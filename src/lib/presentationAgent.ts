import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { Agent } from "@mastra/core/agent";
import {
  createProviderTransport,
  getProviderError,
  type ProviderConfig,
} from "@/lib/providerRequest";

type AgentTask = "outline" | "generate" | "polish";

const TASK_SETTINGS = {
  outline: { name: "Presentation outline", temperature: 0.45, timeoutMs: 45_000, maxOutputTokens: 6000 },
  generate: { name: "Presentation slides", temperature: 0.5, timeoutMs: 45_000, maxOutputTokens: 16_000 },
  polish: { name: "Presentation slide editor", temperature: 0.45, timeoutMs: 35_000, maxOutputTokens: 2500 },
} as const;

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
  let providerError: string | undefined;
  try {
    const provider = createOpenAICompatible({
      name: "pptgod-openai-compatible",
      baseURL: config.endpointRoot,
      apiKey: config.apiKey,
      transformRequestBody: (body) => ({ ...body, response_format: { type: "json_object" } }),
      fetch: async (url, init) => {
        const response = await transport.fetch(String(url), init);
        if (!response.ok) {
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
        temperature: settings.temperature,
        maxOutputTokens: settings.maxOutputTokens,
        maxRetries: 0,
      },
    });
    const content = result.text.trim();
    if (!content) return { ok: false, error: "大模型返回内容为空，请重试或切换免 Key 模式" };

    const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
    try {
      const data: unknown = JSON.parse((fence?.[1] ?? content).trim());
      return { ok: true, data };
    } catch {
      return { ok: false, error: "大模型返回的内容不是合法 JSON 格式，请重试或切换免 Key 模式" };
    }
  } catch {
    return {
      ok: false,
      error: providerError ?? (timeout.aborted
        ? "大模型接口请求超时，请稍后重试或切换免 Key 模式"
        : "无法读取大模型接口响应，请检查 API Base URL、模型与网络连通性"),
    };
  } finally {
    await transport.close();
  }
}
