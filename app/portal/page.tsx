import type { Metadata } from "next";
import Home from "../home-client";

export const metadata:Metadata={
  title:"에어처치 전체 포털",
  description:"말씀·찬양·교회·목회자·교계소식과 공동체 기능을 한곳에서 이용합니다.",
  robots:{index:false,follow:true},
};
export const dynamic="force-dynamic";

export default async function PortalPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const params=await searchParams;
  const initialQuery=String(Array.isArray(params.q)?params.q[0]??"":params.q??"").trim().slice(0,100);
  return <Home initialQuery={initialQuery}/>;
}
