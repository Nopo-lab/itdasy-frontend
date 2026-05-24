/* 사진 편집기 — 시술 프리셋 선택 텍스트 */
(function () {
  'use strict';

  const PICKER_ID = 'peServicePicker';
  const STYLE_ID = 'peServicePickerStyle';

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }
  function _toast(msg) { if (window.showToast) window.showToast(msg); }
  function _price(n) {
    const v = Number(n) || 0;
    if (!v) return '가격 문의';
    return v >= 10000 && v % 10000 === 0 ? (v / 10000) + '만원' : v.toLocaleString('ko-KR') + '원';
  }
  function _internal() { return window.PhotoEditor && window.PhotoEditor._internal; }
  function _state() { try { return _internal()?.getState?.() || null; } catch (e) { console.warn('[pe-service] 상태 확인 실패', e); return null; } }

  async function _loadServices() {
    let list = Array.isArray(window._serviceTemplatesCache) ? window._serviceTemplatesCache : [];
    if (!list.length && typeof window.loadServiceTemplates === 'function') {
      try { list = await window.loadServiceTemplates(); }
      catch (e) { console.warn('[pe-service] 시술 프리셋 로드 실패', e); }
    }
    if (!list.length) {
      try { list = JSON.parse(localStorage.getItem('itdasy_service_templates_cache') || '[]'); }
      catch (e) { console.warn('[pe-service] 저장된 시술 프리셋 읽기 실패', e); }
    }
    return (Array.isArray(list) ? list : []).filter(s => s && s.name);
  }

  function _ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `
      .pe-svc-picker{position:absolute;inset:auto 12px 12px;z-index:40;background:#fff;color:#191f28;border:1px solid rgba(25,31,40,.08);border-radius:18px;box-shadow:0 18px 42px rgba(15,23,42,.22);padding:14px;max-height:min(70vh,520px);display:flex;flex-direction:column;gap:10px}
      .pe-svc-picker h3{font-size:17px;line-height:1.25;margin:0;color:#191f28}
      .pe-svc-picker p{font-size:12px;line-height:1.45;margin:2px 0 0;color:#6b7280}
      .pe-svc-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
      .pe-svc-close{width:34px;height:34px;border-radius:999px;border:1px solid #e5e7eb;background:#f9fafb;color:#111827;font-size:20px;line-height:1;cursor:pointer}
      .pe-svc-search{width:100%;border:1px solid #e5e7eb;border-radius:12px;padding:11px 12px;font-size:14px;outline:none;background:#f9fafb}
      .pe-svc-list{display:grid;gap:8px;overflow:auto;padding-right:2px}
      .pe-svc-item{border:1px solid #edf0f3;background:#fff;border-radius:14px;padding:11px 12px;text-align:left;display:flex;justify-content:space-between;gap:12px;align-items:center;cursor:pointer}
      .pe-svc-name{font-size:14px;font-weight:800;color:#191f28;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .pe-svc-meta{font-size:11px;color:#8b95a1;margin-top:3px}
      .pe-svc-price{font-size:14px;font-weight:900;color:#BC6675;white-space:nowrap}
      .pe-svc-empty{padding:18px;border:1px dashed #d8dde4;border-radius:14px;text-align:center;color:#6b7280;font-size:13px;line-height:1.5}
      .pe-svc-manage{border:none;background:#191f28;color:#fff;border-radius:12px;padding:11px 14px;font-size:13px;font-weight:800;cursor:pointer}
    `;
    document.head.appendChild(st);
  }

  function _apply(mode, svc) {
    const st = _state();
    if (!st || !svc) return;
    st.serviceName = svc.name || '';
    st.price = Number(svc.default_price) || 0;
    const text = mode === 'price' ? _price(st.price) : st.serviceName;
    const api = _internal();
    if (api && typeof api.applyStatePatch === 'function') api.applyStatePatch({ text: { value: text } });
    _close();
    _toast(mode === 'price' ? '가격을 넣었어요' : '시술명을 넣었어요');
  }

  function _rows(list, mode, q) {
    const needle = String(q || '').trim().toLowerCase();
    const shown = list.filter(s => !needle || String(s.name || '').toLowerCase().includes(needle)).slice(0, 50);
    if (!shown.length) return '<div class="pe-svc-empty">맞는 시술이 없어요. 시술 프리셋에서 먼저 추가해 주세요.</div>';
    return shown.map((s, i) => `
      <button type="button" class="pe-svc-item" data-pe-svc-i="${i}" data-pe-svc-name="${_esc(s.name)}">
        <span style="min-width:0"><span class="pe-svc-name">${_esc(s.name)}</span><span class="pe-svc-meta">${mode === 'price' ? '가격 텍스트로 넣기' : '시술명 텍스트로 넣기'}</span></span>
        <span class="pe-svc-price">${_esc(_price(s.default_price))}</span>
      </button>`).join('');
  }

  function _render(mode, list) {
    const sheet = document.getElementById('photoEditorSheet');
    if (!sheet) return;
    _ensureStyle(); _close();
    const box = document.createElement('div');
    box.id = PICKER_ID;
    box.className = 'pe-svc-picker';
    box.innerHTML = `
      <div class="pe-svc-top"><div><h3>시술 선택</h3><p>시술 프리셋에 저장된 이름과 기본 가격을 사진 문구로 넣어요.</p></div><button type="button" class="pe-svc-close" data-pe-svc-close aria-label="닫기">×</button></div>
      <input class="pe-svc-search" data-pe-svc-search placeholder="시술명 검색">
      <div class="pe-svc-list" data-pe-svc-list>${_rows(list, mode)}</div>
      <button type="button" class="pe-svc-manage" data-pe-svc-manage>시술 프리셋 관리</button>`;
    sheet.appendChild(box);
    _bind(box, mode, list);
  }

  function _bind(box, mode, list) {
    box.querySelector('[data-pe-svc-close]')?.addEventListener('click', _close);
    box.querySelector('[data-pe-svc-manage]')?.addEventListener('click', () => {
      _close();
      if (typeof window.openServiceTemplates === 'function') window.openServiceTemplates();
      else _toast('시술 프리셋 화면을 불러오는 중이에요');
    });
    box.querySelector('[data-pe-svc-search]')?.addEventListener('input', (e) => {
      const area = box.querySelector('[data-pe-svc-list]');
      if (area) area.innerHTML = _rows(list, mode, e.target.value);
    });
    box.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-pe-svc-i]');
      if (!btn) return;
      const svc = list.find(s => s.name === btn.dataset.peSvcName);
      _apply(mode, svc);
    });
  }

  function _close() { document.getElementById(PICKER_ID)?.remove(); }

  async function open(mode) {
    const st = _state();
    const list = await _loadServices();
    if (!list.length && st && (st.serviceName || st.price)) {
      _apply(mode === 'price' ? 'price' : 'service', { name: st.serviceName || '시술 결과', default_price: st.price });
      return;
    }
    if (!list.length) _toast('시술 프리셋을 등록하면 사진에서 바로 고를 수 있어요');
    _render(mode === 'price' ? 'price' : 'service', list);
  }

  window.PhotoEditorServicePicker = { open, close: _close, formatPrice: _price };
})();
