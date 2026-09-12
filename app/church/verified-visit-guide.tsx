type Props = { publicId: number; region: string; denomination: string };

type LocalGuide = {
  publicId: number; region: string; denomination: string; name: string;
  address: string; phone: string; telephone: string; directions: string;
  transit?: string[]; newcomers?: { url: string; description: string };
};
const localGuides: LocalGuide[] = [
  {
    publicId: 11737, region: "서울서대문", denomination: "기독교대한감리회", name: "아현중앙교회",
    address: "서울특별시 서대문구 신촌로29길 11", phone: "02-363-1452~4", telephone: "02-363-1452",
    directions: "https://ajmc.or.kr/Page/Index/85",
    transit: ["2호선 아현역 1번 출구에서 약 500m 도보", "2호선 이대역 4번 출구에서 약 600m 도보", "웨딩타운 정류장에서 약 200m 도보"],
    newcomers: { url: "https://ajmc.or.kr/Page/Index/34", description: "교회 소개와 신앙의 교제를 나누고, 5주 교육 후 공동체를 안내합니다." },
  },
  {
    publicId: 10153, region: "강원동해", denomination: "기독교대한감리회", name: "동해교회",
    address: "강원도 동해시 평릉1길 6", phone: "033-532-3123", telephone: "033-532-3123",
    directions: "https://www.dhchurch.net/Page/Index/196",
  },
];

const chapels = [
  {
    name: "분당채플",
    address: "경기도 성남시 분당구 미금일로 154번길 6",
    phone: "031-710-9300",
    directions: "https://www.jiguchon.or.kr/contents.php?gr=2&page=11",
    parking: "https://www.jiguchon.or.kr/contents.php?gr=2&page=20",
    welcomeRoom: "8층 811호 VIP영접실",
  },
  {
    name: "수지채플",
    address: "경기도 용인시 수지구 신봉1로 48번길 48",
    phone: "031-264-9191",
    directions: "https://www.jiguchon.or.kr/contents.php?gr=2&page=10",
    parking: "https://www.jiguchon.or.kr/contents.php?gr=2&page=19",
    welcomeRoom: "4층 406호 VIP영접실",
  },
] as const;

export default function VerifiedVisitGuide({ publicId, region, denomination }: Props) {
  const local = localGuides.find(guide => guide.publicId === publicId && guide.region === region.replace(/\s/g, "") && guide.denomination === denomination.replace(/\s/g, ""));
  if (local) return <section className="church-detail-content church-personalized" aria-labelledby="verified-visit-title">
    <div className="section-heading"><div><span className="section-kicker">공식 홈페이지에서 확인</span><h2 id="verified-visit-title">첫 방문 안내</h2><p>예배시간과 장소를 확인하고 공식 오시는 길을 참고해 주세요.</p></div></div>
    <div className="church-personalized-grid single"><article className="church-profile-card"><span className="church-card-symbol" aria-hidden="true">방문</span><div>
      <h3>{local.name}</h3><dl>
        <div><dt>주소</dt><dd>{local.address}</dd></div>
        <div><dt>대표전화</dt><dd><a href={`tel:${local.telephone}`}>{local.phone}</a></dd></div>
        <div><dt>오시는 길</dt><dd><a href={local.directions} target="_blank" rel="noopener noreferrer">공식 오시는 길·지도 안내 ↗</a></dd></div>
        {local.transit && <div><dt>대중교통</dt><dd>{local.transit.map(line => <p key={line}>{line}</p>)}</dd></div>}
        {local.newcomers && <div><dt>새가족</dt><dd>{local.newcomers.description}{" "}<a href={local.newcomers.url} target="_blank" rel="noopener noreferrer">공식 새가족 안내 ↗</a></dd></div>}
      </dl>
    </div></article></div>
    <p className="church-visit-note">주차와 방문 접수에 관한 사항은 교회 공식 창구에서 확인해 주세요.</p>
    <p className="church-profile-reviewed">공식 안내 확인일: <time dateTime="2026-09-12">2026-09-12</time></p>
  </section>;
  // These official sources identify the Seongnam Baptist church only.
  if (publicId !== 10017 || region.replace(/\s/g, "") !== "경기성남" || denomination.replace(/\s/g, "") !== "기독교한국침례회") return null;

  return <section className="church-detail-content church-personalized" aria-labelledby="verified-visit-title">
    <div className="section-heading"><div>
      <span className="section-kicker">공식 홈페이지에서 확인</span>
      <h2 id="verified-visit-title">첫 방문 안내</h2>
      <p>참석할 예배의 채플을 먼저 확인해 주세요.</p>
    </div></div>
    <div className="church-personalized-grid">
      {chapels.map(chapel => <article className="church-profile-card" key={chapel.name}>
        <span className="church-card-symbol" aria-hidden="true">방문</span>
        <div>
          <h3>{chapel.name}</h3>
          <dl>
            <div><dt>주소</dt><dd>{chapel.address}</dd></div>
            <div><dt>대표전화</dt><dd><a href={`tel:${chapel.phone}`}>{chapel.phone}</a></dd></div>
            <div><dt>교통</dt><dd><a href={chapel.directions} target="_blank" rel="noopener noreferrer">공식 오시는 길 ↗</a></dd></div>
            <div><dt>주차</dt><dd><a href={chapel.parking} target="_blank" rel="noopener noreferrer">공식 주차 안내 ↗</a></dd></div>
            <div><dt>새가족</dt><dd>예배 후 {chapel.welcomeRoom}</dd></div>
          </dl>
        </div>
      </article>)}
    </div>
    <p className="church-visit-note">주차 가능 장소와 무료 이용 조건은 요일·예배에 따라 다릅니다. 방문 전 공식 안내를 확인해 주세요.</p>
    <p className="church-visit-note">
      <a href="https://www.jiguchon.or.kr/greetings.php" target="_blank" rel="noopener noreferrer">공식 첫 방문 안내 ↗</a>
      {" · "}<a href="https://www.jiguchon.or.kr/greetings.php#vipInfo" target="_blank" rel="noopener noreferrer">공식 새가족 안내 ↗</a>
    </p>
    <p className="church-profile-reviewed">공식 안내 확인일: <time dateTime="2026-09-12">2026-09-12</time></p>
  </section>;
}
