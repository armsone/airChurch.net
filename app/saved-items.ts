export type SavedItem={id:string;kind:"sermon"|"praise"|"church";title:string;subtitle:string;url:string};

export const SAVED_ITEMS_KEY="airchurch:saved";
export const SAVED_ITEMS_LIMIT=30;

export function isSavedItem(item:unknown):item is SavedItem{
  if(!item||typeof item!=="object")return false;
  const value=item as Record<string,unknown>;
  return typeof value.id==="string"&&["sermon","praise","church"].includes(String(value.kind))&&typeof value.title==="string"&&typeof value.subtitle==="string"&&typeof value.url==="string"&&value.id.length<=300&&value.title.length<=300&&value.subtitle.length<=500&&value.url.length<=1000;
}

export function readSavedItems(){
  try{const parsed=JSON.parse(localStorage.getItem(SAVED_ITEMS_KEY)||"[]");return Array.isArray(parsed)?parsed.filter(isSavedItem).slice(0,SAVED_ITEMS_LIMIT):[];}catch{return [];}
}

export function writeSavedItems(items:SavedItem[]){
  const safe=items.filter(isSavedItem).filter((item,index,all)=>all.findIndex((other)=>other.id===item.id)===index).slice(0,SAVED_ITEMS_LIMIT);
  localStorage.setItem(SAVED_ITEMS_KEY,JSON.stringify(safe));
  window.dispatchEvent(new CustomEvent("airchurch:saved-change",{detail:safe.length}));
  return safe;
}
