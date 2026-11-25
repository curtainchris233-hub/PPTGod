import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { getDb, getUserStats, mapPublicUser } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import {
  consumeRateLimit,
  getClientIp,
  peekRateLimit,
  resetRateLimit,
} from "@/lib/rateLimit";
import { parseJsonObject, safeString } from "../../prompts/_validation";

const LOGIN_FAIL_LIMIT = 15;
const LOGIN_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  try {
    const parsedBody = await parseJsonObject(request);
    if (!parsedBody.ok) {
      return NextResponse.json({ error: parsedBody.error }, { status: 400 });
    }
    const body = parsedBody.data;
    const email = safeString(body.email).trim().toLowerCase();
    const password = safeString(body.password);

    if (!email || !password) {
      return NextResponse.json(
        { error: "请输入邮箱和密码" },
        { status: 400 }
      );
    }

    const ip = getClientIp(request);
    const limitKey = `login_fail:${ip}:${email}`;
    const status = peekRateLimit(limitKey, LOGIN_FAIL_LIMIT);
    if (!status.allowed) {
      return NextResponse.json(
        { error: `登录失败次数过多，请 ${status.retryAfterSec} 秒后再试` },
        {
          status: 429,
          headers: { "Retry-After": String(status.retryAfterSec) },
        }
      );
    }

    const db = getDb();
    const row = db
      .prepare(
        `SELECT id, username, display_name, email, password_hash, bio, avatar_color, created_at
         FROM users WHERE email = ? LIMIT 1`
      )
      .get(email) as
      | {
          id: string;
          username: string;
          display_name: string;
          email: string;
          password_hash: string;
          bio: string;
          avatar_color: string;
          created_at: string;
        }
      | undefined;

    if (!row || !verifyPassword(password, row.password_hash)) {
      consumeRateLimit(limitKey, LOGIN_FAIL_LIMIT, LOGIN_WINDOW_MS);
      return NextResponse.json(
        { error: "邮箱或密码不正确" },
        { status: 401 }
      );
    }

    resetRateLimit(limitKey);
    await createSession(row.id);

    return NextResponse.json({
      user: mapPublicUser(row),
      stats: getUserStats(row.id),
    });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "登录失败，请稍后重试" },
      { status: 500 }
    );
  }
}
