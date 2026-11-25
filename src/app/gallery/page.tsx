import type { Metadata } from "next";
import GalleryClient from "@/components/GalleryClient";
import { getCurrentUser } from "@/lib/auth";
import { listPrompts } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "风格画廊 · 浏览全部 PPT 视觉风格",
  description:
    "按场景、配色与版式浏览 PPTGod 全部演示文稿视觉风格，查看真实画布预览、收藏、加入对比，或一键用该风格生成 PPT。",
};

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const viewer = await getCurrentUser();
  const initialPrompts = listPrompts({
    sort: "popular",
    viewerId: viewer?.id,
  });

  // Re-key on `q` so a new top-bar search re-seeds the gallery's search box.
  return <GalleryClient key={q} initialPrompts={initialPrompts} initialSearch={q} />;
}
