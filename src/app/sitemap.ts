import type { MetadataRoute } from "next";
import { eq, max } from "drizzle-orm";
import { getDb, listPrompts } from "@/lib/db";
import { prompts, users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (
    process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ).replace(/\/+$/, "");

  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/gallery`, lastModified: now, changeFrequency: "daily", priority: 0.95 },
    { url: `${baseUrl}/generate`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/compare`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/create`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/tools`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];

  // Strictly public styles only — zero private prompt leakage
  const publicPrompts = await listPrompts({});
  for (const p of publicPrompts) {
    if (!p.isPublic) continue;
    entries.push({
      url: `${baseUrl}/studio/${encodeURIComponent(p.slug)}`,
      lastModified: new Date(p.updatedAt || p.createdAt || now),
      changeFrequency: "weekly",
      priority: 0.85,
    });
  }

  // Public creators who have at least 1 public prompt
  const creators = await getDb()
    .select({ username: users.username, lastUpdated: max(prompts.updatedAt) })
    .from(users)
    .innerJoin(prompts, eq(prompts.authorId, users.id))
    .where(eq(prompts.isPublic, true))
    .groupBy(users.username);

  for (const c of creators) {
    entries.push({
      url: `${baseUrl}/creator/${encodeURIComponent(c.username)}`,
      lastModified: c.lastUpdated ? new Date(c.lastUpdated) : now,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  return entries;
}
