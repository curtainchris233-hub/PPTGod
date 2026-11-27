import { NextResponse } from "next/server";
import { isPlainObject } from "@/lib/deckValidation";
import { generatePresentationJson } from "@/lib/presentationAgent";
import { resolveProvider } from "@/lib/providerRequest";
import {
  directionToStyle,
  getDesignDirection,
  sanitizePackSlides,
  sanitizePackStyle,
  type PackDensity,
  type PackLanguage,
  type PackSlide,
  type PackStyle,
  type PromptPack,
} from "@/lib/promptPack";
import {
  buildPackInstructions,
  buildPackUserInput,
  buildRuleBasedPack,
  type PackRequestInput,
} from "@/lib/promptPackEngine";
import type { ParsedDataTable } from "@/lib/spreadsheetParser";
import type { ChartVariant } from "@/types/prompt";
import { limitSiteProvider, limitToolRequest } from "@/lib/toolRateLimit";
import { safeNumber, safeString } from "../prompts/_validation";

export const maxDuration = 75;

const MIN_CHARS = 20;
const MAX_CHARS = 16000;
const VALID_VARIANTS: ChartVariant[] = ["col", "bar", "line", "doughnut"];

function normalizeNumber(value: string): string {
  return value.replace(/[,\s，]/g, "");
}

function clipStr(val: unknown, max: number): string {
  return safeString(val).trim().slice(0, max);
}

function sanitizeIncomingTables(raw: unknown): ParsedDataTable[] {
  if (!Array.isArray(raw)) return [];
  const out: ParsedDataTable[] = [];
  for (const item of raw.slice(0, 8)) {
    if (!isPlainObject(item)) continue;
    const headers = Array.isArray(item.headers)
      ? item.headers.slice(0, 10).map((h) => clipStr(h, 40)).filter(Boolean)
      : [];
    const rows = Array.isArray(item.rows)
      ? item.rows
          .filter(Array.isArray)
          .slice(0, 30)
          .map((r) => r.slice(0, 10).map((c) => clipStr(c, 60)))
      : [];
    if (headers.length < 2 || rows.length < 1) continue;
    const categories = Array.isArray(item.categories)
      ? item.categories.slice(0, 30).map((c) => clipStr(c, 40))
      : rows.map((r, idx) => r[0] || `项 ${idx + 1}`);
    const series = Array.isArray(item.series)
      ? item.series
          .filter(isPlainObject)
          .slice(0, 4)
          .map((s, sIdx) => ({
            name: clipStr(s.name, 32) || `序列 ${sIdx + 1}`,
            values: Array.isArray(s.values)
              ? s.values.slice(0, 30).map((v) => {
                  const n = safeNumber(v);
                  return n !== null ? n : 0;
                })
              : [],
            unit: clipStr(s.unit, 12),
          }))
          .filter((s) => s.values.length > 0)
      : [];
    const highlightCoords: [number, number][] = Array.isArray(item.highlightCoords)
      ? item.highlightCoords
          .filter(
            (p): p is [number, number] =>
              Array.isArray(p) &&
              p.length === 2 &&
              typeof p[0] === "number" &&
              typeof p[1] === "number" &&
              p[0] >= 0 &&
              p[0] < rows.length &&
              p[1] >= 0 &&
              p[1] < headers.length
          )
          .slice(0, 12)
      : [];
    const cv = clipStr(item.inferredChartVariant, 16) as ChartVariant;
    out.push({
      id: clipStr(item.id, 48) || `tbl_${out.length + 1}`,
      fileName: clipStr(item.fileName, 120) || "数据表.xlsx",
      sheetName: clipStr(item.sheetName, 48) || `Sheet${out.length + 1}`,
      rowCount: rows.length,
      colCount: headers.length,
      headers,
      rows,
      mode: item.mode === "chart" && series.length > 0 ? "chart" : "table",
      inferredChartVariant: VALID_VARIANTS.includes(cv) ? cv : "col",
      categories,
      series,
      highlightCoords,
      summaryLine: clipStr(item.summaryLine, 80) || clipStr(item.sheetName, 48),
    });
  }
  return out;
}

/**
 * Honesty guard: drop any LLM-produced datum whose number does not literally
 * appear in the user's material (prevents fabricated statistics).
 */
function groundSlides(slides: PackSlide[], source: string): PackSlide[] {
  const haystack = normalizeNumber(source);
  return slides.map((s) => ({
    ...s,
    data: s.data.filter((d) => {
      const num = normalizeNumber(d.value).match(/-?\d+(?:\.\d+)?/)?.[0];
      return Boolean(num) && haystack.includes(num as string);
    }),
  }));
}

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  const limited = await limitToolRequest(request, "prompt-pack", 24);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!isPlainObject(parsed)) return json(400, { error: "请求体不是合法的 JSON 格式" });
    body = parsed;
  } catch {
    return json(400, { error: "请求体不是合法的 JSON 格式" });
  }

  for (const key of ["apiKey", "apiBase", "model"] as const) {
    const v = body[key];
    if (v !== undefined && v !== null && typeof v !== "string") {
      return json(400, { error: `${key} 格式不合法，请输入字符串` });
    }
  }

  const tables = sanitizeIncomingTables(body.tables);
  const rawText = safeString(body.text).trim();
  const text =
    rawText.length >= MIN_CHARS || tables.length === 0
      ? rawText
      : `${rawText}\n${tables.map((t) => `${t.fileName} · ${t.sheetName}：${t.summaryLine}`).join("\n")}`.trim();
  if (text.length < MIN_CHARS && tables.length === 0) {
    return json(400, { error: `资料内容太少（至少 ${MIN_CHARS} 个字），请粘贴更完整的文字或上传文档` });
  }
  const rawCount = safeNumber(body.slideCount);
  const language: PackLanguage =
    body.language === "en" || body.language === "bilingual" ? body.language : "zh";
  const density: PackDensity = body.density === "reading" ? "reading" : "speaker";
  const anchorStyle: PackStyle | undefined = isPlainObject(body.anchorStyle)
    ? sanitizePackStyle(
        body.anchorStyle,
        directionToStyle(getDesignDirection(safeString(body.anchorStyle.directionId)), "")
      )
    : undefined;
  const input: PackRequestInput = {
    text: text.slice(0, MAX_CHARS),
    fileName: safeString(body.fileName).trim().slice(0, 120),
    topic: safeString(body.topic).trim().slice(0, 60) || undefined,
    audience: safeString(body.audience).trim().slice(0, 40) || undefined,
    slideCount:
      Number.isFinite(rawCount) && rawCount > 0 ? Math.max(5, Math.min(24, Math.round(rawCount))) : undefined,
    language,
    density,
    directionId: safeString(body.directionId).trim().slice(0, 40) || undefined,
    ...(anchorStyle ? { anchorStyle } : {}),
    ...(tables.length > 0 ? { tables } : {}),
  };
  const mode = body.mode === "smart" ? "smart" : "auto";

  let rule: PromptPack;
  try {
    rule = buildRuleBasedPack(input).pack;
  } catch {
    return json(500, { error: "资料解析失败，请检查文本内容后重试" });
  }
  const ruleResponse = (fallbackReason?: string) =>
    json(200, { ok: true, pack: rule, engine: "smart", ...(fallbackReason ? { fallbackReason } : {}) });

  if (mode === "smart") return ruleResponse();

  const provider = resolveProvider(
    {
      apiKey: safeString(body.apiKey).trim(),
      apiBase: safeString(body.apiBase).trim(),
      model: safeString(body.model).trim(),
    },
    "text",
    "未配置大模型 Key，已使用内置规则引擎"
  );
  if (!provider.ok) {
    const hasByok = Boolean(safeString(body.apiKey).trim() || safeString(body.apiBase).trim());
    return ruleResponse(hasByok ? provider.error : undefined);
  }
  if (provider.config.usesSiteKey) {
    const siteLimited = await limitSiteProvider(request, "text");
    if (siteLimited) return ruleResponse("站点共享额度已达上限，已使用内置规则引擎");
  }

  const slideCount = input.slideCount ?? rule.slides.length;
  const result = await generatePresentationJson({
    task: "promptpack",
    config: provider.config,
    instructions: buildPackInstructions(slideCount, language, density),
    input: buildPackUserInput(input, rule, slideCount),
    requestSignal: request.signal,
  });
  if (!result.ok) return ruleResponse(result.error);
  if (!isPlainObject(result.data)) return ruleResponse("大模型返回结构不完整，已使用内置规则引擎");

  const data = result.data;
  const sanitized = sanitizePackSlides(data.slides, rule.slides);
  if (sanitized === rule.slides) {
    return ruleResponse("大模型未返回有效的逐页大纲，已使用内置规则引擎");
  }
  let slides = groundSlides(sanitized, input.text);
  // Ensure structured spreadsheet slides keep their exact numeric matrices even when LLM generates prose copy
  if (tables.length > 0) {
    const ruleTableSlides = rule.slides.filter(
      (rs) => Boolean(rs.tableData) || Boolean(rs.chartSeries && rs.chartSeries.length > 0)
    );
    if (ruleTableSlides.length > 0) {
      let cursor = 0;
      slides = slides.map((s) => {
        if ((s.layout === "table" || s.layout === "chart") && cursor < ruleTableSlides.length) {
          const ref = ruleTableSlides[cursor++];
          return {
            ...s,
            layout: ref.layout,
            chartVariant: s.chartVariant ?? ref.chartVariant,
            chartCategories: ref.chartCategories,
            chartSeries: ref.chartSeries,
            tableData: ref.tableData,
            data: s.data.length > 0 ? s.data : ref.data,
            source: ref.source,
          };
        }
        return s;
      });
    }
  }
  const pack: PromptPack = {
    ...rule,
    engine: "llm",
    model: provider.config.model,
    style: sanitizePackStyle(data.style, rule.style),
    slides,
    insight: {
      ...rule.insight,
      density,
      slideCount: slides.length,
      talkMinutes: Math.max(3, Math.round(slides.length * (density === "speaker" ? 1.5 : 1.2))),
    },
  };
  return json(200, { ok: true, pack, engine: "llm" });
}
