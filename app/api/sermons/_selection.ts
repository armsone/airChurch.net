const sermonKeywords=/(설교|말씀|목사|주일예배|수요예배|금요(?:기도회|성령집회)|새벽(?:기도회|예배)|강해)/i;
const excludedKeywords=/(찬양|성가|특송|광고|공지|교회소식|성경읽기|성경통독|쇼츠|shorts|예고|하이라이트|간증|교회학교)/i;

export function isSermonTitle(title:string) {
  return sermonKeywords.test(title) && !excludedKeywords.test(title);
}
