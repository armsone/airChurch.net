const sermonKeywords=/(설교|말씀|목사|예배|강해)/i;
const excludedKeywords=/(찬양|성가|특송|광고|공지|교회소식|성경읽기|성경통독|쇼츠|shorts|예고|하이라이트|간증|교회학교)/i;

export function isSermonTitle(title:string) {
  return sermonKeywords.test(title) && !excludedKeywords.test(title);
}

// Conservative title/hashtag classifier: the playlistItems API does not expose aspect ratio,
// so we only treat explicit #shorts/쇼츠 signals as Shorts rather than all short-duration videos.
const shortKeywords=/(#shorts|#쇼츠|\bshorts\b|쇼츠)/i;

export function isShortTitle(title:string) {
  return shortKeywords.test(title);
}

// YouTube Shorts can be up to three minutes long. Duration is intentionally a
// permissive fallback because many churches upload real Shorts without adding
// #shorts to the title. Content such as sermons, notices, ads, and praise is
// valid here; this classifier is about the short-form format, not the topic.
export function isShortDuration(durationSeconds:number) {
  return Number.isFinite(durationSeconds) && durationSeconds >= 5 && durationSeconds <= 180;
}

export function youtubeDurationSeconds(value:string) {
  const match=value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if(!match)return 0;
  return Number(match[1]||0)*3600+Number(match[2]||0)*60+Number(match[3]||0);
}

export function isPraiseTitle(title:string) {
  return /(찬양|찬송|성가|워십|worship|praise|choir|특송|송축)/i.test(title) && !/(설교|말씀|간증|성경공부|세미나)/i.test(title);
}
