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

    <section className="tech-numbers" aria-labelledby="tech-numbers-title"><div><span>LIVE DESIGN NUMBERS</span><h2 id="tech-numbers-title">작게 시작해도<br />운영 가능한 숫자로 설계합니다</h2><p>아래 수치는 2026년 9월 기준 airChurch 코드에 설정된 상한과 운영 기준입니다. “많이 가져오기”보다 출처의 부하와 오류 전파를 제한하는 데 목적이 있습니다.</p></div><dl><div><dt>1,770곳</dt><dd>교회·공식 채널 수집 후보<small>교단별 목록과 직접 등록 후보의 합계. 같은 채널은 하나로 묶습니다.</small></dd></div><div><dt>25곳</dt><dd>교계 뉴스 RSS 출처<small>출처당 최대 2건, 한 번의 목록에는 최대 50건만 담습니다.</small></dd></div><div><dt>80곳</dt><dd>행사 출처 목록<small>자동 수집 연결 59곳, 추가 확인이 필요한 탐색 후보 21곳입니다.</small></dd></div><div><dt>20곳</dt><dd>한 번의 교회 채널 점검<small>전체 후보를 한 번에 훑지 않고 다음 묶음으로 이어갑니다.</small></dd></div></dl></section>

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
      <div className="tech-spec-table" role="region" aria-label="자동화 수치 명세"><div className="tech-spec-row tech-spec-head"><b>작업</b><b>한 번에 하는 양</b><b>시간·실패 제한</b><b>결과와 다음 동작</b></div><div className="tech-spec-row"><strong>교회 채널·말씀</strong><span>후보 최대 20곳. 채널별 최근 설교 18편, Shorts 12편, 찬양 12편까지 저장합니다.</span><span>외부 API 요청당 10초. 동시 실행 방지 잠금은 30분. 전체 순회 완료 뒤 1시간 이내에는 처음부터 다시 시작하지 않습니다.</span><span>같은 영상 ID는 갱신합니다. 저장은 80건 단위로 나눕니다. 180일보다 오래된 새 콘텐츠는 기본 분류 대상에서 제외합니다.</span></div><div className="tech-spec-row"><strong>찬양 RSS</strong><span>승인된 교회 채널 최대 60곳을 읽고, 최신 항목 최대 60건을 갱신합니다.</span><span>동시에 6곳, 채널당 10초. 30분 잠금. 목록이 이미 12건 이상이면 6시간 안에는 새 전체 갱신을 건너뜁니다.</span><span>한 채널 오류가 전체 작업을 멈추지 않습니다. 모든 채널이 실패했을 때만 실패 상태를 기록합니다.</span></div><div className="tech-spec-row"><strong>교계 뉴스</strong><span>RSS 25곳을 동시에 최대 6곳씩 읽습니다. 출처당 최대 2건, 최종 최대 50건입니다.</span><span>출처당 8초, 응답 본문 최대 1MB. 잘못된 주소·빈 제목·허용되지 않은 도메인은 제외합니다.</span><span>가장 최근의 정상 스냅샷을 유지합니다. 읽기 화면은 저장된 목록을 보여 주고 새 수집이 실패해도 기존 목록을 지킵니다.</span></div><div className="tech-spec-row"><strong>행사</strong><span>15분마다 최대 3개 출처씩, 한 실행에서 최대 24묶음을 처리합니다. 출처당 후보는 최대 10건입니다.</span><span>50초가 지나면 다음 후보로 넘기며, 대기 작업은 1분 뒤 이어갑니다. 정상 출처는 약 4시간 뒤 다시 확인합니다.</span><span>24시간 넘게 검증되지 않은 행사는 숨깁니다. 충돌하거나 날짜가 불명확한 항목은 공개 대신 확인 대기로 둡니다.</span></div></div>
      <div className="tech-trigger-flow"><article><span>방문 중 보조 갱신</span><h3>최대 5분에 한 번</h3><p>말씀·찬양·Shorts 목록을 읽는 요청이 들어오면, 이미 응답한 뒤 백그라운드에서 갱신을 요청합니다. 같은 실행 환경에서는 5분 안에 중복 실행하지 않습니다.</p></article><i aria-hidden="true">+</i><article><span>서버 예약 작업</span><h3>7개 유지보수 작업을 함께 요청</h3><p>콘텐츠, 찬양, 뉴스, 행사, 보관 기간 정리를 병렬로 시작합니다. 실행 주기는 배포 환경에서 관리하므로, 다른 팀은 자신의 트래픽·API 한도에 맞게 별도로 설정해야 합니다.</p></article><i aria-hidden="true">+</i><article><span>방문 통계</span><h3>5분 · 절약 모드 10분</h3><p>추적 금지 설정은 존중합니다. 첫 전송은 일반적으로 1.5초 뒤, 데이터 절약 모드에서는 5초 뒤이며 홈에서는 실제 상호작용 후에만 시작합니다.</p></article></div>
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
      <div className="tech-retention"><h3>삭제도 자동화합니다</h3><p>방문 통계는 90일, 마지막 활동 기록은 30일 뒤 자동 삭제합니다. 반복 제출 방지용 해시와 횟수는 최대 2일 안에 정리합니다. 처리 완료된 문의·제보·검토 기록은 성격에 따라 30일에서 180일 사이에 삭제하며, 자세한 기준은 <a href="/privacy">개인정보처리방침</a>에서 공개합니다.</p></div><div className="tech-retention-grid"><article><strong>40,000</strong><span>설교 저장 상한</span><p>전체 상한을 넘으면 오래된 항목부터 정리하되, 각 교회의 최신 3편은 남깁니다.</p></article><article><strong>4,000</strong><span>찬양 저장 상한</span><p>전체 상한을 넘으면 오래된 항목부터 정리하되, 각 교회의 최신 2편은 남깁니다.</p></article><article><strong>2,000</strong><span>Shorts 저장 상한</span><p>전체 상한을 넘으면 오래된 항목부터 정리하되, 각 교회의 최신 2편은 남깁니다.</p></article><article><strong>매일 1회</strong><span>개인 데이터 정리</span><p>동시에 여러 서버가 실행해도 한 곳만 정리하도록 잠금을 둡니다. 실패하면 다음 실행에서 다시 시도합니다.</p></article></div>
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
