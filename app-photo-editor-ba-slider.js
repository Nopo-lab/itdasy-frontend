/* 사진 편집기 — Before/After 인터랙티브 슬라이더 */
(function () {
  'use strict';

  let _baState = {
    enabled: false,
    secondImg: null,
    secondSrc: '',
    position: 0.5,        // 0~1, 슬라이더 위치
    mode: 'vertical',     // vertical(좌우) | horizontal(상하)
    dividerStyle: 'line', // line | gradient | none
    leftLabel: 'BEFORE',
    rightLabel: 'AFTER',
    labelVisible: true,
    animating: false,
  };

  let _dragging = false;

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  function _panelHTML() {
    const ba = _baState;
    return `
      <div class="pe-field-label">Before / After 비교</div>
      <div class="pe-panel-row">
        <button type="button" class="pe-action-btn" data-ba-pick>📷 비교할 사진 고르기 (${ba.secondImg ? '선택됨 ✓' : '미선택'})</button>
      </div>
      <input type="file" id="baPicker" accept="image/*" style="display:none" />
      ${_modeSection(ba)}
      ${_styleSection(ba)}
      ${_labelSection(ba)}
      ${_controlSection(ba)}
      <div class="pe-panel-row" style="margin-top:10px;">
        <button type="button" class="pe-action-btn" data-ba-export>💾 현재 비교 화면 저장</button>
      </div>

      <div class="pe-hint">
        캔버스 위에서 직접 드래그해도 슬라이더가 움직여요. 터치·마우스 모두 지원.
        ${!ba.secondImg ? '<br><strong>비교할 사진을 먼저 골라주세요.</strong>' : ''}
      </div>`;
  }

  function _modeSection(ba) {
    const btn = (m, label) => `<button type="button" class="pe-chip-btn${ba.mode === m ? ' on' : ''}" data-ba-mode="${m}">${label}</button>`;
    return `<div class="pe-field-label" style="margin-top:12px;">비교 방향</div>
      <div class="pe-panel-row pe-panel-grid-2">${btn('vertical', '⇋ 좌우 비교')}${btn('horizontal', '⇵ 상하 비교')}</div>`;
  }

  function _styleSection(ba) {
    const btn = (s, label) => `<button type="button" class="pe-chip-btn${ba.dividerStyle === s ? ' on' : ''}" data-ba-style="${s}">${label}</button>`;
    return `<div class="pe-field-label" style="margin-top:10px;">구분선 스타일</div>
      <div class="pe-panel-row pe-panel-grid-3" style="display:flex;gap:6px;">${btn('line', '라인')}${btn('gradient', '그라데이션')}${btn('none', '없음')}</div>`;
  }

  function _labelSection(ba) {
    return `<label class="pe-field" style="margin-top:10px;"><span>왼쪽/위 라벨</span><input type="text" class="pe-input" data-ba-left value="${_esc(ba.leftLabel)}" maxlength="12" /></label>
      <label class="pe-field"><span>오른쪽/아래 라벨</span><input type="text" class="pe-input" data-ba-right value="${_esc(ba.rightLabel)}" maxlength="12" /></label>`;
  }

  function _controlSection(ba) {
    return `<div class="pe-panel-row pe-panel-grid-2" style="margin-top:8px;">
        <button type="button" class="pe-chip-btn${ba.labelVisible ? ' on' : ''}" data-ba-label-toggle>라벨 ${ba.labelVisible ? '숨기기' : '보이기'}</button>
        <button type="button" class="pe-chip-btn" data-ba-animate>✨ 슬라이드 애니메이션</button>
      </div>
      <label class="pe-slider" style="margin-top:10px;"><div class="pe-slider-head"><span>슬라이더 위치</span><span class="pe-slider-val">${Math.round(ba.position * 100)}%</span></div><input type="range" min="0" max="100" value="${Math.round(ba.position * 100)}" data-ba-pos /></label>`;
  }

  function _bindPanel(panel, state, helpers) {
    _bindPhotoPick(panel, helpers);
    _bindModeStyle(panel, helpers);
    _bindLabels(panel, helpers);
    _bindControls(panel, state, helpers);
    _attachCanvasDrag(helpers);
  }

  function _bindPhotoPick(panel, helpers) {
    panel.querySelector('[data-ba-pick]')?.addEventListener('click', () => panel.querySelector('#baPicker')?.click());
    panel.querySelector('#baPicker')?.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) _loadSecondImage(file, helpers);
    });
  }

  function _loadSecondImage(file, helpers) {
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      _baState.secondImg = img;
      _baState.secondSrc = src;
      _baState.enabled = true;
      helpers.renderPanel(); helpers.redraw(); helpers.pushHistory();
      helpers.toast('비교 사진 선택 완료');
    };
    img.onerror = () => helpers.toast('사진 로드 실패');
    img.src = src;
  }

  function _bindModeStyle(panel, helpers) {
    panel.querySelectorAll('[data-ba-mode]').forEach(btn => {
      btn.addEventListener('click', () => { _baState.mode = btn.dataset.baMode; helpers.renderPanel(); helpers.redraw(); });
    });
    panel.querySelectorAll('[data-ba-style]').forEach(btn => {
      btn.addEventListener('click', () => { _baState.dividerStyle = btn.dataset.baStyle; helpers.renderPanel(); helpers.redraw(); });
    });
  }

  function _bindLabels(panel, helpers) {
    panel.querySelector('[data-ba-left]')?.addEventListener('input', (e) => { _baState.leftLabel = e.target.value; helpers.redraw(); });
    panel.querySelector('[data-ba-right]')?.addEventListener('input', (e) => { _baState.rightLabel = e.target.value; helpers.redraw(); });
    panel.querySelector('[data-ba-label-toggle]')?.addEventListener('click', () => {
      _baState.labelVisible = !_baState.labelVisible;
      helpers.renderPanel(); helpers.redraw();
    });
  }

  function _bindControls(panel, state, helpers) {
    panel.querySelector('[data-ba-pos]')?.addEventListener('input', (e) => {
      _baState.position = +e.target.value / 100;
      helpers.redraw();
    });
    panel.querySelector('[data-ba-animate]')?.addEventListener('click', () => _animateSlider(helpers.redraw));
    panel.querySelector('[data-ba-export]')?.addEventListener('click', () => _exportBA(state, helpers));
  }

  // ── 캔버스 드래그 ──
  function _attachCanvasDrag(helpers) {
    const cv = document.getElementById('peCanvas');
    if (!cv || cv._baDragBound) return;
    cv._baDragBound = true;

    const getPos = (e, rect) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      if (_baState.mode === 'vertical') {
        return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      }
      return Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    };

    const onStart = (e) => {
      if (!_baState.enabled || !_baState.secondImg) return;
      // ba 탭일 때만 드래그 활성화
      const editorState = window.PhotoEditor?._internal?.getState?.();
      if (!editorState || editorState.activeTab !== 'ba') return;
      _dragging = true;
      const rect = cv.getBoundingClientRect();
      _baState.position = getPos(e, rect);
      helpers.redraw();
    };
    const onMove = (e) => {
      if (!_dragging) return;
      e.preventDefault();
      const rect = cv.getBoundingClientRect();
      _baState.position = getPos(e, rect);
      helpers.redraw();
    };
    const onEnd = () => { _dragging = false; };

    cv.addEventListener('mousedown', onStart);
    cv.addEventListener('mousemove', onMove);
    cv.addEventListener('mouseup', onEnd);
    cv.addEventListener('mouseleave', onEnd);
    cv.addEventListener('touchstart', onStart, { passive: true });
    cv.addEventListener('touchmove', onMove, { passive: false });
    cv.addEventListener('touchend', onEnd);
  }

  // ── 슬라이드 애니메이션 ──
  function _animateSlider(redraw) {
    if (_baState.animating) return;
    _baState.animating = true;
    const start = _baState.position;
    const dur = 1200;
    const t0 = performance.now();

    function frame(now) {
      const elapsed = now - t0;
      const t = Math.min(1, elapsed / dur);
      // ease-in-out: 0→1→0 (왕복)
      const phase = t < 0.5 ? t * 2 : (1 - t) * 2;
      _baState.position = start + (1 - start) * phase * (t < 0.5 ? 1 : -1);
      _baState.position = Math.max(0.02, Math.min(0.98, _baState.position));
      redraw();
      if (t < 1) requestAnimationFrame(frame);
      else { _baState.position = start; _baState.animating = false; redraw(); }
    }
    requestAnimationFrame(frame);
  }

  // BA 모드 활성화 시 _redraw 를 오버라이드하는 대신, template drawHook 패턴 활용
  function _drawBAComposite(cv, img, state, helpers) {
    if (!_baState.enabled || !_baState.secondImg || !img) return;
    const size = _baSize(img);
    const W = size.W, H = size.H;
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(_baState.secondImg, 0, 0, W, H);
    _drawAfterClip(ctx, img, state, helpers, W, H);
    _drawDivider(ctx, W, H, _baState.position, _baState.mode === 'vertical');
    if (_baState.labelVisible) _drawLabel(ctx, W, H, _baState.position, _baState.mode === 'vertical');
    if (state.watermark && state.watermark.value && helpers && typeof helpers.drawWatermark === 'function') {
      helpers.drawWatermark(ctx, W, H, state.watermark);
    }
  }

  function _baSize(img) {
    const W = Math.min(1080, img.naturalWidth || img.width);
    const ratio = W / (img.naturalWidth || img.width);
    return { W, H: Math.round((img.naturalHeight || img.height) * ratio) };
  }

  function _drawAfterClip(ctx, img, state, helpers, W, H) {
    const pos = _baState.position, isV = _baState.mode === 'vertical';
    ctx.save();
    ctx.beginPath();
    if (isV) ctx.rect(Math.round(W * pos), 0, W, H);
    else ctx.rect(0, Math.round(H * pos), W, H);
    ctx.clip();
    const a = state.adjust || {}, temp = a.temperature || 0;
    const sepia = Math.max(0, temp) / 100, contrast = 100 + Math.max(0, -temp) * 0.3;
    ctx.filter = `brightness(${a.brightness || 100}%) saturate(${a.saturate || 100}%) contrast(${contrast}%) sepia(${sepia})`;
    ctx.drawImage(img, 0, 0, W, H);
    ctx.filter = 'none';
    if (helpers && typeof helpers.applyDrawHook === 'function') {
      try { helpers.applyDrawHook('beauty', ctx, W, H, state.beauty, helpers); } catch (_e) { void _e; }
    }
    ctx.restore();
  }

  function _drawDivider(ctx, W, H, pos, isV) {
    if (_baState.dividerStyle === 'none') return;
    ctx.save();
    if (isV) _drawVerticalDivider(ctx, W, H, pos);
    else _drawHorizontalDivider(ctx, W, H, pos);
    ctx.restore();
  }

  function _drawVerticalDivider(ctx, W, H, pos) {
    const x = Math.round(W * pos);
    if (_baState.dividerStyle === 'gradient') {
      _drawDividerGradient(ctx, x - 12, 0, x + 12, 0, x - 12, 0, 24, H);
    } else {
      _strokeDivider(ctx, x, 0, x, H);
    }
    _drawHandle(ctx, x, H / 2, true);
  }

  function _drawHorizontalDivider(ctx, W, H, pos) {
    const y = Math.round(H * pos);
    if (_baState.dividerStyle === 'gradient') {
      _drawDividerGradient(ctx, 0, y - 12, 0, y + 12, 0, y - 12, W, 24);
    } else {
      _strokeDivider(ctx, 0, y, W, y);
    }
    _drawHandle(ctx, W / 2, y, false);
  }

  function _drawDividerGradient(ctx, x0, y0, x1, y1, rx, ry, rw, rh) {
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(rx, ry, rw, rh);
  }

  function _strokeDivider(ctx, x0, y0, x1, y1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  function _drawHandle(ctx, x, y, isVertical) {
    ctx.save();
    // 외부 원
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 8;
    ctx.fill();
    // 화살표
    ctx.fillStyle = '#333';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 0;
    ctx.fillText(isVertical ? '⇔' : '⇕', x, y);
    ctx.restore();
  }

  function _drawLabel(ctx, W, H, pos, isV) {
    ctx.save();
    const fs = Math.max(16, Math.round(W * 0.028));
    ctx.font = `800 ${fs}px Pretendard, "Noto Sans KR", sans-serif`;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;

    if (isV) {
      const splitX = Math.round(W * pos);
      // BEFORE (왼쪽)
      if (splitX > 60) {
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        _drawLabelPill(ctx, 20, 24, _baState.leftLabel, fs);
      }
      // AFTER (오른쪽)
      if (W - splitX > 60) {
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        _drawLabelPill(ctx, W - 20, 24, _baState.rightLabel, fs);
      }
    } else {
      const splitY = Math.round(H * pos);
      if (splitY > 40) {
        ctx.textAlign = 'left';
        _drawLabelPill(ctx, 20, 24, _baState.leftLabel, fs);
      }
      if (H - splitY > 40) {
        ctx.textAlign = 'left';
        _drawLabelPill(ctx, 20, H - 20, _baState.rightLabel, fs);
      }
    }
    ctx.restore();
  }

  function _drawLabelPill(ctx, x, y, text, fs) {
    const tw = ctx.measureText(text).width;
    const padX = Math.round(fs * 0.5);
    const padY = Math.round(fs * 0.3);
    const pillW = tw + padX * 2;
    const pillH = fs + padY * 2;
    const align = ctx.textAlign;
    const rx = align === 'right' ? x - pillW : x;

    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    _roundRect(ctx, rx, y - padY, pillW, pillH, 8);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'top';
    ctx.fillText(text, align === 'right' ? x - padX : x + padX, y);
  }

  function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ── Export ──
  function _exportBA(state, helpers) {
    const cv = document.getElementById('peCanvas');
    if (!cv) return helpers.toast('캔버스를 찾을 수 없어요');
    if (!_baState.secondImg) return helpers.toast('비교 사진을 먼저 골라주세요');

    cv.toBlob((blob) => {
      if (!blob) return helpers.toast('저장 실패');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'itdasy-ba-compare-' + Date.now() + '.png';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
      helpers.toast('Before/After 비교 이미지 저장 완료');

      // 인스타 미리보기 연동
      if (typeof window.openInstagramPreview === 'function') {
        try {
          const dataUrl = cv.toDataURL('image/png');
          setTimeout(() => {
            window.openInstagramPreview({ ratio: '4:5', src: dataUrl });
          }, 300);
        } catch (_e) { void _e; }
      }
    }, 'image/png', 0.95);
  }

  // ── 메인 모듈에 탭 동적 추가 + 등록 ──
  function _register() {
    if (!window.PhotoEditor || !window.PhotoEditor._internal) return false;
    const internal = window.PhotoEditor._internal;
    _ensureBaTab();
    internal.registerTabPanel('ba', { html: _panelHTML, bind: _bindPanel });
    _bindBaRedraw(internal);
    _wrapRedraw(internal);
    return true;
  }

  function _ensureBaTab() {
    const tabsNav = document.getElementById('peTabs');
    if (tabsNav && !tabsNav.querySelector('[data-pe-tab="ba"]')) {
      const templateTab = tabsNav.querySelector('[data-pe-tab="template"]');
      const baBtn = document.createElement('button');
      baBtn.type = 'button';
      baBtn.className = 'pe-tab';
      baBtn.dataset.peTab = 'ba';
      baBtn.textContent = 'B/A 비교';
      if (templateTab) tabsNav.insertBefore(baBtn, templateTab);
      else tabsNav.appendChild(baBtn);
    }
  }

  function _bindBaRedraw(internal) {
    if (internal._baRedrawBound) return;
    internal._baRedrawBound = true;
    window.addEventListener('itdasy:pe:redraw', () => {
      _drawIfActive(internal);
    });
    let _lastTab = null;
    setInterval(() => {
      try {
        const state = internal.getState();
        if (!state) return;
        if (state.activeTab === 'ba' && _baState.enabled && _baState.secondImg) {
          if (_lastTab !== 'ba') _drawIfActive(internal);
          _lastTab = 'ba';
        } else {
          _lastTab = state.activeTab;
        }
      } catch (_e) { void _e; }
    }, 100);
  }

  function _drawIfActive(internal) {
    const state = internal.getState();
    if (!state || state.activeTab !== 'ba' || !_baState.enabled || !_baState.secondImg) return;
    const cv = document.getElementById('peCanvas');
    if (cv && state.originalImg) _drawBAComposite(cv, state.originalImg, state, internal.helpers);
  }

  function _wrapRedraw(internal) {
    if (internal.helpers._baRedrawWrapped) return;
    const origRedraw = internal.helpers.redraw;
    internal.helpers._baRedrawWrapped = true;

    internal.helpers.redraw = function () {
      origRedraw();
      try { _drawIfActive(internal); } catch (_e) { void _e; }
    };
  }

  // 폴링 등록
  if (!_register()) {
    let tries = 0;
    const iv = setInterval(() => {
      if (_register() || ++tries > 50) clearInterval(iv);
    }, 100);
  }

  // 공개 API
  window.PhotoEditorBA = {
    getState: () => _baState,
    setSecondImage: (img) => {
      _baState.secondImg = img;
      _baState.enabled = true;
      const helpers = window.PhotoEditor && window.PhotoEditor._internal && window.PhotoEditor._internal.helpers;
      if (helpers && typeof helpers.renderPanel === 'function') helpers.renderPanel();
      if (helpers && typeof helpers.redraw === 'function') helpers.redraw();
    },
    setPosition: (p) => { _baState.position = Math.max(0, Math.min(1, p)); },
  };
})();
