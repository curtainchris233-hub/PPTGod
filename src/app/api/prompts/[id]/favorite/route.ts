import { NextResponse } from "next/server";
import { and, eq, or, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, getPromptBySlugOrId } from "@/lib/db";
import { promptFavorites, prompts } from "@/lib/db/schema";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "请先登录后将收藏同步至云端" },
      { status: 401 }
    );
  }

  const { id } = await context.params;
  const prompt = await getPromptBySlugOrId(id, user.id);
  if (!prompt) {
    return NextResponse.json({ error: "模板不存在" }, { status: 404 });
  }

  const result = await getDb().transaction(async (tx) => {
    const [lockedPrompt] = await tx.select({ id: prompts.id })
      .from(prompts)
      .where(and(eq(prompts.id, prompt.id), or(eq(prompts.isPublic, true), eq(prompts.authorId, user.id))))
      .for("update");
    if (!lockedPrompt) return null;

    const [removed] = await tx.delete(promptFavorites)
      .where(and(eq(promptFavorites.userId, user.id), eq(promptFavorites.promptId, prompt.id)))
      .returning({ promptId: promptFavorites.promptId });
    if (!removed) {
      await tx.insert(promptFavorites).values({
        userId: user.id,
        promptId: prompt.id,
        createdAt: new Date().toISOString(),
      });
    }

    const adjustment = removed ? -1 : 1;
    const [updated] = await tx.update(prompts)
      .set({ savesCount: sql`greatest(0, ${prompts.savesCount} + ${adjustment})` })
      .where(eq(prompts.id, prompt.id))
      .returning({ savesCount: prompts.savesCount });
    return { favorited: !removed, savesCount: updated.savesCount };
  });
  if (!result) {
    return NextResponse.json({ error: "模板不存在" }, { status: 404 });
  }

  return NextResponse.json(result);
}
