/* 사진 편집기 — 살롱 추천 프리셋 카드 */
(function () {
  'use strict';
  if (window.PhotoEditorPresetCards) return;

  const RECENT_KEY = 'itdasy_pe_recent_presets';
  const CATEGORIES = [
    { id: 'recommend', label: '추천', tab: 'auto' },
    { id: 'adjust', label: '보정', tab: 'tune' },
    { id: 'retouch', label: '리터치', tab: 'beauty' },
    { id: 'hair', label: '헤어', tab: 'beauty' },
    { id: 'bg', label: '배경', tab: 'bg' },
    { id: 'promo', label: '홍보', tab: 'template' },
  ];
  const PRESETS = [
    { id: 'salon-clean', label: '깨끗한 피부', category: 'recommend', tone: '#F8D9DD', adjust: { brightness: 108, saturate: 106, sharpness: 12, temperature: 3 }, beauty: { skin: 18, redness: 24, blemish: 18, textureSmooth: 12 } },
    { id: 'shop-bright', label: '화사한 매장', category: 'adjust', tone: '#FFE3B3', adjust: { brightness: 116, saturate: 112, sharpness: 10, temperature: 8 }, relight: { ambientBoost: 18, warmth: 10, intensity: 8 } },
    { id: 'hair-gloss', label: '헤어 윤기', category: 'hair', tone: '#B98265', adjust: { brightness: 104, saturate: 108, sharpness: 18, temperature: 8 }, beauty: { hairShine: 52, hairVolume: 28, hairDetail: 22 } },
    { id: 'nail-crisp', label: '네일 선명', category: 'retouch', tone: '#D58A95', adjust: { brightness: 106, saturate: 118, sharpness: 28, temperature: 2 }, beauty: { nailGloss: 58, nailShape: 42, handSkin: 18 } },
    { id: 'lash-clear', label: '속눈썹 또렷', category: 'retouch', tone: '#24252B', adjust: { brightness: 104, saturate: 104, sharpness: 22, temperature: 0 }, beauty: { lashSharp: 52, irisClear: 34, catchLight: 22 } },
    { id: 'natural-before', label: '자연 Before', category: 'recommend', tone: '#E5EADF', adjust: { brightness: 102, saturate: 101, sharpness: 4, temperature: 0 }, beauty: { skin: 4, redness: 6 } },
    { id: 'promo-after', label: '홍보용 After', category: 'promo', tone: '#C69B63', adjust: { brightness: 112, saturate: 112, sharpness: 24, temperature: 5 }, beauty: { skin: 20, blemish: 18, hairShine: 18 } },
    { id: 'premium-warm', label: '프리미엄 톤', category: 'promo', tone: '#EFE6D9', adjust: { brightness: 106, saturate: 104, sharpness: 8, temperature: 14 }, film: { presetId: 'cream', strength: 42 } },
  ];

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  function entryHTML() {
    return `<div class="pe-preset-cats">${CATEGORIES.map(_catButton).join('')}</div>
      <div class="pe-preset-strip">${_sortedPresets().map(_presetButton).join('')}</div>`;
  }

  function _catButton(cat) {
    return `<button type="button" class="pe-preset-cat" data-pev6-category="${cat.id}" data-pev6-card="${cat.tab}">${_esc(cat.label)}</button>`;
  }

  function _presetButton(preset) {
    return `<button type="button" class="pe-preset-card" data-pe-preset="${preset.id}">
      <span class="pe-preset-thumb" style="background:${_esc(preset.tone)}"></span>
      <span class="pe-preset-name">${_esc(preset.label)}</span>
      <span class="pe-preset-cat-label">${_esc(_catLabel(preset.category))}</span>
    </button>`;
  }

  function _catLabel(id) {
    const cat = CATEGORIES.find(c => c.id === id);
    return cat ? cat.label : '추천';
  }

  function _sortedPresets() {
    const recent = _recent();
    return PRESETS.slice().sort((a, b) => recent.indexOf(b.id) - recent.indexOf(a.id));
  }

  function apply(id) {
    const PE = window.PhotoEditor;
    const state = PE && PE._internal && PE._internal.getState();
    const helpers = PE && PE._internal && PE._internal.helpers;
    return applyToState(id, state, helpers);
  }

  function applyToState(id, state, helpers) {
    const preset = PRESETS.find(p => p.id === id);
    if (!preset || !state) return false;
    _merge(state.adjust, preset.adjust);
    _merge(state.beauty, preset.beauty);
    _merge(state.relight, preset.relight);
    if (preset.film) state.film = Object.assign({}, state.film || {}, preset.film);
    state._lastModifiedKeys = _modifiedKeys(preset);
    _remember(id);
    if (helpers) _finish(helpers, preset.label + ' 적용');
    return true;
  }

  function _modifiedKeys(preset) {
    return Object.keys(preset).filter(k => ['adjust', 'beauty', 'relight', 'film'].includes(k));
  }

  function _merge(target, patch) {
    if (!patch) return;
    Object.assign(target, patch);
  }

  function _finish(helpers, msg) {
    if (helpers.renderPanel) helpers.renderPanel();
    if (helpers.scheduleRedraw) helpers.scheduleRedraw();
    if (helpers.pushHistory) helpers.pushHistory();
    if (helpers.toast) helpers.toast(msg);
  }

  function _recent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') || []; }
    catch (e) { console.warn('[photo-editor-presets] 최근 프리셋 읽기 실패:', e.message); return []; }
  }

  function _remember(id) {
    try {
      const next = [id].concat(_recent().filter(x => x !== id)).slice(0, 12);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch (e) { console.warn('[photo-editor-presets] 최근 프리셋 저장 실패:', e.message); }
  }

  window.PhotoEditorPresetCards = { CATEGORIES, PRESETS, entryHTML, apply, applyToState };
})();
