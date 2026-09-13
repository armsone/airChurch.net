export const siteIdentities = {
  "airchurch.net": { domain: "airchurch.net", name: "에어처치", wordmark: "airChurch.net", description: "사람과 교회를 잇는 크리스천 포털", headline: "말씀을 발견하고", tagline: "교회와 이어지는 곳" },
  "goodshare.net": { domain: "goodshare.net", name: "선한영향력", wordmark: "goodShare.net", description: "사람과 교회를 잇는 선한 영향력", headline: "선한영향력", tagline: "작은 나눔으로 함께하는 곳" },
  "linechurch.net": { domain: "linechurch.net", name: "라인처치", wordmark: "lineChurch.net", description: "사람과 교회를 잇는 라인 처치", headline: "라인처치", tagline: "말씀으로 사람과 교회를 잇는 곳" },
} as const;
export type SiteIdentity = typeof siteIdentities[keyof typeof siteIdentities];
export function siteIdentityForHost(host: string | null): SiteIdentity {
  const hostname = (host ?? "").toLowerCase().split(":")[0].replace(/^www\./, "");
  return siteIdentities[hostname as keyof typeof siteIdentities] ?? siteIdentities["airchurch.net"];
}
