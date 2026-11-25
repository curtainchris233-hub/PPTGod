"""Tier 1 E2E Tests: Isolated happy-path feature coverage across all 35 features & 7 routes.

Contains 22 granular tests (13 API + 9 Browser UI):
- T1_API_01 .. T1_API_13
- T1_UI_01  .. T1_UI_09
"""

from __future__ import annotations

import re
from typing import Any

from tests.e2e.config import (
    ACCOUNT_DEMO,
    ACCOUNT_OFFICIAL,
    BASELINE_COLOR_COUNTS,
    BASELINE_SCENARIO_COUNTS,
    BASELINE_STYLE_COUNTS,
    BASELINE_TOOL_COUNTS,
    DESKTOP_VIEWPORT,
    DECORATIVE_MOTIFS,
    LAYOUT_ARCHETYPES,
    OFFICIAL_STYLE_IDS,
    OFFICIAL_STYLE_SLUGS,
    PPTX_CONTENT_TYPE,
    SLIDE_TYPE_LABELS,
    SLIDE_TYPES,
    SOURCE_MATERIAL_PRESETS,
    TARGET_TOOLS,
    TOOL_MARKERS,
    make_valid_deck_payload,
    make_valid_prompt_payload,
    unique_token,
)
from tests.e2e.helpers import (
    BrowserPageGuard,
    HtmlDeckVerifier,
    PptxVerifier,
    TestCaseSpec,
    TestContext,
    first_visible,
)


# ---------------------------------------------------------------------------
# Reusable Workshop UI Helpers (Shared with Tier 2 / Tier 3 / Tier 4)
# ---------------------------------------------------------------------------


def load_preset_and_generate(
    guard: BrowserPageGuard,
    preset_index: int = 0,
) -> dict[str, Any]:
    """Load an industry preset on /generate and click Smart Generate, returning /api/generate JSON."""
    page = guard.page
    preset = SOURCE_MATERIAL_PRESETS[preset_index]
    preset_pat = re.compile(preset["label_pattern"])

    preset_btn = page.get_by_role("button", name=preset_pat)
    if preset_btn.count() == 0 or not preset_btn.first.is_visible():
        toggle = first_visible(
            [
                page.get_by_role(
                    "button", name=re.compile(r"生成配置|原始素材|配置面板|重新生成|素材输入|展开配置")
                )
            ],
            timeout_ms=8000,
        )
        toggle.click()
        preset_btn.first.wait_for(state="visible", timeout=8000)

    preset_btn.first.click()
    page.wait_for_timeout(150)

    gen_btn = first_visible(
        [
            page.get_by_role(
                "button",
                name=re.compile(r"一键生成|开始生成|生成整套|立即生成|智能生成|生成\s*PPT"),
            )
        ],
        timeout_ms=8000,
    )

    with page.expect_response(
        lambda r: "/api/generate" in r.url and r.request.method == "POST",
        timeout=guard._timeout_ms,
    ) as resp_info:
        gen_btn.click()

    resp = resp_info.value
    assert resp.status == 200, f"POST /api/generate from /generate UI returned {resp.status}"
    data = resp.json()
    assert isinstance(data.get("slides"), list) and len(data["slides"]) >= 5, (
        f"Expected >= 5 generated slides from /generate UI, got {data!r}"
    )
    page.wait_for_timeout(300)
    return data


def count_generate_tree_slides(page: Any) -> int:
    """Count thumbnail slides in the left filmstrip tree on /generate."""
    return int(
        page.evaluate(
            """() => {
              const thumbs = Array.from(document.querySelectorAll('.pg-slide-outer, [style*="aspect-ratio"]'))
                .filter((el) => {
                  const r = el.getBoundingClientRect();
                  return r.width > 30 && r.width < 280 && r.height > 15;
                });
              return thumbs.length;
            }"""
        )
    )


def switch_generate_style_to_dark_obsidian(guard: BrowserPageGuard) -> None:
    """Switch active visual style on /generate to keynote-obsidian-stage (暗夜星环)."""
    page = guard.page
    # Prefer native <select> containing keynote-obsidian-stage or 暗夜星环
    selects = page.locator("select")
    for idx in range(selects.count()):
        sel = selects.nth(idx)
        if not sel.is_visible():
            continue
        opt_info = sel.evaluate(
            """(el) => Array.from(el.options).map((o) => ({ value: o.value, text: o.text }))"""
        )
        for opt in opt_info:
            if (
                "keynote-obsidian-stage" in opt["value"]
                or "prompt_keynote_obsidian" in opt["value"]
                or "暗夜星环" in opt["text"]
            ):
                sel.select_option(value=opt["value"])
                page.wait_for_timeout(250)
                return

    # Fallback: button-based style switcher / popover
    direct = page.get_by_role("button", name=re.compile(r"暗夜星环"))
    if direct.count() > 0 and direct.first.is_visible():
        direct.first.click()
        page.wait_for_timeout(250)
        return

    picker_trigger = first_visible(
        [
            page.get_by_role(
                "button", name=re.compile(r"切换风格|视觉风格|换肤|风格模板|柔光圆角")
            )
        ],
        timeout_ms=6000,
    )
    picker_trigger.click()
    choice = first_visible(
        [page.get_by_role("button", name=re.compile(r"暗夜星环"))],
        timeout_ms=6000,
    )
    choice.click()
    page.wait_for_timeout(250)


# ---------------------------------------------------------------------------
# Tier 1 — API Feature Suite (13 Tests)
# ---------------------------------------------------------------------------


def t1_api_01_catalog_18_styles(ctx: TestContext) -> None:
    """GET /api/prompts returns all official curated public styles with valid fields & sort."""
    client = ctx.api()
    resp = client.get("/api/prompts").assert_status(200, "GET /api/prompts")
    data = resp.require_json("GET /api/prompts")
    prompts = data.get("prompts")
    expected_total = len(OFFICIAL_STYLE_IDS)
    assert isinstance(prompts, list), f"Expected prompts list, got {type(prompts)}"
    assert len(prompts) == expected_total, f"Expected {expected_total} curated styles, got {len(prompts)}"

    ids = {p["id"] for p in prompts}
    slugs = {p["slug"] for p in prompts}
    assert ids == set(OFFICIAL_STYLE_IDS), (
        f"Seeded prompt ID mismatch: missing={set(OFFICIAL_STYLE_IDS) - ids}, "
        f"extra={ids - set(OFFICIAL_STYLE_IDS)}"
    )
    assert slugs == set(OFFICIAL_STYLE_SLUGS), (
        f"Seeded slug mismatch: missing={set(OFFICIAL_STYLE_SLUGS) - slugs}, "
        f"extra={slugs - set(OFFICIAL_STYLE_SLUGS)}"
    )

    for p in prompts:
        assert p.get("isPublic") is True, f"Public catalog returned non-public item: {p['id']}"
        assert isinstance(p.get("commentsCount"), int), f"Missing int commentsCount on {p['id']}"
        assert isinstance(p.get("visualSpec"), dict), f"Missing visualSpec on {p['id']}"
        assert isinstance(p.get("promptAnatomy"), dict), f"Missing promptAnatomy on {p['id']}"

    by_id = {p["id"]: p for p in prompts}
    assert by_id["prompt_swiss_grid"]["commentsCount"] >= 2, (
        f"Expected >= 2 seeded comments on prompt_swiss_grid, got {by_id['prompt_swiss_grid']['commentsCount']}"
    )
    assert by_id["prompt_soft_bento"]["commentsCount"] >= 1, (
        f"Expected >= 1 seeded comment on prompt_soft_bento, got {by_id['prompt_soft_bento']['commentsCount']}"
    )

    likes_seq = [int(p["likesCount"]) for p in prompts]
    assert likes_seq == sorted(likes_seq, reverse=True), (
        f"Default popular sort is not descending by likesCount: {likes_seq}"
    )
    ctx.details["catalog_count"] = len(prompts)


def t1_api_02_catalog_filters_and_sort(ctx: TestContext) -> None:
    """GET /api/prompts accurately filters by q, scenario, style, color, all 6 tools & sort."""
    client = ctx.api()

    # Search q=Bento
    q_data = client.get("/api/prompts", params={"q": "Bento"}).assert_status(200).require_json()
    q_slugs = [p["slug"] for p in q_data["prompts"]]
    assert "apple-soft-bento-modular" in q_slugs, f"q=Bento missed Bento style: {q_slugs}"

    # Scenario filter
    scen_data = (
        client.get("/api/prompts", params={"scenario": "产品发布"}).assert_status(200).require_json()
    )
    assert len(scen_data["prompts"]) == BASELINE_SCENARIO_COUNTS["产品发布"], (
        f"Expected {BASELINE_SCENARIO_COUNTS['产品发布']} 产品发布 styles, got {len(scen_data['prompts'])}"
    )
    assert all(p["scenario"] == "产品发布" for p in scen_data["prompts"])

    # Style category filter
    style_data = (
        client.get("/api/prompts", params={"style": "商务咨询"}).assert_status(200).require_json()
    )
    assert len(style_data["prompts"]) == BASELINE_STYLE_COUNTS["商务咨询"], (
        f"Expected {BASELINE_STYLE_COUNTS['商务咨询']} 商务咨询 styles, got {len(style_data['prompts'])}"
    )
    assert all(p["styleCategory"] == "商务咨询" for p in style_data["prompts"])

    # Color family filter
    color_data = (
        client.get("/api/prompts", params={"color": "dark"}).assert_status(200).require_json()
    )
    assert len(color_data["prompts"]) == BASELINE_COLOR_COUNTS["dark"], (
        f"Expected {BASELINE_COLOR_COUNTS['dark']} dark styles, got {len(color_data['prompts'])}"
    )
    assert all(p["colorFamily"] == "dark" for p in color_data["prompts"])

    # All 6 target tools filter counts
    for tool in TARGET_TOOLS:
        tool_data = (
            client.get("/api/prompts", params={"tool": tool}).assert_status(200, f"tool={tool}").require_json()
        )
        expected_n = BASELINE_TOOL_COUNTS[tool]
        got = tool_data["prompts"]
        assert len(got) == expected_n, f"tool={tool} expected {expected_n}, got {len(got)}"
        assert all(tool in p["recommendedTools"] for p in got)

    # sort=copies descending
    copies_data = (
        client.get("/api/prompts", params={"sort": "copies"}).assert_status(200).require_json()
    )
    copies_seq = [int(p["copiesCount"]) for p in copies_data["prompts"]]
    assert copies_seq == sorted(copies_seq, reverse=True), f"sort=copies not descending: {copies_seq}"

    # sort=newest descending
    newest_data = (
        client.get("/api/prompts", params={"sort": "newest"}).assert_status(200).require_json()
    )
    created_seq = [str(p["createdAt"]) for p in newest_data["prompts"]]
    assert created_seq == sorted(created_seq, reverse=True), f"sort=newest not descending: {created_seq}"


def t1_api_03_auth_lifecycle(ctx: TestContext) -> None:
    """Auth login -> /api/auth/me with UserStats.decks -> logout clears session."""
    client = ctx.api()

    login_resp = client.login(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password).assert_status(
        200, "POST /api/auth/login"
    )
    set_cookie = login_resp.header("Set-Cookie")
    assert "pptgod_session=" in set_cookie, f"Missing pptgod_session in Set-Cookie: {set_cookie!r}"
    assert "httponly" in set_cookie.lower(), f"Session cookie missing HttpOnly flag: {set_cookie!r}"

    login_json = login_resp.require_json("login")
    assert login_json["user"]["username"] == ACCOUNT_DEMO.username
    stats = login_json["stats"]
    for key in ("published", "likes", "favorites", "decks"):
        assert isinstance(stats.get(key), int), f"login stats missing integer {key!r}: {stats!r}"

    me_json = client.me().assert_status(200, "GET /api/auth/me authenticated").require_json()
    assert me_json["user"]["id"] == ACCOUNT_DEMO.id
    assert isinstance(me_json["stats"].get("decks"), int), f"/api/auth/me stats missing decks: {me_json}"

    logout_json = client.logout().assert_status(200, "POST /api/auth/logout").require_json()
    assert logout_json.get("ok") is True

    me_after = client.me().assert_status(200, "GET /api/auth/me after logout").require_json()
    assert me_after.get("user") is None, f"User still authenticated after logout: {me_after}"
    assert me_after.get("stats") is None, f"Stats still present after logout: {me_after}"


def t1_api_04_prompt_detail_and_copy(ctx: TestContext) -> None:
    """GET /api/prompts/[slug|id] returns full detail and POST .../copy increments counter."""
    anon = ctx.api()
    by_slug = (
        anon.get("/api/prompts/apple-soft-bento-modular")
        .assert_status(200, "GET by slug")
        .require_json()["prompt"]
    )
    by_id = (
        anon.get("/api/prompts/prompt_soft_bento")
        .assert_status(200, "GET by id")
        .require_json()["prompt"]
    )
    assert by_slug["id"] == by_id["id"] == "prompt_soft_bento"
    assert by_slug["isPublic"] is True
    assert by_slug["commentsCount"] >= 1

    # Test copy increment on a synthetic prompt so seeded copiesCount stays clean
    author = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    with ctx.cleanup() as cleanup:
        created = (
            author.post("/api/prompts", json_body=make_valid_prompt_payload(is_public=True))
            .assert_status(201, "create synthetic prompt for copy test")
            .require_json()["prompt"]
        )
        syn_id = created["id"]
        cleanup.register_delete_prompt(author, syn_id)
        initial_copies = int(created["copiesCount"])

        copy_resp = (
            anon.post(f"/api/prompts/{syn_id}/copy")
            .assert_status(200, "POST /api/prompts/[synId]/copy")
            .require_json()
        )
        assert int(copy_resp["copiesCount"]) == initial_copies + 1, (
            f"Expected copiesCount {initial_copies + 1}, got {copy_resp}"
        )


def t1_api_05_prompt_create_remix_edit_delete(ctx: TestContext) -> None:
    """Full prompt lifecycle: Remix POST -> PUT edit (slug stable) -> PATCH visibility -> DELETE."""
    author = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    with ctx.cleanup() as cleanup:
        payload = make_valid_prompt_payload(
            title_prefix="[E2E-REMIX]",
            is_public=True,
            remixed_from_id="prompt_swiss_grid",
        )
        created = (
            author.post("/api/prompts", json_body=payload)
            .assert_status(201, "POST /api/prompts remix")
            .require_json()["prompt"]
        )
        pid = created["id"]
        orig_slug = created["slug"]
        cleanup.register_delete_prompt(author, pid)

        assert created["isPublic"] is True
        assert created["likesCount"] == 1, "Author auto-like should initialize likesCount to 1"
        remixed = created.get("remixedFrom")
        assert isinstance(remixed, dict) and remixed.get("slug") == "swiss-international-grid", (
            f"Expected remixedFrom swiss-international-grid, got {remixed!r}"
        )

        # PUT full edit + flip to private while preserving slug
        updated_payload = dict(payload)
        updated_payload["title"] = f"[E2E-EDITED] 更新后标题 {unique_token('U')}"
        updated_payload["isPublic"] = False
        put_prompt = (
            author.put(f"/api/prompts/{pid}", json_body=updated_payload)
            .assert_status(200, "PUT /api/prompts/[id]")
            .require_json()["prompt"]
        )
        assert put_prompt["slug"] == orig_slug, "PUT edit must preserve existing slug"
        assert put_prompt["title"] == updated_payload["title"]
        assert put_prompt["isPublic"] is False
        assert str(put_prompt["updatedAt"]) >= str(created["createdAt"])

        # PATCH visibility back to public
        patch_prompt = (
            author.patch(f"/api/prompts/{pid}", json_body={"isPublic": True})
            .assert_status(200, "PATCH /api/prompts/[id]")
            .require_json()["prompt"]
        )
        assert patch_prompt["isPublic"] is True

        # DELETE and verify 404
        del_json = author.delete(f"/api/prompts/{pid}").assert_status(200, "DELETE prompt").require_json()
        assert del_json.get("ok") is True
        author.get(f"/api/prompts/{pid}").assert_status(404, "GET deleted prompt")


def t1_api_06_prompt_like_and_favorite_toggle(ctx: TestContext) -> None:
    """POST .../like and .../favorite toggle cleanly and restore original counts."""
    author = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    target_id = "prompt_soft_bento"

    detail = author.get(f"/api/prompts/{target_id}").assert_status(200).require_json()["prompt"]
    orig_liked = bool(detail.get("likedByMe", False))
    orig_likes = int(detail["likesCount"])
    orig_faved = bool(detail.get("favoritedByMe", False))
    orig_saves = int(detail["savesCount"])

    with ctx.cleanup() as cleanup:
        cleanup.register_restore_toggle(author, target_id, "like", expected_state=orig_liked)
        cleanup.register_restore_toggle(author, target_id, "favorite", expected_state=orig_faved)

        # Like toggle twice
        like1 = author.post(f"/api/prompts/{target_id}/like").assert_status(200).require_json()
        expected_like_delta = -1 if orig_liked else 1
        assert like1["liked"] is (not orig_liked)
        assert int(like1["likesCount"]) == orig_likes + expected_like_delta

        like2 = author.post(f"/api/prompts/{target_id}/like").assert_status(200).require_json()
        assert like2["liked"] is orig_liked
        assert int(like2["likesCount"]) == orig_likes

        # Favorite toggle twice
        fav1 = author.post(f"/api/prompts/{target_id}/favorite").assert_status(200).require_json()
        expected_fav_delta = -1 if orig_faved else 1
        assert fav1["favorited"] is (not orig_faved)
        assert int(fav1["savesCount"]) == orig_saves + expected_fav_delta

        fav2 = author.post(f"/api/prompts/{target_id}/favorite").assert_status(200).require_json()
        assert fav2["favorited"] is orig_faved
        assert int(fav2["savesCount"]) == orig_saves


def t1_api_07_comments_crud(ctx: TestContext) -> None:
    """GET seeded comments, POST per-tool review (201), and DELETE own review (200)."""
    author = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    pid = "prompt_swiss_grid"

    initial = author.get(f"/api/prompts/{pid}/comments").assert_status(200).require_json()["comments"]
    seed_ids = {c["id"] for c in initial}
    assert {"cmt_seed_1", "cmt_seed_2"}.issubset(seed_ids), (
        f"Expected seeded comments cmt_seed_1 & cmt_seed_2, found {seed_ids}"
    )

    marker = f"[E2E-REVIEW-{unique_token('C')}] Slidev/Marp 实测排版非常干净清晰"
    with ctx.cleanup() as cleanup:
        post_comments = (
            author.post(
                f"/api/prompts/{pid}/comments",
                json_body={"testedTool": "slidev-marp", "rating": 5, "content": marker},
            )
            .assert_status(201, "POST comment")
            .require_json()["comments"]
        )
        matching = [c for c in post_comments if c.get("content") == marker]
        assert len(matching) == 1, f"Newly posted comment missing from response: {post_comments}"
        cid = matching[0]["id"]
        cleanup.register_delete_comment(author, pid, cid)

        assert matching[0]["testedTool"] == "slidev-marp"
        assert int(matching[0]["rating"]) == 5

        after_del = (
            author.delete(f"/api/prompts/{pid}/comments", params={"commentId": cid})
            .assert_status(200, "DELETE own comment")
            .require_json()["comments"]
        )
        assert all(c["id"] != cid for c in after_del), "Deleted comment still present"


def t1_api_08_sync_favorites(ctx: TestContext) -> None:
    """POST /api/prompts/sync-favorites merges valid public IDs idempotently."""
    author = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    with ctx.cleanup() as cleanup:
        syn = (
            author.post("/api/prompts", json_body=make_valid_prompt_payload(is_public=True))
            .assert_status(201)
            .require_json()["prompt"]
        )
        syn_id = syn["id"]
        cleanup.register_delete_prompt(author, syn_id)

        first_sync = (
            author.post("/api/prompts/sync-favorites", json_body={"promptIds": [syn_id]})
            .assert_status(200, "sync-favorites first call")
            .require_json()
        )
        assert int(first_sync["synced"]) == 1, f"Expected synced=1, got {first_sync}"

        second_sync = (
            author.post("/api/prompts/sync-favorites", json_body={"promptIds": [syn_id]})
            .assert_status(200, "sync-favorites idempotent repeat")
            .require_json()
        )
        assert int(second_sync["synced"]) == 0, f"Expected synced=0 on repeat, got {second_sync}"

        favs = (
            author.get("/api/prompts", params={"scope": "favorites"})
            .assert_status(200)
            .require_json()["prompts"]
        )
        assert any(p["id"] == syn_id for p in favs), "Synced prompt missing from scope=favorites"


def t1_api_09_profile_patch(ctx: TestContext) -> None:
    """PATCH /api/auth/profile updates displayName/bio/avatarColor and reflects in /me & creator API."""
    author = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    orig_user = author.me().assert_status(200).require_json()["user"]
    orig_profile = {
        "displayName": orig_user.get("displayName") or ACCOUNT_DEMO.display_name,
        "bio": orig_user.get("bio") or ACCOUNT_DEMO.bio,
        "avatarColor": orig_user.get("avatarColor") or ACCOUNT_DEMO.avatar_color,
    }

    with ctx.cleanup() as cleanup:
        cleanup.register_restore_profile(author, orig_profile)

        new_name = f"林屿 E2E {unique_token('U')[:6]}"
        new_bio = "端到端自动化资料更新验证简介"
        new_color = "#7C3AED"
        patched = (
            author.patch(
                "/api/auth/profile",
                json_body={"displayName": new_name, "bio": new_bio, "avatarColor": new_color},
            )
            .assert_status(200, "PATCH /api/auth/profile")
            .require_json()
        )
        assert patched["user"]["displayName"] == new_name
        assert patched["user"]["bio"] == new_bio
        assert patched["user"]["avatarColor"] == new_color

        me_now = author.me().assert_status(200).require_json()["user"]
        assert me_now["displayName"] == new_name

        creator_now = (
            author.get(f"/api/creators/{ACCOUNT_DEMO.username}")
            .assert_status(200)
            .require_json()["creator"]
        )
        assert creator_now["displayName"] == new_name
        assert creator_now["bio"] == new_bio


def t1_api_10_generate_smart_engine(ctx: TestContext) -> None:
    """POST /api/generate (mode=smart, slideCount=7) returns 7 structured slides with notes."""
    client = ctx.api()
    preset = SOURCE_MATERIAL_PRESETS[0]
    resp = client.post(
        "/api/generate",
        json_body={
            "topic": preset["topic"],
            "subtitle": preset["subtitle"],
            "audience": preset["audience"],
            "scenario": preset["scenario"],
            "sourceText": preset["rawText"],
            "slideCount": 7,
            "mode": "smart",
        },
    ).assert_status(200, "POST /api/generate smart")

    data = resp.require_json("POST /api/generate smart")
    assert data.get("engine") == "smart", f"Expected engine='smart', got {data.get('engine')!r}"
    slides = data.get("slides")
    assert isinstance(slides, list) and len(slides) == 7, (
        f"Expected exactly 7 slides, got {len(slides) if isinstance(slides, list) else slides!r}"
    )
    assert slides[0]["slideType"] == "cover", f"First slide must be cover, got {slides[0]['slideType']}"
    assert slides[-1]["slideType"] == "closing", (
        f"Last slide must be closing, got {slides[-1]['slideType']}"
    )
    for idx, slide in enumerate(slides):
        assert slide.get("slideType") in SLIDE_TYPES, f"Slide {idx} invalid type: {slide.get('slideType')}"
        assert str(slide.get("title", "")).strip(), f"Slide {idx} has empty title"
        assert str(slide.get("speakerNotes", "")).strip(), f"Slide {idx} has empty speakerNotes"


def t1_api_11_export_pptx_ooxml_verification(ctx: TestContext) -> None:
    """POST /api/export/pptx returns valid >30KB OOXML archive with slides, notes & title text."""
    client = ctx.api()
    preset = SOURCE_MATERIAL_PRESETS[0]
    gen_data = (
        client.post(
            "/api/generate",
            json_body={
                "topic": preset["topic"],
                "subtitle": preset["subtitle"],
                "audience": preset["audience"],
                "scenario": preset["scenario"],
                "sourceText": preset["rawText"],
                "slideCount": 7,
                "mode": "smart",
            },
        )
        .assert_status(200)
        .require_json()
    )
    slides = gen_data["slides"]
    bento = (
        client.get("/api/prompts/prompt_soft_bento").assert_status(200).require_json()["prompt"]
    )

    exp_resp = client.post(
        "/api/export/pptx",
        json_body={
            "title": preset["topic"],
            "subtitle": preset["subtitle"],
            "audience": preset["audience"],
            "styleName": bento["title"],
            "visualSpec": bento["visualSpec"],
            "slides": slides,
        },
    ).assert_status(200, "POST /api/export/pptx")

    ctype = exp_resp.header("Content-Type")
    assert PPTX_CONTENT_TYPE in ctype, f"Unexpected Content-Type: {ctype!r}"
    inspected = PptxVerifier.verify(
        exp_resp.body,
        min_size=30720,
        expected_slide_count=7,
        expected_slide_texts=[slides[0]["title"]],
        require_notes=True,
    )
    ctx.details["pptx_bytes"] = inspected.size_bytes
    ctx.details["pptx_slides"] = inspected.slide_count
    ctx.details["pptx_notes"] = len(inspected.notes_members)


def t1_api_12_saved_decks_crud(ctx: TestContext) -> None:
    """Full Saved Decks CRUD: POST (private default) -> GET list/detail -> PUT -> PATCH -> DELETE."""
    author = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    with ctx.cleanup() as cleanup:
        payload = make_valid_deck_payload(is_public=None)
        created = (
            author.post("/api/decks", json_body=payload)
            .assert_status(201, "POST /api/decks")
            .require_json()["deck"]
        )
        deck_id = created["id"]
        cleanup.register_delete_deck(author, deck_id)

        assert created["isPublic"] is False, "New deck must default to isPublic === false"

        listed = author.get("/api/decks").assert_status(200).require_json()["decks"]
        assert any(d["id"] == deck_id for d in listed), "Created deck missing from GET /api/decks"

        fetched = author.get(f"/api/decks/{deck_id}").assert_status(200).require_json()["deck"]
        assert fetched["title"] == payload["title"]

        # PUT full deck update
        updated_title = f"[E2E-DECK-PUT] {unique_token('D')}"
        put_payload = dict(payload)
        put_payload["title"] = updated_title
        put_deck = (
            author.put(f"/api/decks/{deck_id}", json_body=put_payload)
            .assert_status(200, "PUT /api/decks/[id]")
            .require_json()["deck"]
        )
        assert put_deck["title"] == updated_title

        # PATCH visibility to public
        patch_deck = (
            author.patch(f"/api/decks/{deck_id}", json_body={"isPublic": True})
            .assert_status(200, "PATCH /api/decks/[id]")
            .require_json()["deck"]
        )
        assert patch_deck["isPublic"] is True

        # DELETE & verify 404
        del_json = author.delete(f"/api/decks/{deck_id}").assert_status(200).require_json()
        assert del_json.get("ok") is True
        author.get(f"/api/decks/{deck_id}").assert_status(404, "GET deleted deck")


def t1_api_13_creator_profile_api(ctx: TestContext) -> None:
    """GET /api/creators/pptgod_lab returns 9 public prompts, accurate impact & privateCount=0."""
    anon = ctx.api()
    data = (
        anon.get(f"/api/creators/{ACCOUNT_OFFICIAL.username}")
        .assert_status(200, "GET /api/creators/pptgod_lab")
        .require_json()
    )
    assert data["creator"]["id"] == ACCOUNT_OFFICIAL.id
    assert data["creator"]["username"] == ACCOUNT_OFFICIAL.username
    prompts = data["prompts"]
    assert len(prompts) == ACCOUNT_OFFICIAL.seeded_prompt_count, (
        f"Expected {ACCOUNT_OFFICIAL.seeded_prompt_count} prompts for pptgod_lab, got {len(prompts)}"
    )
    assert all(p.get("isPublic") is True for p in prompts)

    impact = data["impact"]
    assert int(impact["publishedCount"]) == ACCOUNT_OFFICIAL.seeded_prompt_count
    assert int(impact["totalLikes"]) >= ACCOUNT_OFFICIAL.baseline_likes
    assert int(impact["totalSaves"]) >= ACCOUNT_OFFICIAL.baseline_saves
    assert int(impact["totalCopies"]) >= ACCOUNT_OFFICIAL.baseline_copies
    assert int(data["privateCount"]) == 0


# ---------------------------------------------------------------------------
# Tier 1 — Browser UI Smoke Suite Across All 7 Routes (9 Tests)
# ---------------------------------------------------------------------------


def t1_ui_01_navbar_and_gallery_18_cards(ctx: TestContext) -> None:
    """Browser /: 4 primary nav links, 18 cards, live global topic sync, filter & reset."""
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.goto_ok(ctx.url("/"))

        header = page.locator("header, #pg-main-navbar").first
        header.wait_for(state="visible")
        for nav_href, nav_pat in (
            ("/", r"视觉画廊"),
            ("/generate", r"在线生成\s*PPT|生成\s*PPT"),
            ("/compare", r"并排对比"),
            ("/collections", r"我的空间|收藏"),
        ):
            link = header.locator(f'a[href="{nav_href}"]').or_(
                header.get_by_role("link", name=re.compile(nav_pat))
            )
            assert link.count() > 0 and link.first.is_visible(), (
                f"Navbar missing primary link {nav_href} ({nav_pat})"
            )

        create_link = header.locator('#pg-nav-create-btn, a[href="/create"]')
        assert create_link.count() > 0 and create_link.first.is_visible(), (
            "Navbar missing + 发布风格 link"
        )

        # Verify all official curated style cards rendered
        expected_total = len(OFFICIAL_STYLE_IDS)
        cards = page.locator("article[data-prompt-slug]")
        cards.first.wait_for(state="visible")
        card_count = cards.count()
        if card_count == 0:
            card_count = len(
                set(
                    page.locator('main a[href^="/studio/"]').evaluate_all(
                        "els => els.map(e => e.getAttribute('href'))"
                    )
                )
            )
        assert card_count == expected_total, (
            f"Expected {expected_total} style cards on /, found {card_count}"
        )

        # Dual CTAs & creator links on cards
        assert page.locator('a[href*="/generate?style="]').count() >= expected_total, (
            "Cards should expose /generate?style= direct Generate PPT CTAs"
        )
        assert page.locator('a[href^="/creator/"]').count() >= expected_total, (
            "Cards should expose clickable /creator/[username] links"
        )

        # Global live topic preview
        topic_input = first_visible(
            [
                page.locator("#pg-global-topic-input"),
                page.get_by_placeholder(re.compile(r"汇报|路演标题|实时预览|主题")),
            ]
        )
        live_marker = "E2E实时画布同步测试标题"
        topic_input.fill(live_marker)
        page.wait_for_timeout(250)
        matched_stages = int(
            page.evaluate(
                """(needle) => Array.from(document.querySelectorAll('main .pg-slide-stage, main [style*="aspect-ratio"]'))
                  .filter((el) => (el.innerText || '').includes(needle)).length""",
                live_marker,
            )
        )
        assert matched_stages >= 3, (
            f"Expected >= 3 cards to reflect live topic {live_marker!r}, matched {matched_stages}"
        )
        topic_input.fill("")

        # Search filter -> narrow -> reset -> expected_total
        search_input = first_visible(
            [
                page.locator("#pg-gallery-search"),
                page.locator('input[type="search"]'),
                page.get_by_placeholder(re.compile(r"搜索风格|关键词")),
            ]
        )
        search_input.fill("Bento")
        page.wait_for_timeout(300)
        narrow_count = page.locator("article[data-prompt-slug]").count()
        assert 1 <= narrow_count <= 5, f"Expected 1..5 cards for 'Bento', got {narrow_count}"
        assert page.locator('a[href="/studio/apple-soft-bento-modular"]').first.is_visible()

        reset_btn = first_visible(
            [
                page.locator("#pg-reset-filters-btn"),
                page.get_by_role("button", name=re.compile(r"重置.*筛选|重置")),
            ]
        )
        reset_btn.click()
        page.wait_for_timeout(300)
        restored_count = page.locator("article[data-prompt-slug]").count()
        assert restored_count == expected_total, (
            f"Expected {expected_total} cards after reset, got {restored_count}"
        )

        guard.assert_no_browser_errors("T1_UI_01")


def t1_ui_02_style_matcher_modal(ctx: TestContext) -> None:
    """Browser /: 30-second StyleMatcherModal 3-step wizard renders Top 3 16:9 recommendations."""
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.goto_ok(ctx.url("/"))

        modal = guard.drive_style_matcher_modal()
        studio_links = modal.locator('a[href^="/studio/"]')
        gen_links = modal.locator('a[href*="/generate?style="]')
        canvases = modal.locator('.pg-slide-outer, [style*="aspect-ratio"]')

        assert studio_links.count() >= 3, f"Expected >= 3 Studio links in matcher, got {studio_links.count()}"
        assert gen_links.count() >= 3, f"Expected >= 3 Generate links in matcher, got {gen_links.count()}"
        assert canvases.count() >= 3, f"Expected >= 3 16:9 canvases in matcher, got {canvases.count()}"

        for idx in range(3):
            guard.assert_canvas_non_blank(
                canvases.nth(idx),
                min_width=160,
                min_height=90,
                min_text_len=10,
                label=f"matcher_rec_{idx + 1}",
            )

        # Close modal cleanly
        close_btn = modal.locator('button[aria-label*="关闭"]').or_(
            modal.get_by_role("button", name=re.compile(r"关闭|取消|×"))
        )
        if close_btn.count() > 0 and close_btn.first.is_visible():
            close_btn.first.click()
        else:
            page.keyboard.press("Escape")
        modal.wait_for(state="hidden", timeout=5000)

        guard.assert_no_browser_errors("T1_UI_02")


def t1_ui_03_studio_8_slides_anatomy_tuning(ctx: TestContext) -> None:
    """Browser /studio/apple-soft-bento-modular: 8 slide types, 5-dim anatomy, live tuning, fullscreen."""
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.goto_ok(ctx.url("/studio/apple-soft-bento-modular"))

        # Verify key action links
        assert page.locator('a[href*="/generate?style=apple-soft-bento-modular"]').first.is_visible()
        assert page.locator('a[href*="/create?fork=apple-soft-bento-modular"]').first.is_visible()
        assert page.locator('a[href="/creator/pptgod_lab"]').first.is_visible()

        # Cycle all 8 slide types in filmstrip
        filmstrip = first_visible(
            [
                page.locator('[role="tablist"][aria-label*="幻灯片"]'),
                page.locator(".pg-filmstrip"),
                page.locator('[role="tablist"]').filter(
                    has=page.get_by_role("tab", name=re.compile(r"金句|路线图"))
                ),
            ]
        )
        text_samples: list[str] = []
        for st in SLIDE_TYPES:
            pat = re.compile(SLIDE_TYPE_LABELS[st]["pattern"], re.IGNORECASE)
            tab = filmstrip.get_by_role("tab", name=pat).or_(
                filmstrip.get_by_role("button", name=pat)
            ).first
            tab.click()
            page.wait_for_timeout(150)
            info = guard.assert_canvas_non_blank(slide_type=st, label=f"studio_{st}")
            text_samples.append(info["textSample"])

        distinct_count = len(set(text_samples))
        assert distinct_count >= 6, (
            f"Expected >= 6 distinct slide renders across 8 types, got {distinct_count}"
        )

        # 5-dimension anatomy highlight toggle
        anatomy_bar = first_visible(
            [
                page.locator('[role="group"][aria-label*="透视"]'),
                page.locator('section[aria-label*="提示词视觉结构拆解"]'),
            ]
        )
        color_dim_btn = anatomy_bar.get_by_role(
            "button", name=re.compile(r"色彩系统规范|色彩|Color System")
        ).first
        color_dim_btn.click()
        page.wait_for_timeout(150)
        stage_text = guard.find_primary_stage().inner_text()
        assert any(tok in stage_text for tok in ("色彩", "ACCENT", "BG", "#")), (
            f"Anatomy highlight did not appear on stage: {stage_text[:200]!r}"
        )
        color_dim_btn.click()

        # Live visual tuning + reset reflected in compiled prompt
        output = first_visible(
            [
                page.locator("#pg-compiled-prompt-output"),
                page.get_by_label(re.compile(r"完整.*提示词")),
                page.locator("textarea[readonly]"),
            ]
        )
        orig_prompt = output.input_value()
        assert len(orig_prompt) > 100, "Compiled prompt output unexpectedly short"

        tweaker = page.locator('section[aria-label*="视觉参数微调"]').or_(
            page.locator("section").filter(has_text=re.compile(r"实时视觉微调|视觉参数"))
        ).first
        tweak_btn = first_visible(
            [
                tweaker.get_by_role("button", name=re.compile(r"深邃暗")),
                tweaker.locator('button[aria-label*="#1652B8"]'),
                tweaker.get_by_role("button", name=re.compile(r"紧凑|宽松")),
            ]
        )
        tweak_btn.click()
        page.wait_for_timeout(200)
        tweaked_prompt = output.input_value()
        assert tweaked_prompt != orig_prompt, "Live visual tuning did not update compiled prompt"

        reset_btn = tweaker.get_by_role("button", name=re.compile(r"恢复原版|重置|原版")).first
        reset_btn.click()
        page.wait_for_timeout(200)
        assert output.input_value() == orig_prompt, "Reset did not restore original compiled prompt"

        # Fullscreen presentation modal open -> next -> Escape close
        fs_btn = first_visible(
            [
                page.locator("#pg-studio-fullscreen-btn"),
                page.get_by_role("button", name=re.compile(r"全屏演播|全屏预览|全屏")),
            ]
        )
        fs_btn.click()
        fs_dialog = page.locator('[role="dialog"]').first
        fs_dialog.wait_for(state="visible", timeout=5000)
        page.keyboard.press("ArrowRight")
        page.wait_for_timeout(150)
        page.keyboard.press("Escape")
        fs_dialog.wait_for(state="hidden", timeout=5000)

        guard.assert_no_browser_errors("T1_UI_03")


def t1_ui_04_studio_6_tools_batch_exports_reviews(ctx: TestContext) -> None:
    """Browser /studio/apple-soft-bento-modular: 6 tools, 6-slide batch, Quick Launch, exports & review."""
    with ctx.open_page(viewport=DESKTOP_VIEWPORT, grant_clipboard_origin=ctx.base_url) as guard:
        page = guard.page
        guard.goto_ok(ctx.url("/studio/apple-soft-bento-modular"))

        output = first_visible(
            [
                page.locator("#pg-compiled-prompt-output"),
                page.locator("textarea[readonly]"),
            ]
        )

        # Switch through all 6 compiler tools
        for tool_id in TARGET_TOOLS:
            meta = TOOL_MARKERS[tool_id]
            tab = first_visible(
                [
                    page.locator(f"#pg-tool-tab-{tool_id}"),
                    page.get_by_role("tab", name=re.compile(meta["label_pattern"], re.I)),
                    page.get_by_role("button", name=re.compile(meta["label_pattern"], re.I)),
                ]
            )
            tab.click()
            page.wait_for_timeout(150)
            compiled = output.input_value()
            for token in meta["required_tokens"]:
                assert token in compiled, (
                    f"Tool {tool_id} compiled prompt missing marker {token!r}"
                )

            # Verify Quick Launch external links visible
            ext_links = page.locator('a[target="_blank"][href^="https://"]')
            assert ext_links.count() >= 1, f"Tool {tool_id} missing external Quick Launch links"

            if tool_id == "ai-image":
                batch_toggle = first_visible(
                    [
                        page.get_by_role(
                            "button", name=re.compile(r"全套\s*6\s*页|连贯.*词包|分页生图")
                        ),
                        page.get_by_label(re.compile(r"全套\s*6\s*页|连贯.*词包|分页生图")),
                    ]
                )
                batch_toggle.click()
                page.wait_for_timeout(180)
                batch_text = output.input_value()
                for bt in meta["batch_tokens"]:
                    assert bt in batch_text, (
                        f"AI-image 6-slide batch output missing marker {bt!r}"
                    )

        # Sample .pptx export download
        pptx_btn = first_visible(
            [
                page.get_by_role(
                    "button", name=re.compile(r"样板.*\.pptx|导出.*\.pptx|下载.*PPTX", re.I)
                )
            ]
        )
        pptx_name, pptx_bytes = guard.capture_download(lambda: pptx_btn.click())
        assert pptx_name.lower().endswith(".pptx"), f"Unexpected sample pptx filename: {pptx_name!r}"
        PptxVerifier.verify(pptx_bytes, min_size=30720, expected_min_slides=4, require_notes=True)

        # Sample .html export download
        html_btn = first_visible(
            [
                page.get_by_role(
                    "button", name=re.compile(r"交互.*\.html|导出.*\.html|下载.*HTML", re.I)
                )
            ]
        )
        html_name, html_bytes = guard.capture_download(lambda: html_btn.click())
        assert html_name.lower().endswith(".html"), f"Unexpected sample html filename: {html_name!r}"
        HtmlDeckVerifier.verify(html_bytes, expected_min_slides=4)

        # Seeded review cmt_seed_5 visible on Bento studio page
        review_loc = page.get_by_text(re.compile(r"产品月度迭代一图流|18px\s*圆角白卡片")).first
        review_loc.scroll_into_view_if_needed()
        assert review_loc.is_visible(), "Seeded review cmt_seed_5 not visible on Bento studio page"

        guard.assert_no_browser_errors("T1_UI_04")


def t1_ui_05_generate_workshop_end_to_end(ctx: TestContext) -> None:
    """Browser /generate: preset generate, live re-skin, WYSIWYG title/notes, fullscreen & exports."""
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.goto_ok(ctx.url("/generate?style=apple-soft-bento-modular"))

        gen_data = load_preset_and_generate(guard, preset_index=0)
        tree_count = count_generate_tree_slides(page)
        assert tree_count >= 5, f"Expected >= 5 slide thumbnails in left tree, got {tree_count}"

        before_stage = guard.assert_canvas_non_blank(label="generate_initial")
        before_bg = before_stage["bgColor"]
        orig_slide_title = gen_data["slides"][0]["title"]

        # Live re-skin to dark obsidian preserving slide title
        switch_generate_style_to_dark_obsidian(guard)
        after_stage = guard.assert_canvas_non_blank(label="generate_reskinned")
        assert after_stage["bgColor"] != before_bg, (
            f"Live style switch did not change stage background ({before_bg} -> {after_stage['bgColor']})"
        )
        assert orig_slide_title[:8] in after_stage["fullText"], (
            "Live style switch lost active slide text content"
        )

        # Right WYSIWYG title & speaker notes edit
        edited_title = f"E2E实时编辑标题_{unique_token('G')}"
        edited_notes = f"E2E讲稿备注验证_{unique_token('N')}"

        title_input = first_visible(
            [
                page.get_by_label(re.compile(r"页面标题|本页标题|主标题|单页标题")),
                page.locator('input[type="text"]').filter(
                    has=page.locator("xpath=.")
                ),
            ]
        )
        # Prefer finding the text input whose value currently matches the active slide title
        exact_title_idx = page.evaluate(
            """(curTitle) => {
              const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'));
              return inputs.findIndex((i) => i.value && curTitle && i.value.includes(curTitle.slice(0, 8)));
            }""",
            orig_slide_title,
        )
        if isinstance(exact_title_idx, int) and exact_title_idx >= 0:
            title_input = page.locator('input[type="text"], input:not([type])').nth(exact_title_idx)

        title_input.fill(edited_title)
        page.wait_for_timeout(200)
        updated_stage = guard.assert_canvas_non_blank(label="generate_after_title_edit")
        assert edited_title in updated_stage["fullText"], (
            f"Live WYSIWYG title edit {edited_title!r} not reflected on 16:9 stage"
        )

        notes_input = first_visible(
            [
                page.get_by_label(re.compile(r"演讲者备注|演讲逐字稿|讲稿")),
                page.get_by_placeholder(re.compile(r"演讲|讲稿|备注")),
            ]
        )
        notes_input.fill(edited_notes)
        page.wait_for_timeout(150)

        # Fullscreen roadshow modal open & close
        fs_btn = first_visible(
            [page.get_by_role("button", name=re.compile(r"全屏演播|全屏播放|全屏预览|路演"))]
        )
        fs_btn.click()
        fs_dialog = page.locator('[role="dialog"]').first
        fs_dialog.wait_for(state="visible", timeout=5000)
        page.keyboard.press("ArrowRight")
        page.wait_for_timeout(120)
        page.keyboard.press("Escape")
        fs_dialog.wait_for(state="hidden", timeout=5000)

        # Export .pptx & verify edited title + notes inside OOXML
        pptx_btn = first_visible(
            [page.get_by_role("button", name=re.compile(r"导出.*\.pptx|下载.*PPTX", re.I))]
        )
        pptx_name, pptx_bytes = guard.capture_download(lambda: pptx_btn.click())
        assert pptx_name.lower().endswith(".pptx")
        PptxVerifier.verify(
            pptx_bytes,
            min_size=30720,
            expected_min_slides=5,
            expected_slide_texts=[edited_title],
            expected_notes_texts=[edited_notes],
            require_notes=True,
        )

        # Export .html & verify edited title + notes inside offline HTML5 deck
        html_btn = first_visible(
            [page.get_by_role("button", name=re.compile(r"导出.*\.html|离线.*HTML|交互.*HTML", re.I))]
        )
        html_name, html_bytes = guard.capture_download(lambda: html_btn.click())
        assert html_name.lower().endswith(".html")
        HtmlDeckVerifier.verify(
            html_bytes,
            expected_min_slides=5,
            expected_slide_texts=[edited_title],
            expected_notes_texts=[edited_notes],
        )

        guard.assert_no_browser_errors("T1_UI_05")


def t1_ui_06_compare_8_slides_and_cta(ctx: TestContext) -> None:
    """Browser /compare: 3 styles synced across all 8 slide types, unified topic, matrix & CTAs."""
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.goto_ok(ctx.url("/compare"))

        preset_btn = page.locator("#pg-compare-preset-btn").or_(
            page.get_by_role("button", name=re.compile(r"一键载入.*三套|载入经典"))
        )
        if preset_btn.count() > 0 and preset_btn.first.is_visible():
            preset_btn.first.click()
            page.wait_for_timeout(300)

        gen_ctas = page.locator('a[href*="/generate?style="]')
        gen_ctas.nth(2).wait_for(state="visible", timeout=8000)
        assert gen_ctas.count() >= 3, f"Expected >= 3 /generate?style= CTAs on /compare, got {gen_ctas.count()}"

        tablist = page.locator('[role="tablist"][aria-label*="同步"]').or_(
            page.locator('[role="tablist"]').first
        )
        for st in SLIDE_TYPES:
            pat = re.compile(SLIDE_TYPE_LABELS[st]["pattern"], re.I)
            tab = tablist.get_by_role("tab", name=pat).or_(tablist.get_by_role("button", name=pat)).first
            tab.click()
            page.wait_for_timeout(120)
            col_canvases = page.locator('.pg-compare-col .pg-slide-outer, main .pg-slide-outer')
            assert col_canvases.count() >= 3, f"Slide {st}: expected >= 3 compare canvases"
            guard.assert_canvas_non_blank(
                col_canvases.first,
                slide_type=st,
                min_width=240,
                min_height=130,
                label=f"compare_{st}",
            )

        # Unified topic propagation on cover slide
        cover_tab = tablist.get_by_role("tab", name=re.compile(r"封面|Cover", re.I)).or_(
            tablist.get_by_role("button", name=re.compile(r"封面|Cover", re.I))
        ).first
        cover_tab.click()
        topic_inp = first_visible(
            [
                page.locator("#pg-compare-topic-input"),
                page.get_by_placeholder(re.compile(r"统一主题|同步预览")),
            ]
        )
        marker = "E2E对比压力测试主题"
        topic_inp.fill(marker)
        page.wait_for_timeout(200)
        hits = int(
            page.evaluate(
                """(m) => Array.from(document.querySelectorAll('main .pg-slide-stage'))
                  .filter((e) => (e.innerText || '').includes(m)).length""",
                marker,
            )
        )
        assert hits >= 3, f"Expected unified topic in all 3 compare canvases, found {hits}"

        body_text = page.locator("main").inner_text()
        for matrix_label in ("配色系统", "字体规范"):
            assert matrix_label in body_text, f"Compare parameter matrix missing {matrix_label!r}"

        guard.assert_no_browser_errors("T1_UI_06")


def t1_ui_07_create_remix_8_preview_visibility(ctx: TestContext) -> None:
    """Browser /create?fork=swiss-international-grid: Remix banner, 15 archetypes, 11 motifs, visibility."""
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.login_via_api(ctx.base_url, ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
        guard.goto_ok(ctx.url("/create?fork=swiss-international-grid"))

        # Remix attribution banner
        banner = page.get_by_text(re.compile(r"二创|改编自|Remix|克隆")).first
        assert banner.is_visible(), "Remix attribution banner not visible on /create?fork=..."

        # Prefilled title & archetype
        title_inp = first_visible([page.locator("#create-title"), page.get_by_label(re.compile(r"风格名称|标题"))])
        assert title_inp.input_value().strip(), "Remix mode did not prefill title input"

        arch_sel = page.locator("#create-arch")
        arch_sel.wait_for(state="visible")
        assert arch_sel.input_value() == "swiss-grid", (
            f"Expected prefilled archetype 'swiss-grid', got {arch_sel.input_value()!r}"
        )
        arch_values = arch_sel.evaluate("el => Array.from(el.options).map(o => o.value)")
        assert len(arch_values) == len(LAYOUT_ARCHETYPES), (
            f"Expected {len(LAYOUT_ARCHETYPES)} layout archetypes, got {len(arch_values)}: {arch_values}"
        )
        for v2_arch in ("soft-bento", "financial-terminal", "clinical-clean"):
            assert v2_arch in arch_values, f"Missing v2 layout archetype {v2_arch!r}"

        motif_sel = page.locator("#create-motif")
        motif_values = motif_sel.evaluate("el => Array.from(el.options).map(o => o.value)")
        assert len(motif_values) == len(DECORATIVE_MOTIFS), (
            f"Expected {len(DECORATIVE_MOTIFS)} decorative motifs, got {len(motif_values)}"
        )
        for v2_motif in ("bento-dots", "editorial-drop", "hairline-rule"):
            assert v2_motif in motif_values, f"Missing v2 decorative motif {v2_motif!r}"

        # Preview newly added v2 slide types
        for st in ("process", "timeline", "quote"):
            pat = re.compile(SLIDE_TYPE_LABELS[st]["pattern"], re.I)
            btn = first_visible(
                [
                    page.get_by_role("tab", name=pat),
                    page.get_by_role("button", name=pat),
                ]
            )
            btn.click()
            page.wait_for_timeout(150)
            guard.assert_canvas_non_blank(slide_type=st, label=f"create_preview_{st}")

        # Visibility toggle visible
        vis_public = page.get_by_text(re.compile(r"公开分享|公开发布|公开")).first
        vis_private = page.get_by_text(re.compile(r"仅自己可见|私有")).first
        assert vis_public.is_visible() and vis_private.is_visible(), (
            "Public / Private visibility controls not visible on /create"
        )

        guard.assert_no_browser_errors("T1_UI_07")


def t1_ui_08_collections_4_tabs_and_profile_modal(ctx: TestContext) -> None:
    """Browser /collections: UI demo login, all 4 workspace tabs & Edit Profile modal."""
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.goto_ok(ctx.url("/collections"))
        guard.login_via_demo_ui()
        page.wait_for_timeout(300)

        tab_patterns = (
            ("favorites", r"已收藏"),
            ("decks", r"保存.*文稿|PPT\s*文稿|我的文稿"),
            ("published", r"我发布"),
            ("liked", r"我点赞"),
        )
        for tab_key, pat in tab_patterns:
            tab = first_visible(
                [
                    page.get_by_role("tab", name=re.compile(pat)),
                    page.get_by_role("button", name=re.compile(pat)),
                ]
            )
            tab.click()
            page.wait_for_timeout(200)
            ctx.details[f"tab_{tab_key}_clicked"] = True

        # Open Edit Profile modal & verify fields
        edit_btn = first_visible(
            [page.get_by_role("button", name=re.compile(r"编辑.*资料|修改资料|个人资料"))]
        )
        edit_btn.click()
        modal = page.locator('[role="dialog"]').first
        modal.wait_for(state="visible", timeout=5000)
        assert modal.locator("input, textarea").count() >= 2, (
            "Edit Profile modal missing displayName/bio inputs"
        )
        page.keyboard.press("Escape")
        guard.assert_no_browser_errors("T1_UI_08")


def t1_ui_09_creator_profile_page(ctx: TestContext) -> None:
    """Browser /creator/pptgod_lab: creator header, bio, impact metrics & 9 public style cards."""
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.goto_ok(ctx.url(f"/creator/{ACCOUNT_OFFICIAL.username}"))

        main_text = page.locator("main").inner_text()
        assert ACCOUNT_OFFICIAL.display_name in main_text, "Creator display name missing"
        assert f"@{ACCOUNT_OFFICIAL.username}" in main_text, "Creator @username handle missing"
        assert "专注演示文稿设计系统" in main_text, "Creator bio missing"
        for metric_re in (r"发布|作品", r"获赞", r"收藏", r"复制"):
            assert re.search(metric_re, main_text), f"Creator impact metric {metric_re!r} missing"

        cards = page.locator("article[data-prompt-slug]")
        card_count = cards.count()
        if card_count == 0:
            card_count = len(
                set(
                    page.locator('main a[href^="/studio/"]').evaluate_all(
                        "els => els.map(e => e.getAttribute('href'))"
                    )
                )
            )
        assert card_count == ACCOUNT_OFFICIAL.seeded_prompt_count, (
            f"Expected {ACCOUNT_OFFICIAL.seeded_prompt_count} public cards on /creator/pptgod_lab, "
            f"got {card_count}"
        )

        guard.assert_no_browser_errors("T1_UI_09")


# ---------------------------------------------------------------------------
# Tier 1 Registry Export (22 Tests)
# ---------------------------------------------------------------------------


def get_tier1_tests() -> list[TestCaseSpec]:
    return [
        TestCaseSpec("T1_API_01_catalog_18_styles", 1, "Catalog returns all 18 public curated styles", ("api", "F1", "F2", "F3", "F33"), t1_api_01_catalog_18_styles),
        TestCaseSpec("T1_API_02_catalog_filters_and_sort", 1, "Catalog multi-dim filters (q/scenario/style/color/6 tools) & sort", ("api", "F9", "F33"), t1_api_02_catalog_filters_and_sort),
        TestCaseSpec("T1_API_03_auth_lifecycle", 1, "Auth login/me(stats.decks)/logout lifecycle", ("api", "F3", "F32", "F33"), t1_api_03_auth_lifecycle),
        TestCaseSpec("T1_API_04_prompt_detail_and_copy", 1, "Prompt detail by slug/id and copy counter increment", ("api", "F2", "F15", "F33"), t1_api_04_prompt_detail_and_copy),
        TestCaseSpec("T1_API_05_prompt_create_remix_edit_delete", 1, "Prompt Remix POST -> PUT edit -> PATCH visibility -> DELETE", ("api", "F25", "F26", "F27", "F33"), t1_api_05_prompt_create_remix_edit_delete),
        TestCaseSpec("T1_API_06_prompt_like_and_favorite_toggle", 1, "Prompt like & favorite idempotent toggles", ("api", "F11", "F14", "F33"), t1_api_06_prompt_like_and_favorite_toggle),
        TestCaseSpec("T1_API_07_comments_crud", 1, "Per-tool verified reviews GET/POST/DELETE", ("api", "F2", "F17", "F33"), t1_api_07_comments_crud),
        TestCaseSpec("T1_API_08_sync_favorites", 1, "Guest favorites cloud sync idempotency", ("api", "F30", "F33"), t1_api_08_sync_favorites),
        TestCaseSpec("T1_API_09_profile_patch", 1, "User profile PATCH & clean restore", ("api", "F29", "F33"), t1_api_09_profile_patch),
        TestCaseSpec("T1_API_10_generate_smart_engine", 1, "Smart semantic generation engine (7 slides + notes)", ("api", "F18", "F19", "F33"), t1_api_10_generate_smart_engine),
        TestCaseSpec("T1_API_11_export_pptx_ooxml_verification", 1, "Native .pptx export OOXML ZIP/XML/notes verification", ("api", "F16", "F23", "F33", "F35"), t1_api_11_export_pptx_ooxml_verification),
        TestCaseSpec("T1_API_12_saved_decks_crud", 1, "Saved decks CRUD & private-by-default lifecycle", ("api", "F23", "F28", "F33"), t1_api_12_saved_decks_crud),
        TestCaseSpec("T1_API_13_creator_profile_api", 1, "Creator profile API public portfolio & impact stats", ("api", "F31", "F33"), t1_api_13_creator_profile_api),
        TestCaseSpec("T1_UI_01_navbar_and_gallery_18_cards", 1, "Browser /: Navbar 4 links, 18 cards, live topic & filter reset", ("ui", "F8", "F9", "F11", "F32"), t1_ui_01_navbar_and_gallery_18_cards),
        TestCaseSpec("T1_UI_02_style_matcher_modal", 1, "Browser /: 30s StyleMatcherModal 3 steps -> Top 3 previews", ("ui", "F10"), t1_ui_02_style_matcher_modal),
        TestCaseSpec("T1_UI_03_studio_8_slides_anatomy_tuning", 1, "Browser /studio: 8 slide types, 5-dim anatomy, live tuning & fullscreen", ("ui", "F4", "F5", "F7", "F12", "F13", "F14"), t1_ui_03_studio_8_slides_anatomy_tuning),
        TestCaseSpec("T1_UI_04_studio_6_tools_batch_exports_reviews", 1, "Browser /studio: 6 tools, 6-slide batch, Quick Launch, .pptx/.html & reviews", ("ui", "F15", "F16", "F17"), t1_ui_04_studio_6_tools_batch_exports_reviews),
        TestCaseSpec("T1_UI_05_generate_workshop_end_to_end", 1, "Browser /generate: preset, re-skin, WYSIWYG, fullscreen & .pptx/.html", ("ui", "F4", "F6", "F18", "F19", "F20", "F21", "F22", "F23"), t1_ui_05_generate_workshop_end_to_end),
        TestCaseSpec("T1_UI_06_compare_8_slides_and_cta", 1, "Browser /compare: 8 synced slide types, unified topic & Generate CTA", ("ui", "F24"), t1_ui_06_compare_8_slides_and_cta),
        TestCaseSpec("T1_UI_07_create_remix_8_preview_visibility", 1, "Browser /create?fork=: Remix banner, 15 archetypes, 11 motifs & visibility", ("ui", "F25", "F26"), t1_ui_07_create_remix_8_preview_visibility),
        TestCaseSpec("T1_UI_08_collections_4_tabs_and_profile_modal", 1, "Browser /collections: 4 tabs & Edit Profile modal", ("ui", "F28", "F29", "F32"), t1_ui_08_collections_4_tabs_and_profile_modal),
        TestCaseSpec("T1_UI_09_creator_profile_page", 1, "Browser /creator/pptgod_lab: header, impact stats & 9 cards", ("ui", "F31"), t1_ui_09_creator_profile_page),
    ]
