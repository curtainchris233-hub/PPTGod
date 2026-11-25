import { NextResponse } from "next/server";
import {
  isPlainObject,
  isValidImageDataUrl,
  scrubUpstreamError,
  validateByokApiBase,
} from "@/lib/deckValidation";
import { safeString } from "../prompts/_validation";

const ALLOWED_SIZES = new Set(["1024x1024", "1792x1024", "1024x1792", "512x512"]);

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
    const prompt = safeString(body.prompt).trim();
    if (!prompt) {
      return NextResponse.json(
        { error: "请输入配图提示词（prompt）" },
        { status: 400 }
      );
    }

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
      safeString(body.apiKey).trim() ||
      process.env.OPENAI_IMAGE_API_KEY ||
      process.env.OPENAI_API_KEY ||
      "";
    const rawApiBase =
      safeString(body.apiBase).trim() ||
      process.env.OPENAI_BASE_URL ||
      "https://api.openai.com/v1";
    const model =
      safeString(body.model).trim() ||
      process.env.OPENAI_IMAGE_MODEL ||
      "dall-e-3";
    const rawSize = safeString(body.size, "1024x1024").trim();
    const size = ALLOWED_SIZES.has(rawSize) ? rawSize : "1024x1024";

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "未检测到 AI 生图 API Key：请填入 OpenAI Image 兼容 API Key，或使用「12 套免 Key 矢量艺术图」/「本地图片上传」/「一键复制即梦提示词」",
        },
        { status: 400 }
      );
    }

    const baseCheck = validateByokApiBase(rawApiBase);
    if (!baseCheck.ok) {
      return NextResponse.json({ error: baseCheck.error }, { status: 400 });
    }

    const endpoint = `${baseCheck.endpointRoot}/images/generations`;

    let imgRes: Response;
    try {
      imgRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt: prompt.slice(0, 2000),
          n: 1,
          size,
          response_format: "b64_json",
        }),
        signal: AbortSignal.timeout(60000),
      });
    } catch (fetchErr) {
      const isTimeout =
        fetchErr instanceof Error &&
        (fetchErr.name === "TimeoutError" || fetchErr.name === "AbortError");
      return NextResponse.json(
        {
          error: isTimeout
            ? "AI 生图接口请求超时（60s），请稍后重试"
            : "无法连接 AI 生图接口，请检查 API Base URL 与网络连通性",
        },
        { status: 502 }
      );
    }

    if (!imgRes.ok) {
      const errText = await imgRes.text().catch(() => "");
      return NextResponse.json(
        {
          error: `AI 生图接口返回错误 (HTTP ${imgRes.status})：${scrubUpstreamError(
            errText,
            apiKey
          )}`,
        },
        { status: 502 }
      );
    }

    let imgJson: unknown;
    try {
      imgJson = await imgRes.json();
    } catch {
      return NextResponse.json(
        { error: "AI 生图接口返回了非 JSON 响应" },
        { status: 502 }
      );
    }

    const dataArr =
      isPlainObject(imgJson) && Array.isArray(imgJson.data)
        ? imgJson.data
        : [];
    const firstItem = isPlainObject(dataArr[0]) ? dataArr[0] : null;
    const b64 =
      firstItem && typeof firstItem.b64_json === "string"
        ? firstItem.b64_json.trim()
        : "";

    let dataUrl = "";
    if (b64) {
      dataUrl = b64.startsWith("data:image/")
        ? b64
        : `data:image/png;base64,${b64}`;
    } else if (
      firstItem &&
      typeof firstItem.url === "string" &&
      isValidImageDataUrl(firstItem.url)
    ) {
      dataUrl = firstItem.url.trim();
    }

    if (!dataUrl || !isValidImageDataUrl(dataUrl)) {
      return NextResponse.json(
        {
          error:
            "AI 生图接口未返回有效的 Base64 图像数据（b64_json），请确认接口支持 response_format=b64_json",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      dataUrl,
      engine: "byok-image",
    });
  } catch (err) {
    console.error(
      "Generate Image API error:",
      err instanceof Error ? err.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "AI 生图过程中发生异常，请稍后重试" },
      { status: 500 }
    );
  }
}
