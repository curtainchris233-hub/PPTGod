#!/opt/pyenv/shims/python3
"""Unified CLI runner for the PPTGod v2 opaque-box E2E test suite (Tiers 1-4).

Supports both direct execution and module execution from any working directory:
    /opt/pyenv/shims/python3 tests/e2e/run_e2e.py --base-url http://localhost:3000 --tier all
    /opt/pyenv/shims/python3 -m tests.e2e.run_e2e --tier 1,3 --list
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import tempfile
import time
import traceback
from pathlib import Path
from typing import Any, Sequence

# Ensure repository root is on sys.path before importing tests.e2e.*
_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/ms-playwright")

from tests.e2e import __version__  # noqa: E402
from tests.e2e.config import DEFAULT_BASE_URL, DEFAULT_TIMEOUT_MS  # noqa: E402
from tests.e2e.helpers import (  # noqa: E402
    ApiClient,
    ApiConnectionError,
    DbHygieneHelper,
    PlaywrightSession,
    RunConfig,
    TestCaseSpec,
    TestContext,
    TestResult,
)
from tests.e2e.tier1_features import get_tier1_tests  # noqa: E402
from tests.e2e.tier2_boundaries import get_tier2_tests  # noqa: E402
from tests.e2e.tier3_security_journeys import get_tier3_tests  # noqa: E402
from tests.e2e.tier4_scenarios_visual import get_tier4_tests  # noqa: E402
from tests.e2e.tier5_v3 import get_tier5_tests  # noqa: E402
from tests.e2e.tier6_v4 import get_tier6_tests  # noqa: E402

VALID_TIERS: tuple[int, ...] = (1, 2, 3, 4, 5, 6)


def collect_all_tests() -> list[TestCaseSpec]:
    """Return all registered Tier 1-6 test cases in deterministic execution order."""
    return [
        *get_tier1_tests(),
        *get_tier2_tests(),
        *get_tier3_tests(),
        *get_tier4_tests(),
        *get_tier5_tests(),
        *get_tier6_tests(),
    ]


def parse_tiers(raw: str) -> tuple[int, ...]:
    """Parse --tier argument ('all' or comma-separated subset of 1,2,3,4,5,6)."""
    cleaned = raw.strip().lower()
    if not cleaned:
        raise ValueError("Empty --tier value; expected 'all' or comma-separated subset of 1,2,3,4,5,6")
    if cleaned == "all":
        return VALID_TIERS

    seen: list[int] = []
    for part in cleaned.split(","):
        tok = part.strip()
        if tok not in {"1", "2", "3", "4", "5", "6"}:
            raise ValueError(
                f"Invalid tier {tok!r} in --tier={raw!r}; allowed values: 1, 2, 3, 4, 5, 6, or all"
            )
        num = int(tok)
        if num not in seen:
            seen.append(num)
    return tuple(sorted(seen))


def select_tests(
    all_tests: Sequence[TestCaseSpec],
    tiers: tuple[int, ...],
    filter_expr: str | None,
) -> list[TestCaseSpec]:
    """Filter registered tests by tier and optional case-insensitive substring."""
    tier_set = set(tiers)
    needle = (filter_expr or "").strip().lower()
    selected: list[TestCaseSpec] = []
    for spec in all_tests:
        if spec.tier not in tier_set:
            continue
        if needle:
            haystack = " ".join([spec.id, spec.name, *spec.tags]).lower()
            if needle not in haystack:
                continue
        selected.append(spec)
    return selected


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="run_e2e.py",
        description=f"PPTGod v2 Opaque-Box E2E Test Suite Runner (v{__version__})",
    )
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help=f"Target PPTGod v2 server base URL (default: {DEFAULT_BASE_URL})",
    )
    parser.add_argument(
        "--tier",
        default="all",
        help="Tier selection: 1, 2, 3, 4, comma-separated (e.g. 1,3), or all (default: all)",
    )
    parser.add_argument(
        "--screenshots-dir",
        default=None,
        help="Optional output directory for Tier 4's 8 desktop PNG screenshots",
    )
    parser.add_argument(
        "--json-report",
        default=None,
        help="Optional output file path for structured UTF-8 JSON report",
    )
    parser.add_argument(
        "--backup-db",
        action="store_true",
        help="Take a WAL-safe sqlite3 .backup before running and verify clean post-run DB counts",
    )
    parser.add_argument(
        "--timeout-ms",
        type=int,
        default=DEFAULT_TIMEOUT_MS,
        help=f"Per-request HTTP and Playwright action timeout in ms (default: {DEFAULT_TIMEOUT_MS})",
    )
    parser.add_argument(
        "--filter",
        default=None,
        help="Case-insensitive substring matching test id, name, or tags",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List matching tests and tier summary without running HTTP/Playwright, then exit 0",
    )
    return parser


def _print_test_listing(selected: Sequence[TestCaseSpec], tiers: tuple[int, ...]) -> None:
    print(f"PPTGod v2 E2E Suite v{__version__} — Selected Tiers: {list(tiers)}")
    by_tier: dict[int, list[TestCaseSpec]] = {t: [] for t in VALID_TIERS}
    for spec in selected:
        by_tier[spec.tier].append(spec)

    for tier_num in tiers:
        items = by_tier[tier_num]
        print(f"\n[Tier {tier_num}] ({len(items)} tests)")
        for spec in items:
            tag_str = ",".join(spec.tags)
            print(f"  - {spec.id:<66} | {spec.name} [{tag_str}]")

    print(f"\nTotal matching tests: {len(selected)}")


def _preflight_server(base_url: str, timeout_ms: int) -> None:
    """Confirm target HTTP server responds before launching suite."""
    probe_timeout = min(timeout_ms, 8000)
    client = ApiClient(base_url, timeout_ms=probe_timeout)
    resp = client.get("/api/prompts")
    if resp.status >= 500:
        raise ApiConnectionError(
            f"Server preflight GET {base_url.rstrip('/')}/api/prompts returned HTTP {resp.status}"
        )


def _execute_single_test(
    spec: TestCaseSpec,
    config: RunConfig,
    pw_session: PlaywrightSession,
    temp_dir: Path,
) -> TestResult:
    for attempt in range(2):
        ctx = TestContext(config=config, playwright=pw_session, temp_dir=temp_dir)
        started = time.monotonic()
        try:
            spec.fn(ctx)
            elapsed_ms = (time.monotonic() - started) * 1000.0
            if attempt > 0:
                ctx.details["renderer_crash_retried"] = True
            return TestResult(
                id=spec.id,
                tier=spec.tier,
                name=spec.name,
                status="PASS",
                duration_ms=elapsed_ms,
                details=ctx.details,
            )
        except AssertionError as exc:
            elapsed_ms = (time.monotonic() - started) * 1000.0
            return TestResult(
                id=spec.id,
                tier=spec.tier,
                name=spec.name,
                status="FAIL",
                duration_ms=elapsed_ms,
                error=str(exc) or exc.__class__.__name__,
                traceback=traceback.format_exc(),
                details=ctx.details,
            )
        except Exception as exc:
            is_renderer_crash = (
                attempt == 0
                and exc.__class__.__name__ == "TargetClosedError"
                and "Page crashed" in str(exc)
            )
            if is_renderer_crash:
                pw_session.force_recycle()
                continue
            elapsed_ms = (time.monotonic() - started) * 1000.0
            return TestResult(
                id=spec.id,
                tier=spec.tier,
                name=spec.name,
                status="ERROR",
                duration_ms=elapsed_ms,
                error=f"{exc.__class__.__name__}: {exc}",
                traceback=traceback.format_exc(),
                details=ctx.details,
            )
    raise AssertionError("unreachable")


def _summarize_results(
    results: Sequence[TestResult],
    tiers: tuple[int, ...],
) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    passed = sum(1 for r in results if r.status == "PASS")
    failed = sum(1 for r in results if r.status == "FAIL")
    errors = sum(1 for r in results if r.status == "ERROR")
    total_ms = sum(r.duration_ms for r in results)

    summary = {
        "total": len(results),
        "executed": len(results),
        "passed": passed,
        "failed": failed,
        "errors": errors,
        "duration_ms": round(total_ms, 2),
    }

    tier_summary: dict[str, dict[str, Any]] = {}
    for tier_num in tiers:
        tier_res = [r for r in results if r.tier == tier_num]
        tier_summary[str(tier_num)] = {
            "executed": len(tier_res),
            "passed": sum(1 for r in tier_res if r.status == "PASS"),
            "failed": sum(1 for r in tier_res if r.status == "FAIL"),
            "errors": sum(1 for r in tier_res if r.status == "ERROR"),
            "duration_ms": round(sum(r.duration_ms for r in tier_res), 2),
        }

    return summary, tier_summary


def _print_summary_report(
    summary: dict[str, Any],
    tier_summary: dict[str, dict[str, Any]],
    results: Sequence[TestResult],
    db_hygiene: dict[str, Any] | None,
) -> None:
    print("\n" + "=" * 88)
    print("PPTGod v2 E2E Summary by Tier")
    print("-" * 88)
    print(f"{'Tier':<10} {'Executed':>10} {'Passed':>10} {'Failed':>10} {'Errors':>10} {'Time (ms)':>14}")
    for tier_key, stats in tier_summary.items():
        print(
            f"Tier {tier_key:<5} {stats['executed']:>10} {stats['passed']:>10} "
            f"{stats['failed']:>10} {stats['errors']:>10} {stats['duration_ms']:>14.1f}"
        )
    print("-" * 88)
    print(
        f"{'TOTAL':<10} {summary['executed']:>10} {summary['passed']:>10} "
        f"{summary['failed']:>10} {summary['errors']:>10} {summary['duration_ms']:>14.1f}"
    )
    print("=" * 88)

    if db_hygiene is not None:
        print(f"DB Hygiene (--backup-db): ok={db_hygiene.get('ok')} details={db_hygiene}")

    failures = [r for r in results if r.status != "PASS"]
    if failures:
        print(f"\nFailure / Error Details ({len(failures)}):")
        for res in failures:
            print(f"\n--- [{res.status}] {res.id} ({res.name}) ---")
            print(f"Error: {res.error}")
            if res.traceback:
                print(res.traceback.rstrip())


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_arg_parser()
    try:
        args = parser.parse_args(argv)
    except SystemExit as exc:
        code = exc.code if isinstance(exc.code, int) else 2
        return code

    if args.timeout_ms <= 0:
        print("Error: --timeout-ms must be a positive integer", file=sys.stderr)
        return 2

    try:
        tiers = parse_tiers(args.tier)
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2

    all_tests = collect_all_tests()
    selected = select_tests(all_tests, tiers, args.filter)

    if args.list:
        _print_test_listing(selected, tiers)
        return 0

    if not selected:
        print(
            f"Error: No tests matched selection (tiers={list(tiers)}, filter={args.filter!r})",
            file=sys.stderr,
        )
        return 1

    # Verify target server is reachable before running suite
    try:
        _preflight_server(args.base_url, args.timeout_ms)
    except ApiConnectionError as exc:
        print(f"Preflight failed: {exc}", file=sys.stderr)
        return 2

    screenshots_dir = Path(args.screenshots_dir).resolve() if args.screenshots_dir else None
    json_report_path = Path(args.json_report).resolve() if args.json_report else None
    db_path = _REPO_ROOT / "data" / "pptgod.db"

    config = RunConfig(
        base_url=args.base_url.rstrip("/"),
        tiers=tiers,
        screenshots_dir=screenshots_dir,
        json_report=json_report_path,
        backup_db=bool(args.backup_db),
        timeout_ms=int(args.timeout_ms),
        filter_expr=args.filter,
        repo_root=_REPO_ROOT,
        db_path=db_path,
    )

    started_at = dt.datetime.now(dt.timezone.utc).isoformat()
    results: list[TestResult] = []
    db_hygiene: dict[str, Any] | None = None

    with tempfile.TemporaryDirectory(prefix="pptgod_e2e_") as tmp_str:
        temp_dir = Path(tmp_str)

        if config.backup_db:
            if db_path.exists():
                backup_dest = temp_dir / "pre_e2e_backup.db"
                DbHygieneHelper.backup_wal(db_path, backup_dest)
                pre_counts = DbHygieneHelper.snapshot_counts(db_path)
                db_hygiene = {
                    "backed_up": True,
                    "backup_bytes": backup_dest.stat().st_size,
                    "pre_counts": pre_counts,
                    "post_counts": None,
                    "ok": True,
                }
            else:
                db_hygiene = {
                    "backed_up": False,
                    "note": f"DB file not found at {db_path}",
                    "ok": True,
                }

        print(
            f"Running {len(selected)} E2E tests against {config.base_url} "
            f"(tiers={list(tiers)}, timeout={config.timeout_ms}ms)..."
        )

        with PlaywrightSession(timeout_ms=config.timeout_ms, headless=True) as pw_session:
            for idx, spec in enumerate(selected, start=1):
                res = _execute_single_test(spec, config, pw_session, temp_dir)
                results.append(res)
                status_tag = f"[{res.status:5}]"
                print(
                    f"  ({idx:>2}/{len(selected):>2}) {status_tag} [T{res.tier}] "
                    f"{res.id} ({res.duration_ms:.0f} ms)"
                )
                if res.error:
                    first_line = res.error.splitlines()[0][:160]
                    print(f"          -> {first_line}")

        if config.backup_db and db_hygiene is not None and db_hygiene.get("backed_up"):
            post_counts = DbHygieneHelper.snapshot_counts(db_path)
            pre_counts = db_hygiene["pre_counts"]
            mismatches: dict[str, dict[str, int]] = {}
            for table in ("users", "prompts", "saved_decks", "prompt_comments"):
                if pre_counts.get(table) != post_counts.get(table):
                    mismatches[table] = {
                        "before": int(pre_counts.get(table, -1)),
                        "after": int(post_counts.get(table, -1)),
                    }
            residual = int(post_counts.get("residual_e2e_rows", 0))
            db_hygiene["post_counts"] = post_counts
            db_hygiene["mismatches"] = mismatches
            db_hygiene["ok"] = (len(mismatches) == 0) and (residual == 0)

    finished_at = dt.datetime.now(dt.timezone.utc).isoformat()
    summary, tier_summary = _summarize_results(results, tiers)
    _print_summary_report(summary, tier_summary, results, db_hygiene)

    if json_report_path is not None:
        json_report_path.parent.mkdir(parents=True, exist_ok=True)
        report_payload = {
            "suite_version": __version__,
            "started_at": started_at,
            "finished_at": finished_at,
            "base_url": config.base_url,
            "tiers_selected": list(tiers),
            "filter": config.filter_expr,
            "summary": summary,
            "tiers": tier_summary,
            "db_hygiene": db_hygiene,
            "tests": [r.to_dict() for r in results],
        }
        json_report_path.write_text(
            json.dumps(report_payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"JSON report written to: {json_report_path}")

    db_ok = True if db_hygiene is None else bool(db_hygiene.get("ok", True))
    if summary["executed"] > 0 and summary["failed"] == 0 and summary["errors"] == 0 and db_ok:
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
