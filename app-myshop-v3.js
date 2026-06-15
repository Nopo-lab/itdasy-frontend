/* 내샵관리 v3 렌더러 — 모바일 메인 + PC 사이드바·도넛·위젯·피드.
   SWR: 캐시 즉시 → 백그라운드 fetch. 데이터: /today/brief.
   AI 허브 / 설정 허브 시트는 별도 (app-ai-hub.js / app-settings-hub.js).
   외부 anchor (#dashboardMetrics, .dashboard-topbar, #tab-ai-suggest) 손대지 않음.
   window.MyShopV3 = { render(containerId), refresh() } */
(function () {
  'use strict';

  const SWR_KEY = 'mv3_cache::brief';
  const SWR_TTL = 60 * 1000;

  // ─────────── XSS escape ───────────
  function _esc(s) { return window._esc(s); } /* [2026-06-11] 중복 제거 — app-core 정본 위임 */

  // ─────────── SWR cache ───────────
  function _readSWR() {
    try {
      const raw = localStorage.getItem(SWR_KEY) || sessionStorage.getItem(SWR_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      return { d: obj.d, fresh: Date.now() - obj.t < SWR_TTL };
    } catch (_e) { return null; }
  }
  function _writeSWR(data) {
    try {
      const payload = JSON.stringify({ t: Date.now(), d: data });
      try { localStorage.setItem(SWR_KEY, payload); }
      catch (_e1) { try { sessionStorage.setItem(SWR_KEY, payload); } catch (_e2) { void _e2; } }
    } catch (_e) { /* silent */ }
  }

  // ─────────── fetch ───────────
  function _authHeaders() {
    try {
      const headers = window.authHeader ? window.authHeader() : {};
      return headers && headers.Authorization ? headers : null;
    } catch (_e) { return null; }
  }
  async function _fetchBrief() {
    // [2026-05-12 QA] 내샵 화면이 기대하는 필드 (today_bookings 배열, at_risk 배열, low_stock 배열,
    // this_month_total, total_customers, new_customer_count 등) 는 /assistant/brief 에 있음.
    // /today/brief 는 *_count 만 반환해서 카운트 0건 표시되던 문제 픽스.
    const headers = _authHeaders();
    if (!window.API || !headers) return null;
    try {
      const res = await apiFetch('/assistant/brief', { headers });
      if (!res.ok) return null;
      const data = await _withBookingRevenue(await res.json());
      _writeSWR(data);
      return data;
    } catch (_e) { return null; }
  }
  async function _withBookingRevenue(data) {
    if (!window.BookingRevenueOverlay || typeof window.BookingRevenueOverlay.enrichBrief !== 'function') return data;
    try { return await window.BookingRevenueOverlay.enrichBrief(data); }
    catch (err) {
      console.warn('[myshop] 예약금 보강 실패:', err);
      return data;
    }
  }
  // ─────────── 헬퍼 ───────────
  function _shopName() {
    // 2026-05-01 ── 인스타 핸들 우선. shop_name 이 'd' 같은 임시값이면 IG 핸들 보여주는 게 자연스러움.
    try {
      const ig = localStorage.getItem('itdasy:ig_handle');
      if (ig) return ig;
      return localStorage.getItem('shop_name') || '내 샵';
    } catch (_e) { return '내 샵'; }
  }
  function _shopInitial(shop) {
    return ((shop || '내')[0] || '내').toUpperCase();
  }
  function _shopAvatarUrl() {
    try { return localStorage.getItem('itdasy:ig_profile_pic') || ''; }
    catch (_e) { return ''; }
  }
  function _planLabel() {
    try {
      if (typeof window.getCurrentPlanLabel === 'function') return window.getCurrentPlanLabel();
      const badge = document.getElementById('planBadge');
      const text = badge && badge.textContent ? badge.textContent.trim() : '';
      return text || '체험';
    } catch (_e) { return '체험'; }
  }
  function _planText() {
    return _planLabel().replace(/\s*플랜$/g, '');
  }
  // [2026-05-19] _won/_wonShort 삭제 → formatMoney (format-money.js 공통 유틸)
  function _todayYMD() {
    // [2026-06-10] 로컬 날짜로 — toISOString()은 UTC 라 KST 0~9시에 어제로 어긋남.
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }
  function _todayBookingsList(brief) {
    // [2026-06-10] 취소·노쇼 제외 — 홈/캘린더와 카운트 기준 통일 (BE 필터의 이중 방어).
    const list = (brief && brief.today_bookings) || [];
    const ymd = _todayYMD();
    return list
      .filter(b => b.status !== 'cancelled' && b.status !== 'no_show')
      .filter(b => (b.starts_at || '').startsWith(ymd))
      .sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)));
  }
  function _hhmm(iso) {
    try {
      const d = new Date(iso);
      return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    } catch (_e) { return ''; }
  }
  function _automationOnCount() {
    // 2026-05-01 ── ai-hub 와 동일 source 로 통일 — 이전엔 다른 키 보고 항상 0.
    if (typeof window.aihGetOnCount === 'function') {
      try { return window.aihGetOnCount(); } catch (_e) { /* fallback */ }
    }
    // 폴백: ai-hub 가 아직 안 로드됐을 때
    let on = 1;  // 페르소나 학습됨 = 기본 1
    try {
      const v1 = localStorage.getItem('itdasy:aih:dm_enabled');
      const v2 = localStorage.getItem('itdasy:aih:kakao_enabled');
      if (v1 === null || v1 === 'true') on += 1;
      if (v2 === null || v2 === 'true') on += 1;
    } catch (_e) { /* ignore */ }
    return on;
  }

  // ─────────── 헤더 (모바일) — v212 제거: 샵카드와 중복 ───────────
  function _renderHeader() {
    return '';
  }

  // ─────────── 샵 카드 ───────────
  function _shopStats(brief) {
    const rev = (brief && brief.this_month_total) || 0;
    const mom = brief && (brief.mom_delta_pct != null ? brief.mom_delta_pct : null);
    const newC = brief && (brief.new_customer_count != null ? brief.new_customer_count : null);
    const totalC = brief && (brief.total_customers != null ? brief.total_customers : null);
    const atRiskN = brief && Array.isArray(brief.at_risk) ? brief.at_risk.length :
                    (brief && typeof brief.at_risk_count === 'number' ? brief.at_risk_count : 0);
    const todayN = _todayBookingsList(brief).length;
    const pendingN = brief && Array.isArray(brief.pending_bookings) ? brief.pending_bookings.length : 0;

    const custVal = totalC != null ? `${totalC}명` : (atRiskN ? `이탈 ${atRiskN}` : '—');
    // [2026-06-03] 신규 단일수치 → 방문 기준 3분해. BE 새 필드 없으면(미배포·구캐시) 기존 '신규 N' 폴백.
    const fv = brief && brief.first_visit_count;
    const rv = brief && brief.revisit_count;
    const rg = brief && brief.regular_count;
    const has3 = [fv, rv, rg].some(v => v != null);
    const custTrend = has3
      ? `첫방문 ${fv || 0} · 재방문 ${rv || 0} · 단골 ${rg || 0}`
      : (newC != null ? `신규 ${newC}` : (atRiskN ? `이탈 위험 ${atRiskN}명` : ''));
    const bookVal = `${todayN}건`;
    const bookTrend = pendingN ? `대기 ${pendingN}건` : '오늘 예약';

    return { rev, custVal, custTrend, bookVal, bookTrend };
  }
  function _renderShopCard(brief) {
    const shop = _shopName();
    const initial = _shopInitial(shop);
    const avatarUrl = _shopAvatarUrl();
    const avatarHTML = avatarUrl
      ? `<img src="${_esc(avatarUrl)}" alt="" data-ms-avatar-fallback="${_esc(initial)}" referrerpolicy="no-referrer" style="width:100%;height:100%;border-radius:inherit;object-fit:cover;">`
      : _esc(initial);
    const s = _shopStats(brief);
    return `
      <div class="ms-shop">
        <div class="ms-shop__top">
          <div class="ms-shop__avatar" aria-hidden="true">${avatarHTML}</div>
          <div class="ms-shop__info">
            <div class="ms-shop__name">${_esc(shop)}</div>
            <div class="ms-shop__plan">${_esc(_planText())}</div>
          </div>
          <button type="button" class="ms-shop__edit" data-mv-act="editShop" aria-label="샵 정보 편집">
            <i class="ph-duotone ph-pencil-simple" style="font-size:14px" aria-hidden="true"></i>
          </button>
        </div>
        <div class="ms-shop__stats">
          <div class="ms-shop__stat">
            <div class="ms-shop__stat-label">이번달 매출</div>
            <div class="ms-shop__stat-value">${_esc(formatMoney(s.rev))}</div>
          </div>
          <div class="ms-shop__stat">
            <div class="ms-shop__stat-label">고객</div>
            <div class="ms-shop__stat-value">${_esc(s.custVal)}</div>
            ${s.custTrend ? `<div class="ms-shop__stat-trend">${_esc(s.custTrend)}</div>` : ''}
          </div>
          <div class="ms-shop__stat">
            <div class="ms-shop__stat-label">예약</div>
            <div class="ms-shop__stat-value">${_esc(s.bookVal)}</div>
            <div class="ms-shop__stat-trend is-amber">${_esc(s.bookTrend)}</div>
          </div>
        </div>
      </div>
    `;
  }

  // ─────────── 운영 메뉴 4개 ───────────
  // 메뉴 행 한 개를 만드는 헬퍼 (운영 / 허브 / 계정 공통)
  const _CHEV_SVG = '<svg class="ms-menu__chev" width="16" height="16" aria-hidden="true"><use href="#ic-chevron-right"/></svg>';
  function _menuItemHTML(opt) {
    // opt: { act, iconSVG, iconClass, name, meta, metaClass, badge }
    const iconCls = opt.iconClass ? ` ${opt.iconClass}` : '';
    const metaCls = opt.metaClass ? ` ${opt.metaClass}` : '';
    const right = opt.badge != null
      ? `<div class="ms-menu__right"><span class="ms-menu__badge">${_esc(opt.badge)}</span>${_CHEV_SVG}</div>`
      : _CHEV_SVG;
    return `
      <button type="button" class="ms-menu__item" data-mv-act="${_esc(opt.act)}">
        <div class="ms-menu__icon${iconCls}">${opt.iconSVG}</div>
        <div class="ms-menu__info">
          <div class="ms-menu__name">${_esc(opt.name)}</div>
          <div class="ms-menu__meta${metaCls}">${_esc(opt.meta)}</div>
        </div>
        ${right}
      </button>`;
  }
  function _opsMetaList(brief) {
    const todayN = _todayBookingsList(brief).length;
    const totalC = brief && (brief.total_customers != null ? brief.total_customers : null);
    const atRiskN = brief && Array.isArray(brief.at_risk) ? brief.at_risk.length : 0;
    const rev = (brief && brief.this_month_total) || 0;
    const mom = brief && (brief.mom_delta_pct != null ? brief.mom_delta_pct : null);
    const lowStock = brief && Array.isArray(brief.low_stock) ? brief.low_stock.length :
                     (brief && typeof brief.low_stock === 'number' ? brief.low_stock : 0);
    return {
      bookMeta: `오늘 ${todayN}건`,
      custMeta: totalC != null
        ? `${totalC}명${atRiskN ? ` · 이탈 위험 ${atRiskN}명` : ''}`
        : (atRiskN ? `이탈 위험 ${atRiskN}명` : '고객 관리'),
      atRiskN,
      revMeta: `${formatMoney(rev)}${mom != null ? ` · ${mom >= 0 ? '+' : ''}${Number(mom).toFixed(0)}%` : ''}`,
      stockMeta: lowStock > 0 ? `${lowStock}개 부족` : '재고 정상',
      lowStock,
    };
  }
  function _renderOpsMenu(brief) {
    const m = _opsMetaList(brief);
    const items = [
      _menuItemHTML({ act: 'booking', iconClass: 'ms-menu__icon--teal', iconSVG: '<svg width="20" height="20" aria-hidden="true"><use href="#ic-calendar-check"/></svg>', name: '예약관리', meta: m.bookMeta }),
      _menuItemHTML({ act: 'customer', iconClass: 'ms-menu__icon--blue', iconSVG: '<svg width="20" height="20" aria-hidden="true"><use href="#ic-users"/></svg>', name: '고객관리', meta: m.custMeta, metaClass: m.atRiskN ? 'is-danger' : '' }),
      _menuItemHTML({ act: 'customerDm', iconClass: 'ms-menu__icon--pink', iconSVG: '<svg width="20" height="20" aria-hidden="true"><use href="#ic-message-circle"/></svg>', name: '실시간 DM', meta: '답장 필요 · 잇비 초안' }),
      _menuItemHTML({ act: 'revenue', iconClass: 'ms-menu__icon--amber', iconSVG: '<svg width="20" height="20" aria-hidden="true"><use href="#ic-wallet"/></svg>', name: '매출관리', meta: m.revMeta, metaClass: 'is-ok' }),
      /* INVENTORY_HIDDEN */ // _menuItemHTML({ act: 'inventory', iconClass: 'ms-menu__icon--coral', iconSVG: '<svg width="20" height="20" aria-hidden="true"><use href="#ic-package"/></svg>', name: '재고관리', meta: m.stockMeta, metaClass: m.lowStock > 0 ? 'is-danger' : '', badge: m.lowStock > 0 ? m.lowStock : null }),
    ].join('');
    return `<div class="ms-section"><div class="ms-section__title">운영 관리</div><div class="ms-menu">${items}</div></div>`;
  }

  // ─────────── 통합 허브 메뉴 2개 ───────────
  function _renderHubMenu() {
    const automationOn = _automationOnCount();
    const automationTotal = 7;
    const items = [
      _menuItemHTML({ act: 'aiHub', iconClass: 'ms-menu__icon--purple', iconSVG: '<svg width="20" height="20" aria-hidden="true"><use href="#ic-sparkles"/></svg>', name: '잇비 · 자동화', meta: `${automationOn}개 켜짐 · ${automationTotal - automationOn}개 꺼짐`, badge: automationTotal }),
      _menuItemHTML({ act: 'settings', iconClass: 'ms-menu__icon--gray', iconSVG: '<svg width="20" height="20" aria-hidden="true"><use href="#ic-settings"/></svg>', name: '연동관리', meta: '샵정보 · 직원 · 네이버 · 백업' }),
    ].join('');
    return `<div class="ms-section"><div class="ms-section__title">통합 허브</div><div class="ms-menu">${items}</div></div>`;
  }

  // ─────────── 계정 메뉴 2개 ───────────
  function _renderAccountMenu() {
    const planLabel = _planLabel();
    const items = [
      _menuItemHTML({ act: 'plan', iconClass: 'ms-menu__icon--pink', iconSVG: '<svg width="20" height="20" aria-hidden="true"><use href="#ic-id-card"/></svg>', name: '플랜 · 구독', meta: planLabel }),
      _menuItemHTML({ act: 'support', iconClass: 'ms-menu__icon--gray', iconSVG: '<svg width="20" height="20" aria-hidden="true"><use href="#ic-message-circle"/></svg>', name: '도움말 · 문의', meta: '사용법 · 문의하기' }),
    ].join('');
    return `<div class="ms-section"><div class="ms-section__title">계정</div><div class="ms-menu">${items}</div></div>`;
  }

  // ─────────── 하단 푸터 링크 (쿠팡식 · 모바일 전용) ───────────
  // [2026-06-09] 고객센터·로그아웃을 내샵관리 맨 아래 회색 작은 텍스트로 일원화.
  function _renderFooterLinks() {
    const linkStyle = 'background:none;border:0;padding:6px 10px;font-size:12px;color:var(--text-subtle);font-family:inherit;cursor:pointer;';
    return `
      <div class="ms-foot" style="display:flex;align-items:center;justify-content:center;gap:4px;padding:20px 0 28px;">
        <button type="button" data-mv-act="support" style="${linkStyle}">고객센터</button>
        <span style="color:var(--border-strong);font-size:11px;">|</span>
        <button type="button" data-mv-act="logout" style="${linkStyle}">로그아웃</button>
      </div>`;
  }

  // ─────────── PC 사이드바 ───────────
  // 사이드바 행 헬퍼
  function _sideItemHTML(opt) {
    // opt: { act, iconSVG, label, badge, badgeClass, active }
    const cls = `ms-side__item${opt.active ? ' is-active' : ''}`;
    const aria = opt.active ? ' aria-current="page"' : '';
    const badge = opt.badge != null
      ? `<span class="ms-side__badge${opt.badgeClass ? ' ' + opt.badgeClass : ''}">${_esc(opt.badge)}</span>`
      : '';
    return `
      <button type="button" class="${cls}" data-mv-act="${_esc(opt.act || '')}"${aria}>
        <span class="ms-side__icon">${opt.iconSVG}</span>
        <span class="ms-side__label">${_esc(opt.label)}</span>
        ${badge}
      </button>`;
  }
  function _sideOpsHTML(brief) {
    const todayN = _todayBookingsList(brief).length;
    return [
      '<div class="ms-side__section">운영</div>',
      _sideItemHTML({ act: 'booking',   iconSVG: '<svg width="20" height="20" aria-hidden="true"><use href="#ic-calendar-check"/></svg>',    label: '예약관리', badge: todayN > 0 ? todayN : null, badgeClass: 'is-ok' }),
      _sideItemHTML({ act: 'customer',  iconSVG: '<svg width="20" height="20" aria-hidden="true"><use href="#ic-users"/></svg>',       label: '고객관리' }),
      _sideItemHTML({ act: 'customerDm', iconSVG: '<svg width="20" height="20" aria-hidden="true"><use href="#ic-message-circle"/></svg>', label: '실시간 DM' }),
      _sideItemHTML({ act: 'revenue',   iconSVG: '<svg width="20" height="20" aria-hidden="true"><use href="#ic-wallet"/></svg>', label: '매출관리' }),
      /* INVENTORY_HIDDEN */ // _sideItemHTML({ act: 'inventory', iconSVG: '<svg width="20" height="20" aria-hidden="true"><use href="#ic-package"/></svg>', label: '재고관리', badge: lowStock > 0 ? lowStock : null }),
    ].join('');
  }
  function _sideHubHTML() {
    const automationOn = _automationOnCount();
    return [
      '<div class="ms-side__section">통합 허브</div>',
      _sideItemHTML({ act: 'aiHub',    iconSVG: '<svg width="20" height="20" aria-hidden="true"><use href="#ic-sparkles"/></svg>', label: '잇비 · 자동화', badge: `${automationOn}/7`, badgeClass: 'is-ok' }),
      _sideItemHTML({ act: 'settings', iconSVG: '<svg width="20" height="20" aria-hidden="true"><use href="#ic-settings"/></svg>', label: '연동관리' }),
    ].join('');
  }
  function _sideAccountHTML() {
    const planLabel = _planLabel();
    return [
      '<div class="ms-side__section">계정</div>',
      _sideItemHTML({ act: 'plan',    iconSVG: '<svg width="20" height="20" aria-hidden="true"><use href="#ic-id-card"/></svg>',           label: '플랜 · ' + planLabel }),
      _sideItemHTML({ act: 'support', iconSVG: '<svg width="20" height="20" aria-hidden="true"><use href="#ic-message-circle"/></svg>', label: '도움말' }),
    ].join('');
  }
  function _renderPCSidebar(brief) {
    const top = [
      _sideItemHTML({ act: 'goHome',     iconSVG: '<svg width="20" height="20" aria-hidden="true"><use href="#ic-home"/></svg>',  label: '홈' }),
      _sideItemHTML({ active: true,      iconSVG: '<svg width="20" height="20" aria-hidden="true"><use href="#ic-store"/></svg>', label: '내샵관리' }),
    ].join('');
    return `
      <aside class="ms-side" aria-label="내샵관리 사이드바">
        <div class="ms-side__logo">잇데이</div>
        ${top}
        ${_sideOpsHTML(brief)}
        ${_sideHubHTML()}
        ${_sideAccountHTML()}
        <button type="button" class="ms-side__fab" data-mv-act="createShortcut">
          <i class="ph-duotone ph-sparkle" aria-hidden="true"></i>
          만들기
        </button>
      </aside>
    `;
  }

  // ─────────── PC 도넛 데이터 ───────────
  // [Step 5 · 2026-05-16] brief.payment_breakdown 실데이터 연결 — 0건 항목 미표시
  function _buildDonutData(brief) {
    const total = (brief && brief.this_month_total) || 0;
    const pm = brief && brief.payment_breakdown;
    if (!total || !pm) {
      return {
        total,
        rows: [{ name: '데이터 없음', value: 0, pct: 100, color: 'var(--border-strong)' }],
        gradient: 'var(--border-strong)',
      };
    }
    const LBL = { card: '카드', cash: '현금', transfer: '계좌', booking_deposit: '예약금', membership: '회원권', etc: '기타' };
    const COLORS = [
      'var(--brand-strong)',
      'color-mix(in srgb, var(--brand-strong) 55%, var(--surface))',
      'color-mix(in srgb, var(--brand-strong) 22%, var(--surface))',
      'var(--text-subtle)',
      'var(--border-strong)',
    ];
    const sumPM = Object.values(pm).reduce((s, v) => s + (+v || 0), 0);
    const base = sumPM || total;  // 합이 0 이면 분포 표시 의미 없음
    const rows = Object.entries(pm)
      .filter(([, v]) => (+v || 0) > 0)
      .sort((a, b) => (b[1] || 0) - (a[1] || 0))
      .map(([k, v], i) => ({
        name: LBL[k] || k,
        value: +v || 0,
        pct: Math.round((+v || 0) * 100 / base),
        color: COLORS[i] || 'var(--border-strong)',
      }));
    if (!rows.length) {
      return {
        total,
        rows: [{ name: '데이터 없음', value: 0, pct: 100, color: 'var(--border-strong)' }],
        gradient: 'var(--border-strong)',
      };
    }
    let acc = 0;
    const stops = rows.map(r => {
      const start = acc; const end = acc + (r.pct / 100) * 360;
      acc = end;
      return `${r.color} ${start}deg ${end}deg`;
    }).join(', ');
    return { total, rows, gradient: `conic-gradient(${stops})` };
  }

  // ─────────── PC 도넛 + 위젯 + 피드 ───────────
  function _renderPCDonut(brief) {
    const d = _buildDonutData(brief);
    const legend = d.rows.map(r => `
      <div class="ms-legend__row">
        <span class="ms-legend__dot" style="background:${r.color};"></span>
        <span class="ms-legend__name">${_esc(r.name)}</span>
        <span class="ms-legend__value">${_esc(formatMoney(r.value))}</span>
        <span class="ms-legend__pct">${_esc(r.pct)}%</span>
      </div>
    `).join('');
    return `
      <div class="ms-chart">
        <div class="ms-chart__head">
          <div>
            <div class="ms-chart__title">이번달 매출 분포</div>
            <div class="ms-chart__sub">결제 방식별</div>
          </div>
          <button type="button" class="ms-chart__link" data-mv-act="revenue">매출관리 →</button>
        </div>
        <div class="ms-chart__body">
          <div class="ms-donut" style="background:${d.gradient};" aria-hidden="true">
            <div class="ms-donut__center">
              <div class="ms-donut__total">${_esc(formatMoney(d.total))}</div>
              <div class="ms-donut__label">이번달 합계</div>
            </div>
          </div>
          <div class="ms-legend">${legend}</div>
        </div>
      </div>
    `;
  }
  function _renderPCWidgets(brief) {
    const todayN = _todayBookingsList(brief).length;
    const next = _todayBookingsList(brief)[0];
    const nextLabel = next
      ? `다음 ${_hhmm(next.starts_at)} ${_esc(next.customer_name || next.name || '')}`
      : '오늘 예약 없음';
    const memExp = brief && typeof brief.membership_expiring_30d === 'number' ? brief.membership_expiring_30d : 0;
    // TODO[v1.5]: 회원권 만료 카운트 — brief.membership_expiring_30d 백엔드 응답 확인 필요
    const atRiskN = brief && Array.isArray(brief.at_risk) ? brief.at_risk.length :
                    (brief && typeof brief.at_risk_count === 'number' ? brief.at_risk_count : 0);
    const automationOn = _automationOnCount();
    return `
      <div class="ms-widgets">
        <button type="button" class="ms-widget" data-mv-act="booking">
          <div class="ms-widget__label">오늘 예약</div>
          <div class="ms-widget__value">${todayN}건</div>
          <div class="ms-widget__meta">${_esc(nextLabel)}</div>
        </button>
        <button type="button" class="ms-widget" data-mv-act="customer">
          <div class="ms-widget__label">회원권 만료 임박</div>
          <div class="ms-widget__value is-amber">${memExp}건</div>
          <div class="ms-widget__meta">7일 이내 · 충전 안내</div>
        </button>
        <button type="button" class="ms-widget" data-mv-act="customer">
          <div class="ms-widget__label">이탈 위험</div>
          <div class="ms-widget__value is-amber">${atRiskN}명</div>
          <div class="ms-widget__meta">90일+ 미방문</div>
        </button>
        <button type="button" class="ms-widget" data-mv-act="aiHub">
          <div class="ms-widget__label">자동화</div>
          <div class="ms-widget__value is-ok">${automationOn}/7</div>
          <div class="ms-widget__meta">DM · 카톡 · 페르소나 외</div>
        </button>
      </div>
    `;
  }

  // ─────────── 활동 피드 ───────────
  function _buildActivityFeed(brief) {
    // 활동 피드 — 백엔드 미존재 → fallback: 빈 상태
    // TODO[v1.5]: brief.recent_activities 백엔드 추가 시 매핑
    const list = brief && Array.isArray(brief.recent_activities) ? brief.recent_activities : [];
    if (!list.length) {
      return [{
        icon: 'info',
        text: '최근 활동 없음 · 예약·시술이 기록되면 여기에 표시돼요',
        time: '',
      }];
    }
    return list.slice(0, 5);
  }
  function _feedIconSVG(kind) {
    const map = { check: 'ph-check-circle', dm: 'ph-chat-circle', msg: 'ph-envelope-simple', stock: 'ph-package', info: 'ph-info' };
    return '<i class="ph-duotone ' + (map[kind] || map.info) + '" style="font-size:14px" aria-hidden="true"></i>';
  }
  function _renderPCFeed(brief) {
    const items = _buildActivityFeed(brief);
    const rows = items.map(it => `
      <div class="ms-feed__row">
        <div class="ms-feed__icon">${_feedIconSVG(it.icon || 'info')}</div>
        <div class="ms-feed__text">${_esc(it.text || '')}</div>
        ${it.time ? `<div class="ms-feed__time">${_esc(it.time)}</div>` : ''}
      </div>
    `).join('');
    return `
      <div class="ms-section__title" style="margin: 14px 0 8px;">최근 활동</div>
      <div class="ms-feed">${rows}</div>
    `;
  }

  // ─────────── PC 메인 컴포지션 ───────────
  // [2026-05-16] 인스타 말투 분석 리포트 카드 — 홈에서 내샵관리로 이전 (사용자 요청).
  // 데이터 소스: localStorage('itdasy_latest_analysis') — 인스타 분석 완료 시 저장됨.
  // 접어두기: localStorage('ms_persona_collapsed') = '1' / '0'.
  function _ensureMsPersonaStyles() {
    if (document.getElementById('msPersonaStyles')) return;
    const s = document.createElement('style');
    s.id = 'msPersonaStyles';
    s.textContent = `
      .ms-persona { background:#fff; border:1px solid #E5E8EB; border-radius:16px; padding:16px 18px; margin:12px 0; box-shadow:0 2px 8px rgba(0,0,0,0.04); }
      .ms-persona__head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .ms-persona__title { font-size:14px; font-weight:700; color:#191F28; letter-spacing:-0.2px; }
      .ms-persona__toggle { padding:6px 12px; border:1px solid #E5E8EB; background:#fff; border-radius:999px; font-size:12px; font-weight:600; color:#4E5968; cursor:pointer; }
      .ms-persona__toggle:hover { background:#F7F8FA; }
      .ms-persona__body { margin-top:12px; padding:14px 16px; background:rgba(213,138,149,0.06); border-radius:12px; border:1px solid rgba(213,138,149,0.15); }
      .ms-persona__label { font-size:11px; font-weight:700; color:#BC6675; letter-spacing:-0.2px; margin-bottom:6px; }
      .ms-persona__summary { font-size:13px; color:#191F28; line-height:1.6; font-weight:500; }
      .ms-persona__detail { margin-top:12px; padding:10px 14px; border:1px solid #BC6675; background:#fff; color:#BC6675; border-radius:10px; font-size:12px; font-weight:600; cursor:pointer; }
      .ms-persona__detail:hover { background:#F7EFF0; }
    `;
    document.head.appendChild(s);
  }
  function _renderPersonaCard() {
    _ensureMsPersonaStyles();
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem('itdasy_latest_analysis') || '{}'); } catch (_e) { raw = null; }
    // [F3] showDetailedAnalysis 와 동일 기준 — style_summary/tone_summary/tone 중 하나라도 있으면 노출.
    const summary = ((raw && (raw.style_summary || raw.tone_summary || raw.tone)) || '').toString().trim();
    if (!summary) return '';
    const collapsed = localStorage.getItem('ms_persona_collapsed') === '1';
    const body = collapsed
      ? ''
      : `<div class="ms-persona__body">
           <div class="ms-persona__label">사장님 말투</div>
           <div class="ms-persona__summary">${_esc(summary)}</div>
           <button type="button" class="ms-persona__detail" data-ms-persona-detail>전체 분석 리포트 보기</button>
         </div>`;
    const toggleLbl = collapsed ? '펼치기' : '접기';
    return `
      <section class="ms-persona" aria-label="말투 분석 리포트">
        <header class="ms-persona__head">
          <div class="ms-persona__title">말투 분석 리포트</div>
          <button type="button" class="ms-persona__toggle" data-mv-act="persona-toggle" aria-expanded="${collapsed ? 'false' : 'true'}">${toggleLbl}</button>
        </header>
        ${body}
      </section>`;
  }

  function _renderPCDash(brief) {
    return `
      <main class="ms-pc" aria-label="내샵관리 PC 대시보드">
        ${_renderShopCard(brief)}
        ${_renderPersonaCard()}
        <div class="ms-dash">
          ${_renderPCDonut(brief)}
          ${_renderPCWidgets(brief)}
        </div>
        ${_renderPCFeed(brief)}
      </main>
    `;
  }

  // ─────────── 액션 라우팅 ───────────
  function _runAct(act) {
    if (window.hapticLight) { try { window.hapticLight(); } catch (_e) { /* ignore */ } }
    const map = {
      booking:        () => window.openCalendarView && window.openCalendarView(),
      customer:       () => window.openCustomerHub && window.openCustomerHub(),
      customerDm:     () => (window.openDMConfirmQueue || window.openDMConversations)?.(),
      revenue:        () => (window.openRevenue || window.openRevenueHub)?.(),
      /* INVENTORY_HIDDEN */ // inventory:      () => window.openInventoryHub && window.openInventoryHub(),
      aiHub:          () => window.openAiHub && window.openAiHub(),
      settings:       () => window.openIntegrationsHub && window.openIntegrationsHub(),
      // 플랜·구독 — app-plan.js 에서 openPlanPopup 으로 노출. openPlan / openSupport 도 시도.
      plan:           () => (window.openPlan || window.openPlanPopup || (() => {}))(),
      support:        () => (window.openSupport || window.openSupportChat || (() => {}))(),
      logout:         () => (window.logout || (() => {}))(),
      bell:           () => window.openNotifications && window.openNotifications(),
      editShop:       () => window.openShopSettings && window.openShopSettings(),
      'persona-toggle': () => {
        const cur = localStorage.getItem('ms_persona_collapsed') === '1';
        try { localStorage.setItem('ms_persona_collapsed', cur ? '0' : '1'); } catch (_e) { /* silent */ }
        if (window.MyShopV3 && typeof window.MyShopV3.refresh === 'function') window.MyShopV3.refresh();
      },
      createShortcut: () => window.openAiHub && window.openAiHub(),
      goHome: () => {
        if (typeof window.showTab === 'function') {
          const btn = document.querySelector('.tab-bar__btn[data-tab="home"]');
          try { window.showTab('home', btn); } catch (_e) { /* ignore */ }
        }
      },
    };
    if (map[act]) { try { map[act](); } catch (_e) { /* ignore */ } }
  }

  // ─────────── 이벤트 바인딩 ───────────
  function _bindEvents(container) {
    container.querySelectorAll('[data-mv-act]').forEach(el => {
      el.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        _runAct(el.dataset.mvAct || '');
      });
    });
    container.querySelectorAll('[data-ms-avatar-fallback]').forEach(img => {
      img.addEventListener('error', () => {
        const span = document.createElement('span');
        span.textContent = img.dataset.msAvatarFallback || '';
        img.replaceWith(span);
      }, { once: true });
    });
    // [2026-05-22] _renderPersonaCard 가 모바일·PC 양쪽에 렌더 → 카드 2개. querySelector 는
    // 첫 번째만 매칭 → 사용자가 두 번째 누르면 무반응. querySelectorAll 로 모두 바인딩.
    // 추가: window.showDetailedAnalysis 가 timing/error 로 undefined 인 케이스 fallback 토스트.
    container.querySelectorAll('[data-ms-persona-detail]').forEach(_btn => {
      _btn.addEventListener('click', () => {
        if (typeof window.showDetailedAnalysis === 'function') {
          try { window.showDetailedAnalysis(); }
          catch (e) {
            console.error('[ms-persona-detail] showDetailedAnalysis 실행 실패:', e);
            if (window.showToast) window.showToast('리포트 표시 실패. 잠시 후 다시 시도해주세요');
          }
        } else {
          console.warn('[ms-persona-detail] window.showDetailedAnalysis undefined — app-instagram.js 미로드?');
          if (window.showToast) window.showToast('분석 모듈 로드중. 1~2초 후 다시 눌러주세요');
        }
      });
    });
  }

  // ─────────── 메인 컴포지션 ───────────
  // PC: ms-side (220px 풀 메뉴) + ms-pc (대시보드)
  // 모바일: 헤더 + 샵카드 + 운영/허브/계정 메뉴 스택
  // 2026-05-01 ── 글로벌 #sideNav 가 같은 ms-side 스타일로 항상 보임 → myshop 자체 사이드바 제거.
  // 사용자 요청: PC 디폴트가 사이드바 + 메인 영역, 홈 탭에서도 같은 사이드바 유지.
  function _composeHTML(brief) {
    return `
      <div class="ms-root">
        <div class="ms-mobile-only">
          ${_renderHeader()}
          <div class="ms-body">
            ${_renderShopCard(brief)}
            ${_renderPersonaCard()}
            ${_renderOpsMenu(brief)}
            ${_renderHubMenu()}
            ${_renderAccountMenu()}
            ${_renderFooterLinks()}
          </div>
        </div>
        ${_renderPCDash(brief)}
      </div>
    `;
  }

  // ─────────── 렌더 (SWR) ───────────
  let _lastContainerId = null;
  let _inFlight = false;

  async function _doRender(containerId) {
    const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) return;
    _lastContainerId = container.id || _lastContainerId;

    const swr = _readSWR();
    if (swr && swr.d) {
      try {
        // 캐시 hit: 즉시 렌더, fresh 면 백그라운드 갱신 생략
        container.innerHTML = _composeHTML(swr.d);
        _bindEvents(container);
        if (swr.fresh) return;
      } catch (_e) { /* fall through */ }
    } else {
      // 캐시 없을 때도 빈 상태로 즉시 렌더 (깨지지 않도록)
      container.innerHTML = _composeHTML({});
      _bindEvents(container);
    }

    if (_inFlight) return;
    _inFlight = true;
    try {
      const brief = await _fetchBrief();
      const merged = brief || (swr && swr.d) || {};
      container.innerHTML = _composeHTML(merged);
      _bindEvents(container);
    } finally {
      _inFlight = false;
    }
  }

  // ─────────── 공개 API ───────────
  window.MyShopV3 = {
    async render(containerId) { return _doRender(containerId || 'myshopV3Root'); },
    async refresh() { if (_lastContainerId) return _doRender(_lastContainerId); },
  };

  // ─────────── 자동 부트스트랩 ───────────
  function _autoMount() {
    const el = document.getElementById('myshopV3Root');
    if (el && !el.dataset.mvMounted) {
      el.dataset.mvMounted = '1';
      _doRender(el);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _autoMount, { once: true });
  } else {
    _autoMount();
  }

  // 데이터 변경 이벤트 — 내샵관리 탭 활성 시 재렌더
  if (!window._myShopV3DataListenerInit) {
    window._myShopV3DataListenerInit = true;
    window.addEventListener('itdasy:data-changed', () => {
      try { localStorage.removeItem(SWR_KEY); sessionStorage.removeItem(SWR_KEY); } catch (_e) { void _e; }
      const root = document.getElementById('myshopV3Root');
      if (!root) return;
      const dashTab = document.getElementById('tab-dashboard');
      if (dashTab && dashTab.classList.contains('active')) _doRender(root);
    });
    window.addEventListener('itdasy:plan-updated', () => {
      const root = document.getElementById('myshopV3Root');
      if (root) _doRender(root);
    });
    // 탭 전환 감지 — #tab-dashboard.active 가 되면 첫 렌더 (혹시 자동마운트 시점에 아직 DOM 없었을 경우)
    document.addEventListener('click', (ev) => {
      const t = ev.target && ev.target.closest && ev.target.closest('[data-tab="dashboard"]');
      if (!t) return;
      setTimeout(_autoMount, 0);
    }, true);
  }
})();
