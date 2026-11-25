import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCreatorByUsername } from "@/lib/db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ username: string }> }
) {
  const { username } = await context.params;
  const trimmed = username.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "未找到该创作者" }, { status: 404 });
  }

  const viewer = await getCurrentUser();
  const data = getCreatorByUsername(trimmed, viewer?.id);
  if (!data) {
    return NextResponse.json({ error: "未找到该创作者" }, { status: 404 });
  }

  return NextResponse.json(data);
}
