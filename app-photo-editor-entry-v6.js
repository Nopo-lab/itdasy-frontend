/* 사진편집 진입 화면 v6 — Meitu grammar (2026-05-20)
   설계: DESIGN_SYSTEM.md (uploads) §3 + §4 (4 화면 흐름)
   역할:
     PhotoEditor.open() 호출 → 기존 dark 에디터 시트 위에 라이트 진입 화면 오버레이
     사용자가 카드 탭 → 진입 오버레이 숨김 + 기존 에디터 탭 활성화
   기존 코드 영향 없음 — 새 DOM 노드 + 기존 탭 버튼을 프로그래매틱 클릭.
*/
(function () {
  'use strict';

  const ENTRY_ID = 'photoEditorEntryV6';
  let _wrapped = false;
  let _backBound = false;
  let _origOpen = null;
  let _origOpenFromAction = null;
  let _pendingCardAfterPick = null;
  let _openSeq = 0;
  let _featureSeq = -1;

  // ── Lucide SVG (DESIGN_SYSTEM 의 ti-* 아이콘을 인라인 SVG 로 — 외부 폰트 의존 제거) ──
  // index.html 의 ic-* 스프라이트가 있으면 그걸 써도 됨. 우선 inline 으로 시작.
  const ICONS = {
    'wand':       '<svg viewBox="0 0 24 24"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M15 9h0M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5"/></svg>',
    'sparkles':   '<svg viewBox="0 0 24 24"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4M22 5h-4M4 17v2M5 18H3"/></svg>',
    'eraser':     '<svg viewBox="0 0 24 24"><path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21M5.082 11.09 8.99 15"/></svg>',
    'crop':       '<svg viewBox="0 0 24 24"><path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2"/></svg>',
    'resize':     '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 21V9h12"/></svg>',
    'typography': '<svg viewBox="0 0 24 24"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>',
    'adjustments':'<svg viewBox="0 0 24 24"><circle cx="6" cy="10" r="2"/><path d="M6 4v4M6 12v8"/><circle cx="12" cy="16" r="2"/><path d="M12 4v10M12 18v2"/><circle cx="18" cy="7" r="2"/><path d="M18 4v1M18 9v11"/></svg>',
    'color-filter':'<svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="6"/><circle cx="15" cy="15" r="6"/></svg>',
    'droplet':    '<svg viewBox="0 0 24 24"><path d="M12 2.69 5.66 9.04a8 8 0 1 0 12.68 0Z"/></svg>',
    'sticker':    '<svg viewBox="0 0 24 24"><path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6M10 14a3.5 3.5 0 0 0 5 0"/><path d="M9 10h.01M15 10h.01"/></svg>',
    'frame':      '<svg viewBox="0 0 24 24"><path d="M22 6 6 22M22 18 6 2M2 6h20M2 18h20"/></svg>',
    'arrows-lr':  '<svg viewBox="0 0 24 24"><path d="m21 7-4-4-4 4M17 3v18M3 17l4 4 4-4M7 21V3"/></svg>',
    'stack':      '<svg viewBox="0 0 24 24"><path d="m12 2 9 4.5-9 4.5L3 6.5 12 2zM21 12l-9 4.5L3 12M21 17.5l-9 4.5-9-4.5"/></svg>',
    'bookmark':   '<svg viewBox="0 0 24 24"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>',
    'heart-fill': '<svg viewBox="0 0 24 24" fill="#FF3366" stroke="none"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
    'history':    '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l4 2"/></svg>',
    'close':      '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  };
  function _ic(name) { return '<span class="pe-ic">' + (ICONS[name] || '') + '</span>'; }
  function _circleIc(name) { return ICONS[name] || ''; }

  // ── 카드 → 기존 탭 매핑 ──────────────────────────
  const CARD_TO_TAB = {
    'auto':     'auto',
    'film':     'film',
    'bg':       'bg',
    'detail':   'beauty',
    'retouch':  'brush',
    'save':     'export',
    'crop':     'export',
    'tune':     'tune',
    'relight':  'relight',
    'hair':     'beauty',
    'export':   'export',
    'text':     'text',
    'brand':    'brand',
    'brush':    'brush',
    'template': 'template',
    'pro':      'pro',
    'ba':       'ba',
  };
  const TAB_TO_CARD = {
    auto: 'auto',
    tune: 'tune',
    beauty: 'detail',
    brush: 'retouch',
    selective: 'retouch',
    pro: 'pro',
    relight: 'relight',
    film: 'film',
    bg: 'bg',
    template: 'template',
    text: 'text',
    brand: 'brand',
    export: 'save',
    ba: 'ba',
  };
  const CARD_LABELS = {
    auto: '빠른 자동보정',
    film: '톤·필터',
    relight: '조명',
    hair: '헤어 디테일',
    detail: '디테일',
    retouch: '잡티 지우기',
    save: '저장',
    bg: '배경·누끼',
    crop: '자르기',
    tune: '수동 보정',
    export: '사이즈',
    text: '텍스트',
    brand: '브랜드',
    brush: '잡티',
    template: '홍보 템플릿',
    pro: '고급',
    ba: '비포/애프터',
  };

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  function _buildHeader() {
    return `<div class="pe-entry-hd">
        <h1>사진 편집</h1>
        <div class="pe-entry-actions">
          <button type="button" class="pe-entry-btn ghost" data-pev6-act="history" aria-label="기록">${_ic('history')}</button>
          <button type="button" class="pe-entry-btn dark" data-pev6-act="close" aria-label="닫기">${_ic('close')}</button>
        </div>
      </div>`;
  }
  function _buildCanvas(state) {
    const hasImg = !!(state && state.originalImg && state.originalImg.src);
    const previewSrc = hasImg ? state.originalImg.src : '';
    return `<div class="pe-entry-canvas ${hasImg ? '' : 'empty'}">
        ${hasImg ? `<img src="${_esc(previewSrc)}" alt="편집 사진">` : ''}
        <button type="button" class="pe-entry-pickbtn" data-pev6-act="pick">${hasImg ? '다른 사진' : '사진 고르기'}</button>
      </div>`;
  }
  function _buildLargeCards() {
    return `<div class="pe-sec-hd">빠르게 끝내기</div>
      <div class="pe-card-grid-l">
        <button type="button" class="pe-card-l" data-pev6-card="auto">
          <span class="pe-badge ai" style="top:10px;right:10px">즉시</span>
          ${_ic('wand')}
          <div><div class="pe-title">빠른 자동보정</div><div class="pe-sub">밝기 · 컬러 · 잡티</div></div>
        </button>
        <button type="button" class="pe-card-l" data-pev6-card="film">
          ${_ic('sparkles')}
          <div><div class="pe-title">톤·필터</div><div class="pe-sub">살롱톤 · 네일샷</div></div>
        </button>
      </div>`;
  }
  function _buildMediumCards() {
    return `<div class="pe-card-grid-m">
        <button type="button" class="pe-card-m" data-pev6-card="bg">${_ic('eraser')}<div class="pe-title">배경·누끼</div></button>
        <button type="button" class="pe-card-m" data-pev6-card="detail">${_ic('adjustments')}<div class="pe-title">디테일</div></button>
        <button type="button" class="pe-card-m" data-pev6-card="text">${_ic('typography')}<div class="pe-title">텍스트</div></button>
        <button type="button" class="pe-card-m" data-pev6-card="save">
          <span class="pe-badge hot">Hot</span>${_ic('resize')}<div class="pe-title">저장</div>
        </button>
      </div>`;
  }
  function _toolItem(card, icon, label, badgeAi) {
    const badge = badgeAi ? '<span class="pe-badge ai">AI</span>' : '';
    return `<button type="button" class="pe-tool" data-pev6-card="${card}">
        <div class="pe-tool-circle">${_circleIc(icon)}${badge}</div>
        <span class="pe-tool-label">${label}</span>
      </button>`;
  }
  function _buildTools() {
    return `<div class="pe-sec-hd">자세히</div>
      <div class="pe-card-grid-tools">
        ${_toolItem('tune', 'adjustments', '수동 보정', false)}
        ${_toolItem('relight', 'sparkles', '조명', false)}
        ${_toolItem('retouch', 'droplet', '잡티', false)}
        ${_toolItem('template', 'frame', '템플릿', false)}
        ${_toolItem('ba', 'arrows-lr', '전후', false)}
        ${_toolItem('hair', 'stack', '헤어', false)}
        ${_toolItem('brand', 'sticker', '브랜드', false)}
        ${_toolItem('pro', 'bookmark', '고급', false)}
      </div>`;
  }
  function _buildFav() {
    return '';
  }
  function _buildPresetCards(state) {
    if (window.PhotoEditorPresetCards && typeof window.PhotoEditorPresetCards.entryHTML === 'function') {
      return window.PhotoEditorPresetCards.entryHTML(state);
    }
    return '';
  }
  function _buildHTML(state) {
    return _buildHeader() + _buildCanvas(state) + _buildPresetCards(state) + _buildLargeCards()
      + _buildMediumCards() + _buildTools() + _buildFav();
  }

  function _ensureEntry() {
    const sheet = document.getElementById('photoEditorSheet');
    if (!sheet) return null;
    let entry = document.getElementById(ENTRY_ID);
    if (entry) return entry;
    entry = document.createElement('div');
    entry.id = ENTRY_ID;
    entry.className = 'pe-entry-v6';
    sheet.appendChild(entry);
    entry.addEventListener('click', _onClick);
    return entry;
  }

  function _onClick(e) {
    const actBtn = e.target.closest('[data-pev6-act]');
    if (actBtn) {
      const a = actBtn.dataset.pev6Act;
      if (a === 'close') {
        // PhotoEditor.close() 호출 — 미저장 경고 등 그대로 동작
        if (window.PhotoEditor && typeof window.PhotoEditor.close === 'function') window.PhotoEditor.close();
        return;
      }
      if (a === 'pick') {
        const picker = document.getElementById('pePicker');
        if (picker) picker.click();
        return;
      }
      if (a === 'history') {
        // 기록(되돌리기) — 기존 에디터 탭으로 진입한 뒤 ⤺ 버튼 클릭
        _gotoEditor('auto');
        setTimeout(() => {
          const undo = document.querySelector('#photoEditorSheet [data-pe-act="undo"]');
          if (undo) undo.click();
        }, 50);
        return;
      }
    }
    const presetBtn = e.target.closest('[data-pe-preset]');
    if (presetBtn) {
      if (!_hasImage()) { _pickThenOpen('auto'); return; }
      if (window.PhotoEditorPresetCards?.apply?.(presetBtn.dataset.pePreset)) _gotoEditor('auto', 'auto');
      return;
    }
    const cardBtn = e.target.closest('[data-pev6-card]');
    if (cardBtn) _openCard(cardBtn.dataset.pev6Card);
  }

  function _state() {
    try { return window.PhotoEditor?._internal?.getState?.(); }
    catch (_e) { return null; }
  }

  function _hasImage() {
    const st = _state();
    return !!(st && st.originalImg && st.originalImg.src);
  }

  function _pickThenOpen(cardKey) {
    _pendingCardAfterPick = cardKey || 'auto';
    const picker = document.getElementById('pePicker');
    if (picker) picker.click();
  }

  function _openCard(cardKey) {
    if (!_hasImage()) { _pickThenOpen(cardKey); return; }
    _gotoEditor(CARD_TO_TAB[cardKey] || 'auto', cardKey);
  }

  function _hideEntry() {
    const sheet = document.getElementById('photoEditorSheet');
    const entry = document.getElementById(ENTRY_ID);
    if (entry) entry.classList.add('hidden');
    if (sheet) sheet.classList.remove('pe-has-entry-v6');
  }

  function _showEntry() {
    const sheet = document.getElementById('photoEditorSheet');
    const entry = _ensureEntry();
    if (!entry || !sheet) return;
    _setFeatureMode(sheet, false);
    // PhotoEditor 내부 상태에서 현재 사진 미리보기용 src 가져옴
    let state = null;
    try { state = window.PhotoEditor && window.PhotoEditor._internal && window.PhotoEditor._internal.getState(); }
    catch (_e) { state = null; }
    entry.innerHTML = _buildHTML(state || {});
    entry.classList.remove('hidden');
    sheet.classList.add('pe-has-entry-v6');
  }

  function _setFeatureTitle(sheet, cardKey) {
    const title = sheet.querySelector('.pe-title');
    const backLabel = sheet.querySelector('.pe-back-label');
    const backBtn = sheet.querySelector('[data-pe-act="close"]');
    if (title) title.textContent = '사진 편집 · ' + (CARD_LABELS[cardKey] || '편집');
    if (backLabel) backLabel.textContent = '메뉴';
    if (backBtn) backBtn.setAttribute('aria-label', '사진편집 메뉴로 돌아가기');
  }

  function _setFeatureMode(sheet, on, cardKey) {
    if (!sheet) return;
    sheet.classList.toggle('pe-v6-feature-mode', !!on);
    if (on) {
      sheet.dataset.pev6Feature = cardKey || 'auto';
      _setFeatureTitle(sheet, cardKey);
    } else {
      delete sheet.dataset.pev6Feature;
      const title = sheet.querySelector('.pe-title');
      const backLabel = sheet.querySelector('.pe-back-label');
      const backBtn = sheet.querySelector('[data-pe-act="close"]');
      if (title) title.textContent = '사진 편집기';
      if (backLabel) backLabel.textContent = '뒤로';
      if (backBtn) backBtn.setAttribute('aria-label', '편집기 닫고 뒤로가기');
    }
  }

  function _backToMenu() {
    const sheet = document.getElementById('photoEditorSheet');
    if (!sheet || sheet.style.display === 'none') return false;
    _showEntry();
    return true;
  }

  function _gotoEditor(tabId, cardKey) {
    const sheet = document.getElementById('photoEditorSheet');
    _featureSeq = _openSeq;
    try {
      const st = _state();
      if (st) st.beautyFocus = cardKey === 'hair' ? 'hair' : null;
    } catch (_e) { void _e; }
    _setFeatureMode(sheet, true, cardKey || tabId);
    _hideEntry();
    // 기존 탭 버튼 클릭 — 핸들러 그대로 동작
    setTimeout(() => {
      const tabBtn = document.querySelector('#peTabs [data-pe-tab="' + tabId + '"]');
      if (tabBtn) tabBtn.click();
    }, 0);
  }

  function _bindFeatureBack() {
    if (_backBound) return;
    document.addEventListener('click', (e) => {
      const closeBtn = e.target.closest && e.target.closest('#photoEditorSheet.pe-v6-feature-mode [data-pe-act="close"]');
      if (!closeBtn) return;
      e.preventDefault();
      e.stopPropagation();
      _backToMenu();
    }, true);
    _backBound = true;
  }

  function _refreshEntryIfVisible() {
    const sheet = document.getElementById('photoEditorSheet');
    if (_pendingCardAfterPick && _hasImage()) {
      const card = _pendingCardAfterPick;
      _pendingCardAfterPick = null;
      _gotoEditor(CARD_TO_TAB[card] || 'auto', card);
      return;
    }
    if (sheet && sheet.classList.contains('pe-has-entry-v6')) _showEntry();
  }

  function _showAfterOpen(opts, seq) {
    const tab = opts && opts.initial_tab;
    if (!tab && _featureSeq === seq) return;
    if (!tab) { _showEntry(); return; }
    const sheet = document.getElementById('photoEditorSheet');
    if (!sheet) return;
    _ensureEntry();
    _hideEntry();
    _setFeatureMode(sheet, true, TAB_TO_CARD[tab] || tab || 'auto');
  }

  function _scheduleAfterOpen(opts) {
    const seq = ++_openSeq;
    requestAnimationFrame(() => { try { _showAfterOpen(opts || {}, seq); } catch (_e) { void _e; } });
    setTimeout(() => { try { _showAfterOpen(opts || {}, seq); } catch (_e) { void _e; } }, 220);
    setTimeout(() => { try { _showAfterOpen(opts || {}, seq); } catch (_e) { void _e; } }, 700);
  }

  function _wrapOpen() {
    if (_wrapped) return;
    if (!window.PhotoEditor || typeof window.PhotoEditor.open !== 'function') return;
    _origOpen = window.PhotoEditor.open;
    _origOpenFromAction = window.PhotoEditor.openFromAction;
    window.PhotoEditor.open = function (opts) {
      const ret = _origOpen.call(window.PhotoEditor, opts || {});
      try { _scheduleAfterOpen(opts || {}); } catch (_e) { void _e; }
      _bindFeatureBack();
      return ret;
    };
    if (typeof _origOpenFromAction === 'function') {
      window.PhotoEditor.openFromAction = function (payload) {
        const ret = _origOpenFromAction.call(window.PhotoEditor, payload || {});
        try { _scheduleAfterOpen(payload || {}); } catch (_e) { void _e; }
        _bindFeatureBack();
        return ret;
      };
    }
    _wrapped = true;
    _bindFeatureBack();
  }

  function _boot() {
    if (window.PhotoEditor) { _wrapOpen(); return; }
    let tries = 0;
    const iv = setInterval(() => {
      if (window.PhotoEditor || ++tries > 80) {
        clearInterval(iv);
        _wrapOpen();
      }
    }, 80);
  }

  // 외부 접근용
  window.PhotoEditorEntryV6 = {
    show: _showEntry,
    hide: _hideEntry,
    refresh: _refreshEntryIfVisible,
    goto: _gotoEditor,
    backToMenu: _backToMenu,
    isFeatureMode: () => {
      const sheet = document.getElementById('photoEditorSheet');
      return !!(sheet && sheet.classList.contains('pe-v6-feature-mode'));
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    _boot();
  }
})();
