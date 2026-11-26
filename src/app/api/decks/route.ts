import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, getSavedDeckById, listSavedDecksByUser } from "@/lib/db";
import { savedDecks } from "@/lib/db/schema";
import { validateSlidesPayload } from "@/lib/deckValidation";
import type { SavedDeck } from "@/types/prompt";
import { generateToken } from "@/lib/password";
import {
  parseJsonObject,
  safeString,
  sanitizeAndValidateVisualSpec,
} from "../prompts/_validation";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ decks: [] });
  }
  return NextResponse.json({ decks: await listSavedDecksByUser(user.id) });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "请先登录后将生成的 PPT 文稿保存至云端" },
        { status: 401 }
      );
    }

    const parsedBody = await parseJsonObject(request);
    if (!parsedBody.ok) {
      return NextResponse.json({ error: parsedBody.error }, { status: 400 });
    }
    const body = parsedBody.data;

    if (body.isPublic !== undefined && typeof body.isPublic !== "boolean") {
      return NextResponse.json(
        { error: "isPublic 必须为布尔值" },
        { status: 400 }
      );
    }

    const existingId =
      typeof body.id === "string" ? body.id.trim() : "";
    const title = safeString(body.title).trim();
    const subtitle = safeString(body.subtitle).trim();
    const audience = safeString(body.audience, "核心团队").trim() || "核心团队";
    const promptId = safeString(body.promptId).trim();
    const promptSlug = safeString(body.promptSlug).trim();
    const promptTitle = safeString(body.promptTitle).trim();
    const slides = body.slides;

    if (!title) {
      return NextResponse.json(
        { error: "文稿标题或页面内容不能为空" },
        { status: 400 }
      );
    }

    const specCheck = sanitizeAndValidateVisualSpec(body.visualSpec);
    if (!specCheck.ok) {
      return NextResponse.json({ error: specCheck.error }, { status: 400 });
    }
    const visualSpec = specCheck.data;

    const slidesCheck = validateSlidesPayload(slides);
    if (!slidesCheck.ok) {
      return NextResponse.json({ error: slidesCheck.error }, { status: 400 });
    }

    const db = getDb();
    const now = new Date().toISOString();
    const deckValues = {
      title,
      subtitle,
      audience,
      promptId,
      promptSlug,
      promptTitle,
      visualSpec,
      slides: slides as SavedDeck["slides"],
      updatedAt: now,
    };

    if (existingId) {
      const [updated] = await db.update(savedDecks)
        .set({ ...deckValues, isPublic: body.isPublic })
        .where(and(eq(savedDecks.id, existingId), eq(savedDecks.authorId, user.id)))
        .returning({ id: savedDecks.id });
      if (updated) {
        return NextResponse.json({ deck: await getSavedDeckById(existingId) });
      }
    }

    const isPublic = typeof body.isPublic === "boolean" ? body.isPublic : false;
    const id = `deck_${generateToken(8)}`;
    await db.insert(savedDecks).values({
      ...deckValues,
      id,
      isPublic,
      authorId: user.id,
      createdAt: now,
    });

    return NextResponse.json(
      { deck: await getSavedDeckById(id) },
      { status: 201 }
    );
  } catch (err) {
    console.error("Save deck error:", err);
    return NextResponse.json(
      { error: "保存演示文稿失败" },
      { status: 500 }
    );
  }
}
