/* 사진 편집기 — 살롱 추천 프리셋 카드 */
(function () {
  'use strict';
  if (window.PhotoEditorPresetCards) return;

  const RECENT_KEY = 'itdasy_pe_recent_presets';
  let _activeCategory = 'recommend';
  const CATEGORIES = [
    { id: 'recommend', label: '추천', tab: 'auto' },
    { id: 'skin-care', label: '피부 보정', tab: 'beauty' },
    { id: 'ba', label: '전후 템플릿', tab: 'template' },
    { id: 'filter', label: '색감 보정', tab: 'film' },
    { id: 'retouch', label: '리터치', tab: 'beauty' },
    { id: 'promo', label: '홍보', tab: 'template' },
  ];
  const PRESETS = [
    { id: 'salon-clean', label: '깨끗한 피부', category: 'skin-care', beautyFocus: 'skin', tone: 'linear-gradient(145deg,#fff8f7,#f6cad0)', adjust: { brightness: 110, saturate: 104, sharpness: 8, temperature: 4 }, beauty: { skin: 34, redness: 38, blemish: 34, textureSmooth: 28, eyeShadow: 14, yellowness: 18 }, relight: { ambientBoost: 12, warmth: 4, intensity: 5 } },
    { id: 'shop-bright', label: '화사한 매장', category: 'filter', tone: 'linear-gradient(145deg,#fff2d9,#f0c088)', adjust: { brightness: 116, saturate: 112, sharpness: 10, temperature: 8 }, relight: { ambientBoost: 18, warmth: 10, intensity: 8 } },
    { id: 'hair-gloss', label: '헤어 윤기', category: 'skin-care', tone: 'linear-gradient(145deg,#f6dfce,#6c4737)', adjust: { brightness: 104, saturate: 108, sharpness: 18, temperature: 8 }, beauty: { hairShine: 52, hairVolume: 28, hairDetail: 22 } },
    { id: 'nail-crisp', label: '네일 선명', category: 'retouch', tone: 'linear-gradient(145deg,#ffe5ee,#d0738e)', adjust: { brightness: 106, saturate: 118, sharpness: 28, temperature: 2 }, beauty: { nailGloss: 58, nailShape: 42, handSkin: 18 } },
    { id: 'lash-clear', label: '속눈썹 또렷', category: 'retouch', tone: 'linear-gradient(145deg,#eef2f9,#20232b)', adjust: { brightness: 104, saturate: 104, sharpness: 22, temperature: 0 }, beauty: { lashSharp: 52, irisClear: 34, catchLight: 22 } },
    { id: 'natural-before', label: '자연 Before', category: 'recommend', tone: '#E5EADF', adjust: { brightness: 102, saturate: 101, sharpness: 4, temperature: 0 }, beauty: { skin: 4, redness: 6 } },
    { id: 'promo-after', label: '홍보용 After', category: 'promo', tone: 'linear-gradient(145deg,#fff8ea,#c69b63)', adjust: { brightness: 112, saturate: 112, sharpness: 24, temperature: 5 }, beauty: { skin: 20, blemish: 18, hairShine: 18 } },
    { id: 'premium-warm', label: '프리미엄 톤', category: 'filter', tone: 'linear-gradient(145deg,#f8f1e8,#d8c4a8)', adjust: { brightness: 106, saturate: 104, sharpness: 8, temperature: 14 }, film: { presetId: 'cream', strength: 42 } },
    { id: 'soft-glow', label: '부드러운 광채', category: 'skin-care', beautyFocus: 'makeup', tone: 'linear-gradient(145deg,#fff,#f3d7e8)', adjust: { brightness: 112, saturate: 104, sharpness: 10, temperature: -2 }, beauty: { skin: 28, redness: 28, blemish: 20, textureSmooth: 20, lipPop: 16, catchLight: 18 } },
    { id: 'clear-detail', label: '또렷한 선명', category: 'filter', tone: 'linear-gradient(145deg,#e9eef4,#9ca8b8)', adjust: { brightness: 103, saturate: 108, sharpness: 34, temperature: 0 }, relight: { ambientBoost: 8, intensity: 8 } },
    { id: 'vintage-mood', label: '빈티지 무드', category: 'filter', tone: 'linear-gradient(145deg,#f8d9be,#65758c)', adjust: { brightness: 104, saturate: 116, sharpness: 8, temperature: 10 }, film: { presetId: 'cream', strength: 58 } },
    { id: 'ai-glow', label: '글로우 리터치', category: 'retouch', beautyFocus: 'skin', tone: 'linear-gradient(145deg,#fff6cf,#eec0cc)', adjust: { brightness: 111, saturate: 106, sharpness: 8, temperature: 4 }, beauty: { skin: 30, redness: 22, blemish: 28, textureSmooth: 26, catchLight: 20 } },
  ];
  // v326 — tier: 'free'|'pro' 마킹 + BA 시리즈 일부 노출
  const TEMPLATE_CARDS = [
    // BA 그룹 (free 5 / pro 1) — 부위별 시리즈 + 기존 폴라로이드 + 에디토리얼(pro)
    { id: 'ba-hair-cream',    label: '헤어 전후 (크림)',  sub: 'Hair B/A',    style: 'cream',    group: 'ba', type: 'ba', tier: 'free' },
    { id: 'ba-nail-cream',    label: '네일 전후 (크림)',  sub: 'Nail B/A',    style: 'cream',    group: 'ba', type: 'ba', tier: 'free' },
    { id: 'ba-lash-polaroid', label: '속눈썹 전후 (폴라)', sub: 'Lash B/A',    style: 'polaroid', group: 'ba', type: 'ba', tier: 'free' },
    { id: 'ba-skin-cream',    label: '피부 전후 (크림)',  sub: 'Skin B/A',    style: 'cream',    group: 'ba', type: 'ba', tier: 'free' },
    { id: 'ba-polaroid',      label: '폴라로이드 전후',   sub: '인스타 피드',  style: 'polaroid', group: 'ba', type: 'ba', tier: 'free' },
    { id: 'ba-editorial',     label: '에디토리얼 전후',   sub: '잡지 느낌',    style: 'editorial', group: 'ba', type: 'ba', tier: 'pro'  },
    // 홍보 그룹 (free 4 / pro 2)
    { id: 'feed-showcase',    label: '시술 자랑 피드',    sub: '포트폴리오',   style: 'feed',     group: 'promo', type: 'feed',  tier: 'free' },
    { id: 'story-open',       label: '스토리 오픈',       sub: '9:16 홍보',    style: 'story',    group: 'promo', type: 'story', tier: 'free' },
    { id: 'reels-process',    label: '시술 과정',         sub: '세로 홍보',    style: 'process',  group: 'promo', type: 'story', tier: 'free' },
    { id: 'event-discount',   label: '할인 이벤트',       sub: '즉시 홍보',    style: 'event',    group: 'promo', type: 'promo', tier: 'free' },
    { id: 'price-hair',       label: '헤어 가격표',       sub: '메뉴판',       style: 'price',    group: 'promo', type: 'price', tier: 'free' },
    { id: 'price-nail',       label: '네일 가격표',       sub: '메뉴판',       style: 'price',    group: 'promo', type: 'price', tier: 'free' },
    { id: 'card-gold',        label: '골드 명함',         sub: '샵 안내',      style: 'card',     group: 'promo', type: 'card',  tier: 'pro'  },
    { id: 'card-dark',        label: '블랙 명함',         sub: '프리미엄',     style: 'dark-card', group: 'promo', type: 'card', tier: 'pro'  },
  ];

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  function entryHTML() {
    const presets = _visiblePresets();
    const templates = _visibleTemplates();
    return `<div class="pe-preset-hero">
        <div>
          <div class="pe-preset-eyebrow">프리미엄 살롱 템플릿</div>
          <div class="pe-preset-hero-title">사진을 바로 홍보물처럼</div>
          <div class="pe-preset-hero-sub">피부 보정 · 전후사진 · 스토리 · 가격표 · 명함</div>
        </div>
        <button type="button" class="pe-preset-hero-btn" data-pev6-card="template">전체보기</button>
      </div>
      <div class="pe-preset-cats">${CATEGORIES.map(_catButton).join('')}</div>
      ${presets.length ? `<div class="pe-look-strip">${presets.map(_presetButton).join('')}</div>` : ''}
      <div class="pe-template-showcase">
        <div class="pe-template-showcase-head">
          <strong>${_activeCategory === 'ba' ? '고급 전후 템플릿' : '프리미엄 홍보 템플릿'}</strong>
          <span>${templates.length}종</span>
        </div>
        <div class="pe-template-strip">${templates.map(_templateButton).join('')}</div>
      </div>`;
  }

  function _catButton(cat) {
    const on = _activeCategory === cat.id ? ' on' : '';
    return `<button type="button" class="pe-preset-cat${on}" data-pev6-category="${cat.id}">${_esc(cat.label)}</button>`;
  }

  function _presetButton(preset) {
    return `<button type="button" class="pe-look-card" data-pe-preset="${preset.id}">
      <span class="pe-preset-thumb" style="background:${_esc(preset.tone)}"></span>
      <span class="pe-preset-name">${_esc(preset.label)}</span>
      <span class="pe-preset-cat-label">${_esc(_catLabel(preset.category))}</span>
    </button>`;
  }

  function _templateButton(tpl) {
    const badge = tpl.tier === 'free'
      ? '<span class="pe-tpl-free">Free</span>'
      : (tpl.tier === 'pro' ? '<span class="pe-tpl-pro">Pro</span>' : '');
    return `<button type="button" class="pe-template-card is-${_esc(tpl.style)}" data-pe-template-card="${_esc(tpl.id)}">
      ${badge}
      <span class="pe-template-mini">
        <span class="pe-template-title">${_esc(_templateTitle(tpl))}</span>
        <span class="pe-template-line"></span>
        ${_templateVisual(tpl)}
      </span>
      <span class="pe-template-name">${_esc(tpl.label)}</span>
      <span class="pe-template-sub">${_esc(tpl.sub)}</span>
    </button>`;
  }

  function _templateTitle(tpl) {
    if (tpl.type === 'feed') return 'Portfolio';
    if (tpl.type === 'story') return 'Story';
    if (tpl.type === 'promo') return 'Event';
    if (tpl.type === 'price') return 'Menu';
    if (tpl.type === 'card') return 'Studio';
    return 'Before & After';
  }

  function _templateVisual(tpl) {
    if (tpl.type === 'ba') return '<span class="pe-template-photos"><i></i><i></i></span><span class="pe-template-caption"><b>Before</b><b>After</b></span>';
    if (tpl.type === 'price') return '<span class="pe-template-list"><i></i><i></i><i></i></span>';
    if (tpl.type === 'card') return '<span class="pe-template-card-lines"><i></i><i></i><i></i></span>';
    return '<span class="pe-template-poster"><i></i><b></b></span>';
  }

  function _catLabel(id) {
    const cat = CATEGORIES.find(c => c.id === id);
    return cat ? cat.label : '추천';
  }

  function _sortedPresets() {
    const recent = _recent();
    return PRESETS.slice().sort((a, b) => recent.indexOf(b.id) - recent.indexOf(a.id));
  }

  function _visiblePresets() {
    const all = _sortedPresets();
    if (_activeCategory === 'recommend') return all.slice(0, 8);
    return all.filter(p => p.category === _activeCategory);
  }

  function _visibleTemplates() {
    if (_activeCategory === 'ba') return TEMPLATE_CARDS.filter(t => t.group === 'ba');
    if (_activeCategory === 'promo') return TEMPLATE_CARDS.filter(t => t.group === 'promo');
    return TEMPLATE_CARDS;
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
    if (preset.beautyFocus) state.beautyFocus = preset.beautyFocus;
    state._lastModifiedKeys = _modifiedKeys(preset);
    _remember(id);
    if (helpers) _finish(helpers, preset.label + ' 적용');
    return true;
  }

  function _modifiedKeys(preset) {
    return Object.keys(preset).filter(k => ['adjust', 'beauty', 'relight', 'film', 'beautyFocus'].includes(k));
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

  function setCategory(id) {
    if (!CATEGORIES.some(c => c.id === id)) return false;
    _activeCategory = id;
    return true;
  }

  window.PhotoEditorPresetCards = { CATEGORIES, PRESETS, TEMPLATE_CARDS, entryHTML, apply, applyToState, setCategory };
})();
