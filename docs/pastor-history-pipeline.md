# 목사 공개 이력 수집 파이프라인

이 파이프라인은 airChurch 공개 프로필에 바로 쓰지 않는 검토 전용 도구다. 공식 공개 페이지에서 사전에 정의한 짧은 사실을 확인해 `pending` 기록으로 만들고, 모든 결과는 기본적으로 `dryRun: true`, `published: false`다. 운영 DB나 공개 API에 쓰는 코드는 포함하지 않는다.

## 수집 경계

- 허용: 교회·교단·노회·신학교의 공식 공개 페이지, 공식 홈페이지에서 소유 관계가 확인되는 YouTube 채널
- 차단: 로그인·회원·마이페이지·관리자 경로, 개인 SNS·블로그·카페, 로컬·사설 주소, 개별 YouTube 영상이나 검색 결과
- 이력·공개 출력에서 제외: 전화·이메일·상세 주소, 가족관계, 생년월일, 건강·병력, 계좌·고유식별정보 등 민감하거나 사적인 정보
- 저장: 짧은 사실 요약, 사건 종류, 직책, 기관, 가능한 시작·종료일, 공식 출처 URL, 확인일, 신뢰도, 검토 상태
- 미저장: 원문 HTML과 원문 인용. 캐시에는 본문 해시와 판정 결과만 남는다.

사실 요약이 출처 본문의 문장과 그대로 일치하면 파이프라인이 거부한다. 요약은 사실관계만 짧게 재서술해야 한다.

모든 roster·collection·import-plan 산출물은 `metadata.privacyScan`을 포함한다. 원문은 저장하지 않으며, 사실 요약 전체에 이메일·계좌·개인 연락처·상세 주소·가족관계 등 금지 정보가 하나라도 감지되면 `passed` 산출물을 만들지 않고 중단한다.

공식 교회·교단 페이지에 공개된 교역자 이메일·전화번호·계좌번호도 공개 이력 산출물이나 일반 수집 캐시에는 한 글자도 넣지 않는다. 검증된 후보는 별도 관리자 입력 파일 `out/pastor-history/admin-contact-candidates.json`에만 저장한다. 각 후보의 필수 필드는 `churchId`, `type`(`email`, `phone`, `account`), `value`, `scope: official_role`, 공식 `sourceUrl`이다. 추가로 `reviewStatus: pending`, `visibility: admin_only`, `revealPolicy: masked_audited`, `publicationEligible: false`를 붙인다. 운영 DB와 암호화 키는 이 파이프라인이 다루지 않으며, 팀장이 후보를 승인한 뒤 운영 암호화 입력 절차를 별도로 수행한다. 개인 SNS나 비공식 출처의 연락정보는 후보가 될 수 없다.

동명이인 방지를 위해 각 출처에서 목사 이름·교회명·교단·지역·역할 다섯 축을 모두 확인하고, 기본적으로 공식 출처 두 곳 이상이 같은 신원을 지지해야 한다. 한 축이라도 빠지거나 현재 주된 직책이 충돌하면 이력은 비워 두고 보류 사유만 기록한다. 근거가 약해 빈 결과가 되는 것은 정상적인 성공이다.

## 전국 대상 선정

전국 목회자 검색부터 시작하지 않는다. [`selection-policy.json`](../data/pastor-history/selection-policy.json)에 따라 airChurch에서 이미 검토 승인된 국내 교회를 기준점으로 삼는다. 공식 출처에서 확인되는 담임·위임·대표·부·교육·협동·원로·은퇴목사를 각각 별도 후보로 다룬다. 초청 설교자와 행사 강사는 대상이 아니다. 국내 범위는 서울부터 제주까지 17개 시·도 접두어로 제한하며 해외 지역은 별도 보류한다.

교회 명부의 단일 `pastor` 값은 현재 주된 목회자 후보를 만드는 단서일 뿐 직책의 증거가 아니다. 추가 역할은 `pastors` 배열에 이름·직책·current/former 상태·가능한 시작/종료일을 별도 행으로 제공한다. 명부 주장은 `roleTitleClaim`, `roleStatusClaim`, `startDateClaim`, `endDateClaim`으로만 보존하며 공식 출처 두 곳에서 확인하기 전에는 항상 `needs_source_curation`, `confidence: unverified`, `publicationEligible: false`다.

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

전국용 source manifest는 `policy.pilotOnly`를 사용하지 않고 `policy.selectionPolicyId`를 roster와 같게 지정하며, 각 `subjects[].id`와 `identity`도 roster 후보와 정확히 같아야 한다. 전국 수집은 반드시 roster를 함께 전달한다.

```bash
npm run pastor-history:collect -- --manifest curated-sources.json --roster out/pastor-history/roster.json
```

roster가 없거나 후보 신원이 다르면 네트워크 요청 전에 중단한다. 기본 샘플 manifest만 `pilotOnly: true`이며 최대 10명까지 공식 출처 기능을 시험하는 용도다.

두 번째 명령은 robots.txt를 먼저 확인한 후 호스트별로 최소 2.5초 간격을 두고 순차 요청한다. 출처별 재수집 간격 전에는 원문 없는 로컬 캐시를 재사용한다. 공개 이력 검토 결과는 기본적으로 `out/pastor-history/collected.json`에, 관리자 입력 후보는 `out/pastor-history/admin-contact-candidates.json`에 별도로 생성된다. 경로를 바꾸려면 각각 `--output`, `--admin-contacts-output`을 사용한다. 공개 이력 JSON에는 관리자 연락처 배열이나 연락처 값이 존재하지 않는다.

출처 주장, 신원 정보, 호스트 정책 또는 파이프라인 판정 버전이 바뀌면 기존 캐시 키가 무효화되어 다시 확인한다. 따라서 오래된 판정이 수정된 정책을 우회하지 않는다.

세 번째 명령은 공개 이력 JSON만 받아 DB에 쓰지 않고 `out/pastor-history/import-plan.json`만 만든다. 관리자 연락처 후보 파일을 읽거나 포함하지 않는다. `--apply`, `--publish`, `--write-db`는 의도적으로 지원하지 않는다. 승인 템플릿은 승인서가 아니며 기본 결정값이 `pending`이다.

사람이 모든 사실과 출처를 확인한 경우에만 승인 파일에 다음을 기록한다.

- `decision: "approved"`
- 실제 승인자 식별값 `approvedBy`
- ISO 8601 승인 시각 `approvedAt`
- importer가 만든 정확한 artifact digest와 전체 event ID 집합

그 후 아래처럼 다시 미리보기를 만들 수 있다.

```bash
npm run pastor-history:import:dry-run -- --approval out/pastor-history/approval.json
```

승인이 정확히 일치해도 이 도구는 `publicationEligible: true`인 계획만 만들며, DB 쓰기와 공개는 여전히 0건이다. 실제 게시 기능을 별도로 만들 때도 이 승인 digest 검증과 `human_approved` 상태를 서버 측에서 다시 요구해야 한다.

## 운영 원칙

- 한 호스트에 동시 요청하지 않는다. 재시도 폭주도 하지 않는다.
- robots.txt가 5xx, 429, 시간 초과 등으로 확인되지 않으면 보수적으로 수집을 멈춘다.
- 사이트 정책 확인일이 366일을 넘으면 수집을 멈춘다.
- 리디렉션마다 URL·호스트 정책·robots 허용 여부를 다시 검사한다.
- 최대 응답 크기는 1MB이며 HTML·XHTML·일반 텍스트 외 형식은 수집하지 않는다.
- 중복 이력은 사람·사건·직책·기관·기간 키로 합치고, 출처 URL만 병합한다.
- 보류 기록을 공개 데이터로 승격하지 않는다.
