# ITDASY — ITBI ABSOLUTE FINAL CLOSEOUT REPORT

> 2026-09-13 ~ 09-14 · 2차 게이트 RED 사유만 닫는 게이트 · 기본 판정 RED 에서 시작 · **라이브에서 증명한 것만** PASS

```
====================================================
ITDASY — ITBI ABSOLUTE FINAL CLOSEOUT REPORT
====================================================
BASELINE (게이트 시작 시 재측정 → 종료 시 재측정)
  FE live:          20260913-0408-37f5d36  →  20260913-1505-181a2b9
  BE serving:       f473e3e9 (rev 00598-p45)  →  c043b33 (rev 00611-kr7, 100%)
  Cloud Run:        itdasy-backend-staging · env=production · /health db ok · QA 주입 플래그 없음(종료 시 확인)
  DB:               Supabase itdasy-staging (실사용자 DB) · 쓰기 테스트는 QA 계정 추가형 1건만(아래 UI RACE)
  ENV:              production
  Account:          user 4 (창① 빨간 띠 · 전용 Playwright 프로필) · user 5 (창② 파란 띠 · 별도 프로필)
  Browser profile:  연준님 Chrome 과 완전 분리된 persistent userDataDir 2개 (localStorage/쿠키 공유 0)
  Data snapshot:    user 4 고객 16 · 회원권 보유 4 · 이번달 매출 415,000 · facts 2
  [ITBI] latest:    2026-09-13T14:0x Z (게이트 중 계속 적재)
  trace_json:       content_reports.trace_json 존재(models + main _ensure_col) · 라이브 신고 1건 trace 연결 확인
  Log retention:    _Default 30일 · _Required 400일(잠김)

DECISION — HISTORICAL PII LOGS
  Current build leak:  0  (30일 재스캔 1,612건 · 수정 후 빌드 전부 a필드 0 · 전화/이메일/토큰 0 · QA 이름 0)
                       ※ 전화 패턴 1건은 q_fp 해시 16진수 속 숫자 오탐 → 경계 보강 후 0
  Historical leak:     빌드 38510bbf 24건 중 답변 원문(a) 21건 · QA 이름 포함 5건 (전부 user 4 = QA 계정)
  Real customer data:  실사용자 고객명·전화·이메일 0 (ITBI 로그에 등장한 user hash 는 QA 계정 2개뿐)
  Decision:            A. 만료 대기 + 위험 수용
  Risk accepted by:    연준님 (2026-09-13 게이트 중 선택)
  Expiry date:         2026-10-11 22:44 UTC (= 10-12 07:44 KST) — 마지막 수정 전 레코드 +30일
  Action taken:        삭제 안 함 · 로그 IAM 확인(owner 1명 · compute SA · cloudbuild SA)
  추가 발견·수정:        [MODERATION REPORT] 로그가 신고된 답변 원문 200자를 남기던 경로(050345d) — 30일 1건, 이름 없음

REGRESSION (최종 빌드 FE 181a2b9 / BE c043b33 에서 전체 재실행)
  CASE-001~036:     ✅ 라이브 회귀 스크립트 27케이스(CASE-001~015·020·021·025~029·032~036) 27/27 PASS
                    + CASE-016~019·022~024·030·031 은 PG/유닛 회귀(tests/pg 205 · 유닛 4,416)
  Pass / Fail:      27 / 0 (신원 4→4 · facts 2→2 · 칩 101클릭 · 재추천 0 · 나쁜 막다른 길 0 · 17초+ 0)
  Not reproduced:   refresh→401 반복(원관측) · 새 배포 직후 새로고침 탭 멈춤(1회) · 쓰기카드 빈 메모(API 4/4 정상)
  Remaining:        없음(아래 P3 만)

CANONICAL ROUTING
  27/27:            ✅ 27/27  — 이번부터 "오류 문구 없음" 이 아니라 **즉답 경로를 탔는지**까지 판정
                    (이전 판정은 "단골 손님 있어?" 가 LLM 으로 새는 걸 통과로 셌다 → 0c4dd6a 수정)

READONLY INTENT
  25/25:            ✅ (customer_ordinal 신설로 24→25 · 실제 /assistant/ask 로 intent 대조 · user 5)

RECOMMENDATION GRAPH (최종 빌드 181a2b9 · 실제 마우스 클릭)
  roots:                    62
  nodes:                    192
  clicked edges:            130
  max depth:                5
  unique states:            67
  re-asked suggestions:     0   (1차 1건 → 30df9a0 수정 · 하네스의 llm_freeform 동일시 오탐 4건 제거)
  dead ends:                나쁜 종료 0 · 정상 종료 10('예약 잡기'=이름 입력 대기 · '취소'=종료)
                            (1차 20건 → dee65ba 프론트 지름길 칩 · 2차 16건 → 181a2b9 예약초안 가로채기 수정)
  unsupported suggestions:  0
  chip failures:            0 · 창 닫힘 0 · 17초 이상 0

UI MULTITAB / RACE (전용 프로필 · 최종 FE 에서 재실행)
  same account tabs:        ✅ 6/6 (두 탭 대명사 분리 · 목록 교차 되묻기 · 응답 역전 · 로딩 중 입력 · 칩 클릭 중 입력 · 새로고침/뒤로)
  different profile:        ✅ user 4 × user 5 동시 42턴 — 상대 가게 고객명 0 · 401/500 0 · 세션 1257≠1259 · 토큰 분리
  response inversion:       ✅ 느린 LLM + 빠른 즉답 — 서버 대화기록에 두 턴 모두 · 역전 표시 0
  bfcache:                  ✅ 다른 페이지 → 뒤로 → 옛 칩 클릭 정상 · 새로고침 후 중복 답 0
  session expiry:           ✅ 입력 중 서버측 로그아웃 → Enter: refresh 1회(401) · ask 1회(401) · 반복 0 · 429 0 · 재로그인 화면 표시
                            P3: 친 질문은 대화 말풍선에만 남음(새로고침 시 소실 · 로그인 후 자동 재전송 없음) — 로그인 화면 '작업 보관' 문구는 잇비 질문엔 해당 안 됨
  pending action duplicate: ✅ 확인 버튼 3연타(80ms) → /assistant/execute 1회 200 → 메모 0→1 (QA 고객 · 추가형)
  result:                   ✅ PASS

UNCONFIRMED CASES
  CASE-023/028:     ✅ 재현·수정 종결 — 원인 3겹(LLM 답 엔티티 미기록 · 서수 기준 · FE 지름길 턴 서버 부재)
                    PG Pattern A–D ×20 · 라이브 CASE-032 20/20 · 지칭어 매트릭스 50/50 · 고친 경로 20라운드 140턴 0 실패
                    그 과정에서 같은 계열 추가 발견·수정: CASE-033~036 (아래)
  refresh 401 loop: NOT REPRODUCED — PG S1–S6 ×25 · 라이브 두 탭 동시 refresh→ask 25라운드(유효 쌍 ≥55) 401 0
                    조건: user 4/5 각 단독 · 두 탭 동시 · 서로 다른 프로필 동시 · 로그아웃 직후 · refresh 회전 직후
                    미시도 조건: 24h 자연 만료 · 같은 프로필 계정 전환 · 인위 네트워크 지연
                    별건 발견·수정: 같은 초 두 번째 로그아웃이 에폭을 안 올려 토큰 생존(P2 · 437d8a9)
                    별건 발견·수정: 레이트리밋이 인스턴스당 120/분으로 막혀 /auth/me·refresh 가 429(P2 · 6da9aa0)
                                  → 수정 후 라이브 60초 300회 전부 200
  result:           ✅ 종결

WRITE / MONEY
  25 kind smoke:        ✅ tests/pg 205 통과(쓰기 25 kind 게이트 · 확인 전 쓰기 0 · 확인 후 멱등 25/25 포함)
  money idempotency:    ✅ 회원권 동시성·환불 상계·같은 키 교차 테넌트 PG 통과
  tenant write isolation: ✅ Backend CI tenant-isolation 게이트 초록(c043b33)
  라이브 추가:           확인 카드 3연타 중복 실행 0 · 확인 문구 고객명 오염 발견·수정(c043b33) — 라이브 10회 전부 실제 이름 · 그중 1회 LLM 오염을 가드가 복원(로그 확인)
  result:               ✅

OBSERVABILITY
  logs:             [ITBI] 1일 1,266턴 — 성공 98.3% · fallback 1.7% · ERROR 0.0%(주입분 제외) · P95 2,699ms
  report script:    itbi_report.py — 주입분 분리 · DEADEND_BAD 0 · RISKY 0 · context_source 분포 출력
  alerts:           in-process 경보 → [ITBI_ALERT] 로그 → **로그 기반 지표 2개 + Cloud Monitoring 알림 정책 2개**(이번에 신설)
                    → 인증된 이메일 채널 "연준 (잇데이 장애 알림)"
                    진짜 경보: QA 주입 model_timeout ×3 → 경보 · execute_exception → money_write_error P0 경보(둘 다 'QA주입' 표시)
                    지표 도달: itbi_money_write_error=1 · itbi_alert_fired=2 (13:38Z)
                    오경보: 최근 3일 경보 4건 전부 수정(75a1c15) 이전 빌드 · 수정 후 0
                    메일 수신: ✅ 연준님 받은편지함에서 도착 확인(2026-09-14)
  failure events:   ✅ model_timeout · llm_500 · tool_error · execute_exception(주입) · entity_not_found · ambiguous_entity(실제)
                    · network_error(Playwright route abort · error_code=fetch_failed 로 보존 — c798047 전엔 [NAME])
                    · unsupported_request · client event 턴 보고
                    client_render_error · recommendation_click_error: 계측 코드·테스트만(라이브 유발 수단 없음 — P3 관측 공백 아님, 코드 경로 존재)
  user_report:      ✅ 창② 실제 '신고' 버튼 → 모달 → 제출 200 → [ITBI] user_report(conversation 1260 · turn 19 · intent · build · sha)
                    ※ 이 과정에서 **신고 모달이 잇비 창 뒤에 깔려 제출 불가**였던 P1 발견·수정(e227c09)
  trace_json:       ✅
  PII scan:         ✅ 현재 빌드 0 (위 DECISION)
  facts scan:       ✅ user 4 · user 5 facts — 질문형 0 · 전화 0 · 이메일 0
  result:           ✅

OPTIONAL / EXCLUDED SCOPE
  Vertex vision quality:  EXCLUDED (연준님 결정 A · 공용 쿼터)
  Meta real send:         EXCLUDED (연준님 결정 A · autosend OFF · 심사 대기)
  long session:           최소 게이트만 — readonly 100턴 한 세션 전부 200(P95 208ms) · LLM 10턴 전부 200(최대 4.0s)
                          완전 게이트(50턴 연속 LLM · 요약 압축 후 문맥 유지 · 비용)는 NOT TESTED → GREEN 범위 밖
  20 concurrent:          최소 게이트 — readonly 동시 20발: 200 9 · 503 11(Retry-After 5 전부) · 401/500 0
  cold start:             NOT TESTED (강제하지 않음 · 스펙 허용) → GREEN 범위 밖

BUGS FOUND (이번 게이트)
  P0: 0
  P1: 3
    · 신고 모달이 잇비 창(z 10500) 뒤(z 10050)에 깔려 AI 답변 신고 불가                                  e227c09
    · '예약 잡기' 초안이 이후 질문을 10분간 전부 예약 슬롯으로 먹음("주에님을 못 찾았어요")                 181a2b9
    · "아까 그분 …"·"방금 그 사람 …" 20문장 전부 작업실로 튕기며 잇비 창 닫힘 (CASE-035)                    1c48ce3
  P2: 12
    · CASE-030 두 탭이 대명사 문맥 섞음                                                                   c613a46 / 437d8a9
    · CASE-031 대화기록 lost update                                                                        437d8a9
    · CASE-032/033 FE 지름길 턴이 서버에 없어 "그분" 이 한 칸 앞 사람                                        3c204be / 888c4c0 / e6b6890
    · CASE-034 예약 지름길이 "아까" 를 이름으로 · 숫자 규칙이 가게 전체로                                    8655eeb / 7009595
    · CASE-036 "그분 오늘 예약·생일·회원권 잔액" 을 가게 전체로(남의 잔액 노출)                              cdabdbc
    · 단골 목록 말투가 LLM 으로 새서 "6분의 단골" 을 지어냄                                                  0c4dd6a
    · 확인 문구 고객명이 '익명' 으로 오염(10회 중 1회)                                                      c043b33
    · 레이트리밋 인스턴스당 120/분                                                                          6da9aa0
    · 같은 초 두 번째 로그아웃 토큰 생존                                                                     437d8a9
    · 504/500/429·execute 예외가 [ITBI] 에 0건(경보 원천 없음) · FE 실패 4종 서버 0건                        437d8a9 / 17c52b4
    · [MODERATION REPORT] 로그에 답변 원문                                                                  050345d
    · 경보가 로그에만 남고 사람에게 안 감(알림 채널 0)                                                        GCP 지표·정책 신설
  P3: 6
    · 프론트 지름길 답 후속칩 0(나쁜 막다른 길)                                                              dee65ba
    · 칩 재추천(같은 뜻)                                                                                   30df9a0
    · 로그 마스킹이 오류코드·지칭어를 [NAME] 으로 가림                                                        c798047 / 3796ee1
    · 서수 질문 LLM 17초                                                                                    437d8a9 (customer_ordinal)
    · "포토샵으로 로고 디자인해줘" → 문구 편집 시트로 이동(대안 제시로는 약함)                                  미수정·기록
    · 세션 만료 시 잇비 질문 보존이 말풍선뿐(새로고침 소실)                                                     미수정·기록

BUGS FIXED
  위 P1 3 · P2 12 · P3 4 전부 main 반영 · 서빙 확인 · 라이브 재검증 완료
  테스트: FE jest 2,975 · BE 4,416 · PG 205 (전부 통과, 새 결함마다 수정 전 코드에서 실패 확인)

CORRECTIONS TO PREVIOUS REPORTS
  · 2차 게이트 보고서에 "504/429/500 도 [ITBI] 로 관측" 이라 적었는데 **틀렸다** — 그 분기엔 관측이 한 번도 없었다(git 이력). 437d8a9 로 신설.
  · 2차 게이트 "CANONICAL 27/27" 은 오류 문구만 봤다 — "단골 손님 있어?" 는 LLM 경로였다. 이번부터 경로까지 판정.

REMAINING
  · P3: 로고 디자인 요청 → 문구 편집 시트(대안 안내 약함)
  · P3: 기능 질문 LLM 22.7초 1건(목록·서수 아님)
  · P3: 세션 만료 후 잇비 질문 자동 복구 없음
  · 잔여 결정: Discord 신고 알림 embed 의 snippet(운영자 검토용) 유지 여부
  · 과거 로그 PII 21건 — 2026-10-12 07:44 KST 자연 만료(위험 수용)
  · NOT TESTED(범위 밖): Vertex 비전 품질 · 실 Meta 왕복 · 완전 장기세션 · 콜드스타트 · 24h 자연 토큰 만료

FINAL:
  GREEN (범위 한정)

  FINAL GREEN — 단, 이 GREEN의 범위는 본 보고서에서 PASS로 증명한 잇비 조회·추천·쓰기 확인카드·돈 안전·관측·알림·PII/facts/tenant·UI 멀티탭 범위다. Vertex 비전 품질과 실 Meta 왕복이 제외됐다면 제외 범위로 명시한다.
  제외 범위: Vertex 비전 품질 · 실 Meta 발송 왕복 · 완전 장기세션(요약 압축) · 콜드스타트 · 24h 자연 토큰 만료.
```
