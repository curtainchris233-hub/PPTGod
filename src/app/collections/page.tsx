import type { Metadata } from "next";
import CollectionsClient from "@/components/CollectionsClient";
import { getCurrentUser } from "@/lib/auth";
import { listPrompts, listSavedDecksByUser } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "我的空间 — 收藏风格、云端 PPT 文稿与个人作品",
  description:
    "管理收藏的 PPT 视觉提示词、云端保存的演示文稿、已发布与私有的原创风格以及创作者个人资料。",
};

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const viewer = await getCurrentUser();
  const initialPrompts = listPrompts({
    sort: "newest",
    viewerId: viewer?.id,
    includePrivateForAuthorId: viewer?.id,
  });
  const initialDecks = viewer ? listSavedDecksByUser(viewer.id) : [];

  const initialTab =
    sp.tab === "decks" || sp.tab === "mine" || sp.tab === "liked"
      ? sp.tab
      : "favorites";

  return (
    <CollectionsClient
      initialPrompts={initialPrompts}
      initialDecks={initialDecks}
      initialTab={initialTab}
    />
  );
}
