/* 사진 편집기 — 템플릿 마켓 v2 */
(function () {
  'use strict';
  if (window.PhotoEditorTemplatesV2) return;

  const MARKET_DATA = window.PhotoEditorTemplateMarketData || { CATS: [], TEMPLATES: [] };
  const CATS = MARKET_DATA.CATS;
  const TEMPLATES = MARKET_DATA.TEMPLATES;

  let _sheetEl = null;
  let _selectedCat = 'feed';
  let _searchTerm = '';

  function _esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  function _getBrandKit() {
    try {
      if (window.BrandKit && window.BrandKit.get) return window.BrandKit.get();
    } catch (_e) { /* ignore */ }
    return {
      primary: '#7b61ff', accent: '#c89a52', soft: '#f3eee4',
      shopName: '잇데이 스튜디오', logo: null,
    };
  }

  function _accentColor(accent, bk) {
    if (accent === 'gold') return bk.accent || '#c89a52';
    if (accent === 'primary') return bk.primary || '#7b61ff';
    return bk.soft || '#f3eee4';
  }

  function _ensureSheet() {
    if (_sheetEl) return _sheetEl;
    _sheetEl = document.createElement('div');
    _sheetEl.id = 'tplV2Sheet';
    _sheetEl.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:10050;display:none;flex-direction:column;';
    _sheetEl.innerHTML = `
      <header style="padding:14px 16px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #eee;">
        <button type="button" id="tpv2Close" class="pe-action-btn" style="background:#eee;">닫기</button>
        <div style="font-weight:700;flex:1;">템플릿 마켓 (30+)</div>
        <input type="search" id="tpv2Search" placeholder="검색…" style="border:1px solid #ddd;padding:6px 10px;border-radius:8px;font-size:13px;" />
      </header>
      <div id="tpv2Cats" style="padding:10px 16px;display:flex;gap:6px;overflow-x:auto;border-bottom:1px solid #eee;background:#fafafa;"></div>
      <div id="tpv2Grid" style="flex:1;overflow-y:auto;padding:14px 16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;"></div>
    `;
    document.body.appendChild(_sheetEl);
    _sheetEl.querySelector('#tpv2Close').addEventListener('click', () => { _sheetEl.style.display = 'none'; });
    _sheetEl.querySelector('#tpv2Search').addEventListener('input', (e) => { _searchTerm = e.target.value || ''; _renderGrid(); });
    return _sheetEl;
  }

  function _renderCats() {
    const cats = _sheetEl.querySelector('#tpv2Cats');
    cats.innerHTML = CATS.map(c => `
      <button type="button" class="pe-chip-btn ${_selectedCat === c.id ? 'on' : ''}" data-tpv2-cat="${c.id}">${_esc(c.label)}</button>
    `).join('');
    cats.querySelectorAll('[data-tpv2-cat]').forEach(b => {
      b.addEventListener('click', () => { _selectedCat = b.dataset.tpv2Cat; _renderCats(); _renderGrid(); });
    });
  }

  function _renderGrid() {
    const grid = _sheetEl.querySelector('#tpv2Grid');
    const bk = _getBrandKit();
    const filtered = TEMPLATES.filter(t => {
      if (t.cat !== _selectedCat) return false;
      if (!_searchTerm) return true;
      return (t.label + ' ' + (t.prefillText || '')).toLowerCase().includes(_searchTerm.toLowerCase());
    });
    if (!filtered.length) { grid.innerHTML = `<div style="grid-column:1/-1;color:#999;padding:24px;text-align:center;">검색 결과 없음</div>`; return; }
    grid.innerHTML = filtered.map(t => {
      const color = _accentColor(t.accent, bk);
      const cat = CATS.find(c => c.id === t.cat);
      const ar = cat.ratio === '9:16' ? '9 / 16' : (cat.ratio === '4:5' ? '4 / 5' : '1 / 1');
      return `
        <button type="button" class="tpv2-card" data-tpv2-tpl="${t.id}" style="border:1px solid #eee;border-radius:14px;overflow:hidden;background:#fff;cursor:pointer;padding:0;text-align:left;">
          <div style="aspect-ratio:${ar};background:linear-gradient(135deg, ${color}33, ${color});display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;text-shadow:0 1px 4px rgba(0,0,0,0.3);">${_esc(t.prefillText || t.label)}</div>
          <div style="padding:8px 10px;font-size:12px;font-weight:600;">${_esc(t.label)}</div>
        </button>
      `;
    }).join('');
    grid.querySelectorAll('[data-tpv2-tpl]').forEach(b => {
      b.addEventListener('click', () => _apply(b.dataset.tpv2Tpl));
    });
  }

  // 템플릿 적용: PhotoEditor 상태에 카드 정보 + 텍스트 레이어 prefill
  function _apply(tplId) {
    const tpl = TEMPLATES.find(t => t.id === tplId);
    if (!tpl) return;
    const cat = CATS.find(c => c.id === tpl.cat);
    const bk = _getBrandKit();
    const PE = window.PhotoEditor;
    if (!PE || !PE._internal) { _toast('편집기를 먼저 열어주세요'); return; }
    const state = PE._internal.getState();
    if (!state) return;
    // 비율 설정
    state.ratio = cat.ratio;
    state.tplV2 = {
      id: tpl.id,
      label: tpl.label,
      bg: _accentColor(tpl.accent, bk),
      shopName: bk.shopName,
      logo: bk.logo,
      cat: cat.id,
    };
    // 텍스트 레이어 prefill
    if (window.PhotoEditorLayers && window.PhotoEditorLayers.ensure) {
      window.PhotoEditorLayers.ensure(state);
      const active = state.layers && state.layers.find(l => l.id === state.activeLayerId);
      if (active) {
        active.value = tpl.prefillText;
        active.color = '#ffffff';
        active.size = (cat.ratio === '9:16' ? 9 : 7);
        active.bg = true;
      }
    }
    if (PE._internal.helpers && PE._internal.helpers.scheduleRedraw) PE._internal.helpers.scheduleRedraw();
    if (PE._internal.helpers && PE._internal.helpers.pushHistory) PE._internal.helpers.pushHistory();
    _toast('템플릿 적용: ' + tpl.label);
    if (_sheetEl) _sheetEl.style.display = 'none';
  }

  function _toast(msg) {
    if (window.toast) window.toast(msg);
    else if (window.PhotoEditor && window.PhotoEditor._internal && window.PhotoEditor._internal.helpers && window.PhotoEditor._internal.helpers.toast) {
      window.PhotoEditor._internal.helpers.toast(msg);
    }
  }

  function _open(initialCat) {
    _ensureSheet();
    if (initialCat) _selectedCat = initialCat;
    _renderCats();
    _renderGrid();
    _sheetEl.style.display = 'flex';
  }

  // MutationObserver — 템플릿 탭 활성일 때마다 버튼 주입
  function _inject(panel) {
    if (!panel || panel.querySelector('[data-pe-tplv2]')) return;
    const PE = window.PhotoEditor;
    const state = PE && PE._internal && PE._internal.getState();
    if (!state || state.activeTab !== 'template') return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pe-action-btn';
    btn.dataset.peTplv2 = '1';
    btn.style.cssText = 'margin-top:12px;background:linear-gradient(135deg,#7b61ff,#5b8def);color:#fff;font-weight:600;width:100%;';
    btn.textContent = '✨ 더 많은 템플릿 (30+) — 카테고리·검색';
    btn.addEventListener('click', () => _open());
    panel.appendChild(btn);
  }

  function _watchPanel() {
    const sheet = document.getElementById('photoEditorSheet');
    const panel = sheet && sheet.querySelector('#pePanel');
    if (!panel) {
      setTimeout(_watchPanel, 800);
      return;
    }
    _inject(panel);
    new MutationObserver(() => _inject(panel)).observe(panel, { childList: true });
    _registerDrawHook();
  }

  function _registerDrawHook() {
    const PE = window.PhotoEditor;
    if (!PE || !PE._internal || !PE._internal.registerDrawHook) {
      setTimeout(_registerDrawHook, 500);
      return;
    }
    PE._internal.registerDrawHook('tplV2_overlay', (ctx, dw, dh, state) => {
      const tpl = state && state.tplV2;
      if (!tpl) return;
      const t = TEMPLATES.find(x => x.id === tpl.id);
      if (!t) return;
      window.PhotoEditorTemplateOverlay?.draw?.(ctx, dw, dh, t, tpl);
    });
  }

  window.PhotoEditorTemplatesV2 = { open: _open, apply: _apply, TEMPLATES, CATS };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _watchPanel);
  } else _watchPanel();
})();
