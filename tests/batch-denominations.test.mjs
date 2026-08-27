import assert from "node:assert/strict";
import test from "node:test";

import {
  DENOMINATION_MANIFEST,
  DEFAULT_MANIFEST_ORDER,
  standardizeRecord,
  dedupeRecords,
  createProgressTracker,
  isDenominationCompleteInCheckpoint,
  parseKmcChurchHtml,
  parseSalvationArmyJson,
  parseAnglicanChurchHtml,
  discoverAnglicanLinks,
} from "../scripts/batch-register-remaining-denominations.mjs";

test("manifest classifies all 13 denominations deterministically", () => {
  assert.equal(DENOMINATION_MANIFEST.length, 13);
  assert.equal(DEFAULT_MANIFEST_ORDER.length, 13);

  // 1. 4개 공식 수집 가능 교단
  const available = DENOMINATION_MANIFEST.filter((d) => d.status === "available");
  assert.equal(available.length, 4);
  assert.deepEqual(
    available.map((d) => d.id),
    ["tonghap", "kmc", "salvation", "anglican"]
  );

  // 2. 4개 로그인 필수 차단 교단
  const loginRequired = DENOMINATION_MANIFEST.filter(
    (d) => d.status === "blocked" && d.blockerReason === "login_required"
  );
  assert.equal(loginRequired.length, 4);
  assert.deepEqual(
    loginRequired.map((d) => d.id),
    ["kehc", "kbch", "agk", "baekseok"]
  );

  // 3. 5개 전수 공개 명부 부재 차단 교단
  const unavailable = DENOMINATION_MANIFEST.filter(
    (d) => d.status === "blocked" && d.blockerReason === "public_complete_directory_unavailable"
  );
  assert.equal(unavailable.length, 5);
  assert.deepEqual(
    unavailable.map((d) => d.id),
    ["hapshin", "daeshin", "yehc", "nazarene", "bokum"]
  );

  // 모든 교단이 필수 메타데이터를 보유하는지 검증
  for (const item of DENOMINATION_MANIFEST) {
    assert.ok(item.id, "id 필수");
    assert.ok(item.name, "name 필수");
    assert.ok(item.status, "status 필수");
    assert.ok(item.officialSite, "officialSite 필수");
    assert.ok(item.officialDirectoryUrl, "officialDirectoryUrl 필수");
    assert.ok(item.provenance, "provenance 필수");
    if (item.status === "blocked") {
      assert.ok(item.blockerReason, "blockerReason 필수");
      assert.ok(item.blockerNote, "blockerNote 필수");
    }
  }
});

test("standardizes church records and excludes private contact fields", () => {
  const sample = standardizeRecord({
    denomination: "기독교대한감리회",
    denominationId: "kmc",
    name: "정동제일",
    rawName: "정동제일",
    pastor: "천영태",
    address: "서울특별시 중구 정동길 46",
    region: null,
    homepage: "http://chungdong.org",
    officialSourceUrl: "https://his.kmc.or.kr/address/church",
    presbytery: "서울연회 종로지방",
  });

  assert.equal(sample.denomination, "기독교대한감리회");
  assert.equal(sample.name, "정동제일교회");
  assert.equal(sample.pastor, "천영태 목사");
  assert.equal(sample.region, "서울 중구");
  assert.equal(sample.homepage, "http://chungdong.org/");
  assert.equal(sample.homepageStatus, "unverified");
  assert.equal(sample.officialSourceUrl, "https://his.kmc.or.kr/address/church");
  assert.ok(sample.recordKey.startsWith("kmc-"));

  // 비공개 개인정보(전화·팩스·이메일·우편번호) 필드가 출력 객체에 없어야 함
  assert.equal(sample.phone, undefined);
  assert.equal(sample.tel, undefined);
  assert.equal(sample.fax, undefined);
  assert.equal(sample.email, undefined);
  assert.equal(sample.postalCode, undefined);
});

test("deduplicates deterministically without merging different denominations", () => {
  const records = [
    // 통합 중앙교회
    standardizeRecord({
      denomination: "대한예수교장로회 통합",
      denominationId: "tonghap",
      name: "중앙교회",
      pastor: "김목사",
      address: "서울 종로구 123",
      region: "서울 종로",
      homepage: null,
      officialSourceUrl: "https://www.pck.or.kr",
    }),
    // 통합 중앙교회 (중복, 홈페이지 추가)
    standardizeRecord({
      denomination: "대한예수교장로회 통합",
      denominationId: "tonghap",
      name: "중앙교회",
      pastor: "김목사",
      address: "서울 종로구 123",
      region: "서울 종로",
      homepage: "https://jungang-tonghap.org",
      officialSourceUrl: "https://www.pck.or.kr",
    }),
    // 감리회 중앙교회 (동명·동주소이지만 교단이 다르므로 절대 병합되지 않아야 함)
    standardizeRecord({
      denomination: "기독교대한감리회",
      denominationId: "kmc",
      name: "중앙교회",
      pastor: "이목사",
      address: "서울 종로구 123",
      region: "서울 종로",
      homepage: "https://jungang-kmc.org",
      officialSourceUrl: "https://his.kmc.or.kr",
    }),
  ];

  const deduped = dedupeRecords(records);
  assert.equal(deduped.length, 2, "통합 1건, 감리회 1건으로 2건 유지");

  const tonghapChurch = deduped.find((r) => r.denomination === "대한예수교장로회 통합");
  assert.ok(tonghapChurch);
  assert.equal(tonghapChurch.homepage, "https://jungang-tonghap.org/");

  const kmcChurch = deduped.find((r) => r.denomination === "기독교대한감리회");
  assert.ok(kmcChurch);
  assert.equal(kmcChurch.homepage, "https://jungang-kmc.org/");
});

test("tracks progress exactly at every 100 processed records and prefixes with [HH:MM KST · G]", () => {
  const logs = [];
  const tracker = createProgressTracker({
    actorTag: "G",
    logger: (msg) => logs.push(msg),
  });

  tracker.onDenominationStart("기독교대한감리회", "https://his.kmc.or.kr/address/church");
  assert.equal(logs.length, 1);
  assert.match(logs[0], /^\[\d{2}:\d{2} KST · G\] \[기독교대한감리회\] 수집 시작:/);

  // 1~99건 추가: 100건 알림은 아직 발생하지 않아야 함
  for (let i = 1; i <= 99; i += 1) {
    tracker.onRecord("기독교대한감리회");
  }
  assert.equal(logs.length, 1, "99건까지는 100건 알림 미발생");

  // 100번째 레코드: 정확히 100건 알림 발생
  tracker.onRecord("기독교대한감리회");
  assert.equal(logs.length, 2);
  assert.match(logs[1], /^\[\d{2}:\d{2} KST · G\] \[기독교대한감리회\] 100건 수집 완료/);

  // 101~199건 추가: 알림 유지
  for (let i = 101; i <= 199; i += 1) {
    tracker.onRecord("기독교대한감리회");
  }
  assert.equal(logs.length, 2);

  // 200번째 레코드: 정확히 200건 알림 발생
  tracker.onRecord("기독교대한감리회");
  assert.equal(logs.length, 3);
  assert.match(logs[2], /^\[\d{2}:\d{2} KST · G\] \[기독교대한감리회\] 200건 수집 완료 \(해당 교단 200건 \/ 전체 누적 200건\)/);

  tracker.onDenominationComplete("기독교대한감리회", 200);
  assert.equal(logs.length, 4);
  assert.match(logs[3], /^\[\d{2}:\d{2} KST · G\] \[기독교대한감리회\] 처리 완료: status=completed, count=200/);

  tracker.onDenominationBlocked("기독교대한성결교회", "login_required", "로그인 필수");
  assert.equal(logs.length, 5);
  assert.match(logs[4], /^\[\d{2}:\d{2} KST · G\] \[기독교대한성결교회\] 차단 확인: status=blocked, reason=login_required/);

  // 다음 교단 시작 시 denominationProcessed 리셋 및 누적 totalProcessed 유지 검증
  tracker.onDenominationStart("대한성공회", "https://anglicankr.church");
  for (let i = 1; i <= 100; i += 1) {
    tracker.onRecord("대한성공회");
  }
  assert.equal(logs.length, 7);
  assert.match(logs[6], /^\[\d{2}:\d{2} KST · G\] \[대한성공회\] 100건 수집 완료 \(해당 교단 100건 \/ 전체 누적 300건\)/);
});

test("parses official 10-column KMC HIS live table format with checkbox, counts, and exclusions", () => {
  const officialHtml = `
    <table class="table table-hover">
      <thead>
        <tr>
          <th><input type="checkbox" id="check_all"></th>
          <th>연회</th>
          <th>지방</th>
          <th>교회 (소속목회자)</th>
          <th>담임</th>
          <th>전화</th>
          <th>주소</th>
          <th>홈페이지</th>
          <th>설립일</th>
          <th>비고</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><input type="checkbox" name="chk[]" value="1"></td>
          <td>서울</td>
          <td>종로</td>
          <td>중앙 (13)</td>
          <td>이형노</td>
          <td>02-730-6711</td>
          <td>03162 서울시 종로구 인사동 5길 25(인사동)</td>
          <td>http://central21.org</td>
          <td>1890-10-12</td>
          <td></td>
        </tr>
        <tr>
          <td><input type="checkbox" name="chk[]" value="2"></td>
          <td>서울</td>
          <td>종로</td>
          <td>소속없음 (3)</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
        <tr>
          <td><input type="checkbox" name="chk[]" value="3"></td>
          <td>서울</td>
          <td>종로</td>
          <td>정동제일 (5)</td>
          <td>천영태</td>
          <td>02-753-0001</td>
          <td>04518 서울특별시 중구 정동길 46</td>
          <td>http://chungdong.org</td>
          <td>1885-10-11</td>
          <td></td>
        </tr>
        <tr>
          <td><input type="checkbox" name="chk[]" value="4"></td>
          <td>중부</td>
          <td>인천동</td>
          <td>인천제일 (8)</td>
          <td>이제일</td>
          <td>032-123-4567</td>
          <td>21556 인천광역시 남동구 만수동 100</td>
          <td><a href="http://incheonjeil.org">http://incheonjeil.org</a></td>
          <td>1950-05-01</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  `;

  const parsed = parseKmcChurchHtml(officialHtml, "https://his.kmc.or.kr/address/church?search_ac=1&page=1");
  assert.equal(parsed.length, 3, "소속없음 행은 제외되어 3건만 파싱됨");

  // 1. 중앙교회: 꼬리 소속인원 (13) 제거 및 '교회' 정규화, 주소 우편번호 처리 및 서울 종로 지역 매핑, 일반 텍스트 홈페이지 추출
  assert.equal(parsed[0].name, "중앙교회");
  assert.equal(parsed[0].rawName, "중앙");
  assert.equal(parsed[0].pastor, "이형노 목사");
  assert.equal(parsed[0].address, "03162 서울시 종로구 인사동 5길 25(인사동)");
  assert.equal(parsed[0].region, "서울 종로");
  assert.equal(parsed[0].homepage, "http://central21.org/");
  assert.equal(parsed[0].presbytery, "서울연회 종로지방");

  // 2. 정동제일교회
  assert.equal(parsed[1].name, "정동제일교회");
  assert.equal(parsed[1].rawName, "정동제일");
  assert.equal(parsed[1].pastor, "천영태 목사");
  assert.equal(parsed[1].address, "04518 서울특별시 중구 정동길 46");
  assert.equal(parsed[1].region, "서울 중구");
  assert.equal(parsed[1].homepage, "http://chungdong.org/");
  assert.equal(parsed[1].presbytery, "서울연회 종로지방");

  // 3. 인천제일교회: 중부연회 인천동지방, 링크 태그 내 홈페이지 추출
  assert.equal(parsed[2].name, "인천제일교회");
  assert.equal(parsed[2].rawName, "인천제일");
  assert.equal(parsed[2].pastor, "이제일 목사");
  assert.equal(parsed[2].address, "21556 인천광역시 남동구 만수동 100");
  assert.equal(parsed[2].region, "인천 남동");
  assert.equal(parsed[2].homepage, "http://incheonjeil.org/");
  assert.equal(parsed[2].presbytery, "중부연회 인천동지방");

  // 소속없음 및 비어있는 레코드 완전 배제 검증
  assert.ok(parsed.every((r) => !r.name.includes("소속없음")));
  assert.ok(parsed.every((r) => r.name !== ""));
});

test("parses compact 5-column KMC church table variant correctly", () => {
  const compactHtml = `
    <table class="table">
      <thead>
        <tr><th>연회/지방</th><th>교회명</th><th>담임자</th><th>주소</th><th>전화</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>서울연회 종로지방</td>
          <td>정동제일교회</td>
          <td>천영태</td>
          <td>서울특별시 중구 정동길 46</td>
          <td>02-753-0001</td>
        </tr>
        <tr>
          <td>중부연회 인천동지방</td>
          <td><a href="http://incheonjeil.org">인천제일교회</a></td>
          <td>이제일</td>
          <td>인천광역시 남동구 만수동 100</td>
          <td>032-123-4567</td>
        </tr>
      </tbody>
    </table>
  `;

  const parsed = parseKmcChurchHtml(compactHtml, "https://his.kmc.or.kr/address/church");
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].name, "정동제일교회");
  assert.equal(parsed[0].pastor, "천영태 목사");
  assert.equal(parsed[0].region, "서울 중구");
  assert.equal(parsed[0].presbytery, "서울연회 종로지방");

  assert.equal(parsed[1].name, "인천제일교회");
  assert.equal(parsed[1].pastor, "이제일 목사");
  assert.equal(parsed[1].region, "인천 남동");
  assert.equal(parsed[1].homepage, "http://incheonjeil.org/");
  assert.equal(parsed[1].presbytery, "중부연회 인천동지방");
});

test("invariant: distinct official KMC rows do not collapse to conference names", () => {
  const multiConferenceHtml = `
    <table>
      <thead>
        <tr>
          <th>체크</th><th>연회</th><th>지방</th><th>교회 (소속목회자)</th><th>담임</th><th>전화</th><th>주소</th><th>홈페이지</th><th>설립일</th><th>비고</th>
        </tr>
      </thead>
      <tbody>
        <tr><td></td><td>서울</td><td>종로</td><td>중앙 (13)</td><td>이형노</td><td>02-730-6711</td><td>03162 서울시 종로구 인사동 5길 25(인사동)</td><td>http://central21.org</td><td>1890-10-12</td><td></td></tr>
        <tr><td></td><td>서울</td><td>종로</td><td>정동제일 (5)</td><td>천영태</td><td>02-753-0001</td><td>04518 서울특별시 중구 정동길 46</td><td>http://chungdong.org</td><td>1885-10-11</td><td></td></tr>
        <tr><td></td><td>서울</td><td>중구용산</td><td>상동 (7)</td><td>김상동</td><td>02-755-1234</td><td>04527 서울시 중구 남대문로 30</td><td></td><td>1888-10-09</td><td></td></tr>
        <tr><td></td><td>서울</td><td>성동광진</td><td>꽃재 (10)</td><td>김성동</td><td>02-2292-1234</td><td>04702 서울시 성동구 하왕십리동 966</td><td></td><td>1905-04-01</td><td></td></tr>
        <tr><td></td><td>중부</td><td>인천동</td><td>인천제일 (8)</td><td>이제일</td><td>032-123-4567</td><td>21556 인천광역시 남동구 만수동 100</td><td>http://incheonjeil.org</td><td>1950-05-01</td><td></td></tr>
        <tr><td></td><td>중부</td><td>강화북</td><td>교산 (4)</td><td>박강화</td><td>032-932-1234</td><td>23001 인천광역시 강화군 양사면 교산리 100</td><td></td><td>1893-05-10</td><td></td></tr>
        <tr><td></td><td>경기</td><td>수원영통</td><td>수원성 (6)</td><td>안경기</td><td>031-200-1234</td><td>16675 경기도 수원시 영통구 매영로 100</td><td></td><td>1970-03-01</td><td></td></tr>
        <tr><td></td><td>경기</td><td>안양</td><td>안양 (9)</td><td>최안양</td><td>031-440-1234</td><td>14000 경기도 안양시 만안구 안양로 200</td><td></td><td>1960-06-01</td><td></td></tr>
        <tr><td></td><td>서울</td><td>종로</td><td>소속없음 (3)</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      </tbody>
    </table>
  `;

  const parsed = parseKmcChurchHtml(multiConferenceHtml, "https://his.kmc.or.kr/address/church");
  assert.equal(parsed.length, 8, "소속없음 행 제외 후 8곳 정상 파싱");

  const churchNames = parsed.map((r) => r.name);
  const distinctNames = new Set(churchNames);

  // 불변식 1: 파싱된 레코드 수가 고유 교회명 수와 일치 (교단/연회명으로 붕괴되지 않음)
  assert.equal(distinctNames.size, 8);

  // 불변식 2: 연회명이 교회명으로 오인되지 않음 (서울교회, 중부교회, 경기교회 등 연회명 오인 없음)
  assert.ok(!distinctNames.has("서울연회교회"));
  assert.ok(!distinctNames.has("중부연회교회"));
  assert.ok(!distinctNames.has("경기연회교회"));
  assert.ok(!distinctNames.has("서울교회"));
  assert.ok(!distinctNames.has("중부교회"));
  assert.ok(!distinctNames.has("경기교회"));

  // 불변식 3: 실제 교회명이 정상 보존됨
  assert.ok(distinctNames.has("중앙교회"));
  assert.ok(distinctNames.has("정동제일교회"));
  assert.ok(distinctNames.has("상동교회"));
  assert.ok(distinctNames.has("꽃재교회"));
  assert.ok(distinctNames.has("인천제일교회"));
  assert.ok(distinctNames.has("교산교회"));
  assert.ok(distinctNames.has("수원성교회"));
  assert.ok(distinctNames.has("안양교회"));

  // 불변식 4: dedupeRecords 통과 후에도 8건 모두 고유하게 보존됨
  const deduped = dedupeRecords(parsed);
  assert.equal(deduped.length, 8);
});

test("parses Salvation Army organization JSON filtering category 16", () => {
  const samplePayload = {
    data: [
      {
        id: 101,
        categoryId: 16,
        categoryName: "영문(교회)",
        name: "서울영문",
        leader: "천영호",
        address: "서울특별시 중구 덕수궁길 130",
        homepage: "https://salvationarmy.kr/seoul",
      },
      {
        id: 102,
        categoryId: 20,
        categoryName: "복지시설",
        name: "구세군후생원",
        leader: "김원장",
        address: "서울 서대문구 50",
      },
      {
        id: 103,
        categoryId: 16,
        categoryName: "영문(교회)",
        name: "부산영문",
        leader: "박사관",
        address: "부산광역시 동구 초량동 200",
        homepage: null,
      },
      {
        id: 104,
        categoryId: 16,
        categoryName: "영문(교회)",
        name: "대구영문",
        leader: "홍길동 사관",
        address: "대구광역시 중구 동성로 10",
        homepage: null,
      },
      {
        id: 105,
        categoryId: 16,
        categoryName: "영문(교회)",
        name: "대전영문",
        leader: "홍길동 목사",
        address: "대전광역시 중구 중앙로 20",
        homepage: null,
      },
    ],
  };

  const parsed = parseSalvationArmyJson(samplePayload, "https://api.thesalvationarmy.or.kr/api/user/organization");
  assert.equal(parsed.length, 4, "복지시설(categoryId=20)은 제외되고 영문(교회) 4건만 파싱됨");
  assert.equal(parsed[0].name, "서울영문");
  assert.equal(parsed[0].pastor, "천영호 사관");
  assert.equal(parsed[0].region, "서울 중구");
  assert.equal(parsed[0].homepage, "https://salvationarmy.kr/seoul");

  assert.equal(parsed[1].name, "부산영문");
  assert.equal(parsed[1].pastor, "박사관 사관");
  assert.equal(parsed[1].region, "부산 동구");

  assert.equal(parsed[2].name, "대구영문");
  assert.equal(parsed[2].pastor, "홍길동 사관");

  assert.equal(parsed[3].name, "대전영문");
  assert.equal(parsed[3].pastor, "홍길동 목사");
});

test("discovers Anglican links and parses church table", () => {
  const rootHtml = `
    <html>
      <body>
        <nav>
          <a href="/seoul-diocese">전국 교회 주소록 (서울교구)</a>
          <a href="/daejeon-diocese">교구 기관 단체 (대전교구)</a>
          <a href="https://other.com/ext">외부 링크</a>
        </nav>
      </body>
    </html>
  `;

  const links = discoverAnglicanLinks(rootHtml, "https://anglicankr.church");
  assert.equal(links.length, 2);
  assert.ok(links.includes("https://anglicankr.church/seoul-diocese"));
  assert.ok(links.includes("https://anglicankr.church/daejeon-diocese"));

  const parishHtml = `
    <table>
      <thead><tr><th>성당명</th><th>관할사제</th><th>주소</th></tr></thead>
      <tbody>
        <tr>
          <td>서울주교좌성당</td>
          <td>주낙현</td>
          <td>서울특별시 중구 세종대로21길 15</td>
        </tr>
      </tbody>
    </table>
  `;

  const parsed = parseAnglicanChurchHtml(parishHtml, "https://anglicankr.church/seoul-diocese");
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].name, "서울주교좌성당");
  assert.equal(parsed[0].pastor, "주낙현 신부");
  assert.equal(parsed[0].region, "서울 중구");
});

test("checkpoint state identifies completed and blocked denominations", () => {
  const checkpoint = {
    version: 1,
    denominations: {
      tonghap: { id: "tonghap", stage: "completed", status: "completed", recordCount: 8500 },
      kehc: { id: "kehc", stage: "blocked", status: "blocked", recordCount: 0 },
      kmc: { id: "kmc", stage: "error", status: "error", recordCount: 0 },
    },
  };

  assert.equal(isDenominationCompleteInCheckpoint(checkpoint, "tonghap"), true);
  assert.equal(isDenominationCompleteInCheckpoint(checkpoint, "kehc"), true);
  assert.equal(isDenominationCompleteInCheckpoint(checkpoint, "kmc"), false);
  assert.equal(isDenominationCompleteInCheckpoint(checkpoint, "salvation"), false);
});
