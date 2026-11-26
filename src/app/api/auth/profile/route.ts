import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAuthBaseUrl } from "@/lib/auth-config";
import { getDb, getUserStats, mapPublicUser } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { parseJsonObject, safeString } from "../../prompts/_validation";

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export async function PATCH(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== getAuthBaseUrl()) {
      return NextResponse.json({ error: "无法验证请求来源" }, { status: 403 });
    }
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const parsedBody = await parseJsonObject(request);
    if (!parsedBody.ok) {
      return NextResponse.json({ error: parsedBody.error }, { status: 400 });
    }
    const body = parsedBody.data;

    const displayName = (
      body.displayName === undefined || body.displayName === null
        ? user.displayName
        : safeString(body.displayName)
    ).trim();
    const bio = safeString(body.bio, user.bio).trim().slice(0, 140);

    let avatarColor = user.avatarColor || "#C84B31";
    if (body.avatarColor !== undefined) {
      const rawColor =
        typeof body.avatarColor === "string" ? body.avatarColor.trim() : "";
      if (!HEX_COLOR_RE.test(rawColor)) {
        return NextResponse.json(
          { error: "头像配色格式无效，请使用十六进制颜色值（如 #C84B31）" },
          { status: 400 }
        );
      }
      avatarColor =
        rawColor.length === 4
          ? `#${rawColor[1]}${rawColor[1]}${rawColor[2]}${rawColor[2]}${rawColor[3]}${rawColor[3]}`.toUpperCase()
          : rawColor.toUpperCase();
    }

    if (displayName.length < 2 || displayName.length > 32) {
      return NextResponse.json(
        { error: "昵称长度需在 2 到 32 个字符之间" },
        { status: 400 }
      );
    }

    const [updated] = await getDb().update(users)
      .set({ name: displayName, bio, avatarColor, updatedAt: new Date() })
      .where(eq(users.id, user.id)).returning();
    if (!updated) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    return NextResponse.json({
      user: mapPublicUser(updated),
      stats: await getUserStats(user.id),
    });
  } catch {
    console.error("PPTGod profile update failed");
    return NextResponse.json({ error: "保存资料失败" }, { status: 500 });
  }
}
