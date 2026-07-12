/* 사진 편집기 — RegionMaskProvider (v313 2026-05-28)

   부위별 마스크 dispatcher.
     Tier 1: 온디바이스 AI segmentation / Hand Landmarker
     Tier 2: MediaPipe Face Landmarker polygon
     Tier 3: 색상/위치 휴리스틱 (SmartMask)
     Tier 4: 사용자 브러시 (v315+ UI 연결)

   v313 정책:
     - 가벼운 5종 (skin/hair/lip/eye/background) 만 precompute
     - nail/handSkin/eyelashBand/hairBoundary 는 lazy (필요 시 getMask)
     - nailMask/handSkinMask 는 Hand Landmarker 결과만 허용
     - 손·네일 검출 실패 시 색상/위치 추정 금지
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
  // [v573·P3-4] 이마 윗부분 연장 — MediaPipe faceOval 최상단(landmark 10)은 "이마 중앙"이라
  //   윗이마(중앙~헤어라인)가 skinMask 밖이었음(="이마 절반"). 컬럼별 마스크 최상단을 위로 ext 픽셀
  //   연장(위로 갈수록 약하게)해 윗이마를 덮는다. 머리카락 침범은 호출부에서 hairMask(Tier1) 빼서 차단.
  function _extrudeForeheadUp(mask, w, h, bb, ext) {
    if (!bb || ext < 1) return mask;
    const out = new Float32Array(mask.length);
    out.set(mask);
    const x0 = Math.max(0, bb.x), x1 = Math.min(w - 1, bb.x + bb.w - 1);
    const searchBot = Math.min(h - 1, bb.y + ((bb.h * 0.5) | 0));   // 얼굴 상단 절반에서만 최상단 탐색(턱 무시)
    for (let x = x0; x <= x1; x++) {
      let topY = -1, topV = 0;
      for (let y = Math.max(0, bb.y); y <= searchBot; y++) {
        const v = mask[y * w + x];
        if (v > 0.3) { topY = y; topV = v; break; }
      }
      if (topY < 0) continue;
      for (let k = 1; k <= ext; k++) {
        const yy = topY - k;
        if (yy < 0) break;
        // [v575·필수4] 상단 falloff 0.7→0.45 — 윗이마(중앙~헤어라인)도 충분한 가중(최상단≈0.55×)을 유지해
        //   연장 영역이 실제 보정을 받게(기존 0.3× 는 사실상 무보정이라 '이마 절반'으로 보임).
        const wgt = topV * (1 - (k / ext) * 0.45);
        const idx = yy * w + x;
        if (wgt > out[idx]) out[idx] = wgt;
      }
    }
    return out;
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
        eyeMask: 'eye', backgroundMask: 'background',
      };
      const useKey = keyMap[regionType];
      if (!useKey) return _emptyResult('failed', 'heuristic forbidden for ' + regionType);
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

  // [v573·P3-1] 네일 색/광택 휴리스틱 폴백 — 손 전체가 안 보이는 "네일 클로즈업"에서 Hand Landmarker
  //   가 noHand 가 되어 네일 보정이 통째로 NO-OP 되던 문제. 선명 폴리시(고채도)·글로시 팁(밝고 저채도)만,
  //   살색 warm 톤은 제외하고 coverage 게이트(0.3~12%)로 옷/배경 오검출을 차단한다. (mask-application 이 2차 게이트)
  async function _tier3_nailHeuristic(img) {
    const sz = _imgSize(img);
    if (!sz.w || !sz.h) return null;
    const RF = _getRefine();
    const target = 256;
    const k = Math.min(1, target / Math.max(sz.w, sz.h));
    const dw = Math.max(1, Math.round(sz.w * k)), dh = Math.max(1, Math.round(sz.h * k));
    try {
      const cv = document.createElement('canvas');
      cv.width = dw; cv.height = dh;
      const ctx = cv.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, dw, dh);
      const data = ctx.getImageData(0, 0, dw, dh).data;
      const small = new Float32Array(dw * dh);
      let cnt = 0;
      for (let y = 0, idx = 0, pi = 0; y < dh; y++) {
        const ny = (y + 0.5) / dh;
        for (let x = 0; x < dw; x++, idx++, pi += 4) {
          const r = data[pi], g = data[pi + 1], b = data[pi + 2];
          const lum = r * 0.299 + g * 0.587 + b * 0.114;
          const sat = Math.max(r, g, b) - Math.min(r, g, b);
          const nx = (x + 0.5) / dw;
          const subj = 1 - (Math.abs(nx - 0.5) * 1.2 + Math.abs(ny - 0.5) * 0.8);
          if (subj < 0.15) continue;
          const vivid = sat > 70 && lum > 40 && lum < 240;                 // 유채색 폴리시(빨강/핑크/누드강조)
          const glossy = lum > 214 && sat < 24;                            // 투명/프렌치 팁 하이라이트
          // 살색 gradient(r>g>b, 따뜻) 은 채도가 높아도 제외 — 손/얼굴 피부 오검출 차단(핵심 가드)
          const warmSkin = r > g && g > b && (r - b) >= 8 && (r - b) <= 95 && lum > 60 && lum < 225;
          if ((vivid || glossy) && !warmSkin) { small[idx] = vivid ? 0.95 : 0.7; cnt++; }
        }
      }
      const cov = cnt / (dw * dh);
      if (cov < 0.003 || cov > 0.12) return null;                          // 네일 아님(옷·배경·전면 오검출) → 폴백 포기
      const full = new Float32Array(sz.w * sz.h);
      for (let y = 0; y < sz.h; y++) {
        const sy = Math.min(dh - 1, (y * dh / sz.h) | 0);
        for (let x = 0; x < sz.w; x++) {
          const sx = Math.min(dw - 1, (x * dw / sz.w) | 0);
          full[y * sz.w + x] = small[sy * dw + sx];
        }
      }
      // [v574] morphology — open(스펙클 false-positive 제거) → close(손톱 내부 구멍 채움) → 경계 feather 작게.
      let refined = full;
      if (RF && RF.openMask && RF.closeMask) {
        const mr = Math.max(1, Math.round(Math.min(sz.w, sz.h) * 0.0045));
        refined = RF.closeMask(RF.openMask(full, sz.w, sz.h, mr), sz.w, sz.h, mr);
      }
      const featherR = Math.max(2, Math.round(Math.min(sz.w, sz.h) * 0.003));   // 손피부 경계 번짐 최소화(작게)
      const out = RF ? RF.gaussianFeather(refined, sz.w, sz.h, featherR) : refined;
      const finalCov = RF ? RF.maskCoverage(out) : cov;
      if (finalCov < 0.002) return null;                                         // morphology 후 너무 작아지면 폴백 포기
      return {
        mask: out,
        confidence: 0.35,
        coverage: finalCov,
        sourceTier: 3,
        inferenceTimeMs: 0,
        status: 'fallback',
        _nailHeuristic: true,
        featherRadius: featherR,
        reason: 'nail heuristic (vivid polish / glossy tip, cov ' + (cov * 100).toFixed(1) + '%)',
      };
    } catch (e) { return _emptyResult('failed', 'nail heuristic: ' + (e && e.message)); }
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
            // [v573·P3-4] 윗이마 연장(이마 절반 해소). 헤어라인 침범은 Tier1 hairMask(실세그) 가 있을 때만 차감
            //   (Tier2 foreheadTop 폴리곤은 이마를 덮어버려 빼면 안 됨 → sourceTier===1 한정).
            if (RF) {
              const sz4 = _imgSize(img);
              const bb = _maskBBox(mask, sz4.w, sz4.h, 0.3);
              if (bb) {
                const ext = Math.round(bb.h * 0.40);   // [v575·필수4] 0.28→0.40 — 윗이마(헤어라인까지) 더 덮음
                let exm = _extrudeForeheadUp(mask, sz4.w, sz4.h, bb, ext);
                try {
                  const hair = await getMask(img, 'hairMask');
                  if (hair && hair.mask && hair.sourceTier === 1) exm = RF.subtractMask(exm, hair.mask);
                } catch (_e) { /* hair 미검출 시 연장만 적용 */ }
                mask = RF.gaussianFeather(exm, sz4.w, sz4.h, Math.max(2, Math.round(Math.min(sz4.w, sz4.h) * 0.004)));
                r._foreheadExtended = true;
              }
            }
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
            const dr = Math.max(1, Math.round(Math.min(sz2.w, sz2.h) * 0.006));   // [v548] 0.012→0.006 — 눈썹쪽 번짐 축소(coverage 확장은 유지하되 보수적)
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
          // v550 — 네일은 Hand Landmarker 결과만 허용. 실패 시 색/광택 추정으로 대체하지 않는다.
          const HA = _getHandAdapter();
          if (HA && typeof HA.nailMask === 'function') {
            const t1 = await HA.nailMask(img, _imgSize(img));
            if (t1 && t1.status === 'ready' && t1.mask) {
              result = Object.assign({ sourceTier: 1, inferenceTimeMs: 0 }, t1);
              break;
            }
            if (t1 && t1.status === 'noHand') {
              // [v573·P3-1] 손 미검출(네일 클로즈업) → 색/광택 휴리스틱 폴백 시도(보수적 게이트)
              const hr = await _tier3_nailHeuristic(img);
              if (hr && hr.mask && hr._nailHeuristic) { result = hr; break; }
              result = _emptyResult('noHand', t1.reason || 'no hand detected');
              break;
            }
          }
          result = _emptyResult('failed', 'nail detector unavailable or rejected');
          break;
        }
        case 'handSkinMask': {
          // v550 — 손 피부는 Hand Landmarker 결과만 허용. 피부색 추정으로 대체하지 않는다.
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
          result = _emptyResult('failed', 'hand detector unavailable or rejected');
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
            if (t && t.mask) { result = t; break; }   // [v548] 흰자는 dilation 안 함 — 눈맑게가 눈꺼풀/눈썹쪽으로 번지던 문제 수정(흰자 타이트 유지)
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
            // [v551] dilation 0.01→0.004 — 0.01 은 실제 눈썹보다 위(이마/눈썹뼈)로 번지고 두꺼워
            //   "눈썹 선명도"가 이마까지 건드림(실QA 확인). landmark hull 근처로 타이트하게 유지.
            if (t && t.mask) {
              // [v575·필수5] 한 눈썹 안에서 마스크가 '중간 끊김'으로 보이던 문제 — feather/다운스케일로 얇은 구간이
              //   임계 아래로 떨어진 것. closeMask(dilate→erode)로 외형 확장 없이 내부 gap 만 메워 끊김 제거.
              const RFb = _getRefine();
              if (RFb && typeof RFb.closeMask === 'function') {
                const szb = _imgSize(img);
                const crb = Math.max(1, Math.round(Math.min(szb.w, szb.h) * 0.006));
                t.mask = RFb.closeMask(t.mask, szb.w, szb.h, crb);
              }
              result = _dilateRegion(t, img, 0.004); break;   // [v546→v551] 눈썹 ROI 보수적 확장
            }
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
