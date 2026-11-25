import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { parseJsonObject } from "../_validation";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const parsedBody = await parseJsonObject(request);
    if (!parsedBody.ok) {
      return NextResponse.json({ error: parsedBody.error }, { status: 400 });
    }
    const body = parsedBody.data;

    const ids = Array.isArray(body.promptIds)
      ? Array.from(
          new Set(
            body.promptIds
              .filter((id): id is string => typeof id === "string")
              .map((id) => id.trim())
              .filter(Boolean)
          )
        ).slice(0, 200)
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ synced: 0 });
    }

    const db = getDb();
    const now = new Date().toISOString();
    let synced = 0;

    const tx = db.transaction(() => {
      const checkStmt = db.prepare(
        `SELECT 1 FROM prompts WHERE id = ? AND (is_public = 1 OR author_id = ?)`
      );
      const insertFavStmt = db.prepare(
        `INSERT OR IGNORE INTO prompt_favorites (user_id, prompt_id, created_at) VALUES (?, ?, ?)`
      );
      const bumpCountStmt = db.prepare(
        `UPDATE prompts SET saves_count = saves_count + 1 WHERE id = ?`
      );

      for (const pid of ids) {
        const promptExists = checkStmt.get(pid, user.id);
        if (!promptExists) continue;
        const info = insertFavStmt.run(user.id, pid, now);
        if (info.changes > 0) {
          bumpCountStmt.run(pid);
          synced += 1;
        }
      }
    });
    tx();

    return NextResponse.json({ synced });
  } catch (err) {
    console.error("Sync favorites error:", err);
    return NextResponse.json({ error: "同步收藏失败" }, { status: 500 });
  }
}
