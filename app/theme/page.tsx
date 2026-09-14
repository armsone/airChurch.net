import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import MakingNav from "../making/making-nav";
import { hasAdminAccess } from "../admin-access";
import { siteIdentityForHost } from "../site-identity";
import { readSelectedSiteTheme, SITE_THEMES } from "../site-theme";
import ThemeChoices from "./theme-choices";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "에어처치 테마 | 색상과 화면 분위기",
  description: "에어처치의 평소·새봄·포털·대림절·크리스마스 테마 색상표와 미리보기입니다.",
};

export default async function ThemePage() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-site-brand-host") ?? requestHeaders.get("host");
  if (siteIdentityForHost(host).domain !== "airchurch.net") notFound();
  const [setting, canManage] = await Promise.all([readSelectedSiteTheme(), hasAdminAccess()]);
  return <main className="making-shell theme-page">
    <div className="making-section-nav"><a href="/making">에어처치 만들기</a><MakingNav current="theme" /></div>
    <header className="theme-page-heading"><span>COLOR THEMES</span><h1>계절에 따라, 한결같은 기준으로</h1><p>테마마다 계절의 색을 분명히 담고, 투데이 패널은 말씀·찬양·소식 등 주제별 고유 색을 유지합니다.</p></header>
    <ThemeChoices themes={SITE_THEMES} selected={setting.theme} canManage={canManage} settingsAvailable={setting.available} />
    {!canManage && <p className="theme-admin-note"><a href="/admin">관리자 로그인</a> 후 사이트 전체에 사용할 테마를 선택할 수 있습니다.</p>}
  </main>;
}
