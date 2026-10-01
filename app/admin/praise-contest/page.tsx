import { hasAdminAccess } from "../../admin-access";
import AdminLogin from "../admin-login";
import ContestAdmin from "./contest-admin";
import "../../praise-contest/contest.css";
import "./contest-admin.css";
export const dynamic="force-dynamic";
export default async function Page(){if(!await hasAdminAccess())return <AdminLogin/>;return <main className="contest-shell contest-admin-page"><header className="contest-admin-page-header"><div><p className="contest-admin-kicker">이벤트 관리</p><h1>찬양대회 관리</h1><p>참가작의 정보를 수정하고 공개 상태를 관리하세요.</p></div><nav aria-label="행사 관리 이동"><a href="/admin">← 관리자 홈</a><a href="/praise-contest/2026-10-01">대회 페이지 보기 ↗</a></nav></header><ContestAdmin/></main>;}
