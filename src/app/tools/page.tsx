import type { Metadata } from "next";
import ToolsClient from "@/components/ToolsClient";
import { getCurrentUser } from "@/lib/auth";
import { listPrompts } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PPT 效率工具箱 · 本地隐私实用工具",
  description:
    "纯本地浏览器运行的 PPT 高频效率工具：演讲时长节拍测算、旧 PPTX 诊断与备注提取、品牌图抽色与 WCAG 投影可读性体检、视觉导演 AI 生图提示词快编。",
};

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const viewer = await getCurrentUser();
  const styles = listPrompts({ sort: "popular", viewerId: viewer?.id });
  return <ToolsClient styles={styles} initialTab={sp.tab} />;
}
