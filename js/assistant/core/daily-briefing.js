/* 잇비 Daily Ops Briefing (T-114 MVP · 2026-05-30)

   "오늘 뭐 해야 돼? / 오늘 브리핑해줘 / 오늘 샵 상태" → 오늘 운영 우선순위 요약.
   운영 "판단"이지 자동 실행 아님 — 읽기 전용. 발송/예약생성/기록수정 0.

   데이터 소스(전부 기존, 백엔드 수정 0):
   - GET /today/brief : 매출(오늘/어제)·리터치 대상·이탈·미기록·다음예약·추천(proactive_suggestions)
   - window.Booking.list/shopHours : 오늘 예약 목록 + 공백시간 계산
   - window.loadGalleryItems : 고객기록 미연결 사진(customer_id 없음, 최근 2일) 수

   추천 액션은 "~할까요?" 제안만 — 실행은 기존 잇비 명령(리터치 초안/사진연결/예약)으로 이어감. */
(function () {
  'use strict';
  if (window.ItdasyDailyBriefing) return;

  // 브리핑(종합 요청)만 감지. 단순 조회("오늘 매출?","오늘 예약 보여줘")는 제외 → 기존 경로 유지.
  const _BRIEF = /(브리핑|오늘\s*뭐\s*(해야|하면|할|하지)|오늘\s*할\s*일|샵\s*상태|가게\s*상태|매장\s*상태|오늘\s*어때|오늘\s*어떄|오늘\s*상황|오늘\s*정리|오늘\s*요약|오늘\s*체크|운영\s*(요약|브리핑|상황))/;
  const _NOT = /(매출|얼마|벌었|예약\s*(보여|목록|몇|있|확인))/;

  function detect(text) {
    const t = String(text || '').trim();
    if (!t) return false;
    return _BRIEF.test(t) && !_NOT.test(t);
  }

  function _todayRangeISO() {
    const s = new Date(); s.setHours(0, 0, 0, 0);
    const e = new Date(); e.setHours(23, 59, 59, 0);
    return { from: s.toISOString(), to: e.toISOString(), start: s, end: e };
  }
  function _hhmm(d) {
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function _man(n) {
    const v = Number(n) || 0;
    if (v >= 10000) return Math.round(v / 10000) + '만원';
    return v.toLocaleString('ko-KR') + '원';
  }

  async function _fetchBrief() {
    try {
      if (typeof window.apiFetch !== 'function') return null;
      const auth = (typeof window.authHeader === 'function') ? window.authHeader() : {};
      const res = await window.apiFetch('/today/brief', { headers: auth });
      if (!res || !res.ok) return null;
      return await res.json();
    } catch (_e) { return null; }
  }

  // 오늘 예약 목록 → {count, next, gaps[]}
  async function _bookingsAndGaps() {
    const out = { count: 0, next: null, gaps: [] };
    if (!(window.Booking && typeof window.Booking.list === 'function')) return out;
    const r = _todayRangeISO();
    let items = [];
    try { items = (await window.Booking.list(r.from, r.to)) || []; } catch (_e) { items = []; }
    items = items.filter((b) => b && b.starts_at && b.status !== 'cancelled')
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    out.count = items.length;
    const now = Date.now();
    const future = items.filter((b) => new Date(b.starts_at).getTime() >= now);
    if (future.length) {
      out.next = { at: new Date(future[0].starts_at), name: future[0].customer_name || '', service: future[0].service_name || '' };
    }
    // 공백: 영업시간 내, 1시간 이상, 지금 이후 끝나는 구간 최대 3개.
    const hours = (window.Booking.shopHours && window.Booking.shopHours()) || { start: 10, end: 22 };
    const dayStart = new Date(r.start); dayStart.setHours(hours.start, 0, 0, 0);
    const dayEnd = new Date(r.start); dayEnd.setHours(hours.end, 0, 0, 0);
    let cursor = new Date(Math.max(dayStart.getTime(), now));
    const blocks = items.map((b) => ({ s: new Date(b.starts_at), e: new Date(b.ends_at || (new Date(b.starts_at).getTime() + 60 * 60000)) }))
      .filter((x) => x.e.getTime() > cursor.getTime());
    for (const blk of blocks) {
      if (out.gaps.length >= 3) break;
      if (blk.s.getTime() - cursor.getTime() >= 60 * 60000) {
        out.gaps.push({ s: new Date(cursor), e: new Date(blk.s) });
      }
      if (blk.e.getTime() > cursor.getTime()) cursor = new Date(blk.e);
    }
    if (out.gaps.length < 3 && dayEnd.getTime() - cursor.getTime() >= 60 * 60000) {
      out.gaps.push({ s: new Date(cursor), e: new Date(dayEnd) });
    }
    return out;
  }

  // 고객기록 미연결 사진(최근 2일 저장, customer_id 없음) 수.
  async function _unlinkedPhotoCount() {
    try {
      if (typeof window.loadGalleryItems !== 'function') return 0;
      const all = await window.loadGalleryItems();
      const cutoff = Date.now() - 2 * 24 * 60 * 60 * 1000;
      return (all || []).filter((it) => it && it.customer_id == null && (it.savedAt || 0) >= cutoff).length;
    } catch (_e) { return 0; }
  }

  async function run() {
    const [brief, bk, unlinked] = await Promise.all([_fetchBrief(), _bookingsAndGaps(), _unlinkedPhotoCount()]);
    const lines = [];
    const recs = [];
    const actions = [];   // [T-115] 추천 버튼(안전 — 화면 이동/초안 경로만)

    // 처리할 거리(시그널)가 하나도 없으면 = 조용한 날 → 친절 안내. (공백만 있는 빈 스케줄은 시그널 아님)
    const hasSignal = bk.count > 0 || unlinked > 0
      || !!(brief && (brief.retouch_due_count > 0 || brief.at_risk_count > 0 || brief.unrecorded_count > 0 || brief.revenue_total > 0));
    if (!hasSignal) {
      return { message: '오늘은 특별히 처리할 알림이 없어요. 예약과 매출 흐름은 안정적이에요.' };
    }

    // 예약 + 다음
    if (bk.count > 0) {
      const nx = bk.next ? `, 다음은 ${_hhmm(bk.next.at)} ${bk.next.name || ''}${bk.next.service ? '(' + bk.next.service + ')' : ''}`.replace(/\s+,/, ',') : '';
      lines.push(`오늘 예약 ${bk.count}건${nx}`);
    } else {
      lines.push('오늘 예약은 아직 없어요');
    }
    // 공백
    if (bk.gaps.length) {
      lines.push('비어 있는 시간: ' + bk.gaps.map((g) => `${_hhmm(g.s)}~${_hhmm(g.e)}`).join(', '));
    }
    // 리터치
    if (brief && brief.retouch_due_count > 0) {
      const custs = (brief.retouch_due_customers || []).slice(0, 3).map((c) => ({ id: c.id, name: c.name })).filter((c) => c.name);
      const names = custs.map((c) => c.name);
      lines.push(`리터치 시기 지난 고객 ${brief.retouch_due_count}명${names.length ? ': ' + names.join('·') : ''}`);
      recs.push(`리터치 고객 ${Math.min(brief.retouch_due_count, 3)}명에게 안내 초안 만들기`);
      actions.push({ id: 'retouch_draft', kind: 'retouch_draft', label: '리터치 안내 초안', safety: 'safe', payload: { customers: custs } });
    }
    // 이탈 임박
    if (brief && brief.at_risk_count > 0) {
      lines.push(`한동안 안 오신 고객 ${brief.at_risk_count}명`);
      actions.push({ id: 'at_risk', kind: 'open_at_risk', label: '이탈 고객 확인', safety: 'safe', payload: { count: brief.at_risk_count } });
    }
    // 미연결 사진
    if (unlinked > 0) {
      lines.push(`최근 저장한 사진 ${unlinked}장이 아직 고객 기록에 안 붙었어요`);
      recs.push(`미연결 사진 ${unlinked}장 고객 기록에 연결`);
      actions.push({ id: 'unlinked_photos', kind: 'open_unlinked_photos', label: '미연결 사진 확인', safety: 'safe', payload: { count: unlinked } });
    }
    // 매출 미기록
    if (brief && brief.unrecorded_count > 0) {
      lines.push(`매출 미기록 ${brief.unrecorded_count}건`);
      recs.push(`매출 미기록 ${brief.unrecorded_count}건 정리`);
      actions.push({ id: 'unrecorded_revenue', kind: 'open_unrecorded', label: '매출 미기록 정리', safety: 'safe', payload: { count: brief.unrecorded_count } });
    }
    // 매출 + 어제 대비
    if (brief && brief.revenue_total > 0) {
      let cmp = '';
      if (brief.today_total != null && brief.yesterday_total != null) {
        if (brief.today_total > brief.yesterday_total) cmp = ', 어제보다 좋아요';
        else if (brief.today_total < brief.yesterday_total) cmp = ', 어제보단 낮아요';
      }
      lines.push(`오늘 매출 ${_man(brief.revenue_total)}${cmp}`);
    }
    // 공백 추천 (예약 제안은 실행 아님, 제안만)
    if (bk.gaps.length && recs.length < 3) {
      recs.push(`${_hhmm(bk.gaps[0].s)} 공백에 단골 예약 제안`);
    }
    if (bk.gaps.length && actions.length < 5) {
      actions.push({ id: 'empty_slot', kind: 'open_empty_slot', label: '공백 시간 활용', safety: 'safe', payload: { first: _hhmm(bk.gaps[0].s) } });
    }
    // 백엔드 능동 추천 보강 (중복 최소화)
    if (brief && Array.isArray(brief.proactive_suggestions)) {
      brief.proactive_suggestions.forEach((s) => {
        if (recs.length >= 3) return;
        const txt = (s && (s.text || s.label)) ? String(s.text || s.label) : '';
        if (txt && !recs.some((r) => r.includes('리터치') && /리터치/.test(txt))) {
          // 너무 긴 텍스트는 컷
          if (!recs.includes(txt)) recs.push(txt.slice(0, 40));
        }
      });
    }

    if (!lines.length) {
      return { message: '오늘은 특별히 처리할 알림이 없어요. 예약과 매출 흐름은 안정적이에요.', actions: [] };
    }
    let msg = '☀️ 오늘 브리핑이에요.\n\n' + lines.map((l) => '• ' + l).join('\n');
    if (recs.length) {
      msg += '\n\n추천:\n' + recs.slice(0, 3).map((r, i) => `${i + 1}. ${r}`).join('\n');
    }
    try { window.ItdasyAssistantContext && window.ItdasyAssistantContext.markRecentAction('오늘 브리핑'); } catch (_e) { void 0; }
    return { message: msg, actions: actions };
  }

  // [T-115] 추천 버튼 클릭 → 안전한 다음 단계로만 연결. 자동 발송/예약/매출생성/기록수정 0.
  //   반환: { chatInput? } (잇비 입력으로 보낼 문장) | { message? } | { navigated? }.
  function _nav(fn) { try { if (typeof fn === 'function') { fn(); return true; } } catch (_e) { void 0; } return false; }

  function runAction(action) {
    if (!action || !action.kind) return { message: '' };
    const p = action.payload || {};
    switch (action.kind) {
      case 'retouch_draft': {
        const custs = Array.isArray(p.customers) ? p.customers : [];
        if (custs.length === 1) {
          // 1명 → 기존 T-110/T-113 draft 경로로(잇비 입력 전송). 발송 아님(초안).
          return { chatInput: `${custs[0].name} 리터치 안내 문구 만들어줘` };
        }
        if (custs.length > 1) {
          const names = custs.map((c) => c.name).join(', ');
          return { message: `리터치 대상: ${names} 중 누구에게 초안을 만들까요? 이름을 말씀해 주세요. (예: "${custs[0].name} 리터치 안내 문구 만들어줘")` };
        }
        return { message: '리터치 대상 고객이 없어요.' };
      }
      case 'open_unlinked_photos':
        _nav(() => window.showTab && window.showTab('workshop'));
        return { navigated: true, message: '작업실을 열었어요. 사진을 선택한 뒤 "이 사진 고객 기록에 저장해줘"로 연결할 수 있어요. (자동 연결은 하지 않아요)' };
      case 'open_unrecorded':
        if (_nav(() => window.openBooking && window.openBooking()) || _nav(() => window.openCalendarView && window.openCalendarView())) {
          return { navigated: true, message: '예약/완료 화면을 열었어요. 미기록 건을 완료 처리하면 매출로 기록돼요. (자동 기록은 하지 않아요)' };
        }
        return { message: '매출 미기록은 예약 화면에서 완료 처리로 정리할 수 있어요.' };
      case 'open_at_risk':
        if (_nav(() => window.openRetentionAI && window.openRetentionAI())) return { navigated: true, message: '이탈 위험 고객 화면을 열었어요. (메시지는 확인 후 직접 보내세요)' };
        if (_nav(() => window.openCustomers && window.openCustomers())) return { navigated: true, message: '고객 화면을 열었어요.' };
        return { message: '이탈 임박 고객은 고객 관리 화면에서 확인할 수 있어요.' };
      case 'open_empty_slot':
        _nav(() => window.openCalendarView && window.openCalendarView());
        return { navigated: true, message: '예약 화면을 열었어요. (공백에 맞는 고객 추천 기능은 곧 추가될 예정이에요)' };
      default:
        return { message: '' };
    }
  }

  window.ItdasyDailyBriefing = { detect, run, runAction };
})();
