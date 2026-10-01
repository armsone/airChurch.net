/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface ScheduledController {
  scheduledTime: number;
  cron: string;
}

async function runScheduledMaintenance(env:Env,ctx:ExecutionContext){
  const requests=[
    new Request("https://airchurch.internal/api/sermons/sync?scope=photo_pastors&limit=1",{method:"POST"}),
    new Request("https://airchurch.internal/api/sermons/sync?scope=database&limit=20",{method:"POST"}),
    new Request("https://airchurch.internal/api/sermons/sync?scope=all&limit=20",{method:"POST"}),
    new Request("https://airchurch.internal/api/praises/sync",{method:"POST"}),
    new Request("https://airchurch.internal/api/church-news/sync",{method:"POST"}),
    new Request("https://airchurch.internal/api/events/sync",{method:"POST"}),
    new Request("https://airchurch.internal/api/maintenance/retention",{method:"POST"}),
    new Request("https://airchurch.internal/api/praise-contest/maintenance",{method:"POST"}),
  ];
  await Promise.allSettled(requests.map((request)=>handler.fetch(request,env,ctx)));
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

// Temporary read-only incident probe: one run per isolate, then expires.
let contestReadOnlyProbeStarted=false;
async function contestReadOnlyProbe(env:Env){
  await Promise.all([
    (async()=>{
      try{
        const columns=await env.DB.prepare("PRAGMA table_info(praise_contest_entries)").all<{name:string;type:string;notnull:number;dflt_value:string|null;pk:number}>();
        const names=["id","contest_id","youtube_id","performer","title","channel_name","contact","source_file_url","browser_hash","consent_version","consent_at","status","reupload_status","reupload_url","admin_note","created_at","payout_ciphertext"];
        const nullable=["source_file_url","reupload_url","admin_note","payout_ciphertext"];
        const mismatches=names.filter(name=>{const row=columns.results.find(c=>c.name===name);return !row||row.type.toLowerCase()!==(name==="id"?"integer":"text")||row.notnull!==(nullable.includes(name)?0:1)||(name==="id"&&row.pk!==1);});
        const indexes=await env.DB.prepare("PRAGMA index_list(praise_contest_entries)").all<{name:string;unique:number}>();
        const uniqueColumns=await env.DB.prepare("PRAGMA index_info(idx_contest_unique_video)").all<{name:string}>();
        const triggers=await env.DB.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='trigger' AND tbl_name='praise_contest_entries'").first<{count:number}>();
        console.info("praise_contest_runtime_diagnostic",{check:"schema",columnMismatches:mismatches,unexpectedRequiredColumn:columns.results.some(c=>!names.includes(c.name)&&c.notnull===1&&c.dflt_value===null&&c.pk===0),statusDefaultMatches:columns.results.find(c=>c.name==="status")?.dflt_value==="'published'",reuploadDefaultMatches:columns.results.find(c=>c.name==="reupload_status")?.dflt_value==="'awaiting_source'",uniqueVideoIndex:indexes.results.some(i=>i.name==="idx_contest_unique_video"&&i.unique===1)&&JSON.stringify(uniqueColumns.results.map(c=>c.name))===JSON.stringify(["contest_id","youtube_id"]),orderIndex:indexes.results.some(i=>i.name==="idx_contest_entries_order"),entryTriggerCount:Number(triggers?.count??0)});
      }catch{console.info("praise_contest_runtime_diagnostic",{check:"schema",code:"schema_read_failed"});}
    })(),
    (async()=>{
      let code="youtube_fetch_failed";
      try{
        // Existing public demonstration video; this is a metadata read, never a registration.
        const response=await fetch("https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DCeilnv98oNA&format=json",{signal:AbortSignal.timeout(8000),redirect:"error"});
        if(!response.ok){console.info("praise_contest_runtime_diagnostic",{check:"youtube",code:"youtube_http_rejected",status:response.status});return;}
        code="youtube_metadata_invalid";
        const metadata=await response.json() as {author_name?:unknown}|null;
        console.info("praise_contest_runtime_diagnostic",{check:"youtube",code:"youtube_read_ok",status:response.status,metadataObject:metadata!==null&&typeof metadata==="object",authorNameString:typeof metadata?.author_name==="string"});
      }catch(error){if(code==="youtube_fetch_failed"&&error instanceof Error&&["AbortError","TimeoutError"].includes(error.name))code="youtube_timeout";console.info("praise_contest_runtime_diagnostic",{check:"youtube",code});}
    })(),
  ]);
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    const wwwHosts = new Set(["www.airchurch.net", "www.goodshare.net", "www.linechurch.net"]);
    if (wwwHosts.has(url.hostname)) {
      return Response.redirect(`https://${url.hostname.slice(4)}${url.pathname}${url.search}`, 301);
    }
    // Derive branding from the actual incoming hostname, including RSC navigation.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-site-brand-host", url.hostname);
    request = new Request(request, { headers: requestHeaders });

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    if(!contestReadOnlyProbeStarted&&Date.now()<Date.parse("2026-10-01T03:50:00Z")&&url.hostname==="airchurch.net"&&url.pathname==="/api/praise-contest"&&request.method==="GET"){
      contestReadOnlyProbeStarted=true;
      ctx.waitUntil(contestReadOnlyProbe(env));
    }
    const response=await handler.fetch(request, env, ctx);
    if(url.pathname.startsWith("/api/pastor-photo/")&&response.ok&&response.body){
      try{
        const resized=await env.IMAGES.input(response.clone().body!).transform({width:360,height:440,fit:"cover"}).output({format:"image/jpeg",quality:82});
        const optimized=resized.response(),headers=new Headers(optimized.headers);
        headers.set("cache-control","public, max-age=86400, stale-while-revalidate=604800");
        headers.set("x-content-type-options","nosniff");
        return new Response(optimized.body,{status:optimized.status,headers});
      }catch{return response;}
    }
    return response;
  },
  async scheduled(_controller:ScheduledController,env:Env,ctx:ExecutionContext):Promise<void>{
    ctx.waitUntil(runScheduledMaintenance(env,ctx));
  },
};

export default worker;
