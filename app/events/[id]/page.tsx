import type { Metadata } from "next";
import SiteFooter from "../../site-footer";
import { readEvent,withDeadline } from "../data";
import { dateLabel,koreaDate } from "../types";
import EventSaveButton from "../event-save-button";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"행사 안내 | airChurch"};
export default async function EventPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;let item;try{item=await withDeadline(readEvent(id));}catch{return <main className="events-page"><h1>일정을 잠시 불러오지 못했습니다</h1><a href={`/events/${id}`}>다시 시도</a><p><a href="/events">전체 일정 보기</a></p></main>;}
  if(!item)return <main className="events-page"><h1>행사를 찾을 수 없습니다</h1><a href="/events">전체 일정 보기 →</a></main>;
  const ended=item.endDate<koreaDate()||item.status==="ended",checking=item.status==="checking"||item.validUntil<new Date().toISOString(),cancelled=item.status==="cancelled";
  const registrationPassed=Boolean(item.participation?.registrationClosesOn&&item.participation.registrationClosesOn<koreaDate());
  const unavailable=ended||checking||cancelled||item.scheduleChanged;
  return <main className="church-detail-shell events-shell"><article className="events-page event-detail"><span className="section-kicker">{item.category}</span><h1>{item.title}</h1>
    <EventSaveButton item={item}/>
    {unavailable&&<p className="event-status" role="status">{cancelled?"취소된 행사입니다.":item.scheduleChanged?"공식 원문에 일정 변경 안내가 있습니다. 변경된 일정은 원문에서 확인해 주세요.":ended?"안내된 일정이 지났습니다. 변경 여부는 원문에서 확인해 주세요.":"일정 변경 여부를 다시 확인하고 있습니다. 아래 정보는 마지막 확인 내용입니다."}</p>}
    <dl><div><dt>일정</dt><dd>{dateLabel(item.startDate)}{item.endDate!==item.startDate&&` ~ ${dateLabel(item.endDate)}`} · {item.startTime||"시간은 공식 원문 확인"}</dd></div><div><dt>장소</dt><dd>{item.venue}</dd></div><div><dt>주최</dt><dd>{item.organizer}</dd></div><div><dt>참여 대상</dt><dd>{item.participation?.audienceText||item.audience}</dd></div><div><dt>참여 방식</dt><dd>{item.attendance}</dd></div><div><dt>자료 출처</dt><dd><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceName} · 공식 원문 ↗</a></dd></div><div><dt>마지막 확인</dt><dd>{new Date(item.checkedAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</dd></div></dl>
    {registrationPassed&&<p className="event-status" role="status">안내된 신청 기간이 지났습니다. 추가 접수 여부는 주최 측에 확인해 주세요.</p>}
    {item.participation&&<section aria-label="참여 안내"><h2>참여 안내</h2><dl>
      {item.participation.cost&&<div><dt>참가비</dt><dd>{item.participation.cost}</dd></div>}
      {item.participation.registrationInstructions&&<div><dt>신청 방법</dt><dd>{item.participation.registrationInstructions}</dd></div>}
      <div><dt>{item.participation.registrationClosesOn?"신청 기간":"신청 마감"}</dt><dd>{item.participation.registrationDeadline||"신청 마감일은 예약 페이지에서 확인해 주세요."}</dd></div>
      {item.participation.preparation&&<div><dt>준비·유의 사항</dt><dd style={{whiteSpace:"pre-line"}}>{item.participation.preparation}</dd></div>}
    </dl><p>예약 화면의 행사명·장소·날짜를 이 안내와 대조한 뒤 신청해 주세요. 잔여석과 현재 접수 가능 여부는 예약 페이지에서 확인해야 합니다.</p></section>}
    <p>기간으로 안내된 행사는 실제 진행일·회차가 다를 수 있습니다. 참가비, 신청 마감과 참여 조건은 공식 안내에서 확인해 주세요.</p><div className="event-actions"><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">공식 행사 안내 ↗</a>{!unavailable&&item.registrationUrl&&<a href={item.registrationUrl} target="_blank" rel="noopener noreferrer">신청 안내 ↗</a>}{item.churchPublicId&&<a href={`/church/${item.churchPublicId}`}>주최 교회 보기 →</a>}<a href={`/contact?category=${encodeURIComponent("정보 수정")}&event=${id}`}>일정 오류 알려주기</a></div></article><SiteFooter/></main>;
}
