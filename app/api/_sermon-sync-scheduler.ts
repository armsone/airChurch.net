import { getRequestExecutionContext } from "vinext/shims/request-context";
import { POST as syncSermons } from "./sermons/sync/route";

let pendingSync:Promise<void>|null=null;

export function scheduleSermonSync(){
  const context=getRequestExecutionContext();
  if(!context)return;
  if(!pendingSync)pendingSync=syncSermons(new Request("https://airchurch.internal/api/sermons/sync",{method:"POST"})).then(()=>undefined).catch(()=>undefined).finally(()=>{pendingSync=null;});
  context.waitUntil(pendingSync);
}
