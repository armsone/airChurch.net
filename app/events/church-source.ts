import type { SourceConfig } from "./sources";

// Verified 2026-09-12: G02 posts 1167 (Baptist church, Bundang chapel),
// 1170 (Bundang chapel 711), and 1171 (pastor Lee Dong-won, both chapels).
// Their live event IDs were 218b9a0534498653c2d66197509d6b97,
// 19f60be947c79e0fee01c4508bbf8065, and 432d242ab7ae1e6b28183821dabde5af.
// Source: https://www.jiguchon.or.kr/bbs/board.php?bo_table=G02&wr_id=1167
// Source: https://www.jiguchon.or.kr/bbs/board.php?bo_table=G02&wr_id=1170
// Source: https://www.jiguchon.or.kr/bbs/board.php?bo_table=G02&wr_id=1171
// The three verified posts above may lack a literal organizer field; only
// these posts accept the extractor's unknown value. Seven other live G02
// events remain unverified and do not receive that exception.
// This is a public church ID; resolve its internal database ID before storing.
export function verifiedEventChurchPublicId(source:SourceConfig,candidateUrl:string,organizer:string):number|null {
  if(source.kind!=="official"||source.id!=="jiguchon"||source.churchPublicId!==10017||source.churchName!=="지구촌교회"||source.name!=="지구촌교회")return null;
  try {
    const homepage=new URL(source.homepage),listing=new URL(source.url),candidate=new URL(candidateUrl);
    if([homepage,listing,candidate].some(url=>url.origin!=="https://www.jiguchon.or.kr"||url.username||url.password))return null;
    if(homepage.pathname!=="/"||listing.pathname!=="/bbs/board.php"||candidate.pathname!=="/bbs/board.php")return null;
    if([listing,candidate].some(url=>url.searchParams.getAll("bo_table").length!==1||url.searchParams.get("bo_table")!=="G02"))return null;
    if(candidate.searchParams.getAll("wr_id").length!==1||!/^\d+$/.test(candidate.searchParams.get("wr_id")||""))return null;
    const verifiedNotice=["1167","1170","1171"].includes(candidate.searchParams.get("wr_id")||"");
    if(organizer.replace(/\s/g,"")!==source.churchName&&!(organizer==="주최 확인 필요"&&verifiedNotice))return null;
    return source.churchPublicId;
  }catch{return null;}
}
