import { accessSession } from "../../../admin-access";
import { clean, database, ensureAdminTables, readLimitedJson } from "../../_shared";
import { normalizeSearchValue, sqlNormalized } from "../../../search-domain";

async function requestRole(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return null;
  return accessSession(request);
}

export async function PATCH(request: Request) {
  const session=await requestRole(request);
  if (!session) return Response.json({ error: "운영자 권한이 필요합니다." }, { status: 403 });
  const {role}=session;

  const body=await readLimitedJson(request);if(body.tooLarge)return Response.json({error:"요청 내용이 너무 큽니다."},{status:413,headers:{"cache-control":"no-store"}});const data=body.data;
  const id = Number(data.id);
  const kind = clean(data.kind, 40);
  if(role==="reviewer"&&kind!=="church-change-request") return Response.json({error:"교회 정보 요청 권한만 사용할 수 있습니다."},{status:403});
  if (kind !== "church-batch" && (!Number.isInteger(id) || id < 1)) return Response.json({ error: "대상을 확인해 주세요." }, { status: 400 });

  const db = database();
  await ensureAdminTables(db);

  if(kind==="church-batch") {
    if(role!=="admin") return Response.json({error:"관리자만 교회를 일괄 처리할 수 있습니다."},{status:403});
    const status=clean(data.status,20);
    if(!["approved","removed","deleted"].includes(status)) return Response.json({error:"상태를 확인해 주세요."},{status:400});
    const suppliedIds=Array.isArray(data.ids)?data.ids:[];
    const ids=[...new Set(suppliedIds.map(Number).filter((value)=>Number.isInteger(value)&&value>0))];
    if(!ids.length) return Response.json({error:"선택한 교회를 확인해 주세요."},{status:400});
    if(ids.length>500) return Response.json({error:"한 번에 500곳까지 처리할 수 있습니다."},{status:400});
    const statements=ids.map((churchId)=>status==="removed"
      ?db.prepare("UPDATE churches SET review_status='removed',hold_reason='review_needed',hold_note='관리자 일괄 보류',held_at=CURRENT_TIMESTAMP WHERE id=? AND review_status='approved'").bind(churchId)
      :status==="approved"
        ?db.prepare("UPDATE churches SET review_status='approved' WHERE id=? AND review_status='removed'").bind(churchId)
        :db.prepare("UPDATE churches SET review_status='deleted' WHERE id=? AND review_status IN ('approved','removed')").bind(churchId));
    const results=await db.batch(statements),updated:number[]=[],failed:number[]=[];
    ids.forEach((churchId,index)=>(Number(results[index]?.meta?.changes??0)===1?updated:failed).push(churchId));
    if(updated.length&&(status==="removed"||status==="deleted")) {
      for(let offset=0;offset<updated.length;offset+=80) {
        const chunk=updated.slice(offset,offset+80),placeholders=chunk.map(()=>"?").join(",");
        await db.batch([db.prepare(`UPDATE sermons SET status='hidden' WHERE church_id IN (${placeholders})`).bind(...chunk),db.prepare(`UPDATE praise_videos SET status='hidden' WHERE church_id IN (${placeholders})`).bind(...chunk),db.prepare(`UPDATE church_shorts SET status='hidden' WHERE church_id IN (${placeholders})`).bind(...chunk)]);
      }
    }
    return Response.json({ok:true,updated,failed},{headers:{"cache-control":"no-store"}});
  } else if(kind==="reviewer-account") {
    if(role!=="admin") return Response.json({error:"관리자만 검토자 계정을 관리할 수 있습니다."},{status:403});
    const status=clean(data.status,20);
    if(status==="deleted") {
      const affected=await db.prepare("SELECT DISTINCT church_id FROM reviewer_church_reviews WHERE reviewer_id=?").bind(id).all<{church_id:number}>();
      const statements=[
        db.prepare("DELETE FROM reviewer_church_reviews WHERE reviewer_id=?").bind(id),
        db.prepare("DELETE FROM reviewer_accounts WHERE id=?").bind(id),
        ...(affected.results??[]).map(({church_id})=>db.prepare("UPDATE churches SET reviewer_status=COALESCE((SELECT status FROM reviewer_church_reviews WHERE church_id=? ORDER BY reviewed_at DESC LIMIT 1),'unreviewed'),reviewer_note=(SELECT note FROM reviewer_church_reviews WHERE church_id=? ORDER BY reviewed_at DESC LIMIT 1),reviewed_at=(SELECT reviewed_at FROM reviewer_church_reviews WHERE church_id=? ORDER BY reviewed_at DESC LIMIT 1) WHERE id=?").bind(church_id,church_id,church_id,church_id)),
      ];
      await db.batch(statements);
    } else {
      if(!["pending","approved","rejected"].includes(status)) return Response.json({error:"가입 상태를 확인해 주세요."},{status:400});
      await db.prepare("UPDATE reviewer_accounts SET status=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?").bind(status,id).run();
    }
  } else if(kind==="church-change-request") {
    const requestType=clean(data.requestType,20),reason=clean(data.reason,500);
    if(!["edit","hold","delete"].includes(requestType)) return Response.json({error:"요청 종류를 확인해 주세요."},{status:400});
    if(reason.length<3) return Response.json({error:"요청 이유를 3자 이상 적어 주세요."},{status:400});
    const church=await db.prepare("SELECT c.id FROM churches c JOIN reviewer_accounts a ON a.id=? AND a.status='approved' AND a.church_id=c.id WHERE c.id=? AND c.review_status IN ('approved','removed') LIMIT 1").bind(session.reviewerId,id).first();
    if(!church)return Response.json({error:"요청할 교회를 찾을 수 없습니다."},{status:404});
    const name=requestType==="edit"?clean(data.name,100):"",pastor=requestType==="edit"?clean(data.pastor,80):"",region=requestType==="edit"?clean(data.region,80):"",denomination=requestType==="edit"?clean(data.denomination,120):"";
    if(requestType==="edit"&&(!name||!pastor||!region||!denomination)) return Response.json({error:"수정할 교회 정보를 모두 입력해 주세요."},{status:400});
    const inserted=await db.prepare("INSERT INTO church_change_requests (reviewer_id,church_id,request_type,reason,proposed_name,proposed_pastor,proposed_region,proposed_denomination) SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM church_change_requests WHERE reviewer_id=? AND church_id=? AND request_type=? AND status IN ('pending','deferred')) AND (SELECT COUNT(*) FROM church_change_requests WHERE reviewer_id=? AND status IN ('pending','deferred'))<100").bind(session.reviewerId,id,requestType,reason,name||null,pastor||null,region||null,denomination||null,session.reviewerId,id,requestType,session.reviewerId).run();
    if(Number(inserted.meta?.changes??0)!==1)return Response.json({error:"이미 같은 요청이 처리 대기 중이거나 대기 요청이 너무 많습니다."},{status:409,headers:{"cache-control":"no-store"}});
  } else if(kind==="church-change-request-resolution") {
    if(role!=="admin")return Response.json({error:"관리자만 요청을 결정할 수 있습니다."},{status:403});
    const resolution=clean(data.resolution,20),adminNote=clean(data.adminNote,500);
    if(!["approved","rejected","deferred"].includes(resolution))return Response.json({error:"결정 내용을 확인해 주세요."},{status:400});
    if((resolution==="rejected"||resolution==="deferred")&&adminNote.length<3)return Response.json({error:"목사님이 볼 답변을 3자 이상 적어 주세요."},{status:400});
    const change=await db.prepare("SELECT id,church_id,request_type,proposed_name,proposed_pastor,proposed_region,proposed_denomination,status FROM church_change_requests WHERE id=? LIMIT 1").bind(id).first<{id:number;church_id:number;request_type:string;proposed_name:string|null;proposed_pastor:string|null;proposed_region:string|null;proposed_denomination:string|null;status:string}>();
    if(!change)return Response.json({error:"요청을 찾을 수 없습니다."},{status:404});
    if(change.status!=="pending"&&change.status!=="deferred")return Response.json({error:"이미 처리된 요청입니다."},{status:409});
    const statements:Array<ReturnType<typeof db.prepare>>=[];
    if(resolution==="approved") {
      if(change.request_type==="edit")statements.push(db.prepare("UPDATE churches SET name=?,pastor=?,region=?,denomination=? WHERE id=?").bind(change.proposed_name,change.proposed_pastor,change.proposed_region,change.proposed_denomination,change.church_id));
      if(change.request_type==="hold")statements.push(db.prepare("UPDATE churches SET review_status='removed',hold_reason='pastor_request',hold_note=?,held_at=CURRENT_TIMESTAMP WHERE id=?").bind(adminNote||"목사님 요청 승인",change.church_id));
      if(change.request_type==="delete")statements.push(db.prepare("UPDATE churches SET review_status='deleted',hold_reason='pastor_request',hold_note=?,held_at=CURRENT_TIMESTAMP WHERE id=?").bind(adminNote||"목사님 삭제 요청 승인",change.church_id));
      if(change.request_type==="hold"||change.request_type==="delete")statements.push(db.prepare("UPDATE sermons SET status='hidden' WHERE church_id=?").bind(change.church_id),db.prepare("UPDATE praise_videos SET status='hidden' WHERE church_id=?").bind(change.church_id),db.prepare("UPDATE church_shorts SET status='hidden' WHERE church_id=?").bind(change.church_id));
    }
    statements.push(db.prepare("UPDATE church_change_requests SET status=?,admin_note=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?").bind(resolution,adminNote||null,id));
    await db.batch(statements);
  } else if(kind==="church-review") {
    const status=clean(data.status,20),note=clean(data.note,500);
    if(!["unreviewed","confirmed","concern"].includes(status)) return Response.json({error:"선택한 검토 내용을 다시 확인해 주세요."},{status:400});
    if(status==="concern"&&note.length<3) return Response.json({error:"운영팀에 전할 내용을 3자 이상 적어 주세요."},{status:400});
    const reviewChurch=await db.prepare("SELECT id FROM churches WHERE id=? AND review_status IN ('approved','removed') LIMIT 1").bind(id).first<{id:number}>();
    if(!reviewChurch) return Response.json({error:"검토할 수 있는 교회를 찾을 수 없습니다."},{status:404});
    await db.batch([
      db.prepare("INSERT INTO reviewer_church_reviews (reviewer_id,church_id,status,note,reviewed_at,handled_at,admin_resolution,admin_note,resolved_by) VALUES (?,?,?,?,CURRENT_TIMESTAMP,NULL,NULL,NULL,NULL) ON CONFLICT(reviewer_id,church_id) DO UPDATE SET status=excluded.status,note=excluded.note,reviewed_at=CURRENT_TIMESTAMP,handled_at=NULL,admin_resolution=NULL,admin_note=NULL,resolved_by=NULL").bind(session.reviewerId,id,status,note||null),
      db.prepare("UPDATE churches SET reviewer_status=CASE WHEN EXISTS(SELECT 1 FROM reviewer_church_reviews WHERE church_id=? AND status='concern' AND handled_at IS NULL) THEN 'concern' WHEN EXISTS(SELECT 1 FROM reviewer_church_reviews WHERE church_id=? AND status='confirmed') THEN 'confirmed' ELSE 'unreviewed' END,reviewer_note=COALESCE((SELECT note FROM reviewer_church_reviews WHERE church_id=? AND status='concern' AND handled_at IS NULL ORDER BY reviewed_at DESC LIMIT 1),(SELECT note FROM reviewer_church_reviews WHERE church_id=? AND status='confirmed' ORDER BY reviewed_at DESC LIMIT 1)),reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND review_status IN ('approved','removed')").bind(id,id,id,id,id),
    ]);
  } else if(kind==="church-review-resolution") {
    if(role!=="admin") return Response.json({error:"관리자만 재검토 의견을 결정할 수 있습니다."},{status:403});
    const resolution=clean(data.resolution,30),adminNote=clean(data.adminNote,500),holdReason=clean(data.holdReason,40);
    if(!["kept_public","held","needs_follow_up","deleted"].includes(resolution)) return Response.json({error:"처리 결정을 확인해 주세요."},{status:400});
    const opinions:{id:number;reviewedAt:string}[]=[],seenOpinionIds=new Set<number>();
    for(const supplied of (Array.isArray(data.opinions)?data.opinions:[]).slice(0,1000)) {
      if(!supplied||typeof supplied!=="object") continue;
      const opinionId=Number((supplied as Record<string,unknown>).id),reviewedAt=clean((supplied as Record<string,unknown>).reviewedAt,40);
      if(!Number.isInteger(opinionId)||opinionId<1||!reviewedAt||seenOpinionIds.has(opinionId)) continue;
      seenOpinionIds.add(opinionId);opinions.push({id:opinionId,reviewedAt});
    }
    if(!opinions.length) return Response.json({error:"화면에서 확인한 목사님 의견을 찾을 수 없습니다."},{status:400});
    if((resolution==="held"||resolution==="needs_follow_up")&&adminNote.length<3) return Response.json({error:"처리 근거를 3자 이상 적어 주세요."},{status:400});
    if(resolution==="held"&&!["rights_request","youtube_unavailable","inactive","info_unverified","review_needed","other"].includes(holdReason)) return Response.json({error:"보류 사유를 선택해 주세요."},{status:400});
    const opinionIds=opinions.map((opinion)=>opinion.id),placeholders=opinionIds.map(()=>"?").join(","),claimToken=`processing:${crypto.randomUUID()}`;
    const claimStatements:Array<ReturnType<typeof db.prepare>>=[
      db.prepare(`UPDATE churches SET review_resolution_token=? WHERE id=? AND review_resolution_token IS NULL AND (SELECT COUNT(*) FROM reviewer_church_reviews WHERE church_id=? AND status='concern' AND handled_at IS NULL)=? AND (SELECT COUNT(*) FROM reviewer_church_reviews WHERE church_id=? AND status='concern' AND handled_at IS NULL AND id IN (${placeholders}))=?`).bind(claimToken,id,id,opinions.length,id,...opinionIds,opinions.length),
      ...opinions.map((opinion)=>db.prepare("UPDATE reviewer_church_reviews SET admin_resolution=? WHERE id=? AND church_id=? AND status='concern' AND handled_at IS NULL AND reviewed_at=? AND EXISTS(SELECT 1 FROM churches WHERE id=? AND review_resolution_token=?)").bind(claimToken,opinion.id,id,opinion.reviewedAt,id,claimToken)),
    ];
    const claimResults=await db.batch(claimStatements);
    if(Number(claimResults[0]?.meta?.changes??0)!==1||claimResults.slice(1).some((result:{meta?:{changes?:number}})=>Number(result.meta?.changes??0)!==1)) {
      await db.batch([db.prepare("UPDATE reviewer_church_reviews SET admin_resolution=NULL WHERE church_id=? AND admin_resolution=?").bind(id,claimToken),db.prepare("UPDATE churches SET review_resolution_token=NULL WHERE id=? AND review_resolution_token=?").bind(id,claimToken)]);
      return Response.json({error:"목사님 의견이 변경되었거나 다른 관리자가 처리 중입니다. 최신 내용을 다시 확인해 주세요."},{status:409});
    }
    const allClaims=`(SELECT COUNT(*) FROM reviewer_church_reviews WHERE church_id=? AND admin_resolution=? AND status='concern' AND handled_at IS NULL AND id IN (${placeholders}))=?`;
    const finalStatements:Array<ReturnType<typeof db.prepare>>=[];
    if(resolution==="held") {
      finalStatements.push(db.prepare(`UPDATE churches SET review_status='removed',hold_reason=?,hold_note=?,held_at=CURRENT_TIMESTAMP WHERE id=? AND review_resolution_token=? AND ${allClaims}`).bind(holdReason,adminNote,id,claimToken,id,claimToken,...opinionIds,opinions.length));
      finalStatements.push(db.prepare(`UPDATE sermons SET status='hidden' WHERE church_id=? AND EXISTS(SELECT 1 FROM churches WHERE id=? AND review_resolution_token=?)`).bind(id,id,claimToken));
      finalStatements.push(db.prepare(`UPDATE praise_videos SET status='hidden' WHERE church_id=? AND EXISTS(SELECT 1 FROM churches WHERE id=? AND review_resolution_token=?)`).bind(id,id,claimToken));
      finalStatements.push(db.prepare(`UPDATE church_shorts SET status='hidden' WHERE church_id=? AND EXISTS(SELECT 1 FROM churches WHERE id=? AND review_resolution_token=?)`).bind(id,id,claimToken));
    } else if(resolution==="kept_public") {
      finalStatements.push(db.prepare(`UPDATE churches SET review_status='approved',hold_reason=NULL,hold_note=NULL WHERE id=? AND review_resolution_token=? AND ${allClaims}`).bind(id,claimToken,id,claimToken,...opinionIds,opinions.length));
    } else if(resolution==="deleted") {
      finalStatements.push(db.prepare(`UPDATE churches SET review_status='deleted',hold_reason=NULL,hold_note=NULL WHERE id=? AND review_resolution_token=? AND ${allClaims}`).bind(id,claimToken,id,claimToken,...opinionIds,opinions.length));
      finalStatements.push(db.prepare(`UPDATE sermons SET status='hidden' WHERE church_id=? AND EXISTS(SELECT 1 FROM churches WHERE id=? AND review_resolution_token=?)`).bind(id,id,claimToken));
      finalStatements.push(db.prepare(`UPDATE praise_videos SET status='hidden' WHERE church_id=? AND EXISTS(SELECT 1 FROM churches WHERE id=? AND review_resolution_token=?)`).bind(id,id,claimToken));
      finalStatements.push(db.prepare(`UPDATE church_shorts SET status='hidden' WHERE church_id=? AND EXISTS(SELECT 1 FROM churches WHERE id=? AND review_resolution_token=?)`).bind(id,id,claimToken));
    } else {
      finalStatements.push(db.prepare(`UPDATE churches SET review_resolution_token=review_resolution_token WHERE id=? AND review_resolution_token=? AND ${allClaims}`).bind(id,claimToken,id,claimToken,...opinionIds,opinions.length));
    }
    const reviewResultIndex=finalStatements.length;
    if(resolution==="needs_follow_up") finalStatements.push(db.prepare(`UPDATE reviewer_church_reviews SET admin_resolution='needs_follow_up',admin_note=?,resolved_by='admin' WHERE church_id=? AND admin_resolution=? AND id IN (${placeholders}) AND EXISTS(SELECT 1 FROM churches WHERE id=? AND review_resolution_token=?)`).bind(adminNote,id,claimToken,...opinionIds,id,claimToken));
    else finalStatements.push(db.prepare(`UPDATE reviewer_church_reviews SET handled_at=CURRENT_TIMESTAMP,admin_resolution=?,admin_note=?,resolved_by='admin' WHERE church_id=? AND admin_resolution=? AND id IN (${placeholders}) AND EXISTS(SELECT 1 FROM churches WHERE id=? AND review_resolution_token=?)`).bind(resolution,adminNote||null,id,claimToken,...opinionIds,id,claimToken));
    finalStatements.push(db.prepare("UPDATE churches SET reviewer_status=CASE WHEN EXISTS(SELECT 1 FROM reviewer_church_reviews WHERE church_id=? AND status='concern' AND handled_at IS NULL) THEN 'concern' WHEN EXISTS(SELECT 1 FROM reviewer_church_reviews WHERE church_id=? AND status='confirmed') THEN 'confirmed' ELSE 'unreviewed' END,reviewer_note=COALESCE((SELECT note FROM reviewer_church_reviews WHERE church_id=? AND status='concern' AND handled_at IS NULL ORDER BY reviewed_at DESC LIMIT 1),(SELECT note FROM reviewer_church_reviews WHERE church_id=? AND status='confirmed' ORDER BY reviewed_at DESC LIMIT 1)),reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND review_resolution_token=?").bind(id,id,id,id,id,claimToken));
    finalStatements.push(db.prepare("UPDATE churches SET review_resolution_token=NULL WHERE id=? AND review_resolution_token=?").bind(id,claimToken));
    const finalResults=await db.batch(finalStatements);
    if(Number(finalResults[0]?.meta?.changes??0)!==1||Number(finalResults[reviewResultIndex]?.meta?.changes??0)!==opinions.length) {
      await db.batch([db.prepare("UPDATE reviewer_church_reviews SET handled_at=NULL,admin_resolution=NULL,admin_note=NULL,resolved_by=NULL WHERE church_id=? AND id IN ("+placeholders+") AND (admin_resolution=? OR admin_resolution IN ('kept_public','held','needs_follow_up','deleted'))").bind(id,...opinionIds,claimToken),db.prepare("UPDATE churches SET review_resolution_token=NULL WHERE id=? AND review_resolution_token=?").bind(id,claimToken)]);
      return Response.json({error:"처리 중 의견이 변경되었습니다. 최신 내용을 다시 확인해 주세요."},{status:409});
    }
  } else if(kind==="church-review-handled") {
    if(role!=="admin") return Response.json({error:"관리자만 의견을 처리할 수 있습니다."},{status:403});
    const handled=data.handled===true;
    await db.prepare(`UPDATE reviewer_church_reviews SET handled_at=${handled?"CURRENT_TIMESTAMP":"NULL"} WHERE id=?`).bind(id).run();
  } else if(kind==="church-info") {
    if(role!=="admin")return Response.json({error:"관리자만 교회 정보를 수정할 수 있습니다."},{status:403});
    const name=clean(data.name,100),pastor=clean(data.pastor,80),region=clean(data.region,80),denomination=clean(data.denomination,120);
    if(!name||!pastor||!region||!denomination)return Response.json({error:"교회 정보를 모두 입력해 주세요."},{status:400});
    const result=await db.prepare("UPDATE churches SET name=?,pastor=?,region=?,denomination=? WHERE id=?").bind(name,pastor,region,denomination,id).run();
    if(Number(result.meta?.changes??0)!==1)return Response.json({error:"교회를 찾을 수 없습니다."},{status:404});
  } else if (kind === "church") {
    const status = clean(data.status, 20);
    if (status) {
      if (!["approved", "removed", "deleted"].includes(status)) return Response.json({ error: "상태를 확인해 주세요." }, { status: 400 });
      const church = await db.prepare("SELECT review_status FROM churches WHERE id=?").bind(id).first<{ review_status: string }>();
      if (!church) return Response.json({ error: "교회를 찾을 수 없습니다." }, { status: 404 });
      if (status === "removed") {
        const holdReason = clean(data.holdReason, 40), holdNote = clean(data.holdNote, 500);
        if (!["pastor_request", "rights_request", "youtube_unavailable", "inactive", "info_unverified", "review_needed", "other"].includes(holdReason) || holdNote.length < 3) return Response.json({ error: "보류 사유와 3자 이상의 관리자 메모를 입력해 주세요." }, { status: 400 });
        await db.prepare("UPDATE churches SET review_status='removed',hold_reason=?,hold_note=?,held_at=CURRENT_TIMESTAMP WHERE id=?").bind(holdReason, holdNote, id).run();
      } else {
        await db.prepare("UPDATE churches SET review_status=? WHERE id=?").bind(status, id).run();
      }
      if (status === "removed" || status === "deleted") await db.batch([db.prepare("UPDATE sermons SET status='hidden' WHERE church_id=?").bind(id),db.prepare("UPDATE praise_videos SET status='hidden' WHERE church_id=?").bind(id),db.prepare("UPDATE church_shorts SET status='hidden' WHERE church_id=?").bind(id)]);
    } else {
      const name = clean(data.name, 100), pastor = clean(data.pastor, 80), region = clean(data.region, 80), denomination = clean(data.denomination, 120);
      const holdReason = clean(data.holdReason, 40), holdNote = clean(data.holdNote, 500), priorityWeight = Number(data.priorityWeight);
      if (!name || !pastor || !region || !denomination) return Response.json({ error: "교회 정보를 모두 입력해 주세요." }, { status: 400 });
      if (![1, 2, 3, 4].includes(priorityWeight)) return Response.json({ error: "노출 비중을 확인해 주세요." }, { status: 400 });
      const church = await db.prepare("SELECT review_status FROM churches WHERE id=?").bind(id).first<{ review_status: string }>();
      if (!church) return Response.json({ error: "교회를 찾을 수 없습니다." }, { status: 404 });
      if (church.review_status === "removed" && (!["pastor_request", "rights_request", "youtube_unavailable", "inactive", "info_unverified", "review_needed", "other"].includes(holdReason) || holdNote.length < 3)) return Response.json({ error: "보류 교회에는 사유와 3자 이상의 관리자 메모가 필요합니다." }, { status: 400 });
      await db.prepare("UPDATE churches SET name=?,pastor=?,region=?,denomination=?,priority_weight=?,hold_reason=?,hold_note=? WHERE id=?").bind(name, pastor, region, denomination, priorityWeight, holdReason || null, holdNote || null, id).run();
    }
  } else if (kind === "sermon") {
    const status = clean(data.status, 20);
    if (!["published", "hidden"].includes(status)) return Response.json({ error: "상태를 확인해 주세요." }, { status: 400 });
    await db.prepare("UPDATE sermons SET status=? WHERE id=?").bind(status, id).run();
  } else if(kind==="pastor-photo"){
    if(role!=="admin")return Response.json({error:"관리자만 목회자 사진을 처리할 수 있습니다."},{status:403});
    const requested=clean(data.status,20),status=requested==="rejected"?"removed":requested;
    if(!["pending","approved","removed","deleted"].includes(status))return Response.json({error:"상태를 확인해 주세요."},{status:400});
    if(status==="deleted")await db.prepare("UPDATE pastor_people SET photo_url=NULL,photo_source_url=NULL,photo_sha256=NULL,photo_review_status='pending',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
    else await db.prepare("UPDATE pastor_people SET photo_review_status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND photo_url IS NOT NULL AND photo_source_url IS NOT NULL").bind(status,id).run();
  } else if(kind==="pastor-person"){
    if(role!=="admin")return Response.json({error:"관리자만 목회자 기록을 처리할 수 있습니다."},{status:403});
    const requested=clean(data.status,20),status=requested==="rejected"?"removed":requested;
    if(!["pending","approved","removed","deleted"].includes(status))return Response.json({error:"상태를 확인해 주세요."},{status:400});
    const person=await db.prepare("SELECT id FROM pastor_people WHERE id=? LIMIT 1").bind(id).first();if(!person)return Response.json({error:"목회자를 찾을 수 없습니다."},{status:404});
    if(status==="deleted")await db.batch([db.prepare("DELETE FROM pastor_encouragement_messages WHERE pastor_id=?").bind(id),db.prepare("DELETE FROM pastor_private_contact_values WHERE pastor_id=?").bind(id),db.prepare("DELETE FROM pastor_church_roles WHERE pastor_id=?").bind(id),db.prepare("DELETE FROM pastor_people WHERE id=?").bind(id)]);
    else await db.batch([db.prepare("UPDATE pastor_people SET review_status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status,id),db.prepare("UPDATE pastor_church_roles SET review_status=?,updated_at=CURRENT_TIMESTAMP WHERE pastor_id=?").bind(status,id)]);
  } else if(kind==="ministry-suggestion"){
    if(role!=="admin")return Response.json({error:"관리자만 교역자 제보를 처리할 수 있습니다."},{status:403});
    const status=clean(data.status,20);if(!["approved","rejected","deleted"].includes(status))return Response.json({error:"상태를 확인해 주세요."},{status:400});
    if(status==="deleted")await db.prepare("DELETE FROM ministry_profile_suggestions WHERE id=?").bind(id).run();
    else if(status==="rejected")await db.prepare("UPDATE ministry_profile_suggestions SET status='rejected',fingerprint='',reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(id).run();
    else {const suggestion=await db.prepare("SELECT church_id,name,role_title,source_url FROM ministry_profile_suggestions WHERE id=? AND status='pending' LIMIT 1").bind(id).first<{church_id:number;name:string;role_title:string;source_url:string|null}>();if(!suggestion||!suggestion.source_url)return Response.json({error:"공식 출처가 있는 대기 제보만 반영할 수 있습니다."},{status:409});const primary=["담임목사","위임목사","대표목사"].includes(suggestion.role_title),associate=["수석부목사","부목사","행정목사","목양목사"].includes(suggestion.role_title),education=["교육목사","강도사","전임전도사","교육전도사","전도사"].includes(suggestion.role_title),roleCategory=primary?"current_primary":associate?"associate":education?"education":suggestion.role_title==="협동목사"?"cooperating":suggestion.role_title==="원로목사"?"emeritus":"retired";await db.batch([db.prepare("INSERT INTO church_ministry_profiles (church_id,name,role_title,role_category,role_status,source_url,source_checked_at,review_status) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP,'approved') ON CONFLICT(church_id,name,role_title,role_status) DO UPDATE SET source_url=excluded.source_url,source_checked_at=CURRENT_TIMESTAMP,review_status='approved',updated_at=CURRENT_TIMESTAMP").bind(suggestion.church_id,suggestion.name,suggestion.role_title,roleCategory,["원로목사","은퇴목사"].includes(suggestion.role_title)?"former":"current",suggestion.source_url),db.prepare("UPDATE ministry_profile_suggestions SET status='approved',fingerprint='',reviewed_at=CURRENT_TIMESTAMP WHERE id=?").bind(id)]);}
  } else if (kind === "post" || kind === "talent" || kind === "contact" || kind === "encouragement" || kind === "pastor-encouragement") {
    const status = clean(data.status, 20);
    const table = kind === "post" ? "community_posts" : kind === "contact" ? "contact_requests" : kind==="encouragement"?"encouragement_messages":kind==="pastor-encouragement"?"pastor_encouragement_messages":"talent_offers";
    if (status === "deleted") await db.prepare(`DELETE FROM ${table} WHERE id=?`).bind(id).run();
    else {
      if (!["pending", "approved", "rejected"].includes(status)) return Response.json({ error: "상태를 확인해 주세요." }, { status: 400 });
      const reviewed=kind === "contact" ? ",reviewed_at=CURRENT_TIMESTAMP" : kind==="encouragement"||kind==="pastor-encouragement"?",moderated_at=CURRENT_TIMESTAMP":kind==="post"&&status==="approved" ? ",report_count=0" : "";
      await db.prepare(`UPDATE ${table} SET status=?${reviewed} WHERE id=?`).bind(status, id).run();
    }
  } else if (kind === "recommendation") {
    const status=clean(data.status,20);
    if(status==="deleted") {
      await db.prepare("DELETE FROM church_recommendations WHERE id=?").bind(id).run();
      return Response.json({ok:true},{headers:{"cache-control":"no-store"}});
    }
    if(!["pending","approved","rejected"].includes(status)) return Response.json({error:"상태를 확인해 주세요."},{status:400});
    const recommendation=await db.prepare("SELECT church_name,pastor,region,denomination FROM church_recommendations WHERE id=?").bind(id).first<{church_name:string;pastor:string;region:string;denomination:string}>();
    if(!recommendation) return Response.json({error:"교회 추천을 찾을 수 없습니다."},{status:404});
    if(status==="approved") {
      const approved=await db.batch([
        db.prepare(`INSERT INTO churches (name,pastor,region,denomination,review_status) SELECT ?,?,?,?,'approved' WHERE NOT EXISTS (SELECT 1 FROM churches WHERE ${sqlNormalized("name")}=? AND ${sqlNormalized("region")}=?)`).bind(recommendation.church_name,recommendation.pastor,recommendation.region,recommendation.denomination,normalizeSearchValue(recommendation.church_name),normalizeSearchValue(recommendation.region)),
        db.prepare(`UPDATE church_recommendations SET status='approved',reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND EXISTS (SELECT 1 FROM churches WHERE ${sqlNormalized("name")}=? AND ${sqlNormalized("region")}=? AND review_status='approved')`).bind(id,normalizeSearchValue(recommendation.church_name),normalizeSearchValue(recommendation.region)),
      ]);
      if(Number(approved[1]?.meta?.changes??0)!==1)return Response.json({error:"삭제·보류된 교회는 추천으로 다시 등록할 수 없습니다."},{status:409,headers:{"cache-control":"no-store"}});
    } else {
      await db.prepare("UPDATE church_recommendations SET status=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?").bind(status,id).run();
    }
  } else {
    return Response.json({ error: "지원하지 않는 작업입니다." }, { status: 400 });
  }

  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
