import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const row = db
      .prepare("SELECT COUNT(*) AS cnt FROM prompts WHERE is_public = 1")
      .get() as { cnt: number };
    const modeRow = db.pragma("journal_mode", { simple: true }) as string;

    return NextResponse.json(
      {
        status: "ok",
        version: "6.0.0",
        catalogCount: Number(row?.cnt ?? 0),
        dbMode: String(modeRow || "wal").toLowerCase(),
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch {
    return NextResponse.json(
      {
        status: "error",
        error: "Database unavailable",
      },
      { status: 503 }
    );
  }
}
