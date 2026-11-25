import { NextResponse } from "next/server";
import { generateStructuredDeck } from "@/lib/deckGenerator";
import {
  isPlainObject,
  sanitizeLlmSlide,
  sanitizeOutlineItems,
  scrubUpstreamError,
  validateByokApiBase,
} from "@/lib/deckValidation";
import {
  ALL_SLIDE_TYPES,
  type LayoutArchetype,
} from "@/types/prompt";
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
    const archetype = safeString(body.archetype).trim() as
      | LayoutArchetype
      | "";
    const rawCount = safeNumber(body.slideCount);
    const slideCount = Math.max(
      5,
      Math.min(
        20,
        Number.isFinite(rawCount) && rawCount > 0 ? Math.round(rawCount) : 7
      )
    );
    const outline = Array.isArray(body.outline)
      ? sanitizeOutlineItems(body.outline, topic || "演示文稿")
      : undefined;
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
              "未检测到 API Key：请在下方填入 OpenAI / DeepSeek 兼容 API Key，或切换为「内置语义结构引擎（免 Key）」",
          },
          { status: 400 }
        );
      }

      const baseCheck = validateByokApiBase(rawApiBase);
      if (!baseCheck.ok) {
        return NextResponse.json({ error: baseCheck.error }, { status: 400 });
      }

      const chatEndpoint = `${baseCheck.endpointRoot}/chat/completions`;
      const effectiveCount =
        outline && outline.length > 0 ? outline.length : slideCount;

      const systemPrompt = `你是一位顶级商业演示文稿架构师。请根据用户提供的主题、背景素材${
        outline && outline.length > 0 ? "与已确认的大纲结构" : ""
      }，规划一套包含 ${effectiveCount} 页的 16:9 演示文稿，并严格只输出合法的 JSON 对象：{"slides": [...]}。
每页 slide 必须符合以下 TypeScript 结构：
{
  "id": "slide_1",
  "slideType": "${ALL_SLIDE_TYPES.join('" | "')}",
  "sectionTag": "01 / SECTION",
  "title": "结论性精炼标题（<=26字）",
  "subtitle": "可选副标题",
  "bullets": ["当 slideType 为 image-split 时的 3 条核心卖点"],
  "imageSlot": {"kind":"svg-preset","presetId":"swiss-geometry","caption":"配图说明","layout":"left","promptHint":"配图美术提示"},
  "swot": {"strengths":["优势1","优势2"],"weaknesses":["劣势1","劣势2"],"opportunities":["机会1","机会2"],"threats":["威胁1","威胁2"]},
  "chartMode": "funnel" | "donut",
  "funnelStages": [{"label":"阶段名","value":1000,"unit":"人","note":"转化率说明"}],
  "teamMembers": [{"name":"姓名","role":"职衔","bio":"精炼履历","badge":"ARCH"}],
  "quoteText": "当 slideType 为 quote 时的核心洞察金句",
  "quoteAuthor": "金句署名",
  "leftTitle": "当 slideType 为 comparison 时左栏标题",
  "leftPoints": ["痛点1", "痛点2", "痛点3"],
  "rightTitle": "当 slideType 为 comparison 时右栏推荐方案标题",
  "rightPoints": ["优势1", "优势2", "优势3"],
  "kpis": [{"label":"指标名","value":"+140%","note":"简短说明"}],
  "bars": [{"label":"Q1","v1":45,"v2":68},{"label":"Q2","v1":52,"v2":85},{"label":"Q3","v1":60,"v2":102},{"label":"Q4","v1":68,"v2":124}],
  "steps": [{"code":"01","title":"模块名","desc":"20-35字说明"}],
  "speakerNotes": "50-90字自然口语演讲串词"
}
要求：第一页必须是 cover，最后一页必须是 closing，中间各页灵活组合 12 种商业版式，绝不重复单调模板。`;

      const outlineHint =
        outline && outline.length > 0
          ? `\n\n请严格按照以下已确认大纲逐页展开（共 ${outline.length} 页）：\n${outline
              .map(
                (o, i) =>
                  `${i + 1}. [${o.slideType}] ${o.title} — ${o.summary}`
              )
              .join("\n")}`
          : "";

      const userContent = `主题：${topic}\n副标题：${subtitle}\n受众：${audience}\n场景：${scenario}\n参考原始素材：\n${
        sourceText.slice(0, 12000) || "（请结合行业最佳实践自动充实高质量数据与论据）"
      }${outlineHint}`;

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
            temperature: 0.5,
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
        const safeSnippet = scrubUpstreamError(errText, apiKey);
        return NextResponse.json(
          {
            error: `大模型接口返回错误 (HTTP ${llmRes.status})：${safeSnippet}`,
          },
          { status: 502 }
        );
      }

      let llmJson: unknown;
      try {
        llmJson = await llmRes.json();
      } catch {
        return NextResponse.json(
          {
            error:
              "大模型接口返回了非 JSON 响应，请检查 API Base URL 或切换「内置语义结构引擎」",
          },
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

      if (!rawContent) {
        return NextResponse.json(
          {
            error:
              "大模型返回内容为空，请重试或切换「内置语义结构引擎」",
          },
          { status: 502 }
        );
      }

      const fenceMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const candidate = (fenceMatch ? fenceMatch[1] : rawContent).trim();

      let parsed: unknown;
      try {
        parsed = JSON.parse(candidate);
      } catch {
        return NextResponse.json(
          {
            error:
              "大模型返回的内容不是合法 JSON 格式，请重试或切换「内置语义结构引擎」",
          },
          { status: 502 }
        );
      }

      const rawSlides =
        isPlainObject(parsed) && Array.isArray(parsed.slides)
          ? parsed.slides.filter(isPlainObject).slice(0, 20)
          : [];

      if (rawSlides.length === 0) {
        return NextResponse.json(
          {
            error:
              "大模型未返回有效的幻灯片列表，请重试或切换「内置语义结构引擎」",
          },
          { status: 502 }
        );
      }

      const slides = rawSlides.map((s, idx) =>
        sanitizeLlmSlide(s, idx, rawSlides.length, topic)
      );

      return NextResponse.json({
        slides,
        engine: "llm",
      });
    }

    const slides = generateStructuredDeck({
      topic,
      subtitle,
      audience,
      sourceText,
      slideCount,
      scenario,
      archetype: archetype || undefined,
      outline: outline && outline.length > 0 ? outline : undefined,
    });

    return NextResponse.json({ slides, engine: "smart" });
  } catch (err) {
    console.error(
      "Generate Deck API error:",
      err instanceof Error ? err.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "生成演示文稿大纲失败，请检查输入参数" },
      { status: 500 }
    );
  }
}
