import type { Metadata } from "next";
import SiteFooter from "../site-footer";
import ContestBoard from "./contest-board";
import "./contest.css";
export const metadata:Metadata={title:"10월 찬양대회 · 총상금 100만 원 | airChurch",description:"내 유튜브 찬양 영상을 등록하고 좋아요로 응원해 주세요. 10월 1일 시작, 18일 좋아요 마감, 19일 결과 발표.",alternates:{canonical:"/praise-contest"},openGraph:{title:"에이처치 10월 찬양대회",description:"당신의 찬양을 들려주세요. 총상금 100만 원 · 10월 1일 시작",url:"https://airchurch.net/praise-contest"}};
export default function ContestPage(){return <main className="contest-shell"><ContestBoard/><SiteFooter/></main>;}
