import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import {
  getDb,
  getPromptBySlugOrId,
  listPromptComments,
} from "@/lib/db";
import { promptComments } from "@/lib/db/schema";
import { generateToken } from "@/lib/password";
import { TOOL_METADATA, type TargetTool } from "@/types/prompt";
import { parseJsonObject, safeNumber, safeString } from "../../_validation";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const viewer = await getCurrentUser();
  const prompt = await getPromptBySlugOrId(id, viewer?.id);
  if (!prompt) {
    return NextResponse.json({ error: "未找到模板" }, { status: 404 });
  }
  const comments = await listPromptComments(prompt.id);
  return NextResponse.json({ comments });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "请先登录后发表实测评价" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const prompt = await getPromptBySlugOrId(id, user.id);
    if (!prompt) {
      return NextResponse.json({ error: "未找到模板" }, { status: 404 });
    }

    const parsedBody = await parseJsonObject(request);
    if (!parsedBody.ok) {
      return NextResponse.json({ error: parsedBody.error }, { status: 400 });
    }
    const body = parsedBody.data;

    const content = safeString(body.content).trim();
    const rawTool = safeString(body.testedTool, "claude-html");
    const testedTool: TargetTool = Object.prototype.hasOwnProperty.call(
      TOOL_METADATA,
      rawTool
    )
      ? (rawTool as TargetTool)
      : "claude-html";
    const rawRating = safeNumber(body.rating);
    const rating = Number.isFinite(rawRating)
      ? Math.max(1, Math.min(5, Math.round(rawRating)))
      : 5;

    if (content.length < 4 || content.length > 500) {
      return NextResponse.json(
        { error: "评价内容长度需在 4 到 500 字之间" },
        { status: 400 }
      );
    }

    const commentId = `cmt_${generateToken(8)}`;
    const now = new Date().toISOString();
    await getDb().insert(promptComments).values({
      id: commentId,
      promptId: prompt.id,
      userId: user.id,
      testedTool,
      rating,
      content,
      createdAt: now,
    });

    return NextResponse.json(
      { comments: await listPromptComments(prompt.id) },
      { status: 201 }
    );
  } catch (err) {
    console.error("Create comment error:", err);
    return NextResponse.json({ error: "提交评价失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const { id } = await context.params;
  const prompt = await getPromptBySlugOrId(id, user.id);
  if (!prompt) {
    return NextResponse.json({ error: "未找到模板" }, { status: 404 });
  }
  const { searchParams } = new URL(request.url);
  const commentId = searchParams.get("commentId");
  if (!commentId) {
    return NextResponse.json({ error: "缺少评价 ID" }, { status: 400 });
  }

  const db = getDb();
  const commentFilter = and(eq(promptComments.id, commentId), eq(promptComments.promptId, prompt.id));
  const [row] = await db.select({ userId: promptComments.userId })
    .from(promptComments)
    .where(commentFilter);
  if (!row) {
    return NextResponse.json({ error: "评价不存在" }, { status: 404 });
  }
  if (row.userId !== user.id) {
    return NextResponse.json({ error: "只能删除自己的评价" }, { status: 403 });
  }

  await db.delete(promptComments).where(and(commentFilter, eq(promptComments.userId, user.id)));
  return NextResponse.json({ comments: await listPromptComments(prompt.id) });
}
