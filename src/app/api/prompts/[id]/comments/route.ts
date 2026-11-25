import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getDb,
  getPromptBySlugOrId,
  listPromptComments,
} from "@/lib/db";
import { generateToken } from "@/lib/password";
import { TOOL_METADATA, type TargetTool } from "@/types/prompt";
import { parseJsonObject, safeNumber, safeString } from "../../_validation";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const viewer = await getCurrentUser();
  const prompt = getPromptBySlugOrId(id, viewer?.id);
  if (!prompt) {
    return NextResponse.json({ error: "未找到模板" }, { status: 404 });
  }
  const comments = listPromptComments(prompt.id);
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
    const prompt = getPromptBySlugOrId(id, user.id);
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
    const db = getDb();
    db.prepare(
      `INSERT INTO prompt_comments (id, prompt_id, user_id, tested_tool, rating, content, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(commentId, prompt.id, user.id, testedTool, rating, content, now);

    return NextResponse.json(
      { comments: listPromptComments(prompt.id) },
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
  const prompt = getPromptBySlugOrId(id, user.id);
  if (!prompt) {
    return NextResponse.json({ error: "未找到模板" }, { status: 404 });
  }
  const { searchParams } = new URL(request.url);
  const commentId = searchParams.get("commentId");
  if (!commentId) {
    return NextResponse.json({ error: "缺少评价 ID" }, { status: 400 });
  }

  const db = getDb();
  const row = db
    .prepare(`SELECT user_id FROM prompt_comments WHERE id = ? AND prompt_id = ?`)
    .get(commentId, prompt.id) as { user_id: string } | undefined;
  if (!row) {
    return NextResponse.json({ error: "评价不存在" }, { status: 404 });
  }
  if (row.user_id !== user.id) {
    return NextResponse.json({ error: "只能删除自己的评价" }, { status: 403 });
  }

  db.prepare(`DELETE FROM prompt_comments WHERE id = ? AND user_id = ?`).run(
    commentId,
    user.id
  );
  return NextResponse.json({ comments: listPromptComments(prompt.id) });
}
