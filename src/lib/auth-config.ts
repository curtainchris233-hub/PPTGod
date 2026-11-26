const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function publicPreviewEnabled() {
  return process.env.PPTGOD_PUBLIC_PREVIEW === "true";
}

function isLoopback(url: string | undefined) {
  if (!url) return false;
  try {
    return LOOPBACK.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function getAuthBaseUrl() {
  const value = process.env.BETTER_AUTH_URL
    ?? (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
  if (!value) throw new Error("BETTER_AUTH_URL is required");
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password
    || url.pathname !== "/" || url.search || url.hash
    || (url.protocol !== "https:" && !isLoopback(value))) {
    throw new Error("BETTER_AUTH_URL must be the canonical site origin");
  }
  return url.origin;
}

export function isLocalAuthEnvironment() {
  const databaseUrl = process.env.DATABASE_URL;
  const localComposeDatabase = databaseUrl ? new URL(databaseUrl).hostname === "postgres" : false;
  return process.env.PPTGOD_REQUIRE_SERVICES !== "true"
    && !publicPreviewEnabled()
    && isLoopback(getAuthBaseUrl())
    && (isLoopback(databaseUrl) || localComposeDatabase);
}

export const DEMO_ACCOUNT_EMAIL = "demo@pptgod.studio";

export function demoAccountEnabled() {
  return process.env.PPTGOD_ENABLE_DEMO_ACCOUNT === "true" && isLocalAuthEnvironment();
}

export function testAccountsEnabled() {
  return process.env.PPTGOD_ENABLE_TEST_ACCOUNTS === "true" && isLocalAuthEnvironment();
}

export function getAuthMailConfig() {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from) {
    if (key || from || !isLocalAuthEnvironment()) {
      throw new Error("RESEND_API_KEY and RESEND_FROM_EMAIL are required");
    }
    return null;
  }
  return { key, from };
}
