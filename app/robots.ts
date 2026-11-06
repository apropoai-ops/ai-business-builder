import type { MetadataRoute } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/businesses/", "/settings/", "/api/", "/cancel/"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
