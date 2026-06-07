/* Home v4.1 render helpers */
(function () {
  'use strict';

  const COLORS = ['pink', 'blue', 'teal', 'purple', 'orange'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  function cfg() {
    return window.HomeV41Config || {};
  }

  function todayKor() {
    const d = new Date();
    const w = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${w})`;
  }

  function shopName() {
    try { return localStorage.getItem('shop_name') || '사장님'; }
    catch (_e) { return '사장님'; }
  }

  function shopInitial(shop) {
    return ((shop || '사장님')[0] || '잇').toUpperCase();
  }

  function syncAvatar(container) {
    if (!container) return;
    const slot = container.querySelector('[data-hv-avatar]');
    if (!slot) return;
    const img = document.querySelector('#headerAvatar img');
    const src = img && img.src ? img.src : '';
    const initialHTML = `<span class="hv-header__initial">${esc(shopInitial(shopName()))}</span>`;
    if (src) {
      // referrerpolicy: 인스타 CDN 403 방지. onerror: 만료/실패 시 깨진 이미지 대신 이니셜.
      slot.innerHTML = `<img src="${esc(src)}" alt="" class="hv-header__avatar-img" referrerpolicy="no-referrer">`;
      const av = slot.querySelector('img');
      if (av) av.onerror = function () { slot.innerHTML = initialHTML; };
    } else {
      slot.innerHTML = initialHTML;
    }
  }

  function minToHuman(min) {
    const n = Math.max(0, Math.round(Number(min) || 0));
    if (n < 60) return n + '분';
    const h = Math.floor(n / 60);
    const m = n % 60;
    return m === 0 ? h + '시간' : h + '시간 ' + m + '분';
  }

  function cardTodayGuest(brief) {
    const list = Array.isArray(brief.today_bookings)
      ? brief.today_bookings.filter(b => b.status === 'confirmed')
      : [];
    if (!list.length) return { ok: 1, cat: '오늘 손님', dot: '#10B981', okMsg: '오늘 예약을 확인해보세요' };
    const next = list[0];
    const who = next.customer_name ? (next.customer_name + '님') : '손님';
    const svc = next.service_name || next.service || '시술';
    return {
      ok: 0, cat: '오늘 손님 미리보기', dot: 'var(--brand-strong,#BC6675)',
      hl: who + ' · ' + svc,
      desc: next.memo ? '"' + next.memo + '"' : '메모 없음',
      btn: '고객 메모 보기', act: 'openCustomers',
    };
  }

  function cardAtRisk(brief) {
    const raw = brief.at_risk;
    const count = Array.isArray(raw) ? raw.length : (Number(raw) || 0);
    if (!count) return { ok: 1, cat: '단골 관리', dot: '#10B981', okMsg: '이탈 위험 손님 없어요' };
    return {
      ok: 0, cat: '단골 이탈 감지', dot: 'var(--danger)',
      hl: count + '명 방문 주기 넘었어요',
      desc: '평균 주기보다 오래 안 오신 손님',
      btn: '고객 목록', act: 'openCustomers',
    };
  }

  function cardEmptySlots(brief) {
    const emptySlots = Array.isArray(brief.empty_slots) ? brief.empty_slots : [];
    if (!emptySlots.length) {
      return { ok: 1, cat: '이번주 빈 시간', dot: '#10B981', okMsg: '이번주 일정이 꽉 찼어요' };
    }
    const top = emptySlots[0] || {};
    const hl = top.type === 'fullday'
      ? `${top.day_label}요일 종일 비어요`
      : `${minToHuman(top.gap_min)} · ${top.day_label}요일 ${top.from}~${top.to}`;
    const more = emptySlots.length > 1 ? ` 외 ${emptySlots.length - 1}건` : '';
    return {
      ok: 0, cat: '이번주 빈 시간', dot: '#0891B2',
      hl: hl + more,
      desc: '비어있는 시간에 프로모션이나 단골 안부 어떠세요?',
      btn: '예약 잡기', act: 'openCalendar',
    };
  }

  function buildCarouselCards(brief) {
    const data = brief || {};
    const cards = [
      cardTodayGuest(data),
      cardAtRisk(data),
      { ok: 0, cat: '요일별 매출', dot: '#3B82F6', hl: '이번주 매출 패턴 보기', desc: '요일별 매출 비교 · 프로모션 타이밍', btn: '자세히', act: 'openRevenue' },
      { ok: 0, cat: 'SNS 글 써주기', dot: 'var(--cyan,#0891B2)', hl: '갤러리 사진으로 문구 써줄까요?', desc: 'AI가 게시물 문구를 만들어드려요', btn: '문구 만들기', act: 'openCaption' },
      { ok: 0, cat: '인스타 리마인드', dot: 'var(--brand,#D58A95)', hl: '최근 포스팅 확인해보세요', desc: '꾸준한 업로드가 고객 유입에 도움돼요', btn: '갤러리에서 올리기', act: 'openGallery' },
      { ok: 1, cat: '노쇼 예측', dot: '#10B981', okMsg: '노쇼 위험 손님 없어요' },
      cardEmptySlots(data),
    ];
    return cards.sort((a, b) => a.ok - b.ok);
  }

  function todayBookings(brief) {
    const list = (brief && brief.today_bookings) || [];
    const ymd = new Date().toISOString().split('T')[0];
    return list
      .filter(b => (b.starts_at || '').startsWith(ymd))
      .sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)));
  }

  function statusLabel(s) {
    switch (s) {
      case 'completed': return '완료';
      case 'confirmed': return '확정';
      case 'cancelled': return '취소';
      case 'no_show': return '안 옴';
      default: return '';
    }
  }

  function hhmm(iso) {
    try {
      const d = new Date(iso);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch (_e) { return ''; }
  }

  function servicePrice(name) {
    const key = String(name || '').trim().toLowerCase();
    const cache = window._serviceTemplatesCache || [];
    if (!key || !cache.length) return 0;
    let hit = cache.find(t => String(t.name || '').trim().toLowerCase() === key);
    if (!hit) {
      hit = cache.find(t => {
        const n = String(t.name || '').trim().toLowerCase();
        return n && (key.includes(n) || n.includes(key));
      });
    }
    return Number(hit && hit.default_price) || 0;
  }

  function renderHeader(brief) {
    const shop = shopName();
    const data = brief || {};
    const monthTotal = Number(data.this_month_total) || 0;
    const monthLabel = (new Date().getMonth() + 1) + '월';
    const projRaw = data._projected_total;
    const projected = projRaw == null ? null
      : (Number.isFinite(Number(projRaw)) ? Number(projRaw) : null);
    const _comma = (n) => Number(n || 0).toLocaleString('ko-KR');
    const predChipHtml = projected == null ? '' : `
      <button type="button" class="hv5-pred-chip" data-hv-act="openRevenue" aria-label="잇비 분석 이번달 예상 매출">
        <span class="hv5-pred-chip-label">잇비 분석 이번달 예상 매출</span>
        <span class="hv5-pred-chip-amt"><span data-hv-count="${projected}">${formatMoney(projected)}</span></span>
      </button>`;
    const predRowHtml = projected == null ? '' : `
      <div class="hv5-rev-sum-row hv5-rev-sum-bot">
        <span class="hv5-rev-sum-pred-label">잇비 분석 이번달 예상 매출</span>
        <span class="hv5-rev-sum-pred-val"><span data-hv-count="${projected}">${_comma(projected)}</span><span class="hv5-rev-sum-unit">원</span></span>
      </div>`;
    return `<div class="hv5"><div class="hv5-hdr">
      <div class="av" data-hv-avatar aria-hidden="true">${esc(shopInitial(shop))}</div>
      <div class="meta">
        <div class="date">${esc(todayKor())}</div>
        <div class="shop">${esc(shop)}</div>
      </div>
      <button type="button" class="hv5-rev-chip" data-hv-act="openRevenue" aria-label="${monthLabel} 매출 상세">
        <span class="hv5-rev-chip-label">${monthLabel} 매출</span>
        <span class="hv5-rev-chip-amt"><span data-hv-count="${monthTotal}">${formatMoney(monthTotal)}</span></span>
      </button>
      ${predChipHtml}
      <button type="button" class="hv5-bell" data-hv-act="bell" aria-label="알림">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8C6 4.68629 8.68629 2 12 2C15.3137 2 18 4.68629 18 8C18 15 21 17 21 17H3C3 17 6 15 6 8Z"/><path d="M10 20C10.5 21 11.2 21.5 12 21.5C12.8 21.5 13.5 21 14 20"/></svg>
        <span id="dashBellBadge" class="hv5-bell-badge" style="display:none"></span>
      </button>
    </div>
    <button type="button" class="hv5-rev-sum" data-hv-act="openRevenue" aria-label="${monthLabel} 매출 상세">
      <div class="hv5-rev-sum-row hv5-rev-sum-top">
        <span class="hv5-rev-sum-label">${monthLabel} 매출</span>
        <span class="hv5-rev-sum-val"><span data-hv-count="${monthTotal}">${_comma(monthTotal)}</span><span class="hv5-rev-sum-unit">원</span></span>
      </div>
      ${predRowHtml}
    </button>`;
  }

  function _fallbackBookings(brief) {
    let bk = Array.isArray(brief.today_bookings) ? brief.today_bookings : [];
    if (bk.length || !window.Booking || typeof window.Booking.list !== 'function') return bk;
    try {
      const all = window.Booking._items || [];
      const ymd = new Date().toISOString().slice(0, 10);
      bk = all.filter(b => b && (b.starts_at || '').slice(0, 10) === ymd);
    } catch (_e) { /* silent */ }
    return bk;
  }

  function _monthCount(brief, completedCount) {
    let count = Number(brief.this_month_count) || 0;
    if (!count && window.Revenue && Array.isArray(window.Revenue._items)) {
      try {
        const now = new Date();
        const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
        count = window.Revenue._items.filter(r => String(r.recorded_at || r.created_at || '').slice(0, 7) === ym).length;
      } catch (_e) { /* silent */ }
    }
    return count || Number(brief.completed_count) || completedCount;
  }

  function _todayExpected(bookings) {
    return bookings
      .filter(b => b && b.status === 'confirmed')
      .reduce((sum, b) => {
        const amount = Number(b.amount) || 0;
        return sum + (amount > 0 ? amount : servicePrice(b.service_name));
      }, 0);
  }

  function _emptyStateMessage(brief) {
    const h = new Date().getHours();
    const todayCount = (brief && (brief.today_bookings_count || (Array.isArray(brief.today_bookings) && brief.today_bookings.length))) || 0;
    if (todayCount === 0) return '오늘은 여유 있는 하루네요. 갤러리 정리 어때요?';
    if (h >= 6 && h < 11)  return '좋은 아침이에요. 오늘 무엇을 도와드릴까요?';
    if (h >= 11 && h < 14) return '점심 시간이네요. 잠깐 쉬셨어요?';
    if (h >= 14 && h < 18) return '오늘 어떻게 흘러가고 있어요?';
    if (h >= 18 && h < 22) return '오늘 마무리 잘 하셨어요?';
    return '수고 많으셨어요. 푹 쉬세요';
  }

  function renderItbiCard(brief) {
    const data = brief || {};
    const lastMsg = (typeof data.assistant_last_message === 'string' && data.assistant_last_message.trim())
      ? data.assistant_last_message.trim()
      : '';
    const lastTime = (typeof data.assistant_last_time === 'string') ? data.assistant_last_time : '';
    const isEmpty = !lastMsg;
    const msgHtml = isEmpty
      ? esc(_emptyStateMessage(data))
      : esc(lastMsg);
    const confirm = (data.assistant_confirm_action && typeof data.assistant_confirm_action === 'object')
      ? data.assistant_confirm_action : null;
    const actionsHtml = confirm
      ? `<div class="hv5-itbi-actions">
          <button type="button" class="hv5-itbi-action-btn is-primary" data-hv-act="${esc(confirm.confirmAct || 'openAssistant')}">${esc(confirm.confirmLabel || '네, 등록할게요')}</button>
          <button type="button" class="hv5-itbi-action-btn" data-hv-act="${esc(confirm.cancelAct || 'openAssistant')}">${esc(confirm.cancelLabel || '아니요')}</button>
        </div>`
      : '';
    const timeHtml = lastTime ? `<div class="hv5-itbi-msg-time">${esc(lastTime)}</div>` : '';
    const promptsHtml = window.HomeV41ItbiPrompts ? window.HomeV41ItbiPrompts.render(esc) : '';
    return `<section class="hv5-itbi-card">
      <div class="hv5-itbi-head">
        <div class="hv5-itbi-head-l">
          <span class="hv5-itbi-avatar"><svg width="18" height="18" aria-hidden="true"><use href="#ic-bot"/></svg></span>
          <div class="hv5-itbi-head-text">
            <div class="hv5-itbi-name-row"><strong class="hv5-itbi-name">AI 잇비</strong><span class="hv5-itbi-beta">베타</span></div>
            <div class="hv5-itbi-status"><span class="hv5-itbi-status-dot"></span>원장님 기다리는 중</div>
          </div>
        </div>
        <button type="button" class="hv5-itbi-all" data-hv-act="openAssistant">전체 보기 ›</button>
      </div>
      <div class="hv5-itbi-msg${isEmpty ? ' is-empty' : ''}">
        <span class="hv5-itbi-msg-avatar"><svg width="16" height="16" aria-hidden="true"><use href="#ic-bot"/></svg></span>
        <div class="hv5-itbi-msg-body">
          <div class="hv5-itbi-msg-text">${msgHtml}</div>
          ${actionsHtml}
          ${timeHtml}
        </div>
      </div>
      ${promptsHtml}
      <div class="hv5-itbi-input">
        <button type="button" class="hv5-itbi-input-icon" data-itbi-act="photo" aria-label="사진 첨부"><svg width="18" height="18" aria-hidden="true"><use href="#ic-camera"/></svg></button>
        <input type="text" class="hv5-itbi-input-field" placeholder="잇비에게 무엇이든 물어보세요" data-itbi-input />
        <button type="button" class="hv5-itbi-input-icon" data-itbi-act="voice" aria-label="음성 입력"><svg width="16" height="16" aria-hidden="true"><use href="#ic-mic"/></svg></button>
        <button type="button" class="hv5-itbi-send" data-itbi-act="send" aria-label="보내기"><svg width="14" height="14" aria-hidden="true"><use href="#ic-send"/></svg></button>
        <input type="file" accept="image/*" data-itbi-file style="display:none;" />
      </div>
    </section>`;
  }

  function overdueAlertContext(brief) {
    const pending = Array.isArray(brief && brief.overdue_bookings) ? brief.overdue_bookings.slice() : [];
    pending.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    if (!pending.length) return clearOverdue();
    const top = pending[0];
    window._homePendingTopId = top.id;
    window._homePendingTopBooking = top;
    const name = (top.customer_name || '').trim() ? `${top.customer_name.trim()}님` : '손님';
    const desc = [name, overdueDate(top.starts_at)].filter(Boolean).join(' · ');
    return { count: pending.length, desc: pending.length > 1 ? `${desc} · 외 ${pending.length - 1}건` : desc };
  }

  function clearOverdue() {
    try { delete window._homePendingTopId; } catch (_e) { /* ignore */ }
    try { delete window._homePendingTopBooking; } catch (_e) { /* ignore */ }
    return null;
  }

  function overdueDate(value) {
    try {
      const d = new Date(value);
      if (!Number.isFinite(d.getTime())) return '';
      const dow = '일월화수목금토'.charAt(d.getDay());
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${d.getMonth() + 1}/${d.getDate()}(${dow}) ${hh}:${mm}`;
    } catch (_e) { return ''; }
  }

  function alertItems(brief, dmQueueCount, onlinePendingCount) {
    const items = [];
    const depositPending = (brief && brief.pending_booking_count) || 0;
    if (dmQueueCount > 0) items.push({ tone: 'purple', title: `답장 ${dmQueueCount}건 써뒀어요`, desc: '확인하고 보내기만 하세요', count: dmQueueCount, act: 'openDMConfirmQueue' });
    const overdue = overdueAlertContext(brief);
    if (overdue) items.push({ tone: 'pink', title: '미완료 예약 찾았어요', desc: overdue.desc, count: overdue.count, act: 'completePending' });
    setOverdueCache(brief, Boolean(overdue));
    if (depositPending > 0) items.push({ tone: 'amber', title: '결제 미확인 예약', desc: '입금 확인하면 캘린더에 등록돼요', count: depositPending, act: 'openBookingApproval' });
    if (onlinePendingCount > 0 && onlinePendingCount !== depositPending) items.push({ tone: 'cyan', title: '새 예약 신청 들어왔어요', desc: '손님이 사장님 승인을 기다리고 있어요', count: onlinePendingCount, act: 'openBookingApproval' });
    return items;
  }

  function setOverdueCache(brief, hasOverdue) {
    try {
      window._overdueBookings = hasOverdue && Array.isArray(brief && brief.overdue_bookings)
        ? brief.overdue_bookings.slice()
        : [];
    } catch (_e) { /* ignore */ }
  }

  function renderAlerts(brief, dmQueueCount, onlinePendingCount) {
    const items = alertItems(brief, dmQueueCount, onlinePendingCount);
    if (!items.length) return '';
    const total = items.reduce((s, it) => s + it.count, 0);
    return `<div class="hv5-card">
      <div class="hv5-card-h">
        <div class="hv5-card-title">AI 잇비가 챙겼어요</div>
        <span style="font-size:11px;color:#BC6675;font-weight:700">${total}건</span>
      </div>
      <div class="hv5-noti-list">${items.map(renderAlertItem).join('')}</div>
    </div>`;
  }

  function renderAlertItem(it) {
    return `<button type="button" class="hv5-noti" data-hv-act="${esc(it.act)}">
      <div class="hv5-noti-dot ${it.tone}"></div>
      <div class="hv5-noti-body">
        <div class="hv5-noti-title">${esc(it.title)}</div>
        <div class="hv5-noti-desc">${esc(it.desc)}</div>
      </div>
      <div class="hv5-noti-count">${it.count}건</div>
      <div class="hv5-noti-arrow" aria-hidden="true">›</div>
    </button>`;
  }

  function renderBooking(brief) {
    const all = todayBookings(brief);
    const empty = cfg().BOOKING_EMPTY_DISPLAY || 'hide';
    if (!all.length) return empty === 'hide' ? '' : bookingEmptyHtml();
    const max = cfg().BOOKING_SLOTS_MAX || 5;
    const now = Date.now();
    const idxNext = all.findIndex(b => Number.isFinite(Date.parse(b.starts_at || '')) && Date.parse(b.starts_at || '') >= now);
    const visible = all.slice(0, max);
    const slotsHtml = visible.map((b, i) => renderBookingSlot(b, i, idxNext)).join('');
    const more = all.length - visible.length;
    const moreRow = more > 0 ? `<button type="button" class="hv5-s-more" data-hv-act="openCalendar">+${more}건 더 보기</button>` : '';
    return `<div class="hv5-card">
      <div class="hv5-card-h">
        <div class="hv5-card-title">오늘의 예약 ${all.length}건</div>
        <button type="button" class="hv5-card-link" data-hv-act="openCalendar">캘린더 →</button>
      </div>
      <div class="hv5-slots">${slotsHtml}${moreRow}</div>
    </div>`;
  }

  function bookingEmptyHtml() {
    return `<div class="hv5-card">
      <div class="hv5-card-h">
        <div class="hv5-card-title">오늘의 예약</div>
        <button type="button" class="hv5-card-link" data-hv-act="openCalendar">캘린더 →</button>
      </div>
      <button type="button" class="hv5-bk-empty" data-hv-act="openCalendar">오늘 예약 없음</button>
    </div>`;
  }

  function renderBookingSlot(b, i, idxNext) {
    const status = statusLabel(b.status);
    const badge = status ? `<span class="hv5-s-badge ${statusClass(b.status)}">${status}</span>` : '';
    const amount = bookingAmount(b);
    return `<button type="button" class="hv5-slot${i === idxNext ? ' now' : ''} hv5-slot-${COLORS[i % 5]}" data-hv-slot="${i}" data-hv-time="${esc(b.starts_at || '')}">
      <span class="hv5-s-time">${esc(hhmm(b.starts_at))}</span>
      <span class="hv5-s-bar" aria-hidden="true"></span>
      <span class="hv5-s-info">
        <span class="hv5-s-name">${esc(b.customer_name || b.name || '')}</span>
        ${b.service_name ? `<span class="hv5-s-svc">${esc(b.service_name)}</span>` : ''}
        ${amount ? `<span class="hv5-s-amt">${amount}</span>` : ''}
      </span>
      ${badge}
    </button>`;
  }

  function statusClass(status) {
    if (status === 'completed') return 'done';
    if (status === 'cancelled' || status === 'no_show') return 'cncl';
    return 'conf';
  }

  function bookingAmount(b) {
    let amount = Number(b.amount) || 0;
    if (!amount && b.service_name) amount = servicePrice(b.service_name);
    const rounded = amount > 0 ? Math.round(amount / 1000) * 1000 : 0;
    return rounded > 0 ? rounded.toLocaleString('ko-KR') + '원' : '';
  }

  function renderAiRecs(cards) {
    if (!cards || !cards.length) return '</div>';
    const total = cards.length;
    const todoCnt = cards.filter(c => !c.ok).length;
    const cardHtml = cards.map(renderAiCard).join('');
    const navHtml = renderAiNav(total);
    return `<div class="hv5-ai">
      <div class="hv5-ai-label">
        <span class="hv5-ai-pulse" aria-hidden="true"></span>
        <span class="hv5-ai-label-t"><b>AI 잇비</b> 실시간 분석</span>
        <span class="hv5-ai-label-count">${todoCnt > 0 ? todoCnt + '건 확인 필요' : '모두 정상'}</span>
      </div>
      <div class="hv5-ai-track" id="hv5AiTrack">${cardHtml}</div>
      ${navHtml}
    </div></div>`;
  }

  function renderAiCard(c) {
    if (c.ok) {
      return `<div class="hv5-ai-card hv5-ai-card-page ok" data-ok="1">
        <div class="hv5-ai-tag"><div class="hv5-ai-dot" style="background:${esc(c.dot || '#10B981')}"></div><div class="hv5-ai-tag-t">${esc(c.cat || '')}</div><span class="hv5-ai-check">✓</span></div>
        <div class="hv5-ai-ok-msg">${esc(c.okMsg || '')}</div>
      </div>`;
    }
    return `<div class="hv5-ai-card hv5-ai-card-page" data-ok="0" data-hv-act="${esc(c.act || '')}" role="button" tabindex="0">
      <div class="hv5-ai-tag"><div class="hv5-ai-dot" style="background:${esc(c.dot || '#BC6675')}"></div><div class="hv5-ai-tag-t">${esc(c.cat || '')}</div></div>
      <div class="hv5-ai-hl">${esc(c.hl || '')}</div>
      <div class="hv5-ai-desc">${esc(c.desc || '')}</div>
      <button type="button" class="hv5-ai-btn" data-hv-act="${esc(c.act || '')}">${esc(c.btn || '확인')} ›</button>
    </div>`;
  }

  function renderAiNav(total) {
    const isMobile = window.matchMedia('(max-width: 540px)').matches;
    const pages = Math.max(1, Math.ceil(total / (isMobile ? 1 : 3)));
    if (pages <= 1) return '';
    const dots = Array.from({ length: pages }, (_, i) =>
      `<button type="button" class="hv5-ai-dot-nav${i === 0 ? ' on' : ''}" data-hv-ai-page="${i}" aria-label="페이지 ${i + 1}"></button>`
    ).join('');
    return `<div class="hv5-ai-nav">
      <button type="button" class="hv5-ai-nav-btn" id="hv5AiPrev" disabled aria-label="이전">‹</button>
      <div class="hv5-ai-dots" id="hv5AiDots">${dots}</div>
      <button type="button" class="hv5-ai-nav-btn" id="hv5AiNext" aria-label="다음">›</button>
    </div>`;
  }

  function ensureStyles() {
    if (document.getElementById('hv5Styles')) return;
    const s = document.createElement('style');
    s.id = 'hv5Styles';
    s.textContent = window.HomeV41StylesV5 || '';
    document.head.appendChild(s);
  }

  function middleRow(bookingHtml, alertsHtml) {
    if (bookingHtml && alertsHtml) {
      return `<div class="hv5-row"><div class="hv5-col-7">${bookingHtml}</div><div class="hv5-col-5">${alertsHtml}</div></div>`;
    }
    if (bookingHtml) return `<div class="hv5-row"><div style="grid-column:span 12">${bookingHtml}</div></div>`;
    if (alertsHtml) return `<div class="hv5-row"><div style="grid-column:span 12">${alertsHtml}</div></div>`;
    return '';
  }

  // [2026-06-07] 고객 메시지 카드 줄 — 빈 컨테이너만 렌더. 데이터는 app-home-customer-msgs.js 가
  //   기존 /conversations 폴링으로 채움 (추가 비용 0). 카드 없으면 hidden 유지.
  function renderCustomerMsgs() {
    return `<section class="hv5-cmsg" id="hv5Cmsg" hidden aria-label="고객 메시지">
      <div class="hv5-cmsg-head">
        <span class="hv5-cmsg-title">고객 메시지</span>
        <span class="hv5-cmsg-count" id="hv5CmsgCount"></span>
        <button type="button" class="hv5-cmsg-more" id="hv5CmsgMore">전체 보기 ›</button>
      </div>
      <div class="hv5-cmsg-row" id="hv5CmsgRow"></div>
    </section>`;
  }

  function compose(brief, dmQueueCount, onlinePendingCount) {
    ensureStyles();
    const cards = buildCarouselCards(brief);
    const bookingHtml = renderBooking(brief);
    const alertsHtml = renderAlerts(brief, dmQueueCount || 0, onlinePendingCount || 0);
    return [
      renderHeader(brief),
      renderItbiCard(brief),
      middleRow(bookingHtml, alertsHtml),
      renderCustomerMsgs(),
      renderAiRecs(cards),
    ].join('');
  }

  window.HomeV41Render = { compose, syncAvatar, todayBookings };
})();
