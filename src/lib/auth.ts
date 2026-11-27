import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { getSessionCookie } from "better-auth/cookies";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { headers } from "next/headers";
import { getAuthBaseUrl, getAuthMailConfig, publicPreviewEnabled } from "@/lib/auth-config";
import { sendAccountEmail } from "@/lib/auth-email";
import { getDb, mapPublicUser } from "@/lib/db";
import { accounts, sessions, users, verifications } from "@/lib/db/schema";
import { generateToken, LEGACY_PASSWORD_PREFIX, verifyLegacyPassword } from "@/lib/password";
import type { UserPublic } from "@/types/prompt";

const AUTH_COOKIE_PREFIX = "pptgod";
const AVATAR_COLORS = ["#C84B31", "#0F766E", "#1D4ED8", "#9D174D", "#B45309", "#3F6212", "#1E3A5F"];

function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("BETTER_AUTH_SECRET must be at least 32 characters");
  const baseURL = getAuthBaseUrl();
  const mail = getAuthMailConfig();

  return betterAuth({
    appName: "PPTGod",
    baseURL,
    secret,
    advanced: { cookiePrefix: AUTH_COOKIE_PREFIX, useSecureCookies: baseURL.startsWith("https://") },
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      transaction: true,
      schema: { account: accounts, session: sessions, user: users, verification: verifications },
    }),
    session: { expiresIn: 60 * 60 * 24 * 14, updateAge: 60 * 60 * 24 },
    // The public route allowlist enforces shared rate limits before forwarding
    // to Better Auth, so separate per-process limits would double-count.
    rateLimit: { enabled: false },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      requireEmailVerification: Boolean(mail),
      resetPasswordTokenExpiresIn: 30 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => sendAccountEmail("reset", user.email, url),
      password: {
        hash: hashPassword,
        verify: ({ hash, password }) => hash.startsWith(LEGACY_PASSWORD_PREFIX)
          ? verifyLegacyPassword(password, hash.slice(LEGACY_PASSWORD_PREFIX.length))
          : verifyPassword({ hash, password }),
      },
    },
    emailVerification: mail ? {
      sendOnSignUp: true,
      sendOnSignIn: false,
      expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user, url }) => sendAccountEmail("verification", user.email, url),
    } : undefined,
    user: {
      additionalFields: {
        username: { type: "string", required: false, input: false },
        bio: { type: "string", required: false, defaultValue: "" },
        avatarColor: { type: "string", required: false, input: false },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const prefix = user.name.toLowerCase().replace(/[^a-z0-9_]+/g, "").slice(0, 16) || "creator";
            return {
              data: {
                ...user,
                username: `${prefix}_${generateToken(6)}`,
                bio: typeof user.bio === "string" ? user.bio.trim().slice(0, 140) : "",
                avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
              },
            };
          },
        },
      },
    },
    // Adapter diagnostics may contain SQL arguments and personal information.
    logger: { level: "error", log: () => console.error("PPTGod account operation failed") },
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  return (auth ??= createAuth());
}

export async function getCurrentUser(): Promise<UserPublic | null> {
  if (publicPreviewEnabled()) return null;
  const requestHeaders = await headers();
  if (!getSessionCookie(requestHeaders, { cookiePrefix: AUTH_COOKIE_PREFIX })) return null;

  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session?.user || !session.user.username) return null;
  return mapPublicUser({
    ...session.user,
    username: session.user.username,
    bio: session.user.bio ?? "",
    avatarColor: session.user.avatarColor ?? "#C84B31",
  });
}
