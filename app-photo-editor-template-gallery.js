/* 사진 편집기 — 캔바식 템플릿 갤러리 (T1+T2 2026-06-06)
   템플릿 탭을 "검색 + 해시태그 칩 + 2열 썸네일 그리드 + 현재 사진 프리뷰 + 적용" 으로 통합.
   - 썸네일/큰 프리뷰는 현재 편집 중인 사진(state.originalImg)으로 실제 합성(premium renderHook 재사용 → 적용 결과와 동일).
   - 보관함(즐겨찾기/최근): PhotoEditorTemplateLibrary.
   - 적용: 기존 PhotoEditorTemplatesV2.apply 경로 그대로(상태 오염/엔진 변경 없음).
   외부 노출: window.PhotoEditorTemplateGallery = { panelHTML, bind } — templates.js 가 위임. */
(function () {
  'use strict';
  if (window.PhotoEditorTemplateGallery) return;

  // ── 갤러리 상태(탭 재진입 사이 유지) ──
  let _chip = 'recommend';
  let _query = '';
  let _selectedId = '';
  let _showAll = false;
  let _searchTimer = null;
  const _thumbCache = {};   // key: id|px|photoSig → dataURL

  const CHIPS = [
    ['recommend', '추천'], ['ba', '전후'], ['price', '가격표'], ['story', '스토리'],
    ['feed', '피드'], ['review', '후기'], ['event', '이벤트'], ['library', '보관함'],
  ];
  const SHORT_PURPOSE = {
    before_after: '전후', review: '후기', price: '가격표', event: '이벤트', story: '스토리',
    feed: '피드', reel_cover: '릴스', booking: '명함', retouch: '리터치', portfolio: '포트폴리오', promo: '홍보',
  };
  // 한글 검색어 → 추가 매칭 토큰(영문 id/태그까지 잡음).
  const ALIAS = {
    '회원권': 'member 회원', '왁싱': 'wax', '네일': 'nail', '헤어': 'hair', '피부': 'skin',
    '속눈썹': 'lash', '눈썹': 'brow', '메이크업': 'makeup', '전후': 'before after ba',
    '가격표': 'price', '후기': 'review', '이벤트': 'event', '스토리': 'story', '피드': 'feed', '명함': 'card',
  };

  const _SEARCH_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>';
  const _BMK_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
  function _MD() { return window.PhotoEditorTemplateMarketData || { CATS: [], TEMPLATES: [] }; }
  function _LIB() { return window.PhotoEditorTemplateLibrary; }
  function _toast(msg) {
    if (window.toast) window.toast(msg);
    else if (window.showToast) window.showToast(msg);
  }

  function _brandKit() {
    try { if (window.BrandKit && window.BrandKit.get) return window.BrandKit.get(); } catch (_e) { void 0; }
    return { primary: '#7b61ff', accent: '#c89a52', soft: '#f3eee4', shopName: '잇데이 스튜디오', logo: null };
  }
  function _accentColor(accent, bk) {
    if (accent === 'gold') return bk.accent || '#c89a52';
    if (accent === 'primary') return bk.primary || '#7b61ff';
    return bk.soft || '#f3eee4';
  }

  // ── 템플릿 선별 ──
  function _tplById(id) { return _MD().TEMPLATES.find(t => t.id === id) || null; }

  function _recommendList() {
    const MD = _MD();
    let shopType = '';
    try { shopType = localStorage.getItem('shop_type') || ''; } catch (_e) { void 0; }
    if (MD.recommendTemplates) {
      const picks = MD.recommendTemplates('', { shopType }, 12) || [];
      if (picks.length) return picks;
    }
    return MD.TEMPLATES.filter(t => t.tier !== 'pro').slice(0, 12);
  }

  function _chipMatch(chip, t) {
    switch (chip) {
      case 'ba': return t.cat === 'ba' || t.purpose === 'before_after';
      case 'price': return t.cat === 'price' || t.purpose === 'price';
      case 'story': return t.cat === 'story';
      case 'feed': return t.cat === 'feed' || t.purpose === 'feed';
      case 'review': return t.purpose === 'review';
      case 'event': return t.cat === 'event' || t.purpose === 'event';
      default: return true;
    }
  }

  function _searchable(t) {
    const MD = _MD();
    const ind = (MD.INDUSTRY_LABEL || {})[t.industry] || '';
    const pur = (MD.PURPOSE_LABEL || {})[t.purpose] || '';
    const cat = (MD.CATS.find(c => c.id === t.cat) || {}).label || '';
    return (t.label + ' ' + (t.prefillText || '') + ' ' + ind + ' ' + pur + ' ' + cat + ' ' + t.id).toLowerCase();
  }

  function _matchQuery(t, q) {
    if (!q) return true;
    const hay = _searchable(t);
    return q.toLowerCase().split(/\s+/).filter(Boolean).every(tok => {
      if (hay.indexOf(tok) !== -1) return true;
      const alias = ALIAS[tok];
      return alias ? alias.split(' ').some(a => hay.indexOf(a) !== -1) : false;
    });
  }

  function _currentList() {
    const MD = _MD();
    let base;
    if (_chip === 'library') {
      const lib = _LIB();
      const ids = lib ? lib.listAll() : [];
      base = ids.map(_tplById).filter(Boolean);
    } else if (_showAll) {
      base = MD.TEMPLATES.slice();
    } else if (_chip === 'recommend') {
      // 추천은 큐레이션 12개지만, 검색어가 있으면 전체에서 찾는다(원장이 "가격표"라 치면 전체 가격표 노출).
      base = _query ? MD.TEMPLATES.slice() : _recommendList();
    } else {
      base = MD.TEMPLATES.filter(t => _chipMatch(_chip, t));
    }
    return base.filter(t => _matchQuery(t, _query));
  }

  // ── 현재 사진 기반 프리뷰 합성 ──
  function _photoSig(state) {
    const src = (state && state.originalSrc) || '';
    return src.length + ':' + src.slice(0, 28) + ':' + (state && state.secondImg ? '2' : '1');
  }
  function _ratioWH(ratio, base) {
    if (ratio === '9:16') return { w: Math.round(base * 9 / 16), h: base };
    if (ratio === '1:1') return { w: base, h: base };
    return { w: Math.round(base * 4 / 5), h: base };
  }
  function _coverDraw(ctx, img, x, y, w, h) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    const sAR = iw / ih, dAR = w / h;
    let sx, sy, sw, sh;
    if (sAR > dAR) { sh = ih; sw = sh * dAR; sx = (iw - sw) / 2; sy = 0; }
    else { sw = iw; sh = sw / dAR; sx = 0; sy = (ih - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  // 실패 없이 항상 dataURL 반환(사진 있으면 사진+오버레이, 없으면 살롱톤 + 라벨).
  function _previewURL(t, state, basePx) {
    const sig = _photoSig(state);
    const key = t.id + '|' + basePx + '|' + sig;
    if (_thumbCache[key]) return _thumbCache[key];
    const MD = _MD();
    const cat = MD.CATS.find(c => c.id === t.cat) || { ratio: '4:5' };
    const dim = _ratioWH(cat.ratio, basePx);
    const bk = _brandKit();
    const color = _accentColor(t.accent, bk);
    let url = '';
    try {
      const cv = document.createElement('canvas');
      cv.width = dim.w; cv.height = dim.h;
      const ctx = cv.getContext('2d');
      const photo = state && state.originalImg;
      if (photo) {
        _coverDraw(ctx, photo, 0, 0, dim.w, dim.h);
      } else {
        const g = ctx.createLinearGradient(0, 0, dim.w, dim.h);
        g.addColorStop(0, '#f3e9ea'); g.addColorStop(1, color);
        ctx.fillStyle = g; ctx.fillRect(0, 0, dim.w, dim.h);
      }
      const tplV2 = { id: t.id, label: t.label, bg: color, shopName: bk.shopName, logo: bk.logo, cat: cat.id };
      // [S1] 프리뷰==적용 유지 — slotValues 주입(현재 적용 중이면 편집값, 아니면 기본값).
      const TS = window.PhotoEditorTemplateSlots;
      if (TS) {
        const cur = state && state.tplV2;
        tplV2.slotValues = (cur && cur.id === t.id && cur.slotValues)
          ? cur.slotValues
          : TS.getDefaultValues(t.id, t, { shopName: bk.shopName, serviceName: state && state.serviceName, price: state && state.price });
      }
      const synth = {
        tplV2, originalImg: photo, secondImg: state && state.secondImg,
        shopName: state && state.shopName, serviceName: state && state.serviceName, price: state && state.price,
      };
      const PT = window.PhotoEditorPremiumTemplates;
      if (PT && PT.renderHook) PT.renderHook(ctx, dim.w, dim.h, synth);
      else if (/^ba-/.test(t.id) && window.PhotoEditorBACompose) window.PhotoEditorBACompose.draw(ctx, dim.w, dim.h, synth, tplV2, {});
      else if (window.PhotoEditorTemplateOverlay) window.PhotoEditorTemplateOverlay.draw(ctx, dim.w, dim.h, t, tplV2);
      url = cv.toDataURL('image/jpeg', basePx > 480 ? 0.86 : 0.8);
    } catch (_e) { url = ''; }
    if (url) _thumbCache[key] = url;
    return url;
  }

  // ── HTML 빌더 ──
  function _chipsHTML() {
    return CHIPS.map(([id, label]) => {
      const on = (id === _chip) ? ' is-active' : '';
      return `<button type="button" class="pe-tplg-chip${on}" data-pe-tplg-chip="${id}">${_esc(label)}</button>`;
    }).join('');
  }

  function _cardHTML(t) {
    const MD = _MD();
    const isFree = t.tier !== 'pro';
    const badge = SHORT_PURPOSE[t.purpose] || (MD.PURPOSE_LABEL || {})[t.purpose] || '홍보';
    const ind = (MD.INDUSTRY_LABEL || {})[t.industry];
    const catL = (MD.CATS.find(c => c.id === t.cat) || {}).label || '';
    const sub = [(t.industry && t.industry !== 'common') ? ind : '', catL].filter(Boolean).join(' · ');
    const fav = _LIB() && _LIB().isFav(t.id);
    const sel = (t.id === _selectedId) ? ' is-selected' : '';
    return `<button type="button" class="pe-tplg-card${sel}" data-pe-tplg-id="${_esc(t.id)}">
      <div class="pe-tplg-thumb" data-pe-tplg-thumb="${_esc(t.id)}">
        <span class="pe-tplg-badge">${_esc(badge)}</span>
        ${isFree ? '' : '<span class="pe-tplg-pro">PRO</span>'}
        <span class="pe-tplg-bmk${fav ? ' on' : ''}" data-pe-tplg-bmk="${_esc(t.id)}" role="button" aria-label="보관함">${_BMK_SVG}</span>
      </div>
      <div class="pe-tplg-card-title">${_esc(t.label)}</div>
      <div class="pe-tplg-card-sub">${_esc(sub)}</div>
    </button>`;
  }

  function _gridHTML(list) {
    if (!list.length) {
      if (_chip === 'library') {
        return `<div class="pe-tplg-empty"><strong>저장한 템플릿이 없어요</strong>
          <p>템플릿을 보관하면 여기서 빠르게 다시 쓸 수 있어요.</p></div>`;
      }
      return `<div class="pe-tplg-empty"><strong>검색 결과가 없어요</strong>
        <p>다른 검색어나 칩을 눌러보세요.</p></div>`;
    }
    return list.map(_cardHTML).join('');
  }

  function _previewHTML(t, state) {
    if (!t) return '';
    const isFree = t.tier !== 'pro';
    const url = _previewURL(t, state, 720);
    const MD = _MD();
    const cat = MD.CATS.find(c => c.id === t.cat) || { ratio: '4:5', label: '' };
    const ar = cat.ratio === '9:16' ? '9 / 16' : (cat.ratio === '4:5' ? '4 / 5' : '1 / 1');
    const applied = state && state.tplV2 && state.tplV2.id === t.id;
    return `<div class="pe-tplg-preview-inner">
      <div class="pe-tplg-preview-canvas" style="aspect-ratio:${ar};${url ? `background-image:url(${url});` : ''}"></div>
      <div class="pe-tplg-preview-meta"><strong>${_esc(t.label)}</strong>${isFree ? '' : '<span class="pe-tplg-pro">PRO</span>'}</div>
      <div class="pe-tplg-selected-actions">
        <button type="button" class="pe-tplg-primary" data-pe-tplg-apply="${_esc(t.id)}">${applied ? '적용됨 ✓' : (isFree ? '이 템플릿 적용' : 'Pro로 적용')}</button>
        <button type="button" class="pe-tplg-secondary" data-pe-tplg-all>전체 템플릿 보기</button>
      </div>
    </div>`;
  }

  function panelHTML(state) {
    const list = _currentList();
    const selTpl = _selectedId ? _tplById(_selectedId) : null;
    return `<div class="pe-tplg" data-pe-template-gallery>
      <div class="pe-tplg-search">
        <span class="pe-tplg-search-icon">${_SEARCH_SVG}</span>
        <input type="search" data-pe-tplg-search value="${_esc(_query)}" placeholder="전후, 가격표, 후기, 이벤트 검색" />
      </div>
      <div class="pe-tplg-chips" data-pe-tplg-chips>${_chipsHTML()}</div>
      <div class="pe-tplg-preview" data-pe-tplg-preview>${selTpl ? _previewHTML(selTpl, state) : ''}</div>
      <div class="pe-tplg-grid" data-pe-tplg-grid>${_gridHTML(list)}</div>
    </div>`;
  }

  // ── 바인딩 ──
  function _paintThumbs(panel, state) {
    const nodes = panel.querySelectorAll('[data-pe-tplg-thumb]');
    const paint = (el) => {
      if (!el || el.dataset.painted) return;
      const t = _tplById(el.dataset.peTplgThumb);
      if (!t) return;
      const url = _previewURL(t, state, 320);
      if (url) { el.style.backgroundImage = `url(${url})`; }
      el.dataset.painted = '1';
    };
    if (typeof IntersectionObserver === 'function') {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) { paint(e.target); io.unobserve(e.target); } });
      }, { root: panel.closest('.pe-panel') || null, rootMargin: '300px' });
      nodes.forEach(el => io.observe(el));
    } else {
      nodes.forEach(paint);
    }
  }

  function _renderGrid(panel, state) {
    const grid = panel.querySelector('[data-pe-tplg-grid]');
    if (!grid) return;
    grid.innerHTML = _gridHTML(_currentList());
    _bindCards(panel, state);
    _paintThumbs(panel, state);
  }

  function _renderPreview(panel, state) {
    const box = panel.querySelector('[data-pe-tplg-preview]');
    if (!box) return;
    const t = _selectedId ? _tplById(_selectedId) : null;
    box.innerHTML = t ? _previewHTML(t, state) : '';
    _bindPreview(panel, state);
  }

  function _bindCards(panel, state) {
    panel.querySelectorAll('[data-pe-tplg-card], .pe-tplg-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const bmk = e.target.closest('[data-pe-tplg-bmk]');
        if (bmk) {
          e.preventDefault(); e.stopPropagation();
          const lib = _LIB();
          if (lib) {
            const now = lib.toggleFav(bmk.dataset.peTplgBmk);
            bmk.classList.toggle('on', now);
            _toast(now ? '보관함에 저장했어요' : '보관함에서 뺐어요');
            if (_chip === 'library') _renderGrid(panel, state);
          }
          return;
        }
        const id = card.dataset.peTplgId;
        if (!id) return;
        _selectedId = id;
        panel.querySelectorAll('.pe-tplg-card.is-selected').forEach(c => c.classList.remove('is-selected'));
        card.classList.add('is-selected');
        _renderPreview(panel, state);
        const box = panel.querySelector('[data-pe-tplg-preview]');
        if (box && box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  }

  function _applyTemplate(id, panel, state, helpers) {
    const t = _tplById(id);
    if (!t) return;
    const isFree = t.tier !== 'pro';
    if (!isFree) {
      let paid = false;
      try { paid = typeof window.isPaidPlan === 'function' && !!window.isPaidPlan(); } catch (_e) { paid = false; }
      if (!paid) {
        _toast('Pro 템플릿은 잇데이 멤버십에서 사용할 수 있어요');
        try { if (typeof window.openPlanPopup === 'function') window.openPlanPopup(); } catch (_e) { void 0; }
        return;
      }
    }
    const api = window.PhotoEditorTemplatesV2;
    if (!api || typeof api.apply !== 'function') { _toast('템플릿을 불러오는 중이에요'); return; }
    if (state) {
      if (state.tplV2 === undefined) state.tplV2 = null;
      if (state.template) { state.template.id = null; state.secondImg = null; }
    }
    if (helpers && typeof helpers.pushHistory === 'function') helpers.pushHistory();
    api.apply(id);   // state.tplV2 세팅 + 텍스트 prefill + scheduleRedraw (라이브 캔버스 반영)
    if (_LIB()) _LIB().addRecent(id);
    _renderPreview(panel, state);   // "적용됨 ✓" 반영
  }

  function _bindPreview(panel, state) {
    const helpers = panel._tplgHelpers;
    panel.querySelector('[data-pe-tplg-apply]')?.addEventListener('click', (e) => {
      _applyTemplate(e.currentTarget.dataset.peTplgApply, panel, state, helpers);
    });
    panel.querySelector('[data-pe-tplg-all]')?.addEventListener('click', () => {
      _showAll = true; _query = '';
      const si = panel.querySelector('[data-pe-tplg-search]'); if (si) si.value = '';
      _renderGrid(panel, state);
    });
  }

  function bind(panel, state, helpers) {
    panel._tplgHelpers = helpers;
    // 검색
    const search = panel.querySelector('[data-pe-tplg-search]');
    if (search) {
      search.addEventListener('input', (e) => {
        _query = e.target.value || '';
        clearTimeout(_searchTimer);
        _searchTimer = setTimeout(() => _renderGrid(panel, state), 140);
      });
    }
    // 칩
    panel.querySelectorAll('[data-pe-tplg-chip]').forEach(btn => {
      btn.addEventListener('click', () => {
        _chip = btn.dataset.peTplgChip; _showAll = false;
        panel.querySelectorAll('[data-pe-tplg-chip]').forEach(b => b.classList.toggle('is-active', b === btn));
        _renderGrid(panel, state);
      });
    });
    _bindCards(panel, state);
    _bindPreview(panel, state);
    _paintThumbs(panel, state);
  }

  window.PhotoEditorTemplateGallery = { panelHTML, bind };
})();
