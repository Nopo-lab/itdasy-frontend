/* DM 자동 메뉴 설정 (Quick Replies + Ice Breakers) — [2026-06-20]
   진입: window.openDMMenuSettings()
   BE: GET/PUT /shop/dm-menu (services/dm_menu.py 계약). key/action 고정, label/enabled/ice_breakers 편집.
   디자인: 흰바탕·로즈 포인트·검정 CTA, 그라데이션·하드코딩색 지양. .subscreen-overlay 재사용(PC 사이드바 안전).
*/
(function () {
  'use strict';
  const ID = 'dmMenuOverlay';
  function _esc(s) { return window._esc ? window._esc(s) : String(s == null ? '' : s); }
  function _toast(m) { if (window.showToast) window.showToast(m); }
  function _haptic() { try { window.hapticLight && window.hapticLight(); } catch (_e) { void _e; } }

  // 메뉴 항목 메타(고정) — key/action 은 서버 enum. 라벨만 편집.
  const ITEM_META = {
    BOOK_FORM: { mt: '예약 양식 보내기', ms: '탭하면 → 원장 큐에 [양식 보내기] 카드' },
    HOURS:     { mt: '영업시간 자동 안내', ms: '설정한 영업시간·휴무를 바로 답장' },
    LOCATION:  { mt: '위치·주소 자동 안내', ms: '샵 주소를 바로 답장' },
    PRICE:     { mt: '가격표 자동 안내', ms: '등록한 가격표를 바로 답장' },
    OTHER:     { mt: '사장님이 직접 답장', ms: '잇비가 큐에만 올림 (자동발송 X)' },
  };
  const ORDER = ['BOOK_FORM', 'HOURS', 'LOCATION', 'PRICE', 'OTHER'];
  const ICE_MAX = 4;

  let _menu = null;  // 현재 편집 상태

  function _defaultMenu() {
    return {
      enabled: false,
      greeting: '문의 감사합니다 😊 어떤 게 궁금하세요? 아래에서 골라주세요.',
      items: ORDER.map(k => ({ key: k, label: _defaultLabel(k), enabled: k !== 'PRICE' })),
      ice_breakers: ['BOOK_FORM', 'HOURS', 'LOCATION'],
    };
  }
  function _defaultLabel(k) {
    return { BOOK_FORM: '예약하기', HOURS: '영업시간', LOCATION: '오시는 길', PRICE: '가격 문의', OTHER: '기타 문의' }[k] || k;
  }
  function _itemOf(key) {
    return (_menu.items || []).find(i => i.key === key) || { key, label: _defaultLabel(key), enabled: false };
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
      #${ID} .dmm-greet textarea{width:100%;border:.5px solid rgba(0,0,0,.12);border-radius:12px;padding:11px 12px;font-family:inherit;font-size:13.5px;line-height:1.5;resize:none;outline:none;color:#191F28;box-sizing:border-box}
      #${ID} .dmm-greet textarea:focus{border-color:var(--brand,#D58A95)}
      #${ID} .dmm-row{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:.5px solid rgba(0,0,0,.06)}
      #${ID} .dmm-row:last-child{border-bottom:0}
      #${ID} .dmm-lblin{font-size:13px;font-weight:800;color:var(--brand-strong,#BC6675);background:var(--brand-bg,#F7EFF0);border:.5px solid rgba(0,0,0,.08);border-radius:999px;padding:6px 12px;width:96px;text-align:center;outline:none;font-family:inherit}
      #${ID} .dmm-lblin:focus{border-color:var(--brand,#D58A95)}
      #${ID} .dmm-tx{flex:1;min-width:0}
      #${ID} .dmm-tx .mt{font-size:13px;font-weight:700;color:#191F28}
      #${ID} .dmm-tx .ms{font-size:11px;color:#8B95A1;margin-top:1px}
      #${ID} .dmm-tg{width:42px;height:25px;border-radius:99px;background:#E2E6EB;position:relative;flex:none;border:none;padding:0;cursor:pointer;transition:.18s}
      #${ID} .dmm-tg.on{background:#16B55E}
      #${ID} .dmm-tg::after{content:"";position:absolute;top:2.5px;left:2.5px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:.18s}
      #${ID} .dmm-tg.on::after{left:19.5px}
      #${ID} .dmm-ib{display:flex;flex-wrap:wrap;gap:7px;padding:13px 14px}
      #${ID} .dmm-ib button{font-size:12.5px;font-weight:700;padding:8px 13px;border-radius:999px;border:.5px solid rgba(0,0,0,.08);background:#F7F8FA;color:#4E5968;cursor:pointer;font-family:inherit}
      #${ID} .dmm-ib button.on{background:var(--brand-bg,#F7EFF0);color:var(--brand-strong,#BC6675);border-color:var(--brand,#D58A95)}
      #${ID} .dmm-ibcap{font-size:11px;color:#8B95A1;padding:11px 14px 0}
      #${ID} .dmm-dim{opacity:.45;pointer-events:none}
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
        <button type="button" class="ss-back" data-dmm-back aria-label="뒤로">
          <svg width="14" height="14" aria-hidden="true"><use href="#ic-chevron-left"/></svg>
        </button>
        <div class="ss-title">DM 자동 메뉴</div>
        <button type="button" class="ss-action" data-dmm-save>저장</button>
      </header>
      <div class="ss-body"><div id="dmmBody"></div></div>`;
    document.body.appendChild(el);
    el.querySelector('[data-dmm-back]').addEventListener('click', closeDMMenuSettings);
    el.querySelector('[data-dmm-save]').addEventListener('click', _save);
    el.querySelector('#dmmBody').addEventListener('click', _onClick);
    el.querySelector('#dmmBody').addEventListener('input', _onInput);
    return el;
  }

  function _render() {
    const body = document.getElementById('dmmBody');
    if (!body || !_menu) return;
    const dim = _menu.enabled ? '' : ' dmm-dim';
    const rows = ORDER.map(k => {
      const it = _itemOf(k);
      const meta = ITEM_META[k] || { mt: k, ms: '' };
      return `
        <div class="dmm-row">
          <input class="dmm-lblin" data-lbl="${k}" maxlength="20" value="${_esc(it.label || _defaultLabel(k))}" aria-label="${_esc(meta.mt)} 버튼 라벨">
          <div class="dmm-tx"><div class="mt">${_esc(meta.mt)}</div><div class="ms">${_esc(meta.ms)}</div></div>
          <button type="button" class="dmm-tg ${it.enabled ? 'on' : ''}" data-tg="${k}" aria-pressed="${it.enabled}" aria-label="${_esc(meta.mt)} 켜기"></button>
        </div>`;
    }).join('');
    const ice = ORDER.map(k => {
      const on = (_menu.ice_breakers || []).indexOf(k) >= 0;
      return `<button type="button" class="${on ? 'on' : ''}" data-ice="${k}">${_esc(_itemOf(k).label || _defaultLabel(k))}</button>`;
    }).join('');
    body.innerHTML = `
      <div class="dmm-note">손님이 DM을 보내면 이 <b>버튼들이 자동으로</b> 떠요. 손님은 타이핑 없이 탭만 하면 돼요. 인스타에 직접은 못 만드는 기능이라 <b>잇데이가 대신 깔아줘요.</b></div>

      <div class="dmm-card">
        <div class="dmm-master">
          <div class="t"><b>퀵리플라이 메뉴</b><span>손님 DM에 자동으로 버튼 메뉴를 띄워요</span></div>
          <button type="button" class="dmm-tg ${_menu.enabled ? 'on' : ''}" data-tg="__MASTER__" aria-pressed="${_menu.enabled}" aria-label="퀵리플라이 메뉴 켜기"></button>
        </div>
      </div>

      <div class="dmm-sec">첫 인사 멘트</div>
      <div class="dmm-card dmm-greet${dim}"><textarea rows="2" data-greet maxlength="300">${_esc(_menu.greeting || '')}</textarea></div>

      <div class="dmm-sec">메뉴 버튼 (켠 것만 손님에게 보여요)</div>
      <div class="dmm-card${dim}">${rows}</div>

      <div class="dmm-sec">대화 처음 열 때 메뉴 (최대 ${ICE_MAX}개)</div>
      <div class="dmm-card${dim}">
        <div class="dmm-ibcap">손님이 DM 창을 처음 열면 미리 보이는 버튼이에요.</div>
        <div class="dmm-ib">${ice}</div>
      </div>`;
  }

  function _onClick(e) {
    const tg = e.target.closest('.dmm-tg');
    if (tg) {
      const k = tg.getAttribute('data-tg');
      if (k === '__MASTER__') { _menu.enabled = !_menu.enabled; }
      else { const it = _itemOf(k); it.enabled = !it.enabled; }
      _haptic(); _render();
      return;
    }
    const ice = e.target.closest('[data-ice]');
    if (ice) {
      const k = ice.getAttribute('data-ice');
      const arr = _menu.ice_breakers || (_menu.ice_breakers = []);
      const idx = arr.indexOf(k);
      if (idx >= 0) arr.splice(idx, 1);
      else {
        if (arr.length >= ICE_MAX) { _toast(`처음 열 때 메뉴는 최대 ${ICE_MAX}개예요`); return; }
        arr.push(k);
      }
      _haptic(); _render();
    }
  }

  function _onInput(e) {
    if (e.target.matches('[data-greet]')) { _menu.greeting = e.target.value; return; }
    if (e.target.matches('[data-lbl]')) {
      const k = e.target.getAttribute('data-lbl');
      _itemOf(k).label = e.target.value;
    }
  }

  async function _hydrate() {
    try {
      const res = await apiFetch(apiUrl('/shop/dm-menu'), { headers: window.authHeader ? window.authHeader() : {} });
      const d = await res.json().catch(() => null);
      _menu = (d && typeof d === 'object' && Array.isArray(d.items)) ? d : _defaultMenu();
    } catch (_e) {
      _menu = _defaultMenu();
    }
    // 항목 누락 방어 — 5종 보장
    const have = new Set((_menu.items || []).map(i => i.key));
    ORDER.forEach(k => { if (!have.has(k)) _menu.items.push({ key: k, label: _defaultLabel(k), enabled: false }); });
    _render();
  }

  async function _save() {
    if (!_menu) return;
    const payload = {
      enabled: !!_menu.enabled,
      greeting: _menu.greeting || '',
      items: ORDER.map(k => { const it = _itemOf(k); return { key: k, label: (it.label || _defaultLabel(k)).slice(0, 20), enabled: !!it.enabled }; }),
      ice_breakers: (_menu.ice_breakers || []).filter(k => ORDER.indexOf(k) >= 0).slice(0, ICE_MAX),
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
      if (d && d.ice_breaker_warning) _toast(d.ice_breaker_warning);
      else _toast('저장됐어요 ✓');
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
