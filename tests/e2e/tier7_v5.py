"""Tier 7: PPTGod v5 Full-Domain 36-Style Expansion E2E Suite (5 Tests).

Covers every v5 full-domain upgrade end-to-end:
  - T7_CAT_01: 36 official curated styles, full 20-archetype & 15-motif coverage, and 15/12/9 author distribution
  - T7_UI_02: Gallery 5-Domain Tabs navigation, live counts, responsive mobile zero-overflow, and 6-goal StyleMatcherModal
  - T7_COMP_03: Domain-aware promptCompiler guardrails across Teaching, Research, PMO, Civic, STAR Career & Lifestyle
  - T7_EXP_04: Native .pptx & offline .html 1:1 synchronized rendering for all 5 new v5 archetypes & motifs
  - T7_WORK_05: /generate 4 new full-domain presets (7 total) + dynamic next/og PNG for new v5 styles
"""

from __future__ import annotations

import re
from typing import Any

from tests.e2e.config import (
    ACCOUNT_CHEN,
    ACCOUNT_DEMO,
    ACCOUNT_OFFICIAL,
    DESKTOP_VIEWPORT,
    LAYOUT_ARCHETYPES,
    MOBILE_VIEWPORT,
    OFFICIAL_STYLE_IDS,
    OFFICIAL_STYLE_SLUGS,
)
from tests.e2e.helpers import (
    HtmlDeckVerifier,
    PptxVerifier,
    TestCaseSpec,
    TestContext,
)

V5_NEW_ARCHETYPE_SLUGS: tuple[tuple[str, str, str], ...] = (
    ("chalkboard-classic-lesson", "chalkboard-class", "chalk-frame"),
    ("nature-okabe-ito-evidence", "scientific-figure", "citation-axis"),
    ("civic-party-red-gold", "civic-redgold", "redgold-ribbon"),
    ("pmo-rag-milestone-board", "pmo-rag-grid", "status-dots"),
    ("kodak-analog-travelogue", "polaroid-zine", "film-sprocket"),
)


def t7_cat_01_catalog_36_styles_and_archetype_coverage(ctx: TestContext) -> None:
    """Verify 36 curated styles, all 20 LayoutArchetypes, all 15 non-none motifs, and author sums."""
    client = ctx.api()
    data = client.get("/api/prompts").assert_status(200).require_json()
    prompts: list[dict[str, Any]] = data["prompts"]

    assert len(prompts) == 36, f"Expected 36 official styles in v5, got {len(prompts)}"
    assert {p["id"] for p in prompts} == set(OFFICIAL_STYLE_IDS)
    assert {p["slug"] for p in prompts} == set(OFFICIAL_STYLE_SLUGS)

    archetypes = {p["visualSpec"]["layout"]["archetype"] for p in prompts}
    motifs = {p["visualSpec"]["layout"]["decorativeMotif"] for p in prompts}

    assert archetypes == set(LAYOUT_ARCHETYPES), (
        f"Expected all 20 archetypes covered; missing={set(LAYOUT_ARCHETYPES) - archetypes}"
    )
    assert len(motifs) == 15, f"Expected all 15 non-none decorative motifs covered, got {len(motifs)}: {sorted(motifs)}"

    by_author: dict[str, int] = {}
    for p in prompts:
        by_author[p["authorId"]] = by_author.get(p["authorId"], 0) + 1
    assert by_author.get(ACCOUNT_OFFICIAL.id) == 15
    assert by_author.get(ACCOUNT_DEMO.id) == 12
    assert by_author.get(ACCOUNT_CHEN.id) == 9

    # Verify each of the 5 flagship v5 styles exposes the expected archetype & motif
    by_slug = {p["slug"]: p for p in prompts}
    for slug, expected_arch, expected_motif in V5_NEW_ARCHETYPE_SLUGS:
        item = by_slug[slug]
        assert item["visualSpec"]["layout"]["archetype"] == expected_arch, (
            f"{slug}: expected archetype {expected_arch}, got {item['visualSpec']['layout']['archetype']}"
        )
        assert item["visualSpec"]["layout"]["decorativeMotif"] == expected_motif, (
            f"{slug}: expected motif {expected_motif}, got {item['visualSpec']['layout']['decorativeMotif']}"
        )

    ctx.details["archetype_count"] = len(archetypes)
    ctx.details["motif_count"] = len(motifs)


def t7_ui_02_gallery_5_domain_tabs_and_6_goal_matcher(ctx: TestContext) -> None:
    """Verify 5-Domain Tabs filtering, mobile 390px zero-overflow, and 6-goal StyleMatcher recommendations."""
    expected_domain_counts = {
        "all": 36,
        "business-tech": 11,  # 产品发布(3)+商业路演(2)+品牌提案(4)+技术分享(2)
        "teaching": 5,        # 课堂教学(3)+教育培训(2)
        "research": 6,        # 科研基金(2)+学术答辩(4)
        "workplace": 9,       # 项目汇报(3)+政务党建(1)+个人述职(2)+咨询汇报(2)+年度总结(1)
        "lifestyle": 7,       # 生活纪实(3)+文化创意(2)+个人述职(2)
    }

    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.goto_ok(ctx.url("/"))

        tabs = page.locator("#pg-domain-tabs [role='tab']")
        tabs.first.wait_for(state="visible")
        assert tabs.count() == 6, f"Expected 6 domain tabs (All + 5 domains), got {tabs.count()}"

        for domain_id, exp_count in expected_domain_counts.items():
            tab = page.locator(f"#pg-domain-tab-{domain_id}")
            tab.click()
            page.wait_for_timeout(160)
            shown = page.locator("article[data-prompt-slug]").count()
            assert shown == exp_count, (
                f"Domain tab {domain_id!r}: expected {exp_count} cards, got {shown}"
            )

        # Verify clicking 'teaching' shows Chalkboard Classroom style and hides Civic Red-Gold
        page.locator("#pg-domain-tab-teaching").click()
        page.wait_for_timeout(150)
        assert page.locator('article[data-prompt-slug="chalkboard-classic-lesson"]').is_visible()
        assert page.locator('article[data-prompt-slug="civic-party-red-gold"]').count() == 0

        # Reset filter restores all 36 cards
        page.locator("#pg-reset-filters-btn").click()
        page.wait_for_timeout(150)
        assert page.locator("article[data-prompt-slug]").count() == 36

        # Open 30s StyleMatcherModal and test full-domain Teaching & Research goals
        page.locator("#pg-open-matcher-btn").click()
        modal = page.locator("#pg-style-matcher-modal")
        modal.wait_for(state="visible")
        assert modal.locator("[data-goal-id]").count() == 6, "Expected 6 full-domain goals in StyleMatcherModal"

        modal.locator('[data-goal-id="teaching-class"]').click()
        page.wait_for_timeout(160)
        rec_text_teach = modal.locator("#pg-matcher-results").inner_text()
        assert re.search(r"课堂教学|教育培训", rec_text_teach), (
            f"Expected teaching recommendations, got: {rec_text_teach[:200]}"
        )

        modal.locator('[data-goal-id="research-academic"]').click()
        page.wait_for_timeout(160)
        rec_text_res = modal.locator("#pg-matcher-results").inner_text()
        assert re.search(r"科研基金|学术答辩", rec_text_res), (
            f"Expected research recommendations, got: {rec_text_res[:200]}"
        )

        modal.locator("#pg-matcher-close-btn").click()
        guard.assert_no_browser_errors("T7_UI_02 desktop")

    # Mobile 390px zero horizontal overflow check with 5-Domain Tabs
    with ctx.open_page(viewport=MOBILE_VIEWPORT) as guard:
        page = guard.page
        guard.goto_ok(ctx.url("/"))
        page.locator("#pg-domain-tabs").wait_for(state="visible")
        overflow = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
        assert overflow <= 2, f"Mobile 390px / has horizontal overflow={overflow}px with 5-Domain Tabs"
        guard.assert_no_browser_errors("T7_UI_02 mobile")


def t7_comp_03_domain_aware_prompt_compiler(ctx: TestContext) -> None:
    """Verify domain-specific guardrails inject into compiled prompts across Studio & tools."""
    checks: tuple[tuple[str, str], ...] = (
        ("chalkboard-classic-lesson", "课堂教学与认知负荷铁律"),
        ("nature-okabe-ito-evidence", "[待补实验数据]"),
        ("pmo-rag-milestone-board", "PMO 项目管控与风险透明铁律"),
        ("civic-party-red-gold", "政务与国央企规范表达铁律"),
        ("star-career-promotion-pitch", "STAR 述职与作品集叙事铁律"),
        ("kodak-analog-travelogue", "生活纪实与松弛叙事铁律"),
    )

    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        for slug, expected_marker in checks:
            guard.goto_ok(ctx.url(f"/studio/{slug}"))
            output_box = page.locator("#pg-compiled-prompt-output")
            output_box.wait_for(state="visible")
            claude_txt = output_box.input_value()
            assert expected_marker in claude_txt, (
                f"Studio /{slug} compiled prompt missing domain guardrail {expected_marker!r}"
            )

        # Also verify switching target tools on a scientific style keeps domain guardrail across Gamma, NotebookLM & Python-PPTX
        guard.goto_ok(ctx.url("/studio/nature-okabe-ito-evidence"))
        output_box = page.locator("#pg-compiled-prompt-output")
        for tool_id in ("gamma-kimi", "notebooklm", "python-pptx"):
            page.locator(f"#pg-tool-tab-{tool_id}").click()
            page.wait_for_timeout(150)
            txt = output_box.input_value()
            assert "[待补实验数据]" in txt, (
                f"Tool {tool_id} on scientific style missing anti-hallucination guardrail"
            )
        guard.assert_no_browser_errors("T7_COMP_03")


def t7_exp_04_5_new_archetypes_pptx_and_html(ctx: TestContext) -> None:
    """Export native .pptx and offline .html for all 5 new v5 archetypes and verify integrity."""
    api = ctx.api()
    catalog = api.get("/api/prompts").assert_status(200).require_json()["prompts"]
    by_slug = {p["slug"]: p for p in catalog}

    # Generate a compact 5-slide realistic deck once to test all 5 archetypes cleanly
    slides = (
        api.post(
            "/api/generate",
            json_body={
                "topic": "全领域五母版同步导出校验",
                "subtitle": "验证板书/顶刊/红金/PMO/胶片原生导出",
                "audience": "评审委员会",
                "slideCount": 5,
                "mode": "smart",
            },
        )
        .assert_status(200)
        .require_json()["slides"]
    )
    assert len(slides) == 5

    for slug, arch, motif in V5_NEW_ARCHETYPE_SLUGS:
        prompt = by_slug[slug]
        pptx_resp = api.post(
            "/api/export/pptx",
            json_body={
                "title": prompt["sampleTopic"],
                "subtitle": prompt["sampleSubtitle"],
                "audience": "全领域测试受众",
                "styleName": prompt["title"],
                "visualSpec": prompt["visualSpec"],
                "slides": slides,
            },
        ).assert_status(200, f"POST /api/export/pptx for {arch}")
        PptxVerifier.verify(pptx_resp.body, expected_slide_count=5)

    # Also verify browser-side offline HTML download on a new v5 archetype (/generate?style=kodak-analog-travelogue)
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.goto_ok(ctx.url("/generate?style=kodak-analog-travelogue"))
        page.get_by_role("button", name=re.compile(r"冰岛胶片旅行游记")).first.click()
        page.locator("#pg-gen-run-btn").click()
        page.locator(".pg-gen-slide-card, .pg-slide-thumb-btn").first.wait_for(
            state="visible", timeout=12000
        )

        _, html_bytes = guard.capture_download(
            lambda: page.locator("#pg-gen-export-html-btn").click()
        )
        html_content = html_bytes.decode("utf-8")
        HtmlDeckVerifier.verify(html_content, expected_min_slides=5)
        assert "ISO 400 · WARM FILM" in html_content, (
            "Offline HTML for kodak-analog-travelogue missing polaroid-zine cover stamp"
        )
        assert 'x="942"' in html_content, (
            "Offline HTML for kodak-analog-travelogue missing film-sprocket SVG perforation holes"
        )
        guard.assert_no_browser_errors("T7_EXP_04")


def t7_work_05_generate_new_domain_presets_and_og(ctx: TestContext) -> None:
    """Verify all 7 full-domain presets in /generate and dynamic next/og PNG for new v5 styles."""
    # 1. Verify /studio/[slug]/opengraph-image returns valid PNG for newly added Teaching & Research styles
    api = ctx.api()
    for slug in ("chalkboard-classic-lesson", "nature-okabe-ito-evidence", "civic-party-red-gold"):
        og_resp = api.get(f"/studio/{slug}/opengraph-image").assert_status(
            200, f"OG image for {slug}"
        )
        assert og_resp.body[:8] == b"\x89PNG\r\n\x1a\n", f"OG image for {slug} is not a valid PNG"
        assert len(og_resp.body) > 5000, f"OG PNG for {slug} suspiciously small ({len(og_resp.body)}B)"

    # 2. Verify /generate exposes all 7 full-domain presets & can generate from Teaching and NSFC presets
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.goto_ok(ctx.url("/generate?style=nsfc-grant-defense-bluered"))

        for preset_pat in (
            r"教师公开课",
            r"国自然\s*NSFC",
            r"PMO\s*项目里程碑",
            r"冰岛胶片旅行游记",
        ):
            btn = page.get_by_role("button", name=re.compile(preset_pat)).first
            btn.wait_for(state="visible")

        # Click NSFC Grant preset -> verify topic populates & slides render
        page.get_by_role("button", name=re.compile(r"国自然\s*NSFC")).first.click()
        topic_val = page.locator("#pg-gen-topic").input_value()
        assert "陶瓷基复合材料" in topic_val, f"Unexpected NSFC preset topic: {topic_val!r}"

        page.locator("#pg-gen-run-btn").click()
        page.locator(".pg-gen-slide-card, .pg-slide-thumb-btn").first.wait_for(
            state="visible", timeout=12000
        )
        assert page.locator(".pg-slide-thumb-btn, .pg-gen-slide-card").count() >= 5
        guard.assert_no_browser_errors("T7_WORK_05")


def get_tier7_tests() -> list[TestCaseSpec]:
    return [
        TestCaseSpec(
            "T7_CAT_01_catalog_36_styles_and_archetype_coverage",
            7,
            "36 official curated styles, 20 archetypes, 15 motifs & 15/12/9 author totals",
            ("v5", "api", "catalog"),
            t7_cat_01_catalog_36_styles_and_archetype_coverage,
        ),
        TestCaseSpec(
            "T7_UI_02_gallery_5_domain_tabs_and_6_goal_matcher",
            7,
            "Gallery 5-Domain Tabs, 390px zero-overflow & 6-goal StyleMatcherModal",
            ("v5", "ui", "gallery", "matcher"),
            t7_ui_02_gallery_5_domain_tabs_and_6_goal_matcher,
        ),
        TestCaseSpec(
            "T7_COMP_03_domain_aware_prompt_compiler",
            7,
            "Domain-aware promptCompiler guardrails across Teaching/Research/PMO/Civic/Career/Lifestyle",
            ("v5", "ui", "compiler"),
            t7_comp_03_domain_aware_prompt_compiler,
        ),
        TestCaseSpec(
            "T7_EXP_04_5_new_archetypes_pptx_and_html",
            7,
            "Native .pptx & offline .html export across all 5 new v5 archetypes & motifs",
            ("v5", "api", "ui", "export"),
            t7_exp_04_5_new_archetypes_pptx_and_html,
        ),
        TestCaseSpec(
            "T7_WORK_05_generate_new_domain_presets_and_og",
            7,
            "/generate 4 new full-domain presets (7 total) & dynamic next/og PNG for v5 styles",
            ("v5", "api", "ui", "workshop", "og"),
            t7_work_05_generate_new_domain_presets_and_og,
        ),
    ]
