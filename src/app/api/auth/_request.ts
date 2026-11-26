import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { publicPreviewEnabled } from "@/lib/auth-config";
import { consumeRateLimit, getClientIp, RateLimitUnavailableError } from "@/lib/rateLimit";

export async function authAttemptLimit(request: Request, action: string, limit: number, ms: number) {
  if (publicPreviewEnabled()) {
    return NextResponse.json(
      { error: "游客试用版暂未开放邮箱账号。你可以继续创作并下载演示文稿。" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  const status = await consumeRateLimit(`auth:${action}:${getClientIp(request)}`, limit, ms);
  if (status.allowed) return null;
  return NextResponse.json({ error: "操作过于频繁，请稍后重试" }, {
    status: 429,
    headers: { "Retry-After": String(status.retryAfterSec) },
  });
}

export function authPost(request: Request, path: string, body?: Record<string, string>) {
  const url = new URL(`/api/auth/${path}`, request.url);
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  if (body) headers.set("content-type", "application/json");
  return getAuth().handler(new Request(url, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  }));
}

export function withAuthCookies(response: NextResponse, source: Response) {
  for (const cookie of source.headers.getSetCookie()) {
    response.headers.append("Set-Cookie", cookie);
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function authUnavailable(error: unknown) {
  if (!(error instanceof RateLimitUnavailableError)) console.error("PPTGod account operation failed");
  return NextResponse.json({ error: "账号服务暂时不可用，请稍后重试" }, { status: 503 });
}
