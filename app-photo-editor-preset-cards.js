/* 사진 편집기 — 살롱 추천 프리셋 카드 */
(function () {
  'use strict';
  if (window.PhotoEditorPresetCards) return;

  const RECENT_KEY = 'itdasy_pe_recent_presets';
  const CATEGORIES = [
    { id: 'recommend', label: 'Hot', tab: 'auto' },
    { id: 'beautycam', label: '뷰티캠', tab: 'beauty' },
    { id: 'ba', label: '전후 템플릿', tab: 'template' },
    { id: 'filter', label: '카메라 프로', tab: 'film' },
    { id: 'retouch', label: 'AI 사진', tab: 'beauty' },
    { id: 'promo', label: '홍보', tab: 'template' },
  ];
  const PRESETS = [
    { id: 'salon-clean', label: '깨끗한 피부', category: 'beautycam', tone: 'linear-gradient(145deg,#fff8f7,#f6cad0)', adjust: { brightness: 108, saturate: 106, sharpness: 12, temperature: 3 }, beauty: { skin: 18, redness: 24, blemish: 18, textureSmooth: 12 } },
    { id: 'shop-bright', label: '화사한 매장', category: 'filter', tone: 'linear-gradient(145deg,#fff2d9,#f0c088)', adjust: { brightness: 116, saturate: 112, sharpness: 10, temperature: 8 }, relight: { ambientBoost: 18, warmth: 10, intensity: 8 } },
    { id: 'hair-gloss', label: '헤어 윤기', category: 'beautycam', tone: 'linear-gradient(145deg,#f6dfce,#6c4737)', adjust: { brightness: 104, saturate: 108, sharpness: 18, temperature: 8 }, beauty: { hairShine: 52, hairVolume: 28, hairDetail: 22 } },
    { id: 'nail-crisp', label: '네일 선명', category: 'retouch', tone: 'linear-gradient(145deg,#ffe5ee,#d0738e)', adjust: { brightness: 106, saturate: 118, sharpness: 28, temperature: 2 }, beauty: { nailGloss: 58, nailShape: 42, handSkin: 18 } },
    { id: 'lash-clear', label: '속눈썹 또렷', category: 'retouch', tone: 'linear-gradient(145deg,#eef2f9,#20232b)', adjust: { brightness: 104, saturate: 104, sharpness: 22, temperature: 0 }, beauty: { lashSharp: 52, irisClear: 34, catchLight: 22 } },
    { id: 'natural-before', label: '자연 Before', category: 'recommend', tone: '#E5EADF', adjust: { brightness: 102, saturate: 101, sharpness: 4, temperature: 0 }, beauty: { skin: 4, redness: 6 } },
    { id: 'promo-after', label: '홍보용 After', category: 'promo', tone: 'linear-gradient(145deg,#fff8ea,#c69b63)', adjust: { brightness: 112, saturate: 112, sharpness: 24, temperature: 5 }, beauty: { skin: 20, blemish: 18, hairShine: 18 } },
    { id: 'premium-warm', label: '프리미엄 톤', category: 'filter', tone: 'linear-gradient(145deg,#f8f1e8,#d8c4a8)', adjust: { brightness: 106, saturate: 104, sharpness: 8, temperature: 14 }, film: { presetId: 'cream', strength: 42 } },
    { id: 'idol-soft', label: '아이돌 소프트', category: 'beautycam', tone: 'linear-gradient(145deg,#fff,#f3d7e8)', adjust: { brightness: 112, saturate: 104, sharpness: 10, temperature: -2 }, beauty: { skin: 26, redness: 26, lipPop: 16, catchLight: 14 } },
    { id: 'dslr-clear', label: 'DSLR 선명', category: 'filter', tone: 'linear-gradient(145deg,#e9eef4,#9ca8b8)', adjust: { brightness: 103, saturate: 108, sharpness: 34, temperature: 0 }, relight: { ambientBoost: 8, intensity: 8 } },
    { id: 'ccd-mood', label: 'CCD 무드', category: 'filter', tone: 'linear-gradient(145deg,#f8d9be,#65758c)', adjust: { brightness: 104, saturate: 116, sharpness: 8, temperature: 10 }, film: { presetId: 'cream', strength: 58 } },
    { id: 'ai-glow', label: 'AI 글로우', category: 'retouch', tone: 'linear-gradient(145deg,#fff6cf,#eec0cc)', adjust: { brightness: 111, saturate: 106, sharpness: 8, temperature: 4 }, beauty: { skin: 22, blemish: 20, textureSmooth: 18, catchLight: 20 } },
  ];
  const TEMPLATE_CARDS = [
    { id: 'ba-cream', label: '크림 전후', sub: 'Canva 스타일', style: 'cream' },
    { id: 'ba-flower-shadow', label: '꽃 그림자 전후', sub: '고급 살롱', style: 'shadow' },
    { id: 'ba-polaroid', label: '폴라로이드 전후', sub: '인스타 피드', style: 'polaroid' },
    { id: 'ba-editorial', label: '에디토리얼 전후', sub: '잡지 느낌', style: 'editorial' },
    { id: 'ba-sage', label: '세이지 전후', sub: '차분한 무드', style: 'sage' },
    { id: 'ba-dark', label: '블랙 전후', sub: '프리미엄', style: 'dark' },
    { id: 'ba-2split-h', label: '2분할 피드', sub: '4:5', style: 'split' },
    { id: 'ba-review', label: '후기 전후', sub: '리뷰 강조', style: 'review' },
    { id: 'ba-price', label: '가격표 전후', sub: '상담 유도', style: 'price' },
    { id: 'story-open', label: '스토리 오픈', sub: '9:16', style: 'story' },
  ];

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  function entryHTML() {
    return `<div class="pe-preset-hero">
        <div>
          <div class="pe-preset-eyebrow">프리미엄 살롱 템플릿</div>
          <div class="pe-preset-hero-title">전후사진을 캔바처럼</div>
          <div class="pe-preset-hero-sub">고급 배경 · 영문 타이틀 · Before/After 레이아웃</div>
        </div>
        <button type="button" class="pe-preset-hero-btn" data-pev6-card="template">전체보기</button>
      </div>
      <div class="pe-preset-cats">${CATEGORIES.map(_catButton).join('')}</div>
      <div class="pe-look-strip">${_sortedPresets().map(_presetButton).join('')}</div>
      <div class="pe-template-showcase">
        <div class="pe-template-showcase-head">
          <strong>고급 전후 템플릿</strong>
          <span>${TEMPLATE_CARDS.length}종</span>
        </div>
        <div class="pe-template-strip">${TEMPLATE_CARDS.map(_templateButton).join('')}</div>
      </div>`;
  }

  function _catButton(cat) {
    return `<button type="button" class="pe-preset-cat" data-pev6-category="${cat.id}" data-pev6-card="${cat.tab}">${_esc(cat.label)}</button>`;
  }

  function _presetButton(preset) {
    return `<button type="button" class="pe-look-card" data-pe-preset="${preset.id}">
      <span class="pe-preset-thumb" style="background:${_esc(preset.tone)}"></span>
      <span class="pe-preset-name">${_esc(preset.label)}</span>
      <span class="pe-preset-cat-label">${_esc(_catLabel(preset.category))}</span>
    </button>`;
  }

  function _templateButton(tpl) {
    return `<button type="button" class="pe-template-card is-${_esc(tpl.style)}" data-pe-template-card="${_esc(tpl.id)}">
      <span class="pe-template-mini">
        <span class="pe-template-title">Before & After</span>
        <span class="pe-template-line"></span>
        <span class="pe-template-photos"><i></i><i></i></span>
        <span class="pe-template-caption"><b>Before</b><b>After</b></span>
      </span>
      <span class="pe-template-name">${_esc(tpl.label)}</span>
      <span class="pe-template-sub">${_esc(tpl.sub)}</span>
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

  window.PhotoEditorPresetCards = { CATEGORIES, PRESETS, TEMPLATE_CARDS, entryHTML, apply, applyToState };
})();
