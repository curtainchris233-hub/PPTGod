"""Standalone infrastructure & Glacier 2.0 browser probes for PPTGod E2E tests.

Zero imports from legacy ``tests/e2e/*.py``. Provides:
- ``ApiClient`` / ``ApiResponse`` (cookie jar, JSON + first-class multipart, logout hygiene)
- ``CleanupRegistry`` / ``CleanupError`` (strict LIFO rollback, non-masking ``add_note``)
- ``DbHygieneHelper`` (WAL-safe ``sqlite3 .backup``, 6-table baseline + ``sessions_delta <= 0``)
- ``PptxVerifier`` & ``HtmlDeckVerifier`` (native OOXML & offline HTML verification)
- ``MockOpenAIServer`` (ephemeral ``127.0.0.1:0`` chat + image mock with auth & 500 scrub testing)
- ``BrowserPageGuard`` & ``PlaywrightSession`` (real Chromium + automatic session logout)
- Glacier 2.0 probes: Core Web Vitals (LCP/CLS/INP), WCAG 2.2 AA & Frosted Topbar contrast,
  Glacier tokens/zero-Tailwind/scoped ``backdrop-filter``/brand SVG non-overlap/focus-visible/
  ``prefers-reduced-motion``, plus resilient accessible locator utilities.
- ``TestSpec``, ``TestResult``, ``TestContext``, and ``SuiteRunner``.
"""

from __future__ import annotations

import contextlib
import http.cookiejar
import http.server
import io
import json
import os
import re
import shutil
import socket
import sqlite3
import subprocess
import sys
import threading
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
import uuid
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Callable, Iterator, Sequence

from .config import (
    ACCOUNT_DEMO,
    DB_BASELINE_COUNTS,
    DEFAULT_BASE_URL,
    DEFAULT_TIMEOUT_MS,
    DESKTOP_VIEWPORT,
    PLAYWRIGHT_BROWSERS_DEFAULT,
    PPTX_CONTENT_TYPE,
    SESSION_COOKIE_NAME,
    SQLITE3_FALLBACK_BIN,
    SeedAccount,
    TINY_PNG_B64,
    make_valid_outline_items,
    make_valid_slides,
)

# ---------------------------------------------------------------------------
# HTTP ApiClient & ApiResponse (Cookie Jar + Multipart + Session Hygiene)
# ---------------------------------------------------------------------------


class ApiConnectionError(RuntimeError):
    """Raised when the target HTTP server cannot be reached or times out."""


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Return 3xx responses directly so redirect contracts can be verified."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[override]
        return None


@dataclass(frozen=True)
class ApiResponse:
    """Immutable HTTP response container returned by ``ApiClient``."""

    status: int
    headers: dict[str, str]
    body: bytes
    json_data: Any
    elapsed_ms: float
    url: str
    method: str

    def text(self, encoding: str = "utf-8") -> str:
        return self.body.decode(encoding, errors="replace")

    def header(self, name: str, default: str = "") -> str:
        target = name.lower()
        for k, v in self.headers.items():
            if k.lower() == target:
                return v
        return default

    def assert_status(
        self,
        expected: int | Sequence[int],
        context: str = "",
    ) -> ApiResponse:
        allowed = (expected,) if isinstance(expected, int) else tuple(expected)
        if self.status not in allowed:
            preview = self.text()[:500].replace("\n", " ")
            prefix = f"{context}: " if context else ""
            raise AssertionError(
                f"{prefix}{self.method} {self.url} returned HTTP {self.status}, "
                f"expected {allowed}. Body preview: {preview!r}"
            )
        return self

    def require_json(self, context: str = "") -> Any:
        if self.json_data is None:
            preview = self.text()[:500].replace("\n", " ")
            prefix = f"{context}: " if context else ""
            raise AssertionError(
                f"{prefix}{self.method} {self.url} (HTTP {self.status}) did not return "
                f"valid JSON. Body preview: {preview!r}"
            )
        return self.json_data


class ApiClient:
    """Stateful HTTP client with per-instance CookieJar, multipart upload, and session logout."""

    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        *,
        timeout_ms: int = DEFAULT_TIMEOUT_MS,
        follow_redirects: bool = False,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_ms = max(1000, int(timeout_ms))
        self.follow_redirects = follow_redirects
        self.cookie_jar = http.cookiejar.CookieJar()
        handlers: list[urllib.request.BaseHandler] = [
            urllib.request.HTTPCookieProcessor(self.cookie_jar),
        ]
        if not follow_redirects:
            handlers.append(_NoRedirectHandler())
        self._opener = urllib.request.build_opener(*handlers)

    def __enter__(self) -> ApiClient:
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> bool:
        self.logout_if_authenticated()
        return False

    def _build_url(self, path: str, query: dict[str, Any] | None = None) -> str:
        if path.startswith("http://") or path.startswith("https://"):
            url = path
        else:
            suffix = path if path.startswith("/") else f"/{path}"
            url = f"{self.base_url}{suffix}"
        if query:
            pairs = [
                (str(k), str(v))
                for k, v in query.items()
                if v is not None
            ]
            if pairs:
                sep = "&" if "?" in url else "?"
                url = f"{url}{sep}{urllib.parse.urlencode(pairs)}"
        return url

    def get_cookie(self, name: str) -> str | None:
        for cookie in self.cookie_jar:
            if cookie.name == name:
                return cookie.value
        return None

    def clear_cookies(self) -> None:
        self.cookie_jar.clear()

    def request(
        self,
        method: str,
        path: str,
        *,
        json_body: Any = None,
        raw_body: bytes | None = None,
        query: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        timeout_ms: int | None = None,
    ) -> ApiResponse:
        if json_body is not None and raw_body is not None:
            raise ValueError("Cannot pass both json_body and raw_body")

        url = self._build_url(path, query=query)
        req_headers: dict[str, str] = {"Accept": "application/json, text/html, */*"}
        if headers:
            req_headers.update(headers)

        data: bytes | None = raw_body
        if json_body is not None:
            data = json.dumps(json_body, ensure_ascii=False).encode("utf-8")
            if not any(k.lower() == "content-type" for k in req_headers):
                req_headers["Content-Type"] = "application/json; charset=utf-8"

        req = urllib.request.Request(
            url=url,
            data=data,
            headers=req_headers,
            method=method.upper(),
        )
        timeout_sec = max(1.0, (timeout_ms or self.timeout_ms) / 1000.0)
        start = time.perf_counter()

        try:
            with self._opener.open(req, timeout=timeout_sec) as resp:
                status = int(resp.getcode())
                resp_headers = dict(resp.headers.items())
                body = resp.read()
        except urllib.error.HTTPError as err:
            status = int(err.code)
            resp_headers = dict(err.headers.items()) if err.headers else {}
            body = err.read() if err.fp is not None else b""
        except (urllib.error.URLError, TimeoutError, socket.timeout, OSError) as err:
            raise ApiConnectionError(
                f"{method.upper()} {url} failed: {err}"
            ) from err

        elapsed_ms = (time.perf_counter() - start) * 1000.0
        parsed_json: Any = None
        if body:
            ct = next(
                (v.lower() for k, v in resp_headers.items() if k.lower() == "content-type"),
                "",
            )
            if "json" in ct or body.lstrip()[:1] in (b"{", b"["):
                try:
                    parsed_json = json.loads(body.decode("utf-8"))
                except (UnicodeDecodeError, json.JSONDecodeError):
                    parsed_json = None

        return ApiResponse(
            status=status,
            headers=resp_headers,
            body=body,
            json_data=parsed_json,
            elapsed_ms=elapsed_ms,
            url=url,
            method=method.upper(),
        )

    def get(
        self,
        path: str,
        *,
        query: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        timeout_ms: int | None = None,
    ) -> ApiResponse:
        return self.request("GET", path, query=query, headers=headers, timeout_ms=timeout_ms)

    def post(
        self,
        path: str,
        *,
        json_body: Any = None,
        raw_body: bytes | None = None,
        query: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        timeout_ms: int | None = None,
    ) -> ApiResponse:
        return self.request(
            "POST",
            path,
            json_body=json_body,
            raw_body=raw_body,
            query=query,
            headers=headers,
            timeout_ms=timeout_ms,
        )

    def put(
        self,
        path: str,
        *,
        json_body: Any = None,
        headers: dict[str, str] | None = None,
        timeout_ms: int | None = None,
    ) -> ApiResponse:
        return self.request("PUT", path, json_body=json_body, headers=headers, timeout_ms=timeout_ms)

    def patch(
        self,
        path: str,
        *,
        json_body: Any = None,
        headers: dict[str, str] | None = None,
        timeout_ms: int | None = None,
    ) -> ApiResponse:
        return self.request("PATCH", path, json_body=json_body, headers=headers, timeout_ms=timeout_ms)

    def delete(
        self,
        path: str,
        *,
        query: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        timeout_ms: int | None = None,
    ) -> ApiResponse:
        return self.request("DELETE", path, query=query, headers=headers, timeout_ms=timeout_ms)

    def post_multipart(
        self,
        path: str,
        *,
        field_name: str = "file",
        filename: str,
        content: bytes,
        content_type: str = "application/octet-stream",
        extra_fields: dict[str, str] | None = None,
        headers: dict[str, str] | None = None,
        timeout_ms: int | None = None,
    ) -> ApiResponse:
        """Send a standards-compliant multipart/form-data POST upload."""
        boundary = f"----GlacierE2E-{uuid.uuid4().hex}"
        safe_name = (
            filename.replace("\\", "\\\\")
            .replace('"', '\\"')
            .replace("\r", "")
            .replace("\n", "")
        )
        chunks: list[bytes] = []
        if extra_fields:
            for key, val in extra_fields.items():
                safe_key = str(key).replace('"', '\\"').replace("\r", "").replace("\n", "")
                chunks.append(
                    f"--{boundary}\r\n"
                    f'Content-Disposition: form-data; name="{safe_key}"\r\n\r\n'
                    f"{val}\r\n".encode("utf-8")
                )

        chunks.append(
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{field_name}"; filename="{safe_name}"\r\n'
            f"Content-Type: {content_type}\r\n\r\n".encode("utf-8")
        )
        chunks.append(content)
        chunks.append(f"\r\n--{boundary}--\r\n".encode("utf-8"))
        body = b"".join(chunks)

        req_headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
        if headers:
            req_headers.update(headers)
        return self.request(
            "POST",
            path,
            raw_body=body,
            headers=req_headers,
            timeout_ms=timeout_ms,
        )

    def login(self, email: str, password: str) -> ApiResponse:
        resp = self.post(
            "/api/auth/login",
            json_body={"email": email, "password": password},
        )
        resp.assert_status(200, f"Login failed for {email}")
        if not self.get_cookie(SESSION_COOKIE_NAME):
            raise AssertionError(
                f"Login for {email} returned 200 but did not set cookie '{SESSION_COOKIE_NAME}'"
            )
        return resp

    def logout(self) -> ApiResponse:
        resp = self.post("/api/auth/logout")
        self.clear_cookies()
        return resp

    def logout_if_authenticated(self) -> None:
        """Delete active server session row if this client holds ``pptgod_session``."""
        if not self.get_cookie(SESSION_COOKIE_NAME):
            return
        try:
            resp = self.post("/api/auth/logout", timeout_ms=5000)
            if resp.status not in (200, 204):
                sys.stderr.write(
                    f"[glacier_e2e] Warning: session logout returned HTTP {resp.status}\n"
                )
        except ApiConnectionError as err:
            sys.stderr.write(
                f"[glacier_e2e] Warning: could not reach /api/auth/logout during teardown: {err}\n"
            )
        finally:
            self.clear_cookies()


# ---------------------------------------------------------------------------
# Strict LIFO CleanupRegistry (Zero Swallowed Errors, Non-Masking)
# ---------------------------------------------------------------------------


class CleanupError(RuntimeError):
    """Raised when a test passes its assertions but one or more cleanup steps fail."""

    def __init__(self, failures: Sequence[tuple[str, Exception]]) -> None:
        self.failures = list(failures)
        summary = "; ".join(f"{label}: {err}" for label, err in self.failures)
        super().__init__(f"Cleanup failed ({len(self.failures)} step(s)): {summary}")


class CleanupRegistry:
    """Deterministic LIFO rollback registry that NEVER swallows errors or masks primary failures."""

    def __init__(self) -> None:
        self._stack: list[tuple[str, Callable[[], None]]] = []

    def add(self, label: str, fn: Callable[[], None]) -> None:
        self._stack.append((label, fn))

    def register_delete_prompt(self, client: ApiClient, prompt_id: str) -> None:
        def _delete() -> None:
            resp = client.delete(f"/api/prompts/{urllib.parse.quote(prompt_id, safe='')}")
            if resp.status not in (200, 404):
                raise RuntimeError(
                    f"DELETE /api/prompts/{prompt_id} returned HTTP {resp.status}: {resp.text()[:200]}"
                )

        self.add(f"delete_prompt({prompt_id})", _delete)

    def register_delete_deck(self, client: ApiClient, deck_id: str) -> None:
        def _delete() -> None:
            resp = client.delete(f"/api/decks/{urllib.parse.quote(deck_id, safe='')}")
            if resp.status not in (200, 404):
                raise RuntimeError(
                    f"DELETE /api/decks/{deck_id} returned HTTP {resp.status}: {resp.text()[:200]}"
                )

        self.add(f"delete_deck({deck_id})", _delete)

    def register_delete_comment(
        self,
        client: ApiClient,
        prompt_id: str,
        comment_id: str,
    ) -> None:
        def _delete() -> None:
            resp = client.delete(
                f"/api/prompts/{urllib.parse.quote(prompt_id, safe='')}/comments",
                query={"commentId": comment_id},
            )
            if resp.status not in (200, 404):
                raise RuntimeError(
                    f"DELETE comment {comment_id} on {prompt_id} returned HTTP {resp.status}: "
                    f"{resp.text()[:200]}"
                )

        self.add(f"delete_comment({prompt_id}:{comment_id})", _delete)

    def register_restore_profile(
        self,
        client: ApiClient,
        account: SeedAccount,
    ) -> None:
        def _restore() -> None:
            resp = client.patch(
                "/api/auth/profile",
                json_body={
                    "displayName": account.display_name,
                    "bio": account.bio,
                    "avatarColor": account.avatar_color,
                },
            )
            if resp.status != 200:
                raise RuntimeError(
                    f"PATCH /api/auth/profile restore for {account.username} returned "
                    f"HTTP {resp.status}: {resp.text()[:200]}"
                )

        self.add(f"restore_profile({account.username})", _restore)

    def register_restore_toggle(
        self,
        client: ApiClient,
        prompt_id: str,
        action: str,
        expected_state: bool,
    ) -> None:
        if action not in ("like", "favorite"):
            raise ValueError(f"Unsupported toggle action: {action!r}")
        state_key = "likedByMe" if action == "like" else "favoritedByMe"

        def _restore() -> None:
            get_resp = client.get(f"/api/prompts/{urllib.parse.quote(prompt_id, safe='')}")
            if get_resp.status == 404:
                return
            if get_resp.status != 200:
                raise RuntimeError(
                    f"GET /api/prompts/{prompt_id} before {action} restore returned HTTP {get_resp.status}"
                )
            data = get_resp.require_json("restore_toggle")
            prompt_obj = data.get("prompt", data) if isinstance(data, dict) else None
            if not isinstance(prompt_obj, dict) or state_key not in prompt_obj:
                keys = (
                    sorted(prompt_obj.keys())[:12]
                    if isinstance(prompt_obj, dict)
                    else type(prompt_obj).__name__
                )
                raise RuntimeError(
                    f"GET /api/prompts/{prompt_id} missing required key {state_key!r} (got {keys})"
                )
            current = bool(prompt_obj[state_key])
            if current != expected_state:
                toggle_resp = client.post(
                    f"/api/prompts/{urllib.parse.quote(prompt_id, safe='')}/{action}"
                )
                if toggle_resp.status != 200:
                    raise RuntimeError(
                        f"POST /api/prompts/{prompt_id}/{action} restore returned HTTP {toggle_resp.status}"
                    )

        self.add(f"restore_{action}({prompt_id}->{expected_state})", _restore)

    def run_all(self) -> list[tuple[str, Exception]]:
        failures: list[tuple[str, Exception]] = []
        while self._stack:
            label, fn = self._stack.pop()
            try:
                fn()
            except Exception as err:  # noqa: BLE001 — collected and re-raised/attached, NEVER swallowed
                failures.append((label, err))
        return failures

    def __enter__(self) -> CleanupRegistry:
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> bool:
        failures = self.run_all()
        if failures:
            if exc_val is not None:
                for label, err in failures:
                    exc_val.add_note(f"[cleanup failure] {label}: {err}")
                return False
            raise CleanupError(failures)
        return False


# ---------------------------------------------------------------------------
# DbHygieneHelper (WAL-Safe sqlite3 .backup + Baseline + Session Delta + S22)
# ---------------------------------------------------------------------------


class DbHygieneHelper:
    """Read-only SQLite WAL snapshot, backup, hygiene verification, and secret scan."""

    @staticmethod
    def find_sqlite3_bin() -> str:
        found = shutil.which("sqlite3")
        if found:
            return found
        fallback = Path(SQLITE3_FALLBACK_BIN)
        if fallback.is_file() and os.access(fallback, os.X_OK):
            return str(fallback)
        raise FileNotFoundError(
            f"sqlite3 CLI binary not found in PATH or at {SQLITE3_FALLBACK_BIN}"
        )

    @classmethod
    def backup_wal(cls, db_path: Path, dest_path: Path) -> Path:
        """Create a WAL-consistent snapshot using ``sqlite3 .backup`` (NEVER plain ``cp``)."""
        if not db_path.is_file():
            raise FileNotFoundError(f"SQLite database not found: {db_path}")
        sqlite_bin = cls.find_sqlite3_bin()
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        escaped_dest = str(dest_path).replace("'", "''")
        proc = subprocess.run(
            [sqlite_bin, str(db_path), f".backup '{escaped_dest}'"],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        if proc.returncode != 0:
            raise RuntimeError(
                f"sqlite3 .backup failed (rc={proc.returncode}): {proc.stderr.strip()}"
            )
        if not dest_path.is_file() or dest_path.stat().st_size <= 0:
            raise RuntimeError(f"sqlite3 .backup produced empty/missing file: {dest_path}")
        return dest_path

    @staticmethod
    def connect_readonly(db_path: Path) -> sqlite3.Connection:
        encoded = urllib.parse.quote(str(db_path.resolve()))
        return sqlite3.connect(f"file:{encoded}?mode=ro", uri=True, timeout=5.0)

    @classmethod
    def snapshot_counts(cls, db_path: Path) -> dict[str, Any]:
        """Collect read-only row counts for all 7 tables + residual ``[E2E%`` rows."""
        with contextlib.closing(cls.connect_readonly(db_path)) as conn:
            cur = conn.cursor()
            tables = (
                "users",
                "prompts",
                "prompt_comments",
                "saved_decks",
                "prompt_likes",
                "prompt_favorites",
                "sessions",
            )
            counts: dict[str, Any] = {}
            for tbl in tables:
                cur.execute(f"SELECT COUNT(*) FROM {tbl}")
                counts[tbl] = int(cur.fetchone()[0])

            cur.execute("SELECT COUNT(*) FROM prompts WHERE title LIKE '[E2E%'")
            res_prompts = int(cur.fetchone()[0])
            cur.execute("SELECT COUNT(*) FROM saved_decks WHERE title LIKE '[E2E%'")
            res_decks = int(cur.fetchone()[0])
            cur.execute("SELECT COUNT(*) FROM prompt_comments WHERE content LIKE '[E2E%'")
            res_comments = int(cur.fetchone()[0])

            cur.execute("PRAGMA journal_mode")
            jmode_row = cur.fetchone()
            counts["journal_mode"] = str(jmode_row[0]).lower() if jmode_row else ""
            counts["residual_e2e_prompts"] = res_prompts
            counts["residual_e2e_decks"] = res_decks
            counts["residual_e2e_comments"] = res_comments
            counts["residual_e2e_rows"] = res_prompts + res_decks + res_comments
            return counts

    @staticmethod
    def verify_hygiene(
        pre: dict[str, Any],
        post: dict[str, Any],
        *,
        enforce_baseline: bool = True,
    ) -> tuple[bool, list[str]]:
        """Compare pre/post SQLite snapshots and enforce strict zero-pollution invariants."""
        issues: list[str] = []
        for tbl, expected_base in DB_BASELINE_COUNTS.items():
            if pre.get(tbl) != post.get(tbl):
                issues.append(
                    f"Table '{tbl}' count drifted: before={pre.get(tbl)}, after={post.get(tbl)}"
                )
            if enforce_baseline and post.get(tbl) != expected_base:
                issues.append(
                    f"Table '{tbl}' baseline mismatch: expected={expected_base}, actual={post.get(tbl)}"
                )

        if int(post.get("residual_e2e_rows", 0)) != 0:
            issues.append(
                "Residual [E2E% rows detected: "
                f"prompts={post.get('residual_e2e_prompts')}, "
                f"saved_decks={post.get('residual_e2e_decks')}, "
                f"prompt_comments={post.get('residual_e2e_comments')}"
            )

        sessions_delta = int(post.get("sessions", 0)) - int(pre.get("sessions", 0))
        if sessions_delta > 0:
            issues.append(
                f"Leaked session rows detected: sessions_delta=+{sessions_delta} "
                f"(before={pre.get('sessions')}, after={post.get('sessions')})"
            )

        return (len(issues) == 0, issues)

    @classmethod
    def scan_for_secret(cls, db_path: Path, secret: str) -> list[str]:
        """Scan every table and column in SQLite (read-only) for leaked secret substrings."""
        if not secret:
            raise ValueError("secret must be non-empty")
        hits: list[str] = []
        secret_bytes = secret.encode("utf-8")
        with contextlib.closing(cls.connect_readonly(db_path)) as conn:
            cur = conn.cursor()
            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            tables = [row[0] for row in cur.fetchall()]
            for tbl in tables:
                cur.execute(f"SELECT * FROM {tbl}")
                col_names = [desc[0] for desc in cur.description or ()]
                for row_idx, row in enumerate(cur.fetchall()):
                    for col_idx, val in enumerate(row):
                        matched = False
                        if isinstance(val, str) and secret in val:
                            matched = True
                        elif isinstance(val, (bytes, bytearray)) and secret_bytes in val:
                            matched = True
                        if matched:
                            col = col_names[col_idx] if col_idx < len(col_names) else str(col_idx)
                            hits.append(f"{tbl}[{row_idx}].{col}")
        return hits


# ---------------------------------------------------------------------------
# Native PPTX & Offline HTML Deck Verifiers
# ---------------------------------------------------------------------------

_HEX6_RE = re.compile(r"^[0-9A-Fa-f]{6}$")


@dataclass(frozen=True)
class PptxInspectionResult:
    size_bytes: int
    slide_count: int
    slide_members: tuple[str, ...]
    notes_members: tuple[str, ...]
    master_members: tuple[str, ...]
    chart_members: tuple[str, ...]
    chart_types: tuple[str, ...]
    table_slide_members: tuple[str, ...]
    media_members: tuple[str, ...]
    slide_texts: dict[str, str]
    notes_texts: dict[str, str]
    border_colors: tuple[str, ...]
    all_members: tuple[str, ...]


class PptxVerifier:
    """Structural OOXML verifier for exported ``.pptx`` binaries."""

    @classmethod
    def verify_response(
        cls,
        resp: ApiResponse,
        *,
        require_rfc5987_disposition: bool = False,
        **verify_kwargs: Any,
    ) -> PptxInspectionResult:
        resp.assert_status(200, "PPTX export")
        ct = resp.header("content-type").lower()
        if PPTX_CONTENT_TYPE not in ct:
            raise AssertionError(
                f"Expected Content-Type containing '{PPTX_CONTENT_TYPE}', got {ct!r}"
            )
        if require_rfc5987_disposition:
            cd = resp.header("content-disposition")
            if "filename*=UTF-8''" not in cd and "filename*=utf-8''" not in cd.lower():
                raise AssertionError(
                    f"Expected RFC 5987 Content-Disposition filename*=UTF-8'', got {cd!r}"
                )
        return cls.verify(resp.body, **verify_kwargs)

    @classmethod
    def verify(
        cls,
        raw: bytes,
        *,
        min_size: int = 30720,
        expected_slide_count: int | None = None,
        min_slide_count: int = 1,
        require_slide_master: bool = True,
        require_notes: bool = True,
        require_native_table: bool = False,
        require_chart_types: Sequence[str] = (),
        require_media: bool = False,
        disallow_pure_white_borders: bool = False,
        expected_slide_texts: Sequence[str] = (),
        expected_notes_texts: Sequence[str] = (),
    ) -> PptxInspectionResult:
        if not raw.startswith(b"PK\x03\x04"):
            raise AssertionError(
                f"PPTX binary missing ZIP magic PK\\x03\\x04 (got {raw[:8]!r})"
            )
        if len(raw) < min_size:
            raise AssertionError(
                f"PPTX binary too small: {len(raw)} bytes < minimum {min_size} bytes"
            )

        with zipfile.ZipFile(io.BytesIO(raw), "r") as zf:
            corrupt_member = zf.testzip()
            if corrupt_member is not None:
                raise AssertionError(f"Corrupt ZIP CRC detected in member: {corrupt_member}")

            members = tuple(zf.namelist())
            member_set = set(members)

            for core in (
                "[Content_Types].xml",
                "_rels/.rels",
                "ppt/presentation.xml",
                "ppt/_rels/presentation.xml.rels",
            ):
                if core not in member_set:
                    raise AssertionError(f"PPTX missing required OOXML member: {core}")
                ET.fromstring(zf.read(core))

            slide_re = re.compile(r"^ppt/slides/slide(\d+)\.xml$")
            notes_re = re.compile(r"^ppt/notesSlides/notesSlide(\d+)\.xml$")
            master_re = re.compile(r"^ppt/slideMasters/slideMaster\d+\.xml$")
            chart_re = re.compile(r"^ppt/charts/chart\d+\.xml$")

            slide_indexed: list[tuple[int, str]] = []
            notes_indexed: list[tuple[int, str]] = []
            master_members: list[str] = []
            chart_members: list[str] = []
            media_members: list[str] = []

            for name in members:
                if (m := slide_re.match(name)):
                    slide_indexed.append((int(m.group(1)), name))
                elif (m := notes_re.match(name)):
                    notes_indexed.append((int(m.group(1)), name))
                elif master_re.match(name):
                    master_members.append(name)
                elif chart_re.match(name):
                    chart_members.append(name)
                elif name.startswith("ppt/media/") and not name.endswith("/"):
                    media_members.append(name)

            slide_indexed.sort(key=lambda pair: pair[0])
            notes_indexed.sort(key=lambda pair: pair[0])
            slide_members = tuple(name for _, name in slide_indexed)
            notes_members = tuple(name for _, name in notes_indexed)

            expected_indices = list(range(1, len(slide_indexed) + 1))
            actual_indices = [idx for idx, _ in slide_indexed]
            if actual_indices != expected_indices:
                raise AssertionError(
                    f"Slide XML numbering not contiguous 1..N: {actual_indices}"
                )

            if len(slide_members) < min_slide_count:
                raise AssertionError(
                    f"Expected >= {min_slide_count} slides in PPTX, found {len(slide_members)}"
                )
            if expected_slide_count is not None and len(slide_members) != expected_slide_count:
                raise AssertionError(
                    f"Expected exactly {expected_slide_count} slides in PPTX, found {len(slide_members)}"
                )

            if require_slide_master and not master_members:
                raise AssertionError("PPTX missing ppt/slideMasters/slideMaster*.xml")
            for m_name in master_members:
                ET.fromstring(zf.read(m_name))

            slide_texts: dict[str, str] = {}
            table_slide_members: list[str] = []
            border_colors: list[str] = []

            for s_name in slide_members:
                root = ET.fromstring(zf.read(s_name))
                texts: list[str] = []
                has_table = False
                for elem in root.iter():
                    local = elem.tag.rsplit("}", 1)[-1]
                    if local == "t" and elem.text:
                        texts.append(elem.text)
                    elif local == "tbl":
                        has_table = True
                    elif local == "srgbClr":
                        val = elem.attrib.get("val", "")
                        if not _HEX6_RE.match(val):
                            raise AssertionError(
                                f"Invalid non-6-hex <a:srgbClr val={val!r}> in {s_name}"
                            )
                    elif local == "ln":
                        for child in elem.iter():
                            if child.tag.rsplit("}", 1)[-1] == "srgbClr":
                                val = child.attrib.get("val", "").upper()
                                if val:
                                    border_colors.append(val)
                slide_texts[s_name] = " ".join(texts)
                if has_table:
                    table_slide_members.append(s_name)

            if disallow_pure_white_borders and "FFFFFF" in border_colors:
                raise AssertionError(
                    "Dark-theme PPTX contains uncomposited pure white #FFFFFF <a:ln> border color "
                    "(rgba border failed to alpha-composite against dark surface)"
                )

            notes_texts: dict[str, str] = {}
            for n_name in notes_members:
                root = ET.fromstring(zf.read(n_name))
                nt = [
                    elem.text
                    for elem in root.iter()
                    if elem.tag.rsplit("}", 1)[-1] == "t" and elem.text
                ]
                notes_texts[n_name] = " ".join(nt)

            if require_notes and not notes_members:
                raise AssertionError("PPTX missing ppt/notesSlides/notesSlide*.xml")

            if require_native_table and not table_slide_members:
                raise AssertionError(
                    "PPTX missing native DrawingML <a:tbl> table on comparison slide"
                )

            found_chart_types: list[str] = []
            chart_tag_candidates = {
                "barChart",
                "bar3DChart",
                "doughnutChart",
                "pieChart",
                "lineChart",
                "areaChart",
                "scatterChart",
            }
            for c_name in chart_members:
                c_root = ET.fromstring(zf.read(c_name))
                for elem in c_root.iter():
                    local = elem.tag.rsplit("}", 1)[-1]
                    if local in chart_tag_candidates and local not in found_chart_types:
                        found_chart_types.append(local)

            for req_chart in require_chart_types:
                if req_chart not in found_chart_types:
                    raise AssertionError(
                        f"PPTX missing required native chart type '{req_chart}'. "
                        f"Found chart types: {found_chart_types}, members: {chart_members}"
                    )

            if require_media and not media_members:
                raise AssertionError("PPTX missing embedded media under ppt/media/*")

            combined_slide_text = "\n".join(slide_texts.values())
            for expected_str in expected_slide_texts:
                if expected_str not in combined_slide_text:
                    raise AssertionError(
                        f"Expected slide text {expected_str!r} not found in PPTX slide XMLs. "
                        f"Extracted snippet: {combined_slide_text[:400]!r}"
                    )

            combined_notes_text = "\n".join(notes_texts.values())
            for expected_note in expected_notes_texts:
                if expected_note not in combined_notes_text:
                    raise AssertionError(
                        f"Expected speaker note {expected_note!r} not found in PPTX notes XMLs. "
                        f"Extracted snippet: {combined_notes_text[:400]!r}"
                    )

        return PptxInspectionResult(
            size_bytes=len(raw),
            slide_count=len(slide_members),
            slide_members=slide_members,
            notes_members=notes_members,
            master_members=tuple(sorted(master_members)),
            chart_members=tuple(sorted(chart_members)),
            chart_types=tuple(found_chart_types),
            table_slide_members=tuple(table_slide_members),
            media_members=tuple(sorted(media_members)),
            slide_texts=slide_texts,
            notes_texts=notes_texts,
            border_colors=tuple(border_colors),
            all_members=members,
        )


@dataclass(frozen=True)
class HtmlDeckInspectionResult:
    size_bytes: int
    slide_count: int
    has_print_css: bool
    has_16_9_page_rule: bool
    has_keyboard_nav: bool
    has_notes_toggle: bool
    external_cdn_links: tuple[str, ...]
    svg_nan_attrs: tuple[str, ...]


class _OfflineHtmlParser(HTMLParser):
    """Inspect offline HTML deck structure, external CDN refs, and SVG NaN geometry."""

    _SVG_GEOM_ATTRS = frozenset(
        {
            "x",
            "y",
            "width",
            "height",
            "cx",
            "cy",
            "r",
            "rx",
            "ry",
            "x1",
            "y1",
            "x2",
            "y2",
            "d",
            "points",
            "transform",
            "viewbox",
        }
    )

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.slide_count = 0
        self.external_cdn_links: list[str] = []
        self.svg_nan_attrs: list[str] = []
        self._in_svg = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        t = tag.lower()
        attr_map = {k.lower(): (v or "") for k, v in attrs}
        if t == "svg":
            self._in_svg += 1
        if t == "section":
            cls = attr_map.get("class", "")
            if "slide" in cls.split() or "data-index" in attr_map or "data-slide-index" in attr_map:
                self.slide_count += 1
        if t == "script":
            src = attr_map.get("src", "").strip()
            if src.startswith("http://") or src.startswith("https://") or src.startswith("//"):
                self.external_cdn_links.append(src)
        if t == "link":
            rel = attr_map.get("rel", "").lower()
            href = attr_map.get("href", "").strip()
            if "stylesheet" in rel and (
                href.startswith("http://") or href.startswith("https://") or href.startswith("//")
            ):
                self.external_cdn_links.append(href)
        if self._in_svg > 0:
            for k, v in attr_map.items():
                if k in self._SVG_GEOM_ATTRS and re.search(r"\b(?:NaN|Infinity)\b", v):
                    self.svg_nan_attrs.append(f"<{t} {k}={v!r}>")

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "svg" and self._in_svg > 0:
            self._in_svg -= 1


class HtmlDeckVerifier:
    """Verifier for self-contained offline HTML presentation exports."""

    @classmethod
    def verify(
        cls,
        html_text: str,
        *,
        expected_min_slides: int = 1,
        expected_title_substrings: Sequence[str] = (),
        expected_slide_texts: Sequence[str] = (),
        expected_notes_texts: Sequence[str] = (),
        require_print_page_size: bool = False,
    ) -> HtmlDeckInspectionResult:
        if "<!doctype html>" not in html_text.lower():
            raise AssertionError("Exported HTML missing <!DOCTYPE html>")
        for tag in ("<html", "<head", "<body"):
            if tag not in html_text.lower():
                raise AssertionError(f"Exported HTML missing {tag}> tag")

        parser = _OfflineHtmlParser()
        parser.feed(html_text)
        parser.close()

        if parser.external_cdn_links:
            raise AssertionError(
                f"Offline HTML deck contains forbidden external CDN links: {parser.external_cdn_links}"
            )
        if parser.svg_nan_attrs:
            raise AssertionError(
                f"Offline HTML deck contains NaN/Infinity SVG geometry: {parser.svg_nan_attrs[:10]}"
            )
        if parser.slide_count < expected_min_slides:
            raise AssertionError(
                f"Offline HTML deck slide count {parser.slide_count} < expected {expected_min_slides}"
            )

        has_print_css = "@media print" in html_text
        if not has_print_css:
            raise AssertionError("Offline HTML deck missing @media print CSS rule")

        has_16_9_page = "@page" in html_text and "13.333in" in html_text and "7.5in" in html_text
        if require_print_page_size and not has_16_9_page:
            raise AssertionError(
                "Offline HTML deck missing @page { size: 13.333in 7.5in } 16:9 print rule"
            )

        has_keyboard_nav = (
            "keydown" in html_text
            and ("ArrowRight" in html_text or "ArrowLeft" in html_text)
        )
        if not has_keyboard_nav:
            raise AssertionError("Offline HTML deck missing keyboard navigation script")

        has_notes_toggle = bool(
            re.search(r"toggleNotes|data-notes|notes-drawer|speaker-notes", html_text, re.I)
        )

        title_match = re.search(r"<title>(.*?)</title>", html_text, re.I | re.S)
        title_text = title_match.group(1) if title_match else ""
        for sub in expected_title_substrings:
            if sub not in title_text and sub not in html_text:
                raise AssertionError(
                    f"Expected title substring {sub!r} not found in HTML <title> ({title_text!r})"
                )
        for txt in expected_slide_texts:
            if txt not in html_text:
                raise AssertionError(f"Expected slide text {txt!r} not found in offline HTML")
        for note in expected_notes_texts:
            if note not in html_text:
                raise AssertionError(f"Expected notes text {note!r} not found in offline HTML")

        return HtmlDeckInspectionResult(
            size_bytes=len(html_text.encode("utf-8")),
            slide_count=parser.slide_count,
            has_print_css=has_print_css,
            has_16_9_page_rule=has_16_9_page,
            has_keyboard_nav=has_keyboard_nav,
            has_notes_toggle=has_notes_toggle,
            external_cdn_links=tuple(parser.external_cdn_links),
            svg_nan_attrs=tuple(parser.svg_nan_attrs),
        )


# ---------------------------------------------------------------------------
# Unified Threaded MockOpenAIServer (127.0.0.1:0 — Chat + Image + Error Scrub)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RecordedOpenAIRequest:
    method: str
    path: str
    headers: dict[str, str]
    authorization: str
    raw_body: bytes
    json_body: Any


class _QuietThreadingHTTPServer(http.server.ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


class MockOpenAIServer:
    """Thread-safe ephemeral ``127.0.0.1:0`` OpenAI-compatible mock server.

    Supports ``/v1/chat/completions`` (auto-dispatching slides/outline/polish)
    and ``/v1/images/generations``, records all received requests & Bearer tokens,
    and simulates ``valid_json``, ``fenced_json``, ``malformed_text``, ``http_500``,
    and ``slow_timeout`` modes cleanly.
    """

    def __init__(
        self,
        *,
        mode: str = "valid_json",
        slides: list[dict[str, Any]] | None = None,
        outline: list[dict[str, Any]] | None = None,
        polished_slide: dict[str, Any] | None = None,
        image_b64: str = TINY_PNG_B64,
        expected_api_key: str | None = None,
        require_auth: bool = True,
        echo_auth_on_error: bool = True,
        slow_delay_sec: float = 2.0,
    ) -> None:
        valid_modes = {"valid_json", "fenced_json", "malformed_text", "http_500", "slow_timeout"}
        if mode not in valid_modes:
            raise ValueError(f"Invalid MockOpenAIServer mode {mode!r}, expected one of {valid_modes}")
        self.mode = mode
        self._slides = slides if slides is not None else make_valid_slides(6, custom_title="[MOCK-LLM] 生成主标题")
        self._outline = outline if outline is not None else make_valid_outline_items(6)
        self._polished_slide = polished_slide or {
            "id": "mock_polish_1",
            "slideType": "data",
            "sectionTag": "04 / INSIGHT",
            "title": "核心结论：模拟 LLM 精炼标题 (+88%)",
            "bullets": ["量化验证要点 1 (+88%)", "量化验证要点 2 (12ms)"],
            "speakerNotes": "各位好，这是来自本地 Mock LLM 的高管润色讲稿。",
        }
        self._image_b64 = image_b64
        self._expected_api_key = expected_api_key
        self._require_auth = require_auth
        self._echo_auth_on_error = echo_auth_on_error
        self._slow_delay_sec = slow_delay_sec
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self.requests: list[RecordedOpenAIRequest] = []
        self._server: _QuietThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None
        self.port: int = 0

    @property
    def base_url(self) -> str:
        return f"http://127.0.0.1:{self.port}/v1"

    def _record(self, rec: RecordedOpenAIRequest) -> None:
        with self._lock:
            self.requests.append(rec)

    def start(self) -> MockOpenAIServer:
        parent = self

        class _Handler(http.server.BaseHTTPRequestHandler):
            def log_message(self, fmt: str, *args: Any) -> None:
                return

            def _send_json(self, code: int, payload: Any) -> None:
                raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                self.send_response(code)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)

            def do_POST(self) -> None:  # noqa: N802
                length = int(self.headers.get("Content-Length", "0") or "0")
                raw = self.rfile.read(length) if length > 0 else b""
                try:
                    parsed = json.loads(raw.decode("utf-8")) if raw else None
                except (UnicodeDecodeError, json.JSONDecodeError):
                    parsed = None
                auth = self.headers.get("Authorization", "")
                parent._record(
                    RecordedOpenAIRequest(
                        method="POST",
                        path=self.path,
                        headers=dict(self.headers.items()),
                        authorization=auth,
                        raw_body=raw,
                        json_body=parsed,
                    )
                )

                if parent._require_auth and not auth.startswith("Bearer "):
                    self._send_json(401, {"error": {"message": "Missing Authorization: Bearer token"}})
                    return
                if parent._expected_api_key and auth != f"Bearer {parent._expected_api_key}":
                    self._send_json(401, {"error": {"message": "Invalid API key"}})
                    return

                if parent.mode == "slow_timeout":
                    parent._stop_event.wait(timeout=parent._slow_delay_sec)
                    self._send_json(504, {"error": {"message": "Simulated upstream timeout"}})
                    return

                if parent.mode == "http_500":
                    msg = "Simulated upstream provider 500 failure"
                    if parent._echo_auth_on_error and auth:
                        msg = f"{msg} for credential {auth}"
                    self._send_json(500, {"error": {"message": msg}})
                    return

                clean_path = self.path.split("?", 1)[0]
                if clean_path.endswith("/images/generations"):
                    self._send_json(
                        200,
                        {"created": int(time.time()), "data": [{"b64_json": parent._image_b64}]},
                    )
                    return

                if clean_path.endswith("/chat/completions"):
                    if parent.mode == "malformed_text":
                        echo_suffix = f" {auth}" if (parent._echo_auth_on_error and auth) else ""
                        content = f"NOT_VALID_JSON {{{{ broken response{echo_suffix}"
                    else:
                        sys_prompt = ""
                        if isinstance(parsed, dict):
                            msgs = parsed.get("messages") or []
                            if isinstance(msgs, list) and msgs and isinstance(msgs[0], dict):
                                sys_prompt = str(msgs[0].get("content") or "")
                        if '"outline"' in sys_prompt:
                            inner_obj: Any = {"outline": parent._outline}
                        elif '"slide"' in sys_prompt and '"slides"' not in sys_prompt:
                            inner_obj = {"slide": parent._polished_slide}
                        else:
                            inner_obj = {"slides": parent._slides}
                        raw_json = json.dumps(inner_obj, ensure_ascii=False)
                        content = (
                            f"```json\n{raw_json}\n```"
                            if parent.mode == "fenced_json"
                            else raw_json
                        )
                    self._send_json(
                        200,
                        {
                            "id": f"chatcmpl-mock-{uuid.uuid4().hex[:8]}",
                            "object": "chat.completion",
                            "choices": [
                                {
                                    "index": 0,
                                    "message": {"role": "assistant", "content": content},
                                    "finish_reason": "stop",
                                }
                            ],
                        },
                    )
                    return

                self._send_json(404, {"error": {"message": f"Unknown mock path: {self.path}"}})

        self._server = _QuietThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        self.port = int(self._server.server_address[1])
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()
        return self

    def stop(self) -> None:
        self._stop_event.set()
        if self._server is not None:
            self._server.shutdown()
            self._server.server_close()
            self._server = None
        if self._thread is not None:
            self._thread.join(timeout=2.0)
            self._thread = None

    def __enter__(self) -> MockOpenAIServer:
        return self.start()

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> bool:
        self.stop()
        return False


# ---------------------------------------------------------------------------
# Glacier UI 2.0 Pure-ES2020 Browser Probe Scripts
# ---------------------------------------------------------------------------

_WEB_VITALS_INIT_JS = r"""
(() => {
  const store = {
    lcpMs: 0,
    lcpTag: "",
    lcpSize: 0,
    clsTotal: 0,
    clsSessionMax: 0,
    _sessionValue: 0,
    _sessionEntries: [],
    interactions: {},
    maxEventMs: 0,
    eventCount: 0,
    observers: [],
  };
  window.__glVitals = store;

  try {
    const processLcp = (entries) => {
      for (const entry of entries || []) {
        store.lcpMs = entry.startTime;
        store.lcpTag = entry.element ? entry.element.tagName.toLowerCase() : "";
        store.lcpSize = entry.size || 0;
      }
    };
    const lcpObs = new PerformanceObserver((list) => processLcp(list.getEntries()));
    lcpObs.observe({ type: "largest-contentful-paint", buffered: true });
    store.observers.push({ obs: lcpObs, process: processLcp });
  } catch {}

  try {
    const processCls = (entries) => {
      for (const entry of entries || []) {
        if (entry.hadRecentInput) continue;
        store.clsTotal += entry.value;
        const first = store._sessionEntries[0];
        const prev = store._sessionEntries[store._sessionEntries.length - 1];
        if (
          first &&
          entry.startTime - prev.startTime < 1000 &&
          entry.startTime - first.startTime < 5000
        ) {
          store._sessionValue += entry.value;
          store._sessionEntries.push(entry);
        } else {
          store._sessionValue = entry.value;
          store._sessionEntries = [entry];
        }
        if (store._sessionValue > store.clsSessionMax) {
          store.clsSessionMax = store._sessionValue;
        }
      }
    };
    const clsObs = new PerformanceObserver((list) => processCls(list.getEntries()));
    clsObs.observe({ type: "layout-shift", buffered: true });
    store.observers.push({ obs: clsObs, process: processCls });
  } catch {}

  try {
    const processInp = (entries) => {
      for (const entry of entries || []) {
        const dur = Number(entry.duration || 0);
        store.eventCount += 1;
        if (dur > store.maxEventMs) store.maxEventMs = dur;
        const iid = Number(entry.interactionId || 0);
        if (iid > 0) {
          store.interactions[iid] = Math.max(store.interactions[iid] || 0, dur);
        }
      }
    };
    const inpObs = new PerformanceObserver((list) => processInp(list.getEntries()));
    inpObs.observe({ type: "event", buffered: true, durationThreshold: 16 });
    store.observers.push({ obs: inpObs, process: processInp });
  } catch {}
})();
"""

_WEB_VITALS_COLLECT_JS = r"""
() => new Promise((resolve) => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const store = window.__glVitals || {};
      for (const item of store.observers || []) {
        try {
          if (item && item.obs && typeof item.process === "function") {
            const pending = item.obs.takeRecords();
            if (pending && pending.length) item.process(pending);
          }
        } catch {}
      }
      const durs = Object.values(store.interactions || {}).sort((a, b) => a - b);
      let inpMs = 0;
      if (durs.length > 0) {
        const idx = Math.max(0, Math.min(durs.length - 1, durs.length - 1 - Math.floor(durs.length / 50)));
        inpMs = durs[idx];
      } else {
        inpMs = store.maxEventMs || 0;
      }
      const nav = performance.getEntriesByType("navigation")[0];
      resolve({
        lcpMs: Number((store.lcpMs || 0).toFixed(1)),
        lcpTag: store.lcpTag || "",
        cls: Number((store.clsSessionMax || 0).toFixed(4)),
        clsTotal: Number((store.clsTotal || 0).toFixed(4)),
        inpMs: Number(inpMs.toFixed(1)),
        maxEventMs: Number((store.maxEventMs || 0).toFixed(1)),
        eventCount: Number(store.eventCount || 0),
        interactionCount: durs.length,
        ttfbMs: nav ? Number((nav.responseStart - nav.requestStart).toFixed(1)) : 0,
        dclMs: nav ? Number(nav.domContentLoadedEventEnd.toFixed(1)) : 0,
        loadMs: nav ? Number(nav.loadEventEnd.toFixed(1)) : 0,
      });
    });
  });
})
"""

_WCAG_CONTRAST_AUDIT_JS = r"""
(opts = {}) => {
  const baseBg = opts.baseBg || { r: 240, g: 246, b: 252 };
  const parseRgba = (str) => {
    if (!str || str === "transparent") return null;
    const m = str.match(/rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  };
  const composite = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const srgb = (c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = (c) => 0.2126 * srgb(c.r) + 0.7152 * srgb(c.g) + 0.0722 * srgb(c.b);
  const ratio = (c1, c2) => {
    const l1 = lum(c1), l2 = lum(c2);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const parseGradientStopsWithPositions = (bgImg) => {
    if (!bgImg || !bgImg.includes("gradient(")) return [];
    const re = /(rgba?\(\s*[\d.]+\s*[, ]\s*[\d.]+\s*[, ]\s*[\d.]+(?:\s*[,/]\s*[\d.]+)?\s*\))(?:\s+([\d.]+)%)?/gi;
    const raw = [];
    for (const m of bgImg.matchAll(re)) {
      const col = parseRgba(m[1]);
      if (col) raw.push({ color: col, pos: m[2] !== undefined ? parseFloat(m[2]) : null });
    }
    if (raw.length === 0) return [];
    if (raw[0].pos === null) raw[0].pos = 0;
    if (raw[raw.length - 1].pos === null) raw[raw.length - 1].pos = 100;
    for (let i = 1; i < raw.length - 1; i++) {
      if (raw[i].pos === null) {
        let j = i + 1;
        while (j < raw.length && raw[j].pos === null) j++;
        const startPos = raw[i - 1].pos;
        const endPos = raw[j].pos;
        const span = j - (i - 1);
        for (let k = i; k < j; k++) {
          raw[k].pos = startPos + ((endPos - startPos) * (k - (i - 1))) / span;
        }
      }
    }
    return raw;
  };
  const sampleGradientAt = (stops, pct) => {
    if (stops.length === 1 || pct <= stops[0].pos) return stops[0].color;
    const last = stops[stops.length - 1];
    if (pct >= last.pos) return last.color;
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i], b = stops[i + 1];
      if (pct >= a.pos && pct <= b.pos) {
        const span = Math.max(0.0001, b.pos - a.pos);
        const t = (pct - a.pos) / span;
        return {
          r: a.color.r + (b.color.r - a.color.r) * t,
          g: a.color.g + (b.color.g - a.color.g) * t,
          b: a.color.b + (b.color.b - a.color.b) * t,
          a: a.color.a + (b.color.a - a.color.a) * t,
        };
      }
    }
    return last.color;
  };
  const sampleGradientTextBand = (stops) => {
    if (!stops || stops.length === 0) return null;
    const samples = [
      { pct: 35, w: 0.15 },
      { pct: 50, w: 0.35 },
      { pct: 65, w: 0.35 },
      { pct: 80, w: 0.15 },
    ];
    let r = 0, g = 0, b = 0, a = 0;
    for (const s of samples) {
      const c = sampleGradientAt(stops, s.pct);
      r += c.r * s.w;
      g += c.g * s.w;
      b += c.b * s.w;
      a += c.a * s.w;
    }
    return { r, g, b, a };
  };
  const hasHiddenAncestor = (el) => {
    let cur = el;
    while (cur && cur.nodeType === 1) {
      const c = getComputedStyle(cur);
      if (c.display === "none" || c.visibility === "hidden" || parseFloat(c.opacity) < 0.5) {
        return true;
      }
      cur = cur.parentElement;
    }
    return false;
  };
  const resolveEffectiveBg = (el, backdropOverride = null) => {
    const layers = [];
    let cur = el;
    while (cur && cur.nodeType === 1) {
      const cs = getComputedStyle(cur);
      const gStops = parseGradientStopsWithPositions(cs.backgroundImage);
      const gColor = sampleGradientTextBand(gStops);
      let opaqueStop = false;
      if (gColor && gColor.a > 0) {
        layers.push(gColor);
        if (gColor.a >= 0.99) opaqueStop = true;
      }
      if (!opaqueStop) {
        const c = parseRgba(cs.backgroundColor);
        if (c && c.a > 0) {
          layers.push(c);
          if (c.a >= 0.99) opaqueStop = true;
        }
      }
      if (opaqueStop) break;
      cur = cur.parentElement;
    }
    let acc = backdropOverride || baseBg;
    for (let i = layers.length - 1; i >= 0; i--) {
      acc = composite(layers[i], acc);
    }
    return acc;
  };

  const textViolations = [];
  const controlViolations = [];
  let auditedTextNodes = 0;
  let auditedControls = 0;

  for (const el of document.querySelectorAll("body *")) {
    if (el.closest(".pg-slide-outer, .pg-slide-stage, [aria-hidden='true']")) continue;
    if (hasHiddenAncestor(el)) continue;
    if (el.matches(":disabled, [aria-disabled='true']")) continue;
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;

    const directText = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => (n.textContent || "").trim())
      .join(" ")
      .trim();
    if (directText.length > 0) {
      const fgRaw = parseRgba(cs.color);
      if (fgRaw && fgRaw.a > 0) {
        const bg = resolveEffectiveBg(el);
        const cr = ratio(composite(fgRaw, bg), bg);
        const fontSize = parseFloat(cs.fontSize) || 14;
        const fontWeight = parseInt(cs.fontWeight, 10) || 400;
        const isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
        const required = isLarge ? 3.0 : 4.5;
        auditedTextNodes++;
        if (cr + 0.02 < required) {
          textViolations.push({
            tag: el.tagName.toLowerCase(),
            id: el.id || "",
            cls: typeof el.className === "string" ? el.className.slice(0, 60) : "",
            text: directText.slice(0, 40),
            ratio: +cr.toFixed(2),
            required,
            color: cs.color,
            bgSample: { r: Math.round(bg.r), g: Math.round(bg.g), b: Math.round(bg.b), a: 1 },
          });
        }
      }
    }

    if (el.matches("input:not([type='hidden']):not([type='file']), textarea, select")) {
      const bw = parseFloat(cs.borderTopWidth) || 0;
      const bc = parseRgba(cs.borderTopColor);
      if (bw >= 1 && bc && bc.a > 0) {
        const parentBg = resolveEffectiveBg(el.parentElement || document.body);
        const borderRatio = ratio(composite(bc, parentBg), parentBg);
        auditedControls++;
        if (borderRatio + 0.02 < 3.0) {
          controlViolations.push({
            tag: el.tagName.toLowerCase(),
            id: el.id || "",
            ratio: +borderRatio.toFixed(2),
            required: 3.0,
            borderColor: cs.borderTopColor,
          });
        }
      }
    }
  }
  return {
    auditedTextNodes,
    auditedControls,
    textViolations: textViolations.slice(0, 20),
    controlViolations: controlViolations.slice(0, 20),
  };
}
"""

_FROSTED_TOPBAR_CONTRAST_JS = r"""
(underlyingRgb) => {
  const header = document.querySelector("header");
  if (!header) return { ok: false, error: "No <header> Topbar found", checked: 0, violations: [] };
  const hcs = getComputedStyle(header);
  const bf = hcs.backdropFilter || hcs.webkitBackdropFilter || "none";
  const parseRgba = (str) => {
    if (!str || str === "transparent") return null;
    const m = (str || "").match(/rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  };
  const composite = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const srgb = (c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = (c) => 0.2126 * srgb(c.r) + 0.7152 * srgb(c.g) + 0.0722 * srgb(c.b);
  const ratio = (c1, c2) => (Math.max(lum(c1), lum(c2)) + 0.05) / (Math.min(lum(c1), lum(c2)) + 0.05);
  const parseGradientStopsWithPositions = (bgImg) => {
    if (!bgImg || !bgImg.includes("gradient(")) return [];
    const re = /(rgba?\(\s*[\d.]+\s*[, ]\s*[\d.]+\s*[, ]\s*[\d.]+(?:\s*[,/]\s*[\d.]+)?\s*\))(?:\s+([\d.]+)%)?/gi;
    const raw = [];
    for (const m of bgImg.matchAll(re)) {
      const col = parseRgba(m[1]);
      if (col) raw.push({ color: col, pos: m[2] !== undefined ? parseFloat(m[2]) : null });
    }
    if (raw.length === 0) return [];
    if (raw[0].pos === null) raw[0].pos = 0;
    if (raw[raw.length - 1].pos === null) raw[raw.length - 1].pos = 100;
    for (let i = 1; i < raw.length - 1; i++) {
      if (raw[i].pos === null) {
        let j = i + 1;
        while (j < raw.length && raw[j].pos === null) j++;
        const startPos = raw[i - 1].pos, endPos = raw[j].pos, span = j - (i - 1);
        for (let k = i; k < j; k++) raw[k].pos = startPos + ((endPos - startPos) * (k - (i - 1))) / span;
      }
    }
    return raw;
  };
  const sampleGradientAt = (stops, pct) => {
    if (stops.length === 1 || pct <= stops[0].pos) return stops[0].color;
    const last = stops[stops.length - 1];
    if (pct >= last.pos) return last.color;
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i], b = stops[i + 1];
      if (pct >= a.pos && pct <= b.pos) {
        const t = (pct - a.pos) / Math.max(0.0001, b.pos - a.pos);
        return {
          r: a.color.r + (b.color.r - a.color.r) * t,
          g: a.color.g + (b.color.g - a.color.g) * t,
          b: a.color.b + (b.color.b - a.color.b) * t,
          a: a.color.a + (b.color.a - a.color.a) * t,
        };
      }
    }
    return last.color;
  };
  const sampleGradientTextBand = (stops) => {
    if (!stops || stops.length === 0) return null;
    const samples = [{ pct: 35, w: 0.15 }, { pct: 50, w: 0.35 }, { pct: 65, w: 0.35 }, { pct: 80, w: 0.15 }];
    let r = 0, g = 0, b = 0, a = 0;
    for (const s of samples) {
      const c = sampleGradientAt(stops, s.pct);
      r += c.r * s.w; g += c.g * s.w; b += c.b * s.w; a += c.a * s.w;
    }
    return { r, g, b, a };
  };

  // Composite <header> own backgroundColor + backgroundImage over underlyingRgb
  let effectiveHeaderBg = underlyingRgb;
  const headerBgColor = parseRgba(hcs.backgroundColor);
  const headerGrad = sampleGradientTextBand(parseGradientStopsWithPositions(hcs.backgroundImage));
  if (headerBgColor && headerBgColor.a > 0) effectiveHeaderBg = composite(headerBgColor, effectiveHeaderBg);
  if (headerGrad && headerGrad.a > 0) effectiveHeaderBg = composite(headerGrad, effectiveHeaderBg);
  if ((!headerBgColor || headerBgColor.a === 0) && (!headerGrad || headerGrad.a === 0)) {
    effectiveHeaderBg = composite({ r: 255, g: 255, b: 255, a: 0.78 }, underlyingRgb);
  }

  const isHiddenInHeader = (el) => {
    let cur = el;
    while (cur && cur.nodeType === 1) {
      const c = getComputedStyle(cur);
      if (c.display === "none" || c.visibility === "hidden" || parseFloat(c.opacity) < 0.5) return true;
      if (cur === header) break;
      cur = cur.parentElement;
    }
    return false;
  };

  const resolveSurfaceInsideHeader = (el) => {
    const layers = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && cur !== header) {
      const cs = getComputedStyle(cur);
      const gColor = sampleGradientTextBand(parseGradientStopsWithPositions(cs.backgroundImage));
      let opaque = false;
      if (gColor && gColor.a > 0) {
        layers.push(gColor);
        if (gColor.a >= 0.99) opaque = true;
      }
      if (!opaque) {
        const bgc = parseRgba(cs.backgroundColor);
        if (bgc && bgc.a > 0) {
          layers.push(bgc);
          if (bgc.a >= 0.99) opaque = true;
        }
      }
      if (opaque) break;
      cur = cur.parentElement;
    }
    let surface = effectiveHeaderBg;
    for (let i = layers.length - 1; i >= 0; i--) {
      surface = composite(layers[i], surface);
    }
    return surface;
  };

  const violations = [];
  let checked = 0;

  for (const el of header.querySelectorAll("a, button, span, h1, p, input, label, strong")) {
    if (el.closest("[aria-hidden='true']")) continue;
    if (isHiddenInHeader(el)) continue;
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    const text = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => (n.textContent || "").trim())
      .join(" ")
      .trim();
    if (!text) continue;
    const fg = parseRgba(cs.color);
    if (!fg || fg.a <= 0) continue;
    const surface = resolveSurfaceInsideHeader(el);
    const cr = ratio(composite(fg, surface), surface);
    const fontSize = parseFloat(cs.fontSize) || 14;
    const fontWeight = parseInt(cs.fontWeight, 10) || 400;
    const req = (fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700)) ? 3.0 : 4.5;
    checked++;
    if (cr + 0.02 < req) {
      violations.push({
        text: text.slice(0, 30),
        ratio: +cr.toFixed(2),
        required: req,
        color: cs.color,
        surface: { r: Math.round(surface.r), g: Math.round(surface.g), b: Math.round(surface.b), a: 1 },
      });
    }
  }
  return {
    ok: checked > 0 && violations.length === 0 && /blur\(/.test(bf),
    backdropFilter: bf,
    headerBg: hcs.backgroundColor,
    effectiveHeaderBg,
    checked,
    violations,
  };
}
"""

_GLACIER_AESTHETICS_JS = r"""
() => {
  const rootCs = getComputedStyle(document.documentElement);
  const bodyCs = getComputedStyle(document.body);
  const resolveTokenRgb = (varName) => {
    const raw = rootCs.getPropertyValue(varName).trim();
    if (!raw) return { raw: "", computed: "", rgb: null };
    const probe = document.createElement("span");
    probe.style.color = `var(${varName})`;
    probe.style.display = "none";
    document.body.appendChild(probe);
    const computed = getComputedStyle(probe).color;
    probe.remove();
    const m = computed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    return { raw, computed, rgb: m ? [+m[1], +m[2], +m[3]] : null };
  };
  const closeRgb = (rgb, target, tol = 4) =>
    Array.isArray(rgb) &&
    Math.abs(rgb[0] - target[0]) <= tol &&
    Math.abs(rgb[1] - target[1]) <= tol &&
    Math.abs(rgb[2] - target[2]) <= tol;

  const glBg = resolveTokenRgb("--gl-bg");
  const glPrimary = resolveTokenRgb("--gl-primary");
  const glText = resolveTokenRgb("--gl-text");
  const easeApple = rootCs.getPropertyValue("--ease-apple").trim();

  const bodyBgMatch = bodyCs.backgroundColor.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  const bodyRgb = bodyBgMatch ? [+bodyBgMatch[1], +bodyBgMatch[2], +bodyBgMatch[3]] : null;
  const bodyBgImg = bodyCs.backgroundImage || "";
  const isGlacierWash =
    closeRgb(bodyRgb, [240, 246, 252], 6) ||
    closeRgb(bodyRgb, [248, 251, 255], 6) ||
    closeRgb(bodyRgb, [234, 243, 252], 6) ||
    /248,\s*251,\s*255|234,\s*243,\s*252|240,\s*246,\s*252/.test(bodyBgImg);
  const isLegacyWarmPaper = closeRgb(bodyRgb, [245, 242, 235], 3);

  const fontVarsPresent = [
    "--font-sans",
    "--font-serif",
    "--font-mono",
    "--font-cjk-sans",
    "--font-cjk-serif",
  ].filter((v) => rootCs.getPropertyValue(v).trim().length > 0);

  const twVars = Array.from(rootCs).filter((p) => p.startsWith("--tw-"));
  const gradientTextViolations = [];
  const neonGlowViolations = [];

  for (const el of document.querySelectorAll("body, body *")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (cs.backgroundClip === "text" || cs.webkitBackgroundClip === "text") {
      gradientTextViolations.push({ tag: el.tagName.toLowerCase(), text: (el.innerText || "").slice(0, 30) });
    }
    if (el.closest(".pg-slide-outer, .pg-slide-stage")) continue;
    const bs = cs.boxShadow;
    if (bs && bs !== "none") {
      const m = bs.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
      const px = bs.replace(m ? m[0] : "", "").match(/-?[\d.]+px/g)?.map(parseFloat) || [];
      const blur = px[2] || 0;
      const alpha = m && m[4] !== undefined ? +m[4] : 1;
      if (m && alpha >= 0.32 && blur >= 16) {
        const [rr, gg, bb] = [+m[1] / 255, +m[2] / 255, +m[3] / 255];
        const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
        const l = (max + min) / 2;
        const s = max === min ? 0 : (l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min));
        if (s >= 0.45 && l >= 0.25 && l <= 0.80) {
          neonGlowViolations.push({ tag: el.tagName.toLowerCase(), boxShadow: bs.slice(0, 100) });
        }
      }
    }
  }

  return {
    bodyBg: bodyCs.backgroundColor,
    bodyBgImage: bodyBgImg.slice(0, 120),
    bodyBgOk: isGlacierWash && !isLegacyWarmPaper,
    isLegacyWarmPaper,
    glBgOk: closeRgb(glBg.rgb, [240, 246, 252], 3),
    glPrimaryOk: closeRgb(glPrimary.rgb, [37, 99, 235], 3),
    glTextOk: closeRgb(glText.rgb, [20, 36, 60], 3),
    glBg,
    glPrimary,
    glText,
    easeApple,
    easeAppleOk: easeApple.includes("cubic-bezier(") && easeApple.includes(".22") && easeApple.includes(".36"),
    fontVarsPresent,
    tailwindRuntimeVars: twVars,
    gradientTextViolations,
    neonGlowViolations,
  };
}
"""

_BACKDROP_FILTER_AUDIT_JS = r"""
() => {
  const cardSelectors = ".gl-style-card, .pg-card, article[data-prompt-slug], .gl-project-card, [data-project-card]";
  const cardBlurViolations = [];
  let cardCount = 0;
  let contentVisAutoCount = 0;

  for (const card of document.querySelectorAll(cardSelectors)) {
    const cs = getComputedStyle(card);
    if (cs.display === "none") continue;
    cardCount++;
    if (cs.contentVisibility === "auto") contentVisAutoCount++;
    for (const node of [card, ...card.querySelectorAll("*")]) {
      if (node.closest("[role='dialog'], .gl-drawer, .gl-popover")) continue;
      const ncs = getComputedStyle(node);
      const bf = ncs.backdropFilter || ncs.webkitBackdropFilter || "none";
      if (bf !== "none" && /blur\(/i.test(bf)) {
        cardBlurViolations.push({
          tag: node.tagName.toLowerCase(),
          cls: typeof node.className === "string" ? node.className.slice(0, 60) : "",
          backdropFilter: bf,
        });
        break;
      }
    }
  }

  const blurredElements = [];
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const bf = cs.backdropFilter || cs.webkitBackdropFilter || "none";
    if (bf !== "none" && /blur\(/i.test(bf)) {
      blurredElements.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || "",
        cls: typeof el.className === "string" ? el.className.slice(0, 50) : "",
        bf,
      });
    }
  }

  const header = document.querySelector("header");
  const headerBf = header
    ? getComputedStyle(header).backdropFilter || getComputedStyle(header).webkitBackdropFilter || "none"
    : "none";

  return {
    cardCount,
    contentVisAutoCount,
    cardBlurViolations: cardBlurViolations.slice(0, 10),
    totalBlurredCount: blurredElements.length,
    blurredElements: blurredElements.slice(0, 12),
    topbarHasBlur: /blur\(/i.test(headerBf),
    topbarBackdropFilter: headerBf,
  };
}
"""

_BRAND_SVG_NON_OVERLAP_JS = r"""
() => {
  const brandAssets = [];
  const brokenAssets = [];
  const overlapViolations = [];
  const wallpaperViolations = [];

  const candidates = Array.from(
    document.querySelectorAll('img[src*="/brand/"], [data-glacier-decor], .gl-hero-peaks')
  );
  const seen = new Set();
  for (const el of candidates) {
    if (seen.has(el)) continue;
    seen.add(el);
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const rect = el.getBoundingClientRect();
    const isImg = el.tagName.toLowerCase() === "img";
    const src = isImg ? (el.getAttribute("src") || "") : (el.getAttribute("data-glacier-decor") || el.className || "inline-decor");
    const isPeakDecor =
      /peak|glacier|mountain|hero/i.test(String(src)) ||
      el.hasAttribute("data-glacier-decor") ||
      el.classList.contains("gl-hero-peaks");
    brandAssets.push({
      src: String(src),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      isPeakDecor,
    });

    if (isImg && (!el.complete || el.naturalWidth === 0)) {
      brokenAssets.push({ src, complete: el.complete, naturalWidth: el.naturalWidth });
      continue;
    }

    if (isPeakDecor) {
      if (cs.pointerEvents !== "none") {
        overlapViolations.push({ src: String(src), reason: `pointer-events must be none, got ${cs.pointerEvents}` });
      }
      if (cs.position === "fixed" || rect.height > Math.max(420, window.innerHeight * 0.65)) {
        wallpaperViolations.push({
          src: String(src),
          position: cs.position,
          height: Math.round(rect.height),
          vh: window.innerHeight,
        });
      }
      for (const txtEl of document.querySelectorAll("main h1, main h2, main p")) {
        const tcs = getComputedStyle(txtEl);
        if (tcs.display === "none" || tcs.visibility === "hidden") continue;
        const tr = txtEl.getBoundingClientRect();
        if (tr.width < 4 || tr.height < 4) continue;
        const range = document.createRange();
        range.selectNodeContents(txtEl);
        const textBox = range.getBoundingClientRect();
        if (textBox.width < 4 || textBox.height < 4) continue;
        const intersects = !(
          textBox.right <= rect.left + 4 ||
          textBox.left >= rect.right - 4 ||
          textBox.bottom <= rect.top + 4 ||
          textBox.top >= rect.bottom - 4
        );
        if (intersects) {
          const cx = Math.min(window.innerWidth - 1, Math.max(0, textBox.left + textBox.width / 2));
          const cy = Math.min(window.innerHeight - 1, Math.max(0, textBox.top + textBox.height / 2));
          const topEl = document.elementFromPoint(cx, cy);
          const blockedByDecor = topEl === el || (topEl !== null && el.contains(topEl));
          if (blockedByDecor || (txtEl.tagName === "H1" && parseFloat(cs.opacity) > 0.45)) {
            overlapViolations.push({
              src: String(src),
              tag: txtEl.tagName.toLowerCase(),
              text: (txtEl.innerText || "").slice(0, 40),
              blockedByDecor,
              textRight: Math.round(textBox.right),
              decorLeft: Math.round(rect.left),
              decorOpacity: cs.opacity,
            });
          }
        }
      }
    }
  }
  return { brandAssets, brokenAssets, wallpaperViolations, overlapViolations };
}
"""

_FOCUS_RESTING_SNAPSHOT_JS = r"""
() => {
  const map = new WeakMap();
  const focusables = document.querySelectorAll(
    'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"], [role="tab"]'
  );
  for (const el of focusables) {
    if (el === document.activeElement) continue;
    const cs = getComputedStyle(el);
    map.set(el, {
      outline: cs.outline,
      boxShadow: cs.boxShadow,
      borderColor: cs.borderColor,
    });
  }
  window.__glRestingFocusStyles = map;
  return focusables.length;
}
"""

_FOCUS_VISIBLE_CHECK_JS = r"""
() => {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) {
    return { active: false };
  }
  const cs = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  let matchesFocusVisible = false;
  try { matchesFocusVisible = el.matches(":focus-visible"); } catch {}

  const parseAlpha = (colorStr) => {
    if (!colorStr || colorStr === "transparent") return 0;
    const m = colorStr.match(/rgba?\(\s*[\d.]+\s*[, ]\s*[\d.]+\s*[, ]\s*[\d.]+(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
    return m ? (m[1] === undefined ? 1 : parseFloat(m[1])) : 0;
  };
  const splitShadowLayers = (bs) => {
    if (!bs || bs === "none") return [];
    const layers = [];
    let depth = 0, start = 0;
    for (let i = 0; i < bs.length; i++) {
      if (bs[i] === "(") depth++;
      else if (bs[i] === ")") depth = Math.max(0, depth - 1);
      else if (bs[i] === "," && depth === 0) {
        layers.push(bs.slice(start, i).trim());
        start = i + 1;
      }
    }
    layers.push(bs.slice(start).trim());
    return layers.filter(Boolean);
  };
  const hasSpreadFocusRing = (bs) => {
    for (const layer of splitShadowLayers(bs)) {
      const colorMatch = layer.match(/rgba?\([^)]+\)/i);
      const alpha = colorMatch ? parseAlpha(colorMatch[0]) : 1;
      if (alpha < 0.18) continue;
      const stripped = layer.replace(/rgba?\([^)]+\)/gi, "").replace(/\binset\b/gi, "").trim();
      const nums = (stripped.match(/-?[\d.]+px/g) || []).map((v) => parseFloat(v));
      if (nums.length >= 4) {
        const [ox, oy, _blur, spread] = nums;
        if (Math.abs(ox) <= 1.0 && Math.abs(oy) <= 1.0 && spread >= 1.5) {
          return true;
        }
      }
    }
    return false;
  };

  const outlineWidth = parseFloat(cs.outlineWidth) || 0;
  const outlineAlpha = parseAlpha(cs.outlineColor);
  const hasOutline = cs.outlineStyle !== "none" && outlineWidth >= 1.5 && outlineAlpha >= 0.25;
  const hasShadowRing = hasSpreadFocusRing(cs.boxShadow);

  const restingMap = window.__glRestingFocusStyles;
  const resting = restingMap && typeof restingMap.get === "function" ? restingMap.get(el) : null;
  const changedFromResting = resting
    ? (cs.outline !== resting.outline || cs.boxShadow !== resting.boxShadow || cs.borderColor !== resting.borderColor)
    : true;

  return {
    active: true,
    tag: el.tagName.toLowerCase(),
    id: el.id || "",
    text: (el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 40),
    matchesFocusVisible,
    hasOutline,
    hasShadowRing,
    changedFromResting,
    hasVisibleIndicator: (hasOutline || hasShadowRing) && changedFromResting,
    outlineStyle: cs.outlineStyle,
    outlineWidth,
    outlineColor: cs.outlineColor,
    boxShadow: cs.boxShadow,
    inViewport: rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight,
  };
}
"""

_REDUCED_MOTION_AUDIT_JS = r"""
() => {
  const parseCssDurationMs = (raw) => {
    if (!raw) return 0;
    return Math.max(
      ...raw.split(",").map((part) => {
        const s = part.trim().toLowerCase();
        if (!s || s === "none") return 0;
        if (s.endsWith("ms")) return parseFloat(s) || 0;
        if (s.endsWith("s")) return (parseFloat(s) || 0) * 1000;
        return 99999;
      })
    );
  };

  const mediaMatches = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const motionViolations = [];
  const sampleTargets = document.querySelectorAll(
    ".gl-page, .pg-page, .pg-canvas-motion-slot, .gl-panel, button, a, article[data-prompt-slug]"
  );
  for (const el of Array.from(sampleTargets).slice(0, 40)) {
    const cs = getComputedStyle(el);
    if (cs.display === "none") continue;
    const animMs = cs.animationName !== "none" ? parseCssDurationMs(cs.animationDuration) : 0;
    const transMs = cs.transitionProperty !== "none" ? parseCssDurationMs(cs.transitionDuration) : 0;
    if (animMs > 10 || transMs > 10) {
      motionViolations.push({
        tag: el.tagName.toLowerCase(),
        cls: typeof el.className === "string" ? el.className.slice(0, 50) : "",
        animMs: +animMs.toFixed(2),
        transMs: +transMs.toFixed(2),
      });
    }
  }

  const allowedProps = new Set(["transform", "opacity"]);
  const keyframeViolations = [];
  const auditedKeyframes = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const rule of Array.from(rules || [])) {
      if (rule.type === CSSRule.KEYFRAMES_RULE && /^(pg|gl)/i.test(rule.name || "")) {
        auditedKeyframes.push(rule.name);
        for (const kf of Array.from(rule.cssRules || [])) {
          for (let i = 0; i < kf.style.length; i++) {
            const prop = kf.style[i];
            if (!allowedProps.has(prop)) {
              keyframeViolations.push(`${rule.name}:${prop}`);
            }
          }
        }
      }
    }
  }

  return {
    mediaMatches,
    motionViolations: motionViolations.slice(0, 10),
    auditedKeyframeCount: auditedKeyframes.length,
    keyframeViolations,
  };
}
"""

_SLIDE_16_9_AUDIT_JS = r"""
() => {
  const frames = [];
  const violations = [];
  for (const el of document.querySelectorAll(".pg-slide-outer, .gl-slide-frame")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 20) continue;
    const ratio = r.width / r.height;
    const entry = {
      cls: typeof el.className === "string" ? el.className.slice(0, 50) : "",
      width: Math.round(r.width),
      height: Math.round(r.height),
      ratio: +ratio.toFixed(3),
    };
    frames.push(entry);
    if (ratio < 1.70 || ratio > 1.86) {
      violations.push(entry);
    }
  }
  return { count: frames.length, violations: violations.slice(0, 15) };
}
"""

# ---------------------------------------------------------------------------
# Standalone Probe & Resilient Locator Functions (Ready for Tiers 1–4)
# ---------------------------------------------------------------------------

LocatorCandidate = Callable[[Any], Any] | str


def _resolve_candidate(scope: Any, cand: LocatorCandidate) -> Any:
    if callable(cand):
        return cand(scope)
    return scope.locator(cand)


def locate_first(
    scope: Any,
    candidates: Sequence[LocatorCandidate],
    *,
    timeout_ms: int = 5000,
    description: str = "element",
    require_visible: bool = True,
) -> Any:
    """Poll prioritized resilient locator candidates and return the first match.

    When ``require_visible=True`` (default), requires ``nth.is_visible()``.
    When ``require_visible=False``, returns the first DOM-attached element (for hidden
    ``<input type="file">`` elements). Never silently returns ``None`` — raises
    ``AssertionError`` if none match within ``timeout_ms``.
    """
    deadline = time.monotonic() + max(0.3, timeout_ms / 1000.0)
    last_labels: list[str] = []
    while True:
        last_labels = []
        for idx, cand in enumerate(candidates):
            label = cand if isinstance(cand, str) else f"fn#{idx}"
            last_labels.append(label)
            loc = _resolve_candidate(scope, cand)
            try:
                count = loc.count()
            except Exception:  # noqa: BLE001 — invalid selector or transient detachment during poll
                count = 0
            if count > 0:
                if not require_visible:
                    return loc.first
                for i in range(min(count, 8)):
                    nth = loc.nth(i)
                    try:
                        if nth.is_visible():
                            return nth
                    except Exception:  # noqa: BLE001 — transient DOM detachment during poll
                        continue
        if time.monotonic() >= deadline:
            break
        time.sleep(0.1)

    vis = "visible" if require_visible else "attached"
    raise AssertionError(
        f"Could not locate {vis} {description} within {timeout_ms}ms. "
        f"Tried candidates: {last_labels}"
    )


def locate_attached(
    scope: Any,
    candidates: Sequence[LocatorCandidate],
    *,
    timeout_ms: int = 5000,
    description: str = "attached element",
) -> Any:
    """Locate a DOM-attached element regardless of CSS visibility (e.g., hidden file inputs)."""
    return locate_first(
        scope,
        candidates,
        timeout_ms=timeout_ms,
        description=description,
        require_visible=False,
    )


def assert_any_visible(
    scope: Any,
    candidates: Sequence[LocatorCandidate],
    *,
    description: str = "element",
    timeout_ms: int = 5000,
) -> Any:
    return locate_first(scope, candidates, timeout_ms=timeout_ms, description=description)


def click_resilient(
    scope: Any,
    candidates: Sequence[LocatorCandidate],
    *,
    description: str = "clickable control",
    timeout_ms: int = 5000,
) -> Any:
    loc = locate_first(scope, candidates, timeout_ms=timeout_ms, description=description)
    loc.scroll_into_view_if_needed(timeout=timeout_ms)
    loc.click(timeout=timeout_ms)
    return loc


def fill_resilient(
    scope: Any,
    candidates: Sequence[LocatorCandidate],
    value: str,
    *,
    description: str = "text input",
    timeout_ms: int = 5000,
) -> Any:
    loc = locate_first(scope, candidates, timeout_ms=timeout_ms, description=description)
    loc.scroll_into_view_if_needed(timeout=timeout_ms)
    loc.fill(value, timeout=timeout_ms)
    return loc


def assert_16_9_ratio(
    locator: Any,
    *,
    label: str = "slide canvas",
    tol_min: float = 1.70,
    tol_max: float = 1.86,
) -> dict[str, float]:
    box = locator.bounding_box()
    if not box or box["width"] <= 0 or box["height"] <= 0:
        raise AssertionError(f"{label} has empty or hidden bounding box: {box}")
    ratio = box["width"] / box["height"]
    if not (tol_min <= ratio <= tol_max):
        raise AssertionError(
            f"{label} aspect ratio {ratio:.3f} outside 16:9 tolerance [{tol_min}, {tol_max}] "
            f"(width={box['width']:.1f}, height={box['height']:.1f})"
        )
    return {"width": float(box["width"]), "height": float(box["height"]), "ratio": round(ratio, 3)}


def collect_web_vitals(
    page: Any,
    *,
    trigger_interaction_fn: Callable[[Any], None] | None = None,
) -> dict[str, Any]:
    """Finalize LCP/CLS/INP observers (after optional user click) and return numeric vitals."""
    if trigger_interaction_fn is not None:
        trigger_interaction_fn(page)
        page.wait_for_timeout(120)
    return dict(page.evaluate(_WEB_VITALS_COLLECT_JS))


def audit_wcag_contrast(
    page: Any,
    *,
    base_bg: dict[str, int] | None = None,
) -> dict[str, Any]:
    opts = {"baseBg": base_bg} if base_bg else {}
    return dict(page.evaluate(_WCAG_CONTRAST_AUDIT_JS, opts))


def audit_frosted_topbar_contrast(
    page: Any,
    underlying_rgb: dict[str, int],
) -> dict[str, Any]:
    return dict(page.evaluate(_FROSTED_TOPBAR_CONTRAST_JS, underlying_rgb))


def audit_glacier_tokens_and_css(page: Any) -> dict[str, Any]:
    return dict(page.evaluate(_GLACIER_AESTHETICS_JS))


def audit_scoped_backdrop_filter(page: Any) -> dict[str, Any]:
    return dict(page.evaluate(_BACKDROP_FILTER_AUDIT_JS))


def audit_brand_svg_non_overlap(page: Any) -> dict[str, Any]:
    return dict(page.evaluate(_BRAND_SVG_NON_OVERLAP_JS))


def audit_zero_tailwind(repo_root: Path, page: Any | None = None) -> dict[str, Any]:
    """Verify zero TailwindCSS/PostCSS dependencies, directives, or runtime vars."""
    pkg_path = repo_root / "package.json"
    pkg_violations: list[str] = []
    if pkg_path.is_file():
        pkg = json.loads(pkg_path.read_text(encoding="utf-8"))
        for section in ("dependencies", "devDependencies", "peerDependencies"):
            deps = pkg.get(section) or {}
            for dep in deps:
                if "tailwind" in dep.lower() or dep.lower() in ("postcss", "@tailwindcss/postcss"):
                    pkg_violations.append(f"{section}:{dep}")

    css_violations: list[str] = []
    src_dir = repo_root / "src"
    if src_dir.is_dir():
        for css_file in sorted(src_dir.rglob("*.css")):
            text = css_file.read_text(encoding="utf-8", errors="replace")
            if re.search(r"@tailwind\b|@apply\b|@import\s+['\"]tailwindcss['\"]", text):
                css_violations.append(str(css_file.relative_to(repo_root)))

    dom_violations: list[str] = []
    if page is not None:
        dom_check = page.evaluate(
            """() => {
              const bad = [];
              for (const s of document.querySelectorAll('script[src], link[href]')) {
                const ref = s.getAttribute('src') || s.getAttribute('href') || '';
                if (/tailwind/i.test(ref)) bad.push(ref);
              }
              const twVars = Array.from(getComputedStyle(document.documentElement))
                .filter((p) => p.startsWith('--tw-'));
              return { bad, twVars };
            }"""
        )
        dom_violations.extend(dom_check.get("bad", []))
        dom_violations.extend(dom_check.get("twVars", []))

    return {
        "ok": not pkg_violations and not css_violations and not dom_violations,
        "packageViolations": pkg_violations,
        "cssViolations": css_violations,
        "domViolations": dom_violations,
    }


def audit_focus_visible(page: Any, *, tab_stops: int = 8) -> dict[str, Any]:
    """Press Tab ``tab_stops`` times and inspect `:focus-visible` indicator visibility."""
    page.evaluate(_FOCUS_RESTING_SNAPSHOT_JS)
    stops: list[dict[str, Any]] = []
    missing_indicators: list[dict[str, Any]] = []
    for _ in range(tab_stops):
        page.keyboard.press("Tab")
        page.wait_for_timeout(40)
        info = dict(page.evaluate(_FOCUS_VISIBLE_CHECK_JS))
        stops.append(info)
        if info.get("active") and not info.get("hasVisibleIndicator"):
            missing_indicators.append(info)
    active_stops = [s for s in stops if s.get("active")]
    return {
        "ok": len(active_stops) >= min(4, tab_stops) and len(missing_indicators) == 0,
        "activeCount": len(active_stops),
        "stops": stops,
        "missingIndicators": missing_indicators,
    }


def audit_reduced_motion_and_keyframes(page: Any) -> dict[str, Any]:
    """Emulate ``prefers-reduced-motion: reduce`` and verify durations + compositor keyframes."""
    page.emulate_media(reduced_motion="reduce")
    page.evaluate("() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))")
    try:
        return dict(page.evaluate(_REDUCED_MOTION_AUDIT_JS))
    finally:
        page.emulate_media(reduced_motion="no-preference")


# ---------------------------------------------------------------------------
# Non-Blocking Browser-Side Delayed Fetch + MutationObserver Probe
# ---------------------------------------------------------------------------

_INSTALL_DELAYED_FETCH_PROBE_JS = r"""
({ urlMatch, delayMs, observeMutations }) => {
  if (window.__glFetchProbe && typeof window.__glFetchProbe.restore === "function") {
    window.__glFetchProbe.restore();
  }
  const origFetch = window.fetch.bind(window);
  const getNonSlideBodyLines = () => {
    const root = document.body || document.documentElement;
    if (!root) return [];
    const clone = root.cloneNode(true);
    for (const s of clone.querySelectorAll(".pg-slide-outer, .pg-slide-stage, script, style")) {
      s.remove();
    }
    return (clone.innerText || "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  };

  const preLines = new Set(getNonSlideBodyLines());
  const state = {
    requestCount: 0,
    inFlightCount: 0,
    maxConcurrent: 0,
    loadingUiObserved: false,
    explicitProgressTexts: [],
    addedMainLines: [],
    mutationTexts: [],
    ariaProgressValues: [],
    _seenAdded: new Set(),
    observer: null,
    restore: null,
  };

  const recordAddedLine = (line) => {
    const clean = (line || "").trim();
    if (!clean || preLines.has(clean) || state._seenAdded.has(clean)) return;
    state._seenAdded.add(clean);
    state.addedMainLines.push(clean);
  };

  const sampleInFlightDom = () => {
    if (state.inFlightCount <= 0) return;
    const progressNodes = document.querySelectorAll(
      '[role="progressbar"], [aria-busy="true"], [data-progress], .gl-progress, [role="status"], [aria-valuenow], [aria-valuetext]'
    );
    for (const el of progressNodes) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      state.loadingUiObserved = true;
      const txt = (el.innerText || "").trim();
      const vnow = el.getAttribute("aria-valuenow");
      const vtxt = el.getAttribute("aria-valuetext");
      if (txt) state.explicitProgressTexts.push(txt);
      if (vtxt) state.explicitProgressTexts.push(vtxt);
      if (vnow !== null && vnow !== "") state.ariaProgressValues.push(String(vnow));
    }
    const genBtn = document.querySelector("#pg-gen-run-btn");
    if (genBtn && (genBtn.disabled || genBtn.getAttribute("aria-busy") === "true")) {
      state.loadingUiObserved = true;
    }
    for (const line of getNonSlideBodyLines()) {
      recordAddedLine(line);
      if (/生成中|正在|构建|加载|准备|处理|大纲|进度|稍候|Loading/i.test(line)) {
        state.loadingUiObserved = true;
      }
    }
  };

  if (observeMutations) {
    const obs = new MutationObserver((mutations) => {
      if (state.inFlightCount <= 0) return;
      for (const m of mutations) {
        if (m.type === "characterData" && m.target && m.target.textContent) {
          const p = m.target.parentElement;
          if (!p || !p.closest(".pg-slide-outer, .pg-slide-stage")) {
            const t = m.target.textContent.trim();
            if (t) {
              state.mutationTexts.push(t);
              state.loadingUiObserved = true;
            }
          }
        } else if (m.type === "childList") {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1) {
              if (node.closest && node.closest(".pg-slide-outer, .pg-slide-stage")) continue;
              const t = (node.innerText || node.textContent || "").trim();
              if (t) {
                state.mutationTexts.push(t);
                state.loadingUiObserved = true;
              }
            } else if (node.nodeType === 3) {
              const t = (node.textContent || "").trim();
              if (t) state.mutationTexts.push(t);
            }
          }
        } else if (m.type === "attributes" && m.target && m.target.nodeType === 1) {
          const vnow = m.target.getAttribute("aria-valuenow");
          const vtxt = m.target.getAttribute("aria-valuetext");
          if (vnow !== null && vnow !== "") {
            state.ariaProgressValues.push(String(vnow));
            state.loadingUiObserved = true;
          }
          if (vtxt) {
            state.mutationTexts.push(vtxt);
            state.loadingUiObserved = true;
          }
          if (m.target.getAttribute("aria-busy") === "true" || m.target.disabled) {
            state.loadingUiObserved = true;
          }
        }
      }
      sampleInFlightDom();
    });
    obs.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-busy", "aria-valuenow", "aria-valuetext", "disabled", "class"],
    });
    state.observer = obs;
  }

  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : (input && input.url ? input.url : String(input));
    if (!url.includes(urlMatch)) {
      return origFetch(input, init);
    }
    state.requestCount += 1;
    state.inFlightCount += 1;
    if (state.inFlightCount > state.maxConcurrent) state.maxConcurrent = state.inFlightCount;
    sampleInFlightDom();
    setTimeout(sampleInFlightDom, 25);
    const iv = setInterval(sampleInFlightDom, 75);
    try {
      const [resp] = await Promise.all([
        origFetch(input, init),
        new Promise((resolve) => setTimeout(resolve, delayMs)),
      ]);
      sampleInFlightDom();
      return resp;
    } finally {
      clearInterval(iv);
      state.inFlightCount -= 1;
    }
  };

  state.restore = () => {
    window.fetch = origFetch;
    if (state.observer) {
      try { state.observer.disconnect(); } catch {}
    }
  };
  window.__glFetchProbe = state;
  return true;
}
"""

_READ_DELAYED_FETCH_PROBE_JS = r"""
() => {
  const s = window.__glFetchProbe;
  if (!s) return null;
  return {
    requestCount: s.requestCount,
    inFlightCount: s.inFlightCount,
    maxConcurrent: s.maxConcurrent,
    loadingUiObserved: s.loadingUiObserved,
    explicitProgressTexts: Array.from(new Set(s.explicitProgressTexts)),
    addedMainLines: Array.from(new Set(s.addedMainLines)),
    mutationTexts: Array.from(new Set(s.mutationTexts)),
    ariaProgressValues: Array.from(new Set(s.ariaProgressValues)),
  };
}
"""

_RESTORE_DELAYED_FETCH_PROBE_JS = r"""
() => {
  if (window.__glFetchProbe && typeof window.__glFetchProbe.restore === "function") {
    window.__glFetchProbe.restore();
    delete window.__glFetchProbe;
  }
}
"""


class DelayedFetchProbe:
    """Non-blocking browser-side fetch delay + MutationObserver + passive request counter.

    Replaces blocking ``time.sleep`` inside Playwright sync ``page.route`` handlers so
    Playwright can concurrently sample in-flight DOM loading states and fire double-click
    race checks while ``window.fetch`` remains pending inside Chromium.
    """

    def __init__(
        self,
        page: Any,
        url_substring: str,
        *,
        delay_ms: int = 1000,
        observe_mutations: bool = True,
    ) -> None:
        self.page = page
        self.url_substring = url_substring
        self.delay_ms = delay_ms
        self.observe_mutations = observe_mutations
        self.network_request_count = 0
        self._on_req = self._handle_request

    def _handle_request(self, req: Any) -> None:
        if self.url_substring in str(req.url) and str(req.method).upper() == "POST":
            self.network_request_count += 1

    def __enter__(self) -> DelayedFetchProbe:
        self.page.on("request", self._on_req)
        self.page.evaluate(
            _INSTALL_DELAYED_FETCH_PROBE_JS,
            {
                "urlMatch": self.url_substring,
                "delayMs": self.delay_ms,
                "observeMutations": self.observe_mutations,
            },
        )
        return self

    def snapshot(self) -> dict[str, Any]:
        data = self.page.evaluate(_READ_DELAYED_FETCH_PROBE_JS) or {}
        data["networkRequestCount"] = self.network_request_count
        return dict(data)

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> bool:
        try:
            self.page.remove_listener("request", self._on_req)
        except Exception as err:  # noqa: BLE001 — page may already be closed on error
            sys.stderr.write(f"[glacier_e2e] Warning removing request listener: {err}\n")
        try:
            self.page.evaluate(_RESTORE_DELAYED_FETCH_PROBE_JS)
        except Exception as err:  # noqa: BLE001 — page navigated or closed
            sys.stderr.write(f"[glacier_e2e] Warning restoring window.fetch probe: {err}\n")
        return False


def login_via_api(
    page: Any,
    base_url: str,
    account: SeedAccount = ACCOUNT_DEMO,
) -> None:
    """Authenticate a Playwright BrowserContext using ``POST /api/auth/login``."""
    resp = page.request.post(
        f"{base_url.rstrip('/')}/api/auth/login",
        data={"email": account.email, "password": account.password},
    )
    if resp.status != 200:
        raise AssertionError(
            f"Browser API login for {account.email} failed with HTTP {resp.status}: {resp.text()[:200]}"
        )
    # Verify cookie is attached to context and track token for crash-safe teardown
    cookies = page.context.cookies()
    session_cookie = next(
        (c for c in cookies if c.get("name") == SESSION_COOKIE_NAME and c.get("value")),
        None,
    )
    if not session_cookie:
        raise AssertionError(
            f"Browser API login succeeded but cookie '{SESSION_COOKIE_NAME}' not stored in context"
        )
    tracked = getattr(page.context, "_pptgod_session_tokens", None)
    if isinstance(tracked, list):
        tracked.append((base_url.rstrip("/"), str(session_cookie["value"])))


def login_via_demo_ui(page: Any, base_url: str, *, timeout_ms: int = 8000) -> None:
    """Authenticate through the visible Topbar Login trigger + AuthModal Demo button."""
    if not page.url.startswith(base_url.rstrip("/")):
        page.goto(f"{base_url.rstrip('/')}/", wait_until="domcontentloaded")
    click_resilient(
        page,
        [
            "#pg-nav-login-btn",
            lambda p: p.get_by_role("button", name=re.compile(r"登录|立即登录|Sign\s*in", re.I)),
        ],
        description="Topbar Login button",
        timeout_ms=timeout_ms,
    )
    click_resilient(
        page,
        [
            "#pg-demo-login-btn",
            lambda p: p.get_by_role("button", name=re.compile(r"体验账号|一键体验|Demo|演示账号", re.I)),
        ],
        description="AuthModal Demo Login button",
        timeout_ms=timeout_ms,
    )
    # Wait for authenticated state (logout button or session cookie)
    deadline = time.monotonic() + (timeout_ms / 1000.0)
    while time.monotonic() < deadline:
        cookies = page.context.cookies()
        if any(c.get("name") == SESSION_COOKIE_NAME for c in cookies):
            page.wait_for_timeout(200)
            return
        time.sleep(0.1)
    raise AssertionError("Demo UI login did not establish pptgod_session cookie in time")


def ensure_editor_ready(
    guard: BrowserPageGuard,
    base_url: str,
    *,
    topic: str = "2026 Glacier 冰川架构效能升级汇报",
    style_slug: str = "apple-soft-bento-modular",
    timeout_ms: int = 20000,
) -> Any:
    """Open ``/generate``, run smart generation if in Workshop mode, and verify Editor stage is ready."""
    url = f"{base_url.rstrip('/')}/generate?style={urllib.parse.quote(style_slug)}"
    guard.goto_ok(url)
    page = guard.page

    # Check if already in editor mode (e.g., deck loaded) or in Workshop wizard
    editor_indicators = [
        "#pg-gen-undo-btn",
        "#pg-edit-slide-title",
        "#pg-slide-type-select",
        lambda p: p.get_by_role("button", name=re.compile(r"导出\s*PPTX", re.I)),
    ]
    already_editor = False
    for cand in editor_indicators:
        loc = _resolve_candidate(page, cand)
        if loc.count() > 0 and loc.first.is_visible():
            already_editor = True
            break

    if not already_editor:
        fill_resilient(
            page,
            [
                "#pg-gen-topic",
                lambda p: p.get_by_placeholder(re.compile(r"描述你想创建|演示主题|输入.*主题", re.I)),
                "main textarea",
            ],
            topic,
            description="Workshop topic input",
            timeout_ms=timeout_ms,
        )
        click_resilient(
            page,
            [
                "#pg-gen-run-btn",
                lambda p: p.get_by_role("button", name=re.compile(r"开始生成|生成\s*PPT|直接生成", re.I)),
            ],
            description="Workshop Start Generate button",
            timeout_ms=timeout_ms,
        )
        locate_first(
            page,
            editor_indicators,
            timeout_ms=timeout_ms,
            description="Presentation Editor workspace controls",
        )

    stage = guard.find_primary_stage(timeout_ms=timeout_ms)
    return stage


# ---------------------------------------------------------------------------
# BrowserPageGuard & PlaywrightSession (Real Chromium + Auto Session Logout)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ConsoleErrorRecord:
    text: str
    location: str


@dataclass(frozen=True)
class HttpErrorRecord:
    status: int
    url: str
    resource_type: str


class BrowserPageGuard:
    """Wraps a Playwright Page with zero-tolerance console/pageerror/5xx/404-asset capture."""

    _TRACKED_404_TYPES = frozenset({"image", "stylesheet", "script", "font", "fetch", "xhr"})

    def __init__(self, page: Any, *, timeout_ms: int = DEFAULT_TIMEOUT_MS) -> None:
        self.page = page
        self.timeout_ms = timeout_ms
        self.console_errors: list[ConsoleErrorRecord] = []
        self.page_errors: list[str] = []
        self.unexpected_5xx: list[HttpErrorRecord] = []
        self.unexpected_404_assets: list[HttpErrorRecord] = []
        self.request_failures: list[str] = []
        self._allowed_statuses: set[int] = set()
        self._suppress_console_errors: bool = False

        page.on("console", self._on_console)
        page.on("pageerror", self._on_pageerror)
        page.on("response", self._on_response)
        page.on("requestfailed", self._on_requestfailed)

    def _on_console(self, msg: Any) -> None:
        if msg.type != "error" or self._suppress_console_errors:
            return
        text = str(msg.text)
        # Ignore Chromium's automatic "Failed to load resource: the server responded with a status of N"
        # ONLY when status N is explicitly permitted by allow_expected_http_errors().
        if self._allowed_statuses:
            for code in self._allowed_statuses:
                if f"status of {code}" in text:
                    return
        loc = ""
        if msg.location:
            loc = f"{msg.location.get('url', '')}:{msg.location.get('lineNumber', '')}"
        self.console_errors.append(ConsoleErrorRecord(text=text, location=loc))

    def _on_pageerror(self, err: Any) -> None:
        self.page_errors.append(str(err))

    def _on_response(self, resp: Any) -> None:
        status = int(resp.status)
        if status in self._allowed_statuses:
            return
        url = str(resp.url)
        rtype = str(resp.request.resource_type) if resp.request else ""
        if status >= 500:
            self.unexpected_5xx.append(HttpErrorRecord(status=status, url=url, resource_type=rtype))
        elif status == 404:
            if (
                rtype in self._TRACKED_404_TYPES
                or "/brand/" in url
                or "/_next/static/" in url
            ):
                self.unexpected_404_assets.append(
                    HttpErrorRecord(status=status, url=url, resource_type=rtype)
                )

    def _on_requestfailed(self, req: Any) -> None:
        if self._suppress_console_errors or self._allowed_statuses:
            return
        failure = str(req.failure or "")
        if "ERR_ABORTED" in failure:
            return
        self.request_failures.append(f"{req.method} {req.url} ({failure})")

    @contextlib.contextmanager
    def allow_expected_http_errors(
        self,
        statuses: set[int] | Sequence[int],
        *,
        suppress_console: bool = False,
    ) -> Iterator[None]:
        prev_statuses = set(self._allowed_statuses)
        prev_suppress = self._suppress_console_errors
        self._allowed_statuses.update(int(s) for s in statuses)
        if suppress_console:
            self._suppress_console_errors = True
        try:
            yield
        finally:
            self._allowed_statuses = prev_statuses
            self._suppress_console_errors = prev_suppress

    def goto_ok(
        self,
        url: str,
        *,
        wait_until: str = "load",
        expected_statuses: Sequence[int] = (200,),
        settle_network: bool = True,
    ) -> Any:
        effective_wait = wait_until if settle_network else "domcontentloaded"
        resp = self.page.goto(url, wait_until=effective_wait, timeout=self.timeout_ms)
        if resp is None:
            raise AssertionError(f"Navigation to {url} returned None response")
        if resp.status not in expected_statuses:
            raise AssertionError(
                f"GET {url} returned HTTP {resp.status}, expected {tuple(expected_statuses)}"
            )
        if settle_network:
            try:
                self.page.wait_for_load_state("networkidle", timeout=min(self.timeout_ms, 8000))
            except Exception:  # noqa: BLE001 — SSE/polling pages may stay active; load already succeeded
                self.page.wait_for_timeout(200)
            hydrate_js = """() => {
              const mainEls = document.querySelectorAll('main button, main input, main textarea, main select, main a, main');
              const pool = mainEls.length > 0 ? mainEls : document.querySelectorAll('header, button, a, body');
              for (const el of pool) {
                for (const k of Object.keys(el)) {
                  if (k.startsWith('__reactProps$') || k.startsWith('__reactFiber$')) return true;
                }
              }
              return false;
            }"""
            try:
                self.page.wait_for_function(hydrate_js, timeout=min(self.timeout_ms, 4000))
            except Exception:  # noqa: BLE001
                if resp.status == 200 and self.page.locator("main").count() > 0:
                    try:
                        self.page.reload(wait_until="load", timeout=self.timeout_ms)
                        self.page.wait_for_load_state("networkidle", timeout=min(self.timeout_ms, 6000))
                        self.page.wait_for_function(hydrate_js, timeout=min(self.timeout_ms, 6000))
                    except Exception:  # noqa: BLE001
                        pass
        return resp

    def assert_no_browser_errors(self, label: str = "") -> None:
        problems: list[str] = []
        if self.console_errors:
            problems.append(
                f"console.error({len(self.console_errors)}): "
                + "; ".join(f"{e.text} [{e.location}]" for e in self.console_errors[:5])
            )
        if self.page_errors:
            problems.append(f"pageerror({len(self.page_errors)}): {self.page_errors[:5]}")
        if self.unexpected_5xx:
            problems.append(
                f"HTTP 5xx({len(self.unexpected_5xx)}): "
                + "; ".join(f"{e.status} {e.url}" for e in self.unexpected_5xx[:5])
            )
        if self.unexpected_404_assets:
            problems.append(
                f"HTTP 404 assets({len(self.unexpected_404_assets)}): "
                + "; ".join(f"404 {e.resource_type} {e.url}" for e in self.unexpected_404_assets[:5])
            )
        if self.request_failures:
            problems.append(f"requestfailed({len(self.request_failures)}): {self.request_failures[:5]}")
        if problems:
            prefix = f"[{label}] " if label else ""
            raise AssertionError(f"{prefix}Browser runtime errors detected: " + " | ".join(problems))

    def assert_no_horizontal_overflow(self, label: str = "", *, tolerance_px: int = 2) -> dict[str, int]:
        metrics = self.page.evaluate(
            """() => ({
              scrollWidth: Math.ceil(document.documentElement.scrollWidth),
              innerWidth: Math.ceil(window.innerWidth),
              bodyScrollWidth: Math.ceil(document.body ? document.body.scrollWidth : 0),
            })"""
        )
        sw = int(metrics["scrollWidth"])
        iw = int(metrics["innerWidth"])
        if sw > iw + tolerance_px:
            prefix = f"[{label}] " if label else ""
            raise AssertionError(
                f"{prefix}Unintended horizontal overflow: scrollWidth={sw}px > innerWidth={iw}px (+{tolerance_px}px)"
            )
        return metrics

    def stabilize_for_screenshot(self) -> None:
        self.page.evaluate(
            """() => {
              for (const el of document.querySelectorAll('.pg-toast, .gl-toast, [data-toast], [role="status"].gl-toast')) {
                el.style.display = 'none';
              }
            }"""
        )
        self.page.wait_for_timeout(150)

    def find_primary_stage(self, *, timeout_ms: int | None = None) -> Any:
        t_ms = timeout_ms or self.timeout_ms
        primary_candidates = [
            '[data-slide-stage="primary"] .pg-slide-outer',
            '[data-slide-stage="primary"]',
            ".gl-editor-stage .pg-slide-outer",
            ".pg-stage-canvas-wrap .pg-slide-outer",
            ".pg-slide-outer",
        ]
        # Wait until at least one slide outer is visible
        locate_first(self.page, primary_candidates, timeout_ms=t_ms, description="primary SlideCanvas stage")
        # Pick the largest visible .pg-slide-outer if multiple exist
        for sel in primary_candidates[:-1]:
            loc = self.page.locator(sel)
            if loc.count() > 0 and loc.first.is_visible():
                return loc.first
        all_outers = self.page.locator(".pg-slide-outer")
        best_idx = 0
        best_area = -1.0
        for i in range(min(all_outers.count(), 20)):
            nth = all_outers.nth(i)
            if nth.is_visible():
                box = nth.bounding_box()
                if box:
                    area = box["width"] * box["height"]
                    if area > best_area:
                        best_area = area
                        best_idx = i
        return all_outers.nth(best_idx)

    def count_editor_tree_slides(self) -> int:
        """Count slides strictly inside the Editor left slide tree (never Workshop/style strip)."""
        for sel in (
            "[data-slide-tree] [data-slide-index]",
            ".gl-slide-tree [data-slide-index]",
            ".pg-gen-slide-card",
            "[data-slide-tree] .pg-slide-outer",
            ".gl-slide-tree .pg-slide-outer",
            '[data-slide-tree] [role="option"]',
            '.gl-slide-tree [role="option"]',
            '[data-slide-tree] [role="listitem"]',
            '.gl-slide-tree [role="listitem"]',
        ):
            loc = self.page.locator(sel)
            cnt = loc.count()
            if cnt > 0:
                return cnt
        # Fallback: inspect visible slide tree items inside left editor sidebar
        return int(
            self.page.evaluate(
                """() => {
                  const tree = document.querySelector('[data-slide-tree], .gl-slide-tree, [aria-label*="幻灯片"]');
                  if (!tree) return 0;
                  const items = tree.querySelectorAll(
                    '[data-slide-index], .pg-gen-slide-card, .pg-slide-outer, [role="option"], [role="listitem"], li'
                  );
                  return items.length;
                }"""
            )
        )

    def get_body_text(self) -> str:
        return str(self.page.evaluate("() => (document.body ? document.body.innerText : '')"))

    def assert_text_absent(
        self,
        patterns: Sequence[str],
        *,
        label: str = "",
        scope_selector: str = "body",
    ) -> None:
        res = self.page.evaluate(
            """(sel) => {
              const els = Array.from(document.querySelectorAll(sel));
              return {
                count: els.length,
                text: els.map((el) => el.innerText || '').join('\\n'),
              };
            }""",
            scope_selector,
        )
        matched_count = int(res["count"])
        if scope_selector.strip() != "body" and matched_count == 0:
            prefix = f"[{label}] " if label else ""
            raise AssertionError(
                f"{prefix}assert_text_absent scope_selector {scope_selector!r} matched 0 elements on {self.page.url}"
            )
        text = str(res["text"])
        hits: list[str] = []
        for pat in patterns:
            m = re.search(pat, text, re.I)
            if m:
                hits.append(f"{pat!r} matched {m.group(0)!r}")
        if hits:
            prefix = f"[{label}] " if label else ""
            raise AssertionError(
                f"{prefix}Forbidden text found in <{scope_selector}> ({matched_count} el): {'; '.join(hits)}"
            )

    def audit_16_9_slide_frames(self) -> dict[str, Any]:
        return dict(self.page.evaluate(_SLIDE_16_9_AUDIT_JS))


class PlaywrightSession:
    """Lazy headless Chromium manager with context recycling and automatic session logout."""

    def __init__(
        self,
        *,
        timeout_ms: int = DEFAULT_TIMEOUT_MS,
        recycle_every: int = 6,
    ) -> None:
        self.timeout_ms = timeout_ms
        self.recycle_every = max(1, recycle_every)
        self._pw_cm: Any = None
        self._pw: Any = None
        self._browser: Any = None
        self._contexts_opened = 0

    def _ensure_browser(self) -> Any:
        if self._browser is not None and self._contexts_opened >= self.recycle_every:
            self.restart_browser()

        if self._browser is None:
            os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", PLAYWRIGHT_BROWSERS_DEFAULT)
            from playwright.sync_api import sync_playwright

            if self._pw is None:
                self._pw_cm = sync_playwright()
                self._pw = self._pw_cm.start()

            browser_kind = os.environ.get("GLACIER_E2E_BROWSER", "chromium").strip().lower()
            if browser_kind == "firefox":
                self._browser = self._pw.firefox.launch(headless=True)
            else:
                launch_args = [
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--disable-software-rasterizer",
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-extensions",
                    "--disable-features=RenderDocument,BackForwardCache,SpareRendererForSitePerProcess",
                    "--font-render-hinting=none",
                ]
                self._browser = self._pw.chromium.launch(headless=True, args=launch_args)
            self._contexts_opened = 0
        return self._browser

    def restart_browser(self) -> None:
        if self._browser is not None:
            try:
                self._browser.close()
            except Exception as err:  # noqa: BLE001 — log cleanup error on crashed browser
                sys.stderr.write(f"[glacier_e2e] Warning closing Chromium during recycle: {err}\n")
            self._browser = None
        self._contexts_opened = 0

    def close(self) -> None:
        self.restart_browser()
        if self._pw is not None:
            try:
                self._pw.stop()
            except Exception as err:  # noqa: BLE001
                sys.stderr.write(f"[glacier_e2e] Warning stopping Playwright: {err}\n")
            self._pw = None
        self._pw_cm = None

    @staticmethod
    def _logout_browser_context_session(context: Any, base_url: str | None) -> None:
        """If the browser context holds a ``pptgod_session`` cookie, revoke it via API."""
        tokens_to_revoke: list[tuple[str, str]] = []
        tracked = getattr(context, "_pptgod_session_tokens", None)
        if isinstance(tracked, list):
            tokens_to_revoke.extend(tracked)

        try:
            cookies = context.cookies()
            for c in cookies:
                if c.get("name") == SESSION_COOKIE_NAME and c.get("value"):
                    origin = base_url.rstrip("/") if base_url else ""
                    if not origin:
                        domain = str(c.get("domain", "")).lstrip(".")
                        if domain:
                            origin = f"http://{domain}"
                    if origin:
                        tokens_to_revoke.append((origin, str(c["value"])))
        except Exception as err:  # noqa: BLE001 — context already crashed
            sys.stderr.write(f"[glacier_e2e] Warning reading browser cookies during teardown: {err}\n")

        seen: set[tuple[str, str]] = set()
        for origin, token in tokens_to_revoke:
            if not origin or not token or (origin, token) in seen:
                continue
            seen.add((origin, token))
            client = ApiClient(origin, timeout_ms=5000)
            try:
                client.post(
                    "/api/auth/logout",
                    headers={"Cookie": f"{SESSION_COOKIE_NAME}={token}"},
                )
            except ApiConnectionError as err:
                sys.stderr.write(
                    f"[glacier_e2e] Warning: browser session logout failed during context teardown: {err}\n"
                )

    @contextlib.contextmanager
    def open_page(
        self,
        *,
        viewport: tuple[int, int] = DESKTOP_VIEWPORT,
        base_url: str | None = None,
        track_web_vitals: bool = True,
        reduced_motion: str | None = None,
        accept_downloads: bool = True,
    ) -> Iterator[BrowserPageGuard]:
        browser = self._ensure_browser()
        self._contexts_opened += 1
        ctx_kwargs: dict[str, Any] = {
            "viewport": {"width": viewport[0], "height": viewport[1]},
            "accept_downloads": accept_downloads,
            "locale": "zh-CN",
        }
        if reduced_motion in ("reduce", "no-preference"):
            ctx_kwargs["reduced_motion"] = reduced_motion

        context = browser.new_context(**ctx_kwargs)
        setattr(context, "_pptgod_session_tokens", [])
        context.set_default_timeout(self.timeout_ms)
        page = context.new_page()
        if track_web_vitals:
            page.add_init_script(_WEB_VITALS_INIT_JS)
        guard = BrowserPageGuard(page, timeout_ms=self.timeout_ms)
        try:
            yield guard
        finally:
            self._logout_browser_context_session(context, base_url)
            try:
                context.close()
            except Exception as err:  # noqa: BLE001
                sys.stderr.write(f"[glacier_e2e] Warning closing BrowserContext: {err}\n")


# ---------------------------------------------------------------------------
# Test Runner Primitives (TestSpec, TestResult, TestContext, SuiteRunner)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class TestSpec:
    id: str
    tier: int
    name: str
    fn: Callable[[TestContext], None]
    tags: tuple[str, ...] = ()
    requires_browser: bool = False


@dataclass
class TestResult:
    id: str
    tier: int
    name: str
    status: str  # "PASS" | "FAIL" | "ERROR"
    duration_ms: float
    error: str | None = None
    details: dict[str, Any] = field(default_factory=dict)


class TestContext:
    """Per-test execution context providing tracked authenticated clients, cleanup, and Playwright."""

    def __init__(
        self,
        *,
        base_url: str,
        timeout_ms: int,
        screenshots_dir: Path | None,
        repo_root: Path,
        db_path: Path,
        playwright_session: PlaywrightSession,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_ms = timeout_ms
        self.screenshots_dir = screenshots_dir
        self.repo_root = repo_root
        self.db_path = db_path
        self.playwright = playwright_session
        self._auth_clients: list[ApiClient] = []
        self._metrics: dict[str, Any] = {}

    def api(self, *, follow_redirects: bool = False) -> ApiClient:
        client = ApiClient(
            self.base_url,
            timeout_ms=self.timeout_ms,
            follow_redirects=follow_redirects,
        )
        self._auth_clients.append(client)
        return client

    def api_logged_in(
        self,
        account_or_email: SeedAccount | str = ACCOUNT_DEMO,
        password: str | None = None,
    ) -> ApiClient:
        if isinstance(account_or_email, SeedAccount):
            email = account_or_email.email
            pwd = account_or_email.password
        else:
            if not password:
                raise ValueError("password is required when passing email string to api_logged_in")
            email = account_or_email
            pwd = password
        client = self.api()
        client.login(email, pwd)
        return client

    def cleanup(self) -> CleanupRegistry:
        return CleanupRegistry()

    @contextlib.contextmanager
    def browser_page(
        self,
        *,
        viewport: tuple[int, int] = DESKTOP_VIEWPORT,
        track_web_vitals: bool = True,
        reduced_motion: str | None = None,
    ) -> Iterator[BrowserPageGuard]:
        with self.playwright.open_page(
            viewport=viewport,
            base_url=self.base_url,
            track_web_vitals=track_web_vitals,
            reduced_motion=reduced_motion,
        ) as guard:
            yield guard

    def record_metric(self, key: str, value: Any) -> None:
        self._metrics[key] = value

    def pop_metrics(self) -> dict[str, Any]:
        out = dict(self._metrics)
        self._metrics.clear()
        return out

    def teardown_sessions(self) -> None:
        """Log out every tracked authenticated ApiClient AFTER test & CleanupRegistry complete."""
        while self._auth_clients:
            client = self._auth_clients.pop()
            client.logout_if_authenticated()


class SuiteRunner:
    """Executes selected ``TestSpec`` items with strict session hygiene and structured reporting."""

    def __init__(
        self,
        *,
        base_url: str,
        timeout_ms: int = DEFAULT_TIMEOUT_MS,
        screenshots_dir: Path | None = None,
        repo_root: Path | None = None,
        db_path: Path | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_ms = timeout_ms
        self.screenshots_dir = screenshots_dir
        self.repo_root = repo_root or Path(__file__).resolve().parents[3]
        self.db_path = db_path or (self.repo_root / "data" / "pptgod.db")
        self.playwright = PlaywrightSession(timeout_ms=timeout_ms)

    def _is_chromium_crash(self, exc: BaseException) -> bool:
        msg = str(exc).lower()
        return any(
            marker in msg
            for marker in (
                "target closed",
                "target page, context or browser has been closed",
                "browser has been closed",
                "crash",
                "pipe closed",
                "err_aborted",
                "page.goto: timeout",
            )
        )

    def _run_one(self, spec: TestSpec) -> TestResult:
        attempts = 5 if spec.requires_browser else 1
        for attempt in range(1, attempts + 1):
            ctx = TestContext(
                base_url=self.base_url,
                timeout_ms=self.timeout_ms,
                screenshots_dir=self.screenshots_dir,
                repo_root=self.repo_root,
                db_path=self.db_path,
                playwright_session=self.playwright,
            )
            t0 = time.perf_counter()
            try:
                spec.fn(ctx)
                dur = round((time.perf_counter() - t0) * 1000.0, 1)
                return TestResult(
                    id=spec.id,
                    tier=spec.tier,
                    name=spec.name,
                    status="PASS",
                    duration_ms=dur,
                    details=ctx.pop_metrics(),
                )
            except AssertionError as err:
                dur = round((time.perf_counter() - t0) * 1000.0, 1)
                notes = getattr(err, "__notes__", [])
                note_txt = ("\n" + "\n".join(notes)) if notes else ""
                return TestResult(
                    id=spec.id,
                    tier=spec.tier,
                    name=spec.name,
                    status="FAIL",
                    duration_ms=dur,
                    error=f"{err}{note_txt}",
                    details=ctx.pop_metrics(),
                )
            except Exception as err:  # noqa: BLE001 — classify unexpected errors strictly as ERROR
                dur = round((time.perf_counter() - t0) * 1000.0, 1)
                if attempt < attempts and self._is_chromium_crash(err):
                    self.playwright.restart_browser()
                    continue
                tb = traceback.format_exc(limit=8)
                return TestResult(
                    id=spec.id,
                    tier=spec.tier,
                    name=spec.name,
                    status="ERROR",
                    duration_ms=dur,
                    error=f"{type(err).__name__}: {err}\n{tb}",
                    details=ctx.pop_metrics(),
                )
            finally:
                ctx.teardown_sessions()

        raise RuntimeError(f"Unreachable runner exit for {spec.id}")

    def run(self, specs: Sequence[TestSpec]) -> list[TestResult]:
        results: list[TestResult] = []
        try:
            for spec in specs:
                res = self._run_one(spec)
                results.append(res)
                tag = res.status.ljust(5)
                print(
                    f"[{tag}] T{res.tier} {res.id:<14} ({res.duration_ms:7.1f} ms)  {res.name}",
                    flush=True,
                )
                if res.error:
                    first_line = res.error.splitlines()[0]
                    print(f"        -> {first_line}", flush=True)
        finally:
            self.playwright.close()
        return results
