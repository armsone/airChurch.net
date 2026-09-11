import { redirect } from "next/navigation";
import { CONTEST } from "./config";
export const dynamic = "force-dynamic";
export default async function ContestRedirect({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const params=await searchParams,query=new URLSearchParams();
  for(const [key,value] of Object.entries(params)){if(Array.isArray(value))value.forEach(item=>query.append(key,item));else if(value!==undefined)query.set(key,value);}
  const suffix=query.toString();
  redirect(CONTEST.path+(suffix?`?${suffix}`:""));
}
