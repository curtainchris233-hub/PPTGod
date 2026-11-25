import type { Metadata } from "next";
import DashboardClient from "@/components/dashboard/DashboardClient";
import { getCurrentUser } from "@/lib/auth";
import { listPrompts } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PPTGod · 用 AI 创作你的演示文稿",
  description:
    "输入一个主题、粘贴一段资料或上传文档，选好风格即可生成可编辑的 16:9 演示文稿，并导出原生 .pptx。",
};

export default async function HomePage() {
  const viewer = await getCurrentUser();
  const prompts = listPrompts({
    sort: "popular",
    viewerId: viewer?.id,
  });

  return <DashboardClient prompts={prompts} />;
}
