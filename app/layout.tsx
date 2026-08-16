import type { Metadata, Viewport } from "next";
import "./globals.css";
import VisitorTracker from "./visitor-tracker";

export const metadata: Metadata = {
  metadataBase: new URL("https://airchurch.net"),
  title: "에어처치 | 말씀과 선한 마음이 만나는 곳",
  description: "검증된 교회의 설교를 발견하고, 우리 교회를 응원하며, 착한 나눔에 참여하는 크리스천 포털",
  manifest: "/site.webmanifest",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "에어처치 | 말씀과 선한 마음이 만나는 곳",
    description: "말씀을 발견하고, 교회를 응원하며, 나의 달란트로 누군가의 내일을 돕습니다.",
    url: "https://airchurch.net",
    siteName: "에어처치",
    locale: "ko_KR",
    type: "website",
    images: [{ url: "/og.png", width: 1732, height: 909, alt: "말씀과 선한 마음이 만나는 곳" }],
  },
  twitter: { card:"summary_large_image", title:"에어처치", description:"말씀과 선한 마음이 만나는 곳", images:["/og.png"] },
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
