import GalleryClient from "@/components/GalleryClient";
import { getCurrentUser } from "@/lib/auth";
import { listPrompts } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const viewer = await getCurrentUser();
  const initialPrompts = listPrompts({
    sort: "popular",
    viewerId: viewer?.id,
  });

  return <GalleryClient initialPrompts={initialPrompts} />;
}
