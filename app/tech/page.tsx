import type { Metadata } from "next";
import SiteFooter from "../site-footer";

export const metadata: Metadata = {
  title: "테크 | airChurch",
  description: "공개 자료를 모으고 검토해 연결하는 airChurch의 운영 구조, 자동화와 데이터 원칙",
  alternates: { canonical: "/tech" },
};

const automationSteps = [
  ["01", "정해진 작업 시작", "서버의 예약 작업이 콘텐츠·뉴스·행사·정리 작업을 차례로 실행합니다."],
  ["02", "공개 출처만 읽기", "공식 YouTube 채널, 교회·교단 홈페이지, 공개 RSS를 시간 제한과 용량 제한 안에서 읽습니다."],
  ["03", "형식과 출처 확인", "채널·교회 정보와 제목·날짜·링크를 대조하고, 설교·찬양·짧은 영상·뉴스·행사로 분류합니다."],
  ["04", "중복 없이 안전하게 갱신", "같은 영상과 자료를 하나로 묶고, 실패한 출처는 기존에 정상인 목록을 지키며 다음 작업에서 다시 확인합니다."],
  ["05", "공개 목록과 원문 연결", "검증된 최소 정보만 보여 주고, 영상·뉴스·교회 원문은 원래 제공자의 페이지로 이어집니다."],
];

const dataGroups = [
  ["공개 안내 데이터", "교회·목회자·공식 채널·영상·뉴스·행사", "공개 출처, 확인 시각, 공개 상태와 원문 링크를 함께 관리합니다."],
  ["참여·제보 데이터", "응원글, 익명 글, 정보 수정·추천·문의", "입력값을 제한하고 반복 제출을 막은 뒤, 공개·보류·삭제를 운영자가 판단합니다."],
  ["운영 보호 데이터", "해시된 방문·남용 방지 기록, 처리 상태", "원문 식별값 대신 최소한의 해시와 횟수를 사용하며, 기간이 지나면 자동 삭제합니다."],
  ["비공개 연락 데이터", "공식 출처의 교회·공식 사역자 연락 수단", "별도 저장 영역에서 암호화합니다. 일반 방문자에게는 제공하지 않고 승인된 역할의 접근만 기록합니다."],
];

export default function TechPage() {
  return <main className="tech-page">
    <section className="tech-hero" id="primary-content" tabIndex={-1}>
      <span>OPEN TECH FOR CHRISTIAN COMMUNITIES</span>
      <h1>더 많은 교회가<br />더 쉽게 연결되도록</h1>
      <p>airChurch가 공개 자료를 모으고, 자동으로 정리하며, 사람의 검토를 거쳐 연결하는 방식을 나눕니다. 비밀값·개인 식별 정보·내부 운영 주소는 담지 않았습니다.</p>
      <div className="tech-hero-links"><a href="#automation">자동화 흐름 보기</a><a href="#data">데이터 원칙 보기</a></div>
    </section>

    <nav className="tech-nav" aria-label="테크 페이지 목차"><a href="#map">전체 구조</a><a href="#automation">자동화</a><a href="#data">데이터</a><a href="#trust">공개 기준</a><a href="#reuse">함께 만들기</a></nav>

    <section className="tech-section tech-map" id="map">
      <div className="tech-heading"><span>01 · SYSTEM MAP</span><h2>사람이 보는 화면까지의 길</h2><p>한 곳에 몰아넣기보다, 공개 자료·자동화·검토·표시 영역을 분리해 역할을 단순하게 유지합니다.</p></div>
      <div className="tech-system-flow" aria-label="airChurch 시스템 흐름도">
        <article><b>공개 출처</b><span>교회 · 교단 · 공식 채널 · RSS</span></article><i aria-hidden="true">→</i>
        <article><b>자동 수집</b><span>예약 작업 · 형식 분류 · 중복 방지</span></article><i aria-hidden="true">→</i>
        <article><b>안전한 저장</b><span>Cloudflare D1 · 공개/비공개 상태 분리</span></article><i aria-hidden="true">→</i>
        <article><b>웹 서비스</b><span>전 세계 엣지에서 페이지와 API 제공</span></article><i aria-hidden="true">→</i>
        <article><b>방문자</b><span>찾기 · 읽기 · 원문으로 이동</span></article>
      </div>
      <div className="tech-platform-grid">
        <article><span>EDGE</span><h3>Cloudflare Workers</h3><p>페이지와 API를 같은 실행 환경에서 제공합니다. 대표 도메인으로 정리하고, 이미지 요청은 안전한 크기로 변환해 전달합니다.</p></article>
        <article><span>DATA</span><h3>Cloudflare D1</h3><p>교회·콘텐츠·검토 상태·운영 기록을 관계형 데이터로 저장합니다. 공개 여부를 데이터마다 명확하게 둡니다.</p></article>
        <article><span>DELIVERY</span><h3>캐시와 원문 연결</h3><p>읽기 전용 목록은 짧게 캐시해 빠르게 보여 주되, 콘텐츠 자체를 복제하지 않고 출처와 원문으로 연결합니다.</p></article>
      </div>
    </section>

    <section className="tech-section tech-automation" id="automation">
      <div className="tech-heading"><span>02 · AUTOMATION</span><h2>자동으로 모으고,<br />사람이 책임 있게 판단합니다</h2><p>자동화의 역할은 공개된 사실을 반복해서 정리하는 것입니다. 교회와 사람에 대한 최종 판단, 권리 요청, 비공개 처리는 사람이 맡습니다.</p></div>
      <div className="tech-automation-flow" aria-label="콘텐츠 자동화 순서도">
        {automationSteps.map(([number,title,description],index)=><article key={number}><div><b>{number}</b>{index < automationSteps.length - 1 && <i aria-hidden="true">↓</i>}</div><div><h3>{title}</h3><p>{description}</p></div></article>)}
      </div>
      <div className="tech-automation-cards">
        <article><span>설교 · 찬양 · Shorts</span><h3>공식 채널의 새 자료를 정리</h3><p>공식 채널을 기준으로 제목·게시일·원본 주소를 읽습니다. 설교와 찬양은 제목 기준으로 보수적으로 분류하고, 짧은 영상은 명시적 표기나 짧은 길이·제외 조건을 함께 확인합니다.</p></article>
        <article><span>교계 소식</span><h3>공개 RSS를 제한적으로 수집</h3><p>허용한 출처의 RSS만 읽고, 출처별 수량을 제한합니다. 제목과 짧은 소개만 보여 주며 전체 기사는 원문에서 읽게 합니다.</p></article>
        <article><span>행사</span><h3>출처별 갱신 상태를 관리</h3><p>각 출처의 확인 시각·성공 여부·다음 확인 시점을 남깁니다. 오류가 난 출처가 다른 출처의 표시를 막지 않도록 분리합니다.</p></article>
        <article><span>자동 정리</span><h3>오래된 운영 기록을 비움</h3><p>예약 작업이 보관 기간이 지난 익명 통계, 반복 제출 방지 기록, 처리 완료 요청을 정리합니다. 공개 영상의 원본은 건드리지 않습니다.</p></article>
      </div>
      <aside className="tech-human-check"><span>사람이 하는 일</span><p>교회 공개·보류, 정보 수정, 권리자 요청, 익명 글의 공개 여부는 자동화하지 않습니다. 자동화가 확신할 수 없는 경우에는 표시를 보류하고, 공개 근거를 다시 확인합니다.</p></aside>
    </section>

    <section className="tech-section tech-data" id="data">
      <div className="tech-heading"><span>03 · DATA</span><h2>데이터마다 다른<br />보관 장소와 기준</h2><p>무엇이 공개 정보인지, 무엇이 입력 정보인지, 무엇이 보호 정보인지를 처음부터 나눕니다.</p></div>
      <div className="tech-data-grid">
        {dataGroups.map(([label,title,description],index)=><article key={label}><span>{String(index + 1).padStart(2,"0")}</span><small>{label}</small><h3>{title}</h3><p>{description}</p></article>)}
      </div>
      <div className="tech-storage-flow" aria-label="데이터 저장 위치 흐름도">
        <article><b>이 기기 안</b><p>찜, 최근 검색, 읽기 진행 상태처럼 로그인 없이 쓸 수 있는 개인 편의 기능은 브라우저 저장소에만 둡니다.</p></article><i aria-hidden="true">≠</i>
        <article><b>서비스 저장소</b><p>공개 목록과 검토 상태는 D1에 저장합니다. 제출 기록은 공개 데이터와 분리하고, 필요한 기간만 보관합니다.</p></article><i aria-hidden="true">≠</i>
        <article><b>외부 원문</b><p>영상·기사·교회 홈페이지는 각 제공자가 운영합니다. airChurch는 원문을 대신 보관하거나 로그인 영역을 읽지 않습니다.</p></article>
      </div>
      <div className="tech-retention"><h3>삭제도 자동화합니다</h3><p>방문 통계는 90일, 마지막 활동 기록은 30일 뒤 자동 삭제합니다. 반복 제출 방지용 해시와 횟수는 최대 2일 안에 정리합니다. 처리 완료된 문의·제보·검토 기록은 성격에 따라 30일에서 180일 사이에 삭제하며, 자세한 기준은 <a href="/privacy">개인정보처리방침</a>에서 공개합니다.</p></div>
    </section>

    <section className="tech-section tech-trust" id="trust">
      <div className="tech-heading"><span>04 · TRUST</span><h2>공개 기준이<br />자동화의 경계입니다</h2><p>많이 모으는 것보다 잘못 연결하지 않는 것을 우선합니다.</p></div>
      <div className="tech-trust-grid">
        <article><b>공식성</b><p>로그인 없이 공개된 교회·교단·공식 채널·언론 출처를 우선합니다.</p></article>
        <article><b>출처성</b><p>콘텐츠 가까이에 교회명·출처·원문 링크를 표시해 언제든 확인할 수 있게 합니다.</p></article>
        <article><b>보수성</b><p>채널 소유, 최근 운영, 교회 정보가 맞지 않거나 불명확하면 자동 공개하지 않습니다.</p></article>
        <article><b>권리 존중</b><p>영상·기사 원문을 복제하지 않고 제공자의 재생·원문 링크로 연결합니다.</p></article>
        <article><b>최소 수집</b><p>로그인·비공개 공간·민감정보를 수집해 교회나 개인을 평가하지 않습니다.</p></article>
        <article><b>수정 가능성</b><p>오류, 초상권, 저작권, 비공개 요청은 먼저 보류한 뒤 공식 근거를 확인합니다.</p></article>
      </div>
    </section>

    <section className="tech-reuse" id="reuse">
      <span>05 · SHARE THE PATTERN</span><h2>이 구조를 참고해<br />더 많은 크리스천 사이트를 만들어 주세요</h2>
      <p>교회·지역·교단을 위한 사이트는 거창한 시스템보다 “공개 출처만 다루기”, “자동화와 사람의 역할 나누기”, “개인 정보 최소화”, “원문으로 돌려보내기”에서 출발할 수 있습니다.</p>
      <ol><li><b>1</b><div><strong>먼저 공개 기준을 적으세요</strong><span>무엇을 모으고, 무엇은 보류할지 서비스 첫날부터 정합니다.</span></div></li><li><b>2</b><div><strong>반복되는 일만 자동화하세요</strong><span>출처 확인과 목록 갱신은 기계가 돕고, 사람에 대한 판단은 사람에게 남겨 둡니다.</span></div></li><li><b>3</b><div><strong>개인정보는 기능보다 먼저 보호하세요</strong><span>정말 필요한 정보만 받고, 공개·비공개·삭제 시점을 분리합니다.</span></div></li></ol>
      <div className="tech-reuse-links"><a href="/about">운영 안내</a><a href="/privacy">개인정보처리방침</a><a href="/copyright">저작권 원칙</a><a href="/contact">함께 이야기하기</a></div>
    </section>
    <SiteFooter />
  </main>;
}
