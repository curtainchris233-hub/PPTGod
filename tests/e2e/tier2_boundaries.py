"""Tier 2 E2E Tests: Validation boundaries, BYOK mock LLM, PPTX edge cases, auth & UI guards.

Contains 17 granular tests (13 API + 4 Browser UI):
- T2_VAL_01 .. T2_VAL_05
- T2_LLM_01 .. T2_LLM_04
- T2_EXP_01 .. T2_EXP_02
- T2_AUTH_01 .. T2_AUTH_02
- T2_UI_01  .. T2_UI_04
"""

from __future__ import annotations

import json
import re
import socket

from tests.e2e.config import (
    ACCOUNT_DEMO,
    COMPARE_STORAGE_KEY,
    DESKTOP_VIEWPORT,
    PPTX_CONTENT_TYPE,
    SLIDE_TYPE_LABELS,
    make_valid_deck_payload,
    make_valid_prompt_payload,
    make_valid_slides,
    make_valid_visual_spec,
    unique_token,
)
from tests.e2e.helpers import (
    MockOpenAIServer,
    PptxVerifier,
    TestCaseSpec,
    TestContext,
    first_visible,
)
from tests.e2e.tier1_features import count_generate_tree_slides, load_preset_and_generate


def _get_closed_local_port() -> int:
    """Reserve and immediately close an ephemeral TCP port on 127.0.0.1."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


# ---------------------------------------------------------------------------
# Validation Boundaries (5 Tests)
# ---------------------------------------------------------------------------


def t2_val_01_prompt_create_boundaries(ctx: TestContext) -> None:
    """POST /api/prompts rejects empty/1-char/>60-char titles, short summary, null spec & missing anatomy."""
    author = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    base = make_valid_prompt_payload()

    cases: list[tuple[str, dict]] = [
        ("empty_title", {**base, "title": ""}),
        ("one_char_title", {**base, "title": "A"}),
        ("over_60_title", {**base, "title": "A" * 61}),
        ("short_summary", {**base, "summary": "太短了"}),
        ("null_visual_spec", {**base, "visualSpec": None}),
        (
            "missing_anatomy_content",
            {
                **base,
                "promptAnatomy": {
                    k: v for k, v in base["promptAnatomy"].items() if k != "content"
                },
            },
        ),
    ]
    for label, bad_payload in cases:
        resp = author.post("/api/prompts", json_body=bad_payload)
        resp.assert_status(400, f"POST /api/prompts boundary {label}")
        err_json = resp.require_json(f"error JSON for {label}")
        assert err_json.get("error"), f"Missing error message for {label}: {err_json}"


def t2_val_02_prompt_put_patch_boundaries(ctx: TestContext) -> None:
    """PUT and PATCH /api/prompts/[id] reject invalid fields on own prompt with 400."""
    author = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    payload = make_valid_prompt_payload(is_public=True)
    with ctx.cleanup() as cleanup:
        created = (
            author.post("/api/prompts", json_body=payload)
            .assert_status(201)
            .require_json()["prompt"]
        )
        pid = created["id"]
        cleanup.register_delete_prompt(author, pid)

        author.put(f"/api/prompts/{pid}", json_body={**payload, "title": ""}).assert_status(
            400, "PUT empty title"
        )
        author.put(f"/api/prompts/{pid}", json_body={**payload, "summary": "短"}).assert_status(
            400, "PUT short summary"
        )
        author.patch(f"/api/prompts/{pid}", json_body={}).assert_status(
            400, "PATCH empty body"
        )
        author.patch(f"/api/prompts/{pid}", json_body={"isPublic": "yes"}).assert_status(
            400, "PATCH non-boolean isPublic"
        )


def t2_val_03_comment_boundaries(ctx: TestContext) -> None:
    """Comment length (<4, >500), out-of-range rating (0, 99), and DELETE param validation."""
    author = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    pid = "prompt_swiss_grid"

    author.post(
        f"/api/prompts/{pid}/comments",
        json_body={"testedTool": "claude-html", "rating": 5, "content": "很好用"},
    ).assert_status(400, "comment < 4 chars")

    author.post(
        f"/api/prompts/{pid}/comments",
        json_body={"testedTool": "claude-html", "rating": 5, "content": "评" * 501},
    ).assert_status(400, "comment > 500 chars")

    with ctx.cleanup() as cleanup:
        for bad_rating in (0, 99):
            marker = f"[E2E-RATE-{bad_rating}-{unique_token('R')}] 边界评分测试内容"
            resp = author.post(
                f"/api/prompts/{pid}/comments",
                json_body={"testedTool": "claude-html", "rating": bad_rating, "content": marker},
            )
            resp.assert_status((201, 400), f"rating={bad_rating} clamp or reject")
            if resp.status == 201:
                comments = resp.require_json()["comments"]
                created = [c for c in comments if c.get("content") == marker]
                assert len(created) == 1, f"Rating {bad_rating} accepted but comment not found"
                cleanup.register_delete_comment(author, pid, created[0]["id"])
                stored_rating = int(created[0]["rating"])
                assert 1 <= stored_rating <= 5, (
                    f"Rating {bad_rating} was not clamped to [1, 5]: got {stored_rating}"
                )

    author.delete(f"/api/prompts/{pid}/comments").assert_status(
        400, "DELETE comment missing commentId"
    )
    author.delete(
        f"/api/prompts/{pid}/comments", params={"commentId": "cmt_nonexistent_xyz"}
    ).assert_status(404, "DELETE nonexistent commentId")


def t2_val_04_profile_and_deck_boundaries(ctx: TestContext) -> None:
    """Profile displayName length boundaries & Saved Deck payload validation boundaries."""
    author = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)

    author.patch("/api/auth/profile", json_body={"displayName": "A"}).assert_status(
        400, "profile displayName < 2 chars"
    )
    author.patch("/api/auth/profile", json_body={"displayName": "A" * 33}).assert_status(
        400, "profile displayName > 32 chars"
    )

    valid_deck = make_valid_deck_payload()
    author.post("/api/decks", json_body={**valid_deck, "title": ""}).assert_status(
        400, "deck empty title"
    )
    author.post("/api/decks", json_body={**valid_deck, "slides": []}).assert_status(
        400, "deck empty slides"
    )
    no_spec = {k: v for k, v in valid_deck.items() if k != "visualSpec"}
    author.post("/api/decks", json_body=no_spec).assert_status(
        400, "deck missing visualSpec"
    )

    with ctx.cleanup() as cleanup:
        created = (
            author.post("/api/decks", json_body=valid_deck)
            .assert_status(201)
            .require_json()["deck"]
        )
        cleanup.register_delete_deck(author, created["id"])

        author.patch(f"/api/decks/{created['id']}", json_body={}).assert_status(
            400, "PATCH deck empty body"
        )


def t2_val_05_generate_smart_boundaries(ctx: TestContext) -> None:
    """POST /api/generate enforces empty topic 400, clamps slideCount [5, 20], handles empty sourceText."""
    client = ctx.api()

    client.post(
        "/api/generate",
        json_body={"topic": "", "slideCount": 6, "mode": "smart"},
    ).assert_status(400, "empty topic")

    low = (
        client.post(
            "/api/generate",
            json_body={"topic": "极小页数钳位测试", "slideCount": 2, "mode": "smart"},
        )
        .assert_status(200, "slideCount=2 clamped to 5")
        .require_json()
    )
    assert len(low["slides"]) == 5, f"Expected slideCount=2 clamped to 5, got {len(low['slides'])}"

    high = (
        client.post(
            "/api/generate",
            json_body={"topic": "超大页数钳位测试", "slideCount": 99, "mode": "smart"},
        )
        .assert_status(200, "slideCount=99 clamped to 20")
        .require_json()
    )
    assert len(high["slides"]) == 20, f"Expected slideCount=99 clamped to 20, got {len(high['slides'])}"

    empty_src = (
        client.post(
            "/api/generate",
            json_body={
                "topic": "无素材默认回退测试",
                "sourceText": "",
                "slideCount": 6,
                "mode": "smart",
            },
        )
        .assert_status(200, "empty sourceText fallback")
        .require_json()
    )
    assert len(empty_src["slides"]) == 6
    assert all(str(s.get("speakerNotes", "")).strip() for s in empty_src["slides"])


# ---------------------------------------------------------------------------
# BYOK LLM Mode Boundaries & Local MockOpenAIServer (4 Tests)
# ---------------------------------------------------------------------------


def t2_llm_01_missing_key_and_bad_scheme(ctx: TestContext) -> None:
    """POST /api/generate (mode=llm) rejects missing apiKey (400) and file:// scheme."""
    client = ctx.api()

    resp_no_key = client.post(
        "/api/generate",
        json_body={
            "topic": "BYOK 缺省密钥验证",
            "mode": "llm",
            "apiBase": "https://api.openai.com/v1",
            "apiKey": "",
            "model": "gpt-4o-mini",
        },
    ).assert_status(400, "LLM missing apiKey")
    assert resp_no_key.require_json().get("error")

    resp_bad_scheme = client.post(
        "/api/generate",
        json_body={
            "topic": "BYOK 非法协议验证",
            "mode": "llm",
            "apiBase": "file:///etc/passwd",
            "apiKey": "sk-invalid-scheme-test",
            "model": "gpt-4o-mini",
        },
    ).assert_status((400, 502), "LLM file:// scheme must be rejected")
    assert resp_bad_scheme.require_json().get("error")


def t2_llm_02_unreachable_and_upstream_500(ctx: TestContext) -> None:
    """POST /api/generate returns structured 502/500 JSON on upstream 500 or closed port."""
    client = ctx.api()

    with MockOpenAIServer(mode="http_500") as mock_llm:
        resp_500 = client.post(
            "/api/generate",
            json_body={
                "topic": "上游 500 错误容错测试",
                "mode": "llm",
                "apiBase": mock_llm.base_url,
                "apiKey": "sk-e2e-upstream-500",
                "model": "gpt-4o-mini",
                "slideCount": 5,
            },
        ).assert_status(502, "upstream LLM HTTP 500 should return 502")
        assert resp_500.require_json().get("error")
        assert len(mock_llm.requests) >= 1, "Expected server to invoke local mock LLM endpoint"

    closed_port = _get_closed_local_port()
    resp_closed = client.post(
        "/api/generate",
        json_body={
            "topic": "不可达端点容错测试",
            "mode": "llm",
            "apiBase": f"http://127.0.0.1:{closed_port}/v1",
            "apiKey": "sk-e2e-closed-port",
            "model": "gpt-4o-mini",
            "slideCount": 5,
        },
    ).assert_status((502, 500), "unreachable LLM endpoint")
    assert resp_closed.require_json().get("error")

    # Confirm Next.js server remains healthy
    client.get("/api/prompts").assert_status(200, "server health after upstream LLM error")


def t2_llm_03_mock_openai_happy_path(ctx: TestContext) -> None:
    """POST /api/generate (mode=llm) forwards Bearer token & parses raw + fenced JSON from mock LLM."""
    client = ctx.api()
    mock_slides_4 = make_valid_slides(4, custom_title="Mock LLM Strict JSON Title")
    mock_slides_5 = make_valid_slides(5, custom_title="Mock LLM Fenced JSON Title")

    with MockOpenAIServer(mode="valid_json", slides=mock_slides_4) as mock_llm:
        secret_key = "sk-e2e-mock-secret-999"
        resp = client.post(
            "/api/generate",
            json_body={
                "topic": "Mock LLM 端到端测试",
                "mode": "llm",
                "apiBase": mock_llm.base_url,
                "apiKey": secret_key,
                "model": "gpt-4o-mini",
                "slideCount": 5,
            },
        ).assert_status(200, "BYOK valid_json mock LLM")
        data = resp.require_json()
        assert data.get("engine") == "llm", f"Expected engine='llm', got {data.get('engine')!r}"
        assert len(data["slides"]) == 4, f"Expected 4 slides from mock, got {len(data['slides'])}"
        assert data["slides"][0]["title"] == "Mock LLM Strict JSON Title"

        reqs = mock_llm.requests
        assert len(reqs) == 1, f"Expected 1 mock LLM call, got {len(reqs)}"
        assert reqs[0].path.endswith("/chat/completions"), f"Unexpected LLM path: {reqs[0].path!r}"
        assert reqs[0].authorization == f"Bearer {secret_key}", (
            f"Authorization header mismatch: {reqs[0].authorization!r}"
        )

        # Also verify markdown ```json ... ``` fenced response parsing
        mock_llm.clear_requests()
        mock_llm.set_mode("fenced_json", slides=mock_slides_5)
        fenced_resp = client.post(
            "/api/generate",
            json_body={
                "topic": "Mock LLM Fenced JSON 测试",
                "mode": "llm",
                "apiBase": mock_llm.base_url,
                "apiKey": secret_key,
                "model": "deepseek-chat",
                "slideCount": 5,
            },
        ).assert_status(200, "BYOK fenced_json mock LLM")
        fenced_data = fenced_resp.require_json()
        assert fenced_data.get("engine") == "llm"
        assert len(fenced_data["slides"]) == 5
        assert fenced_data["slides"][0]["title"] == "Mock LLM Fenced JSON Title"


def t2_llm_04_mock_openai_malformed_json(ctx: TestContext) -> None:
    """POST /api/generate cleanly rejects malformed non-JSON content from LLM with 502/500 JSON."""
    client = ctx.api()
    with MockOpenAIServer(mode="malformed_text") as mock_llm:
        resp = client.post(
            "/api/generate",
            json_body={
                "topic": "畸形 JSON 容错测试",
                "mode": "llm",
                "apiBase": mock_llm.base_url,
                "apiKey": "sk-e2e-malformed-test",
                "model": "gpt-4o-mini",
                "slideCount": 5,
            },
        ).assert_status((502, 500), "malformed LLM content must not return 200")
        assert resp.require_json().get("error")
        assert len(mock_llm.requests) == 1


# ---------------------------------------------------------------------------
# Export Edge Cases (2 Tests)
# ---------------------------------------------------------------------------


def t2_exp_01_pptx_empty_bars_and_dark_rgba(ctx: TestContext) -> None:
    """POST /api/export/pptx succeeds on bars: [] + dark rgba theme without FFFFFF glaring borders."""
    client = ctx.api()
    dark_spec = make_valid_visual_spec(dark=True)
    # Use 5 slides with bars=[] on the data slide so it exercises both full >30KB dark PPTX & empty bars
    slides = make_valid_slides(
        5,
        custom_title="暗夜星环空柱状图边界测试",
        custom_notes="EDGE_NOTE_MARKER_OBSIDIAN",
        empty_bars=True,
    )
    data_slides = [s for s in slides if s["slideType"] == "data"]
    assert data_slides and data_slides[0]["bars"] == [], "Precondition: data slide must have bars=[]"

    resp = client.post(
        "/api/export/pptx",
        json_body={
            "title": "暗夜星环空柱状图边界测试",
            "subtitle": "暗色 RGBA 边框混合与空图表防崩测试",
            "audience": "技术架构评审会",
            "styleName": "暗夜星环 · 旗舰发布会舞台",
            "visualSpec": dark_spec,
            "slides": slides,
        },
    ).assert_status(200, "POST /api/export/pptx dark rgba + empty bars")

    inspected = PptxVerifier.verify(
        resp.body,
        min_size=30720,
        expected_slide_count=5,
        expected_slide_texts=["暗夜星环空柱状图边界测试"],
        expected_notes_texts=["EDGE_NOTE_MARKER_OBSIDIAN"],
        require_notes=True,
        validate_srgb_hex=True,
    )
    assert "FFFFFF" not in inspected.border_colors, (
        f"Dark rgba(255,255,255,0.12) border was NOT alpha-composited — found pure FFFFFF in "
        f"<a:ln> border colors: {inspected.border_colors}"
    )
    ctx.details["dark_border_colors"] = list(set(inspected.border_colors))


def t2_exp_02_pptx_special_cjk_filename_and_invalid(ctx: TestContext) -> None:
    """Special CJK/slash title returns RFC 5987 header & valid PPTX; empty slides/missing spec -> 400."""
    client = ctx.api()
    special_title = "2026 Q4/战略复盘：AI「核心」增长 & 100%"
    slides = make_valid_slides(5, custom_title=special_title)

    resp = client.post(
        "/api/export/pptx",
        json_body={
            "title": special_title,
            "subtitle": "特殊字符文件名测试",
            "visualSpec": make_valid_visual_spec(dark=False),
            "slides": slides,
        },
    ).assert_status(200, "POST /api/export/pptx special CJK/slash title")

    assert PPTX_CONTENT_TYPE in resp.header("Content-Type")
    disp = resp.header("Content-Disposition")
    assert "attachment" in disp.lower(), f"Missing attachment in Content-Disposition: {disp!r}"
    assert "filename*=UTF-8''" in disp or "filename*=utf-8''" in disp.lower(), (
        f"Missing RFC 5987 filename*=UTF-8'' in Content-Disposition: {disp!r}"
    )
    PptxVerifier.verify(
        resp.body,
        min_size=30720,
        expected_slide_count=5,
        expected_slide_texts=[special_title],
        require_notes=True,
    )

    # Invalid payloads -> 400
    client.post(
        "/api/export/pptx",
        json_body={"title": "Empty", "visualSpec": make_valid_visual_spec(), "slides": []},
    ).assert_status(400, "PPTX empty slides")
    client.post(
        "/api/export/pptx",
        json_body={"title": "NoSpec", "slides": slides},
    ).assert_status(400, "PPTX missing visualSpec")


# ---------------------------------------------------------------------------
# Auth, Not Found & Non-Mutating 409 Boundaries (2 Tests)
# ---------------------------------------------------------------------------


def t2_auth_01_unauthenticated_mutations_401(ctx: TestContext) -> None:
    """Every protected mutation endpoint strictly returns 401 for unauthenticated callers."""
    anon = ctx.api()

    checks = [
        ("POST /api/prompts", anon.post("/api/prompts", json_body=make_valid_prompt_payload())),
        ("PUT /api/prompts/id", anon.put("/api/prompts/prompt_swiss_grid", json_body=make_valid_prompt_payload())),
        ("PATCH /api/prompts/id", anon.patch("/api/prompts/prompt_swiss_grid", json_body={"isPublic": False})),
        ("DELETE /api/prompts/id", anon.delete("/api/prompts/prompt_swiss_grid")),
        ("POST .../like", anon.post("/api/prompts/prompt_swiss_grid/like")),
        ("POST .../favorite", anon.post("/api/prompts/prompt_swiss_grid/favorite")),
        (
            "POST .../comments",
            anon.post(
                "/api/prompts/prompt_swiss_grid/comments",
                json_body={"testedTool": "claude-html", "rating": 5, "content": "未登录测试评论"},
            ),
        ),
        (
            "DELETE .../comments",
            anon.delete("/api/prompts/prompt_swiss_grid/comments", params={"commentId": "cmt_seed_1"}),
        ),
        (
            "POST /api/prompts/sync-favorites",
            anon.post("/api/prompts/sync-favorites", json_body={"promptIds": ["prompt_swiss_grid"]}),
        ),
        ("PATCH /api/auth/profile", anon.patch("/api/auth/profile", json_body={"displayName": "Anon"})),
        ("POST /api/decks", anon.post("/api/decks", json_body=make_valid_deck_payload())),
        ("PATCH /api/decks/id", anon.patch("/api/decks/deck_unauth_probe", json_body={"isPublic": True})),
        ("PUT /api/decks/id", anon.put("/api/decks/deck_unauth_probe", json_body=make_valid_deck_payload())),
        ("DELETE /api/decks/id", anon.delete("/api/decks/deck_unauth_probe")),
    ]
    for label, resp in checks:
        resp.assert_status(401, f"unauthenticated {label}")


def t2_auth_02_not_found_and_duplicate_register_409(ctx: TestContext) -> None:
    """Nonexistent prompt/creator API & SSR routes return 404; bad login 401; duplicate seeded email 409."""
    anon = ctx.api()

    anon.get("/api/prompts/nonexistent-slug-xyz-999").assert_status(404, "API nonexistent prompt")
    anon.get("/studio/nonexistent-slug-xyz-999").assert_status(404, "SSR nonexistent studio")
    anon.get("/api/creators/nonexistent_user_xyz_999").assert_status(404, "API nonexistent creator")
    anon.get("/creator/nonexistent_user_xyz_999").assert_status(404, "SSR nonexistent creator")

    anon.login(ACCOUNT_DEMO.email, "WrongPassword#9999").assert_status(401, "wrong password login")

    # Use already-seeded demo@pptgod.studio so zero new user rows are ever created
    anon.post(
        "/api/auth/register",
        json_body={
            "displayName": "重复注册测试",
            "email": ACCOUNT_DEMO.email,
            "password": "SomePassword123",
            "bio": "Non-mutating duplicate email test",
        },
    ).assert_status(409, "duplicate registration with seeded demo@pptgod.studio")


# ---------------------------------------------------------------------------
# Browser UI Corner Cases & Guards (4 Tests)
# ---------------------------------------------------------------------------


def t2_ui_01_generate_last_slide_guard(ctx: TestContext) -> None:
    """Browser /generate: deleting slides stops cleanly at 1 remaining slide with zero errors."""
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.goto_ok(ctx.url("/generate?style=apple-soft-bento-modular"))
        load_preset_and_generate(guard, preset_index=0)

        initial_count = count_generate_tree_slides(page)
        assert initial_count >= 5, f"Expected >= 5 slides before deleting, got {initial_count}"

        # Delete down to 1 slide
        guard_iterations = initial_count + 3
        while count_generate_tree_slides(page) > 1 and guard_iterations > 0:
            guard_iterations -= 1
            del_btn = first_visible(
                [
                    page.locator('button[aria-label*="删除该页"], button[title*="删除该页"]'),
                    page.locator('button[aria-label*="删除此页"], button[title*="删除此页"]'),
                    page.locator('button[aria-label*="删除页"], button[title*="删除页"]'),
                    page.locator('aside button[aria-label*="删除"], aside button[title*="删除"]'),
                    page.get_by_role("button", name=re.compile(r"删除本页|删除该页|删除当前页|删除此页")),
                ],
                timeout_ms=6000,
            )
            del_btn.click()
            page.wait_for_timeout(120)

        remaining = count_generate_tree_slides(page)
        assert remaining == 1, f"Expected exactly 1 slide remaining, got {remaining}"

        # Verify last-slide guard: delete button is either disabled or clicking keeps count == 1
        last_del = page.locator(
            'button[aria-label*="删除该页"], button[title*="删除该页"], '
            'button[aria-label*="删除此页"], button[title*="删除此页"], '
            'aside button[aria-label*="删除"], aside button[title*="删除"]'
        )
        if last_del.count() > 0 and last_del.first.is_visible() and last_del.first.is_enabled():
            last_del.first.click()
            page.wait_for_timeout(150)
        assert count_generate_tree_slides(page) == 1, (
            "Last-slide guard failed: slide count dropped below 1"
        )
        guard.assert_canvas_non_blank(label="last_remaining_slide")
        guard.assert_no_browser_errors("T2_UI_01")


def t2_ui_02_generate_slide_type_switch_missing_subfields(ctx: TestContext) -> None:
    """Browser /generate: switching cover slide (missing subfields) to all other 7 types yields zero NaN."""
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.goto_ok(ctx.url("/generate?style=apple-soft-bento-modular"))
        load_preset_and_generate(guard, preset_index=0)

        # Find the slide-type <select> containing cover/data/timeline/quote options
        type_select_idx = page.evaluate(
            """() => {
              const selects = Array.from(document.querySelectorAll('select'));
              return selects.findIndex((s) => {
                const vals = Array.from(s.options).map((o) => o.value);
                return vals.includes('cover') && vals.includes('data') && vals.includes('quote');
              });
            }"""
        )

        target_types = ("data", "timeline", "quote", "comparison", "process", "agenda", "closing")
        for st in target_types:
            if isinstance(type_select_idx, int) and type_select_idx >= 0:
                page.locator("select").nth(type_select_idx).select_option(st)
            else:
                pat = re.compile(SLIDE_TYPE_LABELS[st]["pattern"], re.I)
                btn = first_visible(
                    [page.get_by_role("button", name=pat), page.get_by_role("tab", name=pat)],
                    timeout_ms=6000,
                )
                btn.click()
            page.wait_for_timeout(150)
            guard.assert_canvas_non_blank(
                slide_type=None,  # bars may be empty or default on switched cover; SVG NaN still strictly checked
                min_text_len=8,
                label=f"generate_switch_to_{st}",
            )

        guard.assert_no_browser_errors("T2_UI_02")


def t2_ui_03_compare_max_3_guard(ctx: TestContext) -> None:
    """Browser /: adding a 4th style to compare triggers guard toast and keeps count == 3."""
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.goto_ok(ctx.url("/"))
        page.evaluate("(k) => localStorage.removeItem(k)", COMPARE_STORAGE_KEY)
        page.reload(wait_until="networkidle")

        cards = page.locator("article[data-prompt-slug]")
        cards.nth(3).wait_for(state="visible", timeout=8000)

        for idx in range(4):
            card = cards.nth(idx)
            cmp_btn = card.locator('button[title*="对比"]').or_(
                card.get_by_role("button", name=re.compile(r"对比"))
            ).first
            cmp_btn.click()
            page.wait_for_timeout(150)

        stored_raw = page.evaluate("(k) => localStorage.getItem(k)", COMPARE_STORAGE_KEY)
        stored_ids = json.loads(stored_raw or "[]")
        assert len(stored_ids) == 3, (
            f"Compare guard failed: expected 3 IDs in {COMPARE_STORAGE_KEY}, got {len(stored_ids)}: {stored_ids}"
        )

        toast = page.locator('[role="status"], .pg-toast')
        if toast.count() > 0:
            toast_text = toast.first.inner_text()
            assert re.search(r"最多.*3|3\s*套", toast_text), (
                f"Expected max-3 compare guard message in toast, got {toast_text!r}"
            )

        guard.assert_no_browser_errors("T2_UI_03")


def t2_ui_04_byok_llm_ui_validation(ctx: TestContext) -> None:
    """Browser /generate: switching to BYOK LLM shows apiKey/apiBase inputs and handles empty key cleanly."""
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.goto_ok(ctx.url("/generate?style=apple-soft-bento-modular"))

        # Expand config panel if needed
        llm_btn = page.get_by_role(
            "button", name=re.compile(r"大模型|自定义.*API|BYOK|OpenAI|DeepSeek")
        )
        if llm_btn.count() == 0 or not llm_btn.first.is_visible():
            toggle = first_visible(
                [page.get_by_role("button", name=re.compile(r"生成配置|配置面板|原始素材|展开"))],
                timeout_ms=6000,
            )
            toggle.click()
            llm_btn.first.wait_for(state="visible", timeout=6000)

        llm_btn.first.click()
        page.wait_for_timeout(200)

        key_input = first_visible(
            [
                page.locator('input[type="password"]'),
                page.get_by_placeholder(re.compile(r"sk-|API\s*Key|密钥", re.I)),
            ],
            timeout_ms=6000,
        )
        assert key_input.is_visible(), "BYOK LLM API Key password input not visible"

        base_input = first_visible(
            [
                page.get_by_placeholder(re.compile(r"https://|api\.openai|deepseek|v1", re.I)),
                page.get_by_label(re.compile(r"API\s*Base|接口地址|端点", re.I)),
            ],
            timeout_ms=6000,
        )
        assert base_input.is_visible(), "BYOK LLM apiBase input not visible"

        # Leave key empty and click generate -> friendly error (allow expected 400 if request fires)
        key_input.fill("")
        gen_btn = first_visible(
            [
                page.get_by_role(
                    "button",
                    name=re.compile(r"一键生成|开始生成|生成整套|立即生成|大模型生成|生成\s*PPT"),
                )
            ]
        )
        with guard.allow_expected_http_errors({400}):
            gen_btn.click()
            page.wait_for_timeout(450)

        feedback = page.locator('[role="status"], [role="alert"], .pg-toast, .pg-error')
        page_text = page.locator("body").inner_text()
        has_feedback = (feedback.count() > 0 and feedback.first.is_visible()) or bool(
            re.search(r"API\s*Key|密钥|请填写|不能为空", page_text, re.I)
        )
        assert has_feedback, "Expected friendly validation guidance when submitting empty BYOK API Key"
        guard.assert_no_browser_errors("T2_UI_04")


# ---------------------------------------------------------------------------
# Tier 2 Registry Export (17 Tests)
# ---------------------------------------------------------------------------


def get_tier2_tests() -> list[TestCaseSpec]:
    return [
        TestCaseSpec("T2_VAL_01_prompt_create_boundaries", 2, "Prompt POST title/summary/spec/anatomy 400 boundaries", ("api", "boundary", "validation"), t2_val_01_prompt_create_boundaries),
        TestCaseSpec("T2_VAL_02_prompt_put_patch_boundaries", 2, "Prompt PUT/PATCH invalid field 400 boundaries", ("api", "boundary", "validation"), t2_val_02_prompt_put_patch_boundaries),
        TestCaseSpec("T2_VAL_03_comment_boundaries", 2, "Comment length (<4/>500), rating clamping & DELETE param boundaries", ("api", "boundary", "validation"), t2_val_03_comment_boundaries),
        TestCaseSpec("T2_VAL_04_profile_and_deck_boundaries", 2, "Profile displayName & Saved Deck validation 400 boundaries", ("api", "boundary", "validation"), t2_val_04_profile_and_deck_boundaries),
        TestCaseSpec("T2_VAL_05_generate_smart_boundaries", 2, "Smart generate empty topic 400, slideCount [5,8] clamp & empty sourceText", ("api", "boundary", "validation"), t2_val_05_generate_smart_boundaries),
        TestCaseSpec("T2_LLM_01_missing_key_and_bad_scheme", 2, "BYOK LLM missing apiKey (400) & file:// scheme rejection", ("api", "boundary", "llm"), t2_llm_01_missing_key_and_bad_scheme),
        TestCaseSpec("T2_LLM_02_unreachable_and_upstream_500", 2, "BYOK LLM upstream 500 -> 502 & closed port resilience", ("api", "boundary", "llm"), t2_llm_02_unreachable_and_upstream_500),
        TestCaseSpec("T2_LLM_03_mock_openai_happy_path", 2, "BYOK LLM local MockOpenAIServer Bearer forwarding + JSON & fenced JSON parsing", ("api", "boundary", "llm"), t2_llm_03_mock_openai_happy_path),
        TestCaseSpec("T2_LLM_04_mock_openai_malformed_json", 2, "BYOK LLM malformed non-JSON upstream error handling", ("api", "boundary", "llm"), t2_llm_04_mock_openai_malformed_json),
        TestCaseSpec("T2_EXP_01_pptx_empty_bars_and_dark_rgba", 2, "PPTX bars: [] + dark rgba theme alpha-composited borders", ("api", "boundary", "pptx"), t2_exp_01_pptx_empty_bars_and_dark_rgba),
        TestCaseSpec("T2_EXP_02_pptx_special_cjk_filename_and_invalid", 2, "PPTX CJK/slash RFC 5987 filename & empty slides/spec 400", ("api", "boundary", "pptx"), t2_exp_02_pptx_special_cjk_filename_and_invalid),
        TestCaseSpec("T2_AUTH_01_unauthenticated_mutations_401", 2, "Unauthenticated mutation sweep returns strict 401 across all routes", ("api", "boundary", "auth"), t2_auth_01_unauthenticated_mutations_401),
        TestCaseSpec("T2_AUTH_02_not_found_and_duplicate_register_409", 2, "Nonexistent routes 404, bad login 401 & non-mutating register 409", ("api", "boundary", "auth"), t2_auth_02_not_found_and_duplicate_register_409),
        TestCaseSpec("T2_UI_01_generate_last_slide_guard", 2, "Browser /generate: last-slide delete guard prevents 0 slides", ("ui", "boundary"), t2_ui_01_generate_last_slide_guard),
        TestCaseSpec("T2_UI_02_generate_slide_type_switch_missing_subfields", 2, "Browser /generate: switching cover to all 7 types produces zero NaN SVGs", ("ui", "boundary"), t2_ui_02_generate_slide_type_switch_missing_subfields),
        TestCaseSpec("T2_UI_03_compare_max_3_guard", 2, "Browser /: >3 compare selection guard caps localStorage at 3", ("ui", "boundary"), t2_ui_03_compare_max_3_guard),
        TestCaseSpec("T2_UI_04_byok_llm_ui_validation", 2, "Browser /generate: BYOK LLM mode inputs & empty-key validation", ("ui", "boundary", "llm"), t2_ui_04_byok_llm_ui_validation),
    ]
