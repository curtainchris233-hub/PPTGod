import type { Metadata } from "next";
import GalleryClient, {
  type GalleryInitialFilters,
} from "@/components/GalleryClient";
import { getCurrentUser } from "@/lib/auth";
import { listPrompts } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "风格参考库 · 浏览全部 PPT 视觉风格",
  description:
    "按场景、配色与版式浏览 PPTGod 全部演示文稿视觉风格，查看真实画布预览、收藏、加入对比，或一键用该风格生成 PPT。",
};

function firstParam(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] ?? "";
  return typeof val === "string" ? val : "";
}

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const initialFilters: GalleryInitialFilters = {
    q: firstParam(sp.q).slice(0, 80),
    domain: firstParam(sp.domain),
    scenario: firstParam(sp.scenario),
    style: firstParam(sp.style),
    color: firstParam(sp.color),
    tool: firstParam(sp.tool),
    sort: firstParam(sp.sort),
  };

  const viewer = await getCurrentUser();
  const initialPrompts = await listPrompts({
    sort: "popular",
    viewerId: viewer?.id,
  });

  return (
    <GalleryClient
      initialPrompts={initialPrompts}
      initialSearch={initialFilters.q}
      initialFilters={initialFilters}
    />
  );
}
