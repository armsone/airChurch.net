import type { Metadata, Viewport } from "next";
import "./globals.css";
import VisitorTracker from "./visitor-tracker";

export const metadata: Metadata = {
  metadataBase: new URL("https://airchurch.net"),
  title: "에어처치 | 말씀을 발견하고 교회와 이어지는 곳",
  description: "공개된 말씀과 교계 소식을 정리하고, 사람을 건강한 지역교회와 잇는 가볍고 정직한 크리스천 포털",
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
    images: [{ url: "/og.png", width: 1732, height: 909, alt: "말씀을 발견하고 교회와 이어지는 곳" }],
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
  return (
    <html lang="ko"><body>{children}<VisitorTracker /></body></html>
  );
}
