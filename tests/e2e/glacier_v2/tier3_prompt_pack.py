"""Tier 3 — Prompt Pack (资料 → 提示词包) contract, honesty & UI journey.

* G3_PACK_01: rule-engine API contract — schema, HEX palette, layout enum,
  page budget, and every numeric datum is literally present in the source.
* G3_PACK_02: auto mode with a broken BYOK endpoint degrades to the rule
  engine with an explicit ``fallbackReason`` (never a 5xx, never fake output).
* G3_PACK_03: /pack UI — sample → generate → export prompt contains palette
  HEX + slide titles; copy button writes the same prompt; no apiKey persisted.
* G3_PACK_04: /pack at 390px — zero horizontal overflow after generation.
"""

from __future__ import annotations

import re
from typing import Any

from .config import MOBILE_390
from .helpers import (
    TestContext,
    TestSpec,
    click_resilient,
    locate_first,
)

_LAYOUTS = {
    "cover",
    "agenda",
    "section",
    "big-number",
    "chart",
    "comparison",
    "timeline",
    "process",
    "quote",
    "image-text",
    "summary",
}
_HEX_RE = re.compile(r"^#[0-9A-F]{6}$")

_SOURCE = """牛顿第二定律
# 教学目标
理解加速度与合外力、质量之间的定量关系，能用 F=ma 解决简单动力学问题。通过控制变量法实验，体会科学探究的基本过程。
# 实验探究
保持小车质量 0.5 kg 不变，拉力依次为 0.1 N、0.2 N、0.3 N，测得加速度分别为 0.2 m/s²、0.4 m/s²、0.6 m/s²。保持拉力 0.2 N 不变，小车质量由 0.5 kg 增加到 1.0 kg，加速度由 0.4 m/s² 减小到 0.2 m/s²。
# 规律总结
物体加速度的大小跟它受到的合外力成正比，跟它的质量成反比。表达式 F=ma，力的单位 1 N 定义为使 1 kg 物体产生 1 m/s² 加速度的力。
# 典型例题
质量为 2 kg 的物体在水平面上受到 10 N 拉力，滑动摩擦力为 4 N，求加速度。首先确定研究对象并受力分析；其次求合力 F合 = 10 N − 4 N = 6 N；最后由 a = F合/m 得 a = 3 m/s²。
# 课堂小结
牛顿第二定律揭示了力是改变物体运动状态的原因。课后完成教材习题 1–4。
"""


def _norm(s: str) -> str:
    return re.sub(r"[\s,，]", "", s)


def _assert_pack_shape(pack: dict[str, Any], label: str) -> None:
    assert pack.get("version") == 1, f"{label}: version must be 1"
    style = pack.get("style") or {}
    colors = style.get("colors") or []
    assert len(colors) == 6, f"{label}: expected 6 role colours, got {len(colors)}"
    for c in colors:
        assert _HEX_RE.match(str(c.get("hex", ""))), f"{label}: invalid HEX {c!r}"
    for c in style.get("chartColors") or []:
        assert _HEX_RE.match(str(c)), f"{label}: invalid chart HEX {c!r}"
    slides = pack.get("slides") or []
    assert len(slides) >= 3, f"{label}: too few slides ({len(slides)})"
    assert slides[0]["layout"] == "cover", f"{label}: first slide must be cover"
    assert slides[-1]["layout"] == "summary", f"{label}: last slide must be summary"
    for s in slides:
        assert s["layout"] in _LAYOUTS, f"{label}: unknown layout {s['layout']!r}"
        assert str(s.get("title", "")).strip(), f"{label}: empty slide title"


def g3_pack_01_rule_engine_contract(ctx: TestContext) -> None:
    resp = ctx.api().post(
        "/api/prompt-pack",
        json_body={"text": _SOURCE, "fileName": "newton.md", "slideCount": 10, "mode": "smart"},
    )
    resp.assert_status(200, "G3_PACK_01 smart pack")
    data = resp.require_json("G3_PACK_01")
    assert data.get("ok") is True and data.get("engine") == "smart", f"Unexpected engine: {data.get('engine')!r}"
    assert "fallbackReason" not in data, "smart mode must not report a fallback"
    pack = data["pack"]
    _assert_pack_shape(pack, "G3_PACK_01")

    slides = pack["slides"]
    assert 6 <= len(slides) <= 10, f"Page budget violated: {len(slides)} slides for target 10"
    layouts = {s["layout"] for s in slides}
    assert len(layouts) >= 4, f"Layouts are monotonous: {sorted(layouts)}"
    assert layouts & {"big-number", "chart"}, "Numeric material must yield a big-number or chart slide"

    # Honesty: every datum value must literally appear in the source text.
    source = _norm(_SOURCE)
    for s in slides:
        for d in s.get("data") or []:
            num = re.search(r"-?\d+(?:\.\d+)?", _norm(d["value"]))
            assert num and num.group(0) in source, f"Fabricated datum {d!r} on slide {s['title']!r}"

    style = pack["style"]
    assert style["directionId"] == "textbook-illustrated", (
        f"Lesson material should map to the textbook direction, got {style['directionId']!r}"
    )

    bad = ctx.api().post("/api/prompt-pack", json_body={"text": "太短"})
    bad.assert_status(400, "G3_PACK_01 short input")


def g3_pack_02_byok_failure_falls_back(ctx: TestContext) -> None:
    resp = ctx.api().post(
        "/api/prompt-pack",
        json_body={
            "text": _SOURCE,
            "slideCount": 8,
            "mode": "auto",
            "apiKey": "sk-e2e-invalid-key-never-stored",
            "apiBase": "http://127.0.0.1:9/v1",
            "model": "e2e-model",
        },
        timeout_ms=90_000,
    )
    resp.assert_status(200, "G3_PACK_02 auto fallback")
    data = resp.require_json("G3_PACK_02")
    assert data.get("engine") == "smart", f"Broken BYOK must fall back to rules, got {data.get('engine')!r}"
    reason = str(data.get("fallbackReason") or "")
    assert reason, "Fallback must carry a human-readable fallbackReason"
    assert "sk-e2e-invalid-key" not in resp.text(), "SECURITY: apiKey echoed back in response"
    _assert_pack_shape(data["pack"], "G3_PACK_02")

    wrong_type = ctx.api().post("/api/prompt-pack", json_body={"text": _SOURCE, "apiKey": 123})
    wrong_type.assert_status(400, "G3_PACK_02 non-string apiKey")


def _generate_sample_on_page(guard: Any, ctx: TestContext) -> Any:
    page = guard.page
    guard.goto_ok(f"{ctx.base_url}/pack")
    page.evaluate("() => { try { localStorage.removeItem('pptgod_prompt_pack_v1'); } catch (e) {} }")
    page.reload()
    page.wait_for_load_state("networkidle")
    click_resilient(page, ["#pg-pack-tab-sample"], description="Sample tab")
    click_resilient(page, ["#pg-pack-sample-transformer"], description="Transformer sample")
    page.wait_for_selector("#pg-pack-export", timeout=30_000)
    return page


def g3_pack_03_ui_sample_to_copy(ctx: TestContext) -> None:
    with ctx.browser_page() as guard:
        page = _generate_sample_on_page(guard, ctx)
        locate_first(page, ["#pg-pack-style"], description="Style card")
        canvases = page.locator("#pg-pack-preview .pg-slide-outer")
        assert canvases.count() == 3, f"Expected 3 preview canvases, got {canvases.count()}"

        pack = page.evaluate("() => JSON.parse(localStorage.getItem('pptgod_prompt_pack_v1') || 'null')")
        assert pack and pack.get("pack"), "Pack draft was not persisted"
        p = pack["pack"]
        hexes = [c["hex"] for c in p["style"]["colors"]]
        titles = [s["title"] for s in p["slides"]]

        prompt = page.locator("#pg-pack-prompt-preview").inner_text()
        assert hexes[4] in prompt, f"Primary HEX {hexes[4]} missing from ChatGPT prompt"
        for t in titles[:4]:
            assert t in prompt, f"Slide title {t!r} missing from exported prompt"
        assert "python-pptx" in prompt, "ChatGPT prompt should request a python-pptx build"

        click_resilient(page, ["#pg-pack-tool-gamma"], description="Gamma tool tab")
        gamma = page.locator("#pg-pack-prompt-preview").inner_text()
        assert "---" in gamma and "Gamma" in gamma, "Gamma prompt must be card-split with --- separators"

        page.evaluate(
            """() => {
              window.__pgCopied = '';
              Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: { writeText: (t) => { window.__pgCopied = t; return Promise.resolve(); } },
              });
            }"""
        )
        click_resilient(page, ["#pg-pack-copy-btn"], description="Copy prompt button")
        page.wait_for_function("() => (window.__pgCopied || '').length > 200", timeout=5_000)
        copied = page.evaluate("() => window.__pgCopied")
        assert copied.strip() == gamma.strip(), "Copied text differs from the visible prompt preview"

        stored = page.evaluate("() => localStorage.getItem('pptgod_prompt_pack_v1') || ''")
        assert "apiKey" not in stored, "SECURITY: pack draft must never persist apiKey"
        guard.assert_no_browser_errors("G3_PACK_03")


def g3_pack_04_mobile_390_no_overflow(ctx: TestContext) -> None:
    with ctx.browser_page(viewport=MOBILE_390, track_web_vitals=False) as guard:
        page = _generate_sample_on_page(guard, ctx)
        page.wait_for_timeout(300)
        overflow = page.evaluate("() => Math.ceil(document.documentElement.scrollWidth - window.innerWidth)")
        assert overflow <= 1, f"/pack overflows horizontally at 390px by {overflow}px"
        guard.assert_no_browser_errors("G3_PACK_04")


def g3_pack_05_byok_presets_and_test_ssrf(ctx: TestContext) -> None:
    # 1. API contract + SSRF guard + zero key echo on /api/byok/test
    empty = ctx.api().post("/api/byok/test", json_body={"apiKey": "", "apiBase": "https://api.openai.com/v1"})
    empty.assert_status(400, "G3_PACK_05 empty apiKey")

    ssrf_secret = "sk-e2e-ssrf-secret-must-not-echo"
    ssrf = ctx.api().post(
        "/api/byok/test",
        json_body={
            "apiKey": ssrf_secret,
            "apiBase": "http://169.254.169.254/latest/meta-data",
            "model": "gpt-4o-mini",
        },
    )
    ssrf.assert_status(400, "G3_PACK_05 SSRF private IP blocked")
    assert ssrf_secret not in ssrf.text(), "SECURITY: apiKey echoed back in /api/byok/test SSRF error"

    bad_type = ctx.api().post("/api/byok/test", json_body={"apiKey": 12345})
    bad_type.assert_status(400, "G3_PACK_05 non-string apiKey")

    # 2. UI presets & test button inside SettingsModal opened from /pack
    with ctx.browser_page() as guard:
        page = guard.page
        guard.goto_ok(f"{ctx.base_url}/pack")
        click_resilient(
            page,
            [lambda p: p.get_by_role("button", name="接入自己的大模型")],
            description="Open BYOK settings from /pack",
        )
        dlg = locate_first(page, ["#gl-settings-dialog"], description="SettingsModal")
        click_resilient(dlg, ["#gl-settings-byok-preset-deepseek"], description="DeepSeek preset")
        assert dlg.locator("#gl-settings-byok-base").input_value() == "https://api.deepseek.com/v1"
        assert dlg.locator("#gl-settings-byok-model").input_value() == "deepseek-chat"

        click_resilient(dlg, ["#gl-settings-byok-preset-kimi"], description="Kimi preset")
        assert dlg.locator("#gl-settings-byok-base").input_value() == "https://api.moonshot.cn/v1"
        locate_first(dlg, ["#gl-settings-byok-test-btn"], description="BYOK test connection button")
        guard.assert_no_browser_errors("G3_PACK_05")


def g3_pack_06_gamma_split_and_chatgpt_twostep_copy(ctx: TestContext) -> None:
    with ctx.browser_page() as guard:
        page = guard.page
        guard.goto_ok(f"{ctx.base_url}/pack")
        page.evaluate("() => { try { localStorage.removeItem('pptgod_prompt_pack_v1'); } catch (e) {} }")
        page.reload()
        page.wait_for_load_state("networkidle")

        click_resilient(page, ["#pg-pack-tab-sample"], description="Sample tab")
        click_resilient(page, ["#pg-pack-sample-deepseek-r1"], description="DeepSeek-R1 sample")
        page.wait_for_selector("#pg-pack-export", timeout=30_000)

        page.evaluate(
            """() => {
              window.__pgCopied = '';
              Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: { writeText: (t) => { window.__pgCopied = t; return Promise.resolve(); } },
              });
            }"""
        )

        # ChatGPT two-step mode
        click_resilient(page, ["#pg-pack-chatgpt-twostep"], description="ChatGPT two-step mode")
        locate_first(page, ["#pg-pack-chatgpt-split"], description="ChatGPT two-step split cards")
        click_resilient(page, ["#pg-pack-copy-step1"], description="Copy ChatGPT step 1")
        page.wait_for_function("() => (window.__pgCopied || '').includes('设计规范')", timeout=5_000)
        step1 = page.evaluate("() => window.__pgCopied")
        assert "风格已就绪" in step1, "ChatGPT step 1 must confirm style before slides"

        click_resilient(page, ["#pg-pack-copy-step2"], description="Copy ChatGPT step 2")
        page.wait_for_function("() => (window.__pgCopied || '').includes('逐页内容')", timeout=5_000)
        step2 = page.evaluate("() => window.__pgCopied")
        assert "python-pptx" in step2 and "DeepSeek-R1" in step2

        # Gamma two-part copy
        click_resilient(page, ["#pg-pack-tool-gamma"], description="Gamma tab")
        locate_first(page, ["#pg-pack-gamma-split"], description="Gamma split cards")
        click_resilient(page, ["#pg-pack-copy-gamma-style"], description="Copy Gamma part 1 style")
        page.wait_for_function("() => (window.__pgCopied || '').includes('设计方向')", timeout=5_000)
        gamma_style = page.evaluate("() => window.__pgCopied")
        assert "---" not in gamma_style, "Gamma part 1 should only contain style instructions"

        click_resilient(page, ["#pg-pack-copy-gamma-cards"], description="Copy Gamma part 2 cards")
        page.wait_for_function("() => (window.__pgCopied || '').includes('---')", timeout=5_000)
        gamma_cards = page.evaluate("() => window.__pgCopied")
        assert "---" in gamma_cards and "DeepSeek-R1" in gamma_cards

        # Partial copy buttons
        click_resilient(page, ["#pg-pack-copy-style-btn"], description="Copy style only button")
        page.wait_for_function("() => (window.__pgCopied || '').includes('设计规范')", timeout=5_000)
        click_resilient(page, ["#pg-pack-copy-outline-btn"], description="Copy outline only button")
        page.wait_for_function("() => (window.__pgCopied || '').includes('逐页内容')", timeout=5_000)
        guard.assert_no_browser_errors("G3_PACK_06")


def g3_pack_07_style_editor_outline_data_notes_and_history(ctx: TestContext) -> None:
    with ctx.browser_page() as guard:
        page = guard.page
        guard.goto_ok(f"{ctx.base_url}/pack")
        page.evaluate(
            """() => {
              try {
                localStorage.removeItem('pptgod_prompt_pack_v1');
                localStorage.removeItem('pptgod_prompt_pack_history_v1');
              } catch (e) {}
            }"""
        )
        page.reload()
        page.wait_for_load_state("networkidle")

        # 1. Load Chinese literature sample -> verify neo-chinese direction
        click_resilient(page, ["#pg-pack-tab-sample"], description="Sample tab")
        click_resilient(page, ["#pg-pack-sample-yueyanglou"], description="Yueyanglou sample")
        page.wait_for_selector("#pg-pack-style", timeout=30_000)
        style_title = page.locator("#pg-pack-style-title").inner_text()
        assert "新中式" in style_title, f"Expected neo-chinese style for 岳阳楼记, got {style_title!r}"

        # 2. Inline style HEX tweak reflects immediately in exported prompt
        click_resilient(page, ["#pg-pack-style-edit-toggle"], description="Open inline style editor")
        color_inp = locate_first(page, ["#pg-pack-color-input-4"], description="Primary HEX input")
        color_inp.fill("#1E40AF")
        page.wait_for_timeout(150)
        assert "#1E40AF" in page.locator("#pg-pack-prompt-preview").inner_text()

        # 3. Outline data & speaker notes editing reflect immediately in exported prompt
        first_slide_btn = page.locator("#pg-pack-outline .gl-pack-slide-title").first
        first_slide_btn.click()
        click_resilient(page, ["#pg-pack-add-datum-btn"], description="Add slide datum button")
        data_rows = page.locator("#pg-pack-outline .gl-pack-data-row")
        last_row = data_rows.last
        last_row.locator("input").nth(0).fill("测试指标")
        last_row.locator("input").nth(1).fill("99%")
        page.locator("#pg-pack-slide-note-input").fill("这是测试演讲备注")
        page.wait_for_timeout(150)
        prompt_text = page.locator("#pg-pack-prompt-preview").inner_text()
        assert "测试指标 = 99%" in prompt_text, "Edited datum missing from prompt preview"
        assert "这是测试演讲备注" in prompt_text, "Edited speaker note missing from prompt preview"

        # 4. Generate a second sample and switch back via local history
        click_resilient(page, ["#pg-pack-tab-sample"], description="Sample tab again")
        click_resilient(page, ["#pg-pack-sample-thesis-proposal"], description="Thesis proposal sample")
        page.wait_for_function(
            "() => (document.querySelector('#pg-pack-insight')?.textContent || '').includes('开题报告')",
            timeout=30_000,
        )
        click_resilient(page, ["#pg-pack-history-toggle"], description="Toggle history panel")
        hist_items = page.locator("#pg-pack-history-panel .gl-pack-history-load")
        assert hist_items.count() >= 2, f"Expected >= 2 history items, got {hist_items.count()}"
        hist_items.filter(has_text="岳阳楼记").first.click()
        page.wait_for_function(
            "() => (document.querySelector('#pg-pack-insight')?.textContent || '').includes('岳阳楼记')",
            timeout=10_000,
        )
        hist_raw = page.evaluate("() => localStorage.getItem('pptgod_prompt_pack_history_v1') || ''")
        assert "apiKey" not in hist_raw, "SECURITY: history store must never persist apiKey"
        guard.assert_no_browser_errors("G3_PACK_07")


def g3_pack_08_topbar_style_anchor_and_long_doc_picker(ctx: TestContext) -> None:
    with ctx.browser_page() as guard:
        page = guard.page
        guard.goto_ok(f"{ctx.base_url}/pack?style=nature-okabe-ito-evidence")

        # 1. Topbar /pack active indicator & renamed 风格参考库 nav item
        pack_nav = locate_first(page, ["#pg-nav-pack"], description="Topbar /pack nav link")
        assert pack_nav.get_attribute("aria-current") == "page", "Topbar #pg-nav-pack missing aria-current='page'"
        gallery_nav = locate_first(page, ["#pg-nav-gallery"], description="Topbar /gallery nav link")
        assert "风格参考库" in (gallery_nav.inner_text() or ""), (
            f"Expected Topbar #pg-nav-gallery to say 风格参考库, got {gallery_nav.inner_text()!r}"
        )

        # 2. Style reference anchor banner rendered from ?style=nature-okabe-ito-evidence
        anchor_banner = locate_first(page, ["#pg-pack-anchor-banner"], description="Style anchor banner")
        assert "Nature" in (anchor_banner.inner_text() or "") or "顶刊" in (anchor_banner.inner_text() or "")

        # 3. Long document (>16,000 chars) triggers section picker and auto-unchecks 参考文献
        long_doc = (
            "长论文多模态文档理解研究\n"
            "# 摘要\n"
            + ("本文提出分层自适应多模态解析框架，准确率达到 88.5%，吞吐量提升 2.1 倍。" * 60)
            + "\n# 实验结果\n"
            + ("在复杂版面基准上，相比基线提升 14.2%，视觉 Token 减少 42%。" * 60)
            + "\n# 结论\n"
            + ("核心结论：分层分辨率编码兼顾精度与速度，适合大规模论文知识库构建，核心指标达成率 96%。" * 30)
            + "\n# 参考文献\n"
            + ("[1] Vaswani et al. Attention Is All You Need. NeurIPS 2017. " * 220)
        )
        assert len(long_doc) > 17_000
        page.locator("#pg-pack-text").fill(long_doc)
        picker = locate_first(page, ["#pg-pack-section-picker"], description="Long-doc section picker")
        picker_text = picker.inner_text()
        assert "参考文献" in picker_text and "结论" in picker_text
        # Confirm 参考文献 checkbox is unchecked by default while 结论 is checked
        ref_checked = picker.locator("li", has_text="参考文献").locator("input[type='checkbox']").is_checked()
        concl_checked = picker.locator("li", has_text="结论").locator("input[type='checkbox']").is_checked()
        assert not ref_checked, "References section should be unchecked by default for >16k docs"
        assert concl_checked, "Conclusion section should remain checked for >16k docs"

        click_resilient(page, ["#pg-pack-generate-btn"], description="Generate anchored long-doc pack")
        page.wait_for_function(
            "() => (document.querySelector('#pg-pack-insight')?.textContent || '').includes('长论文多模态')",
            timeout=30_000,
        )
        exported = page.locator("#pg-pack-prompt-preview").inner_text()
        assert "96%" in exported or "88.5%" in exported, "Long-doc conclusion/abstract metrics missing after section filtering"
        guard.assert_no_browser_errors("G3_PACK_08")


def get_specs() -> list[TestSpec]:
    return [
        TestSpec(
            "G3_PACK_01",
            3,
            "Prompt Pack rule engine: schema, HEX palette, varied layouts, source-grounded data",
            g3_pack_01_rule_engine_contract,
            ("api", "pack", "honesty"),
            True,
        ),
        TestSpec(
            "G3_PACK_02",
            3,
            "Prompt Pack auto mode: broken BYOK degrades to rules with fallbackReason, no key echo",
            g3_pack_02_byok_failure_falls_back,
            ("api", "pack", "byok", "security"),
            True,
        ),
        TestSpec(
            "G3_PACK_03",
            3,
            "/pack UI: sample -> generate -> export prompt with HEX + titles -> copy matches preview",
            g3_pack_03_ui_sample_to_copy,
            ("ui", "pack", "flow"),
            True,
        ),
        TestSpec(
            "G3_PACK_04",
            3,
            "/pack at 390px: zero horizontal overflow after generation",
            g3_pack_04_mobile_390_no_overflow,
            ("ui", "pack", "rwd"),
            True,
        ),
        TestSpec(
            "G3_PACK_05",
            3,
            "BYOK presets + /api/byok/test SSRF guard & zero key echo",
            g3_pack_05_byok_presets_and_test_ssrf,
            ("api", "ui", "byok", "security"),
            True,
        ),
        TestSpec(
            "G3_PACK_06",
            3,
            "/pack Gamma two-part copy, ChatGPT two-step copy & partial style/outline copy",
            g3_pack_06_gamma_split_and_chatgpt_twostep_copy,
            ("ui", "pack", "export"),
            True,
        ),
        TestSpec(
            "G3_PACK_07",
            3,
            "/pack style HEX edit, outline data/note edit & 10-item local history switching",
            g3_pack_07_style_editor_outline_data_notes_and_history,
            ("ui", "pack", "editor"),
            True,
        ),
        TestSpec(
            "G3_PACK_08",
            3,
            "Topbar /pack active pill, ?style reference anchor & >16k long-doc section picker",
            g3_pack_08_topbar_style_anchor_and_long_doc_picker,
            ("ui", "pack", "integration"),
            True,
        ),
    ]
