import type { UserPublic, UserStats } from "@/types/prompt";

export const RESET_PASSWORD_PATH = "/account/reset-password";

type AuthAction =
  | "login"
  | "register"
  | "send-verification-email"
  | "request-password-reset"
  | "reset-password";

interface AuthResponse {
  code?: string;
  error?: string;
  user?: UserPublic;
  stats?: UserStats;
  verificationRequired?: boolean;
}

export async function postAuth(action: AuthAction, body: Record<string, string>) {
  const response = await fetch(`/api/auth/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: AuthResponse = (await response.json().catch(() => null)) ?? {};

  return { response, data };
}
