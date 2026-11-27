import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { extractText } from "unpdf";
import { listPrompts } from "@/lib/db";
import { analyzeDocumentAndRecommendStyles } from "@/lib/documentAnalyzer";
import { parsePptxBuffer } from "@/lib/pptxParser";
import { parseCsvBuffer, parseXlsxBuffer } from "@/lib/spreadsheetParser";
import { limitToolRequest } from "@/lib/toolRateLimit";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
// Leave room to receive moderate oversize uploads and return the file-size message.
const MAX_MULTIPART_BYTES = MAX_UPLOAD_BYTES + 1024 * 1024;
const ALLOWED_EXTS = new Set(["pdf", "docx", "pptx", "xlsx", "csv", "md", "txt"]);

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  if (idx === -1) return "";
  return fileName.slice(idx + 1).trim().toLowerCase();
}

function cleanExtractedText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractTitleHints(
  text: string,
  fileName: string
): { suggestedTopic: string; suggestedSubtitle: string } {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/^#+\s*/, "").replace(/^[\-\*•\s]+/, "").trim())
    .filter((l) => l.length >= 2);

  const fallbackName = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();

  const first = lines[0] || fallbackName || "文档智能解析演示文稿";
  const suggestedTopic = first.slice(0, 48);
  const second = lines.find((l, idx) => idx > 0 && l.length >= 6 && l !== first);
  const suggestedSubtitle = second
    ? second.slice(0, 72)
    : "基于源文档自动提炼的结构化商业演示方案";

  return { suggestedTopic, suggestedSubtitle };
}

export async function POST(request: Request) {
  const limited = await limitToolRequest(request, "parse-document", 40);
  if (limited) return limited;

  const tooLarge = () => NextResponse.json(
    { error: "文档体积超过 10MB 上限，请精简后再上传" },
    { status: 400 },
  );
  if (Number(request.headers.get("content-length")) > MAX_MULTIPART_BYTES) {
    return tooLarge();
  }

  let totalBytes = 0;
  let sizeExceeded = false;
  const boundedBody = request.body?.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      totalBytes += chunk.byteLength;
      if (totalBytes > MAX_MULTIPART_BYTES) {
        sizeExceeded = true;
        controller.error(new Error("Upload exceeds request limit"));
        return;
      }
      controller.enqueue(chunk);
    },
  }));

  let formData: FormData;
  try {
    formData = await new Response(boundedBody, { headers: request.headers }).formData();
  } catch {
    if (sizeExceeded) return tooLarge();
    return NextResponse.json(
      { error: "请使用 multipart/form-data 上传文档文件（字段名 file）" },
      { status: 400 }
    );
  }

  const fileEntry = formData.get("file");
  if (!fileEntry || !(fileEntry instanceof File)) {
    return NextResponse.json(
      { error: "未检测到上传文件，请选择 .pdf / .docx / .pptx / .xlsx / .csv / .md / .txt 文件" },
      { status: 400 }
    );
  }

  const fileName = (fileEntry.name || "document.txt").slice(0, 180);
  const ext = getExtension(fileName);

  if (ext === "doc") {
    return NextResponse.json(
      {
        error:
          "检测到旧版二进制 .doc 格式，请先在 Word / WPS 中另存为标准 .docx 格式后再上传",
      },
      { status: 400 }
    );
  }

  if (ext === "xls") {
    return NextResponse.json(
      {
        error:
          "检测到旧版二进制 .xls 格式，请先在 Excel / WPS 中另存为标准 .xlsx 或 .csv 格式后再上传",
      },
      { status: 400 }
    );
  }

  if (!ALLOWED_EXTS.has(ext)) {
    return NextResponse.json(
      {
        error: `不支持的文件类型「.${ext || "未知"}」，仅支持上传 .pdf、.docx、.pptx、.xlsx、.csv、.md、.txt 文档`,
      },
      { status: 400 }
    );
  }

  if (fileEntry.size <= 0) {
    return NextResponse.json(
      { error: "上传的文档内容为空，请选择有效文件" },
      { status: 400 }
    );
  }

  if (fileEntry.size > MAX_UPLOAD_BYTES) {
    return tooLarge();
  }

  try {
    const arrayBuffer = await fileEntry.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    const catalogStyles = await listPrompts({});

    if (ext === "xlsx" || ext === "csv") {
      try {
        const parsed =
          ext === "xlsx"
            ? parseXlsxBuffer(uint8, fileName)
            : parseCsvBuffer(uint8, fileName);
        const analysis = analyzeDocumentAndRecommendStyles({
          text: parsed.textDigest,
          fileName,
          fileType: ext,
          suggestedTopic: parsed.suggestedTopic,
          suggestedSubtitle: parsed.suggestedSubtitle,
          styles: catalogStyles,
        });
        return NextResponse.json({
          ok: true,
          fileName,
          fileType: ext,
          charCount: parsed.textDigest.length,
          sheetCount: parsed.tables.length,
          tables: parsed.tables,
          isScannedPdf: false,
          warning: parsed.warning,
          text: parsed.textDigest,
          suggestedTopic: parsed.suggestedTopic,
          suggestedSubtitle: parsed.suggestedSubtitle,
          analysis,
        });
      } catch (err) {
        return NextResponse.json(
          {
            error:
              err instanceof Error
                ? err.message
                : "数据表解析失败，请确认文件为已整理好的汇总表（≤30 行）",
          },
          { status: 400 }
        );
      }
    }

    if (ext === "pptx") {
      try {
        const parsed = parsePptxBuffer(uint8);
        const analysis = analyzeDocumentAndRecommendStyles({
          text: parsed.text,
          fileName,
          fileType: "pptx",
          suggestedTopic: parsed.suggestedTopic,
          suggestedSubtitle: parsed.suggestedSubtitle,
          styles: catalogStyles,
        });
        return NextResponse.json({
          ok: true,
          fileName,
          fileType: "pptx",
          charCount: parsed.text.length,
          slideCount: parsed.slideCount,
          isScannedPdf: false,
          text: parsed.text,
          suggestedTopic: parsed.suggestedTopic,
          suggestedSubtitle: parsed.suggestedSubtitle,
          parsedOutline: parsed.parsedOutline,
          analysis,
        });
      } catch (err) {
        return NextResponse.json(
          {
            error:
              err instanceof Error
                ? `PPTX 文件解析失败：${err.message}`
                : "PPTX 文件解析失败，请确认文件为标准 .pptx 演示文稿",
          },
          { status: 400 }
        );
      }
    }

    let rawText = "";

    if (ext === "txt" || ext === "md") {
      rawText = new TextDecoder("utf-8", { fatal: false }).decode(uint8);
    } else if (ext === "docx") {
      try {
        const result = await mammoth.extractRawText({
          buffer: Buffer.from(uint8),
        });
        rawText = result.value || "";
      } catch {
        return NextResponse.json(
          { error: "DOCX 文件解析失败，请确认文件未损坏且为标准 Word 文档" },
          { status: 400 }
        );
      }
    } else if (ext === "pdf") {
      try {
        const pdfResult = await extractText(uint8, { mergePages: true });
        rawText = Array.isArray(pdfResult.text)
          ? pdfResult.text.join("\n")
          : String(pdfResult.text || "");
      } catch {
        return NextResponse.json(
          {
            error:
              "PDF 文件解析失败，请确认文件未损坏、未加密，或改用 .docx / .pptx / .md / .txt 文档",
          },
          { status: 400 }
        );
      }
    }

    const cleanText = cleanExtractedText(rawText);
    const nonSpaceChars = cleanText.replace(/\s+/g, "").length;
    const isScannedPdf = ext === "pdf" && nonSpaceChars < 30;
    const { suggestedTopic, suggestedSubtitle } = extractTitleHints(
      cleanText,
      fileName
    );
    const analysis = analyzeDocumentAndRecommendStyles({
      text: cleanText.slice(0, 16000),
      fileName,
      fileType: ext,
      suggestedTopic,
      suggestedSubtitle,
      styles: catalogStyles,
    });

    return NextResponse.json({
      ok: true,
      fileName,
      fileType: ext,
      charCount: cleanText.length,
      isScannedPdf,
      warning: isScannedPdf
        ? "检测到该 PDF 可能是纯图片扫描件或文字层极少（有效文字不足 30 字）。建议先使用本地 OCR / 飞书文档提取文字后粘贴，或直接上传 .docx / .pptx / .md / .txt 文档。"
        : undefined,
      text: cleanText.slice(0, 16000),
      suggestedTopic,
      suggestedSubtitle,
      analysis,
    });
  } catch (err) {
    console.error(
      "Parse document API error:",
      err instanceof Error ? err.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "文档解析过程中发生异常，请稍后重试" },
      { status: 500 }
    );
  }
}
