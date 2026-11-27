"""Tier 2 — Boundaries, Validation, Error Recovery & Honest Boundaries (B1–B16).

Implements:
- Tier 2A: API, upload, BYOK SSRF/mock/scrub, schema & export boundaries (`G2_API_01..12`)
- Tier 2B: Browser UI boundary, empty-state, overflow & guard tests (`G2_UI_01..11`)
- Tier 2C: Dedicated 1-to-1 Honest-Boundary Anti-Fake suite (`G2_HONEST_01..16`)
"""

from __future__ import annotations

import json
import re
import time
from typing import Any

from .config import (
    ACCOUNT_DEMO,
    COMPARE_STORAGE_KEY,
    CORRUPT_PPTX_BYTES,
    DOMAIN_EXPECTED_COUNTS,
    HONEST_BOUNDARY_FORBIDDEN_PATTERNS,
    MALWARE_EXE_BYTES,
    PPTX_CONTENT_TYPE,
    SLIDE_TYPES,
    build_empty_bytes,
    build_legacy_doc_bytes,
    build_oversized_bytes,
    build_png_bytes,
    build_scanned_pdf_bytes,
    make_12_slide_deck,
    make_valid_deck_payload,
    make_valid_prompt_payload,
    make_valid_slides,
    make_valid_visual_spec,
    unique_token,
)
from .helpers import (
    DelayedFetchProbe,
    MockOpenAIServer,
    PptxVerifier,
    TestContext,
    TestSpec,
    assert_any_visible,
    click_resilient,
    ensure_editor_ready,
    fill_resilient,
    locate_attached,
    locate_first,
    login_via_api,
)

# ---------------------------------------------------------------------------
# Tier 2A — API, Upload, BYOK & Export Boundaries (G2_API_01 .. G2_API_12)
# ---------------------------------------------------------------------------


def g2_api_01_upload_oversized(ctx: TestContext) -> None:
    resp = ctx.api().post_multipart(
        "/api/parse-document",
        filename="oversize_10_5mb.txt",
        content=build_oversized_bytes(),
        content_type="text/plain",
        timeout_ms=max(ctx.timeout_ms, 20000),
    )
    resp.assert_status(400, "POST /api/parse-document >10MB")
    err = str((resp.json_data or {}).get("error") or resp.text())
    assert re.search(r"10\s*MB", err, re.I), f"Expected 10MB limit message, got {err!r}"


def g2_api_02_upload_forbidden_and_empty(ctx: TestContext) -> None:
    api = ctx.api()
    cases = [
        ("legacy_report.doc", build_legacy_doc_bytes(), "application/msword", r"\.docx"),
        ("diagram.png", build_png_bytes(16, 16), "image/png", r"不支持|仅支持"),
        ("payload.exe", MALWARE_EXE_BYTES, "application/octet-stream", r"不支持|仅支持"),
        ("empty.txt", build_empty_bytes(), "text/plain", r"为空|empty"),
        ("corrupt.pptx", CORRUPT_PPTX_BYTES, PPTX_CONTENT_TYPE, r"PPTX|解析失败|损坏"),
    ]
    for filename, raw, mime, expected_pat in cases:
        resp = api.post_multipart(
            "/api/parse-document",
            filename=filename,
            content=raw,
            content_type=mime,
        )
        resp.assert_status(400, f"Forbidden/empty upload {filename}")
        err = str((resp.json_data or {}).get("error") or resp.text())
        assert re.search(expected_pat, err, re.I), (
            f"Upload {filename} error did not match /{expected_pat}/: {err!r}"
        )


def g2_api_03_upload_scanned_pdf(ctx: TestContext) -> None:
    resp = ctx.api().post_multipart(
        "/api/parse-document",
        filename="scanned_image_only.pdf",
        content=build_scanned_pdf_bytes(),
        content_type="application/pdf",
    )
    assert resp.status in (200, 400), f"Scanned PDF crashed with HTTP {resp.status}: {resp.text()[:300]}"
    data = resp.require_json("scanned PDF parse")
    if resp.status == 200:
        assert data.get("isScannedPdf") is True, f"Expected isScannedPdf=True, got {data!r}"
        warning = str(data.get("warning") or "")
        assert "扫描" in warning or len(warning) >= 10, f"Expected helpful scan warning, got {warning!r}"
    else:
        assert data.get("error"), f"400 response missing error guidance: {data!r}"


def g2_api_04_prompt_and_comment_validation(ctx: TestContext) -> None:
    demo = ctx.api_logged_in(ACCOUNT_DEMO)
    with ctx.cleanup() as cleanup:
        # Invalid POST /api/prompts cases -> all 400
        bad_prompts: list[tuple[str, dict[str, Any]]] = []

        p1 = make_valid_prompt_payload()
        p1["title"] = ""
        bad_prompts.append(("empty title", p1))

        p2 = make_valid_prompt_payload()
        p2["title"] = "A"
        bad_prompts.append(("1-char title", p2))

        p3 = make_valid_prompt_payload()
        p3["title"] = "超" * 61
        bad_prompts.append((">60-char title", p3))

        p4 = make_valid_prompt_payload()
        p4["summary"] = "太短了"
        bad_prompts.append(("<8-char summary", p4))

        p5 = make_valid_prompt_payload()
        del p5["promptAnatomy"]["layout"]
        bad_prompts.append(("missing promptAnatomy.layout", p5))

        p6 = make_valid_prompt_payload()
        p6["visualSpec"]["palette"]["bg"] = "not-a-color"
        bad_prompts.append(("invalid palette hex", p6))

        p7 = make_valid_prompt_payload()
        p7["visualSpec"]["layout"]["archetype"] = "nonexistent-archetype"
        bad_prompts.append(("invalid layout archetype", p7))

        for label, payload in bad_prompts:
            demo.post("/api/prompts", json_body=payload).assert_status(400, f"POST /api/prompts {label}")

        # Comment validation boundaries
        pid = "prompt_swiss_grid"
        demo.post(
            f"/api/prompts/{pid}/comments",
            json_body={"content": "太短", "testedTool": "claude-html", "rating": 5},
        ).assert_status(400, "comment <4 chars")

        demo.post(
            f"/api/prompts/{pid}/comments",
            json_body={"content": "测" * 501, "testedTool": "claude-html", "rating": 5},
        ).assert_status(400, "comment >500 chars")

        # Out-of-range rating -> either clamped to [1, 5] on 201 or rejected with 400
        for bad_rating in (0, 99):
            tok = unique_token("RAT")
            content = f"[E2E] 评分边界校验测试 ({tok})"
            r = demo.post(
                f"/api/prompts/{pid}/comments",
                json_body={"content": content, "testedTool": "claude-html", "rating": bad_rating},
            )
            assert r.status in (201, 400), f"rating={bad_rating} returned unexpected HTTP {r.status}"
            if r.status == 201:
                comments = r.require_json()["comments"]
                created = next((c for c in comments if c.get("content") == content), None)
                assert created is not None
                cleanup.register_delete_comment(demo, pid, created["id"])
                assert 1 <= int(created["rating"]) <= 5, (
                    f"rating={bad_rating} was not clamped to [1,5]: got {created['rating']}"
                )


def g2_api_05_generate_and_outline_bounds(ctx: TestContext) -> None:
    api = ctx.api()
    # Empty topic -> 400
    api.post("/api/generate", json_body={"topic": "", "mode": "smart"}).assert_status(400, "generate empty topic")
    api.post("/api/outline", json_body={"topic": "   ", "mode": "smart"}).assert_status(400, "outline empty topic")

    # Clamp lower bound (2 -> 5) & upper bound (99 -> 20)
    r_low = api.post(
        "/api/outline",
        json_body={"topic": "边界页数测试", "slideCount": 2, "mode": "smart"},
    ).assert_status(200)
    assert len(r_low.require_json()["outline"]) == 5, "slideCount=2 should clamp to 5"

    r_high = api.post(
        "/api/outline",
        json_body={"topic": "边界页数测试", "slideCount": 99, "mode": "smart"},
    ).assert_status(200)
    assert len(r_high.require_json()["outline"]) == 20, "slideCount=99 should clamp to 20"

    # Generate with empty sourceText succeeds cleanly
    r_gen_low = api.post(
        "/api/generate",
        json_body={"topic": "空源文本兜底生成", "sourceText": "", "slideCount": 2, "mode": "smart"},
    ).assert_status(200)
    assert len(r_gen_low.require_json()["slides"]) == 5

    r_gen_high = api.post(
        "/api/generate",
        json_body={"topic": "最大页数上限测试", "sourceText": "", "slideCount": 99, "mode": "smart"},
    ).assert_status(200)
    assert len(r_gen_high.require_json()["slides"]) == 20


def g2_api_06_byok_ssrf_protection(ctx: TestContext) -> None:
    api = ctx.api()
    ssrf_urls = (
        "http://169.254.169.254/latest/meta-data/",
        "http://metadata.google.internal/computeMetadata/v1/",
        "http://10.0.0.1/v1",
        "http://192.168.1.1/v1",
        "http://172.16.0.1/v1",
        "http://user:pass@example.com/v1",
        "file:///etc/passwd",
        "http://0xa9fea9fe/v1",
    )
    sample_slide = make_valid_slides(2)[0]
    for bad_url in ssrf_urls:
        api.post(
            "/api/generate",
            json_body={
                "topic": "SSRF Test",
                "mode": "llm",
                "apiKey": "sk-ssrf-test",
                "apiBase": bad_url,
            },
        ).assert_status(400, f"/api/generate SSRF {bad_url}")

        api.post(
            "/api/outline",
            json_body={
                "topic": "SSRF Test",
                "mode": "llm",
                "apiKey": "sk-ssrf-test",
                "apiBase": bad_url,
            },
        ).assert_status(400, f"/api/outline SSRF {bad_url}")

        api.post(
            "/api/polish",
            json_body={
                "slide": sample_slide,
                "action": "executive",
                "mode": "llm",
                "apiKey": "sk-ssrf-test",
                "apiBase": bad_url,
            },
        ).assert_status(400, f"/api/polish SSRF {bad_url}")

        api.post(
            "/api/generate-image",
            json_body={
                "prompt": "clean minimal glacier architectural diagram",
                "apiKey": "sk-ssrf-test",
                "apiBase": bad_url,
            },
        ).assert_status(400, f"/api/generate-image SSRF {bad_url}")


def g2_api_07_byok_mock_llm_and_key_scrub(ctx: TestContext) -> None:
    api = ctx.api()
    # 1. Missing apiKey -> 400
    api.post(
        "/api/generate",
        json_body={"topic": "Missing key test", "mode": "llm", "apiKey": ""},
    ).assert_status(400, "LLM missing apiKey")

    canary = f"sk-glacier-canary-{unique_token('KEY')}"

    # 2. Valid JSON response -> 200 + Bearer header forwarded + key NOT echoed
    with MockOpenAIServer(mode="valid_json", expected_api_key=canary) as mock:
        resp = api.post(
            "/api/generate",
            json_body={
                "topic": "BYOK Mock Happy Path",
                "mode": "llm",
                "apiKey": canary,
                "apiBase": mock.base_url,
                "model": "gpt-4o-mini",
            },
        ).assert_status(200, "BYOK valid_json")
        data = resp.require_json()
        assert data.get("engine") == "llm"
        assert len(data.get("slides") or []) >= 2
        assert len(mock.requests) == 1
        assert mock.requests[0].authorization == f"Bearer {canary}"
        assert canary not in resp.text(), "CRITICAL: BYOK apiKey echoed in 200 response!"
        assert canary not in json.dumps(resp.headers), "CRITICAL: BYOK apiKey echoed in headers!"

    # 3. Fenced ```json response -> 200
    with MockOpenAIServer(mode="fenced_json", expected_api_key=canary) as mock:
        resp = api.post(
            "/api/generate",
            json_body={
                "topic": "BYOK Fenced JSON",
                "mode": "llm",
                "apiKey": canary,
                "apiBase": mock.base_url,
            },
        ).assert_status(200, "BYOK fenced_json")
        assert resp.require_json().get("engine") == "llm"

    # 4. Upstream HTTP 500 echoing Bearer token -> 502 with canary scrubbed!
    with MockOpenAIServer(mode="http_500", expected_api_key=canary, echo_auth_on_error=True) as mock:
        resp = api.post(
            "/api/generate",
            json_body={
                "topic": "BYOK 500 Scrub",
                "mode": "llm",
                "apiKey": canary,
                "apiBase": mock.base_url,
            },
        ).assert_status(502, "BYOK upstream 500")
        assert canary not in resp.text(), (
            f"CRITICAL: Upstream 500 leaked BYOK canary in 502 body: {resp.text()[:300]}"
        )

    # 5. Malformed non-JSON upstream response -> 502 with canary scrubbed!
    with MockOpenAIServer(mode="malformed_text", expected_api_key=canary, echo_auth_on_error=True) as mock:
        resp = api.post(
            "/api/generate",
            json_body={
                "topic": "BYOK malformed",
                "mode": "llm",
                "apiKey": canary,
                "apiBase": mock.base_url,
            },
        ).assert_status(502, "BYOK malformed JSON")
        assert canary not in resp.text(), "CRITICAL: Malformed error leaked BYOK canary!"


def g2_api_08_decks_patch_vs_put_contract(ctx: TestContext) -> None:
    demo = ctx.api_logged_in(ACCOUNT_DEMO)
    with ctx.cleanup() as cleanup:
        payload = make_valid_deck_payload(is_public=False)
        deck_id = demo.post("/api/decks", json_body=payload).assert_status(201).require_json()["deck"]["id"]
        cleanup.register_delete_deck(demo, deck_id)

        # PATCH strictly accepts { isPublic: boolean } only
        demo.patch(f"/api/decks/{deck_id}", json_body={}).assert_status(400, "PATCH {}")
        demo.patch(f"/api/decks/{deck_id}", json_body={"title": "Attempt Rename via PATCH"}).assert_status(
            400, "PATCH title only"
        )
        demo.patch(f"/api/decks/{deck_id}", json_body={"isPublic": "true"}).assert_status(
            400, "PATCH non-boolean isPublic"
        )

        # PUT missing required visualSpec or slides -> 400
        demo.put(f"/api/decks/{deck_id}", json_body={"title": "Missing spec"}).assert_status(
            400, "PUT missing visualSpec/slides"
        )

        # Valid full PUT updates title
        full_put = dict(payload)
        full_put["title"] = f"[E2E-PUT] 完整更新标题 {unique_token('P')}"
        r_ok = demo.put(f"/api/decks/{deck_id}", json_body=full_put).assert_status(200, "PUT full deck")
        assert r_ok.require_json()["deck"]["title"] == full_put["title"]


def g2_api_09_polish_strict_action_enum(ctx: TestContext) -> None:
    api = ctx.api()
    slide = make_valid_slides(2)[0]
    for bad_action in ("chat", "freeform", "rewrite", "", None):
        api.post(
            "/api/polish",
            json_body={"slide": slide, "action": bad_action, "mode": "smart"},
        ).assert_status(400, f"/api/polish action={bad_action!r}")
    api.post("/api/polish", json_body={"action": "executive"}).assert_status(400, "/api/polish missing slide")


def g2_api_10_export_pptx_corner_cases(ctx: TestContext) -> None:
    api = ctx.api()
    # (a) Empty bars[] on data slide
    resp_empty_bars = api.post(
        "/api/export/pptx",
        json_body={
            "title": "Empty Bars Check",
            "visualSpec": make_valid_visual_spec(dark=False),
            "slides": make_valid_slides(4, empty_bars=True),
        },
    )
    PptxVerifier.verify_response(resp_empty_bars, min_size=15000, expected_slide_count=4)

    # (b) Dark Obsidian RGBA border/accentSoft compositing
    resp_dark = api.post(
        "/api/export/pptx",
        json_body={
            "title": "Dark Obsidian RGBA",
            "visualSpec": make_valid_visual_spec(dark=True),
            "slides": make_valid_slides(4),
        },
    )
    PptxVerifier.verify_response(
        resp_dark,
        min_size=15000,
        expected_slide_count=4,
        disallow_pure_white_borders=True,
    )

    # (c) Special CJK + slash + quotes title -> RFC 5987 Content-Disposition
    special_title = "2026 Q4/战略复盘：AI「核心」增长 & 100%"
    resp_cjk = api.post(
        "/api/export/pptx",
        json_body={
            "title": special_title,
            "visualSpec": make_valid_visual_spec(dark=False),
            "slides": make_valid_slides(4, custom_title=special_title),
        },
    )
    PptxVerifier.verify_response(
        resp_cjk,
        min_size=15000,
        expected_slide_count=4,
        require_rfc5987_disposition=True,
        expected_slide_texts=(special_title,),
    )

    # (d) Empty slides or missing visualSpec -> 400
    api.post(
        "/api/export/pptx",
        json_body={"title": "Empty", "visualSpec": make_valid_visual_spec(), "slides": []},
    ).assert_status(400, "export slides=[]")
    api.post(
        "/api/export/pptx",
        json_body={"title": "No spec", "slides": make_valid_slides(2)},
    ).assert_status(400, "export missing visualSpec")


def g2_api_11_auth_and_routing_guards(ctx: TestContext) -> None:
    anon = ctx.api()
    # Unauthenticated mutations -> 401
    anon.post("/api/prompts", json_body=make_valid_prompt_payload()).assert_status(401, "unauth POST /api/prompts")
    anon.put("/api/prompts/prompt_soft_bento", json_body=make_valid_prompt_payload()).assert_status(401, "unauth PUT prompt")
    anon.patch("/api/prompts/prompt_soft_bento", json_body={"isPublic": False}).assert_status(401, "unauth PATCH prompt")
    anon.delete("/api/prompts/prompt_soft_bento").assert_status(401, "unauth DELETE prompt")
    anon.post("/api/prompts/prompt_soft_bento/like").assert_status(401, "unauth like")
    anon.post("/api/prompts/prompt_soft_bento/favorite").assert_status(401, "unauth favorite")
    anon.post("/api/prompts/prompt_soft_bento/comments", json_body={"content": "hello world"}).assert_status(401, "unauth comment")
    anon.post("/api/prompts/sync-favorites", json_body={"promptIds": ["prompt_soft_bento"]}).assert_status(401, "unauth sync-favorites")
    anon.patch("/api/auth/profile", json_body={"displayName": "Hacker"}).assert_status(401, "unauth profile")
    anon.post("/api/decks", json_body=make_valid_deck_payload()).assert_status(401, "unauth POST /api/decks")
    anon.patch("/api/decks/deck_nonexistent", json_body={"isPublic": True}).assert_status(401, "unauth PATCH deck")
    anon.put("/api/decks/deck_nonexistent", json_body=make_valid_deck_payload()).assert_status(401, "unauth PUT deck")
    anon.delete("/api/decks/deck_nonexistent").assert_status(401, "unauth DELETE deck")

    # Nonexistent resources -> 404
    anon.get("/api/prompts/nonexistent-glacier-slug-xyz").assert_status(404, "nonexistent prompt")
    anon.get("/api/creators/nonexistent_glacier_user_xyz").assert_status(404, "nonexistent creator")

    # Duplicate email registration (seeded demo account -> 409, zero DB rows added!)
    anon.post(
        "/api/auth/register",
        json_body={
            "displayName": "Duplicate Check",
            "email": ACCOUNT_DEMO.email,
            "password": "Password123!",
        },
    ).assert_status(409, "duplicate register demo@pptgod.studio")


def g2_api_12_deck_slide_and_image_caps(ctx: TestContext) -> None:
    demo = ctx.api_logged_in(ACCOUNT_DEMO)
    # 51 slides -> 400
    too_many = [make_valid_slides(2)[0] for _ in range(51)]
    demo.post(
        "/api/decks",
        json_body=make_valid_deck_payload(slides=too_many),
    ).assert_status(400, "POST /api/decks >50 slides")

    # Forbidden SVG data URL -> 400
    svg_slides = make_12_slide_deck()[:4]
    svg_slides[3]["imageSlot"] = {
        "kind": "data-url",
        "dataUrl": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
        "caption": "SVG blocked",
    }
    demo.post(
        "/api/decks",
        json_body=make_valid_deck_payload(slides=svg_slides),
    ).assert_status(400, "POST /api/decks SVG dataUrl")

    # Oversized >650k char image data URL -> 400
    huge_slides = make_12_slide_deck()[:4]
    huge_slides[3]["imageSlot"] = {
        "kind": "data-url",
        "dataUrl": "data:image/png;base64," + ("A" * 660_000),
        "caption": "Oversized image",
    }
    demo.post(
        "/api/decks",
        json_body=make_valid_deck_payload(slides=huge_slides),
    ).assert_status(400, "POST /api/decks >650k dataUrl")


# ---------------------------------------------------------------------------
# Tier 2B — Browser UI Boundaries, Empty States & Guards (G2_UI_01 .. G2_UI_11)
# ---------------------------------------------------------------------------


def g2_ui_01_upload_errors_preserve_draft(ctx: TestContext) -> None:
    draft_topic = "保留草稿验证主题"
    invalid_files = [
        ("legacy.doc", "application/msword", build_legacy_doc_bytes(), r"docx|旧版|不支持"),
        ("chart.png", "image/png", build_png_bytes(16, 16), r"不支持|仅支持|格式"),
        ("empty.txt", "text/plain", build_empty_bytes(), r"为空|空文件"),
        ("huge_10_5mb.txt", "text/plain", build_oversized_bytes(), r"10\s*MB|上限|超过"),
    ]

    alert_sel = (
        '[role="alert"], .gl-toast, .pg-toast, .gl-upload-error, '
        '.gl-upload-file-card--error, .gl-upload-file-status.is-error, '
        '[data-upload-error], .pg-form-error, .is-error'
    )

    def _snapshot_dom_state(page: Any) -> tuple[set[str], list[str]]:
        res = page.evaluate(
            """(sel) => {
              const lines = (document.body ? document.body.innerText : '')
                .split(/\\r?\\n/)
                .map((l) => l.trim())
                .filter(Boolean);
              const alerts = Array.from(document.querySelectorAll(sel))
                .filter((el) => {
                  const cs = getComputedStyle(el);
                  return cs.display !== 'none' && cs.visibility !== 'hidden';
                })
                .map((el) => (el.innerText || '').trim())
                .filter(Boolean);
              return { lines, alerts };
            }""",
            alert_sel,
        )
        return set(res["lines"]), list(res["alerts"])

    with ctx.browser_page() as guard:
        for route in ("/", "/generate"):
            guard.goto_ok(f"{ctx.base_url}{route}")
            page = guard.page
            topic_input = locate_first(
                page,
                [
                    "#pg-gen-topic",
                    lambda p: p.get_by_placeholder(re.compile(r"描述你|演示主题|输入.*主题", re.I)),
                    "main textarea",
                ],
                description=f"Topic textarea on {route}",
            )
            topic_input.fill(draft_topic)
            file_input = locate_attached(
                page,
                ["#pg-doc-upload-input", 'main input[type="file"]'],
                description=f"Upload file input on {route}",
            )

            with guard.allow_expected_http_errors({400}):
                for fname, mime, raw, err_pat in invalid_files:
                    pre_lines, pre_alerts = _snapshot_dom_state(page)
                    pre_alert_set = set(pre_alerts)
                    file_input.set_input_files({"name": fname, "mimeType": mime, "buffer": raw})

                    # Poll up to 3000ms for newly surfaced alert/error text (NEVER match static B8 hint!)
                    deadline = time.monotonic() + 3.0
                    new_feedback = ""
                    while True:
                        post_lines, post_alerts = _snapshot_dom_state(page)
                        new_alerts = [a for a in post_alerts if a not in pre_alert_set]
                        added_lines = [ln for ln in post_lines if ln not in pre_lines]
                        new_feedback = "\n".join(new_alerts + added_lines).strip()
                        if new_feedback and (
                            re.search(err_pat, new_feedback, re.I) or "上传成功" in new_feedback
                        ):
                            break
                        if time.monotonic() >= deadline:
                            break
                        page.wait_for_timeout(100)

                    assert new_feedback, (
                        f"Route {route}: uploading invalid {fname} surfaced ZERO new error/alert feedback!"
                    )
                    assert "上传成功" not in new_feedback, (
                        f"Route {route}: uploading invalid {fname} was wrongly accepted: {new_feedback!r}"
                    )
                    assert re.search(err_pat, new_feedback, re.I), (
                        f"Route {route}: uploading invalid {fname} new feedback did not match /{err_pat}/: {new_feedback!r}"
                    )
                    assert topic_input.input_value() == draft_topic, (
                        f"Route {route}: uploading invalid {fname} wiped user draft topic!"
                    )

        guard.assert_no_browser_errors("G2_UI_01")


def g2_ui_02_scanned_pdf_warning_preserves_draft(ctx: TestContext) -> None:
    draft = "钙钛矿草稿保留"
    with ctx.browser_page() as guard:
        guard.goto_ok(f"{ctx.base_url}/generate")
        page = guard.page
        topic_input = locate_first(
            page,
            ["#pg-gen-topic", "main textarea"],
            description="Workshop topic textarea",
        )
        topic_input.fill(draft)
        file_input = locate_attached(
            page,
            ["#pg-doc-upload-input", 'main input[type="file"]'],
            description="Workshop file input",
        )
        with guard.allow_expected_http_errors({400}):
            with page.expect_response(
                lambda r: "/api/parse-document" in r.url and r.request.method == "POST",
                timeout=ctx.timeout_ms,
            ) as parse_resp:
                file_input.set_input_files(
                    {
                        "name": "scanned_paper.pdf",
                        "mimeType": "application/pdf",
                        "buffer": build_scanned_pdf_bytes(),
                    }
                )
            assert parse_resp.value.status in (200, 400), (
                f"Scanned PDF /api/parse-document returned unexpected HTTP {parse_resp.value.status}"
            )

        locate_first(
            page,
            [lambda p: p.get_by_text(re.compile(r"扫描|OCR|文字层|手动粘贴", re.I))],
            timeout_ms=6000,
            description="Scanned PDF manual-paste / OCR warning banner",
        )
        assert topic_input.input_value() == draft, "Scanned PDF warning wiped typed draft topic!"
        guard.assert_no_browser_errors("G2_UI_02")


def g2_ui_03_empty_topic_sample_fallback(ctx: TestContext) -> None:
    with ctx.browser_page() as guard:
        page = guard.page
        # 1. Dashboard /
        guard.goto_ok(f"{ctx.base_url}/")
        ta = locate_first(page, ["main textarea"], description="Dashboard topic textarea")
        ta.fill("")
        page.wait_for_timeout(150)
        assert page.locator(".pg-slide-outer").count() >= 3
        first_txt = (page.locator(".pg-slide-outer").first.inner_text() or "").strip()
        assert len(first_txt) > 5, "Dashboard SlideCanvas went blank on empty topic"

        # 2. Workshop /generate (strict 示例预览|示例文稿, NOT bare 示例)
        guard.goto_ok(f"{ctx.base_url}/generate")
        gen_ta = locate_first(page, ["#pg-gen-topic", "main textarea"], description="Workshop textarea")
        gen_ta.fill("")
        page.wait_for_timeout(150)
        assert re.search(r"示例预览|示例文稿", guard.get_body_text()), (
            "Workshop missing strict '示例预览' / '示例文稿' fallback badge when topic is empty"
        )
        assert len((guard.find_primary_stage().inner_text() or "").strip()) > 5, (
            "Workshop preview canvas went blank when topic cleared"
        )

        # 3. Compare /compare — UNCONDITIONAL clear + non-blank canvases
        guard.goto_ok(f"{ctx.base_url}/compare")
        cmp_inp = locate_first(
            page,
            [
                "#pg-compare-topic-input",
                lambda p: p.locator("main").get_by_placeholder(re.compile(r"主题|输入.*内容", re.I)),
                'main input[type="text"]',
            ],
            description="Compare unified topic input",
        )
        cmp_inp.fill("")
        page.wait_for_timeout(150)
        assert re.search(r"示例", guard.get_body_text()), "/compare missing 示例 indicator on empty topic"
        cmp_canvases = page.locator("main .pg-slide-outer")
        assert cmp_canvases.count() >= 2, f"/compare expected >= 2 canvases, got {cmp_canvases.count()}"
        for i in range(min(cmp_canvases.count(), 3)):
            assert len((cmp_canvases.nth(i).inner_text() or "").strip()) > 5, (
                f"/compare canvas #{i + 1} went blank when topic cleared"
            )

        guard.assert_no_browser_errors("G2_UI_03")


def g2_ui_04_zero_result_search_and_clear_filters(ctx: TestContext) -> None:
    impossible_q = "ZZZ_NONEXISTENT_GLACIER_999"
    demo = ctx.api_logged_in(ACCOUNT_DEMO)
    with ctx.cleanup() as cleanup:
        tok = unique_token("SRCH")
        seeded_title = f"[E2E-SRCH] 检索清空测试 {tok}"
        deck_id = demo.post(
            "/api/decks",
            json_body=make_valid_deck_payload(title=seeded_title, is_public=False),
        ).assert_status(201).require_json()["deck"]["id"]
        cleanup.register_delete_deck(demo, deck_id)

        with ctx.browser_page() as guard:
            page = guard.page
            # 1. /gallery zero-result -> clear filters restores all 36 cards
            guard.goto_ok(f"{ctx.base_url}/gallery")
            search = fill_resilient(
                page,
                ["#pg-gallery-search", 'main input[type="search"]'],
                impossible_q,
                description="Gallery search input",
            )
            page.wait_for_timeout(250)
            assert page.locator("article[data-prompt-slug]").count() == 0, (
                "Expected 0 style cards for impossible search query"
            )
            assert search.input_value() == impossible_q, "Search input did not preserve impossible query"

            click_resilient(
                page,
                [
                    "#pg-reset-filters-btn",
                    lambda p: p.get_by_role("button", name=re.compile(r"清除筛选|重置筛选|清空筛选", re.I)),
                ],
                description="Gallery 清除筛选 button",
            )
            page.wait_for_timeout(250)
            assert page.locator("article[data-prompt-slug]").count() == 36, (
                "Clicking 清除筛选 did not restore all 36 style cards"
            )

            # 2. /collections seeded deck -> UNCONDITIONAL zero-match search -> reset restores deck
            login_via_api(page, ctx.base_url, ACCOUNT_DEMO)
            guard.goto_ok(f"{ctx.base_url}/collections")
            assert seeded_title in guard.get_body_text(), (
                f"Seeded deck {seeded_title!r} not visible on /collections before search"
            )
            col_search = fill_resilient(
                page,
                [
                    lambda p: p.locator("main").get_by_placeholder(re.compile(r"搜索.*项目|搜索.*文稿|搜索", re.I)),
                    'main input[type="search"]',
                    'main input[placeholder*="搜索"]',
                ],
                impossible_q,
                description="/collections search input",
            )
            page.wait_for_timeout(200)
            zero_body = guard.get_body_text()
            assert seeded_title not in zero_body, (
                "/collections search with impossible query failed to hide non-matching deck"
            )
            assert re.search(r"暂无|没有|未找到|无匹配|清除|清空", zero_body), (
                "/collections missing honest empty state for zero-match search"
            )

            # Reset search and verify seeded deck reappears
            clear_btn = page.locator("main").get_by_role("button", name=re.compile(r"清除|重置|清空"))
            if clear_btn.count() > 0 and clear_btn.first.is_visible():
                clear_btn.first.click()
            else:
                col_search.fill("")
            page.wait_for_timeout(200)
            assert seeded_title in guard.get_body_text(), (
                f"Resetting /collections search did not restore seeded deck {seeded_title!r}"
            )

            guard.assert_no_browser_errors("G2_UI_04")


def g2_ui_05_guest_vs_zero_deck_empty_states(ctx: TestContext) -> None:
    # 1. Guest context
    with ctx.browser_page() as guard:
        guard.goto_ok(f"{ctx.base_url}/")
        dash_text = guard.get_body_text()
        for fake in HONEST_BOUNDARY_FORBIDDEN_PATTERNS["B7"]["forbidden_recent_titles"]:
            assert fake not in dash_text, f"Guest Dashboard displays fake recent project {fake!r}"
        assert re.search(r"暂无|还没有|去创作|开始创作|新建|登录", dash_text), (
            "Guest Dashboard Recent Projects missing honest empty/create/login guidance"
        )

        guard.goto_ok(f"{ctx.base_url}/collections")
        guest_col_text = guard.get_body_text()
        assert re.search(r"登录|体验账号", guest_col_text), (
            "Guest /collections missing explicit login prompt"
        )
        guard.assert_no_browser_errors("G2_UI_05_guest")

    # 2. Authenticated user with 0 saved decks
    with ctx.browser_page() as guard:
        login_via_api(guard.page, ctx.base_url, ACCOUNT_DEMO)
        guard.goto_ok(f"{ctx.base_url}/collections")
        auth_col_text = guard.get_body_text()
        assert re.search(r"新建演示文稿|开始创作|去创作|新建演示", auth_col_text), (
            "Authenticated 0-deck /collections missing honest '+ 新建演示文稿' / '开始创作' CTA"
        )
        assert not re.search(r"请先登录|登录后查看|立即登录", auth_col_text), (
            "Authenticated 0-deck /collections still shows guest login-gate copy!"
        )
        guard.assert_no_browser_errors("G2_UI_05_auth")


def g2_ui_06_editor_last_slide_guard_and_12_type_safety(ctx: TestContext) -> None:
    with ctx.browser_page() as guard:
        ensure_editor_ready(guard, ctx.base_url)
        page = guard.page

        # Switch current slide across ALL 12 SLIDE_TYPES and verify zero NaN/Infinity in SVG geometry
        for stype in SLIDE_TYPES:
            ctl = locate_first(
                page,
                [f'[data-layout-chip="{stype}"]', "#pg-slide-type-select"],
                description=f"Layout switcher for slideType={stype}",
            )
            if str(ctl.evaluate("el => el.tagName")).upper() == "SELECT":
                ctl.select_option(stype)
            else:
                ctl.click()
            page.wait_for_timeout(70)

            nan_hits = page.evaluate(
                """() => {
                  const attrs = ['x','y','width','height','cx','cy','r','rx','ry','x1','y1','x2','y2','d','points','transform','viewBox'];
                  const bad = [];
                  for (const el of document.querySelectorAll('.pg-slide-outer svg, .pg-slide-outer svg *')) {
                    for (const a of attrs) {
                      const v = el.getAttribute(a);
                      if (v && /\\b(?:NaN|Infinity)\\b/.test(v)) bad.push(`${el.tagName}:${a}=${v}`);
                    }
                  }
                  return bad;
                }"""
            )
            assert not nan_hits, f"SVG NaN/Infinity detected after switching to {stype}: {nan_hits[:8]}"

        # Delete slides unconditionally down to 1 (NEVER silently break on missing delete button!)
        initial_cnt = guard.count_editor_tree_slides()
        assert initial_cnt >= 2, f"Expected >= 2 slides to test last-slide delete guard, got {initial_cnt}"

        delete_candidates = [
            '[data-slide-tree] button[aria-label*="删除"]',
            '.gl-slide-tree button[aria-label*="删除"]',
            '.pg-gen-slide-card button[aria-label*="删除"]',
            'button[title*="删除当前页"]',
            'button[aria-label*="删除当前页"]',
            lambda p: p.get_by_role("button", name=re.compile(r"删除.*页|删除幻灯片")),
        ]
        for _ in range(25):
            cnt = guard.count_editor_tree_slides()
            if cnt <= 1:
                break
            del_btn = locate_first(
                page,
                delete_candidates,
                timeout_ms=3000,
                description=f"Editor slide delete button while {cnt} slides remain",
            )
            assert not del_btn.is_disabled(), (
                f"Slide delete button unexpectedly disabled while {cnt} (> 1) slides still remain!"
            )
            del_btn.click(force=True)
            page.wait_for_timeout(120)
            after_cnt = guard.count_editor_tree_slides()
            assert after_cnt == cnt - 1, (
                f"Clicking slide delete button did not decrement count: before={cnt}, after={after_cnt}"
            )

        final_cnt = guard.count_editor_tree_slides()
        assert final_cnt == 1, (
            f"Expected deletion loop to reach exactly 1 slide for last-slide guard check, got {final_cnt}"
        )

        # At exactly 1 slide: delete button must be disabled/absent OR clicking it keeps count == 1
        del_at_one = page.locator(
            '[data-slide-tree] button[aria-label*="删除"], '
            '.gl-slide-tree button[aria-label*="删除"], '
            '.pg-gen-slide-card button[aria-label*="删除"], '
            'button[title*="删除当前页"], button[aria-label*="删除当前页"]'
        )
        if del_at_one.count() > 0 and del_at_one.first.is_visible() and not del_at_one.first.is_disabled():
            del_at_one.first.click(force=True)
            page.wait_for_timeout(120)
        assert guard.count_editor_tree_slides() == 1, "Last slide was deleted to 0!"

        guard.assert_no_browser_errors("G2_UI_06")


def g2_ui_07_long_cjk_clamping(ctx: TestContext) -> None:
    demo = ctx.api_logged_in(ACCOUNT_DEMO)
    long_title = "[E2E] 超长中文标题压力测试：面向多模态大模型知识引擎的企业级高并发架构演进与商业化落地全景复盘报告"
    prefix = long_title[:16]
    with ctx.cleanup() as cleanup:
        deck_id = demo.post(
            "/api/decks",
            json_body=make_valid_deck_payload(title=long_title, is_public=False),
        ).assert_status(201).require_json()["deck"]["id"]
        cleanup.register_delete_deck(demo, deck_id)

        with ctx.browser_page() as guard:
            login_via_api(guard.page, ctx.base_url, ACCOUNT_DEMO)
            page = guard.page
            for route in ("/collections", "/", f"/generate?deck={deck_id}"):
                guard.goto_ok(f"{ctx.base_url}{route}")
                body_and_vals = str(
                    page.evaluate(
                        """() => {
                          const body = document.body ? document.body.innerText : '';
                          const vals = Array.from(document.querySelectorAll('input, textarea'))
                            .map((i) => i.value || '').join('\\n');
                          return body + '\\n' + vals;
                        }"""
                    )
                )
                assert prefix in body_and_vals, (
                    f"Long CJK title prefix {prefix!r} was not rendered on {route}"
                )
                guard.assert_no_horizontal_overflow(f"G2_UI_07 {route}")
                clamp_violations = page.evaluate(
                    """(pref) => {
                      const bad = [];
                      for (const el of document.querySelectorAll('h1, h2, h3, h4, p, span, a, div, input')) {
                        if (el.closest('.pg-slide-outer, .pg-slide-stage')) continue;
                        const txt = (el.value !== undefined ? String(el.value) : (el.innerText || '')).trim();
                        if (!txt.includes(pref)) continue;
                        const hasChildMatch = Array.from(el.children).some((ch) => (ch.innerText || '').includes(pref));
                        if (hasChildMatch) continue;
                        const cs = getComputedStyle(el);
                        const r = el.getBoundingClientRect();
                        if (r.width === 0 || r.height === 0) continue;
                        const parent = el.closest('article, [data-project-card], .gl-project-card, header, section, main') || el.parentElement;
                        if (parent) {
                          const pr = parent.getBoundingClientRect();
                          if (r.right > pr.right + 4) {
                            bad.push({ tag: el.tagName, right: Math.round(r.right), parentRight: Math.round(pr.right) });
                          }
                        }
                        if (cs.overflowX === 'visible' && el.scrollWidth > el.clientWidth + 4 && el.tagName !== 'INPUT') {
                          bad.push({ tag: el.tagName, scrollW: el.scrollWidth, clientW: el.clientWidth });
                        }
                      }
                      return bad;
                    }""",
                    prefix,
                )
                assert not clamp_violations, (
                    f"Container clamping overflow on {route} for long CJK title: {clamp_violations[:5]}"
                )
            guard.assert_no_browser_errors("G2_UI_07")


def g2_ui_08_anti_double_submit_lock(ctx: TestContext) -> None:
    with ctx.browser_page() as guard:
        guard.goto_ok(f"{ctx.base_url}/generate")
        page = guard.page

        fill_resilient(
            page,
            ["#pg-gen-topic", "main textarea"],
            "防重复提交并发保护验证主题",
            description="Workshop topic",
        )
        btn = locate_first(
            page,
            [
                "#pg-gen-run-btn",
                lambda p: p.get_by_role("button", name=re.compile(r"开始生成|生成\s*PPT|直接生成", re.I)),
            ],
            description="Generate CTA",
        )
        btn.evaluate("el => { window.__glGenCtaRef = el; }")

        # Non-blocking browser-side fetch delay (ZERO time.sleep in page.route!)
        with DelayedFetchProbe(page, "/api/generate", delay_ms=900, observe_mutations=False) as probe:
            btn.click()
            page.wait_for_timeout(80)
            is_locked = bool(
                page.evaluate(
                    """() => {
                      const b = window.__glGenCtaRef || document.querySelector('#pg-gen-run-btn');
                      if (!b || !b.isConnected) return true;
                      const cs = getComputedStyle(b);
                      if (cs.display === 'none' || cs.visibility === 'hidden') return true;
                      return Boolean(b.disabled) || b.getAttribute('aria-busy') === 'true';
                    }"""
                )
            )
            # Attempt a genuine concurrent 2nd click in DOM while fetch #1 is still pending
            page.evaluate(
                """() => {
                  const b = window.__glGenCtaRef || document.querySelector('#pg-gen-run-btn');
                  if (b && b.isConnected) b.click();
                }"""
            )
            locate_first(
                page,
                [
                    "#pg-gen-undo-btn",
                    "#pg-edit-slide-title",
                    lambda p: p.get_by_role("button", name=re.compile(r"导出\s*PPTX", re.I)),
                ],
                timeout_ms=15000,
                description="Editor ready after single delayed generate",
            )
            snap = probe.snapshot()

        assert is_locked is True, (
            f"Anti-double-submit lock FAILED: Generate CTA was NOT locked (disabled/aria-busy) while in-flight "
            f"(requests={snap.get('requestCount')})"
        )
        assert snap.get("requestCount") == 1 and snap.get("networkRequestCount") == 1, (
            f"Anti-double-submit lock FAILED: concurrent double-click sent "
            f"fetch={snap.get('requestCount')}, network={snap.get('networkRequestCount')} POST /api/generate requests!"
        )
        guard.assert_no_browser_errors("G2_UI_08")


def g2_ui_09_generate_failure_retry_preserves_draft(ctx: TestContext) -> None:
    draft_topic = "网络异常恢复草稿保留主题"
    with ctx.browser_page() as guard:
        guard.goto_ok(f"{ctx.base_url}/generate")
        page = guard.page

        topic_input = fill_resilient(
            page,
            ["#pg-gen-topic", "main textarea"],
            draft_topic,
            description="Workshop topic textarea",
        )

        # Intercept first POST /api/generate with HTTP 502
        page.route(
            "**/api/generate",
            lambda r: r.fulfill(
                status=502,
                content_type="application/json",
                body=json.dumps({"error": "上游模型暂时不可用，请重试"}),
            ),
        )
        with guard.allow_expected_http_errors({502}):
            click_resilient(
                page,
                [
                    "#pg-gen-run-btn",
                    lambda p: p.get_by_role("button", name=re.compile(r"开始生成|生成\s*PPT|直接生成", re.I)),
                ],
                description="Generate CTA",
            )
            page.wait_for_timeout(450)
            body = guard.get_body_text()
            assert re.search(r"失败|不可用|重试|错误", body), (
                "502 generation failure did not show visible error recovery feedback"
            )
            assert topic_input.input_value() == draft_topic, (
                "Generation error wiped typed draft topic!"
            )

        # Remove failing mock and retry -> succeeds cleanly
        page.unroute("**/api/generate")
        click_resilient(
            page,
            [
                lambda p: p.get_by_role("button", name=re.compile(r"重试|重新生成")),
                "#pg-gen-run-btn",
                lambda p: p.get_by_role("button", name=re.compile(r"开始生成|生成\s*PPT", re.I)),
            ],
            description="Retry generate button",
        )
        locate_first(
            page,
            ["#pg-gen-undo-btn", "#pg-edit-slide-title", lambda p: p.get_by_role("button", name=re.compile(r"导出\s*PPTX", re.I))],
            timeout_ms=15000,
            description="Editor after retry recovery",
        )
        guard.assert_no_browser_errors("G2_UI_09")


def g2_ui_10_private_deck_browser_isolation(ctx: TestContext) -> None:
    demo = ctx.api_logged_in(ACCOUNT_DEMO)
    secret_marker = f"SECRET-CONFIDENTIAL-{unique_token('PRIV')}"
    with ctx.cleanup() as cleanup:
        deck_id = demo.post(
            "/api/decks",
            json_body=make_valid_deck_payload(
                title=f"[E2E-PRIV] {secret_marker}",
                slides=make_valid_slides(4, custom_title=secret_marker, custom_notes=f"NOTES-{secret_marker}"),
                is_public=False,
            ),
        ).assert_status(201).require_json()["deck"]["id"]
        cleanup.register_delete_deck(demo, deck_id)

        with ctx.browser_page() as guard:
            with guard.allow_expected_http_errors({403, 404}):
                resp_deck = guard.goto_ok(f"{ctx.base_url}/deck/{deck_id}", expected_statuses=(403, 404, 200))
                html_deck = guard.page.content()
                deck_body = guard.get_body_text()
                assert secret_marker not in html_deck, (
                    "CRITICAL PRIVACY LEAK: Anonymous /deck/[privateId] leaked private deck title/notes!"
                )
                assert resp_deck.status in (403, 404) or re.search(
                    r"404|无权|私有|不存在|未找到|访问受限", deck_body, re.I
                ), f"Expected clean 404/access-denied UI on private /deck/{deck_id}, got status={resp_deck.status}"

                guard.goto_ok(f"{ctx.base_url}/generate?deck={deck_id}", expected_statuses=(403, 404, 200))
                html_gen = guard.page.content()
                assert secret_marker not in html_gen, (
                    "CRITICAL PRIVACY LEAK: Anonymous /generate?deck=[privateId] leaked private deck content!"
                )

            guard.assert_no_browser_errors("G2_UI_10")


def g2_ui_11_compare_max_3_guard(ctx: TestContext) -> None:
    with ctx.browser_page() as guard:
        guard.goto_ok(f"{ctx.base_url}/gallery")
        page = guard.page

        slugs = (
            "apple-soft-bento-modular",
            "keynote-obsidian-stage",
            "mckinsey-executive-insight",
            "swiss-international-grid",
        )
        for slug in slugs:
            card = page.locator(f'article[data-prompt-slug="{slug}"]').first
            card.scroll_into_view_if_needed()
            card.hover()
            cmp_btn = locate_first(
                card,
                [
                    lambda c: c.get_by_role("button", name=re.compile(r"对比|加入对比")),
                    'button[aria-label*="对比"]',
                ],
                description=f"Compare toggle on {slug}",
            )
            cmp_btn.click()
            page.wait_for_timeout(150)

        # 4th click must display Max-3 toast/warning AND clamp localStorage to 3
        locate_first(
            page,
            [
                lambda p: p.get_by_text(re.compile(r"最多.*3|已达上限|先移除|3\s*套|3\s*个")),
                '[role="status"]',
                '[role="alert"]',
                ".gl-toast",
                ".pg-toast",
            ],
            timeout_ms=3000,
            description="Compare Max-3 limit warning toast",
        )
        assert re.search(r"最多.*3|已达上限|先移除|3\s*套|3\s*个", guard.get_body_text()), (
            "Adding 4th compare style did not display Max-3 warning feedback"
        )
        raw = page.evaluate("(k) => window.localStorage.getItem(k)", COMPARE_STORAGE_KEY)
        ids = json.loads(raw) if raw else []
        assert len(ids) == 3, f"Compare Max-3 guard failed: expected 3 items in {COMPARE_STORAGE_KEY}, got {ids}"
        guard.assert_no_browser_errors("G2_UI_11")


# ---------------------------------------------------------------------------
# Tier 2C — Dedicated Honest-Boundary Anti-Fake Suite (G2_HONEST_01 .. 16)
# ---------------------------------------------------------------------------


def g2_honest_01_b1_no_pro_upsell(ctx: TestContext) -> None:
    patterns = HONEST_BOUNDARY_FORBIDDEN_PATTERNS["B1"]["forbidden_regexes"]
    with ctx.browser_page() as guard:
        for route in HONEST_BOUNDARY_FORBIDDEN_PATTERNS["B1"]["routes"]:
            guard.goto_ok(f"{ctx.base_url}{route}")
            guard.assert_text_absent(patterns, label=f"B1 ({route})")
        guard.assert_no_browser_errors("G2_HONEST_01")


def g2_honest_02_b2_no_notification_bell(ctx: TestContext) -> None:
    selectors = HONEST_BOUNDARY_FORBIDDEN_PATTERNS["B2"]["forbidden_selectors"]
    with ctx.browser_page() as guard:
        for route in HONEST_BOUNDARY_FORBIDDEN_PATTERNS["B2"]["routes"]:
            guard.goto_ok(f"{ctx.base_url}{route}")
            for sel in selectors:
                loc = guard.page.locator(sel)
                if loc.count() > 0 and loc.first.is_visible():
                    raise AssertionError(
                        f"[B2] Forbidden notification bell matched selector {sel!r} inside <header> on {route}"
                    )
        # Also verify inside Editor mode
        ensure_editor_ready(guard, ctx.base_url)
        for sel in selectors:
            loc = guard.page.locator(sel)
            if loc.count() > 0 and loc.first.is_visible():
                raise AssertionError(
                    f"[B2] Forbidden notification bell matched selector {sel!r} inside Editor <header>"
                )
        guard.assert_no_browser_errors("G2_HONEST_02")


def g2_honest_03_b3_no_fake_feedback_form(ctx: TestContext) -> None:
    patterns = HONEST_BOUNDARY_FORBIDDEN_PATTERNS["B3"]["forbidden_regexes"]
    with ctx.browser_page() as guard:
        for route in HONEST_BOUNDARY_FORBIDDEN_PATTERNS["B3"]["routes"]:
            guard.goto_ok(f"{ctx.base_url}{route}")
            guard.assert_text_absent(patterns, label=f"B3 Nav ({route})", scope_selector="aside, nav, footer")
            guard.assert_text_absent((r"提交反馈",), label=f"B3 Body ({route})")
            assert guard.page.locator('form[action*="feedback" i]').count() == 0, (
                f"[B3] Found fake feedback form on {route}"
            )
        guard.assert_no_browser_errors("G2_HONEST_03")


def g2_honest_04_b4_no_fake_collaboration_badges(ctx: TestContext) -> None:
    patterns = HONEST_BOUNDARY_FORBIDDEN_PATTERNS["B4"]["forbidden_regexes"]
    demo = ctx.api_logged_in(ACCOUNT_DEMO)
    with ctx.cleanup() as cleanup:
        tok = unique_token("B4")
        deck_title = f"[E2E-B4] 可见性诚实徽章 {tok}"
        deck_id = demo.post(
            "/api/decks",
            json_body=make_valid_deck_payload(title=deck_title, is_public=False),
        ).assert_status(201).require_json()["deck"]["id"]
        cleanup.register_delete_deck(demo, deck_id)

        with ctx.browser_page() as guard:
            # Guest check
            guard.goto_ok(f"{ctx.base_url}/collections")
            guard.assert_text_absent(patterns, label="B4 Guest /collections")

            # Authenticated check with real private deck
            login_via_api(guard.page, ctx.base_url, ACCOUNT_DEMO)
            guard.goto_ok(f"{ctx.base_url}/collections")
            guard.assert_text_absent(patterns, label="B4 Auth /collections")
            body = guard.get_body_text()
            assert re.search(r"私有|私密|仅自己可见", body), (
                "[B4] Private deck on /collections missing honest private visibility badge"
            )
            assert re.search(r"公开分享|公开", body), (
                "[B4] /collections missing honest '公开分享' filter/label"
            )

            # Flip deck to public via PATCH and verify UI reflects real isPublic=true state
            demo.patch(f"/api/decks/{deck_id}", json_body={"isPublic": True}).assert_status(200)
            guard.goto_ok(f"{ctx.base_url}/collections")
            guard.assert_text_absent(patterns, label="B4 Public /collections")
            card = guard.page.locator("article, [data-project-card], .gl-project-card").filter(
                has_text=deck_title
            ).first
            assert re.search(r"公开|公开分享", card.inner_text() or ""), (
                f"[B4] Flipped public deck card missing honest '公开' badge: {(card.inner_text() or '')!r}"
            )
            click_resilient(
                guard.page,
                [
                    lambda p: p.get_by_role("tab", name=re.compile(r"公开分享")),
                    lambda p: p.get_by_role("button", name=re.compile(r"公开分享")),
                ],
                description="B4 公开分享 filter",
            )
            guard.page.wait_for_timeout(150)
            assert deck_title in guard.get_body_text(), (
                f"[B4] Public deck {deck_title!r} did not appear under 公开分享 filter"
            )
            guard.assert_no_browser_errors("G2_HONEST_04")


def g2_honest_05_b5_no_trash_bin_and_permanent_delete_confirm(ctx: TestContext) -> None:
    patterns = HONEST_BOUNDARY_FORBIDDEN_PATTERNS["B5"]["forbidden_regexes"]
    demo = ctx.api_logged_in(ACCOUNT_DEMO)
    with ctx.cleanup() as cleanup:
        tok = unique_token("B5")
        title = f"[E2E-B5] 删除确认校验 {tok}"
        deck_id = demo.post(
            "/api/decks",
            json_body=make_valid_deck_payload(title=title, is_public=False),
        ).assert_status(201).require_json()["deck"]["id"]
        cleanup.register_delete_deck(demo, deck_id)

        with ctx.browser_page() as guard:
            login_via_api(guard.page, ctx.base_url, ACCOUNT_DEMO)
            guard.goto_ok(f"{ctx.base_url}/collections")
            guard.assert_text_absent(patterns, label="B5 /collections")

            # Open delete action on card -> MUST trigger confirmation dialog, NOT silent delete
            card = guard.page.locator("article, [data-project-card], .gl-project-card").filter(
                has_text=title
            ).first
            card.wait_for(state="visible", timeout=ctx.timeout_ms)
            card.scroll_into_view_if_needed()
            more = card.locator(
                'button[aria-label*="更多"], button[aria-haspopup="menu"], button:has-text("⋯"), button:has-text("...")'
            )
            if more.count() > 0 and more.first.is_visible():
                more.first.click()
                guard.page.wait_for_timeout(120)
            click_resilient(
                guard.page,
                [
                    lambda p: p.get_by_role("menuitem", name=re.compile(r"删除")),
                    lambda p: p.get_by_role("button", name=re.compile(r"删除")),
                ],
                description="B5 Project Delete trigger",
            )
            dlg = locate_first(guard.page, ['[role="dialog"]'], description="B5 Delete Confirmation Dialog")
            assert re.search(r"永久|不可恢复|确认删除|删除", dlg.inner_text() or ""), (
                "[B5] Delete dialog missing explicit permanent-deletion confirmation wording"
            )
            guard.page.keyboard.press("Escape")
            # Confirm deck still exists because user cancelled!
            demo.get(f"/api/decks/{deck_id}").assert_status(200, "B5 cancelled delete kept deck")
            guard.assert_no_browser_errors("G2_HONEST_05")


def g2_honest_06_b6_no_custom_project_folders(ctx: TestContext) -> None:
    patterns = HONEST_BOUNDARY_FORBIDDEN_PATTERNS["B6"]["forbidden_regexes"]
    with ctx.browser_page() as guard:
        login_via_api(guard.page, ctx.base_url, ACCOUNT_DEMO)
        guard.goto_ok(f"{ctx.base_url}/collections")
        guard.assert_text_absent(patterns, label="B6 /collections")
        guard.assert_no_browser_errors("G2_HONEST_06")


def g2_honest_07_b7_no_hardcoded_stats_or_fake_recent_projects(ctx: TestContext) -> None:
    b7 = HONEST_BOUNDARY_FORBIDDEN_PATTERNS["B7"]
    fake_titles = b7["forbidden_recent_titles"]
    stat_regexes = b7["forbidden_stat_regexes"]
    with ctx.browser_page() as guard:
        guard.goto_ok(f"{ctx.base_url}/")
        dash_text = guard.get_body_text()
        for t in fake_titles:
            assert t not in dash_text, f"[B7] Dashboard displays hardcoded fake recent project {t!r}"
        assert re.search(r"暂无|还没有|去创作|开始创作|新建|登录", dash_text), (
            "[B7] Dashboard Recent Projects missing honest empty-state CTA at 0-deck baseline"
        )

        login_via_api(guard.page, ctx.base_url, ACCOUNT_DEMO)
        guard.goto_ok(f"{ctx.base_url}/collections")
        col_text = guard.get_body_text()
        for t in fake_titles:
            assert t not in col_text, f"[B7] /collections displays hardcoded fake project {t!r}"
        guard.assert_text_absent(stat_regexes, label="B7 /collections hardcoded 42 stats")
        # Positively assert KPI displays real 0 count at 0-deck baseline
        assert re.search(
            r"(?:全部项目|全部演示文稿|我的项目|总项目数)[\s:：(（]*0\b"
            r"|\b0\s*[\n\r]+\s*(?:全部项目|全部演示文稿|我的项目|总项目数)",
            col_text,
        ), f"[B7] /collections KPI does not display honest 0 count at 0-deck baseline: {col_text[:300]!r}"
        guard.assert_no_browser_errors("G2_HONEST_07")


def g2_honest_08_b8_upload_limits_and_no_image_ocr_claim(ctx: TestContext) -> None:
    b8 = HONEST_BOUNDARY_FORBIDDEN_PATTERNS["B8"]
    with ctx.browser_page() as guard:
        for route in ("/", "/generate"):
            guard.goto_ok(f"{ctx.base_url}{route}")
            page = guard.page
            guard.assert_text_absent(b8["forbidden_regexes"], label=f"B8 ({route})")

            # Scope strict image/OCR check to document upload dropzone container
            dropzone_text = str(
                page.evaluate(
                    """() => {
                      const dz = document.querySelector('[data-upload-dropzone], .gl-upload-dropzone, .pg-upload-dropzone');
                      if (dz) return dz.innerText || '';
                      const inp = document.querySelector('#pg-doc-upload-input, main input[type="file"]');
                      if (!inp) return '';
                      const box = inp.closest('[data-upload-dropzone], .gl-upload-dropzone, label, section, article, div');
                      return box ? (box.innerText || '') : '';
                    }"""
                )
            )
            assert dropzone_text.strip(), f"[B8] Could not locate upload dropzone container text on {route}"
            for bad_dz_pat in b8["forbidden_dropzone_regexes"]:
                m = re.search(bad_dz_pat, dropzone_text, re.I)
                assert not m, (
                    f"[B8] Route {route} upload dropzone makes forbidden image/OCR claim "
                    f"{m.group(0)!r} (pattern {bad_dz_pat!r}): {dropzone_text[:200]!r}"
                )

            # Positively verify all 5 real formats + 10MB limit are disclosed
            body = guard.get_body_text()
            for req_pat in b8["required_format_regexes"]:
                assert re.search(req_pat, body, re.I), (
                    f"[B8] Route {route} upload dropzone missing honest disclosure matching /{req_pat}/"
                )
        guard.assert_no_browser_errors("G2_HONEST_08")


def g2_honest_09_b9_mandatory_sample_preview_badge(ctx: TestContext) -> None:
    b9 = HONEST_BOUNDARY_FORBIDDEN_PATTERNS["B9"]
    workshop_req = b9["workshop_required_regex"]
    compare_req = b9["compare_required_regex"]
    with ctx.browser_page() as guard:
        guard.goto_ok(f"{ctx.base_url}/generate")
        assert re.search(workshop_req, guard.get_body_text()), (
            f"[B9] /generate Workshop pre-generation preview missing strict '示例预览'/'示例文稿' badge (/{workshop_req}/)"
        )
        guard.goto_ok(f"{ctx.base_url}/compare")
        assert re.search(compare_req, guard.get_body_text()), (
            f"[B9] /compare missing mandatory '示例' disclosure badge (/{compare_req}/)"
        )
        guard.assert_no_browser_errors("G2_HONEST_09")


def g2_honest_10_b10_no_fabricated_percentage_progress(ctx: TestContext) -> None:
    pct_pat = HONEST_BOUNDARY_FORBIDDEN_PATTERNS["B10"]["forbidden_progress_regex"]
    with ctx.browser_page() as guard:
        guard.goto_ok(f"{ctx.base_url}/generate")
        page = guard.page

        fill_resilient(page, ["#pg-gen-topic", "main textarea"], "进度条诚实边界验证", description="Topic")

        # Non-blocking browser-side fetch delay + MutationObserver + non-slide DOM sampler
        with DelayedFetchProbe(page, "/api/generate", delay_ms=1000, observe_mutations=True) as probe:
            click_resilient(
                page,
                [
                    "#pg-gen-run-btn",
                    lambda p: p.get_by_role("button", name=re.compile(r"开始生成|生成\s*PPT", re.I)),
                ],
                description="Generate CTA",
            )
            locate_first(
                page,
                [
                    "#pg-gen-undo-btn",
                    "#pg-edit-slide-title",
                    lambda p: p.get_by_role("button", name=re.compile(r"导出\s*PPTX", re.I)),
                ],
                timeout_ms=15000,
                description="Editor after generation completes",
            )
            snap = probe.snapshot()

        assert snap.get("requestCount", 0) >= 1, (
            f"[B10] POST /api/generate was not observed by DelayedFetchProbe: {snap}"
        )
        assert snap.get("loadingUiObserved") is True, (
            f"[B10] No in-flight loading feedback was observed during 1000ms delayed generation (empty-loop guard): {snap}"
        )

        # Reject any numeric aria-valuenow (1..100) fabricated percentage on progress bars
        for raw_val in snap.get("ariaProgressValues") or []:
            cleaned = str(raw_val).strip()
            assert not re.fullmatch(r"(?:100|[1-9]\d?)(?:\.\d+)?", cleaned), (
                f"[B10] Fabricated numeric aria-valuenow={cleaned!r} detected during generation!"
            )

        # Scan ALL explicit progress texts, MutationObserver additions, and new non-slide DOM lines
        all_samples = (
            list(snap.get("explicitProgressTexts") or [])
            + list(snap.get("mutationTexts") or [])
            + list(snap.get("addedMainLines") or [])
        )
        for txt in all_samples:
            m = re.search(pct_pat, txt)
            assert not m, (
                f"[B10] Fabricated percentage progress {m.group(0)!r} found during generation: {txt!r}"
            )

        guard.assert_no_browser_errors("G2_HONEST_10")


def g2_honest_11_b11_honest_16_9_aspect_ratio(ctx: TestContext) -> None:
    forbidden = HONEST_BOUNDARY_FORBIDDEN_PATTERNS["B11"]["forbidden_options"]
    ratio_scan_js = """() => Array.from(
      document.querySelectorAll('option, [role="option"], [role="menuitem"], [role="radio"], button')
    ).filter((el) => {
      if (el.tagName === 'OPTION') return true;
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    }).map((el) => (el.textContent || '').trim()).filter(Boolean)"""

    with ctx.browser_page() as guard:
        guard.goto_ok(f"{ctx.base_url}/generate")
        page = guard.page

        assert "16:9" in guard.get_body_text(), "[B11] Workshop missing honest '16:9' aspect ratio indicator"
        opt_texts: list[str] = page.evaluate(ratio_scan_js)
        for bad in forbidden:
            assert not any(bad in t for t in opt_texts), (
                f"[B11] Workshop exposes unimplemented aspect ratio option {bad!r}: {opt_texts}"
            )

        ensure_editor_ready(guard, ctx.base_url)
        assert "16:9" in guard.get_body_text(), "[B11] Editor missing honest '16:9' aspect ratio indicator"
        ed_opts: list[str] = page.evaluate(ratio_scan_js)
        for bad in forbidden:
            assert not any(bad in t for t in ed_opts), (
                f"[B11] Editor exposes unimplemented aspect ratio option {bad!r}: {ed_opts}"
            )
        guard.assert_no_browser_errors("G2_HONEST_11")


def g2_honest_12_b12_no_fake_editor_shapes_animation_transition(ctx: TestContext) -> None:
    b12 = HONEST_BOUNDARY_FORBIDDEN_PATTERNS["B12"]
    forbidden_labels = b12["forbidden_control_labels"]
    forbidden_compounds = b12["forbidden_compound_regexes"]
    with ctx.browser_page() as guard:
        ensure_editor_ready(guard, ctx.base_url)
        page = guard.page

        control_labels: list[str] = page.evaluate(
            """() => Array.from(document.querySelectorAll('button, [role="tab"], [role="menuitem"]'))
              .filter((el) => {
                const cs = getComputedStyle(el);
                return cs.display !== 'none' && cs.visibility !== 'hidden';
              })
              .map((el) => (el.innerText || el.getAttribute('aria-label') || '').trim())
              .filter(Boolean)"""
        )
        for bad in forbidden_labels:
            exact_hits = [lbl for lbl in control_labels if lbl == bad or re.fullmatch(rf"{bad}\s*", lbl)]
            assert not exact_hits, (
                f"[B12] Editor exposes unimplemented mockup tab/tool {bad!r}: {exact_hits}"
            )
        for comp_pat in forbidden_compounds:
            comp_hits = [lbl for lbl in control_labels if re.search(comp_pat, lbl)]
            assert not comp_hits, (
                f"[B12] Editor exposes unimplemented compound mockup control matching /{comp_pat}/: {comp_hits}"
            )

        # Verify BOTH real inspector tabs + 设计体检 tool independently
        joined = " ".join(control_labels)
        assert re.search(r"本页编辑|内容编辑", joined), (
            f"[B12] Editor missing real '本页编辑' inspector tab in {control_labels[:25]}"
        )
        assert re.search(r"页面与主题|主题配色|品牌主题", joined), (
            f"[B12] Editor missing real '页面与主题' inspector tab in {control_labels[:25]}"
        )
        assert re.search(r"设计体检|体检", joined), "[B12] Editor missing real 设计体检 tool"
        guard.assert_no_browser_errors("G2_HONEST_12")


def g2_honest_13_b13_editor_ai_assistant_preview_confirm(ctx: TestContext) -> None:
    with ctx.browser_page() as guard:
        ensure_editor_ready(guard, ctx.base_url)
        page = guard.page

        # Assert all 3 real /api/polish actions are exposed & ZERO fake freeform AI chat input exists
        body_text = guard.get_body_text()
        for pat, desc in (
            (r"高管精炼|提炼高管", "executive action"),
            (r"量化|标尺|论据", "metrics action"),
            (r"讲稿|演讲稿", "notes action"),
        ):
            assert re.search(pat, body_text), f"[B13] Editor AI Assistant missing real {desc} (/{pat}/)"

        fake_chat = page.locator(
            'textarea[placeholder*="描述你的修改需求"], input[placeholder*="描述你的修改需求"], '
            'textarea[placeholder*="问问 AI"], input[placeholder*="问问 AI"], '
            'textarea[placeholder*="自由对话"], input[placeholder*="自由对话"]'
        )
        assert fake_chat.count() == 0, (
            "[B13] Editor exposes forbidden fake freeform AI chat input!"
        )

        orig_title = page.locator("#pg-edit-slide-title").first.input_value()
        # Trigger real POST /api/polish via AI Assistant
        with page.expect_response(
            lambda r: "/api/polish" in r.url and r.request.method == "POST",
            timeout=ctx.timeout_ms,
        ) as polish_resp:
            click_resilient(
                page,
                [
                    "#pg-polish-executive-btn",
                    lambda p: p.get_by_role("button", name=re.compile(r"高管精炼|提炼高管", re.I)),
                ],
                description="B13 AI Assistant executive polish button",
            )
        assert polish_resp.value.status == 200
        req_body = polish_resp.value.request.post_data_json
        assert req_body and req_body.get("action") in ("executive", "metrics", "notes"), (
            f"[B13] AI Assistant sent invalid /api/polish action: {req_body}"
        )

        # Must display preview + explicit 确认应用 & 放弃 WITHOUT silently mutating slide!
        discard_btn = locate_first(
            page,
            [lambda p: p.get_by_role("button", name=re.compile(r"放弃|取消应用|忽略"))],
            description="B13 AI Assistant discard preview button",
        )
        assert_any_visible(
            page,
            [lambda p: p.get_by_role("button", name=re.compile(r"确认应用|应用建议"))],
            description="B13 AI Assistant confirm apply button",
        )
        assert page.locator("#pg-edit-slide-title").first.input_value() == orig_title, (
            "[B13] AI Assistant silently mutated slide before clicking 确认应用!"
        )
        # Clicking 放弃 leaves slide untouched
        discard_btn.click()
        page.wait_for_timeout(150)
        assert page.locator("#pg-edit-slide-title").first.input_value() == orig_title, (
            "[B13] Clicking 放弃 did not keep original slide intact!"
        )
        guard.assert_no_browser_errors("G2_HONEST_13")


def g2_honest_14_b14_no_fake_voice_analysis(ctx: TestContext) -> None:
    patterns = HONEST_BOUNDARY_FORBIDDEN_PATTERNS["B14"]["forbidden_regexes"]
    demo = ctx.api_logged_in(ACCOUNT_DEMO)
    with ctx.cleanup() as cleanup:
        deck_id = demo.post(
            "/api/decks",
            json_body=make_valid_deck_payload(is_public=True),
        ).assert_status(201).require_json()["deck"]["id"]
        cleanup.register_delete_deck(demo, deck_id)

        with ctx.browser_page() as guard:
            guard.goto_ok(f"{ctx.base_url}/")
            guard.assert_text_absent(patterns, label="B14 (/)")
            assert re.search(r"提词|倒计时|计时|排练", guard.get_body_text()), (
                "[B14] Dashboard Quick Tool #3 missing honest teleprompter/timer/rehearsal wording"
            )
            for route in ("/tools?tab=pacing", f"/deck/{deck_id}?rehearsal=1"):
                guard.goto_ok(f"{ctx.base_url}{route}")
                guard.assert_text_absent(patterns, label=f"B14 ({route})")
            guard.assert_no_browser_errors("G2_HONEST_14")


def g2_honest_15_b15_honest_language_scoping(ctx: TestContext) -> None:
    with ctx.browser_page() as guard:
        page = guard.page
        # On Prompt Studio, #pg-param-lang is MANDATORY and switching zh -> en -> bilingual changes output
        guard.goto_ok(f"{ctx.base_url}/studio/apple-soft-bento-modular")
        out_el = locate_first(page, ["#pg-compiled-prompt-output"], description="Studio compiled prompt")

        def _read_out() -> str:
            return str(out_el.evaluate("e => (typeof e.value === 'string' ? e.value : e.innerText) || ''"))

        zh_out = _read_out()
        lang_ctl = locate_first(
            page,
            [
                "#pg-param-lang",
                'select[id*="lang" i]',
                lambda p: p.get_by_label(re.compile(r"语言|Language", re.I)),
            ],
            description="Studio language selector (#pg-param-lang)",
        )
        lang_ctl.select_option("en")
        page.wait_for_timeout(150)
        en_out = _read_out()
        assert en_out != zh_out, "[B15] Switching Studio #pg-param-lang to 'en' did not update compiled prompt!"

        lang_ctl.select_option("bilingual")
        page.wait_for_timeout(150)
        bi_out = _read_out()
        assert bi_out != en_out and bi_out != zh_out, (
            "[B15] Switching Studio #pg-param-lang to 'bilingual' did not produce distinct compiled prompt!"
        )

        # On / and /generate, Smart generation works cleanly end-to-end without language breakage
        guard.goto_ok(f"{ctx.base_url}/")
        ensure_editor_ready(guard, ctx.base_url)
        guard.assert_no_browser_errors("G2_HONEST_15")


def g2_honest_16_b16_live_slidecanvas_and_real_db_counts(ctx: TestContext) -> None:
    bad_badges = HONEST_BOUNDARY_FORBIDDEN_PATTERNS["B16"]["forbidden_mockup_badges"]
    with ctx.browser_page() as guard:
        # 1. /gallery must render 36 live SlideCanvas cards & real DB counts (NOT PNG-2 8/6/6/5/4/4/3)
        guard.goto_ok(f"{ctx.base_url}/gallery")
        page = guard.page
        guard.assert_text_absent(bad_badges, label="B16 /gallery hardcoded PNG-2 counts")

        cards = page.locator("article[data-prompt-slug]")
        assert cards.count() == 36, f"[B16] Expected 36 live cards on /gallery, got {cards.count()}"
        live_canvases = page.locator("article[data-prompt-slug] .pg-slide-outer").count()
        assert live_canvases == 36, (
            f"[B16] Expected 36 live SlideCanvas DOM cards (not static PNGs), got {live_canvases}"
        )

        # Reject static raster mockup images masquerading as SlideCanvas cards
        raster_mockups = page.evaluate(
            """() => {
              const bad = [];
              for (const card of document.querySelectorAll('article[data-prompt-slug] .pg-slide-outer')) {
                const txt = (card.innerText || '').trim();
                const imgs = Array.from(card.querySelectorAll('img')).filter((img) =>
                  /\\.(?:png|webp|jpe?g)(?:\\?|$)/i.test(img.getAttribute('src') || '')
                );
                if (imgs.length > 0 && txt.length < 4) {
                  bad.push(imgs[0].getAttribute('src'));
                }
              }
              return bad;
            }"""
        )
        assert not raster_mockups, (
            f"[B16] Gallery contains static raster mockup images instead of live DOM SlideCanvas: {raster_mockups[:5]}"
        )

        # UNCONDITIONALLY locate EVERY frozen #pg-domain-tab-* and verify real DB counts (NO silent skip!)
        for domain_id, expected_count in DOMAIN_EXPECTED_COUNTS.items():
            tab = locate_first(
                page,
                [f"#pg-domain-tab-{domain_id}"],
                description=f"Gallery domain capsule #pg-domain-tab-{domain_id}",
            )
            txt = tab.inner_text() or ""
            assert str(expected_count) in txt, (
                f"[B16] Domain tab #pg-domain-tab-{domain_id} badge {txt!r} does not match real DB count {expected_count}"
            )

        # 2. Dashboard / uses live SlideCanvas cards (not static mockup PNGs)
        guard.goto_ok(f"{ctx.base_url}/")
        dash_canvases = page.locator("main .pg-slide-outer").count()
        assert dash_canvases >= 9, (
            f"[B16] Dashboard expected >= 9 live SlideCanvas previews, got {dash_canvases}"
        )
        guard.assert_no_browser_errors("G2_HONEST_16")


def get_specs() -> list[TestSpec]:
    return [
        # Tier 2A: 12 API Boundary Tests
        TestSpec("G2_API_01", 2, "POST /api/parse-document rejects >10MB file with 400", g2_api_01_upload_oversized, ("api", "upload", "boundary")),
        TestSpec("G2_API_02", 2, "POST /api/parse-document rejects .doc/.png/.exe/0-byte/corrupt .pptx", g2_api_02_upload_forbidden_and_empty, ("api", "upload", "boundary")),
        TestSpec("G2_API_03", 2, "POST /api/parse-document flags scanned image-only PDF safely", g2_api_03_upload_scanned_pdf, ("api", "upload", "pdf")),
        TestSpec("G2_API_04", 2, "POST /api/prompts & /comments validation boundaries", g2_api_04_prompt_and_comment_validation, ("api", "validation")),
        TestSpec("G2_API_05", 2, "POST /api/generate & /api/outline empty topic & slideCount clamping", g2_api_05_generate_and_outline_bounds, ("api", "generate", "boundary")),
        TestSpec("G2_API_06", 2, "BYOK SSRF protection across generate/outline/polish/generate-image", g2_api_06_byok_ssrf_protection, ("api", "security", "ssrf")),
        TestSpec("G2_API_07", 2, "BYOK MockOpenAIServer valid/fenced JSON, 502 error & API key scrubbing", g2_api_07_byok_mock_llm_and_key_scrub, ("api", "byok", "security")),
        TestSpec("G2_API_08", 2, "PATCH /api/decks/[id] strict isPublic-only vs PUT full deck contract", g2_api_08_decks_patch_vs_put_contract, ("api", "decks", "boundary")),
        TestSpec("G2_API_09", 2, "POST /api/polish strict executive/metrics/notes enum validation", g2_api_09_polish_strict_action_enum, ("api", "polish", "boundary")),
        TestSpec("G2_API_10", 2, "POST /api/export/pptx empty bars, dark RGBA, CJK RFC5987 & 400 guards", g2_api_10_export_pptx_corner_cases, ("api", "pptx", "boundary")),
        TestSpec("G2_API_11", 2, "Unauthenticated 401 guards, nonexistent 404 & duplicate register 409", g2_api_11_auth_and_routing_guards, ("api", "auth", "boundary")),
        TestSpec("G2_API_12", 2, "Deck >50 slides, SVG dataUrl & >650k image payload rejection", g2_api_12_deck_slide_and_image_caps, ("api", "decks", "security")),
        # Tier 2B: 11 Browser UI Boundary Tests
        TestSpec("G2_UI_01", 2, "Invalid uploads (>10MB/.doc/.png/0B) show inline error & preserve draft", g2_ui_01_upload_errors_preserve_draft, ("ui", "upload", "boundary"), True),
        TestSpec("G2_UI_02", 2, "Scanned PDF upload shows warning banner & preserves Workshop draft", g2_ui_02_scanned_pdf_warning_preserves_draft, ("ui", "upload", "pdf"), True),
        TestSpec("G2_UI_03", 2, "Empty topic falls back to non-blank 16:9 sample preview w/ 示例 badge", g2_ui_03_empty_topic_sample_fallback, ("ui", "empty-state"), True),
        TestSpec("G2_UI_04", 2, "Zero-result search EmptyState & 清除筛选 recovery on /gallery & /collections", g2_ui_04_zero_result_search_and_clear_filters, ("ui", "empty-state"), True),
        TestSpec("G2_UI_05", 2, "Guest vs Authenticated 0-deck honest empty states on / & /collections", g2_ui_05_guest_vs_zero_deck_empty_states, ("ui", "empty-state"), True),
        TestSpec("G2_UI_06", 2, "Editor last-slide delete guard & all-12-type zero-NaN SVG switch safety", g2_ui_06_editor_last_slide_guard_and_12_type_safety, ("ui", "editor", "boundary"), True),
        TestSpec("G2_UI_07", 2, "Long 56-char CJK deck title clamping & zero overflow across views", g2_ui_07_long_cjk_clamping, ("ui", "overflow", "cjk"), True),
        TestSpec("G2_UI_08", 2, "Anti-double-submit lock prevents duplicate POST /api/generate requests", g2_ui_08_anti_double_submit_lock, ("ui", "concurrency"), True),
        TestSpec("G2_UI_09", 2, "Generation 502 error preserves draft & recovers cleanly on retry", g2_ui_09_generate_failure_retry_preserves_draft, ("ui", "error-recovery"), True),
        TestSpec("G2_UI_10", 2, "Anonymous browser /deck/[privateId] & /generate?deck= leak zero content", g2_ui_10_private_deck_browser_isolation, ("ui", "privacy"), True),
        TestSpec("G2_UI_11", 2, "Compare Max-3 guard prevents adding 4th style on /gallery", g2_ui_11_compare_max_3_guard, ("ui", "compare", "boundary"), True),
        # Tier 2C: 16 Dedicated Honest-Boundary Anti-Fake Tests (B1–B16)
        TestSpec("G2_HONEST_01", 2, "[B1] Zero fake PPTGod Pro billing/upsell card across routes", g2_honest_01_b1_no_pro_upsell, ("ui", "honest", "B1"), True),
        TestSpec("G2_HONEST_02", 2, "[B2] Zero fake notification bell or unread dot in Topbar", g2_honest_02_b2_no_notification_bell, ("ui", "honest", "B2"), True),
        TestSpec("G2_HONEST_03", 2, "[B3] Zero fake 意见反馈 submission form in Sidebar", g2_honest_03_b3_no_fake_feedback_form, ("ui", "honest", "B3"), True),
        TestSpec("G2_HONEST_04", 2, "[B4] Zero fake 与我共享/协作中; real isPublic visibility labels", g2_honest_04_b4_no_fake_collaboration_badges, ("ui", "honest", "B4"), True),
        TestSpec("G2_HONEST_05", 2, "[B5] Zero fake 回收站; delete opens permanent-deletion confirm dialog", g2_honest_05_b5_no_trash_bin_and_permanent_delete_confirm, ("ui", "honest", "B5"), True),
        TestSpec("G2_HONEST_06", 2, "[B6] Zero fake 项目分组/新建分组 custom folder creation UI", g2_honest_06_b6_no_custom_project_folders, ("ui", "honest", "B6"), True),
        TestSpec("G2_HONEST_07", 2, "[B7] Zero hardcoded 42/8/18/6 stats or fake recent project titles", g2_honest_07_b7_no_hardcoded_stats_or_fake_recent_projects, ("ui", "honest", "B7"), True),
        TestSpec("G2_HONEST_08", 2, "[B8] Dropzone states 10MB limit & makes zero image OCR claims", g2_honest_08_b8_upload_limits_and_no_image_ocr_claim, ("ui", "honest", "B8"), True),
        TestSpec("G2_HONEST_09", 2, "[B9] Mandatory 示例预览 / 示例 disclosure before generation", g2_honest_09_b9_mandatory_sample_preview_badge, ("ui", "honest", "B9"), True),
        TestSpec("G2_HONEST_10", 2, "[B10] Zero fabricated percentage (%) progress during generation", g2_honest_10_b10_no_fabricated_percentage_progress, ("ui", "honest", "B10"), True),
        TestSpec("G2_HONEST_11", 2, "[B11] Honest 16:9 ratio indicator with zero fake 4:3 or 9:16 options", g2_honest_11_b11_honest_16_9_aspect_ratio, ("ui", "honest", "B11"), True),
        TestSpec("G2_HONEST_12", 2, "[B12] Zero unimplemented Editor 形状/表格/动画/切换 tools or tabs", g2_honest_12_b12_no_fake_editor_shapes_animation_transition, ("ui", "honest", "B12"), True),
        TestSpec("G2_HONEST_13", 2, "[B13] Editor AI Assistant uses /api/polish with preview + confirm/discard", g2_honest_13_b13_editor_ai_assistant_preview_confirm, ("ui", "honest", "B13"), True),
        TestSpec("G2_HONEST_14", 2, "[B14] Zero fake AI 语音演练/语音评分/停顿分析 across rehearsal flows", g2_honest_14_b14_no_fake_voice_analysis, ("ui", "honest", "B14"), True),
        TestSpec("G2_HONEST_15", 2, "[B15] Honest language scoping across Studio compiler & Workshop", g2_honest_15_b15_honest_language_scoping, ("ui", "honest", "B15"), True),
        TestSpec("G2_HONEST_16", 2, "[B16] Live 36 SlideCanvas cards & real DB counts (zero static PNG-2 counts)", g2_honest_16_b16_live_slidecanvas_and_real_db_counts, ("ui", "honest", "B16"), True),
    ]
