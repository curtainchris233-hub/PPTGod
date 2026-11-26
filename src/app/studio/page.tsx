import { redirect } from "next/navigation";
import { listPrompts } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function StudioIndexRedirectPage() {
  const prompts = await listPrompts({ sort: "popular" });
  const targetSlug = prompts[0]?.slug ?? "apple-soft-bento-modular";
  redirect(`/studio/${encodeURIComponent(targetSlug)}`);
}
