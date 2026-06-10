/* 사진 편집기 — L3 생성형 홍보컷 mock UX
   미리보기 전용. [적용] 클릭 전 편집 이미지를 바꾸지 않는다. */
(function () {
  'use strict';
  if (window.PhotoEditorGenerativeL3) return;

  var uiByState = new WeakMap();
  var MODES = [
    { id: 'nail_ad_background', label: '네일 홍보컷', desc: '손과 네일은 유지하고 고급 홍보컷 분위기' },
    { id: 'clean_background', label: '배경 정리', desc: '피사체는 그대로 두고 지저분한 배경만 정돈' },
    { id: 'template_outpaint', label: '템플릿에 맞게 확장', desc: '피드와 스토리에 맞는 여백 mock 확장' },
  ];

  function _esc(s) { return window._esc(s); } /* [2026-06-11] 중복 제거 — app-core 정본 위임 */

  function _ui(state) {
    var u = uiByState.get(state);
    if (!u) {
      u = { mode: 'nail_ad_background', status: 'idle', result: null, previewSrc: '', error: '' };
      uiByState.set(state, u);
    }
    return u;
  }

  function _html(state) {
    var hasImg = !!(state && state.originalImg);
    var u = _ui(state || {});
    return '<div class="pe-l3-panel">' +
      '<div class="pe-l3-head"><div><div class="pe-field-label">홍보컷 만들기</div>' +
      '<div class="pe-l3-sub">배경, 무드, 여백만 mock으로 미리 봐요.</div></div>' +
      '<span class="pe-l3-badge">Pro 크레딧 1장 예정</span></div>' +
      (!hasImg ? _emptyHtml() : _modeHtml(u) + _statusHtml(u, state)) +
      '</div>';
  }

  function _emptyHtml() {
    return '<div class="pe-l3-empty">사진을 먼저 선택하면 생성형 홍보컷 미리보기를 만들 수 있어요.</div>';
  }

  function _modeHtml(u) {
    return '<div class="pe-l3-mode-grid">' + MODES.map(function (m) {
      var on = u.mode === m.id ? ' on' : '';
      return '<button type="button" class="pe-l3-mode' + on + '" data-l3-mode="' + m.id + '">' +
        '<span>' + _esc(m.label) + '</span><small>' + _esc(m.desc) + '</small></button>';
    }).join('') + '</div>' +
    '<div class="pe-l3-cost">생성 전 비용 안내: mock 단계라 실제 차감은 없고, 서버 응답은 not_charged_mock이에요.</div>' +
    '<button type="button" class="pe-action-btn pe-l3-create" data-l3-create ' +
      (u.status === 'loading' ? 'disabled' : '') + '>홍보컷 미리보기 만들기</button>';
  }

  function _statusHtml(u, state) {
    if (u.status === 'loading') return '<div class="pe-l3-loading">생성 중...</div>';
    if (u.status === 'error') return '<div class="pe-l3-error">' + _esc(u.error || '생성에 실패했어요. 원본은 그대로예요.') + '</div>';
    if (u.status !== 'ready' || !u.previewSrc) return '';
    return '<div class="pe-l3-preview" data-l3-preview>' +
      '<div class="pe-l3-compare"><figure><img src="' + _esc(state.originalSrc || '') + '" alt="원본"><figcaption>원본</figcaption></figure>' +
      '<figure><img src="' + _esc(u.previewSrc) + '" alt="생성 미리보기"><figcaption>생성 미리보기</figcaption></figure></div>' +
      '<div class="pe-l3-result-meta">' + _esc((u.result && u.result.provider_used) || 'mock') + ' · ' +
        _esc((u.result && u.result.charge_status) || 'not_charged_mock') + ' · 크레딧 ' +
        _esc((u.result && u.result.credit_cost) || 1) + '</div>' +
      '<div class="pe-l3-actions"><button type="button" class="pe-btn-primary" data-l3-apply>적용</button>' +
      '<button type="button" class="pe-chip-btn" data-l3-remake>다시 만들기</button>' +
      '<button type="button" class="pe-chip-btn" data-l3-discard>버리기</button></div></div>';
  }

  function _bind(panel, state, helpers) {
    panel.querySelectorAll('[data-l3-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _ui(state).mode = btn.dataset.l3Mode;
        helpers.renderPanel();
      });
    });
    _on(panel, '[data-l3-create]', function () { _start(state, helpers, false); });
    _on(panel, '[data-l3-remake]', function () { _start(state, helpers, true); });
    _on(panel, '[data-l3-discard]', function () {
      var u = _ui(state); u.status = 'idle'; u.result = null; u.previewSrc = ''; u.error = '';
      helpers.renderPanel();
    });
    _on(panel, '[data-l3-apply]', function () { _apply(state, helpers); });
  }

  function _on(panel, selector, fn) {
    var el = panel.querySelector(selector);
    if (el) el.addEventListener('click', fn);
  }

  function _start(state, helpers) {
    if (!state || !state.originalImg) {
      helpers.toast('먼저 사진을 선택해주세요');
      return;
    }
    var consent = window.PhotoEditorGenerativeConsent;
    if (!consent || !consent.uiCached()) {
      if (!consent) return helpers.toast('동의 모듈을 불러오는 중이에요');
      consent.showModal(function () { _create(state, helpers); }, function () {
        helpers.toast('동의가 필요해요. 원본은 그대로예요.');
      });
      return;
    }
    _create(state, helpers);
  }

  function _create(state, helpers) {
    var client = window.PhotoEditorGenerativeClient;
    var u = _ui(state);
    if (!client) return helpers.toast('생성형 모듈을 불러오는 중이에요');
    u.status = 'loading'; u.error = ''; helpers.renderPanel();
    client.create(state, { mode: u.mode, shop_type: _shopType(), target_ratio: state.ratio }).then(function (r) {
      if (!r.ok) return _handleError(r, state, helpers);
      _buildPreview(state, u.mode).then(function (src) {
        u.status = 'ready'; u.result = r.data; u.previewSrc = src || state.originalSrc; u.error = '';
        helpers.renderPanel();
      });
    });
  }

  function _handleError(r, state, helpers) {
    var u = _ui(state);
    u.status = 'error';
    u.result = null;
    u.previewSrc = '';
    u.error = '생성에 실패했어요. 원본은 그대로예요.';
    helpers.renderPanel();
    helpers.toast(u.error);
    if (r && r.code === 'consent_required' && window.PhotoEditorGenerativeConsent) {
      window.PhotoEditorGenerativeConsent.clearCache();
      window.PhotoEditorGenerativeConsent.showModal(function () { _create(state, helpers); }, null);
    }
  }

  function _apply(state, helpers) {
    var u = _ui(state);
    if (u.status !== 'ready' || !u.previewSrc) return helpers.toast('적용할 미리보기가 없어요');
    helpers.replaceImage(u.previewSrc, '생성형 미리보기를 적용했어요');
    u.status = 'applied';
    helpers.renderPanel();
  }

  function _shopType() {
    try { return localStorage.getItem('shop_type') || ''; }
    catch (_e) { return ''; }
  }

  function _buildPreview(state, mode) {
    return new Promise(function (resolve) {
      try {
        var img = state.originalImg;
        var w = 1080, h = mode === 'template_outpaint' ? 1350 : 1080;
        var cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        var ctx = cv.getContext('2d');
        _drawBackdrop(ctx, w, h, mode);
        _drawSubject(ctx, img, w, h, mode);
        resolve(cv.toDataURL('image/jpeg', 0.9));
      } catch (_e) { resolve(state.originalSrc || ''); }
    });
  }

  function _drawBackdrop(ctx, w, h, mode) {
    var g = ctx.createLinearGradient(0, 0, w, h);
    if (mode === 'nail_ad_background') { g.addColorStop(0, '#f7f1ec'); g.addColorStop(1, '#d9eef0'); }
    else if (mode === 'template_outpaint') { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e8edf5'); }
    else { g.addColorStop(0, '#f8f8f6'); g.addColorStop(1, '#dfe6df'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }

  function _drawSubject(ctx, img, w, h, mode) {
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    var pad = mode === 'template_outpaint' ? 92 : 46;
    var boxW = w - pad * 2, boxH = h - pad * 2;
    var s = Math.min(boxW / iw, boxH / ih);
    var dw = iw * s, dh = ih * s;
    var dx = (w - dw) / 2, dy = (h - dh) / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(20,20,20,0.18)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 12;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  function _register() {
    var PE = window.PhotoEditor;
    if (!PE || !PE._internal) return false;
    PE._internal.registerTabPanel('ai', { html: _html, bind: _bind });
    return true;
  }

  if (!_register()) {
    var t = 0;
    var iv = setInterval(function () { if (_register() || ++t > 50) clearInterval(iv); }, 100);
  }

  window.PhotoEditorGenerativeL3 = { modes: MODES, html: _html, bind: _bind };
})();

