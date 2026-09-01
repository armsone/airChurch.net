const compact=(value:string)=>value.normalize("NFKC").replace(/\s+/g,"").replace(/목사(?:님)?$/u,"");
const speakerPattern=/([가-힣]{2,6})\s*(?:(?:담임|위임|대표|수석부|부|행정|목양|교육|협동|원로|은퇴)\s*)?목사(?:님)?/gu;

export function namedPastorsInTitle(title:string){
  return [...new Set([...title.matchAll(speakerPattern)].map((match)=>compact(match[1])).filter(Boolean))];
}

export function isSermonAttributedTo(title:string,ministerName:string,isPrimary:boolean){
  const subject=compact(ministerName),named=namedPastorsInTitle(title);
  if(named.includes(subject))return true;
  return isPrimary&&named.length===0;
}
