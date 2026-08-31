const RECENT_SEARCHES_KEY="airchurch:recent-searches";
const RECENT_SEARCHES_UPDATED_KEY="airchurch:recent-searches-updated-at";
const RECENT_SEARCHES_RETENTION_MS=30*24*60*60*1000;

export function clearRecentSearches(){
  localStorage.removeItem(RECENT_SEARCHES_KEY);
  localStorage.removeItem(RECENT_SEARCHES_UPDATED_KEY);
}

export function readRecentSearches(){
  const updatedAt=Number(localStorage.getItem(RECENT_SEARCHES_UPDATED_KEY));
  if(updatedAt>0&&Date.now()-updatedAt>RECENT_SEARCHES_RETENTION_MS){clearRecentSearches();return [];}
  const saved=JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY)||"[]") as unknown;
  const items=Array.isArray(saved)?saved.filter((item):item is string=>typeof item==="string").slice(0,5):[];
  if(items.length>0&&updatedAt<=0)localStorage.setItem(RECENT_SEARCHES_UPDATED_KEY,String(Date.now()));
  return items;
}

export function writeRecentSearches(items:string[]){
  localStorage.setItem(RECENT_SEARCHES_KEY,JSON.stringify(items.slice(0,5)));
  localStorage.setItem(RECENT_SEARCHES_UPDATED_KEY,String(Date.now()));
}
