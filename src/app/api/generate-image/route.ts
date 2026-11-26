import { NextResponse } from "next/server";
import {
  isPlainObject,
  VALID_IMAGE_DATA_URL_RE,
} from "@/lib/deckValidation";
import { createProviderTransport, getProviderError, resolveProvider } from "@/lib/providerRequest";
import { limitSiteProvider, limitToolRequest } from "@/lib/toolRateLimit";
import { safeString } from "../prompts/_validation";

const ALLOWED_SIZES = new Set(["1024x1024", "1792x1024", "1024x1792", "512x512"]);
const MAX_PROVIDER_IMAGE_CHARS = 4_000_000;

function isProviderImage(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_PROVIDER_IMAGE_CHARS && VALID_IMAGE_DATA_URL_RE.test(value);
}

export async function POST(request: Request) {
  const limited = await limitToolRequest(request, "image", 8);
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

    const provider = resolveProvider(
      {
        apiKey: safeString(body.apiKey).trim(),
        apiBase: safeString(body.apiBase).trim(),
        model: safeString(body.model).trim(),
      },
      "image",
      "未检测到 AI 生图 API Key：请填入 OpenAI Image 兼容 API Key，或使用「12 套免 Key 矢量艺术图」/「本地图片上传」/「一键复制即梦提示词」"
    );
    if (!provider.ok) {
      return NextResponse.json({ error: provider.error }, { status: 400 });
    }
    if (provider.config.usesSiteKey) {
      const limit = await limitSiteProvider(request, "image");
      if (limit) return limit;
    }

    const { apiKey, endpointRoot, model } = provider.config;
    const rawSize = safeString(body.size, "1024x1024").trim();
    const size = ALLOWED_SIZES.has(rawSize) ? rawSize : "1024x1024";
    const timeout = AbortSignal.timeout(60_000);
    const transport = createProviderTransport(endpointRoot);
    let imgJson: unknown;
    try {
      const response = await transport.fetch(`${endpointRoot}/images/generations`, {
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
          ...(!model.startsWith("gpt-image-") ? { response_format: "b64_json" } : {}),
        }),
        signal: AbortSignal.any([timeout, request.signal]),
      });
      if (!response.ok) {
        const error = await getProviderError(response, apiKey);
        return NextResponse.json({ error }, { status: 502 });
      }

      try {
        imgJson = await response.json();
      } catch {
        return NextResponse.json(
          { error: "AI 生图接口未返回可读取的图像数据" },
          { status: 502 }
        );
      }
    } catch {
      return NextResponse.json(
        {
          error: timeout.aborted
            ? "AI 生图接口请求超时（60s），请稍后重试"
            : "无法连接 AI 生图接口，请检查 API Base URL 与网络连通性",
        },
        { status: 502 }
      );
    } finally {
      await transport.close();
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
      isProviderImage(firstItem.url.trim())
    ) {
      dataUrl = firstItem.url.trim();
    }

    if (!isProviderImage(dataUrl)) {
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
