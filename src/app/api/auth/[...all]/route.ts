import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getAuthMailConfig } from "@/lib/auth-config";
import { SEED_ACCOUNT_ADDRESSES } from "@/lib/seed-accounts";
import { authAttemptLimit, authPost, authUnavailable } from "../_request";
import { parseJsonObject, safeString } from "../../prompts/_validation";

type AuthContext = { params: Promise<{ all: string[] }> };

export async function GET(request: Request, { params }: AuthContext) {
  const path = (await params).all;
  const valid = path.length === 1 && path[0] === "verify-email"
    || path.length === 2 && path[0] === "reset-password";
  if (!valid) return new Response(null, { status: 404 });
  try {
    const limited = await authAttemptLimit(request, "email-link", 45, 60_000);
    return limited ?? await getAuth().handler(request);
  } catch (error) {
    return authUnavailable(error);
  }
}

export async function POST(request: Request, { params }: AuthContext) {
  const path = (await params).all.join("/");
  if (!["send-verification-email", "request-password-reset", "reset-password"].includes(path)) {
    return new Response(null, { status: 404 });
  }

  try {
    const limited = await authAttemptLimit(request, path, 6, 15 * 60_000);
    if (limited) return limited;
    if (!getAuthMailConfig()) {
      return NextResponse.json({ error: "邮箱服务暂时不可用" }, { status: 503 });
    }

    const parsed = await parseJsonObject(request);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    if (path === "reset-password") {
      const token = safeString(parsed.data.token);
      const newPassword = safeString(parsed.data.newPassword);
      if (newPassword.length < 8 || newPassword.length > 128) {
        return NextResponse.json({ error: "密码长度需在 8 到 128 位之间" }, { status: 400 });
      }
      return await authPost(request, path, { token, newPassword });
    }

    const email = safeString(parsed.data.email).trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "请输入有效的邮箱地址" }, { status: 400 });
    }
    // These public attribution accounts cannot acquire a password via email.
    if (SEED_ACCOUNT_ADDRESSES.has(email)) return NextResponse.json({ status: true });

    const response = await authPost(request, path, path === "send-verification-email"
      ? { email, callbackURL: "/account/verify-email" }
      : { email, redirectTo: "/account/reset-password" });
    if (response.status >= 500) return authUnavailable(null);
    return response;
  } catch (error) {
    return authUnavailable(error);
  }
}
