import { hasAdminAccess } from "../../admin-access";
import AdminLogin from "../admin-login";
import ContestAdmin from "./contest-admin";
import "../../praise-contest/contest.css";
export const dynamic="force-dynamic";
export default async function Page(){if(!await hasAdminAccess())return <AdminLogin/>;return <main className="contest-shell"><h1>찬양대회 접수·재업로드 관리</h1><p><a href="/praise-contest">대회 페이지</a> · <a href="/admin">관리자 홈</a></p><p>원본과 게시 권리를 확인한 영상만 에이처치 유튜브에 업로드하세요. 참가 링크 등록과 채널 게시 완료는 별개입니다.</p><ContestAdmin/></main>;}
