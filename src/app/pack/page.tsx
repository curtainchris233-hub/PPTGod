import type { Metadata } from "next";
import PromptPackWorkbench from "@/components/pack/PromptPackWorkbench";
import { getPromptBySlugOrId } from "@/lib/db";
import { promptItemToPackStyle, type PackStyle } from "@/lib/promptPack";

export const metadata: Metadata = {
  title: "提示词包 · 资料一键变成可直接用的 PPT 提示词",
  description:
    "上传论文、课本或报告，PPTGod 自动提炼定制风格（色板 HEX / 字体 / 版式语法）与逐页大纲，生成适配 ChatGPT、Gamma、Kimi、Claude 的总提示词，数据只取自你的资料。",
};

export default async function PackPage({
  searchParams,
}: {
  searchParams: Promise<{ style?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawStyle = Array.isArray(params.style) ? params.style[0] : params.style;
  const slug = typeof rawStyle === "string" ? rawStyle.trim().slice(0, 80) : "";

  let initialAnchorStyle: PackStyle | null = null;
  if (slug) {
    try {
      const item = await getPromptBySlugOrId(slug);
      if (item) {
        initialAnchorStyle = promptItemToPackStyle(item);
      }
    } catch {
      initialAnchorStyle = null;
    }
  }

  return <PromptPackWorkbench initialAnchorStyle={initialAnchorStyle} />;
}
