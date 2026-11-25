import type { Metadata } from "next";
import CompareClient from "@/components/CompareClient";
import { getCurrentUser } from "@/lib/auth";
import { listPrompts } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PPT 风格并排对比台",
  description:
    "将 2–3 套 PPT 提示词视觉风格并排展示，同步切换封面、目录、数据、对比与结尾页，高效挑选最契合场景的设计语言。",
};

export default async function ComparePage() {
  const viewer = await getCurrentUser();
  const allPrompts = listPrompts({ sort: "popular", viewerId: viewer?.id });
  return <CompareClient allPrompts={allPrompts} />;
}
