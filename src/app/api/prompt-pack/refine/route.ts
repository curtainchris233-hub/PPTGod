import { NextResponse } from "next/server";
import { isPlainObject } from "@/lib/deckValidation";
import { generatePresentationJson } from "@/lib/presentationAgent";
import { resolveProvider } from "@/lib/providerRequest";
import {
  PACK_LAYOUTS,
  sanitizePackSlides,
  type PackLanguage,
  type PackSlide,
} from "@/lib/promptPack";
import { limitSiteProvider, limitToolRequest } from "@/lib/toolRateLimit";
import { safeString } from "../../prompts/_validation";

export const maxDuration = 45;

function normalizeNumber(value: string): string {
  return value.replace(/[,\s，]/g, "");
}

function groundSingleSlide(slide: PackSlide, source: string): PackSlide {
  if (!source.trim()) return slide;
  const haystack = normalizeNumber(source);
  return {
    ...slide,
    data: slide.data.filter((d) => {
      const num = normalizeNumber(d.value).match(/-?\d+(?:\.\d+)?/)?.[0];
      return Boolean(num) && haystack.includes(num as string);
    }),
  };
}

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  const limited = await limitToolRequest(request, "prompt-pack-refine", 30);
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

  if (!isPlainObject(body.slide)) {
    return json(400, { error: "缺少待润色的单页内容" });
  }

  const provider = resolveProvider(
    {
      apiKey: safeString(body.apiKey).trim(),
      apiBase: safeString(body.apiBase).trim(),
      model: safeString(body.model).trim(),
    },
    "text",
    "单页 AI 润色需要先在「设置 → 本地 BYOK」中配置自己的模型 API Key"
  );
  if (!provider.ok) {
    return json(400, { error: provider.error });
  }
  if (provider.config.usesSiteKey) {
    const siteLimited = await limitSiteProvider(request, "text");
    if (siteLimited) return siteLimited;
  }

  const rawSlide = body.slide;
  const fallbackSlide: PackSlide = {
    id: safeString(rawSlide.id).slice(0, 40) || "ps_refine",
    layout: "image-text",
    title: safeString(rawSlide.title).trim().slice(0, 60) || "本页内容",
    points: Array.isArray(rawSlide.points)
      ? rawSlide.points.map((p) => safeString(p).trim().slice(0, 120)).filter(Boolean).slice(0, 6)
      : [],
    data: Array.isArray(rawSlide.data)
      ? rawSlide.data
          .filter(isPlainObject)
          .map((d) => ({
            label: safeString(d.label).trim().slice(0, 24),
            value: safeString(d.value).trim().slice(0, 24),
          }))
          .filter((d) => d.label && d.value)
          .slice(0, 6)
      : [],
    visual: safeString(rawSlide.visual).trim().slice(0, 200),
    note: safeString(rawSlide.note).trim().slice(0, 400),
    source: safeString(rawSlide.source).trim().slice(0, 80),
  };

  const language: PackLanguage =
    body.language === "en" || body.language === "bilingual" ? body.language : "zh";
  const topic = safeString(body.topic).trim().slice(0, 60);
  const audience = safeString(body.audience).trim().slice(0, 40);
  const styleName = safeString(body.styleName).trim().slice(0, 40);
  const instruction = safeString(body.instruction).trim().slice(0, 160);
  const sourceText = safeString(body.sourceText).slice(0, 6000);

  const layouts = PACK_LAYOUTS.map((l) => `${l.id}(${l.label})`).join("、");
  const langRule =
    language === "en"
      ? "Write title, points, visual and note in English."
      : language === "bilingual"
        ? "标题用中文配简短英文副题，要点与备注用简体中文。"
        : "全部使用简体中文。";

  const instructions = `你是顶级 PPT 策划编辑。任务：仅优化用户指定的这一页幻灯片，使其标题更有结论感、要点更凝练、视觉建议更具体。只输出一个合法 JSON 对象，不要解释。
JSON 格式：
{"layout":"从 ${layouts} 中选一","title":"结论式标题(≤24字)","points":["2-4条要点，每条≤40字"],"data":[{"label":"指标","value":"数值+单位"}],"visual":"具体视觉/图表建议(≤60字)","note":"演讲备注(≤120字)","source":"资料出处"}
严格要求：
1. 只能使用用户原始资料或本页已有的事实与数字，绝不编造任何新数字、引用或人名。
2. ${langRule}`;

  const origSanitized = sanitizePackSlides([rawSlide, rawSlide, rawSlide], [fallbackSlide, fallbackSlide, fallbackSlide])[0] ?? fallbackSlide;
  const { imageDataUrl: origImg, ...slideForPrompt } = origSanitized;

  const input = [
    topic ? `整份演示主题：${topic}` : "",
    audience ? `受众：${audience}` : "",
    styleName ? `设计风格：${styleName}` : "",
    instruction ? `用户额外要求：${instruction}` : "",
    `当前页面 JSON：\n${JSON.stringify(slideForPrompt)}`,
    sourceText ? `原始资料节选（核对数据依据）：\n${sourceText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await generatePresentationJson({
    task: "polish",
    config: provider.config,
    instructions,
    input,
    requestSignal: request.signal,
  });

  if (!result.ok) {
    return json(502, { error: result.error });
  }
  if (!isPlainObject(result.data)) {
    return json(502, { error: "大模型返回的单页结构不合法，请重试" });
  }

  // Reuse sanitizePackSlides with 3-slot padding to preserve strict field sanitization.
  const padded = sanitizePackSlides([result.data, fallbackSlide, fallbackSlide], [fallbackSlide, fallbackSlide, fallbackSlide]);
  const cleaned: PackSlide = {
    ...padded[0],
    id: fallbackSlide.id,
    source: padded[0].source || fallbackSlide.source,
    ...(origSanitized.chartVariant ? { chartVariant: padded[0].chartVariant ?? origSanitized.chartVariant } : {}),
    ...(origSanitized.chartCategories ? { chartCategories: origSanitized.chartCategories } : {}),
    ...(origSanitized.chartSeries ? { chartSeries: origSanitized.chartSeries } : {}),
    ...(origSanitized.tableData ? { tableData: origSanitized.tableData } : {}),
    ...(origImg ? { imageDataUrl: origImg } : {}),
  };
  const grounded = groundSingleSlide(cleaned, `${sourceText}\n${JSON.stringify(fallbackSlide.data)}`);
  return json(200, { ok: true, slide: grounded, model: provider.config.model });
}
