import { DEMO_ACCOUNT_EMAIL, demoAccountEnabled, testAccountsEnabled } from "@/lib/auth-config";

const TEST_CURATOR_EMAIL = "chen@pptgod.studio";

export const SEED_ACCOUNT_ADDRESSES = new Set([
  "studio@pptgod.studio",
  DEMO_ACCOUNT_EMAIL,
  TEST_CURATOR_EMAIL,
]);

export function canSignInWithEmail(email: string) {
  if (email === DEMO_ACCOUNT_EMAIL) return demoAccountEnabled();
  if (email === TEST_CURATOR_EMAIL) return testAccountsEnabled();
  return !SEED_ACCOUNT_ADDRESSES.has(email);
}
