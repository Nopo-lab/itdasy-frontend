/* 사진 편집기 — 핀치 줌·패닝 디스패처 (v225 2026-05-19, Sprint 1)
   1.0 ~ 7.99x = CSS transform 모드 (기존 v203 동작 그대로)
   8.0 ~ 32.0x = pixel 모드 (app-photo-editor-zoom-pixel.js 위임, nearest 재렌더 + grid + minimap)

   진입/복귀 hysteresis:
     - 진입: 7.5 → 8.0 넘어가는 순간 transform 해제 + pixel.enter()
     - 복귀: 7.0 이하로 떨어지는 순간 pixel.exit() + transform 재개

   pixel 모드 진입 시 wrap.transform 은 scale 1.0 + tx/ty 0 으로 reset.
   pan/zoom 처리는 모두 PhotoEditorZoomPixel 이 책임.

   API (변경 없음):
     • window.PhotoEditor._zoomAttach(wrap, state)
     • window.PhotoEditor._zoomCleanup()
*/
(function () {
  'use strict';

  const MIN = 1.0, MAX = 32.0;               // v225: 4 → 32
  const PIXEL_ENTER = 8.0, PIXEL_EXIT = 7.0; // hysteresis

  function _ensureZoomState(state) {
    if (!state.zoom) state.zoom = { scale: 1, tx: 0, ty: 0, mode: 'transform' };
    if (!state.zoom.mode) state.zoom.mode = 'transform';
    return state.zoom;
  }

  function _applyTransform(wrap, z) {
    if (z.mode === 'pixel') return; // pixel 모드 중엔 transform 건드리지 않음
    wrap.style.transformOrigin = '50% 50%';
    wrap.style.transform = `translate(${z.tx}px, ${z.ty}px) scale(${z.scale})`;
  }

  function _resetTransform(wrap, z) {
    z.scale = 1; z.tx = 0; z.ty = 0;
    wrap.style.transform = 'translate(0px, 0px) scale(1)';
  }

  function _enterPixelMode(wrap, state, z) {
    if (z.mode === 'pixel') return;
    z.mode = 'pixel';
    // wrap transform 초기화 — pixel 모듈이 자체 캔버스에 렌더하므로 wrap 변형 불필요
    wrap.style.transform = 'translate(0px, 0px) scale(1)';
    const Pixel = window.PhotoEditorZoomPixel;
    if (Pixel && typeof Pixel.enter === 'function') {
      try { Pixel.enter(wrap, state, z); } catch (_e) { /* 폴백: 그냥 transform 으로 클램프 */ z.scale = PIXEL_EXIT; z.mode = 'transform'; _applyTransform(wrap, z); }
    } else {
      // pixel 모듈 로드 전이면 transform 모드로 클램프
      z.scale = PIXEL_EXIT; z.mode = 'transform';
      _applyTransform(wrap, z);
    }
  }

  function _exitPixelMode(wrap, state, z) {
    if (z.mode !== 'pixel') return;
    const Pixel = window.PhotoEditorZoomPixel;
    if (Pixel && typeof Pixel.exit === 'function') {
      try { Pixel.exit(); } catch (_e) { /* ignore */ }
    }
    z.mode = 'transform';
    _applyTransform(wrap, z);
  }

  function _applyScale(wrap, state, z, newScale) {
    const clamped = Math.max(MIN, Math.min(MAX, newScale));
    z.scale = clamped;
    // mode 전환 hysteresis
    if (z.mode === 'transform' && clamped >= PIXEL_ENTER) {
      _enterPixelMode(wrap, state, z);
    } else if (z.mode === 'pixel' && clamped <= PIXEL_EXIT) {
      _exitPixelMode(wrap, state, z);
    } else if (z.mode === 'pixel') {
      const Pixel = window.PhotoEditorZoomPixel;
      if (Pixel && typeof Pixel.update === 'function') Pixel.update(z);
    } else {
      _applyTransform(wrap, z);
    }
  }

  function _applyPan(wrap, state, z, newTx, newTy) {
    z.tx = newTx; z.ty = newTy;
    if (z.mode === 'pixel') {
      const Pixel = window.PhotoEditorZoomPixel;
      if (Pixel && typeof Pixel.update === 'function') Pixel.update(z);
    } else {
      _applyTransform(wrap, z);
    }
  }

  function _reset(wrap, state, z) {
    _exitPixelMode(wrap, state, z);
    _resetTransform(wrap, z);
  }

  function _dist(t1, t2) { return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY); }
  function _mid(t1, t2)  { return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 }; }

  function _attach(wrap, state) {
    if (!wrap || wrap._zoomBound) return;
    wrap._zoomBound = true;
    const ctx = _zoomCtx(wrap, state);
    _applyTransform(wrap, ctx.z);
    _bindTouchZoom(ctx);
    _bindWheelZoom(ctx);
    wrap._zoomCleanup = () => _cleanupWrap(ctx);
  }

  function _zoomCtx(wrap, state) {
    return {
      wrap, state, z: _ensureZoomState(state), startDist: 0, startScale: 1,
      startMid: null, startTx: 0, startTy: 0, panStart: null, lastTap: 0,
    };
  }

  function _bindTouchZoom(ctx) {
    ctx.onTouchStart = e => _onTouchStart(ctx, e);
    ctx.onTouchMove = e => _onTouchMove(ctx, e);
    ctx.onTouchEnd = e => _onTouchEnd(ctx, e);
    ctx.wrap.addEventListener('touchstart', ctx.onTouchStart, { passive: false });
    ctx.wrap.addEventListener('touchmove', ctx.onTouchMove, { passive: false });
    ctx.wrap.addEventListener('touchend', ctx.onTouchEnd);
    ctx.wrap.addEventListener('touchcancel', ctx.onTouchEnd);
  }

  function _onTouchStart(ctx, e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      ctx.startDist = _dist(e.touches[0], e.touches[1]);
      ctx.startScale = ctx.z.scale;
      ctx.startMid = _mid(e.touches[0], e.touches[1]);
      ctx.startTx = ctx.z.tx; ctx.startTy = ctx.z.ty; ctx.panStart = null;
    } else if (e.touches.length === 1 && !(ctx.state && ctx.state.activeTab === 'brush') && ctx.z.scale > 1.05) {
      ctx.panStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      ctx.startTx = ctx.z.tx; ctx.startTy = ctx.z.ty;
    }
  }

  function _onTouchMove(ctx, e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const d = _dist(e.touches[0], e.touches[1]);
      const m = _mid(e.touches[0], e.touches[1]);
      ctx.z.tx = ctx.startTx + (ctx.startMid ? m.x - ctx.startMid.x : 0);
      ctx.z.ty = ctx.startTy + (ctx.startMid ? m.y - ctx.startMid.y : 0);
      _applyScale(ctx.wrap, ctx.state, ctx.z, ctx.startScale * (d / Math.max(1, ctx.startDist)));
    } else if (e.touches.length === 1 && ctx.panStart) {
      e.preventDefault();
      _applyPan(ctx.wrap, ctx.state, ctx.z, ctx.startTx + e.touches[0].clientX - ctx.panStart.x, ctx.startTy + e.touches[0].clientY - ctx.panStart.y);
    }
  }

  function _onTouchEnd(ctx, e) {
    if (e.touches.length !== 0) return;
    ctx.panStart = null;
    if (ctx.z.scale < 1.05) _reset(ctx.wrap, ctx.state, ctx.z);
    const now = Date.now();
    if (now - ctx.lastTap < 300 && ctx.z.scale > 1.05) { _reset(ctx.wrap, ctx.state, ctx.z); ctx.lastTap = 0; }
    else ctx.lastTap = now;
  }

  function _bindWheelZoom(ctx) {
    ctx.onWheel = e => _onWheel(ctx, e);
    ctx.wrap.addEventListener('wheel', ctx.onWheel, { passive: false });
  }

  function _onWheel(ctx, e) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const stepK = ctx.z.scale < 4 ? 0.1 : (ctx.z.scale < 12 ? 0.4 : 1.2);
    const next = ctx.z.scale + (e.deltaY > 0 ? -stepK : stepK);
    if (next < 1.05) _reset(ctx.wrap, ctx.state, ctx.z);
    else _applyScale(ctx.wrap, ctx.state, ctx.z, next);
  }

  function _cleanupWrap(ctx) {
    ctx.wrap.removeEventListener('touchstart', ctx.onTouchStart);
    ctx.wrap.removeEventListener('touchmove', ctx.onTouchMove);
    ctx.wrap.removeEventListener('touchend', ctx.onTouchEnd);
    ctx.wrap.removeEventListener('touchcancel', ctx.onTouchEnd);
    ctx.wrap.removeEventListener('wheel', ctx.onWheel);
    ctx.wrap._zoomBound = false;
    _reset(ctx.wrap, ctx.state, ctx.z);
    ctx.wrap.style.transform = '';
  }

  function _cleanup() {
    const wrap = document.querySelector('.pe-canvas-wrap');
    if (wrap && typeof wrap._zoomCleanup === 'function') wrap._zoomCleanup();
  }

  function _register() {
    if (!window.PhotoEditor) return false;
    window.PhotoEditor._zoomAttach  = _attach;
    window.PhotoEditor._zoomCleanup = _cleanup;
    // pixel 모듈에서 사용할 헬퍼 — 현재 모드 + 상수 노출
    window.PhotoEditor._zoomConstants = { MIN, MAX, PIXEL_ENTER, PIXEL_EXIT };
    return true;
  }
  if (!_register()) {
    let tries = 0;
    const iv = setInterval(() => { if (_register() || ++tries > 50) clearInterval(iv); }, 100);
  }
})();
