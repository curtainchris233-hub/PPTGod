import { NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { prompts } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [{ catalogCount }] = await getDb()
      .select({ catalogCount: count() })
      .from(prompts)
      .where(eq(prompts.isPublic, true));
    if (catalogCount === 0) {
      return NextResponse.json({ status: "error", error: "Style catalog unavailable" }, {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      });
    }

    return NextResponse.json(
      {
        status: "ok",
        version: "8.0.0",
        catalogCount,
        dbMode: "postgresql",
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
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
