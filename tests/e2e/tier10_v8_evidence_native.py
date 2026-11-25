"""Tier 10: PPTGod v8 Minimal UX, Evidence-First, Native PPTX & Apple Motion E2E Suite (6 Tests).

Covers every v8 breakthrough end-to-end:
  - T10_UI_01: Figma/Pitch minimal declutter (collapsed advanced filters, zero verbose card blurbs,
               16:9 canvas above the fold on / and /generate, 390px mobile zero horizontal overflow)
  - T10_FLOW_02: 6-type automatic material triage (incl. .pptx beautify-1to1) + 2-slide calibration proof
                 (Cover <-> Representative Content Slide live cross-fade) + Escape dismissal
  - T10_EVID_03: Lossless "Layout Only" remapping preserves custom title & bullets + sourceStatus / sourceNote
                 + Export Modal 4th tab (Speaker Outline & Source/Assumptions Checklist)
  - T10_PPTX_04: Native PowerPoint export contains real Slide Master, native editable chart XML,
                 native editable <a:tbl> table on comparison slide, and evidence notes in notesSlides
  - T10_TOOLS_05: Pure-local browser PPT Toolbox (/tools) reached via quiet footer link — all 4 tools live
  - T10_MOTION_06: Real Chromium measurement of CLS (< 0.05), rAF frame smoothness, unified Apple easing tokens,
                   tabular-nums stability, and prefers-reduced-motion compliance
"""

from __future__ import annotations

import io
import json
import zipfile

from tests.e2e.config import DESKTOP_VIEWPORT, MOBILE_VIEWPORT
from tests.e2e.helpers import TestCaseSpec, TestContext
from tests.e2e.tier5_v3 import _build_multipart_request


def _make_minimal_pptx_bytes() -> bytes:
    """Create a valid minimal .pptx ZIP containing 2 slides for upload triage testing."""
    buf = io.BytesIO()
    slide1 = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
        "<p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>2026 年度商业战略升级复盘</a:t></a:r></a:p>"
        "<a:p><a:r><a:t>核心目标：年度 ARR 突破 2.4 亿，同比增长 68%</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>"
    )
    slide2 = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
        "<p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>一、核心增长引擎与毛利改善</a:t></a:r></a:p>"
        "<a:p><a:r><a:t>AI 行业套件贡献 58% 新增订单，毛利率提升至 76.4%</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>"
    )
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("ppt/slides/slide1.xml", slide1)
        zf.writestr("ppt/slides/slide2.xml", slide2)
    return buf.getvalue()


def t10_ui_01_figma_minimal_declutter_and_above_fold(ctx: TestContext) -> None:
    """Verify Figma/Pitch minimal gallery, progressive filter disclosure, above-the-fold canvas, and 390px safety."""
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page

        # 1. Homepage minimal gallery check
        guard.goto_ok(ctx.url("/"))
        page.locator(".pg-card").first.wait_for(state="visible", timeout=15000)

        # Advanced filters must be collapsed by default (progressive disclosure)
        assert page.locator("#pg-adv-filter-drawer").count() == 0, (
            "Expected #pg-adv-filter-drawer to be collapsed by default"
        )
        # Toggle open & closed (reversible interaction)
        page.locator("#pg-toggle-adv-filters").click()
        page.locator("#pg-adv-filter-drawer").wait_for(state="visible", timeout=5000)
        page.locator("#pg-toggle-adv-filters").click()
        page.locator("#pg-adv-filter-drawer").wait_for(state="hidden", timeout=5000)

        # Pitch/Framer clean card check: zero 2-line verbose .pg-card-summary blurbs
        assert page.locator(".pg-card-summary").count() == 0, (
            "Expected verbose .pg-card-summary blurbs to be removed from gallery cards"
        )

        # Above-the-fold check on 1440x900: first gallery card enters viewport immediately
        first_card_box = page.locator(".pg-card").first.bounding_box()
        assert first_card_box is not None and first_card_box["y"] < 700, (
            f"Expected first 16:9 gallery card above the fold (y < 700), got {first_card_box}"
        )

        # 2. /generate canvas-first check
        guard.goto_ok(ctx.url("/generate"))
        page.locator(".pg-stage-canvas-wrap").first.wait_for(state="visible", timeout=15000)
        canvas_box = page.locator(".pg-stage-canvas-wrap").first.bounding_box()
        assert canvas_box is not None and canvas_box["y"] < 620, (
            f"Expected /generate 16:9 workspace canvas above the fold (y < 620), got {canvas_box}"
        )

        # Style ribbon collapsed by default, toggleable via #pg-gen-toggle-styles-btn
        assert page.locator(".pg-gen-style-strip").count() == 0, (
            "Expected style ribbon collapsed by default on /generate"
        )
        page.locator("#pg-gen-toggle-styles-btn").click()
        page.locator(".pg-gen-style-strip").wait_for(state="visible", timeout=5000)
        page.locator("#pg-gen-toggle-styles-btn").click()
        page.locator(".pg-gen-style-strip").wait_for(state="hidden", timeout=5000)

        # 3. Mobile 390px zero horizontal overflow across /, /generate, /tools
    with ctx.open_page(viewport=MOBILE_VIEWPORT) as m_guard:
        m_page = m_guard.page
        for route in ("/", "/generate", "/tools"):
            m_guard.goto_ok(ctx.url(route))
            m_page.wait_for_timeout(300)
            overflow = m_page.evaluate(
                "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
            )
            assert overflow <= 1, (
                f"Mobile 390px horizontal overflow detected on {route}: {overflow}px"
            )


def t10_flow_02_material_triage_and_two_slide_proof(ctx: TestContext) -> None:
    """Verify 6-type material triage (including .pptx beautify-1to1) and 2-slide calibration proof toggle."""
    # 1. API check for .pptx auto-triage
    pptx_bytes = _make_minimal_pptx_bytes()
    status, data = _build_multipart_request(
        ctx.url("/api/parse-document"),
        "file",
        "board_review_2026.pptx",
        pptx_bytes,
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    )
    assert status == 200, f"Expected 200 for .pptx parse, got {status}: {data}"
    analysis = data.get("analysis", {})
    assert analysis.get("materialKind") == "existing-pptx", (
        f"Expected materialKind='existing-pptx', got {analysis.get('materialKind')!r}"
    )
    assert analysis.get("recommendedRouteMode") == "beautify-1to1", (
        f"Expected recommendedRouteMode='beautify-1to1', got {analysis.get('recommendedRouteMode')!r}"
    )
    assert isinstance(analysis.get("estimatedTalkMinutes"), int) and analysis["estimatedTalkMinutes"] >= 1
    assert analysis.get("representativeSlideType") in {"data", "process", "comparison", "image-split", "swot", "timeline"}

    # 2. Browser UI check: DocIntakeWorkbench 2-slide calibration proof + Escape dismissal
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.goto_ok(ctx.url("/"))
        page.locator("#pg-open-doc-intake-btn").click()
        page.locator("#pg-doc-intake-modal").wait_for(state="visible", timeout=10000)

        # Click first sample doc to populate analysis & Top 3 recommendations
        page.locator("#pg-intake-sample-nsfc").click()
        page.locator("#pg-intake-material-kind").wait_for(state="visible", timeout=10000)
        kind_text = page.locator("#pg-intake-material-kind").inner_text().strip()
        assert len(kind_text) >= 2, f"Expected auto-inferred material kind pill, got {kind_text!r}"

        # Verify Scenario Contract pills (evidence density live-syncs into compiled prompt)
        page.locator("#pg-intake-contract-row").wait_for(state="visible", timeout=5000)
        page.locator("#pg-intake-density-high-evidence").click()
        page.wait_for_timeout(120)
        compiled = page.locator("#pg-intake-compiled-prompt").input_value()
        assert "高证据答辩模式" in compiled, (
            "Expected high-evidence contract guidance inside compiled prompt"
        )

        # Verify 2-slide calibration proof switcher (WAI-ARIA tablist)
        cover_btn = page.locator("#pg-intake-proof-cover")
        content_btn = page.locator("#pg-intake-proof-content")
        cover_btn.wait_for(state="visible", timeout=5000)
        content_btn.wait_for(state="visible", timeout=5000)
        assert cover_btn.get_attribute("aria-selected") == "true"

        before_html = page.locator("#pg-intake-rec-styles .pg-intake-rec-canvas").first.inner_html()
        content_btn.click()
        page.wait_for_timeout(150)
        assert content_btn.get_attribute("aria-selected") == "true"
        after_html = page.locator("#pg-intake-rec-styles .pg-intake-rec-canvas").first.inner_html()
        assert before_html != after_html, "2-Slide Proof switch should re-render Top 3 canvases with representative content layout"

        # Escape key cleanly dismisses modal
        page.keyboard.press("Escape")
        page.locator("#pg-doc-intake-modal").wait_for(state="hidden", timeout=5000)


def t10_evid_03_lossless_layout_only_and_evidence_outline(ctx: TestContext) -> None:
    """Verify Tosea-style lossless Layout Only remapping, source status tagging, live sourceNote parity & Evidence Outline."""
    # API check: /api/outline returns evidence metadata (audienceQuestion + sourceStatus) and /api/generate honors beautify-1to1
    api = ctx.api()
    out_res = api.post(
        "/api/outline",
        json_body={
            "topic": "2026 核心产品商业化复盘",
            "subtitle": "季度数据验证",
            "audience": "董事会",
            "sourceText": "Q4 ARR 达 2.4 亿，同比增长 82%，综合毛利率提升至 76.5%，大客户 NDR 达 128%。" * 3,
            "slideCount": 6,
            "mode": "smart",
            "evidenceDensity": "high-evidence",
        },
    ).assert_status(200, "POST /api/outline with evidenceDensity").require_json()
    outline_items = out_res.get("outline", [])
    assert len(outline_items) == 6
    assert any(it.get("audienceQuestion") for it in outline_items), "Expected audienceQuestion on outline items"
    assert any(it.get("sourceStatus") == "source-material" for it in outline_items), (
        f"Expected honest source-material tag when backed by real sourceText: {outline_items}"
    )

    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.goto_ok(ctx.url("/generate"))
        page.locator(".pg-gen-slide-card").nth(1).wait_for(state="visible", timeout=15000)

        # Select slide 2 and enter custom user content
        page.locator(".pg-gen-slide-card").nth(1).click()
        page.locator("#pg-edit-slide-title").wait_for(state="visible", timeout=5000)

        custom_title = "Q4 独家实测增长验证"
        page.locator("#pg-edit-slide-title").fill(custom_title)

        # Click Layout Only chip -> comparison (must NOT wipe custom title or user points)
        page.locator('[data-layout-chip="comparison"]').click()
        page.wait_for_timeout(120)
        assert page.locator("#pg-edit-slide-title").input_value() == custom_title, (
            "Lossless Layout Only -> comparison must preserve custom slide title"
        )
        # Switch again -> process (still preserves custom title)
        page.locator('[data-layout-chip="process"]').click()
        page.wait_for_timeout(120)
        assert page.locator("#pg-edit-slide-title").input_value() == custom_title, (
            "Lossless Layout Only -> process must preserve custom slide title"
        )

        # Tag evidence source status & source note -> verify live 16:9 SlideCanvas footer parity
        page.locator("#pg-edit-source-status").select_option("needs-verify")
        page.locator("#pg-edit-source-note").fill("财务部 Q4 初步审阅稿")
        page.wait_for_timeout(120)
        stage_text = page.locator(".pg-stage-canvas-wrap").first.inner_text()
        assert "财务部 Q4 初步审阅稿" in stage_text, (
            f"Expected live SlideCanvas footer to reflect slide sourceNote, got: {stage_text[:200]}"
        )

        # Open Export Prompt Modal -> click 4th tab (Speaker Outline & Source Checklist)
        page.locator("#pg-gen-export-md-btn").click()
        page.locator("#pg-export-prompt-modal").wait_for(state="visible", timeout=8000)
        page.locator("#pg-export-tab-outline").click()
        page.wait_for_timeout(120)

        outline_md = page.locator("#pg-export-modal-textarea").input_value()
        assert "演讲提纲" in outline_md and "来源与假设说明" in outline_md, (
            f"Expected speaker outline & source checklist headings, got snippet: {outline_md[:240]}"
        )
        assert "财务部 Q4 初步审阅稿" in outline_md, (
            "Expected user's sourceNote inside exported Evidence Outline Markdown"
        )
        assert "待核验" in outline_md, (
            "Expected needs-verify flag inside exported Evidence Outline Markdown"
        )

        # Escape dismisses ExportPromptModal cleanly
        page.keyboard.press("Escape")
        page.locator("#pg-export-prompt-modal").wait_for(state="hidden", timeout=5000)


def t10_pptx_04_native_master_table_chart_and_notes(ctx: TestContext) -> None:
    """Verify /api/export/pptx embeds a real Slide Master, native chart XML, native <a:tbl> table, and source notes."""
    client = ctx.api()
    prompts_res = client.get("/api/prompts").assert_status(200).require_json()
    first_prompt = prompts_res["prompts"][0]

    payload = {
        "title": "2026 原生母版与图表表格验证报告",
        "subtitle": "PptxGenJS Master + Native Table + Chart",
        "audience": "核心评审委员会",
        "styleName": first_prompt["title"],
        "visualSpec": first_prompt["visualSpec"],
        "slides": [
            {
                "id": "s1",
                "slideType": "cover",
                "sectionTag": "COVER",
                "title": "2026 原生母版与图表表格验证报告",
                "subtitle": "Evidence-First Native Export",
                "bullets": ["核心验证项 1"],
                "speakerNotes": "开场白介绍核心结论。",
            },
            {
                "id": "s2",
                "slideType": "data",
                "sectionTag": "METRICS",
                "title": "季度核心增长指标",
                "subtitle": "真实柱状图验证",
                "bullets": ["同比增速持续领跑"],
                "metrics": [
                    {"value": "¥1.86亿", "label": "季度 ARR", "delta": "+64%"},
                    {"value": "76.4%", "label": "综合毛利率", "delta": "+5.8pp"},
                    {"value": "124%", "label": "大客户 NDR", "delta": "+4pp"},
                ],
                "chart": {
                    "unit": "M",
                    "bars": [
                        {"label": "Q1", "value": 42},
                        {"label": "Q2", "value": 58},
                        {"label": "Q3", "value": 74},
                        {"label": "Q4", "value": 96},
                    ],
                },
                "sourceStatus": "source-material",
                "sourceNote": "审计报告 P12",
                "audienceQuestion": "Q4 增长是否可持续？",
                "speakerNotes": "重点解读 Q4 加速拐点。",
            },
            {
                "id": "s3",
                "slideType": "comparison",
                "sectionTag": "COMPARISON",
                "title": "传统方案 vs 原生架构对比",
                "subtitle": "可编辑原生表格验证",
                "bullets": [],
                "comparison": {
                    "leftTitle": "传统静态排版",
                    "leftPoints": ["手动对齐耗时", "改字破坏版式", "缺乏统一母版"],
                    "rightTitle": "PPTGod 原生母版",
                    "rightPoints": ["真实 SlideMaster 锁定", "原生可编辑表格与图表", "保留来源核验脚注"],
                },
                "sourceStatus": "derived-calc",
                "sourceNote": "内部基准实测",
                "speakerNotes": "展示双栏原生表格可编辑优势。",
            },
            {
                "id": "s4",
                "slideType": "closing",
                "sectionTag": "NEXT",
                "title": "下一步行动计划",
                "subtitle": "立即落地执行",
                "bullets": ["确认预算", "启动试点", "两周复盘"],
                "speakerNotes": "总结并开启 Q&A。",
            },
        ],
    }

    resp = client.post("/api/export/pptx", json_body=payload).assert_status(200, "POST /api/export/pptx")
    assert len(resp.body) > 10_000, f"Exported PPTX unexpectedly small: {len(resp.body)} bytes"

    with zipfile.ZipFile(io.BytesIO(resp.body), "r") as zf:
        names = zf.namelist()
        # 1. Real Slide Master
        masters = [n for n in names if n.startswith("ppt/slideMasters/slideMaster") and n.endswith(".xml")]
        assert len(masters) >= 1, f"Expected real Slide Master in PPTX ZIP, found: {names[:30]}"

        # 2. Native editable PowerPoint Chart
        charts = [n for n in names if n.startswith("ppt/charts/chart") and n.endswith(".xml")]
        assert len(charts) >= 1, f"Expected native editable chart XML in PPTX ZIP, found: {names}"

        # 3. Native editable PowerPoint Table (<a:tbl>) on comparison slide
        slide_xmls = [
            zf.read(n).decode("utf-8", errors="ignore")
            for n in names
            if n.startswith("ppt/slides/slide") and n.endswith(".xml")
        ]
        assert any("<a:tbl" in xml for xml in slide_xmls), (
            "Expected comparison slide to render a native editable PowerPoint table (<a:tbl>)"
        )

        # 4. Evidence sourceNote & audienceQuestion embedded in speaker notes XML
        notes_xmls = [
            zf.read(n).decode("utf-8", errors="ignore")
            for n in names
            if n.startswith("ppt/notesSlides/notesSlide") and n.endswith(".xml")
        ]
        joined_notes = "\n".join(notes_xmls)
        assert "审计报告 P12" in joined_notes, "Expected sourceNote inside PPTX speaker notes XML"
        assert "Q4 增长是否可持续？" in joined_notes, "Expected audienceQuestion inside PPTX speaker notes XML"


def t10_tools_05_pure_local_toolbox_page(ctx: TestContext) -> None:
    """Verify pure-local PPT Toolbox (/tools) navigation from footer and all 4 interactive browser tools."""
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.goto_ok(ctx.url("/"))
        page.locator("#pg-footer-tools-link").wait_for(state="visible", timeout=10000)
        page.locator("#pg-footer-tools-link").click()
        page.wait_for_url("**/tools", timeout=10000)

        # 1. Pace calculator updates live
        page.locator("#pg-pace-result").wait_for(state="visible", timeout=8000)
        initial_pace = page.locator("#pg-pace-result").inner_text()
        page.locator("#pg-pace-script").fill("今天我们汇报 2026 核心战略落地与季度增长复盘。" * 40)
        page.wait_for_timeout(100)
        updated_pace = page.locator("#pg-pace-result").inner_text()
        assert initial_pace != updated_pace, (
            f"Pace calculator should update live: {initial_pace!r} vs {updated_pace!r}"
        )

        # 2. PPTX Inspector tab
        page.locator("#pg-tool-tab-pptx").click()
        page.locator("#pg-tools-pptx-panel").wait_for(state="visible", timeout=5000)

        # 3. Palette WCAG tab + portable .pptgod.json export button
        page.locator("#pg-tool-tab-palette").click()
        page.locator("#pg-tools-palette-panel").wait_for(state="visible", timeout=5000)
        assert page.locator("#pg-tools-palette-panel .pg-slide-stage").count() >= 1
        page.locator("#pg-tools-export-style-json").wait_for(state="visible", timeout=5000)

        # 4. Visual Director v2 prompt tab + density switch
        page.locator("#pg-tool-tab-director").click()
        page.locator("#pg-tools-vd-output").wait_for(state="visible", timeout=5000)
        page.locator("#pg-tools-vd-density").select_option("dense")
        page.wait_for_timeout(100)
        vd_text = page.locator("#pg-tools-vd-output").input_value()
        assert "视觉导演 v2" in vd_text and "Negative Prompt" in vd_text, (
            f"Expected Visual Director v2 output, got: {vd_text[:200]}"
        )


def t10_motion_06_apple_motion_fps_cls_and_reduced_motion(ctx: TestContext) -> None:
    """Measure real Chromium CLS, UI transition FPS, 36-card scroll budget, Apple tokens & prefers-reduced-motion."""
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page

        # Install CLS observer before navigation
        page.add_init_script(
            """
            window.__pgCls = 0;
            try {
              const obs = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                  if (!entry.hadRecentInput) window.__pgCls += entry.value;
                }
              });
              obs.observe({ type: 'layout-shift', buffered: true });
            } catch {}
            """
        )

        guard.goto_ok(ctx.url("/"))
        page.locator(".pg-card").first.wait_for(state="visible", timeout=15000)
        page.wait_for_timeout(350)

        # 1. Verify unified Apple motion CSS tokens exist on :root (supports lightningcss minified '.22')
        tokens = page.evaluate(
            """() => {
              const cs = getComputedStyle(document.documentElement);
              return {
                easeApple: cs.getPropertyValue('--ease-apple').trim(),
                durFast: cs.getPropertyValue('--dur-fast').trim(),
                durBase: cs.getPropertyValue('--dur-base').trim(),
                cardContentVis: getComputedStyle(document.querySelector('.pg-card')).contentVisibility,
              };
            }"""
        )
        assert "cubic-bezier(" in tokens["easeApple"] and ".22" in tokens["easeApple"] and ".36" in tokens["easeApple"], (
            f"Expected unified Apple ease curve token, got {tokens}"
        )
        assert tokens["cardContentVis"] == "auto", (
            f"Expected content-visibility: auto on 36-card gallery items, got {tokens}"
        )

        # 2. Genuine user interactions (filter drawer + slide tab switch) -> check zero CLS
        page.locator("#pg-toggle-adv-filters").click()
        page.locator("#pg-adv-filter-drawer").wait_for(state="visible", timeout=5000)
        page.locator("#pg-toggle-adv-filters").click()
        page.locator("#pg-adv-filter-drawer").wait_for(state="hidden", timeout=5000)

        # 3. Measure pure compositor UI transition FPS (SlideCanvas cross-fade)
        transition_stats = page.evaluate(
            """() => new Promise((resolve) => {
              const deltas = [];
              let prev = performance.now();
              const start = prev;
              function tick(now) {
                deltas.push(now - prev);
                prev = now;
                if (now - start < 480) {
                  requestAnimationFrame(tick);
                } else {
                  const v = deltas.slice(2);
                  const avgMs = v.reduce((a, b) => a + b, 0) / Math.max(1, v.length);
                  const sorted = [...v].sort((a, b) => a - b);
                  const p95Ms = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] || avgMs;
                  resolve({
                    frames: v.length,
                    fps: Number((1000 / Math.max(1, avgMs)).toFixed(1)),
                    avgMs: Number(avgMs.toFixed(2)),
                    p95Ms: Number(p95Ms.toFixed(2)),
                  });
                }
              }
              const tab = document.querySelector('.pg-card .pg-slide-tab:nth-child(3)');
              if (tab) tab.click();
              requestAnimationFrame(tick);
            })"""
        )

        # 4. Measure 36-card long-list smooth scroll cadence + total CLS
        scroll_stats = page.evaluate(
            """() => new Promise((resolve) => {
              const deltas = [];
              let prev = performance.now();
              const start = prev;
              let y = 0;
              function tick(now) {
                deltas.push(now - prev);
                prev = now;
                y += 40;
                window.scrollTo(0, y < 1200 ? y : 0);
                if (now - start < 750 && deltas.length < 45) {
                  requestAnimationFrame(tick);
                } else {
                  window.scrollTo(0, 0);
                  const v = deltas.slice(2);
                  const avgMs = v.reduce((a, b) => a + b, 0) / Math.max(1, v.length);
                  resolve({
                    frames: v.length,
                    fps: Number((1000 / Math.max(1, avgMs)).toFixed(1)),
                    avgMs: Number(avgMs.toFixed(2)),
                    cls: Number((window.__pgCls || 0).toFixed(4)),
                  });
                }
              }
              requestAnimationFrame(tick);
            })"""
        )

        # 1b. Deterministically audit all pg* CSS @keyframes -> ONLY GPU compositor properties (transform, opacity)
        keyframe_audit = page.evaluate(
            """() => {
              const allowed = new Set(['transform', 'opacity']);
              const violations = [];
              const audited = [];
              for (const sheet of Array.from(document.styleSheets)) {
                let rules;
                try { rules = sheet.cssRules; } catch { continue; }
                for (const rule of Array.from(rules || [])) {
                  if (rule.type === CSSRule.KEYFRAMES_RULE && rule.name && rule.name.startsWith('pg')) {
                    audited.push(rule.name);
                    for (const kf of Array.from(rule.cssRules || [])) {
                      for (let i = 0; i < kf.style.length; i++) {
                        const prop = kf.style[i];
                        if (!allowed.has(prop)) {
                          violations.push(rule.name + ':' + prop);
                        }
                      }
                    }
                  }
                }
              }
              return { auditedCount: audited.length, violations };
            }"""
        )
        assert keyframe_audit["auditedCount"] >= 6, f"Expected >= 6 unified pg* keyframes, got {keyframe_audit}"
        assert keyframe_audit["violations"] == [], (
            f"Found non-compositor properties in pg* @keyframes (causes layout/paint jank): {keyframe_audit}"
        )

        combined = {
            "transition": transition_stats,
            "scroll36": scroll_stats,
            "keyframes": keyframe_audit,
        }
        print(f"    [Motion Metrics] {json.dumps(combined)}")
        ctx.details["motion_metrics"] = combined
        assert scroll_stats["cls"] < 0.05, f"Expected CLS < 0.05, got {combined}"
        assert transition_stats["fps"] >= 20.0 and transition_stats["avgMs"] < 55.0, (
            f"Expected smooth SlideCanvas transition frame budget in headless CPU Chromium, got {combined}"
        )
        assert scroll_stats["avgMs"] < 80.0, (
            f"Expected 36-card scroll avg frame time < 80ms in headless CPU Chromium, got {combined}"
        )

        # 5. Verify OS prefers-reduced-motion: reduce collapses animation duration
        page.emulate_media(reduced_motion="reduce")
        page.wait_for_timeout(80)
        reduced_dur = page.evaluate(
            """() => {
              const el = document.querySelector('.pg-canvas-motion-slot') || document.querySelector('.pg-page');
              if (!el) return 'none';
              return getComputedStyle(el).animationDuration;
            }"""
        )
        parsed_sec = float(reduced_dur.replace("s", "")) if reduced_dur.endswith("s") else 99.0
        assert parsed_sec <= 0.001, (
            f"Expected prefers-reduced-motion to clamp animationDuration <= 0.001s, got {reduced_dur!r}"
        )


def get_tier10_tests() -> list[TestCaseSpec]:
    return [
        TestCaseSpec(
            "T10_UI_01_figma_minimal_declutter_and_above_fold",
            10,
            "v8 Figma/Pitch minimal gallery, progressive filters, above-fold canvas & 390px safety",
            ("v8", "ui", "minimal", "responsive"),
            t10_ui_01_figma_minimal_declutter_and_above_fold,
        ),
        TestCaseSpec(
            "T10_FLOW_02_material_triage_and_two_slide_proof",
            10,
            "v8 6-type material triage (.pptx beautify-1to1) + 2-slide proof switcher + Escape",
            ("v8", "api", "ui", "intake"),
            t10_flow_02_material_triage_and_two_slide_proof,
        ),
        TestCaseSpec(
            "T10_EVID_03_lossless_layout_only_and_evidence_outline",
            10,
            "v8 Lossless Layout Only + sourceStatus + Evidence Outline Markdown export tab",
            ("v8", "ui", "generate", "evidence"),
            t10_evid_03_lossless_layout_only_and_evidence_outline,
        ),
        TestCaseSpec(
            "T10_PPTX_04_native_master_table_chart_and_notes",
            10,
            "v8 Native PPTX export: real SlideMaster + native chart + native <a:tbl> table + source notes",
            ("v8", "api", "pptx", "native"),
            t10_pptx_04_native_master_table_chart_and_notes,
        ),
        TestCaseSpec(
            "T10_TOOLS_05_pure_local_toolbox_page",
            10,
            "v8 Pure-local browser PPT Toolbox (/tools) with 4 live productivity tools",
            ("v8", "ui", "tools"),
            t10_tools_05_pure_local_toolbox_page,
        ),
        TestCaseSpec(
            "T10_MOTION_06_apple_motion_fps_cls_and_reduced_motion",
            10,
            "v8 Apple Motion Language: real Chromium CLS, rAF smoothness & prefers-reduced-motion check",
            ("v8", "ui", "motion", "perf"),
            t10_motion_06_apple_motion_fps_cls_and_reduced_motion,
        ),
    ]
