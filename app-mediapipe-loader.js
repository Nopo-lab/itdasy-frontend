/* MediaPipe Face Mesh 공용 로더 (2026-05-19 v217)
   PE-1 정밀 얼굴 보정용.

   책임:
     • Face Landmarker (TF.js 기반) CDN 비동기 로드
     • 얼굴 landmarks (468 points) 검출
     • 영역 마스크 헬퍼: 피부 / 눈 / 입 / 속눈썹 polygon → canvas mask
     • 모델 다운로드 실패 시 graceful 폴백 (간이 face bbox 추정)

   비용: 모든 처리는 클라이언트. 외부 API 호출 0.
*/
(function () {
  'use strict';
  if (window.MediaPipeLoader) return;

  // ── MediaPipe Face Landmarks Detection 모델 메타 ──
  // 468 landmark indices (well-known):
  const REGIONS = {
    // 얼굴 외곽 (피부 보정용)
    faceOval: [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109],
    // 왼쪽 눈 (속눈썹 오버레이)
    leftEye: [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246],
    // 오른쪽 눈
    rightEye: [362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398],
    // 입술 외곽
    lips: [61,146,91,181,84,17,314,405,321,375,291,409,270,269,267,0,37,39,40,185],
    // 헤어 영역 추정 (이마 위 + 양 옆 — landmarks 자체엔 머리카락 없음. faceOval 상단 + 위로 확장)
    foreheadTop: [10,338,297,332,284,251,389,356,127,162,21,54,103,67,109],
  };

  // ── 상태 ──
  let _state = {
    status: 'idle',  // idle | loading | ready | failed
    detector: null,
    error: null,
    loadPromise: null,
    progress: 0,    // 0~100
    listeners: [],  // [(progress, status) => void]
  };

  function _emit() {
    _state.listeners.forEach(l => { try { l(_state.progress, _state.status); } catch (_) { /* ignore */ } });
  }

  function _setProgress(p, status) {
    _state.progress = p;
    if (status) _state.status = status;
    _emit();
  }

  function _loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('script load fail: ' + src));
      document.head.appendChild(s);
    });
  }

  async function _load() {
    if (_state.status === 'ready') return _state.detector;
    if (_state.loadPromise) return _state.loadPromise;
    _setProgress(5, 'loading');
    _state.loadPromise = (async () => {
      try {
        if (!window.tf) {
          _setProgress(15);
          await _loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js');
          _setProgress(45);
        } else {
          _setProgress(45);
        }
        if (!window.faceLandmarksDetection) {
          await _loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/face-landmarks-detection@1.0.5/dist/face-landmarks-detection.min.js');
          _setProgress(75);
        } else {
          _setProgress(75);
        }
        const FLD = window.faceLandmarksDetection;
        const detector = await FLD.createDetector(
          FLD.SupportedModels.MediaPipeFaceMesh,
          { runtime: 'tfjs', refineLandmarks: false, maxFaces: 1 }
        );
        _state.detector = detector;
        _setProgress(100, 'ready');
        return detector;
      } catch (e) {
        _state.error = e && e.message;
        _setProgress(0, 'failed');
        _state.loadPromise = null;
        throw e;
      }
    })();
    return _state.loadPromise;
  }

  function _onProgress(fn) {
    if (typeof fn !== 'function') return () => {};
    _state.listeners.push(fn);
    // 현재 상태 즉시 전달
    try { fn(_state.progress, _state.status); } catch (_) { /* ignore */ }
    return () => {
      const i = _state.listeners.indexOf(fn);
      if (i >= 0) _state.listeners.splice(i, 1);
    };
  }

  // canvas 또는 image element 입력 → landmarks 배열 반환 (없으면 null)
  async function _detect(source) {
    try {
      const detector = await _load();
      const preds = await detector.estimateFaces(source, { flipHorizontal: false });
      if (!preds || !preds.length) return null;
      return preds[0].keypoints; // [{x, y, z?, name?}, ...]
    } catch (_e) {
      return null;
    }
  }

  // landmarks 와 영역명을 받아 polygon 좌표 배열 반환
  function _regionPolygon(landmarks, regionName) {
    if (!landmarks || !REGIONS[regionName]) return null;
    return REGIONS[regionName].map(i => landmarks[i]).filter(Boolean).map(p => ({ x: p.x, y: p.y }));
  }

  // canvas context 에 polygon path 그리기 (clip 또는 fill 용)
  function _pathPolygon(ctx, polygon) {
    if (!polygon || polygon.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(polygon[0].x, polygon[0].y);
    for (let i = 1; i < polygon.length; i++) ctx.lineTo(polygon[i].x, polygon[i].y);
    ctx.closePath();
  }

  // 폴백: landmarks 없을 때 간이 얼굴 bbox 추정 (이미지 중앙 상단 40%)
  function _fallbackFaceBbox(w, h) {
    const cx = w * 0.5, cy = h * 0.38;
    const rx = w * 0.28, ry = h * 0.32;
    return { cx, cy, rx, ry };
  }

  function _drawFallbackEllipsePath(ctx, w, h) {
    const b = _fallbackFaceBbox(w, h);
    ctx.beginPath();
    if (ctx.ellipse) ctx.ellipse(b.cx, b.cy, b.rx, b.ry, 0, 0, Math.PI * 2);
    else ctx.arc(b.cx, b.cy, Math.min(b.rx, b.ry), 0, Math.PI * 2);
  }

  // ── Hand Landmarker (v313 stub — 실제 로드/검출은 v315) ──
  // 의도: RegionMaskProvider 가 nailMask/handSkinMask 를 위해 인터페이스 호출 가능하도록
  //       시그니처만 제공. 호출하면 즉시 null + status:'pendingImplementation' 반환.
  const _handState = {
    status: 'pendingImplementation',   // v315 에서 'idle' → 'loading' → 'ready' 흐름
    error: 'Hand Landmarker 실제 적용은 v315 예정',
  };
  async function _loadHandLandmarker() {
    return null;  // v315 에서 실제 로드 구현
  }
  async function _detectHand(_source) {
    return null;  // v315 에서 실제 검출 구현 — 지금은 null 만 반환
  }

  // ── Image Segmenter (v331 2026-05-28 hair-specific) ──────────────
  // MediaPipe Tasks Vision Image Segmenter — hair_segmenter.tflite (~3MB).
  // 사용: RegionMaskProvider 가 hairMask Tier 1 로 호출.
  // 실패 시 (CDN 불가, ESM 미지원 등) graceful 폴백 — null 반환. Provider 가 Tier 2 로 fallback.
  const _segState = {
    hair: { status: 'idle', segmenter: null, loadPromise: null, error: null },
  };
  const TASKS_VISION_VERSION = '0.10.14';
  const TASKS_VISION_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + TASKS_VISION_VERSION;
  const HAIR_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/latest/hair_segmenter.tflite';

  async function _loadImageSegmenter(modelType) {
    const type = modelType || 'hair';
    if (type !== 'hair') return null; // v331: hair 만
    const s = _segState[type];
    if (s.status === 'ready') return s.segmenter;
    if (s.loadPromise) return s.loadPromise;
    s.status = 'loading';
    s.loadPromise = (async () => {
      try {
        // ESM dynamic import — vision_bundle.mjs 가 FilesetResolver, ImageSegmenter export
        const mod = await import(/* webpackIgnore: true */ TASKS_VISION_BASE + '/vision_bundle.mjs');
        const FilesetResolver = mod.FilesetResolver;
        const ImageSegmenter = mod.ImageSegmenter;
        if (!FilesetResolver || !ImageSegmenter) throw new Error('tasks-vision exports missing');
        const vision = await FilesetResolver.forVisionTasks(TASKS_VISION_BASE + '/wasm');
        const seg = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: { modelAssetPath: HAIR_MODEL_URL },
          runningMode: 'IMAGE',
          outputCategoryMask: true,
          outputConfidenceMasks: false,
        });
        s.segmenter = seg;
        s.status = 'ready';
        return seg;
      } catch (e) {
        s.error = e && e.message;
        s.status = 'failed';
        s.loadPromise = null;
        return null; // graceful — Provider 가 Tier 2 로 폴백
      }
    })();
    return s.loadPromise;
  }

  // img(HTMLImageElement|Canvas) → categoryMask (Uint8Array length w*h). 헤어=1, 비-헤어=0.
  // 실패 시 null. 호출자는 null 이면 폴백.
  async function _segmentHair(img) {
    try {
      const seg = await _loadImageSegmenter('hair');
      if (!seg) return null;
      const result = seg.segment(img);
      if (!result) return null;
      // outputCategoryMask: true → result.categoryMask (MPMask, getAsUint8Array 가능)
      const cm = result.categoryMask;
      if (!cm) return null;
      const u8 = cm.getAsUint8Array ? cm.getAsUint8Array() : null;
      const w = (cm.width || (img.naturalWidth || img.width)) | 0;
      const h = (cm.height || (img.naturalHeight || img.height)) | 0;
      try { cm.close && cm.close(); } catch (_e) { /* ignore */ }
      if (!u8) return null;
      return { mask: u8, w, h };
    } catch (e) {
      console.warn('[mediapipe] hair segment fail:', e && e.message);
      return null;
    }
  }

  function _hairSegStatus() { return _segState.hair.status; }
  function _hairSegError()  { return _segState.hair.error; }

  window.MediaPipeLoader = {
    REGIONS,
    load: _load,
    status: () => _state.status,
    progress: () => _state.progress,
    error: () => _state.error,
    detect: _detect,
    regionPolygon: _regionPolygon,
    pathPolygon: _pathPolygon,
    drawFallbackEllipsePath: _drawFallbackEllipsePath,
    isReady: () => _state.status === 'ready',
    onProgress: _onProgress,
    // v313 stub — v315 에서 실제 구현
    loadHandLandmarker: _loadHandLandmarker,
    detectHand: _detectHand,
    handStatus: () => _handState.status,
    handError: () => _handState.error,
    // v331 — Hair Image Segmenter (Tier 1)
    loadImageSegmenter: _loadImageSegmenter,
    segmentHair: _segmentHair,
    hairSegStatus: _hairSegStatus,
    hairSegError: _hairSegError,
  };
})();
