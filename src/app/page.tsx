import type { Metadata } from "next";
import { redirect } from "next/navigation";
import DashboardClient from "@/components/dashboard/DashboardClient";
import { getCurrentUser } from "@/lib/auth";
import { listPrompts } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PPTGod · 用 AI 创作你的演示文稿",
  description:
    "输入一个主题、粘贴一段资料或上传文档，选好风格即可生成可编辑的 16:9 演示文稿，并导出原生 .pptx。",
};

const LEGACY_GALLERY_KEYS = [
  "q",
  "domain",
  "scenario",
  "style",
  "color",
  "tool",
  "sort",
] as const;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  // Backward compatibility: legacy gallery filter URLs on `/` redirect to `/gallery`.
  const forwarded = new URLSearchParams();
  let hasLegacyFilter = false;
  for (const key of LEGACY_GALLERY_KEYS) {
    const raw = sp[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === "string" && value.trim() !== "") {
      forwarded.set(key, value);
      hasLegacyFilter = true;
    }
  }
  if (hasLegacyFilter) {
    redirect(`/gallery?${forwarded.toString()}`);
  }

  const viewer = await getCurrentUser();
  const prompts = listPrompts({
    sort: "popular",
    viewerId: viewer?.id,
  });

  return <DashboardClient prompts={prompts} />;
}
