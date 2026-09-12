import type { Metadata } from "next";
import MediaBrowser from "../media/media-browser";
import "../media/media.css";
export const metadata:Metadata={title:"교회 쇼츠 | airChurch",description:"교회·목회자·제목으로 짧은 교회 영상을 찾아보세요.",alternates:{canonical:"/shorts"}};
export const dynamic="force-static";
export default function ShortsPage(){return <main className="church-detail-shell"><section className="media-page" id="primary-content" tabIndex={-1}><span className="section-kicker">짧지만 진한 은혜</span><h1>교회 쇼츠</h1><MediaBrowser kind="short"/></section></main>;}
