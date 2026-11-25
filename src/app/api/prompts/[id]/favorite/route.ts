import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb, getPromptBySlugOrId } from "@/lib/db";

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
  const prompt = getPromptBySlugOrId(id, user.id);
  if (!prompt) {
    return NextResponse.json({ error: "模板不存在" }, { status: 404 });
  }

  const db = getDb();
  const tx = db.transaction(() => {
    const existing = db
      .prepare(
        `SELECT 1 FROM prompt_favorites WHERE user_id = ? AND prompt_id = ?`
      )
      .get(user.id, prompt.id);

    if (existing) {
      db.prepare(
        `DELETE FROM prompt_favorites WHERE user_id = ? AND prompt_id = ?`
      ).run(user.id, prompt.id);
      db.prepare(
        `UPDATE prompts SET saves_count = MAX(0, saves_count - 1) WHERE id = ?`
      ).run(prompt.id);
      return { favorited: false };
    } else {
      db.prepare(
        `INSERT INTO prompt_favorites (user_id, prompt_id, created_at) VALUES (?, ?, ?)`
      ).run(user.id, prompt.id, new Date().toISOString());
      db.prepare(
        `UPDATE prompts SET saves_count = saves_count + 1 WHERE id = ?`
      ).run(prompt.id);
      return { favorited: true };
    }
  });

  const { favorited } = tx();
  const updated = db
    .prepare(`SELECT saves_count FROM prompts WHERE id = ?`)
    .get(prompt.id) as { saves_count: number };

  return NextResponse.json({
    favorited,
    savesCount: updated.saves_count,
  });
}
