import type { Metadata } from "next";
import Home from "../home-client";

export const metadata:Metadata={
  title:"에어처치 전체 포털",
  description:"말씀·찬양·교회·목회자·교계소식과 공동체 기능을 한곳에서 이용합니다.",
  robots:{index:false,follow:true},
};
export const dynamic="force-static";

export default function PortalPage(){
  return <Home/>;
}
