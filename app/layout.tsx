import type { Metadata, Viewport } from "next";
import "./globals.css";
import VisitorTracker from "./visitor-tracker";
import AdminBulkBar from "./admin-bulk-selection";
import SiteHeader from "./site-header";
import SiteFooter from "./site-footer";
import SkipLink from "./skip-link";
import { headers } from "next/headers";
import { siteIdentityForHost } from "./site-identity";
import { SiteIdentityProvider } from "./site-identity-context";

export const dynamic = "force-dynamic";
async function requestIdentity() {
  const requestHeaders = await headers();
  return siteIdentityForHost(requestHeaders.get("x-site-brand-host") ?? requestHeaders.get("host"));
}

export async function generateMetadata(): Promise<Metadata> {
  const identity = await requestIdentity();
  return {
  metadataBase: new URL(`https://${identity.domain}`),
  applicationName: identity.name,
  title: identity.domain === "airchurch.net" ? "에어처치 | 말씀을 발견하고 교회와 이어지는 곳" : `${identity.name} | ${identity.tagline}`,
  description: "공개된 말씀과 교계 소식을 정리하고, 사람을 건강한 지역교회와 잇는 가볍고 정직한 크리스천 포털",
  category: "religion",
  verification: {
    google: "nNxbb3NBzUX3Nf1Xy79UGJKs2d2a6-egj06BPJFjSPg",
    other: { "naver-site-verification": "e857bad726151196aee5a281878796705fc8b6a5" },
  },
  manifest: "/site.webmanifest",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: identity.domain === "airchurch.net" ? "에어처치 | 말씀을 발견하고 교회와 이어지는 곳" : `${identity.name} | ${identity.tagline}`,
    description: "공개된 말씀과 소식을 정리해 사람과 건강한 지역교회를 잇습니다.",
    url: `https://${identity.domain}`,
    siteName: identity.name,
    locale: "ko_KR",
    type: "website",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "말씀을 발견하고 교회와 이어지는 곳" }],
  },
  twitter: { card:"summary_large_image", title:identity.name, description:"말씀을 발견하고 교회와 이어지는 곳", images:["/og.png"] },
};
}

export const viewport: Viewport = {
  themeColor: "#18362F",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const identity = await requestIdentity();
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: identity.name,
      alternateName: identity.wordmark,
      url: `https://${identity.domain}`,
      description: "말씀과 찬양을 발견하고 지역교회와 이어지는 크리스천 포털",
      inLanguage: "ko-KR",
      potentialAction: {
        "@type": "SearchAction",
        target: `https://${identity.domain}/search?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: identity.name,
      alternateName: identity.wordmark,
      url: `https://${identity.domain}`,
      logo: `https://${identity.domain}/icon-512.png`,
    },
  ];
  return (
    <html lang="ko"><head><link rel="dns-prefetch" href="https://i.ytimg.com"/><link rel="dns-prefetch" href="https://www.youtube.com"/></head><body><SiteIdentityProvider identity={identity}><SkipLink target="site-content"/><SiteHeader/><div id="site-content" tabIndex={-1}>{children}</div><SiteFooter identity={identity}/><AdminBulkBar/><VisitorTracker /><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structuredData).replace(/</g,"\\u003c")}} /></SiteIdentityProvider></body></html>
  );
}
