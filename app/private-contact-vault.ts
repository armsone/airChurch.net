import { env } from "cloudflare:workers";

type VaultEnv={ADMIN_CONTACT_ENCRYPTION_KEY?:string};
const encoder=new TextEncoder(),decoder=new TextDecoder();
function keyText(){const value=(env as unknown as VaultEnv).ADMIN_CONTACT_ENCRYPTION_KEY?.trim();if(!value)throw new Error("Private contact encryption is not configured");return value;}
function bytesToUrl(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");}
function urlToBytes(value:string){const base64=value.replaceAll("-","+").replaceAll("_","/")+"=".repeat((4-value.length%4)%4);return Uint8Array.from(atob(base64),(character)=>character.charCodeAt(0));}
async function key(usage:KeyUsage[]){const material=await crypto.subtle.importKey("raw",encoder.encode(keyText()),"HKDF",false,["deriveKey"]);return crypto.subtle.deriveKey({name:"HKDF",hash:"SHA-256",salt:encoder.encode("airchurch-private-contact-v1"),info:encoder.encode("aes-gcm")},material,{name:"AES-GCM",length:256},false,usage);}
export async function encryptPrivateContact(value:string){const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},await key(["encrypt"]),encoder.encode(value.trim()));return `v1.${bytesToUrl(iv)}.${bytesToUrl(new Uint8Array(encrypted))}`;}
export async function decryptPrivateContact(payload:string){const [version,iv,cipher]=payload.split(".");if(version!=="v1"||!iv||!cipher)throw new Error("Unsupported private contact value");return decoder.decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:urlToBytes(iv)},await key(["decrypt"]),urlToBytes(cipher)));}
export async function digestPrivateContact(value:string){const material=await crypto.subtle.importKey("raw",encoder.encode(keyText()),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return bytesToUrl(new Uint8Array(await crypto.subtle.sign("HMAC",material,encoder.encode(`contact|${value.trim().toLowerCase()}`))));}

type StoredContact={id:number;church_name:string;contact_type:string;encrypted_value:string;scope:string;source_url:string};
export async function readPrivateContacts(db:D1Database,actor:{role:"admin"|"reviewer";reviewerId:number}){
  const rows=await db.prepare("SELECT p.id,c.name AS church_name,p.contact_type,p.encrypted_value,p.scope,p.source_url FROM private_church_contacts p JOIN churches c ON c.id=p.church_id WHERE p.review_status='approved' ORDER BY c.name,p.contact_type,p.id LIMIT 1000").all<StoredContact>();
  const items=[];
  for(const row of rows.results)try{items.push({id:row.id,churchName:row.church_name,type:row.contact_type,value:await decryptPrivateContact(row.encrypted_value),scope:row.scope,sourceUrl:row.source_url});}catch{}
  await db.prepare("INSERT INTO private_contact_access_events (actor_role,actor_id,record_count) VALUES (?,?,?)").bind(actor.role,actor.reviewerId,items.length).run();
  return items;
}
