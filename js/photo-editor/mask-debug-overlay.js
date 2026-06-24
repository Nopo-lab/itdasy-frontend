/* 사진 편집기 — Mask Debug Overlay (v313 2026-05-28)
   RegionMaskProvider 가 사용하는 디버그 시각화 도구.

   활성 조건:
     - localStorage.getItem('PE_MASK_DEBUG') === '1'
     - (옵션) URL ?pe_debug=1

   동작:
     - peCanvas 위에 absolute 위치 overlay canvas 생성
     - 마스크별 색 (피부=핑크, 헤어=시안, 입술=빨강, 눈=노랑, 배경=회색)
     - alpha 0.35 정도 (보정 화면 가독성 유지)
     - pointer-events: none (캔버스 조작 막지 않음)
     - 기본 OFF
     - console.table 로 통계 출력

   API:
     window.MaskDebugOverlay = {
       isEnabled()                              → boolean
       setEnabled(on)                           → boolean
       render(maskMap, canvasW, canvasH)        → void
       clear()                                  → void
       logStats(statsArray)                     → void
     };

   v313: provider 외에서 직접 호출 안 함. 보정 결과 변경 X.
*/
(function () {
  'use strict';
  if (window.MaskDebugOverlay) return;

  const OVERLAY_ID = 'peMaskDebugOverlay';
  const COLORS = {
    skinMask:         [255, 120, 170], // 핑크
    hairMask:         [145, 90,  220], // 보라
    lipMask:          [255, 60,  90],  // 빨강
    eyeMask:          [70,  130, 240], // 파랑
    backgroundMask:   [140, 140, 140], // 회색
    browMask:         [90,  200, 110], // 초록
    nailMask:         [240, 110, 175], // 핑크
    handSkinMask:     [240, 160, 70],  // 주황
    eyelashBandMask:  [180, 80,  255], // 보라
    hairBoundaryMask: [0,   180, 255], // 라이트블루
    scleraMask:       [80,  220, 255], // PE-M1 흰자(밝은 청록)
  };
  const ALPHA = 0.35;

  function _query(qs) {
    try { return new URLSearchParams(window.location.search).get(qs); }
    catch (_e) { return null; }
  }

  function isEnabled() {
    if (window.__ITDASY_PHOTO_DEBUG__) return true;   // [v537] 통합 사진편집 디버그 플래그
    try {
      if (window.localStorage && localStorage.getItem('PE_MASK_DEBUG') === '1') return true;
    } catch (_e) { /* ignore */ }
    return _query('pe_debug') === '1';
  }

  function setEnabled(on) {
    try {
      if (on) localStorage.setItem('PE_MASK_DEBUG', '1');
      else localStorage.removeItem('PE_MASK_DEBUG');
    } catch (_e) { /* ignore */ }
    if (!on) clear();
    return isEnabled();
  }

  function _ensureOverlayCanvas() {
    const peCanvas = document.getElementById('peCanvas');
    if (!peCanvas || !peCanvas.parentNode) return null;
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;
    overlay = document.createElement('canvas');
    overlay.id = OVERLAY_ID;
    overlay.style.position = 'absolute';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '5';
    overlay.style.mixBlendMode = 'multiply';
    const parent = peCanvas.parentNode;
    // peCanvas 와 같은 부모 (pe-canvas-wrap) 에 삽입
    if (parent && getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }
    parent.appendChild(overlay);
    return overlay;
  }

  function clear() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    try {
      const ctx = overlay.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
    } catch (_e) { /* ignore */ }
  }

  // maskMap = { skinMask: {mask: Float32Array, ...meta}, hairMask: {...}, ... }
  // canvasW/H = 원본 사진의 픽셀 크기 (마스크와 동일)
  function render(maskMap, canvasW, canvasH) {
    if (!isEnabled()) { clear(); return; }
    try {
      const w = canvasW | 0, h = canvasH | 0;
      if (!w || !h || !maskMap) return;
      const overlay = _ensureOverlayCanvas();
      if (!overlay) return;
      if (overlay.width !== w) overlay.width = w;
      if (overlay.height !== h) overlay.height = h;
      const ctx = overlay.getContext('2d');
      if (!ctx) return;
      const img = ctx.createImageData(w, h);
      const d = img.data;
      // 마스크 합성 (가산) — 여러 마스크가 같은 픽셀이면 색이 섞임
      Object.keys(maskMap).forEach(key => {
        const entry = maskMap[key];
        if (!entry || !entry.mask || !entry.mask.length) return;
        if (entry.status === 'pendingImplementation' || entry.status === 'failed') return;
        const color = COLORS[key] || [255, 255, 255];
        const mask = entry.mask;
        if (mask.length !== w * h) return;
        for (let i = 0, j = 0; i < mask.length; i++, j += 4) {
          const v = mask[i];
          if (v <= 0.02) continue;
          const a = v * ALPHA * 255;
          // alpha blending (over existing)
          const ea = d[j + 3];
          const na = a + ea * (1 - a / 255);
          if (na <= 0) continue;
          d[j]     = (color[0] * a + d[j]     * ea * (1 - a / 255)) / na;
          d[j + 1] = (color[1] * a + d[j + 1] * ea * (1 - a / 255)) / na;
          d[j + 2] = (color[2] * a + d[j + 2] * ea * (1 - a / 255)) / na;
          d[j + 3] = na;
        }
      });
      ctx.putImageData(img, 0, 0);
    } catch (e) {
      console.warn('[mask-debug] render failed:', e && e.message);
    }
  }

  function logStats(statsArray) {
    if (!isEnabled()) return;
    try {
      if (console && console.table && Array.isArray(statsArray)) {
        console.groupCollapsed('[RegionMaskProvider] stats');
        console.table(statsArray);
        console.groupEnd();
      } else if (console && console.log) {
        console.log('[RegionMaskProvider] stats', statsArray);
      }
    } catch (_e) { /* ignore */ }
  }

  // 사진 바뀔 때 overlay 차원 동기화는 다음 render() 호출에서 자동.
  // 사진편집기 닫힐 때는 caller 가 clear() 호출 권장.

  window.MaskDebugOverlay = {
    isEnabled,
    setEnabled,
    render,
    clear,
    logStats,
    _COLORS: COLORS,
  };
})();
