import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserStats } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  const options = { headers: { "Cache-Control": "private, no-store" } };
  if (!user) {
    return NextResponse.json({ user: null, stats: null }, options);
  }
  return NextResponse.json({
    user,
    stats: await getUserStats(user.id),
  }, options);
}
