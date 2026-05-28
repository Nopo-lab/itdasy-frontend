/* 사진 편집기 — Hand Landmarker → nailMask / handSkinMask 어댑터
   (v332 2026-05-28; provider 분리)

   RegionMaskProvider 가 Tier 1 으로 호출.
   순수 함수 + MediaPipeLoader.detectHand / MaskRefine 헬퍼만 의존.
   실패 시 graceful null/empty 반환 — Provider 가 Tier 3 폴백.
*/
(function () {
  'use strict';
  if (window.MaskHandAdapter) return;

  // 21 landmarks: fingertip [4,8,12,16,20], 직전 관절 [3,7,11,15,19]
  const FINGERTIP_IDX   = [4, 8, 12, 16, 20];
  const FINGER_PREV_IDX = [3, 7, 11, 15, 19];

  function _ml() { return window.MediaPipeLoader || null; }
  function _rf() { return window.MaskRefine || null; }

  // v336 — handedness score 임계 0.7 (낮은 점수는 false-positive 가능성)
  const HAND_SCORE_MIN = 0.7;

  async function _detectHands(img) {
    const ML = _ml();
    if (!ML || typeof ML.detectHand !== 'function' || !img) return null;
    let hands = null;
    try { hands = await ML.detectHand(img); }
    catch (_e) { return null; }
    if (!hands || !hands.length) return null;
    // 점수 임계 미달 손은 제외
    const filtered = hands.filter(h => (h.score || 0) >= HAND_SCORE_MIN);
    return filtered.length ? filtered : null;
  }

  function _nailEllipseMask(hand, w, h, RF) {
    const acc = new Float32Array(w * h);
    if (!hand || !hand.landmarks) return acc;
    for (let i = 0; i < FINGERTIP_IDX.length; i++) {
      const tip = hand.landmarks[FINGERTIP_IDX[i]];
      const prev = hand.landmarks[FINGER_PREV_IDX[i]];
      if (!tip || !prev) continue;
      const dx = tip.x - prev.x, dy = tip.y - prev.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 4) continue;
      const angle = Math.atan2(dy, dx);
      // 손톱 중심: fingertip 에서 손가락 안쪽으로 15% 이동
      const cx = tip.x - dx * 0.15;
      const cy = tip.y - dy * 0.15;
      const rx = len * 0.35;
      const ry = len * 0.22;
      const m = RF.ellipseToMask(cx, cy, rx, ry, angle, w, h);
      for (let j = 0; j < acc.length; j++) if (m[j] > acc[j]) acc[j] = m[j];
    }
    return acc;
  }

  function _avgScore(hands) {
    if (!hands || !hands.length) return 0;
    let s = 0; for (const h of hands) s += (h.score || 0);
    return s / hands.length;
  }

  async function nailMask(img, sz) {
    const RF = _rf();
    if (!RF) return { status: 'failed', reason: 'mask-refine missing' };
    const hands = await _detectHands(img);
    if (!hands || !hands.length) return { status: 'noHand', reason: 'no hand detected (score < ' + HAND_SCORE_MIN + ' or empty)' };
    let union = new Float32Array(sz.w * sz.h);
    for (const hand of hands) {
      const m = _nailEllipseMask(hand, sz.w, sz.h, RF);
      union = RF.unionMask(union, m);
    }
    const featherR = Math.max(2, Math.round(Math.min(sz.w, sz.h) * 0.003));
    const feathered = RF.gaussianFeather(union, sz.w, sz.h, featherR);
    const coverage = RF.maskCoverage(feathered);
    if (coverage < 0.001) return { status: 'noHand', reason: 'nail union empty (degenerate landmarks)' };
    return {
      status: 'ready',
      mask: feathered,
      handsAvgScore: _avgScore(hands),
      handsCount: hands.length,
      coverage: coverage,
      featherRadius: featherR,
      reason: 'Hand Landmarker fingertip ellipse',
    };
  }

  async function handSkinMask(img, sz) {
    const RF = _rf();
    if (!RF) return { status: 'failed', reason: 'mask-refine missing' };
    const hands = await _detectHands(img);
    if (!hands || !hands.length) return { status: 'noHand', reason: 'no hand detected' };
    let union = new Float32Array(sz.w * sz.h);
    for (const hand of hands) {
      const hull = RF.convexHull(hand.landmarks);
      if (hull.length < 3) continue;
      const m = RF.polygonToMask(hull, sz.w, sz.h);
      union = RF.unionMask(union, m);
    }
    // 손톱 빼기 — nailMask 동일 캐시(detectHand promise) 재사용
    const nail = await nailMask(img, sz);
    if (nail && nail.mask) union = RF.subtractMask(union, nail.mask);
    const featherR = Math.max(3, Math.round(Math.min(sz.w, sz.h) * 0.004));
    const feathered = RF.gaussianFeather(union, sz.w, sz.h, featherR);
    const coverage = RF.maskCoverage(feathered);
    if (coverage < 0.005) return { status: 'noHand', reason: 'hand-skin coverage too low' };
    return {
      status: 'ready',
      mask: feathered,
      handsAvgScore: _avgScore(hands),
      handsCount: hands.length,
      coverage: coverage,
      featherRadius: featherR,
      reason: 'Hand Landmarker convex hull − nailMask',
    };
  }

  window.MaskHandAdapter = { nailMask, handSkinMask };
})();
