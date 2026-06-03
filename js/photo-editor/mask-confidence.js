/* 사진 편집기 — maskType 별 confidence 산식 (v336 2026-05-29)

   coverage(면적 비율)와 confidence(검출 신뢰도)를 분리.
   RegionMaskProvider 가 _computeRegion 끝에서 호출.

   입력: regionType, result { status, sourceTier, _subtracted?, _lowConfidence?, handsAvgScore? }
   출력: 0~1 신뢰도.

   원칙:
     - status:'failed' / 'noHand' / 'pendingImplementation' → 0
     - Tier 3 휴리스틱 → cap 0.3 (background 0.4)
     - Tier 2 landmark → 마스크별 기본 (lip 0.9, eye 0.85, skin 0.85, hair 0.5 등)
     - Tier 1 AI → 마스크별 기본 (hair 0.85, nail/handSkin handsAvgScore)

   외부 의존: 0
*/
(function () {
  'use strict';
  if (window.MaskConfidence) return;

  function compute(regionType, r) {
    const status = r && r.status;
    if (!status || status === 'failed' || status === 'noHand' || status === 'pendingImplementation') return 0;
    // v337 — mask null 또는 coverage 0 이면 confidence 0 (자동 적용 후보 제외)
    //   eyelash 처럼 'fallback' status 인데 실제 mask 가 없는 경우 WEAK 처리 방지.
    if (!r.mask || (typeof r.coverage === 'number' && r.coverage < 0.001)) return 0;
    const tier = r.sourceTier || 0;

    if (tier === 3) {
      if (regionType === 'backgroundMask') return 0.4;
      return 0.3;
    }

    if (tier === 2) {
      if (regionType === 'lipMask') return 0.9;
      if (regionType === 'eyeMask') return 0.85;
      if (regionType === 'scleraMask') return 0.8;   // PE-M1 — eye 폴리곤−홍채 기하. 안정적이라 scale 1.0 (≥0.7)

      if (regionType === 'skinMask') return r._subtracted ? 0.85 : 0.7;
      if (regionType === 'hairMask') return 0.5;          // foreheadTop polygon (approx)
      if (regionType === 'hairBoundaryMask') return 0.5;
      if (regionType === 'eyelashBandMask') return r._lowConfidence ? 0.3 : 0.55;
      return 0.6;
    }

    if (tier === 1) {
      if (regionType === 'hairMask') return 0.85;        // hair-specific segmenter
      if (regionType === 'nailMask' || regionType === 'handSkinMask') {
        const s = r.handsAvgScore || 0;
        return Math.min(0.95, Math.max(0.6, s));
      }
      return 0.8;
    }
    return 0.5;
  }

  window.MaskConfidence = { compute };
})();
