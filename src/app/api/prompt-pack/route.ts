import { NextResponse } from "next/server";
import { isPlainObject } from "@/lib/deckValidation";
import { generatePresentationJson } from "@/lib/presentationAgent";
import { resolveProvider } from "@/lib/providerRequest";
import {
  sanitizePackSlides,
  sanitizePackStyle,
  type PackLanguage,
  type PackSlide,
  type PromptPack,
} from "@/lib/promptPack";
import {
  buildPackInstructions,
  buildPackUserInput,
  buildRuleBasedPack,
  type PackRequestInput,
} from "@/lib/promptPackEngine";
import { limitSiteProvider, limitToolRequest } from "@/lib/toolRateLimit";
import { safeNumber, safeString } from "../prompts/_validation";

export const maxDuration = 75;

const MIN_CHARS = 20;
const MAX_CHARS = 16000;

function normalizeNumber(value: string): string {
  return value.replace(/[,\s，]/g, "");
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

  const text = safeString(body.text).trim();
  if (text.length < MIN_CHARS) {
    return json(400, { error: `资料内容太少（至少 ${MIN_CHARS} 个字），请粘贴更完整的文字或上传文档` });
  }
  const rawCount = safeNumber(body.slideCount);
  const language: PackLanguage =
    body.language === "en" || body.language === "bilingual" ? body.language : "zh";
  const input: PackRequestInput = {
    text: text.slice(0, MAX_CHARS),
    fileName: safeString(body.fileName).trim().slice(0, 120),
    topic: safeString(body.topic).trim().slice(0, 60) || undefined,
    audience: safeString(body.audience).trim().slice(0, 40) || undefined,
    slideCount:
      Number.isFinite(rawCount) && rawCount > 0 ? Math.max(5, Math.min(24, Math.round(rawCount))) : undefined,
    language,
    directionId: safeString(body.directionId).trim().slice(0, 40) || undefined,
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
    instructions: buildPackInstructions(slideCount, language),
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
  const slides = groundSlides(sanitized, input.text);
  const pack: PromptPack = {
    ...rule,
    engine: "llm",
    model: provider.config.model,
    style: sanitizePackStyle(data.style, rule.style),
    slides,
    insight: {
      ...rule.insight,
      slideCount: slides.length,
      talkMinutes: Math.max(3, Math.round(slides.length * 1.4)),
    },
  };
  return json(200, { ok: true, pack, engine: "llm" });
}
