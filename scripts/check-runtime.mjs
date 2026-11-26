for (const path of [".env.production.local", ".env.local", ".env.production", ".env"]) {
  try {
    process.loadEnvFile(path);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const required = ["DATABASE_URL", "BETTER_AUTH_URL", "BETTER_AUTH_SECRET"];
const fullHosted = process.env.PPTGOD_REQUIRE_SERVICES === "true";
const publicPreview = process.env.PPTGOD_PUBLIC_PREVIEW === "true";
if (fullHosted) {
  required.push(
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "R2_ACCOUNT_ID",
    "R2_BUCKET_NAME",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
  );
}

const missing = required.filter((key) => !process.env[key]?.trim());
if (fullHosted && publicPreview) {
  console.error("Disable PPTGOD_PUBLIC_PREVIEW when enabling hosted account services.");
  process.exitCode = 1;
} else if (missing.length) {
  console.error(`PPTGod is missing required environment variables: ${missing.join(", ")}`);
  process.exitCode = 1;
} else if (process.env.BETTER_AUTH_SECRET.length < 32) {
  console.error("BETTER_AUTH_SECRET must contain at least 32 characters.");
  process.exitCode = 1;
} else if (
  (fullHosted || publicPreview) &&
  !process.env.BETTER_AUTH_URL.startsWith("https://")
) {
  console.error("Hosted PPTGod requires an HTTPS BETTER_AUTH_URL.");
  process.exitCode = 1;
}
