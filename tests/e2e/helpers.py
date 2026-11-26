"""Core opaque-box E2E test infrastructure for PPTGod v2.

Provides:
- ApiClient & ApiResponse (isolated cookie jars, non-raising HTTP errors, redirect control)
- CleanupRegistry & CleanupError (LIFO rollback without masking primary test failures)
- PptxVerifier (OOXML ZIP/CRC/XML/DrawingML/sRGB/notes/chart inspection)
- HtmlDeckVerifier (offline standalone HTML5 deck parser & invariant verifier)
- MockOpenAIServer (local ThreadingHTTPServer with 5 modes & cooperative shutdown)
- PlaywrightSession & BrowserPageGuard (lazy Chromium, console/pageerror/5xx guard,
  non-blank 16:9 canvas audit, responsive overflow audit, editorial aesthetics audit,
  download capture & screenshot stabilization)
- DbHygieneHelper (WAL-safe sqlite3 .backup, read-only row counts & secret scanning)
- RunConfig, TestResult, TestCaseSpec, TestContext
"""

from __future__ import annotations

import contextlib
import html as html_lib
import http.cookiejar
import io
import json
import os
import re
import shutil
import socket
import sqlite3
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass, field
from html.parser import HTMLParser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable, Iterable, Iterator, Literal, Sequence

from tests.e2e.config import (
    DESKTOP_VIEWPORT,
    PLAYWRIGHT_BROWSERS_DEFAULT,
    SESSION_COOKIE_NAMES,
    SQLITE3_FALLBACK_BIN,
    make_valid_slides,
)

# Ensure cached Playwright browser binaries are discovered even if caller omits env var.
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", PLAYWRIGHT_BROWSERS_DEFAULT)


# ---------------------------------------------------------------------------
# 1. HTTP ApiClient & ApiResponse
# ---------------------------------------------------------------------------


class ApiConnectionError(RuntimeError):
    """Raised when the target HTTP server cannot be reached or times out."""


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Prevents urllib from automatically following HTTP 3xx responses."""

    def redirect_request(
        self,
        req: urllib.request.Request,
        fp: Any,
        code: int,
        msg: str,
        headers: Any,
        newurl: str,
    ) -> None:
        return None


@dataclass(frozen=True)
class ApiResponse:
    status: int
    headers: dict[str, str]
    body: bytes
    json_data: Any | None
    url: str
    elapsed_ms: float

    def text(self, encoding: str = "utf-8") -> str:
        return self.body.decode(encoding, errors="replace")

    def header(self, name: str, default: str = "") -> str:
        target = name.lower()
        for key, value in self.headers.items():
            if key.lower() == target:
                return value
        return default

    def assert_status(
        self,
        expected: int | Sequence[int],
        context: str = "",
    ) -> "ApiResponse":
        allowed = (expected,) if isinstance(expected, int) else tuple(expected)
        if self.status not in allowed:
            preview = self.text()[:400]
            prefix = f"[{context}] " if context else ""
            raise AssertionError(
                f"{prefix}Expected HTTP status in {allowed}, got {self.status} "
                f"for {self.url}. Body: {preview!r}"
            )
        return self

    def require_json(self, context: str = "") -> Any:
        if self.json_data is None:
            prefix = f"[{context}] " if context else ""
            raise AssertionError(
                f"{prefix}Expected valid JSON response from {self.url} "
                f"(status={self.status}), got: {self.text()[:300]!r}"
            )
        return self.json_data


class ApiClient:
    """Per-role HTTP client with isolated cookie jar and non-raising HTTP status handling."""

    def __init__(
        self,
        base_url: str,
        *,
        timeout_ms: int = 15000,
        default_headers: dict[str, str] | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_ms = timeout_ms
        self.default_headers = dict(default_headers or {})
        self.cookie_jar = http.cookiejar.CookieJar()
        self._opener_follow = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.cookie_jar)
        )
        self._opener_no_redirect = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.cookie_jar),
            _NoRedirectHandler(),
        )

    def _build_url(self, path: str, params: dict[str, Any] | None = None) -> str:
        if path.startswith(("http://", "https://")):
            url = path
        else:
            suffix = path if path.startswith("/") else f"/{path}"
            url = f"{self.base_url}{suffix}"
        if params:
            filtered = {k: v for k, v in params.items() if v is not None}
            if filtered:
                qs = urllib.parse.urlencode(filtered, doseq=True)
                sep = "&" if "?" in url else "?"
                url = f"{url}{sep}{qs}"
        return url

    @staticmethod
    def _try_parse_json(body: bytes) -> Any | None:
        if not body:
            return None
        try:
            return json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return None

    def request(
        self,
        method: str,
        path: str,
        *,
        json_body: Any = None,
        raw_body: bytes | None = None,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        timeout_ms: int | None = None,
        follow_redirects: bool = True,
    ) -> ApiResponse:
        full_url = self._build_url(path, params)
        req_headers = dict(self.default_headers)
        if headers:
            req_headers.update(headers)

        data: bytes | None = raw_body
        if json_body is not None:
            data = json.dumps(json_body, ensure_ascii=False).encode("utf-8")
            req_headers.setdefault("Content-Type", "application/json; charset=utf-8")
            req_headers.setdefault("Accept", "application/json")

        req = urllib.request.Request(
            full_url,
            data=data,
            headers=req_headers,
            method=method.upper(),
        )
        opener = self._opener_follow if follow_redirects else self._opener_no_redirect
        timeout_s = (timeout_ms if timeout_ms is not None else self.timeout_ms) / 1000.0
        started = time.monotonic()

        try:
            with opener.open(req, timeout=timeout_s) as resp:
                body = resp.read()
                elapsed = (time.monotonic() - started) * 1000.0
                return ApiResponse(
                    status=int(resp.status),
                    headers=dict(resp.headers.items()),
                    body=body,
                    json_data=self._try_parse_json(body),
                    url=resp.geturl(),
                    elapsed_ms=elapsed,
                )
        except urllib.error.HTTPError as exc:
            body = exc.read() if exc.fp is not None else b""
            elapsed = (time.monotonic() - started) * 1000.0
            hdrs = dict(exc.headers.items()) if exc.headers is not None else {}
            return ApiResponse(
                status=int(exc.code),
                headers=hdrs,
                body=body,
                json_data=self._try_parse_json(body),
                url=exc.geturl() or full_url,
                elapsed_ms=elapsed,
            )
        except (urllib.error.URLError, TimeoutError, socket.timeout, OSError) as exc:
            raise ApiConnectionError(f"{method.upper()} {full_url} failed: {exc}") from exc

    def get(self, path: str, **kwargs: Any) -> ApiResponse:
        return self.request("GET", path, **kwargs)

    def post(self, path: str, **kwargs: Any) -> ApiResponse:
        return self.request("POST", path, **kwargs)

    def put(self, path: str, **kwargs: Any) -> ApiResponse:
        return self.request("PUT", path, **kwargs)

    def patch(self, path: str, **kwargs: Any) -> ApiResponse:
        return self.request("PATCH", path, **kwargs)

    def delete(self, path: str, **kwargs: Any) -> ApiResponse:
        return self.request("DELETE", path, **kwargs)

    def login(self, email: str, password: str) -> ApiResponse:
        return self.post(
            "/api/auth/login",
            json_body={"email": email, "password": password},
            headers={"Origin": self.base_url},
        )

    def logout(self) -> ApiResponse:
        return self.post("/api/auth/logout", headers={"Origin": self.base_url})

    def me(self) -> ApiResponse:
        return self.get("/api/auth/me")

    def get_cookie(self, name: str | None = None) -> str | None:
        for cookie in self.cookie_jar:
            if cookie.name in (SESSION_COOKIE_NAMES if name is None else (name,)):
                return cookie.value
        return None

    def clear_cookies(self) -> None:
        self.cookie_jar.clear()

    def export_playwright_cookies(self) -> list[dict[str, Any]]:
        """Convert CookieJar entries to Playwright BrowserContext.add_cookies() format."""
        parsed = urllib.parse.urlparse(self.base_url)
        origin_url = f"{parsed.scheme}://{parsed.netloc}/"
        out: list[dict[str, Any]] = []
        for cookie in self.cookie_jar:
            entry: dict[str, Any] = {
                "name": cookie.name,
                "value": cookie.value or "",
                "url": origin_url,
                "secure": bool(cookie.secure),
                "httpOnly": bool(
                    "HttpOnly" in getattr(cookie, "_rest", {})
                    or "httponly" in {k.lower() for k in getattr(cookie, "_rest", {})}
                ),
            }
            if cookie.expires:
                entry["expires"] = float(cookie.expires)
            out.append(entry)
        return out


# ---------------------------------------------------------------------------
# 2. CleanupRegistry & CleanupError
# ---------------------------------------------------------------------------


class CleanupError(RuntimeError):
    """Raised when a test passes its assertions but fails to clean up synthetic DB records."""

    def __init__(self, failures: list[tuple[str, Exception]]) -> None:
        self.failures = list(failures)
        summary = "; ".join(f"{label}: {type(err).__name__}: {err}" for label, err in failures)
        super().__init__(f"Cleanup failed ({len(failures)} error(s)): {summary}")


class CleanupRegistry:
    """LIFO cleanup stack that never masks primary test assertion errors."""

    def __init__(self) -> None:
        self._stack: list[tuple[str, Callable[[], None]]] = []
        self.errors: list[tuple[str, Exception]] = []

    def register(self, label: str, fn: Callable[[], None]) -> None:
        self._stack.append((label, fn))

    def register_delete_prompt(self, client: ApiClient, prompt_id: str) -> None:
        def _delete() -> None:
            resp = client.delete(f"/api/prompts/{prompt_id}")
            if resp.status not in (200, 404):
                raise RuntimeError(
                    f"DELETE /api/prompts/{prompt_id} returned {resp.status}: {resp.text()[:200]}"
                )

        self.register(f"delete_prompt:{prompt_id}", _delete)

    def register_delete_deck(self, client: ApiClient, deck_id: str) -> None:
        def _delete() -> None:
            resp = client.delete(f"/api/decks/{deck_id}")
            if resp.status not in (200, 404):
                raise RuntimeError(
                    f"DELETE /api/decks/{deck_id} returned {resp.status}: {resp.text()[:200]}"
                )

        self.register(f"delete_deck:{deck_id}", _delete)

    def register_delete_comment(
        self, client: ApiClient, prompt_id: str, comment_id: str
    ) -> None:
        def _delete() -> None:
            resp = client.delete(
                f"/api/prompts/{prompt_id}/comments",
                params={"commentId": comment_id},
            )
            if resp.status not in (200, 404):
                raise RuntimeError(
                    f"DELETE /api/prompts/{prompt_id}/comments?commentId={comment_id} "
                    f"returned {resp.status}: {resp.text()[:200]}"
                )

        self.register(f"delete_comment:{prompt_id}:{comment_id}", _delete)

    def register_restore_profile(
        self, client: ApiClient, profile: dict[str, str]
    ) -> None:
        snapshot = {
            "displayName": profile["displayName"],
            "bio": profile["bio"],
            "avatarColor": profile["avatarColor"],
        }

        def _restore() -> None:
            resp = client.patch("/api/auth/profile", json_body=snapshot)
            if resp.status != 200:
                raise RuntimeError(
                    f"PATCH /api/auth/profile restore returned {resp.status}: {resp.text()[:200]}"
                )

        self.register("restore_profile", _restore)

    def register_restore_toggle(
        self,
        client: ApiClient,
        prompt_id: str,
        action: Literal["like", "favorite"],
        expected_state: bool = False,
    ) -> None:
        """Idempotently restore like or favorite state on a seeded prompt."""
        field_name = "likedByMe" if action == "like" else "favoritedByMe"

        def _restore() -> None:
            detail = client.get(f"/api/prompts/{prompt_id}")
            if detail.status == 404:
                return
            if detail.status != 200 or not isinstance(detail.json_data, dict):
                raise RuntimeError(
                    f"GET /api/prompts/{prompt_id} during {action} restore returned {detail.status}"
                )
            prompt = detail.json_data.get("prompt") or {}
            current = bool(prompt.get(field_name, False))
            if current != expected_state:
                toggled = client.post(f"/api/prompts/{prompt_id}/{action}")
                if toggled.status != 200:
                    raise RuntimeError(
                        f"POST /api/prompts/{prompt_id}/{action} restore returned {toggled.status}"
                    )

        self.register(f"restore_{action}:{prompt_id}", _restore)

    def run_all(self) -> list[tuple[str, Exception]]:
        while self._stack:
            label, fn = self._stack.pop()
            try:
                fn()
            except Exception as exc:
                self.errors.append((label, exc))
        return list(self.errors)

    def __enter__(self) -> "CleanupRegistry":
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> bool:
        failures = self.run_all()
        if exc_type is not None:
            if failures and isinstance(exc_val, BaseException):
                for label, err in failures:
                    exc_val.add_note(f"[cleanup failure] {label}: {type(err).__name__}: {err}")
            return False
        if failures:
            raise CleanupError(failures)
        return False


# ---------------------------------------------------------------------------
# 3. PptxVerifier (OOXML Binary / ZIP / XML / DrawingML Inspection)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class PptxInspectionResult:
    size_bytes: int
    slide_count: int
    slide_members: tuple[str, ...]
    notes_members: tuple[str, ...]
    chart_members: tuple[str, ...]
    slide_texts: dict[str, str]
    notes_texts: dict[str, str]
    border_colors: tuple[str, ...]
    all_members: tuple[str, ...]


class PptxVerifier:
    """Strict opaque-box verifier for generated .pptx OOXML archives."""

    MAGIC_BYTES = b"PK\x03\x04"
    REQUIRED_CORE_MEMBERS: tuple[str, ...] = (
        "[Content_Types].xml",
        "_rels/.rels",
        "ppt/presentation.xml",
        "ppt/_rels/presentation.xml.rels",
    )
    _SLIDE_RE = re.compile(r"^ppt/slides/slide(\d+)\.xml$")
    _NOTES_RE = re.compile(r"^ppt/notesSlides/notesSlide(\d+)\.xml$")
    _CHART_RE = re.compile(r"^ppt/charts/chart(\d+)\.xml$")
    _HEX6_RE = re.compile(r"^[0-9A-Fa-f]{6}$")

    @staticmethod
    def _extract_drawingml_text(root: ET.Element) -> str:
        parts: list[str] = []
        for elem in root.iter():
            if elem.tag.endswith("}t") or elem.tag == "t":
                if elem.text:
                    parts.append(elem.text)
        return " ".join(parts)

    @classmethod
    def _collect_srgb_and_borders(
        cls,
        root: ET.Element,
        member: str,
        *,
        validate_srgb_hex: bool,
    ) -> list[str]:
        border_colors: list[str] = []
        for elem in root.iter():
            tag_local = elem.tag.rsplit("}", 1)[-1]
            if tag_local == "srgbClr":
                val = elem.attrib.get("val", "")
                if validate_srgb_hex and not cls._HEX6_RE.match(val):
                    raise AssertionError(
                        f"Invalid DrawingML <a:srgbClr val={val!r}> in {member} "
                        f"(expected exact 6-char hex)"
                    )
            elif tag_local == "ln":
                for desc in elem.iter():
                    if desc.tag.rsplit("}", 1)[-1] == "srgbClr":
                        val = desc.attrib.get("val", "").upper()
                        if val:
                            border_colors.append(val)
        return border_colors

    @classmethod
    def verify(
        cls,
        data: bytes,
        *,
        min_size: int = 30720,
        expected_min_slides: int = 1,
        expected_slide_count: int | None = None,
        expected_slide_texts: Sequence[str] = (),
        expected_notes_texts: Sequence[str] = (),
        require_notes: bool = True,
        validate_srgb_hex: bool = True,
    ) -> PptxInspectionResult:
        if not isinstance(data, (bytes, bytearray)) or len(data) < 4:
            raise AssertionError("PPTX payload is empty or not bytes")
        raw = bytes(data)
        if raw[:4] != cls.MAGIC_BYTES:
            raise AssertionError(
                f"PPTX missing ZIP magic PK\\x03\\x04; got {raw[:16]!r}"
            )
        if len(raw) <= min_size:
            raise AssertionError(
                f"PPTX file too small: {len(raw)} bytes (expected > {min_size} bytes)"
            )

        try:
            zf = zipfile.ZipFile(io.BytesIO(raw), "r")
        except zipfile.BadZipFile as exc:
            raise AssertionError(f"PPTX is not a valid ZIP archive: {exc}") from exc

        with zf:
            bad_member = zf.testzip()
            if bad_member is not None:
                raise AssertionError(f"Corrupt ZIP entry detected by CRC check: {bad_member}")

            all_members = tuple(zf.namelist())
            member_set = set(all_members)
            missing_core = [m for m in cls.REQUIRED_CORE_MEMBERS if m not in member_set]
            if missing_core:
                raise AssertionError(f"PPTX missing required OOXML members: {missing_core}")

            # Verify core XML files parse cleanly
            for core_xml in ("[Content_Types].xml", "ppt/presentation.xml"):
                try:
                    ET.fromstring(zf.read(core_xml))
                except ET.ParseError as exc:
                    raise AssertionError(f"Malformed XML in {core_xml}: {exc}") from exc

            # Discover and verify contiguous slides ppt/slides/slide1.xml..slideN.xml
            indexed_slides: list[tuple[int, str]] = []
            for m in all_members:
                match = cls._SLIDE_RE.match(m)
                if match:
                    indexed_slides.append((int(match.group(1)), m))
            indexed_slides.sort(key=lambda pair: pair[0])

            slide_indices = [idx for idx, _ in indexed_slides]
            slide_members = tuple(name for _, name in indexed_slides)
            if not slide_members:
                raise AssertionError("PPTX contains zero ppt/slides/slide*.xml members")
            expected_seq = list(range(1, len(slide_members) + 1))
            if slide_indices != expected_seq:
                raise AssertionError(
                    f"PPTX slide numbering not contiguous 1..N: got {slide_indices}"
                )
            if len(slide_members) < expected_min_slides:
                raise AssertionError(
                    f"PPTX has {len(slide_members)} slides, expected >= {expected_min_slides}"
                )
            if expected_slide_count is not None and len(slide_members) != expected_slide_count:
                raise AssertionError(
                    f"PPTX has {len(slide_members)} slides, expected exactly {expected_slide_count}"
                )

            slide_texts: dict[str, str] = {}
            all_border_colors: list[str] = []
            for m in slide_members:
                try:
                    root = ET.fromstring(zf.read(m))
                except ET.ParseError as exc:
                    raise AssertionError(f"Malformed slide XML in {m}: {exc}") from exc
                slide_texts[m] = cls._extract_drawingml_text(root)
                all_border_colors.extend(
                    cls._collect_srgb_and_borders(
                        root, m, validate_srgb_hex=validate_srgb_hex
                    )
                )

            # Discover and verify speaker notes XML
            indexed_notes: list[tuple[int, str]] = []
            for m in all_members:
                match = cls._NOTES_RE.match(m)
                if match:
                    indexed_notes.append((int(match.group(1)), m))
            indexed_notes.sort(key=lambda pair: pair[0])
            notes_members = tuple(name for _, name in indexed_notes)

            if require_notes and not notes_members:
                raise AssertionError(
                    "PPTX missing speaker notes (expected ppt/notesSlides/notesSlide*.xml)"
                )

            notes_texts: dict[str, str] = {}
            for m in notes_members:
                try:
                    root = ET.fromstring(zf.read(m))
                except ET.ParseError as exc:
                    raise AssertionError(f"Malformed notes XML in {m}: {exc}") from exc
                notes_texts[m] = cls._extract_drawingml_text(root)

            # Validate any embedded native OOXML charts
            indexed_charts: list[tuple[int, str]] = []
            for m in all_members:
                match = cls._CHART_RE.match(m)
                if match:
                    indexed_charts.append((int(match.group(1)), m))
            indexed_charts.sort(key=lambda pair: pair[0])
            chart_members = tuple(name for _, name in indexed_charts)
            for m in chart_members:
                try:
                    ET.fromstring(zf.read(m))
                except ET.ParseError as exc:
                    raise AssertionError(f"Malformed chart XML in {m}: {exc}") from exc

            combined_slide_text = "\n".join(slide_texts.values())
            for needle in expected_slide_texts:
                if needle not in combined_slide_text:
                    raise AssertionError(
                        f"Expected slide text {needle!r} not found in PPTX slides. "
                        f"Extracted sample: {combined_slide_text[:300]!r}"
                    )

            combined_notes_text = "\n".join(notes_texts.values())
            for needle in expected_notes_texts:
                if needle not in combined_notes_text:
                    raise AssertionError(
                        f"Expected speaker note {needle!r} not found in PPTX notesSlides. "
                        f"Extracted sample: {combined_notes_text[:300]!r}"
                    )

            return PptxInspectionResult(
                size_bytes=len(raw),
                slide_count=len(slide_members),
                slide_members=slide_members,
                notes_members=notes_members,
                chart_members=chart_members,
                slide_texts=slide_texts,
                notes_texts=notes_texts,
                border_colors=tuple(all_border_colors),
                all_members=all_members,
            )


# ---------------------------------------------------------------------------
# 4. HtmlDeckVerifier (Offline Standalone HTML5 Presentation Inspector)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class HtmlDeckInspectionResult:
    size_bytes: int
    title: str
    slide_count: int
    has_keyboard_nav: bool
    has_notes_drawer: bool
    has_print_css: bool
    external_dependencies: tuple[str, ...]
    svg_nan_errors: tuple[str, ...]


class _DeckHtmlParser(HTMLParser):
    """Stdlib HTMLParser collecting slides, notes, styles, scripts, external links & SVG attrs."""

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
    _NAN_RE = re.compile(r"\b(?:NaN|Infinity|-Infinity)\b", re.IGNORECASE)

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_title = False
        self.in_script = False
        self.in_style = False
        self.svg_depth = 0
        self.title_parts: list[str] = []
        self.body_parts: list[str] = []
        self.scripts: list[str] = []
        self.styles: list[str] = []
        self.notes: list[str] = []
        self.slide_count = 0
        self.external_deps: list[str] = []
        self.svg_nan_errors: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        t = tag.lower()
        attr_map = {k.lower(): (v or "") for k, v in attrs}

        if t == "title":
            self.in_title = True
        elif t == "script":
            self.in_script = True
            src = attr_map.get("src", "").strip()
            if src.startswith(("http://", "https://", "//")):
                self.external_deps.append(f"script:{src}")
        elif t == "style":
            self.in_style = True
        elif t == "link":
            rel = attr_map.get("rel", "").lower()
            href = attr_map.get("href", "").strip()
            if any(tok in rel for tok in ("stylesheet", "preload")) and href.startswith(
                ("http://", "https://", "//")
            ):
                self.external_deps.append(f"link:{href}")
        elif t == "section":
            cls = attr_map.get("class", "")
            if "slide" in cls.split() or "data-index" in attr_map:
                self.slide_count += 1
            if "data-notes" in attr_map and attr_map["data-notes"].strip():
                self.notes.append(attr_map["data-notes"])

        if t == "svg":
            self.svg_depth += 1

        if self.svg_depth > 0:
            for k, v in attr_map.items():
                if k in self._SVG_GEOM_ATTRS and self._NAN_RE.search(v):
                    self.svg_nan_errors.append(f"<{t} {k}={v!r}>")

    def handle_endtag(self, tag: str) -> None:
        t = tag.lower()
        if t == "title":
            self.in_title = False
        elif t == "script":
            self.in_script = False
        elif t == "style":
            self.in_style = False
        elif t == "svg" and self.svg_depth > 0:
            self.svg_depth -= 1

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data)
        elif self.in_script:
            self.scripts.append(data)
        elif self.in_style:
            self.styles.append(data)
        else:
            self.body_parts.append(data)


class HtmlDeckVerifier:
    """Strict verifier for offline standalone interactive HTML5 presentation decks."""

    @classmethod
    def verify(
        cls,
        content: str | bytes,
        *,
        expected_title_substrings: Sequence[str] = (),
        expected_slide_texts: Sequence[str] = (),
        expected_notes_texts: Sequence[str] = (),
        expected_min_slides: int = 1,
    ) -> HtmlDeckInspectionResult:
        if isinstance(content, (bytes, bytearray)):
            raw_bytes = bytes(content)
            text = raw_bytes.decode("utf-8")
        else:
            text = str(content)
            raw_bytes = text.encode("utf-8")

        if len(raw_bytes) < 200:
            raise AssertionError(f"HTML deck too small ({len(raw_bytes)} bytes)")
        if not re.match(r"^\s*<!doctype\s+html\b", text, re.IGNORECASE):
            raise AssertionError("HTML deck missing <!DOCTYPE html> declaration")
        lowered = text.lower()
        for required_tag in ("<html", "<head", "<body", "</html>"):
            if required_tag not in lowered:
                raise AssertionError(f"HTML deck missing required tag {required_tag!r}")

        parser = _DeckHtmlParser()
        parser.feed(text)
        parser.close()

        title = html_lib.unescape("".join(parser.title_parts)).strip()
        body_text = html_lib.unescape(" ".join(parser.body_parts))
        notes_text = html_lib.unescape("\n".join(parser.notes))
        all_scripts = "\n".join(parser.scripts)
        all_styles = "\n".join(parser.styles)

        if parser.slide_count < expected_min_slides:
            raise AssertionError(
                f"HTML deck has {parser.slide_count} slide <section> elements, "
                f"expected >= {expected_min_slides}"
            )

        for needle in expected_title_substrings:
            if needle not in title and needle not in body_text:
                raise AssertionError(
                    f"Expected title substring {needle!r} not found in HTML <title> ({title!r})"
                )

        for needle in expected_slide_texts:
            if needle not in body_text:
                raise AssertionError(
                    f"Expected slide text {needle!r} not found in HTML deck body"
                )

        for needle in expected_notes_texts:
            if needle not in notes_text and needle not in body_text:
                raise AssertionError(
                    f"Expected speaker note {needle!r} not found in HTML data-notes or body"
                )

        has_keyboard_nav = (
            "ArrowRight" in all_scripts
            and "ArrowLeft" in all_scripts
            and "keydown" in all_scripts
        )
        if not has_keyboard_nav:
            raise AssertionError(
                "HTML deck inline <script> missing ArrowRight/ArrowLeft keydown navigation"
            )

        has_notes_drawer = (
            "toggleNotes" in all_scripts
            or (
                bool(re.search(r"notesDrawer|notes-drawer", all_scripts + text, re.I))
                and bool(re.search(r"""['"][nN]['"]""", all_scripts))
            )
        )
        if not has_notes_drawer:
            raise AssertionError(
                "HTML deck missing speaker notes drawer toggle (toggleNotes / 'N' key)"
            )

        has_print_css = "@media print" in all_styles
        if not has_print_css:
            raise AssertionError("HTML deck inline <style> missing @media print rules")

        if parser.external_deps:
            raise AssertionError(
                f"Offline HTML deck must have zero external CDN dependencies; found: "
                f"{parser.external_deps}"
            )

        if parser.svg_nan_errors:
            raise AssertionError(
                f"HTML deck contains broken SVG NaN/Infinity attributes: {parser.svg_nan_errors}"
            )

        return HtmlDeckInspectionResult(
            size_bytes=len(raw_bytes),
            title=title,
            slide_count=parser.slide_count,
            has_keyboard_nav=has_keyboard_nav,
            has_notes_drawer=has_notes_drawer,
            has_print_css=has_print_css,
            external_dependencies=tuple(parser.external_deps),
            svg_nan_errors=tuple(parser.svg_nan_errors),
        )


# ---------------------------------------------------------------------------
# 5. MockOpenAIServer (Local ThreadingHTTPServer for BYOK LLM Tests)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RecordedOpenAIRequest:
    method: str
    path: str
    headers: dict[str, str]
    authorization: str
    raw_body: bytes
    json_body: dict[str, Any] | None


class _QuietThreadingHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


class MockOpenAIServer:
    """Ephemeral local OpenAI-compatible HTTP server on 127.0.0.1:0."""

    VALID_MODES: tuple[str, ...] = (
        "valid_json",
        "fenced_json",
        "malformed_text",
        "http_500",
        "slow_timeout",
    )

    def __init__(
        self,
        mode: str = "valid_json",
        *,
        slides: list[dict[str, Any]] | None = None,
        delay_seconds: float = 12.0,
        status_code_override: int | None = None,
    ) -> None:
        if mode not in self.VALID_MODES:
            raise ValueError(f"Unsupported MockOpenAIServer mode: {mode!r}")
        self._mode = mode
        self._slides = slides if slides is not None else make_valid_slides(
            4, custom_title="Mock LLM Generated Deck"
        )
        self._delay_seconds = delay_seconds
        self._status_code_override = status_code_override
        self._lock = threading.Lock()
        self._requests: list[RecordedOpenAIRequest] = []
        self._stop_event = threading.Event()
        self._server: _QuietThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None

    @property
    def port(self) -> int:
        if self._server is None:
            raise RuntimeError("MockOpenAIServer has not been started")
        return int(self._server.server_address[1])

    @property
    def base_url(self) -> str:
        return f"http://127.0.0.1:{self.port}/v1"

    @property
    def requests(self) -> list[RecordedOpenAIRequest]:
        with self._lock:
            return list(self._requests)

    def clear_requests(self) -> None:
        with self._lock:
            self._requests.clear()

    def set_mode(
        self,
        mode: str,
        *,
        slides: list[dict[str, Any]] | None = None,
        delay_seconds: float | None = None,
        status_code_override: int | None = None,
    ) -> None:
        if mode not in self.VALID_MODES:
            raise ValueError(f"Unsupported MockOpenAIServer mode: {mode!r}")
        with self._lock:
            self._mode = mode
            if slides is not None:
                self._slides = slides
            if delay_seconds is not None:
                self._delay_seconds = delay_seconds
            self._status_code_override = status_code_override

    def _build_handler(self) -> type[BaseHTTPRequestHandler]:
        parent = self

        class _Handler(BaseHTTPRequestHandler):
            def log_message(self, format: str, *args: Any) -> None:
                # Suppress noisy HTTP access logs during test execution.
                _ = (format, args)

            def do_POST(self) -> None:
                length = int(self.headers.get("Content-Length", "0") or "0")
                raw = self.rfile.read(length) if length > 0 else b""
                parsed_json: dict[str, Any] | None = None
                try:
                    loaded = json.loads(raw.decode("utf-8")) if raw else None
                    if isinstance(loaded, dict):
                        parsed_json = loaded
                except (UnicodeDecodeError, json.JSONDecodeError):
                    parsed_json = None

                hdr_dict = {k: v for k, v in self.headers.items()}
                record = RecordedOpenAIRequest(
                    method="POST",
                    path=self.path,
                    headers=hdr_dict,
                    authorization=self.headers.get("Authorization", ""),
                    raw_body=raw,
                    json_body=parsed_json,
                )
                with parent._lock:
                    parent._requests.append(record)
                    mode = parent._mode
                    slides = list(parent._slides)
                    delay_s = parent._delay_seconds
                    override_code = parent._status_code_override

                if mode == "slow_timeout":
                    parent._stop_event.wait(timeout=delay_s)
                    if parent._stop_event.is_set():
                        return

                if mode == "http_500":
                    status = override_code or 500
                    payload = {"error": {"message": "Upstream simulated failure"}}
                elif mode == "malformed_text":
                    status = override_code or 200
                    payload = {
                        "id": "chatcmpl-e2e-malformed",
                        "object": "chat.completion",
                        "choices": [
                            {
                                "index": 0,
                                "message": {
                                    "role": "assistant",
                                    "content": "NOT_JSON {{{ broken_response_payload",
                                },
                                "finish_reason": "stop",
                            }
                        ],
                    }
                elif mode == "fenced_json":
                    status = override_code or 200
                    inner = json.dumps({"slides": slides}, ensure_ascii=False)
                    payload = {
                        "id": "chatcmpl-e2e-fenced",
                        "object": "chat.completion",
                        "choices": [
                            {
                                "index": 0,
                                "message": {
                                    "role": "assistant",
                                    "content": f"```json\n{inner}\n```",
                                },
                                "finish_reason": "stop",
                            }
                        ],
                    }
                else:
                    status = override_code or 200
                    inner = json.dumps({"slides": slides}, ensure_ascii=False)
                    payload = {
                        "id": "chatcmpl-e2e-mock",
                        "object": "chat.completion",
                        "choices": [
                            {
                                "index": 0,
                                "message": {
                                    "role": "assistant",
                                    "content": inner,
                                },
                                "finish_reason": "stop",
                            }
                        ],
                    }

                encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                try:
                    self.send_response(status)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Length", str(len(encoded)))
                    self.end_headers()
                    self.wfile.write(encoded)
                except (BrokenPipeError, ConnectionResetError):
                    return

        return _Handler

    def start(self) -> "MockOpenAIServer":
        if self._server is not None:
            return self
        self._stop_event.clear()
        self._server = _QuietThreadingHTTPServer(("127.0.0.1", 0), self._build_handler())
        self._thread = threading.Thread(
            target=self._server.serve_forever,
            kwargs={"poll_interval": 0.1},
            daemon=True,
            name="MockOpenAIServer",
        )
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

    def __enter__(self) -> "MockOpenAIServer":
        return self.start()

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        self.stop()


# ---------------------------------------------------------------------------
# 6. PlaywrightSession, BrowserPageGuard & Resilient Locator Helpers
# ---------------------------------------------------------------------------


def first_visible(candidates: Sequence[Any], timeout_ms: int = 8000) -> Any:
    """Poll candidate Playwright locators in priority order until one becomes visible."""
    deadline = time.monotonic() + (timeout_ms / 1000.0)
    last_err: Exception | None = None
    while time.monotonic() < deadline:
        for loc in candidates:
            try:
                if loc.count() > 0 and loc.first.is_visible():
                    return loc.first
            except Exception as exc:
                last_err = exc
        time.sleep(0.1)
    raise AssertionError(
        f"No candidate locator became visible within {timeout_ms}ms "
        f"(tried {len(candidates)} candidates; last_err={last_err!r})"
    )


@dataclass(frozen=True)
class ConsoleErrorRecord:
    text: str
    location: str
    url: str


@dataclass(frozen=True)
class HttpErrorRecord:
    status: int
    url: str
    method: str


_CANVAS_INSPECT_JS = """
(el) => {
  const rect = el.getBoundingClientRect();
  const stage = el.querySelector('.pg-slide-stage') || el;
  const text = (stage.innerText || '').trim();
  const nonDecorativeNodes = Array.from(stage.querySelectorAll('*')).filter((n) => {
    if (n.closest('[aria-hidden="true"]')) return false;
    const r = n.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  const svgErrors = [];
  const svgs = Array.from(stage.querySelectorAll('svg')).filter(
    (s) => !s.closest('[aria-hidden="true"]')
  );
  const geomAttrs = ['x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2', 'd', 'points', 'transform'];
  for (const svg of svgs) {
    for (const node of svg.querySelectorAll('rect, line, circle, path, polyline, polygon, text')) {
      for (const attr of geomAttrs) {
        const val = node.getAttribute(attr);
        if (val !== null && /\\b(NaN|Infinity|-Infinity)\\b/i.test(val)) {
          svgErrors.push(`<${node.tagName} ${attr}="${val}">`);
        }
      }
    }
  }
  const barRects = svgs.flatMap((s) =>
    Array.from(s.querySelectorAll('rect')).filter((r) => parseFloat(r.getAttribute('height') || '0') > 0)
  ).length;
  return {
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    aspectRatio: rect.height > 0 ? +(rect.width / rect.height).toFixed(3) : 0,
    textLength: text.length,
    textSample: text.slice(0, 180),
    fullText: text,
    hasCorruptText: /\\b(NaN|undefined)\\b|\\[object Object\\]/.test(text),
    visibleElementCount: nonDecorativeNodes.length,
    svgCount: svgs.length,
    barRectCount: barRects,
    svgErrors,
    bgColor: getComputedStyle(stage).backgroundColor,
  };
}
"""

_OVERFLOW_AUDIT_JS = """
(tolerancePx) => {
  const docEl = document.documentElement;
  const innerW = window.innerWidth;
  const scrollW = docEl.scrollWidth;
  const offenders = [];
  if (scrollW > innerW + tolerancePx) {
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.right > innerW + tolerancePx) {
        const cs = getComputedStyle(el);
        if (cs.visibility !== 'hidden' && cs.display !== 'none') {
          offenders.push({
            tag: el.tagName.toLowerCase(),
            id: el.id || '',
            cls: typeof el.className === 'string' ? el.className.slice(0, 60) : '',
            right: Math.round(r.right),
            innerW,
          });
          if (offenders.length >= 8) break;
        }
      }
    }
  }
  return { innerW, scrollW, overflowPx: scrollW - innerW, ok: scrollW <= innerW + tolerancePx, offenders };
}
"""

_EDITORIAL_AESTHETICS_JS = """
() => {
  const bodyStyle = getComputedStyle(document.body);
  const bodyBg = bodyStyle.backgroundColor;
  const bgMatch = bodyBg.match(/rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/);
  const bodyBgOk = Boolean(
    bgMatch &&
    Math.abs(Number(bgMatch[1]) - 245) <= 4 &&
    Math.abs(Number(bgMatch[2]) - 242) <= 4 &&
    Math.abs(Number(bgMatch[3]) - 235) <= 4
  );

  const splitShadowLayers = (str) => {
    const layers = [];
    let cur = '', depth = 0;
    for (const ch of str) {
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      if (ch === ',' && depth === 0) {
        if (cur.trim()) layers.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    if (cur.trim()) layers.push(cur.trim());
    return layers;
  };

  const rgbToHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    }
    return { s, l };
  };

  const gradientTextViolations = [];
  const neonGlowViolations = [];
  const gridBgViolations = [];

  for (const el of document.querySelectorAll('body, body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    const bgClip = cs.backgroundClip || '';
    const wkClip = cs.webkitBackgroundClip || '';
    if (bgClip === 'text' || wkClip === 'text') {
      gradientTextViolations.push({
        tag: el.tagName.toLowerCase(),
        cls: typeof el.className === 'string' ? el.className.slice(0, 60) : '',
        text: (el.innerText || '').trim().slice(0, 40),
      });
    }

    if (el.closest('.pg-slide-outer, .pg-slide-stage')) continue;

    const bs = cs.boxShadow;
    if (bs && bs !== 'none') {
      const layers = splitShadowLayers(bs);
      let coloredGlowLayers = 0;
      let isNeon = false;
      for (const layer of layers) {
        if (/\\binset\\b/i.test(layer)) continue;
        const colorMatch = layer.match(/rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)(?:\\s*[,/]\\s*([\\d.]+))?\\s*\\)/i);
        if (!colorMatch) continue;
        const r = Number(colorMatch[1]), g = Number(colorMatch[2]), b = Number(colorMatch[3]);
        const alpha = colorMatch[4] !== undefined ? Number(colorMatch[4]) : 1;
        const { s, l } = rgbToHsl(r, g, b);
        const pxNums = layer.replace(colorMatch[0], '').match(/-?[\\d.]+px/g)?.map(parseFloat) || [];
        const [ox = 0, oy = 0, blur = 0] = pxNums;
        if (s >= 0.45 && l >= 0.25 && l <= 0.80 && alpha >= 0.32 && blur >= 12) {
          coloredGlowLayers++;
          if (blur >= 16 || (ox === 0 && oy === 0)) {
            isNeon = true;
          }
        }
      }
      if (isNeon || coloredGlowLayers >= 2) {
        neonGlowViolations.push({
          tag: el.tagName.toLowerCase(),
          cls: typeof el.className === 'string' ? el.className.slice(0, 60) : '',
          boxShadow: bs.slice(0, 120),
        });
      }
    }

    if (el === document.body || el.tagName === 'MAIN' || el.tagName === 'SECTION') {
      const bgImg = cs.backgroundImage || '';
      const hasRepeatingGrid = /repeating-(linear|conic)-gradient/i.test(bgImg);
      const smallTile = (cs.backgroundSize || '').match(/(\\d+(?:\\.\\d+)?)px/g)
        ?.some((v) => parseFloat(v) > 0 && parseFloat(v) <= 80);
      const isLinearGrid = /linear-gradient/i.test(bgImg) && smallTile && cs.backgroundRepeat !== 'no-repeat';
      if (hasRepeatingGrid || isLinearGrid) {
        gridBgViolations.push({
          tag: el.tagName.toLowerCase(),
          cls: typeof el.className === 'string' ? el.className.slice(0, 60) : '',
          bgImg: bgImg.slice(0, 100),
          bgSize: cs.backgroundSize,
        });
      }
    }
  }

  return {
    bodyBg,
    bodyBgOk,
    gradientTextViolations,
    neonGlowViolations,
    gridBgViolations,
  };
}
"""


class BrowserPageGuard:
    """Wraps a Playwright Page with strict console/pageerror/5xx tracking and E2E helpers."""

    _RESOURCE_STATUS_RE = re.compile(
        r"Failed to load resource: the server responded with a status of (\d{3})"
    )

    def __init__(self, page: Any, context: Any, *, timeout_ms: int = 15000) -> None:
        self.page = page
        self.context = context
        self._timeout_ms = timeout_ms
        self.console_errors: list[ConsoleErrorRecord] = []
        self.page_errors: list[str] = []
        self.unexpected_5xx: list[HttpErrorRecord] = []
        self._allowed_http_statuses: set[int] = set()

        self.page.set_default_timeout(timeout_ms)
        self.page.set_default_navigation_timeout(timeout_ms)

        self.page.on("console", self._on_console)
        self.page.on("pageerror", self._on_pageerror)
        self.page.on("response", self._on_response)

    def _on_console(self, msg: Any) -> None:
        if getattr(msg, "type", "") != "error":
            return
        text = str(msg.text)
        if self._allowed_http_statuses:
            match = self._RESOURCE_STATUS_RE.search(text)
            if match and int(match.group(1)) in self._allowed_http_statuses:
                return
        loc = msg.location or {}
        loc_str = f"{loc.get('url', '')}:{loc.get('lineNumber', '')}"
        self.console_errors.append(
            ConsoleErrorRecord(text=text, location=loc_str, url=self.page.url)
        )

    def _on_pageerror(self, err: Any) -> None:
        self.page_errors.append(str(err))

    def _on_response(self, resp: Any) -> None:
        status = int(resp.status)
        if status >= 500 and status not in self._allowed_http_statuses:
            self.unexpected_5xx.append(
                HttpErrorRecord(
                    status=status,
                    url=str(resp.url),
                    method=str(resp.request.method),
                )
            )

    @contextlib.contextmanager
    def allow_expected_http_errors(self, statuses: Iterable[int]) -> Iterator[None]:
        """Temporarily allow intentional negative-test HTTP status resource console messages."""
        prev = set(self._allowed_http_statuses)
        self._allowed_http_statuses.update(int(s) for s in statuses)
        try:
            yield
        finally:
            self._allowed_http_statuses = prev

    @contextlib.contextmanager
    def accept_next_dialog(self) -> Iterator[list[str]]:
        """Auto-accept native window.confirm/alert dialogs fired inside the block."""
        messages: list[str] = []

        def _handler(dialog: Any) -> None:
            messages.append(str(dialog.message))
            dialog.accept()

        self.page.on("dialog", _handler)
        try:
            yield messages
        finally:
            self.page.remove_listener("dialog", _handler)

    def reset_errors(self) -> None:
        self.console_errors.clear()
        self.page_errors.clear()
        self.unexpected_5xx.clear()

    def assert_no_browser_errors(self, label: str = "") -> None:
        problems: list[str] = []
        if self.console_errors:
            formatted = "; ".join(f"{r.text} ({r.location})" for r in self.console_errors[:5])
            problems.append(f"console.error x{len(self.console_errors)}: {formatted}")
        if self.page_errors:
            problems.append(
                f"pageerror x{len(self.page_errors)}: {'; '.join(self.page_errors[:5])}"
            )
        if self.unexpected_5xx:
            formatted = "; ".join(
                f"{r.method} {r.url} -> {r.status}" for r in self.unexpected_5xx[:5]
            )
            problems.append(f"HTTP 5xx x{len(self.unexpected_5xx)}: {formatted}")
        if problems:
            prefix = f"[{label}] " if label else ""
            raise AssertionError(f"{prefix}Browser errors detected: " + " | ".join(problems))

    def goto_ok(
        self,
        url: str,
        *,
        wait_until: str = "networkidle",
        expected_status: int | None = 200,
    ) -> Any:
        resp = self.page.goto(url, wait_until=wait_until, timeout=self._timeout_ms)
        if expected_status is not None:
            if resp is None:
                raise AssertionError(f"Navigation to {url} returned no HTTP response")
            if int(resp.status) != expected_status:
                raise AssertionError(
                    f"Expected HTTP {expected_status} navigating to {url}, got {resp.status}"
                )
        return resp

    def login_via_api(self, base_url: str, email: str, password: str) -> None:
        """Authenticate via API and inject session cookies into the BrowserContext."""
        client = ApiClient(base_url, timeout_ms=self._timeout_ms)
        resp = client.login(email, password)
        resp.assert_status(200, f"BrowserPageGuard.login_via_api({email})")
        cookies = client.export_playwright_cookies()
        if not cookies:
            raise AssertionError(f"Login for {email} did not produce a session cookie")
        self.context.add_cookies(cookies)

    def login_via_demo_ui(self) -> None:
        """Open AuthModal from Navbar and click one-click demo login button."""
        login_btn = first_visible(
            [
                self.page.locator("#pg-nav-login-btn"),
                self.page.get_by_role(
                    "button", name=re.compile(r"登录\s*/?\s*注册|立即登录|登录同步|登录")
                ),
            ],
            timeout_ms=self._timeout_ms,
        )
        login_btn.click()
        dialog = self.page.locator('[role="dialog"]').filter(
            has=self.page.get_by_role(
                "button", name=re.compile(r"演示账号|立即登录|demo@pptgod")
            )
        )
        dialog.first.wait_for(state="visible", timeout=self._timeout_ms)
        demo_btn = first_visible(
            [
                dialog.first.locator("#pg-demo-login-btn"),
                dialog.first.get_by_role(
                    "button", name=re.compile(r"一键登录.*演示|体验演示账号|demo@pptgod")
                ),
            ],
            timeout_ms=self._timeout_ms,
        )
        demo_btn.click()
        # Confirm login succeeded via logout button or user display name
        first_visible(
            [
                self.page.locator("#pg-nav-logout-btn"),
                self.page.locator('button[aria-label="退出登录"]'),
                self.page.locator("header").get_by_text(re.compile(r"林屿")),
            ],
            timeout_ms=self._timeout_ms,
        )

    def capture_download(
        self,
        trigger_fn: Callable[[], None],
        *,
        timeout_ms: int | None = None,
    ) -> tuple[str, bytes]:
        """Trigger a server or client-side Blob download and return (filename, bytes)."""
        wait_ms = timeout_ms if timeout_ms is not None else self._timeout_ms
        with self.page.expect_download(timeout=wait_ms) as dl_info:
            trigger_fn()
        download = dl_info.value
        suggested = download.suggested_filename
        with tempfile.TemporaryDirectory(prefix="pptgod_dl_") as tmp_dir:
            dest = Path(tmp_dir) / (suggested or "download.bin")
            download.save_as(str(dest))
            data = dest.read_bytes()
        return suggested, data

    def find_primary_stage(self, *, min_width: int = 300) -> Any:
        """Locate the primary 16:9 SlideCanvas stage (excluding small filmstrip thumbnails)."""
        scoped = self.page.locator(".pg-stage-canvas-wrap .pg-slide-outer")
        if scoped.count() > 0 and scoped.first.is_visible():
            box = scoped.first.bounding_box()
            if box and box["width"] >= min_width:
                return scoped.first

        all_canvases = self.page.locator('.pg-slide-outer, [style*="aspect-ratio"]')
        count = all_canvases.count()
        best_idx = -1
        best_width = 0.0
        for idx in range(count):
            cand = all_canvases.nth(idx)
            if not cand.is_visible():
                continue
            box = cand.bounding_box()
            if box and box["width"] >= min_width and box["width"] > best_width:
                best_width = box["width"]
                best_idx = idx
        if best_idx >= 0:
            return all_canvases.nth(best_idx)
        raise AssertionError(
            f"No primary 16:9 SlideCanvas stage with width >= {min_width}px found on {self.page.url}"
        )

    def assert_canvas_non_blank(
        self,
        stage_locator: Any = None,
        *,
        slide_type: str | None = None,
        min_width: int = 300,
        min_height: int = 160,
        min_text_len: int = 20,
        label: str = "",
    ) -> dict[str, Any]:
        """Inspect a rendered 16:9 SlideCanvas and assert non-blank, non-corrupt geometry."""
        target = stage_locator if stage_locator is not None else self.find_primary_stage(min_width=min_width)
        target.wait_for(state="visible", timeout=self._timeout_ms)
        info: dict[str, Any] = target.evaluate(_CANVAS_INSPECT_JS)
        prefix = f"[{label or slide_type or 'canvas'}] "

        if info["width"] < min_width or info["height"] < min_height:
            raise AssertionError(
                f"{prefix}Canvas box too small: {info['width']}x{info['height']} "
                f"(expected >= {min_width}x{min_height})"
            )
        if abs(info["aspectRatio"] - 1.778) > 0.09:
            raise AssertionError(
                f"{prefix}Canvas aspect ratio {info['aspectRatio']} deviates from 16:9 (1.778)"
            )
        if info["textLength"] < min_text_len:
            raise AssertionError(
                f"{prefix}Canvas rendered blank/insufficient text: len={info['textLength']} "
                f"(sample={info['textSample']!r})"
            )
        if info["visibleElementCount"] < 4:
            raise AssertionError(
                f"{prefix}Canvas has only {info['visibleElementCount']} visible non-decorative nodes"
            )
        if info["hasCorruptText"]:
            raise AssertionError(
                f"{prefix}Canvas contains corrupt text (NaN/undefined/[object Object]): "
                f"{info['textSample']!r}"
            )
        if info["svgErrors"]:
            raise AssertionError(
                f"{prefix}Canvas contains invalid SVG attributes: {info['svgErrors']}"
            )
        if slide_type == "data":
            if info["svgCount"] < 1 or info["barRectCount"] < 2:
                raise AssertionError(
                    f"{prefix}Data slide missing SVG bar chart "
                    f"(svgCount={info['svgCount']}, barRectCount={info['barRectCount']})"
                )
        return info

    def assert_no_horizontal_overflow(
        self,
        *,
        tolerance_px: int = 2,
        label: str = "",
    ) -> tuple[int, int]:
        result: dict[str, Any] = self.page.evaluate(_OVERFLOW_AUDIT_JS, tolerance_px)
        if not result["ok"]:
            prefix = f"[{label or self.page.url}] "
            raise AssertionError(
                f"{prefix}Horizontal overflow detected: scrollWidth={result['scrollW']}px > "
                f"innerWidth={result['innerW']}px (+{result['overflowPx']}px). "
                f"Offenders: {result['offenders']}"
            )
        return int(result["scrollW"]), int(result["innerW"])

    def assert_editorial_aesthetics(self, *, label: str = "") -> dict[str, Any]:
        """Verify warm archival paper canvas and zero prohibited AI-slop styling."""
        audit: dict[str, Any] = self.page.evaluate(_EDITORIAL_AESTHETICS_JS)
        prefix = f"[{label or self.page.url}] "
        violations: list[str] = []
        if not audit["bodyBgOk"]:
            violations.append(
                f"body backgroundColor={audit['bodyBg']!r} (expected warm paper ~rgb(245, 242, 235))"
            )
        if audit["gradientTextViolations"]:
            violations.append(
                f"gradient text prohibited: {audit['gradientTextViolations'][:5]}"
            )
        if audit["neonGlowViolations"]:
            violations.append(
                f"neon glow box-shadow prohibited on editorial chrome: "
                f"{audit['neonGlowViolations'][:5]}"
            )
        if audit["gridBgViolations"]:
            violations.append(
                f"grid/mesh background prohibited on editorial chrome: "
                f"{audit['gridBgViolations'][:5]}"
            )
        if violations:
            raise AssertionError(prefix + "Aesthetic violation(s): " + " | ".join(violations))
        return audit

    def stabilize_for_screenshot(self) -> None:
        self.page.wait_for_load_state("networkidle")
        self.page.evaluate("() => document.fonts ? document.fonts.ready : Promise.resolve()")
        self.page.wait_for_timeout(450)
        self.page.evaluate("() => document.querySelectorAll('.pg-toast').forEach((e) => e.remove())")
        self.page.evaluate("() => window.scrollTo(0, 0)")

    def save_screenshot(
        self,
        path: Path,
        *,
        full_page: bool = False,
        min_bytes: int = 20480,
    ) -> bytes:
        path.parent.mkdir(parents=True, exist_ok=True)
        self.page.screenshot(path=str(path), full_page=full_page)
        data = path.read_bytes()
        if not data.startswith(b"\x89PNG\r\n\x1a\n"):
            raise AssertionError(f"Screenshot {path} does not have valid PNG magic header")
        if len(data) <= min_bytes:
            raise AssertionError(
                f"Screenshot {path} suspiciously small ({len(data)} bytes <= {min_bytes})"
            )
        return data

    def drive_style_matcher_modal(self) -> Any:
        """Open the 30s Smart Style Matcher modal from / and complete all 3 wizard steps."""
        trigger = first_visible(
            [
                self.page.get_by_role(
                    "button",
                    name=re.compile(r"30\s*秒|智能选词|选词顾问|挑词顾问|智能推荐|风格顾问|帮我选"),
                )
            ],
            timeout_ms=self._timeout_ms,
        )
        trigger.click()

        modal = self.page.locator('[role="dialog"]').filter(
            has_not=self.page.locator("#pg-auth-title")
        ).first
        modal.wait_for(state="visible", timeout=self._timeout_ms)

        step_patterns = (
            re.compile(r"高管|投资人|管理层|商业路演|客户|导师|产品发布|咨询"),
            re.compile(r"明亮|会议室|投影|暗场|大屏|LED|电脑|阅读|浅色"),
            re.compile(r"极简|高留白|均衡|高密度|信息密度|适中"),
        )
        for pattern in step_patterns:
            if modal.locator('a[href^="/studio/"]').count() >= 3:
                break
            choice = modal.get_by_role("button", name=pattern).first
            choice.wait_for(state="visible", timeout=self._timeout_ms)
            choice.click()
            next_btn = modal.get_by_role(
                "button", name=re.compile(r"下一步|生成推荐|查看推荐|开始匹配|完成")
            )
            if next_btn.count() > 0 and next_btn.first.is_visible() and next_btn.first.is_enabled():
                next_btn.first.click()
            self.page.wait_for_timeout(180)

        # Wait for Top 3 recommendations to render inside modal
        modal.locator('a[href^="/studio/"]').nth(2).wait_for(
            state="visible", timeout=self._timeout_ms
        )
        return modal


class PlaywrightSession:
    """Lazy headless Chromium manager creating isolated BrowserContexts per test."""

    def __init__(self, *, timeout_ms: int = 15000, headless: bool = True) -> None:
        self.timeout_ms = timeout_ms
        self.headless = headless
        self._pw_cm: Any = None
        self._pw: Any = None
        self._browser: Any = None
        self._contexts_since_launch = 0
        self.launch_fallback_used = False

    def _launch_browser(self) -> Any:
        if self._pw is None:
            os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", PLAYWRIGHT_BROWSERS_DEFAULT)
            from playwright.sync_api import sync_playwright

            self._pw_cm = sync_playwright()
            self._pw = self._pw_cm.__enter__()
        try:
            self._browser = self._pw.chromium.launch(headless=self.headless)
        except Exception as first_err:
            self.launch_fallback_used = True
            try:
                self._browser = self._pw.chromium.launch(
                    headless=self.headless,
                    args=["--no-sandbox"],
                )
            except Exception as second_err:
                raise RuntimeError(
                    f"Chromium failed both default launch ({first_err}) and "
                    f"--no-sandbox launch ({second_err})"
                ) from second_err
        self._contexts_since_launch = 0
        return self._browser

    def force_recycle(self) -> None:
        if self._browser is not None:
            try:
                self._browser.close()
            except Exception:
                pass
            self._browser = None
        self._contexts_since_launch = 0

    def _ensure_browser(self) -> Any:
        if self._browser is not None:
            if self._contexts_since_launch >= 10 or not self._browser.is_connected():
                self.force_recycle()
                return self._launch_browser()
            return self._browser
        return self._launch_browser()

    def __enter__(self) -> "PlaywrightSession":
        os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", PLAYWRIGHT_BROWSERS_DEFAULT)
        return self

    def close(self) -> None:
        close_errors: list[Exception] = []
        if self._browser is not None:
            try:
                self._browser.close()
            except Exception as exc:
                close_errors.append(exc)
            self._browser = None
        if self._pw_cm is not None:
            try:
                self._pw_cm.__exit__(None, None, None)
            except Exception as exc:
                close_errors.append(exc)
            self._pw_cm = None
            self._pw = None
        if close_errors:
            raise RuntimeError(f"Error closing PlaywrightSession: {close_errors[0]}") from close_errors[0]

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        self.close()

    @contextlib.contextmanager
    def open_page(
        self,
        *,
        viewport: tuple[int, int] = DESKTOP_VIEWPORT,
        grant_clipboard_origin: str | None = None,
        timeout_ms: int | None = None,
    ) -> Iterator[BrowserPageGuard]:
        browser = self._ensure_browser()
        self._contexts_since_launch += 1
        width, height = viewport
        context = browser.new_context(
            viewport={"width": width, "height": height},
            device_scale_factor=1,
            accept_downloads=True,
            locale="zh-CN",
        )
        if grant_clipboard_origin:
            parsed = urllib.parse.urlparse(grant_clipboard_origin)
            origin = f"{parsed.scheme}://{parsed.netloc}"
            context.grant_permissions(["clipboard-read", "clipboard-write"], origin=origin)
        page = context.new_page()
        guard = BrowserPageGuard(
            page,
            context,
            timeout_ms=timeout_ms if timeout_ms is not None else self.timeout_ms,
        )
        try:
            yield guard
        finally:
            try:
                context.close()
            except Exception:
                pass


# ---------------------------------------------------------------------------
# 7. DbHygieneHelper (WAL-Safe Backup, Read-Only Counts & Secret Scanner)
# ---------------------------------------------------------------------------


class DbHygieneHelper:
    """Read-only SQLite hygiene inspector and WAL-safe .backup wrapper."""

    CORE_TABLES: tuple[str, ...] = (
        "users",
        "prompts",
        "saved_decks",
        "prompt_comments",
        "prompt_likes",
        "prompt_favorites",
    )

    @staticmethod
    def resolve_sqlite_bin() -> str:
        found = shutil.which("sqlite3")
        if found:
            return found
        if Path(SQLITE3_FALLBACK_BIN).exists():
            return SQLITE3_FALLBACK_BIN
        raise FileNotFoundError(
            f"sqlite3 CLI binary not found on PATH or at {SQLITE3_FALLBACK_BIN}"
        )

    @classmethod
    def backup_wal(cls, db_path: Path, dest_path: Path) -> Path:
        if not db_path.exists():
            raise FileNotFoundError(f"SQLite DB not found: {db_path}")
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        sqlite_bin = cls.resolve_sqlite_bin()
        escaped_dest = str(dest_path).replace("'", "''")
        proc = subprocess.run(
            [sqlite_bin, str(db_path), f".backup '{escaped_dest}'"],
            capture_output=True,
            text=True,
            check=False,
        )
        if proc.returncode != 0:
            raise RuntimeError(
                f"sqlite3 WAL .backup failed (rc={proc.returncode}): {proc.stderr.strip()}"
            )
        if not dest_path.exists() or dest_path.stat().st_size == 0:
            raise RuntimeError(f"WAL backup destination missing or empty: {dest_path}")
        return dest_path

    @staticmethod
    def _connect_ro(db_path: Path) -> sqlite3.Connection:
        encoded = urllib.parse.quote(str(db_path.resolve()))
        return sqlite3.connect(f"file:{encoded}?mode=ro", uri=True)

    @classmethod
    def snapshot_counts(cls, db_path: Path) -> dict[str, int]:
        if not db_path.exists():
            return {}
        conn = cls._connect_ro(db_path)
        try:
            cur = conn.cursor()
            existing = {
                row[0]
                for row in cur.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ).fetchall()
            }
            counts: dict[str, int] = {}
            for table in cls.CORE_TABLES:
                if table in existing:
                    row = cur.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()
                    counts[table] = int(row[0]) if row else 0
            residual = 0
            if "prompts" in existing:
                row = cur.execute(
                    "SELECT COUNT(*) FROM prompts WHERE title LIKE '[E2E%'"
                ).fetchone()
                residual += int(row[0]) if row else 0
            if "saved_decks" in existing:
                row = cur.execute(
                    "SELECT COUNT(*) FROM saved_decks WHERE title LIKE '[E2E%'"
                ).fetchone()
                residual += int(row[0]) if row else 0
            counts["residual_e2e_rows"] = residual
            return counts
        finally:
            conn.close()

    @classmethod
    def scan_for_secret(cls, db_path: Path, secret: str) -> list[str]:
        """Scan every table and column in SQLite (read-only) for any occurrence of secret."""
        if not secret or not db_path.exists():
            return []
        hits: list[str] = []
        conn = cls._connect_ro(db_path)
        try:
            cur = conn.cursor()
            tables = [
                row[0]
                for row in cur.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
                ).fetchall()
            ]
            for table in tables:
                safe_table = table.replace('"', '""')
                col_rows = cur.execute(f'PRAGMA table_info("{safe_table}")').fetchall()
                col_names = [r[1] for r in col_rows]
                if not col_names:
                    continue
                for row_idx, row in enumerate(cur.execute(f'SELECT * FROM "{safe_table}"')):
                    for col_name, val in zip(col_names, row):
                        if val is None:
                            continue
                        text_val = (
                            val.decode("utf-8", errors="ignore")
                            if isinstance(val, (bytes, bytearray))
                            else str(val)
                        )
                        if secret in text_val:
                            hits.append(f"{table}[row={row_idx}].{col_name}")
            return hits
        finally:
            conn.close()


# ---------------------------------------------------------------------------
# 8. Test Runner Primitives
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RunConfig:
    base_url: str
    tiers: tuple[int, ...]
    screenshots_dir: Path | None
    json_report: Path | None
    backup_db: bool
    timeout_ms: int
    filter_expr: str | None
    repo_root: Path
    db_path: Path


@dataclass
class TestResult:
    id: str
    tier: int
    name: str
    status: Literal["PASS", "FAIL", "ERROR"]
    duration_ms: float
    error: str | None = None
    traceback: str | None = None
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "tier": self.tier,
            "name": self.name,
            "status": self.status,
            "duration_ms": round(self.duration_ms, 2),
            "error": self.error,
            "details": self.details,
        }


@dataclass(frozen=True)
class TestCaseSpec:
    id: str
    tier: int
    name: str
    tags: tuple[str, ...]
    fn: Callable[["TestContext"], None]


class TestContext:
    """Per-test execution context passed into every Tier 1-4 test function."""

    def __init__(
        self,
        config: RunConfig,
        playwright: PlaywrightSession,
        temp_dir: Path,
    ) -> None:
        self.config = config
        self.playwright = playwright
        self.temp_dir = temp_dir
        self.details: dict[str, Any] = {}

    @property
    def base_url(self) -> str:
        return self.config.base_url

    def url(self, path: str) -> str:
        suffix = path if path.startswith("/") else f"/{path}"
        return f"{self.config.base_url.rstrip('/')}{suffix}"

    def api(self, *, timeout_ms: int | None = None) -> ApiClient:
        return ApiClient(
            self.config.base_url,
            timeout_ms=timeout_ms if timeout_ms is not None else self.config.timeout_ms,
        )

    def api_logged_in(self, email: str, password: str) -> ApiClient:
        client = self.api()
        resp = client.login(email, password)
        resp.assert_status(200, f"api_logged_in({email})")
        return client

    def cleanup(self) -> CleanupRegistry:
        return CleanupRegistry()

    def open_page(
        self,
        *,
        viewport: tuple[int, int] = DESKTOP_VIEWPORT,
        grant_clipboard_origin: str | None = None,
        timeout_ms: int | None = None,
    ) -> contextlib.AbstractContextManager[BrowserPageGuard]:
        return self.playwright.open_page(
            viewport=viewport,
            grant_clipboard_origin=grant_clipboard_origin,
            timeout_ms=timeout_ms,
        )
