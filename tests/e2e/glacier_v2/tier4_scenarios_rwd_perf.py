"""Tier 4 — 5-Breakpoint Responsive Matrix, Mobile Editor Ergonomics & Glacier Visual Parity.

Automates per-breakpoint zero-overflow validation (`1920/1440/1024/768/390px`),
mobile `390px` Presentation Editor filmstrip & inspector collapse ergonomics,
and Glacier UI 2.0 sans-serif / StyleCard harmonization across secondary pages.
"""

from __future__ import annotations

import re

from .config import (
    ACCOUNT_OFFICIAL,
    DESKTOP_1440,
    LAPTOP_1024,
    MOBILE_390,
    TABLET_768,
    WIDE_1920,
)
from .helpers import (
    TestContext,
    TestSpec,
    click_resilient,
    locate_first,
)

_CORE_RWD_ROUTES: tuple[str, ...] = (
    "/",
    "/gallery",
    "/generate",
    "/generate?mode=editor",
    "/collections",
    "/tools",
    "/compare",
    f"/creator/{ACCOUNT_OFFICIAL.username}",
    "/studio/apple-soft-bento-modular",
    "/pack",
)


def _assert_breakpoint_zero_overflow(
    ctx: TestContext,
    bp_name: str,
    viewport: tuple[int, int],
) -> None:
    failures: list[str] = []
    chunk_size = 3
    for start in range(0, len(_CORE_RWD_ROUTES), chunk_size):
        chunk = _CORE_RWD_ROUTES[start : start + chunk_size]
        for chunk_attempt in range(1, 5):
            chunk_failures: list[str] = []
            try:
                with ctx.browser_page(viewport=viewport, track_web_vitals=False) as guard:
                    page = guard.page
                    for route in chunk:
                        guard.goto_ok(f"{ctx.base_url}{route}")
                        overflow = page.evaluate(
                            "() => Math.ceil(document.documentElement.scrollWidth - window.innerWidth)"
                        )
                        if overflow > 1:
                            chunk_failures.append(f"{route} @ {bp_name}px overflow={overflow}px")
                    guard.assert_no_browser_errors(f"G4_RWD@{bp_name}[{start}]")
                failures.extend(chunk_failures)
                break
            except Exception as err:  # noqa: BLE001 — only restart on Chromium renderer crash
                if isinstance(err, AssertionError):
                    raise
                msg = str(err).lower()
                is_crash = any(
                    m in msg
                    for m in ("crash", "target closed", "pipe closed", "err_aborted", "page.goto: timeout")
                )
                if chunk_attempt < 4 and is_crash:
                    ctx.playwright.restart_browser()
                    continue
                raise

    assert not failures, f"Horizontal overflow detected at {bp_name}px: {failures}"


def g4_rwd_01_wide_1920(ctx: TestContext) -> None:
    _assert_breakpoint_zero_overflow(ctx, "1920", WIDE_1920)


def g4_rwd_02_desktop_1440(ctx: TestContext) -> None:
    _assert_breakpoint_zero_overflow(ctx, "1440", DESKTOP_1440)


def g4_rwd_03_laptop_1024(ctx: TestContext) -> None:
    _assert_breakpoint_zero_overflow(ctx, "1024", LAPTOP_1024)


def g4_rwd_04_tablet_768(ctx: TestContext) -> None:
    _assert_breakpoint_zero_overflow(ctx, "768", TABLET_768)


def g4_rwd_05_mobile_390(ctx: TestContext) -> None:
    _assert_breakpoint_zero_overflow(ctx, "390", MOBILE_390)


def g4_rwd_06_mobile_editor_filmstrip_and_inspector(ctx: TestContext) -> None:
    """Verify 390px mobile Editor filmstrip anti-truncation and collapsible inspector toggle."""
    with ctx.browser_page(viewport=MOBILE_390, track_web_vitals=False) as guard:
        page = guard.page
        guard.goto_ok(f"{ctx.base_url}/generate?mode=editor")

        # 1. Filmstrip cards have adequate width (>= 165px) and active slide actions stay visible while inactive hide
        metrics = page.evaluate(
            """() => {
              const items = Array.from(document.querySelectorAll('.gl-slide-tree-item'));
              if (items.length < 2) return { count: items.length };
              const active = items[0];
              const inactive = items[1];
              const activeLabel = active.querySelector('.gl-slide-tree-type');
              const inactiveActions = inactive.querySelector('.pg-gen-slide-card-actions');
              return {
                count: items.length,
                activeWidth: Math.round(active.getBoundingClientRect().width),
                labelWidth: activeLabel ? Math.round(activeLabel.getBoundingClientRect().width) : 0,
                inactiveActionsDisplay: inactiveActions ? getComputedStyle(inactiveActions).display : '',
                overflow: Math.ceil(document.documentElement.scrollWidth - window.innerWidth),
              };
            }"""
        )
        assert metrics["count"] >= 2, f"Expected >=2 slide tree items, got {metrics}"
        assert metrics["activeWidth"] >= 165, (
            f"Mobile filmstrip item too narrow ({metrics['activeWidth']}px)"
        )
        assert metrics["labelWidth"] >= 18, (
            f"Mobile filmstrip slide type label truncated ({metrics['labelWidth']}px)"
        )
        assert metrics["inactiveActionsDisplay"] == "none", (
            f"Inactive mobile filmstrip items should hide 4-icon action bar, got {metrics['inactiveActionsDisplay']!r}"
        )
        assert metrics["overflow"] <= 1, (
            f"Mobile Editor horizontal overflow: {metrics['overflow']}px"
        )

        # 2. Mobile inspector fold toggle collapses & restores inspector smoothly
        toggle = locate_first(
            page,
            [".gl-ed-right-mobile-toggle"],
            description="Mobile Editor inspector fold toggle",
        )
        assert toggle.get_attribute("aria-expanded") == "true"
        toggle.click()
        page.wait_for_timeout(120)
        assert toggle.get_attribute("aria-expanded") == "false"
        assert not page.locator("#pg-edit-slide-title").first.is_visible(), (
            "Inspector title input remained visible after collapsing mobile inspector"
        )
        toggle.click()
        page.wait_for_timeout(120)
        assert toggle.get_attribute("aria-expanded") == "true"
        locate_first(page, ["#pg-edit-slide-title"], description="Restored inspector title input")

        guard.assert_no_browser_errors("G4_RWD_06")


def g4_visual_01_glacier_secondary_page_parity(ctx: TestContext) -> None:
    """Verify Glacier 2.0 sans-serif UI headings, StyleCard on Creator Profile & flush container alignment."""
    with ctx.browser_page(viewport=DESKTOP_1440, track_web_vitals=False) as guard:
        page = guard.page

        # 1. Creator Profile uses Glacier StyleCard + StyleDetailDrawer & sans-serif heading
        guard.goto_ok(f"{ctx.base_url}/creator/{ACCOUNT_OFFICIAL.username}")
        creator_check = page.evaluate(
            """() => {
              const h1 = document.querySelector('.pg-creator-name');
              const card = document.querySelector('article.gl-style-card[data-prompt-slug]');
              const container = document.querySelector('.gl-main-inner .pg-container');
              return {
                h1Font: h1 ? getComputedStyle(h1).fontFamily : '',
                hasGlStyleCard: Boolean(card),
                containerPadLeft: container ? parseFloat(getComputedStyle(container).paddingLeft) : -1,
              };
            }"""
        )
        assert not re.search(r"(?<!sans-)serif", creator_check["h1Font"], re.I), (
            f"Creator H1 must use Glacier sans-serif, got {creator_check['h1Font']!r}"
        )
        assert creator_check["hasGlStyleCard"], (
            "Creator Profile must render Glacier StyleCard (.gl-style-card)"
        )
        assert creator_check["containerPadLeft"] == 0, (
            f"Secondary page inside .gl-main-inner still has double horizontal padding: {creator_check['containerPadLeft']}px"
        )

        # Scroll first StyleCard into view, hover, then open StyleDetailDrawer
        first_card = locate_first(
            page,
            ["article.gl-style-card[data-prompt-slug]"],
            description="First StyleCard on Creator Profile",
        )
        first_card.scroll_into_view_if_needed()
        first_card.hover()
        page.wait_for_timeout(150)
        click_resilient(
            first_card,
            [lambda c: c.get_by_role("button", name=re.compile(r"预览|详情", re.I))],
            description="Creator Profile StyleCard preview button",
        )
        locate_first(page, ['[role="dialog"]'], description="StyleDetailDrawer on Creator Profile")
        page.keyboard.press("Escape")

        # 2. Studio H1 uses Glacier sans-serif & zero double container padding
        guard.goto_ok(f"{ctx.base_url}/studio/apple-soft-bento-modular")
        studio_check = page.evaluate(
            """() => {
              const h1 = document.querySelector('.pg-studio-h1');
              const container = document.querySelector('.gl-main-inner .pg-container');
              return {
                h1Font: h1 ? getComputedStyle(h1).fontFamily : '',
                containerPadLeft: container ? parseFloat(getComputedStyle(container).paddingLeft) : -1,
              };
            }"""
        )
        assert not re.search(r"(?<!sans-)serif", studio_check["h1Font"], re.I), (
            f"Studio H1 must use Glacier sans-serif, got {studio_check['h1Font']!r}"
        )
        assert studio_check["containerPadLeft"] == 0, (
            f"Studio page inside .gl-main-inner still has double horizontal padding: {studio_check['containerPadLeft']}px"
        )

        guard.assert_no_browser_errors("G4_VISUAL_01")


def get_specs() -> list[TestSpec]:
    return [
        TestSpec("G4_RWD_01", 4, "Wide 1920px zero horizontal overflow across 10 routes", g4_rwd_01_wide_1920, ("ui", "rwd"), True),
        TestSpec("G4_RWD_02", 4, "Desktop 1440px zero horizontal overflow across 10 routes", g4_rwd_02_desktop_1440, ("ui", "rwd"), True),
        TestSpec("G4_RWD_03", 4, "Laptop 1024px zero horizontal overflow across 10 routes", g4_rwd_03_laptop_1024, ("ui", "rwd"), True),
        TestSpec("G4_RWD_04", 4, "Tablet 768px zero horizontal overflow across 10 routes", g4_rwd_04_tablet_768, ("ui", "rwd"), True),
        TestSpec("G4_RWD_05", 4, "Mobile 390px zero horizontal overflow across 10 routes", g4_rwd_05_mobile_390, ("ui", "rwd"), True),
        TestSpec(
            "G4_RWD_06",
            4,
            "Mobile 390px Presentation Editor filmstrip anti-truncation & collapsible inspector",
            g4_rwd_06_mobile_editor_filmstrip_and_inspector,
            ("ui", "rwd", "editor"),
            True,
        ),
        TestSpec(
            "G4_VISUAL_01",
            4,
            "Glacier 2.0 secondary-page parity: sans-serif headings, Creator StyleCard & flush padding",
            g4_visual_01_glacier_secondary_page_parity,
            ("ui", "visual", "glacier"),
            True,
        ),
    ]
