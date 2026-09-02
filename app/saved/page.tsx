import type { Metadata } from "next";
import SavedClient from "./saved-client";
import SkipLink from "../skip-link";

export const metadata:Metadata={title:"나의 모음 | airChurch",description:"관심 있는 교회와 말씀, 찬양을 이 브라우저에서 이어봅니다.",robots:{index:false,follow:true}};

export default function SavedPage(){return <><SkipLink/><div id="primary-content" tabIndex={-1}><SavedClient/></div></>;}
