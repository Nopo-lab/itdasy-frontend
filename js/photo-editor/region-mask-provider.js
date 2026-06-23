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
  const LAZY_REGIONS = ['nailMask', 'handSkinMask', 'eyelashBandMask', 'hairBoundaryMask', 'scleraMask', 'browMask'];
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

  // [v546] 눈·눈썹·흰자·속눈썹 ROI 가 너무 작아(coverage≈0.8%) 체감 저하 → 마스크 dilation 으로 확장.
  //   separable max-pool(>0.3 영역을 r 만큼 키움). 마스크는 원본 해상도라 r 은 짧은 변 비율로.
  function _dilateMask(mask, w, h, r) {
    if (!mask || r < 1) return mask;
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let m = 0; const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r);
      for (let xx = x0; xx <= x1; xx++) { const v = mask[y * w + xx]; if (v > m) m = v; }
      tmp[y * w + x] = m;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let m = 0; const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
      for (let yy = y0; yy <= y1; yy++) { const v = tmp[yy * w + x]; if (v > m) m = v; }
      out[y * w + x] = m;
    }
    return out;
  }
  function _maskBBox(mask, w, h, thr) {
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((mask[y * w + x] || 0) > thr) {
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    if (maxX < 0) return null;
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
  }
  // [v546] 한쪽 눈만 인식된 경우(oneEye) — 검출된 눈을 반대쪽으로 평행이동 복제해 양쪽 ROI 복원.
  //   landmark 미러가 정확하진 않지만(각도 무시) ROI 가 아예 한쪽만 적용되던 것보다 체감 개선.
  //   대상이 검출 눈 폭의 ~2배 떨어진 위치라 얼굴이 어느 정도 정면일 때 잘 맞음. 셀피(좌우반전)도 대칭이라 무관.
  // [v546] result.mask 를 짧은 변 비율 r 만큼 dilation + feather 후 coverage/confidence 갱신.
  function _dilateRegion(result, img, ratio) {
    const RF = _getRefine();
    if (!RF || !result || !result.mask) return result;
    const sz = _imgSize(img); if (!sz.w || !sz.h) return result;
    const dr = Math.max(1, Math.round(Math.min(sz.w, sz.h) * ratio));
    result.mask = RF.gaussianFeather(_dilateMask(result.mask, sz.w, sz.h, dr), sz.w, sz.h, Math.max(1, (dr / 2) | 0));
    result.coverage = RF.maskCoverage(result.mask);
    result.confidence = RF.maskConfidence(result.mask, 0.4);
    result.dilatedRadius = dr;
    return result;
  }
  function _reconstructMissingEye(mask, w, h, detectedIsLeft) {
    const bb = _maskBBox(mask, w, h, 0.2); if (!bb) return mask;
    const shift = Math.round(bb.w * 2.0) * (detectedIsLeft ? 1 : -1);   // left 검출 → 오른쪽(+x)으로 복제
    const out = new Float32Array(w * h);
    for (let i = 0; i < mask.length; i++) out[i] = mask[i];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const sx = x - shift; if (sx < 0 || sx >= w) continue;
      const v = mask[y * w + sx]; if (v > out[y * w + x]) out[y * w + x] = v;
    }
    return out;
  }

  // ── Tier 1 hair 어댑터 (v336 — mask-hair-adapter.js 로 분리) ──
  function _getHairAdapter() { return window.MaskHairAdapter || null; }

  // ── Tier 1 hand 어댑터 (v332 — mask-hand-adapter.js 로 분리) ──
  function _getHandAdapter() { return window.MaskHandAdapter || null; }
  function _getConfidence() { return window.MaskConfidence || null; }

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
            let subOk = 0;
            if (RF && eye.mask)  { mask = RF.subtractMask(mask, eye.mask); subOk++; }
            if (RF && eye2.mask) { mask = RF.subtractMask(mask, eye2.mask); subOk++; }
            if (RF && lip.mask)  { mask = RF.subtractMask(mask, lip.mask); subOk++; }
            r.mask = mask;
            r.coverage = RF ? RF.maskCoverage(mask) : r.coverage;
            r._subtracted = subOk >= 2;
          }
          if (r.status === 'ready') { result = r; break; }
          result = await _tier3_heuristic(img, regionType);
          break;
        }
        case 'hairMask': {
          // v336 — Tier 1 (mask-hair-adapter) → Tier 2 (foreheadTop) → Tier 3
          const HA = _getHairAdapter();
          if (HA && typeof HA.hairMask === 'function') {
            const t1 = await HA.hairMask(img, _imgSize(img));
            if (t1 && t1.status === 'ready' && t1.mask) {
              result = Object.assign({ sourceTier: 1, inferenceTimeMs: 0 }, t1);
              break;
            }
          }
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
          // v340 — 좌/우 polygon coverage 따로 측정 (한쪽만 인식 진단용)
          const lCov = (RF && l.mask) ? RF.maskCoverage(l.mask) : 0;
          const rCov = (RF && r2.mask) ? RF.maskCoverage(r2.mask) : 0;
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
          // v340 — 좌/우 coverage 노출 + 비대칭(한쪽만) 경고
          result.eyeLeftCoverage = +lCov.toFixed(4);
          result.eyeRightCoverage = +rCov.toFixed(4);
          const oneEye = (lCov > 0.0005 && rCov < 0.0001) || (rCov > 0.0005 && lCov < 0.0001);
          // [v546] 한쪽 눈만 인식 → 대칭 복원, 그리고 항상 dilation 으로 coverage 확장(0.8% 너무 작음 대응).
          if (RF && result.mask && result.status === 'ready') {
            const sz2 = _imgSize(img);
            if (oneEye) {
              result.mask = _reconstructMissingEye(result.mask, sz2.w, sz2.h, lCov >= rCov);
              result.fallbackUsed = true; result.fallbackReason = 'symmetry-mirror(oneEye)';
            }
            const dr = Math.max(1, Math.round(Math.min(sz2.w, sz2.h) * 0.012));
            result.mask = RF.gaussianFeather(_dilateMask(result.mask, sz2.w, sz2.h, dr), sz2.w, sz2.h, Math.max(1, (dr / 2) | 0));
            result.coverage = RF.maskCoverage(result.mask);
            result.confidence = RF.maskConfidence(result.mask, 0.4);
            result.dilatedRadius = dr;
          }
          if (oneEye) {
            result.reason = (result.reason ? result.reason + '; ' : '') +
              'ONE-EYE→대칭복원: leftEye=' + lCov.toFixed(4) + ' rightEye=' + rCov.toFixed(4) +
              ' (한쪽 polygon coverage≈0 — 얼굴 각도/landmark 불안정 추정)';
          }
          try {
            if (window.localStorage && localStorage.getItem('PE_MASK_DEBUG') === '1') {
              console.log('[eyeMask] leftEye coverage=' + lCov.toFixed(4) +
                ' / rightEye coverage=' + rCov.toFixed(4) + (oneEye ? '  ⚠ ONE-EYE' : ''));
            }
          } catch (_e) { /* ignore */ }
          break;
        }
        case 'backgroundMask':
          // Tier 1 Selfie Segmentation 미사용 — Tier 3 휴리스틱 (subject inverse)
          result = await _tier3_heuristic(img, 'backgroundMask');
          break;
        case 'nailMask': {
          // v336 — Tier 1 Hand Landmarker. 어댑터가 status('ready'|'noHand'|'failed') 반환.
          //   noHand 면 Tier 3 폴백 안 함 (얼굴 사진 등에서 false-positive 방지).
          const HA = _getHandAdapter();
          if (HA && typeof HA.nailMask === 'function') {
            const t1 = await HA.nailMask(img, _imgSize(img));
            if (t1 && t1.status === 'ready' && t1.mask) {
              result = Object.assign({ sourceTier: 1, inferenceTimeMs: 0 }, t1);
              break;
            }
            if (t1 && t1.status === 'noHand') {
              result = _emptyResult('noHand', t1.reason || 'no hand detected');
              break;
            }
          }
          result = await _tier3_heuristic(img, 'nailMask');
          break;
        }
        case 'handSkinMask': {
          const HA = _getHandAdapter();
          if (HA && typeof HA.handSkinMask === 'function') {
            const t1 = await HA.handSkinMask(img, _imgSize(img));
            if (t1 && t1.status === 'ready' && t1.mask) {
              result = Object.assign({ sourceTier: 1, inferenceTimeMs: 0 }, t1);
              break;
            }
            if (t1 && t1.status === 'noHand') {
              result = _emptyResult('noHand', t1.reason || 'no hand detected');
              break;
            }
          }
          result = await _tier3_heuristic(img, 'handSkinMask');
          break;
        }
        case 'eyelashBandMask': {
          // v336 — reason 명확화. 세 가지 실패 경로 분리:
          //   1) 어댑터 미로드 → 'failed: adapter not loaded'
          //   2) 어댑터 호출 결과 null (얼굴 미검출/band 너무 얇음/refine 실패) → 'fallback: <reason>'
          //   3) 어댑터 throw → 'failed: <message>'
          const EA = window.MaskEyelashAdapter;
          if (!EA || typeof EA.eyelashBandMask !== 'function') {
            result = _emptyResult('failed', 'eyelash adapter not loaded');
            break;
          }
          try {
            const t1 = await EA.eyelashBandMask(img);
            if (t1 && t1.mask) {
              result = _dilateRegion(Object.assign({   // [v546] 속눈썹 band ROI 확장
                sourceTier: 2,
                inferenceTimeMs: 0,
                status: t1._lowConfidence ? 'fallback' : 'ready',
              }, t1), img, 0.006);
            } else {
              result = _emptyResult('fallback', 'no face landmarks or band too thin');
            }
          } catch (e) {
            result = _emptyResult('failed', 'eyelash adapter error: ' + (e && e.message));
          }
          break;
        }
        case 'hairBoundaryMask': {
          // v334 — hairMask 두 단계 블러 차이 = 경계 band.
          //   blur_near (r=2) ↔ blur_far (r=8) 의 절대 차이가 큰 픽셀이 경계.
          //   distance transform 없이 가벼운 근사.
          const RF = _getRefine();
          if (!RF) { result = _emptyResult('failed', 'mask-refine missing'); break; }
          const hair = await getMask(img, 'hairMask');
          if (!hair || !hair.mask) { result = _emptyResult('fallback', 'hairMask not ready'); break; }
          const sz = _imgSize(img);
          const near = RF.gaussianFeather(hair.mask, sz.w, sz.h, 2);
          const far  = RF.gaussianFeather(hair.mask, sz.w, sz.h, 8);
          const diff = new Float32Array(sz.w * sz.h);
          let maxV = 0;
          for (let i = 0; i < diff.length; i++) {
            const v = Math.abs(near[i] - far[i]);
            diff[i] = v;
            if (v > maxV) maxV = v;
          }
          if (maxV > 0) {
            const k = 1 / maxV;
            for (let i = 0; i < diff.length; i++) diff[i] = Math.min(1, diff[i] * k * 1.4);
          }
          const final = RF.gaussianFeather(diff, sz.w, sz.h, 2);
          const cov = RF.maskCoverage(final);
          if (cov < 0.002) { result = _emptyResult('fallback', 'boundary too thin'); break; }
          result = {
            mask: final,
            confidence: RF.maskConfidence(final, 0.3),
            coverage: cov,
            sourceTier: 2,
            inferenceTimeMs: 0,
            status: 'ready',
            featherRadius: 2,
            reason: 'hairMask blur differential (r=2 vs r=8)',
          };
          break;
        }
        case 'scleraMask': {
          // PE-M1 — 흰자 정밀 마스크 = eye 폴리곤 − 홍채. 무거운 기하는 mask-sclera-adapter 위임.
          //   refineLandmarks(478) 없거나 어댑터 미로드 → fallback → eyeRedness 는 휴리스틱 유지.
          const SA = window.MaskScleraAdapter;
          if (SA && typeof SA.scleraMask === 'function') {
            const t = await SA.scleraMask(img, _imgSize(img));
            if (t && t.mask) { result = _dilateRegion(t, img, 0.008); break; }   // [v546] 흰자 ROI 확장
          }
          result = _emptyResult('fallback', 'sclera adapter unavailable or no iris(478) landmarks');
          break;
        }
        case 'browMask': {
          // PE-M2 — 눈썹 정밀 마스크 = 좌/우 눈썹 convex hull. 무거운 기하는 mask-brow-adapter 위임.
          //   눈썹 랜드마크 부족/측면 → fallback → browSharp 는 기존 eyeMask 상단 ROI 유지.
          const BA = window.MaskBrowAdapter;
          if (BA && typeof BA.browMask === 'function') {
            const t = await BA.browMask(img, _imgSize(img));
            if (t && t.mask) { result = _dilateRegion(t, img, 0.01); break; }   // [v546] 눈썹 ROI 확장
          }
          result = _emptyResult('fallback', 'brow adapter unavailable or no eyebrow landmarks');
          break;
        }
        default:
          result = _emptyResult('failed', 'unknown region: ' + regionType);
      }
    } catch (e) {
      result = _emptyResult('failed', 'compute exception: ' + (e && e.message));
    }
    const t1 = (performance && performance.now) ? performance.now() : Date.now();
    result.inferenceTimeMs = Math.round(t1 - t0);
    // v336 — confidence 신산식으로 일괄 재계산 (mask-confidence.js — coverage 와 분리)
    const MC = _getConfidence();
    if (MC && typeof MC.compute === 'function') {
      result.confidence = MC.compute(regionType, result);
    }
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

  // v316 — sync 캐시 lookup. 미캐시면 백그라운드 trigger (fire-and-forget).
  function getCachedSync(img, regionType) {
    if (!img) return null;
    const cache = _cache.get(img);
    const cached = cache && cache.get(regionType);
    if (cached) return cached;
    // 백그라운드 계산 트리거 — 다음 redraw 에 캐시 hit 기대
    try { getMask(img, regionType).catch(() => {}); } catch (_e) { /* ignore */ }
    return null;
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
    getCachedSync,
    getStats,
    invalidate,
    setDebug,
    isReady,
    _PRECOMPUTE_REGIONS: PRECOMPUTE_REGIONS,
    _LAZY_REGIONS: LAZY_REGIONS,
  };
})();
