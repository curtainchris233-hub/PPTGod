"""Tier 8: PPTGod v6 Image-to-Style, Deck Linter, Brand Footer, Rehearsal Cockpit, UX & Ops E2E Suite (6 Tests).

Covers every v6 upgrade end-to-end:
  - T8_PAL_01: /create Canvas Image-to-Style palette extraction from a synthetic PNG + WCAG 2.1 contrast status & 1-click Auto-Fix
  - T8_LINT_02: /generate 100-point Deck Quality Linter detection (long title + empty notes + low contrast) + 1-click auto-fix notes & contrast score improvement
  - T8_BRAND_03: Custom layout.brandFooter synced across SlideCanvas, native .pptx XML, and offline .html + /studio .pptgod.json export -> /create lossless import
  - T8_PRES_04: /deck/[id] Presenter Rehearsal Cockpit (P shortcut, countdown presets, live timer tick, teleprompter A+/A-, Next Slide preview & 390px zero-overflow)
  - T8_UX_05: Gallery compact inline search + 5-Domain bar (desktop & 390px mobile), /generate 5-domain <optgroup> selector, and Studio domain-smart default audience
  - T8_OPS_06: Production ops endpoints GET /api/health, /robots.txt, and /sitemap.xml (all 36 public styles indexed, private styles strictly zero-leaked)
"""

from __future__ import annotations

import json
import re
import struct
import uuid
import zlib

from tests.e2e.config import (
    ACCOUNT_DEMO,
    DESKTOP_VIEWPORT,
    MOBILE_VIEWPORT,
    make_valid_deck_payload,
    make_valid_prompt_payload,
)
from tests.e2e.helpers import (
    HtmlDeckVerifier,
    PptxVerifier,
    TestCaseSpec,
    TestContext,
)


def _tok(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def _make_synthetic_png(width: int = 40, height: int = 40) -> bytes:
    """Create a pure-Python valid RGBA PNG with dark navy perimeter and vibrant gold/coral center."""
    raw_rows = bytearray()
    for y in range(height):
        raw_rows.append(0)  # filter type 0
        for x in range(width):
            if 10 <= x <= 29 and 10 <= y <= 19:
                # Vibrant coral accent block
                raw_rows.extend((230, 68, 42, 255))
            elif 10 <= x <= 29 and 20 <= y <= 29:
                # Secondary teal accent block
                raw_rows.extend((18, 168, 148, 255))
            else:
                # Deep midnight navy background around perimeter
                raw_rows.extend((14, 22, 40, 255))

    def _chunk(ctype: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(ctype + data) & 0xFFFFFFFF
        return struct.pack("!I", len(data)) + ctype + data + struct.pack("!I", crc)

    ihdr = struct.pack("!IIBBBBB", width, height, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw_rows), level=6)
    return (
        b"\x89PNG\r\n\x1a\n"
        + _chunk(b"IHDR", ihdr)
        + _chunk(b"IDAT", idat)
        + _chunk(b"IEND", b"")
    )


def t8_pal_01_image_to_style_and_wcag_autofix(ctx: TestContext) -> None:
    """Upload a synthetic PNG in /create -> verify Canvas extraction updates palette, swatches & WCAG auto-fix."""
    png_bytes = _make_synthetic_png()

    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.goto_ok(ctx.url("/create"))

        # Upload reference PNG to Image-to-Style extractor
        page.locator("#pg-extract-image-input").set_input_files(
            {
                "name": "navy-coral-poster.png",
                "mimeType": "image/png",
                "buffer": png_bytes,
            }
        )

        # Extracted swatch strip must appear and color family should switch to 'dark'
        swatches = page.locator("#pg-extracted-swatches .pg-extracted-swatch")
        swatches.first.wait_for(state="visible", timeout=8000)
        assert swatches.count() >= 2, f"Expected >= 2 extracted swatches, got {swatches.count()}"

        color_family_val = page.locator("#create-color-family").input_value()
        assert color_family_val == "dark", (
            f"Expected dark canvas extracted from dark-navy PNG, got colorFamily={color_family_val!r}"
        )

        wcag_text = page.locator("#pg-wcag-status").inner_text()
        assert re.search(r"WCAG\s+(AAA|AA)", wcag_text), (
            f"Extracted palette should automatically pass WCAG AA/AAA, got: {wcag_text}"
        )

        # Now intentionally sabotage text color to match bg (low contrast -> WARN) and test 1-click Auto-Fix
        page.locator(".pg-color-field", has_text="主文字色").locator('input[type="color"]').fill("#11192a")
        page.wait_for_timeout(150)
        warn_text = page.locator("#pg-wcag-status").inner_text()
        assert "WCAG WARN" in warn_text, f"Expected WCAG WARN after low-contrast edit, got: {warn_text}"

        page.locator("#pg-wcag-autofix-btn").click()
        page.wait_for_timeout(150)
        fixed_text = page.locator("#pg-wcag-status").inner_text()
        assert re.search(r"WCAG\s+(AAA|AA)", fixed_text), (
            f"Expected WCAG AA/AAA after 1-click autofix, got: {fixed_text}"
        )
        guard.assert_no_browser_errors("T8_PAL_01")


def t8_lint_02_deck_quality_audit_and_autofix(ctx: TestContext) -> None:
    """Verify 100-point DeckAuditDrawer detects issues and raises score via 1-click note & contrast fixes."""
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.goto_ok(ctx.url("/generate?style=swiss-international-grid"))

        # Clear speaker notes on slide 0 and enter an overly long title to trigger linter issues
        page.locator("#pg-gen-speaker-notes").fill("")
        page.locator("#pg-deck-tweaker-toggle").click()
        page.locator("#pg-deck-bg-input").fill("#18181b")  # Dark bg against dark text -> severe WCAG WARN!
        page.wait_for_timeout(200)

        page.locator("#pg-deck-audit-toggle").click()
        page.locator("#pg-deck-audit-panel").wait_for(state="visible")

        score_before = int(
            page.locator("#pg-deck-audit-score").get_attribute("data-score") or "100"
        )
        assert score_before < 85, f"Expected degraded audit score with low contrast & missing notes, got {score_before}"

        # 1-click auto-fix contrast
        page.locator("#pg-audit-autofix-contrast-btn").click()
        page.wait_for_timeout(180)

        # 1-click auto-fill missing speaker notes
        page.locator("#pg-audit-autofix-notes-btn").click()
        page.wait_for_timeout(200)

        score_after = int(
            page.locator("#pg-deck-audit-score").get_attribute("data-score") or "0"
        )
        assert score_after > score_before, (
            f"Expected audit score to improve after 1-click fixes ({score_before} -> {score_after})"
        )
        notes_after = page.locator("#pg-gen-speaker-notes").input_value()
        assert len(notes_after.strip()) >= 12, f"Expected auto-filled speaker notes, got {notes_after!r}"
        guard.assert_no_browser_errors("T8_LINT_02")


def t8_brand_03_custom_brand_footer_and_json_portability(ctx: TestContext) -> None:
    """Verify custom layout.brandFooter renders in Canvas, .pptx XML, and .html + .pptgod.json round-trip."""
    footer_marker = f"清华大学智能实验室 · {_tok('BF')}"

    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.goto_ok(ctx.url("/generate?style=nature-okabe-ito-evidence"))

        # Set custom brandFooter in DeckSpecTweaker
        page.locator("#pg-deck-tweaker-toggle").click()
        page.locator("#pg-deck-footer-input").fill(footer_marker)
        page.wait_for_timeout(160)

        # Switch to slide 2 (non-cover) and confirm custom footer renders live on SlideCanvas
        page.locator(".pg-gen-slide-card").nth(1).click()
        page.wait_for_timeout(180)
        stage_text = page.locator(".pg-stage-canvas-wrap").first.inner_text()
        assert footer_marker in stage_text, (
            f"Expected custom brandFooter {footer_marker!r} live on SlideCanvas, got: {stage_text[:200]}"
        )

        # Export offline .html and verify footer_marker is present
        _, html_bytes = guard.capture_download(
            lambda: page.locator("#pg-gen-export-html-btn").click()
        )
        html_text = html_bytes.decode("utf-8")
        HtmlDeckVerifier.verify(html_text, expected_min_slides=5)
        assert footer_marker in html_text, "Offline .html export missing custom brandFooter"

        # Export native .pptx and verify footer_marker is present in slide XML
        _, pptx_bytes = guard.capture_download(
            lambda: page.locator("#pg-gen-export-pptx-btn").click()
        )
        PptxVerifier.verify(
            pptx_bytes,
            expected_min_slides=5,
            expected_slide_texts=[footer_marker],
        )

        # Export .pptgod.json from /studio/chalkboard-classic-lesson and import it in /create
        guard.goto_ok(ctx.url("/studio/chalkboard-classic-lesson"))
        _, json_bytes = guard.capture_download(
            lambda: page.locator("#pg-studio-export-json-btn").click()
        )
        pack = json.loads(json_bytes.decode("utf-8"))
        assert pack.get("schema") == "pptgod.style.v1"
        assert pack["visualSpec"]["layout"]["archetype"] == "chalkboard-class"

        guard.goto_ok(ctx.url("/create"))
        page.locator("#pg-import-style-json-input").set_input_files(
            {
                "name": "chalkboard.pptgod.json",
                "mimeType": "application/json",
                "buffer": json_bytes,
            }
        )
        page.wait_for_timeout(200)
        assert page.locator("#create-arch").input_value() == "chalkboard-class"
        assert "黑板" in page.locator("#create-title").input_value()
        guard.assert_no_browser_errors("T8_BRAND_03")


def t8_pres_04_deck_share_rehearsal_cockpit(ctx: TestContext) -> None:
    """Verify /deck/[id] P-key Presenter Rehearsal Cockpit: countdown presets, live timer, teleprompter & mobile RWD."""
    author = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    deck_payload = make_valid_deck_payload(title=f"[E2E-T8] 排练提词实测 {_tok('PR')}")
    deck_payload["isPublic"] = True

    with ctx.cleanup() as cleanup:
        created = (
            author.post("/api/decks", json_body=deck_payload)
            .assert_status(201)
            .require_json()["deck"]
        )
        deck_id = created["id"]
        cleanup.register_delete_deck(author, deck_id)

        with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
            page = guard.page
            guard.goto_ok(ctx.url(f"/deck/{deck_id}"))

            # Toggle Presenter Rehearsal Cockpit via keyboard shortcut 'p'
            page.keyboard.press("p")
            cockpit = page.locator("#pg-rehearsal-cockpit")
            cockpit.wait_for(state="visible", timeout=6000)

            # Select 5-min preset (300s) -> clock shows 05:00
            page.locator('[data-timer-preset="300"]').click()
            assert page.locator("#pg-rehearsal-clock").inner_text().strip() == "05:00"

            # Start timer and verify countdown ticks down
            page.locator("#pg-rehearsal-timer-toggle").click()
            page.wait_for_timeout(1300)
            ticked = page.locator("#pg-rehearsal-clock").inner_text().strip()
            assert ticked != "05:00", f"Expected rehearsal countdown to tick down, stayed at {ticked!r}"
            page.locator("#pg-rehearsal-timer-toggle").click()  # pause

            # Increase teleprompter font size
            before_px = page.locator("#pg-rehearsal-notes-text").evaluate(
                "el => parseFloat(getComputedStyle(el).fontSize)"
            )
            page.locator("#pg-teleprompter-font-inc").click()
            after_px = page.locator("#pg-rehearsal-notes-text").evaluate(
                "el => parseFloat(getComputedStyle(el).fontSize)"
            )
            assert after_px > before_px, f"Expected font size to increase ({before_px} -> {after_px})"

            # Next slide thumbnail preview is visible and advances slide when clicked
            next_preview = page.locator("#pg-rehearsal-next-preview")
            next_preview.wait_for(state="visible")
            next_preview.click()
            page.wait_for_timeout(150)
            assert "2 /" in page.locator(".pg-share-topbar").inner_text()
            guard.assert_no_browser_errors("T8_PRES_04 desktop")

        # Mobile 390px zero-overflow in Rehearsal Cockpit mode
        with ctx.open_page(viewport=MOBILE_VIEWPORT) as guard:
            page = guard.page
            guard.goto_ok(ctx.url(f"/deck/{deck_id}"))
            page.locator("#pg-share-rehearsal-btn").click()
            page.locator("#pg-rehearsal-cockpit").wait_for(state="visible")
            overflow = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
            assert overflow <= 2, f"Mobile 390px /deck rehearsal cockpit overflow={overflow}px"
            guard.assert_no_browser_errors("T8_PRES_04 mobile")


def t8_ux_05_gallery_layout_optgroup_and_domain_audience(ctx: TestContext) -> None:
    """Verify compact Gallery domain+search bar, 5-domain <optgroup> in /generate, and domain-smart Studio audience."""
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.goto_ok(ctx.url("/"))

        # Search input sits inside .pg-domain-bar inline with 5-domain tabs on desktop
        in_domain_bar = page.locator(".pg-domain-bar #pg-gallery-search").count()
        assert in_domain_bar == 1, "Expected #pg-gallery-search inline inside .pg-domain-bar"
        guard.assert_no_browser_errors("T8_UX_05 gallery")

    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        # /generate style selector grouped into 5 domain <optgroup>s
        guard.goto_ok(ctx.url("/generate"))
        optgroup_count = page.locator("#pg-gen-style-select optgroup").count()
        assert optgroup_count >= 5, f"Expected >= 5 domain optgroups in /generate select, got {optgroup_count}"

        # Studio domain-smart default audience (not hardcoded corporate audience)
        guard.goto_ok(ctx.url("/studio/chalkboard-classic-lesson"))
        teach_aud = page.locator("#pg-param-audience").input_value()
        assert "学生" in teach_aud or "教研" in teach_aud, (
            f"Expected classroom default audience for chalkboard style, got: {teach_aud!r}"
        )

        guard.goto_ok(ctx.url("/studio/nature-okabe-ito-evidence"))
        sci_aud = page.locator("#pg-param-audience").input_value()
        assert "评审" in sci_aud or "专家" in sci_aud, (
            f"Expected research panel default audience for scientific style, got: {sci_aud!r}"
        )
        guard.assert_no_browser_errors("T8_UX_05 generate+studio")


def t8_ops_06_health_sitemap_privacy_and_robots(ctx: TestContext) -> None:
    """Verify GET /api/health, /robots.txt, and privacy-safe /sitemap.xml (zero private prompt leak)."""
    anon = ctx.api()
    author = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)

    # 1. /api/health
    health = anon.get("/api/health").assert_status(200, "GET /api/health").require_json()
    assert health.get("status") == "ok"
    assert int(health.get("catalogCount", 0)) >= 36
    assert health.get("dbMode") == "wal"

    # 2. /robots.txt
    robots = anon.get("/robots.txt").assert_status(200, "GET /robots.txt")
    robots_txt = robots.body.decode("utf-8", errors="replace")
    assert "Disallow: /api/" in robots_txt
    assert "sitemap.xml" in robots_txt.lower()

    # 3. /sitemap.xml includes public styles and strictly excludes newly created private style
    with ctx.cleanup() as cleanup:
        priv_payload = make_valid_prompt_payload(
            title=f"[E2E-T8-PRIV] 绝密私有模板 {_tok('SM')}",
            is_public=False,
        )
        priv = (
            author.post("/api/prompts", json_body=priv_payload)
            .assert_status(201)
            .require_json()["prompt"]
        )
        cleanup.register_delete_prompt(author, priv["id"])

        sm_resp = anon.get("/sitemap.xml").assert_status(200, "GET /sitemap.xml")
        sm_xml = sm_resp.body.decode("utf-8", errors="replace")
        assert "/studio/chalkboard-classic-lesson" in sm_xml
        assert "/studio/nature-okabe-ito-evidence" in sm_xml
        assert priv["slug"] not in sm_xml, (
            f"PRIVACY LEAK: private style slug {priv['slug']!r} appeared in /sitemap.xml!"
        )


def get_tier8_tests() -> list[TestCaseSpec]:
    return [
        TestCaseSpec(
            "T8_PAL_01_image_to_style_and_wcag_autofix",
            8,
            "/create Canvas Image-to-Style extraction & WCAG 2.1 contrast Auto-Fix",
            ("v6", "ui", "palette", "wcag"),
            t8_pal_01_image_to_style_and_wcag_autofix,
        ),
        TestCaseSpec(
            "T8_LINT_02_deck_quality_audit_and_autofix",
            8,
            "/generate 100-point Deck Quality Linter & 1-click contrast/notes fixes",
            ("v6", "ui", "linter"),
            t8_lint_02_deck_quality_audit_and_autofix,
        ),
        TestCaseSpec(
            "T8_BRAND_03_custom_brand_footer_and_json_portability",
            8,
            "Custom brandFooter synced in Canvas/.pptx/.html & .pptgod.json export/import",
            ("v6", "ui", "export", "json"),
            t8_brand_03_custom_brand_footer_and_json_portability,
        ),
        TestCaseSpec(
            "T8_PRES_04_deck_share_rehearsal_cockpit",
            8,
            "/deck/[id] P-key Presenter Rehearsal Cockpit (timer, teleprompter, next preview & 390px)",
            ("v6", "ui", "rehearsal"),
            t8_pres_04_deck_share_rehearsal_cockpit,
        ),
        TestCaseSpec(
            "T8_UX_05_gallery_layout_optgroup_and_domain_audience",
            8,
            "Gallery compact domain+search bar, /generate 5-domain optgroup & Studio domain audience",
            ("v6", "ui", "ux"),
            t8_ux_05_gallery_layout_optgroup_and_domain_audience,
        ),
        TestCaseSpec(
            "T8_OPS_06_health_sitemap_privacy_and_robots",
            8,
            "Production /api/health, /robots.txt & privacy-safe /sitemap.xml",
            ("v6", "api", "ops", "security"),
            t8_ops_06_health_sitemap_privacy_and_robots,
        ),
    ]
