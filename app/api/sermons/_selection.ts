const sermonKeywords=/(설교|말씀|목사|예배|강해)/i;
const excludedKeywords=/(찬양|성가|특송|광고|공지|교회소식|성경읽기|성경통독|쇼츠|shorts|예고|하이라이트|간증|교회학교)/i;

export function isSermonTitle(title:string) {
  return sermonKeywords.test(title) && !excludedKeywords.test(title);
}
