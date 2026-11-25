import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ).replace(/\/+$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/studio/", "/generate", "/compare", "/creator/"],
        disallow: ["/api/", "/collections", "/deck/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
