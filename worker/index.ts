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
  // These jobs share D1; simultaneous maintenance batches compete with public
  // reads and the event scheduler. Keep each job's failure independent.
  for(const request of requests){
    try{
      const response=await handler.fetch(request,env,ctx);
      if(!response.ok)console.error("scheduled_maintenance_failed",new URL(request.url).pathname,response.status);
      await response.body?.cancel();
    }catch(error){console.error("scheduled_maintenance_failed",new URL(request.url).pathname,error instanceof Error?error.message:"unknown_error");}
  }
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    const wwwHosts = new Set(["www.airchurch.net", "www.goodshare.net", "www.linechurch.net"]);
    if (wwwHosts.has(url.hostname)) {
      return Response.redirect(`https://${url.hostname.slice(4)}${url.pathname}${url.search}`, 301);
    }
    // This site has no PHP routes or assets. Scanner probes otherwise render
    // the full 404 layout, including a D1 theme read for every missing file.
    if(/\.php(?:\/|$)/i.test(url.pathname)){
      return new Response("Not found",{status:404,headers:{"content-type":"text/plain; charset=utf-8","cache-control":"public, max-age=300"}});
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

    // These two endpoints contain public media only and already advertise
    // cacheable responses. Reuse fresh results instead of repeating the full
    // weighted catalog sort for each visitor. Never cache failures or sessions.
    const cacheableMedia=request.method==="GET"&&["/api/sermons","/api/shorts"].includes(url.pathname)&&!request.headers.has("authorization")&&!request.headers.has("range")&&!/no-cache|no-store|max-age\s*=\s*0/i.test(request.headers.get("cache-control")||"")&&!/no-cache/i.test(request.headers.get("pragma")||"");
    const cacheKey=cacheableMedia?new Request(url.toString(),{method:"GET"}):null;
    if(cacheKey){
      const cached=await caches.default.match(cacheKey).catch(()=>undefined);
      if(cached){
        const headers=new Headers(cached.headers);headers.set("x-airchurch-cache","HIT");
        return new Response(cached.body,{status:cached.status,headers});
      }
    }
    const response=await handler.fetch(request, env, ctx);
    if(cacheKey&&response.status===200&&!response.headers.has("set-cookie")&&/\bpublic\b/i.test(response.headers.get("cache-control")||"")&&!/\b(?:private|no-store|no-cache)\b/i.test(response.headers.get("cache-control")||"")){
      const copy=response.clone(),headers=new Headers(copy.headers);
      headers.set("cache-control","public, max-age=60");
      ctx.waitUntil(caches.default.put(cacheKey,new Response(copy.body,{status:200,headers})).catch((error)=>{console.warn("public_media_cache_write_failed",error instanceof Error?error.message.replace(/https?:\/\/[^\s)]+/g,"[url]").slice(0,240):"unknown_error");}));
    }
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
