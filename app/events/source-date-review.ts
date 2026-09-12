// This notice's schedule says September 2, while its body says September 3
// (Wednesday). In 2026 September 2 is Wednesday and September 3 is Thursday.
// Hold only while that exact contradiction remains in the official content.
export function sourceDateReviewReason(html:string,sourceId:string,sourceUrl:string):string|null {
  if(sourceId!=="jiguchon")return null;
  try {
    const url=new URL(sourceUrl);
    if(url.origin!=="https://www.jiguchon.or.kr"||url.username||url.password||url.pathname!=="/bbs/board.php"||url.searchParams.getAll("bo_table").length!==1||url.searchParams.get("bo_table")!=="G02"||url.searchParams.getAll("wr_id").length!==1||url.searchParams.get("wr_id")!=="1164")return null;
  }catch{return null;}
  const clean=(value:string)=>value.replace(/<!--[\s\S]*?-->/g,"").replace(/<(script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,"").replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/\s+/g," ").trim();
  const notice=html.match(/<div\b[^>]*class=["']notice_information["'][^>]*>([\s\S]*?)<section\b[^>]*id=["']bo_v_atc["']/i)?.[1]||"";
  const periods=[...notice.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(match=>clean(match[1])).filter(value=>/^사역일정\s/.test(value));
  if(periods.length!==1||!/^사역일정\s+2026\.\s*09\.\s*02\s*-\s*2026\.\s*09\.\s*23$/.test(periods[0]))return null;
  const content=html.match(/<div\b[^>]*id=["']bo_v_con["'][^>]*>([\s\S]*?)<!--\s*}\s*본문 내용 끝\s*-->/i)?.[1];
  if(!content||!/일시\s*[:：]\s*9\s*\/\s*3\s*\(\s*수\s*\)/.test(clean(content)))return null;
  return "official_date_conflict";
}
