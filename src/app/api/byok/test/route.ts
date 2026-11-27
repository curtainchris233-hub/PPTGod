import { NextResponse } from "next/server";
import { isPlainObject } from "@/lib/deckValidation";
import {
  createProviderTransport,
  getProviderError,
  resolveProvider,
} from "@/lib/providerRequest";
import { limitToolRequest } from "@/lib/toolRateLimit";
import { safeString } from "../../prompts/_validation";

export const maxDuration = 20;

const TEST_TIMEOUT_MS = 12_000;
const REASONING_MODEL_RE = /(?:^|\/)(?:o1|o3|o4)(?:[-_.]|$)/i;

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  const limited = await limitToolRequest(request, "byok-test", 12);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!isPlainObject(parsed)) {
      return json(400, { ok: false, error: "请求体不是合法的 JSON 格式" });
    }
    body = parsed;
  } catch {
    return json(400, { ok: false, error: "请求体不是合法的 JSON 格式" });
  }

  for (const key of ["apiKey", "apiBase", "model"] as const) {
    const v = body[key];
    if (v !== undefined && v !== null && typeof v !== "string") {
      return json(400, { ok: false, error: `${key} 格式不合法，请输入字符串` });
    }
  }

  const apiKey = safeString(body.apiKey).trim();
  const apiBase = safeString(body.apiBase).trim();
  const model = safeString(body.model).trim();

  if (!apiKey) {
    return json(400, { ok: false, error: "请先填写 API Key 后再测试连接" });
  }

  const resolved = resolveProvider(
    { apiKey, apiBase, model },
    "text",
    "请先填写 API Key 后再测试连接"
  );
  if (!resolved.ok) {
    return json(400, { ok: false, error: resolved.error });
  }

  const { config } = resolved;
  const startedAt = Date.now();
  const timeout = AbortSignal.timeout(TEST_TIMEOUT_MS);
  const transport = createProviderTransport(config.endpointRoot);
  try {
    const tokenField = REASONING_MODEL_RE.test(config.model)
      ? { max_completion_tokens: 16 }
      : { max_tokens: 16 };
    const response = await transport.fetch(
      `${config.endpointRoot}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        signal: AbortSignal.any([timeout, request.signal]),
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: "user", content: "Reply OK" }],
          ...tokenField,
        }),
      }
    );

    if (!response.ok) {
      const error = await getProviderError(response, config.apiKey);
      return json(200, { ok: false, error });
    }

    // Consume minimal body to confirm valid JSON payload without echoing secrets.
    await response.json().catch(() => null);
    return json(200, {
      ok: true,
      model: config.model,
      latencyMs: Math.max(1, Date.now() - startedAt),
    });
  } catch {
    return json(200, {
      ok: false,
      error: timeout.aborted
        ? "连接超时（>12 秒），请检查 API Base URL 与网络连通性"
        : "无法连接到该模型接口，请检查 API Base URL、模型名与网络连通性",
    });
  } finally {
    await transport.close();
  }
}
