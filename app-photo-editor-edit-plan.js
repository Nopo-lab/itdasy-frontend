/* 사진 편집기 — EditPlan 실행기 */
(function () {
  'use strict';
  if (window.PhotoEditorEditPlan) return;

  function execute(plan, state, helpers) {
    if (!plan || !state || !Array.isArray(plan.steps)) return false;
    plan.steps.forEach(step => {
      _runStep(step, state, helpers || {});
      if (helpers && helpers.pushHistory) helpers.pushHistory();
    });
    if (helpers && helpers.renderPanel) helpers.renderPanel();
    if (helpers && helpers.scheduleRedraw) helpers.scheduleRedraw();
    if (helpers && helpers.toast) helpers.toast(plan.explanation_ko || '사진 편집 완료');
    return true;
  }

  function _runStep(step, state, helpers) {
    const p = step.params || {};
    if (step.action === 'apply_preset') return _preset(p.preset, state, helpers);
    if (step.action === 'set_adjust') return _assign(state.adjust, p, state, 'adjust');
    if (step.action === 'set_beauty') return _assign(state.beauty, p, state, 'beauty');
    if (step.action === 'set_relight') return _assign(state.relight, p, state, 'relight');
    if (step.action === 'apply_bgblur') return _bgBlur(state, p);
    if (step.action === 'apply_template') return _template(state, p);
    if (step.action === 'add_text') return _text(state, p, helpers);
    if (step.action === 'set_watermark') return _assign(state.watermark, p, state, 'watermark');
    if (step.action === 'set_ratio') return _ratio(state, p);
    if (step.action === 'apply_film') return _film(state, p);
    if (step.action === 'apply_nukki') return _nukki(state, p, helpers);
    if (step.action === 'export') return helpers.exportImage && helpers.exportImage(p.format || 'png');
    if (step.action === 'undo') return _undo(helpers);
    return false;
  }

  function _preset(id, state, helpers) {
    if (window.PhotoEditorPresetCards?.applyToState?.(id, state, null)) {
      if (helpers.toast) helpers.toast('프리셋 적용');
      return true;
    }
    return false;
  }

  function _assign(target, patch, state, key) {
    if (!target || !patch) return false;
    Object.assign(target, patch);
    state._lastModifiedKeys = [key];
    return true;
  }

  function _bgBlur(state, p) {
    state.bgBlur = Object.assign({}, state.bgBlur || {}, { strength: _num(p.strength, 45) });
    state._lastModifiedKeys = ['bgBlur'];
    return true;
  }

  function _template(state, p) {
    const data = window.PhotoEditorShopData?.fillTemplate?.({}, p) || p;
    state.ratio = p.ratio || state.ratio || '4:5';
    state.tplV2 = Object.assign({}, state.tplV2 || {}, {
      id: p.template || 'ba-cream',
      label: p.label || '전후사진',
      cat: 'ba',
      bg: data.primaryColor || data.bg || '#D58A95',
      shopName: data.shopName,
      price: p.price || state.price || '',
      review: p.review || '',
    });
    state._lastModifiedKeys = ['tplV2', 'ratio'];
    return true;
  }

  function _text(state, p, helpers) {
    if (helpers.ensureLayers) helpers.ensureLayers();
    state.text.value = p.value || '';
    state.text.size = p.size || state.text.size || 6;
    state.text.y = p.y || state.text.y || 0.86;
    if (helpers.syncTextToLayer) helpers.syncTextToLayer();
    state._lastModifiedKeys = ['text'];
    return true;
  }

  function _ratio(state, p) {
    state.ratio = p.ratio || '4:5';
    state._lastModifiedKeys = ['ratio'];
    return true;
  }

  function _film(state, p) {
    state.film = Object.assign({}, state.film || {}, p);
    state._lastModifiedKeys = ['film'];
    return true;
  }

  function _nukki(state, p, helpers) {
    var compose = window.PhotoEditorBgCompose;
    if (!compose || !compose.compose) {
      var bgTab = document.querySelector('#peTabs [data-pe-tab="bg"]');
      if (bgTab) bgTab.click();
      if (helpers.toast) helpers.toast('배경 탭에서 배경을 선택해 주세요.');
      return true;
    }
    var bgType = p.bgType || 'pink_radial';
    var ratio = state.ratio || '4:5';
    var srcUrl = state.originalImg ? state.originalImg.src : null;
    if (!srcUrl) { if (helpers.toast) helpers.toast('사진을 먼저 골라 주세요.'); return false; }
    if (helpers.toast) helpers.toast('배경 제거 중...');
    compose.compose({
      srcUrl: srcUrl,
      targetRatio: ratio,
      bg: { type: 'procedural', render: bgType },
      shadow: 'soft',
    }).then(function (result) {
      if (result && result.composedDataUrl && state) {
        var img = new Image();
        img.onload = function () {
          state.originalImg = img;
          state.removedBgDataUrl = result.removedBgDataUrl;
          if (helpers.scheduleRedraw) helpers.scheduleRedraw();
          if (helpers.pushHistory) helpers.pushHistory();
          if (helpers.toast) helpers.toast('누끼 + 배경 적용 완료');
        };
        img.src = result.composedDataUrl;
      }
    }).catch(function (err) {
      console.warn('[edit-plan] 누끼 실패:', err);
      var bgTab = document.querySelector('#peTabs [data-pe-tab="bg"]');
      if (bgTab) bgTab.click();
      if (helpers.toast) helpers.toast('자동 배경 제거에 실패했어요. 배경 탭에서 직접 시도해 주세요.');
    });
    return true;
  }

  function _undo(helpers) {
    const btn = document.querySelector('#photoEditorSheet [data-pe-act="undo"]');
    if (btn) btn.click();
    else if (helpers.toast) helpers.toast('되돌릴 작업이 없어요');
    return true;
  }

  function _num(v, fallback) {
    return Number.isFinite(+v) ? +v : fallback;
  }

  window.PhotoEditorEditPlan = { execute };
})();
