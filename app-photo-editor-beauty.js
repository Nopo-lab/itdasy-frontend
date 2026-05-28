/* 사진 편집기 — 뷰티 모듈 */
(function () {
  'use strict';

  // ── 슬라이더 정의 (key → meta) ──
  const SLIDERS = {
    // 얼굴·피부
    skin:          { label: '피부톤 정리',     group: 'face', min: 0,   max: 100, step: 1 },
    redness:       { label: '붉은기 완화',     group: 'face', min: 0,   max: 100, step: 1 },
    blemish:       { label: '잡티 완화',       group: 'face', min: 0,   max: 100, step: 1 },
    eyeShadow:     { label: '눈가 그림자',     group: 'face', min: 0,   max: 100, step: 1 },
    textureSmooth: { label: '결 정리 (자연)',  group: 'face', min: 0,   max: 100, step: 1 },
    yellowness:    { label: '노란기 완화',     group: 'face', min: 0,   max: 100, step: 1 },
    // 메이크업 (v192 신규)
    lipPop:        { label: '입술 발색',       group: 'face', min: 0,   max: 100, step: 1 },
    eyeColor:      { label: '아이 색감',       group: 'face', min: 0,   max: 100, step: 1 },
    browSharp:     { label: '눈썹 선명',       group: 'face', min: 0,   max: 100, step: 1 },
    // 손·네일
    handSkin:      { label: '손/발 피부톤',    group: 'hand', min: 0,   max: 100, step: 1 },
    nailGloss:     { label: '네일 광택',       group: 'hand', min: 0,   max: 100, step: 1 },
    coolness:      { label: '푸른기 완화 (손)', group: 'hand', min: 0,   max: 100, step: 1 },
    nailShape:     { label: '네일 경계 선명',  group: 'hand', min: 0,   max: 100, step: 1 },
    // 모발
    hairShine:     { label: '모발 윤기',       group: 'hair', min: 0,   max: 100, step: 1 },
    hairVolume:    { label: '머리 풍성감',     group: 'hair', min: 0,   max: 100, step: 1 },
    hairEndsClean: { label: '머리끝 정리',     group: 'hair', min: 0,   max: 100, step: 1 },
    hairColor:     { label: '모발 색감 (- 차가운 / + 따뜻)', group: 'hair', min: -50, max: 50, step: 1 },
    hairDetail:    { label: '머리결',          group: 'hair', min: 0,   max: 100, step: 1 },
    hairColorPop:  { label: '염색 컬러 강조',  group: 'hair', min: 0,   max: 100, step: 1 },
    scalpBoost:    { label: '두피 톤 (풍성감)', group: 'hair', min: 0,   max: 100, step: 1 },
    hairyArm:      { label: '바디 잔털 시각화 ↓', group: 'face', min: 0, max: 100, step: 1 },
    // 속눈썹
    eyeRedness:    { label: '눈 붉음 완화',     group: 'lash', min: 0,   max: 100, step: 1 },
    irisClear:     { label: '눈동자 또렷',      group: 'lash', min: 0,   max: 100, step: 1 },
    catchLight:    { label: '눈빛 반짝임',      group: 'lash', min: 0,   max: 100, step: 1 },
    underEyeClean: { label: '눈밑 칙칙함',      group: 'lash', min: 0,   max: 100, step: 1 },
    lashSharp:     { label: '속눈썹 선명도',   group: 'lash', min: 0,   max: 100, step: 1 },
    closeUpDetail: { label: '눈가 디테일 (close-up)', group: 'lash', min: 0,   max: 100, step: 1 },
  };

  // shop_type → 추천 보정 슬라이더 우선순위. v192 신규 3 카테고리 (makeup/scalp/general).
  const SHOP_FEATURED = {
    hair:    ['hairVolume', 'hairEndsClean', 'hairShine', 'hairDetail', 'hairColorPop', 'hairColor'],
    scalp:   ['scalpBoost', 'hairVolume', 'hairShine', 'hairDetail', 'skin', 'redness'],
    makeup:  ['skin', 'redness', 'lipPop', 'eyeColor', 'browSharp', 'yellowness'],
    lash:    ['eyeRedness', 'irisClear', 'catchLight', 'lashSharp', 'underEyeClean', 'closeUpDetail'],
    nail:    ['nailGloss', 'handSkin', 'coolness', 'nailShape', 'yellowness', 'redness'],
    wax:     ['skin', 'redness', 'blemish', 'textureSmooth', 'eyeShadow', 'hairyArm'],
    skin:    ['skin', 'redness', 'blemish', 'textureSmooth', 'eyeShadow'],
    general: ['skin', 'redness', 'blemish', 'textureSmooth'],
  };

  const AI_FEATURES = {
    hair:   ['컬·웨이브 또렷하게', '잔머리 정리', '볼륨/풍성함 강화', '두피·정수리 휑함 완화', '붙임머리 결합부 자연스럽게'],
    scalp:  ['두피 휑함 자연 보완', '잔모 강조', 'AI 모발 풍성함'],
    makeup: ['AI 메이크업 가상 시술', '발색 자연 보강', '얼굴 부위 자동 마스크'],
    lash:   ['빈 부분 자연스럽게 보완', '연장 결합부 정리'],
    nail:   ['큐티클·주변부 정리', '컬러 정확도 보정', '배경 깔끔화'],
    wax:    ['부위 강조 자동', '결 자연 보정 (강도)'],
    skin:   ['자극 부위 자연 복원', '잡티 AI 제거'],
    general: ['AI 일반 보정 보강'],
  };
  const BEAUTY_LOOKS = [
    { id: 'classic', label: '클래식 모드', cat: 'general', icon: '◉', patch: { skin: 16, redness: 18, textureSmooth: 12 } },
    { id: 'soft-clean', label: '결 정리', cat: 'skin', icon: '✦', patch: { skin: 24, blemish: 26, textureSmooth: 20, eyeShadow: 12 } },
    { id: 'proof', label: '컨셉 화보', cat: 'makeup', icon: '▣', patch: { skin: 18, lipPop: 20, eyeColor: 14, browSharp: 18, catchLight: 16 } },
    { id: 'natural-light', label: '자연광', cat: 'general', icon: '▢', patch: { skin: 10, redness: 14, textureSmooth: 6 } },
    { id: 'clear-detail', label: '또렷한 결', cat: 'hair', icon: '◎', patch: { hairDetail: 28, hairShine: 26, closeUpDetail: 18 } },
    { id: 'film-soft', label: '필름톤', cat: 'general', icon: '◌', patch: { skin: 10, redness: 10, lipPop: 12 } },
    { id: 'hair', label: '헤어 컬러', cat: 'hair', icon: '⌁', patch: { hairShine: 48, hairDetail: 34, hairColorPop: 30, hairVolume: 18 } },
    { id: 'lash', label: '속눈썹', cat: 'lash', icon: '⌕', patch: { lashSharp: 52, irisClear: 30, catchLight: 26, underEyeClean: 18 } },
    { id: 'nail', label: '네일', cat: 'nail', icon: '◧', patch: { nailGloss: 58, nailShape: 40, handSkin: 18, coolness: 18 } },
    { id: 'glow', label: 'AI 글로우', cat: 'skin', icon: '✧', patch: { skin: 24, redness: 22, blemish: 18, catchLight: 26 } },
  ];
  const BEAUTY_FOCUS = [
    { id: 'general', label: 'Hot🔥' },
    { id: 'hair', label: '헤어' },
    { id: 'skin', label: '피부' },
    { id: 'lash', label: '속눈썹' },
    { id: 'nail', label: '네일' },
    { id: 'makeup', label: '메이크업' },
  ];

  // [v192] 정규화 헬퍼 (app-core.js itdasyNormalizeShopType) 활용. 없으면 폴백 분기.
  function _detectShopCat() {
    try {
      if (typeof window.itdasyNormalizeShopType === 'function') {
        const r = window.itdasyNormalizeShopType(localStorage.getItem('shop_type') || '');
        return r.cat;  // 'hair' | 'scalp' | 'makeup' | 'lash' | 'nail' | 'wax' | 'skin' | 'general'
      }
      const t = (localStorage.getItem('shop_type') || '').toLowerCase();
      if (!t) return null;
      if (/(두피|탈모|scalp)/.test(t)) return 'scalp';
      if (/(헤어|붙임머리|미용|hair|extension)/.test(t)) return 'hair';
      if (/(속눈썹|lash)/.test(t)) return 'lash';
      if (/(메이크업|눈썹|makeup|brow)/.test(t)) return 'makeup';
      if (/(네일|nail|패디|풋케어|pedi|foot)/.test(t)) return 'nail';
      if (/(왁싱|바디|wax|body)/.test(t)) return 'wax';
      if (/(피부|반영구|문신|skin|tattoo)/.test(t)) return 'skin';
    } catch (_e) { void _e; }
    return 'general';
  }

  function _slider(esc, key, val) {
    const m = SLIDERS[key];
    return `
      <label class="pe-slider">
        <div class="pe-slider-head">
          <span>${esc(m.label)}</span>
          <span class="pe-slider-val" data-pe-slider-val="${key}">${val}</span>
        </div>
        <input type="range" min="${m.min}" max="${m.max}" step="${m.step}" value="${val}" data-pe-slider="${key}" />
      </label>
    `;
  }

  function _groupedHTML(esc, keys, b) {
    const GROUPS = { face: '얼굴 · 피부', hand: '손 · 네일', hair: '모발', lash: '속눈썹' };
    let html = '';
    Object.keys(GROUPS).forEach(g => {
      const gk = keys.filter(k => SLIDERS[k] && SLIDERS[k].group === g);
      if (!gk.length) return;
      html += `<div class="pe-group-label">${GROUPS[g]}</div>`;
      html += gk.map(k => _slider(esc, k, b[k])).join('');
    });
    return html;
  }

  function _panelBeautyHTML(state) {
    const DEF = Object.keys(SLIDERS).reduce((a, k) => { a[k] = 0; return a; }, {});
    const b = Object.assign({}, DEF, state.beauty || {});
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, ch =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
    const cat = state.beautyFocus || _detectShopCat();
    const featured = cat ? (SHOP_FEATURED[cat] || []) : [];
    const otherKeys = Object.keys(SLIDERS).filter(k => !featured.includes(k));
    const aiItems = cat ? (AI_FEATURES[cat] || []) : [];
    const catLabel = { hair: '헤어·붙임머리·미용', lash: '속눈썹', nail: '네일', wax: '왁싱·피부·반영구' }[cat || ''] || '';

    const quickHtml = _beautyQuickHTML(esc, cat);

    let featuredHtml = '';
    if (featured.length) {
      featuredHtml = `
        <div class="pe-group-label" style="color:#D58A95;font-weight:800;">✦ 추천 보정 — ${esc(catLabel)}</div>
        ${featured.map(k => _slider(esc, k, b[k])).join('')}
      `;
    }

    let moreHtml = '';
    if (otherKeys.length) {
      if (featured.length) {
        moreHtml = `
          <button type="button" data-pe-beauty-toggle="1"
            style="margin:14px 0 6px;width:100%;padding:10px;background:rgba(255,255,255,0.05);color:#c9c9d0;border:1px dashed rgba(255,255,255,0.18);border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;">
            ＋ 전체 보정 보기 (+${otherKeys.length})
          </button>
          <div id="peBeautyMore" hidden>
            ${_groupedHTML(esc, otherKeys, b)}
          </div>
        `;
      } else {
        moreHtml = _groupedHTML(esc, otherKeys, b);
      }
    }

    let aiHtml = '';
    if (aiItems.length) {
      aiHtml = '<div class="pe-hint" style="color:#7f7f87;margin-top:14px;">느린 AI 기능은 준비된 것만 별도 버튼으로 보여줘요. 이 화면은 즉시 보정만 다룹니다.</div>';
    }

    return `${quickHtml}${featuredHtml}${moreHtml}${aiHtml}<div class="pe-hint">시술 왜곡 없이 자연 보정 위주로 동작해요. 슬라이더는 손 떼는 순간 반영됩니다.</div>`;
  }

  function _beautyQuickHTML(esc, cat) {
    return `<div class="pe-beauty-hero">
      <div>
        <div class="pe-beauty-hero-kicker">살롱 사진 빠른 보정</div>
        <strong>원하는 느낌을 먼저 고르세요</strong>
        <p>선택 후 아래 슬라이더로 세기만 살짝 조절</p>
      </div>
    </div>
    <div class="pe-beauty-focus">${BEAUTY_FOCUS.map(item =>
      `<button type="button" class="${cat === item.id ? 'on' : ''}" data-pe-beauty-focus="${item.id}">${esc(item.label)}</button>`
    ).join('')}</div>
    <div class="pe-beauty-look-grid">${_beautyLooksFor(cat).map(item => `
      <button type="button" class="pe-beauty-look" data-pe-beauty-look="${item.id}">
        <span>${esc(item.icon)}</span>
        <b>${esc(item.label)}</b>
      </button>
    `).join('')}</div>`;
  }

  function _beautyLooksFor(cat) {
    return BEAUTY_LOOKS
      .filter(item => cat === 'general' || item.cat === cat || item.cat === 'general')
      .slice(0, 8);
  }

  // v343 — fast preview 활성 여부 (PE_FAST_PREVIEW_DISABLE='1' → v342 방식 풀해상도 즉시)
  function _fastPreviewOn() {
    try { return !(window.localStorage && localStorage.getItem('PE_FAST_PREVIEW_DISABLE') === '1'); }
    catch (_e) { return true; }
  }

  function _bindBeautyPanel(panel, state, helpers) {
    const scheduleRedraw = helpers.scheduleRedraw;
    const pushHistory = helpers.pushHistory;
    _bindBeautyQuick(panel, state, helpers);
    panel.querySelectorAll('[data-pe-slider]').forEach(inp => {
      inp.addEventListener('input', () => {
        const key = inp.dataset.peSlider;
        const v = +inp.value;
        if (state.beauty[key] === v) return;   // 같은 값 → redraw 중복 방지 (렉 완화)
        state.beauty[key] = v;
        const out = panel.querySelector(`[data-pe-slider-val="${key}"]`);
        if (out) out.textContent = inp.value;
        scheduleRedraw(_fastPreviewOn());   // v343 — 드래그 중 저해상도 preview (플래그 OFF 면 full)
      });
      // v343 — 손 뗄 때 풀해상도 final 1회 (+히스토리). pointerup/touchend 는 final redraw 만(coalesced).
      inp.addEventListener('change', () => { scheduleRedraw(); pushHistory(); });
      inp.addEventListener('pointerup', () => scheduleRedraw());
      inp.addEventListener('touchend', () => scheduleRedraw());
      // [v202 2026-05-18] 더블탭 reset (S1-2)
      inp.addEventListener('dblclick', () => {
        const key = inp.dataset.peSlider;
        state.beauty[key] = 0;
        inp.value = 0;
        const out = panel.querySelector(`[data-pe-slider-val="${key}"]`);
        if (out) out.textContent = 0;
        scheduleRedraw(); pushHistory();
        if (helpers && helpers.toast) helpers.toast('초기화: ' + (SLIDERS[key] ? SLIDERS[key].label : key));
      });
    });
    // 전체 보정 보기 토글
    const toggleBtn = panel.querySelector('[data-pe-beauty-toggle]');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const more = panel.querySelector('#peBeautyMore');
        if (!more) return;
        if (more.hidden) {
          more.hidden = false;
          toggleBtn.textContent = '－ 추천 보정만 보기';
        } else {
          more.hidden = true;
          toggleBtn.textContent = '＋ 전체 보정 보기';
        }
      });
    }
    // AI 준비 중 클릭 → 토스트
    panel.querySelectorAll('[data-pe-ai-coming]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.showToast) window.showToast('AI 보정은 카드 발급 후 활성화 예정이에요');
      });
    });
  }

  function _bindBeautyQuick(panel, state, helpers) {
    panel.querySelectorAll('[data-pe-beauty-focus]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.beautyFocus = btn.dataset.peBeautyFocus;
        helpers.renderPanel();
      });
    });
    panel.querySelectorAll('[data-pe-beauty-look]').forEach(btn => {
      btn.addEventListener('click', () => _applyBeautyLook(btn.dataset.peBeautyLook, state, helpers));
    });
  }

  function _applyBeautyLook(id, state, helpers) {
    const look = BEAUTY_LOOKS.find(item => item.id === id);
    if (!look) return;
    Object.assign(state.beauty, look.patch);
    if (look.cat && look.cat !== 'general') state.beautyFocus = look.cat;
    helpers.renderPanel();
    helpers.scheduleRedraw();
    helpers.pushHistory();
    if (helpers.toast) helpers.toast(look.label + ' 적용');
  }

  // ── 뷰티 보정 (픽셀 처리는 beauty-engine.js 담당) ──
  function _applyBeauty(ctx, w, h, b) {
    const engine = window.PhotoEditorBeautyEngine;
    if (!engine || typeof engine.apply !== 'function') return;
    let skinSmoothed = false;
    const txK = (b.textureSmooth || 0) / 100;
    const blemK = (b.blemish || 0) / 100;
    const smoothStr = Math.max(txK, blemK);
    if (smoothStr > 0) {
      const bilateral = window.PhotoEditorGLBilateral;
      if (bilateral && typeof bilateral.apply === 'function') {
        try {
          const result = bilateral.apply(ctx.canvas, smoothStr, _skinMaskCanvas(ctx.canvas));
          if (result) { ctx.drawImage(result, 0, 0); skinSmoothed = true; }
        } catch (_e) { void _e; }
      }
    }
    // v316 — RegionMask 우선 (sync 캐시 hit 만). 미캐시/비활성/conf<0.4 → null → v312 휴리스틱 fallback.
    let regionMasks = null;
    try {
      const MA = window.MaskApplication;
      const PE = window.PhotoEditor;
      const st = PE && PE._internal && PE._internal.getState ? PE._internal.getState() : null;
      const img = st && st.originalImg;
      if (MA && typeof MA.getMasksForBeautySync === 'function' && img) {
        regionMasks = MA.getMasksForBeautySync(img);
      }
      // v317 — 속눈썹: lashSharp 사용 시에만 eyelashBandMask 페치 (conf≥0.4면 밴드만 샤픈, 아니면 전역 unsharp)
      if ((b.lashSharp || 0) > 10 && MA && typeof MA.getLashMaskSync === 'function' && img) {
        const lash = MA.getLashMaskSync(img);
        if (lash) {
          if (!regionMasks) regionMasks = { useMasks: {}, _scale: {}, maskW: (img.naturalWidth || img.width) | 0, maskH: (img.naturalHeight || img.height) | 0 };
          regionMasks.lashMask = lash.mask;
          regionMasks.lashScale = lash.scale;
        }
      }
    } catch (_e) { regionMasks = null; }
    engine.apply(ctx, w, h, b, skinSmoothed, regionMasks);
  }

  function _skinMaskCanvas(canvas) {
    const SM = window.PhotoEditorSmartMask;
    if (!SM || typeof SM.classify !== 'function') return null;
    const w = canvas.width, h = canvas.height;
    let data;
    try { data = canvas.getContext('2d').getImageData(0, 0, w, h); }
    catch (_e) { return null; }
    const mask = document.createElement('canvas');
    mask.width = w; mask.height = h;
    const out = mask.getContext('2d').createImageData(w, h);
    _fillSkinMask(data.data, out.data, w, h, SM);
    mask.getContext('2d').putImageData(out, 0, 0);
    return mask;
  }

  function _fillSkinMask(src, dst, w, h, SM) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = src[i], g = src[i + 1], b = src[i + 2];
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      const p = SM.classify({ r, g, b, lum, maxCh: Math.max(r, g, b), minCh: Math.min(r, g, b), x, y, w, h });
      const v = Math.round(Math.max(p.skin || 0, Math.min(p.redness || 0, 0.5)) * 255);
      dst[i] = v; dst[i + 1] = v; dst[i + 2] = v; dst[i + 3] = 255;
    }
  }

  // ── 메인 모듈 준비될 때까지 폴링 후 등록 ──
  function _register() {
    if (!window.PhotoEditor || !window.PhotoEditor._internal) return false;
    const i = window.PhotoEditor._internal;
    i.registerTabPanel('beauty', { html: _panelBeautyHTML, bind: _bindBeautyPanel });
    i.registerDrawHook('beauty', _applyBeauty);
    return true;
  }
  if (!_register()) {
    let tries = 0;
    const iv = setInterval(() => {
      if (_register() || ++tries > 50) clearInterval(iv);
    }, 100);
  }
})();
