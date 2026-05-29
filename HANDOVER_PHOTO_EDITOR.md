# 사진편집기 리디자인 — 인수인계 (2026-05-29)

## 현재 상태 (v316 통합)

GitHub Pages: https://nopo-lab.github.io/itdasy-frontend-test-yeunjun/
캐시 버전: `20260529-v316-mask-applied`
커밋: `cfa02b9`

### 완료된 작업 (v313 → v337 → v316)

| 버전 | 내용 | 사용자 체감 |
|---|---|---|
| v313 | RegionMaskProvider 인프라 (캐시·debug overlay·console.table) | 없음 (인프라) |
| v327~v328 | 템플릿 tier 정리 + BA 12종 시리즈 (헤어/네일/속눈썹/피부 × cream/polaroid/dark) + 적용 버그 fix | Free 배지 + 신규 BA 카드 |
| v329~v330 | Nav v7 하단 2단 카테고리/서브칩 메뉴 (default ON) | 뷰티캠 그라마 UX |
| v331 | hairMask Tier 1 — MediaPipe `hair_segmenter.tflite` | (v316 통해 체감) |
| v332 | nailMask/handSkinMask Tier 1 — MediaPipe Hand Landmarker | (보류, v316 미연결) |
| v333 | eyelashBandMask refinement — eye polygon upper band ∩ Sobel dark-line | (보류, v316 미연결) |
| v334 | hairBoundaryMask — hairMask blur differential | (v316 약하게 연결) |
| v335 | mask QA 도구 (`RegionMaskQA.runOnCurrentImage`) | 콘솔 도구 |
| v336 | QA 산식·캐시·no-hand·v316 판정 수정 | 표 정확도 ↑ |
| v337 | eyelashBandMask zero-coverage confidence=0 | QA 표 정확도 ↑ |
| **v316** | **RegionMask → beauty-engine 1차 연결 (skin/hair/lip/eye + hairBoundary)** | **헤어/피부/입술/눈 보정 정확도 ↑** |

### v316 슬라이더 → 마스크 매핑

| 슬라이더 그룹 | 마스크 | 연결 정책 |
|---|---|---|
| skin / redness / blemish / textureSmooth / yellowness / coolness / scalpBoost | skinMask | AUTO (conf≥0.7→1.0×, 0.4~0.7→0.6×) |
| hairShine / hairVolume / hairDetail / hairColor / hairColorPop | hairMask | AUTO |
| hairEndsClean | hairBoundaryMask → hairMask fallback | hairBoundary cap 0.6 |
| lipPop | lipMask | AUTO |
| eyeColor / irisClear / catchLight / eyeRedness / underEyeClean | eyeMask | AUTO |
| **lashSharp** | (마스크 미연결) | 기존 unsharp mask 유지 |
| **nailGloss / nailShape** | (마스크 미연결) | 기존 휴리스틱 유지 |
| **handSkin** | (마스크 미연결) | 기존 휴리스틱 유지 |
| closeUpDetail / browSharp | (마스크 미연결) | 기존 동작 |

**핵심 회귀 안전성**:
- RegionMaskProvider 없음 / PE_MASK_DISABLE='1' / confidence < 0.4 → 자동으로 v312 휴리스틱 fallback
- 사용자가 슬라이더 움직였는데 변화 0 인 상황 발생 X

### ON/OFF 비교

브라우저 콘솔:
```js
// OFF (v312 등가)
localStorage.setItem('PE_MASK_DISABLE','1'); location.reload();

// ON (기본)
localStorage.removeItem('PE_MASK_DISABLE'); location.reload();

// 현재 마스크 적용 현황
await MaskApplication.explain(PhotoEditor._internal.getState().originalImg)

// 마스크 측정 결과
await RegionMaskQA.runOnCurrentImage()
```

### Nav v7 비활성 (필요 시)

```js
localStorage.setItem('PE_NAV_V7','0'); location.reload();
```

---

## 남은 계획 (작업 순서 추천)

### A. v316 검증 + 작은 fix (먼저)

#### A-1. v316 픽셀 시각 회귀 확인
- 정면 얼굴 사진 + skin/hair/lip/eye 슬라이더 전부 적용
- PE_MASK_DISABLE='1' vs '0' 비교
- 의도한 영역만 변화하는지 (특히 hair 보정이 옷·배경에 안 묻는지)
- 만약 회귀 발견 시:
  - mask-application.js의 `_scaleOf` 임계 조정 (현재 0.7 / 0.4)
  - 또는 마스크별 cap 추가

#### A-2. lipMask coverage 검증
- v316은 lipW=1 fallback이라 mask 없어도 입술 보정 색 기반 검출로 동작
- mask 있으면 lipMask 영역만 → 정확도 ↑
- 사용자 다양한 사진에서 입술 외부 색칠 안 되는지

### B. v317 — eyelash 개선 (보류 마스크 1)

**문제**: 눈 클로즈업 사진에서 Face Landmarker 실패 → eyelashBandMask coverage 0 → v316 X-no-mask.

**개선 방향** (우선순위 순):
1. `MediaPipeLoader.detect`에 `refineLandmarks: true` 옵션 → 478 landmark, 눈 더 정밀
2. Face detect 실패 시 eye crop 자동 검출 (얼굴 bbox 추정 → 눈 영역 crop)
3. Sobel dark-curved-line 후보 탐지 (landmark 의존 X) — pure edge 기반
4. 사용자 브러시 fallback UI ("속눈썹 영역 칠해주세요")
5. confidence ≥ 0.4면 lashSharp 마스크 연결

**파일**:
- `app-mediapipe-loader.js` (~10줄 옵션 추가)
- `js/photo-editor/mask-eyelash-adapter.js` (~30줄 — refine 강화)
- `js/photo-editor/beauty-engine.js` (~10줄 — lashSharp 분기에서 mask 적용)

**예상 PR 크기**: ~150줄

### C. v318 — nail/handSkin 추가 QA → **보류 확정 (won't-wire, 2026-05-29 QA)**

**QA 결론 (헤드리스 5장 + detectHand 격리 프로브, `scripts/mask-qa-headless.js PHOTO_QA_MODE=nail`)**:

| 항목 | 결과 |
|---|---|
| Hand Landmarker 로드 | ✅ 정상 (헤드리스 456ms, 에러 0) |
| 네일샵 포즈(손등 평면·프렌치네일) 탐지 | ❌ conf 0.3/0.5/0.7 **전부 0개** |
| 얼굴 사진 false-positive | ⚠️ handedness 0.993 로 손 1개 (오탐) |
| 어댑터 `HAND_SCORE_MIN=0.7` 필터 효과 | ❌ 무력 — handedness 점수는 탐지되면 항상 ~0.99 |

**결정**: nailMask/handSkinMask 를 v316 에 **연결하지 않음**.
- 이유: MediaPipe Hand Landmarker 는 손바닥 제스처 포즈 학습 모델이라 네일샵 대표 포즈(손등 평면)에서 recall 실패. 진짜 네일 손은 놓치고 얼굴엔 FP. 연결 시 "슬라이더 변화 0"(rule 3) + "QA 미통과 연결"(rule 4) 위반.
- **현재 안전**: nailMask 미연결 → 네일은 `beauty-engine.js:126` 휘도 휴리스틱(`lum0 140~210 & subjectW>0.4`)으로 동작. nailShape 는 `_applySharpen` 전역 unsharp. 깨진 마스크 연결 시 오히려 퇴보.

**나중에 네일 정밀도 올리려면 (item H 영역, Hand Landmarker 아님)**:
1. 휴리스틱 개선 — specular highlight + 채도 높은 폴리시 색 기반 nail 검출 강화 (마스크 모델 불필요, 비용 0)
2. 전용 nail segmentation 모델 (별도 .tflite, 비용·용량 검토 필요)
3. **실제 원장님 네일샵 사진** 으로 재QA — loremflickr/commons 샘플은 품질 낮음(옛 광고·삽화 섞임). 원장님 실사진 확보 시 휴리스틱 1번 튜닝 권장.

**QA 도구**: `scripts/mask-qa-headless.js` 에 `PHOTO_QA_MODE=nail` 모드 추가됨(원격 5장 fetch). 재현: `PHOTO_QA_MODE=nail PHOTO_QA_URL='http://127.0.0.1:8080/?v=maskqa' node scripts/mask-qa-headless.js`

### D. v319 — Nav v7 + 카테고리 폴리싱

**현재**: v330 cutover로 default ON. 기본 동작 가능 보고 받음.

**남은 폴리싱** (사용자 캡처 #20 기준):
1. 진입화면 단순화 — 사진 픽커 + 빈 미리보기만 (entry-v6 카드 그리드 완전 제거 또는 hide만)
2. nav-v7 카테고리 아이콘 시각 개선 (현재 인라인 SVG → Lucide 스프라이트 통일)
3. 서브칩 좌우 스크롤 시 활성 칩 자동 스크롤 (`scrollIntoView`)
4. 헤어/뷰티 카테고리에서 beautyFocus 표시 (어떤 부위 보정 중인지 사용자 인식)
5. 저장 카테고리 — 비율/내보내기 + 다음 단계 모달
6. 키보드 단축키 (Tab/Shift+Tab으로 카테고리 전환)

**파일**: `app-photo-editor-nav-v7.js` (+50), CSS (+30)

### E. v320 — 캔바 템플릿 폴리싱 (v327 후속)

**현재**: BA 12종 시리즈 + tier 정리 완료.

**남은 폴리싱**:
1. 캔바 SVG defs 실제 적용 (나뭇잎·꽃 그림자) — `js/photo-editor/template-overlay.js` 또는 신규 `template-decorations.js`
2. Playfair Display 폰트 동적 로드 (templates 카테고리 진입 시만)
3. 카드 코너 / 그림자 폴리싱 (border-radius 14px, box-shadow 통일)
4. 무료 템플릿 추천 강화 — 부위별 자동 추천 (장면 카테고리)
5. 명함 템플릿 5종 무료/유료 재조정

**파일**: `js/photo-editor/template-overlay.js` (+100), CSS (+50)

### F. v321 — Hair Tier 1 정확도 검증 → **검증 완료: Tier 1 precision-safe (2026-05-29 QA)**

**QA 결과** (`scripts/mask-qa-headless.js PHOTO_QA_MODE=hair`, 엣지케이스 5장 + fpChecks.hair_vs_bg):

| # | 사진 | Tier | coverage | **hair_vs_bg (FP)** | hair_vs_skin |
|---|---|---|---|---|---|
| 1 | 갈색 단발(전신·머리 작음) | T1 ready | 0.016 | **0.000** ✅ | 0.025 |
| 2 | 단발 뒷모습(검은옷) | T3 fallback | 0.406 | 0.212 ⚠️ | 0.322 |
| 3 | 헤어 포트레이트 | T1 ready | 0.019 | **0.000** ✅ | 0.000 |
| 4 | 곱슬 헤어 | T1 ready | 0.284 | **0.000** ✅ | 0.080 |
| 5 | 헤어 포트레이트 | T1 ready | 0.139 | **0.000** ✅ | 0.000 |

**결론**:
1. ✅ **Tier 1 (hair_segmenter.tflite) 은 배경 false-positive 없음** — 작동하는 모든 케이스 `hair_vs_bg=0.000`. 인수인계가 예상한 "FP 높으면 confidence 감점" 조건 **미발동** → Tier 1 에 감점/후처리 **불필요**. (감점 코드 추가 안 함이 정답)
2. ⚠️ FP(`hair_vs_bg=0.212`) 는 **Tier 1 실패 → Tier 3 휴리스틱 폴백** 에서만 발생(#2). Tier 3 hair conf=0.5 → v316 scale 0.6 자동적용이라 배경에 약하게 보정 번짐. 단, 이건 기존 v312 동작 범위.
3. ⚠️ **recall 갭**: 단발 뒷모습(#2) 같은 뒷통수 헤어샷에서 Tier 1 세그멘터가 빠짐. 살롱은 뒷통수 샷이 흔하므로 잠재 개선 포인트.

**남은(저우선) 개선 후보** — 실제 원장님 헤어 사진 확보 후만 안전:
- Tier 3 hair conf 0.5 → 0.39 강등 시 v316 자동적용 제외 → beauty-engine 내부 `hairLike`(subjectW·edgeBg 게이팅 더 강함)로 폴백 → #2 류 배경 FP 감소 기대. 단 Tier3 가 잘 되는 다수 케이스 회귀 위험 있어 실사진 QA 전 보류.
- 뒷통수 recall 갭은 segmenter 입력 전처리/임계 조정 별도 PR.

**QA 도구**: `scripts/mask-qa-headless.js` 에 `PHOTO_QA_MODE=hair` 추가됨. 재현: `PHOTO_QA_MODE=hair PHOTO_QA_URL='http://127.0.0.1:8080/?v=maskqa' node scripts/mask-qa-headless.js`
※ loremflickr/commons 샘플 품질 한계 — 정밀 튜닝은 실제 원장님 사진 필요.

### G. v322 — Provider 코드 리팩토링 (선택)

**현재**: `region-mask-provider.js` 485줄 (한도 직전).

**리팩토링 후보**:
- `_tier3_heuristic` (60줄) → `mask-heuristic-adapter.js` 분리
- `_computeRegion` switch 분기 → `mask-region-router.js` 분리

**시급성**: 낮음. 새 마스크 추가나 분기 변경 시에만 필요.

### H. v323+ — 더 큰 작업 (장기)

1. **Selfie Segmentation 활용** — backgroundMask Tier 1 승격 (현재 T3, 정확도 부족)
2. **MediaPipe Pose Landmarker** — 전신 사진에서 어깨/팔 등 별도 마스크 (헤어 시술 풀바디 사진용)
3. **Gemini Vision** — 사진 타입 분류 / 템플릿 추천 (`PhotoSemanticAdvisor` 인터페이스만 정의)
4. **사용자 브러시 마스크 UI** — Tier 4 활성화 (`PhotoEditorBrush` 재활용)
5. **마스크별 visual debug 향상** — 사진편집기 안 디버그 패널 (`?pe_debug=1` URL)

---

## 비상 롤백 명령

| 상황 | 명령 |
|---|---|
| v316 마스크 보정이 이상함 | `localStorage.setItem('PE_MASK_DISABLE','1'); location.reload()` |
| Nav v7 깨짐 | `localStorage.setItem('PE_NAV_V7','0'); location.reload()` |
| 둘 다 비활성 (완전 v312 등가) | 위 2개 모두 실행 |
| 디버그 오버레이 | `localStorage.setItem('PE_MASK_DEBUG','1'); location.reload()` |
| 디버그 해제 | `localStorage.removeItem('PE_MASK_DEBUG')` |

---

## 핵심 파일 맵

| 파일 | 줄 | 역할 |
|---|---|---|
| `js/photo-editor/region-mask-provider.js` | 485 | Provider 메인 — 4-tier dispatch, WeakMap 캐시, getCachedSync |
| `js/photo-editor/mask-refine.js` | 265 | polygon→mask, feather, Sobel, convex hull, ellipse |
| `js/photo-editor/mask-confidence.js` | 56 | maskType별 confidence 산식 (coverage 와 분리) |
| `js/photo-editor/mask-debug-overlay.js` | 166 | overlay canvas (pointer-events:none) + console.table |
| `js/photo-editor/mask-hair-adapter.js` | 52 | Tier 1 hair_segmenter.tflite |
| `js/photo-editor/mask-hand-adapter.js` | 118 | Tier 1 Hand Landmarker (fingertip ellipse + convex hull) |
| `js/photo-editor/mask-eyelash-adapter.js` | 108 | Tier 2 eye polygon upper band ∩ Sobel dark-line |
| `js/photo-editor/mask-qa-tool.js` | 220 | RegionMaskQA — 콘솔 측정 도구 |
| `js/photo-editor/mask-application.js` | 117 | beauty-engine 통합 — sync mask 빌더, PE_MASK_DISABLE |
| `js/photo-editor/beauty-engine.js` | 273 | 픽셀 walk + _pixel(d,i,w,h,SmartMask,regionMasks) |
| `app-mediapipe-loader.js` | 330 | Face Landmarker + Hand Landmarker + Image Segmenter (모두 promise 캐시) |
| `app-photo-editor-nav-v7.js` | 275 | Nav v7 하단 2단 메뉴 |
| `css/screens/photo-editor-nav-v7.css` | 143 | Nav v7 스타일 |

전부 ≤500줄 (CLAUDE.md 룰).

---

## 작업 시 주의사항

1. **CLAUDE.md 파일 크기 룰**: 500줄 초과 금지. 초과 시 어댑터로 분리 (예: mask-hair-adapter, mask-eyelash-adapter).
2. **회귀 안전**: 모든 마스크 신규 연결은 conf<0.4 → 휴리스틱 fallback. PE_MASK_DISABLE 경로 항상 유지.
3. **사용자 체감 우선**: 슬라이더 움직였는데 변화 0 인 상황 만들지 말 것.
4. **QA 먼저**: 새 마스크 자동 연결 전 `RegionMaskQA.runOnCurrentImage()` 5장 이상 QA 통과.
5. **캐시 버스트**: `sw.js` / `app-core.js` / `index.html`의 `__LATEST_BUILD__` 3개 + 수정한 script ?v= 모두 동일 버전.
6. **Capacitor 셸**: 앱은 GitHub Pages를 가리킴. APK 재빌드 보통 불필요 (cap copy만으로 충분).
7. **빌드는 사용자 요청 시에만**: 매번 빌드하지 말고, "빌드해줘" 명시될 때만.

---

## 진행률 (사용자 체감 기준)

- 부위 인식 정확도 ↑: **90%** (skin/hair/lip/eye + eyelash(v317) 완료, hair Tier1 검증 완료(F), nail 은 Hand Landmarker 부적합 확인 → 휴리스틱 유지(C))
- 하단 2단 메뉴: **100%** (v330 cutover + v319 폴리싱)
- 캔바 무료 템플릿: **100%** (v327 + BA 12종 + v320-A/B 폴리싱)
- 중복 진입점 제거: **70%** (v330 — 카드 그리드 hide)
- 메인 진입 직접화: **60%** (entry-v6 hide만, 완전 제거는 v319 일부)

**전체 ~88%**. 남은 큰 항목: 진입화면 완전 단순화(D 잔여), 실제 원장님 사진 기반 nail 휴리스틱·hair recall 튜닝(C/F 후속), G(provider 리팩토링)·H(장기).

### 2026-05-29 세션 추가 (C·F 검증)
- **C (nail/handSkin)**: QA 결과 Hand Landmarker 가 네일샵 손등 포즈 recall 실패 + 얼굴 FP → v316 미연결 확정(won't-wire). 네일은 휘도 휴리스틱 유지. 상세 §C.
- **F (hair Tier 1)**: QA 결과 Tier 1 hair_vs_bg=0.000 (precision-safe) → confidence 감점 불필요 확정. FP 는 Tier 3 폴백에서만. 상세 §F.
- QA 도구: `scripts/mask-qa-headless.js` 에 `PHOTO_QA_MODE=nail|hair` 모드 추가.
