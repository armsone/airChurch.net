type DiscoveryKind="church"|"pastor"|"sermon"|"praise";

const sources:Record<DiscoveryKind,{table:string;id:string;where:string;extraTriggers:string[]}>= {
  church:{table:"churches",id:"id",where:"source.review_status='approved'",extraTriggers:[]},
  pastor:{table:"pastor_people",id:"id",where:"source.review_status='approved'",extraTriggers:["pastor_church_roles"]},
  sermon:{table:"sermons",id:"id",where:"source.status='published' AND EXISTS (SELECT 1 FROM churches c WHERE c.id=source.church_id AND c.review_status='approved')",extraTriggers:[]},
  praise:{table:"praise_videos",id:"id",where:"source.status='published' AND EXISTS (SELECT 1 FROM churches c WHERE c.id=source.church_id AND c.review_status='approved')",extraTriggers:[]},
};

export async function ensureSearchDiscoveryPools(db:ReturnType<typeof import("./api/_shared").database>){
  await db.prepare("CREATE TABLE IF NOT EXISTS search_discovery_pool (kind TEXT NOT NULL,bucket INTEGER NOT NULL,position INTEGER NOT NULL,item_key TEXT NOT NULL,PRIMARY KEY(kind,bucket,position))").run();
  const triggerTables:Array<[string,DiscoveryKind[],string]>=[
    ["churches",["church","sermon","praise"],"OLD.name IS NOT NEW.name OR OLD.pastor IS NOT NEW.pastor OR OLD.region IS NOT NEW.region OR OLD.denomination IS NOT NEW.denomination OR OLD.review_status IS NOT NEW.review_status OR OLD.homepage_url IS NOT NEW.homepage_url OR OLD.youtube_channel_id IS NOT NEW.youtube_channel_id"],
    ["pastor_people",["pastor"],"OLD.name IS NOT NEW.name OR OLD.public_id IS NOT NEW.public_id OR OLD.photo_url IS NOT NEW.photo_url OR OLD.photo_review_status IS NOT NEW.photo_review_status OR OLD.review_status IS NOT NEW.review_status"],
    ["pastor_church_roles",["pastor"],"OLD.pastor_id IS NOT NEW.pastor_id OR OLD.church_id IS NOT NEW.church_id OR OLD.church_name IS NOT NEW.church_name OR OLD.region IS NOT NEW.region OR OLD.denomination IS NOT NEW.denomination OR OLD.role_title IS NOT NEW.role_title OR OLD.role_status IS NOT NEW.role_status OR OLD.review_status IS NOT NEW.review_status"],
    ["sermons",["sermon"],"OLD.church_id IS NOT NEW.church_id OR OLD.title IS NOT NEW.title OR OLD.published_at IS NOT NEW.published_at OR OLD.status IS NOT NEW.status"],
    ["praise_videos",["praise"],"OLD.church_id IS NOT NEW.church_id OR OLD.title IS NOT NEW.title OR OLD.published_at IS NOT NEW.published_at OR OLD.status IS NOT NEW.status"],
  ];
  for(const [table,kinds,updateWhen] of triggerTables)for(const action of ["INSERT","UPDATE","DELETE"] as const){
    const trigger=`search_discovery_${table}_${action.toLowerCase()}`,quoted=kinds.map((kind)=>`'${kind}'`).join(",");
    await db.prepare(`CREATE TRIGGER IF NOT EXISTS ${trigger} AFTER ${action} ON ${table}${action==="UPDATE"?` WHEN ${updateWhen}`:""} BEGIN DELETE FROM search_discovery_pool WHERE kind IN (${quoted}); END`).run();
  }
  for(const kind of Object.keys(sources) as DiscoveryKind[]){
    const ready=await db.prepare("SELECT COUNT(DISTINCT bucket) AS buckets,COUNT(*) AS items FROM search_discovery_pool WHERE kind=?").bind(kind).first<{buckets:number;items:number}>();
    if(Number(ready?.buckets)===50&&Number(ready?.items)>0)continue;
    const source=sources[kind];
    await db.prepare("DELETE FROM search_discovery_pool WHERE kind=?").bind(kind).run();
    await db.prepare(`WITH RECURSIVE buckets(bucket) AS (SELECT 0 UNION ALL SELECT bucket+1 FROM buckets WHERE bucket<49), ranked AS (SELECT buckets.bucket,CAST(source.${source.id} AS TEXT) AS item_key,ROW_NUMBER() OVER (PARTITION BY buckets.bucket ORDER BY (((source.${source.id}*1103515245)+((buckets.bucket+1)*12345))&2147483647),source.${source.id}) AS position FROM ${source.table} source CROSS JOIN buckets WHERE ${source.where}) INSERT INTO search_discovery_pool(kind,bucket,position,item_key) SELECT ?,bucket,position,item_key FROM ranked WHERE position<=40`).bind(kind).run();
  }
}

export function discoveryFilter(kind:DiscoveryKind,bucket:number,column:string){
  return ` AND CAST(${column} AS TEXT) IN (SELECT item_key FROM search_discovery_pool WHERE kind='${kind}' AND bucket=${bucket})`;
}

export function discoveryOrder(kind:DiscoveryKind,bucket:number,column:string){
  return `(SELECT position FROM search_discovery_pool WHERE kind='${kind}' AND bucket=${bucket} AND item_key=CAST(${column} AS TEXT))`;
}
