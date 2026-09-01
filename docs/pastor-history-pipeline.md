# 목사 공개 이력 수집 파이프라인

이 파이프라인은 공식 공개 페이지에서 사전에 정의한 짧은 사실을 확인해 `pending` 기록으로 만드는 검토 우선 도구다. 모든 수집 결과는 기본적으로 `dryRun: true`, `published: false`이며 자동 공개하지 않는다. 사람이 정확한 산출물 해시와 전체 사건을 승인한 뒤에도 별도 관리자 업로드와 같은 해시 재확인을 거쳐야 운영 DB에 반영된다.

## 수집 경계

- 허용: 교회·교단·노회·신학교의 공식 공개 페이지, 공식 홈페이지에서 소유 관계가 확인되는 YouTube 채널
- 차단: 로그인·회원·마이페이지·관리자 경로, 개인 SNS·블로그·카페, 로컬·사설 주소, 개별 YouTube 영상이나 검색 결과
- 이력·공개 출력에서 제외: 전화·이메일·상세 주소, 가족관계, 생년월일, 건강·병력, 계좌·고유식별정보 등 민감하거나 사적인 정보
- 저장: 짧은 사실 요약, 사건 종류, 직책, 기관, 가능한 시작·종료일, 공식 출처 URL, 확인일, 신뢰도, 검토 상태
- 미저장: 원문 HTML과 원문 인용. 캐시에는 본문 해시와 판정 결과만 남는다.

사실 요약이 출처 본문의 문장과 그대로 일치하면 파이프라인이 거부한다. 요약은 사실관계만 짧게 재서술해야 한다.

모든 roster·collection·import-plan 산출물은 `metadata.privacyScan`을 포함한다. 원문은 저장하지 않으며, 사실 요약 전체에 이메일·계좌·개인 연락처·상세 주소·가족관계 등 금지 정보가 하나라도 감지되면 `passed` 산출물을 만들지 않고 중단한다.

공식 교회·교단 페이지에 공개된 교역자 이메일·전화번호·계좌번호도 공개 이력 산출물이나 일반 수집 캐시에는 한 글자도 넣지 않는다. 검증된 후보는 별도 관리자 입력 파일 `out/pastor-history/admin-contact-candidates.json`에만 저장한다. 각 후보의 필수 필드는 `churchId`, `type`(`email`, `phone`, `account`), `value`, `scope: official_role`, 공식 `sourceUrl`이다. 추가로 `reviewStatus: pending`, `visibility: admin_only`, `revealPolicy: masked_audited`, `publicationEligible: false`를 붙인다. 운영 DB와 암호화 키는 이 파이프라인이 다루지 않으며, 팀장이 후보를 승인한 뒤 운영 암호화 입력 절차를 별도로 수행한다. 개인 SNS나 비공식 출처의 연락정보는 후보가 될 수 없다.

동명이인 방지를 위해 각 출처에서 목사 이름·교회명·교단·지역·역할 다섯 축을 확인한다. 공식 교회·교단·노회 공개 페이지 한 곳에서 이름·교회·직책이 함께 확인되면 기본 후보 근거로 충분하다. 동명이인 가능성이 있거나 직책·기간이 충돌할 때만 두 번째 공식 출처를 요구한다. 한 축이라도 빠지거나 충돌이 해결되지 않으면 이력은 비워 두고 보류 사유만 기록한다. 근거가 약해 빈 결과가 되는 것은 정상적인 성공이다.

한 공식 페이지에 다섯 축이 모두 적혀 있지 않으면 `identityEvidenceMode: complementary`를 명시할 수 있다. 이때는 이름·교회·직책을 함께 확인한 공식 페이지와 교단·지역을 확인한 별도 공식 페이지를 합쳐 다섯 축을 모두 충족해야 한다. 이력 사건은 반드시 이름·교회·직책을 함께 확인한 출처에서만 만들며, 보조 페이지 단독으로 인물 이력을 생성하지 않는다.

## 전국 대상 선정

전국 목회자 검색부터 시작하지 않는다. [`selection-policy.json`](../data/pastor-history/selection-policy.json)에 따라 airChurch에서 이미 검토 승인된 국내 교회를 기준점으로 삼는다. 공식 출처에서 확인되는 담임·위임·대표·부·교육·협동·원로·은퇴목사를 각각 별도 후보로 다룬다. 교회 명부와 무관한 초청 설교자·행사 강사를 이름만으로 새 인물 후보로 자동 생성하지는 않는다. 다만 이미 교회 및 역할과 연결되어 검증된 목회자가 다른 교회에서 설교·집회·세미나를 한 공식 기록은 별도 `ministry_appearance` 이력으로 연결할 수 있다. 국내 범위는 서울부터 제주까지 17개 시·도 접두어로 제한하며 해외 지역은 별도 보류한다.

교회 명부의 단일 `pastor` 값은 현재 주된 목회자 후보를 만드는 단서일 뿐 직책의 증거가 아니다. 추가 역할은 `pastors` 배열에 이름·직책·current/former 상태·가능한 시작/종료일을 별도 행으로 제공한다. 담임·위임·대표뿐 아니라 부·수석부·행정·목양·교육목사, 강도사, 전임·교육전도사, 전도사, 협동·원로·은퇴 교역자를 한 교회에 여러 명 연결할 수 있다. 명부 주장은 `roleTitleClaim`, `roleStatusClaim`, `startDateClaim`, `endDateClaim`으로만 보존하며 공식 출처 검토 전에는 항상 `needs_source_curation`, `confidence: unverified`, `publicationEligible: false`다.

역할은 `current_primary`, `associate`, `education`, `cooperating`, `emeritus`, `retired`로 나눈다. 같은 사람이 여러 역할을 가졌으면 역할·기관·기간·current/former 상태별로 별도 레코드를 만든다. 승계나 재직 기간은 추정하지 않는다. 모든 역할의 `searchPriorityWeight`와 `publicationPriorityWeight`는 동일한 1이며, 담임목사라는 이유로 더 높은 검색·공개 우선순위를 주지 않는다.

현재 교회 명부가 단일 `pastor`만 제공해도 승인 교회마다 `roleDiscoveryQueue`가 생성된다. 이 후속 큐는 공식 교역자·섬기는 사람들·연혁 페이지에서 부·교육·협동·원로·은퇴목사를 찾도록 안내한다. 발견한 인물은 추측해서 합치지 않고 `pastors` 배열의 별도 역할 행으로 되돌려 검증한다.

대상 큐 입력은 배열을 `items` 또는 `records`에 담는다. 각 행에 `reviewStatus: "approved"`가 있어야 한다. 공개 API처럼 행별 상태가 생략된 승인 전용 내보내기라면 최상위에 `metadata.approvedOnly: true`를 명시해야 한다.

```json
{
  "metadata": { "approvedOnly": true },
  "items": [
    {
      "id": 1,
      "name": "교회명",
      "pastor": "이름 목사",
      "region": "지역",
      "denomination": "교단",
      "homepageUrl": "https://official.example/",
      "youtubeChannelId": "UC...",
      "pastors": [
        { "name": "이름", "role": "부목사", "status": "current", "startDate": "2024" },
        { "name": "이름", "role": "은퇴목사", "status": "former", "endDate": "2020-12-31" }
      ]
    }
  ]
}
```

전화·이메일·상세 주소 같은 필드가 입력에 섞여 있어도 대상 큐로 복사하지 않는다. 공식 공개 홈페이지가 없거나 한 필드에 여러 사람이 들어 있으면 자동 분해·추측하지 않고 보류한다.

HTTP 공식 홈페이지도 후보에서 제외하지 않는다. 공개 사실을 GET으로 읽는 용도로만 허용하며 `transportWarning: "unencrypted_transport"`, `transportReview: "required"`로 표시한다. 로그인, 폼 제출, 쿠키·자격정보·개인정보 전송은 하지 않는다. 각 산출물에는 `httpSourceCount`와 전체 `transportReview` 결과가 포함된다.

## 출처 등록

[`data/pastor-history/sample-sources.json`](../data/pastor-history/sample-sources.json)은 공식 출처가 명확한 소수 교회만 담은 보수적 샘플이다. 새 출처를 추가할 때는 다음을 함께 검토한다.

1. `sites`에 공식 호스트, 허용 경로, 허용 출처 유형, 정책 확인일, 요청 간격을 등록한다.
2. `subjects[].identity`에 이름·교회·교단·지역을, `subjects[].role`에 역할 범주·직책·current/former 상태를 적고 각 출처의 `identityEvidence`로 다섯 축을 검증한다.
3. `assertions`에는 160자 이하의 자체 작성 사실 요약과 이를 확인할 최소 검색어만 넣는다. 날짜를 알 수 없으면 `null`로 둔다.
4. YouTube는 채널 URL만 허용한다. 같은 subject의 공식 비-YouTube 출처가 해당 채널로 직접 링크해야 하며 `ownershipEvidenceUrl`에 그 출처 URL을 지정한다.
5. 사이트 정책이 불명확하거나 robots.txt를 확인할 수 없으면 `collectionAllowed`를 켜지 않는다.

샘플의 사실 문장은 원문 복제가 아니라 확인 가능한 직책·날짜를 짧게 재서술한 것이다. 샘플 URL과 정책 확인일은 정기적으로 사람이 다시 검토한다.

## 실행

```bash
npm run pastor-history:roster -- --input approved-church-export.json
npm run pastor-history:collect
npm run pastor-history:import:dry-run -- --approval-template out/pastor-history/approval.json
```

첫 명령은 승인 교회에서 1단계 대상 큐를 만들 뿐 네트워크나 DB에 접근하지 않는다. 결과는 `out/pastor-history/roster.json`이며, 사람이 각 후보의 공식 출처와 짧은 사실 주장을 source manifest에 추가해야 한다.

공식 홈페이지가 아직 등록되지 않은 교회도 ID·교회명·대표 교역자 후보와 동일 우선순위를 유지한다. 이 경우 `transportReview: source_discovery_required`로 표시하고 교회·교단·노회의 공식 공개 출처 찾기를 후속 과제로 남긴다. 정보 부족 자체는 보류·감점·삭제 사유가 아니며 공식 확인 전에는 공개 이력만 비워 둔다.

전국용 source manifest는 `policy.pilotOnly`를 사용하지 않고 `policy.selectionPolicyId`를 roster와 같게 지정하며, 각 `subjects[].id`와 `identity`도 roster 후보와 정확히 같아야 한다. 전국 수집은 반드시 roster를 함께 전달한다.

```bash
npm run pastor-history:collect -- --manifest curated-sources.json --roster out/pastor-history/roster.json
```

roster가 없거나 후보 신원이 다르면 네트워크 요청 전에 중단한다. 기본 샘플 manifest만 `pilotOnly: true`이며 최대 10명까지 공식 출처 기능을 시험하는 용도다.

두 번째 명령은 robots.txt를 먼저 확인한 후 호스트별로 최소 2.5초 간격을 두고 순차 요청한다. 출처별 재수집 간격 전에는 원문 없는 로컬 캐시를 재사용한다. 공개 이력 검토 결과는 기본적으로 `out/pastor-history/collected.json`에, 관리자 입력 후보는 `out/pastor-history/admin-contact-candidates.json`에 별도로 생성된다. 경로를 바꾸려면 각각 `--output`, `--admin-contacts-output`을 사용한다. 공개 이력 JSON에는 관리자 연락처 배열이나 연락처 값이 존재하지 않는다.

전국 후보의 공식 출처 조사를 여러 검토자에게 나눌 때는 `npm run pastor-history:prepare-source-review`를 사용한다. 같은 교회 후보는 한 묶음에 유지하고 기본 25개 교회씩 나누며, 모든 결정과 공식 출처·추가 역할 입력칸은 빈 `pending` 상태로 시작한다. 후보 원문 해시가 함께 들어가므로 이름·교회·교단·지역·역할·검색 질의가 바뀐 결과는 후속 병합에서 그대로 신뢰해서는 안 된다.

돌아온 묶음은 `npm run pastor-history:merge-source-review`로 합친다. 후보 해시·전체 1,770명 수·중복·공식 HTTP(S) 출처 유형·식별축·검토 시각·메모·연락처 패턴을 다시 검사한다. 미검토가 남아 있으면 기본적으로 중단하며 진행 상황만 볼 때에만 `-- --allow-pending`을 붙인다. 병합 결과도 공식 출처 목록일 뿐 자동 수집·승인·공개를 시작하지 않는다.

병합이 완료되면 `npm run pastor-history:build-source-manifest`로 수집 manifest를 만든다. 이 단계는 검토자가 확정한 직책이 원래 후보의 허용 직책인지, 이름·교회·교단·지역이 roster와 완전히 같은지, 공식 출처별 사이트 정책과 허용 경로가 URL에 맞는지, 여러 출처가 다섯 식별축을 빠짐없이 덮는지 다시 확인한다. 미완료 진행 상황에서 빈 구조만 확인하려면 `-- --allow-partial`을 사용할 수 있지만 전국 수집 입력으로 취급하지 않는다.

기본 파일럿에서 보류 없이 공식 검증된 인물은 `npm run pastor-history:seed-verified-pilot`로 전국 검토 묶음에 옮길 수 있다. 이름·교회·교단이 정확히 일치하는 `pending` 후보만 한 번 갱신하며, 파일럿의 사이트 정책·식별 근거·사실 주장과 실제 수집 확인 시각을 그대로 보존한다.

외부 조사 결과는 `npm run pastor-history:apply-source-review -- --input <검토 JSON>`으로 반영한다. subject ID만 같아서는 안 되고 교회 ID·이름·교회·교단·지역·역할 분류가 모두 원본 후보와 일치해야 하며, 이미 결정된 항목은 완전히 같은 재실행만 허용한다. 반영 뒤에도 병합과 manifest 검증을 별도로 통과해야 한다.

출처 주장, 신원 정보, 호스트 정책 또는 파이프라인 판정 버전이 바뀌면 기존 캐시 키가 무효화되어 다시 확인한다. 따라서 오래된 판정이 수정된 정책을 우회하지 않는다.

세 번째 명령은 공개 이력 JSON만 받아 DB에 쓰지 않고 `out/pastor-history/import-plan.json`만 만든다. 관리자 연락처 후보 파일을 읽거나 포함하지 않는다. `--apply`, `--publish`, `--write-db`는 의도적으로 지원하지 않는다. 승인 템플릿은 승인서가 아니며 기본 결정값이 `pending`이다.

수집 대상별 검색은 이름 하나로 끝내지 않는다. 다음 네 갈래를 교회명·교단·지역과 함께 교차 검색하고, 공식 출처만 manifest에 등록한다.

- 신원·현재 역할: 교역자, 섬기는 사람들, 조직
- 이동·승계 이력: 개척, 부임, 사임, 은퇴, 원로 추대
- 외부 사역: 초청 설교, 특별 집회, 부흥회, 세미나
- 교단 이력: 교단·노회 공식 인사 및 연혁

사람이 모든 사실과 출처를 확인한 경우에만 승인 파일에 다음을 기록한다.

- `decision: "approved"`
- 실제 승인자 식별값 `approvedBy`
- ISO 8601 승인 시각 `approvedAt`
- importer가 만든 정확한 artifact digest와 전체 event ID 집합

그 후 아래처럼 다시 미리보기를 만들 수 있다.

```bash
npm run pastor-history:import:dry-run -- --approval out/pastor-history/approval.json
```

승인이 정확히 일치하면 이 도구는 `publicationEligible: true`인 계획과 `upsert_reviewed_ministry_profile`·`upsert_reviewed_ministry_appearance` 작업을 만든다. 이 단계의 DB 쓰기와 공개는 여전히 0건이다. 관리자가 `/admin`의 검토 자료 가져오기에서 해당 JSON을 선택하고, 표시된 작업 수와 SHA-256 해시를 다시 입력해야만 승인 레코드가 반영된다. 서버는 관리자 권한, 요청 출처, 최대 100개 작업, 50개 단위 배치, 승인 교회, 공식 HTTP(S) 출처, 민감정보 없음, 허용 역할·날짜를 다시 검사한다.

## 영상 연결 원칙

- 현재 담임목사의 교회 공식 채널 설교는 제목에 다른 목회자가 명시되지 않은 경우 그 담임목사의 영상으로 본다.
- 부·협동·원로·은퇴목사는 제목에 해당 인물 이름과 `목사` 표기가 명시된 영상만 자동 연결한다.
- 제목에 다른 목회자가 명시된 초청 설교는 현재 담임목사 영상에서 제외한다.
- 다른 교회의 공식 기록은 승인된 `ministry_appearance`로만 연결하며, 동명이인은 교회·역할·교단·지역 근거가 맞지 않으면 보류한다.
- 영상 파일과 썸네일을 airChurch에 복제하지 않고 YouTube 식별자와 최소 메타데이터만 저장한다.

전체 영상 수보다 ‘승인된 목회자 중 검증된 영상이 한 편 이상 연결된 비율’을 우선한다. 운영 내보내기로 이 비율을 점검할 때는 다음 오프라인 명령을 사용한다.

```bash
npm run pastor-media:coverage -- --input reviewed-media-export.json --output out/pastor-media-coverage.json
```

입력은 `churches`, `ministryProfiles`, `sermons`, `ministryAppearances` 배열을 담은 JSON이다. 이 도구는 네트워크와 DB에 접근하지 않고 담임목사 기본 귀속, 비담임 제목 명시, 승인된 외부 사역을 같은 규칙으로 계산한다. 사람·교회·역할별 커버리지와 영상이 없는 검토 큐만 출력한다.

## 운영 원칙

- 한 호스트에 동시 요청하지 않는다. 재시도 폭주도 하지 않는다.
- robots.txt가 5xx, 429, 시간 초과 등으로 확인되지 않으면 보수적으로 수집을 멈춘다.
- 사이트 정책 확인일이 366일을 넘으면 수집을 멈춘다.
- 리디렉션마다 URL·호스트 정책·robots 허용 여부를 다시 검사한다.
- 최대 응답 크기는 1MB이며 HTML·XHTML·일반 텍스트 외 형식은 수집하지 않는다.
- 중복 이력은 사람·사건·직책·기관·기간 키로 합치고, 출처 URL만 병합한다.
- 보류 기록을 공개 데이터로 승격하지 않는다.
