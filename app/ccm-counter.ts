// Independent IDs keep CCM counts separate from accounts and browsing analytics.
function enabled() { return navigator.doNotTrack!=="1"; }
function randomId() { return crypto.randomUUID(); }

async function send(event:"visit"|"play",id:string,retry=false):Promise<void> {
  if(!enabled())return;
  try {
    const response=await fetch("/api/ccm/counters",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({event,id}),keepalive:true,signal:AbortSignal.timeout(8000),
    });
    if(!response.ok)throw new Error("counter_unavailable");
  } catch {
    if(!retry)window.setTimeout(()=>{void send(event,id,true);},5000);
  }
}

export function countCcmVisit() {
  if(!enabled()||document.hidden)return;
  try {
    const key="airchurch.ccm.visitor.v1";
    let id=localStorage.getItem(key);
    if(!id||!/^[a-zA-Z0-9-]{16,80}$/.test(id)) {
      id=randomId();localStorage.setItem(key,id);
    }
    void send("visit",id);
  } catch { /* Storage blocked: skip unique visits instead of inflating them. */ }
}

export function createCcmPlaybackCounter() {
  let id:string|null=null;
  try { if(enabled())id=randomId(); } catch { /* Counting must not block playback. */ }
  let elapsed=0;
  let since:number|null=null;
  let timer:ReturnType<typeof setTimeout>|undefined;
  let counted=false;
  const stop=()=>{
    clearTimeout(timer);timer=undefined;
    if(since!==null)elapsed+=performance.now()-since;
    since=null;
    if(id&&!counted&&elapsed>=10000){counted=true;void send("play",id);}
  };
  const playing=(active:boolean)=>{
    stop();
    if(!active||!id||counted)return;
    since=performance.now();
    timer=setTimeout(()=>playing(true),Math.max(1,Math.ceil(10000-elapsed)));
  };
  window.addEventListener("pagehide",stop);
  return {playing,dispose:()=>{stop();window.removeEventListener("pagehide",stop);}};
}
