import type { Metadata } from "next";
import Home from "./classic-home-client";

export const metadata:Metadata={alternates:{canonical:"/"}};
export const dynamic="force-static";

export default function Page() {
  return <Home />;
}
