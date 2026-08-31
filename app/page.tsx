import Home from "./home-client";
import type { Metadata } from "next";

export const dynamic="force-static";
export const revalidate=3600;
export const metadata:Metadata={alternates:{canonical:"/"}};

export default function Page() {
  return <Home />;
}
