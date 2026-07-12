/* 손·네일 ROI 필수 정책 — 실제 검출 실패 시 보정 중단 + 사용자 안내 */
(function () {
  'use strict';
  if (window.MaskStrictPolicy) return;

  const baseSeen = new WeakSet();
  const strictSeen = new WeakMap();
  const lastToast = {};

  function _strictKey(beauty) {
    return ((beauty.handSkin || 0) > 0 ? 'hand' : '') +
      (((beauty.nailGloss || 0) > 0 || (beauty.nailShape || 0) > 10) ? 'nail' : '') +
      ((beauty.eyeRedness || 0) > 0 ? 'sclera' : '');   // [v552] 눈맑게 — 흰자 미검출 안내
  }

  function _claimStrict(img, key) {
    if (!key) return false;
    let seen = strictSeen.get(img);
    if (!seen) { seen = new Set(); strictSeen.set(img, seen); }
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }

  function _notify(failures) {
    if (!failures || !failures.length || !window.showToast) return;
    const now = Date.now();
    failures.forEach(kind => {
      if (now - (lastToast[kind] || 0) < 1500) return;
      lastToast[kind] = now;
      const msg = kind === 'hand' ? '손을 인식하지 못했습니다'
        : kind === 'nail' ? '네일을 인식하지 못했습니다'
        : '흰자 영역을 인식하지 못했습니다';   // [v552] sclera
      window.showToast(msg);
    });
  }

  function warm(img, beauty, onReady) {
    const MA = window.MaskApplication;
    if (!img || !MA) return;
    const jobs = [];
    if (!baseSeen.has(img) && typeof MA.getMasksForBeauty === 'function') {
      baseSeen.add(img);
      jobs.push(MA.getMasksForBeauty(img));
    }
    if (_claimStrict(img, _strictKey(beauty || {})) && typeof MA.prepareStrictMasks === 'function') {
      jobs.push(MA.prepareStrictMasks(img, beauty || {}));
    }
    if (!jobs.length) return;
    Promise.all(jobs).then(results => {
      _notify(results[results.length - 1]);
      if (typeof onReady === 'function') onReady();
    }).catch(() => {});
  }

  window.MaskStrictPolicy = { warm };
})();
