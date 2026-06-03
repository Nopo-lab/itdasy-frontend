/* 사진 편집기 — browMask 어댑터 (PE-M2 2026-06-04)

   눈썹 정밀 마스크 = 좌/우 눈썹 랜드마크 convex hull polygon → union → feather.
   browSharp 의 "영역 게이트" 전용. 없으면 엔진이 기존 eyeMask 상단 ROI → 약한 전역으로 fallback.
   계수/알고리즘은 엔진 그대로 — 이 마스크는 샤픈 ROI 소스만 제공.

   안전 원칙:
     - 눈썹 랜드마크 부족/측면/가림 → null (엔진이 기존 fallback)
     - landmarks[i] undefined 가드 (Number.isFinite)
     - convexHull 로 polygon 단순화 → 자기교차/순서 오류 방지
     - 전 구간 try/catch → 실패 시 null

   외부 의존: MediaPipeLoader(detect), MaskRefine(convexHull/polygonToMask/unionMask/gaussianFeather/maskCoverage)
*/
(function () {
  'use strict';
  if (window.MaskBrowAdapter) return;

  const FEATHER = 2;
  // FaceMesh 눈썹 랜드마크(상단+하단). 좌/우 각 10점. (refineLandmarks 없이도 ≤468 에 존재하나 안전 가드)
  const L_BROW = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46];
  const R_BROW = [336, 296, 334, 293, 300, 285, 295, 282, 283, 276];

  function _ml() { return window.MediaPipeLoader || null; }
  function _rf() { return window.MaskRefine || null; }

  // idx 랜드마크 → convex hull polygon. 점 부족/누락 안전. 실패 시 null.
  function _browPoly(landmarks, idx) {
    const pts = [];
    for (let i = 0; i < idx.length; i++) {
      const p = landmarks[idx[i]];
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) pts.push({ x: p.x, y: p.y });
    }
    if (pts.length < 3) return null;
    const RF = _rf();
    try { return (RF && typeof RF.convexHull === 'function') ? RF.convexHull(pts) : pts; }
    catch (_e) { return pts; }
  }

  // img → MaskResult | null. confidence 는 Provider 가 MaskConfidence.compute('browMask') 로 재계산.
  async function browMask(img, size) {
    const ML = _ml(), RF = _rf();
    if (!ML || !RF || !img || typeof ML.detect !== 'function') return null;
    const w = (size && size.w) || img.naturalWidth || img.width || 0;
    const h = (size && size.h) || img.naturalHeight || img.height || 0;
    if (!w || !h) return null;

    let lm = null;
    try { lm = await ML.detect(img); } catch (_e) { return null; }
    if (!lm || lm.length < 468) return null;          // 눈썹 인덱스 부재 → fallback

    let mask;
    try {
      const lp = _browPoly(lm, L_BROW), rp = _browPoly(lm, R_BROW);
      if ((!lp || lp.length < 3) && (!rp || rp.length < 3)) return null;
      let m = new Float32Array(w * h);
      if (lp && lp.length >= 3) m = RF.unionMask(m, RF.polygonToMask(lp, w, h));
      if (rp && rp.length >= 3) m = RF.unionMask(m, RF.polygonToMask(rp, w, h));
      mask = RF.gaussianFeather(m, w, h, FEATHER);
    } catch (_e) { return null; }

    const coverage = (typeof RF.maskCoverage === 'function') ? RF.maskCoverage(mask) : 0;
    return {
      mask: mask,
      coverage: coverage,
      confidence: 0,                 // Provider 가 MaskConfidence.compute('browMask') 로 덮어씀
      sourceTier: 2,
      inferenceTimeMs: 0,
      status: coverage > 0.0001 ? 'ready' : 'fallback',
      featherRadius: FEATHER,
      reason: 'eyebrow landmark convex hull (L+R)',
    };
  }

  window.MaskBrowAdapter = { browMask };
})();
