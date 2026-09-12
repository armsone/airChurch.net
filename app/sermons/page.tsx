import type { Metadata } from "next";
import MediaBrowser from "../media/media-browser";
import "../media/media.css";
export const metadata:Metadata={title:"말씀 찾아보기 | airChurch",description:"교회·목회자·제목으로 공식 채널의 설교 말씀을 찾아보세요.",alternates:{canonical:"/sermons"}};
export const dynamic="force-static";
export default function SermonsPage(){return <main className="church-detail-shell"><section className="media-page" id="primary-content" tabIndex={-1}><span className="section-kicker">매일 새로 만나는</span><h1>말씀 찾아보기</h1><MediaBrowser kind="sermon"/></section></main>;}
