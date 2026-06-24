# 별도 티켓 — Nail-plate detector / Clone(Heal) brush

> 작성: 2026-06-25 (v556 캡션 작업 중 조사). **둘 다 저위험 MVP 불가 → 별도 티켓.**
> 조사 근거는 실제 코드 검증(아래 인용). 섣부른 엔진 변경 금지 원칙에 따라 미구현.

---

## TICKET 1 — 네일 클로즈업 보정 (nail-plate detector)

### 문제
네일샵 사진은 손 전체 없이 손톱만 크게 나온 클로즈업이 많은데, 현재는 보정이 적용되지 않는다(슬라이더는 동작하는 것처럼 보이나 효과 0).

### 근본 원인 (코드 검증)
- `js/photo-editor/mask-hand-adapter.js` `nailMask()`: MediaPipe Hand Landmarker가 **손을 못 잡으면 `{status:'noHand'}` + 마스크 없음** 반환.
  ```js
  const hands = await _detectHands(img);
  if (!hands || !hands.length) return { status: 'noHand', ... };  // 마스크 자체가 없음
  ```
- `js/photo-editor/mask-application.js` `_nailGatePass()`: `if (!r.mask) return false` — **마스크가 없으면 coverage 임계값은 검사조차 안 됨.**
- 따라서 "게이트 coverage 완화"로는 **해결 불가**(완화할 마스크가 없음).
- 정책 `region-mask-provider.js`(v550): "네일은 Hand Landmarker 결과만 허용. 실패 시 색/광택 추정으로 대체하지 않는다" — **의도적 안전장치**(피부/얼굴/배경 오검출 방지).

### 왜 고위험
- 손 없는 클로즈업 보정 = **새 nail-plate detector 필요**(색/윤곽/세로타원/고광택 기반 손톱판 검출).
- 이는 위 v550 안전정책을 **되돌리는** 일 → 피부/얼굴/배경을 손톱으로 오인할 위험을 재도입. 광범위한 false-positive QA 필요.

### 설계 (티켓에서 구현)
1. 신규 `nailPlateMask(img)` — Hand Landmarker 실패 시에만 동작하는 fallback 검출:
   - 후보: 고채도/저텍스처/세로 타원형 + 고광택 하이라이트 영역, 화면 중앙 비중 높은 ROI.
   - confidence tier 도입: 높음=적용, 중간=약하게(scale 0.3~0.5), 낮음=미적용+안내.
2. `_nailGatePass`에 Tier 2(nailPlate) 허용 경로 추가 — 단 **얼굴/스킨/배경 마스크와 상호배제** 안전검사.
3. mask overlay에 `nailPlate` 영역 표시(사용자가 적용 범위 확인).
4. 피부/헤어/눈썹/얼굴 보정에는 영향 없음(별도 마스크).
- **QA 필수**: 손 전체 네일(기존 PASS 유지) / 손톱만 클로즈업(보정 가능) / 일반 얼굴·피부(오인 0) / 배경·소품(오인 0).

### 저위험 임시 대안 (이번에 가능, 별도 판단)
- 손 미검출 시 슬라이더가 조용히 무효가 되는 대신 **명확한 안내**("이 사진에선 손톱이 또렷이 보이면 보정이 더 잘 돼요") 노출. → 문제를 푸는 건 아니지만 "조용히 죽음"은 개선. 본 티켓과 별개로 결정.

**브랜치(티켓):** `feat/nail-plate-detector` · **위험도: 중~고** · 추정: 검출 튜닝 + 광범위 QA.

---

## TICKET 2 — Clone / Heal 브러시 (잡티·머리카락·먼지 제거)

### 현황 (코드 검증)
- clone/heal 알고리즘과 브러시 UI는 **레거시 편집기**에 이미 존재:
  - `app-photo-editor-brush.js`(brush 타입 clone/heal, pointer/touch 바인딩), `app-photo-editor-brush-effects.js`(`_paintCloneOrHeal`), `app-photo-editor-heal-v2.js`.
- 그러나 **현재 워크스페이스 v2 편집기(`js/workspace/workspace-v2-flow.js`)엔 연결 안 됨**:
  - `index.html`에 `app-photo-editor.js` 미로드. v2 '고급(tools)' 탭 `controls: []`(비어있음).
  - v2의 undo/redo는 `d.undo/d.redo` = **adjust/beauty 설정 스냅샷**(`_snapEdit`)이라 **픽셀 단위 브러시 편집을 담지 못함**.

### 왜 고위험(즉시 MVP 아님)
- v2 편집기에 브러시를 붙이려면:
  1. v2 프리뷰 캔버스 위 stroke 페인팅 레이어 신설(v2 렌더는 `_paintEditPhoto`/`_refreshPreview` 설정 기반).
  2. **픽셀 히스토리** 신규 도입(현재 설정 스냅샷 모델과 별개) → undo/redo/원본보기/초기화 연동.
  3. export(`editedDataUrl` bake) 경로에 브러시 합성 반영.
- = v2 편집 엔진/히스토리 모델 확장. 레거시 알고리즘 재사용으로 **알고리즘 리스크는 낮으나 통합 리스크는 중**.

### 설계 (티켓에서 구현)
1. v2 '고급' 탭에 `heal`(auto-heal, source-point 불필요) 도구 1개 추가(MVP는 heal만, clone 제외).
2. `.ed-photo` 위 오버레이 캔버스 + touch/pointer stroke(레거시 `_getXY`/`_drawAt` 재사용).
3. stroke 종료 시 픽셀 결과를 photo.editedDataUrl 베이스에 커밋 + **픽셀 히스토리 push**(설정 히스토리와 분리, 통합 undo).
4. brush size 3단계, 모바일 터치 우선.
- **QA**: 작은 점/머리카락/네일 주변 잡티 제거, undo/redo, 원본보기, 초기화, 사진 전환 후 비혼합, 저장 유지, 모바일 터치, 성능.

**브랜치(티켓):** `feat/photo-editor-heal-brush-v2` · **위험도: 중**(알고리즘 재사용, 통합 신규) · MVP는 heal-only.

---

## 요약
| 기능 | 연구 1차 판정 | 실제(코드 검증) | 결론 |
|---|---|---|---|
| 네일 클로즈업 | 저위험(게이트 완화) | 무-손 시 마스크 없음 → 완화 무의미, 새 detector 필요(+안전정책 반전) | **별도 티켓(중~고)** |
| clone/heal | 저위험(80% 구현됨) | 레거시에만 존재, v2 미연결 + 설정기반 히스토리에 픽셀편집 불가 | **별도 티켓(중)** |
