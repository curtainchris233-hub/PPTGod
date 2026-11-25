import { NextResponse } from "next/server";
import { polishSlideContent, type PolishAction } from "@/lib/deckGenerator";
import {
  isPlainObject,
  sanitizeLlmSlide,
  scrubUpstreamError,
  validateByokApiBase,
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

      const apiKey =
        safeString(body.apiKey).trim() || process.env.OPENAI_API_KEY || "";
      const rawApiBase =
        safeString(body.apiBase).trim() ||
        process.env.OPENAI_BASE_URL ||
        "https://api.openai.com/v1";
      const model =
        safeString(body.model).trim() ||
        process.env.OPENAI_MODEL ||
        "gpt-4o-mini";

      if (!apiKey) {
        return NextResponse.json(
          { error: "未检测到 API Key，请填入 Key 或使用免 Key 智能润色模式" },
          { status: 400 }
        );
      }

      const baseCheck = validateByokApiBase(rawApiBase);
      if (!baseCheck.ok) {
        return NextResponse.json({ error: baseCheck.error }, { status: 400 });
      }

      // Strip potentially large image dataUrl before sending to text LLM
      const promptSlideCopy: DeckSlideItem = structuredClone(baseSlide);
      if (promptSlideCopy.imageSlot?.dataUrl) {
        promptSlideCopy.imageSlot = {
          ...promptSlideCopy.imageSlot,
          dataUrl: undefined,
        };
      }

      let llmRes: Response;
      try {
        llmRes = await fetch(`${baseCheck.endpointRoot}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            temperature: 0.45,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: `你是一位资深商业 PPT 润色专家。任务：${ACTION_INSTRUCTIONS[action]}。严格返回 JSON 对象 {"slide": { ...与输入字段结构兼容的单页对象... }}，不要更改 id 与 slideType。`,
              },
              {
                role: "user",
                content: JSON.stringify({ slide: promptSlideCopy }),
              },
            ],
          }),
          signal: AbortSignal.timeout(35000),
        });
      } catch (fetchErr) {
        const isTimeout =
          fetchErr instanceof Error &&
          (fetchErr.name === "TimeoutError" || fetchErr.name === "AbortError");
        return NextResponse.json(
          {
            error: isTimeout
              ? "大模型润色请求超时，请稍后重试或切换免 Key 模式"
              : "无法连接大模型接口，请检查 API Base URL",
          },
          { status: 502 }
        );
      }

      if (!llmRes.ok) {
        const errText = await llmRes.text().catch(() => "");
        return NextResponse.json(
          {
            error: `大模型润色失败 (HTTP ${llmRes.status})：${scrubUpstreamError(
              errText,
              apiKey
            )}`,
          },
          { status: 502 }
        );
      }

      let llmJson: unknown;
      try {
        llmJson = await llmRes.json();
      } catch {
        return NextResponse.json(
          { error: "大模型返回非 JSON 响应" },
          { status: 502 }
        );
      }

      const choices = isPlainObject(llmJson) ? llmJson.choices : undefined;
      const firstChoice = Array.isArray(choices) ? choices[0] : undefined;
      const message = isPlainObject(firstChoice)
        ? firstChoice.message
        : undefined;
      const rawContent =
        isPlainObject(message) && typeof message.content === "string"
          ? message.content.trim()
          : "";
      const fenceMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const candidate = (fenceMatch ? fenceMatch[1] : rawContent).trim();

      let parsed: unknown;
      try {
        parsed = JSON.parse(candidate);
      } catch {
        return NextResponse.json(
          { error: "大模型返回的润色结果不是合法 JSON" },
          { status: 502 }
        );
      }

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
