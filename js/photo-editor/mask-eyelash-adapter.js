/* 사진 편집기 — eyelashBandMask 어댑터 (v333 2026-05-29)

   알고리즘:
     1. MediaPipe Face Landmarker → leftEye / rightEye polygon
     2. 각 eye polygon 을 위로 6% (sz.h * 0.06) shift 한 polygon 생성
        → upper polygon mask − 원 eye mask = "눈 위쪽 얇은 band"
     3. band 내부에서 Sobel edge × (1 - luminance) 곱셈 → dark-line 강조 mask
     4. band ∩ darkLine = 속눈썹 결만 남김
     5. feather + coverage 검증

   confidence < 0.05 → status:'fallback' (자동 적용 안 함, v316 에서 brush UI 안내)

   외부 의존: MediaPipeLoader.detect/regionPolygon, MaskRefine
   실패 시 graceful null. Provider 가 Tier 3 폴백.
*/
(function () {
  'use strict';
  if (window.MaskEyelashAdapter) return;

  function _ml() { return window.MediaPipeLoader || null; }
  function _rf() { return window.MaskRefine || null; }

  function _imgSize(img) {
    const w = (img && (img.naturalWidth || img.width)) | 0;
    const h = (img && (img.naturalHeight || img.height)) | 0;
    return { w, h };
  }

  // Sobel edge × darkness — 사진을 그대로 사용 (다운샘플은 v315 튜닝).
  // 다크라인이 강한 픽셀일수록 1 에 가까움 (속눈썹 결 후보).
  function _darkEdgeMask(img, sz) {
    const RF = _rf();
    if (!RF) return null;
    try {
      const cv = document.createElement('canvas');
      cv.width = sz.w; cv.height = sz.h;
      const ctx = cv.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, sz.w, sz.h);
      const edge = RF.sobelEdgeStrength(cv);
      const data = ctx.getImageData(0, 0, sz.w, sz.h).data;
      const out = new Float32Array(sz.w * sz.h);
      for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
        // edge × (1 - lum) — 어두우면서 edge 강한 곳
        let v = edge[j] * (1 - lum) * 1.6;
        if (v > 1) v = 1;
        out[j] = v;
      }
      return out;
    } catch (e) {
      console.warn('[eyelash] darkEdge fail:', e && e.message);
      return null;
    }
  }

  function _upperBand(landmarks, regionName, shiftY, sz) {
    const ML = _ml(), RF = _rf();
    if (!ML || !RF) return null;
    const orig = ML.regionPolygon(landmarks, regionName);
    if (!orig || orig.length < 3) return null;
    const upper = orig.map(p => ({ x: p.x, y: p.y + shiftY }));
    const mOrig = RF.polygonToMask(orig, sz.w, sz.h);
    const mUp = RF.polygonToMask(upper, sz.w, sz.h);
    // upper - orig = 위쪽 band 만 남음
    return RF.subtractMask(mUp, mOrig);
  }

  async function eyelashBandMask(img) {
    const ML = _ml(), RF = _rf();
    if (!ML || !RF || !img) return null;
    let landmarks = null;
    try { landmarks = await ML.detect(img); }
    catch (_e) { return null; }
    if (!landmarks || !landmarks.length) return null;
    const sz = _imgSize(img);
    if (!sz.w || !sz.h) return null;
    const shiftY = -sz.h * 0.06;
    const bandL = _upperBand(landmarks, 'leftEye', shiftY, sz);
    const bandR = _upperBand(landmarks, 'rightEye', shiftY, sz);
    if (!bandL && !bandR) return null;
    let band = new Float32Array(sz.w * sz.h);
    if (bandL) band = RF.unionMask(band, bandL);
    if (bandR) band = RF.unionMask(band, bandR);
    // Sobel × darkness refinement
    const darkEdge = _darkEdgeMask(img, sz);
    let refined = band;
    if (darkEdge) {
      refined = RF.intersectMask(band, darkEdge);
    }
    const featherR = 2;
    const feathered = RF.gaussianFeather(refined, sz.w, sz.h, featherR);
    const coverage = RF.maskCoverage(feathered);
    if (coverage < 0.0005) return null;
    const confidence = RF.maskConfidence(feathered, 0.3);
    return {
      mask: feathered,
      confidence: confidence,
      coverage: coverage,
      featherRadius: featherR,
      // confidence 낮으면 호출자가 자동 적용 안 하도록 status:'fallback' 으로 표기
      _lowConfidence: confidence < 0.05,
      reason: 'eye polygon upper band ∩ Sobel dark-line',
    };
  }

  window.MaskEyelashAdapter = { eyelashBandMask };
})();
