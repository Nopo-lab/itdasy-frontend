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

  // v350 — nailMask 안전 조건부 게이트 상수 (실사진 부족 시 이 값만 조정).
  const NAIL_CONF_MIN = 0.7;     // 최소 신뢰도 (Hand Landmarker ready 기준)
  const NAIL_COV_MIN  = 0.0005;  // 너무 작게 잡힌 마스크 거부 (점 단위 false-positive)
  const NAIL_COV_MAX  = 0.08;    // 너무 크게 잡힌 마스크 거부 (손 전체로 번진 경우)
  const NAIL_MASK_SCALE = 1.0;   // ready 일 때 mask 가중 배율

  // PE-M1 — scleraMask 안전 게이트 상수. 흰자는 작으므로 coverage 범위 좁게.
  const SCLERA_COV_MIN = 0.0002;  // 점 단위 false-positive 거부
  const SCLERA_COV_MAX_DEFAULT = 0.03;  // 손/배경 오검출 거부. 눈 클로즈업 정상사진서 reject 시 PE_SCLERA_COV_MAX 로 0.05 까지 상향
  const SCLERA_CONF_MIN = 0.4;    // 미달 → 휴리스틱 유지

  // PE-M2 — browMask 안전 게이트. 눈썹은 작으므로 coverage 범위 좁게. 미달 → 기존 eyeMask ROI fallback.
  const BROW_COV_MIN = 0.0003;
  const BROW_COV_MAX = 0.04;      // 과도(눈/이마 번짐 추정) → reject
  const BROW_CONF_MIN = 0.4;

  function _disabled() {
    try {
      if (window.localStorage && localStorage.getItem('PE_MASK_DISABLE') === '1') return true;
    } catch (_e) { /* ignore */ }
    return false;
  }

  // v350 — nailMask 전용 비상 off (PE_MASK_DISABLE 와 독립).
  function _nailDisabled() {
    try {
      if (window.localStorage && localStorage.getItem('PE_NAIL_MASK_DISABLE') === '1') return true;
    } catch (_e) { /* ignore */ }
    return false;
  }

  // v350 — nailMask 안전 게이트. 전부 통과해야 mask 사용, 하나라도 미달이면 false → 휴리스틱 유지.
  //   noHand/failed/fallback/pendingImplementation 은 status!=='ready' 또는 mask 없음 → 자동 false.
  function _nailGatePass(r) {
    if (!r || r.status !== 'ready' || !r.mask) return false;
    if (r.sourceTier !== 1) return false;                  // Hand Landmarker(Tier1)만 신뢰 — Tier3 휴리스틱 마스크 거부
    if ((r.confidence || 0) < NAIL_CONF_MIN) return false;
    const cov = r.coverage || 0;
    if (cov < NAIL_COV_MIN || cov > NAIL_COV_MAX) return false;
    return true;
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

  // v350 — nailGloss/nailShape 전용 nailMask sync 조회. 게이트 통과 시에만 {mask, scale}.
  //   getLashMaskSync 미러. noHand/저신뢰/미캐시/PE_NAIL_MASK_DISABLE → null → 호출자는 v348 휴리스틱 유지.
  //   nailMask 는 LAZY → 첫 호출 시 getCachedSync 가 백그라운드 계산 1회 트리거, 이후 캐시 read.
  function getNailMaskSync(img) {
    if (!img) return null;
    if (_disabled() || _nailDisabled()) return null;
    const RP = window.RegionMaskProvider;
    if (!RP || typeof RP.getCachedSync !== 'function') return null;
    const r = RP.getCachedSync(img, 'nailMask');
    if (!_nailGatePass(r)) return null;
    return { mask: r.mask, scale: NAIL_MASK_SCALE, confidence: r.confidence, coverage: r.coverage, tier: r.sourceTier };
  }

  // [v546] handSkin 전용 handSkinMask sync 조회 — 손/네일 사진에서 손 피부톤이 face skinMask 대신
  //   hand ROI 를 쓰게. getNailMaskSync 미러. 미캐시/실패 → null → 엔진은 기존 skinW 폴백(얼굴 사진 무영향).
  function getHandSkinMaskSync(img) {
    if (!img) return null;
    if (_disabled()) return null;
    const RP = window.RegionMaskProvider;
    if (!RP || typeof RP.getCachedSync !== 'function') return null;
    const r = RP.getCachedSync(img, 'handSkinMask');
    if (!r || r.status !== 'ready' || !r.mask || (r.coverage || 0) < 0.01) return null;
    return { mask: r.mask, scale: 1, confidence: r.confidence, coverage: r.coverage, tier: r.sourceTier };
  }

  // PE-M1 — scleraMask 전용 비상 off (PE_MASK_DISABLE 와 독립). disable 시 PE-ER 동결 버전과 pixel-identical.
  function _scleraDisabled() {
    try {
      if (window.localStorage && localStorage.getItem('PE_SCLERA_MASK_DISABLE') === '1') return true;
    } catch (_e) { /* ignore */ }
    return false;
  }

  // PE-M1 — coverage 상한 런타임 튜닝 (눈 클로즈업 정상사진이 reject 되면 PE_SCLERA_COV_MAX='0.05').
  function _scleraCovMax() {
    try {
      const v = window.localStorage && parseFloat(localStorage.getItem('PE_SCLERA_COV_MAX'));
      if (Number.isFinite(v) && v > 0 && v <= 0.2) return v;
    } catch (_e) { /* ignore */ }
    return SCLERA_COV_MAX_DEFAULT;
  }

  // PE-M1 — scleraMask 안전 게이트. Tier2(landmark) + conf≥0.4 + coverage 범위. 미달 → null → 휴리스틱 유지.
  function _scleraGatePass(r) {
    if (!r || r.status !== 'ready' || !r.mask) return false;
    if (r.sourceTier !== 2) return false;
    if ((r.confidence || 0) < SCLERA_CONF_MIN) return false;
    const cov = r.coverage || 0;
    if (cov < SCLERA_COV_MIN || cov > _scleraCovMax()) return false;
    return true;
  }

  // PE-M1 — eyeRedness 전용 scleraMask sync 조회. getNailMaskSync 미러.
  //   게이트 미통과/미캐시/disable → null → beauty-engine 이 기존 PE-ER 휴리스틱(eyeW) 유지.
  //   scleraMask 는 LAZY → 첫 호출 시 getCachedSync 가 백그라운드 계산 1회 트리거, 이후 캐시 read.
  function getScleraMaskSync(img) {
    if (!img) return null;
    if (_disabled() || _scleraDisabled()) return null;
    const RP = window.RegionMaskProvider;
    if (!RP || typeof RP.getCachedSync !== 'function') return null;
    const r = RP.getCachedSync(img, 'scleraMask');
    if (!_scleraGatePass(r)) return null;
    return { mask: r.mask, scale: _scaleOf('scleraMask', r.confidence || 0), confidence: r.confidence, coverage: r.coverage, tier: r.sourceTier };
  }

  // PE-M2 — browMask 전용 비상 off. disable 시 browSharp 는 기존 eyeMask 상단 ROI 경로 유지.
  function _browDisabled() {
    try {
      if (window.localStorage && localStorage.getItem('PE_BROW_MASK_DISABLE') === '1') return true;
    } catch (_e) { /* ignore */ }
    return false;
  }

  // PE-M2 — browMask 안전 게이트. Tier2(landmark) + conf≥0.4 + coverage 범위. 미달 → null → 기존 fallback.
  function _browGatePass(r) {
    if (!r || r.status !== 'ready' || !r.mask) return false;
    if (r.sourceTier !== 2) return false;
    if ((r.confidence || 0) < BROW_CONF_MIN) return false;
    const cov = r.coverage || 0;
    if (cov < BROW_COV_MIN || cov > BROW_COV_MAX) return false;
    return true;
  }

  // PE-M2 — browSharp 전용 browMask sync 조회. getScleraMaskSync 미러.
  //   게이트 미통과/미캐시/disable → null → beauty-engine 이 기존 eyeMask 상단 ROI → 약한 전역 유지.
  //   browMask 는 LAZY → 첫 호출 시 getCachedSync 가 백그라운드 계산 1회 트리거, 이후 캐시 read.
  function getBrowMaskSync(img) {
    if (!img) return null;
    if (_disabled() || _browDisabled()) return null;
    const RP = window.RegionMaskProvider;
    if (!RP || typeof RP.getCachedSync !== 'function') return null;
    const r = RP.getCachedSync(img, 'browMask');
    if (!_browGatePass(r)) return null;
    return { mask: r.mask, scale: _scaleOf('browMask', r.confidence || 0), confidence: r.confidence, coverage: r.coverage, tier: r.sourceTier };
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
    getNailMaskSync,
    getHandSkinMaskSync,
    getScleraMaskSync,
    getBrowMaskSync,
    explain,
    V316_FIRST,
    _scaleOf,
    _nailGatePass,
    _scleraGatePass,
    _browGatePass,
  };
})();
