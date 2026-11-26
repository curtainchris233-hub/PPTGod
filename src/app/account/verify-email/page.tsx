import type { Metadata } from "next";
import { EmailVerification } from "@/components/AccountRecovery";

export const metadata: Metadata = {
  title: "邮箱验证",
  robots: { index: false, follow: false },
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  return <EmailVerification failed={error !== undefined} />;
}
