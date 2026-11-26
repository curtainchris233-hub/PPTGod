import { NextResponse } from "next/server";
import { generatePresentationJson } from "@/lib/presentationAgent";
import { resolveProvider } from "@/lib/providerRequest";
import { limitSiteProvider, limitToolRequest } from "@/lib/toolRateLimit";
import { polishSlideContent, type PolishAction } from "@/lib/deckGenerator";
import {
  isPlainObject,
  sanitizeLlmSlide,
} from "@/lib/deckValidation";
import type { DeckSlideItem } from "@/types/prompt";
import { safeString } from "../prompts/_validation";

const VALID_ACTIONS = new Set<PolishAction>(["executive", "metrics", "notes"]);

const ACTION_INSTRUCTIONS: Record<PolishAction, string> = {
  executive:
    "将本页内容提炼为顶级咨询高管决策风（结论先行、删繁就简、每条要点精炼有力），同时更新 speakerNotes。",
  metrics:
    "在不编造荒谬数值的前提下，为本页要点、KPI、漏斗或对比项补充具有商业说服力的量化标尺、同比增幅与验收周期参考，同时更新 speakerNotes。",
  notes:
    "保持页面主体文字基本稳定，重点为本页撰写一段 90-150 字自然流畅、带有听众互动和承上启下过渡语的高品质演讲逐字稿（speakerNotes）。",
};

export async function POST(request: Request) {
  const limited = await limitToolRequest(request, "polish", 40);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!isPlainObject(parsed)) {
      return NextResponse.json(
        { error: "请求体不是合法的 JSON 格式" },
        { status: 400 }
      );
    }
    body = parsed;
  } catch {
    return NextResponse.json(
      { error: "请求体不是合法的 JSON 格式" },
      { status: 400 }
    );
  }

  try {
    if (!isPlainObject(body.slide)) {
      return NextResponse.json(
        { error: "缺少待润色的单页幻灯片数据（slide）" },
        { status: 400 }
      );
    }

    const action = safeString(body.action).trim() as PolishAction;
    if (!VALID_ACTIONS.has(action)) {
      return NextResponse.json(
        { error: "不支持的润色指令，请选择 executive / metrics / notes" },
        { status: 400 }
      );
    }

    const baseSlide = sanitizeLlmSlide(
      body.slide,
      1,
      2,
      safeString(body.slide.title, "幻灯片核心观点")
    );
    const mode = body.mode === "llm" ? "llm" : "smart";

    if (mode === "llm") {
      if (
        body.apiKey !== undefined &&
        body.apiKey !== null &&
        typeof body.apiKey !== "string"
      ) {
        return NextResponse.json(
          { error: "API Key 格式不合法" },
          { status: 400 }
        );
      }
      if (
        body.apiBase !== undefined &&
        body.apiBase !== null &&
        typeof body.apiBase !== "string"
      ) {
        return NextResponse.json(
          { error: "API Base URL 格式不合法" },
          { status: 400 }
        );
      }

      const provider = resolveProvider(
        {
          apiKey: safeString(body.apiKey).trim(),
          apiBase: safeString(body.apiBase).trim(),
          model: safeString(body.model).trim(),
        },
        "text",
        "未检测到 API Key，请填入 Key 或使用免 Key 智能润色模式"
      );
      if (!provider.ok) {
        return NextResponse.json({ error: provider.error }, { status: 400 });
      }
      if (provider.config.usesSiteKey) {
        const limit = await limitSiteProvider(request, "text");
        if (limit) return limit;
      }

      // Strip potentially large image dataUrl before sending to text LLM
      const promptSlideCopy: DeckSlideItem = structuredClone(baseSlide);
      if (promptSlideCopy.imageSlot?.dataUrl) {
        promptSlideCopy.imageSlot = {
          ...promptSlideCopy.imageSlot,
          dataUrl: undefined,
        };
      }

      const result = await generatePresentationJson({
        task: "polish",
        config: provider.config,
        instructions: `你是一位资深商业 PPT 润色专家。任务：${ACTION_INSTRUCTIONS[action]}。严格返回 JSON 对象 {"slide": { ...与输入字段结构兼容的单页对象... }}，不要更改 id 与 slideType。`,
        input: JSON.stringify({ slide: promptSlideCopy }),
        requestSignal: request.signal,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 502 });
      }
      const parsed = result.data;

      const rawPolished =
        isPlainObject(parsed) && isPlainObject(parsed.slide)
          ? parsed.slide
          : isPlainObject(parsed)
          ? parsed
          : null;

      if (!rawPolished) {
        return NextResponse.json(
          { error: "大模型未返回有效的单页内容" },
          { status: 502 }
        );
      }

      const sanitized = sanitizeLlmSlide(rawPolished, 1, 2, baseSlide.title);
      // Always preserve identity, slideType, and original user imageSlot
      const merged: DeckSlideItem = {
        ...baseSlide,
        ...sanitized,
        id: baseSlide.id,
        slideType: baseSlide.slideType,
        imageSlot: baseSlide.imageSlot ?? sanitized.imageSlot,
      };
      return NextResponse.json({ slide: merged, engine: "llm" });
    }

    const polished = polishSlideContent(baseSlide, action);
    return NextResponse.json({ slide: polished, engine: "smart" });
  } catch (err) {
    console.error(
      "Polish API error:",
      err instanceof Error ? err.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "单页润色处理失败，请稍后重试" },
      { status: 500 }
    );
  }
}
