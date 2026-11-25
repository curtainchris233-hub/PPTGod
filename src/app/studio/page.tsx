import { redirect } from "next/navigation";
import { listPrompts } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function StudioIndexRedirectPage() {
  const prompts = listPrompts({ sort: "popular" });
  const targetSlug = prompts[0]?.slug ?? "apple-soft-bento-modular";
  redirect(`/studio/${encodeURIComponent(targetSlug)}`);
}
