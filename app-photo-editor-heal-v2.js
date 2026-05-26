/* 사진 편집기 — Spot Healing v2 (단순 inpainting, Sprint 5 v230 2026-05-19)
   plan v3: Poisson 빼고 단순 inpainting (60~120줄). 미용실 워크플로우 충분.

   동작:
     1. brush 탭 활성 시 패널에 "✨ 잡티 자동 제거 (클릭 한 번)" 버튼 자동 주입
     2. 활성 모드 진입: 사진 위 마우스가 십자 커서, 클릭하면 그 자리 자동 제거
     3. 알고리즘: 클릭 위치 주변 8방향 sample (반경 R 의 r*2 거리) → 평균 색 → 가우시안 페더로 alpha blend
     4. R 슬라이더 (잡티 크기) — 8~40px

   메인 파일 수정 없음 (MutationObserver 자동 주입).
*/
(function () {
  'use strict';
  if (window.PhotoEditorHealV2) return;

  const DEFAULT_RADIUS = 18;  // 잡티 반경 (CSS 픽셀)
  let _enabled = false;
  let _radius = DEFAULT_RADIUS;
  let _stateRef = null;
  let _helpersRef = null;
  let _clickHandler = null;
  let _canvas = null;

  // ── inpainting 알고리즘 ──
  // 클릭 위치 (cx, cy) 주변 8방향 sample (반경 r*1.5 거리) → 평균 색
  // 그 후 cx, cy 중심 가우시안 마스크로 alpha blend
  function _inpaint(canvas, cx, cy, r) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const box = _inpaintBox(W, H, cx, cy, r);
    if (!box) return;
    const img = ctx.getImageData(box.x0, box.y0, box.w, box.h);
    const d = img.data;
    const sample = _sampleAround(d, box, W, H, cx, cy, r);
    if (!sample) return;
    _blendPatch(d, box, cx, cy, r, sample);
    ctx.putImageData(img, box.x0, box.y0);
  }

  function _inpaintBox(W, H, cx, cy, r) {
    const pad = Math.round(r * 1.8);
    const x0 = Math.max(0, cx - pad), y0 = Math.max(0, cy - pad);
    const x1 = Math.min(W, cx + pad), y1 = Math.min(H, cy + pad);
    if (x1 <= x0 || y1 <= y0) return null;
    return { x0, y0, w: x1 - x0, h: y1 - y0, pad };
  }

  function _sampleAround(d, box, W, H, cx, cy, r) {
    const sampleDist = Math.round(r * 1.5);
    const angles = [0, 45, 90, 135, 180, 225, 270, 315];
    let sumR = 0, sumG = 0, sumB = 0, cnt = 0;
    angles.forEach(deg => {
      const rad = deg * Math.PI / 180;
      const sx = Math.round(cx + Math.cos(rad) * sampleDist);
      const sy = Math.round(cy + Math.sin(rad) * sampleDist);
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;
      const px = _sample3x3(d, box, W, H, sx, sy);
      if (px) { sumR += px.r; sumG += px.g; sumB += px.b; cnt++; }
    });
    return cnt ? { r: sumR / cnt, g: sumG / cnt, b: sumB / cnt } : null;
  }

  function _sample3x3(d, box, W, H, sx, sy) {
    let r = 0, g = 0, b = 0, count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const px = sx + dx, py = sy + dy;
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        const idx = ((py - box.y0) * box.w + (px - box.x0)) * 4;
        if (idx < 0 || idx >= d.length) continue;
        r += d[idx]; g += d[idx + 1]; b += d[idx + 2]; count++;
      }
    }
    return count ? { r: r / count, g: g / count, b: b / count } : null;
  }

  function _blendPatch(d, box, cx, cy, r, sample) {
    const sigma = r * 0.55;
    const inv2sig2 = 1 / (2 * sigma * sigma);
    for (let yy = 0; yy < box.h; yy++) {
      for (let xx = 0; xx < box.w; xx++) {
        const idx = (yy * box.w + xx) * 4;
        const gx = xx + box.x0 - cx, gy = yy + box.y0 - cy;
        const dist2 = gx * gx + gy * gy;
        if (dist2 > box.pad * box.pad) continue;
        const alpha = Math.exp(-dist2 * inv2sig2);  // 0~1
        if (alpha < 0.02) continue;
        d[idx] = Math.round(d[idx] * (1 - alpha) + sample.r * alpha);
        d[idx + 1] = Math.round(d[idx + 1] * (1 - alpha) + sample.g * alpha);
        d[idx + 2] = Math.round(d[idx + 2] * (1 - alpha) + sample.b * alpha);
      }
    }
  }

  // 사진 클릭 → originalImg 의 좌표로 변환 → inpaint → originalImg 갱신
  function _onClick(e) {
    if (!_enabled || !_stateRef) return;
    const img = _stateRef.originalImg;
    if (!img) { if (_helpersRef && _helpersRef.toast) _helpersRef.toast('사진을 먼저 불러오세요'); return; }
    const cv = e.currentTarget;
    const rect = cv.getBoundingClientRect();
    const ratioX = img.naturalWidth / rect.width;
    const ratioY = img.naturalHeight / rect.height;
    const cx = Math.round((e.clientX - rect.left) * ratioX);
    const cy = Math.round((e.clientY - rect.top) * ratioY);
    const rOrig = Math.round(_radius * ratioX);  // 클릭 좌표계에서 반경 변환

    // originalImg 의 픽셀을 오프스크린 캔버스에서 inpaint 한 뒤 originalImg 교체
    const off = document.createElement('canvas');
    off.width = img.naturalWidth;
    off.height = img.naturalHeight;
    off.getContext('2d').drawImage(img, 0, 0);
    _inpaint(off, cx, cy, rOrig);

    const url = off.toDataURL('image/png');
    const newImg = new Image();
    newImg.onload = () => {
      _stateRef.originalImg = newImg;
      _stateRef.originalSrc = url;
      if (_helpersRef && _helpersRef.scheduleRedraw) _helpersRef.scheduleRedraw();
      if (_helpersRef && _helpersRef.pushHistory) _helpersRef.pushHistory();
      if (_helpersRef && _helpersRef.toast) _helpersRef.toast('잡티 제거 완료 — 다른 곳도 클릭 가능');
    };
    newImg.src = url;
  }

  function _attachClickHandler() {
    if (_canvas && _clickHandler) {
      _canvas.removeEventListener('click', _clickHandler);
    }
    _canvas = document.getElementById('peCanvas');
    if (!_canvas) return;
    _clickHandler = _onClick;
    _canvas.addEventListener('click', _clickHandler);
    _canvas.style.cursor = _enabled ? 'crosshair' : '';
  }

  function _detachClickHandler() {
    if (_canvas && _clickHandler) {
      _canvas.removeEventListener('click', _clickHandler);
      _canvas.style.cursor = '';
    }
    _clickHandler = null;
  }

  function _toggle(state, helpers) {
    _enabled = !_enabled;
    _stateRef = state; _helpersRef = helpers;
    if (_enabled) _attachClickHandler();
    else _detachClickHandler();
    if (helpers && helpers.toast) helpers.toast(_enabled ? '잡티 클릭 모드 ON — 사진에서 잡티 클릭' : '잡티 클릭 모드 OFF');
    _refreshButton();
  }

  // brush 탭 패널 위에 자동 주입
  function _inject(panel, state, helpers) {
    if (!panel || panel.querySelector('[data-pe-heal-v2]')) return;
    _stateRef = state; _helpersRef = helpers;
    const wrap = document.createElement('div');
    wrap.dataset.peHealV2 = '1';
    wrap.style.cssText = 'background:rgba(123,97,255,0.06);border-radius:12px;padding:10px 12px;margin:8px 0;';
    wrap.innerHTML = `
      <div class="pe-field-label" style="margin-bottom:6px;"><svg class="pe-ic" viewBox="0 0 24 24" style="margin-right:4px;"><use href="#ic-wand-sparkles"/></svg> 잡티 자동 제거 (클릭 한 번)</div>
      <div class="pe-hint" style="margin-bottom:8px;">아래 버튼 켜고 사진에서 잡티를 한 번 클릭하면 자동으로 제거돼요.</div>
      <div style="display:flex;gap:8px;align-items:center;">
        <button type="button" id="peHealToggle" class="pe-action-btn">${_enabled ? '잡티 클릭 모드 ON (끄기)' : '잡티 자동 제거 켜기'}</button>
      </div>
      <label class="pe-field" style="margin-top:8px;">
        <span>잡티 크기 (${_radius}px)</span>
        <input type="range" min="8" max="60" step="1" value="${_radius}" data-pe-heal-radius>
      </label>`;
    panel.insertBefore(wrap, panel.firstChild);
    const btn = wrap.querySelector('#peHealToggle');
    btn.addEventListener('click', () => _toggle(state, helpers));
    const rIn = wrap.querySelector('[data-pe-heal-radius]');
    rIn.addEventListener('input', () => {
      _radius = parseInt(rIn.value, 10);
      const span = wrap.querySelector('span');
      if (span) span.textContent = `잡티 크기 (${_radius}px)`;
    });
  }

  function _refreshButton() {
    const btn = document.getElementById('peHealToggle');
    if (!btn) return;
    btn.textContent = _enabled ? '잡티 클릭 모드 ON (끄기)' : '잡티 자동 제거 켜기';
    btn.style.background = _enabled ? '#D58A95' : 'linear-gradient(135deg,#c87c8a,#7b61ff)';
  }

  // brush 탭 활성 시 자동 주입 (MutationObserver — v218 pattern)
  function _watchPanel() {
    const sheet = document.getElementById('photoEditorSheet');
    const panel = sheet && sheet.querySelector('#pePanel');
    if (!panel) { setTimeout(_watchPanel, 800); return; }
    const tryInject = () => {
      const PE = window.PhotoEditor;
      if (!PE || !PE._internal) return;
      const state = PE._internal.getState();
      const helpers = PE._internal.helpers;
      if (!state || state.activeTab !== 'brush') {
        // 다른 탭으로 떠나면 click handler 정리
        if (_enabled) _toggle(state, helpers);
        return;
      }
      _inject(panel, state, helpers);
    };
    tryInject();
    new MutationObserver(tryInject).observe(panel, { childList: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _watchPanel);
  else _watchPanel();

  window.PhotoEditorHealV2 = { toggle: _toggle, inpaint: _inpaint };
})();
