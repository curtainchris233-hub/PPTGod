import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { Agent } from "@mastra/core/agent";
import {
  createProviderTransport,
  getProviderError,
  type ProviderConfig,
} from "@/lib/providerRequest";

type AgentTask = "outline" | "generate" | "polish" | "promptpack";

const TASK_SETTINGS = {
  outline: { name: "Presentation outline", temperature: 0.45, timeoutMs: 45_000, maxOutputTokens: 6000 },
  generate: { name: "Presentation slides", temperature: 0.5, timeoutMs: 45_000, maxOutputTokens: 16_000 },
  polish: { name: "Presentation slide editor", temperature: 0.45, timeoutMs: 35_000, maxOutputTokens: 2500 },
  promptpack: { name: "Presentation prompt pack", temperature: 0.5, timeoutMs: 60_000, maxOutputTokens: 10_000 },
} as const;

const NO_JSON_FORMAT_RE =
  /(?:^|\/)(?:o1|o3|o4|deepseek-reasoner|deepseek-r1|qwq|claude)(?:[-_.]|$)/i;

export function supportsJsonObjectFormat(model: string): boolean {
  return !NO_JSON_FORMAT_RE.test(model.trim());
}

/**
 * Robustly extract a JSON object/array from LLM output:
 * 1. Strip `<think>...</think>` reasoning blocks emitted by DeepSeek-R1 / QwQ / proxies.
 * 2. Prefer fenced ```json ... ``` blocks when present.
 * 3. Fall back to slicing from the first `{` (or `[`) to the matching last `}` (or `]`).
 */
export function extractJsonText(raw: string): string {
  const withoutThink = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fence = withoutThink.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fence?.[1] ?? withoutThink).trim();
  if (candidate.startsWith("{") || candidate.startsWith("[")) {
    return candidate;
  }
  const firstObj = candidate.indexOf("{");
  const lastObj = candidate.lastIndexOf("}");
  if (firstObj !== -1 && lastObj > firstObj) {
    return candidate.slice(firstObj, lastObj + 1).trim();
  }
  const firstArr = candidate.indexOf("[");
  const lastArr = candidate.lastIndexOf("]");
  if (firstArr !== -1 && lastArr > firstArr) {
    return candidate.slice(firstArr, lastArr + 1).trim();
  }
  return candidate;
}

export async function generatePresentationJson({
  task,
  config,
  instructions,
  input,
  requestSignal,
}: {
  task: AgentTask;
  config: ProviderConfig;
  instructions: string;
  input: string;
  requestSignal: AbortSignal;
}): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const settings = TASK_SETTINGS[task];
  const timeout = AbortSignal.timeout(settings.timeoutMs);
  const transport = createProviderTransport(config.endpointRoot);
  const runOnce = async (useJsonFormat: boolean) => {
    let providerError: string | undefined;
    let statusCode: number | undefined;
    try {
      const provider = createOpenAICompatible({
        name: "pptgod-openai-compatible",
        baseURL: config.endpointRoot,
        apiKey: config.apiKey,
        ...(useJsonFormat
          ? {
              transformRequestBody: (body: Record<string, unknown>) => ({
                ...body,
                response_format: { type: "json_object" },
              }),
            }
          : {}),
        fetch: async (url, init) => {
          const response = await transport.fetch(String(url), init);
          if (!response.ok) {
            statusCode = response.status;
            providerError = await getProviderError(response, config.apiKey);
            // Keep provider errors out of the agent's diagnostic output.
            throw new Error("Model request failed");
          }
          return response;
        },
      });
      const agent = new Agent({
        id: `pptgod-${task}`,
        name: settings.name,
        instructions,
        model: provider.chatModel(config.model),
      });
      const result = await agent.generate(input, {
        abortSignal: AbortSignal.any([timeout, requestSignal]),
        maxSteps: 1,
        modelSettings: {
          ...(supportsJsonObjectFormat(config.model) ? { temperature: settings.temperature } : {}),
          maxOutputTokens: settings.maxOutputTokens,
          maxRetries: 0,
        },
      });
      return { ok: true as const, text: result.text.trim() };
    } catch {
      return { ok: false as const, providerError, statusCode };
    }
  };

  try {
    const preferJson = supportsJsonObjectFormat(config.model);
    let attempt = await runOnce(preferJson);
    if (
      !attempt.ok &&
      preferJson &&
      attempt.statusCode === 400 &&
      /response_format|json_object/i.test(attempt.providerError ?? "")
    ) {
      attempt = await runOnce(false);
    }

    if (!attempt.ok) {
      return {
        ok: false,
        error:
          attempt.providerError ??
          (timeout.aborted
            ? "大模型接口请求超时，请稍后重试或切换免 Key 模式"
            : "无法读取大模型接口响应，请检查 API Base URL、模型与网络连通性"),
      };
    }

    if (!attempt.text) {
      return { ok: false, error: "大模型返回内容为空，请重试或切换免 Key 模式" };
    }

    try {
      const data: unknown = JSON.parse(extractJsonText(attempt.text));
      return { ok: true, data };
    } catch {
      return { ok: false, error: "大模型返回的内容不是合法 JSON 格式，请重试或切换免 Key 模式" };
    }
  } finally {
    await transport.close();
  }
}
