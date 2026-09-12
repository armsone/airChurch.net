import type { Metadata } from "next";
import { hasAdminAccess } from "../../admin-access";
import AdminLogin from "../admin-login";
import MakingEditor from "./editor";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"에어처치 만들기 관리",robots:{index:false,follow:false}};
export default async function MakingAdminPage(){if(!await hasAdminAccess())return <AdminLogin/>;return <main className="making-shell"><a href="/admin">← 관리자</a><h1>에어처치 만들기 관리</h1><p>글을 작성하고 공개 여부를 정하거나, 접수된 댓글을 확인합니다.</p><a href="/making">게시판 보기</a><MakingEditor/></main>;}
