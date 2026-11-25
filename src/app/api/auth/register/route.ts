import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { getDb, getUserStats, mapPublicUser } from "@/lib/db";
import { generateToken, hashPassword } from "@/lib/password";
import { consumeRateLimit, getClientIp } from "@/lib/rateLimit";
import { parseJsonObject, safeString } from "../../prompts/_validation";

const REGISTER_LIMIT_PER_MIN = 40;
const AVATAR_COLORS = [
  "#C84B31",
  "#0F766E",
  "#1D4ED8",
  "#9D174D",
  "#B45309",
  "#3F6212",
  "#1E3A5F",
];

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = consumeRateLimit(
      `register:${ip}`,
      REGISTER_LIMIT_PER_MIN,
      60_000
    );
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `注册请求过于频繁，请 ${limit.retryAfterSec} 秒后再试` },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSec) },
        }
      );
    }

    const parsedBody = await parseJsonObject(request);
    if (!parsedBody.ok) {
      return NextResponse.json({ error: parsedBody.error }, { status: 400 });
    }
    const body = parsedBody.data;
    const displayName = safeString(body.displayName).trim();
    const email = safeString(body.email).trim().toLowerCase();
    const password = safeString(body.password);
    const bio = safeString(body.bio).trim().slice(0, 140);

    if (displayName.length < 2 || displayName.length > 32) {
      return NextResponse.json(
        { error: "昵称长度需在 2 到 32 个字符之间" },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "请输入有效的邮箱地址" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "密码长度至少需要 6 位" },
        { status: 400 }
      );
    }

    const db = getDb();
    const existing = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(email);
    if (existing) {
      return NextResponse.json(
        { error: "该邮箱已被注册，请直接登录" },
        { status: 409 }
      );
    }

    const id = `user_${generateToken(8)}`;
    const baseUsername = email
      .split("@")[0]
      .replace(/[^a-zA-Z0-9_]/g, "")
      .slice(0, 16) || "creator";
    const username = `${baseUsername}_${generateToken(2)}`;
    const avatarColor =
      AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO users (id, username, display_name, email, password_hash, bio, avatar_color, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      username,
      displayName,
      email,
      hashPassword(password),
      bio || "PPT 提示词创作者",
      avatarColor,
      now
    );

    await createSession(id);

    const user = mapPublicUser({
      id,
      username,
      display_name: displayName,
      bio: bio || "PPT 提示词创作者",
      avatar_color: avatarColor,
      created_at: now,
    });

    return NextResponse.json(
      { user, stats: getUserStats(id) },
      { status: 201 }
    );
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json(
      { error: "注册失败，请稍后重试" },
      { status: 500 }
    );
  }
}
