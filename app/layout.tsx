import type { Metadata, Viewport } from "next";
import "./globals.css";
import VisitorTracker from "./visitor-tracker";

export const metadata: Metadata = {
  metadataBase: new URL("https://airchurch.net"),
  applicationName: "에어처치",
  title: "에어처치 | 말씀을 발견하고 교회와 이어지는 곳",
  description: "공개된 말씀과 교계 소식을 정리하고, 사람을 건강한 지역교회와 잇는 가볍고 정직한 크리스천 포털",
  category: "religion",
  manifest: "/site.webmanifest",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "에어처치 | 말씀을 발견하고 교회와 이어지는 곳",
    description: "공개된 말씀과 소식을 정리해 사람과 건강한 지역교회를 잇습니다.",
    url: "https://airchurch.net",
    siteName: "에어처치",
    locale: "ko_KR",
    type: "website",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "말씀을 발견하고 교회와 이어지는 곳" }],
  },
  twitter: { card:"summary_large_image", title:"에어처치", description:"말씀을 발견하고 교회와 이어지는 곳", images:["/og.png"] },
};

export const viewport: Viewport = {
  themeColor: "#18362F",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "에어처치",
      alternateName: "airChurch",
      url: "https://airchurch.net",
      description: "말씀과 찬양을 발견하고 지역교회와 이어지는 크리스천 포털",
      inLanguage: "ko-KR",
      potentialAction: {
        "@type": "SearchAction",
        target: "https://airchurch.net/?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "에어처치",
      alternateName: "airChurch",
      url: "https://airchurch.net",
      logo: "https://airchurch.net/icon-512.png",
    },
  ];
  return (
    <html lang="ko"><head><link rel="dns-prefetch" href="https://i.ytimg.com"/><link rel="dns-prefetch" href="https://www.youtube.com"/></head><body>{children}<VisitorTracker /><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structuredData).replace(/</g,"\\u003c")}} /></body></html>
  );
}
