const PLACEHOLDER_NAMES=new Set(["","확인필요","이름확인필요","성명확인필요","목회자확인필요","담임목사확인필요","미상","없음","공석","청빙중","-","?"]);

export function normalizePastorName(value:string){return value.replace(/\s+/g,"");}
export function isValidPastorName(value:string){return !PLACEHOLDER_NAMES.has(normalizePastorName(value));}
export function sqlValidPastorName(field:string){return `REPLACE(TRIM(COALESCE(${field},'')),' ','') NOT IN ('','확인필요','이름확인필요','성명확인필요','목회자확인필요','담임목사확인필요','미상','없음','공석','청빙중','-','?')`;}
export function displayRoleTitle(value:string){return value==="목회자"||value==="부목사"?"목사":value;}
