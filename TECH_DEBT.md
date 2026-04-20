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

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-20 | 최초 작성. 3대 모놀리스 분할 계획 + 백엔드 미결 과제 기록 |
