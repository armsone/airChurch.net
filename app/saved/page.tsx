import type { Metadata } from "next";
import SavedClient from "./saved-client";

export const metadata:Metadata={title:"나의 모음 | airChurch",description:"관심 있는 말씀·찬양·교회·목회자·행사를 이 브라우저에서 이어봅니다.",robots:{index:false,follow:true}};

export default function SavedPage(){return <><div id="primary-content" tabIndex={-1}><SavedClient/></div></>;}
