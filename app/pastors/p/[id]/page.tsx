import {redirect} from "next/navigation";
import {database,ensurePastorPeopleTables} from "../../../api/_shared";

export const dynamic="force-dynamic";

export default async function LegacyPastorPersonPage({params}:{params:Promise<{id:string}>}){
  const internalId=Number((await params).id);
  if(!Number.isInteger(internalId)||internalId<1)redirect("/pastors");
  const db=database();await ensurePastorPeopleTables(db);
  const person=await db.prepare("SELECT COALESCE(public_id,1000000+id) AS public_id FROM pastor_people WHERE id=? AND review_status='approved' LIMIT 1").bind(internalId).first<{public_id:number|null}>();
  redirect(person?.public_id===null||person?.public_id===undefined?"/pastors":`/pastors/${person.public_id}`);
}
