type Props = { publicId: number; region: string; denomination: string };

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
