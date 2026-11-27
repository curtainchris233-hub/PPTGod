import { inflateRawSync } from "zlib";
import type { ChartVariant } from "@/types/prompt";

const MAX_ZIP_ENTRIES = 400;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 15 * 1024 * 1024; // 15 MB zip-bomb cap
const MAX_SINGLE_ENTRY_BYTES = 4 * 1024 * 1024;

export const MAX_TABLE_DATA_ROWS = 30;
export const MAX_TABLE_COLS = 10;

export type DataTableMode = "chart" | "table";

export interface ParsedTableSeries {
  name: string;
  values: number[];
  unit: string;
}

export interface ParsedDataTable {
  id: string;
  fileName: string;
  sheetName: string;
  rowCount: number;
  colCount: number;
  headers: string[];
  rows: string[][];
  mode: DataTableMode;
  inferredChartVariant: ChartVariant;
  categories: string[];
  series: ParsedTableSeries[];
  /** [rowIdx, colIdx] (0-indexed into `rows` and `headers`) of optimal cell per numeric column */
  highlightCoords: [number, number][];
  summaryLine: string;
}

export interface SpreadsheetParseResult {
  tables: ParsedDataTable[];
  textDigest: string;
  suggestedTopic: string;
  suggestedSubtitle: string;
  warning?: string;
}

interface ZipEntryRecord {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

function readZipDirectory(buf: Buffer): ZipEntryRecord[] {
  const minOffset = Math.max(0, buf.length - 65557);
  let eocdPos = -1;
  for (let i = buf.length - 22; i >= minOffset; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdPos = i;
      break;
    }
  }
  if (eocdPos === -1) {
    throw new Error("不是合法的 .xlsx 压缩归档（如为旧版 .xls 请先另存为 .xlsx）");
  }

  const totalEntries = buf.readUInt16LE(eocdPos + 10);
  const cdSize = buf.readUInt32LE(eocdPos + 12);
  const cdOffset = buf.readUInt32LE(eocdPos + 16);

  if (totalEntries === 0 || totalEntries > MAX_ZIP_ENTRIES) {
    throw new Error("Excel 内部条目数量超出安全解析上限");
  }
  if (cdOffset + cdSize > buf.length) {
    throw new Error("Excel 中央目录索引损坏");
  }

  const entries: ZipEntryRecord[] = [];
  let cursor = cdOffset;
  for (let idx = 0; idx < totalEntries; idx++) {
    if (cursor + 46 > buf.length || buf.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error("Excel 目录项签名异常");
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
      throw new Error("Excel 文件名读取越界");
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
    throw new Error("Excel 解压后体积超过安全上限，请仅上传汇总数据表");
  }

  const off = entry.localHeaderOffset;
  if (off + 30 > buf.length || buf.readUInt32LE(off) !== 0x04034b50) {
    throw new Error("Excel 本地文件头损坏");
  }
  const nameLen = buf.readUInt16LE(off + 26);
  const extraLen = buf.readUInt16LE(off + 28);
  const dataStart = off + 30 + nameLen + extraLen;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > buf.length) {
    throw new Error("Excel 数据块读取越界");
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
    throw new Error("Excel 解压总大小超过 15MB 安全上限");
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

function getAttr(tagOpen: string, attrName: string): string {
  const re = new RegExp(`\\b${attrName}\\s*=\\s*"([^"]*)"`, "i");
  const m = tagOpen.match(re);
  if (m) return decodeXmlEntities(m[1]);
  const reSingle = new RegExp(`\\b${attrName}\\s*=\\s*'([^']*)'`, "i");
  const m2 = tagOpen.match(reSingle);
  return m2 ? decodeXmlEntities(m2[1]) : "";
}

function colLettersToIndex(cellRef: string): number {
  const m = cellRef.match(/^([A-Za-z]+)/);
  if (!m) return -1;
  const letters = m[1].toUpperCase();
  let idx = 0;
  for (let i = 0; i < letters.length; i++) {
    idx = idx * 26 + (letters.charCodeAt(i) - 64);
  }
  return idx - 1;
}

function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  const siMatches = xml.match(/<(?:\w+:)?si\b[\s\S]*?<\/(?:\w+:)?si>/g) || [];
  for (const si of siMatches) {
    // Strip phonetic runs <rPh>...</rPh> so East Asian phonetic hints don't duplicate cell text
    const cleaned = si.replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, "");
    const runs = Array.from(
      cleaned.matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)
    ).map((m) => decodeXmlEntities(m[1]));
    strings.push(runs.join("").replace(/\s+/g, " ").trim());
  }
  return strings;
}

/** Detect which cellXfs style indices correspond to percentage number formats */
function parsePercentStyleIndices(stylesXml: string): Set<number> {
  const pctNumFmtIds = new Set<number>([9, 10]); // Built-in Excel 0% and 0.00%
  for (const m of stylesXml.matchAll(/<(?:\w+:)?numFmt\b([^>]*)\/?>/g)) {
    const attrs = m[1];
    const id = Number(getAttr(attrs, "numFmtId"));
    const code = getAttr(attrs, "formatCode");
    if (Number.isFinite(id) && code.includes("%")) {
      pctNumFmtIds.add(id);
    }
  }
  const pctXfIndices = new Set<number>();
  const cellXfsBlock = stylesXml.match(/<(?:\w+:)?cellXfs\b[^>]*>([\s\S]*?)<\/(?:\w+:)?cellXfs>/);
  if (cellXfsBlock) {
    let idx = 0;
    for (const xf of cellXfsBlock[1].matchAll(/<(?:\w+:)?xf\b([^>]*)(?:\/>|>[\s\S]*?<\/(?:\w+:)?xf>)/g)) {
      const fmtId = Number(getAttr(xf[1], "numFmtId"));
      if (pctNumFmtIds.has(fmtId)) {
        pctXfIndices.add(idx);
      }
      idx++;
    }
  }
  return pctXfIndices;
}

function formatCleanNumericCell(rawVal: string, isPercentStyle: boolean): string {
  const n = Number(rawVal);
  if (!Number.isFinite(n)) return rawVal.trim();
  if (isPercentStyle) {
    const pct = Number((n * 100).toPrecision(10));
    const rounded = Math.round(pct * 100) / 100;
    return `${rounded}%`;
  }
  // Eliminate IEEE-754 tail artifacts such as 12.300000000000001
  const clean = Number(n.toPrecision(12));
  return String(clean);
}

function parseWorksheetGrid(
  xml: string,
  sharedStrings: string[],
  pctStyles: Set<number>
): string[][] {
  const rows: string[][] = [];
  const rowMatches = xml.match(/<(?:\w+:)?row\b[\s\S]*?<\/(?:\w+:)?row>/g) || [];
  for (const rowXml of rowMatches) {
    const rowCells: string[] = [];
    let nextCol = 0;
    const cellRegex = /<(?:\w+:)?c\b([^>]*)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g;
    for (const cMatch of rowXml.matchAll(cellRegex)) {
      const attrs = cMatch[1] || "";
      const inner = cMatch[2] || "";
      const ref = getAttr(attrs, "r");
      const parsedCol = ref ? colLettersToIndex(ref) : -1;
      const colIdx = parsedCol >= 0 ? parsedCol : nextCol;
      nextCol = colIdx + 1;
      if (colIdx > 40) continue; // Ignore stray far-right notes beyond column AO

      const cellType = getAttr(attrs, "t");
      const styleIdx = Number(getAttr(attrs, "s"));
      let val = "";

      if (cellType === "inlineStr") {
        const tRuns = Array.from(
          inner.matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)
        ).map((m) => decodeXmlEntities(m[1]));
        val = tRuns.join("").replace(/\s+/g, " ").trim();
      } else {
        const vMatch = inner.match(/<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/);
        const rawV = vMatch ? decodeXmlEntities(vMatch[1]).trim() : "";
        if (cellType === "s") {
          const sIdx = Number(rawV);
          val = Number.isFinite(sIdx) && sharedStrings[sIdx] !== undefined ? sharedStrings[sIdx] : "";
        } else if (cellType === "b") {
          val = rawV === "1" ? "是" : rawV === "0" ? "否" : rawV;
        } else if (cellType === "str" || cellType === "e") {
          val = rawV;
        } else if (rawV !== "") {
          val = formatCleanNumericCell(rawV, Number.isFinite(styleIdx) && pctStyles.has(styleIdx));
        }
      }

      while (rowCells.length <= colIdx) rowCells.push("");
      rowCells[colIdx] = val;
    }
    rows.push(rowCells);
  }
  return rows;
}

/** Decode UTF-8 CSV, falling back to GB18030 for Windows Chinese Excel CSV exports */
function decodeCsvBytes(uint8: Uint8Array): string {
  try {
    const utf8 = new TextDecoder("utf-8", { fatal: true }).decode(uint8);
    return utf8.replace(/^\uFEFF/, "");
  } catch {
    try {
      return new TextDecoder("gb18030", { fatal: false }).decode(uint8).replace(/^\uFEFF/, "");
    } catch {
      return new TextDecoder("utf-8", { fatal: false }).decode(uint8).replace(/^\uFEFF/, "");
    }
  }
}

function detectCsvDelimiter(sample: string): string {
  const firstLine = sample.split(/\r?\n/).find((l) => l.trim().length > 0) || "";
  let inQuotes = false;
  const counts: Record<string, number> = { ",": 0, "\t": 0, ";": 0 };
  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && counts[ch] !== undefined) {
      counts[ch]++;
    }
  }
  if (counts["\t"] > counts[","] && counts["\t"] >= counts[";"]) return "\t";
  if (counts[";"] > counts[","]) return ";";
  return ",";
}

function parseCsvGrid(raw: string): string[][] {
  const text = raw.replace(/\r\n?/g, "\n");
  const delim = detectCsvDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field.length === 0) {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(field.trim());
      field = "";
    } else if (ch === "\n") {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }
  return rows;
}

interface ParsedNumericCell {
  value: number;
  unit: string;
}

function extractHeaderUnit(header: string): string {
  const m = header.match(/[（(]\s*(%|pct|pp|ms|s|秒|分钟|小时|天|倍|x|万|亿|元|万元|亿元|美元|人|家|分|bps|GB|MB|TB|Hz)\s*[)）]/i);
  if (m) return normalizeUnit(m[1]);
  if (/%|率|占比|份额|Pass@1|准确率|召回率/i.test(header)) return "%";
  return "";
}

function normalizeUnit(u: string): string {
  const clean = u.trim();
  if (!clean) return "";
  const lower = clean.toLowerCase();
  if (lower === "pct") return "%";
  if (lower === "x") return "倍";
  if (lower === "s") return "秒";
  return clean;
}

function parseNumericCell(cell: string, headerUnit: string): ParsedNumericCell | null {
  const t = cell.trim();
  if (!t || /^[-—–/\\]+$/.test(t) || /^n\/?a$/i.test(t)) return null;
  // Strip currency prefix & thousands commas
  let prefixUnit = "";
  let body = t;
  const curr = body.match(/^([¥￥$€£])\s*(.+)$/);
  if (curr) {
    prefixUnit = curr[1] === "$" ? "美元" : "元";
    body = curr[2];
  }
  const m = body.match(
    /^([+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?|[+-]?\d+(?:\.\d+)?)\s*(%|pct|pp|ms|s|秒|倍|x|万|亿|元|万元|亿元|人|家|分|bps|GB|MB|TB)?$/i
  );
  if (!m) return null;
  const num = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(num)) return null;
  const rawSuffix = m[2] ? normalizeUnit(m[2]) : "";
  const unit = rawSuffix || prefixUnit || headerUnit;
  return { value: num, unit };
}

function isLowerBetterHeader(header: string): boolean {
  return /延迟|耗时|时延|响应时间|latency|delay|duration|成本|费用|开销|单价|cost|price|错误率|误差|故障|流失|退货|投诉|功耗|内存占用|显存|perplexity|ppl|wer|cer/i.test(
    header
  );
}

function isTimeSequenceCategories(categories: string[]): boolean {
  if (categories.length < 3) return false;
  const timePattern =
    /^(?:20\d{2}|19\d{2}|Q[1-4]|20\d{2}\s*Q[1-4]|H[12]|[1-9]?\d\s*月|第?[一二三四五六七八九十\d]+[周月季年步期阶段]|W\d+|M\d+|Day\s*\d+|Step\s*\d+|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i;
  const hits = categories.filter((c) => timePattern.test(c.trim())).length;
  return hits / categories.length >= 0.6;
}

interface NormalizedGrid {
  bannerTitle?: string;
  headers: string[];
  dataRows: string[][];
}

function normalizeGrid(rawGrid: string[][]): NormalizedGrid | null {
  const nonEmptyRows = rawGrid.filter((r) => r.some((c) => c.trim().length > 0));
  if (nonEmptyRows.length === 0) return null;

  // Determine rightmost non-empty column
  let maxCol = 0;
  for (const r of nonEmptyRows) {
    for (let c = r.length - 1; c >= 0; c--) {
      if (r[c] && r[c].trim().length > 0) {
        if (c + 1 > maxCol) maxCol = c + 1;
        break;
      }
    }
  }
  if (maxCol === 0) return null;

  const trimmed = nonEmptyRows.map((r) => {
    const out: string[] = [];
    for (let c = 0; c < maxCol; c++) {
      out.push((r[c] || "").trim());
    }
    return out;
  });

  // Strip completely empty leading columns
  let firstCol = 0;
  while (firstCol < maxCol && trimmed.every((r) => !r[firstCol])) {
    firstCol++;
  }
  const aligned = firstCol > 0 ? trimmed.map((r) => r.slice(firstCol)) : trimmed;
  if (aligned.length === 0 || aligned[0].length === 0) return null;

  // Handle single-cell title banner row above the real header row
  let bannerTitle: string | undefined;
  let headerRowIdx = 0;
  const row0NonEmpty = aligned[0].filter((c) => c.length > 0);
  if (
    aligned.length >= 3 &&
    row0NonEmpty.length === 1 &&
    aligned[1].filter((c) => c.length > 0).length >= 2
  ) {
    bannerTitle = row0NonEmpty[0];
    headerRowIdx = 1;
  }

  const rawHeaders = aligned[headerRowIdx];
  const headers = rawHeaders.map((h, idx) => h || (idx === 0 ? "维度" : `指标 ${idx}`));
  const dataRows = aligned
    .slice(headerRowIdx + 1)
    .filter((r) => r.some((c) => c.length > 0));

  return { bannerTitle, headers, dataRows };
}

function buildParsedDataTable(params: {
  id: string;
  fileName: string;
  sheetName: string;
  bannerTitle?: string;
  headers: string[];
  dataRows: string[][];
}): ParsedDataTable {
  const { id, fileName, sheetName, bannerTitle, headers, dataRows } = params;
  const colCount = headers.length;
  const rowCount = dataRows.length;
  const categories = dataRows.map((r, i) => r[0] || `项 ${i + 1}`);

  interface ColAnalysis {
    colIdx: number;
    header: string;
    isNumeric: boolean;
    unit: string;
    values: number[];
    maxVal: number;
    minVal: number;
  }

  const colAnalyses: ColAnalysis[] = [];
  const highlightCoords: [number, number][] = [];

  for (let c = 1; c < colCount; c++) {
    const header = headers[c];
    const headerUnit = extractHeaderUnit(header);
    const parsedCells = dataRows.map((r) => parseNumericCell(r[c] || "", headerUnit));
    const nonEmptyCount = dataRows.filter((r) => (r[c] || "").trim().length > 0).length;
    const validCells = parsedCells.filter((x): x is ParsedNumericCell => x !== null);
    const minRequired = rowCount === 1 ? 1 : 2;
    const isNumeric =
      nonEmptyCount > 0 &&
      validCells.length >= minRequired &&
      validCells.length / nonEmptyCount >= 0.75;

    if (isNumeric) {
      const unitCounts = new Map<string, number>();
      for (const cell of validCells) {
        unitCounts.set(cell.unit, (unitCounts.get(cell.unit) || 0) + 1);
      }
      let dominantUnit = headerUnit;
      let bestCnt = 0;
      for (const [u, cnt] of unitCounts.entries()) {
        if (cnt > bestCnt) {
          dominantUnit = u;
          bestCnt = cnt;
        }
      }
      const values = parsedCells.map((cell) => (cell ? cell.value : 0));
      const finiteVals = validCells.map((cell) => cell.value);
      const maxVal = Math.max(...finiteVals);
      const minVal = Math.min(...finiteVals);

      // Highlight optimal cell in this numeric column
      const lowerBetter = isLowerBetterHeader(header);
      const targetVal = lowerBetter ? minVal : maxVal;
      const bestRowIdx = parsedCells.findIndex((cell) => cell !== null && cell.value === targetVal);
      if (bestRowIdx >= 0 && rowCount >= 2) {
        highlightCoords.push([bestRowIdx, c]);
      }

      colAnalyses.push({
        colIdx: c,
        header,
        isNumeric: true,
        unit: dominantUnit,
        values,
        maxVal,
        minVal,
      });
    } else {
      colAnalyses.push({
        colIdx: c,
        header,
        isNumeric: false,
        unit: "",
        values: [],
        maxVal: 0,
        minVal: 0,
      });
    }
  }

  const numericCols = colAnalyses.filter((c) => c.isNumeric);
  const textCols = colAnalyses.filter((c) => !c.isNumeric);

  // Determine if all numeric columns share a compatible unit & scale for direct multi-series charting
  const distinctUnits = new Set(numericCols.map((c) => c.unit));
  let scaleCompatible = true;
  if (numericCols.length >= 2) {
    const absMaxes = numericCols.map((c) => Math.max(Math.abs(c.maxVal), Math.abs(c.minVal), 1e-6));
    const highest = Math.max(...absMaxes);
    const lowest = Math.min(...absMaxes);
    if (highest / lowest > 25) {
      scaleCompatible = false;
    }
  }

  const canDirectChart =
    textCols.length === 0 &&
    numericCols.length >= 1 &&
    numericCols.length <= 4 &&
    rowCount >= 2 &&
    rowCount <= 16 &&
    distinctUnits.size <= 1 &&
    scaleCompatible;

  const mode: DataTableMode = canDirectChart ? "chart" : "table";

  // Build series (even for mode === "table", populate compatible primary series so manual toggle to chart works)
  const chartableCols = canDirectChart
    ? numericCols
    : numericCols.length > 0
      ? numericCols
          .filter((c) => c.unit === numericCols[0].unit)
          .slice(0, 3)
      : [];

  const series: ParsedTableSeries[] = chartableCols.map((c) => ({
    name: c.header,
    values: c.values,
    unit: c.unit,
  }));

  // Infer best native chart variant
  const titleSignal = `${bannerTitle || ""} ${sheetName} ${headers.join(" ")}`;
  let inferredChartVariant: ChartVariant = "col";

  if (series.length === 1 && rowCount >= 2 && rowCount <= 7) {
    const vals = series[0].values;
    const sum = vals.reduce((acc, v) => acc + v, 0);
    const allPositive = vals.every((v) => v > 0);
    const isShare =
      (series[0].unit === "%" && sum >= 94 && sum <= 106) ||
      /占比|构成|份额|分布|结构|share|breakdown/i.test(titleSignal);
    if (allPositive && isShare) {
      inferredChartVariant = "doughnut";
    }
  }

  if (inferredChartVariant === "col") {
    if (
      rowCount >= 3 &&
      (isTimeSequenceCategories(categories) ||
        /趋势|走势|演进|月度|季度|历年|增长曲线|trend/i.test(titleSignal))
    ) {
      inferredChartVariant = "line";
    } else {
      const avgCatLen =
        categories.reduce((acc, s) => acc + s.length, 0) / Math.max(1, categories.length);
      if (
        rowCount >= 6 ||
        avgCatLen >= 8 ||
        (series.length <= 2 && /排行|排名|榜单|对比|评测|benchmark/i.test(titleSignal))
      ) {
        inferredChartVariant = "bar";
      }
    }
  }

  // Synthesize an Assertion-Evidence summary headline from actual table numbers
  let summaryLine = bannerTitle || sheetName;
  if (numericCols.length > 0 && rowCount >= 2) {
    const primary = numericCols[0];
    const lowerBetter = isLowerBetterHeader(primary.header);
    const bestVal = lowerBetter ? primary.minVal : primary.maxVal;
    const bestIdx = primary.values.findIndex((v) => v === bestVal);
    const bestCat = categories[bestIdx >= 0 ? bestIdx : 0];
    const unitSuffix = primary.unit && !String(bestVal).endsWith(primary.unit) ? primary.unit : "";
    if (mode === "table" && numericCols.length >= 2) {
      const second = numericCols[1];
      const secVal = second.values[bestIdx >= 0 ? bestIdx : 0] ?? second.maxVal;
      const secUnit = second.unit && !String(secVal).endsWith(second.unit) ? second.unit : "";
      summaryLine = `${bestCat}在${primary.header}达 ${bestVal}${unitSuffix}，${second.header}为 ${secVal}${secUnit}`;
    } else if (inferredChartVariant === "line" && rowCount >= 3) {
      const firstVal = primary.values[0];
      const lastVal = primary.values[rowCount - 1];
      const dir = lastVal >= firstVal ? "升至" : "降至";
      summaryLine = `${primary.header}自${categories[0]}（${firstVal}${unitSuffix}）${dir}${categories[rowCount - 1]}（${lastVal}${unitSuffix}）`;
    } else {
      summaryLine = `${bestCat}在${primary.header}表现领先（达 ${bestVal}${unitSuffix}）`;
    }
  }

  return {
    id,
    fileName,
    sheetName: bannerTitle && sheetName === "Sheet1" ? bannerTitle.slice(0, 32) : sheetName,
    rowCount,
    colCount,
    headers,
    rows: dataRows,
    mode,
    inferredChartVariant,
    categories,
    series,
    highlightCoords,
    summaryLine: summaryLine.slice(0, 64),
  };
}

function buildSpreadsheetResult(
  fileName: string,
  rawSheets: { sheetName: string; grid: string[][] }[]
): SpreadsheetParseResult {
  const validTables: ParsedDataTable[] = [];
  const skippedReasons: string[] = [];

  rawSheets.forEach(({ sheetName, grid }, idx) => {
    const norm = normalizeGrid(grid);
    if (!norm || norm.dataRows.length === 0) return;

    if (norm.dataRows.length > MAX_TABLE_DATA_ROWS) {
      skippedReasons.push(
        `检测到明细长表「${sheetName}」（共 ${norm.dataRows.length} 行数据），本工具仅负责已整理好的汇总数据表排版，请先在 Excel 中汇总至 ${MAX_TABLE_DATA_ROWS} 行以内再上传`
      );
      return;
    }

    if (norm.headers.length > MAX_TABLE_COLS) {
      skippedReasons.push(
        `检测到超宽数据表「${sheetName}」（共 ${norm.headers.length} 列），请精简至 ${MAX_TABLE_COLS} 列以内的核心对比指标再上传`
      );
      return;
    }

    validTables.push(
      buildParsedDataTable({
        id: `tbl_${idx + 1}_${sheetName.replace(/\s+/g, "_").slice(0, 20)}`,
        fileName,
        sheetName,
        bannerTitle: norm.bannerTitle,
        headers: norm.headers,
        dataRows: norm.dataRows,
      })
    );
  });

  if (validTables.length === 0) {
    if (skippedReasons.length > 0) {
      throw new Error(skippedReasons[0]);
    }
    throw new Error("未在表格文件中检测到有效表头与汇总数据行");
  }

  const digestBlocks = validTables.map((tbl) => {
    const headerLine = tbl.headers.join(" | ");
    const rowLines = tbl.rows.map((r) => r.join(" | ")).join("\n");
    return `## 【数据表：${fileName} · ${tbl.sheetName}】\n核心结论：${tbl.summaryLine}\n${headerLine}\n${rowLines}`;
  });

  const cleanBaseName = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  const firstTable = validTables[0];
  const suggestedTopic =
    (validTables.length === 1 && firstTable.sheetName !== "Sheet1" && firstTable.sheetName !== "CSV数据"
      ? `${cleanBaseName} · ${firstTable.sheetName}`
      : cleanBaseName) || "数据汇总对比分析报告";

  return {
    tables: validTables,
    textDigest: digestBlocks.join("\n\n").slice(0, 16000),
    suggestedTopic: suggestedTopic.slice(0, 48),
    suggestedSubtitle: firstTable.summaryLine.slice(0, 72),
    warning: skippedReasons.length > 0 ? skippedReasons.join("；") : undefined,
  };
}

export function parseXlsxBuffer(uint8: Uint8Array, fileName: string): SpreadsheetParseResult {
  const buf = Buffer.from(uint8);
  const entries = readZipDirectory(buf);
  const budget = { remaining: MAX_TOTAL_UNCOMPRESSED_BYTES };

  const entryByName = new Map<string, ZipEntryRecord>();
  for (const e of entries) {
    entryByName.set(e.name.replace(/^\/+/, ""), e);
  }

  const sharedEntry = entryByName.get("xl/sharedStrings.xml");
  const sharedStrings = sharedEntry
    ? parseSharedStrings(extractEntryText(buf, sharedEntry, budget))
    : [];

  const stylesEntry = entryByName.get("xl/styles.xml");
  const pctStyles = stylesEntry
    ? parsePercentStyleIndices(extractEntryText(buf, stylesEntry, budget))
    : new Set<number>();

  // Map rId -> target path from xl/_rels/workbook.xml.rels
  const relTargetById = new Map<string, string>();
  const relsEntry = entryByName.get("xl/_rels/workbook.xml.rels");
  if (relsEntry) {
    const relsXml = extractEntryText(buf, relsEntry, budget);
    for (const m of relsXml.matchAll(/<(?:\w+:)?Relationship\b([^>]*)\/?>/g)) {
      const id = getAttr(m[1], "Id");
      const target = getAttr(m[1], "Target");
      if (id && target) {
        const normalized = target.startsWith("/")
          ? target.replace(/^\/+/, "")
          : `xl/${target.replace(/^\.\//, "")}`;
        relTargetById.set(id, normalized);
      }
    }
  }

  const sheetsToRead: { sheetName: string; entry: ZipEntryRecord }[] = [];
  const wbEntry = entryByName.get("xl/workbook.xml");
  if (wbEntry) {
    const wbXml = extractEntryText(buf, wbEntry, budget);
    for (const m of wbXml.matchAll(/<(?:\w+:)?sheet\b([^>]*)\/?>/g)) {
      const attrs = m[1];
      const state = getAttr(attrs, "state");
      if (state === "hidden" || state === "veryHidden") continue;
      const name = getAttr(attrs, "name") || `Sheet${sheetsToRead.length + 1}`;
      const rId = getAttr(attrs, "r:id") || getAttr(attrs, "id");
      const targetPath = (rId && relTargetById.get(rId)) || `xl/worksheets/sheet${sheetsToRead.length + 1}.xml`;
      const sheetEntry = entryByName.get(targetPath);
      if (sheetEntry) {
        sheetsToRead.push({ sheetName: name, entry: sheetEntry });
      }
    }
  }

  if (sheetsToRead.length === 0) {
    const fallbackSheets = entries
      .map((e) => {
        const m = e.name.match(/^xl\/worksheets\/sheet(\d+)\.xml$/i);
        return m ? { num: Number(m[1]), entry: e } : null;
      })
      .filter((x): x is { num: number; entry: ZipEntryRecord } => x !== null)
      .sort((a, b) => a.num - b.num);
    for (const s of fallbackSheets) {
      sheetsToRead.push({ sheetName: `Sheet${s.num}`, entry: s.entry });
    }
  }

  if (sheetsToRead.length === 0) {
    throw new Error("未在该 .xlsx 文件中检测到有效工作表（xl/worksheets/sheet*.xml）");
  }

  const rawSheets = sheetsToRead.slice(0, 12).map(({ sheetName, entry }) => {
    const xml = extractEntryText(buf, entry, budget);
    return {
      sheetName,
      grid: parseWorksheetGrid(xml, sharedStrings, pctStyles),
    };
  });

  return buildSpreadsheetResult(fileName, rawSheets);
}

export function parseCsvBuffer(uint8: Uint8Array, fileName: string): SpreadsheetParseResult {
  const raw = decodeCsvBytes(uint8);
  const grid = parseCsvGrid(raw);
  const cleanSheetName =
    fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 28) || "CSV数据";
  return buildSpreadsheetResult(fileName, [{ sheetName: cleanSheetName, grid }]);
}
