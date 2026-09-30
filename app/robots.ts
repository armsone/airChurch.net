import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Limit the reviewer route without blocking the public /pastors directory.
      disallow: ["/admin", "/pastor$", "/pastor/", "/pastor?", "/api/"],
    },
    sitemap: "https://airchurch.net/sitemap.xml",
    host: "https://airchurch.net",
  };
}
