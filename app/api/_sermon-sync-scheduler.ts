import { getRequestExecutionContext } from "vinext/shims/request-context";
import { POST as syncSermons } from "./sermons/sync/route";

let pendingSync:Promise<void>|null=null;
let lastAttemptAt=0;

export function scheduleSermonSync(){
  const context=getRequestExecutionContext();
  if(!context||Date.now()-lastAttemptAt<5*60*1000)return;
  if(!pendingSync){lastAttemptAt=Date.now();pendingSync=(async()=>{
    await syncSermons(new Request("https://airchurch.internal/api/sermons/sync?scope=photo_pastors&limit=3",{method:"POST"}));
    await syncSermons(new Request("https://airchurch.internal/api/sermons/sync",{method:"POST"}));
  })().then(()=>undefined).catch(()=>undefined).finally(()=>{pendingSync=null;});}
  context.waitUntil(pendingSync);
}
