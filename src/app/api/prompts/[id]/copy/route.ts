import { NextResponse } from "next/server";
import { and, eq, or, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { publicPreviewEnabled } from "@/lib/auth-config";
import { getDb, getPromptBySlugOrId } from "@/lib/db";
import { prompts } from "@/lib/db/schema";
import { consumeRateLimit, getClientIp } from "@/lib/rateLimit";

const COPY_DEDUPE_WINDOW_MS = 5_000;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const viewer = await getCurrentUser();
  const prompt = await getPromptBySlugOrId(id, viewer?.id);
  if (!prompt) {
    return NextResponse.json({ error: "模板不存在" }, { status: 404 });
  }
  if (publicPreviewEnabled()) {
    return NextResponse.json({ copiesCount: prompt.copiesCount, counted: false });
  }

  const ip = getClientIp(request);
  const dedupeKey = `copy:${ip}:${viewer?.id ?? "anon"}:${prompt.id}`;
  const quota = await consumeRateLimit(dedupeKey, 1, COPY_DEDUPE_WINDOW_MS);

  if (!quota.allowed) {
    return NextResponse.json({ copiesCount: prompt.copiesCount, counted: false });
  }

  const [updated] = await getDb().update(prompts)
    .set({ copiesCount: sql`${prompts.copiesCount} + 1` })
    .where(and(eq(prompts.id, prompt.id), or(eq(prompts.isPublic, true), eq(prompts.authorId, viewer?.id ?? ""))))
    .returning({ copiesCount: prompts.copiesCount });
  if (!updated) {
    return NextResponse.json({ error: "模板不存在" }, { status: 404 });
  }
  return NextResponse.json({ copiesCount: updated.copiesCount, counted: true });
}
