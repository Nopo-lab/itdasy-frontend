/* 사진 편집기 — 조명/플래시 보정 */
(function () {
  'use strict';
  if (window.PhotoEditorRelight) return;

  const DEF = { direction: 0.5, warmth: 0, intensity: 0, ambientBoost: 0, flash: 0 };

  function _state(edState) {
    if (!edState.relight) edState.relight = Object.assign({}, DEF);
    return Object.assign(edState.relight, Object.keys(DEF).reduce((a, k) => {
      if (edState.relight[k] == null) a[k] = DEF[k];
      return a;
    }, {}));
  }

  function _panelHTML(edState) {
    const s = _state(edState);
    return `<div class="pe-field-label">조명 · 플래시</div>
      <div class="pe-panel-row pe-panel-grid-2" style="margin-bottom:10px;">
        <button type="button" class="pe-action-btn" data-relight-preset="studio">스튜디오 조명</button>
        <button type="button" class="pe-action-btn" data-relight-preset="flash">사진 플래시</button>
        <button type="button" class="pe-chip-btn" data-relight-preset="ring">링라이트</button>
        <button type="button" class="pe-chip-btn" data-relight-reset>초기화</button>
      </div>
      ${_slider('조명 방향', 'direction', Math.round(s.direction * 100), 0, 100)}
      ${_slider('색온도', 'warmth', s.warmth, -50, 50)}
      ${_slider('조명 강도', 'intensity', s.intensity, 0, 100)}
      ${_slider('어두운 곳 살리기', 'ambientBoost', s.ambientBoost, 0, 100)}
      ${_slider('플래시 반짝임', 'flash', s.flash, 0, 100)}
      <div class="pe-hint">매장 조명이 어둡거나 얼굴·네일이 죽어 보일 때 쓰는 빠른 조명 보정이에요.</div>`;
  }

  function _slider(label, key, val, min, max) {
    return `<label class="pe-slider"><div class="pe-slider-head"><span>${label}</span><span class="pe-slider-val" data-relight-val="${key}">${val}</span></div><input type="range" min="${min}" max="${max}" value="${val}" data-relight="${key}"></label>`;
  }

  function _bindPanel(panel, edState, helpers) {
    const scheduleRedraw = helpers.scheduleRedraw, pushHistory = helpers.pushHistory;
    const s = _state(edState);
    panel.querySelectorAll('[data-relight]').forEach(inp => {
      inp.addEventListener('input', () => {
        const key = inp.dataset.relight;
        s[key] = key === 'direction' ? +inp.value / 100 : +inp.value;
        const out = panel.querySelector(`[data-relight-val="${key}"]`);
        if (out) out.textContent = inp.value;
        scheduleRedraw();
      });
      inp.addEventListener('change', () => pushHistory && pushHistory());
    });
    panel.querySelectorAll('[data-relight-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        Object.assign(s, _preset(btn.dataset.relightPreset));
        helpers.renderPanel(); scheduleRedraw(); pushHistory && pushHistory();
        helpers.toast && helpers.toast(btn.textContent.trim() + ' 적용');
      });
    });
    panel.querySelector('[data-relight-reset]')?.addEventListener('click', () => {
      Object.assign(s, DEF);
      helpers.renderPanel(); scheduleRedraw(); pushHistory && pushHistory();
    });
  }

  function _preset(id) {
    if (id === 'flash') return { direction: 0.5, warmth: -4, intensity: 34, ambientBoost: 18, flash: 62 };
    if (id === 'ring') return { direction: 0.5, warmth: 3, intensity: 42, ambientBoost: 26, flash: 34 };
    return { direction: 0.55, warmth: 8, intensity: 58, ambientBoost: 42, flash: 12 };
  }

  function _drawRelight(peCanvas, edState) {
    const s = _state(edState);
    if (!(s.intensity || s.ambientBoost || s.flash || s.warmth)) return;
    const ctx = peCanvas.getContext('2d');
    const w = peCanvas.width, h = peCanvas.height;
    try {
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;
      _walk(d, w, h, s);
      ctx.putImageData(imgData, 0, 0);
    } catch (e) {
      console.warn('[relight] getImageData 실패 — canvas tainted?', e.message);
      if (!_drawRelight._warned) { _drawRelight._warned = true; if (window.showToast) window.showToast('조명 보정 불가 — 사진을 파일에서 다시 불러와 주세요'); }
    }
  }

  function _walk(d, w, h, s) {
    const dir = s.direction, warmth = s.warmth / 100;
    const intens = s.intensity / 100, ambient = s.ambientBoost / 100, flash = s.flash / 100;
    const cx = 0.5, cy = 0.46;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const nx = x / w, ny = y / h;
        const luma = (d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114) / 255;
        const side = 1 - Math.abs(nx - dir) * 0.65;
        const dist = Math.hypot((nx - cx) * 1.15, ny - cy);
        const radial = Math.max(0, 1 - dist * 1.7);
        const boost = 1 + intens * side * 0.32 + flash * radial * 0.34;
        const shadow = luma < 0.42 ? ambient * (0.42 - luma) * 1.7 * 255 : 0;
        let r = d[i] * boost + shadow;
        let g = d[i+1] * boost + shadow;
        let b = d[i+2] * boost + shadow;
        r += warmth * 28 - Math.max(0, -warmth) * 8;
        b -= Math.max(0, warmth) * 14;
        b += Math.max(0, -warmth) * 22 + flash * radial * 8;
        d[i] = _clamp(r); d[i+1] = _clamp(g); d[i+2] = _clamp(b);
      }
    }
  }

  function _clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

  function _register() {
    if (!window.PhotoEditor || !window.PhotoEditor._internal) return false;
    const i = window.PhotoEditor._internal;
    const tabsNav = document.getElementById('peTabs');
    if (tabsNav && !tabsNav.querySelector('[data-pe-tab="relight"]')) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'pe-tab'; btn.dataset.peTab = 'relight'; btn.textContent = '조명';
      const filmTab = tabsNav.querySelector('[data-pe-tab="film"]');
      if (filmTab) tabsNav.insertBefore(btn, filmTab);
      else tabsNav.appendChild(btn);
    }
    i.registerTabPanel('relight', { html: _panelHTML, bind: _bindPanel });
    i.registerDrawHook('relight', _drawRelight);
    return true;
  }

  if (!_register()) {
    let t = 0;
    const iv = setInterval(() => { if (_register() || ++t > 50) clearInterval(iv); }, 100);
  }

  window.PhotoEditorRelight = { presets: _preset, draw: _drawRelight };
})();
