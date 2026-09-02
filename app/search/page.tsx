import {redirect} from "next/navigation";

export default async function SearchRedirect({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const params=await searchParams;
  const q=String(Array.isArray(params.q)?params.q[0]??"":params.q??"").trim().slice(0,100);
  redirect(q?`/?q=${encodeURIComponent(q)}`:"/");
}
