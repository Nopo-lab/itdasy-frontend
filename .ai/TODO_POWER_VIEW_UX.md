# 📌 이따 진행 — 파워뷰 UX 개선 (원영이 저녁 push 받고 pull 후 착수)

**만든 날:** 2026-04-22
**대기 이유:** 원영이 오늘 저녁 파워뷰 관련 디자인/코드 업로드 예정. 머지 충돌 방지 차 먼저 pull 하고 그 위에서 작업.

## 먼저 할 일

```bash
cd /Users/kang-yeonjun/프로젝트/깃허브with원영/itdasy_beauty_app_recent/itdasy-frontend-test-yeunjun
git pull origin main --rebase    # 원영이 올린 것 확인
```

## 이미 완료된 것 (이번 세션)
- ✅ 검색창 마이크 제거 — `app-power-view.js:567` `<input class="pv-search" id="pv-search" data-no-voice ...>`

## 적용할 개선 (Top 5 — 이후 작업)

### 🥇 1. 탭 숫자 뱃지 + 상태 시그널
- 위치: `app-power-view.js` TABS 정의부 + `_renderTabs()`
- `고객 (234)` / `예약 (12 🔴)` / `재고 (3 ⚠️)` 등
- 뱃지 데이터: 각 탭 데이터 길이 + 특수 조건 (오늘 예약/재고 부족 등)
- 구현: TABS 에 `badge: (data) => {...}` 콜백 필드 추가, 렌더링 시 호출

### 🥈 2. 빠른 필터 칩 (탭별 프리셋)
- 위치: 각 탭 헤더 바로 아래, `pv-toolbar` 위
- 예:
  - 고객: `전체` `오늘 방문` `VIP` `재방문 위험` `생일 이번달` `신규 (7일)`
  - 예약: `오늘` `내일` `이번주` `취소된`
  - 매출: `오늘` `이번주` `이번달` `카드만`
- 칩 선택 시 `searchKW` 외 `filterPreset` 상태 추가
- 필터 로직: 탭별 schema 에 `presets: [{ id, label, predicate: (row) => bool }]` 추가

### 🥉 3. 관계형 뷰 (고객 탭 → 슬라이드업 상세)
- 고객 행 탭 시 하단에서 슬라이드업 패널
- 내용: 해당 고객의 예약 이력 + 매출 합계 + 최근 NPS + 메모
- 신규 컴포넌트: `app-customer-detail.js` 또는 power-view 내부
- API 재사용: `GET /customers/{id}/profile` 이미 있는지 확인 필요

### 4. 스티키 퀵액션
- 스크롤 시 `pv-qadd` + `pv-toolbar` 를 `position: sticky; top: 0;`
- 배경 투명도 + blur + 그림자로 헤더 시각화
- 모바일에서 safe-area-inset-top 고려

### 5. 일괄 선택 + AI 액션
- 각 행에 `<input type="checkbox">` 추가
- 선택된 항목 > 0 일 때 하단에 액션 바 등장
- 액션: [메시지 초안 생성] [쿠폰] [태그] [CSV] [삭제]
- AI 비서와 연결 — selected 목록을 `/assistant/bulk` 로 전달

## 참고 파일
- `app-power-view.js` — TABS, _renderTabs, _renderBody
- `app-assistant.js` — bulk 메시지 action kind
- `app-killer-widgets.js` — 이탈 위험 리스트 연결
- `.ai/tickets/T-351.md` — 직전 작업 기록

## 티켓 번호
- T-352 예약 (파워뷰 UX 2026-04-22 저녁)
