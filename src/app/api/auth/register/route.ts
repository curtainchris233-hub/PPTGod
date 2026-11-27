import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAuthMailConfig } from "@/lib/auth-config";
import { getDb, getUserStats, mapPublicUser } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { parseJsonObject, safeString } from "../../prompts/_validation";
import { authAttemptLimit, authPost, authUnavailable, withAuthCookies } from "../_request";

export async function POST(request: Request) {
  try {
    const limited = await authAttemptLimit(request, "register", 8, 15 * 60_000);
    if (limited) return limited;

    const parsed = await parseJsonObject(request);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const displayName = safeString(parsed.data.displayName).trim();
    const email = safeString(parsed.data.email).trim().toLowerCase();
    const password = safeString(parsed.data.password);
    const bio = safeString(parsed.data.bio).trim().slice(0, 140);

    if (displayName.length < 2 || displayName.length > 32) {
      return NextResponse.json({ error: "昵称长度需在 2 到 32 个字符之间" }, { status: 400 });
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "请输入有效的邮箱地址" }, { status: 400 });
    }
    if (password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: "密码长度需在 8 到 128 位之间" }, { status: 400 });
    }

    const verificationRequired = Boolean(getAuthMailConfig());
    const response = await authPost(request, "sign-up/email", {
      name: displayName,
      email,
      password,
      bio: bio || "PPT 提示词创作者",
      callbackURL: "/account/verify-email",
    });
    if (!response.ok) {
      const { code } = await response.json().catch(() => ({}));
      const duplicate = code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL";
      const error = duplicate ? "该邮箱已被注册，请直接登录" : "注册失败，请检查填写的信息";
      return NextResponse.json({ error, code }, { status: duplicate ? 409 : response.status });
    }
    if (verificationRequired) {
      return NextResponse.json({ verificationRequired }, { status: 201 });
    }

    const { user } = await response.json();
    const [row] = await getDb().select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!row) return authUnavailable(null);
    return withAuthCookies(
      NextResponse.json({ user: mapPublicUser(row), stats: await getUserStats(row.id) }, { status: 201 }),
      response,
    );
  } catch (error) {
    return authUnavailable(error);
  }
}
