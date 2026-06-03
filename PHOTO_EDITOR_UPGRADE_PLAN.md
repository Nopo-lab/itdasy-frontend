# itdasy 사진 편집기 전면 고도화 계획

## Context

itdasy 사진 편집기는 "살롱 시술 사진을 빠르게 보정하고, 고급 홍보 콘텐츠로 변환하며, AI 잇비가 말 한마디로 완성해주는 살롱 전용 콘텐츠 제작기"로 진화해야 한다. 현재 13탭/30+ 모듈의 기능은 이미 갖춰져 있으나, 렌더링 버그(캐시 해시 누락, 과샤프닝), 브러시 체감 미흡(blur가 3x3, gloss 약함), UX 복잡도(13탭 노출), 템플릿 부족(B/A 3종만)이 병목이다. BeautyCam식 프리셋 카드 UX + Canva식 고급 템플릿 + AI 잇비 자연어 편집을 단계적으로 쌓아 올린다.

---

## 1. 현재 구조 요약

### 핵심 파일 (줄수)
| 파일 | 줄 | 역할 |
|------|-----|------|
| `app-photo-editor.js` | ~507 | 코어 상태, 탭 등록, API |
| `js/photo-editor/renderer.js` | 322 | 캔버스 2D 파이프라인, _fxCache |
| `js/photo-editor/basic-panels.js` | 492 | auto/tune/bg/text/export 패널 |
| `js/photo-editor/beauty-engine.js` | ~233 | 22슬라이더 뷰티 픽셀 엔진 |
| `app-photo-editor-brush.js` | 439 | 브러시 마스크 캔버스 |
| `app-photo-editor-brush-effects.js` | 145 | 브러시 효과 (smooth/shine/gloss/blur/clone/heal) |
| `app-photo-editor-smart-mask.js` | 71 | 픽셀 분류 (skin/hair/eye/nail) |
| `app-photo-editor-entry-v6.js` | 415 | Meitu 카드 진입 화면 |
| `app-photo-editor-layers.js` | 97 | 멀티 텍스트 레이어 |
| `app-photo-editor-export.js` | 188 | 저장 (PNG/JPG/WebP, feed/story) |
| `js/photo-editor/template-market-data.js` | 61 | 30종 템플릿 카탈로그 |
| `js/photo-editor/premium-templates.js` | 380 | 프리미엄 렌더링 엔진 |
| `js/photo-editor/template-overlay.js` | 349 | 오버레이 합성 |
| `app-photo-editor-templates-v2.js` | 188 | 마켓 UI |
| `js/photo-editor/history.js` | 45 | undo/redo (20항목 순환) |
| `app-photo-editor-gl-*.js` | 여러 | WebGL2 가속 (tone, blur, bilateral) |

### 현재 탭 (14개)
`auto` `tune` `beauty` `brush` `selective` `pro` `relight` `film` `bg` `ba` `template` `text` `brand` `export`

### 렌더 파이프라인
drawBase → GL_TONE → GL_BLUR(sharpness) → beauty CPU → bgBlur → relight → gl_selective → gl_curve → gl_hsl → gl_film → text layers → watermark → tplV2_overlay

### 상태 관리
단일 `_state` 객체 + `_state.history[]` 순환 버퍼(최대 20), `_fxCache` 해시 기반 캐시 무효화

---

## 2. 탭 → 6대분류 매핑

```
기존 14탭              → 사용자 대분류 6개
──────────────────────────────────────────
auto, favorites        → 추천 (Recommended)
tune, pro, relight,    → 보정 (Adjust)
  film, selective,
  curve, hsl, shadow
beauty (face/nail)     → 리터치 (Retouch)
beauty (hair focus)    → 헤어 (Hair)
bg, bgBlur             → 배경 (Background)
ba, template, text,    → 홍보 (Promotion)
  brand, export
```

**하위 호환**: 기존 `registerTabPanel()` / `registerDrawHook()` 시스템 유지. 새 카테고리는 entry-v6의 UI 레이어로 기존 탭을 감싼다. 카테고리 카드 탭 → 내부적으로 `_state.activeTab = 'beauty'` 등으로 매핑.

---

## 3. PR별 구현 계획

---

### PR-1A: 렌더링/텍스트/캐시 안정화

**목표**: 기능 표면 변경 없이 5개 알려진 버그 수정

#### 3.1.1 _fxCache 해시 누락 수정
**파일**: `js/photo-editor/renderer.js:274-284`

`_fxHash()` 에 `layers`, `activeLayerId` 키가 없어서 텍스트 레이어 변경 시 캐시가 무효화되지 않음. 또한 `tplV2` 상태도 누락.

```js
// 현재 (line 276-284)
return s.originalSrc + '|' + s.ratio + '|' + (s.template && s.template.id || '') + '|' +
  a.brightness + ',' + a.saturate + ',' + a.sharpness + ',' + a.temperature + '|' +
  Object.values(s.beauty).join(',') + '|' + ... + (s.bgBlur ? s.bgBlur.strength : 0);

// 수정: 누락 키 추가
// layers는 text/watermark와 함께 캐시 바깥에서 그려지므로 hash에 불필요
// 하지만 tplV2, bgBlur 전체를 포함해야 함
(s.bgBlur ? JSON.stringify(s.bgBlur) : '0')
```

실제 확인: `_fxCache` 바깥에서 그려지는 것들 (line 314-318): text layers, watermark, tplV2_overlay. 이들은 해시에 포함할 필요 없음. **실제 누락**: `s.bgBlur`가 `strength` 만 포함하고 `radius` 등 추가 필드가 있다면 누락됨 → `JSON.stringify(s.bgBlur)` 로 변경

#### 3.1.2 h.redraw() 직접 호출 → scheduleRedraw 교체
**대상 파일 4곳** (grep 결과):
- `app-photo-editor-layers.js:61,80` — `helpers.redraw()` → `helpers.scheduleRedraw()`
- `app-photo-editor-brush.js:143` — `helpers.redraw()` → `helpers.scheduleRedraw()`
- `app-photo-editor-templates-v2.js:118` — `PE._internal.helpers.redraw()` → `PE._internal.helpers.scheduleRedraw()`

추가 audit 대상 (14개 더 발견): `hsl.js`, `selective.js`, `text-dnd.js`, `curve.js`, `face-mask.js`, `brand-templates.js`, `bg-tab.js`, `ba-slider.js`, `ai-touch-v2.js`, `film-presets.js`, `templates.js`, `ai-mask.js`, `relight.js`, `studio-presets.js`
→ 모두 `scheduleRedraw()` 로 교체

#### 3.1.3 undo stack 개선
**파일**: `js/photo-editor/history.js`

현재 `SNAP_KEYS` 에 `bgBlur` 누락 → 추가. `originalSrc`(base64 data URL, 수 MB)가 매 스냅샷마다 deep copy됨.

수정:
1. `SNAP_KEYS` 에 `'bgBlur'` 추가
2. `snapshot()` 에서 `originalSrc` 는 이전 스냅샷과 동일하면 참조만 유지 (delta)
```js
function snapshot(state, prevSnap) {
  const out = {};
  for (const key of SNAP_KEYS) {
    if (key === 'originalSrc' && prevSnap && state[key] === prevSnap[key]) {
      out[key] = prevSnap[key]; // 참조 공유 (deep copy 회피)
    } else {
      out[key] = JSON.parse(JSON.stringify(state[key]));
    }
  }
  return out;
}
```

#### 3.1.4 텍스트 입력 렉 감소
**파일**: `js/photo-editor/basic-panels.js` (text 패널 input 핸들러)

텍스트 input 이벤트마다 `scheduleRedraw()` (32ms 쓰로틀) + `syncTextToLayer()` 호출 → redraw를 80ms 디바운스로 분리

```js
let _textTimer = null;
textarea.addEventListener('input', e => {
  state.text.value = e.target.value;
  h.syncTextToLayer();
  clearTimeout(_textTimer);
  _textTimer = setTimeout(() => { _textTimer = null; h.scheduleRedraw(); }, 80);
});
```

#### 3.1.5 과샤프닝 완화
**파일 2곳**:
- `js/photo-editor/renderer.js:74` — `k = 1 + strength * 0.8` → `k = 1 + strength * 0.5` + `strength = Math.min(strength, 0.6)` 가드
- `js/photo-editor/beauty-engine.js:40` — `k = 1 + strength * 1.2` → `k = 1 + strength * 0.7` + 누적 샤프닝 상한 0.5

**수정 파일 요약**:
| 파일 | 변경 내용 |
|------|-----------|
| `js/photo-editor/renderer.js` | _fxHash 확장, unsharp k값 완화 |
| `js/photo-editor/history.js` | SNAP_KEYS에 bgBlur 추가, originalSrc delta |
| `js/photo-editor/basic-panels.js` | 텍스트 input 디바운스 80ms |
| `js/photo-editor/beauty-engine.js` | unsharp k값 완화, 누적 상한 |
| `app-photo-editor-layers.js` | redraw → scheduleRedraw (2곳) |
| `app-photo-editor-brush.js` | redraw → scheduleRedraw (1곳) |
| `app-photo-editor-templates-v2.js` | redraw → scheduleRedraw (1곳) |
| 14개 추가 파일 | redraw → scheduleRedraw 일괄 교체 |

---

### PR-1B: 뷰티/브러시 체감 개선

#### 3.2.1 boxBlur 확인
`renderer.js:43-67` 과 `beauty-engine.js:9-33` 의 `_boxBlur` 는 이미 2-pass (수평→수직) 정상 구현. **이 항목은 수정 불필요**.

#### 3.2.2 브러시 blur 실제 블러로 수정
**파일**: `app-photo-editor-brush-effects.js:87-101`

현재: 3x3 커널 + `weight * 0.7` 믹스 → 거의 안 보임

수정: 적응형 커널(brush size 비례) + Gaussian 가중치 + 0.85 믹스
```js
function _paintBlur(d, i, r, g, b, lum, weight, w, h) {
  const idx = i >> 2, py = (idx / w) | 0, px = idx - py * w;
  const rad = Math.max(2, Math.round(weight * 5));
  let rS = 0, gS = 0, bS = 0, wSum = 0;
  for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
    const nx = px + dx, ny = py + dy;
    if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
    const dist2 = dx * dx + dy * dy;
    const gw = Math.exp(-dist2 / (2 * rad * rad));
    const j = (ny * w + nx) * 4;
    rS += d[j] * gw; gS += d[j + 1] * gw; bS += d[j + 2] * gw; wSum += gw;
  }
  if (wSum < 0.001) return;
  const mix = weight * 0.85;
  d[i] = _clamp(r * (1 - mix) + (rS / wSum) * mix);
  d[i + 1] = _clamp(g * (1 - mix) + (gS / wSum) * mix);
  d[i + 2] = _clamp(b * (1 - mix) + (bS / wSum) * mix);
}
```

#### 3.2.3 광택 브러시 체감 개선
**파일**: `app-photo-editor-brush-effects.js:80-85`

현재: `lift = lum>140 ? 24 : lum>80 ? 14 : 6` → 균일한 밝기 증가, 광택 느낌 안 남

수정: specular highlight 시뮬레이션 + 약간의 웜 틴트
```js
function _paintGloss(d, i, r, g, b, lum, weight) {
  const spec = lum > 160 ? 38 : (lum > 120 ? 24 : (lum > 80 ? 14 : 5));
  d[i] = _clamp(r + (spec + 5) * weight);     // R 약간 더 (웜)
  d[i + 1] = _clamp(g + (spec + 2) * weight); // G 중간
  d[i + 2] = _clamp(b + spec * weight);       // B 기본
}
```

#### 3.2.4 SmartMask fallback 기본값 수정
**파일**: `js/photo-editor/beauty-engine.js:97-98`

현재: `eyeW: mask ? mask.eye : 0`, `nailW: mask ? mask.nail : 0` → SmartMask 없으면 eye/nail 효과 0

수정: 위치 기반 heuristic fallback
```js
const ny = (y + 0.5) / h;
const faceBand = ny > 0.25 && ny < 0.55;
eyeW: mask ? mask.eye : (faceBand && lum0 < 150 ? 0.25 : 0),
nailW: mask ? mask.nail : (lum0 > 130 && lum0 < 220 ? 0.2 : 0),
```

#### 3.2.5 피부 분류 조건 완화
**파일 2곳**:
- `app-photo-editor-smart-mask.js:19` — `rg > -4` → `rg > -12`, `rb > 8` → `rb > 3` (아시안 스킨톤 커버)
- `js/photo-editor/beauty-engine.js:84` — `r > 68 && r > g` → `r > 55 && r > g - 8`, `(r - bl) > 10` → `(r - bl) > 4`

**수정 파일 요약**:
| 파일 | 변경 내용 |
|------|-----------|
| `app-photo-editor-brush-effects.js` | blur 커널 확대, gloss specular 개선 |
| `app-photo-editor-smart-mask.js` | 피부 분류 rg/rb 조건 완화 |
| `js/photo-editor/beauty-engine.js` | 피부 조건 완화, eyeW/nailW fallback |

---

### PR-2: WebGL bilateral 피부 스무딩

**기존 파일**: `app-photo-editor-gl-shaders-bilateral.js` (이미 존재)

**변경**:
1. SmartMask 피부 확률 → GL 마스크 텍스처로 업로드 (`u_skinMask`)
2. 쉐이더에서 `skinProb < 0.15` 인 영역은 스킵 (눈/입술/헤어라인 보호)
3. 커널 7x7 → 9x9 (고강도 슬라이더값에서)
4. `beauty-engine.js` 의 기존 boxBlur는 WebGL 미지원 시 fallback 유지

**수정 파일**:
| 파일 | 변경 내용 |
|------|-----------|
| `app-photo-editor-gl-shaders-bilateral.js` | u_skinMask 추가, 커널 확장 |
| `app-photo-editor-beauty.js` | GL bilateral 호출 시 마스크 캔버스 전달 |

---

### PR-3: 배경 블러 (인물 보케)

**기존 파일**: `app-photo-editor-bg-blur.js` (이미 존재)

**변경**:
1. 마스크 품질: morphological close (dilate→erode) 로 구멍 채우기
2. depth 시뮬레이션: 피사체 중심에서 거리에 따라 blur radius 점진적 증가
3. feather: box blur 5x5 → Gaussian feather로 교체
4. blur 패스: 2회 → 3회 (더 부드러운 보케)

**수정 파일**:
| 파일 | 변경 내용 |
|------|-----------|
| `app-photo-editor-bg-blur.js` | 마스크 morpho, depth map, Gaussian feather |

---

### PR-4: 살롱 추천 프리셋 카드 UX

**핵심 변경**: entry-v6 진입 화면을 6대분류 카테고리 카드로 재구성

#### 새 파일
- **`app-photo-editor-preset-cards.js`** (~450줄) — 프리셋 카드 그리드, 썸네일 lazy 생성, 카테고리별 프리셋 데이터
- **`css/screens/photo-editor-presets.css`** (~200줄) — 카드 스타일, 그리드, 가로 스크롤

#### 프리셋 데이터 구조
```js
const PRESET = {
  id: 'salon-clean',
  label: '자연광 살롱',
  category: 'recommend',   // recommend|adjust|retouch|hair|bg|promo
  shopTypes: ['all'],
  adjust: { brightness: 106, saturate: 108, sharpness: 18, temperature: 4 },
  beauty: { skin: 18, redness: 24 },
};
```

#### 추천 프리셋 8종 (요구사항 반영)
1. 깨끗한 피부 — skin 보정 + 잡티 완화 + 붉은기↓ + 밝기↑
2. 화사한 매장 — 노출↑ + 그림자 정리 + 색온도 + 채도↑
3. 헤어 윤기 — hairShine + 대비 + 브라운톤
4. 네일 선명 — nailGloss + 채도 선별↑ + 선명도
5. 속눈썹 또렷 — lashSharp + 눈 주변 선명도
6. 자연 Before — 약보정만 (신뢰성 유지)
7. 홍보용 After — 밝기↑ + 피부결 + 선명도
8. 프리미엄 톤 — 베이지/웜톤 + 낮은 대비 + 필름 느낌

#### 썸네일 생성
현재 이미지를 160x200으로 downscale → 프리셋 적용 → base64 캐시 (LRU 12장)
`requestIdleCallback()` 으로 UI 블로킹 방지

#### 수정 파일
| 파일 | 변경 내용 |
|------|-----------|
| `app-photo-editor-entry-v6.js` | 6대분류 카테고리 카드 UI로 재구성 |
| `css/screens/photo-editor-entry-v6.css` | 카테고리 그리드 스타일 |
| **신규** `app-photo-editor-preset-cards.js` | 프리셋 데이터 + 카드 렌더 + 썸네일 |
| **신규** `css/screens/photo-editor-presets.css` | 프리셋 카드 스타일 |

---

### PR-5: Canva식 Before/After 홍보 템플릿

#### 새 템플릿 7종 추가 (기존 ba-cream/sage/dark 3종 유지)
| ID | 레이아웃 | 비율 |
|----|----------|------|
| `ba-2split-h` | 2분할 수평 | 4:5 |
| `ba-2split-v` | 2분할 수직 | 9:16 |
| `ba-3process` | Before→Process→After 3분할 | 4:5 |
| `ba-4grid` | 2x2 포트폴리오 | 1:1 |
| `ba-price` | B/A + 가격표 행 | 4:5 |
| `ba-event` | B/A + 이벤트 배너 | 9:16 |
| `ba-review` | B/A + 후기 인용 | 4:5 |

#### 디자인 원칙 (Canva 참고)
- 여백: 캔버스 너비의 8% padding
- 제목 폰트: `Playfair Display` / `Noto Serif KR` (기존 `FONT_FAM.playfair` 재사용)
- 팔레트: `premium-templates.js` 의 기존 `PAL` 객체 (cream/sage/charcoal) 재사용
- Before 사진: `brightness(0.92) grayscale(0.15)` 살짝 mute
- After 사진: `saturate(1.08) brightness(1.03)` 살짝 enhance
- "BEFORE" / "AFTER" 레이블 명확

#### 파일
| 파일 | 변경 내용 |
|------|-----------|
| `js/photo-editor/template-market-data.js` | TEMPLATES[]에 7종 추가, CATS[]에 'ba' 카테고리 추가 |
| `js/photo-editor/premium-templates.js` | META 엔트리 + 렌더 함수 추가 |
| **신규** `app-photo-editor-ba-compose.js` (~350줄) | 2장 이미지 합성 (before+after 배치) |

---

### PR-6: 샵 데이터 자동 삽입

#### 데이터 소스 (기존 활용)
- `localStorage.getItem('itdasy_shop_name')` — 샵명
- `localStorage.getItem('itdasy_brand_kit')` — JSON (shop_name, instagram_handle, logo_url, primary_color, accent_color, phone, address)
- `_state.serviceName`, `_state.price` — PhotoEditor.open() 옵션

#### 새 파일
- **`app-photo-editor-shop-data.js`** (~250줄)

```js
window.PhotoEditorShopData = {
  get() {
    const bk = JSON.parse(localStorage.getItem('itdasy_brand_kit') || '{}');
    return {
      shopName: bk.shop_name || localStorage.getItem('itdasy_shop_name') || '',
      logo: bk.logo_url || null,
      instagram: bk.instagram_handle || '',
      phone: bk.phone || '',
      bookingUrl: bk.booking_url || '',
      primaryColor: bk.primary_color || '#D58A95',
    };
  },
  fillTemplate(tplState, overrides) { ... }
};
```

#### 통합
- `premium-templates.js` 에서 `PhotoEditorShopData.get()` 호출하여 템플릿에 자동 삽입
- `basic-panels.js` text 패널에 "샵정보 삽입" 빠른 버튼 추가

| 파일 | 변경 내용 |
|------|-----------|
| **신규** `app-photo-editor-shop-data.js` | 샵 데이터 aggregator |
| `js/photo-editor/premium-templates.js` | shopData 자동 삽입 연동 |
| `js/photo-editor/basic-panels.js` | 텍스트 패널에 샵정보 버튼 |

---

### PR-7: AI 잇비 EditPlan 스키마 + Intent Parser

#### EditPlan JSON 스키마
```json
{
  "version": "1.0",
  "intent": "beautify|adjust|template|retouch|export|modify",
  "confidence": 0.92,
  "steps": [
    {
      "action": "apply_preset|set_adjust|set_beauty|set_relight|apply_bgblur|apply_template|add_text|set_watermark|set_ratio|apply_film|export",
      "params": { ... },
      "description_ko": "피부톤 정리"
    }
  ],
  "explanation_ko": "사진을 자연스럽게 밝히고 피부톤을 정리해요."
}
```

#### 파일
| 파일 | 변경 내용 |
|------|-----------|
| **신규** `app-photo-editor-edit-plan.js` (~400줄) | EditPlan 파서, 실행기, 상태 패치 변환 |
| **신규** `app-photo-editor-intent-parser.js` (~350줄) | 자연어 → intent 분류 (로컬 정규식 우선, API fallback) |

#### Intent 분류 (로컬, API 호출 없음)
```js
const PATTERNS = {
  adjust:   /밝[게히]|어둡|채도|선명|따뜻|차갑|색온도|보정/,
  beautify: /예쁘게|자연스럽|피부|잡티|윤기|매끈|리터치|뷰티/,
  template: /전후|비포|애프터|인스타|피드|스토리|홍보|템플/,
  retouch:  /지우|클론|힐링|블러|부분/,
  export:   /저장|내보내|다운로드/,
  modify:   /덜|더|줄여|늘려|빼|넣|바꿔/,
};
```

---

### PR-8: 자연어 → 추천 프리셋/보정값 적용

| 사용자 말 | intent | action |
|-----------|--------|--------|
| "예쁘게 해줘" | beautify | apply_preset("salon-clean") |
| "자연스럽게" | beautify | apply_preset("salon-clean") + beauty(skin:15) |
| "더 밝게" | modify | adjust.brightness += 10 |
| "따뜻한 톤으로" | adjust | adjust.temperature = 15 |
| "헤어 윤기 살려줘" | beautify | beauty(hairShine:50, hairVolume:40) |
| "네일 선명하게" | beautify | beauty(nailGloss:60) + adjust(saturate:115) |
| "속눈썹 또렷하게" | beautify | beauty(lashSharp:50) |

| 파일 | 변경 내용 |
|------|-----------|
| **신규** `app-photo-editor-nl-apply.js` (~350줄) | NL→EditPlan→상태 패치 적용 |

---

### PR-9: 자연어 → Before/After 템플릿 자동 생성

| 사용자 말 | 템플릿 | 비율 |
|-----------|--------|------|
| "전후사진 만들어줘" | ba-cream | 4:5 |
| "인스타용으로" | ba-cream | 4:5 feed |
| "스토리용 전후" | ba-2split-v | 9:16 |
| "가격표 넣어줘" | ba-price | 4:5 |

**플로우**: NL 파싱 → 템플릿 타입/비율 결정 → `_state.secondImg` 존재 시 before로 사용, 없으면 현재 이미지에 desaturation 적용하여 가상 before 생성 → 템플릿 오버레이 → 샵 데이터 자동 삽입 (PR-6) → 미리보기

| 파일 | 변경 내용 |
|------|-----------|
| **신규** `app-photo-editor-nl-template.js` (~300줄) | NL→템플릿 자동 선택+합성 |

---

### PR-10: 수정 대화 지원

| 사용자 말 | 동작 |
|-----------|------|
| "덜 과하게" | 마지막 변경 beauty 슬라이더 40% 감소 |
| "배경 흐리게" | bgBlur.strength += 30 |
| "로고 빼줘" | watermark.value = '' |
| "가격 넣어줘" | 텍스트 레이어에 가격 삽입 |
| "스토리용으로 바꿔줘" | ratio = '9:16' |
| "원래대로" | undo() |

`_state._lastModifiedKeys[]` 추적으로 상대적 수정("덜", "더") 지원

| 파일 | 변경 내용 |
|------|-----------|
| **신규** `app-photo-editor-nl-modify.js` (~250줄) | 수정 대화 파서 + 상태 delta 적용 |

---

## 4. AI 잇비 EditPlan 스키마 (전체)

```json
{
  "version": "1.0",
  "intent": "adjust | beautify | template | composite | retouch | export | modify",
  "confidence": 0.0-1.0,
  "steps": [
    {
      "action": "apply_preset | set_adjust | set_beauty | set_relight | apply_bgblur | apply_template | add_text | set_watermark | set_ratio | apply_film | apply_brush | export",
      "params": {
        "preset": "salon-clean",
        "brightness": 108,
        "saturate": 112,
        "skin": 30,
        "template": "ba-cream",
        "ratio": "4:5"
      },
      "description_ko": "자연광 살롱톤 적용"
    }
  ],
  "shopData": {
    "shopName": true,
    "logo": true,
    "instagram": true,
    "bookingUrl": false,
    "price": "49,000원"
  },
  "safety": {
    "naturalLevel": "medium",
    "maxFaceShapeChange": 0,
    "preserveIdentity": true,
    "requireUserConfirm": true
  },
  "fallback_preset": "salon-clean",
  "explanation_ko": "사진을 자연스럽게 밝히고 피부톤을 정리한 뒤 모발에 윤기를 더해요."
}
```

**실행 규칙**:
- steps 는 순차 실행, 각 step 후 `pushHistory()` (단계별 undo 가능)
- `requireUserConfirm: true` 이면 미리보기 생성 후 사용자 확인 대기
- 사용자 확인 없이 저장/덮어쓰기 절대 금지

---

## 5. 리스크

| 리스크 | 심각도 | 완화 |
|--------|--------|------|
| GL bilateral 스킨마스크가 회전 이미지에서 어긋남 | 높음 | `_applyTransform('rotL')` 후 마스크 캐시 초기화 |
| 프리셋 썸네일 생성이 UI 블로킹 | 중간 | `requestIdleCallback()` 사용, 화면 밖 프리셋은 lazy |
| B/A 템플릿에 before 이미지 없을 때 크래시 | 높음 | 현재 이미지 복제 + sepia 필터로 가상 before 생성 |
| NL 파서 오분류 | 중간 | 항상 토스트로 확인 후 적용, undo 경로 보장 |
| 프리셋 썸네일 캐시 메모리 누수 | 중간 | LRU 12장 제한, WeakRef |
| _fxCache 해시 변경으로 캐시 미스 증가 | 중간 | 해시에 꼭 필요한 키만 추가, 성능 측정 |
| iOS Safari GL context loss | 중간 | 기존 `webglcontextlost` 핸들러 + CPU fallback 유지 |
| 파일 500줄 초과 | 중간 | premium-templates.js(380줄)에 7종 추가 시 초과 가능 → B/A 전용 렌더를 ba-compose.js로 분리 |

---

## 6. 테스트 시나리오

### PR-1A
- [ ] 이미지 로드 → 모든 슬라이더 조정 → 캐시 무효화 확인 (스테일 프레임 없음)
- [ ] 텍스트 빠르게 타이핑 → iPhone SE에서 프레임 드롭 없음
- [ ] 25회 이상 undo → 메모리 스파이크 없음
- [ ] 선명도 슬라이더 100% → 흰색 halo 없음

### PR-1B
- [ ] 블러 브러시로 눈 위 드래그 → 실제 블러 체감 (단순 desaturate 아님)
- [ ] 광택 브러시로 하이라이트 영역 드래그 → 스페큘러 느낌
- [ ] 형광등 아래 아시안 스킨톤 사진 → 피부 감지됨

### PR-4
- [ ] 6대분류 카테고리 탭 → 프리셋 카드 노출 → 탭 시 즉시 적용
- [ ] 최근 사용 프리셋 순서 유지
- [ ] 매장 업종별 추천 프리셋 정렬

### PR-5
- [ ] 2장 이미지 → B/A 2분할 템플릿 → 샵명/워터마크 자동 삽입
- [ ] 1장만 있을 때 → 가상 before 생성
- [ ] 인스타 피드(4:5) / 스토리(9:16) 비율 정확

### PR-7~10
- [ ] "예쁘게 해줘" → 프리셋 적용 + 미리보기 토스트 → 확인 시 적용
- [ ] "너무 과해" → 직전 보정값 40% 감소
- [ ] "전후사진 만들어줘" → B/A 템플릿 자동 선택 + 샵 데이터 삽입
- [ ] AI 잇비가 사용자 확인 없이 저장하지 않음

### 공통
- [ ] `python3 -m http.server 8080` → 브라우저에서 전체 플로우 확인
- [ ] 기존 export/history/template/누끼/AI Touch v2 깨지지 않음

---

## 7. MVP vs 확장

### MVP (PR-1A ~ PR-6, 약 2주)
- 버그 수정 (PR-1A, 1B) — 위험 0
- bilateral 피부 보정 개선 (PR-2)
- 배경 블러 개선 (PR-3)
- 6대분류 프리셋 카드 UX (PR-4) — 가장 큰 UX 변경
- 7종 B/A 템플릿 (PR-5)
- 샵 데이터 자동 삽입 (PR-6)

### 확장 (PR-7 ~ PR-10, 약 1.5주)
- EditPlan 스키마 + Intent Parser (PR-7)
- NL → 프리셋 적용 (PR-8) — PR-7 의존
- NL → 템플릿 생성 (PR-9) — PR-5+7 의존
- 수정 대화 (PR-10) — PR-8 의존

### 이후 (PR-11+)
- AI 업스케일 / 사진 구출
- AI 오브젝트 제거
- AI 배경 생성/확장
- 헤어 컬러 시뮬레이션
- 고급 네일/헤어 상담용 시뮬레이션

---

## 8. 구현 순서

```
PR-1A (1-2일) ──┐
                ├──► PR-2 (2일) ──► PR-4 (3-4일) ──► PR-5 (3일)
PR-1B (1-2일) ──┘                                      │
                                   PR-3 (1-2일, 병렬)   │
                                                        ▼
                                   PR-6 (1일) ──► PR-7 (2일) ──► PR-8 (2-3일)
                                                                     │
                                                        PR-9 (1-2일) ◄┘
                                                                     │
                                                        PR-10 (1일) ◄┘
```

PR-1A, PR-1B는 병렬 가능. PR-3도 PR-2와 병렬 가능.

---

## 9. 전체 파일 변경 매트릭스

| PR | 신규 파일 | 수정 파일 |
|----|-----------|-----------|
| 1A | — | renderer.js, history.js, beauty-engine.js, basic-panels.js, layers.js, brush.js, templates-v2.js + 14개 redraw 교체 |
| 1B | — | brush-effects.js, smart-mask.js, beauty-engine.js |
| 2 | — | gl-shaders-bilateral.js, beauty.js |
| 3 | — | bg-blur.js |
| 4 | preset-cards.js, photo-editor-presets.css | entry-v6.js, entry-v6.css |
| 5 | ba-compose.js | template-market-data.js, premium-templates.js |
| 6 | shop-data.js | premium-templates.js, basic-panels.js |
| 7 | edit-plan.js, intent-parser.js | — |
| 8 | nl-apply.js | — |
| 9 | nl-template.js | — |
| 10 | nl-modify.js | — |

---

## 10. 코드 패턴 (기존 준수)

### Hook 등록
```js
(function () {
  'use strict';
  if (window.MyModule) return;
  function _register() {
    if (!window.PhotoEditor?._internal) return false;
    const i = window.PhotoEditor._internal;
    i.registerTabPanel('myTab', { html: _html, bind: _bind });
    i.registerDrawHook('myHook', _drawHook);
    return true;
  }
  if (!_register()) {
    let tries = 0;
    const iv = setInterval(() => { if (_register() || ++tries > 50) clearInterval(iv); }, 100);
  }
  window.MyModule = { publicApi };
})();
```

### scheduleRedraw (슬라이더)
```js
inp.addEventListener('input', () => { state.beauty[key] = +inp.value; helpers.scheduleRedraw(); });
inp.addEventListener('change', () => helpers.pushHistory());
```

### API 호출
```js
const res = await window.apiFetch('/endpoint', {
  method: 'POST',
  headers: { ...window.authHeader(), 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
```

### SVG 아이콘 (Lucide, 이모지 금지)
```html
<svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;">
  <use href="#ic-sparkles"/>
</svg>
```
