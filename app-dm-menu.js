/* 빠른 안내 (DM Quick Replies + Ice Breakers) 설정 — [2026-06-20]
   진입: window.openDMMenuSettings()
   BE: GET/PUT /shop/dm-menu (services/dm_menu.py). 고정5 key/action 불변, label/resp/ack/enabled + 커스텀(≤13) 편집.
   디자인: 흰바탕·로즈 포인트·검정 CTA, 그라데이션 X, .subscreen-overlay 재사용(PC 사이드바 자동 안전).
*/
(function () {
  'use strict';
  const ID = 'dmMenuOverlay';
  function _esc(s) { return window._esc ? window._esc(s) : String(s == null ? '' : s); }
  function _toast(m) { if (window.showToast) window.showToast(m); }
  function _haptic() { try { window.hapticLight && window.hapticLight(); } catch (_e) { void _e; } }

  const LABEL_MAX = 20, MAX_ITEMS = 13, ICE_MAX = 4;
  // 고정 항목 설명 + 편집 필드(resp/ack/none) + 토큰 안내
  const FIXED_META = {
    BOOK_FORM: { mt: '예약 양식 보내기', ms: '탭하면 → 손님에게 양식 바로 발송', edit: 'none', editNote: '양식 내용은 [예약 양식] 화면에서 편집해요.' },
    HOURS:     { mt: '영업시간 자동 안내', ms: '영업시간을 바로 답장', edit: 'resp', token: '{영업시간}' },
    LOCATION:  { mt: '위치·주소 자동 안내', ms: '샵 주소를 바로 답장', edit: 'resp', token: '{주소}' },
    PRICE:     { mt: '가격표 자동 안내', ms: '등록한 가격표를 바로 답장', edit: 'resp', token: '{가격표}' },
    OTHER:     { mt: '사장님이 직접 답장', ms: '확인 멘트 보낸 뒤 큐에 올림', edit: 'ack' },
  };
  const FIXED_ORDER = ['BOOK_FORM', 'HOURS', 'LOCATION', 'PRICE', 'OTHER'];
  const DEFAULT_LABEL = { BOOK_FORM: '예약하기', HOURS: '영업시간', LOCATION: '오시는 길', PRICE: '가격 문의', OTHER: '기타 문의' };

  let _menu = null;
  const _open = new Set();   // 펼쳐진 항목 key

  function _defaultMenu() {
    return {
      enabled: false,
      greeting: '문의 감사합니다 😊 어떤 게 궁금하세요? 아래에서 골라주세요.',
      items: FIXED_ORDER.map(k => ({
        key: k, label: DEFAULT_LABEL[k], enabled: k !== 'PRICE',
        action: { BOOK_FORM: 'book_form', HOURS: 'hours', LOCATION: 'location', PRICE: 'price', OTHER: 'owner_queue' }[k],
        resp: { HOURS: '영업시간 안내드려요 🕐\n{영업시간}', LOCATION: '오시는 길 안내드려요 📍\n{주소}', PRICE: '가격 안내드려요 💰\n{가격표}' }[k] || '',
        ack: k === 'OTHER' ? '문의 확인했어요! 원장님이 확인 후 답장드릴게요 🙏' : '',
        custom: false,
      })),
      ice_breakers: ['BOOK_FORM', 'HOURS', 'LOCATION'],
    };
  }
  function _items() { return (_menu && _menu.items) || []; }
  function _itemOf(key) { return _items().find(i => i.key === key); }
  function _isCustom(it) { return !!it.custom || (it.key || '').indexOf('CUSTOM_') === 0; }
  function _editKind(it) {
    if (_isCustom(it)) return it.action === 'owner_direct' ? 'ack' : 'resp';
    return (FIXED_META[it.key] || {}).edit || 'none';
  }

  function _styleOnce() {
    if (document.getElementById('dmMenuStyle')) return;
    const s = document.createElement('style');
    s.id = 'dmMenuStyle';
    s.textContent = `
      #${ID} .dmm-note{font-size:12.5px;color:var(--text-muted,#4E5968);line-height:1.5;background:var(--brand-bg,#F7EFF0);border:.5px solid rgba(0,0,0,.08);border-radius:14px;padding:11px 13px;margin-bottom:14px}
      #${ID} .dmm-sec{font-size:12px;font-weight:700;color:var(--text-subtle,#8B95A1);margin:14px 4px 6px}
      #${ID} .dmm-card{background:#fff;border:.5px solid rgba(0,0,0,.08);border-radius:18px;overflow:hidden}
      #${ID} .dmm-master{display:flex;align-items:center;gap:12px;padding:15px 14px}
      #${ID} .dmm-master .t{flex:1;min-width:0}
      #${ID} .dmm-master .t b{font-size:15px;font-weight:800;color:#191F28}
      #${ID} .dmm-master .t span{display:block;font-size:11.5px;color:#8B95A1;margin-top:2px}
      #${ID} .dmm-greet{padding:13px 14px}
      #${ID} textarea,#${ID} .dmm-lblin{font-family:inherit;outline:none;color:#191F28;box-sizing:border-box}
      #${ID} .dmm-greet textarea{width:100%;border:.5px solid rgba(0,0,0,.12);border-radius:12px;padding:11px 12px;font-size:13.5px;line-height:1.5;resize:none}
      #${ID} textarea:focus,#${ID} .dmm-lblin:focus{border-color:var(--brand,#D58A95)}
      #${ID} .dmm-it{border-bottom:.5px solid rgba(0,0,0,.06)}
      #${ID} .dmm-it:last-child{border-bottom:0}
      #${ID} .dmm-row{display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer}
      #${ID} .dmm-chip{font-size:13px;font-weight:800;color:var(--brand-strong,#BC6675);background:var(--brand-bg,#F7EFF0);border:.5px solid rgba(0,0,0,.08);border-radius:999px;padding:6px 12px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #${ID} .dmm-tx{flex:1;min-width:0}
      #${ID} .dmm-tx .mt{font-size:13px;font-weight:700;color:#191F28}
      #${ID} .dmm-tx .ms{font-size:11px;color:#8B95A1;margin-top:1px}
      #${ID} .dmm-caret{color:#C9CDD4;transition:transform .2s;flex:none;display:inline-flex}
      #${ID} .dmm-caret.open{transform:rotate(180deg)}
      #${ID} .dmm-body{padding:0 14px 14px;display:flex;flex-direction:column;gap:9px}
      #${ID} .dmm-fld{font-size:11px;font-weight:700;color:#8B95A1;margin-bottom:-3px}
      #${ID} .dmm-lblin{width:100%;border:.5px solid rgba(0,0,0,.12);border-radius:10px;padding:9px 11px;font-size:13px;font-weight:700}
      #${ID} .dmm-cnt{font-size:10.5px;color:#B0B8C1;text-align:right}
      #${ID} .dmm-resp{width:100%;border:.5px solid rgba(0,0,0,.12);border-radius:10px;padding:9px 11px;font-size:13px;line-height:1.5;resize:none;min-height:62px}
      #${ID} .dmm-tok{display:inline-block;font-size:10.5px;font-weight:700;color:var(--brand-strong,#BC6675);background:var(--brand-bg,#F7EFF0);border-radius:999px;padding:2px 8px;margin-right:5px}
      #${ID} .dmm-seg{display:flex;gap:6px}
      #${ID} .dmm-seg button{flex:1;font-size:12px;font-weight:700;padding:8px;border-radius:10px;border:.5px solid rgba(0,0,0,.12);background:#F7F8FA;color:#4E5968;cursor:pointer;font-family:inherit}
      #${ID} .dmm-seg button.on{background:#191F28;color:#fff;border-color:#191F28}
      #${ID} .dmm-del{align-self:flex-start;font-size:12px;font-weight:700;color:#D95F70;background:none;border:none;padding:4px 0;cursor:pointer}
      #${ID} .dmm-addbtn{width:100%;padding:13px;border:1px dashed rgba(0,0,0,.18);background:#fff;border-radius:14px;font-size:13px;font-weight:700;color:#4E5968;cursor:pointer;font-family:inherit;margin-top:10px}
      #${ID} .dmm-ib{display:flex;flex-wrap:wrap;gap:7px;padding:13px 14px}
      #${ID} .dmm-ib button{font-size:12.5px;font-weight:700;padding:8px 13px;border-radius:999px;border:.5px solid rgba(0,0,0,.08);background:#F7F8FA;color:#4E5968;cursor:pointer;font-family:inherit}
      #${ID} .dmm-ib button.on{background:var(--brand-bg,#F7EFF0);color:var(--brand-strong,#BC6675);border-color:var(--brand,#D58A95)}
      #${ID} .dmm-ibcap{font-size:11px;color:#8B95A1;padding:11px 14px 0}
      #${ID} .dmm-dim{opacity:.45;pointer-events:none}
      /* 쫀득 토글 — 노브 바운스 + 누를 때 살짝 늘었다 튕김 */
      #${ID} .dmm-tg{width:44px;height:26px;border-radius:99px;background:#E2E6EB;position:relative;flex:none;border:none;padding:0;cursor:pointer;transition:background .18s}
      #${ID} .dmm-tg.on{background:#16B55E}
      #${ID} .dmm-tg::after{content:"";position:absolute;top:2.5px;left:2.5px;width:21px;height:21px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.22);transition:left .24s cubic-bezier(.34,1.56,.64,1),width .12s ease}
      #${ID} .dmm-tg.on::after{left:20.5px}
      #${ID} .dmm-tg:active::after{width:26px}
      #${ID} .dmm-tg.on:active::after{left:15.5px}
    `;
    document.head.appendChild(s);
  }

  function _ensureMounted() {
    let el = document.getElementById(ID);
    if (el) return el;
    _styleOnce();
    el = document.createElement('div');
    el.id = ID;
    el.className = 'subscreen-overlay';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <header class="ss-topbar">
        <button type="button" class="ss-back" data-dmm-back aria-label="뒤로"><svg width="14" height="14" aria-hidden="true"><use href="#ic-chevron-left"/></svg></button>
        <div class="ss-title">빠른 안내</div>
        <button type="button" class="ss-action" data-dmm-save>저장</button>
      </header>
      <div class="ss-body"><div id="dmmBody"></div></div>`;
    document.body.appendChild(el);
    el.querySelector('[data-dmm-back]').addEventListener('click', closeDMMenuSettings);
    el.querySelector('[data-dmm-save]').addEventListener('click', _save);
    const body = el.querySelector('#dmmBody');
    body.addEventListener('click', _onClick);
    body.addEventListener('input', _onInput);
    return el;
  }

  function _caret(open) {
    return `<span class="dmm-caret ${open ? 'open' : ''}" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span>`;
  }
  function _tgHtml(on, kind, key) {
    return `<button type="button" class="dmm-tg ${on ? 'on' : ''}" data-tg="${kind}" data-key="${_esc(key || '')}" aria-pressed="${on}" aria-label="켜기"></button>`;
  }

  function _itemEditor(it) {
    const kind = _editKind(it);
    const meta = FIXED_META[it.key] || {};
    const lblCount = (it.label || '').length;
    let fields = `
      <div class="dmm-fld">버튼 글자 (손님에게 보임)</div>
      <input class="dmm-lblin" data-lbl="${_esc(it.key)}" maxlength="${LABEL_MAX}" value="${_esc(it.label || '')}" placeholder="예: 예약하기">
      <div class="dmm-cnt"><span data-cnt="${_esc(it.key)}">${lblCount}</span>/${LABEL_MAX}</div>`;
    if (meta.edit === 'none') {
      fields += `<div class="dmm-fld" style="color:#B0B8C1;">${_esc(meta.editNote || '')}</div>`;
    } else if (kind === 'resp') {
      const tok = meta.token || (_isCustom(it) ? '' : '');
      fields += `<div class="dmm-fld">응답 멘트</div>`;
      if (tok) fields += `<div><span class="dmm-tok">${_esc(tok)}</span><span style="font-size:10.5px;color:#B0B8C1;">숫자·데이터는 설정에서 자동으로 채워져요</span></div>`;
      fields += `<textarea class="dmm-resp" data-resp="${_esc(it.key)}" maxlength="600" placeholder="손님에게 보낼 답장">${_esc(it.resp || '')}</textarea>`;
    } else if (kind === 'ack') {
      fields += `<div class="dmm-fld">확인 멘트 (보낸 뒤 사장님 큐로)</div>
        <textarea class="dmm-resp" data-ack="${_esc(it.key)}" maxlength="300" placeholder="예: 문의 확인했어요! 곧 답장드릴게요 🙏">${_esc(it.ack || '')}</textarea>`;
    }
    if (_isCustom(it)) {
      const at = it.action === 'owner_direct' ? 'owner_direct' : 'auto_text';
      fields += `
        <div class="dmm-fld">응답 방식</div>
        <div class="dmm-seg">
          <button type="button" data-act-set="auto_text" data-key="${_esc(it.key)}" class="${at === 'auto_text' ? 'on' : ''}">자동 답장</button>
          <button type="button" data-act-set="owner_direct" data-key="${_esc(it.key)}" class="${at === 'owner_direct' ? 'on' : ''}">사장님 직접</button>
        </div>
        <button type="button" class="dmm-del" data-del="${_esc(it.key)}">이 메뉴 삭제</button>`;
    }
    return `<div class="dmm-body">${fields}</div>`;
  }

  function _render() {
    const body = document.getElementById('dmmBody');
    if (!body || !_menu) return;
    const dim = _menu.enabled ? '' : ' dmm-dim';
    const rows = _items().map(it => {
      const meta = FIXED_META[it.key] || { mt: it.label || it.key, ms: it.action === 'owner_direct' ? '확인 멘트 후 사장님 직접 답장' : '자동 답장' };
      const open = _open.has(it.key);
      return `
        <div class="dmm-it">
          <div class="dmm-row" data-exp="${_esc(it.key)}">
            <span class="dmm-chip">${_esc(it.label || it.key)}</span>
            <div class="dmm-tx"><div class="mt">${_esc(meta.mt)}</div><div class="ms">${_esc(meta.ms)}</div></div>
            ${_caret(open)}
            ${_tgHtml(it.enabled, 'item', it.key)}
          </div>
          ${open ? _itemEditor(it) : ''}
        </div>`;
    }).join('');
    const ice = _items().map(it => {
      const on = (_menu.ice_breakers || []).indexOf(it.key) >= 0;
      return `<button type="button" class="${on ? 'on' : ''}" data-ice="${_esc(it.key)}">${_esc(it.label || it.key)}</button>`;
    }).join('');
    body.innerHTML = `
      <div class="dmm-note">손님이 DM을 보내면 이 <b>버튼들이 자동으로</b> 떠요. 손님은 타이핑 없이 탭만 하면 돼요. 인스타에 직접은 못 만드는 기능이라 <b>잇데이가 대신 깔아줘요.</b></div>
      <div class="dmm-card">
        <div class="dmm-master">
          <div class="t"><b>빠른 안내</b><span>손님 DM에 자동으로 버튼 메뉴를 띄워요</span></div>
          ${_tgHtml(_menu.enabled, 'master', '')}
        </div>
      </div>
      <div class="dmm-sec">첫 인사 멘트</div>
      <div class="dmm-card dmm-greet${dim}"><textarea rows="2" data-greet maxlength="300">${_esc(_menu.greeting || '')}</textarea></div>
      <div class="dmm-sec">메뉴 버튼 (켠 것만 손님에게 보여요 · 탭해서 편집)</div>
      <div class="dmm-card${dim}">${rows}</div>
      <button type="button" class="dmm-addbtn${dim}" data-add>+ 메뉴 추가</button>
      <div class="dmm-sec">대화 처음 열 때 메뉴 (최대 ${ICE_MAX}개)</div>
      <div class="dmm-card${dim}">
        <div class="dmm-ibcap">손님이 DM 창을 처음 열면 미리 보이는 버튼이에요.</div>
        <div class="dmm-ib">${ice}</div>
      </div>`;
  }

  function _onClick(e) {
    const tg = e.target.closest('.dmm-tg');
    if (tg) {
      e.stopPropagation();
      const kind = tg.getAttribute('data-tg');
      if (kind === 'master') _menu.enabled = !_menu.enabled;
      else { const it = _itemOf(tg.getAttribute('data-key')); if (it) it.enabled = !it.enabled; }
      _haptic(); _render(); return;
    }
    const actSet = e.target.closest('[data-act-set]');
    if (actSet) {
      const it = _itemOf(actSet.getAttribute('data-key'));
      if (it) { it.action = actSet.getAttribute('data-act-set'); _haptic(); _render(); }
      return;
    }
    const del = e.target.closest('[data-del]');
    if (del) {
      const k = del.getAttribute('data-del');
      _menu.items = _items().filter(i => i.key !== k);
      _menu.ice_breakers = (_menu.ice_breakers || []).filter(x => x !== k);
      _open.delete(k); _haptic(); _render(); return;
    }
    const add = e.target.closest('[data-add]');
    if (add) {
      if (_items().length >= MAX_ITEMS) { _toast(`메뉴는 최대 ${MAX_ITEMS}개예요`); return; }
      let n = 1; while (_itemOf('CUSTOM_' + n)) n++;
      const key = 'CUSTOM_' + n;
      _menu.items.push({ key, label: '새 메뉴', enabled: true, action: 'auto_text', resp: '', ack: '', custom: true });
      _open.add(key); _haptic(); _render(); return;
    }
    const ice = e.target.closest('[data-ice]');
    if (ice) {
      const k = ice.getAttribute('data-ice');
      const arr = _menu.ice_breakers || (_menu.ice_breakers = []);
      const idx = arr.indexOf(k);
      if (idx >= 0) arr.splice(idx, 1);
      else { if (arr.length >= ICE_MAX) { _toast(`처음 열 때 메뉴는 최대 ${ICE_MAX}개예요`); return; } arr.push(k); }
      _haptic(); _render(); return;
    }
    const exp = e.target.closest('[data-exp]');
    if (exp) {
      const k = exp.getAttribute('data-exp');
      if (_open.has(k)) _open.delete(k); else _open.add(k);
      _render();
    }
  }

  function _onInput(e) {
    const t = e.target;
    if (t.matches('[data-greet]')) { _menu.greeting = t.value; return; }
    if (t.matches('[data-lbl]')) {
      const it = _itemOf(t.getAttribute('data-lbl'));
      if (it) it.label = t.value;
      const cnt = document.querySelector(`#${ID} [data-cnt="${t.getAttribute('data-lbl')}"]`);
      if (cnt) cnt.textContent = (t.value || '').length;
      return;
    }
    if (t.matches('[data-resp]')) { const it = _itemOf(t.getAttribute('data-resp')); if (it) it.resp = t.value; return; }
    if (t.matches('[data-ack]')) { const it = _itemOf(t.getAttribute('data-ack')); if (it) it.ack = t.value; }
  }

  async function _hydrate() {
    try {
      const res = await apiFetch(apiUrl('/shop/dm-menu'), { headers: window.authHeader ? window.authHeader() : {} });
      const d = await res.json().catch(() => null);
      _menu = (d && typeof d === 'object' && Array.isArray(d.items)) ? d : _defaultMenu();
    } catch (_e) { _menu = _defaultMenu(); }
    if (!Array.isArray(_menu.items) || !_menu.items.length) _menu.items = _defaultMenu().items;
    _render();
  }

  async function _save() {
    if (!_menu) return;
    const payload = {
      enabled: !!_menu.enabled,
      greeting: _menu.greeting || '',
      items: _items().map(it => ({
        key: it.key, label: (it.label || '').slice(0, LABEL_MAX) || '메뉴',
        enabled: !!it.enabled, action: it.action,
        resp: it.resp || '', ack: it.ack || '', custom: _isCustom(it),
      })),
      ice_breakers: (_menu.ice_breakers || []).slice(0, ICE_MAX),
    };
    const btn = document.querySelector('#' + ID + ' [data-dmm-save]');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
    try {
      const res = await apiFetch(apiUrl('/shop/dm-menu'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(window.authHeader ? window.authHeader() : {}) },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.detail || ('HTTP ' + res.status));
      _toast(d && d.ice_breaker_warning ? d.ice_breaker_warning : '저장됐어요 ✓');
      closeDMMenuSettings();
    } catch (e) {
      _toast('저장 실패: ' + (e && e.message ? e.message : '네트워크 오류'));
    } finally {
      if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    }
  }

  function openDMMenuSettings() {
    const el = _ensureMounted();
    _menu = _menu || _defaultMenu();
    _open.clear();
    _render();
    _hydrate().catch(() => {});
    requestAnimationFrame(() => el.classList.add('is-open'));
    el.setAttribute('aria-hidden', 'false');
    _haptic();
  }
  function closeDMMenuSettings() {
    const el = document.getElementById(ID);
    if (!el) return;
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    _haptic();
  }

  window.openDMMenuSettings = openDMMenuSettings;
  window.closeDMMenuSettings = closeDMMenuSettings;
})();
