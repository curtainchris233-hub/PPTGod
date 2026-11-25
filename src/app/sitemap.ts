import type { MetadataRoute } from "next";
import { getDb, listPrompts } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
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
  const publicPrompts = listPrompts({});
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
  const db = getDb();
  const creators = db
    .prepare(
      `SELECT DISTINCT u.username, MAX(p.updated_at) AS last_updated
       FROM users u
       INNER JOIN prompts p ON p.author_id = u.id AND p.is_public = 1
       GROUP BY u.username`
    )
    .all() as { username: string; last_updated: string | null }[];

  for (const c of creators) {
    entries.push({
      url: `${baseUrl}/creator/${encodeURIComponent(c.username)}`,
      lastModified: c.last_updated ? new Date(c.last_updated) : now,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  return entries;
}
