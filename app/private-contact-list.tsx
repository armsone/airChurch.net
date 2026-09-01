import { safeHttpUrl } from "./safe-url";

export type PrivateContactView={id:number;churchName:string;type:string;value:string;scope:string;sourceUrl:string};
const typeLabel=(type:string)=>type==="email"?"이메일":type==="phone"?"전화번호":"계좌번호";
export default function PrivateContactList({items,viewer}:{items:PrivateContactView[];viewer:"관리자"|"승인된 목회자"}){
  return <section className="admin-panel private-contact-panel" id="private-contacts"><div className="admin-panel-title"><div><small>AUTHORIZED CONTACTS</small><h2>교회 비공개 연락 정보</h2><p>DB에는 암호화되어 저장되며 {viewer}에게만 표시됩니다. 일반 사용자 화면과 API는 이 자료를 가져오지 않습니다.</p></div><span>{items.length}건</span></div><div className="review-list">{items.length?items.map((item)=>{const source=safeHttpUrl(item.sourceUrl);return <article key={item.id}><div><span>{typeLabel(item.type)} · {item.scope==="official_role"?"공식 사역자":"교회 공식"}</span></div><strong>{item.churchName}</strong><p className="private-contact-value">{item.value}</p>{source&&<a className="admin-review-link" href={source} target="_blank" rel="noreferrer">공식 출처 확인 ↗</a>}</article>}):<p className="admin-empty">저장된 비공개 연락 정보가 없습니다.</p>}</div></section>;
}
