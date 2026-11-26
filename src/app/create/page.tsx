import type { Metadata } from "next";
import CreateClient from "@/components/CreateClient";
import { getCurrentUser } from "@/lib/auth";
import { getPromptBySlugOrId } from "@/lib/db";
import type { PromptItem } from "@/types/prompt";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "创作与二创 PPT 视觉风格",
  description:
    "可视化配置配色系统、字体层级与版式网格，支持从零创作、Remix 二创或编辑个人已发布风格，自由切换公开分享或仅自己可见。",
};

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ fork?: string; edit?: string }>;
}) {
  const sp = await searchParams;
  const viewer = await getCurrentUser();

  let mode: "create" | "fork" | "edit" = "create";
  let sourcePrompt: PromptItem | null = null;
  let editForbidden = false;

  if (sp.edit) {
    const found = await getPromptBySlugOrId(sp.edit, viewer?.id);
    if (found && viewer && found.authorId === viewer.id) {
      mode = "edit";
      sourcePrompt = found;
    } else {
      editForbidden = true;
    }
  } else if (sp.fork) {
    const found = await getPromptBySlugOrId(sp.fork, viewer?.id);
    if (found) {
      mode = "fork";
      sourcePrompt = found;
    }
  }

  return (
    <CreateClient
      mode={mode}
      sourcePrompt={sourcePrompt}
      editForbidden={editForbidden}
    />
  );
}
