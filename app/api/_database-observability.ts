type StatementInfo={native:D1PreparedStatement;sql:string};
const statements=new WeakMap<object,StatementInfo>();
const knownTables=new Set("access_sessions admin_login_attempts church_change_requests church_ministry_profiles church_news_snapshots church_profiles church_recommendations church_shorts church_status_events churches community_posts contact_requests encouragement_messages event_candidates event_sources events maintenance_state making_comments making_posts ministry_appearances ministry_profile_suggestions page_views pastor_admin_buckets pastor_church_roles pastor_encouragement_messages pastor_identity_candidates pastor_people pastor_private_contact_values praise_contest_audit praise_contest_decisions praise_contest_entries praise_contest_payments praise_contest_results praise_contest_vote_events praise_contest_votes praise_videos private_church_contacts private_contact_access_events reviewer_accounts reviewer_church_reviews search_discovery_pool search_discovery_pool_v2 sermons site_settings submission_rate_limits sync_state talent_offers visitor_activity worship_schedules".split(" "));
const normalize=(sql:string)=>sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"/g,"?").replace(/--[^\n]*|\/\*[\s\S]*?\*\//g," ").replace(/\s+/g," ").trim();

function describe(sql:string){
  let hash=2166136261;
  for(let i=0;i<sql.length;i++)hash=Math.imul(hash^sql.charCodeAt(i),16777619);
  return {id:(hash>>>0).toString(16),operation:sql.split(/\s+/,1)[0],tables:[...new Set([...sql.matchAll(/\b(?:FROM|JOIN|UPDATE|INTO|TABLE(?:\s+IF\s+NOT\s+EXISTS)?)\s+`?([a-z_][\w]*)/gi)].map(match=>match[1]).filter(table=>knownTables.has(table)))].slice(0,8)};
}

async function measure<T>(sqls:string[],run:()=>Promise<T>,hasMeta=true):Promise<T>{
  const started=Date.now();
  let result:T|undefined,error:unknown;
  try{return result=await run();}
  catch(caught){error=caught;throw caught;}
  finally{
    try{
    const elapsedMs=Date.now()-started;
    if(error||elapsedMs>=500){
      const metas=hasMeta?(Array.isArray(result)?result:[result]).map(value=>(value as {meta?:{duration?:number;rows_read?:number;rows_written?:number}}|undefined)?.meta).filter(Boolean):[];
      const message=error instanceof Error?error.message:"";
      const total=(key:"duration"|"rows_read"|"rows_written")=>metas.length&&metas.every(meta=>Number.isFinite(meta?.[key]))?metas.reduce((sum,meta)=>sum+Number(meta?.[key]),0):undefined;
      console.warn(error?"d1_query_failed":"d1_query_slow",{queries:sqls.slice(0,4).map(describe),queryCount:sqls.length,elapsedMs,queryDurationMs:total("duration"),rowsRead:total("rows_read"),rowsWritten:total("rows_written"),errorKind:error?(message.includes("overloaded")?"overloaded":"query_failed"):undefined});
    }
    }catch{/* Observation must never change a database result or exception. */}
  }
}

function observeStatement(native:D1PreparedStatement,sql:string):D1PreparedStatement{
  const observed=new Proxy(native,{
    get(target,key){
      if(key==="bind")return (...values:unknown[])=>observeStatement(target.bind(...values),sql);
      const value=Reflect.get(target,key,target);
      if(["all","run","first","raw"].includes(String(key))&&typeof value==="function")return (...args:unknown[])=>measure([sql],()=>value.apply(target,args),key==="all"||key==="run");
      return typeof value==="function"?value.bind(target):value;
    },
  });
  statements.set(observed,{native,sql});
  return observed;
}

// Observe native calls without retaining request promises, SQL text, or bound
// input values in logs. Batch receives native statements, not proxy objects.
export function observeDatabase(native:D1Database):D1Database{
  return new Proxy(native,{
    get(target,key){
      if(key==="prepare")return (sql:string)=>observeStatement(target.prepare(sql),normalize(sql));
      if(key==="batch")return (items:D1PreparedStatement[])=>measure(items.map(item=>statements.get(item)?.sql||"batch"),()=>target.batch(items.map(item=>statements.get(item)?.native||item)));
      const value=Reflect.get(target,key,target);
      return typeof value==="function"?value.bind(target):value;
    },
  });
}
