import type { Metadata } from "next";
import CtsDiscovery from "../cts-discovery";
import "../portal-today.css";
export const metadata:Metadata={title:"신앙이야기 | airChurch",description:"간증과 삶, 청년의 질문, 성경 이야기를 주제별로 찾아보고 감상하세요.",alternates:{canonical:"/faith-stories"}};
export default function FaithStoriesPage(){return <main className="church-detail-shell"><section className="faith-stories-page" id="primary-content" tabIndex={-1}><a href="/#faith-stories">← 에어처치로 돌아가기</a><h1 className="sr-only">신앙이야기</h1><CtsDiscovery dedicated/></section></main>;}
