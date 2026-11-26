"""Tier 1 — Isolated Feature Happy Paths for PPTGod · Glacier UI 2.0.

Covers ALL core API routes (`G1_API_01..12`) and ALL Glacier UI 2.0 routes,
modals, and widgets (`G1_UI_01`, `G1_UI_01B`, `G1_UI_02..15`, `G1_UI_15B`)
with zero legacy `tests/e2e/` imports and zero swallowed exceptions.
"""

from __future__ import annotations

import json
import re
import urllib.parse
from pathlib import Path
from typing import Any

from .config import (
    ACCOUNT_DEMO,
    ACCOUNT_OFFICIAL,
    BASELINE_COLOR_COUNTS,
    BASELINE_SCENARIO_COUNTS,
    BASELINE_STYLE_COUNTS,
    BASELINE_TOOL_COUNTS,
    COMPARE_STORAGE_KEY,
    DOMAIN_EXPECTED_COUNTS,
    GUEST_FAVS_STORAGE_KEY,
    OFFICIAL_STYLE_SLUGS,
    PPTX_CONTENT_TYPE,
    SEED_COMMENTS,
    SLIDE_TYPES,
    SOURCE_MATERIAL_PRESETS,
    TARGET_TOOLS,
    TOOL_MARKERS,
    build_png_bytes,
    build_valid_docx_bytes,
    build_valid_pdf_bytes,
    build_valid_pptx_bytes,
    make_12_slide_deck,
    make_pptgod_style_pack_json,
    make_valid_deck_payload,
    make_valid_prompt_payload,
    make_valid_slides,
    unique_token,
)
from .helpers import (
    HtmlDeckVerifier,
    PptxVerifier,
    TestContext,
    TestSpec,
    assert_16_9_ratio,
    assert_any_visible,
    click_resilient,
    ensure_editor_ready,
    fill_resilient,
    locate_attached,
    locate_first,
    login_via_api,
)

# ---------------------------------------------------------------------------
# Tier 1A — Core API Happy Paths (G1_API_01 .. G1_API_12)
# ---------------------------------------------------------------------------


def g1_api_01_health(ctx: TestContext) -> None:
    resp = ctx.api().get("/api/health")
    resp.assert_status(200, "GET /api/health")
    data = resp.require_json("GET /api/health")
    assert data.get("status") == "ok", f"Expected status='ok', got {data!r}"
    assert data.get("catalogCount") == 36, f"Expected catalogCount=36, got {data!r}"
    assert str(data.get("dbMode", "")).lower() == "postgresql", f"Expected dbMode='postgresql', got {data!r}"


def g1_api_02_prompts_catalog_filters(ctx: TestContext) -> None:
    api = ctx.api()
    resp = api.get("/api/prompts")
    resp.assert_status(200, "GET /api/prompts")
    data = resp.require_json("GET /api/prompts")
    prompts = data.get("prompts")
    assert isinstance(prompts, list), f"Expected prompts list, got {type(prompts)}"
    assert len(prompts) == 36, f"Expected 36 baseline prompts, got {len(prompts)}"
    slugs = {p["slug"] for p in prompts}
    assert slugs == set(OFFICIAL_STYLE_SLUGS), (
        f"Slug mismatch: missing={set(OFFICIAL_STYLE_SLUGS) - slugs}, extra={slugs - set(OFFICIAL_STYLE_SLUGS)}"
    )
    assert all(p.get("isPublic") is True for p in prompts), "Catalog returned non-public prompt"

    # Facet filters
    for label, query, expected_count in (
        ("color=dark", {"color": "dark"}, BASELINE_COLOR_COUNTS["dark"]),
        ("tool=slidev-marp", {"tool": "slidev-marp"}, BASELINE_TOOL_COUNTS["slidev-marp"]),
        ("scenario=科研基金", {"scenario": "科研基金"}, BASELINE_SCENARIO_COUNTS["科研基金"]),
        ("style=商务咨询", {"style": "商务咨询"}, BASELINE_STYLE_COUNTS["商务咨询"]),
    ):
        r = api.get("/api/prompts", query=query).assert_status(200, f"filter {label}")
        items = r.require_json(label)["prompts"]
        assert len(items) == expected_count, (
            f"Filter {label}: expected {expected_count} prompts, got {len(items)}"
        )

    # Keyword search
    q_resp = api.get("/api/prompts", query={"q": "Bento"}).assert_status(200, "q=Bento")
    q_slugs = [p["slug"] for p in q_resp.require_json("q=Bento")["prompts"]]
    assert "apple-soft-bento-modular" in q_slugs, f"q=Bento missing apple-soft-bento-modular: {q_slugs}"

    # Sort modes
    for sort_mode in ("popular", "newest", "copies"):
        sr = api.get("/api/prompts", query={"sort": sort_mode}).assert_status(200, f"sort={sort_mode}")
        s_items = sr.require_json(f"sort={sort_mode}")["prompts"]
        assert len(s_items) == 36, f"sort={sort_mode} returned {len(s_items)} items"
        if sort_mode == "copies":
            counts = [int(p.get("copiesCount", 0)) for p in s_items]
            assert counts == sorted(counts, reverse=True), f"sort=copies not descending: {counts[:8]}"


def g1_api_03_auth_lifecycle(ctx: TestContext) -> None:
    with ctx.api() as client:
        login_resp = client.login(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
        set_cookie = login_resp.header("set-cookie")
        assert "httponly" in set_cookie.lower(), f"Session cookie must be HttpOnly: {set_cookie!r}"

        me_resp = client.get("/api/auth/me").assert_status(200, "GET /api/auth/me authenticated")
        me_data = me_resp.require_json("GET /api/auth/me")
        assert me_data["user"]["id"] == ACCOUNT_DEMO.id, f"Unexpected user: {me_data}"
        stats = me_data.get("stats") or {}
        for key in ("published", "likes", "favorites", "decks"):
            assert key in stats and isinstance(stats[key], int), f"Missing stats.{key}: {stats}"

        logout_resp = client.logout()
        logout_resp.assert_status(200, "POST /api/auth/logout")

        me_after = client.get("/api/auth/me").assert_status(200, "GET /api/auth/me post-logout")
        assert me_after.require_json("post-logout /me").get("user") is None, (
            "Expected user=null after logout"
        )


def g1_api_04_prompts_crud(ctx: TestContext) -> None:
    demo = ctx.api_logged_in(ACCOUNT_DEMO)
    with ctx.cleanup() as cleanup:
        payload = make_valid_prompt_payload(is_public=True)
        create_resp = demo.post("/api/prompts", json_body=payload).assert_status(201, "POST /api/prompts")
        created = create_resp.require_json("POST /api/prompts")["prompt"]
        pid = created["id"]
        slug = created["slug"]
        cleanup.register_delete_prompt(demo, pid)

        assert created["likesCount"] == 1, f"Expected initial likesCount=1, got {created['likesCount']}"
        assert created["isPublic"] is True

        # Read
        get_resp = demo.get(f"/api/prompts/{pid}").assert_status(200, "GET /api/prompts/[id]")
        assert get_resp.require_json()["prompt"]["slug"] == slug

        # Update via PUT preserving slug
        updated_payload = dict(payload)
        updated_payload["title"] = f"[E2E] 更新后冰川模板 {unique_token('UPD')}"
        put_resp = demo.put(f"/api/prompts/{pid}", json_body=updated_payload).assert_status(
            200, "PUT /api/prompts/[id]"
        )
        updated = put_resp.require_json()["prompt"]
        assert updated["title"] == updated_payload["title"]
        assert updated["slug"] == slug, f"PUT altered slug: {slug} -> {updated['slug']}"

        # Visibility toggle via PATCH
        patch_priv = demo.patch(f"/api/prompts/{pid}", json_body={"isPublic": False}).assert_status(
            200, "PATCH /api/prompts/[id] private"
        )
        assert patch_priv.require_json()["prompt"]["isPublic"] is False
        patch_pub = demo.patch(f"/api/prompts/{pid}", json_body={"isPublic": True}).assert_status(
            200, "PATCH /api/prompts/[id] public"
        )
        assert patch_pub.require_json()["prompt"]["isPublic"] is True

        # Explicit DELETE + verify 404
        demo.delete(f"/api/prompts/{pid}").assert_status(200, "DELETE /api/prompts/[id]")
        demo.get(f"/api/prompts/{pid}").assert_status(404, "GET deleted prompt")


def g1_api_05_prompt_social_and_sync(ctx: TestContext) -> None:
    demo = ctx.api_logged_in(ACCOUNT_DEMO)
    target_id = "prompt_soft_bento"
    swiss_id = "prompt_swiss_grid"
    with ctx.cleanup() as cleanup:
        # Read baseline states strictly via frozen likedByMe / favoritedByMe keys
        init = demo.get(f"/api/prompts/{target_id}").assert_status(200).require_json()["prompt"]
        assert "likedByMe" in init and "favoritedByMe" in init, (
            f"GET /api/prompts/{target_id} missing likedByMe/favoritedByMe: {sorted(init.keys())}"
        )
        orig_liked = bool(init["likedByMe"])
        orig_fav = bool(init["favoritedByMe"])
        cleanup.register_restore_toggle(demo, target_id, "like", orig_liked)
        cleanup.register_restore_toggle(demo, target_id, "favorite", orig_fav)

        # Read baseline favorite state of prompt_swiss_grid and register restore BEFORE sync-favorites
        swiss_init = demo.get(f"/api/prompts/{swiss_id}").assert_status(200).require_json()["prompt"]
        assert "favoritedByMe" in swiss_init, (
            f"GET /api/prompts/{swiss_id} missing favoritedByMe: {sorted(swiss_init.keys())}"
        )
        orig_swiss_fav = bool(swiss_init["favoritedByMe"])
        cleanup.register_restore_toggle(demo, swiss_id, "favorite", orig_swiss_fav)

        # Toggle like twice
        like1 = demo.post(f"/api/prompts/{target_id}/like").assert_status(200).require_json()
        assert like1["liked"] is (not orig_liked), f"Like did not toggle: {like1}"
        like2 = demo.post(f"/api/prompts/{target_id}/like").assert_status(200).require_json()
        assert like2["liked"] is orig_liked, f"Like did not restore: {like2}"

        # Toggle favorite + sync-favorites merge
        fav1 = demo.post(f"/api/prompts/{target_id}/favorite").assert_status(200).require_json()
        assert fav1["favorited"] is (not orig_fav), f"Favorite did not toggle: {fav1}"

        sync_resp = demo.post(
            "/api/prompts/sync-favorites",
            json_body={"promptIds": [target_id, swiss_id]},
        ).assert_status(200, "POST /api/prompts/sync-favorites")
        sync_data = sync_resp.require_json()
        min_expected = 1 if not orig_swiss_fav else 0
        assert isinstance(sync_data.get("synced"), int) and sync_data["synced"] >= min_expected, (
            f"Expected sync-favorites synced >= {min_expected}, got {sync_data!r}"
        )

        # Copy counter (respecting 5s dedupe window)
        before_copies = int(
            demo.get(f"/api/prompts/{swiss_id}").assert_status(200).require_json()["prompt"]["copiesCount"]
        )
        copy_resp = demo.post(f"/api/prompts/{swiss_id}/copy").assert_status(200).require_json()
        assert isinstance(copy_resp.get("copiesCount"), int)
        if copy_resp.get("counted") is True:
            assert copy_resp["copiesCount"] == before_copies + 1
        else:
            assert copy_resp["copiesCount"] == before_copies


def g1_api_06_comments_crud(ctx: TestContext) -> None:
    demo = ctx.api_logged_in(ACCOUNT_DEMO)
    prompt_id = "prompt_swiss_grid"
    with ctx.cleanup() as cleanup:
        list_resp = demo.get(f"/api/prompts/{prompt_id}/comments").assert_status(200)
        comments = list_resp.require_json()["comments"]
        seed_ids = {c["id"] for c in SEED_COMMENTS if c["promptId"] == prompt_id}
        returned_ids = {c["id"] for c in comments}
        assert seed_ids.issubset(returned_ids), (
            f"Missing seed comments {seed_ids - returned_ids} in {returned_ids}"
        )

        tok = unique_token("CMT")
        content = f"[E2E] Glacier 2.0 实测 Slidev/Marp 导出结构清晰 ({tok})"
        post_resp = demo.post(
            f"/api/prompts/{prompt_id}/comments",
            json_body={"content": content, "testedTool": "slidev-marp", "rating": 5},
        ).assert_status(201, "POST comment")
        after_comments = post_resp.require_json()["comments"]
        created = next((c for c in after_comments if c.get("content") == content), None)
        assert created is not None, "Created comment missing from POST response list"
        cid = created["id"]
        cleanup.register_delete_comment(demo, prompt_id, cid)
        assert created["testedTool"] == "slidev-marp"
        assert int(created["rating"]) == 5

        del_resp = demo.delete(
            f"/api/prompts/{prompt_id}/comments",
            query={"commentId": cid},
        ).assert_status(200, "DELETE comment")
        remaining_ids = {c["id"] for c in del_resp.require_json()["comments"]}
        assert cid not in remaining_ids, f"Deleted comment {cid} still present"


def g1_api_07_profile_and_creator_api(ctx: TestContext) -> None:
    demo = ctx.api_logged_in(ACCOUNT_DEMO)
    with ctx.cleanup() as cleanup:
        cleanup.register_restore_profile(demo, ACCOUNT_DEMO)
        tok = unique_token("PROF")
        patch_resp = demo.patch(
            "/api/auth/profile",
            json_body={
                "displayName": f"林屿 · 冰川验证 {tok[:4]}",
                "bio": f"自动化个人资料更新验证 {tok}",
                "avatarColor": "#2563EB",
            },
        ).assert_status(200, "PATCH /api/auth/profile")
        user = patch_resp.require_json()["user"]
        assert user["displayName"].startswith("林屿 · 冰川验证")
        assert user["avatarColor"].upper() == "#2563EB"

    creator_resp = ctx.api().get(f"/api/creators/{ACCOUNT_OFFICIAL.username}").assert_status(
        200, "GET /api/creators/pptgod_lab"
    )
    cdata = creator_resp.require_json()
    assert cdata["creator"]["username"] == ACCOUNT_OFFICIAL.username
    assert len(cdata["prompts"]) == ACCOUNT_OFFICIAL.seeded_prompt_count
    assert cdata["impact"]["publishedCount"] == ACCOUNT_OFFICIAL.seeded_prompt_count
    assert cdata.get("privateCount", 0) == 0


def g1_api_08_parse_document_formats(ctx: TestContext) -> None:
    api = ctx.api()
    md_content = (
        "# 2026 企业级 AI 知识引擎技术白皮书\n\n"
        "## 核心痛点\n跨部门文档超过 400 万份，检索准确率不足 42%。\n\n"
        "## 实测成效\n方案编写效率提升 +146%，P99 延迟低至 18ms，准确率 99.4%。\n"
    ).encode("utf-8")
    txt_content = (
        "年度科研基金答辩提纲：钙钛矿太阳能电池界面结晶调控。\n"
        "实验结果：效率由 23.4% 提升至 26.1%，双 85 老化 1500h 保持率 94.2%。\n"
    ).encode("utf-8")

    cases = [
        ("brief.md", md_content, "text/markdown", "md"),
        ("notes.txt", txt_content, "text/plain", "txt"),
        ("proposal.docx", build_valid_docx_bytes(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"),
        ("legacy_deck.pptx", build_valid_pptx_bytes(), PPTX_CONTENT_TYPE, "pptx"),
        ("exec_brief.pdf", build_valid_pdf_bytes(), "application/pdf", "pdf"),
    ]

    for filename, raw, mime, expected_type in cases:
        resp = api.post_multipart(
            "/api/parse-document",
            filename=filename,
            content=raw,
            content_type=mime,
        ).assert_status(200, f"parse-document {filename}")
        data = resp.require_json(f"parse-document {filename}")
        assert data.get("ok") is True, f"{filename}: ok != True ({data})"
        assert data.get("fileType") == expected_type, f"{filename}: fileType={data.get('fileType')}"
        assert int(data.get("charCount", 0)) > 20, f"{filename}: charCount too small ({data.get('charCount')})"
        assert data.get("isScannedPdf") is False, f"{filename}: unexpectedly flagged as scanned PDF"
        analysis = data.get("analysis") or {}
        assert analysis.get("detectedScenario"), f"{filename}: missing analysis.detectedScenario"
        assert analysis.get("materialKind"), f"{filename}: missing analysis.materialKind"
        recs = analysis.get("recommendedStyles") or []
        assert 1 <= len(recs) <= 3, f"{filename}: expected 1..3 recommendedStyles, got {len(recs)}"
        if expected_type == "pptx":
            assert analysis.get("materialKind") == "existing-pptx"
            assert analysis.get("recommendedRouteMode") == "beautify-1to1"
            parsed_outline = data.get("parsedOutline") or []
            assert len(parsed_outline) == 4, f"Expected 4 slides in parsedOutline, got {len(parsed_outline)}"


def g1_api_09_outline_and_smart_generate(ctx: TestContext) -> None:
    api = ctx.api()
    preset = SOURCE_MATERIAL_PRESETS[0]
    outline_resp = api.post(
        "/api/outline",
        json_body={
            "topic": preset["topic"],
            "subtitle": preset["subtitle"],
            "audience": preset["audience"],
            "scenario": preset["scenario"],
            "sourceText": preset["rawText"],
            "slideCount": 10,
            "mode": "smart",
        },
    ).assert_status(200, "POST /api/outline")
    odata = outline_resp.require_json()
    assert odata.get("engine") == "smart"
    outline = odata.get("outline") or []
    assert len(outline) == 10, f"Expected 10 outline items, got {len(outline)}"
    for item in outline:
        assert item.get("slideType") in SLIDE_TYPES, f"Unknown slideType: {item}"
        assert item.get("title"), f"Empty outline title: {item}"

    # Customize slide 2 title and verify /api/generate honors it
    custom_s2 = f"定制架构突破 {unique_token('OUT')}"
    outline[1]["title"] = custom_s2
    gen_resp = api.post(
        "/api/generate",
        json_body={
            "topic": preset["topic"],
            "subtitle": preset["subtitle"],
            "audience": preset["audience"],
            "scenario": preset["scenario"],
            "sourceText": preset["rawText"],
            "slideCount": 10,
            "mode": "smart",
            "outline": outline,
        },
    ).assert_status(200, "POST /api/generate")
    gdata = gen_resp.require_json()
    assert gdata.get("engine") == "smart"
    slides = gdata.get("slides") or []
    assert len(slides) == 10, f"Expected 10 generated slides, got {len(slides)}"
    assert any(custom_s2 in str(s.get("title", "")) for s in slides), (
        f"Edited outline title {custom_s2!r} not preserved in generated slides"
    )
    assert all(len(str(s.get("speakerNotes", "")).strip()) >= 8 for s in slides), (
        "All generated slides should have non-empty speakerNotes"
    )


def g1_api_10_polish_all_three_actions(ctx: TestContext) -> None:
    api = ctx.api()
    base_slide = make_12_slide_deck()[3]  # image-split with imageSlot + bullets + sourceStatus
    for action in ("executive", "metrics", "notes"):
        resp = api.post(
            "/api/polish",
            json_body={"slide": base_slide, "action": action, "mode": "smart"},
        ).assert_status(200, f"POST /api/polish ({action})")
        data = resp.require_json()
        assert data.get("engine") == "smart"
        polished = data["slide"]
        assert polished["id"] == base_slide["id"], f"{action}: slide.id mutated"
        assert polished["slideType"] == base_slide["slideType"], f"{action}: slideType mutated"
        assert polished.get("imageSlot") == base_slide.get("imageSlot"), f"{action}: imageSlot lost"
        notes = str(polished.get("speakerNotes", ""))
        if action == "executive":
            assert "高管决策" in notes or "核心结论" in str(polished.get("title", ""))
        elif action == "metrics":
            assert "量化" in notes or "%" in str(polished.get("title", ""))
        elif action == "notes":
            assert "各位好" in notes and len(notes) >= 20


def g1_api_11_decks_crud_and_native_pptx(ctx: TestContext) -> None:
    demo = ctx.api_logged_in(ACCOUNT_DEMO)
    with ctx.cleanup() as cleanup:
        tok = unique_token("PPTX")
        brand_footer = f"PPTGod Glacier {tok[:6]}"
        slides_12 = make_12_slide_deck(
            custom_title=f"[E2E-DECK] 全版式导出 {tok}",
            include_image_data_url=True,
            chart_mode="donut",
        )
        payload = make_valid_deck_payload(
            title=f"[E2E-DECK] 云端保存 {tok}",
            slides=slides_12,
            is_public=None,  # omit to verify private default
            brand_footer=brand_footer,
        )
        create_resp = demo.post("/api/decks", json_body=payload).assert_status(201, "POST /api/decks")
        deck = create_resp.require_json()["deck"]
        deck_id = deck["id"]
        cleanup.register_delete_deck(demo, deck_id)
        assert deck["isPublic"] is False, "New deck should default to isPublic=false"

        # List & Get
        list_ids = [d["id"] for d in demo.get("/api/decks").assert_status(200).require_json()["decks"]]
        assert deck_id in list_ids
        demo.get(f"/api/decks/{deck_id}").assert_status(200)

        # Rename via PUT (required idiom)
        renamed_title = f"[E2E-DECK] 重命名 {tok}"
        put_payload = dict(payload)
        put_payload["title"] = renamed_title
        put_resp = demo.put(f"/api/decks/{deck_id}", json_body=put_payload).assert_status(
            200, "PUT /api/decks/[id] rename"
        )
        assert put_resp.require_json()["deck"]["title"] == renamed_title

        # Duplicate via POST omitting id
        dup_payload = dict(put_payload)
        dup_payload.pop("id", None)
        dup_payload["title"] = f"[E2E-DECK] 副本 {tok}"
        dup_resp = demo.post("/api/decks", json_body=dup_payload).assert_status(201, "POST duplicate deck")
        dup_id = dup_resp.require_json()["deck"]["id"]
        cleanup.register_delete_deck(demo, dup_id)
        assert dup_id != deck_id

        # Toggle visibility via PATCH
        patch_resp = demo.patch(f"/api/decks/{deck_id}", json_body={"isPublic": True}).assert_status(200)
        assert patch_resp.require_json()["deck"]["isPublic"] is True

        # Native 12-slide PPTX export verification
        export_resp = demo.post(
            "/api/export/pptx",
            json_body={
                "title": renamed_title,
                "subtitle": payload["subtitle"],
                "audience": payload["audience"],
                "styleName": "Glacier Soft Bento",
                "visualSpec": payload["visualSpec"],
                "slides": slides_12,
            },
        )
        insp = PptxVerifier.verify_response(
            export_resp,
            min_size=30720,
            expected_slide_count=12,
            require_slide_master=True,
            require_notes=True,
            require_native_table=True,
            require_chart_types=("barChart", "doughnutChart"),
            require_media=True,
            expected_slide_texts=(
                f"[E2E-DECK] 全版式导出 {tok}",
                brand_footer,
                "平均耗时 4.5 小时",
                "单页仅换版式不动字",
                "设计系统负责人",
                "真正决定企业演示效率的",
            ),
            expected_notes_texts=("封面页开场白",),
        )
        ctx.record_metric("pptx_size_bytes", insp.size_bytes)
        ctx.record_metric("pptx_chart_types", list(insp.chart_types))


def g1_api_12_seo_and_og_image(ctx: TestContext) -> None:
    api = ctx.api()
    robots = api.get("/robots.txt").assert_status(200, "GET /robots.txt").text()
    allow_paths = [
        line.split(":", 1)[1].strip()
        for line in robots.splitlines()
        if line.strip().lower().startswith("allow:")
    ]
    disallow_paths = [
        line.split(":", 1)[1].strip()
        for line in robots.splitlines()
        if line.strip().lower().startswith("disallow:")
    ]
    assert "/api/" in robots, f"robots.txt should mention /api/: {robots}"
    assert "/collections" in robots, f"robots.txt should disallow /collections: {robots}"
    assert "/deck/" in robots, f"robots.txt should disallow /deck/: {robots}"
    for pub_path in ("/gallery", "/tools"):
        assert any(p == pub_path or p.rstrip("/") == pub_path for p in allow_paths), (
            f"robots.txt should explicitly Allow {pub_path!r} (Allow={allow_paths!r}): {robots}"
        )
        assert not any(p == pub_path or p.rstrip("/") == pub_path for p in disallow_paths), (
            f"robots.txt must NOT Disallow {pub_path!r} (Disallow={disallow_paths!r})"
        )

    sitemap = api.get("/sitemap.xml").assert_status(200, "GET /sitemap.xml").text()
    for path_fragment in ("/gallery", "/tools", "/generate", "/compare", "/create", "/studio/apple-soft-bento-modular"):
        assert path_fragment in sitemap, f"sitemap.xml missing {path_fragment!r}"

    og = api.get("/studio/apple-soft-bento-modular/opengraph-image").assert_status(
        200, "GET opengraph-image"
    )
    assert "image/png" in og.header("content-type").lower(), f"Bad OG Content-Type: {og.header('content-type')}"
    assert og.body.startswith(b"\x89PNG\r\n\x1a\n"), "OG image missing PNG magic signature"
    assert len(og.body) > 5000, f"OG image unexpectedly small: {len(og.body)} bytes"


# ---------------------------------------------------------------------------
# Tier 1B — Browser UI Happy Paths (G1_UI_01 .. G1_UI_15B, 1440×900)
# ---------------------------------------------------------------------------


def g1_ui_01_dashboard_bento(ctx: TestContext) -> None:
    with ctx.browser_page() as guard:
        guard.goto_ok(f"{ctx.base_url}/")
        page = guard.page

        # Hero H1 exact copy + ONLY "AI 创作" in Glacier primary blue #2563EB
        h1_info = page.evaluate(
            """() => {
              const h1 = document.querySelector('main h1, h1');
              if (!h1) return null;
              const h1Color = getComputedStyle(h1).color;
              const spans = Array.from(h1.querySelectorAll('span, em, strong, mark')).map((s) => ({
                text: (s.textContent || '').trim(),
                color: getComputedStyle(s).color,
              }));
              return { text: (h1.innerText || '').trim(), h1Color, spans };
            }"""
        )
        assert h1_info is not None, "Dashboard missing H1 heading"
        assert "你好" in h1_info["text"] and "AI 创作" in h1_info["text"] and "演示文稿" in h1_info["text"], (
            f"Unexpected Dashboard H1 text: {h1_info['text']!r}"
        )
        blue_spans = [s for s in h1_info["spans"] if "37, 99, 235" in s["color"]]
        assert len(blue_spans) == 1 and "AI 创作" in blue_spans[0]["text"], (
            f"Expected ONLY 'AI 创作' span in #2563EB rgb(37,99,235), got spans={h1_info['spans']}"
        )
        assert "37, 99, 235" not in h1_info["h1Color"], "Entire H1 should not be primary blue"

        # Row 1: 3-Tab switching + slideCount + audience + primary CTA + UploadDropzone
        tab_specs = [
            (r"资料转\s*PPT|导入资料", "Tab 2 (资料转 PPT)"),
            (r"从模板新建|模板新建", "Tab 3 (从模板新建)"),
            (r"AI\s*生成", "Tab 1 (AI 生成)"),
        ]
        for pat, desc in tab_specs:
            click_resilient(
                page,
                [lambda p, rx=pat: p.get_by_role("tab", name=re.compile(rx, re.I))],
                description=desc,
            )
        assert_any_visible(
            page,
            [
                lambda p: p.locator("main").get_by_label(re.compile(r"页数|幻灯片数|slide", re.I)),
                'main select[name*="slide" i]',
                'main input[type="range"]',
                'main input[type="number"]',
                lambda p: p.locator("main").get_by_text(re.compile(r"\d+\s*页")),
            ],
            description="Dashboard Row 1 slideCount control",
        )
        assert_any_visible(
            page,
            [
                lambda p: p.locator("main").get_by_label(re.compile(r"受众|对象|audience", re.I)),
                lambda p: p.locator("main").get_by_placeholder(re.compile(r"受众|高管|评审|听众", re.I)),
                'main select[name*="audience" i]',
                'main input[name*="audience" i]',
                lambda p: p.locator("main").get_by_text(re.compile(r"目标受众|汇报对象|高管决策|投资人|通用受众")),
            ],
            description="Dashboard Row 1 audience control",
        )
        assert_any_visible(
            page,
            [
                lambda p: p.locator("main").get_by_role(
                    "button", name=re.compile(r"生成\s*PPT|开始生成|立即生成|一键生成", re.I)
                ),
            ],
            description="Dashboard Row 1 primary Generate CTA",
        )
        locate_attached(
            page,
            ['main input[type="file"]'],
            description="Dashboard Row 1 UploadDropzone file input",
        )

        # Row 2: Live 3-style comparison responds synchronously to typed topic
        custom_topic = "冰川量子计算效能跃升"
        fill_resilient(
            page,
            [
                lambda p: p.get_by_placeholder(re.compile(r"描述你的演示主题|输入.*主题|演示文稿", re.I)),
                "main textarea",
            ],
            custom_topic,
            description="Dashboard topic textarea",
        )
        page.wait_for_timeout(250)
        matched_canvases = int(
            page.evaluate(
                "(topic) => Array.from(document.querySelectorAll('.pg-slide-outer, .pg-slide-stage'))"
                ".filter((el) => (el.innerText || '').includes(topic)).length",
                custom_topic,
            )
        )
        assert matched_canvases >= 3, (
            f"Expected >= 3 live SlideCanvas cards synced to topic {custom_topic!r}, found {matched_canvases}"
        )

        # Unconditional Radio selection in 3-style comparison (NO silent skip)
        radios = page.locator('main input[type="radio"], main [role="radio"]')
        assert radios.count() >= 3, (
            f"Expected >= 3 style comparison radio controls on Dashboard Row 2, got {radios.count()}"
        )
        second_radio = radios.nth(1)
        second_radio.scroll_into_view_if_needed()
        second_radio.click(force=True)
        page.wait_for_timeout(120)
        is_checked = bool(
            second_radio.evaluate(
                "(el) => Boolean(el.checked) || el.getAttribute('aria-checked') === 'true'"
            )
        )
        assert is_checked, "Clicking 2nd style comparison radio did not mark it checked/selected"

        assert_any_visible(page, ['a[href^="/compare"]'], description="更多对比 link to /compare")
        assert_any_visible(page, ['a[href^="/gallery"]'], description="更多风格 link to /gallery")

        # 2x3 recommended styles (>= 9 live slide previews across Row 2)
        total_slide_frames = page.locator(".pg-slide-outer").count()
        assert total_slide_frames >= 9, (
            f"Expected >= 9 live SlideCanvas frames on Dashboard (3 compare + 6 recommended), got {total_slide_frames}"
        )

        # Row 3: Recent Projects section + 4 Quick Tools present with valid real links
        assert_any_visible(
            page,
            [
                lambda p: p.locator("main").get_by_text(re.compile(r"最近项目|最近编辑")),
            ],
            description="Dashboard Row 3 Recent Projects section",
        )
        for pat, label in (
            (r"进入创作工坊|创作工坊", "Quick Tool 1: 创作工坊"),
            (r"设计体检", "Quick Tool 2: 设计体检"),
            (r"演讲排练|演播提词", "Quick Tool 3: 演讲排练"),
            (r"提示词工作室", "Quick Tool 4: 提示词工作室"),
        ):
            assert_any_visible(
                page,
                [
                    lambda p, rx=pat: p.locator("main").get_by_role("link", name=re.compile(rx, re.I)),
                    lambda p, rx=pat: p.locator("main").get_by_role("button", name=re.compile(rx, re.I)),
                ],
                description=label,
            )

        guard.assert_no_browser_errors("G1_UI_01")


def g1_ui_01b_dashboard_legacy_redirect(ctx: TestContext) -> None:
    # Verify server-side HTTP redirect preserves query params
    resp = ctx.api(follow_redirects=False).get("/", query={"q": "Bento", "domain": "business-tech"})
    assert resp.status in (301, 302, 307, 308), (
        f"Expected HTTP 3xx redirect from /?q=Bento&domain=business-tech, got {resp.status}"
    )
    loc = resp.header("location")
    assert "/gallery" in loc and "q=Bento" in loc and "domain=business-tech" in loc, (
        f"Redirect Location missing /gallery or query params: {loc!r}"
    )

    with ctx.browser_page() as guard:
        guard.goto_ok(f"{ctx.base_url}/?q=Bento&domain=business-tech")
        page = guard.page
        parsed = urllib.parse.urlparse(page.url)
        qs = urllib.parse.parse_qs(parsed.query)
        assert parsed.path == "/gallery", f"Expected final path /gallery, got {page.url}"
        assert qs.get("q") == ["Bento"], f"Expected q=Bento in URL, got {page.url}"
        assert qs.get("domain") == ["business-tech"], f"Expected domain=business-tech, got {page.url}"
        assert_any_visible(
            page,
            ['article[data-prompt-slug="apple-soft-bento-modular"]'],
            description="Filtered Bento card on /gallery",
        )
        guard.assert_no_browser_errors("G1_UI_01B")


def g1_ui_02_appshell_topbar_and_sidebar(ctx: TestContext) -> None:
    with ctx.browser_page() as guard:
        guard.goto_ok(f"{ctx.base_url}/")
        page = guard.page

        header_box = page.locator("header").first.bounding_box()
        assert header_box is not None, "Topbar <header> not visible"
        assert 56 <= header_box["height"] <= 72, (
            f"Expected Topbar height ~64px (56..72), got {header_box['height']:.1f}px"
        )
        assert "PPTGod" in (page.locator("header").first.inner_text() or ""), "Brand PPTGod missing in Topbar"

        # Topbar <-> Sidebar active route pill sync on /
        assert page.locator('header [aria-current="page"]').count() >= 1, (
            "Topbar missing active nav indicator [aria-current='page'] on /"
        )
        assert page.locator('aside [aria-current="page"]').count() >= 1, (
            "Sidebar missing active nav indicator [aria-current='page'] on /"
        )

        # Verify Sidebar expanded width (~220px), collapse to ~64px, expand back
        sidebar = page.locator("aside").first
        before_box = sidebar.bounding_box()
        assert before_box is not None and 190 <= before_box["width"] <= 260, (
            f"Expected expanded Sidebar ~220px, got {before_box}"
        )

        toggle_btn = locate_first(
            page,
            [
                lambda p: p.get_by_role("button", name=re.compile(r"收起侧栏|展开侧栏|折叠侧栏|折叠|收起导航", re.I)),
                "aside button[aria-expanded]",
                "header button[aria-expanded]",
            ],
            description="Sidebar collapse toggle button",
        )
        toggle_btn.click()
        page.wait_for_timeout(260)
        collapsed_box = sidebar.bounding_box()
        assert collapsed_box is not None and 48 <= collapsed_box["width"] <= 84, (
            f"Expected collapsed Sidebar ~64px (48..84), got {collapsed_box}"
        )

        # Expand back
        toggle_btn = locate_first(
            page,
            [
                lambda p: p.get_by_role("button", name=re.compile(r"展开侧栏|收起侧栏|折叠|展开导航", re.I)),
                "aside button[aria-expanded]",
                "header button[aria-expanded]",
            ],
            description="Sidebar expand toggle button",
        )
        toggle_btn.click()
        page.wait_for_timeout(260)
        reexpanded_box = sidebar.bounding_box()
        assert reexpanded_box is not None and reexpanded_box["width"] >= 190, (
            f"Sidebar did not re-expand: {reexpanded_box}"
        )

        # Verify every primary Sidebar link resolves cleanly (HTTP 200 or redirect to 200)
        hrefs: list[str] = page.evaluate(
            """() => Array.from(document.querySelectorAll('aside a[href]'))
              .map((a) => a.getAttribute('href') || '')
              .filter((h) => h.startsWith('/'))"""
        )
        unique_hrefs = sorted(set(hrefs))
        assert len(unique_hrefs) >= 6, f"Expected >= 6 unique sidebar nav links, found {unique_hrefs}"
        for core_prefix in ("/", "/generate", "/collections", "/gallery", "/tools"):
            assert any(
                h == core_prefix or (core_prefix != "/" and h.startswith(core_prefix))
                for h in unique_hrefs
            ), f"Sidebar missing core nav link for {core_prefix!r}: {unique_hrefs}"
        http_client = ctx.api(follow_redirects=True)
        for href in unique_hrefs:
            r = http_client.get(href)
            assert r.status == 200, f"Sidebar link {href!r} resolved to HTTP {r.status}"

        # Topbar global search submits to /gallery?q=... and active pills sync on /gallery
        search_box = locate_first(
            page,
            [
                lambda p: p.locator("header").get_by_role("searchbox"),
                lambda p: p.locator("header").get_by_placeholder(re.compile(r"搜索", re.I)),
                'header input[type="search"]',
                'header input[type="text"]',
            ],
            description="Topbar global search input",
        )
        search_box.fill("Bento")
        search_box.press("Enter")
        page.wait_for_url(re.compile(r"/gallery.*q=Bento", re.I), timeout=ctx.timeout_ms)
        assert page.locator('header [aria-current="page"]').count() >= 1, (
            "Topbar missing active nav indicator [aria-current='page'] on /gallery"
        )
        assert page.locator('aside [aria-current="page"]').count() >= 1, (
            "Sidebar missing active nav indicator [aria-current='page'] on /gallery"
        )
        guard.assert_no_browser_errors("G1_UI_02")


def g1_ui_03_gallery_filters_selection_favorites(ctx: TestContext) -> None:
    with ctx.browser_page() as guard:
        guard.goto_ok(f"{ctx.base_url}/gallery")
        page = guard.page

        cards = page.locator("article[data-prompt-slug]")
        assert cards.count() == 36, f"Expected 36 cards on /gallery, got {cards.count()}"

        # Multi-facet filter: Domain capsule + Color filter + Keyword search + combined URL sync
        click_resilient(
            page,
            [
                "#pg-domain-tab-research",
                lambda p: p.get_by_role("button", name=re.compile(r"科研与学术|学术科研", re.I)),
            ],
            description="Research domain capsule",
        )
        page.wait_for_timeout(250)
        assert cards.count() == DOMAIN_EXPECTED_COUNTS["research"], (
            f"Expected {DOMAIN_EXPECTED_COUNTS['research']} research cards, got {cards.count()}"
        )
        assert "domain=research" in page.url, f"URL did not sync domain=research: {page.url}"

        # Open advanced filter drawer if color filter is inside it
        adv_toggle = page.locator("#pg-toggle-adv-filters")
        if adv_toggle.count() > 0 and adv_toggle.first.is_visible():
            if adv_toggle.first.get_attribute("aria-expanded") in (None, "false"):
                adv_toggle.first.click()
                page.wait_for_timeout(150)

        color_ctl = locate_first(
            page,
            [
                "#pg-filter-color",
                'select[name*="color" i]',
                'select[aria-label*="色系"]',
                lambda p: p.locator("main").get_by_label(re.compile(r"色系|明暗|颜色", re.I)),
                lambda p: p.locator("main").get_by_role("button", name=re.compile(r"^浅色|亮色浅底|浅色系")),
            ],
            description="Gallery color=light filter control",
        )
        if str(color_ctl.evaluate("el => el.tagName")).upper() == "SELECT":
            color_ctl.select_option("light")
        else:
            color_ctl.click()
        page.wait_for_timeout(200)

        # Combine with keyword search
        fill_resilient(
            page,
            [
                "#pg-gallery-search",
                lambda p: p.locator("main").get_by_placeholder(re.compile(r"搜索风格|关键词", re.I)),
            ],
            "LaTeX",
            description="Gallery keyword search",
        )
        page.wait_for_timeout(250)
        assert cards.count() >= 1 and cards.count() < DOMAIN_EXPECTED_COUNTS["research"], (
            f"Expected narrowed multi-facet results, got {cards.count()}"
        )
        assert "domain=research" in page.url and "q=LaTeX" in page.url, (
            f"URL did not sync combined multi-facet params: {page.url}"
        )

        # Reset strictly via Reset Filters control (NO fallback to #pg-domain-tab-all)
        click_resilient(
            page,
            [
                "#pg-reset-filters-btn",
                lambda p: p.get_by_role("button", name=re.compile(r"清除筛选|重置筛选|清空筛选", re.I)),
            ],
            description="Reset filters button",
        )
        page.wait_for_timeout(250)
        assert "domain=" not in page.url and "q=" not in page.url, (
            f"Reset filters did not clear URL query params: {page.url}"
        )
        assert cards.count() == 36, f"Expected 36 cards after reset, got {cards.count()}"

        # Select card -> strictly verify #2563EB (rgb(37, 99, 235)) border/outline/ring >= 1.5px
        bento_card = page.locator('article[data-prompt-slug="apple-soft-bento-modular"]').first
        bento_card.scroll_into_view_if_needed()
        bento_card.click(position={"x": 20, "y": 20})
        page.wait_for_timeout(150)
        sel_state = bento_card.evaluate(
            """(el) => {
              const inspect = (node) => {
                if (!node) return null;
                const cs = getComputedStyle(node);
                return {
                  borderColor: cs.borderColor,
                  borderWidth: parseFloat(cs.borderTopWidth) || 0,
                  outlineColor: cs.outlineColor,
                  outlineWidth: parseFloat(cs.outlineWidth) || 0,
                  boxShadow: cs.boxShadow,
                };
              };
              const targets = [el, el.querySelector('.gl-slide-frame, .pg-card-frame, .gl-style-card-inner, .pg-slide-outer')].filter(Boolean);
              return {
                nodes: targets.map(inspect),
                dataSelected: el.getAttribute('data-selected'),
                ariaSelected: el.getAttribute('aria-selected'),
                cls: el.className,
              };
            }"""
        )
        has_blue_chrome = any(
            (
                ("37, 99, 235" in str(n["borderColor"]) and float(n["borderWidth"]) >= 1.5)
                or ("37, 99, 235" in str(n["outlineColor"]) and float(n["outlineWidth"]) >= 1.5)
                or ("37, 99, 235" in str(n["boxShadow"]))
            )
            for n in sel_state["nodes"]
        )
        assert has_blue_chrome, (
            f"Selected card missing #2563EB (2px blue) border/outline/ring: {sel_state}"
        )

        # Guest favorite persists in localStorage
        fav_btn = locate_first(
            bento_card,
            [
                lambda c: c.get_by_role("button", name=re.compile(r"收藏", re.I)),
                'button[aria-label*="收藏"]',
            ],
            description="Card favorite button",
        )
        fav_btn.click()
        page.wait_for_timeout(150)
        fav_raw = page.evaluate("(k) => window.localStorage.getItem(k)", GUEST_FAVS_STORAGE_KEY)
        assert fav_raw and ("prompt_soft_bento" in fav_raw or "apple-soft-bento-modular" in fav_raw), (
            f"Guest favorite did not persist in {GUEST_FAVS_STORAGE_KEY}: {fav_raw!r}"
        )

        # Copy prompt feedback
        copy_btn = locate_first(
            bento_card,
            [
                lambda c: c.get_by_role("button", name=re.compile(r"复制提示词|复制", re.I)),
            ],
            description="Card copy prompt button",
        )
        copy_btn.click()
        page.wait_for_timeout(200)
        assert "已复制" in guard.get_body_text(), "Expected '已复制' feedback after copying prompt"

        guard.assert_no_browser_errors("G1_UI_03")


def g1_ui_04_gallery_drawer_matcher_doc_intake(ctx: TestContext) -> None:
    with ctx.browser_page() as guard:
        guard.goto_ok(f"{ctx.base_url}/gallery")
        page = guard.page

        # 1. Style Detail Drawer
        bento_card = page.locator('article[data-prompt-slug="apple-soft-bento-modular"]').first
        bento_card.hover()
        click_resilient(
            bento_card,
            [
                lambda c: c.get_by_role("button", name=re.compile(r"预览|详情", re.I)),
            ],
            description="Style card Preview button",
        )
        drawer = locate_first(
            page,
            ['[role="dialog"]', ".gl-drawer"],
            description="Style Detail Drawer",
        )
        drawer_canvas = locate_first(drawer, [".pg-slide-outer"], description="Drawer 16:9 SlideCanvas")
        assert_16_9_ratio(drawer_canvas, label="Style Detail Drawer SlideCanvas")
        for pat in (r"封面", r"数据", r"对比"):
            click_resilient(
                drawer,
                [
                    lambda d, rx=pat: d.get_by_role("tab", name=re.compile(rx, re.I)),
                    lambda d, rx=pat: d.get_by_role("button", name=re.compile(rx, re.I)),
                ],
                description=f"Drawer slide type {pat}",
            )
        drawer_text = drawer.inner_text()
        assert re.search(r"#[0-9A-Fa-f]{6}", drawer_text), (
            f"Style Detail Drawer missing palette hex swatches: {drawer_text[:200]!r}"
        )
        assert_any_visible(
            drawer,
            [
                lambda d: d.get_by_role("link", name=re.compile(r"使用此风格|使用风格|用此风格", re.I)),
                lambda d: d.get_by_role("button", name=re.compile(r"使用此风格|使用风格|用此风格", re.I)),
                'a[href*="/generate?style="]',
            ],
            description="Drawer Use Style CTA",
        )
        assert_any_visible(
            drawer,
            [
                lambda d: d.get_by_role("button", name=re.compile(r"加入对比|取消对比|对比", re.I)),
            ],
            description="Drawer Compare action button",
        )
        assert_any_visible(
            drawer,
            [
                'a[href^="/studio/"]',
                lambda d: d.get_by_role("link", name=re.compile(r"提示词工作室|进入工作室", re.I)),
            ],
            description="Drawer Prompt Studio link",
        )
        assert_any_visible(
            drawer,
            [
                lambda d: d.get_by_role("button", name=re.compile(r"复制提示词|复制", re.I)),
            ],
            description="Drawer Copy Prompt button",
        )
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)
        assert drawer.is_visible() is False, "Style Detail Drawer did not close on Escape"

        # 2. StyleMatcherModal
        click_resilient(
            page,
            [
                "#pg-open-matcher-btn",
                lambda p: p.get_by_role("button", name=re.compile(r"帮我选风格|智能选词|30\s*秒", re.I)),
            ],
            description="Open StyleMatcherModal button",
        )
        matcher = locate_first(
            page,
            ["#pg-style-matcher-modal", '[role="dialog"]'],
            description="StyleMatcherModal",
        )
        goal_btn = locate_first(
            matcher,
            [
                '[data-goal-id="research-academic"]',
                '[data-goal-id="teaching-class"]',
                "[data-goal-id]",
                lambda m: m.get_by_role("button", name=re.compile(r"科研|学术|答辩|教学", re.I)),
            ],
            description="Matcher goal choice",
        )
        goal_btn.click()
        page.wait_for_timeout(200)
        rec_links = matcher.locator('a[href^="/studio/"], a[href*="/generate?style="]')
        assert rec_links.count() >= 3, (
            f"Expected >= 3 style recommendations inside StyleMatcherModal, got {rec_links.count()}"
        )
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)

        # 3. DocIntakeWorkbench (use locate_attached for hidden file input)
        click_resilient(
            page,
            [
                "#pg-open-doc-intake-btn",
                lambda p: p.get_by_role("button", name=re.compile(r"资料转\s*PPT|上传资料|文档导入", re.I)),
            ],
            description="Open DocIntakeWorkbench button",
        )
        intake = locate_first(
            page,
            ["#pg-doc-intake-modal", '[role="dialog"]'],
            description="DocIntakeWorkbench modal",
        )
        intake_file_input = locate_attached(
            intake,
            ['input[type="file"]'],
            description="DocIntakeWorkbench hidden file input",
        )
        intake_file_input.set_input_files(
            {
                "name": "glacier_intake.md",
                "mimeType": "text/markdown",
                "buffer": (
                    "# 钙钛矿电池稳定性研究\n"
                    "效率提升至 26.1%，双 85 老化 1500h 保持率 94.2%，缺陷密度下降 64%。\n"
                ).encode("utf-8"),
            }
        )
        locate_first(
            intake,
            [
                'a[href*="/generate"]',
                lambda m: m.get_by_role("button", name=re.compile(r"套用|进入工坊|生成", re.I)),
                ".pg-slide-outer",
            ],
            timeout_ms=12000,
            description="DocIntakeWorkbench analysis recommendations",
        )
        page.keyboard.press("Escape")
        guard.assert_no_browser_errors("G1_UI_04")


def g1_ui_05_workshop_wizard_flow(ctx: TestContext) -> None:
    with ctx.browser_page() as guard:
        guard.goto_ok(f"{ctx.base_url}/generate")
        page = guard.page

        body_text = guard.get_body_text()
        for step_label in ("内容与资料", "选择风格", "AI 生成", "预览与优化"):
            assert step_label in body_text, f"Workshop 4-step stepper missing step {step_label!r}"

        # Quick sample chip populates topic + char count indicator updates
        topic_input = locate_first(
            page,
            [
                "#pg-gen-topic",
                lambda p: p.get_by_placeholder(re.compile(r"描述你想创建|演示主题|输入.*主题", re.I)),
                "main textarea",
            ],
            description="Workshop topic textarea",
        )
        sample_chip = locate_first(
            page,
            [
                "[data-sample-chip]",
                ".gl-sample-chip",
                ".pg-sample-chip",
                "button[data-sample-topic]",
                lambda p: p.locator("main").locator(
                    'xpath=.//*[contains(normalize-space(.), "试试示例")]//button'
                    ' | .//*[contains(normalize-space(.), "试试示例")]/following-sibling::button'
                    ' | .//*[contains(normalize-space(.), "试试示例")]/following-sibling::*//button'
                ),
            ],
            description="Workshop quick sample chip",
        )
        sample_chip.click()
        page.wait_for_timeout(150)
        assert len(topic_input.input_value().strip()) >= 4, (
            "Clicking Workshop quick sample chip did not populate topic input"
        )
        assert re.search(r"\d+\s*/\s*\d+|\d+\s*字", page.locator("main").inner_text() or ""), (
            "Workshop missing topic character counter readout"
        )

        # Fill custom topic & verify live 16:9 preview + strict 示例预览 disclosure
        custom_topic = "钙钛矿光伏器件效率突破实测"
        topic_input.fill(custom_topic)
        page.wait_for_timeout(200)
        assert re.search(r"示例预览|示例文稿", guard.get_body_text()), (
            "Workshop pre-generation preview missing mandatory '示例预览' / '示例文稿' disclosure"
        )
        preview_stage = guard.find_primary_stage()
        assert_16_9_ratio(preview_stage, label="Workshop live preview canvas")
        assert custom_topic in (preview_stage.inner_text() or ""), (
            "Workshop live preview did not reflect typed topic"
        )

        # Verify >= 4 preview thumbnails and switch to thumbnail #2
        thumbs = page.locator(
            '[data-preview-thumb], .gl-preview-thumb, .pg-preview-thumb, '
            '[aria-label*="缩略图"] button, [aria-label*="预览页"] button'
        )
        assert thumbs.count() >= 4, (
            f"Expected >= 4 Workshop preview thumbnails, got {thumbs.count()}"
        )
        thumbs.nth(1).click()
        page.wait_for_timeout(150)
        assert len((guard.find_primary_stage().inner_text() or "").strip()) > 0, (
            "Workshop preview stage became blank after clicking thumbnail #2"
        )

        # Upload removable file first via locate_attached (hidden file input safe), verify removal
        file_input = locate_attached(
            page,
            ["#pg-doc-upload-input", 'main input[type="file"]'],
            description="Workshop file input",
        )
        file_input.set_input_files(
            {
                "name": "removable_brief.md",
                "mimeType": "text/markdown",
                "buffer": b"# Removable Draft\nThis temporary uploaded file will be removed before outline.\n",
            }
        )
        locate_first(
            page,
            [lambda p: p.get_by_text(re.compile(r"removable_brief\.md", re.I))],
            timeout_ms=10000,
            description="Parsed file card for removable_brief.md",
        )
        click_resilient(
            page,
            [
                '.gl-upload-remove-btn',
                '[data-remove-file]',
                'button[aria-label*="移除"]',
                lambda p: p.locator("main").locator(
                    'xpath=.//*[contains(normalize-space(.), "removable_brief.md")]/ancestor::*[.//button][1]//button'
                ),
            ],
            description="Remove uploaded file button (×)",
        )
        page.wait_for_timeout(200)
        assert "removable_brief.md" not in guard.get_body_text(), (
            "Removed uploaded file 'removable_brief.md' still visible in Workshop"
        )

        # Upload real .md file for outline generation
        file_input.set_input_files(
            {
                "name": "glacier_brief.md",
                "mimeType": "text/markdown",
                "buffer": (
                    "# 钙钛矿光伏器件效率突破实测\n\n"
                    "光电转换效率由 23.4% 跃升至 26.1%，双 85 老化 1500h 保持率 94.2%。\n"
                ).encode("utf-8"),
            }
        )
        locate_first(
            page,
            [
                "#pg-doc-upload-badge",
                lambda p: p.get_by_text(re.compile(r"glacier_brief\.md", re.I)),
            ],
            timeout_ms=10000,
            description="Parsed file badge/card for glacier_brief.md",
        )

        # Select style in bottom style rail
        style_card = locate_first(
            page,
            [
                '[data-style-rail] [data-style-slug]',
                '.gl-style-rail [data-style-slug]',
                '[data-style-rail] button',
                '.gl-style-rail button',
                '#pg-gen-style-select',
            ],
            description="Workshop bottom style rail control",
        )
        if str(style_card.evaluate("el => el.tagName")).upper() == "SELECT":
            style_card.select_option(index=1)
        else:
            style_card.click()
            page.wait_for_timeout(150)

        # Open Outline confirmation, edit row #2 title & add a slide, then confirm into Editor
        click_resilient(
            page,
            [
                "#pg-gen-outline-btn",
                lambda p: p.get_by_role("button", name=re.compile(r"先看大纲|生成大纲", re.I)),
            ],
            description="先看大纲 button",
        )
        outline_panel = locate_first(
            page,
            ["#pg-outline-editor"],
            timeout_ms=12000,
            description="Editable OutlineDraftPanel",
        )
        rows = outline_panel.locator(".pg-outline-row")
        before_rows = rows.count()
        assert before_rows >= 5, f"Expected >= 5 outline rows, got {before_rows}"

        edited_s2 = f"大纲改写标题 {unique_token('OL')}"
        row2_title_input = locate_first(
            rows.nth(1),
            ['input[type="text"]', "input:not([type])", "input", "textarea"],
            description="Outline row #2 title input",
        )
        row2_title_input.fill(edited_s2)

        click_resilient(
            outline_panel,
            [
                "#pg-outline-add-btn",
                lambda o: o.get_by_role("button", name=re.compile(r"新增|添加.*页", re.I)),
            ],
            description="Outline add slide button",
        )
        page.wait_for_timeout(150)
        assert rows.count() == before_rows + 1, (
            f"Expected {before_rows + 1} outline rows after add, got {rows.count()}"
        )

        click_resilient(
            outline_panel,
            [
                "#pg-outline-confirm-btn",
                lambda o: o.get_by_role("button", name=re.compile(r"确认.*生成|按此大纲生成", re.I)),
            ],
            description="Confirm outline and generate button",
        )
        locate_first(
            page,
            [
                "#pg-gen-undo-btn",
                "#pg-edit-slide-title",
                lambda p: p.get_by_role("button", name=re.compile(r"导出\s*PPTX", re.I)),
            ],
            timeout_ms=15000,
            description="Presentation Editor after outline confirmation",
        )
        assert edited_s2 in guard.get_body_text(), (
            f"Edited outline row #2 title {edited_s2!r} did not appear in Presentation Editor"
        )
        guard.assert_no_browser_errors("G1_UI_05")


def g1_ui_06_editor_topbar_tree_toolbar_zoom(ctx: TestContext) -> None:
    with ctx.browser_page() as guard:
        stage = ensure_editor_ready(guard, ctx.base_url)
        page = guard.page

        assert_16_9_ratio(stage, label="Editor primary 16:9 canvas")

        # Global nav <aside> identified structurally must auto-collapse (<= 84px) or hide
        global_sidebar_w = float(
            page.evaluate(
                """() => {
                  for (const a of document.querySelectorAll('aside')) {
                    if (
                      a.querySelector('a[href="/gallery"], a[href="/collections"]') ||
                      /导航/.test(a.getAttribute('aria-label') || '')
                    ) {
                      const cs = getComputedStyle(a);
                      if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
                      const rect = a.getBoundingClientRect();
                      return rect.width;
                    }
                  }
                  return 0;
                }"""
            )
        )
        assert global_sidebar_w <= 84.0, (
            f"Global sidebar did not auto-collapse in full-bleed Editor: width={global_sidebar_w:.1f}px"
        )

        # Dedicated Editor Topbar essential controls: Back, Editable Title, Save, Undo, Redo, Export PPTX, Overflow
        assert_any_visible(
            page,
            [
                'a[href="/"]',
                'a[href="/collections"]',
                'a[href="/generate"]',
                lambda p: p.get_by_role("button", name=re.compile(r"返回")),
            ],
            description="Editor Topbar Back control",
        )
        assert_any_visible(
            page,
            [
                "[data-editor-title]",
                'input[aria-label*="标题"]',
                'header input[type="text"]',
                "header input",
            ],
            description="Editor Topbar editable deck title",
        )
        assert_any_visible(
            page,
            [lambda p: p.get_by_role("button", name=re.compile(r"保存"))],
            description="Editor Topbar Save button",
        )
        assert_any_visible(page, ["#pg-gen-undo-btn", lambda p: p.get_by_role("button", name=re.compile(r"撤销"))], description="Undo")
        assert_any_visible(page, ["#pg-gen-redo-btn", lambda p: p.get_by_role("button", name=re.compile(r"重做"))], description="Redo")
        assert_any_visible(page, [lambda p: p.get_by_role("button", name=re.compile(r"导出\s*PPTX", re.I))], description="Export PPTX")
        assert_any_visible(
            page,
            [
                "#pg-gen-export-html-btn",
                "#pg-gen-export-md-btn",
                'button[aria-haspopup="menu"]',
                lambda p: p.get_by_role("button", name=re.compile(r"更多|导出更多|其他导出|菜单", re.I)),
            ],
            description="Editor Topbar overflow / secondary export controls",
        )
        assert re.search(r"未保存|草稿|已保存|自动保存", guard.get_body_text()), (
            "Editor topbar missing honest save status indicator"
        )

        # Slide tree count + mandatory 大纲 <-> 幻灯片 toggle (NO silent skip)
        initial_count = guard.count_editor_tree_slides()
        assert initial_count >= 5, f"Expected >= 5 slides in editor tree, got {initial_count}"

        outline_tab = click_resilient(
            page,
            [
                lambda p: p.get_by_role("tab", name=re.compile(r"大纲")),
                lambda p: p.get_by_role("button", name=re.compile(r"^大纲$")),
            ],
            description="Editor tree 大纲 tab",
        )
        page.wait_for_timeout(120)
        outline_active = bool(
            outline_tab.evaluate(
                "(el) => el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-pressed') === 'true' || /active|selected/i.test(el.className)"
            )
        )
        assert outline_active, "Editor tree 大纲 tab did not activate on click"

        slides_tab = click_resilient(
            page,
            [
                lambda p: p.get_by_role("tab", name=re.compile(r"幻灯片")),
                lambda p: p.get_by_role("button", name=re.compile(r"^幻灯片$")),
            ],
            description="Editor tree 幻灯片 tab",
        )
        page.wait_for_timeout(120)
        slides_active = bool(
            slides_tab.evaluate(
                "(el) => el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-pressed') === 'true' || /active|selected/i.test(el.className)"
            )
        )
        assert slides_active, "Editor tree 幻灯片 tab did not activate on click"

        # Add slide
        click_resilient(
            page,
            [
                lambda p: p.get_by_role("button", name=re.compile(r"新建幻灯片|添加幻灯片|新增页面|\+\s*新建", re.I)),
            ],
            description="Add slide button in Editor tree",
        )
        page.wait_for_timeout(200)
        after_add = guard.count_editor_tree_slides()
        assert after_add == initial_count + 1, (
            f"Expected {initial_count + 1} slides after add, got {after_add}"
        )

        # Duplicate slide
        click_resilient(
            page,
            [
                '[data-slide-tree] button[aria-label*="复制"]',
                '.gl-slide-tree button[aria-label*="复制"]',
                lambda p: p.get_by_role("button", name=re.compile(r"复制本页|复制页面|复制幻灯片|复制当前页")),
            ],
            description="Duplicate slide button in Editor tree",
        )
        page.wait_for_timeout(200)
        after_dup = guard.count_editor_tree_slides()
        assert after_dup == after_add + 1, (
            f"Expected {after_add + 1} slides after duplicate, got {after_dup}"
        )

        # Reorder control presence & interaction
        reorder_ctl = locate_first(
            page,
            [
                '[data-slide-tree] button[aria-label*="上移"]',
                '[data-slide-tree] button[aria-label*="下移"]',
                '.gl-slide-tree button[aria-label*="上移"]',
                '.gl-slide-tree button[aria-label*="下移"]',
                lambda p: p.get_by_role("button", name=re.compile(r"上移|下移")),
                '[data-slide-tree] [draggable="true"]',
                '.gl-slide-tree [draggable="true"]',
            ],
            description="Slide reorder control (up/down button or draggable slide card)",
        )
        if str(reorder_ctl.evaluate("el => el.tagName")).upper() == "BUTTON" and not reorder_ctl.is_disabled():
            reorder_ctl.click()
            page.wait_for_timeout(120)

        # Zoom controls (+ / - / Fit or %)
        zoom_in = locate_first(
            page,
            [
                'button[aria-label*="放大"]',
                'button[title*="放大"]',
                '[data-zoom-in]',
                lambda p: p.get_by_role("button", name=re.compile(r"放大|\+|Zoom\s*In", re.I)),
            ],
            description="Editor Zoom In control",
        )
        assert_any_visible(
            page,
            [
                'button[aria-label*="缩小"]',
                'button[title*="缩小"]',
                '[data-zoom-out]',
                lambda p: p.get_by_role("button", name=re.compile(r"缩小|-|Zoom\s*Out|适应|Fit", re.I)),
            ],
            description="Editor Zoom Out / Fit control",
        )
        zoom_in.click()
        page.wait_for_timeout(120)

        # Pager increments active slide
        first_title = page.locator("#pg-edit-slide-title").first.input_value()
        click_resilient(
            page,
            [
                'button[aria-label*="下一页"]',
                'button[title*="下一页"]',
                '[data-pager-next]',
                lambda p: p.get_by_role("button", name=re.compile(r"下一页|Next", re.I)),
            ],
            description="Editor bottom pager Next button",
        )
        page.wait_for_timeout(150)
        pager_changed = (
            page.locator("#pg-edit-slide-title").first.input_value() != first_title
            or bool(re.search(rf"2\s*/\s*{after_dup}", guard.get_body_text()))
        )
        assert pager_changed, "Editor bottom pager Next button did not advance active slide"

        # Fullscreen presenter open & Esc close (UNCONDITIONAL open & close verification)
        click_resilient(
            page,
            [
                lambda p: p.get_by_role("button", name=re.compile(r"演播|全屏演示|全屏预览|演示", re.I)),
            ],
            description="Editor Present / Fullscreen button",
        )
        presenter_overlay = locate_first(
            page,
            ['.pg-presenter-overlay', '.gl-presenter-overlay', '[role="dialog"][aria-label*="演播"]', '[role="dialog"]'],
            timeout_ms=5000,
            description="Fullscreen Presenter overlay",
        )
        assert presenter_overlay.is_visible() is True, "Fullscreen Presenter overlay did not open"
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)
        assert presenter_overlay.is_visible() is False, "Fullscreen Presenter overlay did not close on Escape"

        guard.assert_no_browser_errors("G1_UI_06")


def g1_ui_07_editor_inspector_notes_ai_assistant(ctx: TestContext) -> None:
    with ctx.browser_page() as guard:
        ensure_editor_ready(guard, ctx.base_url)
        page = guard.page

        # Edit title on current slide & set frozen #pg-edit-source-status unconditionally
        custom_title = "版式切换不丢字验证标题"
        fill_resilient(
            page,
            ["#pg-edit-slide-title"],
            custom_title,
            description="Slide title editor input",
        )
        page.wait_for_timeout(150)

        source_select = locate_first(
            page,
            ["#pg-edit-source-status"],
            description="Slide sourceStatus selector (#pg-edit-source-status)",
        )
        source_select.select_option("source-material")

        # Switch layout preserving text & sourceStatus (仅换版式不动字)
        layout_ctl = locate_first(
            page,
            ['[data-layout-chip="comparison"]', "#pg-slide-type-select"],
            description="Layout switcher to comparison",
        )
        if str(layout_ctl.evaluate("el => el.tagName")).upper() == "SELECT":
            layout_ctl.select_option("comparison")
        else:
            layout_ctl.click()
        page.wait_for_timeout(200)

        assert page.locator("#pg-edit-slide-title").first.input_value() == custom_title, (
            "Layout-only switch lost edited slide title!"
        )
        assert source_select.input_value() == "source-material", (
            "Layout-only switch lost #pg-edit-source-status value!"
        )

        # Switch to image-split & verify ImageSlotManager 12 SVG presets work
        img_layout_ctl = locate_first(
            page,
            ['[data-layout-chip="image-split"]', "#pg-slide-type-select"],
            description="Layout switcher to image-split",
        )
        if str(img_layout_ctl.evaluate("el => el.tagName")).upper() == "SELECT":
            img_layout_ctl.select_option("image-split")
        else:
            img_layout_ctl.click()
        page.wait_for_timeout(200)

        preset_btns = page.locator(".pg-artwork-btn, [data-artwork-preset]")
        assert preset_btns.count() >= 6, (
            f"ImageSlotManager expected >= 6 SVG artwork presets on image-split slide, got {preset_btns.count()}"
        )
        target_preset = preset_btns.nth(1)
        target_preset.scroll_into_view_if_needed()
        target_preset.click()
        page.wait_for_timeout(150)
        preset_active = bool(
            target_preset.evaluate(
                "(el) => /is-active|active|selected/i.test(el.className) || el.getAttribute('aria-pressed') === 'true'"
            )
        )
        assert preset_active, "Clicking ImageSlotManager SVG preset did not activate it"
        assert guard.find_primary_stage().locator("svg").count() >= 1, (
            "ImageSlotManager SVG preset did not render <svg> on SlideCanvas"
        )

        # Speaker notes + AI 讲稿生成 (/api/polish notes) — unconditionally assert notes updated
        notes_area = locate_first(
            page,
            [
                lambda p: p.get_by_placeholder(re.compile(r"演讲备注|演讲者备注|讲稿", re.I)),
                lambda p: p.get_by_label(re.compile(r"演讲备注|讲稿", re.I)),
                'textarea[id*="notes" i]',
            ],
            description="Editor Speaker Notes textarea",
        )
        notes_area.fill("原始测试讲稿。")
        with page.expect_response(
            lambda r: "/api/polish" in r.url and r.request.method == "POST",
            timeout=ctx.timeout_ms,
        ) as notes_polish_info:
            click_resilient(
                page,
                [
                    lambda p: p.get_by_role("button", name=re.compile(r"AI\s*讲稿生成|优化演讲稿|润色讲稿", re.I)),
                ],
                description="AI 讲稿生成 button",
            )
        assert notes_polish_info.value.status == 200, (
            f"AI 讲稿生成 returned HTTP {notes_polish_info.value.status}"
        )
        page.wait_for_timeout(200)
        # If notes polish opened a preview confirm button, confirm it before checking unconditional update
        notes_confirm = page.get_by_role("button", name=re.compile(r"确认应用|应用建议", re.I))
        if notes_confirm.count() > 0 and notes_confirm.first.is_visible():
            notes_confirm.first.click()
            page.wait_for_timeout(200)
        updated_notes = notes_area.input_value().strip()
        assert updated_notes != "原始测试讲稿。" and len(updated_notes) >= 15, (
            f"AI 讲稿生成 did not update speaker notes (got {updated_notes!r})"
        )

        # Right AI Assistant -> executive polish -> UNCONDITIONAL 确认应用 -> UNCONDITIONAL change + Undo revert
        title_before_polish = page.locator("#pg-edit-slide-title").first.input_value()
        with page.expect_response(
            lambda r: "/api/polish" in r.url and r.request.method == "POST",
            timeout=ctx.timeout_ms,
        ) as exec_polish_info:
            click_resilient(
                page,
                [
                    "#pg-polish-executive-btn",
                    lambda p: p.get_by_role("button", name=re.compile(r"高管精炼|提炼高管", re.I)),
                ],
                description="AI Assistant 高管精炼 button",
            )
        assert exec_polish_info.value.status == 200

        click_resilient(
            page,
            [lambda p: p.get_by_role("button", name=re.compile(r"确认应用|应用建议", re.I))],
            description="AI Assistant mandatory 确认应用 button (B13)",
        )
        page.wait_for_timeout(200)

        title_after_polish = page.locator("#pg-edit-slide-title").first.input_value()
        assert title_after_polish != title_before_polish, (
            f"AI polish 确认应用 did not update slide title (stayed {title_before_polish!r})"
        )

        click_resilient(
            page,
            ["#pg-gen-undo-btn", lambda p: p.get_by_role("button", name=re.compile(r"撤销"))],
            description="Undo after AI polish",
        )
        page.wait_for_timeout(150)
        assert page.locator("#pg-edit-slide-title").first.input_value() == title_before_polish, (
            f"Undo did not revert AI polish title change: expected {title_before_polish!r}, "
            f"got {page.locator('#pg-edit-slide-title').first.input_value()!r}"
        )

        # Theme tab / DeckSpecTweaker brandFooter live update
        click_resilient(
            page,
            [
                lambda p: p.get_by_role("tab", name=re.compile(r"页面与主题|主题配色|品牌主题", re.I)),
                "#pg-deck-tweaker-toggle",
            ],
            description="页面与主题 tab / DeckSpecTweaker toggle",
        )
        fill_resilient(
            page,
            ["#pg-deck-footer-input"],
            "Glacier Footer Live",
            description="Brand footer input",
        )
        page.wait_for_timeout(200)
        assert "Glacier Footer Live" in (guard.find_primary_stage().inner_text() or ""), (
            "Updated brandFooter not rendered live on SlideCanvas"
        )

        guard.assert_no_browser_errors("G1_UI_07")


def g1_ui_08_design_audit_workflow(ctx: TestContext) -> None:
    demo = ctx.api_logged_in(ACCOUNT_DEMO)
    with ctx.cleanup() as cleanup:
        tok = unique_token("AUD")
        slides = make_valid_slides(4, custom_title=f"[E2E-AUD] 体检文稿 {tok}")
        # Trigger missing-notes issue on Slide 2 (< 8 chars) and jump-slide issue on Slide 3 (> 28 chars title)
        slides[1]["speakerNotes"] = "短"
        long_s3_title = "这是一个刻意超过二十八个字符用于触发智能体检跳转修复按钮的长标题示例文案"
        slides[2]["title"] = long_s3_title

        create_resp = demo.post(
            "/api/decks",
            json_body=make_valid_deck_payload(
                title=f"[E2E-AUD] 体检文稿 {tok}",
                slides=slides,
                dark=False,
                is_public=False,
            ),
        ).assert_status(201, "seed deck for audit workflow")
        deck_id = create_resp.require_json()["deck"]["id"]
        cleanup.register_delete_deck(demo, deck_id)

        with ctx.browser_page() as guard:
            login_via_api(guard.page, ctx.base_url, ACCOUNT_DEMO)
            guard.goto_ok(f"{ctx.base_url}/generate?deck={deck_id}&panel=audit")
            page = guard.page

            # 1. Deep-link ?panel=audit must auto-open #pg-deck-audit-panel
            audit_panel = locate_first(
                page,
                ["#pg-deck-audit-panel"],
                timeout_ms=12000,
                description="DeckAuditDrawer auto-opened via /generate?panel=audit",
            )

            def _read_score() -> int:
                el = locate_first(page, ["#pg-deck-audit-score"], description="#pg-deck-audit-score")
                ds = el.get_attribute("data-score")
                if ds and ds.isdigit():
                    return int(ds)
                m = re.search(r"\d+", el.inner_text() or "")
                assert m, f"No numeric score in #pg-deck-audit-score: {el.inner_text()!r}"
                return int(m.group(0))

            initial_score = _read_score()
            assert 25 <= initial_score < 100, (
                f"Expected imperfect audit score (<100) for seeded issues, got {initial_score}"
            )

            # 2. Click jump-slide issue action inside #pg-deck-audit-issues -> switches active slide to slide 3
            click_resilient(
                audit_panel,
                [
                    lambda a: a.locator("#pg-deck-audit-issues").get_by_role(
                        "button", name=re.compile(r"第\s*3\s*页|跳至|精简|优化")
                    ),
                ],
                description="Audit issue jump-to-slide button",
            )
            page.wait_for_timeout(200)
            assert page.locator("#pg-edit-slide-title").first.input_value() == long_s3_title, (
                "Clicking audit jump-slide issue did not switch Editor to Slide 3"
            )

            # 3. Autofix missing notes via #pg-audit-autofix-notes-btn raises score
            click_resilient(
                page,
                ["#pg-audit-autofix-notes-btn"],
                description="Audit autofix missing notes button",
            )
            page.wait_for_timeout(250)
            notes_fixed_score = _read_score()
            assert notes_fixed_score > initial_score, (
                f"Expected notes autofix to raise score: initial={initial_score}, after={notes_fixed_score}"
            )

            # 4. Deliberately break contrast via #pg-deck-bg-input = #1A1A1A (-18 pts), then autofix contrast
            click_resilient(
                page,
                [
                    lambda p: p.get_by_role("tab", name=re.compile(r"页面与主题|主题配色|品牌主题", re.I)),
                    "#pg-deck-tweaker-toggle",
                ],
                description="Open DeckSpecTweaker to test contrast audit",
            )
            bg_input = locate_first(page, ["#pg-deck-bg-input"], description="Deck background color input")
            bg_input.fill("#1A1A1A")
            bg_input.dispatch_event("input")
            bg_input.dispatch_event("change")
            page.wait_for_timeout(250)

            if not page.locator("#pg-deck-audit-panel").first.is_visible():
                click_resilient(page, ["#pg-deck-audit-toggle"], description="Reopen DeckAuditDrawer")
            locate_first(page, ["#pg-deck-audit-panel"], description="DeckAuditDrawer panel after contrast drop")

            low_score = _read_score()
            assert low_score < notes_fixed_score, (
                f"Expected audit score to drop after setting low-contrast bg #1A1A1A: "
                f"before={notes_fixed_score}, after={low_score}"
            )

            click_resilient(
                page,
                ["#pg-audit-autofix-contrast-btn"],
                description="Audit autofix contrast button",
            )
            page.wait_for_timeout(250)
            fixed_score = _read_score()
            assert fixed_score > low_score, (
                f"Expected contrast autofix to raise score: low={low_score}, fixed={fixed_score}"
            )
            ctx.record_metric(
                "audit_scores",
                {
                    "initial": initial_score,
                    "notes_fixed": notes_fixed_score,
                    "low": low_score,
                    "fixed": fixed_score,
                },
            )
            guard.assert_no_browser_errors("G1_UI_08")


def g1_ui_09_collections_projects_crud(ctx: TestContext) -> None:
    demo = ctx.api_logged_in(ACCOUNT_DEMO)
    with ctx.cleanup() as cleanup:
        tok = unique_token("COL")
        orig_title = f"[E2E-COL] 冰川项目 {tok}"
        create_resp = demo.post(
            "/api/decks",
            json_body=make_valid_deck_payload(title=orig_title, is_public=False),
        ).assert_status(201)
        deck_id = create_resp.require_json()["deck"]["id"]
        cleanup.register_delete_deck(demo, deck_id)

        with ctx.browser_page() as guard:
            login_via_api(guard.page, ctx.base_url, ACCOUNT_DEMO)
            guard.goto_ok(f"{ctx.base_url}/collections")
            page = guard.page

            col_text = guard.get_body_text()
            # Honest filter rail labels & real KPI count == 1
            for rail_pat, desc in (
                (r"全部项目|全部演示文稿", "Honest rail: 全部项目"),
                (r"最近编辑", "Honest rail: 最近编辑"),
                (r"公开分享", "Honest rail: 公开分享"),
                (r"我收藏的", "Honest rail: 我收藏的"),
                (r"我发布的", "Honest rail: 我发布的"),
                (r"我点赞的", "Honest rail: 我点赞的"),
            ):
                assert re.search(rail_pat, col_text), f"/collections missing {desc}"
            assert re.search(
                r"(?:全部项目|全部演示文稿|我的项目|总项目数)[\s:：(（]*1\b"
                r"|\b1\s*[\n\r]+\s*(?:全部项目|全部演示文稿|我的项目|总项目数)",
                col_text,
            ), f"/collections KPI does not reflect 1 seeded project: {col_text[:300]!r}"

            # Verify seeded deck visible
            assert orig_title in col_text, (
                f"Saved deck {orig_title!r} not visible on /collections"
            )

            # Unconditional Grid <-> List view toggle (NO silent skip)
            click_resilient(
                page,
                [
                    'button[aria-label*="列表"]',
                    'button[title*="列表"]',
                    lambda p: p.locator("main").get_by_role("button", name=re.compile(r"列表视图|列表")),
                ],
                description="Collections List view toggle",
            )
            page.wait_for_timeout(120)
            click_resilient(
                page,
                [
                    'button[aria-label*="网格"]',
                    'button[title*="网格"]',
                    lambda p: p.locator("main").get_by_role("button", name=re.compile(r"网格视图|网格")),
                ],
                description="Collections Grid view toggle",
            )
            page.wait_for_timeout(120)

            # Exercise search, visibility filter & sort controls
            search_inp = fill_resilient(
                page,
                [
                    lambda p: p.locator("main").get_by_placeholder(re.compile(r"搜索.*项目|搜索.*文稿|搜索", re.I)),
                    'main input[type="search"]',
                    'main input[type="text"]',
                ],
                tok,
                description="Collections search input",
            )
            page.wait_for_timeout(150)
            assert orig_title in guard.get_body_text(), "Collections search hid matching deck"
            search_inp.fill("")
            page.wait_for_timeout(150)

            assert_any_visible(
                page,
                [
                    'main select[aria-label*="排序"]',
                    'main select[name*="sort" i]',
                    lambda p: p.locator("main").get_by_label(re.compile(r"排序")),
                    lambda p: p.locator("main").get_by_role("combobox"),
                    "main select",
                ],
                description="Collections sort/visibility dropdown",
            )

            # Helper to open card overflow menu if present before unconditional action click
            def _open_card_menu(title_text: str) -> Any:
                card = page.locator("article, [data-project-card], .gl-project-card").filter(
                    has_text=title_text
                ).first
                card.scroll_into_view_if_needed()
                more = card.locator(
                    'button[aria-label*="更多"], button[aria-haspopup="menu"], button:has-text("⋯"), button:has-text("...")'
                )
                if more.count() > 0 and more.first.is_visible():
                    more.first.click()
                    page.wait_for_timeout(120)
                return card

            # Rename strictly via [role="dialog"] / [data-rename-dialog] (NO broad "form" fallback)
            renamed_title = f"[E2E-COL] 重命名 {tok}"
            _open_card_menu(orig_title)
            click_resilient(
                page,
                [
                    lambda p: p.get_by_role("menuitem", name=re.compile(r"重命名")),
                    lambda p: p.get_by_role("button", name=re.compile(r"重命名")),
                ],
                description="Project Rename action",
            )
            rename_dialog = locate_first(
                page,
                ['[role="dialog"]', "[data-rename-dialog]"],
                description="Rename confirmation dialog",
            )
            rename_input = locate_first(rename_dialog, ['input[type="text"]', "input"], description="Rename input")
            rename_input.fill(renamed_title)
            with page.expect_response(
                lambda r: f"/api/decks/{deck_id}" in r.url and r.request.method == "PUT",
                timeout=ctx.timeout_ms,
            ) as put_info:
                click_resilient(
                    rename_dialog,
                    [lambda d: d.get_by_role("button", name=re.compile(r"确认|保存|确定"))],
                    description="Confirm rename button",
                )
            assert put_info.value.status == 200, f"Rename PUT returned {put_info.value.status}"

            # Reload and assert rename persisted
            page.reload(wait_until="networkidle")
            assert renamed_title in guard.get_body_text(), "Renamed deck title did not persist after reload"

            # UI Visibility toggle (PATCH /api/decks/[id] -> isPublic=true)
            _open_card_menu(renamed_title)
            with page.expect_response(
                lambda r: f"/api/decks/{deck_id}" in r.url and r.request.method == "PATCH",
                timeout=ctx.timeout_ms,
            ) as vis_info:
                click_resilient(
                    page,
                    [
                        lambda p: p.get_by_role("menuitem", name=re.compile(r"设为公开|公开分享|切换.*公开|公开")),
                        lambda p: p.get_by_role("button", name=re.compile(r"设为公开|公开分享|切换.*公开")),
                    ],
                    description="Project visibility toggle to Public",
                )
            assert vis_info.value.status == 200, f"Visibility PATCH returned {vis_info.value.status}"
            assert vis_info.value.json()["deck"]["isPublic"] is True, "Visibility PATCH did not set isPublic=true"
            page.wait_for_timeout(150)

            # UI Export PPTX: verify the PowerPoint file the browser saves.
            _open_card_menu(renamed_title)
            with page.expect_response(
                lambda r: "/api/export/pptx" in r.url and r.request.method == "POST",
                timeout=ctx.timeout_ms,
            ) as exp_info, page.expect_download(timeout=ctx.timeout_ms) as pptx_download:
                click_resilient(
                    page,
                    [
                        lambda p: p.get_by_role("menuitem", name=re.compile(r"导出\s*PPTX|导出\s*\.pptx|导出", re.I)),
                        lambda p: p.get_by_role("button", name=re.compile(r"导出\s*PPTX|导出\s*\.pptx", re.I)),
                    ],
                    description="Project Export PPTX action",
                )
            assert exp_info.value.status == 200, f"Collections Export PPTX returned {exp_info.value.status}"
            download = pptx_download.value
            assert download.suggested_filename.endswith(".pptx")
            assert Path(download.path()).read_bytes().startswith(b"PK\x03\x04"), "Collections Export PPTX missing ZIP magic"
            page.wait_for_timeout(150)

            # Duplicate (POST /api/decks)
            _open_card_menu(renamed_title)
            with page.expect_response(
                lambda r: r.url.rstrip("/").endswith("/api/decks") and r.request.method == "POST",
                timeout=ctx.timeout_ms,
            ) as dup_info:
                click_resilient(
                    page,
                    [
                        lambda p: p.get_by_role("menuitem", name=re.compile(r"复制副本|创建副本|复制项目|复制")),
                        lambda p: p.get_by_role("button", name=re.compile(r"复制副本|创建副本|复制项目|复制")),
                    ],
                    description="Project Duplicate action",
                )
            assert dup_info.value.status == 201, f"Duplicate POST returned {dup_info.value.status}"
            dup_json = dup_info.value.json()
            dup_id = dup_json["deck"]["id"]
            cleanup.register_delete_deck(demo, dup_id)
            assert dup_id != deck_id

            page.wait_for_timeout(300)
            decks_now = demo.get("/api/decks").assert_status(200).require_json()["decks"]
            assert len(decks_now) == 2, f"Expected 2 decks after duplicate, got {len(decks_now)}"

            # Delete duplicated card via explicit confirmation dialog + assert post-delete count == 1
            dup_title = dup_json["deck"]["title"]
            _open_card_menu(dup_title)
            click_resilient(
                page,
                [
                    lambda p: p.get_by_role("menuitem", name=re.compile(r"删除")),
                    lambda p: p.get_by_role("button", name=re.compile(r"删除")),
                ],
                description="Project Delete action",
            )
            confirm_dlg = locate_first(page, ['[role="dialog"]'], description="Delete confirmation dialog")
            with page.expect_response(
                lambda r: "/api/decks/" in r.url and r.request.method == "DELETE",
                timeout=ctx.timeout_ms,
            ) as del_info:
                click_resilient(
                    confirm_dlg,
                    [lambda d: d.get_by_role("button", name=re.compile(r"确认删除|永久删除|删除"))],
                    description="Confirm permanent delete button",
                )
            assert del_info.value.status == 200
            page.wait_for_timeout(200)
            decks_after_del = demo.get("/api/decks").assert_status(200).require_json()["decks"]
            assert len(decks_after_del) == 1, (
                f"Expected 1 deck remaining after deleting duplicate, got {len(decks_after_del)}"
            )

            # Unconditional verification of ALL 3 preserved community tabs (NO silent skip)
            for tab_pat, desc in (
                (r"我收藏的|已收藏", "Community tab: 我收藏的"),
                (r"我发布的", "Community tab: 我发布的"),
                (r"我点赞的", "Community tab: 我点赞的"),
            ):
                click_resilient(
                    page,
                    [
                        lambda p, rx=tab_pat: p.get_by_role("tab", name=re.compile(rx)),
                        lambda p, rx=tab_pat: p.get_by_role("button", name=re.compile(rx)),
                    ],
                    description=desc,
                )
                page.wait_for_timeout(180)
                if "我发布的" in tab_pat:
                    pub_cards = page.locator('article[data-prompt-slug], main a[href^="/studio/"]')
                    assert pub_cards.count() >= 1, (
                        "我发布的 tab did not render demo_designer's seeded published styles"
                    )

            guard.assert_no_browser_errors("G1_UI_09")


def g1_ui_10_compare_comparator(ctx: TestContext) -> None:
    with ctx.browser_page() as guard:
        page = guard.page
        guard.goto_ok(f"{ctx.base_url}/compare")
        # Seed 3 distinct styles into localStorage if fewer than 3 are currently shown
        if page.locator("main .pg-slide-outer").count() < 3:
            page.evaluate(
                "([k, ids]) => window.localStorage.setItem(k, JSON.stringify(ids))",
                [
                    COMPARE_STORAGE_KEY,
                    ["prompt_soft_bento", "prompt_keynote_obsidian", "prompt_mckinsey_exec"],
                ],
            )
            guard.goto_ok(f"{ctx.base_url}/compare")

        canvases = page.locator("main .pg-slide-outer")
        assert canvases.count() >= 3, f"Expected >= 3 compare columns, got {canvases.count()}"

        # Top-Y alignment check across 3 columns
        ys = [canvases.nth(i).bounding_box()["y"] for i in range(3)]
        assert max(ys) - min(ys) <= 8.0, f"Compare columns not top-aligned: y positions={ys}"

        # Unified topic sync across all 3 columns
        topic = "冰川同内容三风格对齐测试"
        fill_resilient(
            page,
            [
                "#pg-compare-topic-input",
                lambda p: p.locator("main").get_by_placeholder(re.compile(r"主题|输入.*内容", re.I)),
                'main input[type="text"]',
            ],
            topic,
            description="Compare unified topic input",
        )
        page.wait_for_timeout(200)
        for i in range(3):
            assert topic in (canvases.nth(i).inner_text() or ""), (
                f"Compare column {i + 1} did not sync unified topic {topic!r}"
            )

        # Unconditionally cycle ALL 5 representative slide types (NO silent skip)
        for pat in (r"目录", r"数据", r"对比", r"SWOT", r"结尾"):
            click_resilient(
                page,
                [
                    lambda p, rx=pat: p.locator("main").get_by_role("tab", name=re.compile(rx, re.I)),
                    lambda p, rx=pat: p.locator("main").get_by_role("button", name=re.compile(rx, re.I)),
                ],
                description=f"Compare slide-type switcher {pat}",
            )
            page.wait_for_timeout(120)
            assert canvases.count() >= 3, f"Compare columns dropped below 3 on slide type {pat}"
            for i in range(3):
                assert len((canvases.nth(i).inner_text() or "").strip()) > 5, (
                    f"Compare column {i + 1} rendered blank on slide type {pat}"
                )

        assert re.search(r"#[0-9A-Fa-f]{6}", guard.get_body_text()), "Compare page missing palette hex swatches"

        # Remove 1 column (3 -> 2) and add a style back (2 -> 3)
        click_resilient(
            page,
            [
                'main button[aria-label*="移除"]',
                'main button[title*="移除"]',
                lambda p: p.locator("main").get_by_role("button", name=re.compile(r"移除|移出|取消对比|删除此列")),
            ],
            description="Remove 1 compare column button",
        )
        page.wait_for_timeout(200)
        assert canvases.count() == 2, f"Expected 2 compare columns after removing 1, got {canvases.count()}"

        add_ctl = locate_first(
            page,
            [
                "#pg-compare-add-select",
                'main select[aria-label*="添加"]',
                'main select[aria-label*="加入"]',
                'main select',
                lambda p: p.locator("main").get_by_role("button", name=re.compile(r"添加风格|加入风格|新增对比|\+\s*添加")),
            ],
            description="Compare add style back control",
        )
        if str(add_ctl.evaluate("el => el.tagName")).upper() == "SELECT":
            add_ctl.select_option(index=1)
        else:
            add_ctl.click()
            page.wait_for_timeout(150)
            opt = locate_first(
                page,
                [
                    '[role="dialog"] button[data-prompt-id]',
                    '[role="listbox"] [role="option"]',
                    '[role="menu"] [role="menuitem"]',
                    '[role="dialog"] button:has-text("加入")',
                    '[role="dialog"] article button',
                ],
                description="Style choice inside Compare add picker",
            )
            opt.click()
        page.wait_for_timeout(200)
        assert canvases.count() == 3, f"Expected 3 compare columns after adding style back, got {canvases.count()}"

        guard.assert_no_browser_errors("G1_UI_10")


def g1_ui_11_studio_redirect_and_workbench(ctx: TestContext) -> None:
    # /studio redirect
    r = ctx.api(follow_redirects=False).get("/studio")
    assert r.status in (301, 302, 307, 308), f"GET /studio should redirect, got {r.status}"
    loc = r.header("location")
    assert loc.startswith("/studio/") and len(loc) > len("/studio/"), f"Bad /studio redirect: {loc!r}"

    demo = ctx.api_logged_in(ACCOUNT_DEMO)
    with ctx.cleanup() as cleanup:
        with ctx.browser_page() as guard:
            guard.goto_ok(f"{ctx.base_url}/studio/apple-soft-bento-modular")
            page = guard.page

            # Verify 16:9 stage
            stage = guard.find_primary_stage()
            assert_16_9_ratio(stage, label="Prompt Studio SlideCanvas")

            # Unconditionally cycle ALL 12 slide types in filmstrip (disambiguated from 6-tool tablist)
            slide_tabs = page.locator(
                '.pg-filmstrip [role="tab"], .pg-filmstrip button, '
                '[role="tablist"][aria-label*="幻灯片"] [role="tab"], '
                '[role="tablist"][aria-label*="页型"] [role="tab"], '
                '[data-slide-filmstrip] [role="tab"], [data-slide-filmstrip] button'
            )
            assert slide_tabs.count() >= 12, (
                f"Expected >= 12 slide-type filmstrip tabs in Prompt Studio, got {slide_tabs.count()}"
            )
            for i in range(12):
                slide_tabs.nth(i).click()
                page.wait_for_timeout(50)
                assert len((stage.inner_text() or "").strip()) > 0, f"Blank Studio canvas on filmstrip tab {i}"

            # 5-dimension prompt anatomy overlay pin
            anatomy_items = page.locator(".pg-anatomy-item, .pg-blueprint-chip, [data-anatomy-dim]")
            assert anatomy_items.count() >= 5, (
                f"Expected >= 5 prompt anatomy dimension items, got {anatomy_items.count()}"
            )
            anatomy_items.first.click()
            page.wait_for_timeout(120)
            assert bool(
                anatomy_items.first.evaluate(
                    "(el) => /is-active|active|pinned/i.test(el.className) || /已锁定/.test(el.innerText || '')"
                )
            ), "Clicking 1st anatomy item did not activate/pin overlay"

            # Live visual tweaker accent dot + 恢复原版风格 reset
            accent_dots = page.locator(".pg-accent-dot, [data-accent-dot]")
            assert accent_dots.count() >= 2, f"Expected >= 2 live tweaker accent dots, got {accent_dots.count()}"
            non_active_dot = page.locator(".pg-accent-dot:not(.is-active), [data-accent-dot]:not(.is-active)").first
            non_active_dot.click()
            page.wait_for_timeout(120)
            click_resilient(
                page,
                [lambda p: p.get_by_role("button", name=re.compile(r"恢复原版风格|重置风格|恢复默认"))],
                description="Live tweaker 恢复原版风格 reset button",
            )
            page.wait_for_timeout(120)

            # Param topic updates compiled prompt output
            tok = unique_token("STU")
            fill_resilient(
                page,
                ["#pg-param-topic", lambda p: p.get_by_label(re.compile(r"主题|Topic", re.I))],
                f"冰川编译验证 {tok}",
                description="Studio topic input",
            )
            page.wait_for_timeout(150)
            output_el = locate_first(page, ["#pg-compiled-prompt-output"], description="Compiled prompt output")
            compiled_initial = str(
                output_el.evaluate("e => (typeof e.value === 'string' ? e.value : e.innerText) || ''")
            )
            assert tok in compiled_initial, "Compiled prompt output did not reflect Studio topic input"

            # Verify all 6 Target Tools & exact TOOL_MARKERS
            for tool_id in TARGET_TOOLS:
                click_resilient(
                    page,
                    [
                        f"#pg-tool-tab-{tool_id}",
                        lambda p, pat=TOOL_MARKERS[tool_id]["label_pattern"]: p.get_by_role(
                            "tab", name=re.compile(pat, re.I)
                        ),
                    ],
                    description=f"Studio tool tab {tool_id}",
                )
                page.wait_for_timeout(120)
                compiled = str(
                    output_el.evaluate("e => (typeof e.value === 'string' ? e.value : e.innerText) || ''")
                )
                for req_tok in TOOL_MARKERS[tool_id]["required_tokens"]:
                    assert req_tok in compiled, (
                        f"Tool {tool_id} compiled prompt missing required token {req_tok!r}"
                    )

            # Under ai-image tab, verify 6-slide & 12-slide batch modes
            click_resilient(page, ["#pg-tool-tab-ai-image"], description="Switch to ai-image tab")
            page.wait_for_timeout(100)
            click_resilient(page, ["#pg-ai-img-batch-btn"], description="ai-image 6-slide batch button")
            page.wait_for_timeout(120)
            batch6_out = str(
                output_el.evaluate("e => (typeof e.value === 'string' ? e.value : e.innerText) || ''")
            )
            assert re.search(r"0?6|Slide\s*6|第\s*6\s*页|6\s*页", batch6_out, re.I), (
                "ai-image 6-slide batch output missing 6-slide markers"
            )
            click_resilient(page, ["#pg-ai-img-batch-12-btn"], description="ai-image 12-slide batch button")
            page.wait_for_timeout(120)
            batch12_out = str(
                output_el.evaluate("e => (typeof e.value === 'string' ? e.value : e.innerText) || ''")
            )
            assert re.search(r"12|Slide\s*12|第\s*12\s*页|12\s*页", batch12_out, re.I) and len(batch12_out) > len(batch6_out), (
                "ai-image 12-slide batch output did not expand beyond 6-slide batch"
            )

            # Sample exports: .html (HtmlDeckVerifier) & .pptgod.json (PortableStylePack v1)
            with page.expect_download(timeout=ctx.timeout_ms) as html_dl:
                click_resilient(page, ["#pg-studio-export-html-btn"], description="Studio export HTML button")
            html_path = html_dl.value.path()
            assert html_path is not None, "Studio HTML export did not produce a downloaded file"
            HtmlDeckVerifier.verify(Path(html_path).read_text(encoding="utf-8"))

            with page.expect_download(timeout=ctx.timeout_ms) as json_dl:
                click_resilient(page, ["#pg-studio-export-json-btn"], description="Studio export .pptgod.json button")
            json_path = json_dl.value.path()
            assert json_path is not None, "Studio .pptgod.json export did not produce a downloaded file"
            pack_data = json.loads(Path(json_path).read_text(encoding="utf-8"))
            assert pack_data.get("schema") == "pptgod.style.v1" and isinstance(pack_data.get("visualSpec"), dict), (
                f"Exported .pptgod.json invalid schema: {list(pack_data.keys())}"
            )

            # Copy prompt feedback
            click_resilient(
                page,
                [
                    "#pg-studio-copy-btn",
                    lambda p: p.get_by_role("button", name=re.compile(r"复制.*提示词|一键复制", re.I)),
                ],
                description="Studio Copy Prompt button",
            )
            page.wait_for_timeout(150)
            assert "已复制" in guard.get_body_text(), "Studio copy prompt missing '已复制' confirmation"

            # Authenticated community review comment CRUD (POST + DELETE + CleanupRegistry safety net)
            login_via_api(page, ctx.base_url, ACCOUNT_DEMO)
            guard.goto_ok(f"{ctx.base_url}/studio/apple-soft-bento-modular")
            review_msg = f"[E2E] 冰川工作室实测评价 {tok}"
            fill_resilient(page, ["#pg-review-textarea"], review_msg, description="Studio review textarea")
            with page.expect_response(
                lambda resp: "/api/prompts/prompt_soft_bento/comments" in resp.url and resp.request.method == "POST",
                timeout=ctx.timeout_ms,
            ) as cmt_post:
                click_resilient(page, ["#pg-review-submit-btn"], description="Studio submit review button")
            assert cmt_post.value.status == 201, f"Studio comment POST returned {cmt_post.value.status}"
            created_cmt = next(
                (c for c in cmt_post.value.json().get("comments", []) if c.get("content") == review_msg),
                None,
            )
            assert created_cmt is not None, "Posted review missing from POST response"
            cid = created_cmt["id"]
            cleanup.register_delete_comment(demo, "prompt_soft_bento", cid)

            page.wait_for_timeout(150)
            assert review_msg in guard.get_body_text(), "Posted review not visible in Studio review list"
            review_card = page.locator("article.pg-review-card, [data-review-card]").filter(has_text=review_msg).first
            with page.expect_response(
                lambda resp: "/api/prompts/prompt_soft_bento/comments" in resp.url and resp.request.method == "DELETE",
                timeout=ctx.timeout_ms,
            ) as cmt_del:
                click_resilient(
                    review_card,
                    ['button[aria-label*="删除"]', 'button[title*="删除"]', "button"],
                    description="Delete own Studio review button",
                )
            assert cmt_del.value.status == 200, f"Studio comment DELETE returned {cmt_del.value.status}"
            page.wait_for_timeout(150)
            assert review_msg not in guard.get_body_text(), "Deleted review still visible in Studio"

            guard.assert_no_browser_errors("G1_UI_11")


def g1_ui_12_deck_rehearsal_cockpit(ctx: TestContext) -> None:
    demo = ctx.api_logged_in(ACCOUNT_DEMO)
    with ctx.cleanup() as cleanup:
        tok = unique_token("REH")
        deck_resp = demo.post(
            "/api/decks",
            json_body=make_valid_deck_payload(
                title=f"[E2E-REH] 排练测试 {tok}",
                slides=make_valid_slides(5, custom_notes=f"这是排练提词器验证讲稿 {tok}"),
                is_public=True,
            ),
        ).assert_status(201)
        deck_id = deck_resp.require_json()["deck"]["id"]
        cleanup.register_delete_deck(demo, deck_id)

        with ctx.browser_page() as guard:
            guard.goto_ok(f"{ctx.base_url}/deck/{deck_id}?rehearsal=1")
            page = guard.page

            cockpit = locate_first(page, ["#pg-rehearsal-cockpit"], description="Rehearsal Cockpit")
            assert_any_visible(cockpit, ["#pg-rehearsal-next-preview"], description="Next slide preview")

            # Export HTML, Export PPTX & Clone to Workshop controls visible & valid
            assert_any_visible(page, ["#pg-share-export-html-btn"], description="Deck Share Export HTML button")
            assert_any_visible(page, ["#pg-share-export-pptx-btn"], description="Deck Share Export PPTX button")
            clone_btn = locate_first(page, ["#pg-share-clone-btn"], description="Deck Share Clone to Workshop link")
            clone_href = clone_btn.get_attribute("href") or ""
            assert f"/generate?deck={deck_id}" in clone_href, (
                f"Expected #pg-share-clone-btn href to include /generate?deck={deck_id}, got {clone_href!r}"
            )

            # Timer preset & ticking check
            click_resilient(
                cockpit,
                ['[data-timer-preset="300"]', lambda c: c.get_by_role("button", name=re.compile(r"5\s*分钟|5m"))],
                description="5-minute timer preset",
            )
            clock = locate_first(cockpit, ["#pg-rehearsal-clock"], description="Rehearsal clock")
            t_before = (clock.inner_text() or "").strip()
            toggle_timer = locate_first(cockpit, ["#pg-rehearsal-timer-toggle"], description="Timer toggle")
            toggle_timer.click()
            page.wait_for_timeout(1250)
            toggle_timer.click()
            t_after = (clock.inner_text() or "").strip()
            assert t_after != t_before, f"Rehearsal timer did not tick: before={t_before!r}, after={t_after!r}"

            # Teleprompter font A+ — target real #pg-rehearsal-notes-text & strict before < after
            inc_btn = locate_first(cockpit, ["#pg-teleprompter-font-inc"], description="Teleprompter A+ button")
            tele_el = locate_first(
                cockpit,
                ["#pg-rehearsal-notes-text", ".pg-rehearsal-notes-body", "[data-teleprompter]"],
                description="Teleprompter notes text element",
            )
            before_px = float(tele_el.evaluate("el => parseFloat(getComputedStyle(el).fontSize) || 0"))
            inc_btn.click()
            page.wait_for_timeout(100)
            after_px = float(tele_el.evaluate("el => parseFloat(getComputedStyle(el).fontSize) || 0"))
            assert before_px > 0 and after_px > before_px, (
                f"Teleprompter A+ font size did not strictly increase: before={before_px}px, after={after_px}px"
            )

            # Keyboard next slide — explicitly verify advancement to Slide 2 (not P02 in next-preview)
            page.keyboard.press("ArrowRight")
            page.wait_for_timeout(150)
            page_text = guard.get_body_text()
            assert re.search(r"2\s*/\s*5|P02\s*提词讲稿", page_text), (
                "ArrowRight did not advance rehearsal deck to slide 2 ('2 / 5' or 'P02 提词讲稿' absent)"
            )

            guard.assert_no_browser_errors("G1_UI_12")


def g1_ui_13_create_remix_and_image_to_style(ctx: TestContext) -> None:
    demo = ctx.api_logged_in(ACCOUNT_DEMO)
    with ctx.cleanup() as cleanup:
        with ctx.browser_page() as guard:
            login_via_api(guard.page, ctx.base_url, ACCOUNT_DEMO)
            guard.goto_ok(f"{ctx.base_url}/create?fork=swiss-international-grid")
            page = guard.page

            assert re.search(r"二创|Remix|基于", guard.get_body_text(), re.I), (
                "/create?fork=... missing remix provenance banner"
            )

            # Image-to-Style extractor with synthetic 40x40 palette PNG (hidden file input -> locate_attached)
            img_input = locate_attached(
                page,
                ["#pg-extract-image-input"],
                description="Image-to-Style hidden file input",
            )
            img_input.set_input_files(
                {
                    "name": "brand_palette.png",
                    "mimeType": "image/png",
                    "buffer": build_png_bytes(40, 40, palette_mode=True),
                }
            )
            swatches = locate_first(
                page,
                ["#pg-extracted-swatches"],
                timeout_ms=8000,
                description="Extracted palette swatches",
            )
            assert swatches.locator("button, span, div").count() >= 2, (
                "Image-to-Style did not render extracted swatches"
            )

            # WCAG contrast badge & autofix button
            wcag_status = locate_first(page, ["#pg-wcag-status"], description="Create page WCAG status bar")
            assert re.search(r"WCAG\s*(AAA|AA|WARN)", wcag_status.inner_text() or "", re.I), (
                f"#pg-wcag-status missing WCAG grade: {wcag_status.inner_text()!r}"
            )
            click_resilient(page, ["#pg-wcag-autofix-btn"], description="Create page WCAG autofix button")
            page.wait_for_timeout(150)

            # Import .pptgod.json PortableStylePack (hidden file input -> locate_attached)
            tok = unique_token("CRT")
            pack_title = f"[E2E] 导入冰川风格包 {tok}"
            json_input = locate_attached(
                page,
                ["#pg-import-style-json-input"],
                description=".pptgod.json hidden import file input",
            )
            json_input.set_input_files(
                {
                    "name": "glacier_pack.pptgod.json",
                    "mimeType": "application/json",
                    "buffer": make_pptgod_style_pack_json(title=pack_title).encode("utf-8"),
                }
            )
            page.wait_for_timeout(250)
            title_input = locate_first(page, ["#create-title"], description="Create title input")
            assert title_input.input_value() == pack_title, (
                f"Importing .pptgod.json did not populate #create-title: expected {pack_title!r}, "
                f"got {title_input.input_value()!r}"
            )

            # Public / Private visibility radio toggle
            priv_radio = click_resilient(
                page,
                ["#pg-create-visibility-private"],
                description="Create Private visibility radio",
            )
            assert priv_radio.get_attribute("aria-checked") == "true", (
                "Private visibility radio did not set aria-checked='true'"
            )
            pub_radio = click_resilient(
                page,
                ["#pg-create-visibility-public"],
                description="Create Public visibility radio",
            )
            assert pub_radio.get_attribute("aria-checked") == "true", (
                "Public visibility radio did not set aria-checked='true'"
            )

            # Update title to isolated [E2E] value and publish
            title_input.fill(f"[E2E] 冰川二创 {tok}")
            with page.expect_response(
                lambda r: r.url.rstrip("/").endswith("/api/prompts") and r.request.method == "POST",
                timeout=ctx.timeout_ms,
            ) as create_info:
                click_resilient(
                    page,
                    [
                        "#create-submit-btn",
                        lambda p: p.get_by_role("button", name=re.compile(r"发布.*风格|保存并发布|提交发布")),
                    ],
                    description="Publish style submit button",
                )
            assert create_info.value.status == 201, f"Publish returned HTTP {create_info.value.status}"
            created_id = create_info.value.json()["prompt"]["id"]
            cleanup.register_delete_prompt(demo, created_id)

            guard.assert_no_browser_errors("G1_UI_13")


def g1_ui_14_tools_four_tabs(ctx: TestContext) -> None:
    demo = ctx.api_logged_in(ACCOUNT_DEMO)
    with ctx.cleanup() as cleanup:
        tok = unique_token("TLS")
        deck_title = f"[E2E-TLS] 排练入口文稿 {tok}"
        deck_resp = demo.post(
            "/api/decks",
            json_body=make_valid_deck_payload(title=deck_title, is_public=False),
        ).assert_status(201)
        deck_id = deck_resp.require_json()["deck"]["id"]
        cleanup.register_delete_deck(demo, deck_id)

        with ctx.browser_page() as guard:
            login_via_api(guard.page, ctx.base_url, ACCOUNT_DEMO)
            page = guard.page

            # 1. Pacing tab (?tab=pacing) — strict aria-selected + specific result panel + saved-deck rehearsal launcher
            guard.goto_ok(f"{ctx.base_url}/tools?tab=pacing")
            pacing_tab = locate_first(page, ["#pg-tool-tab-pacing"], description="Tools pacing tab button")
            assert pacing_tab.get_attribute("aria-selected") == "true", (
                "/tools?tab=pacing did not activate #pg-tool-tab-pacing (aria-selected != 'true')"
            )
            pace_res = locate_first(
                page,
                ["#pg-pace-result", "#pg-tools-pacing-panel"],
                description="Pacing computed result panel",
            )
            assert re.search(r"分|秒|分钟|min", pace_res.inner_text() or ""), (
                f"Pacing result missing computed duration: {pace_res.inner_text()!r}"
            )
            # Saved-deck rehearsal launcher link to /deck/{deck_id}?rehearsal=1
            rehearsal_link = locate_first(
                page,
                [
                    f'a[href*="/deck/{deck_id}"][href*="rehearsal=1"]',
                    f'a[href*="/deck/{deck_id}"]',
                ],
                timeout_ms=8000,
                description="Tools saved-deck rehearsal launcher link",
            )
            assert deck_id in (rehearsal_link.get_attribute("href") or ""), (
                "Rehearsal launcher link missing seeded deck_id"
            )

            # 2. PPTX inspect tab (?tab=pptx-inspect)
            guard.goto_ok(f"{ctx.base_url}/tools?tab=pptx-inspect")
            pptx_tab = locate_first(page, ["#pg-tool-tab-pptx"], description="Tools pptx-inspect tab button")
            assert pptx_tab.get_attribute("aria-selected") == "true", (
                "/tools?tab=pptx-inspect did not activate #pg-tool-tab-pptx (aria-selected != 'true')"
            )
            pptx_panel = locate_first(page, ["#pg-tools-pptx-panel"], description="Tools PPTX inspector panel")
            pptx_input = locate_attached(
                pptx_panel,
                ["#pg-tools-pptx-input", 'input[type="file"]'],
                description="PPTX inspector upload input",
            )
            pptx_input.set_input_files(
                {
                    "name": "sample_deck.pptx",
                    "mimeType": PPTX_CONTENT_TYPE,
                    "buffer": build_valid_pptx_bytes(),
                }
            )
            locate_first(
                pptx_panel,
                [lambda p: p.get_by_text(re.compile(r"钙钛矿太阳能电池|4\s*页"))],
                timeout_ms=10000,
                description="Parsed PPTX inspection output inside #pg-tools-pptx-panel",
            )

            # 3. Palette WCAG tab (?tab=palette-wcag) — strict tab & panel checks (NOT body text 'WCAG')
            guard.goto_ok(f"{ctx.base_url}/tools?tab=palette-wcag")
            palette_tab = locate_first(page, ["#pg-tool-tab-palette"], description="Tools palette-wcag tab button")
            assert palette_tab.get_attribute("aria-selected") == "true", (
                "/tools?tab=palette-wcag did not activate #pg-tool-tab-palette (aria-selected != 'true')"
            )
            palette_panel = locate_first(
                page,
                ["#pg-tools-palette-panel"],
                description="Tools palette-wcag panel",
            )
            assert_any_visible(
                palette_panel,
                ["#pg-tools-export-style-json"],
                description="Tools palette-wcag export .pptgod.json button",
            )

            # 4. Visual director tab (?tab=visual-director) — strict tab, panel & non-empty output
            guard.goto_ok(f"{ctx.base_url}/tools?tab=visual-director")
            director_tab = locate_first(page, ["#pg-tool-tab-director"], description="Tools visual-director tab button")
            assert director_tab.get_attribute("aria-selected") == "true", (
                "/tools?tab=visual-director did not activate #pg-tool-tab-director (aria-selected != 'true')"
            )
            director_panel = locate_first(
                page,
                ["#pg-tools-director-panel"],
                description="Tools visual-director panel",
            )
            vd_output = locate_first(
                director_panel,
                ["#pg-tools-vd-output"],
                description="Visual director compiled prompt output",
            )
            vd_val = str(vd_output.evaluate("el => (typeof el.value === 'string' ? el.value : el.innerText) || ''")).strip()
            assert len(vd_val) >= 20, f"Visual director prompt output unexpectedly short: {vd_val!r}"

            guard.assert_no_browser_errors("G1_UI_14")


def g1_ui_15_modals_and_not_found(ctx: TestContext) -> None:
    with ctx.browser_page() as guard:
        guard.goto_ok(f"{ctx.base_url}/")
        page = guard.page

        # AuthModal: switch between signup and login, then submit the login form.
        click_resilient(
            page,
            [
                "#pg-nav-login-btn",
                lambda p: p.get_by_role("button", name=re.compile(r"登录\s*/\s*注册|登录|注册")),
            ],
            description="Topbar Login/Register button",
        )
        auth_dlg = locate_first(page, ['[role="dialog"]'], description="AuthModal dialog")
        click_resilient(
            auth_dlg,
            [
                lambda d: d.get_by_role("tab", name=re.compile(r"注册")),
                lambda d: d.get_by_role("button", name=re.compile(r"注册账号|立即注册|^注册$")),
            ],
            description="AuthModal Register tab",
        )
        page.wait_for_timeout(120)
        assert_any_visible(
            auth_dlg,
            [
                lambda d: d.get_by_placeholder(re.compile(r"用户名|昵称|邮箱")),
                'input[name="username"]',
                'input[type="email"]',
            ],
            description="AuthModal Register form input",
        )
        click_resilient(
            auth_dlg,
            [
                lambda d: d.get_by_role("tab", name=re.compile(r"登录")),
                lambda d: d.get_by_role("button", name=re.compile(r"已有账号|账号登录|^登录$")),
            ],
            description="AuthModal Login tab",
        )
        page.wait_for_timeout(120)
        auth_dlg.locator("#pg-auth-email").fill(ACCOUNT_DEMO.email)
        auth_dlg.locator("#pg-auth-password").fill(ACCOUNT_DEMO.password)
        with page.expect_response(
            lambda r: "/api/auth/login" in r.url and r.request.method == "POST",
            timeout=ctx.timeout_ms,
        ) as login_resp:
            click_resilient(auth_dlg, ["#pg-auth-submit-btn"], description="AuthModal login submit button")
        assert login_resp.value.status == 200, f"Login returned HTTP {login_resp.value.status}"
        locate_first(page, ["#pg-nav-logout-btn"], timeout_ms=ctx.timeout_ms, description="Logged-in logout button")

        # SettingsModal from Sidebar — verify editable profile inputs AND local-only BYOK section
        click_resilient(
            page,
            [
                lambda p: p.locator("aside").get_by_role("button", name=re.compile(r"设置")),
                lambda p: p.get_by_role("button", name=re.compile(r"^设置$|账户设置|偏好设置")),
            ],
            description="Sidebar Settings button",
        )
        settings_dlg = locate_first(page, ['[role="dialog"]'], description="SettingsModal")
        settings_text = settings_dlg.inner_text()
        assert re.search(r"昵称|个人资料|简介", settings_text) and re.search(r"BYOK|API|本地", settings_text, re.I), (
            f"SettingsModal missing profile or local-only BYOK section: {settings_text[:240]!r}"
        )
        editable_inputs = settings_dlg.locator('input:not([type="hidden"]), textarea')
        assert editable_inputs.count() >= 2, (
            f"SettingsModal expected >= 2 editable profile/BYOK inputs, got {editable_inputs.count()}"
        )
        page.keyboard.press("Escape")
        page.wait_for_timeout(150)

        # HelpModal from Sidebar — strict 10\s*MB FAQ match (NOT bare '10')
        click_resilient(
            page,
            [
                lambda p: p.locator("aside").get_by_role("button", name=re.compile(r"帮助")),
                lambda p: p.get_by_role("button", name=re.compile(r"帮助中心|帮助")),
            ],
            description="Sidebar Help button",
        )
        help_dlg = locate_first(page, ['[role="dialog"]'], description="HelpModal")
        help_search = locate_first(
            help_dlg,
            ['input[type="search"]', 'input[type="text"]', "input"],
            description="HelpModal FAQ search input",
        )
        help_search.fill("10MB")
        page.wait_for_timeout(150)
        assert re.search(r"10\s*MB", help_dlg.inner_text() or "", re.I), (
            f"HelpModal search for '10MB' did not match any '10MB' FAQ entry: {(help_dlg.inner_text() or '')[:240]!r}"
        )
        page.keyboard.press("Escape")
        page.wait_for_timeout(150)

        # Glacier not-found page
        with guard.allow_expected_http_errors({404}):
            guard.goto_ok(
                f"{ctx.base_url}/nonexistent-route-glacier-404",
                expected_statuses=(404,),
            )
        assert_any_visible(
            page,
            ['a[href="/"]', 'a[href="/gallery"]'],
            description="Glacier 404 recovery link",
        )
        guard.assert_no_browser_errors("G1_UI_15")


def g1_ui_15b_creator_profile(ctx: TestContext) -> None:
    with ctx.browser_page() as guard:
        guard.goto_ok(f"{ctx.base_url}/creator/{ACCOUNT_OFFICIAL.username}")
        page = guard.page
        text = guard.get_body_text()
        assert ACCOUNT_OFFICIAL.display_name in text, f"Missing displayName {ACCOUNT_OFFICIAL.display_name!r}"
        assert ACCOUNT_OFFICIAL.bio in text, f"Missing bio {ACCOUNT_OFFICIAL.bio!r}"
        assert "15" in text, "Creator impact publishedCount 15 not displayed"

        # Deduplicated card/slug count (NEVER double-count card + inner /studio/ link)
        card_count = page.locator("article[data-prompt-slug]").count()
        if card_count == 0:
            unique_slugs: list[str] = page.evaluate(
                """() => Array.from(
                  new Set(
                    Array.from(document.querySelectorAll('main a[href^="/studio/"]'))
                      .map((a) => (a.getAttribute('href') || '').split('?')[0])
                      .filter((h) => h.length > '/studio/'.length)
                  )
                )"""
            )
            card_count = len(unique_slugs)
        assert card_count == ACCOUNT_OFFICIAL.seeded_prompt_count, (
            f"Expected exactly {ACCOUNT_OFFICIAL.seeded_prompt_count} unique public styles on creator profile, "
            f"got {card_count}"
        )
        guard.assert_no_browser_errors("G1_UI_15B")


def get_specs() -> list[TestSpec]:
    return [
        # Tier 1A: 12 Core API Happy Paths
        TestSpec("G1_API_01", 1, "GET /api/health returns ok, 36 catalogCount, PostgreSQL", g1_api_01_health, ("api", "health")),
        TestSpec("G1_API_02", 1, "GET /api/prompts catalog (36 slugs), facet filters & sorts", g1_api_02_prompts_catalog_filters, ("api", "prompts")),
        TestSpec("G1_API_03", 1, "Auth login/me/logout lifecycle & HttpOnly session cookie", g1_api_03_auth_lifecycle, ("api", "auth")),
        TestSpec("G1_API_04", 1, "Prompts POST/GET/PUT/PATCH/DELETE lifecycle", g1_api_04_prompts_crud, ("api", "prompts", "crud")),
        TestSpec("G1_API_05", 1, "Prompt like/favorite/copy toggles & sync-favorites merge", g1_api_05_prompt_social_and_sync, ("api", "social")),
        TestSpec("G1_API_06", 1, "Prompt comments GET seeded + POST + DELETE", g1_api_06_comments_crud, ("api", "comments")),
        TestSpec("G1_API_07", 1, "PATCH /api/auth/profile restore & GET /api/creators/pptgod_lab", g1_api_07_profile_and_creator_api, ("api", "profile", "creator")),
        TestSpec("G1_API_08", 1, "POST /api/parse-document across .md/.txt/.docx/.pptx/.pdf", g1_api_08_parse_document_formats, ("api", "parse")),
        TestSpec("G1_API_09", 1, "POST /api/outline (10 slides) & smart POST /api/generate", g1_api_09_outline_and_smart_generate, ("api", "generate")),
        TestSpec("G1_API_10", 1, "POST /api/polish executive/metrics/notes smart actions", g1_api_10_polish_all_three_actions, ("api", "polish")),
        TestSpec("G1_API_11", 1, "Saved Decks CRUD (PUT rename + POST clone) & 12-slide native PPTX", g1_api_11_decks_crud_and_native_pptx, ("api", "decks", "pptx")),
        TestSpec("G1_API_12", 1, "SEO robots.txt, sitemap.xml & studio opengraph-image PNG", g1_api_12_seo_and_og_image, ("api", "seo")),
        # Tier 1B: 17 Isolated Browser UI Happy Paths
        TestSpec("G1_UI_01", 1, "/ Dashboard Bento 8:4 / 9:3 / 4:8, H1 blue highlight & live 3-style sync", g1_ui_01_dashboard_bento, ("ui", "dashboard"), True),
        TestSpec("G1_UI_01B", 1, "/ legacy filter query params server-redirect to /gallery", g1_ui_01b_dashboard_legacy_redirect, ("ui", "redirect"), True),
        TestSpec("G1_UI_02", 1, "Global AppShell 64px Topbar, Sidebar 220px<->64px collapse & nav links", g1_ui_02_appshell_topbar_and_sidebar, ("ui", "shell"), True),
        TestSpec("G1_UI_03", 1, "/gallery 36 styles, domain capsules, URL sync, 2px blue selection & fav", g1_ui_03_gallery_filters_selection_favorites, ("ui", "gallery"), True),
        TestSpec("G1_UI_04", 1, "/gallery Style Detail Drawer, StyleMatcherModal & DocIntakeWorkbench", g1_ui_04_gallery_drawer_matcher_doc_intake, ("ui", "gallery", "modals"), True),
        TestSpec("G1_UI_05", 1, "/generate Creation Workshop 4-step stepper, upload, live preview & outline", g1_ui_05_workshop_wizard_flow, ("ui", "workshop"), True),
        TestSpec("G1_UI_06", 1, "/generate Editor topbar, slide tree, add slide, zoom & fullscreen", g1_ui_06_editor_topbar_tree_toolbar_zoom, ("ui", "editor"), True),
        TestSpec("G1_UI_07", 1, "/generate Editor layout-only switch, notes AI, brandFooter & AI Assistant", g1_ui_07_editor_inspector_notes_ai_assistant, ("ui", "editor", "polish"), True),
        TestSpec("G1_UI_08", 1, "Design Audit (/generate?panel=audit) 100-pt score & contrast autofix", g1_ui_08_design_audit_workflow, ("ui", "audit"), True),
        TestSpec("G1_UI_09", 1, "/collections My Projects KPI, Rename (PUT), Duplicate (POST), Delete & Tabs", g1_ui_09_collections_projects_crud, ("ui", "collections"), True),
        TestSpec("G1_UI_10", 1, "/compare 3-col top-aligned synced comparison & unified topic", g1_ui_10_compare_comparator, ("ui", "compare"), True),
        TestSpec("G1_UI_11", 1, "/studio redirect & /studio/[slug] 12-slide + 6-tool prompt compiler", g1_ui_11_studio_redirect_and_workbench, ("ui", "studio"), True),
        TestSpec("G1_UI_12", 1, "/deck/[id]?rehearsal=1 Rehearsal Cockpit timer, teleprompter & keys", g1_ui_12_deck_rehearsal_cockpit, ("ui", "rehearsal"), True),
        TestSpec("G1_UI_13", 1, "/create?fork=... Remix, Image-to-Style palette extraction & publish", g1_ui_13_create_remix_and_image_to_style, ("ui", "create"), True),
        TestSpec("G1_UI_14", 1, "/tools?tab=... all 4 toolbox tabs & PPTX inspector upload", g1_ui_14_tools_four_tabs, ("ui", "tools"), True),
        TestSpec("G1_UI_15", 1, "AuthModal, SettingsModal, HelpModal & Glacier 404 not-found page", g1_ui_15_modals_and_not_found, ("ui", "modals"), True),
        TestSpec("G1_UI_15B", 1, "/creator/pptgod_lab public creator profile, impact & 15 styles", g1_ui_15b_creator_profile, ("ui", "creator"), True),
    ]
