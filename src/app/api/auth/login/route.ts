import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, getUserStats, mapPublicUser } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { consumeRateLimit, resetRateLimit } from "@/lib/rateLimit";
import { canSignInWithEmail } from "@/lib/seed-accounts";
import { parseJsonObject, safeString } from "../../prompts/_validation";
import { authAttemptLimit, authPost, authUnavailable, withAuthCookies } from "../_request";

function invalidCredentials() {
  return NextResponse.json({ error: "邮箱或密码不正确" }, { status: 401 });
}

export async function POST(request: Request) {
  try {
    const limited = await authAttemptLimit(request, "login", 25, 60_000);
    if (limited) return limited;

    const parsed = await parseJsonObject(request);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const email = safeString(parsed.data.email).trim().toLowerCase();
    const password = safeString(parsed.data.password);
    if (!email || email.length > 254 || !password || password.length > 128) {
      return NextResponse.json({ error: "请输入有效的邮箱和密码" }, { status: 400 });
    }
    if (!canSignInWithEmail(email)) return invalidCredentials();

    const limitKey = `auth:login-email:${email}`;
    const limit = await consumeRateLimit(limitKey, 15, 60_000);
    if (!limit.allowed) {
      return NextResponse.json({ error: "登录请求过于频繁，请稍后重试" }, {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSec) },
      });
    }

    const response = await authPost(request, "sign-in/email", { email, password });
    if (!response.ok) {
      const { code } = await response.json().catch(() => ({}));
      if (code === "EMAIL_NOT_VERIFIED") {
        return NextResponse.json({ error: "请先验证邮箱，或重新发送验证邮件。", code }, { status: 403 });
      }
      if (response.status === 401 || response.status === 422) return invalidCredentials();
      if (response.status >= 500) return authUnavailable(null);
      return NextResponse.json({ error: "登录请求失败，请稍后重试", code }, { status: response.status });
    }

    const { user } = await response.json();
    const [row] = await getDb().select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!row) return authUnavailable(null);
    await resetRateLimit(limitKey).catch(() => undefined);
    return withAuthCookies(NextResponse.json({ user: mapPublicUser(row), stats: await getUserStats(row.id) }), response);
  } catch (error) {
    return authUnavailable(error);
  }
}
