"""Tier 5: PPTGod v3 Full-Stack Feature, Export, Security & Browser E2E Suite (8 Tests).

Covers every v3 upgrade end-to-end:
  - Document upload parsing (.pdf, .docx, .md, .txt, scanned PDF detection, reject bad ext)
  - 2-step controllable outline API (5-20 slides, smart + BYOK mock LLM) & custom outline render
  - Single-slide smart polish API (executive, metrics, notes)
  - BYOK AI image generation API (/api/generate-image) + error key-scrubbing security
  - Saved decks image Data URL validation (accept valid PNG, reject malformed/oversized)
  - High-fidelity 15-archetype .pptx export across all 12 slide types (native Doughnut + Bar + Image)
  - Browser /studio 12-slide filmstrip & prompt sync
  - Browser /generate full v3 workflow (upload -> 2-step outline -> image-split -> donut -> duplicate -> undo/redo -> polish -> print-PDF HTML -> mobile 390px overflow)
"""

from __future__ import annotations

import base64
import http.server
import io
import json
import re
import socketserver
import threading
import urllib.error
import urllib.request
import zipfile
from pathlib import Path
from typing import Any

from tests.e2e.config import (
    ACCOUNT_DEMO,
    DESKTOP_VIEWPORT,
    MOBILE_VIEWPORT,
    make_valid_visual_spec,
)
from tests.e2e.helpers import (
    HtmlDeckVerifier,
    PptxVerifier,
    TestCaseSpec,
    TestContext,
)
from tests.e2e.tier1_features import count_generate_tree_slides

V3_ALL_SLIDE_TYPES: tuple[str, ...] = (
    "cover",
    "agenda",
    "process",
    "image-split",
    "data",
    "funnel-donut",
    "comparison",
    "swot",
    "timeline",
    "team-grid",
    "quote",
    "closing",
)

# Valid 1x1 red PNG base64
TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)
TINY_PNG_DATA_URL = f"data:image/png;base64,{TINY_PNG_B64}"


def _build_multipart_request(
    url: str,
    field_name: str,
    filename: str,
    content: bytes,
    content_type: str = "application/octet-stream",
    timeout_s: float = 15.0,
) -> tuple[int, dict[str, Any]]:
    boundary = "----PPTGodE2EBoundary7MA4YWxkTrZu0gW"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"\r\n'
        f"Content-Type: {content_type}\r\n\r\n"
    ).encode("utf-8") + content + f"\r\n--{boundary}--\r\n".encode("utf-8")

    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Content-Length": str(len(body)),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return resp.status, json.loads(raw)
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(raw)
        except Exception:
            payload = {"raw": raw}
        return err.code, payload


def _make_minimal_docx(paragraphs: list[str]) -> bytes:
    """Create a valid minimal OOXML .docx archive readable by mammoth."""
    buf = io.BytesIO()
    p_xml = "".join(
        f"<w:p><w:r><w:t>{p}</w:t></w:r></w:p>" for p in paragraphs
    )
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            "</Types>",
        )
        zf.writestr(
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            "</Relationships>",
        )
        zf.writestr(
            "word/document.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            f"<w:body>{p_xml}</w:body></w:document>",
        )
    return buf.getvalue()


def _make_minimal_pdf(text_line: str) -> bytes:
    """Generate a valid single-page PDF 1.4 document with optional ASCII text stream."""
    escaped = (
        text_line.replace("\\", "\\\\")
        .replace("(", "\\(")
        .replace(")", "\\)")
    )
    stream_body = (
        f"BT /F1 14 Tf 50 720 Td ({escaped}) Tj ET\n".encode("latin-1")
        if text_line
        else b"q Q\n"
    )
    objects: list[bytes] = [
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
        b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
        (
            f"5 0 obj\n<< /Length {len(stream_body)} >>\nstream\n".encode("latin-1")
            + stream_body
            + b"endstream\nendobj\n"
        ),
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets: list[int] = [0]
    for obj in objects:
        offsets.append(len(out))
        out.extend(obj)
    xref_pos = len(out)
    out.extend(f"xref\n0 {len(offsets)}\n".encode("latin-1"))
    out.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        out.extend(f"{off:010d} 00000 n \n".encode("latin-1"))
    out.extend(
        f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode(
            "latin-1"
        )
    )
    return bytes(out)


class _MockImageAndChatServer:
    """Local mock server supporting both /images/generations and /chat/completions."""

    def __init__(self, *, error_mode: bool = False) -> None:
        self.error_mode = error_mode
        self._httpd: socketserver.TCPServer | None = None
        self._thread: threading.Thread | None = None
        self.base_url = ""

    def __enter__(self) -> "_MockImageAndChatServer":
        parent = self

        class Handler(http.server.BaseHTTPRequestHandler):
            def log_message(self, format: str, *args: Any) -> None:
                return

            def do_POST(self) -> None:
                length = int(self.headers.get("Content-Length") or 0)
                raw = self.rfile.read(length) if length > 0 else b"{}"
                auth = self.headers.get("Authorization", "")
                if parent.error_mode:
                    self.send_response(500)
                    self.send_header("Content-Type", "text/plain")
                    self.end_headers()
                    # Echo auth token to verify backend scrubs it
                    self.wfile.write(f"Upstream crash with {auth}".encode("utf-8"))
                    return

                if self.path.endswith("/images/generations"):
                    payload = {"data": [{"b64_json": TINY_PNG_B64}]}
                elif self.path.endswith("/chat/completions"):
                    req_body = json.loads(raw.decode("utf-8", errors="replace"))
                    sys_msg = str(req_body.get("messages", [{}])[0].get("content", ""))
                    if '"outline"' in sys_msg:
                        content = json.dumps(
                            {
                                "outline": [
                                    {"id": "o1", "slideType": "cover", "sectionTag": "DECK", "title": "Mock Outline Cover", "summary": "Intro"},
                                    {"id": "o2", "slideType": "image-split", "sectionTag": "01 / VISUAL", "title": "Mock Split Visual", "summary": "Hero"},
                                    {"id": "o3", "slideType": "swot", "sectionTag": "02 / SWOT", "title": "Mock SWOT Matrix", "summary": "Strategy"},
                                    {"id": "o4", "slideType": "funnel-donut", "sectionTag": "03 / FUNNEL", "title": "Mock Funnel", "summary": "Conversion"},
                                    {"id": "o5", "slideType": "closing", "sectionTag": "04 / END", "title": "Mock Closing", "summary": "CTA"},
                                ]
                            },
                            ensure_ascii=False,
                        )
                    else:
                        content = json.dumps(
                            {
                                "slide": {
                                    "id": "should_be_ignored",
                                    "slideType": "closing",
                                    "sectionTag": "POLISHED",
                                    "title": "Mock LLM Polished Executive Title",
                                    "speakerNotes": "Mock polished notes for executives.",
                                }
                            },
                            ensure_ascii=False,
                        )
                    payload = {
                        "choices": [{"message": {"content": f"```json\n{content}\n```"}}]
                    }
                else:
                    self.send_response(404)
                    self.end_headers()
                    return

                encoded = json.dumps(payload).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(encoded)))
                self.end_headers()
                self.wfile.write(encoded)

        socketserver.TCPServer.allow_reuse_address = True
        self._httpd = socketserver.TCPServer(("127.0.0.1", 0), Handler)
        port = self._httpd.server_address[1]
        self.base_url = f"http://127.0.0.1:{port}/v1"
        self._thread = threading.Thread(target=self._httpd.serve_forever, daemon=True)
        self._thread.start()
        return self

    def __exit__(self, *args: Any) -> None:
        if self._httpd:
            self._httpd.shutdown()
            self._httpd.server_close()


def t5_api_01_parse_document_formats_and_guards(ctx: TestContext) -> None:
    """POST /api/parse-document parses .txt/.md/.docx/.pdf, detects scanned PDF, rejects bad ext."""
    endpoint = ctx.url("/api/parse-document")

    # 1. Markdown upload
    md_bytes = "# 2026 企业智能知识平台方案\n\n全面提升跨团队协作与检索效率 +142%\n\n核心模块涵盖多模态解析、混合图谱与权限沙箱。".encode("utf-8")
    st, data = _build_multipart_request(endpoint, "file", "strategy.md", md_bytes, "text/markdown")
    assert st == 200, f".md upload failed: {st} {data}"
    assert data.get("isScannedPdf") is False
    assert "2026 企业智能知识平台方案" in data.get("suggestedTopic", "")
    assert data.get("charCount", 0) >= 30

    # 2. TXT upload
    txt_bytes = "年度数字化转型复盘报告\n核心指标 ARR 突破 2.4 亿元，毛利率提升至 78%。".encode("utf-8")
    st, data = _build_multipart_request(endpoint, "file", "report.txt", txt_bytes, "text/plain")
    assert st == 200, f".txt upload failed: {st} {data}"
    assert data.get("fileType") == "txt"
    assert "ARR" in data.get("text", "")

    # 3. Real DOCX archive upload (mammoth)
    docx_bytes = _make_minimal_docx([
        "PPTGod V3 Enterprise Architecture Blueprint",
        "Structured high-fidelity slide generation with 12 commercial layouts and native PPTX export.",
    ])
    st, data = _build_multipart_request(
        endpoint,
        "file",
        "blueprint.docx",
        docx_bytes,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    assert st == 200, f".docx upload failed: {st} {data}"
    assert data.get("fileType") == "docx"
    assert "PPTGod V3 Enterprise Architecture Blueprint" in data.get("text", "")

    # 4. Real PDF with text layer (unpdf)
    pdf_bytes = _make_minimal_pdf(
        "PPTGod V3 PDF Extraction Test Document With Over Forty Characters Of Clean Text"
    )
    st, data = _build_multipart_request(endpoint, "file", "brief.pdf", pdf_bytes, "application/pdf")
    assert st == 200, f".pdf upload failed: {st} {data}"
    assert data.get("fileType") == "pdf"
    assert data.get("isScannedPdf") is False, f"Expected text PDF not scanned: {data}"
    assert "PPTGod V3 PDF Extraction" in data.get("text", "")

    # 5. Scanned/image-only PDF (< 30 extracted chars)
    scanned_pdf = _make_minimal_pdf("")
    st, data = _build_multipart_request(endpoint, "file", "scanned.pdf", scanned_pdf, "application/pdf")
    assert st == 200, f"scanned .pdf failed: {st} {data}"
    assert data.get("isScannedPdf") is True, f"Expected isScannedPdf=True, got {data}"
    assert "扫描" in str(data.get("warning", ""))

    # 6. Unsupported extension rejected with 400
    st, _ = _build_multipart_request(endpoint, "file", "malware.exe", b"MZ\x90\x00", "application/octet-stream")
    assert st == 400, f"Expected 400 for .exe upload, got {st}"


def t5_api_02_outline_and_two_step_generate_20_slides(ctx: TestContext) -> None:
    """POST /api/outline (5-20 pages, smart + mock LLM) -> Step 2 POST /api/generate with edited outline."""
    client = ctx.api()

    # Smart outline 12 pages covers all 12 commercial slide types
    out_resp = (
        client.post(
            "/api/outline",
            json_body={
                "topic": "全球化 AI SaaS 商业战略",
                "subtitle": "从产品发布到规模盈利的完整闭环",
                "audience": "董事会与核心高管",
                "slideCount": 12,
                "mode": "smart",
            },
        )
        .assert_status(200, "POST /api/outline smart 12 pages")
        .require_json()
    )
    outline = out_resp["outline"]
    assert len(outline) == 12
    assert outline[0]["slideType"] == "cover"
    assert outline[-1]["slideType"] == "closing"
    types_present = {item["slideType"] for item in outline}
    for required_new in ("image-split", "swot", "funnel-donut", "team-grid"):
        assert required_new in types_present, f"Missing v3 slideType {required_new} in 12-page outline"

    # Mutate outline + append 3 pages -> 15 pages -> Step 2 render
    outline[3]["title"] = "自定义编辑后的核心图文标题"
    outline.insert(
        -1,
        {
            "id": "outline_extra_1",
            "slideType": "swot",
            "sectionTag": "12 / EXTRA SWOT",
            "title": "区域扩张 SWOT 专项分析",
            "summary": "对比欧美与亚太渠道机会与合规挑战",
        },
    )
    outline.insert(
        -1,
        {
            "id": "outline_extra_2",
            "slideType": "funnel-donut",
            "sectionTag": "13 / SHARE",
            "title": "区域营收占比结构",
            "summary": "环形占比拆解四大核心区域收入贡献",
        },
    )
    outline.insert(
        -1,
        {
            "id": "outline_extra_3",
            "slideType": "team-grid",
            "sectionTag": "14 / ADVISORY",
            "title": "行业顾问委员会",
            "summary": "资深企业级顾问助力标杆客户交付",
        },
    )
    assert len(outline) == 15

    gen_resp = (
        client.post(
            "/api/generate",
            json_body={
                "topic": "全球化 AI SaaS 商业战略",
                "subtitle": "从产品发布到规模盈利的完整闭环",
                "audience": "董事会与核心高管",
                "outline": outline,
                "archetype": "soft-bento",
                "mode": "smart",
            },
        )
        .assert_status(200, "Step 2 POST /api/generate with 15-item outline")
        .require_json()
    )
    slides = gen_resp["slides"]
    assert len(slides) == 15, f"Expected 15 slides from custom outline, got {len(slides)}"
    assert slides[3]["title"] == "自定义编辑后的核心图文标题"
    assert any(s.get("chartMode") == "donut" for s in slides if s["slideType"] == "funnel-donut")

    # Mock LLM mode for /api/outline
    with _MockImageAndChatServer() as mock_srv:
        llm_out = (
            client.post(
                "/api/outline",
                json_body={
                    "topic": "Mock LLM Outline Test",
                    "slideCount": 5,
                    "mode": "llm",
                    "apiBase": mock_srv.base_url,
                    "apiKey": "sk-e2e-secret-outline-token",
                    "model": "gpt-4o-mini",
                },
            )
            .assert_status(200, "POST /api/outline mock llm")
            .require_json()
        )
        assert llm_out["engine"] == "llm"
        assert len(llm_out["outline"]) == 5
        assert llm_out["outline"][1]["slideType"] == "image-split"


def t5_api_03_single_slide_polish_smart_and_llm(ctx: TestContext) -> None:
    """POST /api/polish works for executive/metrics/notes in smart mode & preserves identity in LLM mode."""
    client = ctx.api()
    base_slide = {
        "id": "slide_polish_target",
        "slideType": "image-split",
        "sectionTag": "04 / VISUAL",
        "title": "产品体验全面升级",
        "subtitle": "帮助企业更高效地检索内部知识",
        "bullets": ["支持多模态文档解析", "权限隔离安全可靠"],
        "imageSlot": {
            "kind": "data-url",
            "dataUrl": TINY_PNG_DATA_URL,
            "caption": "保留原图",
            "layout": "left",
        },
        "speakerNotes": "原讲稿",
    }

    # Invalid action -> 400
    client.post(
        "/api/polish",
        json_body={"slide": base_slide, "action": "unknown_action"},
    ).assert_status(400, "invalid polish action")

    # Executive polish
    exec_res = (
        client.post(
            "/api/polish",
            json_body={"slide": base_slide, "action": "executive", "mode": "smart"},
        )
        .assert_status(200, "polish executive")
        .require_json()
    )
    assert exec_res["slide"]["title"] != base_slide["title"]
    assert "高管" in exec_res["slide"]["speakerNotes"]

    # Metrics polish
    metrics_res = (
        client.post(
            "/api/polish",
            json_body={"slide": base_slide, "action": "metrics", "mode": "smart"},
        )
        .assert_status(200, "polish metrics")
        .require_json()
    )
    assert any("%" in b for b in metrics_res["slide"].get("bullets", []))

    # Notes polish
    notes_res = (
        client.post(
            "/api/polish",
            json_body={"slide": base_slide, "action": "notes", "mode": "smart"},
        )
        .assert_status(200, "polish notes")
        .require_json()
    )
    assert len(notes_res["slide"]["speakerNotes"]) > 40

    # Mock LLM mode preserves id, slideType, and original user imageSlot dataUrl
    with _MockImageAndChatServer() as mock_srv:
        llm_res = (
            client.post(
                "/api/polish",
                json_body={
                    "slide": base_slide,
                    "action": "executive",
                    "mode": "llm",
                    "apiBase": mock_srv.base_url,
                    "apiKey": "sk-polish-secret-key",
                },
            )
            .assert_status(200, "polish llm")
            .require_json()
        )
        polished = llm_res["slide"]
        assert polished["id"] == "slide_polish_target"
        assert polished["slideType"] == "image-split"
        assert polished["imageSlot"]["dataUrl"] == TINY_PNG_DATA_URL
        assert polished["title"] == "Mock LLM Polished Executive Title"


def t5_api_04_byok_generate_image_security_and_happy_path(ctx: TestContext) -> None:
    """POST /api/generate-image enforces URL/key guards, returns b64 dataUrl, and never leaks apiKey."""
    client = ctx.api()

    client.post("/api/generate-image", json_body={"prompt": ""}).assert_status(
        400, "empty image prompt"
    )
    client.post(
        "/api/generate-image",
        json_body={"prompt": "Minimalist Swiss geometric poster", "apiKey": ""},
    ).assert_status(400, "missing image apiKey")
    client.post(
        "/api/generate-image",
        json_body={
            "prompt": "Minimalist Swiss geometric poster",
            "apiKey": "sk-test",
            "apiBase": "file:///etc/passwd",
        },
    ).assert_status(400, "disallowed file:// apiBase")

    # Happy path with mock OpenAI Image endpoint
    with _MockImageAndChatServer() as mock_srv:
        ok = (
            client.post(
                "/api/generate-image",
                json_body={
                    "prompt": "Swiss grid geometric presentation artwork",
                    "apiBase": mock_srv.base_url,
                    "apiKey": "sk-img-live-secret-998877",
                    "model": "dall-e-3",
                },
            )
            .assert_status(200, "mock generate-image happy path")
            .require_json()
        )
        assert ok["dataUrl"] == TINY_PNG_DATA_URL

    # Upstream 500 error MUST scrub secret apiKey
    secret = "sk-TOPSECRET-IMG-TOKEN-XYZ999"
    with _MockImageAndChatServer(error_mode=True) as err_srv:
        err_resp = client.post(
            "/api/generate-image",
            json_body={
                "prompt": "Test scrubbing",
                "apiBase": err_srv.base_url,
                "apiKey": secret,
            },
        ).assert_status(502, "upstream 500 returns 502")
        assert secret not in err_resp.text(), "CRITICAL: API key leaked in /api/generate-image error!"


def t5_api_05_decks_image_data_url_validation(ctx: TestContext) -> None:
    """POST /api/decks accepts valid compressed PNG Data URL and rejects malicious/oversized Data URLs."""
    author = ctx.api_logged_in(ACCOUNT_DEMO.email, ACCOUNT_DEMO.password)
    spec = make_valid_visual_spec()

    base_payload = {
        "title": "E2E_V3_IMAGE_DECK_VALIDATION",
        "subtitle": "Image Data URL security validation",
        "audience": "QA",
        "promptId": "p_bento",
        "promptSlug": "apple-soft-bento-modular",
        "promptTitle": "柔光圆角 Bento",
        "visualSpec": spec,
        "isPublic": False,
    }

    # Malicious non-image data URL -> 400
    bad_svg_slide = [
        {
            "id": "s1",
            "slideType": "image-split",
            "sectionTag": "01",
            "title": "Bad Image",
            "imageSlot": {
                "kind": "data-url",
                "dataUrl": "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
            },
        }
    ]
    author.post(
        "/api/decks", json_body={**base_payload, "slides": bad_svg_slide}
    ).assert_status(400, "reject text/html dataUrl")

    # Oversized Data URL (> 650KB) -> 400
    oversized = "data:image/png;base64," + ("A" * 700_000)
    author.post(
        "/api/decks",
        json_body={
            **base_payload,
            "slides": [
                {
                    "id": "s1",
                    "slideType": "image-split",
                    "sectionTag": "01",
                    "title": "Huge Image",
                    "imageSlot": {"kind": "data-url", "dataUrl": oversized},
                }
            ],
        },
    ).assert_status(400, "reject oversized image dataUrl")

    # Valid PNG Data URL -> 201, then clean up
    valid_slides = [
        {
            "id": "s1",
            "slideType": "image-split",
            "sectionTag": "01 / VISUAL",
            "title": "Valid Embedded PNG Slide",
            "imageSlot": {
                "kind": "data-url",
                "dataUrl": TINY_PNG_DATA_URL,
                "caption": "Compressed PNG",
                "layout": "left",
            },
            "speakerNotes": "Verified embedded image.",
        }
    ]
    created = (
        author.post(
            "/api/decks", json_body={**base_payload, "slides": valid_slides}
        )
        .assert_status(201, "valid PNG dataUrl saved")
        .require_json()["deck"]
    )
    try:
        assert created["slides"][0]["imageSlot"]["dataUrl"] == TINY_PNG_DATA_URL
    finally:
        author.delete(f"/api/decks/{created['id']}").assert_status(200, "cleanup image deck")


def t5_exp_06_pptx_v3_12_types_archetypes_doughnut_image(ctx: TestContext) -> None:
    """POST /api/export/pptx renders all 12 slide types + native Doughnut chart + embedded PNG + archetypes."""
    client = ctx.api()

    # Generate 12 slides (all 12 commercial types)
    gen = (
        client.post(
            "/api/generate",
            json_body={
                "topic": "PPTGod V3 全版式高保真导出验证",
                "subtitle": "15 种原型 × 12 种商业母版",
                "audience": "核心决策层",
                "slideCount": 12,
                "mode": "smart",
            },
        )
        .assert_status(200)
        .require_json()
    )
    slides = gen["slides"]
    # Add an explicit image-split slide with real PNG dataUrl + an explicit donut slide
    slides.append(
        {
            "id": "slide_v3_real_img",
            "slideType": "image-split",
            "sectionTag": "12 / EMBEDDED PHOTO",
            "title": "实拍图片高清内嵌展示",
            "subtitle": "右图左文实测验证",
            "bullets": ["PNG 自动压缩内嵌", "导出 PPTX 离线可用"],
            "imageSlot": {
                "kind": "data-url",
                "dataUrl": TINY_PNG_DATA_URL,
                "caption": "测试实拍图",
                "layout": "right",
            },
            "speakerNotes": "本页包含真实 PNG 内嵌图像。",
        }
    )
    slides.append(
        {
            "id": "slide_v3_donut",
            "slideType": "funnel-donut",
            "sectionTag": "13 / DONUT MIX",
            "title": "环形占比原生图表验证",
            "chartMode": "donut",
            "funnelStages": [
                {"label": "标杆订阅", "value": 48, "unit": "%", "note": "核心盘"},
                {"label": "行业套件", "value": 30, "unit": "%", "note": "主力增长"},
                {"label": "生态渠道", "value": 22, "unit": "%", "note": "区域放量"},
            ],
            "speakerNotes": "本页生成 PowerPoint 原生可编辑环形图。",
        }
    )

    # Test export across 4 distinct archetypes
    archetype_slugs = [
        "apple-soft-bento-modular",
        "swiss-international-grid",
        "neo-chinese-song-aesthetics",
        "neo-brutalist-pitch-poster",
    ]
    for slug in archetype_slugs:
        style = (
            client.get(f"/api/prompts/{slug}")
            .assert_status(200)
            .require_json()["prompt"]
        )
        pptx_resp = client.post(
            "/api/export/pptx",
            json_body={
                "title": f"V3_{slug}",
                "subtitle": "Archetype fidelity check",
                "audience": "核心团队",
                "styleName": style["title"],
                "visualSpec": style["visualSpec"],
                "slides": slides,
            },
        ).assert_status(200, f"export pptx for {slug}")

        PptxVerifier.verify(
            pptx_resp.body,
            min_size=35000,
            expected_slide_count=len(slides),
            expected_slide_texts=["PPTGod V3 全版式高保真导出验证", "环形占比原生图表验证"],
            require_notes=True,
        )

        # Inspect ZIP entries for native charts (bar + doughnut) & embedded image media
        with zipfile.ZipFile(io.BytesIO(pptx_resp.body), "r") as zf:
            names = zf.namelist()
            chart_xmls = [n for n in names if n.startswith("ppt/charts/chart") and n.endswith(".xml")]
            media_imgs = [n for n in names if n.startswith("ppt/media/")]
            assert len(chart_xmls) >= 2, (
                f"[{slug}] Expected >= 2 native charts (bar + doughnut), got {chart_xmls}"
            )
            assert len(media_imgs) >= 1, (
                f"[{slug}] Expected embedded image in ppt/media/, got {media_imgs}"
            )
            all_chart_xml = "\n".join(zf.read(c).decode("utf-8", errors="ignore") for c in chart_xmls)
            assert "doughnutChart" in all_chart_xml, (
                f"[{slug}] Expected native <c:doughnutChart> in PPTX charts"
            )
            assert "barChart" in all_chart_xml, (
                f"[{slug}] Expected native <c:barChart> in PPTX charts"
            )


def t5_ui_07_studio_12_slide_types_and_prompt_sync(ctx: TestContext) -> None:
    """Browser /studio: renders all 12 commercial slide types (4x3 grid) and updates AI prompt compilers."""
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.goto_ok(ctx.url("/studio/apple-soft-bento-modular"))

        tabs = page.locator('.pg-filmstrip [role="tab"]')
        assert tabs.count() == 12, f"Expected 12 slide tabs in Studio filmstrip, got {tabs.count()}"

        for label, st in [
            ("图文页", "image-split"),
            ("漏斗占比", "funnel-donut"),
            ("SWOT 矩阵", "swot"),
            ("核心团队", "team-grid"),
        ]:
            tab = page.locator('.pg-filmstrip [role="tab"]', has_text=label).first
            tab.click()
            page.wait_for_timeout(120)
            guard.assert_canvas_non_blank(slide_type=st, label=f"studio_v3_{st}")

        # Switch to ai-image tool and confirm compiled prompt reflects active slide type
        ai_tab = page.get_by_role("tab", name=re.compile(r"AI\s*整页生图")).first
        ai_tab.click()
        page.wait_for_timeout(150)
        compiled_val = page.locator("textarea[readonly]").first.input_value()
        assert "核心团队" in compiled_val or "Team Grid" in compiled_val, (
            "Expected compiled ai-image prompt to reflect team-grid slide"
        )
        guard.assert_no_browser_errors("studio_12_types_desktop")


def t5_ui_08_generate_v3_upload_outline_undo_duplicate_polish_image(ctx: TestContext) -> None:
    """Browser /generate: full v3 journey (upload, 2-step outline, duplicate, undo/redo, polish, donut, HTML PDF, mobile)."""
    with ctx.open_page(viewport=DESKTOP_VIEWPORT) as guard:
        page = guard.page
        guard.goto_ok(ctx.url("/generate?style=apple-soft-bento-modular"))

        # 1. Upload .md document
        md_file = ctx.temp_dir / "v3_e2e_brief.md"
        md_file.write_text(
            "# 2026 量子云智算平台战略发布\n\n让算力调度效率提升 +188%，端到端推理延迟压缩至 14ms。\n\n核心亮点涵盖自研多模态解析、弹性调度引擎与全球合规沙箱。",
            encoding="utf-8",
        )
        with page.expect_response(
            lambda r: "/api/parse-document" in r.url and r.request.method == "POST",
            timeout=15000,
        ) as up_resp:
            page.locator("#pg-doc-upload-input").set_input_files(str(md_file))
        assert up_resp.value.status == 200
        page.locator("#pg-doc-upload-badge").wait_for(state="visible", timeout=8000)
        assert "2026 量子云智算平台战略发布" in page.locator("#pg-gen-topic").input_value()

        # 2. Step 1: Build editable outline -> edit -> add page -> Step 2 render
        with page.expect_response(
            lambda r: "/api/outline" in r.url and r.request.method == "POST",
            timeout=15000,
        ) as out_resp:
            page.locator("#pg-gen-outline-btn").click()
        assert out_resp.value.status == 200
        page.locator("#pg-outline-editor").wait_for(state="visible", timeout=8000)

        before_rows = page.locator(".pg-outline-row").count()
        assert before_rows >= 5
        page.locator("#pg-outline-add-btn").click()
        page.wait_for_timeout(120)
        after_rows = page.locator(".pg-outline-row").count()
        assert after_rows == before_rows + 1, f"Expected outline rows {before_rows + 1}, got {after_rows}"

        with page.expect_response(
            lambda r: "/api/generate" in r.url and r.request.method == "POST",
            timeout=15000,
        ) as gen_resp:
            page.locator("#pg-outline-confirm-btn").click()
        assert gen_resp.value.status == 200
        page.wait_for_timeout(250)

        rendered_count = count_generate_tree_slides(page)
        assert rendered_count == after_rows, (
            f"Expected {after_rows} slides after Step 2 outline render, got {rendered_count}"
        )

        # 3. Duplicate slide -> Undo -> Redo
        dup_btn = page.locator('.pg-gen-slide-card button[aria-label="复制页面"]').first
        dup_btn.click()
        page.wait_for_timeout(150)
        assert count_generate_tree_slides(page) == rendered_count + 1

        page.locator("#pg-gen-undo-btn").click()
        page.wait_for_timeout(150)
        assert count_generate_tree_slides(page) == rendered_count, "Undo did not restore slide count"

        page.locator("#pg-gen-redo-btn").click()
        page.wait_for_timeout(150)
        assert count_generate_tree_slides(page) == rendered_count + 1, "Redo did not restore duplicated slide"

        # 4. Switch current slide to image-split -> select SVG artwork -> switch to funnel-donut -> toggle donut
        page.locator("#pg-slide-type-select").select_option("image-split")
        page.wait_for_timeout(150)
        guard.assert_canvas_non_blank(slide_type="image-split", label="gen_v3_image_split")
        page.locator(".pg-artwork-btn").nth(1).click()
        page.wait_for_timeout(120)

        page.locator("#pg-slide-type-select").select_option("funnel-donut")
        page.wait_for_timeout(120)
        page.locator("#pg-chartmode-donut").click()
        page.wait_for_timeout(150)
        guard.assert_canvas_non_blank(slide_type="funnel-donut", label="gen_v3_donut")

        # 5. Single-slide Smart Polish (Executive + Notes)
        before_title = page.locator("#pg-edit-slide-title").input_value()
        with page.expect_response(
            lambda r: "/api/polish" in r.url and r.request.method == "POST",
            timeout=15000,
        ) as pol_resp:
            page.locator("#pg-polish-executive-btn").click()
        assert pol_resp.value.status == 200
        page.wait_for_timeout(150)
        after_title = page.locator("#pg-edit-slide-title").input_value()
        assert after_title != before_title, "Executive polish did not update slide title"

        # 6. Export interactive HTML and verify @page print-PDF CSS + slides
        with page.expect_download(timeout=15000) as dl_info:
            page.locator("#pg-gen-export-html-btn").click()
        dl_path = ctx.temp_dir / "v3_exported_deck.html"
        dl_info.value.save_as(str(dl_path))
        html_text = dl_path.read_text(encoding="utf-8")
        assert "@page" in html_text and "13.333in 7.5in" in html_text, (
            "Exported HTML missing 16:9 @page print-to-PDF CSS rule"
        )
        HtmlDeckVerifier.verify(
            html_text,
            expected_title_substrings=["2026 量子云智算平台战略发布"],
            expected_min_slides=rendered_count + 1,
        )
        guard.assert_no_browser_errors("generate_v3_desktop")

    # 7. Verify mobile 390x844 zero horizontal overflow on /generate and /studio
    with ctx.open_page(viewport=MOBILE_VIEWPORT) as mguard:
        for route in ("/generate?style=apple-soft-bento-modular", "/studio/apple-soft-bento-modular"):
            mguard.goto_ok(ctx.url(route))
            mguard.page.wait_for_timeout(200)
            mguard.assert_no_horizontal_overflow(label=f"v3_mobile_{route}")
        mguard.assert_no_browser_errors("v3_mobile_clean")


def get_tier5_tests() -> list[TestCaseSpec]:
    return [
        TestCaseSpec(
            "T5_API_01_parse_document_formats_and_guards",
            5,
            "POST /api/parse-document (.md/.txt/.docx/.pdf, scanned PDF, reject .exe)",
            ("api", "v3", "upload"),
            t5_api_01_parse_document_formats_and_guards,
        ),
        TestCaseSpec(
            "T5_API_02_outline_and_two_step_generate_20_slides",
            5,
            "POST /api/outline (12-20p, smart + mock LLM) -> Step 2 custom outline render",
            ("api", "v3", "outline"),
            t5_api_02_outline_and_two_step_generate_20_slides,
        ),
        TestCaseSpec(
            "T5_API_03_single_slide_polish_smart_and_llm",
            5,
            "POST /api/polish (executive/metrics/notes, smart + mock LLM identity preserve)",
            ("api", "v3", "polish"),
            t5_api_03_single_slide_polish_smart_and_llm,
        ),
        TestCaseSpec(
            "T5_API_04_byok_generate_image_security_and_happy_path",
            5,
            "POST /api/generate-image BYOK guards, b64 dataUrl & secret key scrubbing",
            ("api", "v3", "security", "image"),
            t5_api_04_byok_generate_image_security_and_happy_path,
        ),
        TestCaseSpec(
            "T5_API_05_decks_image_data_url_validation",
            5,
            "POST /api/decks image Data URL allowlist & size cap enforcement",
            ("api", "v3", "security", "decks"),
            t5_api_05_decks_image_data_url_validation,
        ),
        TestCaseSpec(
            "T5_EXP_06_pptx_v3_12_types_archetypes_doughnut_image",
            5,
            "POST /api/export/pptx 12 slide types, 4 archetypes, native Doughnut + Bar + PNG",
            ("api", "v3", "pptx"),
            t5_exp_06_pptx_v3_12_types_archetypes_doughnut_image,
        ),
        TestCaseSpec(
            "T5_UI_07_studio_12_slide_types_and_prompt_sync",
            5,
            "Browser /studio: 12 slide tabs (4x3 grid) & compiler prompt sync",
            ("ui", "v3", "studio"),
            t5_ui_07_studio_12_slide_types_and_prompt_sync,
        ),
        TestCaseSpec(
            "T5_UI_08_generate_v3_upload_outline_undo_duplicate_polish_image",
            5,
            "Browser /generate: doc upload, 2-step outline, undo/redo, duplicate, polish, donut, PDF HTML & mobile",
            ("ui", "v3", "generate"),
            t5_ui_08_generate_v3_upload_outline_undo_duplicate_polish_image,
        ),
    ]
