"""Tier 3 — Cross-Feature Workflows, URL Query Sync & Browser-Local BYOK Journeys.

Validates end-to-end client-side navigation synchronization across routes,
browser-local BYOK configuration sharing (S22 zero-DB-leak invariant),
Workshop evidenceDensity/routeMode forwarding, and full cross-route deck lifecycle.
"""

from __future__ import annotations

import json
import re
from typing import Any

from .config import (
    ACCOUNT_DEMO,
    PPTX_CONTENT_TYPE,
    build_valid_pptx_bytes,
    unique_token,
)
from .helpers import (
    TestContext,
    TestSpec,
    assert_any_visible,
    click_resilient,
    fill_resilient,
    locate_attached,
    locate_first,
    login_via_api,
)


def g3_flow_01_client_url_query_sync(ctx: TestContext) -> None:
    """Verify client-side query sync on /generate, /gallery, /tools, and /collections."""
    with ctx.browser_page() as guard:
        page = guard.page

        # 1. /generate (Workshop) -> Sidebar '设计体检' (/generate?panel=audit) -> opens Editor + Audit
        guard.goto_ok(f"{ctx.base_url}/generate")
        locate_first(page, ["#pg-gen-run-btn"], description="Workshop generate button")

        click_resilient(
            page,
            ['aside a[href="/generate?panel=audit"]'],
            description="Sidebar Design Audit link from /generate Workshop",
        )
        locate_first(
            page,
            ["#pg-deck-audit-panel"],
            timeout_ms=ctx.timeout_ms,
            description="DeckAuditDrawer opened after client-side click from Workshop",
        )

        # Back to Workshop via Editor topbar back button cleans ?panel=audit
        click_resilient(
            page,
            [
                lambda p: p.get_by_role("button", name=re.compile(r"返回工坊|返回")),
                ".gl-ed-back-btn",
            ],
            description="Editor back-to-workshop button",
        )
        locate_first(page, ["#pg-gen-run-btn"], description="Workshop restored after back click")
        assert "panel=audit" not in page.url, (
            f"Expected ?panel=audit cleared when returning to Workshop, got {page.url!r}"
        )

        # Explicit ?mode=editor lands directly in Editor; ?mode=create lands directly in Workshop
        guard.goto_ok(f"{ctx.base_url}/generate?mode=editor")
        locate_first(page, ['[data-slide-tree="true"]'], description="Editor via ?mode=editor")

        guard.goto_ok(f"{ctx.base_url}/generate?mode=create")
        locate_first(page, ["#pg-gen-run-btn"], description="Workshop via ?mode=create")

        # 2. Already on /gallery -> Topbar global search filters cards in real time
        guard.goto_ok(f"{ctx.base_url}/gallery")
        assert page.locator("article[data-prompt-slug]").count() == 36, (
            "Expected 36 cards on initial /gallery load"
        )
        topbar_search = locate_first(
            page,
            ["#gl-topbar-search-input"],
            description="Topbar global search input while on /gallery",
        )
        topbar_search.fill("Bento")
        topbar_search.press("Enter")
        page.wait_for_timeout(400)
        bento_count = page.locator("article[data-prompt-slug]").count()
        assert 1 <= bento_count < 10, (
            f"Topbar search 'Bento' while already on /gallery failed to filter cards: count={bento_count}"
        )
        assert page.locator('article[data-prompt-slug="apple-soft-bento-modular"]').count() == 1, (
            "Topbar search 'Bento' did not keep apple-soft-bento-modular visible"
        )

        # 3. /tools bidirectional tab sync with Sidebar links
        guard.goto_ok(f"{ctx.base_url}/tools?tab=pptx-inspect")
        assert locate_first(page, ["#pg-tool-tab-pptx"]).get_attribute("aria-selected") == "true"

        click_resilient(
            page,
            ['aside a[href="/tools?tab=pacing"]'],
            description="Sidebar Rehearsal link while already on /tools?tab=pptx-inspect",
        )
        page.wait_for_timeout(200)
        assert locate_first(page, ["#pg-tool-tab-pacing"]).get_attribute("aria-selected") == "true", (
            "Sidebar click to /tools?tab=pacing did not switch ToolsClient activeTab"
        )

        click_resilient(
            page,
            ["#pg-tool-tab-palette"],
            description="Tools palette-wcag tab button",
        )
        page.wait_for_timeout(150)
        assert "tab=palette-wcag" in page.url, (
            f"In-page tab switch on /tools did not update URL: {page.url!r}"
        )

        # 4. /collections bidirectional tab sync
        guard.goto_ok(f"{ctx.base_url}/collections")
        click_resilient(page, ["#pg-tab-favorites"], description="Collections favorites tab")
        page.wait_for_timeout(150)
        assert "tab=favorites" in page.url, (
            f"In-page tab click on /collections did not update URL: {page.url!r}"
        )

        guard.assert_no_browser_errors("G3_FLOW_01")


def g3_flow_02_byok_local_store_closed_loop(ctx: TestContext) -> None:
    """Verify SettingsModal <-> Editor browser-local BYOK sync and S22 zero-DB-leak guarantee."""
    with ctx.browser_page() as guard:
        page = guard.page
        fake_session_key = "sk-e2e-session-only-test-key-never-db"

        # 1. Open Editor directly via ?mode=editor -> click AI Assistant BYOK button -> opens SettingsModal
        guard.goto_ok(f"{ctx.base_url}/generate?mode=editor")
        byok_btn = locate_first(
            page,
            ["#pg-ed-byok-config-btn"],
            description="Editor AI Assistant BYOK config button",
        )
        assert "配置本地 BYOK" in (byok_btn.inner_text() or ""), (
            f"Expected unconfigured BYOK button text initially, got {byok_btn.inner_text()!r}"
        )
        byok_btn.click()

        settings_dlg = locate_first(page, ["#gl-settings-dialog"], description="SettingsModal from Editor")
        click_resilient(settings_dlg, ["#gl-settings-byok-llm"], description="BYOK LLM toggle")
        fill_resilient(
            settings_dlg,
            ["#gl-settings-byok-base"],
            "https://api.deepseek.com/v1",
            description="BYOK base URL input",
        )
        fill_resilient(
            settings_dlg,
            ["#gl-settings-byok-model"],
            "deepseek-chat",
            description="BYOK text model input",
        )
        fill_resilient(
            settings_dlg,
            ["#gl-settings-byok-key"],
            fake_session_key,
            description="BYOK session API key input",
        )
        click_resilient(
            settings_dlg,
            ["#gl-settings-byok-save-btn"],
            description="Save local BYOK settings button",
        )
        page.wait_for_timeout(150)

        # Verify sessionStorage holds key while localStorage NEVER stores apiKey
        storage_audit = page.evaluate(
            """() => ({
              localRaw: window.localStorage.getItem('pptgod_byok_prefs_v1') || '',
              sessionKey: window.sessionStorage.getItem('pptgod_byok_session_key_v1') || '',
            })"""
        )
        assert fake_session_key not in storage_audit["localRaw"], (
            "SECURITY VIOLATION: BYOK apiKey must NOT be stored in localStorage"
        )
        assert storage_audit["sessionKey"] == fake_session_key, (
            "BYOK session key was not saved in sessionStorage"
        )

        # Close SettingsModal and confirm Editor immediately reflects BYOK ready state
        page.keyboard.press("Escape")
        page.wait_for_timeout(150)
        assert "BYOK 已启用" in (byok_btn.inner_text() or ""), (
            f"Editor did not reactively reflect BYOK ready state: {byok_btn.inner_text()!r}"
        )

        # Re-open SettingsModal and clear session key -> Editor reverts to unconfigured
        byok_btn.click()
        settings_dlg = locate_first(page, ["#gl-settings-dialog"], description="SettingsModal reopen")
        click_resilient(
            settings_dlg,
            ["#gl-settings-byok-clear-btn"],
            description="Clear session API key button",
        )
        page.wait_for_timeout(150)
        page.keyboard.press("Escape")
        page.wait_for_timeout(150)
        assert "配置本地 BYOK" in (byok_btn.inner_text() or ""), (
            f"Editor did not revert after clearing BYOK session key: {byok_btn.inner_text()!r}"
        )

        guard.assert_no_browser_errors("G3_FLOW_02")


def g3_flow_03_workshop_density_and_pptx_route_forwarding(ctx: TestContext) -> None:
    """Verify Workshop Advanced Settings forward evidenceDensity & .pptx routeMode to /api/generate."""
    captured_payload: dict[str, Any] = {}

    with ctx.browser_page() as guard:
        page = guard.page

        def _capture_generate(req: Any) -> None:
            if "/api/generate" in req.url and req.method == "POST":
                try:
                    captured_payload.update(json.loads(req.post_data or "{}"))
                except Exception:
                    pass

        page.on("request", _capture_generate)
        guard.goto_ok(f"{ctx.base_url}/generate")

        # Upload a real .pptx file directly inside Workshop -> defaults routeMode to beautify-1to1
        file_input = locate_attached(
            page,
            ['input[type="file"]'],
            description="Workshop document upload input",
        )
        with page.expect_response(
            lambda r: "/api/parse-document" in r.url and r.request.method == "POST",
            timeout=ctx.timeout_ms,
        ) as parse_resp:
            file_input.set_input_files(
                {
                    "name": "lesson_sample.pptx",
                    "mimeType": PPTX_CONTENT_TYPE,
                    "buffer": build_valid_pptx_bytes(),
                }
            )
        assert parse_resp.value.status == 200, f"parse-document returned {parse_resp.value.status}"

        # Open Advanced Settings and select high-evidence density
        click_resilient(page, ["#pg-gen-adv-toggle-btn"], description="Workshop Advanced Settings toggle")
        click_resilient(
            page,
            ["#pg-density-high-evidence-btn"],
            description="High-evidence density option",
        )
        assert "is-active" in (
            locate_first(page, ["#pg-route-beautify-btn"]).get_attribute("class") or ""
        ), "Uploading .pptx in Workshop did not auto-select beautify-1to1 routeMode"

        with page.expect_response(
            lambda r: "/api/generate" in r.url and r.request.method == "POST",
            timeout=ctx.timeout_ms,
        ) as gen_resp:
            click_resilient(page, ["#pg-gen-run-btn"], description="Workshop generate button")
        assert gen_resp.value.status == 200, f"/api/generate returned {gen_resp.value.status}"

        assert captured_payload.get("evidenceDensity") == "high-evidence", (
            f"Workshop did not forward evidenceDensity='high-evidence': {captured_payload!r}"
        )
        assert captured_payload.get("routeMode") == "beautify-1to1", (
            f"Workshop did not forward routeMode='beautify-1to1': {captured_payload!r}"
        )

        # Verify Editor opened
        locate_first(page, ['[data-slide-tree="true"]'], description="Editor opened after generate")
        guard.assert_no_browser_errors("G3_FLOW_03")


def g3_flow_04_cross_route_creator_journey(ctx: TestContext) -> None:
    """Full cross-route journey: /generate -> save cloud deck -> /collections -> /deck/[id]?rehearsal=1."""
    demo = ctx.api_logged_in(ACCOUNT_DEMO)
    with ctx.cleanup() as cleanup:
        tok = unique_token("JRN")
        deck_topic = f"[E2E-JRN] Transformer 注意力机制精读 {tok}"

        with ctx.browser_page() as guard:
            login_via_api(guard.page, ctx.base_url, ACCOUNT_DEMO)
            page = guard.page

            # 1. Generate from Workshop with explicit topic
            guard.goto_ok(f"{ctx.base_url}/generate?style=apple-soft-bento-modular")
            # Ensure AppContext has finished hydrating /api/auth/me before saving to cloud
            page.locator("#pg-nav-login-btn").wait_for(state="hidden", timeout=ctx.timeout_ms)
            fill_resilient(page, ["#pg-gen-topic"], deck_topic, description="Workshop topic input")
            with page.expect_response(
                lambda r: "/api/generate" in r.url and r.request.method == "POST",
                timeout=ctx.timeout_ms,
            ) as gen_resp:
                click_resilient(page, ["#pg-gen-run-btn"], description="Generate deck button")
            assert gen_resp.value.status == 200

            locate_first(page, ['[data-slide-tree="true"]'], description="Editor slide tree")

            # 2. Save deck to cloud and register deterministic cleanup
            with page.expect_response(
                lambda r: r.url.endswith("/api/decks") and r.request.method == "POST",
                timeout=ctx.timeout_ms,
            ) as save_resp:
                click_resilient(
                    page,
                    [
                        "#pg-gen-save-deck-btn",
                        lambda p: p.get_by_role("button", name=re.compile(r"保存")),
                    ],
                    description="Editor save cloud deck button",
                )
            assert save_resp.value.status in (200, 201), (
                f"Save deck failed with HTTP {save_resp.value.status}"
            )
            saved_deck_id = save_resp.value.json()["deck"]["id"]
            cleanup.register_delete_deck(demo, saved_deck_id)

            # 3. Navigate to /collections and verify saved deck appears
            guard.goto_ok(f"{ctx.base_url}/collections")
            assert_any_visible(
                page,
                [lambda p: p.get_by_text(deck_topic)],
                timeout_ms=ctx.timeout_ms,
                description="Saved deck visible in /collections",
            )

            # 4. Open Rehearsal Cockpit directly for the saved deck
            guard.goto_ok(f"{ctx.base_url}/deck/{saved_deck_id}?rehearsal=1")
            locate_first(
                page,
                ["#pg-rehearsal-cockpit"],
                timeout_ms=ctx.timeout_ms,
                description="Rehearsal cockpit for saved deck",
            )

            guard.assert_no_browser_errors("G3_FLOW_04")


def get_specs() -> list[TestSpec]:
    from .tier3_prompt_pack import get_specs as get_pack_specs

    return [
        TestSpec(
            "G3_FLOW_01",
            3,
            "Client-side URL query sync across /generate, /gallery, /tools & /collections",
            g3_flow_01_client_url_query_sync,
            ("ui", "flow", "navigation"),
            True,
        ),
        TestSpec(
            "G3_FLOW_02",
            3,
            "Browser-local BYOK SettingsModal <-> Editor sync & S22 zero-localStorage-key check",
            g3_flow_02_byok_local_store_closed_loop,
            ("ui", "flow", "byok", "security"),
            True,
        ),
        TestSpec(
            "G3_FLOW_03",
            3,
            "Workshop Advanced Settings forward evidenceDensity & .pptx routeMode to /api/generate",
            g3_flow_03_workshop_density_and_pptx_route_forwarding,
            ("ui", "flow", "workshop"),
            True,
        ),
        TestSpec(
            "G3_FLOW_04",
            3,
            "Cross-route creator journey: /generate -> Cloud Save -> /collections -> Rehearsal Cockpit",
            g3_flow_04_cross_route_creator_journey,
            ("ui", "flow", "journey"),
            True,
        ),
    ] + get_pack_specs()
