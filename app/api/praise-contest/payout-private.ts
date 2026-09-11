import { env } from "cloudflare:workers";
export type PayoutDetails={phone:string;bank:string;holder:string;account:string};
async function key(){
 const secret=(env as unknown as {ADMIN_SESSION_SECRET?:string}).ADMIN_SESSION_SECRET;
 if(!secret)throw new Error("Private payout storage unavailable");
 const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),"HKDF",false,["deriveKey"]);
 return crypto.subtle.deriveKey({name:"HKDF",hash:"SHA-256",salt:new TextEncoder().encode("airchurch-payout-v1"),info:new TextEncoder().encode("contest-private-contact")},material,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
function encode(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes));}
function decode(value:string){return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}
export async function sealPayout(details:PayoutDetails,context:string){const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:new TextEncoder().encode(context)},await key(),new TextEncoder().encode(JSON.stringify(details)));return `v1.${encode(iv)}.${encode(new Uint8Array(encrypted))}`;}
export async function openPayout(value:string,context:string):Promise<PayoutDetails>{const [version,iv,body]=value.split(".");if(version!=="v1"||!iv||!body)throw new Error("Invalid payout record");const decrypted=await crypto.subtle.decrypt({name:"AES-GCM",iv:decode(iv),additionalData:new TextEncoder().encode(context)},await key(),decode(body));return JSON.parse(new TextDecoder().decode(decrypted));}
