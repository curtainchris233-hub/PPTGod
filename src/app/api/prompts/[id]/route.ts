import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import {
  getDb,
  getPromptBySlugOrId,
  updatePrompt,
  updatePromptVisibility,
} from "@/lib/db";
import { prompts } from "@/lib/db/schema";
import { parseJsonObject, validatePromptPayload } from "../_validation";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const viewer = await getCurrentUser();
  const prompt = await getPromptBySlugOrId(id, viewer?.id);
  if (!prompt) {
    return NextResponse.json({ error: "未找到该提示词模板" }, { status: 404 });
  }
  return NextResponse.json({ prompt });
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
    const existing = await getPromptBySlugOrId(id, user.id);
    if (!existing) {
      return NextResponse.json({ error: "模板不存在" }, { status: 404 });
    }
    if (existing.authorId !== user.id) {
      return NextResponse.json(
        { error: "只能编辑自己发布的模板" },
        { status: 403 }
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

    const validated = validatePromptPayload(body, existing);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const updated = await updatePrompt(
      existing.id,
      { ...validated.data, isPublic: body.isPublic },
      user.id
    );
    if (!updated) {
      return NextResponse.json({ error: "模板不存在" }, { status: 404 });
    }

    return NextResponse.json({ prompt: updated });
  } catch (err) {
    console.error("Update prompt error:", err);
    return NextResponse.json(
      { error: "更新提示词模板失败，请稍后重试" },
      { status: 500 }
    );
  }
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
    const existing = await getPromptBySlugOrId(id, user.id);
    if (!existing) {
      return NextResponse.json({ error: "模板不存在" }, { status: 404 });
    }
    if (existing.authorId !== user.id) {
      return NextResponse.json(
        { error: "只能修改自己发布的模板权限" },
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

    const updated = await updatePromptVisibility(existing.id, body.isPublic, user.id);
    if (!updated) {
      return NextResponse.json({ error: "模板不存在" }, { status: 404 });
    }

    return NextResponse.json({ prompt: updated });
  } catch (err) {
    console.error("Patch prompt visibility error:", err);
    return NextResponse.json(
      { error: "更新模板可见性失败，请稍后重试" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const prompt = await getPromptBySlugOrId(id, user.id);
  if (!prompt) {
    return NextResponse.json({ error: "模板不存在" }, { status: 404 });
  }
  if (prompt.authorId !== user.id) {
    return NextResponse.json({ error: "只能删除自己发布的模板" }, { status: 403 });
  }

  await getDb().delete(prompts)
    .where(and(eq(prompts.id, prompt.id), eq(prompts.authorId, user.id)));
  return NextResponse.json({ ok: true });
}
