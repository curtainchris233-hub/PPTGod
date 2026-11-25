"""Tier 9: PPTGod v7 Drop-a-Doc Intelligent Intake Hub E2E Suite (4 Tests).

Covers every v7 Drop-a-Doc workflow end-to-end:
  - T9_API_01: POST /api/parse-document semantic analysis + Top 3 style recommendations across .txt, .docx, .pdf + friendly .doc guidance
  - T9_UI_02: Homepage Drop-a-Doc intake -> DocIntakeWorkbench Top 3 16:9 recommendations -> 6-tool document-enriched prompt compilation -> Compare Top 3 -> 390px mobile zero overflow
  - T9_UI_03: Homepage DocIntakeWorkbench sample/doc -> 1-click Auto-Generate full PPT handoff (?intake=1) -> native .pptx export verification
  - T9_UI_04: /generate direct document upload -> inline Top 3 style recommendations -> 1-click re-skin -> 1-click auto-organize full deck
"""

from __future__ import annotations

import re

from tests.e2e.config import DESKTOP_VIEWPORT, MOBILE_VIEWPORT
from tests.e2e.helpers import PptxVerifier, TestCaseSpec, TestContext
from tests.e2e.tier1_features import count_generate_tree_slides
from tests.e2e.tier5_v3 import (
    _build_multipart_request,
    _make_minimal_docx,
    _make_minimal_pdf,
)


NSFC_SAMPLE_TXT = """面向多模态单细胞空间转录组的跨尺度稀疏图推理方法研究
国家自然科学基金面上项目立项依据与技术路线汇报

一、立项依据与关键科学问题
跨组织切片的批次漂移导致传统图神经网络泛化性能下降 31.4%。本课题聚焦异质微环境可解释因果表征科学问题，提出双曲稀疏图注意假说。

二、研究内容与技术路线
1. 融合 H&E 病理图像与空间表达矩阵，显存占用降低 48%。
2. 在 14 个公开肿瘤队列上实现细胞亚群识别准确率 94.6%（p < 0.001）。
3. 结合消融实验与湿实验验证，定位 6 个免疫浸润调控轴。

三、前期基础与预期成果
近三年发表 SCI 论文 12 篇，完成 3.2x 推理加速原型。
"""

TEACHING_SAMPLE_TXT = """牛顿第二定律：加速度与力、质量的定量探究
高一物理必修一市级公开课教学设计（45 分钟）

一、教学目标与学情分析
学生已掌握加速度概念与受力分析，重点突破控制变量法处理 1/m 图像难点，课堂互动达成率目标 92%。

二、情境导入与分组实验
对比重载卡车与跑车起步加速度，开展 5 组控制变量实验并板书重难点：瞬时性、矢量性与同体性。

三、随堂例题与分层课后作业
完成 2 道随堂辨析例题并布置生活探究课后作业。
"""


def t9_api_01_parse_document_analysis_and_recommendations(ctx: TestContext) -> None:
    """Verify /api/parse-document returns accurate scenario, metrics, sections, and Top 3 styles for TXT/DOCX/PDF + 400 for legacy .doc."""
    url = ctx.url("/api/parse-document")

    # 1. Classroom teaching .txt
    status, data = _build_multipart_request(
        url,
        "file",
        "physics_lesson.txt",
        TEACHING_SAMPLE_TXT.encode("utf-8"),
        "text/plain",
    )
    assert status == 200, f"Expected 200 for teaching .txt, got {status}: {data}"
    analysis = data.get("analysis")
    assert isinstance(analysis, dict), f"Missing analysis payload: {data}"
    assert analysis.get("detectedScenario") == "课堂教学", (
        f"Expected detectedScenario='课堂教学', got {analysis.get('detectedScenario')!r}"
    )
    assert analysis.get("detectedDomainId") == "teaching", (
        f"Expected detectedDomainId='teaching', got {analysis.get('detectedDomainId')!r}"
    )
    assert len(analysis.get("keyMetrics", [])) >= 2, (
        f"Expected >= 2 extracted metrics, got {analysis.get('keyMetrics')}"
    )
    assert len(analysis.get("keySections", [])) >= 2, (
        f"Expected >= 2 extracted sections, got {analysis.get('keySections')}"
    )
    recs = analysis.get("recommendedStyles", [])
    assert len(recs) == 3, f"Expected 3 recommendedStyles, got {len(recs)}"
    assert recs[0]["scenario"] in {"课堂教学", "教育培训"}, (
        f"Top 1 style should match teaching domain, got {recs[0]}"
    )

    # 2. NSFC grant .docx
    docx_bytes = _make_minimal_docx(
        [
            "2026国家自然科学基金面上项目申请书",
            "立项依据与关键科学问题：解决跨批次稀疏图泛化误差 31.4% 难题",
            "技术路线与消融实验：实现识别准确率 94.6% 且显著性 p &lt; 0.001",
            "前期基础：发表一区 SCI 论文 12 篇，推理加速 3.2x",
        ]
    )
    status_docx, data_docx = _build_multipart_request(
        url,
        "file",
        "nsfc_grant_proposal.docx",
        docx_bytes,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    assert status_docx == 200, f"Expected 200 for .docx, got {status_docx}: {data_docx}"
    a_docx = data_docx.get("analysis", {})
    assert a_docx.get("detectedScenario") == "科研基金", (
        f"Expected detectedScenario='科研基金' for NSFC docx, got {a_docx.get('detectedScenario')!r}"
    )
    assert a_docx.get("detectedDomainId") == "research"
    assert len(a_docx.get("recommendedStyles", [])) == 3
    assert a_docx["recommendedStyles"][0]["scenario"] in {"科研基金", "学术答辩"}, (
        f"Top 1 style for NSFC docx should be research/grant, got {a_docx['recommendedStyles'][0]}"
    )

    # 3. Tech architecture .pdf
    pdf_bytes = _make_minimal_pdf(
        "Kubernetes Microservices Distributed Architecture SDK API P99 Latency 12ms Kernel 2026"
    )
    status_pdf, data_pdf = _build_multipart_request(
        url,
        "file",
        "k8s_architecture.pdf",
        pdf_bytes,
        "application/pdf",
    )
    assert status_pdf == 200, f"Expected 200 for .pdf, got {status_pdf}: {data_pdf}"
    assert data_pdf.get("fileType") == "pdf"
    assert data_pdf.get("isScannedPdf") is False
    a_pdf = data_pdf.get("analysis", {})
    assert a_pdf.get("detectedScenario") == "技术分享", (
        f"Expected detectedScenario='技术分享' for K8s pdf, got {a_pdf.get('detectedScenario')!r}"
    )
    assert len(a_pdf.get("recommendedStyles", [])) == 3

    # 4. Legacy binary .doc returns clear Chinese guidance
    status_doc, data_doc = _build_multipart_request(
        url,
        "file",
        "legacy_report.doc",
        b"fake legacy binary doc",
        "application/msword",
    )
    assert status_doc == 400, f"Expected 400 for legacy .doc, got {status_doc}"
    assert ".docx" in str(data_doc.get("error", "")), (
        f"Expected helpful .docx conversion hint for legacy .doc, got: {data_doc}"
    )

    ctx.details["txt_top1"] = recs[0]["slug"]
    ctx.details["docx_top1"] = a_docx["recommendedStyles"][0]["slug"]
    ctx.details["pdf_top1"] = a_pdf["recommendedStyles"][0]["slug"]


def t9_ui_02_homepage_drop_doc_recommend_and_prompts(ctx: TestContext) -> None:
    """Drop an NSFC doc on homepage -> inspect Top 3 16:9 recommendations, 6-tool document-enriched prompts, Top-3 compare & mobile 390px overflow."""
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.goto_ok(ctx.url("/"))

        # Upload NSFC txt right via Hero Drop-a-Doc bar
        page.locator("#pg-hero-doc-input").set_input_files(
            {
                "name": "nsfc_2026_proposal.txt",
                "mimeType": "text/plain",
                "buffer": NSFC_SAMPLE_TXT.encode("utf-8"),
            }
        )

        # DocIntakeWorkbench modal must open automatically
        modal = page.locator("#pg-doc-intake-modal")
        modal.wait_for(state="visible", timeout=10000)

        scenario_text = page.locator("#pg-intake-detected-scenario").inner_text()
        assert "科研基金" in scenario_text, (
            f"Expected '科研基金' in detected scenario badge, got: {scenario_text}"
        )

        # Verify Top 3 live 16:9 style recommendation cards rendered
        rec_cards = page.locator("#pg-intake-rec-styles [data-style-slug]")
        assert rec_cards.count() == 3, (
            f"Expected 3 recommended style cards, got {rec_cards.count()}"
        )
        assert rec_cards.first.locator(".pg-slide-stage").count() == 1, (
            "Top 1 recommended card should render live 16:9 SlideCanvas"
        )

        # Verify Claude HTML prompt embeds extracted source material, real metric & research anti-hallucination guardrail
        claude_prompt = page.locator("#pg-intake-compiled-prompt").input_value()
        assert "源文档提炼素材" in claude_prompt, (
            "Claude HTML compiled prompt missing injected source document section"
        )
        assert "94.6%" in claude_prompt, (
            "Compiled prompt should embed extracted document metric '94.6%'"
        )
        assert "[待补实验数据]" in claude_prompt, (
            "Research/grant compiled prompt should include anti-hallucination guardrail '[待补实验数据]'"
        )

        # Switch to Gamma/Kimi and Python-PPTX tool tabs and verify dynamic recompilation with source digest
        page.locator("#pg-intake-tool-gamma-kimi").click()
        gamma_prompt = page.locator("#pg-intake-compiled-prompt").input_value()
        assert "Gamma" in gamma_prompt and "源文档提炼素材" in gamma_prompt

        page.locator("#pg-intake-tool-python-pptx").click()
        py_prompt = page.locator("#pg-intake-compiled-prompt").input_value()
        assert "python-pptx" in py_prompt.lower() and "源文档提炼素材" in py_prompt

        # Click "把 Top 3 送入并排对比台" -> verify /compare loads 3 styles
        page.locator("#pg-intake-compare-top3-btn").click()
        page.wait_for_url("**/compare**", timeout=10000)
        page.locator(".pg-compare-col").first.wait_for(state="visible", timeout=8000)
        assert page.locator(".pg-compare-col").count() == 3, (
            f"Expected 3 comparison columns after Compare Top 3, got {page.locator('.pg-compare-col').count()}"
        )
        guard.assert_no_browser_errors("T9_UI_02_desktop")

    # Mobile 390px zero-overflow check on Homepage with new Hero Drop-a-Doc bar
    with ctx.open_page(viewport=MOBILE_VIEWPORT) as guard_m:
        page_m = guard_m.page
        guard_m.goto_ok(ctx.url("/"))
        overflow = page_m.evaluate(
            "() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth)"
        )
        assert overflow <= 2, f"Homepage mobile 390px horizontal overflow={overflow}px"
        guard_m.assert_no_browser_errors("T9_UI_02_mobile")


def t9_ui_03_homepage_doc_to_auto_generate_pptx(ctx: TestContext) -> None:
    """Open DocIntakeWorkbench -> pick 1-click Business sample -> auto-generate full PPT on /generate?intake=1 -> export valid native .pptx."""
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.goto_ok(ctx.url("/"))

        page.locator("#pg-open-doc-intake-btn").click()
        page.locator("#pg-doc-intake-modal").wait_for(state="visible", timeout=8000)

        # Load 1-click Q4 Business sample doc
        page.locator("#pg-intake-sample-biz").click()
        page.locator("#pg-intake-insight-bar").wait_for(state="visible", timeout=8000)

        scene_text = page.locator("#pg-intake-detected-scenario").inner_text()
        assert "咨询汇报" in scene_text, (
            f"Expected '咨询汇报' for Q4 business sample, got: {scene_text}"
        )

        # Click primary 1-click Auto-Generate PPT CTA -> hands off to /generate?style=...&intake=1
        page.locator("#pg-intake-auto-gen-btn").click()
        page.wait_for_url(re.compile(r".*/generate\?.*intake=1.*"), timeout=12000)

        # Wait for auto-populated topic and inline doc recommendation panel
        page.locator("#pg-gen-doc-recs").wait_for(state="visible", timeout=12000)
        page.wait_for_function(
            "() => (document.getElementById('pg-gen-topic')?.value || '').includes('2026 Q4')",
            timeout=12000,
        )
        # Wait until auto-generation finishes (button enabled & tree has >= 6 slides)
        page.wait_for_function(
            "() => !document.getElementById('pg-gen-doc-autogen-btn')?.disabled",
            timeout=15000,
        )
        slide_count = count_generate_tree_slides(page)
        assert slide_count >= 6, f"Expected >= 6 auto-generated slides, got {slide_count}"

        # Export native .pptx and validate OOXML structure
        with page.expect_download(timeout=20000) as dl_info:
            page.locator("#pg-gen-export-pptx-btn").click()
        download = dl_info.value
        out_pptx = ctx.temp_dir / "v7_doc_autogen.pptx"
        download.save_as(str(out_pptx))

        report = PptxVerifier.verify(
            out_pptx.read_bytes(),
            expected_min_slides=6,
            expected_slide_texts=("2026 Q4",),
        )
        assert report.slide_count >= 6, f"Unexpected exported slide count: {report}"
        ctx.details["exported_slides"] = report.slide_count
        guard.assert_no_browser_errors("T9_UI_03")


def t9_ui_04_generate_upload_doc_style_recs(ctx: TestContext) -> None:
    """Upload a teaching lesson .txt directly inside /generate -> verify Top 3 style recs -> 1-click re-skin -> 1-click auto-organize full deck."""
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.goto_ok(ctx.url("/generate?style=apple-keynote-dark"))

        # Upload classroom teaching lesson directly in /generate
        page.locator("#pg-doc-upload-input").set_input_files(
            {
                "name": "newton_law_lesson.txt",
                "mimeType": "text/plain",
                "buffer": TEACHING_SAMPLE_TXT.encode("utf-8"),
            }
        )

        page.locator("#pg-doc-upload-badge").wait_for(state="visible", timeout=10000)
        recs_panel = page.locator("#pg-gen-doc-recs")
        recs_panel.wait_for(state="visible", timeout=10000)
        assert "课堂教学" in recs_panel.inner_text(), (
            f"Expected '课堂教学' inside #pg-gen-doc-recs, got: {recs_panel.inner_text()}"
        )

        # Click Top 1 recommended style chip and verify active style switches to it
        top1_btn = recs_panel.locator("[data-rec-slug]").first
        top1_slug = top1_btn.get_attribute("data-rec-slug") or ""
        assert top1_slug and top1_slug != "apple-keynote-dark", (
            f"Top 1 teaching rec should switch away from apple-keynote-dark, got {top1_slug!r}"
        )
        top1_btn.click()
        page.wait_for_timeout(200)
        selected_style = page.locator("#pg-gen-style-select").input_value()
        assert selected_style == top1_slug, (
            f"Expected style select={top1_slug!r}, got {selected_style!r}"
        )

        # Click 1-click auto-organize full PPT button
        page.locator("#pg-gen-doc-autogen-btn").click()
        page.wait_for_function(
            "() => !document.getElementById('pg-gen-doc-autogen-btn')?.disabled",
            timeout=15000,
        )
        page.wait_for_timeout(300)
        total_slides = count_generate_tree_slides(page)
        assert total_slides >= 6, f"Expected >= 6 organized teaching slides, got {total_slides}"
        ctx.details["switched_style"] = top1_slug
        ctx.details["teaching_slides"] = total_slides
        guard.assert_no_browser_errors("T9_UI_04")


def get_tier9_tests() -> list[TestCaseSpec]:
    return [
        TestCaseSpec(
            id="T9_API_01_parse_document_analysis_and_recommendations",
            tier=9,
            name="Parse Document Semantic Analysis & Top 3 Style Recommendations (TXT/DOCX/PDF + .doc guidance)",
            fn=t9_api_01_parse_document_analysis_and_recommendations,
            tags=("v7", "api", "doc-intake", "recommendations"),
        ),
        TestCaseSpec(
            id="T9_UI_02_homepage_drop_doc_recommend_and_prompts",
            tier=9,
            name="Homepage Drop-a-Doc Workbench: Top 3 16:9 Recs, 6-Tool Source-Enriched Prompts, Compare & 390px Mobile",
            fn=t9_ui_02_homepage_drop_doc_recommend_and_prompts,
            tags=("v7", "ui", "doc-intake", "prompts", "mobile"),
        ),
        TestCaseSpec(
            id="T9_UI_03_homepage_doc_to_auto_generate_pptx",
            tier=9,
            name="Homepage DocIntakeWorkbench -> ?intake=1 Auto-Generate Full PPT -> Native .pptx Verification",
            fn=t9_ui_03_homepage_doc_to_auto_generate_pptx,
            tags=("v7", "ui", "doc-intake", "pptx"),
        ),
        TestCaseSpec(
            id="T9_UI_04_generate_upload_doc_style_recs",
            tier=9,
            name="/generate Direct Doc Upload -> Inline Top 3 Style Recs -> 1-Click Re-Skin & Auto-Organize Deck",
            fn=t9_ui_04_generate_upload_doc_style_recs,
            tags=("v7", "ui", "doc-intake", "generate"),
        ),
    ]
