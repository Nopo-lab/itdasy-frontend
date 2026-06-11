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
    ['recommend', '추천'], ['library', '보관함'],   // [P1b] 보관함을 앞쪽으로 — 발견성 개선
    ['ba', '전후'], ['price', '가격표'], ['story', '스토리'],
    ['feed', '피드'], ['review', '후기'], ['event', '이벤트'],
    ['premium', '프리미엄팩'],   // [BP-4] 뷰티 팩 묶음 칩
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
  const _STAR_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
  // 잇비 자동적용 기본 지정 가능한 purpose 3종 (보관함/최근은 자동적용 미반영).
  const DEFAULT_PURPOSES = ['price', 'review', 'before_after'];
  function _defaultIdFor(purpose) {
    const lib = _LIB();
    if (!lib || typeof lib.getDefault !== 'function' || DEFAULT_PURPOSES.indexOf(purpose) === -1) return '';
    return lib.getDefault(purpose) || '';
  }
  // [기본] purpose 별 기본 템플릿 지정/해제 — 잇비 자동적용이 이 템플릿을 최우선 사용. 썸네일 배지 탭에서 호출.
  function _toggleDefault(id, purpose, panel, state) {
    const lib = _LIB();
    if (!lib || typeof lib.setDefault !== 'function' || !id || !purpose) return;
    const label = SHORT_PURPOSE[purpose] || '';
    if (lib.getDefault(purpose) === id) {
      lib.clearDefault(purpose);
      _toast(`${label} 기본 지정을 해제했어요`);
    } else {
      lib.setDefault(purpose, id);
      _toast(`잇비가 ${label}를 만들 때 이 템플릿을 써요`);
    }
    _renderGrid(panel, state);                              // 카드 "기본" 배지 갱신(같은 purpose 다른 카드도 해제됨)
    if (_selectedId) _renderPreview(panel, state);          // 선택 미리보기도 일관 유지
  }

  function _esc(s) { return window._esc(s); } /* [2026-06-11] 중복 제거 — app-core 정본 위임 */
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
  // [V3-4b] 노출=visibleTemplates(기본 v3 TOP5만), 조회=lookupById(v3+legacy 전체).
  function _visible() { const MD = _MD(); return MD.visibleTemplates ? MD.visibleTemplates() : MD.TEMPLATES.slice(); }
  // 조회는 전체(보관함/legacy 저장본 유지) — lookupById 우선, 없으면 기존 동작.
  function _tplById(id) { const MD = _MD(); return (MD.lookupById ? MD.lookupById(id) : (MD.TEMPLATES.find(t => t.id === id) || null)); }

  function _recommendList() {
    // [V3-4b] 추천도 visible 기준 — 기본은 v3 TOP5(free 우선) 12개 이내.
    const vis = _visible();
    const free = vis.filter(t => t.tier !== 'pro');
    return (free.length ? free : vis).slice(0, 12);
  }

  function _chipMatch(chip, t) {
    switch (chip) {
      case 'ba': return t.cat === 'ba' || t.purpose === 'before_after';
      case 'price': return t.cat === 'price' || t.purpose === 'price';
      case 'story': return t.cat === 'story';
      case 'feed': return t.cat === 'feed' || t.purpose === 'feed';
      case 'review': return t.purpose === 'review';
      case 'event': return t.cat === 'event' || t.purpose === 'event';
      case 'premium': return /^bp-/.test(t.id);   // [BP-4] 프리미엄팩 = 뷰티 팩(bp-*) 묶음
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
    let base;
    if (_chip === 'library') {
      // [V3-4b] 보관함은 조회=lookupById(전체) → legacy favorite/recent 유지 표시.
      const lib = _LIB();
      const ids = lib ? lib.listAll() : [];
      base = ids.map(_tplById).filter(Boolean);
    } else if (_showAll) {
      base = _visible();
    } else if (_chip === 'recommend') {
      // [V3-4b] 검색어 있어도 visible 기준 → legacy 비노출(검색 누출 없음).
      base = _query ? _visible() : _recommendList();
    } else {
      base = _visible().filter(t => _chipMatch(_chip, t));
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
  // djb2 해시(문자열 → 짧은 키). 편집 시 slotValues 변경 감지용.
  function _hash(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  function _imageSlotsSig(imageSlots) {
    if (!imageSlots) return '';
    return Object.keys(imageSlots).sort().map((key) => {
      const slot = imageSlots[key] || {};
      const src = slot.src || '';
      return key + ':' + src.length + ':' + src.slice(0, 24) + ':' + src.slice(-24);
    }).join('|');
  }

  // 렌더 실패/사진 미로드 폴백 썸네일 — 빈칸 대신 살롱톤 그래디언트 dataURL 반환.
  function _fallbackThumb(dim, color) {
    try {
      const cv = document.createElement('canvas');
      cv.width = dim.w; cv.height = dim.h;
      const ctx = cv.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, dim.w, dim.h);
      g.addColorStop(0, '#f3e9ea'); g.addColorStop(1, color);
      ctx.fillStyle = g; ctx.fillRect(0, 0, dim.w, dim.h);
      return cv.toDataURL('image/jpeg', 0.8);
    } catch (_e) { return ''; }
  }

  // [TH-fix] 전후(BA) 템플릿은 '시술 전' 사진이 없으면 before 칸을 빈 "＋사진" 박스로 그려 썸네일이
  //   전부 똑같이 깨져 보임(중복 착시). 작은 썸네일(basePx≤480)에 한해 현재 사진을 대표 before 로 채워
  //   실제 레이아웃이 보이게 한다. 큰 미리보기/실제 적용은 정직(placeholder) 유지.
  function _thumbSecond(t, state, basePx, photo) {
    const realSecond = state && state.secondImg;
    const isBA = t.purpose === 'before_after' || t.kind === 'before_after' || /(^|-)ba-/.test(t.id);
    return (basePx <= 480 && isBA && !realSecond && photo) ? photo : realSecond;
  }

  function _previewURL(t, state, basePx) {
    const sig = _photoSig(state);
    // [S2] 현재 적용 템플릿이면 slotValues 서명을 키에 포함(편집 시 stale 방지).
    const cur = state && state.tplV2;
    const slotSig = (cur && cur.id === t.id && cur.slotValues) ? '|' + _hash(JSON.stringify(cur.slotValues)) : '';
    const imageSig = (cur && cur.id === t.id && cur.imageSlots) ? '|' + _hash(_imageSlotsSig(cur.imageSlots)) : '';
    const key = t.id + '|' + basePx + '|' + sig + slotSig + imageSig;
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
      if (cur && cur.id === t.id && cur.imageSlots) tplV2.imageSlots = cur.imageSlots;
      const synth = {
        tplV2, originalImg: photo, secondImg: _thumbSecond(t, state, basePx, photo),
        shopName: state && state.shopName, serviceName: state && state.serviceName, price: state && state.price,
      };
      const PT = window.PhotoEditorPremiumTemplates;
      if (PT && PT.renderHook) PT.renderHook(ctx, dim.w, dim.h, synth);
      else if (/^ba-/.test(t.id) && window.PhotoEditorBACompose) window.PhotoEditorBACompose.draw(ctx, dim.w, dim.h, synth, tplV2, {});
      else if (window.PhotoEditorTemplateOverlay) window.PhotoEditorTemplateOverlay.draw(ctx, dim.w, dim.h, t, tplV2);
      url = cv.toDataURL('image/jpeg', basePx > 480 ? 0.86 : 0.8);
    } catch (_e) { url = ''; }
    // 렌더 실패 시 빈/깨진 박스 대신 살롱톤 그래디언트(주석 계약 "실패 없이 항상 dataURL" 복원).
    if (!url) url = _fallbackThumb(dim, color);
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
    const canDefault = DEFAULT_PURPOSES.indexOf(t.purpose) !== -1 && !!t.id;
    const isDefault = canDefault && _defaultIdFor(t.purpose) === t.id;
    const purposeLabel = SHORT_PURPOSE[t.purpose] || '';
    const sel = (t.id === _selectedId) ? ' is-selected' : '';
    // [기본] 썸네일 좌하단 탭=토글 배지 — 지정되면 노란 "기본", 아니면 별만 보이는 흐린 토글(탭 시 지정).
    const defaultBadge = canDefault
      ? `<span class="pe-tplg-default-badge${isDefault ? ' on' : ''}" data-pe-tplg-default="${_esc(t.id)}" data-pe-tplg-default-purpose="${_esc(t.purpose)}" role="button" aria-pressed="${isDefault ? 'true' : 'false'}" aria-label="${_esc(purposeLabel)} 기본 템플릿${isDefault ? ' (지정됨, 탭하면 해제)' : '으로 지정'}">${_STAR_SVG}${isDefault ? '<span class="pe-tplg-default-txt">기본</span>' : ''}</span>`
      : '';
    return `<button type="button" class="pe-tplg-card${sel}" data-pe-tplg-id="${_esc(t.id)}">
      <div class="pe-tplg-thumb" data-pe-tplg-thumb="${_esc(t.id)}">
        <span class="pe-tplg-badge">${_esc(badge)}</span>
        ${/^bp-/.test(t.id) ? '<span class="pe-tplg-premium" style="position:absolute;top:8px;left:8px;z-index:3;background:linear-gradient(135deg,#E7CE8C,#C9A24B);color:#1B140A;font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;letter-spacing:.4px;box-shadow:0 1px 4px rgba(0,0,0,.18);">프리미엄</span>' : ''}
        ${isFree ? '' : '<span class="pe-tplg-pro">PRO</span>'}
        ${defaultBadge}
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
          <p>마음에 드는 템플릿 카드의 오른쪽 아래 북마크를 누르면 여기에 모여요.</p></div>`;
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
    // [기본] 기본 지정은 썸네일 카드의 "기본" 배지 탭으로 일원화 → 미리보기 토글 버튼 제거.
    return `<div class="pe-tplg-preview-inner">
      <div class="pe-tplg-preview-canvas" style="aspect-ratio:${ar};${url ? `background-image:url(${url});` : ''}"></div>
      <div class="pe-tplg-preview-meta"><strong>${_esc(t.label)}</strong>${isFree ? '' : '<span class="pe-tplg-pro">PRO</span>'}</div>
      <div class="pe-tplg-selected-actions">
        <button type="button" class="pe-tplg-primary" data-pe-tplg-apply="${_esc(t.id)}">${applied ? '적용됨 ✓' : (isFree ? '이 템플릿 적용' : 'Pro로 적용')}</button>
        <button type="button" class="pe-tplg-secondary" data-pe-tplg-all>전체 템플릿 보기</button>
      </div>
      <button type="button" class="pe-tplg-edit" data-pe-tplg-text-edit="${_esc(t.id)}">문구 편집</button>
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
    // 성공(비어있지 않은 url) 시에만 painted 마킹/관측 해제 → 일시적 렌더 실패가 빈칸으로 고정되지 않음.
    const paint = (el) => {
      if (!el || el.dataset.painted) return true;
      const t = _tplById(el.dataset.peTplgThumb);
      if (!t) return true;
      const url = _previewURL(t, state, 320);
      if (url) { el.style.backgroundImage = `url(${url})`; el.dataset.painted = '1'; return true; }
      return false;
    };
    if (typeof IntersectionObserver === 'function') {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting && paint(e.target)) io.unobserve(e.target); });
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
        // [기본] 썸네일 기본 배지 탭 = 잇비 자동적용 기본 템플릿 지정/해제(카드 선택 막음).
        const dflt = e.target.closest('[data-pe-tplg-default]');
        if (dflt) {
          e.preventDefault(); e.stopPropagation();
          _toggleDefault(dflt.dataset.peTplgDefault, dflt.dataset.peTplgDefaultPurpose, panel, state);
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
    // [기본] 지정/해제는 썸네일 카드 "기본" 배지 탭(_bindCards)에서 처리 — 미리보기 토글 버튼 제거됨.
    // [S2] 문구 편집 — apply-first(WYSIWYG): 먼저 적용(무료) 또는 게이트(PRO 미결제) → 시트 오픈.
    panel.querySelector('[data-pe-tplg-text-edit]')?.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.peTplgTextEdit;
      _applyTemplate(id, panel, state, panel._tplgHelpers);
      if (!(state.tplV2 && state.tplV2.id === id)) return;   // 게이트 차단 시 시트 안 엶
      const sheet = window.PhotoEditorTemplateEditSheet;
      if (!sheet || typeof sheet.open !== 'function') { _toast('문구 편집을 불러오는 중이에요'); return; }
      sheet.open({ templateId: id, templateData: _tplById(id), state: state, helpers: panel._tplgHelpers, onChange: () => _renderPreview(panel, state) });
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
