import type { Metadata } from "next";
import Home from "./home-client";

export const metadata:Metadata={alternates:{canonical:"/"}};
export const dynamic="force-dynamic";

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const params=await searchParams;
  const initialQuery=String(Array.isArray(params.q)?params.q[0]??"":params.q??"").trim().slice(0,100);
  return <Home initialQuery={initialQuery}/>;
}
