/* ─────────────────────────────────────────────────────────────
   In-app 알림 (2026-04-21)

   - 1분 주기 폴링 (포그라운드만)
   - 대시보드 헤더에 배지 표시
   - 탭하면 시트로 목록 펼침 + 읽음 처리
   - 운영자 공지(kind=announcement) 도착 시 홈 상단에 인라인 카드 표시
   ──────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  let _items = [];
  let _pollTimer = null;
  // 2026-05-01 ── localStorage 로 변경. sessionStorage 면 앱 재시작 시 닫은 공지 다시 뜸.
  // 사용자 보고: '공지 한번 끄면 계속 꺼져야하는데 안꺼짐.' — 영구 dismissal 로 통일.
  const _DISMISS_KEY = 'itdasy::announcement_dismissed_ids';
  const _DISMISS_STORAGE = (function () {
    try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return localStorage; }
    catch (_) { return sessionStorage; }
  })();

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  async function _fetch() {
    if (!window.API || !window.authHeader) return null;
    const auth = window.authHeader();
    if (!auth?.Authorization) return null;
    try {
      const res = await apiFetch('/notifications/pending', { headers: auth });
      if (!res.ok) return null;
      return await res.json();
    } catch (_) { return null; }
  }

  function _updateBadge() {
    const badge = document.getElementById('dashBellBadge');
    if (!badge) return;
    // [2026-05-28] 숫자 표기 제거 — dot만 보임
    badge.textContent = '';
    badge.style.display = _items.length > 0 ? 'block' : 'none';
  }

  async function _markRead(id) {
    try { await apiFetch('/notifications/' + id + '/read', { method: 'PATCH', headers: window.authHeader() }); } catch (_) { void 0; }
  }
  async function _markAllRead() {
    try { await apiFetch('/notifications/read-all', { method: 'PATCH', headers: window.authHeader() }); } catch (_) { void 0; }
  }

  function _ensureSheet() {
    let sheet = document.getElementById('notifSheet');
    if (sheet) return sheet;
    sheet = document.createElement('div');
    sheet.id = 'notifSheet';
    sheet.style.cssText = 'position:fixed;inset:0;z-index:10001;display:none;background:rgba(0,0,0,0.45);';
    sheet.innerHTML = `
      <div style="position:absolute;inset:auto 0 0 0;background:var(--bg,#fff);border-radius:20px 20px 0 0;max-height:80vh;display:flex;flex-direction:column;padding:18px;padding-bottom:max(18px,env(safe-area-inset-bottom));">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <svg width="22" height="22" aria-hidden="true" style="color:#191F28;"><use href="#ic-bell"/></svg>
          <strong style="font-size:17px;">알림</strong>
          <span id="notifHeaderBadge" style="display:none;background:#BC6675;color:#fff;font-size:10px;padding:2px 7px;border-radius:5px;font-weight:600;"></span>
          <button data-notif-all style="margin-left:auto;font-size:11px;color:#888;background:none;border:none;cursor:pointer;">전부 읽음</button>
          <button data-notif-close style="background:rgba(0,0,0,0.05);border:none;width:32px;height:32px;border-radius:50%;font-size:16px;cursor:pointer;">✕</button>
        </div>
        <div id="notifBody" style="flex:1;overflow-y:auto;"></div>
      </div>
    `;
    document.body.appendChild(sheet);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) closeNotifications(); });
    sheet.querySelector('[data-notif-close]')?.addEventListener('click', () => closeNotifications());
    sheet.querySelector('[data-notif-all]').addEventListener('click', async () => {
      await _markAllRead();
      _items = [];
      _updateBadge();
      _renderList();
    });
    return sheet;
  }

  function _relativeTime(iso) {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (Math.abs(diff) < 60) return '방금';
    const m = Math.round(diff / 60);
    if (Math.abs(m) < 60) return (diff > 0 ? m + '분 전' : Math.abs(m) + '분 뒤');
    const h = Math.round(m / 60);
    if (Math.abs(h) < 24) return (diff > 0 ? h + '시간 전' : Math.abs(h) + '시간 뒤');
    return new Date(iso).toLocaleDateString('ko-KR');
  }

  // [2026-05-28] 사이드바 아이콘과 통일 — kind별 박스 색 + SVG sprite
  function _iconBoxByKind(kind) {
    const ICON_MAP = {
      booking_soon:              { bg: '#E1F5EE', color: '#1D9E75', icon: 'ic-calendar-check', link: '예약관리 보기 →' },
      booking_confirm_prev_day:  { bg: '#E1F5EE', color: '#1D9E75', icon: 'ic-calendar-check', link: '예약관리 보기 →' },
      dm_risk_alert:             { bg: '#FDECEC', color: '#E5484D', icon: 'ic-alert-triangle', link: 'DM 관리 보기 →' },
      announcement:              { bg: '#F7F8FA', color: '#4E5968', icon: 'ic-megaphone',      link: '공지 보기 →' },
    };
    return ICON_MAP[kind] || { bg: '#F7F8FA', color: '#4E5968', icon: 'ic-bell', link: '' };
  }
  function _iconBoxHtml(kind) {
    const c = _iconBoxByKind(kind);
    return `<span style="width:36px;height:36px;border-radius:10px;background:${c.bg};color:${c.color};display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;"><svg width="18" height="18" aria-hidden="true"><use href="#${c.icon}"/></svg></span>`;
  }
  function _isUnread(n) { return n.read === false || n.read == null; }
  function _isToday(iso) {
    if (!iso) return false;
    const d = new Date(iso); const t = new Date();
    return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
  }
  function _groupKey(n) {
    if (n.kind === 'dm_risk_alert') return 'urgent';
    if (_isToday(n.scheduled_at)) return 'today';
    return 'past';
  }
  const _GROUP_LABEL = { urgent: '긴급', today: '오늘', past: '이전' };
  const _GROUP_COLOR = { urgent: '#E5484D', today: '#8B95A1', past: '#8B95A1' };

  // [2026-04-30] 알림 kind 별 click → 적절한 화면으로 이동
  function _openByKind(n) {
    const kind = n.kind || '';
    try {
      // [2026-05-07] 온라인/DM 예약 입금 대기 → 승인·거절 시트
      if (kind === 'public_booking_pending') {
        if (window.openBookingApproval) { window.openBookingApproval(); return true; }
      }
      if (['dm_pending_confirm', 'dm_customer_register', 'dm_action_pending', 'dm_risk_alert'].includes(kind)) {
        if (window.openDMConfirmQueue) { window.openDMConfirmQueue(); return true; }
      }
      if (kind === 'support_reply' || kind === 'support_ai_reply') {
        if (window.openSupportSheet) { window.openSupportSheet(); return true; }
      }
      // payload 안에 customer_id 있으면 고객 카드 열기
      if (n.payload) {
        try {
          const p = typeof n.payload === 'string' ? JSON.parse(n.payload) : n.payload;
          if (p && p.customer_id && window.openCustomerCard) {
            window.openCustomerCard(p.customer_id);
            return true;
          }
        } catch (_) { /* ignore */ }
      }
    } catch (_) { /* ignore */ }
    return false;
  }

  function _renderList() {
    const body = document.getElementById('notifBody');
    if (!body) return;
    if (!_items.length) {
      body.innerHTML = `
        <div style="padding:40px 20px;text-align:center;color:var(--text-subtle);">
          <div style="font-size:36px;margin-bottom:10px;">🌿</div>
          <div style="font-size:13px;">새 알림 없음</div>
        </div>
      `;
      return;
    }
    // [2026-05-28] 그룹핑 (긴급/오늘/이전) + 미읽/읽음 시각 구분
    const groups = { urgent: [], today: [], past: [] };
    _items.forEach(n => groups[_groupKey(n)].push(n));
    const renderCard = (n) => {
      const c = _iconBoxByKind(n.kind);
      const unread = _isUnread(n);
      const titleColor = unread ? '#191F28' : '#4E5968';
      const cardOpacity = unread ? 1 : 0.55;
      const dot = unread ? '<span style="position:absolute;left:4px;top:50%;transform:translateY(-50%);width:5px;height:5px;border-radius:50%;background:#BC6675;"></span>' : '';
      const timeText = (unread ? '' : '읽음 · ') + _esc(_relativeTime(n.scheduled_at));
      const linkLabel = c.link ? `<span style="font-size:10px;color:#8B95A1;margin-left:8px;">${c.link}</span>` : '';
      return `<button type="button" data-notif-id="${n.id}" style="position:relative;display:flex;gap:12px;padding:12px;width:100%;background:transparent;border:0;border-radius:10px;text-align:left;cursor:pointer;opacity:${cardOpacity};font-family:inherit;">
        ${dot}${_iconBoxHtml(n.kind)}
        <span style="flex:1;min-width:0;">
          <span style="display:block;font-size:13px;font-weight:500;color:${titleColor};">${_esc(n.title)}</span>
          <span style="display:block;font-size:11px;color:#4E5968;margin-top:2px;line-height:1.4;">${_esc(n.body || '')}</span>
          <span style="display:block;font-size:10px;color:#B0B8C1;margin-top:4px;">${timeText}${linkLabel}</span>
        </span>
      </button>`;
    };
    const groupHtml = (key) => {
      const list = groups[key];
      if (!list.length) return '';
      const label = _GROUP_LABEL[key];
      const color = _GROUP_COLOR[key];
      const sep = key === 'urgent' ? '' : 'border-top:0.5px solid #F0F1F4;';
      return `<div style="${sep}"><div style="padding:14px 16px 6px;font-size:10px;font-weight:500;letter-spacing:0.3px;color:${color};">${label}</div>${list.map(renderCard).join('')}</div>`;
    };
    body.innerHTML = groupHtml('urgent') + groupHtml('today') + groupHtml('past');
    // 헤더 미읽 카운트 뱃지
    const unreadCount = _items.filter(_isUnread).length;
    const headerBadge = document.getElementById('notifHeaderBadge');
    if (headerBadge) {
      if (unreadCount > 0) {
        headerBadge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
        headerBadge.style.display = 'inline-block';
      } else {
        headerBadge.style.display = 'none';
      }
    }
    body.querySelectorAll('[data-notif-id]').forEach(el => {
      el.addEventListener('click', async () => {
        const id = parseInt(el.dataset.notifId, 10);
        const target = _items.find(x => x.id === id);
        await _markRead(id);
        _items = _items.filter(x => x.id !== id);
        _updateBadge();
        _renderList();
        // 시트 닫고 해당 화면으로 이동
        if (target && _openByKind(target)) {
          try { window.closeNotifications && window.closeNotifications(); } catch (_) { /* ignore */ }
        }
      });
    });
  }

  function _getDismissed() {
    try {
      const raw = _DISMISS_STORAGE.getItem(_DISMISS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) { return []; }
  }
  function _addDismissed(id) {
    try {
      const arr = _getDismissed();
      if (!arr.includes(id)) arr.push(id);
      _DISMISS_STORAGE.setItem(_DISMISS_KEY, JSON.stringify(arr.slice(-50)));
    } catch (_) { void 0; }
  }

  // [2026-04-29] 회원권 만료 임박 + 잔액 부족 알림 카드 (홈 인라인)
  function _renderMembershipAlertCard() {
    const anchor = document.getElementById('home-today-brief')
      || document.getElementById('homePostConnect')
      || document.querySelector('main') || document.body;
    if (!anchor) return;
    let host = document.getElementById('itdMembershipAlertHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'itdMembershipAlertHost';
      host.style.cssText = 'margin:0 0 12px 0;';
      if (anchor.parentNode) anchor.parentNode.insertBefore(host, anchor);
      else anchor.appendChild(host);
    }
    const dismissed = _getDismissed();
    const memKinds = ['membership_expire_7d', 'membership_expire_1d', 'membership_low_30', 'membership_low_10'];
    // [2026-06-07] 홈 상단 인라인 카드 노출 중단 — 알림은 종(🔔) 목록에서만. 홈 상단 안 밀리게.
    const memNotifs = [];
    // [2026-06-07] 비었을 때 display:none — 빈 호스트의 margin 12px 가 홈 상단 공백 만들던 문제.
    if (!memNotifs.length) { host.innerHTML = ''; host.style.display = 'none'; return; }
    const total = memNotifs.length;
    const a = memNotifs[0];
    host.style.display = '';
    host.innerHTML = `
      <div role="status" style="background:linear-gradient(135deg,#F7EFF0 0%,#FCE7EC 100%);border:1px solid #F0DADF;border-radius:14px;padding:14px 14px 14px 16px;position:relative;">
        <div style="display:flex;align-items:flex-start;gap:10px;">
          <div style="flex-shrink:0;width:36px;height:36px;border-radius:12px;background:#D58A95;display:flex;align-items:center;justify-content:center;font-size:17px;color:#fff;">💳</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:11px;font-weight:600;color:#BC6675;letter-spacing:0.2px;margin-bottom:2px;">회원권 알림 ${total > 1 ? `(${total}건)` : ''}</div>
            <div style="font-size:14px;font-weight:700;color:#1f2330;line-height:1.35;">${_esc(a.title)}</div>
            <div style="font-size:12px;color:#525c70;margin-top:4px;line-height:1.5;">${_esc(a.body || '')}</div>
            <div style="display:flex;gap:8px;align-items:center;margin-top:10px;">
              <button data-mem-open="${a.id}" data-mem-payload='${(a.payload || '{}').replace(/'/g, '&#39;')}' style="background:#BC6675;color:#fff;border:none;padding:7px 14px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;">충전 안내</button>
              <button data-mem-dismiss="${a.id}" style="background:none;border:none;color:#BC6675;font-size:11px;cursor:pointer;">나중에</button>
            </div>
          </div>
        </div>
      </div>
    `;
    host.querySelector('[data-mem-open]')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const id = parseInt(btn.dataset.memOpen, 10);
      try {
        const payload = JSON.parse(btn.dataset.memPayload || '{}');
        if (payload.customer_id && window.MembershipUI && window.MembershipUI.openTopupSheet) {
          window.MembershipUI.openTopupSheet(payload.customer_id, payload.customer_name || '');
        }
      } catch (_) { void 0; }
      await _markRead(id);
      _items = _items.filter(x => x.id !== id);
      _updateBadge();
      _renderMembershipAlertCard();
    });
    host.querySelector('[data-mem-dismiss]')?.addEventListener('click', async (e) => {
      const id = parseInt(e.currentTarget.dataset.memDismiss, 10);
      _items = _items.filter(x => x.id !== id);
      _updateBadge();
      _renderMembershipAlertCard();
    });
  }

  // [2026-04-30 Sprint 7] DM 사장 확인 대기 + [기능 4] 위험 알림 — 홈 인라인 카드
  function _renderDMConfirmQueueCard() {
    const anchor = document.getElementById('home-today-brief')
      || document.getElementById('homePostConnect')
      || document.querySelector('main') || document.body;
    if (!anchor) return;
    let host = document.getElementById('itdDMConfirmHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'itdDMConfirmHost';
      host.style.cssText = 'margin:0 0 12px 0;';
      if (anchor.parentNode) anchor.parentNode.insertBefore(host, anchor);
      else anchor.appendChild(host);
    }
    const dismissed = _getDismissed();
    const dmKinds = ['dm_pending_confirm', 'dm_customer_register', 'dm_action_pending', 'dm_risk_alert'];
    // [2026-06-07] 홈 상단 인라인 카드 노출 중단 — DM 은 '고객 메시지' 카드 줄로 이관됨(+ 종 목록).
    //   홈 상단이 알림으로 안 밀리게. 배지·종 목록은 그대로 유지. (배열 비워 카드 미표시)
    const dmNotifs = [];
    // [2026-06-07] 비었을 때 display:none — 빈 호스트 margin 으로 홈 상단 공백 생기던 문제.
    if (!dmNotifs.length) { host.innerHTML = ''; host.style.display = 'none'; return; }
    // 위험 알림이 1건이라도 있으면 빨간 카드 우선
    const riskNotifs = dmNotifs.filter(n => n.kind === 'dm_risk_alert');
    const isRisk = riskNotifs.length > 0;
    const showItems = isRisk ? riskNotifs : dmNotifs;
    const total = showItems.length;
    const a = showItems[0];

    const colors = isRisk
      ? { bg: 'linear-gradient(135deg,#FEE2E2 0%,#FECACA 100%)', border: '#FCA5A5', icon: '#DC2626', label: '#991B1B', btn: '#DC2626', btnText: '#fff', subText: '#991B1B' }
      : { bg: 'linear-gradient(135deg,#FFFBEB 0%,#FEF3C7 100%)', border: '#FDE68A', icon: '#F59E0B', label: '#B45309', btn: '#F59E0B', btnText: '#fff', subText: '#92400E' };
    const headerLbl = isRisk
      ? `위험 메시지 ${total > 1 ? `(${total}건)` : ''}`
      : `DM 사장 확인 대기 ${total > 1 ? `(${total}건)` : ''}`;
    const iconClass = isRisk ? 'ph-warning' : 'ph-bell';

    host.style.display = '';
    host.innerHTML = `
      <div role="status" style="background:${colors.bg};border:1px solid ${colors.border};border-radius:14px;padding:14px 14px 14px 16px;position:relative;">
        <div style="display:flex;align-items:flex-start;gap:10px;">
          <div style="flex-shrink:0;width:36px;height:36px;border-radius:12px;background:${colors.icon};display:flex;align-items:center;justify-content:center;color:#fff;">
            <i class="ph-duotone ${iconClass}" style="font-size:20px" aria-hidden="true"></i>
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:11px;font-weight:700;color:${colors.label};letter-spacing:0.2px;margin-bottom:2px;">${headerLbl}</div>
            <div style="font-size:14px;font-weight:700;color:#1f2330;line-height:1.35;">${_esc(a.title)}</div>
            <div style="font-size:12px;color:#525c70;margin-top:4px;line-height:1.5;">${_esc(a.body || '')}</div>
            <div style="display:flex;gap:8px;align-items:center;margin-top:10px;">
              <button data-dmq-open style="background:${colors.btn};color:${colors.btnText};border:none;padding:7px 14px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;">${isRisk ? '바로 확인' : '큐 열기'}</button>
              <button data-dmq-dismiss="${a.id}" style="background:none;border:none;color:${colors.subText};font-size:11px;cursor:pointer;">나중에</button>
              <span style="margin-left:auto;font-size:10px;color:${colors.subText}80;">${_esc(_relativeTime(a.scheduled_at))}</span>
            </div>
          </div>
        </div>
      </div>
    `;
    host.querySelector('[data-dmq-open]')?.addEventListener('click', async () => {
      if (window.openDMConfirmQueue) window.openDMConfirmQueue();
      for (const n of showItems) {
        try { await _markRead(n.id); } catch (_) { /* ignore */ }
      }
      _items = _items.filter(n => !showItems.some(x => x.id === n.id));
      _updateBadge();
      _renderDMConfirmQueueCard();
    });
    host.querySelector('[data-dmq-dismiss]')?.addEventListener('click', (e) => {
      const id = parseInt(e.currentTarget.dataset.dmqDismiss, 10);
      _addDismissed(id);
      _renderDMConfirmQueueCard();
    });
  }

  function _renderAnnouncementCard() {
    // 잇데이 운영자가 보낸 공지(kind=announcement) 만 인라인 카드로 노출
    const anchor = document.getElementById('home-today-brief')
      || document.getElementById('homePostConnect')
      || document.querySelector('main') || document.body;
    if (!anchor) return;
    let host = document.getElementById('itdAnnouncementHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'itdAnnouncementHost';
      host.style.cssText = 'margin:0 0 12px 0;';
      // 가장 위에 삽입 (가능한 경우)
      if (anchor.parentNode) anchor.parentNode.insertBefore(host, anchor);
      else anchor.appendChild(host);
    }
    // [2026-06-07] 홈 인라인 '잇데이 공지' 카드 노출 제거 — 공지는 알림(벨) 목록/시트에서만 확인.
    //   배지·알림목록·DM 확인 큐 카드 등 다른 알림 기능은 그대로 유지. BE seed 와 무관하게 홈 노출만 차단.
    const announcements = [];
    if (!announcements.length) {
      host.innerHTML = '';
      host.style.display = 'none';  // 빈 카드 자리(margin) 흔적 제거
      return;
    }
    host.style.display = '';  // 다시 보일 때 복귀
    // 가장 최신 한 건만 노출 (스택형 카드는 시트에서 확인)
    const a = announcements[0];
    const more = announcements.length - 1;
    host.innerHTML = `
      <div role="status" aria-live="polite" style="background:linear-gradient(135deg,#fff5f7 0%,#ffe8ec 100%);border:1px solid rgba(213,138,149,0.35);border-radius:14px;padding:14px 14px 14px 16px;box-shadow:0 2px 10px rgba(213,138,149,0.10);position:relative;">
        <div style="display:flex;align-items:flex-start;gap:10px;">
          <div style="flex-shrink:0;width:36px;height:36px;border-radius:12px;background:var(--brand);display:flex;align-items:center;justify-content:center;font-size:17px;color:#fff;">📢</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:11px;font-weight:600;color:var(--brand);letter-spacing:0.2px;margin-bottom:2px;">잇데이 공지</div>
            <div style="font-size:14px;font-weight:700;color:#1f2330;line-height:1.35;">${_esc(a.title)}</div>
            <div style="font-size:12px;color:#525c70;margin-top:4px;line-height:1.5;white-space:pre-wrap;">${_esc(a.body || '')}</div>
            <div style="display:flex;gap:8px;align-items:center;margin-top:10px;">
              <button data-ann-confirm="${a.id}" style="background:var(--brand);color:#fff;border:none;padding:7px 14px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;">확인</button>
              ${more > 0 ? `<button data-ann-more style="background:none;border:none;color:#7a8294;font-size:11px;cursor:pointer;">공지 ${more}개 더 보기</button>` : ''}
              <span style="margin-left:auto;font-size:10px;color:#8b94a7;">${_esc(_relativeTime(a.scheduled_at))}</span>
            </div>
          </div>
          <button data-ann-dismiss="${a.id}" aria-label="공지 닫기" style="position:absolute;top:8px;right:8px;width:26px;height:26px;border-radius:50%;border:none;background:rgba(0,0,0,0.05);font-size:13px;color:#525c70;cursor:pointer;line-height:1;">✕</button>
        </div>
      </div>
    `;
    const confirmBtn = host.querySelector('[data-ann-confirm]');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        const id = parseInt(confirmBtn.dataset.annConfirm, 10);
        await _markRead(id);
        _items = _items.filter(x => x.id !== id);
        _updateBadge();
        _renderAnnouncementCard();
        const list = document.getElementById('notifBody');
        if (list) _renderList();
      });
    }
    const dismissBtn = host.querySelector('[data-ann-dismiss]');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        const id = parseInt(dismissBtn.dataset.annDismiss, 10);
        _addDismissed(id);
        _renderAnnouncementCard();
      });
    }
    const moreBtn = host.querySelector('[data-ann-more]');
    if (moreBtn) moreBtn.addEventListener('click', () => window.openNotifications && window.openNotifications());
  }

  // [2026-05-07] 온라인 예약 입금 대기 — 홈 인라인 카드 (즉시 승인/거절 진입)
  function _renderPendingBookingCard() {
    const anchor = document.getElementById('home-today-brief')
      || document.getElementById('homePostConnect')
      || document.querySelector('main') || document.body;
    if (!anchor) return;
    let host = document.getElementById('itdPendingBookingHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'itdPendingBookingHost';
      host.style.cssText = 'margin:0 0 12px 0;';
      if (anchor.parentNode) anchor.parentNode.insertBefore(host, anchor);
      else anchor.appendChild(host);
    }
    const dismissed = _getDismissed();
    // [2026-06-07] 홈 상단 인라인 카드 노출 중단 — 알림은 종(🔔) 목록에서만. 홈 상단 안 밀리게.
    const pending = [];
    // [2026-06-07] 비었을 때 display:none — 빈 호스트 margin 으로 홈 상단 공백 생기던 문제.
    if (!pending.length) { host.innerHTML = ''; host.style.display = 'none'; return; }
    const a = pending[0];
    const total = pending.length;
    host.style.display = '';
    host.innerHTML = `
      <div role="status" style="background:linear-gradient(135deg,#FFFBEB 0%,#FEF3C7 100%);border:1px solid #FDE68A;border-radius:14px;padding:14px 14px 14px 16px;position:relative;">
        <div style="display:flex;align-items:flex-start;gap:10px;">
          <div style="flex-shrink:0;width:36px;height:36px;border-radius:12px;background:#F59E0B;display:flex;align-items:center;justify-content:center;font-size:17px;color:#fff;">🆕</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:11px;font-weight:700;color:#B45309;letter-spacing:0.2px;margin-bottom:2px;">예약 승인 대기 ${total > 1 ? `(${total}건)` : ''}</div>
            <div style="font-size:14px;font-weight:700;color:#1f2330;line-height:1.35;">${_esc(a.title)}</div>
            <div style="font-size:12px;color:#525c70;margin-top:4px;line-height:1.5;">${_esc(a.body || '')}</div>
            <div style="display:flex;gap:8px;align-items:center;margin-top:10px;">
              <button data-pb-open style="background:#F59E0B;color:#fff;border:none;padding:7px 14px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;">승인·거절 열기</button>
              <button data-pb-dismiss="${a.id}" style="background:none;border:none;color:#92400E;font-size:11px;cursor:pointer;">나중에</button>
              <span style="margin-left:auto;font-size:10px;color:#92400E80;">${_esc(_relativeTime(a.scheduled_at))}</span>
            </div>
          </div>
        </div>
      </div>
    `;
    host.querySelector('[data-pb-open]')?.addEventListener('click', async () => {
      if (window.openBookingApproval) window.openBookingApproval();
      for (const n of pending) {
        try { await _markRead(n.id); } catch (_) { /* ignore */ }
      }
      _items = _items.filter(n => !pending.some(x => x.id === n.id));
      _updateBadge();
      _renderPendingBookingCard();
    });
    host.querySelector('[data-pb-dismiss]')?.addEventListener('click', (e) => {
      const id = parseInt(e.currentTarget.dataset.pbDismiss, 10);
      _addDismissed(id);
      _renderPendingBookingCard();
    });
  }

  // [2026-05-28] 메인홈 잇비 카드/오늘 예약과 중복되거나 불필요한 알림은 알림함에서 제외.
  // 추후 백엔드 /notifications/pending 자체에서 제외하는 게 정석.
  const EXCLUDED_KINDS = [
    'proactive_morning_brief',  // 좋은 아침 — 메인홈 잇비 카드와 중복
    'dm_pending_confirm',       // DM 답장 대기 — 메인홈 잇비 챙겼어요
    'dm_customer_register',     // DM 새 고객 — 동일
    'public_booking_pending',   // 외부 예약 요청 — 동일
    'birthday',                 // 생일 — 불필요
  ];

  async function _poll() {
    const d = await _fetch();
    if (d && Array.isArray(d.items)) {
      const items = d.items.filter(it => !EXCLUDED_KINDS.includes(it.kind));
      // 신규 알림 도착 시 햅틱
      if (items.length > _items.length && window.hapticLight) {
        try { window.hapticLight(); } catch (_) { void 0; }
      }
      _items = items;
      _updateBadge();
      _renderAnnouncementCard();
      _renderMembershipAlertCard();
      _renderDMConfirmQueueCard();
      _renderPendingBookingCard();
    }
  }

  function _startPolling() {
    if (_pollTimer) return;
    _poll();
    // [P1-2B] 폴링 60초 → 120초 (visibilitychange 즉시 폴링은 그대로 유지)
    _pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') _poll();
    }, 120 * 1000);
  }

  // [PerfFix] 탭이 백그라운드로 가면 폴링 중단 — 배터리/CPU 절약. 복귀 시 재시작.
  function _stopPolling() {
    if (!_pollTimer) return;
    clearInterval(_pollTimer);
    _pollTimer = null;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      _poll();
      _startPolling();
    } else {
      _stopPolling();
    }
  });

  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(_startPolling, 2000);
  else document.addEventListener('DOMContentLoaded', () => setTimeout(_startPolling, 2000));

  window.openNotifications = function () {
    _ensureSheet();
    document.getElementById('notifSheet').style.display = 'block';
    document.body.style.overflow = 'hidden';
    _renderList();
  };
  window.closeNotifications = function () {
    const sheet = document.getElementById('notifSheet');
    if (sheet) sheet.style.display = 'none';
    document.body.style.overflow = '';
  };
  window.Notifications = {
    getAll: () => _items.slice(),
    poll: _poll,
  };
})();
