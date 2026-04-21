# T-330 — 구 페르소나 탭 제거 + 레거시/숨김/노쇼 일괄 정리

> 트랙: **표준** (대규모 제거 — 약 1700줄 순삭감 예상)
> 감사 문서: `.ai/AUDIT_2026-04-22.md`
> 생성일: 2026-04-22

## 1. 목적 (Why)

2026-04-20 이후 **신 글쓰기 온보딩** (`showOnboardingCaptionPopup` → POST `/shop/persona/onboarding`) 이 페르소나 탭 Q1~Q9 설문을 완전히 대체함. 페르소나 탭은 이미 nav 숨김 (`style="display:none"`) 상태이며, `components/persona-popup.js` 는 Mock API 를 사용하는 미완성 기능. 이중 로직 유지 비용 크고, 코드 용량 낭비. 원영님의 방침: **"신 글쓰기 로직에만 집중, 구 페르소나 탭 전부 삭제."**

동시에 감사 과정에서 발견된 소규모 레거시/숨김/노쇼 코드도 같은 티켓으로 일괄 정리 (별도 커밋으로 나눌 필요 없음, 모두 "삭제" 성격).

## 2. 스코프 (What)

### A. 구 페르소나 탭 제거 (핵심)

**삭제 파일 (2개 = 1,444줄)**:
- `app-persona.js` — 900줄 (Q1~Q9 설문 탭 전체)
- `components/persona-popup.js` — 544줄 (Mock AI 캡션 팝업, 신 로직으로 대체됨)

**보존 (중요)**: `components/scenario-selector.js` — 신 글쓰기 (`openCaptionScenarioPopup` at `app-caption.js:521`) 에서도 사용 중, 공통 컴포넌트이므로 **남긴다**.

**index.html 수정 (6군데)**:
- L184 `<div class="header-persona" id="headerPersona">` 영역 제거
- L291 페르소나 nav 버튼 제거
- L395 `<div id="personaDash">` 제거
- L961-962 `<div class="tab" id="tab-persona">` 페르소나 탭 전체 제거
- L1151 `<script src="app-persona.js"></script>` 제거
- L1225 `<script type="module" src="components/persona-popup.js"></script>` 제거

**app-instagram.js 수정 (2군데)**:
- L110-116 `showDetailedAnalysis`: 분석 결과 팝업 닫을 때 `openPersonaPopup` 자동 호출 블록 제거 (팝업 닫힘으로만 끝나게)
- L297-304: 분석 완료 후 자동 `openPersonaPopup` 호출 제거

**app-caption.js 수정 (에러 핸들러/문구만, 핵심 로직 불가침)**:
- L577-582 `identity_incomplete` 에러 핸들러: `openPersonaPopup()` → `showOnboardingCaptionPopup()` 로 교체
- L480 `_CAP_ERR_MSG['consent_missing']`: "페르소나 탭 하단 동의를 먼저 해주세요" → "AI 처리 동의가 필요합니다" 로 문구만 수정
- L585 `consent_missing` 분기 토스트: 같은 문구 교체
- **주의**: `generateCaption` / `openCaptionScenarioPopup` / `_doGenerateCaption` 본문은 **절대 수정 금지**

**.eslintrc.js 수정**:
- L92 `'app-persona.js'` 예외 항목 제거

**삭제 문서**:
- `js/persona/CLAUDE.md` (26줄) — 해당 모듈 사라짐

### B. 쿠키 동의 제거 (C-1)

- `app-cookie-consent.js` 삭제 (49줄, 이미 주석처리되어 미사용)
- `index.html` L1224 주석 `<!-- <script src="app-cookie-consent.js"></script> -->` 제거

### C. 숨김 UI 제거 (C-4-A)

- `index.html` L407 부근 `cbt1ResetArea` 블록 제거
- `index.html` L413 부근 `homeQuestion` 블록 제거

### D. Legacy 토큰 마이그레이션 제거 (C-5)

- `app-core.js` L34-43 — 과거 `itdasy_token` → `itdasy_token::staging` 키 마이그레이션 블록 제거 (이미 모든 사용자 이관 완료 가정)

### E. 노쇼 관련 제거 (C-3) — 프론트 only

- `app-booking.js` L340 노쇼 버튼 / L444 노쇼 라벨 매핑 제거
- `app-report.js` L4 주석 / L122-123 노쇼 통계 표시 제거
- `app-calendar-view.js` L53 노쇼 색상 매핑 제거
- `app-customer-dashboard.js` L170 노쇼 아이콘 제거

**백엔드 노쇼 제거 (별도 티켓 T-330-B)**:
- `.ai/FOR_USER.md` 에 후속 처리 메모 추가:
  - `itdasy_backend-test` 레포에서 `/bookings/{id}/noshow` 엔드포인트, `booking_status` enum 의 `no_show` 값, 관련 마이그레이션 제거 필요
- 이 레포 범위 밖

### F. 하네스 문서 슬림화 (B-1)

목표: 각 CLAUDE.md ≤ 20줄.

- `CLAUDE.md` (루트, 85줄) — 스테이징 전용 핵심만 남김
- `js/caption/CLAUDE.md`
- `js/core/CLAUDE.md`
- `js/gallery/CLAUDE.md`
- `js/portfolio/CLAUDE.md`
- (`js/persona/CLAUDE.md` 는 A에서 삭제)

## 3. 비(非)스코프 (Won't)

- **🚫 글쓰기 탭 전체 불가침** (원영님 지시 "이 로직 최고, 건드리지마"):
  - `generateCaption`, `openCaptionScenarioPopup`, `_doGenerateCaption`
  - `components/scenario-selector.js` (신 글쓰기 핵심 의존성)
  - 시나리오 선택 bottom sheet UX (시술완성 / 후기감사 / 직접 작성)
  - 읽기만 가능, 수정 금지
  - **예외**: `app-caption.js` L577-582 `identity_incomplete` 핸들러 내 `openPersonaPopup` → `showOnboardingCaptionPopup` 교체 (이는 "구 페르소나 탭 제거" 작업의 일부)
- `components/scenario-selector.js` **보존**
- 백엔드 `/shop/persona/*` API 는 건드리지 않음 (신 온보딩이 사용)
- **백엔드 노쇼 제거는 별도 티켓** (T-330-B) — 이 레포는 프론트 전용, `itdasy_backend-test` 레포에서 처리. `.ai/FOR_USER.md` 에 추후 처리 메모 기록
- `.ai/AUDIT_2026-04-22.md` 의 D(디자인) 섹션 — 원영님이 "대기" 지시
- `app-caption.js` / `app-portfolio.js` / `app-gallery.js` 1000줄+ 분할 — Phase 2 별도 티켓 (T-101/102/103)

## 3-bis. 미확정 항목 결론 (2026-04-22 원영님 답변 반영)

| 항목 | 원영님 답변 | 확정 처리 |
|---|---|---|
| AI 처리 동의 체크박스 | "없음" | 신 온보딩에 추가 안 함. 에러 문구만 일반화 |
| `header-persona` 노출 여부 | "잘 모르겠음" | 작업 중 브라우저/코드 확인 후 CSS 포함 제거 |
| 커밋 분리 | "너 추천대로" | A~F **6개 커밋** 분리 |
| 노쇼 서버 | "서버자체를 지워" | 프론트: E 스코프대로 제거. 백엔드: T-330-B 별도 티켓 |

## 4. 위험 & 완화

| 위험 | 가능성 | 완화 |
|---|---|---|
| `openPersonaPopup` 제거 후 인스타 분석 완료 플로우 구멍 | 중 | 분석 결과 팝업 자체는 유지, 단지 자동 후속 팝업 제거. 사용자가 필요시 글쓰기 탭으로 이동하도록 UX 변경 (현재 이미 글쓰기 탭이 메인 진입점) |
| `identity_incomplete` 에러 시 `showOnboardingCaptionPopup` 호출이 캡션 팝업 내부에서 동작 안 할 수 있음 | 중 | 캡션 팝업이 이미 열린 상태 → `closePopup()` 먼저 후 호출하도록 순서 조정 확인 |
| `scenario-selector.js` 를 실수로 삭제 | 저 | plan.md 2-A 에 **보존** 명시, self-review 에서 재확인 |
| 노쇼 제거 후 관련 상태값이 서버에서 여전히 올 경우 화면 깨짐 | 저 | 삭제 후 필터링 로직 유지 (`if (status !== 'no_show')` 같은 방어 코드 추가 대신, 단순 분기 미존재로 두면 기본 라벨로 표시) |

## 5. 검증 계획 (T4)

1. **정적**: `npm run lint` / Stylelint 통과
2. **빌드**: `python3 -m http.server 8080` 로컬 서빙 → 콘솔 에러 0건
3. **기능 체크**:
   - 홈 → 인스타 연동 → 말투 분석 완료 → 팝업 정상 닫힘 (자동 페르소나 팝업 없음 확인)
   - 글쓰기 탭 → 시나리오 선택 → 캡션 생성 OK
   - 글쓰기 탭에서 프로필 미완성 시 → 신 온보딩 팝업 뜸 (구 페르소나 팝업 아님)
   - 예약 관리 / 리포트 / 캘린더 / 고객 대시보드 → 노쇼 흔적 없음
4. **페이지 소스 검색**: `grep -r "persona\|노쇼\|no_show\|cookie-consent\|cbt1ResetArea\|homeQuestion"` → 의도된 참조 외 0건

## 6. 롤백

단일 커밋으로 진행 후 문제 시 `git revert <sha>` 한 번에 복구.

## 7. 수용 기준 (DoD)

- [ ] 삭제된 파일 3개 (app-persona.js, persona-popup.js, cookie-consent.js, js/persona/CLAUDE.md) 커밋에 포함
- [ ] index.html 에 "persona" 검색 시 의도된 placeholder 외 0건
- [ ] `npm run lint` 통과
- [ ] 수동 E2E: 글쓰기 탭 온보딩 → 캡션 생성 정상
- [ ] 6개 CLAUDE.md 각각 ≤ 20줄
- [ ] 전체 diff 줄수 순삭감 ≥ 1500줄

## 8. 실행 순서 (승인 후)

1. 브랜치 `chore/t-310-cleanup` 생성
2. A → B → C → D → E → F 순서로 커밋 분리 (5~6 커밋)
3. 푸시 → PR → T4 검증 → T1 리뷰 → 머지

## 9. 예상 diff 크기

| 구분 | 줄수 |
|---|---|
| 삭제 (파일 전체) | ~1,544 (app-persona 900 + persona-popup 544 + cookie 49 + persona CLAUDE.md 26) |
| 삭제 (부분) | ~150 (index.html, app-instagram/caption 호출처, 숨김 UI, legacy 토큰, 노쇼) |
| 추가 | ~10 (문구 교체, 5개 CLAUDE.md 재작성) |
| **순삭감** | **~1,700줄** |
