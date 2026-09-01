import type {PastorPrivateContactView} from "./private-contact-vault";
import {safeHttpUrl} from "./safe-url";

const typeLabel=(type:string)=>type==="email"?"이메일":type==="phone"?"전화번호":"계좌번호";
export default function PastorPrivateContactList({items,viewer}:{items:PastorPrivateContactView[];viewer:"관리자"|"승인된 목회자"}){
  if(!items.length)return null;
  return <section className="admin-panel private-contact-panel"><div className="admin-panel-title"><div><small>AUTHORIZED CONTACTS</small><h2>목회자 보호 연락 정보</h2><p>암호화된 자료를 {viewer} 권한으로 조회했습니다. 복사·재배포하지 말아 주세요.</p></div><span>{items.length}건</span></div><div className="review-list">{items.map((item)=>{const source=safeHttpUrl(item.sourceUrl);return <article key={item.id}><div><span>{typeLabel(item.type)} · 권한 전용</span></div><strong>{item.pastorName}</strong><p className="private-contact-value">{item.value}</p>{source&&<a className="admin-review-link" href={source} target="_blank" rel="noreferrer">등록 출처 확인 ↗</a>}</article>})}</div></section>;
}
