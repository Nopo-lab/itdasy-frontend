/* 사진 편집기 — 템플릿 문구 편집 하단 시트 (PR-S2 2026-06-06)

   PR-S1 의 slot 기반 구조를 사용해, 선택된 템플릿의 문구를 직접 수정한다.
   - 진입 전 갤러리가 템플릿을 먼저 적용(apply-first) → state.tplV2.slotValues 존재.
   - 입력 즉시 state.tplV2.slotValues 갱신 → scheduleRedraw(실제 캔버스) + onChange(갤러리 프리뷰).
   - 사진 교체는 다음 단계(S3+). image slot 은 비활성 안내만.

   외부 노출: window.PhotoEditorTemplateEditSheet = { open, close, isOpen }
*/
(function () {
  'use strict';
  if (window.PhotoEditorTemplateEditSheet) return;

  const MAX_SERVICES = 6;
  let _el = null;
  let _ctx = null;   // { templateId, state, helpers, onChange, slots, values }
  let _raf = 0;
  let _undoTimer = 0;

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
  function _toast(msg) { if (window.toast) window.toast(msg); else if (window.showToast) window.showToast(msg); }
  const _CLOSE_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function isOpen() { return !!(_el && _el.style.display !== 'none'); }

  function close() {
    if (_raf) { cancelAnimationFrame(_raf); _raf = 0; }
    _clearUndo();
    if (_el) _el.style.display = 'none';
  }

  function open(opts) {
    const TS = window.PhotoEditorTemplateSlots;
    if (!TS || !opts || !opts.state || !opts.state.tplV2) return;
    const slots = TS.getSlots(opts.templateId, opts.templateData);
    if (!opts.state.tplV2.slotValues) opts.state.tplV2.slotValues = {};
    _ctx = { templateId: opts.templateId, state: opts.state, helpers: opts.helpers, onChange: opts.onChange, slots: slots, values: opts.state.tplV2.slotValues };
    _ensureEl();
    _el.querySelector('[data-edit-body]').innerHTML = slots.map(s => _fieldHTML(s, _ctx.values)).join('');
    _bindFields();
    _el.style.display = 'flex';
    _el.querySelector('[data-edit-body]').scrollTop = 0;
  }

  function _ensureEl() {
    if (_el) return;
    _el = document.createElement('div');
    _el.className = 'pe-tpl-edit';
    _el.style.display = 'none';
    _el.innerHTML = `
      <div class="pe-tpl-edit-scrim" data-edit-close></div>
      <div class="pe-tpl-edit-sheet" role="dialog" aria-label="문구 편집">
        <div class="pe-tpl-edit-head">
          <span class="pe-tpl-edit-handle" aria-hidden="true"></span>
          <strong>문구 편집</strong>
          <button type="button" class="pe-tpl-edit-x" data-edit-close aria-label="닫기">${_CLOSE_SVG}</button>
        </div>
        <div class="pe-tpl-edit-body" data-edit-body></div>
        <div class="pe-tpl-edit-foot">
          <button type="button" class="pe-tpl-edit-cancel" data-edit-close>닫기</button>
          <button type="button" class="pe-tpl-edit-apply" data-edit-apply>적용하기</button>
        </div>
      </div>`;
    const host = document.getElementById('photoEditorSheet') || document.body;
    host.appendChild(_el);
    _el.querySelectorAll('[data-edit-close]').forEach(b => b.addEventListener('click', close));
    _el.querySelector('[data-edit-apply]').addEventListener('click', () => { close(); _toast('문구를 적용했어요'); });
  }

  // ── 필드 HTML ──
  function _fieldHTML(slot, values) {
    if (slot.type === 'image') {
      return `<div class="pe-tpl-edit-field"><label>${_esc(slot.label)}</label>
        <div class="pe-tpl-edit-imgnote">현재 편집 사진을 사용 중이에요.<br>사진 교체는 다음 단계에서 지원돼요.</div></div>`;
    }
    if (slot.type === 'list') {
      return _servicesHTML(slot, Array.isArray(values[slot.key]) ? values[slot.key] : []);
    }
    const v = values[slot.key];
    if (slot.type === 'textarea') {
      const max = slot.max || 120;
      return `<div class="pe-tpl-edit-field"><label>${_esc(slot.label)}<span class="pe-tpl-edit-count" data-count-for="${slot.key}">${String(v || '').length}/${max}</span></label>
        <textarea data-edit-key="${slot.key}" maxlength="${max}" rows="3">${_esc(v || '')}</textarea></div>`;
    }
    return `<div class="pe-tpl-edit-field"><label>${_esc(slot.label)}</label>
      <input type="text" data-edit-key="${slot.key}" maxlength="${slot.max || 40}" value="${_esc(v || '')}" /></div>`;
  }

  function _servicesHTML(slot, services) {
    const rows = services.slice(0, MAX_SERVICES);
    while (rows.length < 4) rows.push({ name: '', desc: '', price: '' });
    const ph = '가격표를 한 줄에 하나씩 붙여넣어요\n예) 물광케어 8만원\n진정관리 120000\n리프팅관리 150,000원';
    return `<div class="pe-tpl-edit-field pe-tpl-edit-services">
      <label>${_esc(slot.label)} (최대 ${MAX_SERVICES}개)<span class="pe-tpl-edit-svc-actions">
        <button type="button" class="pe-tpl-edit-pastebtn" data-svc-paste>붙여넣기</button>
        <button type="button" class="pe-tpl-edit-addrow" data-svc-add>+ 항목 추가</button></span></label>
      <div class="pe-tpl-edit-paste" data-svc-paste-box hidden>
        <textarea data-svc-paste-input rows="4" placeholder="${_esc(ph)}"></textarea>
        <div class="pe-tpl-edit-paste-foot">
          <button type="button" class="pe-tpl-edit-paste-cancel" data-svc-paste-cancel>취소</button>
          <button type="button" class="pe-tpl-edit-paste-apply" data-svc-paste-apply>자동 배치</button></div></div>
      <div data-svc-list>${rows.map((r, i) => _svcRowHTML(r, i)).join('')}</div></div>`;
  }
  function _svcRowHTML(r, i) {
    return `<div class="pe-tpl-edit-svc-row" data-svc-row="${i}">
      <div class="pe-tpl-edit-svc-no">${i + 1}</div>
      <div class="pe-tpl-edit-svc-fields">
        <input type="text" data-svc="name" placeholder="시술명" value="${_esc(r.name || '')}" />
        <div class="pe-tpl-edit-svc-line">
          <input type="text" data-svc="desc" placeholder="설명 (선택)" value="${_esc(r.desc || '')}" />
          <input type="text" data-svc="price" placeholder="가격" value="${_esc(r.price || '')}" inputmode="numeric" />
        </div>
      </div>
      <button type="button" class="pe-tpl-edit-svc-del" data-svc-del aria-label="삭제">${_CLOSE_SVG}</button></div>`;
  }

  // ── 바인딩 ──
  function _bindFields() {
    _el.querySelectorAll('[data-edit-key]').forEach((inp) => {
      inp.addEventListener('input', () => {
        _ctx.values[inp.dataset.editKey] = inp.value;
        const c = _el.querySelector('[data-count-for="' + inp.dataset.editKey + '"]');
        if (c) c.textContent = inp.value.length + '/' + inp.maxLength;
        _schedule();
      });
    });
    _el.querySelectorAll('[data-svc-row]').forEach(_bindSvcRow);
    _el.querySelector('[data-svc-add]')?.addEventListener('click', _addSvcRow);
    _el.querySelector('[data-svc-paste]')?.addEventListener('click', () => _togglePaste());
    _el.querySelector('[data-svc-paste-cancel]')?.addEventListener('click', () => _togglePaste(false));
    _el.querySelector('[data-svc-paste-apply]')?.addEventListener('click', _applyPaste);
  }

  function _bindSvcRow(row) {
    row.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', () => { _collectServices(); _schedule(); }));
    const price = row.querySelector('[data-svc="price"]');
    price?.addEventListener('blur', (e) => {
      const FT = window.PhotoEditorTemplateFitText;
      if (FT && e.target.value.trim()) { e.target.value = FT.formatPrice(e.target.value); _collectServices(); _schedule(); }
    });
    row.querySelector('[data-svc-del]')?.addEventListener('click', () => { row.remove(); _renumberSvc(); _collectServices(); _schedule(); });
  }

  function _addSvcRow() {
    const list = _el.querySelector('[data-svc-list]');
    if (!list || list.querySelectorAll('[data-svc-row]').length >= MAX_SERVICES) return;
    list.insertAdjacentHTML('beforeend', _svcRowHTML({}, list.children.length));
    _bindSvcRow(list.lastElementChild);
    _renumberSvc();
  }

  function _renumberSvc() {
    _el.querySelectorAll('[data-svc-row]').forEach((r, i) => { r.dataset.svcRow = i; r.querySelector('.pe-tpl-edit-svc-no').textContent = i + 1; });
  }

  function _collectServices() {
    const list = [];
    _el.querySelectorAll('[data-svc-row]').forEach((row) => {
      const name = row.querySelector('[data-svc="name"]').value.trim();
      const desc = row.querySelector('[data-svc="desc"]').value.trim();
      const price = row.querySelector('[data-svc="price"]').value.trim();
      if (name || price) list.push({ name: name, desc: desc, price: price });
    });
    _ctx.values.services = list;   // _ctx.values === state.tplV2.slotValues (동일 참조)
  }

  // ── 붙여넣기 자동 배치 (S5a) ──
  // services 행 DOM 을 주어진 배열로 재구성(전체 교체). 편집 affordance 위해 최소 4행 패딩.
  function _renderSvcList(rows) {
    const list = _el.querySelector('[data-svc-list]');
    if (!list) return;
    const arr = (rows || []).slice(0, MAX_SERVICES).map(r => ({ name: r.name || '', desc: r.desc || '', price: r.price || '' }));
    while (arr.length < 4) arr.push({ name: '', desc: '', price: '' });
    list.innerHTML = arr.map((r, i) => _svcRowHTML(r, i)).join('');
    list.querySelectorAll('[data-svc-row]').forEach(_bindSvcRow);
  }

  function _togglePaste(show) {
    const box = _el.querySelector('[data-svc-paste-box]');
    if (!box) return;
    const open = (show === undefined) ? box.hasAttribute('hidden') : !!show;
    if (open) { box.removeAttribute('hidden'); box.querySelector('[data-svc-paste-input]')?.focus(); }
    else { box.setAttribute('hidden', ''); }
  }

  function _applyPaste() {
    const FT = window.PhotoEditorTemplateFitText;
    const ta = _el.querySelector('[data-svc-paste-input]');
    if (!FT || !FT.parseServicePrices || !ta) return;
    if (!ta.value.trim()) { _toast('붙여넣을 가격표를 입력해 주세요'); return; }
    // 가격 없는 줄은 name 만 반영, 빈 줄은 parseServicePrices 가 무시.
    const parsed = (FT.parseServicePrices(ta.value) || []).filter(r => (r.name || r.price));
    if (!parsed.length) { _toast('가격표를 인식하지 못했어요'); return; }
    const over = parsed.length > MAX_SERVICES;
    const rows = parsed.slice(0, MAX_SERVICES).map(r => ({ name: r.name || '', desc: '', price: r.price || '' }));
    const prev = (_ctx.values.services || []).map(r => ({ name: r.name || '', desc: r.desc || '', price: r.price || '' }));
    _renderSvcList(rows);          // 전체 교체(overwrite)
    _collectServices();
    _schedule();
    _togglePaste(false);
    ta.value = '';
    _showUndo(prev, over);
  }

  function _showUndo(prevServices, over) {
    _clearUndo();
    const sheet = _el && _el.querySelector('.pe-tpl-edit-sheet');
    if (!sheet) return;
    const msg = over ? ('가격표 ' + MAX_SERVICES + '개까지 자동 배치했어요') : '가격표를 자동 배치했어요';
    const el = document.createElement('div');
    el.className = 'pe-tpl-edit-undo';
    el.innerHTML = '<span>' + _esc(msg) + '</span><button type="button" data-undo>되돌리기</button>';
    sheet.appendChild(el);
    el.querySelector('[data-undo]').addEventListener('click', () => {
      _renderSvcList(prevServices);
      _collectServices();
      _schedule();
      _clearUndo();
      _toast('되돌렸어요');
    });
    _undoTimer = setTimeout(_clearUndo, 5000);
  }

  function _clearUndo() {
    if (_undoTimer) { clearTimeout(_undoTimer); _undoTimer = 0; }
    const ex = _el && _el.querySelector('.pe-tpl-edit-undo');
    if (ex) ex.remove();
  }

  // 입력 즉시 state 반영(위에서 완료), 렌더만 rAF 디바운스.
  function _schedule() {
    if (_raf) return;
    _raf = requestAnimationFrame(() => {
      _raf = 0;
      try { if (_ctx && _ctx.helpers && _ctx.helpers.scheduleRedraw) _ctx.helpers.scheduleRedraw(); } catch (_e) { /* ignore */ }
      try { if (_ctx && _ctx.onChange) _ctx.onChange(); } catch (_e) { /* ignore */ }
    });
  }

  window.PhotoEditorTemplateEditSheet = { open: open, close: close, isOpen: isOpen };
})();
