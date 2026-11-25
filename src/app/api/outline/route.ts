import { NextResponse } from "next/server";
import { generateOutlineDraft } from "@/lib/deckGenerator";
import {
  isPlainObject,
  sanitizeOutlineItems,
  scrubUpstreamError,
  validateByokApiBase,
} from "@/lib/deckValidation";
import { ALL_SLIDE_TYPES } from "@/types/prompt";
import { safeNumber, safeString } from "../prompts/_validation";

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
    const topic = safeString(body.topic).trim();
    const subtitle = safeString(body.subtitle).trim();
    const audience =
      safeString(body.audience, "核心决策团队").trim() || "核心决策团队";
    const sourceText = safeString(body.sourceText).trim();
    const scenario = safeString(body.scenario, "商业路演").trim() || "商业路演";
    const rawCount = safeNumber(body.slideCount);
    const slideCount = Math.max(
      5,
      Math.min(
        20,
        Number.isFinite(rawCount) && rawCount > 0 ? Math.round(rawCount) : 10
      )
    );
    const mode = body.mode === "llm" ? "llm" : "smart";

    if (!topic) {
      return NextResponse.json(
        { error: "请先输入 PPT 演示主题" },
        { status: 400 }
      );
    }

    if (mode === "llm") {
      if (
        body.apiKey !== undefined &&
        body.apiKey !== null &&
        typeof body.apiKey !== "string"
      ) {
        return NextResponse.json(
          { error: "API Key 格式不合法，请输入字符串" },
          { status: 400 }
        );
      }
      if (
        body.apiBase !== undefined &&
        body.apiBase !== null &&
        typeof body.apiBase !== "string"
      ) {
        return NextResponse.json(
          { error: "API Base URL 格式不合法，请输入有效的 http(s) 地址" },
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
          {
            error:
              "未检测到 API Key：请填入 OpenAI / DeepSeek 兼容 API Key，或切换为「内置语义结构引擎（免 Key）」",
          },
          { status: 400 }
        );
      }

      const baseCheck = validateByokApiBase(rawApiBase);
      if (!baseCheck.ok) {
        return NextResponse.json({ error: baseCheck.error }, { status: 400 });
      }

      const chatEndpoint = `${baseCheck.endpointRoot}/chat/completions`;
      const systemPrompt = `你是一位顶级商业演示文稿策划总监。请根据用户的主题与原始资料，规划一份 ${slideCount} 页的演示文稿大纲，严格只输出合法 JSON 对象：{"outline": [...]}。
每条大纲元素包含：
{
  "id": "outline_1",
  "slideType": "${ALL_SLIDE_TYPES.join('" | "')}",
  "sectionTag": "01 / SECTION",
  "title": "结论性精炼标题（<=26字）",
  "summary": "该页要表达的核心论点或关键数据摘要（20-60字）"
}
要求：第 1 页必须是 cover，最后 1 页必须是 closing，中间灵活穿插多种商业版式（agenda, image-split, process, data, funnel-donut, comparison, swot, timeline, team-grid, quote），严禁连续重复同一版式。`;

      const userContent = `主题：${topic}\n副标题：${subtitle}\n受众：${audience}\n场景：${scenario}\n原始资料：\n${
        sourceText.slice(0, 12000) || "（请结合行业最佳实践自动策划）"
      }`;

      let llmRes: Response;
      try {
        llmRes = await fetch(chatEndpoint, {
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
              { role: "system", content: systemPrompt },
              { role: "user", content: userContent },
            ],
          }),
          signal: AbortSignal.timeout(45000),
        });
      } catch (fetchErr) {
        const isTimeout =
          fetchErr instanceof Error &&
          (fetchErr.name === "TimeoutError" || fetchErr.name === "AbortError");
        return NextResponse.json(
          {
            error: isTimeout
              ? "大模型接口请求超时（45s），请稍后重试或切换「内置语义结构引擎」"
              : "无法连接到大模型接口，请检查 API Base URL 与网络连通性",
          },
          { status: 502 }
        );
      }

      if (!llmRes.ok) {
        const errText = await llmRes.text().catch(() => "");
        return NextResponse.json(
          {
            error: `大模型接口返回错误 (HTTP ${llmRes.status})：${scrubUpstreamError(
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
          { error: "大模型接口返回了非 JSON 响应，请检查配置" },
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
          { error: "大模型返回的大纲不是合法 JSON 格式，请重试或切换免 Key 模式" },
          { status: 502 }
        );
      }

      const outline = sanitizeOutlineItems(
        isPlainObject(parsed) ? parsed.outline ?? parsed.slides : undefined,
        topic
      );
      if (outline.length === 0) {
        return NextResponse.json(
          { error: "大模型未返回有效大纲列表，请重试" },
          { status: 502 }
        );
      }

      return NextResponse.json({ outline, engine: "llm" });
    }

    const routeMode =
      body.routeMode === "beautify-1to1" ? "beautify-1to1" : "restructure";
    const evidenceDensity =
      body.evidenceDensity === "light" ||
      body.evidenceDensity === "high-evidence"
        ? body.evidenceDensity
        : "balanced";

    const outline = generateOutlineDraft({
      topic,
      subtitle,
      audience,
      sourceText,
      slideCount,
      scenario,
      routeMode,
      evidenceDensity,
    });

    return NextResponse.json({ outline, engine: "smart", routeMode, evidenceDensity });
  } catch (err) {
    console.error(
      "Outline API error:",
      err instanceof Error ? err.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "生成可编辑大纲失败，请检查输入参数" },
      { status: 500 }
    );
  }
}
