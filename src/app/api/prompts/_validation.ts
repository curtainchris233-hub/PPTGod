import {
  TOOL_METADATA,
  type ColorFamily,
  type DecorativeMotif,
  type LayoutArchetype,
  type PromptAnatomy,
  type TargetTool,
  type TypographyMood,
  type VisualSpec,
} from "@/types/prompt";

const VALID_COLOR_FAMILIES = new Set<ColorFamily>([
  "light",
  "dark",
  "warm",
  "vivid",
  "earth",
]);

const VALID_ARCHETYPES = new Set<LayoutArchetype>([
  "swiss-grid",
  "consulting-mbb",
  "keynote-center",
  "editorial-asymmetric",
  "neo-chinese",
  "retro-bauhaus",
  "academic-paper",
  "warm-humanist",
  "tech-blueprint",
  "brutalist-poster",
  "luxury-minimal",
  "executive-emerald",
  "soft-bento",
  "financial-terminal",
  "clinical-clean",
]);

const VALID_TYPOGRAPHY_MOODS = new Set<TypographyMood>([
  "swiss",
  "editorial",
  "consulting",
  "chinese",
  "tech",
  "academic",
  "brutalist",
  "humanist",
]);

const VALID_MOTIFS = new Set<DecorativeMotif>([
  "hairline-rule",
  "swiss-cross",
  "spotlight-orb",
  "editorial-drop",
  "ink-wash",
  "bauhaus-geo",
  "corner-brackets",
  "hard-offset",
  "ribbon-accent",
  "bento-dots",
  "none",
]);

const VALID_DENSITIES = new Set<"airy" | "balanced" | "dense">([
  "airy",
  "balanced",
  "dense",
]);

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGBA_COLOR_RE =
  /^rgba?\(\s*(?:\d+(?:\.\d+)?|\.\d+)\s*[,\s]\s*(?:\d+(?:\.\d+)?|\.\d+)\s*[,\s]\s*(?:\d+(?:\.\d+)?|\.\d+)(?:\s*[,/]\s*(?:\d+(?:\.\d+)?%?|\.\d+%?))?\s*\)$/i;
const TRACKING_RE = /^(?:normal|0|-?\d+(?:\.\d+)?(?:em|rem|px|%))$/i;

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return Boolean(val) && typeof val === "object" && !Array.isArray(val);
}

export function isValidCssColor(val: unknown): val is string {
  if (typeof val !== "string") return false;
  const trimmed = val.trim();
  if (!trimmed || trimmed.length > 64) return false;
  return HEX_COLOR_RE.test(trimmed) || RGBA_COLOR_RE.test(trimmed);
}

export function safeString(val: unknown, fallback = ""): string {
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  return fallback;
}

export function safeNumber(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string" && val.trim() !== "") return Number(val);
  return Number.NaN;
}

export async function parseJsonObject(
  request: Request
): Promise<
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string }
> {
  try {
    const parsed: unknown = await request.json();
    if (!isPlainObject(parsed)) {
      return { ok: false, error: "请求数据格式不正确" };
    }
    return { ok: true, data: parsed };
  } catch {
    return { ok: false, error: "请求数据格式不正确" };
  }
}

/**
 * Deeply validates and sanitizes a VisualSpec payload so malformed palette
 * colors, non-array chartColors, or unknown enum values can never be persisted.
 */
export function sanitizeAndValidateVisualSpec(
  raw: unknown
): { ok: true; data: VisualSpec } | { ok: false; error: string } {
  if (
    !isPlainObject(raw) ||
    !isPlainObject(raw.palette) ||
    !isPlainObject(raw.layout) ||
    !isPlainObject(raw.typography)
  ) {
    return { ok: false, error: "缺少完整的视觉配置参数（VisualSpec）" };
  }

  const p = raw.palette;
  const requiredPaletteFields = [
    ["bg", "画布底色"],
    ["surface", "卡片表面色"],
    ["text", "主文字色"],
    ["muted", "辅助文字色"],
    ["accent", "强调色"],
    ["accentSoft", "柔和强调色"],
    ["border", "边框分割色"],
  ] as const;

  for (const [key, label] of requiredPaletteFields) {
    if (!isValidCssColor(p[key])) {
      return {
        ok: false,
        error: `VisualSpec 配色字段「${label} (${key})」不是合法的 HEX 或 RGB(A) 色值`,
      };
    }
  }

  if (!Array.isArray(p.chartColors) || p.chartColors.length !== 4) {
    return {
      ok: false,
      error: "VisualSpec 图表配色数组（chartColors）必须包含恰好 4 个合法色值",
    };
  }
  const cleanCharts: string[] = [];
  for (const entry of p.chartColors) {
    if (!isValidCssColor(entry)) {
      return {
        ok: false,
        error: "VisualSpec 图表色板（chartColors）包含非法色值",
      };
    }
    cleanCharts.push(entry.trim());
  }
  const accentStr = (p.accent as string).trim();
  const textStr = (p.text as string).trim();
  const mutedStr = (p.muted as string).trim();
  const borderStr = (p.border as string).trim();
  const chartColors: [string, string, string, string] = [
    cleanCharts[0],
    cleanCharts[1],
    cleanCharts[2],
    cleanCharts[3],
  ];

  const t = raw.typography;
  const moodRaw = typeof t.mood === "string" ? t.mood.trim() : "";
  if (!VALID_TYPOGRAPHY_MOODS.has(moodRaw as TypographyMood)) {
    return { ok: false, error: "VisualSpec 字体气质（typography.mood）不合法" };
  }
  const headingFontLabel = safeString(t.headingFontLabel).trim().slice(0, 80);
  const bodyFontLabel = safeString(t.bodyFontLabel).trim().slice(0, 80);
  if (!headingFontLabel || !bodyFontLabel) {
    return { ok: false, error: "VisualSpec 缺少标题或正文字体说明" };
  }
  const rawWeight = safeNumber(t.titleWeight);
  const titleWeight = Number.isFinite(rawWeight)
    ? Math.max(100, Math.min(900, Math.round(rawWeight)))
    : 700;
  const rawTracking = safeString(t.titleTracking, "-0.02em").trim();
  const titleTracking = TRACKING_RE.test(rawTracking) ? rawTracking : "-0.02em";

  const l = raw.layout;
  const archRaw = typeof l.archetype === "string" ? l.archetype.trim() : "";
  if (!VALID_ARCHETYPES.has(archRaw as LayoutArchetype)) {
    return { ok: false, error: "VisualSpec 版式原型（layout.archetype）不合法" };
  }
  const densityRaw = typeof l.density === "string" ? l.density.trim() : "";
  if (!VALID_DENSITIES.has(densityRaw as "airy" | "balanced" | "dense")) {
    return { ok: false, error: "VisualSpec 信息密度（layout.density）不合法" };
  }
  const motifRaw =
    typeof l.decorativeMotif === "string" ? l.decorativeMotif.trim() : "none";
  if (!VALID_MOTIFS.has(motifRaw as DecorativeMotif)) {
    return {
      ok: false,
      error: "VisualSpec 装饰纹理（layout.decorativeMotif）不合法",
    };
  }
  const rawRadius = safeNumber(l.cornerRadius);
  if (!Number.isFinite(rawRadius) || rawRadius < 0 || rawRadius > 32) {
    return {
      ok: false,
      error: "VisualSpec 圆角参数（layout.cornerRadius）必须在 0 至 32 之间",
    };
  }
  const cornerRadius = Math.round(rawRadius);
  const showPageNumber =
    typeof l.showPageNumber === "boolean" ? l.showPageNumber : true;

  return {
    ok: true,
    data: {
      palette: {
        bg: (p.bg as string).trim(),
        surface: (p.surface as string).trim(),
        text: textStr,
        muted: mutedStr,
        accent: accentStr,
        accentSoft: (p.accentSoft as string).trim(),
        border: borderStr,
        chartColors,
      },
      typography: {
        mood: moodRaw as TypographyMood,
        headingFontLabel,
        bodyFontLabel,
        titleWeight,
        titleTracking,
      },
      layout: {
        archetype: archRaw as LayoutArchetype,
        density: densityRaw as "airy" | "balanced" | "dense",
        cornerRadius,
        showPageNumber,
        decorativeMotif: motifRaw as DecorativeMotif,
      },
    },
  };
}

export interface ValidatedPromptPayload {
  title: string;
  englishTitle: string;
  summary: string;
  scenario: string;
  styleCategory: string;
  colorFamily: ColorFamily;
  recommendedTools: TargetTool[];
  tags: string[];
  visualSpec: VisualSpec;
  promptAnatomy: PromptAnatomy;
  customNotes: string;
  sampleTopic: string;
  sampleSubtitle: string;
}

export function validatePromptPayload(
  body: Record<string, unknown>,
  defaults?: Partial<ValidatedPromptPayload>
):
  | { ok: true; data: ValidatedPromptPayload }
  | { ok: false; error: string } {
  const title = safeString(body.title).trim();
  if (title.length < 2 || title.length > 60) {
    return { ok: false, error: "风格名称长度需在 2 到 60 字之间" };
  }

  const summary = safeString(body.summary).trim();
  if (summary.length < 8) {
    return { ok: false, error: "请填写至少 8 个字的视觉亮点简介" };
  }

  const englishTitle =
    safeString(body.englishTitle).trim() ||
    defaults?.englishTitle ||
    "Custom Slide Style";
  const scenario =
    safeString(body.scenario).trim() || defaults?.scenario || "产品发布";
  const styleCategory =
    safeString(body.styleCategory).trim() ||
    defaults?.styleCategory ||
    "极简主义";

  const rawColor =
    typeof body.colorFamily === "string" ? body.colorFamily.trim() : "";
  const colorFamily: ColorFamily = VALID_COLOR_FAMILIES.has(
    rawColor as ColorFamily
  )
    ? (rawColor as ColorFamily)
    : defaults?.colorFamily ?? "light";

  let recommendedTools: TargetTool[];
  if (Array.isArray(body.recommendedTools)) {
    const filtered = Array.from(
      new Set(
        body.recommendedTools.filter(
          (t): t is TargetTool =>
            typeof t === "string" &&
            Object.prototype.hasOwnProperty.call(TOOL_METADATA, t)
        )
      )
    );
    recommendedTools = filtered.length
      ? filtered
      : defaults?.recommendedTools?.length
        ? defaults.recommendedTools
        : ["claude-html"];
  } else {
    recommendedTools = defaults?.recommendedTools?.length
      ? defaults.recommendedTools
      : ["claude-html", "gamma-kimi"];
  }

  const tags = Array.isArray(body.tags)
    ? Array.from(
        new Set(
          body.tags
            .map((t: unknown) => safeString(t).trim())
            .filter(Boolean)
        )
      ).slice(0, 8)
    : defaults?.tags ?? [];

  const specCheck = sanitizeAndValidateVisualSpec(body.visualSpec);
  if (!specCheck.ok) {
    return specCheck;
  }
  const visualSpec = specCheck.data;

  if (!isPlainObject(body.promptAnatomy)) {
    return { ok: false, error: "请完善提示词的五个结构拆解维度" };
  }
  const rawAnatomy = body.promptAnatomy;
  const promptAnatomy: PromptAnatomy = {
    style: safeString(rawAnatomy.style).trim(),
    palette: safeString(rawAnatomy.palette).trim(),
    typography: safeString(rawAnatomy.typography).trim(),
    layout: safeString(rawAnatomy.layout).trim(),
    content: safeString(rawAnatomy.content).trim(),
  };
  if (
    !promptAnatomy.style ||
    !promptAnatomy.palette ||
    !promptAnatomy.typography ||
    !promptAnatomy.layout ||
    !promptAnatomy.content
  ) {
    return { ok: false, error: "请完善提示词的五个结构拆解维度" };
  }

  const customNotes =
    body.customNotes !== undefined
      ? safeString(body.customNotes).trim()
      : defaults?.customNotes ?? "";
  const sampleTopic = safeString(body.sampleTopic).trim() || title;
  const sampleSubtitle =
    safeString(body.sampleSubtitle).trim() ||
    defaults?.sampleSubtitle ||
    "由社区创作者设计的演示风格模板";

  return {
    ok: true,
    data: {
      title,
      englishTitle,
      summary,
      scenario,
      styleCategory,
      colorFamily,
      recommendedTools,
      tags,
      visualSpec,
      promptAnatomy,
      customNotes,
      sampleTopic,
      sampleSubtitle,
    },
  };
}
