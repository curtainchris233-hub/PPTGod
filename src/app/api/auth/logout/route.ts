import { NextResponse } from "next/server";
import { authAttemptLimit, authPost, authUnavailable, withAuthCookies } from "../_request";

export async function POST(request: Request) {
  try {
    const limited = await authAttemptLimit(request, "logout", 30, 60_000);
    if (limited) return limited;
    const response = await authPost(request, "sign-out");
    if (!response.ok) {
      return NextResponse.json({ error: "退出失败，请稍后重试" }, { status: response.status });
    }
    const result = withAuthCookies(NextResponse.json({ ok: true }), response);
    result.cookies.delete("pptgod_session");
    return result;
  } catch (error) {
    return authUnavailable(error);
  }
}
