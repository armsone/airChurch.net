export type FaithVideo={id:string;title:string;source:string;category:string;thumbnail:string;url:string;youtubeId?:string;programId?:string;publishedAt?:string};
export type FaithPayload={items:FaithVideo[];checkedAt:string;failedSources:string[]};

// Round-robin by provider so the first row is a mix, even when one feed is busier.
export function mixFaithVideos(items:FaithVideo[]){
  const groups=new Map<string,FaithVideo[]>();
  for(const item of items){const group=groups.get(item.source)||[];group.push(item);groups.set(item.source,group);}
  const result:FaithVideo[]=[];
  for(let index=0;result.length<items.length;index++)for(const group of groups.values())if(group[index])result.push(group[index]);
  return result;
}
