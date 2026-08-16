import { accessSession } from "../../../admin-access";
import { clean, database, ensureChurchRecommendationTables, ensureCommunityTables, ensureReviewerTables, ensureSermonTables } from "../../_shared";

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
  const kind = clean(data.kind, 20);
  if(role==="reviewer"&&kind!=="church-review") return Response.json({error:"교회 검토 권한만 사용할 수 있습니다."},{status:403});
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "대상을 확인해 주세요." }, { status: 400 });

  const db = database();
  await Promise.all([ensureCommunityTables(db), ensureSermonTables(db), ensureChurchRecommendationTables(db),ensureReviewerTables(db)]);

  if(kind==="reviewer-account") {
    if(role!=="admin") return Response.json({error:"관리자만 검토자를 승인할 수 있습니다."},{status:403});
    const status=clean(data.status,20);
    if(!["pending","approved","rejected"].includes(status)) return Response.json({error:"가입 상태를 확인해 주세요."},{status:400});
    await db.prepare("UPDATE reviewer_accounts SET status=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?").bind(status,id).run();
  } else if(kind==="church-review") {
    const status=clean(data.status,20),note=clean(data.note,500);
    if(!["unreviewed","confirmed","concern"].includes(status)) return Response.json({error:"검토 상태를 확인해 주세요."},{status:400});
    if(status==="concern"&&note.length<3) return Response.json({error:"재검토가 필요한 이유를 3자 이상 적어 주세요."},{status:400});
    await db.batch([
      db.prepare("INSERT INTO reviewer_church_reviews (reviewer_id,church_id,status,note,reviewed_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(reviewer_id,church_id) DO UPDATE SET status=excluded.status,note=excluded.note,reviewed_at=CURRENT_TIMESTAMP").bind(session.reviewerId,id,status,note||null),
      db.prepare("UPDATE churches SET reviewer_status=?,reviewer_note=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND review_status IN ('approved','removed')").bind(status,note||null,id),
    ]);
  } else if (kind === "church") {
    const status = clean(data.status, 20);
    if (status) {
      if (!["approved", "removed", "deleted"].includes(status)) return Response.json({ error: "상태를 확인해 주세요." }, { status: 400 });
      const church = await db.prepare("SELECT review_status FROM churches WHERE id=?").bind(id).first<{ review_status: string }>();
      if (!church) return Response.json({ error: "교회를 찾을 수 없습니다." }, { status: 404 });
      if (status === "deleted") {
        if (church.review_status !== "removed") return Response.json({ error: "보류된 교회만 삭제할 수 있습니다." }, { status: 409 });
      }
      if (status === "removed") {
        const holdReason = clean(data.holdReason, 40), holdNote = clean(data.holdNote, 500);
        if (!["youtube_unavailable", "inactive", "info_unverified", "review_needed", "other"].includes(holdReason) || holdNote.length < 3) return Response.json({ error: "보류 사유와 3자 이상의 관리자 메모를 입력해 주세요." }, { status: 400 });
        await db.prepare("UPDATE churches SET review_status='removed',hold_reason=?,hold_note=?,held_at=CURRENT_TIMESTAMP WHERE id=?").bind(holdReason, holdNote, id).run();
      } else {
        await db.prepare("UPDATE churches SET review_status=? WHERE id=?").bind(status, id).run();
      }
      if (status === "removed" || status === "deleted") await db.prepare("UPDATE sermons SET status='hidden' WHERE church_id=?").bind(id).run();
    } else {
      const name = clean(data.name, 100), pastor = clean(data.pastor, 80), region = clean(data.region, 80), denomination = clean(data.denomination, 120);
      const holdReason = clean(data.holdReason, 40), holdNote = clean(data.holdNote, 500), priorityWeight = Number(data.priorityWeight);
      if (!name || !pastor || !region || !denomination) return Response.json({ error: "교회 정보를 모두 입력해 주세요." }, { status: 400 });
      if (![1, 2, 3].includes(priorityWeight)) return Response.json({ error: "노출 비중을 확인해 주세요." }, { status: 400 });
      const church = await db.prepare("SELECT review_status FROM churches WHERE id=?").bind(id).first<{ review_status: string }>();
      if (!church) return Response.json({ error: "교회를 찾을 수 없습니다." }, { status: 404 });
      if (church.review_status === "removed" && (!["youtube_unavailable", "inactive", "info_unverified", "review_needed", "other"].includes(holdReason) || holdNote.length < 3)) return Response.json({ error: "보류 교회에는 사유와 3자 이상의 관리자 메모가 필요합니다." }, { status: 400 });
      await db.prepare("UPDATE churches SET name=?,pastor=?,region=?,denomination=?,priority_weight=?,hold_reason=?,hold_note=? WHERE id=?").bind(name, pastor, region, denomination, priorityWeight, holdReason || null, holdNote || null, id).run();
    }
  } else if (kind === "sermon") {
    const status = clean(data.status, 20);
    if (!["published", "hidden"].includes(status)) return Response.json({ error: "상태를 확인해 주세요." }, { status: 400 });
    await db.prepare("UPDATE sermons SET status=? WHERE id=?").bind(status, id).run();
  } else if (kind === "post" || kind === "talent") {
    const status = clean(data.status, 20);
    if (!["pending", "approved", "rejected"].includes(status)) return Response.json({ error: "상태를 확인해 주세요." }, { status: 400 });
    const table = kind === "post" ? "community_posts" : "talent_offers";
    await db.prepare(`UPDATE ${table} SET status=? WHERE id=?`).bind(status, id).run();
  } else if (kind === "recommendation") {
    const status=clean(data.status,20);
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
