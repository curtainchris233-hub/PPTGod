import { NextResponse } from "next/server";
import { and, eq, or, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, getPromptBySlugOrId } from "@/lib/db";
import { promptLikes, prompts } from "@/lib/db/schema";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "请先登录后再点赞支持创作者" },
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

    const [removed] = await tx.delete(promptLikes)
      .where(and(eq(promptLikes.userId, user.id), eq(promptLikes.promptId, prompt.id)))
      .returning({ promptId: promptLikes.promptId });
    if (!removed) {
      await tx.insert(promptLikes).values({
        userId: user.id,
        promptId: prompt.id,
        createdAt: new Date().toISOString(),
      });
    }

    const adjustment = removed ? -1 : 1;
    const [updated] = await tx.update(prompts)
      .set({ likesCount: sql`greatest(0, ${prompts.likesCount} + ${adjustment})` })
      .where(eq(prompts.id, prompt.id))
      .returning({ likesCount: prompts.likesCount });
    return { liked: !removed, likesCount: updated.likesCount };
  });
  if (!result) {
    return NextResponse.json({ error: "模板不存在" }, { status: 404 });
  }

  return NextResponse.json(result);
}
