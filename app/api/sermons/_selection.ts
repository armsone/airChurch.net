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

const shortFormKeywords=/(?:^|\s|[[(#])(1분|2분|3분|60초|90초|한줄|짧은\s*말씀|짧은\s*설교|미니\s*설교|설교\s*클립|말씀\s*클립)/i;
const longFormKeywords=/(주일\s*(오전|오후|낮|저녁)?\s*예배|수요\s*(예배|기도회)|금요\s*(예배|기도회)|새벽\s*(예배|기도회)|찬양대|성가대|독주회|정기\s*연주회|전체\s*예배|full\s*(service|worship))/i;

// Middle-ground fallback: topic is unrestricted, but unlabelled videos must be
// very short and must not look like a complete service or choir performance.
export function isShortCandidate(title:string,durationSeconds:number) {
  if(isShortTitle(title)||shortFormKeywords.test(title))return true;
  return durationSeconds >= 5 && durationSeconds <= 90 && !longFormKeywords.test(title);
}

export function youtubeDurationSeconds(value:string) {
  const match=value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if(!match)return 0;
  return Number(match[1]||0)*3600+Number(match[2]||0)*60+Number(match[3]||0);
}

export function isPraiseTitle(title:string) {
  return /(찬양|찬송|성가|워십|worship|praise|choir|특송|송축)/i.test(title) && !/(설교|말씀|간증|성경공부|세미나)/i.test(title);
}
