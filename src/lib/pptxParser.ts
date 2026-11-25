import { inflateRawSync } from "zlib";
import type { OutlineDraftItem, SlideType } from "@/types/prompt";

const MAX_ZIP_ENTRIES = 350;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 15 * 1024 * 1024; // 15 MB zip-bomb cap
const MAX_SINGLE_ENTRY_BYTES = 2 * 1024 * 1024;

interface ZipEntryRecord {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

function readZipDirectory(buf: Buffer): ZipEntryRecord[] {
  // Locate End of Central Directory signature 0x06054b50 from tail (max comment 65535 bytes)
  const minOffset = Math.max(0, buf.length - 65557);
  let eocdPos = -1;
  for (let i = buf.length - 22; i >= minOffset; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdPos = i;
      break;
    }
  }
  if (eocdPos === -1) {
    throw new Error("不是合法的 ZIP / PPTX 压缩归档");
  }

  const totalEntries = buf.readUInt16LE(eocdPos + 10);
  const cdSize = buf.readUInt32LE(eocdPos + 12);
  const cdOffset = buf.readUInt32LE(eocdPos + 16);

  if (totalEntries === 0 || totalEntries > MAX_ZIP_ENTRIES) {
    throw new Error("PPTX 内部条目数量超出安全解析上限");
  }
  if (cdOffset + cdSize > buf.length) {
    throw new Error("PPTX 中央目录索引损坏");
  }

  const entries: ZipEntryRecord[] = [];
  let cursor = cdOffset;
  for (let idx = 0; idx < totalEntries; idx++) {
    if (cursor + 46 > buf.length || buf.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error("PPTX 目录项签名异常");
    }
    const compressionMethod = buf.readUInt16LE(cursor + 10);
    const compressedSize = buf.readUInt32LE(cursor + 20);
    const uncompressedSize = buf.readUInt32LE(cursor + 24);
    const nameLen = buf.readUInt16LE(cursor + 28);
    const extraLen = buf.readUInt16LE(cursor + 30);
    const commentLen = buf.readUInt16LE(cursor + 32);
    const localHeaderOffset = buf.readUInt32LE(cursor + 42);

    const nameEnd = cursor + 46 + nameLen;
    if (nameEnd > buf.length) {
      throw new Error("PPTX 文件名读取越界");
    }
    const name = buf.toString("utf8", cursor + 46, nameEnd);
    entries.push({
      name,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
    cursor = nameEnd + extraLen + commentLen;
  }

  return entries;
}

function extractEntryText(
  buf: Buffer,
  entry: ZipEntryRecord,
  budget: { remaining: number }
): string {
  if (
    entry.uncompressedSize > MAX_SINGLE_ENTRY_BYTES ||
    entry.uncompressedSize > budget.remaining
  ) {
    throw new Error("PPTX 解压后体积超过安全上限，已中止解析");
  }

  const off = entry.localHeaderOffset;
  if (off + 30 > buf.length || buf.readUInt32LE(off) !== 0x04034b50) {
    throw new Error("PPTX 本地文件头损坏");
  }
  const nameLen = buf.readUInt16LE(off + 26);
  const extraLen = buf.readUInt16LE(off + 28);
  const dataStart = off + 30 + nameLen + extraLen;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > buf.length) {
    throw new Error("PPTX 数据块读取越界");
  }

  const rawSlice = buf.subarray(dataStart, dataEnd);
  let out: Buffer;
  if (entry.compressionMethod === 0) {
    out = rawSlice;
  } else if (entry.compressionMethod === 8) {
    out = inflateRawSync(rawSlice, { maxOutputLength: MAX_SINGLE_ENTRY_BYTES });
  } else {
    return "";
  }

  budget.remaining -= out.length;
  if (budget.remaining < 0) {
    throw new Error("PPTX 解压总大小超过 15MB 安全上限");
  }
  return out.toString("utf8");
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => {
      const code = Number(num);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : "";
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : "";
    });
}

interface ExtractedParagraph {
  text: string;
  fontSize: number;
}

function extractParagraphsFromSlideXml(xml: string): ExtractedParagraph[] {
  const paragraphs: ExtractedParagraph[] = [];
  const pMatches = xml.match(/<a:p\b[\s\S]*?<\/a:p>/g) || [];
  for (const pXml of pMatches) {
    const runs = Array.from(pXml.matchAll(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g)).map(
      (m) => decodeXmlEntities(m[1])
    );
    const line = runs.join("").replace(/\s+/g, " ").trim();
    if (line.length > 0) {
      let maxSz = 0;
      for (const szMatch of pXml.matchAll(/<a:rPr\b[^>]*\bsz="(\d+)"/g)) {
        const val = Number(szMatch[1]);
        if (Number.isFinite(val) && val > maxSz) maxSz = val;
      }
      paragraphs.push({ text: line, fontSize: maxSz });
    }
  }
  return paragraphs;
}

function isDecorativeBadgeLine(line: string): boolean {
  const t = line.trim();
  if (t.length <= 2) return true;
  if (/^\d{1,3}$/.test(t)) return true;
  if (/^P?\d{1,2}\s*\/\s*\d{1,2}$/i.test(t)) return true;
  if (/^\d{1,2}\s*\/\s*[A-Z0-9\s_-]{2,20}$/.test(t)) return true;
  return false;
}

function inferSlideType(
  title: string,
  bodyText: string,
  index: number,
  total: number
): SlideType {
  if (index === 0) return "cover";
  if (index === total - 1 && total > 1) return "closing";
  const combined = `${title} ${bodyText}`;
  if (/目录|议程|agenda|contents|提纲/i.test(combined)) return "agenda";
  if (/swot|优势.*劣势|机会.*威胁/i.test(combined)) return "swot";
  if (/团队|成员|核心班底|创始人|team|leadership/i.test(combined))
    return "team-grid";
  if (/漏斗|转化率|占比|结构分布|funnel|donut|饼图/i.test(combined))
    return "funnel-donut";
  if (/对比|vs\.?|传统.*升级|优劣|comparison|matrix/i.test(combined))
    return "comparison";
  if (/路线图|里程碑|排期|阶段|q1.*q2|phase|roadmap|timeline/i.test(combined))
    return "timeline";
  if (/架构|流程|三步|方法论|architecture|process|workflow/i.test(combined))
    return "process";
  if (/金句|洞察|愿景|理念|quote|insight|“[^”]{8,}”/i.test(combined))
    return "quote";
  if (/\d+(?:\.\d+)?%|同比|环比|arr|roi|kpi|营收|指标/i.test(combined))
    return "data";
  return index % 2 === 0 ? "image-split" : "process";
}

export interface ParsedPptxResult {
  text: string;
  slideCount: number;
  suggestedTopic: string;
  suggestedSubtitle: string;
  parsedOutline: OutlineDraftItem[];
}

/**
 * Parses an existing .pptx OOXML archive in-memory to extract per-slide titles,
 * body points, and speaker notes, mapping them into an editable OutlineDraftItem[]
 * for one-click PPTGod redesign and re-skinning.
 */
export function parsePptxBuffer(uint8: Uint8Array): ParsedPptxResult {
  const buf = Buffer.from(uint8);
  const entries = readZipDirectory(buf);
  const budget = { remaining: MAX_TOTAL_UNCOMPRESSED_BYTES };

  const slideEntries = entries
    .map((e) => {
      const m = e.name.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
      return m ? { num: Number(m[1]), entry: e } : null;
    })
    .filter((x): x is { num: number; entry: ZipEntryRecord } => x !== null)
    .sort((a, b) => a.num - b.num);

  if (slideEntries.length === 0) {
    throw new Error("未在该 .pptx 文件中检测到有效幻灯片页面（ppt/slides/slide*.xml）");
  }

  const notesByNum = new Map<number, string>();
  for (const e of entries) {
    const m = e.name.match(/^ppt\/notesSlides\/notesSlide(\d+)\.xml$/i);
    if (m) {
      const xml = extractEntryText(buf, e, budget);
      const paras = extractParagraphsFromSlideXml(xml)
        .map((p) => p.text)
        .filter((line) => !/^\d+$/.test(line));
      if (paras.length > 0) {
        notesByNum.set(Number(m[1]), paras.join(" "));
      }
    }
  }

  const cappedSlides = slideEntries.slice(0, 20);
  const total = cappedSlides.length;
  const textBlocks: string[] = [];
  const parsedOutline: OutlineDraftItem[] = [];

  cappedSlides.forEach(({ num, entry }, idx) => {
    const xml = extractEntryText(buf, entry, budget);
    const paras = extractParagraphsFromSlideXml(xml);
    // Filter out tiny numeric page-footer markers like "01", "01 / 08"
    const meaningful = paras.filter(
      (p) => p.text.length >= 2 && !/^\d{1,2}\s*\/\s*\d{1,2}$/.test(p.text)
    );

    // Choose the headline: largest font-size non-decorative paragraph (preferring >= 4 chars)
    const candidates = meaningful.filter((p) => !isDecorativeBadgeLine(p.text));
    let titleIdx = -1;
    if (candidates.length > 0) {
      let best = candidates[0];
      for (const cand of candidates) {
        if (cand.fontSize > best.fontSize && cand.text.length <= 90) {
          best = cand;
        }
      }
      titleIdx = meaningful.indexOf(best);
    } else if (meaningful.length > 0) {
      titleIdx = 0;
    }

    const rawTitle =
      titleIdx >= 0 ? meaningful[titleIdx].text : `第 ${idx + 1} 页核心内容`;
    const bodyLines = meaningful
      .filter((_, i) => i !== titleIdx)
      .map((p) => p.text)
      .filter((t) => !isDecorativeBadgeLine(t));
    const noteText = notesByNum.get(num) || "";
    const summaryRaw =
      bodyLines.slice(0, 3).join("；") || noteText || "基于导入原课件自动提炼";
    const slideType = inferSlideType(rawTitle, summaryRaw, idx, total);

    parsedOutline.push({
      id: `pptx_import_${idx + 1}`,
      slideType,
      sectionTag:
        idx === 0
          ? "IMPORTED DECK"
          : `${String(idx).padStart(2, "0")} / ${slideType.toUpperCase()}`,
      title: rawTitle.slice(0, 48),
      summary: summaryRaw.slice(0, 120),
    });

    const blockLines = [`[第 ${idx + 1} 页] ${rawTitle}`];
    if (bodyLines.length > 0) blockLines.push(bodyLines.join("\n"));
    if (noteText) blockLines.push(`备注：${noteText}`);
    textBlocks.push(blockLines.join("\n"));
  });

  const first = parsedOutline[0];
  const suggestedTopic = first?.title || "导入课件焕新重排方案";
  const suggestedSubtitle =
    first?.summary && first.summary !== "基于导入原课件自动提炼"
      ? first.summary.slice(0, 72)
      : "基于存量 .pptx 课件智能提取并重塑视觉设计系统";

  return {
    text: textBlocks.join("\n\n").slice(0, 16000),
    slideCount: slideEntries.length,
    suggestedTopic,
    suggestedSubtitle,
    parsedOutline,
  };
}
