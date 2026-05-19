/* 사진 편집기 — 살롱 빠른 보정 메뉴 (v234)
   Meitu/Xingtu/BeautyPlus 계열에서 원장님 워크플로우에 맞는 것만 로컬 보정으로 큐레이션. */
(function () {
  'use strict';
  if (window.PhotoEditorStudioPresets) return;

  const RECIPES = [
    { id: 'salon-clean', label: '자연광 살롱', desc: '어두운 매장 사진을 맑게', tag: '기본', adjust: { brightness: 106, saturate: 108, sharpness: 18, temperature: 4 }, beauty: { skin: 18, redness: 24, yellowness: 12 }, film: { presetId: 'salon-soft', strength: 48 } },
    { id: 'nail-color', label: '네일 컬러업', desc: '젤 컬러와 광택만 선명하게', tag: '네일', adjust: { brightness: 108, saturate: 122, sharpness: 26, temperature: -2 }, beauty: { handSkin: 34, nailGloss: 62, nailShape: 28, redness: 18 }, film: { presetId: 'nail-glow', strength: 66 } },
    { id: 'hair-shine', label: '헤어 윤기', desc: '모발 결·염색 컬러 살리기', tag: '헤어', adjust: { brightness: 104, saturate: 110, sharpness: 30, temperature: 4 }, beauty: { hairShine: 54, hairDetail: 36, hairColorPop: 34, redness: 18 }, film: { presetId: 'hair-shine', strength: 54 } },
    { id: 'lash-crisp', label: '속눈썹 또렷', desc: '눈매는 또렷, 피부는 자연', tag: '속눈썹', adjust: { brightness: 104, saturate: 108, sharpness: 40, temperature: 0 }, beauty: { lashSharp: 68, closeUpDetail: 36, eyeShadow: 26, redness: 24 }, film: { presetId: 'lash-crisp', strength: 42 } },
    { id: 'skin-even', label: '피부톤 정돈', desc: '붉은기·노란기만 정리', tag: '피부', adjust: { brightness: 106, saturate: 104, sharpness: 12, temperature: 3 }, beauty: { skin: 42, redness: 48, blemish: 30, yellowness: 18 }, film: { presetId: 'warm-skin', strength: 38 } },
    { id: 'social-pop', label: 'SNS 선명컷', desc: '피드에서 멈춰 보이는 대비', tag: '홍보', adjust: { brightness: 107, saturate: 116, sharpness: 28, temperature: 2 }, beauty: { closeUpDetail: 24, redness: 18 }, film: { presetId: 'studio-light', strength: 52 } },
  ];
  const SHOP = { hair: '헤어', scalp: '두피', makeup: '메이크업', lash: '속눈썹', nail: '네일', wax: '왁싱' };
  const MOODS = {
    all: { brightness: 105, saturate: 110, sharpness: 24, temperature: 5 },
    bright: { brightness: 115 }, vivid: { saturate: 120, sharpness: 34 },
    warm: { temperature: 18 }, cool: { temperature: -18 },
  };

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  }

  function _html(state) {
    const cur = state.autoIntensity || 'standard';
    const a = state.adjust || {};
    const recipeCards = RECIPES.map(r => `<button type="button" class="pe-studio-card" data-studio-recipe="${r.id}">
      <span class="pe-studio-tag">${_esc(r.tag)}</span><strong>${_esc(r.label)}</strong><small>${_esc(r.desc)}</small>
    </button>`).join('');
    return `<div class="pe-studio-hero"><span>Salon Quick Edit</span><strong>사진 던지면 홍보용 톤까지</strong></div>
      <div class="pe-studio-grid">${recipeCards}</div>
      <div class="pe-studio-section"><div class="pe-field-label">강도</div><div class="pe-segment">
        ${_seg('natural', '자연', cur)}${_seg('standard', '표준', cur)}${_seg('strong', '강조', cur)}
      </div></div>
      <div class="pe-studio-section"><div class="pe-field-label">업종 자동</div><div class="pe-panel-grid-3">
        ${Object.keys(SHOP).map(k => `<button type="button" class="pe-chip-btn" data-studio-shop="${k}">${_esc(SHOP[k])}</button>`).join('')}
      </div></div>
      <div class="pe-studio-section"><div class="pe-field-label">빠른 조정</div><div class="pe-panel-grid-4">
        ${_chip('all', '원터치')}${_chip('bright', '밝게')}${_chip('vivid', '선명')}${_chip('warm', '따뜻')}${_chip('cool', '차갑게')}
      </div></div>
      ${_slider('밝기', 'brightness', a.brightness, 50, 150)}
      ${_slider('채도', 'saturate', a.saturate, 50, 150)}
      ${_slider('선명도', 'sharpness', a.sharpness, 0, 70)}
      ${_slider('색온도', 'temperature', a.temperature, -50, 50)}
      <div class="pe-panel-row"><button type="button" class="pe-chip-btn" data-studio-reset>보정 초기화</button></div>`;
  }

  function _seg(id, label, cur) {
    return `<button type="button" class="${cur === id ? 'on' : ''}" data-studio-intensity="${id}">${label}</button>`;
  }

  function _chip(id, label) {
    return `<button type="button" class="pe-chip-btn" data-studio-mood="${id}">${label}</button>`;
  }

  function _slider(label, key, val, min, max) {
    const v = val == null ? (key === 'temperature' || key === 'sharpness' ? 0 : 100) : val;
    return `<label class="pe-slider"><div class="pe-slider-head"><span>${label}</span><span class="pe-slider-val" data-studio-val="${key}">${v}</span></div><input type="range" min="${min}" max="${max}" step="1" value="${v}" data-studio-slider="${key}" /></label>`;
  }

  function _bind(panel, state, helpers) {
    panel.querySelectorAll('[data-studio-recipe]').forEach(btn => btn.addEventListener('click', () => _applyRecipe(btn.dataset.studioRecipe, state, helpers)));
    panel.querySelectorAll('[data-studio-shop]').forEach(btn => btn.addEventListener('click', () => _applyShop(btn.dataset.studioShop, state, helpers)));
    panel.querySelectorAll('[data-studio-mood]').forEach(btn => btn.addEventListener('click', () => _applyMood(btn.dataset.studioMood, state, helpers)));
    panel.querySelectorAll('[data-studio-intensity]').forEach(btn => btn.addEventListener('click', () => { state.autoIntensity = btn.dataset.studioIntensity; helpers.renderPanel(); }));
    panel.querySelectorAll('[data-studio-slider]').forEach(inp => _bindSlider(inp, panel, state, helpers));
    panel.querySelector('[data-studio-reset]')?.addEventListener('click', () => _reset(state, helpers));
  }

  function _bindSlider(inp, panel, state, helpers) {
    inp.addEventListener('input', () => {
      state.adjust[inp.dataset.studioSlider] = +inp.value;
      const out = panel.querySelector(`[data-studio-val="${inp.dataset.studioSlider}"]`);
      if (out) out.textContent = inp.value;
      helpers.scheduleRedraw();
    });
    inp.addEventListener('change', () => helpers.pushHistory && helpers.pushHistory());
  }

  function _applyRecipe(id, state, helpers) {
    const r = RECIPES.find(x => x.id === id);
    if (!r) return;
    state.adjust = Object.assign({ brightness: 100, saturate: 100, sharpness: 0, temperature: 0 }, r.adjust);
    state.beauty = Object.assign({}, state.beauty || {}, r.beauty);
    state.film = Object.assign({ presetId: null, strength: 0 }, r.film);
    _done(helpers, r.label + ' 적용');
  }

  function _applyShop(key, state, helpers) {
    const PE = window.PhotoEnhance;
    const preset = PE && PE.getShopPreset && PE.getShopPreset(SHOP[key], state.autoIntensity || 'standard');
    if (!preset) return _toast(helpers, '업종 보정을 불러오지 못했어요');
    state.adjust = Object.assign({}, state.adjust || {}, preset.adjust);
    state.beauty = Object.assign({}, state.beauty || {}, preset.beauty);
    _done(helpers, preset.label + ' 자동 적용');
  }

  function _applyMood(id, state, helpers) {
    const patch = MOODS[id];
    if (!patch) return;
    state.adjust = id === 'all' ? Object.assign({}, patch) : Object.assign({}, state.adjust || {}, patch);
    _done(helpers, '빠른 조정 적용');
  }

  function _reset(state, helpers) {
    state.adjust = { brightness: 100, saturate: 100, sharpness: 0, temperature: 0 };
    const zeroBeauty = {};
    Object.keys(state.beauty || {}).forEach(k => { zeroBeauty[k] = 0; });
    state.beauty = zeroBeauty;
    state.film = { presetId: null, strength: 0 };
    _done(helpers, '초기화 완료');
  }

  function _done(helpers, msg) {
    helpers.redraw();
    helpers.pushHistory && helpers.pushHistory();
    helpers.renderPanel();
    _toast(helpers, msg);
  }

  function _toast(helpers, msg) {
    if (helpers && helpers.toast) helpers.toast(msg);
    else if (window.showToast) window.showToast(msg);
  }

  function _register() {
    const PE = window.PhotoEditor;
    if (!PE || !PE._internal || !PE._internal.registerTabPanel) return false;
    PE._internal.registerTabPanel('auto', { html: _html, bind: _bind });
    return true;
  }

  function _tryRegister() {
    if (_register()) return;
    let tries = 0;
    const iv = setInterval(() => { if (_register() || ++tries > 60) clearInterval(iv); }, 100);
  }

  window.PhotoEditorStudioPresets = { RECIPES, register: _register };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _tryRegister);
  else _tryRegister();
})();
