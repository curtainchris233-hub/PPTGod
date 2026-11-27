import type { Metadata } from "next";
import GenerateClient from "@/components/GenerateClient";
import { getCurrentUser } from "@/lib/auth";
import { getSavedDeckById, listPrompts } from "@/lib/db";
import type { SavedDeck } from "@/types/prompt";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "在线生成 PPT 工坊 — 直出原生 .pptx 与交互 .html",
  description:
    "挑选任意 PPTGod 视觉风格，粘贴大纲或原始文档，使用内置结构引擎或自定义大模型 API 在线生成多页 16:9 演示文稿，可视化微调并导出原生 .pptx 与离线交互 .html。",
};

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<{
    style?: string;
    topic?: string;
    deck?: string;
    handoff?: string;
    intake?: string;
    panel?: string;
    mode?: string;
  }>;
}) {
  const sp = await searchParams;
  const viewer = await getCurrentUser();
  const styles = listPrompts({
    sort: "popular",
    viewerId: viewer?.id,
    includePrivateForAuthorId: viewer?.id,
  });

  let initialDeck: SavedDeck | null = null;
  let deckForbidden = false;

  if (sp.deck) {
    const found = getSavedDeckById(sp.deck);
    if (found) {
      if (found.isPublic || (viewer && found.authorId === viewer.id)) {
        initialDeck = found;
      } else {
        deckForbidden = true;
      }
    }
  }

  const initialMode: "workshop" | "editor" | undefined =
    sp.mode === "editor"
      ? "editor"
      : sp.mode === "create" || sp.mode === "workshop"
        ? "workshop"
        : undefined;

  return (
    <GenerateClient
      styles={styles}
      initialStyleSlug={sp.style || initialDeck?.promptSlug || styles[0]?.slug || ""}
      initialTopic={sp.topic || initialDeck?.title || ""}
      initialDeck={initialDeck}
      deckForbidden={deckForbidden}
      initialHandoff={sp.handoff === "1"}
      initialIntake={sp.intake === "1"}
      initialPanel={sp.panel === "audit" ? "audit" : undefined}
      initialMode={initialMode}
    />
  );
}
