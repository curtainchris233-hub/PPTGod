import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb, getSavedDeckById, listSavedDecksByUser } from "@/lib/db";
import { validateSlidesPayload } from "@/lib/deckValidation";
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
  return NextResponse.json({ decks: listSavedDecksByUser(user.id) });
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

    if (existingId) {
      const prev = getSavedDeckById(existingId);
      if (prev && prev.authorId === user.id) {
        const nextIsPublic =
          typeof body.isPublic === "boolean" ? body.isPublic : prev.isPublic;
        db.prepare(
          `UPDATE saved_decks
           SET title = ?, subtitle = ?, audience = ?, prompt_id = ?, prompt_slug = ?, prompt_title = ?,
               visual_spec = ?, slides_json = ?, is_public = ?, updated_at = ?
           WHERE id = ? AND author_id = ?`
        ).run(
          title,
          subtitle,
          audience,
          promptId,
          promptSlug,
          promptTitle,
          JSON.stringify(visualSpec),
          JSON.stringify(slides),
          nextIsPublic ? 1 : 0,
          now,
          existingId,
          user.id
        );
        return NextResponse.json({ deck: getSavedDeckById(existingId) });
      }
    }

    const isPublic = typeof body.isPublic === "boolean" ? body.isPublic : false;
    const id = `deck_${generateToken(8)}`;
    db.prepare(
      `INSERT INTO saved_decks (
        id, title, subtitle, audience, prompt_id, prompt_slug, prompt_title,
        visual_spec, slides_json, is_public, author_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      title,
      subtitle,
      audience,
      promptId,
      promptSlug,
      promptTitle,
      JSON.stringify(visualSpec),
      JSON.stringify(slides),
      isPublic ? 1 : 0,
      user.id,
      now,
      now
    );

    return NextResponse.json(
      { deck: getSavedDeckById(id) },
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
