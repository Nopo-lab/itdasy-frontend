/* 사진 편집기 — 마스크 QA 도구 (v335 2026-05-29)

   v316 beauty-engine 연결 전 마스크 품질 수동 검증용. 사용자가 콘솔에서 호출.

   사용:
     // 1) 사진편집기에서 사진 업로드 후 콘솔에서:
     await RegionMaskQA.runOnCurrentImage()
     //    → console.table 9행 (각 마스크별 측정 결과 + 자동 검사)
     //    → returns 결과 JSON 객체

     // 2) 시각 확인 (디버그 오버레이 ON):
     RegionMaskQA.visualize()
     //    → 마스크 색이 사진 위에 표시 (pointer-events:none)

     // 3) 결과 JSON 클립보드 복사:
     await RegionMaskQA.copyResultsAsJSON()

   비활성 default — 호출 시에만 동작. 보정/UI 영향 0.

   외부 의존: RegionMaskProvider, MaskDebugOverlay, PhotoEditor.
*/
(function () {
  'use strict';
  if (window.RegionMaskQA) return;

  const REGION_TYPES = [
    'skinMask', 'hairMask', 'hairBoundaryMask',
    'lipMask', 'eyeMask', 'eyelashBandMask',
    'nailMask', 'handSkinMask', 'backgroundMask',
  ];

  function _getCurrentImage() {
    const PE = window.PhotoEditor;
    if (!PE || !PE._internal || typeof PE._internal.getState !== 'function') return null;
    const st = PE._internal.getState();
    return (st && st.originalImg) ? st.originalImg : null;
  }

  function _imgSize(img) {
    return {
      w: img ? (img.naturalWidth || img.width || 0) : 0,
      h: img ? (img.naturalHeight || img.height || 0) : 0,
    };
  }

  // 두 마스크의 overlap 비율 (intersection / union) — false-positive 추정 보조
  function _maskOverlap(a, b) {
    if (!a || !b || !a.length || a.length !== b.length) return 0;
    let inter = 0, uni = 0;
    for (let i = 0; i < a.length; i++) {
      const va = a[i] >= 0.4 ? 1 : 0;
      const vb = b[i] >= 0.4 ? 1 : 0;
      if (va && vb) inter++;
      if (va || vb) uni++;
    }
    return uni > 0 ? inter / uni : 0;
  }

  // 단일 마스크 측정
  async function _measureOne(img, regionType) {
    const t0 = performance.now ? performance.now() : Date.now();
    let r = null;
    try { r = await window.RegionMaskProvider.getMask(img, regionType); }
    catch (e) { r = { status: 'failed', confidence: 0, coverage: 0, sourceTier: 0, reason: e.message }; }
    const t1 = performance.now ? performance.now() : Date.now();
    return {
      maskType: regionType,
      sourceTier: r.sourceTier || 0,
      status: r.status || 'failed',
      coverage: +(r.coverage || 0).toFixed(4),
      confidence: +(r.confidence || 0).toFixed(3),
      inferenceTimeMs: r.inferenceTimeMs || Math.round(t1 - t0),
      reason: r.reason || '',
      _mask: r.mask || null,
    };
  }

  // 9종 마스크 일괄 측정 + 자동 false-positive 추정 + v316 권고
  async function measureAll(img) {
    if (!img) { console.warn('[QA] no image — 사진편집기에서 사진 업로드 후 다시 호출'); return null; }
    const sz = _imgSize(img);
    console.groupCollapsed('[RegionMaskQA] measuring 9 masks on ' + sz.w + 'x' + sz.h);
    const t0 = performance.now ? performance.now() : Date.now();
    const results = {};
    for (const t of REGION_TYPES) results[t] = await _measureOne(img, t);
    const totalMs = Math.round((performance.now ? performance.now() : Date.now()) - t0);

    // false-positive 추정 (배경과의 overlap, 양립 불가 마스크 쌍 overlap)
    const fpChecks = {
      hair_vs_bg:    _maskOverlap(results.hairMask._mask, results.backgroundMask._mask),
      skin_vs_bg:    _maskOverlap(results.skinMask._mask, results.backgroundMask._mask),
      hair_vs_skin:  _maskOverlap(results.hairMask._mask, results.skinMask._mask),
      nail_vs_skin:  _maskOverlap(results.nailMask._mask, results.skinMask._mask),
      eye_vs_eyelash:_maskOverlap(results.eyeMask._mask, results.eyelashBandMask._mask),
    };

    // 표 출력용 (mask 객체 제거)
    const table = REGION_TYPES.map(t => {
      const r = results[t];
      const reco = _v316Reco(r);
      return {
        mask: t,
        tier: r.sourceTier,
        status: r.status,
        coverage: r.coverage,
        confidence: r.confidence,
        ms: r.inferenceTimeMs,
        v316: reco.label,
        reason: r.reason.slice(0, 40),
      };
    });
    console.table(table);

    console.log('[QA] total ' + totalMs + 'ms (sequential, precompute 캐시 hit 가능)');
    console.log('[QA] false-positive overlap (0 가 좋음, 0.3+ 위험):');
    console.table(Object.entries(fpChecks).map(([k, v]) => ({
      check: k, overlap: +v.toFixed(3),
      ok: v < 0.1 ? '✅' : (v < 0.3 ? '⚠️' : '❌'),
    })));

    console.log('[QA] 다음 단계:');
    console.log('  - RegionMaskQA.visualize() → 사진 위 마스크 색 오버레이');
    console.log('  - await RegionMaskQA.copyResultsAsJSON() → 결과 JSON 클립보드 복사');
    console.groupEnd();
    return { sizeWxH: sz, totalMs: totalMs, table: table, fpChecks: fpChecks, results: results };
  }

  // v316 자동 적용 권고 — 사용자가 plan 에서 정한 임계와 일치
  function _v316Reco(r) {
    if (r.status === 'pendingImplementation') return { label: 'X-not-impl', strength: 0 };
    if (r.status === 'failed') return { label: 'X-failed', strength: 0 };
    // eyelash/nail 은 conservative
    const conservative = (r.maskType === 'eyelashBandMask' || r.maskType === 'nailMask');
    const c = r.confidence;
    if (c >= 0.7) return { label: 'AUTO-1.0x', strength: 1.0 };
    if (c >= 0.4) return { label: conservative ? 'WEAK-0.4x' : 'WEAK-0.6x', strength: conservative ? 0.4 : 0.6 };
    return { label: 'BRUSH-only', strength: 0 };
  }

  async function runOnCurrentImage() {
    const img = _getCurrentImage();
    return measureAll(img);
  }

  function visualize() {
    if (!window.MaskDebugOverlay) { console.warn('[QA] MaskDebugOverlay 없음'); return false; }
    window.MaskDebugOverlay.setEnabled(true);
    const img = _getCurrentImage();
    if (img && window.RegionMaskProvider) {
      // precompute 후 overlay 자동 렌더 — 다시 trigger
      window.RegionMaskProvider.invalidate(img);
      window.RegionMaskProvider.precompute(img).catch(() => {});
      console.log('[QA] 디버그 오버레이 ON. 캔버스 위에 마스크 색 표시 (피부 핑크 / 헤어 시안 / 입술 빨강 / 눈 노랑 / 배경 회색).');
      console.log('     OFF: localStorage.removeItem("PE_MASK_DEBUG"); location.reload()');
    }
    return true;
  }

  async function copyResultsAsJSON() {
    const last = await runOnCurrentImage();
    if (!last) return false;
    // _mask Float32Array 제거 (JSON 직렬화 무거움)
    const clean = JSON.parse(JSON.stringify(last, (k, v) => k === '_mask' ? undefined : v));
    const json = JSON.stringify(clean, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      console.log('[QA] 결과 JSON 클립보드 복사 완료 (' + json.length + ' chars)');
      return true;
    } catch (e) {
      console.warn('[QA] clipboard 쓰기 실패:', e.message);
      console.log(json);
      return false;
    }
  }

  window.RegionMaskQA = {
    measureAll, runOnCurrentImage, visualize, copyResultsAsJSON,
    REGION_TYPES,
  };

  console.log('[QA] RegionMaskQA loaded. await RegionMaskQA.runOnCurrentImage() 로 측정.');
})();
