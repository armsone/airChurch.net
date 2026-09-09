import { readEvents,withDeadline } from "../../events/data";
export async function GET(request:Request){
  try {const result=await withDeadline(readEvents(new URL(request.url).searchParams));return Response.json(result,{headers:{"cache-control":"no-store"}});}
  catch(error){const invalid=String(error).includes("invalid_filter");return Response.json({error:invalid?"날짜와 검색 조건을 확인해 주세요.":"일정을 잠시 불러오지 못했습니다."},{status:invalid?400:503,headers:{"cache-control":"no-store","retry-after":"5"}});}
}
