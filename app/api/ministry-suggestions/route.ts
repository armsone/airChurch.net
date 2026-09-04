import {clean,consumeSubmissionLimit,database,ensureMinistryProfileTables,ensureSermonTables,fingerprint,readLimitedJson,requestOriginIsInvalid,resolveChurchId} from "../_shared";
import {safeHttpUrl} from "../../safe-url";

const roles=new Set(["담임목사","위임목사","대표목사","수석부목사","부목사","행정목사","목양목사","교육목사","강도사","전임전도사","교육전도사","전도사","협동목사","원로목사","은퇴목사"]);
const blockedHost=/(^|\.)(facebook\.com|instagram\.com|threads\.net|x\.com|twitter\.com|tiktok\.com|linkedin\.com|band\.us|kakao\.com|blog\.naver\.com|cafe\.naver\.com)$/i;
export async function POST(request:Request){
  if(requestOriginIsInvalid(request))return Response.json({error:"요청을 확인할 수 없습니다."},{status:403});
  const body=await readLimitedJson(request,8192);if(body.tooLarge)return Response.json({error:"제보 내용이 너무 깁니다."},{status:413});const data=body.data;
  if(clean(data.company,20))return Response.json({ok:true});
  const churchId=Number(data.churchId),name=clean(data.name,60),roleTitle=clean(data.roleTitle,30),note=clean(data.note,500),rawSource=clean(data.sourceUrl,500),sourceUrl=rawSource?safeHttpUrl(rawSource):null;
  if(!Number.isInteger(churchId)||churchId<1||name.length<2||!roles.has(roleTitle)||note.length<5)return Response.json({error:"교역자 이름·직책과 확인 내용을 적어 주세요."},{status:400});
  if(rawSource&&!sourceUrl)return Response.json({error:"공개된 공식 출처 주소를 확인해 주세요."},{status:400});
  if(sourceUrl&&blockedHost.test(new URL(sourceUrl).hostname))return Response.json({error:"개인 SNS 대신 교회·교단·노회의 공식 공개 페이지를 적어 주세요."},{status:400});
  const db=database();await Promise.all([ensureSermonTables(db),ensureMinistryProfileTables(db)]);
  const internalChurchId=await resolveChurchId(db,churchId);
  if(!internalChurchId||!await db.prepare("SELECT id FROM churches WHERE id=? AND review_status='approved' LIMIT 1").bind(internalChurchId).first())return Response.json({error:"현재 제보할 수 없는 교회입니다."},{status:404});
  const fp=await fingerprint(request,"ministry-suggestion");if(!await consumeSubmissionLimit(db,"ministry-suggestion",fp,3,1440))return Response.json({error:"제보는 하루에 세 번까지 보낼 수 있습니다."},{status:429});
  const inserted=await db.prepare("INSERT INTO ministry_profile_suggestions (church_id,name,role_title,source_url,note,status,fingerprint) SELECT ?,?,?,?,?,'pending',? WHERE NOT EXISTS (SELECT 1 FROM ministry_profile_suggestions WHERE church_id=? AND name=? AND role_title=? AND status='pending')").bind(internalChurchId,name,roleTitle,sourceUrl,note,fp,internalChurchId,name,roleTitle).run();
  if(Number(inserted.meta.changes??0)!==1)return Response.json({error:"같은 교역자 제보가 이미 검토 대기 중입니다."},{status:409});
  return Response.json({ok:true},{status:201,headers:{"cache-control":"no-store"}});
}
