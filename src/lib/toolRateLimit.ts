import { NextResponse } from "next/server";
import { consumeRateLimit, getClientIp, RateLimitUnavailableError } from "@/lib/rateLimit";

export async function limitToolRequest(
  request: Request,
  tool: string,
  requestsPerMinute: number
) {
  return limitRequest(`tool:${tool}:${getClientIp(request)}`, requestsPerMinute, 60_000);
}

export async function limitSiteProvider(request: Request, kind: "text" | "image") {
  const dailyLimit = kind === "image" ? 20 : 80;
  const dailyLimitPerClient = kind === "image" ? 4 : 16;
  return (
    await limitRequest(`site-provider:${kind}:${getClientIp(request)}`, dailyLimitPerClient, 86_400_000) ??
    await limitRequest(`site-provider:${kind}`, dailyLimit, 86_400_000)
  );
}

export async function limitRequest(key: string, count: number, windowMs: number) {
  try {
    const result = await consumeRateLimit(key, count, windowMs);
    if (!result.allowed) {
      return NextResponse.json(
        { error: "当前使用次数已达上限，请稍后重试" },
        { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } }
      );
    }
  } catch (err) {
    if (!(err instanceof RateLimitUnavailableError)) throw err;
    return NextResponse.json(
      { error: "服务暂时不可用，请稍后重试" },
      { status: 503, headers: { "Retry-After": "10" } }
    );
  }
  return null;
}
