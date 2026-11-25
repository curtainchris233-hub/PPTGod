"""Tier 4 E2E Tests: 5 Real-World Personas, Desktop/Mobile RWD, Vanilla CSS Aesthetics & 8 Screenshots.

Contains 10 granular tests:
- T4_SCN_01 .. T4_SCN_05 (5 realistic end-to-end workloads)
- T4_RWD_01, T4_RWD_02 (Desktop 1440x900 & Mobile 390x844 across all 7 routes)
- T4_CSS_01, T4_CSS_02 (Zero-TailwindCSS static audit & editorial computed-style discipline)
- T4_SHOT_01 (Deterministic capture of all 8 walkthrough PNG screenshots)
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from tests.e2e.config import (
    ACCOUNT_CHEN,
    ACCOUNT_DEMO,
    ALL_SEVEN_ROUTES,
    COMPARE_STORAGE_KEY,
    DESKTOP_VIEWPORT,
    GUEST_FAVS_STORAGE_KEY,
    MOBILE_VIEWPORT,
    REQUIRED_SCREENSHOTS,
    SLIDE_TYPES,
    SOURCE_MATERIAL_PRESETS,
    make_valid_deck_payload,
    make_valid_prompt_payload,
    unique_token,
)
from tests.e2e.helpers import (
    HtmlDeckVerifier,
    PptxVerifier,
    TestCaseSpec,
    TestContext,
    first_visible,
)
from tests.e2e.tier1_features import (
    count_generate_tree_slides,
    load_preset_and_generate,
    switch_generate_style_to_dark_obsidian,
)


# ---------------------------------------------------------------------------
# 5 Realistic End-to-End Personas / Workloads
# ---------------------------------------------------------------------------


def t4_scn_01_executive_q4_board_review(ctx: TestContext) -> None:
    """Persona 1: Executive Q4 Board Review -> edit KPI & bars -> save private -> verify in .pptx XML."""
    author = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    preset = SOURCE_MATERIAL_PRESETS[1]  # preset_q4_strategy

    gen_data = (
        author.post(
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
        .assert_status(200, "Persona 1 smart generate")
        .require_json()
    )
    slides = gen_data["slides"]
    assert len(slides) == 7

    # Edit executive KPI & bars on data slide
    kpi_marker = f"ARR 3.1亿元 ({unique_token('Q4')[:6]})"
    data_slide = next((s for s in slides if s.get("slideType") == "data"), slides[1])
    data_slide["kpis"] = [
        {"label": "年度经常性收入", "value": kpi_marker, "note": "董事会复盘修正口径"},
        {"label": "毛利率", "value": "76.5%", "note": "+8.5pp YoY"},
        {"label": "战略客户 NRR", "value": "128%", "note": "KA 增购驱动"},
    ]
    data_slide["bars"] = [
        {"label": "Q1", "v1": 52, "v2": 68},
        {"label": "Q2", "v1": 58, "v2": 82},
        {"label": "Q3", "v1": 65, "v2": 104},
        {"label": "Q4", "v1": 74, "v2": 136},
    ]

    mckinsey = (
        author.get("/api/prompts/mckinsey-executive-insight")
        .assert_status(200)
        .require_json()["prompt"]
    )

    with ctx.cleanup() as cleanup:
        saved = (
            author.post(
                "/api/decks",
                json_body={
                    "title": f"[E2E-P1] {preset['topic']}",
                    "subtitle": preset["subtitle"],
                    "audience": preset["audience"],
                    "promptId": mckinsey["id"],
                    "promptSlug": mckinsey["slug"],
                    "promptTitle": mckinsey["title"],
                    "visualSpec": mckinsey["visualSpec"],
                    "slides": slides,
                },
            )
            .assert_status(201, "Persona 1 save private deck")
            .require_json()["deck"]
        )
        cleanup.register_delete_deck(author, saved["id"])
        assert saved["isPublic"] is False

        pptx_resp = author.post(
            "/api/export/pptx",
            json_body={
                "title": saved["title"],
                "subtitle": saved["subtitle"],
                "audience": saved["audience"],
                "styleName": mckinsey["title"],
                "visualSpec": mckinsey["visualSpec"],
                "slides": saved["slides"],
            },
        ).assert_status(200, "Persona 1 export .pptx")

        PptxVerifier.verify(
            pptx_resp.body,
            min_size=30720,
            expected_slide_count=7,
            expected_slide_texts=[kpi_marker],
            require_notes=True,
        )


def t4_scn_02_ai_product_launch_keynote(ctx: TestContext) -> None:
    """Persona 2: AI Product Launch Keynote -> dark obsidian re-skin -> add quote slide -> notes in .pptx & .html."""
    note_marker = f"KEYNOTE_SPEAKER_NOTE_E2E_{unique_token('K')}"
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.goto_ok(ctx.url("/generate?style=apple-soft-bento-modular"))

        load_preset_and_generate(guard, preset_index=0)
        before_count = count_generate_tree_slides(page)

        # Live re-skin to keynote-obsidian-stage
        switch_generate_style_to_dark_obsidian(guard)

        # Add a new slide (choose quote if type menu opens)
        add_btn = first_visible(
            [page.get_by_role("button", name=re.compile(r"新增|添加.*页|\+\s*加页|\+\s*新增"))]
        )
        add_btn.click()
        page.wait_for_timeout(180)
        quote_choice = page.get_by_role("button", name=re.compile(r"金句页|Spotlight|Quote", re.I))
        if quote_choice.count() > 0 and quote_choice.first.is_visible():
            quote_choice.first.click()
            page.wait_for_timeout(200)

        after_count = count_generate_tree_slides(page)
        assert after_count >= before_count + 1, (
            f"Persona 2: expected slide count to increase ({before_count} -> {after_count})"
        )

        # Edit speaker notes on the newly added slide
        notes_inp = first_visible(
            [
                page.get_by_label(re.compile(r"演讲者备注|演讲逐字稿|讲稿")),
                page.get_by_placeholder(re.compile(r"演讲|讲稿|备注")),
            ]
        )
        notes_inp.fill(note_marker)
        page.wait_for_timeout(150)

        # Export .pptx and verify notes + no FFFFFF dark borders
        pptx_btn = first_visible(
            [page.get_by_role("button", name=re.compile(r"导出.*\.pptx|下载.*PPTX", re.I))]
        )
        _, pptx_bytes = guard.capture_download(lambda: pptx_btn.click())
        inspected = PptxVerifier.verify(
            pptx_bytes,
            min_size=30720,
            expected_min_slides=after_count,
            expected_notes_texts=[note_marker],
            require_notes=True,
        )
        assert "FFFFFF" not in inspected.border_colors, (
            f"Persona 2 dark obsidian PPTX has non-composited FFFFFF borders: {inspected.border_colors}"
        )

        # Export .html and verify notes in data-notes + offline hygiene
        html_btn = first_visible(
            [page.get_by_role("button", name=re.compile(r"导出.*\.html|离线.*HTML|交互.*HTML", re.I))]
        )
        _, html_bytes = guard.capture_download(lambda: html_btn.click())
        HtmlDeckVerifier.verify(
            html_bytes,
            expected_min_slides=after_count,
            expected_notes_texts=[note_marker],
        )
        guard.assert_no_browser_errors("T4_SCN_02")


def t4_scn_03_academic_thesis_defense(ctx: TestContext) -> None:
    """Persona 3: Academic Thesis Defense 8-slide deck covers all 8 SlideTypes & valid 8-slide .pptx."""
    client = ctx.api()
    preset = SOURCE_MATERIAL_PRESETS[2]  # preset_academic_defense

    gen_data = (
        client.post(
            "/api/generate",
            json_body={
                "topic": preset["topic"],
                "subtitle": preset["subtitle"],
                "audience": preset["audience"],
                "scenario": preset["scenario"],
                "sourceText": preset["rawText"],
                "slideCount": 8,
                "mode": "smart",
            },
        )
        .assert_status(200, "Persona 3 8-slide smart generate")
        .require_json()
    )
    slides = gen_data["slides"]
    assert len(slides) == 8, f"Expected 8 slides, got {len(slides)}"
    generated_types = {s["slideType"] for s in slides}
    assert generated_types == set(SLIDE_TYPES), (
        f"Expected all 8 SlideTypes in 8-slide academic deck; missing={set(SLIDE_TYPES) - generated_types}"
    )

    academic_style = (
        client.get("/api/prompts/academic-symposium-latex")
        .assert_status(200)
        .require_json()["prompt"]
    )
    pptx_resp = client.post(
        "/api/export/pptx",
        json_body={
            "title": preset["topic"],
            "subtitle": preset["subtitle"],
            "audience": preset["audience"],
            "styleName": academic_style["title"],
            "visualSpec": academic_style["visualSpec"],
            "slides": slides,
        },
    ).assert_status(200, "Persona 3 8-slide .pptx export")

    PptxVerifier.verify(
        pptx_resp.body,
        min_size=30720,
        expected_slide_count=8,
        expected_slide_texts=[slides[0]["title"]],
        require_notes=True,
    )


def t4_scn_04_brand_curator_remix_and_review(ctx: TestContext) -> None:
    """Persona 4: Brand curator remixes Swiss Grid, posts 5-star claude-html review, creator impact +1."""
    author = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    baseline = (
        author.get(f"/api/creators/{ACCOUNT_DEMO.username}")
        .assert_status(200)
        .require_json()
    )
    base_published = int(baseline["impact"]["publishedCount"])

    with ctx.cleanup() as cleanup:
        payload = make_valid_prompt_payload(
            title_prefix="[E2E-P4-CURATOR]",
            is_public=True,
            remixed_from_id="prompt_swiss_grid",
        )
        remix = (
            author.post("/api/prompts", json_body=payload)
            .assert_status(201)
            .require_json()["prompt"]
        )
        pid = remix["id"]
        cleanup.register_delete_prompt(author, pid)
        assert (remix.get("remixedFrom") or {}).get("slug") == "swiss-international-grid"

        review_text = f"[E2E-P4-REVIEW-{unique_token('R')}] Claude HTML 实测排版与网格比例极佳"
        comments = (
            author.post(
                f"/api/prompts/{pid}/comments",
                json_body={"testedTool": "claude-html", "rating": 5, "content": review_text},
            )
            .assert_status(201)
            .require_json()["comments"]
        )
        created_cmt = next(c for c in comments if c.get("content") == review_text)
        cleanup.register_delete_comment(author, pid, created_cmt["id"])

        # Verify on Studio API & Creator Profile impact increment
        detail = author.get(f"/api/prompts/{pid}").assert_status(200).require_json()["prompt"]
        assert int(detail["commentsCount"]) >= 1

        after_creator = (
            author.get(f"/api/creators/{ACCOUNT_DEMO.username}")
            .assert_status(200)
            .require_json()
        )
        assert int(after_creator["impact"]["publishedCount"]) == base_published + 1
        assert any(p["id"] == pid for p in after_creator["prompts"])


def t4_scn_05_confidential_enterprise_deck_and_share_clone(ctx: TestContext) -> None:
    """Persona 5: Confidential private prompt + private deck -> zero leak -> public deck -> User B clones."""
    anon = ctx.api()
    author_a = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    user_b = ctx.api_logged_in(ACCOUNT_CHEN.email, ACCOUNT_CHEN.password)

    secret_tok = f"CONF_ENT_{unique_token('E')}"
    with ctx.cleanup() as cleanup:
        priv_prompt = (
            author_a.post(
                "/api/prompts",
                json_body=make_valid_prompt_payload(
                    title=f"[E2E] {secret_tok}", is_public=False
                ),
            )
            .assert_status(201)
            .require_json()["prompt"]
        )
        cleanup.register_delete_prompt(author_a, priv_prompt["id"])

        orig_deck_title = f"[E2E-P5] 机密商业方案 {secret_tok}"
        priv_deck = (
            author_a.post(
                "/api/decks",
                json_body=make_valid_deck_payload(title=orig_deck_title, is_public=None),
            )
            .assert_status(201)
            .require_json()["deck"]
        )
        deck_id = priv_deck["id"]
        cleanup.register_delete_deck(author_a, deck_id)
        assert priv_deck["isPublic"] is False

        # Zero leakage while private
        anon.get(f"/api/prompts/{priv_prompt['id']}").assert_status(404)
        user_b.get(f"/api/prompts/{priv_prompt['id']}").assert_status(404)
        ssr_studio = anon.get(f"/studio/{priv_prompt['slug']}").assert_status(404)
        assert secret_tok not in ssr_studio.text()
        anon.get(f"/api/decks/{deck_id}").assert_status(403)
        user_b.get(f"/api/decks/{deck_id}").assert_status(403)

        # Author A flips deck to Public Share -> User B views & non-destructively clones
        author_a.patch(f"/api/decks/{deck_id}", json_body={"isPublic": True}).assert_status(200)
        viewed_by_b = user_b.get(f"/api/decks/{deck_id}").assert_status(200).require_json()["deck"]
        assert viewed_by_b["title"] == orig_deck_title

        clone_title = f"[E2E-P5-CLONE] 二次编辑副本 {secret_tok}"
        cloned = (
            user_b.post(
                "/api/decks",
                json_body=make_valid_deck_payload(title=clone_title, deck_id=deck_id),
            )
            .assert_status((201, 200))
            .require_json()["deck"]
        )
        cleanup.register_delete_deck(user_b, cloned["id"])

        assert cloned["id"] != deck_id
        assert cloned["authorId"] == ACCOUNT_CHEN.id
        still_orig = author_a.get(f"/api/decks/{deck_id}").assert_status(200).require_json()["deck"]
        assert still_orig["title"] == orig_deck_title


# ---------------------------------------------------------------------------
# Responsive Viewports (Desktop 1440x900 & Mobile 390x844 Across All 7 Routes)
# ---------------------------------------------------------------------------


def _run_responsive_sweep(
    ctx: TestContext,
    viewport: tuple[int, int],
    label: str,
) -> None:
    with ctx.open_page(viewport=viewport) as guard:
        guard.login_via_api(ctx.base_url, ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
        metrics: dict[str, dict[str, int]] = {}
        for route in ALL_SEVEN_ROUTES:
            guard.goto_ok(ctx.url(route))
            guard.page.wait_for_timeout(300)
            scroll_w, inner_w = guard.assert_no_horizontal_overflow(
                tolerance_px=2,
                label=f"{label}:{route}",
            )
            metrics[route] = {"scrollWidth": scroll_w, "innerWidth": inner_w}
        guard.assert_no_browser_errors(label)
        ctx.details["viewports"] = metrics


def t4_rwd_01_desktop_1440x900_all_7_routes(ctx: TestContext) -> None:
    """Desktop 1440x900: all 7 routes render with zero horizontal overflow & zero browser errors."""
    _run_responsive_sweep(ctx, DESKTOP_VIEWPORT, "T4_RWD_01_desktop")


def t4_rwd_02_mobile_390x844_all_7_routes(ctx: TestContext) -> None:
    """Mobile 390x844: all 7 routes render with zero horizontal overflow & zero browser errors."""
    _run_responsive_sweep(ctx, MOBILE_VIEWPORT, "T4_RWD_02_mobile")


# ---------------------------------------------------------------------------
# Aesthetic & Vanilla CSS Stack Discipline
# ---------------------------------------------------------------------------


def t4_css_01_zero_tailwindcss_static_audit(ctx: TestContext) -> None:
    """Static read-only audit: package.json has zero tailwind/postcss & src/ has zero @tailwind/@apply."""
    repo_root = ctx.config.repo_root
    pkg_path = repo_root / "package.json"
    assert pkg_path.exists(), f"package.json not found at {pkg_path}"

    pkg = json.loads(pkg_path.read_text(encoding="utf-8"))
    all_deps = {
        **(pkg.get("dependencies") or {}),
        **(pkg.get("devDependencies") or {}),
    }
    forbidden_deps = [
        dep for dep in all_deps if re.search(r"tailwind|postcss", dep, re.IGNORECASE)
    ]
    assert not forbidden_deps, f"Prohibited TailwindCSS/PostCSS dependencies in package.json: {forbidden_deps}"

    src_dir = repo_root / "src"
    assert src_dir.exists(), f"src directory not found at {src_dir}"
    directive_re = re.compile(r"@tailwind\b|@import\s+['\"]tailwindcss['\"]|@apply\s+", re.IGNORECASE)
    violations: list[str] = []
    scanned = 0
    for ext in ("*.css", "*.ts", "*.tsx"):
        for path in src_dir.rglob(ext):
            scanned += 1
            text = path.read_text(encoding="utf-8", errors="ignore")
            for match in directive_re.finditer(text):
                rel = path.relative_to(repo_root)
                violations.append(f"{rel}: {match.group(0)!r}")
    assert scanned > 0, "Static audit scanned zero files in src/"
    assert not violations, f"Prohibited Tailwind directives found in src/: {violations[:10]}"
    ctx.details["scanned_src_files"] = scanned


def t4_css_02_editorial_aesthetic_computed_styles(ctx: TestContext) -> None:
    """Computed-style browser audit: warm paper #f5f2eb, zero gradient text, zero neon glow, zero grid bg."""
    routes_to_audit = ("/", "/studio/apple-soft-bento-modular", "/generate")
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        audits: dict[str, str] = {}
        for route in routes_to_audit:
            guard.goto_ok(ctx.url(route))
            guard.page.wait_for_timeout(300)
            res = guard.assert_editorial_aesthetics(label=f"T4_CSS_02:{route}")
            audits[route] = res["bodyBg"]
        guard.assert_no_browser_errors("T4_CSS_02")
        ctx.details["body_backgrounds"] = audits


# ---------------------------------------------------------------------------
# 8 Mandatory Desktop (1440x900) Walkthrough Screenshots
# ---------------------------------------------------------------------------


def t4_shot_01_capture_8_walkthrough_views(ctx: TestContext) -> None:
    """Capture all 8 mandatory 1440x900 PNG screenshots into --screenshots-dir (or temp_dir)."""
    out_dir: Path = ctx.config.screenshots_dir or (ctx.temp_dir / "screenshots")
    out_dir.mkdir(parents=True, exist_ok=True)
    captured_sizes: dict[str, int] = {}

    # 1-5 & 8: Guest views in clean isolated context
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page

        # 01_gallery_home.png
        guard.goto_ok(ctx.url("/"))
        page.evaluate(
            "([k1, k2]) => { localStorage.removeItem(k1); localStorage.removeItem(k2); }",
            [COMPARE_STORAGE_KEY, GUEST_FAVS_STORAGE_KEY],
        )
        guard.goto_ok(ctx.url("/"))
        page.locator("article[data-prompt-slug]").first.wait_for(state="visible")
        guard.stabilize_for_screenshot()
        raw = guard.save_screenshot(out_dir / "01_gallery_home.png", full_page=False)
        captured_sizes["01_gallery_home.png"] = len(raw)

        # 02_style_matcher_modal.png
        modal = guard.drive_style_matcher_modal()
        assert modal.locator('a[href^="/studio/"]').count() >= 3
        guard.stabilize_for_screenshot()
        raw = guard.save_screenshot(out_dir / "02_style_matcher_modal.png", full_page=False)
        captured_sizes["02_style_matcher_modal.png"] = len(raw)
        page.keyboard.press("Escape")

        # 03_studio_bento.png
        guard.goto_ok(ctx.url("/studio/apple-soft-bento-modular"))
        guard.assert_canvas_non_blank(label="shot_03_studio")
        guard.stabilize_for_screenshot()
        raw = guard.save_screenshot(out_dir / "03_studio_bento.png", full_page=False)
        captured_sizes["03_studio_bento.png"] = len(raw)

        # 04_generate_workshop.png
        guard.goto_ok(ctx.url("/generate?style=apple-soft-bento-modular"))
        load_preset_and_generate(guard, preset_index=0)
        # Collapse config panel if there's an explicit collapse button covering the stage
        collapse_btn = page.get_by_role("button", name=re.compile(r"收起配置|折叠配置|收起面板"))
        if collapse_btn.count() > 0 and collapse_btn.first.is_visible():
            collapse_btn.first.click()
            page.wait_for_timeout(150)
        guard.assert_canvas_non_blank(label="shot_04_generate")
        guard.stabilize_for_screenshot()
        raw = guard.save_screenshot(out_dir / "04_generate_workshop.png", full_page=False)
        captured_sizes["04_generate_workshop.png"] = len(raw)

        # 05_compare_board.png
        guard.goto_ok(ctx.url("/compare"))
        preset_btn = page.locator("#pg-compare-preset-btn").or_(
            page.get_by_role("button", name=re.compile(r"一键载入.*三套|载入经典"))
        )
        if preset_btn.count() > 0 and preset_btn.first.is_visible():
            preset_btn.first.click()
            page.wait_for_timeout(300)
        data_tab = page.get_by_role("tab", name=re.compile(r"数据|Insight", re.I)).or_(
            page.get_by_role("button", name=re.compile(r"数据|Insight", re.I))
        )
        if data_tab.count() > 0 and data_tab.first.is_visible():
            data_tab.first.click()
            page.wait_for_timeout(200)
        guard.stabilize_for_screenshot()
        raw = guard.save_screenshot(out_dir / "05_compare_board.png", full_page=False)
        captured_sizes["05_compare_board.png"] = len(raw)

        # 08_creator_profile.png
        guard.goto_ok(ctx.url("/creator/pptgod_lab"))
        guard.stabilize_for_screenshot()
        raw = guard.save_screenshot(out_dir / "08_creator_profile.png", full_page=False)
        captured_sizes["08_creator_profile.png"] = len(raw)

        guard.assert_no_browser_errors("T4_SHOT_01_guest")

    # 6 & 7: Authenticated views as demo_designer
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.login_via_api(ctx.base_url, ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)

        # 06_create_remix.png
        guard.goto_ok(ctx.url("/create?fork=swiss-international-grid"))
        guard.stabilize_for_screenshot()
        raw = guard.save_screenshot(out_dir / "06_create_remix.png", full_page=False)
        captured_sizes["06_create_remix.png"] = len(raw)

        # 07_collections_workspace.png (switch to 我发布的风格 so 6 seeded cards render richly)
        guard.goto_ok(ctx.url("/collections"))
        pub_tab = first_visible(
            [
                page.get_by_role("tab", name=re.compile(r"我发布")),
                page.get_by_role("button", name=re.compile(r"我发布")),
            ]
        )
        pub_tab.click()
        page.wait_for_timeout(300)
        guard.stabilize_for_screenshot()
        raw = guard.save_screenshot(out_dir / "07_collections_workspace.png", full_page=False)
        captured_sizes["07_collections_workspace.png"] = len(raw)

        guard.assert_no_browser_errors("T4_SHOT_01_auth")

    expected_names = [spec.filename for spec in REQUIRED_SCREENSHOTS]
    assert set(captured_sizes.keys()) == set(expected_names), (
        f"Screenshot manifest mismatch: got {sorted(captured_sizes.keys())}, expected {sorted(expected_names)}"
    )
    ctx.details["screenshots_dir"] = str(out_dir)
    ctx.details["screenshots_bytes"] = captured_sizes


# ---------------------------------------------------------------------------
# Tier 4 Registry Export (10 Tests)
# ---------------------------------------------------------------------------


def get_tier4_tests() -> list[TestCaseSpec]:
    return [
        TestCaseSpec("T4_SCN_01_executive_q4_board_review", 4, "Persona 1: Q4 Board Review -> edit KPI/bars -> save -> verify .pptx XML", ("scenario", "api", "pptx"), t4_scn_01_executive_q4_board_review),
        TestCaseSpec("T4_SCN_02_ai_product_launch_keynote", 4, "Persona 2: AI Keynote -> dark obsidian re-skin -> add slide -> notes in .pptx & .html", ("scenario", "ui", "pptx", "html"), t4_scn_02_ai_product_launch_keynote),
        TestCaseSpec("T4_SCN_03_academic_thesis_defense", 4, "Persona 3: Academic Defense -> all 8 SlideTypes & valid 8-slide .pptx", ("scenario", "api", "pptx"), t4_scn_03_academic_thesis_defense),
        TestCaseSpec("T4_SCN_04_brand_curator_remix_and_review", 4, "Persona 4: Curator Remix -> 5-star claude-html review -> Creator impact +1", ("scenario", "api"), t4_scn_04_brand_curator_remix_and_review),
        TestCaseSpec("T4_SCN_05_confidential_enterprise_deck_and_share_clone", 4, "Persona 5: Confidential prompt/deck isolation -> public share -> foreign clone", ("scenario", "api", "security"), t4_scn_05_confidential_enterprise_deck_and_share_clone),
        TestCaseSpec("T4_RWD_01_desktop_1440x900_all_7_routes", 4, "Desktop 1440x900 responsive overflow & 0-error sweep across all 7 routes", ("responsive", "ui"), t4_rwd_01_desktop_1440x900_all_7_routes),
        TestCaseSpec("T4_RWD_02_mobile_390x844_all_7_routes", 4, "Mobile 390x844 responsive overflow & 0-error sweep across all 7 routes", ("responsive", "ui"), t4_rwd_02_mobile_390x844_all_7_routes),
        TestCaseSpec("T4_CSS_01_zero_tailwindcss_static_audit", 4, "Static read-only check: zero TailwindCSS/PostCSS in package.json & src/", ("aesthetics", "static"), t4_css_01_zero_tailwindcss_static_audit),
        TestCaseSpec("T4_CSS_02_editorial_aesthetic_computed_styles", 4, "Computed-style audit: warm paper #f5f2eb, zero gradient text/neon glow/grid bg", ("aesthetics", "ui"), t4_css_02_editorial_aesthetic_computed_styles),
        TestCaseSpec("T4_SHOT_01_capture_8_walkthrough_views", 4, "Capture all 8 mandatory 1440x900 desktop PNG walkthrough screenshots", ("screenshots", "ui"), t4_shot_01_capture_8_walkthrough_views),
    ]
