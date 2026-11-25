import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb, getSavedDeckById } from "@/lib/db";
import { validateSlidesPayload } from "@/lib/deckValidation";
import {
  parseJsonObject,
  safeString,
  sanitizeAndValidateVisualSpec,
} from "../../prompts/_validation";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const deck = getSavedDeckById(id);
  if (!deck) {
    return NextResponse.json({ error: "未找到该演示文稿" }, { status: 404 });
  }

  const viewer = await getCurrentUser();
  if (!deck.isPublic && (!viewer || deck.authorId !== viewer.id)) {
    return NextResponse.json(
      { error: "该演示文稿为私有状态，仅作者本人可访问" },
      { status: 403 }
    );
  }

  return NextResponse.json({ deck });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { id } = await context.params;
    const deck = getSavedDeckById(id);
    if (!deck) {
      return NextResponse.json({ error: "文稿不存在" }, { status: 404 });
    }
    if (deck.authorId !== user.id) {
      return NextResponse.json(
        { error: "无权修改他人文稿权限" },
        { status: 403 }
      );
    }

    const parsedBody = await parseJsonObject(request);
    if (!parsedBody.ok) {
      return NextResponse.json({ error: parsedBody.error }, { status: 400 });
    }
    const body = parsedBody.data;

    if (typeof body.isPublic !== "boolean") {
      return NextResponse.json(
        { error: "请提供有效的可见性布尔值（isPublic）" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const db = getDb();
    db.prepare(
      `UPDATE saved_decks SET is_public = ?, updated_at = ? WHERE id = ? AND author_id = ?`
    ).run(body.isPublic ? 1 : 0, now, id, user.id);

    return NextResponse.json({ deck: getSavedDeckById(id) });
  } catch (err) {
    console.error("Patch deck visibility error:", err);
    return NextResponse.json(
      { error: "更新演示文稿权限失败" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { id } = await context.params;
    const deck = getSavedDeckById(id);
    if (!deck) {
      return NextResponse.json({ error: "文稿不存在" }, { status: 404 });
    }
    if (deck.authorId !== user.id) {
      return NextResponse.json({ error: "无权修改他人文稿" }, { status: 403 });
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

    const title = safeString(body.title).trim();
    const subtitle =
      body.subtitle !== undefined
        ? safeString(body.subtitle).trim()
        : deck.subtitle;
    const audience =
      body.audience !== undefined
        ? safeString(body.audience).trim() || "核心团队"
        : deck.audience;
    const promptId =
      body.promptId !== undefined
        ? safeString(body.promptId).trim()
        : deck.promptId;
    const promptSlug =
      body.promptSlug !== undefined
        ? safeString(body.promptSlug).trim()
        : deck.promptSlug;
    const promptTitle =
      body.promptTitle !== undefined
        ? safeString(body.promptTitle).trim()
        : deck.promptTitle;
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

    const nextIsPublic =
      typeof body.isPublic === "boolean" ? body.isPublic : deck.isPublic;
    const now = new Date().toISOString();
    const db = getDb();
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
      id,
      user.id
    );

    return NextResponse.json({ deck: getSavedDeckById(id) });
  } catch (err) {
    console.error("Update deck error:", err);
    return NextResponse.json(
      { error: "更新演示文稿失败" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const { id } = await context.params;
  const deck = getSavedDeckById(id);
  if (!deck) {
    return NextResponse.json({ error: "文稿不存在" }, { status: 404 });
  }
  if (deck.authorId !== user.id) {
    return NextResponse.json({ error: "无权删除他人文稿" }, { status: 403 });
  }

  const db = getDb();
  db.prepare(`DELETE FROM saved_decks WHERE id = ? AND author_id = ?`).run(
    id,
    user.id
  );
  return NextResponse.json({ ok: true });
}
