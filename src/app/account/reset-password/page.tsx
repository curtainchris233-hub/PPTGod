import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PasswordReset } from "@/components/AccountRecovery";
import { publicPreviewEnabled } from "@/lib/auth-config";

export const metadata: Metadata = {
  title: "重设密码",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[]; error?: string | string[] }>;
}) {
  if (publicPreviewEnabled()) notFound();
  const { token, error } = await searchParams;
  return <PasswordReset token={error === undefined && typeof token === "string" ? token : null} />;
}
