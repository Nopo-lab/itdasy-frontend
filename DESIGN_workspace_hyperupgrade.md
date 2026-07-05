# 작업실 초고도화 — 레이아웃-퍼스트 "딸깍 홍보" (MVP 플랜)

> 브랜치 `feat/workspace-hyperupgrade` (origin/main v699 기준) · 상태: **플랜(승인 대기)** · 2026-07-05
> 원칙: 현재 workspace-v2를 **그 자리에서 수정**, 플래그 게이트·가역, 거대 로직은 별도 모듈로 분리(flow.js 4105줄엔 최소 연결만).

## 0. 확정 스펙 (대화로 결정)

| 항목 | 결정 |
|---|---|
| 핵심 루프 | 사진 → **레이아웃 갤러리(별도 스텝)** → 편집 → AI캡션 → 게시/저장 |
| 레이아웃 자산 | *내 레이아웃*(앱에서 배치→저장 + 자동학습) 메인 · 외부 보조 · **A~H 스타터(전후 비교 우선)** · 건너뛰면 AI 자동배치 |
| 채우기 | 자동 먼저 + **터치 드래그**(focal/zoom) 수정 (폰 중심) |
| 편집 | 기존 유지 + 배치·누끼·문구/스티커/로고 (톤보정 X) |
| 캡션 | AI 완전자동 · 시술 **프리셋 원탭 + 한 줄** |
| 여러 장 | 콜라주 + 캐러셀 |
| 출구 | 인스타 바로 게시 + 이미지 저장 |
| 고객연결 | **선택(건너뛰기)** — 이미 skippable(`workspace-v2-flow.js:2089` skipcust) |
| 디자인 | 앱 전역 토큰(`css/tokens.css`)으로 리스킨 |
| 내 레이아웃 동기화 | 계정 동기화(slot-sync 패턴 재사용) — **Phase 2** |
| 범위 | MVP 먼저 |

## 1. 현재 → 목표 플로우

**지금(SIMPLE_FLOW):** `upload → [편집기 자동] → caption → preview(게시) → connect → 저장`
**목표:** `upload → ★layout(갤러리·자동채움·드래그) → 편집 → caption(시술 원탭·AI) → preview → ★게시/저장` (connect 선택)

## 2. 데이터 모델 — "레이아웃"

ShopStyle을 확장해 **레이아웃 = 재사용 홍보 틀**로 승격 (기존 `js/workspace/shop-style.js` list/create/save/duplicate 재사용). 각 레이아웃:
```
{ id, name, kind:'before_after'|'collage'|'single'|'review'|'price',
  frame:{ratio,pad},                 // 기존 ShopStyle.frame
  photoSlots:[                        // ★신규 — 드래그-채움 타겟
    { id, role:'before'|'after'|'main'|'a'|'b',
      rect:{x,y,w,h},                 // 0..1 캔버스 내 슬롯 위치/크기
      focal:{x,y}, zoom, fit:'cover' }// _coverCrop 이 이걸로 크롭
  ],
  layers:[…],                         // 기존 ShopStyle.layers (title/sub/body 텍스트)
  logo, watermark,                    // 기존
  thumb, source:'starter'|'mine'|'imported', createdAt, updatedAt }
```
- **A~H 스타터** = seed 레이아웃(전후 비교 우선: 좌우·상하·프레임형 등 + 후기/가격/단일). `ShopStyle.ensureSeed` 확장.
- **내 레이아웃** = 갤러리 = `ShopStyle.list()`. 편집 결과를 `_learnShopStyle`이 `photoSlots`까지 학습(Phase 2).

## 3. MVP (Phase 1) — 만들 것 + 파일 앵커

### 3-1. 레이아웃 갤러리 스텝 (신규 화면)
- `workspace-v2-flow.js`: `SCREENS`(:14)에 `'layout'` 추가, `VISIBLE_SCREENS`(:26) = `['upload','layout','caption','preview','connect']`, `TITLE/CTA`(:27-35), `RENDER`(:2092)에 `layout: renderLayout`, `onCta`(:3693)에 layout 케이스, `open()`(:3929) `startScreen:'layout'` 지원.
- 화면 = 갤러리: 내 레이아웃 카드 + 스타터 A~H(전후 우선) + "건너뛰기(자동배치)". 실 렌더는 **신규 모듈** `js/workspace/layout/layout-gallery.js`(로직) + flow는 호출만.
- 홈: `workspace-v2-home.js` `KEY2SCREEN`(:16) `'layout':'layout'`, `_launchFlow`(:415) 그대로 startScreen 전달.

### 3-2. 자동채움 + 터치 드래그 (심장)
- **자동채움**: 업로드 사진을 `photoSlots`에 순서/역할대로 배치 (`workspace-adapter.js:219 _applyWorkspaceTemplate` 확장, `_pickPhoto` 재사용).
- **슬롯에 드래그(재배치)** + **슬롯 안 focal/zoom 조정(핀치)**: `itd-editor.js:561-656`의 pointer/pinch/pan 패턴 재사용하되 타겟을 `layer.x/y` → `photoSlots[i].focal/zoom`으로. 렌더는 `premium-templates.js:154 _coverCrop/_drawCover` 그대로.
- 신규 모듈 `js/workspace/layout/slot-drag.js`(제스처→focal/zoom) — flow/편집기와 분리.
- 폰 터치: `touch-action:manipulation`·`[data-draggable]{user-select:none}` 규칙(style-base.css) 준수.

### 3-3. 시술 원탭 → AI 자동캡션
- `ServiceTemplate`(backend `routers/services.py`) 목록을 캡션 스텝에 **원탭 칩**으로. 칩 탭 → `opts.service = preset.name` → 기존 `CaptionEngine.generate`(`app-caption.js:877`) → `/persona/generate`. **캡션 엔진 무변경**(3 입력이 같은 경로로 수렴). 한 줄 직접 입력도 유지.

### 3-4. 게시/저장 (기존 재사용)
- `publish('feed'|'story'|'carousel')`(:3853) + `saveImage`(:2526, 기기 저장 + "올리셨어요?" 시트). preview에서 두 출구. connect는 선택(기존 skipcust).

### 3-5. 리스킨 (앱 정체성 정렬)
- `css/workspace-skin-v3.css`의 하드코딩(아이보리 `#FBF7F5`, 로즈-브라운 그림자)을 **`tokens.css` 전역 토큰**으로 교체: 배경 `--bg`, CTA `--brand`→`--brand-strong` + `--shadow-brand`, 카드 `--surface`/`--shadow-md`, radius `--r-md/lg`, 폰트 Pretendard. 다크모드는 보류(라이트 기준).
- 갤러리·슬롯·드래그 UI는 처음부터 토큰으로 작성. PC 232px 사이드바 안 잘리게(`style-responsive.css` 오버레이 규칙 등록).

### 3-6. 내 레이아웃 저장 (로컬)
- 편집 결과를 `ShopStyle.create/save`로 `photoSlots` 포함 저장 → 다음엔 사진만 교체. (동기화는 Phase 2)

## 4. Phase 2 (fast-follow, MVP 검증 후)
- **내 레이아웃 계정 동기화**: slot-sync 패턴 재사용 → 백엔드 `WorkspaceLayout`(user_id, layout_id, name, spec JSON, thumb, LWW/tombstone) + FE 동기 모듈. (이미 만든 workspace-sync 구조 복제)
- **외부 가져오기 → 레이아웃 자산화**: 기존 `app-template-import.js`(OCR→slotValues) 확장해 사진 자리도 슬롯으로.
- **자동 학습**: `_learnShopStyle`(:683)에 `photoSlots` 반영.
- 콜라주/캐러셀 정교화, 스타터 팩 확대.

## 5. 플래그·롤아웃
- **`ITDASY_WS_HYPER`**(기본 off) — 레이아웃 스텝+드래그+리스킨 게이트. off면 현행 플로우 그대로.
- 리스킨은 `ITDASY_WS_SKIN_V4`로 분리해 단독 롤백 가능.
- 스테이징 검증 → 운영 승격.

## 6. 검증
- 순수 유닛: focal/zoom 제스처 계산, 자동채움 배치, 레이아웃 직렬화(node vm 패턴).
- 로컬 브라우저 QA(커밋 전) + 배포 후 실브라우저(claude-in-chrome)로 사진→레이아웃→드래그→캡션→게시 왕복.
- 회귀: 플래그 off 시 기존 플로우 무변경 확인.

## 7. 리스크·한계
- `workspace-v2-flow.js` 4105줄(🔴 TECH_DEBT T-104): 신규 로직은 `js/workspace/layout/*` 모듈로 분리, flow엔 스텝 등록·호출만.
- 드래그 UX는 폰 실기기 감도 검증 필요(핀치·스냅). MVP는 focal/zoom 우선, 회전은 Phase 2.
- 스타터 A~H 디자인 품질 = 초기 인상 좌우 → 전후 비교부터 소수 정예로.

## 8. 구현 순서 (MVP)
1. 리스킨 토큰 정렬(가장 빨리 체감·저위험) → 2. 레이아웃 갤러리 스텝(스타터 A~H) → 3. 자동채움 → 4. 터치 드래그 focal/zoom → 5. 시술 원탭 캡션 → 6. 게시/저장 연결 + 내 레이아웃 로컬 저장 → 7. 실브라우저 QA. 각 단계 플래그 뒤에서 점진 배포.
