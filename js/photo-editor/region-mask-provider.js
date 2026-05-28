/* 사진 편집기 — RegionMaskProvider (v313 2026-05-28)

   부위별 마스크 4-tier fallback dispatcher.
     Tier 1: 온디바이스 AI segmentation  (v313 에선 미사용)
     Tier 2: MediaPipe Face Landmarker polygon
     Tier 3: 색상/위치 휴리스틱 (SmartMask)
     Tier 4: 사용자 브러시 (v315+ UI 연결)

   v313 정책:
     - 가벼운 5종 (skin/hair/lip/eye/background) 만 precompute
     - nail/handSkin/eyelashBand/hairBoundary 는 lazy (필요 시 getMask)
     - nailMask 는 status: 'pendingImplementation' 반환 (Hand Landmarker 미사용)
     - 모든 진입점 try/catch — 실패해도 사진편집기에 영향 0
     - beauty-engine 에 연결 X (debug overlay + getStats 전용)

   API:
     window.RegionMaskProvider = {
       async precompute(imgSource, opts?)         → MaskMap   (가벼운 5종)
       async getMask(imgSource, regionType, opts?) → MaskResult
       getStats(imgSource)                        → Array<{maskType, sourceTier, coverage, confidence, inferenceTimeMs, status}>
       invalidate(imgSource)                      → void
       setDebug(enabled)                          → boolean
       isReady()                                  → boolean (provider 자체 로드 완료)
     };

   MaskResult = {
     mask: Float32Array | null,
     confidence: number 0~1,
     coverage: number 0~1,
     sourceTier: 1 | 2 | 3 | 4,
     inferenceTimeMs: number,
     status: 'ready' | 'fallback' | 'notReady' | 'pendingImplementation' | 'failed',
     featherRadius?: number,
     reason?: string,
   };
*/
(function () {
  'use strict';
  if (window.RegionMaskProvider) return;

  // ── 의존성 guard (없으면 fallback 모드로 동작) ───────────────
  function _getRefine()    { return window.MaskRefine || null; }
  function _getOverlay()   { return window.MaskDebugOverlay || null; }
  function _getMediaPipe() { return window.MediaPipeLoader || null; }
  function _getSmartMask() { return window.PhotoEditorSmartMask || null; }

  // ── 캐시 (WeakMap — img GC 되면 자동 해제) ────────────────
  const _cache = new WeakMap();   // imgSource → Map<regionType, MaskResult>
  const _inflight = new WeakMap(); // imgSource → Map<regionType, Promise<MaskResult>>

  function _getCacheBucket(img) {
    if (!img) return null;
    let bucket = _cache.get(img);
    if (!bucket) {
      bucket = new Map();
      _cache.set(img, bucket);
    }
    return bucket;
  }

  function _getInflightBucket(img) {
    if (!img) return null;
    let bucket = _inflight.get(img);
    if (!bucket) {
      bucket = new Map();
      _inflight.set(img, bucket);
    }
    return bucket;
  }

  // ── 마스크 정의 ─────────────────────────────────────────
  // precompute 대상 (가벼움)
  const PRECOMPUTE_REGIONS = ['skinMask', 'hairMask', 'lipMask', 'eyeMask', 'backgroundMask'];
  // lazy (호출 시점에 계산)
  const LAZY_REGIONS = ['nailMask', 'handSkinMask', 'eyelashBandMask', 'hairBoundaryMask'];
  const ALL_REGIONS = PRECOMPUTE_REGIONS.concat(LAZY_REGIONS);

  function _emptyResult(status, reason) {
    return {
      mask: null,
      confidence: 0,
      coverage: 0,
      sourceTier: 0,
      inferenceTimeMs: 0,
      status: status || 'failed',
      reason: reason || '',
    };
  }

  function _imgSize(img) {
    if (!img) return { w: 0, h: 0 };
    const w = img.naturalWidth || img.width || 0;
    const h = img.naturalHeight || img.height || 0;
    return { w: w | 0, h: h | 0 };
  }

  // ── Tier 2: MediaPipe Face Landmarker polygon → mask ─────
  async function _tier2_facePolygon(img, regionName) {
    const ML = _getMediaPipe();
    const RF = _getRefine();
    if (!ML || !RF) return _emptyResult('failed', 'mediapipe/refine missing');
    if (!ML.REGIONS || !ML.REGIONS[regionName]) {
      return _emptyResult('failed', 'unknown region: ' + regionName);
    }
    const sz = _imgSize(img);
    if (!sz.w || !sz.h) return _emptyResult('failed', 'invalid image size');
    let landmarks = null;
    try { landmarks = await ML.detect(img); }
    catch (e) { return _emptyResult('failed', 'detect error: ' + (e && e.message)); }
    if (!landmarks || !landmarks.length) {
      return _emptyResult('fallback', 'no face landmarks');
    }
    const polygon = ML.regionPolygon(landmarks, regionName);
    if (!polygon || polygon.length < 3) {
      return _emptyResult('fallback', 'invalid polygon');
    }
    const mask = RF.polygonToMask(polygon, sz.w, sz.h);
    const feathered = RF.gaussianFeather(mask, sz.w, sz.h, Math.max(4, Math.round(Math.min(sz.w, sz.h) * 0.005)));
    return {
      mask: feathered,
      confidence: RF.maskConfidence(feathered, 0.5),
      coverage: RF.maskCoverage(feathered),
      sourceTier: 2,
      inferenceTimeMs: 0, // 호출자가 set
      status: 'ready',
      featherRadius: Math.max(4, Math.round(Math.min(sz.w, sz.h) * 0.005)),
    };
  }

  // ── Tier 3: SmartMask 휴리스틱 → mask ────────────────────
  // imgSource 픽셀을 직접 walk. 비용 있음 → 작은 dims 로 다운샘플 후 업샘플.
  async function _tier3_heuristic(img, regionType) {
    const SM = _getSmartMask();
    if (!SM || typeof SM.classify !== 'function') {
      return _emptyResult('failed', 'smart-mask missing');
    }
    const sz = _imgSize(img);
    if (!sz.w || !sz.h) return _emptyResult('failed', 'invalid image size');
    // 다운샘플 (긴 변 256px) — 보정 엔진과 무관, 디버그/메타용
    const target = 256;
    const longSide = Math.max(sz.w, sz.h);
    const k = Math.min(1, target / longSide);
    const dw = Math.max(1, Math.round(sz.w * k));
    const dh = Math.max(1, Math.round(sz.h * k));
    try {
      const cv = document.createElement('canvas');
      cv.width = dw; cv.height = dh;
      const ctx = cv.getContext('2d');
      if (!ctx) return _emptyResult('failed', 'canvas ctx unavailable');
      ctx.drawImage(img, 0, 0, dw, dh);
      const data = ctx.getImageData(0, 0, dw, dh).data;
      // 출력은 원본 해상도가 아니라 다운샘플 해상도 (debug 용도).
      const mask = new Float32Array(dw * dh);
      const keyMap = {
        skinMask: 'skin', hairMask: 'hair', lipMask: 'skin',
        eyeMask: 'eye', nailMask: 'nail',
        handSkinMask: 'skin', backgroundMask: 'background',
      };
      const useKey = keyMap[regionType] || 'subject';
      for (let y = 0, idx = 0, pi = 0; y < dh; y++) {
        for (let x = 0; x < dw; x++, idx++, pi += 4) {
          const r = data[pi], g = data[pi + 1], b = data[pi + 2];
          const lum = r * 0.299 + g * 0.587 + b * 0.114;
          const maxCh = Math.max(r, g, b), minCh = Math.min(r, g, b);
          const cls = SM.classify({ r, g, b, lum, maxCh, minCh, x, y, w: dw, h: dh });
          let v = 0;
          if (useKey === 'background') v = 1 - (cls.subject || 0);
          else v = cls[useKey] || 0;
          mask[idx] = v;
        }
      }
      const RF = _getRefine();
      const out = RF ? RF.gaussianFeather(mask, dw, dh, 3) : mask;
      return {
        mask: out,
        confidence: RF ? RF.maskConfidence(out, 0.4) : 0,
        coverage: RF ? RF.maskCoverage(out) : 0,
        sourceTier: 3,
        inferenceTimeMs: 0,
        status: 'fallback',
        reason: 'heuristic (downsampled ' + dw + 'x' + dh + ')',
        _dims: { w: dw, h: dh },
      };
    } catch (e) {
      return _emptyResult('failed', 'heuristic walk: ' + (e && e.message));
    }
  }

  // ── Region → tier 라우팅 ─────────────────────────────────
  async function _computeRegion(img, regionType) {
    const t0 = (performance && performance.now) ? performance.now() : Date.now();
    let result;
    try {
      switch (regionType) {
        case 'skinMask': {
          const r = await _tier2_facePolygon(img, 'faceOval');
          if (r.status === 'ready' && r.mask) {
            // 눈/입 영역 제외
            const RF = _getRefine();
            const eye = await _tier2_facePolygon(img, 'leftEye');
            const eye2 = await _tier2_facePolygon(img, 'rightEye');
            const lip = await _tier2_facePolygon(img, 'lips');
            let mask = r.mask;
            if (RF && eye.mask)  mask = RF.subtractMask(mask, eye.mask);
            if (RF && eye2.mask) mask = RF.subtractMask(mask, eye2.mask);
            if (RF && lip.mask)  mask = RF.subtractMask(mask, lip.mask);
            r.mask = mask;
            r.coverage = RF ? RF.maskCoverage(mask) : r.coverage;
            r.confidence = RF ? RF.maskConfidence(mask, 0.5) : r.confidence;
          }
          if (r.status === 'ready') { result = r; break; }
          result = await _tier3_heuristic(img, regionType);
          break;
        }
        case 'hairMask': {
          // Tier 1 hair-specific segmenter 미사용 (v315 검토)
          // Tier 2: foreheadTop polygon 을 위로 확장 (땅 위 헤어 가정) — 1차 근사
          const r = await _tier2_facePolygon(img, 'foreheadTop');
          if (r.status === 'ready') { result = r; result.reason = 'foreheadTop polygon (approx)'; break; }
          result = await _tier3_heuristic(img, regionType);
          break;
        }
        case 'lipMask':
          result = await _tier2_facePolygon(img, 'lips');
          if (result.status !== 'ready') result = await _tier3_heuristic(img, 'lipMask');
          break;
        case 'eyeMask': {
          const RF = _getRefine();
          const l = await _tier2_facePolygon(img, 'leftEye');
          const r2 = await _tier2_facePolygon(img, 'rightEye');
          if (RF && l.mask && r2.mask) {
            const merged = RF.unionMask(l.mask, r2.mask);
            result = {
              mask: merged,
              confidence: RF.maskConfidence(merged, 0.5),
              coverage: RF.maskCoverage(merged),
              sourceTier: 2,
              inferenceTimeMs: 0,
              status: 'ready',
            };
          } else if (l.status === 'ready') {
            result = l;
          } else {
            result = await _tier3_heuristic(img, 'eyeMask');
          }
          break;
        }
        case 'backgroundMask':
          // Tier 1 Selfie Segmentation 미사용 — Tier 3 휴리스틱 (subject inverse)
          result = await _tier3_heuristic(img, 'backgroundMask');
          break;
        case 'nailMask':
          // v313: Hand Landmarker 미적용 → pendingImplementation
          result = _emptyResult('pendingImplementation', 'Hand Landmarker 적용은 v315');
          result.sourceTier = 0;
          break;
        case 'handSkinMask':
          result = await _tier3_heuristic(img, 'handSkinMask');
          break;
        case 'eyelashBandMask': {
          // Tier 2: eye polygon 을 위로 8% 확장 (edge refinement 는 v315 튜닝)
          const RF = _getRefine();
          const ML = _getMediaPipe();
          if (!ML || !RF) { result = _emptyResult('failed', 'mediapipe/refine missing'); break; }
          const landmarks = await ML.detect(img);
          if (!landmarks) { result = _emptyResult('fallback', 'no landmarks'); break; }
          const sz = _imgSize(img);
          const shift = -sz.h * 0.04;
          function _shifted(name) {
            const p = ML.regionPolygon(landmarks, name);
            if (!p) return null;
            return p.map(pt => ({ x: pt.x, y: pt.y + shift }));
          }
          const lp = _shifted('leftEye'), rp = _shifted('rightEye');
          if (!lp && !rp) { result = _emptyResult('fallback', 'eye polygon missing'); break; }
          let mask = new Float32Array(sz.w * sz.h);
          if (lp) {
            const m = RF.polygonToMask(lp, sz.w, sz.h);
            mask = RF.unionMask(mask, m);
          }
          if (rp) {
            const m = RF.polygonToMask(rp, sz.w, sz.h);
            mask = RF.unionMask(mask, m);
          }
          const feathered = RF.gaussianFeather(mask, sz.w, sz.h, 3);
          result = {
            mask: feathered,
            confidence: RF.maskConfidence(feathered, 0.4),
            coverage: RF.maskCoverage(feathered),
            sourceTier: 2,
            inferenceTimeMs: 0,
            status: 'ready',
            reason: 'eye polygon shifted up (refinement v315)',
          };
          break;
        }
        case 'hairBoundaryMask':
          // hairMask 의 edge feather — v315 에서 구체화. 지금은 fallback.
          result = _emptyResult('pendingImplementation', 'hairMask edge feather 는 v315');
          break;
        default:
          result = _emptyResult('failed', 'unknown region: ' + regionType);
      }
    } catch (e) {
      result = _emptyResult('failed', 'compute exception: ' + (e && e.message));
    }
    const t1 = (performance && performance.now) ? performance.now() : Date.now();
    result.inferenceTimeMs = Math.round(t1 - t0);
    return result;
  }

  // ── 공개 API ────────────────────────────────────────────
  async function getMask(img, regionType, _opts) {
    if (!img) return _emptyResult('failed', 'no image');
    if (ALL_REGIONS.indexOf(regionType) < 0) {
      return _emptyResult('failed', 'unsupported region: ' + regionType);
    }
    const cache = _getCacheBucket(img);
    if (cache && cache.has(regionType)) return cache.get(regionType);
    const inflight = _getInflightBucket(img);
    if (inflight && inflight.has(regionType)) return inflight.get(regionType);
    const promise = (async () => {
      let r;
      try { r = await _computeRegion(img, regionType); }
      catch (e) { r = _emptyResult('failed', 'getMask exception: ' + (e && e.message)); }
      if (cache) cache.set(regionType, r);
      if (inflight) inflight.delete(regionType);
      return r;
    })();
    if (inflight) inflight.set(regionType, promise);
    return promise;
  }

  async function precompute(img, _opts) {
    if (!img) return {};
    const results = {};
    try {
      const settled = await Promise.all(PRECOMPUTE_REGIONS.map(r =>
        getMask(img, r).catch(e => _emptyResult('failed', 'precompute: ' + (e && e.message)))
      ));
      PRECOMPUTE_REGIONS.forEach((r, i) => { results[r] = settled[i]; });
      // debug overlay + console.table
      const dbg = _getOverlay();
      if (dbg && dbg.isEnabled && dbg.isEnabled()) {
        const sz = _imgSize(img);
        try { dbg.render(results, sz.w, sz.h); } catch (_e) { /* ignore */ }
        try { dbg.logStats(_buildStatsArray(results)); } catch (_e) { /* ignore */ }
      }
    } catch (e) {
      console.warn('[RegionMaskProvider] precompute failed:', e && e.message);
    }
    return results;
  }

  function _buildStatsArray(maskMap) {
    return Object.keys(maskMap).map(k => {
      const r = maskMap[k] || {};
      return {
        maskType: k,
        sourceTier: r.sourceTier || 0,
        coverage: r.coverage != null ? +r.coverage.toFixed(3) : 0,
        confidence: r.confidence != null ? +r.confidence.toFixed(3) : 0,
        inferenceTimeMs: r.inferenceTimeMs || 0,
        status: r.status || 'failed',
      };
    });
  }

  function getStats(img) {
    const cache = _cache.get(img);
    if (!cache) return [];
    const map = {};
    cache.forEach((v, k) => { map[k] = v; });
    return _buildStatsArray(map);
  }

  function invalidate(img) {
    if (!img) return;
    _cache.delete(img);
    _inflight.delete(img);
    const dbg = _getOverlay();
    if (dbg && dbg.clear) { try { dbg.clear(); } catch (_e) { /* ignore */ } }
  }

  function setDebug(on) {
    const dbg = _getOverlay();
    if (!dbg || !dbg.setEnabled) return false;
    return dbg.setEnabled(!!on);
  }

  function isReady() {
    return !!(_getRefine() && _getMediaPipe() && _getSmartMask());
  }

  window.RegionMaskProvider = {
    precompute,
    getMask,
    getStats,
    invalidate,
    setDebug,
    isReady,
    _PRECOMPUTE_REGIONS: PRECOMPUTE_REGIONS,
    _LAZY_REGIONS: LAZY_REGIONS,
  };
})();
