import Home from "./home-client";
import type { Metadata } from "next";

export const metadata:Metadata={alternates:{canonical:"/"}};
export const dynamic="force-static";

export default function Page() {
  return <Home />;
}
