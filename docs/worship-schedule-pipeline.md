# 예배시간 수집·검토 파이프라인

이 파이프라인은 에어처치의 교회 ID와 공식 홈페이지 URL을 입력으로 받아 공개 예배안내와 교회 프로필의 검토 후보를 만듭니다. 프로필에는 공식 표어·비전·소개·주소·대표 연락처만 포함합니다. 운영 DB에는 연결하거나 쓰지 않으며, 자동 공개도 하지 않습니다.

## 안전 원칙

- 도메인별 정책 파일에서 `decision: allow`, 검토 시각, 검토 근거 메모, 허용 경로가 모두 있어야 접근합니다. 기본 180일이 지난 정책 결정은 자동 만료됩니다.
- 매 실행 시 `/robots.txt`를 먼저 읽고 대상 경로가 금지되면 수집하지 않습니다. 404(robots 파일 없음)를 제외한 비정상 응답은 허용으로 간주하지 않습니다.
- 기본 요청 간격은 3초이며 순차 실행합니다. 로그인, CAPTCHA, 차단, 세션, 우회 프록시를 사용하지 않습니다.
- 공개 HTML만 읽고 전화번호·이메일·교인 이름 같은 개인정보는 결과 형식에 넣지 않습니다.
- 후보는 항상 `pending`이고, 요일이 모호하면 `hold`입니다. 사람의 명시적 승인 없이는 import plan에 들어가지 않습니다.
- 원문 전체를 보관하지 않고 해당 시간 주변의 짧은 근거(`source_text`)만 보관합니다.

## 정규화 형식

각 예배 후보는 `record_id`, `church_id`, `church_name`, `service_type`, `day_of_week`(MON~SUN 배열), `start_time`(24시간 HH:mm), `venue_audience`, `source_text`, `source_url`, `collected_at`, `source_last_modified`, `confidence`, `review_status`, `flags`를 가집니다. 교회 프로필 후보는 `profile_id`, `church_id`, `church_name`, `slogan`, `vision`, `summary`, `address`, `phone`과 동일한 출처·검토 필드를 가집니다.

같은 교회·예배 종류·요일·시각·장소는 동일한 `record_id`로 중복 제거합니다. 재수집 시 더 최근 `collected_at`만 남깁니다. 페이지 갱신일을 알 수 없거나 표현이 모호한 후보는 자동 승인하지 않습니다. 검토자는 출처 URL과 원문 표기를 직접 대조해야 합니다.

## 실행

```bash
npm run worship:collect
npm run worship:validate
npm run worship:plan
```

첫 명령은 `data/worship-schedules/pilot-output.json`에 예배 후보·프로필 후보·보류·오류·요청 로그를 분리해 씁니다. 두 번째 명령은 리뷰 파일이 없으므로 모든 후보를 보류하는 dry-run입니다. 승인하려면 `reviews.example.json`을 복사하고 실제 `record_id` 또는 `profile_id`와 판단을 적은 뒤 `node scripts/worship-schedules/validate.mjs --input ... --reviews ... --output ...`을 실행합니다.

마지막 명령은 승인된 예배시간과 교회 프로필만 담은 체크섬 포함 import plan을 생성합니다. `--apply`는 의도적으로 거부됩니다. 실제 반영은 별도 승인 후 다음 작업에서 스키마·백업·트랜잭션·행 수 및 체크섬을 재확인하는 전용 importer로 수행해야 합니다. 교회 상세 페이지는 `review_status='approved'`인 행만 조회하므로 미검토 표어·비전·예배시간은 노출되지 않습니다.

## 전체 확장 절차

```bash
npm run worship:export-all
npm run worship:collect-all
npm run worship:validate-all
npm run worship:plan-all
npm run worship:report-all
```

`export-all`은 교단·지역 분할 건수의 합과 공개된 전체 승인 교회 수를 대조하고, ID 중복 제거 후에도 건수가 같을 때만 완료됩니다. `collect-all`은 체크포인트로 재개할 수 있으며 교회별 공식 홈페이지에서 같은 출처의 예배 안내 링크 하나만 추가로 확인합니다. 홈페이지가 없는 교회도 `missing_homepage` 결과를 남겨 모든 등록 ID가 산출물에 존재합니다.

도메인별 요청 간격은 기본 3초이고 서로 다른 도메인만 최대 4개 병렬 처리합니다. robots가 금지하거나 정상 확인되지 않으면 보류합니다. 같은 출처에서 발견한 이용약관에 자동 수집 금지 문구가 있으면 해당 출처는 보류합니다. 이용약관 링크가 없거나 읽지 못한 경우에는 플래그를 붙이고 사람 검토 전 공개하지 않습니다.

HTTP 공식 홈페이지는 작은 교회를 일괄 제외하지 않도록 공개 읽기만 허용하되 `unencrypted_transport` 경고와 별도 전송 검토를 남깁니다. 로그인·폼 전송·개인정보 송수신은 하지 않습니다. 이메일·계좌번호·개인 휴대전화·주거지 문맥은 제거하거나 보류하며 `metadata.privacy_scan`에 건수를 기록합니다. `report-all`은 1,782개 전체 ID 처리, HTTP 경고 건수 일치, 후보·보류·정책 사유를 다시 검증해 `all-report.json`으로 만듭니다.

공식 홈페이지가 공개한 이메일·계좌번호·교회 대표번호·공식 직무 연락처는 일반 프로필에서 제거하고 `all-contact-candidates.review.json`에만 분리합니다. 관리자 입력 후보는 `churchId`, `type=email|account|phone`, `value`, `scope=organization|official_role`, `sourceUrl`을 가지며 `visibility=admin_only`, `revealPolicy=masked_audited`가 고정됩니다. 개인 SNS와 비공식 출처는 제외합니다. 이 파일은 검토 후보일 뿐 현재 교회 페이지, 공개 API, import plan, 운영 DB 어느 곳에도 연결되지 않으며 암호화 저장과 승인은 후속 관리자 작업에서 수행합니다. 원문 값이 들어 있는 이 파일은 `.gitignore`로 Git·GitHub 백업에서 제외하고 관리자 로컬 작업 공간에서만 다룹니다.

이용조건이 바뀌거나 검토가 오래된 도메인은 정책 승인을 갱신하기 전까지 수집 대상에서 제거합니다.
