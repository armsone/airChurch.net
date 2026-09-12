import { accessSession } from "../../../admin-access";
import { syncEvents } from "../../../events/collection";
import { readLimitedJson } from "../../_shared";

export async function POST(request:Request){
  if(request.headers.get("origin")!==new URL(request.url).origin)return Response.json({error:"접근할 수 없습니다."},{status:403});
  const session=await accessSession(request);
  if(session?.role!=="admin")return Response.json({error:"관리자 권한이 필요합니다."},{status:403});
  const body=await readLimitedJson(request);
  if(body.tooLarge)return Response.json({error:"요청이 너무 큽니다."},{status:413});
  if(!["sorrygom","jiguchon"].includes(String(body.data.sourceId)))return Response.json({error:"확인할 출처를 선택해 주세요."},{status:400});
  try{return Response.json(await syncEvents(String(body.data.sourceId)),{headers:{"cache-control":"no-store"}});}
  catch{return Response.json({error:"출처 확인을 마치지 못했습니다."},{status:503,headers:{"cache-control":"no-store"}});}
}
