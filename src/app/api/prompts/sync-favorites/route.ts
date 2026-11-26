import { NextResponse } from "next/server";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { promptFavorites, prompts } from "@/lib/db/schema";
import { parseJsonObject } from "../_validation";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const parsedBody = await parseJsonObject(request);
    if (!parsedBody.ok) {
      return NextResponse.json({ error: parsedBody.error }, { status: 400 });
    }
    const body = parsedBody.data;

    const ids = Array.isArray(body.promptIds)
      ? Array.from(
          new Set(
            body.promptIds
              .filter((id): id is string => typeof id === "string")
              .map((id) => id.trim())
              .filter(Boolean)
          )
        ).slice(0, 200)
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ synced: 0 });
    }

    const synced = await getDb().transaction(async (tx) => {
      const accessible = await tx.select({ promptId: prompts.id })
        .from(prompts)
        .where(and(
          inArray(prompts.id, ids),
          or(eq(prompts.isPublic, true), eq(prompts.authorId, user.id)),
        ))
        .orderBy(asc(prompts.id))
        .for("update");
      if (!accessible.length) return 0;

      const now = new Date().toISOString();
      const added = await tx.insert(promptFavorites)
        .values(accessible.map(({ promptId }) => ({ userId: user.id, promptId, createdAt: now })))
        .onConflictDoNothing()
        .returning({ promptId: promptFavorites.promptId });
      if (!added.length) return 0;

      await tx.update(prompts)
        .set({ savesCount: sql`${prompts.savesCount} + 1` })
        .where(inArray(prompts.id, added.map(({ promptId }) => promptId)));
      return added.length;
    });

    return NextResponse.json({ synced });
  } catch (err) {
    console.error("Sync favorites error:", err);
    return NextResponse.json({ error: "同步收藏失败" }, { status: 500 });
  }
}
