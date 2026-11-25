import type { Metadata } from "next";
import { notFound } from "next/navigation";
import StudioClient from "@/components/StudioClient";
import { getCurrentUser } from "@/lib/auth";
import { getPromptBySlugOrId, listPromptComments } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const viewer = await getCurrentUser();
  const prompt = getPromptBySlugOrId(slug, viewer?.id);
  if (!prompt) {
    return { title: "未找到模板" };
  }
  return {
    title: `${prompt.title} — 交互式提示词工作室`,
    description: prompt.summary,
  };
}

export default async function StudioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const viewer = await getCurrentUser();
  const prompt = getPromptBySlugOrId(slug, viewer?.id);

  if (!prompt) {
    notFound();
  }

  const initialComments = listPromptComments(prompt.id);

  return (
    <StudioClient initialPrompt={prompt} initialComments={initialComments} />
  );
}
