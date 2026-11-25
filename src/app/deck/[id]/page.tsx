import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DeckShareClient from "@/components/DeckShareClient";
import { getCurrentUser } from "@/lib/auth";
import { getSavedDeckById } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const viewer = await getCurrentUser();
  const deck = getSavedDeckById(id);

  // Strict privacy guard: never leak private deck titles in <title> or meta tags
  if (!deck || (!deck.isPublic && (!viewer || deck.authorId !== viewer.id))) {
    return {
      title: "演示文稿不可访问 — PPTGod",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: `${deck.title} — 在线演播分享`,
    description:
      deck.subtitle ||
      `${deck.slides.length} 页 16:9 商业演示文稿 · ${deck.promptTitle} 视觉体系`,
  };
}

export default async function DeckSharePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ rehearsal?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const viewer = await getCurrentUser();
  const deck = getSavedDeckById(id);

  if (!deck) {
    notFound();
  }

  if (!deck.isPublic && (!viewer || deck.authorId !== viewer.id)) {
    notFound();
  }

  return <DeckShareClient deck={deck} initialRehearsal={sp.rehearsal === "1"} />;
}
