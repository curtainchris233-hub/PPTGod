import { cookies } from "next/headers";
import { getDb, mapPublicUser } from "@/lib/db";
import { generateToken } from "@/lib/password";
import type { UserPublic } from "@/types/prompt";

export const SESSION_COOKIE_NAME = "pptgod_session";
const SESSION_TTL_DAYS = 14;

export async function createSession(userId: string): Promise<string> {
  const db = getDb();
  const token = generateToken(32);
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(
    now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  // Actively prune expired sessions so stale rows cannot accumulate
  db.prepare(`DELETE FROM sessions WHERE expires_at < ?`).run(nowIso);

  db.prepare(
    `INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`
  ).run(token, userId, expiresAt.toISOString(), nowIso);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    secure: process.env.COOKIE_SECURE === "true",
  });

  return token;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const db = getDb();
    db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUser(): Promise<UserPublic | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const db = getDb();
  const row = db
    .prepare(
      `
    SELECT u.id, u.username, u.display_name, u.bio, u.avatar_color, u.created_at, s.expires_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
    LIMIT 1
  `
    )
    .get(token) as
    | {
        id: string;
        username: string;
        display_name: string;
        bio: string;
        avatar_color: string;
        created_at: string;
        expires_at: string;
      }
    | undefined;

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
    return null;
  }

  return mapPublicUser(row);
}
