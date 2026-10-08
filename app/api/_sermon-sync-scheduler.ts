import { getRequestExecutionContext } from "vinext/shims/request-context";
import { POST as syncSermons } from "./sermons/sync/route";
import { POST as syncPraises } from "./praises/sync/route";
import { database, ensureSermonTables } from "./_shared";

let lastAttemptAt=0;

export function scheduleSermonSync(){
  const context=getRequestExecutionContext();
  if(!context||Date.now()-lastAttemptAt<5*60*1000)return;
  lastAttemptAt=Date.now();
  // The five-minute interval applies across Worker isolates. Per-isolate memory
  // alone allows every cold public read to start all four collectors again.
  context.waitUntil((async()=>{
    const db=database();
    await ensureSermonTables(db);
    const now=new Date().toISOString();
    const claim=await db.prepare("INSERT INTO sync_state(key,last_synced_at) VALUES('public-media-schedule-v1',?) ON CONFLICT(key) DO UPDATE SET last_synced_at=excluded.last_synced_at WHERE sync_state.last_synced_at<?").bind(now,new Date(Date.now()-5*60*1000).toISOString()).run();
    if(Number(claim.meta.changes)!==1)return;
    const praise=await syncPraises();
    if(!praise.ok)console.warn("public_media_sync_failed",{scope:"praises",status:praise.status});
    await praise.body?.cancel().catch(()=>undefined);
    for(const path of ["?scope=photo_pastors&limit=1","?scope=database&limit=20",""]){
      const response=await syncSermons(new Request(`https://airchurch.internal/api/sermons/sync${path}`,{method:"POST"}));
      if(!response.ok)console.warn("public_media_sync_failed",{scope:path||"all",status:response.status});
      await response.body?.cancel().catch(()=>undefined);
    }
  })().catch(()=>{console.warn("public_media_schedule_failed");}));
}
