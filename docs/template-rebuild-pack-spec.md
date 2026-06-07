# 템플릿 리빌드 팩 v3 — 설계/스펙

> 작성: 2026-06-07 · 브랜치 `claude/template-pack-v3` · 상태: **독립 제작 (앱 미연결)**
>
> 목적: 업로드된 레퍼런스 수준의 고퀄 신규 템플릿 팩을 **기존 템플릿을 덮어쓰지 않고 병렬로** 제작한다.
> 이번 범위는 "데이터 + 독립 preview + QA"까지. 실제 앱 갤러리 연결은 코덱스 S3b-2 종료 후 **별도 PR**.

---

## 1. 배경 / 원칙

- 현재 앱 템플릿은 기초 수준 → 레퍼런스(가격표·전후·이벤트·후기) 수준으로 상향한 신규 팩이 필요.
- **기존 것 즉시 교체 금지.** 신규 파일만 생성, 기존 데이터/렌더 경로 변경 0.
- 코덱스가 S3b-2(after_photo) 작업 중 → 충돌 파일 일절 미접근.
- 레퍼런스는 **직접 복제 금지**, "영감 기반의 새 디자인"으로 재해석.

### 절대 미접근 파일 (실서비스)
`index.html`, `sw.js`, `app-core.js`, `app-photo-editor-template-edit-sheet.js`,
`app-photo-editor-ba-compose.js`, `app-photo-editor-template-gallery.js`,
`js/photo-editor/premium-templates.js`, `js/photo-editor/template-market-data.js`,
그리고 onSave / renderer / imageSlots 관련 코드 전부.

### 신규 파일 (이 팩 전용)
| 파일 | 역할 | 단계 |
|---|---|---|
| `docs/template-rebuild-pack-spec.md` | 본 문서 | R1 |
| `js/photo-editor/template-pack-v3-data.js` | 16종 데이터 (`window.PhotoEditorTemplatePackV3`) | R2 |
| `css/screens/photo-editor-template-pack-v3.css` | 팩 전용 스타일 | R3 |
| `js/photo-editor/template-pack-v3-preview.js` | DOM 렌더 + 디바이스 토글 | R3 |
| `dev/template-pack-v3-preview.html` | 독립 preview 페이지 (앱과 분리) | R3 |

---

## 2. 슬롯 호환 전제 (기존 스키마 미러링)

신규 데이터의 `defaultCopy` 키는 **기존 `js/photo-editor/template-slots.js` 의 slot kind 키와 100% 일치**시킨다.
이렇게 하면 나중에 연결 시 `defaultCopy` → `slotValues` 로 무손실 매핑된다.

| kind | 슬롯 키 |
|---|---|
| `price` | `shop_name`, `headline`, `subtitle`, `services[{name,desc,price}]`, `cta`, `phone`, `main_photo` |
| `review` | `shop_name`, `headline`, `subtitle`, `review_text`, `customer_label`, `cta`, `main_photo` |
| `before_after` | `shop_name`, `headline`, `subtitle`, `before_label`, `after_label`, `before_caption`, `after_caption`, `cta`, `before_photo`, `after_photo` |
| `generic` | `shop_name`, `headline`, `subtitle`, `cta`, `main_photo` |

> 이미지 슬롯(`main_photo`/`before_photo`/`after_photo`)은 데이터엔 placeholder 메타만,
> 실제 이미지는 연결 PR에서 `imageSlots` 로 주입한다.

기존 market-data 호환 필드도 함께 보유: `id, cat, tier, label, prefillText, accent, industry`.
- `cat` 값: `price | ba | event | card` (기존 CATS 와 동일 집합).
- `industry` 값: `nail | hair | lash | brow | skin | makeup | common`.
- `tier` 값: `free | pro`.

---

## 3. 레퍼런스 21장 분석 → 3개 스타일군

### A. Clean Premium
- 톤: 화이트 / 베이지 / 로즈골드 / 블랙골드.
- 무드: 피부과·프리미엄 에스테틱. 표·정보 신뢰감, 고급 세리프 헤드라인, 절제된 여백.
- 영감: Beauté 가격표, Beauty Studio 카드형, Premium/Lumière 블랙골드, Lumière Beauty 전후, Pure Day 관리표.

### B. Soft Pastel SNS
- 톤: 핑크 / 라벤더 / 크림.
- 무드: 네일·속눈썹·이벤트. 손글씨 포인트, 하트·스파클 스티커 소량, 찢어진 종이 콜라주.
- 영감: Nail 전후, 봄시즌 이벤트, 이달의 가격표, Lash & Nail, 여드름 케어 전후.

### C. Before/After Focus
- 톤: 블루 클린 / 폴라로이드 / 다크.
- 무드: 사진 대비 강조. BEFORE/AFTER 라벨 가독성, 효과 포인트·CTA 명확.
- 영감: Purelle/Pure Day 블루 클린, 붙임머리 폴라로이드, Lumière Clinic 다크.

---

## 4. 신규 템플릿 16종

| # | id | cat | styleFamily | kind | industry | tier | 핵심 시각 포인트 |
|---|---|---|---|---|---|---|---|
| 1 | `v3-price-clean-rose` | price | clean | price | skin | free | 로즈골드 라인 표, 세리프 헤드, 정상가 취소선 + 이벤트가 강조 |
| 2 | `v3-price-clean-multi` | price | clean | price | common | free | 피부/속눈썹/네일 3섹션 컬러 구분 블록 |
| 3 | `v3-price-luxe-dark` | price | luxe | price | skin | pro | 블랙골드, 모델 사이드 포토, 골드 디바이더 |
| 4 | `v3-price-clean-photo` | price | clean | price | skin | free | 상단 사진 + 하단 카드행, BEST/NEW/EVENT 배지 |
| 5 | `v3-price-sns-pastel` | price | pastel | price | common | free | 보라/핑크, 번호 원형 + 썸네일 행, 손글씨 헤드 |
| 6 | `v3-price-sns-icon` | price | pastel | price | lash | free | 파스텔 원형 아이콘 행, 사이드 PICK 카드 |
| 7 | `v3-ba-clean-rose` | ba | clean | before_after | skin | free | 베이지/로즈, 라운드 BEFORE/AFTER 라벨, 추천시술 4칸 |
| 8 | `v3-ba-clean-blue` | ba | clean | before_after | skin | free | 블루 미니멀, 중앙 화살표 분리, 효과 3아이콘 |
| 9 | `v3-ba-sns-pink` | ba | pastel | before_after | nail | free | 핑크 손글씨, 하트 체크리스트, 스파클 |
| 10 | `v3-ba-polaroid` | ba | pastel | before_after | hair | free | 폴라로이드 틀 + 테이프, 보라핑크 그라데 헤드 |
| 11 | `v3-ba-luxe-dark` | ba | luxe | before_after | skin | pro | 블랙골드 풀블리드, 하단 효과 5칸 골드 |
| 12 | `v3-event-scrapbook` | event | pastel | generic | common | free | 찢어진 종이 콜라주, 테이프/꽃, 시즌 이벤트 |
| 13 | `v3-event-bold` | event | pastel | generic | common | free | 큰 할인 배지, 핑크/옐로 CTA 바 |
| 14 | `v3-event-coupon` | event | clean | generic | common | pro | 쿠폰 점선 절취선, 신규 -30% |
| 15 | `v3-review-card` | card | clean | review | skin | free | 인용부호 후기, 별점 5, 작성자 라벨, 원형 프로필 |
| 16 | `v3-card-shop-intro` | card | clean | generic | common | free | 샵 소개 미니멀, 로고/주소/영업시간/연락처 |

### 카테고리 충족
- 가격표 클린 프리미엄 3종+ → ①②③ (+④ 사진형 확장)
- 가격표 인스타 감성 2종 → ⑤⑥
- 시술 전후 클린 2종 → ⑦⑧
- 시술 전후 감성 2종 → ⑨⑩ (+⑪ 럭셔리 확장)
- 이벤트/프로모션 시즌 2종+ → ⑫⑬ (+⑭ 쿠폰 확장)
- 후기/추천/샵소개 2종 → ⑮⑯

> **총 16종** (목표 12~16 상단 충족).

---

## 5. 데이터 파일 스키마 (R2)

```js
window.PhotoEditorTemplatePackV3 = {
  VERSION: 'v3.0',
  STYLE_FAMILIES: {
    clean:  { label: 'Clean Premium', fontPair: {...}, radius: 18 },
    pastel: { label: 'Soft Pastel SNS', fontPair: {...}, radius: 22 },
    luxe:   { label: 'Luxe Dark', fontPair: {...}, radius: 12 },
  },
  TEMPLATES: [{
    id, label, cat, tier, industry,        // 기존 market-data 호환
    prefillText, accent,                    // 기존 호환
    styleFamily, kind,                      // 신규: 'clean'|'pastel'|'luxe' / slot kind
    ratio, size,                            // price/ba = '4:5' [1080,1350], card/event = '1:1' [1080,1080]
    palette: { bg, ink, sub, accent, line, badge },
    defaultCopy: { /* kind 슬롯 키와 일치 */ },
    previewMeta: { decor: [...], photoSlots: ['main'|'before'|'after'] },
  }],
};
```

- 순수 데이터(함수/렌더 없음). 브라우저 전역만.
- 비율: `price`/`ba` = 4:5 (1080×1350), `event`/`card` = 1:1 (1080×1080).

---

## 6. 독립 preview (R3)

- `dev/template-pack-v3-preview.html` — 앱과 완전 분리. 자체 `<script>`로 data + preview.js + css 만 로드.
- 컨트롤: **[모바일 390×844] / [데스크탑]** 토글 + 카테고리 필터(전체/가격표/전후/이벤트/후기·샵).
- `template-pack-v3-preview.js` — kind별 렌더 함수 `renderPrice / renderBeforeAfter / renderReview / renderGeneric`.
- placeholder 이미지: CSS 그라데이션 + 중앙 라벨 + inline SVG 실루엣 (외부 네트워크·저작권 0).
- 긴 텍스트 오버플로 가드(line-clamp/ellipsis).

---

## 7. 품질 기준

- 위계: 제목 > 본문 > 가격 > CTA 가 한눈에 구분.
- 사진 템플릿은 사진 비중 과하지 않게 정보와 균형.
- 가격표 4~6행 가독성. 전후는 before/after 차이 분명. 이벤트는 프로모션성 살리되 촌스럽지 않게.
- "지금 앱보다 확실히 상향된 퀄리티".
- 아이콘 규칙(루트 CLAUDE.md): UI 칩/배지에 이모지 금지 → preview 데코는 inline SVG/CSS.

---

## 8. QA 체크리스트 (R3 preview)

- [ ] 16종 전부 렌더.
- [ ] 콘솔 pageerror 0.
- [ ] 긴 텍스트(헤드라인 2줄·시술명 김·큰 가격 숫자)에도 레이아웃 안 깨짐.
- [ ] 모바일 390×844 가로 스크롤(넘침) 없음 / 데스크탑 정상.
- [ ] 시선 흐름(제목 → 사진 → 정보 → CTA) 자연스러움.

---

## 9. 앱 연결 시 필요한 메모 (다음 PR — 이번엔 안 함)

코덱스 S3b-2 종료 후 별도 PR에서 결정/진행:

1. **데이터 합류**: `template-market-data.js` 의 `TEMPLATES` 에 v3 항목 추가
   (이미 `id/cat/tier/label/prefillText/accent/industry` 호환 → 거의 그대로 push 가능).
2. **렌더러**: `premium-templates.js` 의 slot-aware `renderHook` 에 v3 레이아웃 함수 추가
   (현재 preview는 DOM 기준이므로 canvas 렌더 함수로 포팅 필요 — 좌표/폰트 매핑).
3. **기본값**: `template-slots.js` `getDefaultValues` 가 kind로 채우므로,
   v3 `defaultCopy` 를 kind 기본값으로 흡수하거나 템플릿별 override 경로 추가.
4. **갤러리 노출**: `app-photo-editor-template-gallery.js` 검색/추천에 자동 포함됨(데이터 추가 시).
5. **PRO 게이트**: `tier:'pro'` 항목은 기존 `isPaidPlan()` 게이트 그대로 적용됨.

> 포팅 핵심: preview의 DOM/CSS 레이아웃을 canvas 좌표계로 1:1 변환하는 작업이 연결 PR의 주 비용.
> 그래서 이번 단계에서 **레이아웃 비율·여백을 % 기준**으로 설계해 포팅을 쉽게 한다.
