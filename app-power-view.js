/* ─────────────────────────────────────────────────────────────
   파워뷰(Power View) — 엑셀식 풀스크린 멀티탭 빠른 입력
   (Phase 6 C11 · 2026-04-21)

   요구: 대시보드에서 기능별로 확대하기 눌러 큰 화면에서 빠르게 입력.

   전역 API:
     window.openPowerView(tabKey)  — 'customer'|'booking'|'revenue'|'inventory'|'nps'|'service'
     window.closePowerView()

   구조:
     [탭바 6개] [오늘 요약 바] [빠른 입력 행] [목록 테이블 + 인라인 수정]

   단축: ESC 닫기, Tab 다음 입력, Enter 저장.
   ──────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const API = () => window.API || '';
  const AUTH = () => (window.authHeader ? window.authHeader() : {});
  const OVERLAY_ID = 'power-view-overlay';
  let currentTab = 'customer';
  let data = { customer: [], booking: [], revenue: [], inventory: [], nps: [], service: [] };

  function _esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch])); }
  function _krw(n) { return (n || 0).toLocaleString('ko-KR') + '원'; }

  const TABS = [
    { key: 'customer',  icon: '👥', label: '고객' },
    { key: 'booking',   icon: '📅', label: '예약' },
    { key: 'revenue',   icon: '💰', label: '매출' },
    { key: 'inventory', icon: '📦', label: '재고' },
    { key: 'nps',       icon: '⭐', label: 'NPS' },
    { key: 'service',   icon: '💅', label: '시술 프리셋' },
  ];

  // ── API fetch per tab ───────────────────────────────────
  async function _fetchTab(key) {
    const paths = {
      customer:  '/customers',
      booking:   '/bookings',
      revenue:   '/revenue?period=month',
      inventory: '/inventory',
      nps:       '/nps',
      service:   '/services',
    };
    try {
      const res = await fetch(API() + paths[key], { headers: AUTH() });
      if (!res.ok) return [];
      const d = await res.json();
      return d.items || [];
    } catch (e) { console.warn('[power-view] fetch', key, e); return []; }
  }

  // ── 각 탭별 표 헤더/행 스키마 ──────────────────────────
  const SCHEMAS = {
    customer: {
      headers: ['이름', '전화', '메모', '방문'],
      row: (r) => [r.name || '—', r.phone || '—', (r.memo||'').slice(0,30) || '—', (r.visit_count||0)+'회'],
      qadd: {
        fields: [
          { name: 'name',  placeholder: '이름', flex: 1.5, required: true },
          { name: 'phone', placeholder: '전화 010-...', flex: 1.5 },
          { name: 'memo',  placeholder: '메모(선택)', flex: 2 },
        ],
        endpoint: '/customers?force=true',
        build: (v) => ({ name: v.name.trim(), phone: v.phone?.trim() || null, memo: v.memo?.trim() || '', tags: [] }),
      },
    },
    booking: {
      headers: ['고객', '시술', '시간', '상태'],
      row: (r) => [r.customer_name || '—', r.service_name || '—', (r.starts_at||'').replace('T',' ').slice(0,16), r.status || 'confirmed'],
      qadd: {
        fields: [
          { name: 'customer_name', placeholder: '고객 이름', flex: 1 },
          { name: 'service_name',  placeholder: '시술',      flex: 1 },
          { name: 'starts_at',     placeholder: '시작 (YYYY-MM-DD HH:MM)', flex: 1.7, required: true },
          { name: 'minutes',       placeholder: '분',        flex: 0.5, type: 'number', default: 60 },
        ],
        endpoint: '/bookings',
        build: (v) => {
          const s = v.starts_at.replace(' ', 'T');
          const start = new Date(s);
          const mins = parseInt(v.minutes) || 60;
          const end = new Date(start.getTime() + mins * 60 * 1000);
          return {
            customer_name: v.customer_name?.trim() || null,
            service_name:  v.service_name?.trim() || null,
            starts_at: start.toISOString(),
            ends_at:   end.toISOString(),
          };
        },
      },
    },
    revenue: {
      headers: ['고객', '시술', '금액', '수단', '실 수령'],
      row: (r) => [
        r.customer_name || '—',
        r.service_name  || '—',
        _krw(r.amount),
        r.method || '—',
        r.net_amount != null ? _krw(r.net_amount) : _krw(r.amount),
      ],
      qadd: {
        fields: [
          { name: 'customer_name', placeholder: '고객',   flex: 1 },
          { name: 'service_name',  placeholder: '시술',   flex: 1 },
          { name: 'amount',        placeholder: '금액',   flex: 0.9, type: 'number', required: true },
          { name: 'method',        placeholder: 'card/cash/transfer', flex: 1, default: 'card' },
        ],
        endpoint: '/revenue',
        build: (v) => ({
          customer_name: v.customer_name?.trim() || null,
          service_name:  v.service_name?.trim() || null,
          amount: parseInt(v.amount),
          method: v.method || 'card',
        }),
      },
    },
    inventory: {
      headers: ['품목', '수량', '단위', '임계', '상태'],
      row: (r) => {
        const low = (r.quantity || 0) < (r.threshold || 0);
        return [r.name, r.quantity, r.unit || '개', r.threshold || '—', low ? '🔴 부족' : '🟢 정상'];
      },
      qadd: {
        fields: [
          { name: 'name',      placeholder: '품목 이름',   flex: 2, required: true },
          { name: 'quantity',  placeholder: '수량',         flex: 0.6, type: 'number' },
          { name: 'threshold', placeholder: '임계',         flex: 0.6, type: 'number', default: 3 },
          { name: 'category',  placeholder: 'nail|hair|lash|skin|etc', flex: 1 },
        ],
        endpoint: '/inventory',
        build: (v) => ({
          name: v.name.trim(), unit: '개',
          quantity: parseInt(v.quantity) || 0,
          threshold: parseInt(v.threshold) || 3,
          category: v.category?.trim() || 'etc',
        }),
      },
    },
    nps: {
      headers: ['평점', '코멘트', '출처', '날짜'],
      row: (r) => [`★${r.rating}`, (r.comment || '').slice(0, 40) || '—', r.source || 'manual', (r.responded_at || '').slice(0, 10) || '—'],
      qadd: {
        fields: [
          { name: 'rating',  placeholder: '평점(0~10)', flex: 0.6, type: 'number', required: true },
          { name: 'comment', placeholder: '후기 내용',  flex: 3 },
        ],
        endpoint: '/nps',
        build: (v) => ({ rating: parseInt(v.rating), comment: v.comment?.trim() || '', source: 'manual' }),
      },
    },
    service: {
      headers: ['이름', '기본 금액', '소요 시간', '분류'],
      row: (r) => [r.name, _krw(r.default_price), (r.default_duration_min || 0)+'분', r.category || 'etc'],
      qadd: {
        fields: [
          { name: 'name',              placeholder: '시술명',       flex: 1.4, required: true },
          { name: 'default_price',     placeholder: '기본 금액',    flex: 0.8, type: 'number' },
          { name: 'default_duration_min', placeholder: '소요(분)', flex: 0.6, type: 'number', default: 60 },
          { name: 'category',          placeholder: 'hair|nail|eye|skin|etc', flex: 1 },
        ],
        endpoint: '/services',
        build: (v) => ({
          name: v.name.trim(),
          default_price: parseInt(v.default_price) || 0,
          default_duration_min: parseInt(v.default_duration_min) || 60,
          category: v.category?.trim() || 'etc',
        }),
      },
    },
  };

  // ── 렌더링 ──────────────────────────────────────────────
  async function _renderTab() {
    const body = document.getElementById('pv-body');
    if (!body) return;
    const schema = SCHEMAS[currentTab];
    body.innerHTML = `<div style="padding:40px;text-align:center;color:#aaa;">불러오는 중…</div>`;

    data[currentTab] = await _fetchTab(currentTab);

    const qadd = schema.qadd;
    const fieldsHtml = qadd.fields.map(f => `
      <input
        data-field="${f.name}"
        type="${f.type || 'text'}"
        placeholder="${f.placeholder}"
        ${f.default !== undefined ? `value="${f.default}"` : ''}
        style="flex:${f.flex};min-width:0;padding:12px 14px;border:1px solid #ddd;border-radius:10px;font-size:14px;background:#fff;"
      />
    `).join('');

    const headers = schema.headers.map(h =>
      `<th style="padding:12px 14px;text-align:left;font-size:12px;color:#666;font-weight:700;border-bottom:2px solid #eee;background:#fafafa;position:sticky;top:0;">${h}</th>`
    ).join('');

    const rows = (data[currentTab] || []).map(r => {
      const cells = schema.row(r).map(c =>
        `<td style="padding:12px 14px;font-size:13px;color:#333;border-bottom:1px solid #f0f0f0;">${_esc(c)}</td>`
      ).join('');
      return `<tr data-id="${r.id}" style="transition:background 0.15s;">${cells}</tr>`;
    }).join('');

    const emptyRow = !rows ? `
      <tr><td colspan="${schema.headers.length}" style="padding:40px;text-align:center;color:#aaa;font-size:14px;">
        아직 데이터가 없어요. 위 입력 행에 추가해 보세요 (Enter로 저장).
      </td></tr>` : '';

    body.innerHTML = `
      <div id="pv-qadd" style="display:flex;gap:8px;padding:16px;background:linear-gradient(135deg,#FEF4F5,#fff);border-bottom:1px solid #eee;">
        ${fieldsHtml}
        <button id="pv-add-btn" style="padding:12px 18px;background:linear-gradient(135deg,#F18091,#D95F70);color:#fff;border:none;border-radius:10px;font-weight:800;cursor:pointer;font-size:13px;white-space:nowrap;box-shadow:0 3px 10px rgba(241,128,145,0.3);">
          추가 (Enter)
        </button>
      </div>
      <div style="overflow:auto;flex:1;background:#fff;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>${headers}</tr></thead>
          <tbody id="pv-tbody">${rows}${emptyRow}</tbody>
        </table>
      </div>
      <div style="padding:10px 16px;border-top:1px solid #eee;background:#fafafa;font-size:12px;color:#888;display:flex;justify-content:space-between;">
        <span>총 ${(data[currentTab] || []).length}건</span>
        <span>단축: <kbd style="background:#eee;padding:1px 6px;border-radius:4px;">Enter</kbd> 저장 · <kbd style="background:#eee;padding:1px 6px;border-radius:4px;">Tab</kbd> 다음칸 · <kbd style="background:#eee;padding:1px 6px;border-radius:4px;">Esc</kbd> 닫기</span>
      </div>
    `;
    _bindQuickAdd();
    _focusFirstInput();
  }

  function _focusFirstInput() {
    const first = document.querySelector('#pv-qadd input');
    if (first) first.focus();
  }

  async function _submitQuickAdd() {
    const schema = SCHEMAS[currentTab];
    const inputs = document.querySelectorAll('#pv-qadd input[data-field]');
    const v = {};
    let missing = null;
    inputs.forEach(i => { v[i.getAttribute('data-field')] = i.value; });
    schema.qadd.fields.forEach(f => { if (f.required && !v[f.name]?.trim()) missing = f.name; });
    if (missing) {
      if (window.showToast) window.showToast(`⚠️ 필수 필드: ${missing}`);
      const el = document.querySelector(`#pv-qadd input[data-field="${missing}"]`);
      if (el) el.focus();
      return;
    }
    try {
      const body = schema.qadd.build(v);
      const res = await fetch(API() + schema.qadd.endpoint, {
        method: 'POST',
        headers: { ...AUTH(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = (typeof err.detail === 'string' ? err.detail : err.detail?.message) || res.statusText;
        throw new Error(msg);
      }
      if (window.hapticSuccess) window.hapticSuccess();
      if (window.showToast) window.showToast('✅ 추가됨');
      inputs.forEach(i => {
        const field = schema.qadd.fields.find(f => f.name === i.getAttribute('data-field'));
        i.value = (field && field.default !== undefined) ? field.default : '';
      });
      _renderTab();
      if (window.Dashboard?.refresh) window.Dashboard.refresh(true);
    } catch (e) {
      if (window.showToast) window.showToast('실패: ' + e.message);
    }
  }

  function _bindQuickAdd() {
    const btn = document.getElementById('pv-add-btn');
    if (btn) btn.addEventListener('click', _submitQuickAdd);
    document.querySelectorAll('#pv-qadd input').forEach((el, idx, all) => {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); _submitQuickAdd(); }
      });
    });
  }

  function _bindTabs() {
    document.querySelectorAll('[data-pv-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-pv-tab');
        if (key === currentTab) return;
        currentTab = key;
        document.querySelectorAll('[data-pv-tab]').forEach(b => {
          const active = b.getAttribute('data-pv-tab') === key;
          b.style.background = active ? '#fff' : 'transparent';
          b.style.color = active ? '#F18091' : '#666';
          b.style.borderBottom = active ? '2px solid #F18091' : '2px solid transparent';
        });
        if (window.hapticLight) window.hapticLight();
        _renderTab();
      });
    });
  }

  function _escListener(e) {
    if (e.key === 'Escape') closePowerView();
  }

  // ── open / close ───────────────────────────────────────
  function openPowerView(tabKey) {
    if (tabKey && SCHEMAS[tabKey]) currentTab = tabKey;
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.55);
      display:flex;align-items:stretch;justify-content:center;padding:16px;
      animation:pvFadeIn 0.2s ease;
    `;

    const tabHtml = TABS.map(t => `
      <button data-pv-tab="${t.key}" style="
        flex:1;padding:14px 10px;border:none;background:${t.key === currentTab ? '#fff' : 'transparent'};
        color:${t.key === currentTab ? '#F18091' : '#666'};
        font-weight:800;font-size:13px;cursor:pointer;
        border-bottom:2px solid ${t.key === currentTab ? '#F18091' : 'transparent'};
        transition:all 0.15s;white-space:nowrap;">
        ${t.icon} ${t.label}
      </button>
    `).join('');

    overlay.innerHTML = `
      <style>@keyframes pvFadeIn{from{opacity:0}to{opacity:1}}</style>
      <div style="width:100%;max-width:1080px;background:#fff;border-radius:20px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <!-- 헤더 -->
        <div style="display:flex;align-items:center;padding:14px 20px;border-bottom:1px solid #eee;background:#fafafa;">
          <div style="font-size:16px;font-weight:900;color:#222;flex:1;">⛶ 파워뷰 — 빠른 입력</div>
          <button onclick="window.closePowerView()" style="width:36px;height:36px;border:none;border-radius:10px;background:#eee;cursor:pointer;font-size:18px;">✕</button>
        </div>
        <!-- 탭바 -->
        <div style="display:flex;background:#f7f7f7;border-bottom:1px solid #eee;overflow-x:auto;">
          ${tabHtml}
        </div>
        <!-- 본문 -->
        <div id="pv-body" style="flex:1;display:flex;flex-direction:column;min-height:420px;max-height:calc(100vh - 200px);"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', _escListener);
    _bindTabs();
    _renderTab();
  }

  function closePowerView() {
    const o = document.getElementById(OVERLAY_ID);
    if (o) o.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', _escListener);
  }

  window.openPowerView = openPowerView;
  window.closePowerView = closePowerView;
})();
