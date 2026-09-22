import { env } from "cloudflare:workers";

function database() {
  if (!env.DB) throw new Error("Database unavailable");
  return env.DB as D1Database;
}

export const SITE_THEMES = [
  {
    id: "everyday",
    name: "평소",
    description: "현재 에어처치의 차분한 녹색과 주황색을 유지합니다.",
    colors: ["#18362F", "#687C76", "#F8F5EE", "#EB7448"],
    palette: { green: "#18362F", greenText: "#FFFFFF", coral: "#EB7448", paper: "#FFFEFA", text: "#18362F" },
  },
  {
    id: "spring",
    name: "새봄",
    description: "참고 이미지의 싱그러운 녹색과 산뜻한 코랄을 담았습니다.",
    colors: ["#8EC179", "#184D22", "#FF7B4A", "#C94B2D"],
    palette: { green: "#8EC179", greenText: "#184D22", coral: "#FF7B4A", paper: "#FFFFFF", text: "#414641" },
  },
  {
    id: "portal",
    name: "포털",
    description: "네이버 메인에서 참고한 흰 여백과 얇은 회색 구분선, 정보 카드, 검색 중심의 맑은 초록을 담았습니다.",
    colors: ["#FFFFFF", "#F5F7F8", "#DDE2E5", "#03C75A", "#33383D"],
    palette: { green: "#FFFFFF", greenText: "#03C75A", coral: "#03C75A", paper: "#FFFFFF", text: "#33383D" },
  },
  {
    id: "advent",
    name: "대림절",
    description: "깊은 황혼빛 자주와 남청, 낮은 촛불의 금빛으로 기다림과 소망을 담습니다.",
    colors: ["#24202D", "#493652", "#3D536D", "#B49759", "#EEE9F0"],
    palette: { green: "#30263E", greenText: "#F7F1E6", coral: "#B49759", paper: "#F4F0F4", text: "#32263E" },
  },
  {
    id: "christmas",
    name: "크리스마스",
    description: "환한 크림빛 위에 축제의 레드·그린과 반짝이는 금빛을 힘 있게 담습니다.",
    colors: ["#0B612E", "#ED2945", "#FFD15C", "#EFF8E9", "#FFF2D8"],
    palette: { green: "#0B612E", greenText: "#FFFFFF", coral: "#ED2945", paper: "#FFFDF6", text: "#12452B" },
  },
] as const;

export type SiteThemeId = (typeof SITE_THEMES)[number]["id"];
export const DEFAULT_SITE_THEME: SiteThemeId = "everyday";

export function isSiteThemeId(value: unknown): value is SiteThemeId {
  return typeof value === "string" && SITE_THEMES.some((theme) => theme.id === value);
}

let siteSettingsReady = false;
async function ensureSiteSettings() {
  if (siteSettingsReady) return;
  // Share only completed initialization; pending D1 I/O belongs to this request.
  await database()
    .prepare("CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)")
    .run();
  siteSettingsReady = true;
}

export async function readSelectedSiteTheme(): Promise<{ theme: SiteThemeId | null; available: boolean }> {
  try {
    await ensureSiteSettings();
    const row = await database().prepare("SELECT value FROM site_settings WHERE key='site_theme' LIMIT 1").first<{ value: string }>();
    return { theme: isSiteThemeId(row?.value) ? row.value : DEFAULT_SITE_THEME, available: true };
  } catch (error) {
    console.error("Unable to load the selected site theme.", error);
    return { theme: null, available: false };
  }
}

export async function getSelectedSiteTheme(): Promise<SiteThemeId> {
  const setting = await readSelectedSiteTheme();
  return setting.theme ?? DEFAULT_SITE_THEME;
}

export async function saveSelectedSiteTheme(theme: SiteThemeId) {
  await ensureSiteSettings();
  await database()
    .prepare("INSERT INTO site_settings (key,value,updated_at) VALUES ('site_theme',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP")
    .bind(theme)
    .run();
}
