import collection from "../data/daily-scriptures.json";

const DAY = 86_400_000;
export const KST_OFFSET = 9 * 60 * 60 * 1000;
type Season = "advent" | "christmas" | "epiphany" | "lent" | "easter" | "ordinary";
const labels: Record<Season, [string, string]> = {
  advent: ["대림절", "기다림"], christmas: ["성탄절기", "기쁨"],
  epiphany: ["주현절기", "빛"], lent: ["사순절", "성찰"],
  easter: ["부활절기", "소망"], ordinary: ["성령강림 후", "성장"],
};
function easterSunday(year: number) {
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
  return Date.UTC(year,Math.floor((h+l-7*m+114)/31)-1,(h+l-7*m+114)%31+1);
}
// Gregorian Western church seasons; editorial selections, not an official lectionary.
function calendar(day: number) {
  const date=new Date(day),year=date.getUTCFullYear(),easter=easterSunday(year);
  const nov27=Date.UTC(year,10,27),advent=nov27+(7-new Date(nov27).getUTCDay())%7*DAY;
  let season: Season = "ordinary";
  if(day>=Date.UTC(year,11,25)||day<Date.UTC(year,0,6))season="christmas";
  else if(day>=advent)season="advent";
  else if(day<easter-46*DAY)season="epiphany";
  else if(day<easter)season="lent";
  else if(day<easter+49*DAY)season="easter";
  let [name,accent]=labels[season];
  let special: string[] | undefined;
  if(day===Date.UTC(year,11,25)){name="성탄절";special=["LUK.2.11","LUK.2.14"];}
  if(day===Date.UTC(year,0,6)){name="주현절";special=["MAT.2.10-11"];}
  if(day===easter-2*DAY){name="성금요일";special=["ISA.53.4","ISA.53.5"];}
  if(day===easter){name="부활주일";special=["MAT.28.6","MRK.16.6"];}
  if(day===easter+49*DAY){name="성령강림절";accent="성령";special=["ACT.1.8","ACT.2.17"];}
  return {season,name,accent,special,year};
}
const reserved=new Set(["LUK.2.11","LUK.2.14","MAT.2.10-11","ISA.53.4","ISA.53.5","MAT.28.6","MRK.16.6","ACT.1.8","ACT.2.17"]);
function hash(value: string) {
  let result=2166136261;
  for(let i=0;i<value.length;i++)result=Math.imul(result^value.charCodeAt(i),16777619);
  return result>>>0;
}
export function koreanDateKey(now = Date.now()) {
  return new Date(now+KST_OFFSET).toISOString().slice(0,10);
}
export function dailyScripture(dateKey: string) {
  const target=Date.parse(`${dateKey}T00:00:00Z`);
  const recent: string[]=[];
  const lastUsed=new Map<string,number>();
  let chosen=collection.items[0];
  // Replay a stable sequence so all visitors agree, including across New Year.
  for(let day=Math.min(Date.UTC(2020,0,1),target);day<=target;day+=DAY){
    const guide=calendar(day);
    if(guide.special){
      chosen=collection.items.find(item=>item.path===guide.special![guide.year%guide.special!.length])!;
    }else{
      const candidates=collection.items.filter(item=>item.season===guide.season&&!reserved.has(item.path)&&!recent.includes(item.path));
      chosen=candidates.reduce((best,item)=>{
        const used=lastUsed.get(item.path)??-Infinity,bestUsed=lastUsed.get(best.path)??-Infinity;
        return used<bestUsed||(used===bestUsed&&hash(`${day}:${item.path}`)<hash(`${day}:${best.path}`))?item:best;
      });
    }
    lastUsed.set(chosen.path,day);
    recent.push(chosen.path);
    if(recent.length>14)recent.shift();
  }
  return {...calendar(target),...chosen,dateKey};
}
