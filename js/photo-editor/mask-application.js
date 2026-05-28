/* 사진 편집기 — 마스크 → beauty engine 적용 어댑터 (v316 2026-05-29)

   목적: RegionMaskProvider 결과 중 v316 1차 연결 대상만 골라서 beauty-engine 픽셀 walk 에
         전달 가능한 형태로 빌드.

   1차 연결: skinMask, hairMask, lipMask, eyeMask
   약하게:   hairBoundaryMask (cap 0.6)
   보류:     eyelashBandMask, nailMask, handSkinMask, backgroundMask  (이번 PR 미연결)

   confidence 정책:
     - >= 0.7 → scale 1.0
     - 0.4 ~ 0.7 → scale 0.6
     - < 0.4 또는 mask 없음 → useMasks 제외 → beauty-engine 이 v312 휴리스틱 fallback
     - hairBoundary 는 scale 상한 0.6

   비상 off:
     localStorage.PE_MASK_DISABLE='1' → null 반환 → 완전 v312 동작

   외부 의존: RegionMaskProvider
*/
(function () {
  'use strict';
  if (window.MaskApplication) return;

  // v316 1차 연결 대상
  const V316_FIRST = ['skinMask', 'hairMask', 'lipMask', 'eyeMask', 'hairBoundaryMask'];

  function _disabled() {
    try {
      if (window.localStorage && localStorage.getItem('PE_MASK_DISABLE') === '1') return true;
    } catch (_e) { /* ignore */ }
    return false;
  }

  function _scaleOf(maskType, confidence) {
    if (confidence >= 0.7) {
      // hairBoundary 는 항상 cap 0.6
      if (maskType === 'hairBoundaryMask') return 0.6;
      return 1.0;
    }
    if (confidence >= 0.4) return 0.6;
    return 0;  // 제외 — 호출자에서 useMasks 에 안 담음
  }

  // img → { useMasks: {key→Float32Array}, _scale: {key→0.6|1.0}, meta: {summary} } | null
  async function getMasksForBeauty(img) {
    if (!img) return null;
    if (_disabled()) return null;
    const RP = window.RegionMaskProvider;
    if (!RP || typeof RP.getMask !== 'function') return null;

    const useMasks = {};
    const _scale = {};
    const meta = {};

    for (const k of V316_FIRST) {
      let r = null;
      try { r = await RP.getMask(img, k); }
      catch (_e) { r = null; }
      if (!r || !r.mask) { meta[k] = { skipped: true, reason: 'no mask' }; continue; }
      const conf = r.confidence || 0;
      const scale = _scaleOf(k, conf);
      if (scale <= 0) {
        meta[k] = { skipped: true, reason: 'conf<0.4 → fallback to heuristic', confidence: conf };
        continue;
      }
      useMasks[k] = r.mask;
      _scale[k] = scale;
      meta[k] = { applied: true, scale: scale, confidence: conf, tier: r.sourceTier, status: r.status };
    }

    // 하나도 못 모으면 null → beauty-engine 완전 v312 동작
    if (!Object.keys(useMasks).length) return null;
    // maskW/maskH — 마스크는 원본 해상도로 빌드됨. 캔버스가 다운스케일됐을 때 좌표 환산용.
    return { useMasks: useMasks, _scale: _scale, meta: meta, maskW: (img.naturalWidth || img.width) | 0, maskH: (img.naturalHeight || img.height) | 0 };
  }

  // v316 — sync 버전. renderer 가 매 redraw 마다 호출.
  //   - Provider 캐시 hit 인 마스크만 useMasks 에 담음
  //   - 미캐시면 fire-and-forget 트리거 (다음 redraw 에 사용 가능)
  //   - 결과 없으면 null → beauty-engine 완전 v312 동작
  function getMasksForBeautySync(img) {
    if (!img) return null;
    if (_disabled()) return null;
    const RP = window.RegionMaskProvider;
    if (!RP || typeof RP.getCachedSync !== 'function') return null;

    const useMasks = {};
    const _scale = {};
    for (const k of V316_FIRST) {
      const r = RP.getCachedSync(img, k);
      if (!r || !r.mask) continue;          // 미캐시 → fire-and-forget 트리거됨, 다음 redraw 에 사용
      const scale = _scaleOf(k, r.confidence || 0);
      if (scale <= 0) continue;
      useMasks[k] = r.mask;
      _scale[k] = scale;
    }
    if (!Object.keys(useMasks).length) return null;
    return { useMasks: useMasks, _scale: _scale, maskW: (img.naturalWidth || img.width) | 0, maskH: (img.naturalHeight || img.height) | 0 };
  }

  // v317 — lashSharp 전용 eyelashBandMask sync 조회. conf≥0.4 일 때만 {mask, scale} 반환.
  //   eyelashBandMask 는 LAZY 라 첫 호출 시 getCachedSync 가 백그라운드 계산 트리거(1회), 이후 캐시 read.
  //   conf<0.4 / 미캐시 / PE_MASK_DISABLE → null → 호출자는 전역 unsharp fallback.
  function getLashMaskSync(img) {
    if (!img) return null;
    if (_disabled()) return null;
    const RP = window.RegionMaskProvider;
    if (!RP || typeof RP.getCachedSync !== 'function') return null;
    const r = RP.getCachedSync(img, 'eyelashBandMask');
    if (!r || !r.mask) return null;
    const scale = _scaleOf('eyelashBandMask', r.confidence || 0);
    if (scale <= 0) return null;
    return { mask: r.mask, scale: scale };
  }

  // 디버그용 — 콘솔에서 확인 가능
  function explain(img) {
    return getMasksForBeauty(img).then(r => {
      if (!r) { console.log('[MaskApplication] disabled or no useable mask — v312 휴리스틱 폴백'); return null; }
      console.table(Object.keys(r.meta).map(k => Object.assign({ mask: k }, r.meta[k])));
      return r;
    });
  }

  window.MaskApplication = {
    getMasksForBeauty,
    getMasksForBeautySync,
    getLashMaskSync,
    explain,
    V316_FIRST,
    _scaleOf,
  };
})();
