# TECH_DEBT — 기술 부채 트래커

> 파일 500줄 상한 규칙(루트 CLAUDE.md §파일 크기 규칙). 초과 파일은 새 기능 추가 금지.
> 원영이 `js/{caption,portfolio,gallery,persona,core}/CLAUDE.md` 플레이스홀더로 분할 가이드를 이미 마련해둠.

---

## 🔴 분할 필요 (1000줄 초과)

### 1. `app-caption.js` — 1167줄
**목표 구조** (원영 `js/caption/CLAUDE.md` 기준):
- `js/caption/index.js` — 공개 API, 이벤트 바인딩 진입점
- `js/caption/generator.js` — AI 호출·프롬프트 조립 (400줄 상한)
- `js/caption/templates.js` — 해시태그·문구 샘플 데이터
- `js/caption/editor.js` — DOM 편집·자동완성 UI
- 외부 노출: `window.ItdasyCaption` 단일 네임스페이스

**착수 조건**: 원영 T-200 리프레시 완료 대기 (탭 구조 확정 후 리팩토링)

### 2. `app-portfolio.js` — 1023줄
**목표 구조** (원영 `js/portfolio/CLAUDE.md` 기준):
- `js/portfolio/index.js` — 공개 API, 이벤트 바인딩
- `js/portfolio/list.js` — 포트폴리오 목록·필터
- `js/portfolio/detail.js` — 상세·편집
- `js/portfolio/upload.js` — 업로드·썸네일 생성
- `js/portfolio/card-deck.js` — 카드 덱 UI (기존 `renderCardDeck`)
- `js/portfolio/bg-store.js` — 배경 창고

### 3. `app-gallery.js` — 1016줄 (+ 이미 분할된 하위 5개)
기존: `app-gallery-bg.js`(376), `app-gallery-element.js`, `app-gallery-finish.js`(327), `app-gallery-review.js`, `app-gallery-write.js`
**남은 작업**: `app-gallery.js` 코어를 `js/gallery/core.js` + `js/gallery/slot.js`로 분할.

---

## 🟡 주의 (700~1000줄)

### `app-persona.js` — 900줄
- 현재 상한 이내지만 페르소나 v2(Phase 4)에서 세그먼트 분기 추가 시 초과 위험.
- `js/persona/CLAUDE.md` 가이드 있음.

---

## ⏸ 연준 Phase 2 미결 과제 (2026-04-20 로드맵 기준)

### 백엔드 레포 작업 필요
- `itdasy_backend/routers/customers.py` (P0-1 백엔드)
- `itdasy_backend/routers/booking.py` (P2.2 백엔드)
- `itdasy_backend/routers/revenue.py` (P0-3 백엔드)
- `itdasy_backend/services/kakao_alimtalk.py` + 알리고 템플릿 4종 승인 (P2.3)
- 각 마이그레이션 SQL

현재 프론트는 **localStorage 오프라인 폴백**으로 단독 동작. 백엔드 배포되면 자동 서버 모드.

### 원영 T-200 완료 후 승격
- 오버레이 시트 방식 → 하단 네비 메인 탭 승격 (customer / booking / revenue)
- `app-core.js` 탭 라우팅 추가

---

## 📝 분할 실행 순서 (착수 시)

1. 단일 모놀리스 하나 선택 (`app-caption.js` 우선)
2. 백업 브랜치 생성: `git branch backup/pre-split-caption-$(date +%Y%m%d)`
3. 기능 단위로 섹션 분리 + import/export 연결
4. 각 하위 파일 500줄 미만 확인
5. `index.html` script 태그 재구성
6. 기능 E2E 스모크 (캡션 생성/편집/템플릿)
7. Lighthouse·문법 체크
8. 커밋 후 다음 모놀리스

---

## 🟢 사진편집기 출시 QA — 종료 (2026-05-31)

출시 QA 라운드 완료. **P0/P1 없음 → 베타 출시 가능.** 런타임은 더 건드리지 않는다(고도화는 아래 P2만).
회귀 감시 하니스 6종 확보: `scripts/{photo-controls-visibility,bg-replace,release,t119-attach,t118-slider,p2-mask}-qa.js`.

해결 완료: T-117 조작부 가시성(v363) · T-116 배경/누끼 검증 · T-120 BA 즉시반영+배경 피드백(v364) ·
T-119 저장/export/slot/attach/dedupe + T-119-A export 안내(v365) · T-118 슬라이더 체감 검증(강도 조정 없음).

### 남은 P2 고도화 (출시 후, 사진편집기 런타임 재오픈 금지 — 별도 티켓으로만)
1. **네일 클로즈업 no-hand 마스크 품질** — 손가락만 큰 클로즈업에서 MediaPipe Hand 미검출 →
   `nailMask` tier0. nailShape/coolness 가 휴리스틱만 사용. 강도 문제 아님(마스크 품질).
2. **눈/입술 정밀 재검증** — lipPop/eyeColor/catchLight 가 약하게 측정되나 마스크는 정상(tier2 AUTO).
   세로 사진 letterbox 로 측정 box 정렬 오차 가능 → 정렬 정확한 클로즈업(P2_EYE/P2_LIP)으로 실측 후 판단.
   섣부른 상수 상향은 작은 영역 과보정 위험.
3. **bg-safe 통합** — bg 탭이 누끼 다운스케일·재시도·단계별 status 이벤트 래퍼(`composeBgForEditor`)를
   우회. 현재는 단계 토스트로만 보강. 통합 시 큰 사진 안정성·진행바 개선.
4. **nav-v7 서브칩 세분화** — 템플릿 카테고리 피드/스토리/가격 서브칩이 동일 `template` 패널로 매핑.
5. **T-108** — cross-device treatments 병합 · 오프라인 영속 재시도 큐 · attach undo.

---

## 🟡 죽은 코드 정리 (DM 작업 완료 후 별도 턴)

### `app-dm-autoreply.js` 죽은 인박스 함수 (~150줄)
- 2026-06-08 '실시간 DM' 카드 리스트(`app-dm-confirm-queue.js`)로 인박스 이관 후, autoreply 시트는
  **설정 전용**으로 전환(compose 에서 인박스 렌더 제거 + 폴링 중단). 단, 옛 인박스 함수들이 파일에 남음:
  `_renderInbox` / `_renderCard` / `_renderCustomerContext`(단골 초록뱃지) / `_renderThread`(인박스용) /
  `_renderMiniTone` / `_handleSend` / `_handleReject` / `_handleMiniTone` / `_handleRegen` / `_refreshInbox` /
  `_startInboxPoll` / `_stopInboxPoll` / `_draftMap` / `_userToneByLog` 등.
- **검증 끝난 뒤** 새 카드 흐름 안정화 확인 후 일괄 삭제 + 파일 분할(현재 1319줄). 지금 삭제 시 설정 시트 회귀 위험.

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-20 | 최초 작성. 3대 모놀리스 분할 계획 + 백엔드 미결 과제 기록 |
| 2026-05-31 | 사진편집기 출시 QA 종료 기록 + 남은 P2 고도화 5종 백로그 추가 |
| 2026-06-08 | '실시간 DM' 카드 재구성 후 app-dm-autoreply.js 죽은 인박스 함수 정리 백로그 등록 |
