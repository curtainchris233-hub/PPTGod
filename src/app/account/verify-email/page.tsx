import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmailVerification } from "@/components/AccountRecovery";
import { publicPreviewEnabled } from "@/lib/auth-config";

export const metadata: Metadata = {
  title: "邮箱验证",
  robots: { index: false, follow: false },
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  if (publicPreviewEnabled()) notFound();
  const { error } = await searchParams;
  return <EmailVerification failed={error !== undefined} />;
}
