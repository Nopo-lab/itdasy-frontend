/* 사진 편집기 — AI 메이크업 추천 버튼
   기존 뷰티 슬라이더 위에 1탭 레시피만 추가한다. */
(function () {
  'use strict';
  if (window.PhotoEditorBeautyAI) return;

  const RECIPES = {
    natural: {
      label: '내추럴',
      patch: { skin: 18, redness: 16, textureSmooth: 12, lipPop: 8, browSharp: 8 },
    },
    glam: {
      label: '글램',
      patch: { skin: 20, redness: 12, lipPop: 28, eyeColor: 22, browSharp: 24, catchLight: 16 },
    },
    lash_focus: {
      label: '속눈썹',
      patch: { lashSharp: 32, irisClear: 18, catchLight: 20, underEyeClean: 16, eyeRedness: 18 },
    },
    lip_focus: {
      label: '입술',
      patch: { lipPop: 34, skin: 14, redness: 10, yellowness: 10, textureSmooth: 8 },
    },
    brow_focus: {
      label: '눈썹',
      patch: { browSharp: 34, eyeColor: 12, skin: 12, redness: 10, closeUpDetail: 10 },
    },
  };

  function _shopType() {
    try { return String(localStorage.getItem('shop_type') || '').toLowerCase(); }
    catch (_e) { return ''; }
  }

  function recommend() {
    const t = _shopType();
    if (/(속눈썹|lash)/.test(t)) return 'lash_focus';
    if (/(눈썹|brow)/.test(t)) return 'brow_focus';
    if (/(메이크업|makeup)/.test(t)) return 'glam';
    if (/(피부|skin)/.test(t)) return 'natural';
    return 'natural';
  }

  function _api() {
    return window.PhotoEditor && window.PhotoEditor._internal;
  }

  function _applyInputs(panel, patch) {
    Object.keys(patch).forEach(key => {
      const input = panel.querySelector(`[data-pe-slider="${key}"]`);
      const out = panel.querySelector(`[data-pe-slider-val="${key}"]`);
      if (input) input.value = patch[key];
      if (out) out.textContent = patch[key];
    });
  }

  function apply(recipeId) {
    const api = _api();
    const state = api && api.getState && api.getState();
    const recipe = RECIPES[recipeId] || RECIPES[recommend()];
    if (!state || !recipe) return false;
    state.beauty = Object.assign({}, state.beauty || {}, recipe.patch);
    const panel = document.getElementById('pePanel');
    if (panel) _applyInputs(panel, recipe.patch);
    api.helpers && api.helpers.scheduleRedraw && api.helpers.scheduleRedraw();
    api.helpers && api.helpers.pushHistory && api.helpers.pushHistory();
    if (api.helpers && api.helpers.toast) api.helpers.toast('AI 추천: ' + recipe.label);
    return true;
  }

  function _chip(id, recipe, on) {
    return `<button type="button" data-beauty-ai="${id}" class="pe-chip-btn${on ? ' on' : ''}" style="white-space:nowrap;">${recipe.label}</button>`;
  }

  function _inject(panel) {
    if (!panel || panel.querySelector('[data-beauty-ai-wrap]')) return;
    const selected = recommend();
    const html = Object.keys(RECIPES).map(id => _chip(id, RECIPES[id], id === selected)).join('');
    const box = document.createElement('div');
    box.dataset.beautyAiWrap = '1';
    box.innerHTML = `<div class="pe-group-label" style="color:#7C3AED;font-weight:800;">AI 추천 메이크업</div>
      <div style="display:flex;gap:6px;overflow-x:auto;margin:6px 0 10px;">${html}</div>`;
    panel.insertBefore(box, panel.firstChild);
    box.addEventListener('click', e => {
      const id = e.target.closest('[data-beauty-ai]')?.dataset.beautyAi;
      if (id) apply(id);
    });
  }

  function _watch() {
    const panel = document.getElementById('pePanel');
    const api = _api();
    const state = api && api.getState && api.getState();
    if (panel && state && state.activeTab === 'beauty') _inject(panel);
  }

  const observer = new MutationObserver(_watch);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.PhotoEditorBeautyAI = { RECIPES, recommend, apply };
})();
