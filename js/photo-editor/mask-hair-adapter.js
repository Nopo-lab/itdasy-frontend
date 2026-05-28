/* 사진 편집기 — Hair Image Segmenter → hairMask Tier 1 어댑터 (v336 2026-05-29; provider 분리)

   MediaPipeLoader.segmentHair → Float32Array mask (sz 크기) 변환.
   호출자(provider) 가 status:'ready'/'fallback'/'failed' 판정 후 사용.

   외부 의존: MediaPipeLoader, MaskRefine
*/
(function () {
  'use strict';
  if (window.MaskHairAdapter) return;

  function _ml() { return window.MediaPipeLoader || null; }
  function _rf() { return window.MaskRefine || null; }

  async function hairMask(img, sz) {
    const ML = _ml(), RF = _rf();
    if (!ML || !RF || typeof ML.segmentHair !== 'function') {
      return { status: 'failed', reason: 'image segmenter unavailable' };
    }
    if (!sz || !sz.w || !sz.h) return { status: 'failed', reason: 'invalid image size' };
    let seg = null;
    try { seg = await ML.segmentHair(img); }
    catch (e) { return { status: 'failed', reason: 'segmentHair error: ' + (e && e.message) }; }
    if (!seg || !seg.mask || !seg.mask.length) return { status: 'fallback', reason: 'segmenter returned empty' };
    const sw = seg.w | 0, sh = seg.h | 0;
    if (!sw || !sh) return { status: 'failed', reason: 'segmenter mask dims missing' };
    // hair_segmenter.tflite: category 1 = hair. nearest-neighbor 리샘플
    const out = new Float32Array(sz.w * sz.h);
    for (let y = 0; y < sz.h; y++) {
      const sy = Math.min(sh - 1, Math.floor(y * sh / sz.h));
      const dstRow = y * sz.w;
      const srcRow = sy * sw;
      for (let x = 0; x < sz.w; x++) {
        const sx = Math.min(sw - 1, Math.floor(x * sw / sz.w));
        out[dstRow + x] = seg.mask[srcRow + sx] >= 1 ? 1 : 0;
      }
    }
    const featherRadius = Math.max(3, Math.round(Math.min(sz.w, sz.h) * 0.004));
    const feathered = RF.gaussianFeather(out, sz.w, sz.h, featherRadius);
    const coverage = RF.maskCoverage(feathered);
    if (coverage < 0.005) return { status: 'fallback', reason: 'segmenter coverage too low' };
    return {
      status: 'ready',
      mask: feathered,
      coverage: coverage,
      featherRadius: featherRadius,
      reason: 'hair_segmenter.tflite (Tier 1)',
    };
  }

  window.MaskHairAdapter = { hairMask };
})();
