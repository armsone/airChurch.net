import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
    {
      source: "/",
      headers: [{ key: "Cache-Control", value: "public, s-maxage=3600, stale-while-revalidate=86400" }],
    },
    {
      source: "/:page(about|community-guidelines|privacy|copyright|terms|saved)",
      headers: [{ key: "Cache-Control", value: "public, s-maxage=3600, stale-while-revalidate=86400" }],
    },
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default nextConfig;
