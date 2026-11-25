import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb, getPromptBySlugOrId } from "@/lib/db";
import { consumeRateLimit, getClientIp } from "@/lib/rateLimit";

const COPY_DEDUPE_WINDOW_MS = 5_000;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const viewer = await getCurrentUser();
  const prompt = getPromptBySlugOrId(id, viewer?.id);
  if (!prompt) {
    return NextResponse.json({ error: "模板不存在" }, { status: 404 });
  }

  const ip = getClientIp(request);
  const dedupeKey = `copy:${ip}:${viewer?.id ?? "anon"}:${prompt.id}`;
  const quota = consumeRateLimit(dedupeKey, 1, COPY_DEDUPE_WINDOW_MS);

  const db = getDb();
  if (quota.allowed) {
    db.prepare(
      `UPDATE prompts SET copies_count = copies_count + 1 WHERE id = ?`
    ).run(prompt.id);
  }
  const updated = db
    .prepare(`SELECT copies_count FROM prompts WHERE id = ?`)
    .get(prompt.id) as { copies_count: number };

  return NextResponse.json({
    copiesCount: updated.copies_count,
    counted: quota.allowed,
  });
}
