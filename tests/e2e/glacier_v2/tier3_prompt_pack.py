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
    ]
