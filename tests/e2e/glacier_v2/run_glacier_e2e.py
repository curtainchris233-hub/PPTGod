#!/opt/pyenv/shims/python3
"""Unified CLI runner for PPTGod · Glacier UI 2.0 4-Tier Standalone E2E Suite.

Usage:
    PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright /opt/pyenv/shims/python3 \
        tests/e2e/glacier_v2/run_glacier_e2e.py \
        --base-url http://127.0.0.1:3010 \
        --tier all \
        [--backup-db] \
        [--screenshots-dir /abs/path] \
        [--json-report /abs/path/report.json] \
        [--timeout-ms 15000] \
        [--filter <substring>] \
        [--list]
"""

from __future__ import annotations

import argparse
import datetime
import importlib
import json
import sys
import tempfile
import urllib.parse
from pathlib import Path
from typing import Any

# Ensure repo root is importable when executed directly as a script
_THIS_FILE = Path(__file__).resolve()
_REPO_ROOT = _THIS_FILE.parents[3]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from tests.e2e.glacier_v2 import __version__ as SUITE_VERSION
from tests.e2e.glacier_v2 import tier1_features, tier2_boundaries
from tests.e2e.glacier_v2.config import (
    DEFAULT_BASE_URL,
    DEFAULT_TIMEOUT_MS,
    FORBIDDEN_PORTS,
)
from tests.e2e.glacier_v2.helpers import (
    ApiClient,
    ApiConnectionError,
    DbHygieneHelper,
    SuiteRunner,
    TestResult,
    TestSpec,
)

_OPTIONAL_TIER_MODULES: dict[int, str] = {
    3: "tier3_interactions",
    4: "tier4_scenarios_rwd_perf",
}


def _load_tier_registry() -> dict[int, list[TestSpec]]:
    """Register Tier 1 & 2 unconditionally, and Tier 3 & 4 whenever their files exist.

    Crucially, optional modules are ONLY checked for file existence via ``Path.exists()``;
    once a file exists, it is imported unconditionally so any genuine ``SyntaxError`` or
    ``ImportError`` inside it fails loudly instead of being masked.
    """
    registry: dict[int, list[TestSpec]] = {
        1: tier1_features.get_specs(),
        2: tier2_boundaries.get_specs(),
    }
    pkg_dir = _THIS_FILE.parent
    for tier_num, mod_name in _OPTIONAL_TIER_MODULES.items():
        if (pkg_dir / f"{mod_name}.py").exists():
            mod = importlib.import_module(f"tests.e2e.glacier_v2.{mod_name}")
            registry[tier_num] = list(mod.get_specs())
    return registry


def _validate_base_url(base_url: str) -> str:
    cleaned = base_url.strip().rstrip("/")
    parsed = urllib.parse.urlparse(cleaned)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ValueError(f"Invalid --base-url {base_url!r}: must be a valid http(s) URL")
    try:
        port = parsed.port
    except ValueError as err:
        raise ValueError(f"Invalid port in --base-url {base_url!r}: {err}") from err
    if port in FORBIDDEN_PORTS:
        raise ValueError(
            f"Refusing to run against protected port {port} ({base_url!r}). "
            f"Port 3000 is reserved for the main production preview daemon; "
            f"use {DEFAULT_BASE_URL} or an ephemeral mock server port."
        )
    return cleaned


def _parse_tiers(tier_arg: str, available: dict[int, list[TestSpec]]) -> list[int]:
    raw = tier_arg.strip().lower()
    if raw == "all":
        return sorted(available.keys())

    selected: list[int] = []
    for part in raw.split(","):
        token = part.strip()
        if not token:
            continue
        if token not in ("1", "2", "3", "4"):
            raise ValueError(
                f"Invalid --tier value {token!r}: expected 1, 2, 3, 4, comma list, or 'all'"
            )
        num = int(token)
        if num not in available:
            mod_name = _OPTIONAL_TIER_MODULES.get(num, f"tier{num}")
            raise ValueError(
                f"Requested tier {num} is not installed yet ({mod_name}.py not present). "
                f"Available tiers: {sorted(available.keys())}"
            )
        if num not in selected:
            selected.append(num)
    if not selected:
        raise ValueError("No valid tiers specified in --tier")
    return selected


def _filter_specs(specs: list[TestSpec], needle: str | None) -> list[TestSpec]:
    if not needle:
        return specs
    q = needle.strip().lower()
    return [
        s
        for s in specs
        if q in s.id.lower()
        or q in s.name.lower()
        or any(q in tag.lower() for tag in s.tags)
    ]


def _preflight_server(base_url: str, timeout_ms: int) -> None:
    client = ApiClient(base_url, timeout_ms=min(timeout_ms, 8000))
    resp = client.get("/api/health")
    if resp.status == 404:
        resp = client.get("/api/prompts")
    if resp.status >= 500:
        raise ApiConnectionError(
            f"Server preflight at {resp.url} returned HTTP {resp.status}: {resp.text()[:200]}"
        )


def _print_list(specs: list[TestSpec], available_tiers: list[int]) -> None:
    print(f"PPTGod Glacier UI 2.0 E2E Suite ({SUITE_VERSION})")
    print(f"Registered tiers: {available_tiers} | Matching tests: {len(specs)}")
    print("-" * 88)
    by_tier: dict[int, list[TestSpec]] = {}
    for s in specs:
        by_tier.setdefault(s.tier, []).append(s)
    for tier_num in sorted(by_tier):
        tier_specs = by_tier[tier_num]
        print(f"Tier {tier_num} ({len(tier_specs)} tests):")
        for s in tier_specs:
            kind = "UI " if s.requires_browser else "API"
            print(f"  {s.id:<14} [{kind}]  {s.name}")
    print("-" * 88)
    print(f"Total: {len(specs)} test(s)")


def _build_json_report(
    *,
    started_at: str,
    finished_at: str,
    base_url: str,
    tiers_selected: list[int],
    filter_arg: str | None,
    results: list[TestResult],
    db_hygiene: dict[str, Any] | None,
) -> dict[str, Any]:
    passed = sum(1 for r in results if r.status == "PASS")
    failed = sum(1 for r in results if r.status == "FAIL")
    errors = sum(1 for r in results if r.status == "ERROR")
    tier_summary: dict[str, dict[str, int]] = {}
    for r in results:
        key = str(r.tier)
        bucket = tier_summary.setdefault(key, {"total": 0, "passed": 0, "failed": 0, "errors": 0})
        bucket["total"] += 1
        if r.status == "PASS":
            bucket["passed"] += 1
        elif r.status == "FAIL":
            bucket["failed"] += 1
        else:
            bucket["errors"] += 1

    return {
        "suite_version": SUITE_VERSION,
        "started_at": started_at,
        "finished_at": finished_at,
        "base_url": base_url,
        "tiers_selected": tiers_selected,
        "filter": filter_arg,
        "summary": {
            "executed": len(results),
            "passed": passed,
            "failed": failed,
            "errors": errors,
            "ok": len(results) > 0 and failed == 0 and errors == 0 and (db_hygiene is None or bool(db_hygiene.get("ok"))),
        },
        "tiers": tier_summary,
        "db_hygiene": db_hygiene,
        "tests": [
            {
                "id": r.id,
                "tier": r.tier,
                "name": r.name,
                "status": r.status,
                "duration_ms": r.duration_ms,
                "error": r.error,
                "details": r.details,
            }
            for r in results
        ],
    }


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="PPTGod · Glacier UI 2.0 4-Tier Standalone E2E Runner",
    )
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help=f"Target server URL (default: {DEFAULT_BASE_URL}; port 3000 is strictly refused)",
    )
    parser.add_argument(
        "--tier",
        default="all",
        help="Tier(s) to execute: 1, 2, 3, 4, comma-separated list (e.g. 1,2), or 'all'",
    )
    parser.add_argument(
        "--backup-db",
        action="store_true",
        help="Take a WAL-safe sqlite3 .backup snapshot before execution and verify zero DB drift after",
    )
    parser.add_argument(
        "--screenshots-dir",
        default=None,
        help="Optional directory for Glacier UI 2.0 Screenshot Manifest PNGs",
    )
    parser.add_argument(
        "--json-report",
        default=None,
        help="Optional output path for structured UTF-8 JSON report",
    )
    parser.add_argument(
        "--timeout-ms",
        type=int,
        default=DEFAULT_TIMEOUT_MS,
        help=f"Per-request & Playwright action timeout in ms (default: {DEFAULT_TIMEOUT_MS})",
    )
    parser.add_argument(
        "--filter",
        default=None,
        help="Case-insensitive substring matching test ID, name, or tag",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List matching tests grouped by tier and exit 0 without executing",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    # 1. Validate arguments & enforce strict port 3000 protection
    try:
        base_url = _validate_base_url(args.base_url)
    except ValueError as err:
        sys.stderr.write(f"[glacier_e2e] ERROR: {err}\n")
        return 2

    if args.timeout_ms <= 0:
        sys.stderr.write(f"[glacier_e2e] ERROR: --timeout-ms must be positive, got {args.timeout_ms}\n")
        return 2

    registry = _load_tier_registry()
    try:
        tiers_selected = _parse_tiers(args.tier, registry)
    except ValueError as err:
        sys.stderr.write(f"[glacier_e2e] ERROR: {err}\n")
        return 2

    specs: list[TestSpec] = []
    for t in tiers_selected:
        specs.extend(registry[t])
    specs = _filter_specs(specs, args.filter)

    if args.list:
        _print_list(specs, sorted(registry.keys()))
        return 0

    if not specs:
        sys.stderr.write(
            f"[glacier_e2e] ERROR: 0 tests matched --tier={args.tier!r} --filter={args.filter!r}\n"
        )
        return 1

    # 2. Server preflight reachability check
    try:
        _preflight_server(base_url, args.timeout_ms)
    except ApiConnectionError as err:
        sys.stderr.write(f"[glacier_e2e] ERROR: Target server unreachable at {base_url}: {err}\n")
        return 2

    screenshots_dir = Path(args.screenshots_dir).resolve() if args.screenshots_dir else None
    if screenshots_dir is not None:
        screenshots_dir.mkdir(parents=True, exist_ok=True)

    db_path = _REPO_ROOT / "data" / "pptgod.db"
    db_hygiene_report: dict[str, Any] | None = None
    pre_snapshot: dict[str, Any] | None = None

    started_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    print(f"=== PPTGod Glacier UI 2.0 E2E ({SUITE_VERSION}) ===")
    print(f"Target: {base_url} | Tiers: {tiers_selected} | Tests: {len(specs)}")

    temp_backup_cm = (
        tempfile.TemporaryDirectory(prefix="pptgod_glacier_e2e_")
        if args.backup_db and DbHygieneHelper.postgres_url() is None
        else None
    )

    pg_mode = DbHygieneHelper.postgres_url() is not None

    def _snapshot() -> dict[str, Any]:
        if pg_mode:
            return DbHygieneHelper.snapshot_counts_postgres(_REPO_ROOT)
        return DbHygieneHelper.snapshot_counts(db_path)

    try:
        if args.backup_db and pg_mode:
            pre_snapshot = _snapshot()
            print(
                "PostgreSQL read-only snapshot (DATABASE_URL) | "
                f"Pre-run counts: prompts={pre_snapshot['prompts']}, "
                f"saved_decks={pre_snapshot['saved_decks']}, "
                f"sessions={pre_snapshot['sessions']}"
            )
        elif args.backup_db and temp_backup_cm is not None:
            backup_file = Path(temp_backup_cm.name) / "pre_e2e_backup.db"
            DbHygieneHelper.backup_wal(db_path, backup_file)
            pre_snapshot = DbHygieneHelper.snapshot_counts(db_path)
            print(
                f"WAL backup created ({backup_file.stat().st_size} bytes) | "
                f"Pre-run counts: prompts={pre_snapshot['prompts']}, "
                f"saved_decks={pre_snapshot['saved_decks']}, "
                f"sessions={pre_snapshot['sessions']}"
            )

        runner = SuiteRunner(
            base_url=base_url,
            timeout_ms=args.timeout_ms,
            screenshots_dir=screenshots_dir,
            repo_root=_REPO_ROOT,
            db_path=db_path,
        )
        results = runner.run(specs)

        if args.backup_db and pre_snapshot is not None:
            post_snapshot = _snapshot()
            # PostgreSQL seeds differ per deployment, so only drift/residual/session checks apply.
            ok, issues = DbHygieneHelper.verify_hygiene(
                pre_snapshot,
                post_snapshot,
                enforce_baseline=not pg_mode,
            )
            db_hygiene_report = {
                "ok": ok,
                "issues": issues,
                "pre": pre_snapshot,
                "post": post_snapshot,
                "sessions_delta": int(post_snapshot["sessions"]) - int(pre_snapshot["sessions"]),
            }
            if ok:
                print(
                    f"[DB HYGIENE PASS] {'no drift' if pg_mode else 'baseline intact'}, residual [E2E%=0, "
                    f"sessions_delta={db_hygiene_report['sessions_delta']}"
                )
            else:
                print("[DB HYGIENE FAIL] " + " | ".join(issues), file=sys.stderr)
    finally:
        if temp_backup_cm is not None:
            temp_backup_cm.cleanup()

    finished_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    passed = sum(1 for r in results if r.status == "PASS")
    failed = sum(1 for r in results if r.status == "FAIL")
    errors = sum(1 for r in results if r.status == "ERROR")
    print("=" * 88)
    print(f"Summary: executed={len(results)} passed={passed} failed={failed} errors={errors}")

    if args.json_report:
        report_path = Path(args.json_report).resolve()
        report_path.parent.mkdir(parents=True, exist_ok=True)
        payload = _build_json_report(
            started_at=started_at,
            finished_at=finished_at,
            base_url=base_url,
            tiers_selected=tiers_selected,
            filter_arg=args.filter,
            results=results,
            db_hygiene=db_hygiene_report,
        )
        report_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"JSON report written to: {report_path}")

    db_ok = True if db_hygiene_report is None else bool(db_hygiene_report["ok"])
    if len(results) > 0 and failed == 0 and errors == 0 and db_ok:
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
