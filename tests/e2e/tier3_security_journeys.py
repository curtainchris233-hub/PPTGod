"""Tier 3 E2E Tests: ALL 22 Security/Privacy Invariants (S1-S22) + 3 Cross-Feature Journeys.

Contains 25 granular tests:
- T3_SEC_S01 .. T3_SEC_S22 (one dedicated, strictly-asserted test per invariant S1-S22)
- T3_JRN_A, T3_JRN_B, T3_JRN_C (3 full multi-step Playwright journeys)
"""

from __future__ import annotations

import json
import re

from tests.e2e.config import (
    ACCOUNT_CHEN,
    ACCOUNT_DEMO,
    DESKTOP_VIEWPORT,
    GUEST_FAVS_STORAGE_KEY,
    make_valid_deck_payload,
    make_valid_prompt_payload,
    make_valid_slides,
    unique_token,
)
from tests.e2e.helpers import (
    DbHygieneHelper,
    HtmlDeckVerifier,
    MockOpenAIServer,
    PptxVerifier,
    TestCaseSpec,
    TestContext,
    first_visible,
)
from tests.e2e.tier1_features import (
    load_preset_and_generate,
    switch_generate_style_to_dark_obsidian,
)


# ---------------------------------------------------------------------------
# Security Invariants S1 - S14 (Prompt Privacy, Visibility & Ownership)
# ---------------------------------------------------------------------------


def t3_sec_s01_private_prompt_excluded_from_public_list(ctx: TestContext) -> None:
    """S1: Private prompt is excluded from GET /api/prompts & search q for Anonymous and User B."""
    anon = ctx.api()
    author_a = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    user_b = ctx.api_logged_in(ACCOUNT_CHEN.email, ACCOUNT_CHEN.password)

    tok = unique_token("S01")
    with ctx.cleanup() as cleanup:
        created = (
            author_a.post(
                "/api/prompts",
                json_body=make_valid_prompt_payload(
                    title=f"[E2E-PRIV-{tok}] 绝密风格", is_public=False
                ),
            )
            .assert_status(201)
            .require_json()["prompt"]
        )
        pid = created["id"]
        cleanup.register_delete_prompt(author_a, pid)
        assert created["isPublic"] is False

        for role_name, client in (("anon", anon), ("user_b", user_b)):
            default_list = client.get("/api/prompts").assert_status(200).require_json()["prompts"]
            assert all(p["id"] != pid for p in default_list), (
                f"S1 VIOLATION: private prompt {pid} leaked in default GET /api/prompts for {role_name}"
            )
            search_list = (
                client.get("/api/prompts", params={"q": tok})
                .assert_status(200)
                .require_json()["prompts"]
            )
            assert all(p["id"] != pid for p in search_list), (
                f"S1 VIOLATION: private prompt {pid} leaked in ?q={tok} for {role_name}"
            )


def t3_sec_s02_private_prompt_included_in_author_scope_mine(ctx: TestContext) -> None:
    """S2: Private prompt is included in GET /api/prompts?scope=mine for Author A with isPublic=false."""
    author_a = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    with ctx.cleanup() as cleanup:
        created = (
            author_a.post(
                "/api/prompts",
                json_body=make_valid_prompt_payload(title_prefix="[E2E-S02]", is_public=False),
            )
            .assert_status(201)
            .require_json()["prompt"]
        )
        pid = created["id"]
        cleanup.register_delete_prompt(author_a, pid)

        mine = (
            author_a.get("/api/prompts", params={"scope": "mine"})
            .assert_status(200)
            .require_json()["prompts"]
        )
        matches = [p for p in mine if p["id"] == pid]
        assert len(matches) == 1, f"S2 VIOLATION: own private prompt {pid} missing from scope=mine"
        assert matches[0]["isPublic"] is False


def t3_sec_s03_private_prompt_excluded_from_foreign_favorites_liked(ctx: TestContext) -> None:
    """S3: Foreign prompt liked/favorited by User B disappears from User B's lists when flipped private."""
    author_a = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    user_b = ctx.api_logged_in(ACCOUNT_CHEN.email, ACCOUNT_CHEN.password)

    with ctx.cleanup() as cleanup:
        created = (
            author_a.post(
                "/api/prompts",
                json_body=make_valid_prompt_payload(title_prefix="[E2E-S03]", is_public=True),
            )
            .assert_status(201)
            .require_json()["prompt"]
        )
        pid = created["id"]
        cleanup.register_delete_prompt(author_a, pid)

        user_b.post(f"/api/prompts/{pid}/like").assert_status(200)
        user_b.post(f"/api/prompts/{pid}/favorite").assert_status(200)

        # Confirm present while public
        favs_before = (
            user_b.get("/api/prompts", params={"scope": "favorites"}).assert_status(200).require_json()["prompts"]
        )
        liked_before = (
            user_b.get("/api/prompts", params={"scope": "liked"}).assert_status(200).require_json()["prompts"]
        )
        assert any(p["id"] == pid for p in favs_before), "Precondition failed: not in User B favorites"
        assert any(p["id"] == pid for p in liked_before), "Precondition failed: not in User B liked"

        # Author A flips to private
        author_a.patch(f"/api/prompts/{pid}", json_body={"isPublic": False}).assert_status(200)

        favs_after = (
            user_b.get("/api/prompts", params={"scope": "favorites"}).assert_status(200).require_json()["prompts"]
        )
        liked_after = (
            user_b.get("/api/prompts", params={"scope": "liked"}).assert_status(200).require_json()["prompts"]
        )
        assert all(p["id"] != pid for p in favs_after), (
            "S3 VIOLATION: Author A's newly private prompt still leaked in User B's scope=favorites"
        )
        assert all(p["id"] != pid for p in liked_after), (
            "S3 VIOLATION: Author A's newly private prompt still leaked in User B's scope=liked"
        )


def t3_sec_s04_private_prompt_api_404_for_anon_and_other(ctx: TestContext) -> None:
    """S4: GET /api/prompts/[privateId] and [privateSlug] return 404 for Anonymous and User B."""
    anon = ctx.api()
    author_a = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    user_b = ctx.api_logged_in(ACCOUNT_CHEN.email, ACCOUNT_CHEN.password)

    with ctx.cleanup() as cleanup:
        created = (
            author_a.post(
                "/api/prompts",
                json_body=make_valid_prompt_payload(title_prefix="[E2E-S04]", is_public=False),
            )
            .assert_status(201)
            .require_json()["prompt"]
        )
        pid, slug = created["id"], created["slug"]
        cleanup.register_delete_prompt(author_a, pid)

        for role, client in (("anon", anon), ("user_b", user_b)):
            client.get(f"/api/prompts/{pid}").assert_status(404, f"S4 {role} by id")
            client.get(f"/api/prompts/{slug}").assert_status(404, f"S4 {role} by slug")


def t3_sec_s05_private_prompt_api_200_for_author(ctx: TestContext) -> None:
    """S5: GET /api/prompts/[privateId] and [privateSlug] return 200 with isPublic=false for Author A."""
    author_a = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    with ctx.cleanup() as cleanup:
        created = (
            author_a.post(
                "/api/prompts",
                json_body=make_valid_prompt_payload(title_prefix="[E2E-S05]", is_public=False),
            )
            .assert_status(201)
            .require_json()["prompt"]
        )
        pid, slug = created["id"], created["slug"]
        cleanup.register_delete_prompt(author_a, pid)

        by_id = author_a.get(f"/api/prompts/{pid}").assert_status(200, "S5 by id").require_json()["prompt"]
        by_slug = author_a.get(f"/api/prompts/{slug}").assert_status(200, "S5 by slug").require_json()["prompt"]
        assert by_id["id"] == by_slug["id"] == pid
        assert by_id["isPublic"] is False
        assert by_slug["isPublic"] is False


def t3_sec_s06_private_prompt_ssr_studio_404_no_title_leak(ctx: TestContext) -> None:
    """S6: SSR GET /studio/[privateSlug] returns 404 and does NOT leak private title in HTML/<title>."""
    anon = ctx.api()
    author_a = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    user_b = ctx.api_logged_in(ACCOUNT_CHEN.email, ACCOUNT_CHEN.password)

    secret_marker = f"S06_CONFIDENTIAL_{unique_token('X')}"
    with ctx.cleanup() as cleanup:
        created = (
            author_a.post(
                "/api/prompts",
                json_body=make_valid_prompt_payload(
                    title=f"[E2E] {secret_marker}", is_public=False
                ),
            )
            .assert_status(201)
            .require_json()["prompt"]
        )
        pid, slug = created["id"], created["slug"]
        cleanup.register_delete_prompt(author_a, pid)

        for role, client in (("anon", anon), ("user_b", user_b)):
            resp = client.get(f"/studio/{slug}").assert_status(404, f"S6 SSR /studio/{slug} ({role})")
            html_body = resp.text()
            assert secret_marker not in html_body, (
                f"S6 VIOLATION: private prompt title {secret_marker!r} leaked in SSR 404 HTML for {role}"
            )


def t3_sec_s07_private_prompt_ssr_studio_200_for_author(ctx: TestContext) -> None:
    """S7: SSR GET /studio/[privateSlug] returns 200 for Author A with private title rendered."""
    author_a = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    marker = f"S07_OWNER_VIEW_{unique_token('X')}"
    with ctx.cleanup() as cleanup:
        created = (
            author_a.post(
                "/api/prompts",
                json_body=make_valid_prompt_payload(title=f"[E2E] {marker}", is_public=False),
            )
            .assert_status(201)
            .require_json()["prompt"]
        )
        pid, slug = created["id"], created["slug"]
        cleanup.register_delete_prompt(author_a, pid)

        resp = author_a.get(f"/studio/{slug}").assert_status(200, "S7 SSR /studio/[privateSlug] owner")
        body = resp.text()
        assert marker in body, f"S7 VIOLATION: owner SSR studio page missing private title {marker!r}"


def t3_sec_s08_private_prompt_excluded_from_ssr_gallery_compare_creator(ctx: TestContext) -> None:
    """S8: SSR GET /, /compare, and /creator/demo_designer exclude Author A's private prompt."""
    anon = ctx.api()
    author_a = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    user_b = ctx.api_logged_in(ACCOUNT_CHEN.email, ACCOUNT_CHEN.password)

    secret_marker = f"S08_HIDDEN_{unique_token('X')}"
    with ctx.cleanup() as cleanup:
        created = (
            author_a.post(
                "/api/prompts",
                json_body=make_valid_prompt_payload(
                    title=f"[E2E] {secret_marker}", is_public=False
                ),
            )
            .assert_status(201)
            .require_json()["prompt"]
        )
        pid, slug = created["id"], created["slug"]
        cleanup.register_delete_prompt(author_a, pid)

        for route in ("/", "/compare", f"/creator/{ACCOUNT_DEMO.username}"):
            for role, client in (("anon", anon), ("user_b", user_b)):
                resp = client.get(route).assert_status(200, f"S8 SSR {route} ({role})")
                html_text = resp.text()
                assert secret_marker not in html_text and slug not in html_text, (
                    f"S8 VIOLATION: private prompt leaked in SSR {route} for {role}"
                )


def t3_sec_s09_creator_profile_excludes_private_shows_private_count_owner_only(ctx: TestContext) -> None:
    """S9: /api/creators/demo_designer excludes private prompt from public prompts/impact; privateCount owner-only."""
    anon = ctx.api()
    author_a = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    user_b = ctx.api_logged_in(ACCOUNT_CHEN.email, ACCOUNT_CHEN.password)

    baseline = (
        anon.get(f"/api/creators/{ACCOUNT_DEMO.username}").assert_status(200).require_json()
    )
    base_published = int(baseline["impact"]["publishedCount"])
    base_likes = int(baseline["impact"]["totalLikes"])

    with ctx.cleanup() as cleanup:
        created = (
            author_a.post(
                "/api/prompts",
                json_body=make_valid_prompt_payload(title_prefix="[E2E-S09]", is_public=False),
            )
            .assert_status(201)
            .require_json()["prompt"]
        )
        pid = created["id"]
        cleanup.register_delete_prompt(author_a, pid)

        for role, client, expect_priv_count in (
            ("anon", anon, False),
            ("user_b", user_b, False),
            ("author_a", author_a, True),
        ):
            data = (
                client.get(f"/api/creators/{ACCOUNT_DEMO.username}")
                .assert_status(200, f"S9 creator profile ({role})")
                .require_json()
            )
            assert all(p["id"] != pid for p in data["prompts"]), (
                f"S9 VIOLATION: private prompt appeared in public prompts[] for {role}"
            )
            assert int(data["impact"]["publishedCount"]) == base_published, (
                f"S9 VIOLATION: private prompt inflated publishedCount for {role}"
            )
            assert int(data["impact"]["totalLikes"]) == base_likes, (
                f"S9 VIOLATION: private prompt auto-like inflated totalLikes for {role}"
            )
            priv_count = int(data["privateCount"])
            if expect_priv_count:
                assert priv_count >= 1, (
                    f"S9 VIOLATION: owner expected privateCount >= 1, got {priv_count}"
                )
            else:
                assert priv_count == 0, (
                    f"S9 VIOLATION: non-owner ({role}) received privateCount={priv_count}, expected 0"
                )


def t3_sec_s10_private_prompt_interactions_blocked_for_non_author(ctx: TestContext) -> None:
    """S10: Non-author/Anon blocked (404 / 401) on private prompt comments, like, favorite & copy."""
    anon = ctx.api()
    author_a = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    user_b = ctx.api_logged_in(ACCOUNT_CHEN.email, ACCOUNT_CHEN.password)

    with ctx.cleanup() as cleanup:
        created = (
            author_a.post(
                "/api/prompts",
                json_body=make_valid_prompt_payload(title_prefix="[E2E-S10]", is_public=False),
            )
            .assert_status(201)
            .require_json()["prompt"]
        )
        pid = created["id"]
        cleanup.register_delete_prompt(author_a, pid)

        # User B: strict 404 on every interaction
        user_b.get(f"/api/prompts/{pid}/comments").assert_status(404, "S10 user_b GET comments")
        user_b.post(
            f"/api/prompts/{pid}/comments",
            json_body={"testedTool": "claude-html", "rating": 5, "content": "尝试越权评论私有风格"},
        ).assert_status(404, "S10 user_b POST comments")
        user_b.post(f"/api/prompts/{pid}/like").assert_status(404, "S10 user_b POST like")
        user_b.post(f"/api/prompts/{pid}/favorite").assert_status(404, "S10 user_b POST favorite")
        user_b.post(f"/api/prompts/{pid}/copy").assert_status(404, "S10 user_b POST copy")

        # Anonymous: strict 404 on unauth-readable endpoints, 401 or 404 on auth-required mutations
        anon.get(f"/api/prompts/{pid}/comments").assert_status(404, "S10 anon GET comments")
        anon.post(f"/api/prompts/{pid}/copy").assert_status(404, "S10 anon POST copy")
        anon.post(f"/api/prompts/{pid}/like").assert_status((401, 404), "S10 anon POST like")
        anon.post(f"/api/prompts/{pid}/favorite").assert_status((401, 404), "S10 anon POST favorite")
        anon.post(
            f"/api/prompts/{pid}/comments",
            json_body={"testedTool": "claude-html", "rating": 5, "content": "匿名越权评论测试"},
        ).assert_status((401, 404), "S10 anon POST comments")

        # Verify counters remained completely untouched
        after = author_a.get(f"/api/prompts/{pid}").assert_status(200).require_json()["prompt"]
        assert int(after["copiesCount"]) == 0
        assert int(after["savesCount"]) == 0
        assert int(after["commentsCount"]) == 0


def t3_sec_s11_private_prompt_comments_and_copy_200_for_author(ctx: TestContext) -> None:
    """S11: Author A gets 200 on GET comments & POST copy for own private prompt."""
    author_a = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    with ctx.cleanup() as cleanup:
        created = (
            author_a.post(
                "/api/prompts",
                json_body=make_valid_prompt_payload(title_prefix="[E2E-S11]", is_public=False),
            )
            .assert_status(201)
            .require_json()["prompt"]
        )
        pid = created["id"]
        cleanup.register_delete_prompt(author_a, pid)

        comments_resp = (
            author_a.get(f"/api/prompts/{pid}/comments")
            .assert_status(200, "S11 owner GET comments on private prompt")
            .require_json()
        )
        assert isinstance(comments_resp.get("comments"), list)

        copy_resp = (
            author_a.post(f"/api/prompts/{pid}/copy")
            .assert_status(200, "S11 owner POST copy on private prompt")
            .require_json()
        )
        assert int(copy_resp["copiesCount"]) == 1


def t3_sec_s12_sync_favorites_ignores_foreign_private_prompt(ctx: TestContext) -> None:
    """S12: User B calling POST /api/prompts/sync-favorites with Author A's private ID syncs 0."""
    author_a = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    user_b = ctx.api_logged_in(ACCOUNT_CHEN.email, ACCOUNT_CHEN.password)

    with ctx.cleanup() as cleanup:
        created = (
            author_a.post(
                "/api/prompts",
                json_body=make_valid_prompt_payload(title_prefix="[E2E-S12]", is_public=False),
            )
            .assert_status(201)
            .require_json()["prompt"]
        )
        pid = created["id"]
        cleanup.register_delete_prompt(author_a, pid)

        sync_json = (
            user_b.post("/api/prompts/sync-favorites", json_body={"promptIds": [pid]})
            .assert_status(200, "S12 sync-favorites foreign private")
            .require_json()
        )
        assert int(sync_json["synced"]) == 0, (
            f"S12 VIOLATION: User B synced Author A's private prompt: {sync_json}"
        )
        detail = author_a.get(f"/api/prompts/{pid}").assert_status(200).require_json()["prompt"]
        assert int(detail["savesCount"]) == 0, "S12 VIOLATION: private prompt savesCount incremented"


def t3_sec_s13_prompt_put_patch_delete_strict_ownership(ctx: TestContext) -> None:
    """S13: Prompt PUT/PATCH/DELETE enforce 401 (Anon), 403/404 (User B), 200 (Author A)."""
    anon = ctx.api()
    author_a = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    user_b = ctx.api_logged_in(ACCOUNT_CHEN.email, ACCOUNT_CHEN.password)

    payload = make_valid_prompt_payload(title_prefix="[E2E-S13]", is_public=True)
    with ctx.cleanup() as cleanup:
        created = (
            author_a.post("/api/prompts", json_body=payload)
            .assert_status(201)
            .require_json()["prompt"]
        )
        pid = created["id"]
        cleanup.register_delete_prompt(author_a, pid)

        # Public prompt: Anon -> 401, User B -> strict 403
        anon.put(f"/api/prompts/{pid}", json_body=payload).assert_status(401, "S13 anon PUT")
        anon.patch(f"/api/prompts/{pid}", json_body={"isPublic": False}).assert_status(401, "S13 anon PATCH")
        anon.delete(f"/api/prompts/{pid}").assert_status(401, "S13 anon DELETE")

        user_b.put(f"/api/prompts/{pid}", json_body=payload).assert_status(403, "S13 user_b PUT public")
        user_b.patch(f"/api/prompts/{pid}", json_body={"isPublic": False}).assert_status(403, "S13 user_b PATCH public")
        user_b.delete(f"/api/prompts/{pid}").assert_status(403, "S13 user_b DELETE public")

        # Author A flips to private -> User B gets 403 or 404
        author_a.patch(f"/api/prompts/{pid}", json_body={"isPublic": False}).assert_status(200)
        user_b.put(f"/api/prompts/{pid}", json_body=payload).assert_status((403, 404), "S13 user_b PUT private")
        user_b.patch(f"/api/prompts/{pid}", json_body={"isPublic": True}).assert_status((403, 404), "S13 user_b PATCH private")
        user_b.delete(f"/api/prompts/{pid}").assert_status((403, 404), "S13 user_b DELETE private")

        # Author A succeeds on PUT, PATCH, DELETE
        author_a.put(f"/api/prompts/{pid}", json_body={**payload, "title": f"[E2E-S13-OK] {unique_token('P')}"}).assert_status(200)
        author_a.patch(f"/api/prompts/{pid}", json_body={"isPublic": True}).assert_status(200)
        author_a.delete(f"/api/prompts/{pid}").assert_status(200)


def t3_sec_s14_private_remix_origin_not_leaked_on_public_child(ctx: TestContext) -> None:
    """S14: When remix origin A becomes private, public child B hides remixedFrom for Anon & User B."""
    anon = ctx.api()
    author_a = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    user_b = ctx.api_logged_in(ACCOUNT_CHEN.email, ACCOUNT_CHEN.password)

    secret_origin_tok = f"ORIGIN_PRIV_{unique_token('O')}"
    with ctx.cleanup() as cleanup:
        origin_a = (
            author_a.post(
                "/api/prompts",
                json_body=make_valid_prompt_payload(
                    title=f"[E2E] {secret_origin_tok}", is_public=True
                ),
            )
            .assert_status(201)
            .require_json()["prompt"]
        )
        origin_id, origin_slug = origin_a["id"], origin_a["slug"]
        cleanup.register_delete_prompt(author_a, origin_id)

        child_b = (
            user_b.post(
                "/api/prompts",
                json_body=make_valid_prompt_payload(
                    title_prefix="[E2E-S14-CHILD]",
                    is_public=True,
                    remixed_from_id=origin_id,
                ),
            )
            .assert_status(201)
            .require_json()["prompt"]
        )
        child_id = child_b["id"]
        cleanup.register_delete_prompt(user_b, child_id)
        assert (child_b.get("remixedFrom") or {}).get("id") == origin_id, (
            "Precondition failed: public origin not linked on child B"
        )

        # Author A flips Origin A to private
        author_a.patch(f"/api/prompts/{origin_id}", json_body={"isPublic": False}).assert_status(200)

        for role, client in (("anon", anon), ("user_b", user_b)):
            detail_resp = client.get(f"/api/prompts/{child_id}").assert_status(200)
            detail_prompt = detail_resp.require_json()["prompt"]
            assert detail_prompt.get("remixedFrom") is None, (
                f"S14 VIOLATION: private remix origin leaked on detail for {role}: {detail_prompt.get('remixedFrom')}"
            )
            assert secret_origin_tok not in detail_resp.text() and origin_slug not in detail_resp.text(), (
                f"S14 VIOLATION: private origin title/slug leaked in raw detail JSON for {role}"
            )

            list_resp = client.get("/api/prompts").assert_status(200)
            listed_child = next(
                (p for p in list_resp.require_json()["prompts"] if p["id"] == child_id), None
            )
            assert listed_child is not None
            assert listed_child.get("remixedFrom") is None, (
                f"S14 VIOLATION: private remix origin leaked in list API for {role}"
            )


# ---------------------------------------------------------------------------
# Security Invariants S15 - S20 (Saved Decks Privacy, Sharing & Cloning)
# ---------------------------------------------------------------------------


def t3_sec_s15_saved_deck_private_by_default(ctx: TestContext) -> None:
    """S15: POST /api/decks omitting isPublic persists with isPublic === false."""
    author_a = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    with ctx.cleanup() as cleanup:
        payload = make_valid_deck_payload(is_public=None)
        assert "isPublic" not in payload
        deck = (
            author_a.post("/api/decks", json_body=payload)
            .assert_status(201)
            .require_json()["deck"]
        )
        cleanup.register_delete_deck(author_a, deck["id"])
        assert deck.get("isPublic") is False, f"S15 VIOLATION: default deck isPublic={deck.get('isPublic')!r}"


def t3_sec_s16_private_deck_get_403_for_anon_and_other(ctx: TestContext) -> None:
    """S16: Private deck GET /api/decks/[id] returns exact 403 for Anonymous and User B."""
    anon = ctx.api()
    author_a = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    user_b = ctx.api_logged_in(ACCOUNT_CHEN.email, ACCOUNT_CHEN.password)

    with ctx.cleanup() as cleanup:
        deck = (
            author_a.post("/api/decks", json_body=make_valid_deck_payload(is_public=False))
            .assert_status(201)
            .require_json()["deck"]
        )
        deck_id = deck["id"]
        cleanup.register_delete_deck(author_a, deck_id)

        anon.get(f"/api/decks/{deck_id}").assert_status(403, "S16 anon GET private deck")
        user_b.get(f"/api/decks/{deck_id}").assert_status(403, "S16 user_b GET private deck")


def t3_sec_s17_private_deck_get_200_for_author(ctx: TestContext) -> None:
    """S17: Private deck GET /api/decks/[id] returns 200 with isPublic=false for Author A."""
    author_a = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    with ctx.cleanup() as cleanup:
        deck = (
            author_a.post("/api/decks", json_body=make_valid_deck_payload(is_public=False))
            .assert_status(201)
            .require_json()["deck"]
        )
        deck_id = deck["id"]
        cleanup.register_delete_deck(author_a, deck_id)

        fetched = author_a.get(f"/api/decks/{deck_id}").assert_status(200, "S17 owner GET private deck").require_json()["deck"]
        assert fetched["id"] == deck_id
        assert fetched["isPublic"] is False


def t3_sec_s18_public_deck_get_200_and_non_destructive_foreign_clone(ctx: TestContext) -> None:
    """S18: Public deck GET 200 for all; foreign POST with same id creates non-destructive clone."""
    anon = ctx.api()
    author_a = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    user_b = ctx.api_logged_in(ACCOUNT_CHEN.email, ACCOUNT_CHEN.password)

    orig_title = f"[E2E-S18-ORIG] 原版公开文稿 {unique_token('O')}"
    with ctx.cleanup() as cleanup:
        deck = (
            author_a.post("/api/decks", json_body=make_valid_deck_payload(title=orig_title, is_public=False))
            .assert_status(201)
            .require_json()["deck"]
        )
        deck_id = deck["id"]
        cleanup.register_delete_deck(author_a, deck_id)

        # Author A enables public sharing
        author_a.patch(f"/api/decks/{deck_id}", json_body={"isPublic": True}).assert_status(200)

        for role, client in (("anon", anon), ("user_b", user_b)):
            got = client.get(f"/api/decks/{deck_id}").assert_status(200, f"S18 {role} GET public deck").require_json()["deck"]
            assert got["isPublic"] is True
            assert got["title"] == orig_title

        # User B saves passing Author A's deck id -> MUST clone, NEVER overwrite Author A's deck
        clone_title = f"[E2E-S18-CLONE] 副本 {unique_token('C')}"
        clone_resp = user_b.post(
            "/api/decks",
            json_body=make_valid_deck_payload(title=clone_title, deck_id=deck_id),
        ).assert_status((201, 200), "S18 user_b foreign clone save")
        cloned = clone_resp.require_json()["deck"]
        clone_id = cloned["id"]
        cleanup.register_delete_deck(user_b, clone_id)

        assert clone_id != deck_id, (
            f"S18 VIOLATION: foreign save reused Author A's deck ID {deck_id!r} instead of cloning"
        )
        assert cloned["authorId"] == ACCOUNT_CHEN.id
        assert cloned["title"] == clone_title

        # Author A's original deck MUST remain completely intact
        orig_after = author_a.get(f"/api/decks/{deck_id}").assert_status(200).require_json()["deck"]
        assert orig_after["title"] == orig_title, (
            f"S18 VIOLATION: Author A's deck title was mutated to {orig_after['title']!r}"
        )


def t3_sec_s19_deck_patch_put_delete_strict_ownership(ctx: TestContext) -> None:
    """S19: Deck PATCH/PUT/DELETE enforce 401 (Anon), strict 403 (User B), 200 (Author A)."""
    anon = ctx.api()
    author_a = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    user_b = ctx.api_logged_in(ACCOUNT_CHEN.email, ACCOUNT_CHEN.password)

    payload = make_valid_deck_payload(is_public=False)
    with ctx.cleanup() as cleanup:
        deck = author_a.post("/api/decks", json_body=payload).assert_status(201).require_json()["deck"]
        deck_id = deck["id"]
        cleanup.register_delete_deck(author_a, deck_id)

        anon.patch(f"/api/decks/{deck_id}", json_body={"isPublic": True}).assert_status(401, "S19 anon PATCH")
        anon.put(f"/api/decks/{deck_id}", json_body=payload).assert_status(401, "S19 anon PUT")
        anon.delete(f"/api/decks/{deck_id}").assert_status(401, "S19 anon DELETE")

        user_b.patch(f"/api/decks/{deck_id}", json_body={"isPublic": True}).assert_status(403, "S19 user_b PATCH")
        user_b.put(f"/api/decks/{deck_id}", json_body=payload).assert_status(403, "S19 user_b PUT")
        user_b.delete(f"/api/decks/{deck_id}").assert_status(403, "S19 user_b DELETE")

        author_a.patch(f"/api/decks/{deck_id}", json_body={"isPublic": True}).assert_status(200, "S19 owner PATCH")
        author_a.put(f"/api/decks/{deck_id}", json_body={**payload, "title": f"[E2E-S19] {unique_token('D')}"}).assert_status(200, "S19 owner PUT")
        author_a.delete(f"/api/decks/{deck_id}").assert_status(200, "S19 owner DELETE")


def t3_sec_s20_deck_list_strict_user_isolation(ctx: TestContext) -> None:
    """S20: GET /api/decks returns [] for Anon, strictly own decks for Author A, never visible to User B."""
    anon = ctx.api()
    author_a = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    user_b = ctx.api_logged_in(ACCOUNT_CHEN.email, ACCOUNT_CHEN.password)

    with ctx.cleanup() as cleanup:
        deck = (
            author_a.post("/api/decks", json_body=make_valid_deck_payload(is_public=True))
            .assert_status(201)
            .require_json()["deck"]
        )
        deck_id = deck["id"]
        cleanup.register_delete_deck(author_a, deck_id)

        anon_decks = anon.get("/api/decks").assert_status(200).require_json()["decks"]
        assert anon_decks == [], f"S20 VIOLATION: anonymous GET /api/decks returned {anon_decks}"

        b_decks = user_b.get("/api/decks").assert_status(200).require_json()["decks"]
        assert all(d["id"] != deck_id for d in b_decks), (
            f"S20 VIOLATION: Author A's deck {deck_id} appeared in User B's GET /api/decks"
        )

        a_decks = author_a.get("/api/decks").assert_status(200).require_json()["decks"]
        assert any(d["id"] == deck_id for d in a_decks), (
            f"S20 VIOLATION: Author A's own deck {deck_id} missing from GET /api/decks"
        )


# ---------------------------------------------------------------------------
# Security Invariants S21 & S22 (Comment Ownership & BYOK Secret Hygiene)
# ---------------------------------------------------------------------------


def t3_sec_s21_comment_delete_strict_ownership(ctx: TestContext) -> None:
    """S21: DELETE /api/prompts/[id]/comments enforces 401 (Anon), 403 (User B), 200 (Comment Author)."""
    anon = ctx.api()
    author_a = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    user_b = ctx.api_logged_in(ACCOUNT_CHEN.email, ACCOUNT_CHEN.password)
    pid = "prompt_swiss_grid"
    marker = f"[E2E-S21-{unique_token('C')}] 评论归属权隔离测试"

    with ctx.cleanup() as cleanup:
        comments = (
            author_a.post(
                f"/api/prompts/{pid}/comments",
                json_body={"testedTool": "claude-html", "rating": 5, "content": marker},
            )
            .assert_status(201)
            .require_json()["comments"]
        )
        created = next(c for c in comments if c.get("content") == marker)
        cid = created["id"]
        cleanup.register_delete_comment(author_a, pid, cid)

        anon.delete(f"/api/prompts/{pid}/comments", params={"commentId": cid}).assert_status(
            401, "S21 anon DELETE comment"
        )
        user_b.delete(f"/api/prompts/{pid}/comments", params={"commentId": cid}).assert_status(
            403, "S21 user_b DELETE foreign comment"
        )
        author_a.delete(f"/api/prompts/{pid}/comments", params={"commentId": cid}).assert_status(
            200, "S21 author DELETE own comment"
        )


def t3_sec_s22_byok_api_key_non_leakage_and_non_persistence(ctx: TestContext) -> None:
    """S22: BYOK apiKey is sent ONLY to upstream Authorization header, never echoed or persisted in SQLite."""
    client = ctx.api()
    canary_key = f"sk-e2e-canary-{unique_token('K')}-9876543210-secret"
    slides = make_valid_slides(4, custom_title="S22 Canary Key Safety Check")

    with MockOpenAIServer(mode="valid_json", slides=slides) as mock_llm:
        resp = client.post(
            "/api/generate",
            json_body={
                "topic": "S22 密钥不落盘与不泄漏验证",
                "mode": "llm",
                "apiBase": mock_llm.base_url,
                "apiKey": canary_key,
                "model": "gpt-4o-mini",
                "slideCount": 5,
            },
        ).assert_status(200, "S22 /api/generate llm")

        assert len(mock_llm.requests) == 1
        assert mock_llm.requests[0].authorization == f"Bearer {canary_key}", (
            "Mock upstream did not receive exact Bearer canary key"
        )

        # Must NEVER appear in response body or response headers
        assert canary_key not in resp.text(), "S22 VIOLATION: BYOK apiKey echoed in response body!"
        for hdr_k, hdr_v in resp.headers.items():
            assert canary_key not in hdr_v, (
                f"S22 VIOLATION: BYOK apiKey leaked in response header {hdr_k!r}"
            )

        # Must NEVER be persisted anywhere in data/pptgod.db
        if ctx.config.db_path.exists():
            db_hits = DbHygieneHelper.scan_for_secret(ctx.config.db_path, canary_key)
            assert db_hits == [], (
                f"S22 VIOLATION: BYOK canary apiKey persisted in SQLite DB at: {db_hits}"
            )
            ctx.details["db_secret_scan"] = "clean_0_hits"


# ---------------------------------------------------------------------------
# Cross-Feature End-to-End Browser Journeys (3 Full Playwright Journeys)
# ---------------------------------------------------------------------------


def t3_jrn_a_guest_fav_login_auto_sync_collections(ctx: TestContext) -> None:
    """Journey A: Guest favorites style -> localStorage populated -> Demo Login auto-syncs -> /collections."""
    target_id = "prompt_soft_bento"
    target_slug = "apple-soft-bento-modular"
    author_api = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    orig_detail = author_api.get(f"/api/prompts/{target_id}").assert_status(200).require_json()["prompt"]
    orig_faved = bool(orig_detail.get("favoritedByMe", False))

    with ctx.cleanup() as cleanup:
        cleanup.register_restore_toggle(author_api, target_id, "favorite", expected_state=orig_faved)
        # Ensure target starts unfavorited for demo_designer so sync_favorites reports synced >= 1
        if orig_faved:
            author_api.post(f"/api/prompts/{target_id}/favorite").assert_status(200)

        with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
            page = guard.page
            guard.goto_ok(ctx.url("/"))

            card = (
                page.locator(f'article[data-prompt-slug="{target_slug}"]')
                .or_(page.locator("article").filter(has=page.locator(f'a[href="/studio/{target_slug}"]')))
                .first
            )
            card.wait_for(state="visible")
            fav_btn = card.locator('button[title*="收藏"]').or_(
                card.get_by_role("button", name=re.compile(r"收藏"))
            ).first
            fav_btn.click()
            page.wait_for_timeout(200)

            stored_raw = page.evaluate("(k) => localStorage.getItem(k)", GUEST_FAVS_STORAGE_KEY)
            stored_ids = json.loads(stored_raw or "[]")
            assert target_id in stored_ids, (
                f"Journey A: expected {target_id} in localStorage[{GUEST_FAVS_STORAGE_KEY}], got {stored_ids}"
            )

            # Open AuthModal and intercept POST /api/prompts/sync-favorites on demo login
            login_btn = first_visible(
                [
                    page.locator("#pg-nav-login-btn"),
                    page.get_by_role("button", name=re.compile(r"登录\s*/?\s*注册|立即登录|登录")),
                ]
            )
            login_btn.click()
            dialog = page.locator('[role="dialog"]').first
            dialog.wait_for(state="visible")
            demo_btn = first_visible(
                [
                    dialog.locator("#pg-demo-login-btn"),
                    dialog.get_by_role("button", name=re.compile(r"一键登录.*演示|demo@pptgod")),
                ]
            )

            with page.expect_response(
                lambda r: "/api/prompts/sync-favorites" in r.url and r.request.method == "POST",
                timeout=guard._timeout_ms,
            ) as sync_resp_info:
                demo_btn.click()

            sync_resp = sync_resp_info.value
            assert sync_resp.status == 200, f"Auto-sync returned {sync_resp.status}"
            assert int(sync_resp.json().get("synced", 0)) >= 1, (
                f"Expected synced >= 1 on guest favorite auto-sync, got {sync_resp.json()}"
            )

            page.wait_for_function(
                "(k) => { const v = localStorage.getItem(k); return !v || v === '[]'; }",
                arg=GUEST_FAVS_STORAGE_KEY,
                timeout=8000,
            )

            # Visit /collections and verify style appears under 已收藏风格
            guard.goto_ok(ctx.url("/collections"))
            fav_tab = first_visible(
                [
                    page.get_by_role("tab", name=re.compile(r"已收藏")),
                    page.get_by_role("button", name=re.compile(r"已收藏")),
                ]
            )
            fav_tab.click()
            page.wait_for_timeout(250)
            synced_link = page.locator(f'a[href="/studio/{target_slug}"]').first
            synced_link.wait_for(state="visible", timeout=8000)
            assert synced_link.is_visible()
            guard.assert_no_browser_errors("T3_JRN_A")


def t3_jrn_b_matcher_studio_remix_edit_visibility_creator(ctx: TestContext) -> None:
    """Journey B: Matcher -> Studio -> Remix -> Author Edit & Private flip -> Creator Profile & Collections."""
    author_api = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    tok = unique_token("JRNB")
    remix_title = f"[E2E-REMIX-{tok}] 智能选词二创"
    edited_title = f"[E2E-EDIT-{tok}] 私有改版风格"

    with ctx.cleanup() as cleanup:
        with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
            page = guard.page
            guard.login_via_api(ctx.base_url, ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
            guard.goto_ok(ctx.url("/"))

            # 1. Complete 30s StyleMatcherModal -> click first recommended Studio link
            modal = guard.drive_style_matcher_modal()
            first_studio_link = modal.locator('a[href^="/studio/"]').first
            source_href = first_studio_link.get_attribute("href") or ""
            assert source_href.startswith("/studio/"), f"Unexpected studio href: {source_href!r}"
            source_slug = source_href.rsplit("/", 1)[-1]
            first_studio_link.click()
            page.wait_for_url(re.compile(r"/studio/"), timeout=guard._timeout_ms)
            page.wait_for_load_state("networkidle")

            # 2. Click Remix CTA -> /create?fork=<source_slug>
            remix_link = first_visible(
                [
                    page.locator('a[href*="/create?fork="]'),
                    page.get_by_role("link", name=re.compile(r"二创|Remix|改编")),
                ]
            )
            remix_link.click()
            page.wait_for_url(re.compile(r"/create\?fork="), timeout=guard._timeout_ms)
            page.wait_for_load_state("networkidle")

            title_input = first_visible([page.locator("#create-title"), page.get_by_label(re.compile(r"风格名称|标题"))])
            title_input.fill(remix_title)

            publish_btn = first_visible(
                [
                    page.locator("#pg-create-publish-btn"),
                    page.locator('button[type="submit"]'),
                ]
            )
            with page.expect_response(
                lambda r: r.url.rstrip("/").endswith("/api/prompts") and r.request.method == "POST",
                timeout=guard._timeout_ms,
            ) as create_resp_info:
                publish_btn.click()

            create_resp = create_resp_info.value
            assert create_resp.status == 201, f"Journey B remix POST returned {create_resp.status}"
            created_prompt = create_resp.json()["prompt"]
            created_id = created_prompt["id"]
            created_slug = created_prompt["slug"]
            cleanup.register_delete_prompt(author_api, created_id)

            page.wait_for_url(re.compile(rf"/studio/{re.escape(created_slug)}"), timeout=guard._timeout_ms)
            page.wait_for_load_state("networkidle")

            # Verify provenance link back to source style
            prov_link = page.locator(f'a[href="/studio/{source_slug}"]').first
            prov_link.wait_for(state="visible", timeout=8000)

            # 3. Click Author Edit CTA -> /create?edit=<created_slug>
            edit_link = first_visible(
                [
                    page.locator(f'a[href*="/create?edit={created_slug}"]'),
                    page.locator('a[href*="/create?edit="]'),
                    page.get_by_role("link", name=re.compile(r"编辑风格|编辑此风格|二次编辑|编辑")),
                ]
            )
            edit_link.click()
            page.wait_for_url(re.compile(r"/create\?edit="), timeout=guard._timeout_ms)
            page.wait_for_load_state("networkidle")

            edit_title_input = first_visible([page.locator("#create-title"), page.get_by_label(re.compile(r"风格名称|标题"))])
            edit_title_input.fill(edited_title)

            # Toggle visibility to Private
            priv_opt = first_visible(
                [
                    page.get_by_role("radio", name=re.compile(r"仅自己可见|私有")),
                    page.get_by_role("button", name=re.compile(r"仅自己可见|私有")),
                    page.locator("label").filter(has_text=re.compile(r"仅自己可见|私有")),
                ]
            )
            priv_opt.click()
            page.wait_for_timeout(150)

            save_btn = first_visible(
                [
                    page.locator("#pg-create-publish-btn"),
                    page.locator('button[type="submit"]'),
                ]
            )
            with page.expect_response(
                lambda r: f"/api/prompts/{created_id}" in r.url and r.request.method == "PUT",
                timeout=guard._timeout_ms,
            ) as put_resp_info:
                save_btn.click()

            assert put_resp_info.value.status == 200
            assert put_resp_info.value.json()["prompt"]["isPublic"] is False

            page.wait_for_url(re.compile(rf"/studio/{re.escape(created_slug)}"), timeout=guard._timeout_ms)
            page.wait_for_load_state("networkidle")
            studio_body = page.locator("main").inner_text()
            assert edited_title in studio_body
            assert re.search(r"仅自己可见|私有", studio_body), "Private badge not visible on owner Studio"

            # 4. Creator profile hides private prompt from public portfolio while showing owner private notice
            guard.goto_ok(ctx.url(f"/creator/{ACCOUNT_DEMO.username}"))
            creator_main = page.locator("main").inner_text()
            assert edited_title not in creator_main, (
                "Journey B: private prompt leaked into /creator/demo_designer public portfolio"
            )
            assert re.search(r"私有|仅自己可见|草稿", creator_main), (
                "Journey B: owner private drafts notice missing on /creator/demo_designer"
            )

            # 5. /collections -> 我发布的风格 shows private style
            guard.goto_ok(ctx.url("/collections"))
            pub_tab = first_visible(
                [
                    page.get_by_role("tab", name=re.compile(r"我发布")),
                    page.get_by_role("button", name=re.compile(r"我发布")),
                ]
            )
            pub_tab.click()
            page.wait_for_timeout(300)
            assert page.get_by_text(edited_title).first.is_visible(), (
                "Journey B: private edited style not visible under /collections 我发布的风格"
            )
            guard.assert_no_browser_errors("T3_JRN_B")


def t3_jrn_c_studio_generate_reskin_edit_save_reopen_export(ctx: TestContext) -> None:
    """Journey C: Studio -> /generate?style= -> Re-skin -> Edit -> Save Deck -> /collections -> Reopen -> Export."""
    author_api = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    tok = unique_token("JRNC")
    edited_title = f"[E2E-JRNC-{tok}] 董事会复盘"
    edited_notes = f"JRNC_NOTES_{tok}"

    with ctx.cleanup() as cleanup:
        with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
            page = guard.page
            guard.login_via_api(ctx.base_url, ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)

            # 1. Start on Studio & click Generate PPT CTA
            guard.goto_ok(ctx.url("/studio/apple-soft-bento-modular"))
            gen_cta = page.locator('a[href*="/generate?style=apple-soft-bento-modular"]').first
            gen_cta.click()
            page.wait_for_url(re.compile(r"/generate\?style=apple-soft-bento-modular"), timeout=guard._timeout_ms)
            page.wait_for_load_state("networkidle")

            # 2. Load preset & generate -> live re-skin -> edit title & speaker notes
            gen_data = load_preset_and_generate(guard, preset_index=1)
            orig_title = gen_data["slides"][0]["title"]
            switch_generate_style_to_dark_obsidian(guard)

            exact_idx = page.evaluate(
                """(curTitle) => {
                  const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'));
                  return inputs.findIndex((i) => i.value && curTitle && i.value.includes(curTitle.slice(0, 6)));
                }""",
                orig_title,
            )
            if isinstance(exact_idx, int) and exact_idx >= 0:
                title_inp = page.locator('input[type="text"], input:not([type])').nth(exact_idx)
            else:
                title_inp = first_visible([page.get_by_label(re.compile(r"页面标题|本页标题|主标题|标题"))])
            title_inp.fill(edited_title)

            notes_inp = first_visible(
                [
                    page.get_by_label(re.compile(r"演讲者备注|演讲逐字稿|讲稿")),
                    page.get_by_placeholder(re.compile(r"演讲|讲稿|备注")),
                ]
            )
            notes_inp.fill(edited_notes)
            page.wait_for_timeout(200)

            # 3. Save cloud deck (verify private default)
            save_btn = first_visible(
                [page.get_by_role("button", name=re.compile(r"保存.*云端|保存文稿|保存当前|保存\s*PPT"))]
            )
            with page.expect_response(
                lambda r: r.url.rstrip("/").endswith("/api/decks") and r.request.method == "POST",
                timeout=guard._timeout_ms,
            ) as save_resp_info:
                save_btn.click()

            save_resp = save_resp_info.value
            assert save_resp.status in (200, 201), f"Save deck failed: {save_resp.status}"
            saved_deck = save_resp.json()["deck"]
            deck_id = saved_deck["id"]
            cleanup.register_delete_deck(author_api, deck_id)
            assert saved_deck["isPublic"] is False, "Journey C: saved deck must default to private"

            # 4. Visit /collections -> 我保存的 PPT 文稿 -> toggle public share -> reopen /generate?deck=...
            guard.goto_ok(ctx.url("/collections"))
            decks_tab = first_visible(
                [
                    page.get_by_role("tab", name=re.compile(r"保存.*文稿|PPT\s*文稿|我的文稿")),
                    page.get_by_role("button", name=re.compile(r"保存.*文稿|PPT\s*文稿|我的文稿")),
                ]
            )
            decks_tab.click()
            page.wait_for_timeout(300)

            reopen_link = page.locator(f'a[href*="/generate?deck={deck_id}"]').first
            reopen_link.wait_for(state="visible", timeout=8000)

            # Toggle deck public share via API or card toggle button
            card_container = reopen_link.locator("xpath=ancestor::article | ancestor::div[contains(@class,'card') or contains(@class,'deck')]").first
            toggle_btn = card_container.get_by_role(
                "button", name=re.compile(r"开启公开|公开分享|公开链接|设为公开|切换")
            )
            if toggle_btn.count() > 0 and toggle_btn.first.is_visible():
                with page.expect_response(
                    lambda r: f"/api/decks/{deck_id}" in r.url and r.request.method == "PATCH",
                    timeout=guard._timeout_ms,
                ) as patch_info:
                    toggle_btn.first.click()
                assert patch_info.value.status == 200
                assert patch_info.value.json()["deck"]["isPublic"] is True

            # Reopen deck in /generate?deck=<deck_id>
            reopen_link.click()
            page.wait_for_url(re.compile(rf"/generate\?deck={re.escape(deck_id)}"), timeout=guard._timeout_ms)
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(350)

            reopened_stage = guard.assert_canvas_non_blank(label="journey_c_reopened_deck")
            assert edited_title in reopened_stage["fullText"], (
                f"Journey C: reopened deck did not preserve edited title {edited_title!r}"
            )

            # 5. Export native .pptx and offline .html from reopened deck
            pptx_btn = first_visible(
                [page.get_by_role("button", name=re.compile(r"导出.*\.pptx|下载.*PPTX", re.I))]
            )
            _, pptx_bytes = guard.capture_download(lambda: pptx_btn.click())
            PptxVerifier.verify(
                pptx_bytes,
                min_size=30720,
                expected_min_slides=5,
                expected_slide_texts=[edited_title],
                expected_notes_texts=[edited_notes],
                require_notes=True,
            )

            html_btn = first_visible(
                [page.get_by_role("button", name=re.compile(r"导出.*\.html|离线.*HTML|交互.*HTML", re.I))]
            )
            _, html_bytes = guard.capture_download(lambda: html_btn.click())
            HtmlDeckVerifier.verify(
                html_bytes,
                expected_min_slides=5,
                expected_slide_texts=[edited_title],
                expected_notes_texts=[edited_notes],
            )
            guard.assert_no_browser_errors("T3_JRN_C")


# ---------------------------------------------------------------------------
# Tier 3 Registry Export (25 Tests: S1-S22 + Journeys A, B, C)
# ---------------------------------------------------------------------------


def get_tier3_tests() -> list[TestCaseSpec]:
    return [
        TestCaseSpec("T3_SEC_S01_private_prompt_excluded_from_public_list", 3, "S1: Private prompt excluded from public GET /api/prompts & search", ("security", "api", "S1"), t3_sec_s01_private_prompt_excluded_from_public_list),
        TestCaseSpec("T3_SEC_S02_private_prompt_included_in_author_scope_mine", 3, "S2: Private prompt included in author's scope=mine", ("security", "api", "S2"), t3_sec_s02_private_prompt_included_in_author_scope_mine),
        TestCaseSpec("T3_SEC_S03_private_prompt_excluded_from_foreign_favorites_liked", 3, "S3: Newly private prompt excluded from foreign favorites & liked", ("security", "api", "S3"), t3_sec_s03_private_prompt_excluded_from_foreign_favorites_liked),
        TestCaseSpec("T3_SEC_S04_private_prompt_api_404_for_anon_and_other", 3, "S4: Private prompt API GET returns 404 for Anon & User B", ("security", "api", "S4"), t3_sec_s04_private_prompt_api_404_for_anon_and_other),
        TestCaseSpec("T3_SEC_S05_private_prompt_api_200_for_author", 3, "S5: Private prompt API GET returns 200 for Author A", ("security", "api", "S5"), t3_sec_s05_private_prompt_api_200_for_author),
        TestCaseSpec("T3_SEC_S06_private_prompt_ssr_studio_404_no_title_leak", 3, "S6: SSR /studio/[privateSlug] returns 404 with zero title leak", ("security", "ssr", "S6"), t3_sec_s06_private_prompt_ssr_studio_404_no_title_leak),
        TestCaseSpec("T3_SEC_S07_private_prompt_ssr_studio_200_for_author", 3, "S7: SSR /studio/[privateSlug] returns 200 for Author A", ("security", "ssr", "S7"), t3_sec_s07_private_prompt_ssr_studio_200_for_author),
        TestCaseSpec("T3_SEC_S08_private_prompt_excluded_from_ssr_gallery_compare_creator", 3, "S8: SSR /, /compare, /creator exclude Author A's private prompt", ("security", "ssr", "S8"), t3_sec_s08_private_prompt_excluded_from_ssr_gallery_compare_creator),
        TestCaseSpec("T3_SEC_S09_creator_profile_excludes_private_shows_private_count_owner_only", 3, "S9: Creator profile public stats exclude private; privateCount owner-only", ("security", "api", "S9"), t3_sec_s09_creator_profile_excludes_private_shows_private_count_owner_only),
        TestCaseSpec("T3_SEC_S10_private_prompt_interactions_blocked_for_non_author", 3, "S10: Non-author/Anon blocked on private prompt comments/like/fav/copy", ("security", "api", "S10"), t3_sec_s10_private_prompt_interactions_blocked_for_non_author),
        TestCaseSpec("T3_SEC_S11_private_prompt_comments_and_copy_200_for_author", 3, "S11: Author A gets 200 on own private prompt comments & copy", ("security", "api", "S11"), t3_sec_s11_private_prompt_comments_and_copy_200_for_author),
        TestCaseSpec("T3_SEC_S12_sync_favorites_ignores_foreign_private_prompt", 3, "S12: sync-favorites ignores foreign private prompt IDs (synced=0)", ("security", "api", "S12"), t3_sec_s12_sync_favorites_ignores_foreign_private_prompt),
        TestCaseSpec("T3_SEC_S13_prompt_put_patch_delete_strict_ownership", 3, "S13: Prompt PUT/PATCH/DELETE enforce 401/403/404 ownership", ("security", "api", "S13"), t3_sec_s13_prompt_put_patch_delete_strict_ownership),
        TestCaseSpec("T3_SEC_S14_private_remix_origin_not_leaked_on_public_child", 3, "S14: Private remix origin redacted on public child prompt", ("security", "api", "S14"), t3_sec_s14_private_remix_origin_not_leaked_on_public_child),
        TestCaseSpec("T3_SEC_S15_saved_deck_private_by_default", 3, "S15: Saved deck defaults to isPublic=false when omitted", ("security", "api", "S15"), t3_sec_s15_saved_deck_private_by_default),
        TestCaseSpec("T3_SEC_S16_private_deck_get_403_for_anon_and_other", 3, "S16: Private deck GET returns exact 403 for Anon & User B", ("security", "api", "S16"), t3_sec_s16_private_deck_get_403_for_anon_and_other),
        TestCaseSpec("T3_SEC_S17_private_deck_get_200_for_author", 3, "S17: Private deck GET returns 200 for Author A", ("security", "api", "S17"), t3_sec_s17_private_deck_get_200_for_author),
        TestCaseSpec("T3_SEC_S18_public_deck_get_200_and_non_destructive_foreign_clone", 3, "S18: Public deck GET 200 & foreign save creates non-destructive clone", ("security", "api", "S18"), t3_sec_s18_public_deck_get_200_and_non_destructive_foreign_clone),
        TestCaseSpec("T3_SEC_S19_deck_patch_put_delete_strict_ownership", 3, "S19: Deck PATCH/PUT/DELETE enforce 401/403/200 ownership", ("security", "api", "S19"), t3_sec_s19_deck_patch_put_delete_strict_ownership),
        TestCaseSpec("T3_SEC_S20_deck_list_strict_user_isolation", 3, "S20: GET /api/decks strictly isolates decks per user", ("security", "api", "S20"), t3_sec_s20_deck_list_strict_user_isolation),
        TestCaseSpec("T3_SEC_S21_comment_delete_strict_ownership", 3, "S21: DELETE comment enforces 401/403/200 comment-author ownership", ("security", "api", "S21"), t3_sec_s21_comment_delete_strict_ownership),
        TestCaseSpec("T3_SEC_S22_byok_api_key_non_leakage_and_non_persistence", 3, "S22: BYOK apiKey never echoed in response or persisted in SQLite DB", ("security", "api", "llm", "S22"), t3_sec_s22_byok_api_key_non_leakage_and_non_persistence),
        TestCaseSpec("T3_JRN_A_guest_fav_login_auto_sync_collections", 3, "Journey A: Guest favorite -> Demo Login auto-sync -> /collections", ("journey", "ui", "JourneyA", "F30"), t3_jrn_a_guest_fav_login_auto_sync_collections),
        TestCaseSpec("T3_JRN_B_matcher_studio_remix_edit_visibility_creator", 3, "Journey B: Matcher -> Studio -> Remix -> Edit/Private -> Creator & Collections", ("journey", "ui", "JourneyB", "F10", "F26", "F27", "F31"), t3_jrn_b_matcher_studio_remix_edit_visibility_creator),
        TestCaseSpec("T3_JRN_C_studio_generate_reskin_edit_save_reopen_export", 3, "Journey C: Studio -> Generate -> Re-skin -> Edit -> Save -> Reopen -> .pptx/.html", ("journey", "ui", "JourneyC", "F18", "F22", "F23", "F28"), t3_jrn_c_studio_generate_reskin_edit_save_reopen_export),
    ]
