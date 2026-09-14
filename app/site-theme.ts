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
    id: "advent",
    name: "대림절",
    description: "기다림과 소망을 보라빛과 촛불 금색으로 표현합니다.",
    colors: ["#55466F", "#352B49", "#C5A45C", "#F7F3EA"],
    palette: { green: "#55466F", greenText: "#352B49", coral: "#A98436", paper: "#FFFEFA", text: "#403B47" },
  },
  {
    id: "christmas",
    name: "크리스마스",
    description: "전나무 초록, 따뜻한 금색, 베리빛 포인트로 성탄을 맞이합니다.",
    colors: ["#285341", "#173D30", "#C64D4B", "#D9B86C"],
    palette: { green: "#285341", greenText: "#173D30", coral: "#B23D3B", paper: "#FFFEFA", text: "#3D4540" },
  },
] as const;

export type SiteThemeId = (typeof SITE_THEMES)[number]["id"];
export const DEFAULT_SITE_THEME: SiteThemeId = "everyday";

export function isSiteThemeId(value: unknown): value is SiteThemeId {
  return typeof value === "string" && SITE_THEMES.some((theme) => theme.id === value);
}

let ensurePromise: Promise<void> | undefined;
async function ensureSiteSettings() {
  if (ensurePromise) return ensurePromise;
  ensurePromise = database()
    .prepare("CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)")
    .run()
    .then(() => undefined)
    .catch((error) => {
      ensurePromise = undefined;
      throw error;
    });
  return ensurePromise;
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
