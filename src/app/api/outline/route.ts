import { NextResponse } from "next/server";
import { generatePresentationJson } from "@/lib/presentationAgent";
import { resolveProvider } from "@/lib/providerRequest";
import { limitSiteProvider, limitToolRequest } from "@/lib/toolRateLimit";
import { generateOutlineDraft } from "@/lib/deckGenerator";
import {
  isPlainObject,
  sanitizeOutlineItems,
} from "@/lib/deckValidation";
import { ALL_SLIDE_TYPES } from "@/types/prompt";
import { safeNumber, safeString } from "../prompts/_validation";

export async function POST(request: Request) {
  const limited = await limitToolRequest(request, "outline", 24);
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

      const provider = resolveProvider(
        {
          apiKey: safeString(body.apiKey).trim(),
          apiBase: safeString(body.apiBase).trim(),
          model: safeString(body.model).trim(),
        },
        "text",
        "未检测到 API Key：请填入 OpenAI / DeepSeek 兼容 API Key，或切换为「内置语义结构引擎（免 Key）」"
      );
      if (!provider.ok) {
        return NextResponse.json({ error: provider.error }, { status: 400 });
      }
      if (provider.config.usesSiteKey) {
        const limit = await limitSiteProvider(request, "text");
        if (limit) return limit;
      }

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

      const result = await generatePresentationJson({
        task: "outline",
        config: provider.config,
        instructions: systemPrompt,
        input: userContent,
        requestSignal: request.signal,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 502 });
      }
      const parsed = result.data;

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
