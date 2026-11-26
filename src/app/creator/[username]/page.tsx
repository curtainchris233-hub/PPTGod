import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CreatorProfileClient from "@/components/CreatorProfileClient";
import { getCurrentUser } from "@/lib/auth";
import { getCreatorByUsername } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const data = await getCreatorByUsername(username, null);
  if (!data) return { title: "未找到创作者" };
  return {
    title: `${data.creator.displayName} — PPT 视觉提示词创作者主页`,
    description:
      data.creator.bio ||
      `浏览 ${data.creator.displayName} 在 PPTGod 公开发布的 ${data.impact.publishedCount} 套 PPT 视觉提示词设计系统。`,
  };
}

export default async function CreatorPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const viewer = await getCurrentUser();
  const data = await getCreatorByUsername(username, viewer?.id);

  if (!data) {
    notFound();
  }

  return (
    <CreatorProfileClient
      creator={data.creator}
      initialPrompts={data.prompts}
      impact={data.impact}
      privateCount={data.privateCount}
      isSelf={Boolean(viewer && viewer.id === data.creator.id)}
    />
  );
}
