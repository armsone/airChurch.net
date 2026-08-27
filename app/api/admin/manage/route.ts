import { accessSession } from "../../../admin-access";
import { clean, database, ensureChurchRecommendationTables, ensureCommunityTables, ensurePraiseTables, ensureReviewerTables, ensureSermonTables } from "../../_shared";

async function requestRole(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return null;
  return accessSession(request);
}

export async function PATCH(request: Request) {
  const session=await requestRole(request);
  if (!session) return Response.json({ error: "운영자 권한이 필요합니다." }, { status: 403 });
  const {role}=session;

  const data = await request.json().catch(() => ({})) as Record<string, unknown>;
  const id = Number(data.id);
  const kind = clean(data.kind, 40);
  if(role==="reviewer"&&kind!=="church-change-request") return Response.json({error:"교회 정보 요청 권한만 사용할 수 있습니다."},{status:403});
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "대상을 확인해 주세요." }, { status: 400 });

  const db = database();
  await Promise.all([ensureCommunityTables(db),ensureSermonTables(db),ensurePraiseTables(db),ensureChurchRecommendationTables(db),ensureReviewerTables(db)]);

  if(kind==="reviewer-account") {
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
    const church=await db.prepare("SELECT id FROM churches WHERE id=? AND review_status IN ('approved','removed') LIMIT 1").bind(id).first();
    if(!church)return Response.json({error:"요청할 교회를 찾을 수 없습니다."},{status:404});
    const name=requestType==="edit"?clean(data.name,100):"",pastor=requestType==="edit"?clean(data.pastor,80):"",region=requestType==="edit"?clean(data.region,80):"",denomination=requestType==="edit"?clean(data.denomination,120):"";
    if(requestType==="edit"&&(!name||!pastor||!region||!denomination)) return Response.json({error:"수정할 교회 정보를 모두 입력해 주세요."},{status:400});
    await db.prepare("INSERT INTO church_change_requests (reviewer_id,church_id,request_type,reason,proposed_name,proposed_pastor,proposed_region,proposed_denomination) VALUES (?,?,?,?,?,?,?,?)").bind(session.reviewerId,id,requestType,reason,name||null,pastor||null,region||null,denomination||null).run();
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
      if(change.request_type==="hold"||change.request_type==="delete")statements.push(db.prepare("UPDATE sermons SET status='hidden' WHERE church_id=?").bind(change.church_id),db.prepare("UPDATE praise_videos SET status='hidden' WHERE church_id=?").bind(change.church_id));
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
    if(resolution==="held"&&!["youtube_unavailable","inactive","info_unverified","review_needed","other"].includes(holdReason)) return Response.json({error:"보류 사유를 선택해 주세요."},{status:400});
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
    } else if(resolution==="kept_public") {
      finalStatements.push(db.prepare(`UPDATE churches SET review_status='approved',hold_reason=NULL,hold_note=NULL WHERE id=? AND review_resolution_token=? AND ${allClaims}`).bind(id,claimToken,id,claimToken,...opinionIds,opinions.length));
    } else if(resolution==="deleted") {
      finalStatements.push(db.prepare(`UPDATE churches SET review_status='deleted',hold_reason=NULL,hold_note=NULL WHERE id=? AND review_resolution_token=? AND ${allClaims}`).bind(id,claimToken,id,claimToken,...opinionIds,opinions.length));
      finalStatements.push(db.prepare(`UPDATE sermons SET status='hidden' WHERE church_id=? AND EXISTS(SELECT 1 FROM churches WHERE id=? AND review_resolution_token=?)`).bind(id,id,claimToken));
      finalStatements.push(db.prepare(`UPDATE praise_videos SET status='hidden' WHERE church_id=? AND EXISTS(SELECT 1 FROM churches WHERE id=? AND review_resolution_token=?)`).bind(id,id,claimToken));
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
        if (!["pastor_request", "youtube_unavailable", "inactive", "info_unverified", "review_needed", "other"].includes(holdReason) || holdNote.length < 3) return Response.json({ error: "보류 사유와 3자 이상의 관리자 메모를 입력해 주세요." }, { status: 400 });
        await db.prepare("UPDATE churches SET review_status='removed',hold_reason=?,hold_note=?,held_at=CURRENT_TIMESTAMP WHERE id=?").bind(holdReason, holdNote, id).run();
      } else {
        await db.prepare("UPDATE churches SET review_status=? WHERE id=?").bind(status, id).run();
      }
      if (status === "removed" || status === "deleted") await db.batch([db.prepare("UPDATE sermons SET status='hidden' WHERE church_id=?").bind(id),db.prepare("UPDATE praise_videos SET status='hidden' WHERE church_id=?").bind(id)]);
    } else {
      const name = clean(data.name, 100), pastor = clean(data.pastor, 80), region = clean(data.region, 80), denomination = clean(data.denomination, 120);
      const holdReason = clean(data.holdReason, 40), holdNote = clean(data.holdNote, 500), priorityWeight = Number(data.priorityWeight);
      if (!name || !pastor || !region || !denomination) return Response.json({ error: "교회 정보를 모두 입력해 주세요." }, { status: 400 });
      if (![1, 2, 3, 4].includes(priorityWeight)) return Response.json({ error: "노출 비중을 확인해 주세요." }, { status: 400 });
      const church = await db.prepare("SELECT review_status FROM churches WHERE id=?").bind(id).first<{ review_status: string }>();
      if (!church) return Response.json({ error: "교회를 찾을 수 없습니다." }, { status: 404 });
      if (church.review_status === "removed" && (!["pastor_request", "youtube_unavailable", "inactive", "info_unverified", "review_needed", "other"].includes(holdReason) || holdNote.length < 3)) return Response.json({ error: "보류 교회에는 사유와 3자 이상의 관리자 메모가 필요합니다." }, { status: 400 });
      await db.prepare("UPDATE churches SET name=?,pastor=?,region=?,denomination=?,priority_weight=?,hold_reason=?,hold_note=? WHERE id=?").bind(name, pastor, region, denomination, priorityWeight, holdReason || null, holdNote || null, id).run();
    }
  } else if (kind === "sermon") {
    const status = clean(data.status, 20);
    if (!["published", "hidden"].includes(status)) return Response.json({ error: "상태를 확인해 주세요." }, { status: 400 });
    await db.prepare("UPDATE sermons SET status=? WHERE id=?").bind(status, id).run();
  } else if (kind === "post" || kind === "talent") {
    const status = clean(data.status, 20);
    const table = kind === "post" ? "community_posts" : "talent_offers";
    if (status === "deleted") await db.prepare(`DELETE FROM ${table} WHERE id=?`).bind(id).run();
    else {
      if (!["pending", "approved", "rejected"].includes(status)) return Response.json({ error: "상태를 확인해 주세요." }, { status: 400 });
      await db.prepare(`UPDATE ${table} SET status=? WHERE id=?`).bind(status, id).run();
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
      const existing=await db.prepare("SELECT id FROM churches WHERE name=? AND region=? AND review_status!='deleted' LIMIT 1").bind(recommendation.church_name,recommendation.region).first();
      const statements=[db.prepare("UPDATE church_recommendations SET status='approved',reviewed_at=CURRENT_TIMESTAMP WHERE id=?").bind(id)];
      if(!existing) statements.unshift(db.prepare("INSERT INTO churches (name,pastor,region,denomination,review_status) VALUES (?,?,?,?,'approved')").bind(recommendation.church_name,recommendation.pastor,recommendation.region,recommendation.denomination));
      await db.batch(statements);
    } else {
      await db.prepare("UPDATE church_recommendations SET status=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?").bind(status,id).run();
    }
  } else {
    return Response.json({ error: "지원하지 않는 작업입니다." }, { status: 400 });
  }

  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
