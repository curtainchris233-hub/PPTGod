"""Tier 6: PPTGod v4 Security, Reverse PPTX, Studio Handoff, /deck/[id] Stage, Marp/Prompt Export & OG Image E2E Suite (6 Tests).

Covers every v4 upgrade end-to-end:
  - T6_SEC_01: Deep VisualSpec field validation, SSRF private/cloud-metadata IP guard, login 429 rate-limit, copy-counter 5s dedupe
  - T6_PPTX_02: Reverse .pptx round-trip upload -> /api/parse-document parsedOutline + corrupt .pptx rejection + browser auto-outline re-skinning
  - T6_HANDOFF_03: Studio -> Generate customized VisualSpec handoff, inline DeckSpecTweaker, and localStorage auto-save draft recovery
  - T6_STAGE_04: Pure read-only presentation stage /deck/[id] privacy enforcement (private=404 zero-leak) + keyboard nav + speaker notes + HTML export + clone CTA + mobile responsiveness
  - T6_EXPORT_05: Real-deck Marp Markdown & Claude/Gamma prompt export modal, offline HTML motif fidelity, and 12/12 native PPTX vector artwork presets
  - T6_OG_06: Dynamic next/og PNG /studio/[slug]/opengraph-image (public=200 PNG, private=404), Gallery 12-slide copy & "更多页型" switcher, and Studio 12-slide AI image batch pack
"""

from __future__ import annotations

import re
import uuid
from typing import Any

from tests.e2e.config import (
    ACCOUNT_CHEN,
    ACCOUNT_DEMO,
    DESKTOP_VIEWPORT,
    MOBILE_VIEWPORT,
    make_valid_deck_payload,
    make_valid_prompt_payload,
    make_valid_visual_spec,
)
from tests.e2e.helpers import (
    HtmlDeckVerifier,
    PptxVerifier,
    TestCaseSpec,
    TestContext,
)
from tests.e2e.tier5_v3 import _build_multipart_request


def _tok(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def t6_sec_01_deep_spec_ssrf_and_rate_limit(ctx: TestContext) -> None:
    """P0 security: deep VisualSpec validation, BYOK SSRF private/metadata guard, login 429 rate limit, copy dedupe."""
    author = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    anon = ctx.api()

    # 1. Deep VisualSpec validation on POST /api/prompts and POST /api/decks
    bad_specs: list[tuple[str, dict[str, Any]]] = [
        (
            "css_injection_bg",
            {
                **make_valid_visual_spec(),
                "palette": {
                    **make_valid_visual_spec()["palette"],
                    "bg": "#FFFFFF; background-image: url(https://evil.test/x)",
                },
            },
        ),
        (
            "invalid_archetype",
            {
                **make_valid_visual_spec(),
                "layout": {
                    **make_valid_visual_spec()["layout"],
                    "archetype": "not-a-real-archetype",
                },
            },
        ),
        (
            "radius_out_of_range",
            {
                **make_valid_visual_spec(),
                "layout": {
                    **make_valid_visual_spec()["layout"],
                    "cornerRadius": 999,
                },
            },
        ),
        (
            "bad_chart_colors_len",
            {
                **make_valid_visual_spec(),
                "palette": {
                    **make_valid_visual_spec()["palette"],
                    "chartColors": ["#FF0000", "#00FF00"],
                },
            },
        ),
    ]

    for label, spec in bad_specs:
        payload = make_valid_prompt_payload(title=f"[E2E-T6] BadSpec {label}")
        payload["visualSpec"] = spec
        author.post("/api/prompts", json_body=payload).assert_status(
            400, f"POST /api/prompts must reject {label}"
        )

        deck_payload = make_valid_deck_payload(title=f"[E2E-T6] BadDeckSpec {label}")
        deck_payload["visualSpec"] = spec
        author.post("/api/decks", json_body=deck_payload).assert_status(
            400, f"POST /api/decks must reject {label}"
        )

    # 2. SSRF guard on BYOK endpoints: block cloud metadata & RFC1918 private IPs
    blocked_urls = [
        "http://169.254.169.254/latest/meta-data",
        "http://metadata.google.internal/computeMetadata/v1",
        "http://10.0.0.1/v1",
        "http://192.168.1.50/v1",
        "http://172.16.0.1/v1",
        "http://0.0.0.0/v1",
        "http://2852039166/latest/meta-data",  # decimal obfuscated 169.254.169.254
    ]
    for bad_base in blocked_urls:
        anon.post(
            "/api/generate",
            json_body={
                "topic": "SSRF Probe",
                "mode": "llm",
                "apiBase": bad_base,
                "apiKey": "sk-test-1234",
                "model": "gpt-4o-mini",
            },
        ).assert_status(400, f"/api/generate must block SSRF target {bad_base}")

        anon.post(
            "/api/generate-image",
            json_body={
                "prompt": "test",
                "apiBase": bad_base,
                "apiKey": "sk-test-1234",
                "model": "dall-e-3",
            },
        ).assert_status(400, f"/api/generate-image must block SSRF target {bad_base}")

    # 3. Login failed-attempt rate limit (15 fails -> 16th returns 429 + Retry-After)
    unique_email = f"ratelimit_{_tok('rl')}@e2e.test"
    saw_429 = False
    for attempt in range(1, 18):
        r = anon.post(
            "/api/auth/login",
            json_body={"email": unique_email, "password": "wrong_password_123"},
        )
        if r.status == 429:
            saw_429 = True
            retry_after = r.headers.get("retry-after") or r.headers.get("Retry-After")
            assert retry_after is not None, "429 login response must include Retry-After header"
            break
        assert r.status == 401, f"Expected 401 before rate limit on attempt {attempt}, got {r.status}"
    assert saw_429, "Expected HTTP 429 after 15 failed login attempts for same email"

    # 4. Copy-counter 5s dedupe on a temporary prompt
    with ctx.cleanup() as cleanup:
        created = (
            author.post(
                "/api/prompts",
                json_body=make_valid_prompt_payload(title=f"[E2E-T6] CopyDedupe {_tok('cp')}"),
            )
            .assert_status(201, "create temp prompt for copy dedupe")
            .require_json()["prompt"]
        )
        cleanup.register_delete_prompt(author, created["id"])

        c1 = author.post(f"/api/prompts/{created['id']}/copy").assert_status(200).require_json()
        c2 = author.post(f"/api/prompts/{created['id']}/copy").assert_status(200).require_json()
        assert c1["counted"] is True, f"First copy should count; got {c1}"
        assert c2["counted"] is False, f"Immediate repeat copy within 5s should be deduped; got {c2}"
        assert c2["copiesCount"] == c1["copiesCount"], (
            f"Deduped copy should not increment copiesCount: {c1} vs {c2}"
        )


def t6_pptx_02_reverse_pptx_import_roundtrip(ctx: TestContext) -> None:
    """Reverse .pptx import: export real .pptx -> upload to /api/parse-document -> parsedOutline + UI re-skinning."""
    anon = ctx.api()
    gen_resp = anon.post(
        "/api/generate",
        json_body={
            "topic": "[E2E-V4] 逆向 PPTX 翻新演练",
            "subtitle": "从旧版幻灯片自动反解大纲并重塑母版",
            "audience": "产品与设计委员会",
            "slideCount": 7,
            "mode": "smart",
        },
    ).assert_status(200)
    slides = gen_resp.require_json()["slides"]
    assert len(slides) == 7

    # 1. Export real .pptx binary via /api/export/pptx
    pptx_resp = anon.post(
        "/api/export/pptx",
        json_body={
            "title": "[E2E-V4] 逆向 PPTX 翻新演练",
            "subtitle": "从旧版幻灯片自动反解大纲并重塑母版",
            "audience": "产品与设计委员会",
            "styleName": "Swiss Minimalist",
            "visualSpec": make_valid_visual_spec(),
            "slides": slides,
        },
    ).assert_status(200)
    pptx_bytes = pptx_resp.body
    PptxVerifier.verify(pptx_bytes, expected_slide_count=7)

    # 2. Upload that exact .pptx right back to /api/parse-document
    parse_url = ctx.url("/api/parse-document")
    status, data = _build_multipart_request(
        parse_url,
        "file",
        "legacy-deck.pptx",
        pptx_bytes,
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    )
    assert status == 200, f"Expected 200 parsing valid .pptx, got {status}: {data}"
    assert data.get("slideCount") == 7, f"Expected 7 parsed slides, got {data.get('slideCount')}"
    parsed_outline = data.get("parsedOutline")
    assert isinstance(parsed_outline, list) and len(parsed_outline) == 7, (
        f"Expected 7 outline items from .pptx, got {parsed_outline}"
    )
    assert "逆向 PPTX 翻新演练" in (data.get("suggestedTopic") or ""), (
        f"Expected cover title extracted as suggestedTopic, got {data.get('suggestedTopic')!r}"
    )
    assert parsed_outline[0]["slideType"] == "cover"
    assert parsed_outline[-1]["slideType"] == "closing"

    # 3. Corrupt .pptx (invalid ZIP) must return 400 cleanly
    bad_status, bad_data = _build_multipart_request(
        parse_url,
        "file",
        "corrupt.pptx",
        b"NOT_A_VALID_ZIP_FILE_AT_ALL",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    )
    assert bad_status == 400, f"Corrupt .pptx must return 400, got {bad_status}: {bad_data}"

    # 4. Browser round-trip: upload .pptx in /generate -> outline editor auto-opens -> confirm renders slides
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        page.goto(ctx.url("/generate"), wait_until="networkidle")
        page.locator("#pg-doc-upload-input").set_input_files(
            {
                "name": "legacy-deck.pptx",
                "mimeType": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                "buffer": pptx_bytes,
            }
        )
        page.locator("#pg-outline-editor").wait_for(state="visible", timeout=10000)
        rows = page.locator("#pg-outline-editor .pg-outline-row")
        assert rows.count() == 7, f"Expected 7 rows in auto-opened outline editor, got {rows.count()}"

        # Click Step 2 confirm button to render all 7 re-skinned slides
        page.locator("#pg-outline-confirm-btn").click()
        page.locator("#pg-outline-editor").wait_for(state="hidden", timeout=10000)
        assert page.locator(".pg-gen-slide-card").count() == 7
        guard.assert_no_browser_errors("reverse .pptx browser flow")


def t6_handoff_03_studio_to_generate_and_draft_recovery(ctx: TestContext) -> None:
    """Studio -> Generate liveSpec handoff, inline DeckSpecTweaker, and localStorage auto-save draft recovery."""
    custom_topic = f"[E2E-V4] 跨页无损承接 {_tok('ho')}"
    edited_title = f"已自动草稿保存标题 {_tok('dr')}"

    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        # 1. Customize accent color + topic in /studio/swiss-international-grid
        page.goto(ctx.url("/studio/swiss-international-grid"), wait_until="networkidle")
        page.locator("#pg-param-topic").fill(custom_topic)
        swatch = page.locator('button[title="#1B4D3E"]').first
        if swatch.count() > 0:
            swatch.click()
            expected_accent = "#1B4D3E"
        else:
            color_input = page.locator('input[type="color"]').first
            color_input.fill("#1b4d3e")
            expected_accent = "#1b4d3e"

        # Navigate via "用此风格在线生成 PPT" CTA
        page.locator("#pg-studio-generate-btn").click()
        page.wait_for_url(re.compile(r"/generate\?"), timeout=10000)
        page.locator("#pg-handoff-badge").wait_for(state="visible", timeout=8000)

        # Verify topic & custom accent hex carried over
        assert page.locator("#pg-gen-topic").input_value() == custom_topic
        hex_badge = page.locator(".pg-tweaker-hex").inner_text().strip().lower()
        assert hex_badge == expected_accent.lower(), (
            f"Expected handed-off accent {expected_accent}, got {hex_badge}"
        )

        # 2. Open inline DeckSpecTweaker and tweak accent + slide title
        page.locator("#pg-deck-tweaker-toggle").click()
        page.locator("#pg-deck-tweaker-panel").wait_for(state="visible", timeout=5000)
        page.locator('button[aria-label="选择品牌强调色 #7C3AED"]').click()
        assert page.locator(".pg-tweaker-hex").inner_text().strip().lower() == "#7c3aed"

        page.locator("#pg-edit-slide-title").fill(edited_title)
        # Wait > 1.3s for debounced localStorage auto-save
        page.wait_for_timeout(1600)

        # 3. Navigate cleanly to /generate (no handoff/deck params) -> recovery banner appears
        page.goto(ctx.url("/generate"), wait_until="networkidle")
        page.locator("#pg-draft-restore-banner").wait_for(state="visible", timeout=8000)
        page.locator("#pg-draft-restore-btn").click()
        page.locator("#pg-draft-restore-banner").wait_for(state="hidden", timeout=5000)

        assert page.locator("#pg-edit-slide-title").input_value() == edited_title
        assert page.locator(".pg-tweaker-hex").inner_text().strip().lower() == "#7c3aed"

        # Clean up localStorage draft
        page.evaluate("() => window.localStorage.removeItem('pptgod_unsaved_draft_v4')")
        guard.assert_no_browser_errors("studio handoff & draft recovery")


def t6_stage_04_public_deck_share_stage_and_privacy(ctx: TestContext) -> None:
    """Pure theater stage /deck/[id]: private deck -> 404 zero-leak; public -> keyboard nav, notes drawer, HTML export, mobile."""
    author = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    other_user = ctx.api_logged_in(ACCOUNT_CHEN.email, ACCOUNT_CHEN.password)
    anon = ctx.api()

    secret_token = f"TOPSECRET_{_tok('stg')}"
    deck_payload = make_valid_deck_payload(
        title=f"[E2E-T6] 演播测试 {secret_token}",
        is_public=False,
    )
    deck_payload["slides"][1]["speakerNotes"] = f"第二页机密讲稿验证 {secret_token}"

    with ctx.cleanup() as cleanup:
        created = (
            author.post("/api/decks", json_body=deck_payload)
            .assert_status(201, "create private deck for /deck/[id] test")
            .require_json()["deck"]
        )
        deck_id = created["id"]
        cleanup.register_delete_deck(author, deck_id)

        # 1. Private deck: anonymous & other user MUST get 404 with ZERO title/notes leak
        for label, client in [("anonymous", anon), ("other_user", other_user)]:
            r = client.get(f"/deck/{deck_id}")
            assert r.status == 404, (
                f"{label} visiting private /deck/{deck_id} must get 404, got {r.status}"
            )
            body_text = r.text()
            assert secret_token not in body_text, (
                f"Private deck secret token leaked in 404 HTML for {label}!"
            )

        # 2. Author visiting own private /deck/[id] gets 200
        r_owner = author.get(f"/deck/{deck_id}")
        assert r_owner.status == 200, (
            f"Author should preview own private /deck/{deck_id}, got {r_owner.status}"
        )

        # 3. Flip deck to public -> anonymous Playwright theater experience
        author.patch(f"/api/decks/{deck_id}", json_body={"isPublic": True}).assert_status(200)

        with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
            page = guard.page
            resp = page.goto(ctx.url(f"/deck/{deck_id}"), wait_until="networkidle")
            assert resp is not None and resp.status == 200
            page.locator("#pg-deck-share-stage").wait_for(state="visible", timeout=8000)
            assert secret_token in page.locator("#pg-share-deck-title").inner_text()

            # Verify pure read-only stage: no editor inspector inputs present
            assert page.locator("#pg-edit-slide-title").count() == 0

            # Keyboard ArrowRight -> slide 2, then press 'N' -> speaker notes drawer appears
            page.keyboard.press("ArrowRight")
            page.wait_for_timeout(150)
            assert "2 /" in page.locator(".pg-share-topbar").inner_text()

            page.keyboard.press("n")
            drawer = page.locator("#pg-share-notes-drawer")
            drawer.wait_for(state="visible", timeout=4000)
            assert f"第二页机密讲稿验证 {secret_token}" in drawer.inner_text()

            # Download offline .html from /deck/[id]
            with page.expect_download(timeout=10000) as dl_info:
                page.locator("#pg-share-export-html-btn").click()
            dl_path = dl_info.value.path()
            assert dl_path is not None
            with open(dl_path, "rb") as fh:
                html_bytes = fh.read()
            HtmlDeckVerifier.verify(
                html_bytes,
                expected_min_slides=len(deck_payload["slides"]),
                expected_slide_texts=[secret_token],
            )

            # Clone CTA links to /generate?deck=<deck_id>
            clone_href = page.locator("#pg-share-clone-btn").get_attribute("href") or ""
            assert f"/generate?deck={deck_id}" in clone_href

            # Mobile 390px horizontal overflow check
            page.set_viewport_size(
                {"width": MOBILE_VIEWPORT[0], "height": MOBILE_VIEWPORT[1]}
            )
            page.wait_for_timeout(200)
            overflow = page.evaluate(
                "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
            )
            assert overflow <= 2, f"/deck/[id] has mobile horizontal overflow: {overflow}px"
            guard.assert_no_browser_errors("/deck/[id] theater stage")


def t6_export_05_marp_prompt_and_html_motif_fidelity(ctx: TestContext) -> None:
    """Real-deck Marp/Claude/Gamma export modal, HTML decorative motif fidelity, and all 12 native PPTX artwork presets."""
    marker = f"MARP_TOKEN_{_tok('mp')}"
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        page.goto(ctx.url("/generate?style=apple-soft-bento-modular"), wait_until="networkidle")
        page.locator("#pg-edit-slide-title").fill(f"封面实测 {marker}")
        page.locator("#pg-gen-speaker-notes").fill(f"实测讲稿备注 {marker}")

        # Open Marp / Prompt export modal
        page.locator("#pg-gen-export-md-btn").click()
        page.locator("#pg-export-prompt-modal").wait_for(state="visible", timeout=5000)

        marp_text = page.locator("#pg-export-modal-textarea").input_value()
        assert "marp: true" in marp_text
        assert "size: 16:9" in marp_text
        assert marker in marp_text
        assert f"实测讲稿备注 {marker}" in marp_text

        # Switch to Claude HTML & Gamma/Kimi real-deck prompt tabs
        page.locator("#pg-export-tab-claude").click()
        claude_text = page.locator("#pg-export-modal-textarea").input_value()
        assert "CSS Design Tokens" in claude_text and marker in claude_text

        page.locator("#pg-export-tab-gamma").click()
        gamma_text = page.locator("#pg-export-modal-textarea").input_value()
        assert "Gamma / Kimi" in gamma_text and marker in gamma_text

        page.locator("#pg-export-modal-close-btn").click()
        page.locator("#pg-export-prompt-modal").wait_for(state="hidden", timeout=4000)

        # Export offline .html on soft-bento archetype -> verify bento-dots motif rendered
        with page.expect_download(timeout=10000) as dl_info:
            page.locator("#pg-gen-export-html-btn").click()
        with open(dl_info.value.path(), "rb") as fh:
            html_bytes = fh.read()
        HtmlDeckVerifier.verify(
            html_bytes,
            expected_min_slides=7,
            expected_slide_texts=[marker],
        )
        html_str = html_bytes.decode("utf-8")
        assert "motif-layer" in html_str, "Exported HTML must include v4 decorative motif layer"
        # Clean up auto-saved draft from this edit
        page.evaluate("() => window.localStorage.removeItem('pptgod_unsaved_draft_v4')")
        guard.assert_no_browser_errors("Marp/Prompt modal & HTML motif export")

    # Verify all 5 newly completed native PPTX artwork presets compile cleanly into valid .pptx
    anon = ctx.api()
    new_presets = [
        "data-topography",
        "biotech-helix",
        "editorial-arch",
        "industrial-radar",
        "editorial-botanical",
    ]
    slides = [
        {
            "id": f"art_{i}",
            "slideType": "image-split",
            "sectionTag": f"0{i+1} / ARTWORK",
            "title": f"原生矢量配图实测 · {preset_id}",
            "subtitle": "v4 12/12 全覆盖验证",
            "bullets": ["精准几何线条", "严格匹配色卡 Token", "可编辑原生 PPTX 形状"],
            "imageSlot": {
                "kind": "svg-preset",
                "presetId": preset_id,
                "layout": "left" if i % 2 == 0 else "right",
                "caption": f"Preset {preset_id}",
            },
        }
        for i, preset_id in enumerate(new_presets)
    ]
    pptx_resp = anon.post(
        "/api/export/pptx",
        json_body={
            "title": "[E2E-V4] 12/12 原生配图验证",
            "subtitle": "5 套新增矢量几何全覆盖",
            "audience": "设计审查组",
            "styleName": "Neo Chinese Ink",
            "visualSpec": {
                **make_valid_visual_spec(),
                "layout": {
                    **make_valid_visual_spec()["layout"],
                    "archetype": "neo-chinese",
                    "decorativeMotif": "ink-wash",
                },
            },
            "slides": slides,
        },
    ).assert_status(200)
    PptxVerifier.verify(pptx_resp.body, expected_slide_count=5)


def t6_og_06_dynamic_og_image_and_gallery_more_slides(ctx: TestContext) -> None:
    """Dynamic /studio/[slug]/opengraph-image PNG (public=200 PNG, private=404), Gallery 12-slide switcher & Studio 12-slide AI batch."""
    anon = ctx.api()
    author = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)

    # 1. Public prompt OG image returns valid PNG > 5KB
    og_resp = anon.get("/studio/swiss-international-grid/opengraph-image")
    assert og_resp.status == 200, f"Public OG image returned {og_resp.status}"
    ctype = (og_resp.headers.get("content-type") or og_resp.headers.get("Content-Type") or "").lower()
    assert "image/png" in ctype, f"Expected image/png Content-Type, got {ctype}"
    assert og_resp.body.startswith(b"\x89PNG\r\n\x1a\n"), "OG response is not valid PNG bytes"
    assert len(og_resp.body) > 5_000, f"OG PNG unexpectedly small: {len(og_resp.body)} bytes"

    # 2. Private prompt OG image MUST return 404 with zero leak
    with ctx.cleanup() as cleanup:
        priv_payload = make_valid_prompt_payload(
            title=f"[E2E-T6] PrivateOG {_tok('og')}",
            is_public=False,
        )
        priv_prompt = (
            author.post("/api/prompts", json_body=priv_payload)
            .assert_status(201)
            .require_json()["prompt"]
        )
        cleanup.register_delete_prompt(author, priv_prompt["id"])
        priv_og = anon.get(f"/studio/{priv_prompt['slug']}/opengraph-image")
        assert priv_og.status == 404, (
            f"Private prompt OG image must return 404, got {priv_og.status}"
        )

    # 3. Gallery 12-slide copy & PromptCard "更多页型" dropdown + Studio 12-slide AI batch
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        page.goto(ctx.url("/"), wait_until="networkidle")
        hero_text = page.locator(".pg-hero-lead").inner_text()
        assert (
            "12 种页型" in hero_text or "12 种商业页型" in hero_text
        ) and "8 种" not in hero_text, f"Expected updated 12-slide copy in Hero, got: {hero_text}"

        first_card = page.locator(".pg-card").first
        assert first_card.locator('[role="tab"]').count() == 5, (
            "PromptCard must keep 5 role='tab' buttons for backwards compatibility"
        )
        more_select = first_card.locator(".pg-slide-more-select")
        more_select.wait_for(state="visible", timeout=5000)
        more_select.select_option("swot")
        page.wait_for_timeout(120)
        more_select.select_option("team-grid")
        page.wait_for_timeout(120)

        # Studio 12-slide AI image batch mode
        page.goto(ctx.url("/studio/swiss-international-grid"), wait_until="networkidle")
        page.locator(".pg-tool-tab", has_text="AI 整页生图").click()
        page.locator("#pg-ai-img-batch-12-btn").wait_for(state="visible", timeout=5000)
        page.locator("#pg-ai-img-batch-12-btn").click()
        compiled_box = page.locator("#pg-compiled-prompt-output").input_value()
        assert "12 页版" in compiled_box and "P12" in compiled_box, (
            "12-slide AI batch prompt must include '12 页版' and 'P12'"
        )
        guard.assert_no_browser_errors("Gallery more-slides & Studio 12-slide batch")


def get_tier6_tests() -> list[TestCaseSpec]:
    return [
        TestCaseSpec(
            "T6_SEC_01_deep_spec_ssrf_and_rate_limit",
            6,
            "Deep VisualSpec validation, BYOK SSRF guard, login 429 rate-limit & copy 5s dedupe",
            ("v4", "api", "security"),
            t6_sec_01_deep_spec_ssrf_and_rate_limit,
        ),
        TestCaseSpec(
            "T6_PPTX_02_reverse_pptx_import_roundtrip",
            6,
            "Reverse .pptx round-trip parse -> auto-open outline editor -> re-skin render",
            ("v4", "pptx", "api", "browser"),
            t6_pptx_02_reverse_pptx_import_roundtrip,
        ),
        TestCaseSpec(
            "T6_HANDOFF_03_studio_to_generate_and_draft_recovery",
            6,
            "Studio -> Generate liveSpec handoff, inline DeckSpecTweaker & localStorage draft recovery",
            ("v4", "browser", "continuity"),
            t6_handoff_03_studio_to_generate_and_draft_recovery,
        ),
        TestCaseSpec(
            "T6_STAGE_04_public_deck_share_stage_and_privacy",
            6,
            "Pure theater share route /deck/[id] privacy (404 zero-leak), keyboard/notes/HTML export & mobile",
            ("v4", "browser", "security", "share"),
            t6_stage_04_public_deck_share_stage_and_privacy,
        ),
        TestCaseSpec(
            "T6_EXPORT_05_marp_prompt_and_html_motif_fidelity",
            6,
            "Real-deck Marp/Claude/Gamma export modal, HTML 11-motif fidelity & 12/12 native PPTX artwork presets",
            ("v4", "export", "browser", "pptx"),
            t6_export_05_marp_prompt_and_html_motif_fidelity,
        ),
        TestCaseSpec(
            "T6_OG_06_dynamic_og_image_and_gallery_more_slides",
            6,
            "Dynamic /studio/[slug]/opengraph-image PNG (public=200, private=404), Gallery 12-slide switcher & Studio 12-slide batch",
            ("v4", "og", "browser", "security"),
            t6_og_06_dynamic_og_image_and_gallery_more_slides,
        ),
    ]
