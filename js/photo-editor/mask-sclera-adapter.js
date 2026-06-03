/* 사진 편집기 — scleraMask 어댑터 (PE-M1 2026-06-03)

   흰자(공막) 정밀 마스크 = (leftEye ∪ rightEye 폴리곤) − (좌/우 홍채 타원) → feather.
   eyeRedness 의 "영역 게이트" 전용. 색 refine(밝음/저채도/중성/warmBrown 제외)은
   엔진(_applyEye)에서 그대로 유지 — 이 마스크는 영역만 좁혀줄 뿐 강제 적용 아님.

   안전 원칙:
     - refineLandmarks(478) 없으면 홍채 인덱스(468~477) 부재 → null fallback (크래시 금지)
     - landmarks[i] undefined 접근 가드 (Number.isFinite 체크)
     - 홍채 추정 실패해도 eye 폴리곤 sclera 는 유효 (홍채 제거만 스킵)
     - 전 구간 try/catch → 실패 시 null → Provider 가 fallback 처리

   외부 의존: MediaPipeLoader(detect/regionPolygon), MaskRefine(polygonToMask/ellipseToMask/unionMask/subtractMask/gaussianFeather/maskCoverage)
*/
(function () {
  'use strict';
  if (window.MaskScleraAdapter) return;

  const IRIS_PAD = 1.15;   // 홍채 반경 여유 — 홍채 경계 색번짐을 sclera 에서 확실히 배제
  const FEATHER = 2;       // 경계 부드럽게 (eyeMask 와 동일 수준)
  const L_IRIS = [468, 469, 470, 471, 472];   // refineLandmarks 좌측 홍채(중심+ring)
  const R_IRIS = [473, 474, 475, 476, 477];   // 우측 홍채

  function _ml() { return window.MediaPipeLoader || null; }
  function _rf() { return window.MaskRefine || null; }

  // ring 인덱스 → 중심+반경 추정 → ellipse 마스크. 누락/undefined 안전. 실패 시 null.
  function _irisEllipse(landmarks, ringIdx, w, h) {
    const RF = _rf();
    if (!RF || typeof RF.ellipseToMask !== 'function') return null;
    let sx = 0, sy = 0;
    const pts = [];
    for (let i = 0; i < ringIdx.length; i++) {
      const p = landmarks[ringIdx[i]];
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      pts.push(p); sx += p.x; sy += p.y;
    }
    if (pts.length < 3) return null;                 // ring 점 부족 → 홍채 추정 불가
    const cx = sx / pts.length, cy = sy / pts.length;
    let r = 0;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - cx, pts[i].y - cy);
      if (d > r) r = d;
    }
    if (!(r > 0)) return null;
    r *= IRIS_PAD;
    try { return RF.ellipseToMask(cx, cy, r, r, 0, w, h); }
    catch (_e) { return null; }
  }

  // img → MaskResult | null. confidence 는 Provider 가 MaskConfidence.compute 로 재계산.
  async function scleraMask(img, size) {
    const ML = _ml(), RF = _rf();
    if (!ML || !RF || !img) return null;
    if (typeof ML.detect !== 'function' || typeof ML.regionPolygon !== 'function') return null;
    const w = (size && size.w) || img.naturalWidth || img.width || 0;
    const h = (size && size.h) || img.naturalHeight || img.height || 0;
    if (!w || !h) return null;

    let lm = null;
    try { lm = await ML.detect(img); } catch (_e) { return null; }
    // 조건#3 — 478 landmark(refineLandmarks) 아니면 홍채 인덱스 없음 → null fallback
    if (!lm || lm.length < 478) return null;

    let eyeRegion;
    try {
      const lEye = ML.regionPolygon(lm, 'leftEye');
      const rEye = ML.regionPolygon(lm, 'rightEye');
      if (!lEye || !rEye || lEye.length < 3 || rEye.length < 3) return null;
      eyeRegion = RF.unionMask(RF.polygonToMask(lEye, w, h), RF.polygonToMask(rEye, w, h));
    } catch (_e) { return null; }

    // 조건#4(기하 단계) — 색 있는 홍채를 sclera 영역에서 제거. 실패해도 eye 폴리곤 sclera 유지.
    try {
      const lIris = _irisEllipse(lm, L_IRIS, w, h);
      const rIris = _irisEllipse(lm, R_IRIS, w, h);
      if (lIris) eyeRegion = RF.subtractMask(eyeRegion, lIris);
      if (rIris) eyeRegion = RF.subtractMask(eyeRegion, rIris);
    } catch (_e) { /* 홍채 제거 스킵 — 엔진 색 refine 이 홍채 잔여 추가 차단 */ }

    let mask;
    try { mask = RF.gaussianFeather(eyeRegion, w, h, FEATHER); }
    catch (_e) { mask = eyeRegion; }

    const coverage = (typeof RF.maskCoverage === 'function') ? RF.maskCoverage(mask) : 0;
    return {
      mask: mask,
      coverage: coverage,
      confidence: 0,                 // Provider 가 MaskConfidence.compute('scleraMask') 로 덮어씀
      sourceTier: 2,
      inferenceTimeMs: 0,
      status: coverage > 0.0001 ? 'ready' : 'fallback',
      featherRadius: FEATHER,
      reason: 'eye polygon (leftEye∪rightEye) − iris ellipse',
    };
  }

  window.MaskScleraAdapter = { scleraMask };
})();
