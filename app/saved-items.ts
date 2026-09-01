export type SavedItem={id:string;kind:"sermon"|"praise"|"church"|"pastor";title:string;subtitle:string;url:string;savedAt?:string};
const normalized=(value:string)=>value.toLocaleLowerCase("ko-KR").replace(/[^\p{L}\p{N}]/gu,"");

export const SAVED_ITEMS_KEY="airchurch:saved";
export const SAVED_ITEMS_LIMIT=30;

export function isSavedItem(item:unknown):item is SavedItem{
  if(!item||typeof item!=="object")return false;
  const value=item as Record<string,unknown>;
  const kind=String(value.kind),url=typeof value.url==="string"?value.url:"";
  const safeUrl=(url.startsWith("/")&&!url.startsWith("//"))||url.startsWith("#")||url.startsWith("https://www.youtube.com/")||url.startsWith("https://youtu.be/");
  const savedAt=value.savedAt===undefined||value.savedAt===null||typeof value.savedAt==="string"&&!Number.isNaN(Date.parse(value.savedAt));
  return typeof value.id==="string"&&["sermon","praise","church","pastor"].includes(kind)&&value.id.startsWith(`${kind}:`)&&typeof value.title==="string"&&typeof value.subtitle==="string"&&safeUrl&&savedAt&&value.id.length<=300&&value.title.length<=300&&value.subtitle.length<=500&&url.length<=1000;
}

export function readSavedItems(){
  try{const parsed=JSON.parse(localStorage.getItem(SAVED_ITEMS_KEY)||"[]");return Array.isArray(parsed)?parsed.filter(isSavedItem).slice(0,SAVED_ITEMS_LIMIT):[];}catch{return [];}
}

export function writeSavedItems(items:SavedItem[]){
  const safe=items.filter(isSavedItem).filter((item,index,all)=>all.findIndex((other)=>other.id===item.id)===index).slice(0,SAVED_ITEMS_LIMIT);
  try{localStorage.setItem(SAVED_ITEMS_KEY,JSON.stringify(safe));}catch{/* 저장이 제한돼도 현재 화면의 기능은 유지합니다. */}
  window.dispatchEvent(new CustomEvent("airchurch:saved-change",{detail:safe.length}));
  return safe;
}

export function markSavedItemSeen(id:string){const items=readSavedItems(),index=items.findIndex((item)=>item.id===id);if(index<0)return items;const next=items.map((item,itemIndex)=>itemIndex===index?{...item,savedAt:new Date().toISOString()}:item);return writeSavedItems(next);}

export function hasSavedItemNewSermon(item:SavedItem,sermons:{church:string;pastor:string;publishedAt?:string}[]){
  if(!item.savedAt||(item.kind!=="church"&&item.kind!=="pastor"))return false;
  const savedAt=Date.parse(item.savedAt);if(!Number.isFinite(savedAt))return false;
  const pastorName=normalized(item.title.replace(/\s*(?:담임|위임|대표|협동|원로|은퇴)?목사(?:님)?$/u,""));
  return sermons.some((sermon)=>{const same=item.kind==="pastor"?normalized(sermon.pastor).includes(pastorName)&&normalized(sermon.church)===normalized(item.subtitle):normalized(sermon.church)===normalized(item.title);return same&&!!sermon.publishedAt&&Date.parse(sermon.publishedAt)>savedAt;});
}
