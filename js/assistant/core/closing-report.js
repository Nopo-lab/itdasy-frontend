/* 잇비 하루 마감 리포트 (2026-07-05)

   저녁에 "마감 리포트 / 오늘 마감 / 하루 결산" → 오늘 결산 + 내일 미리보기 한 장.
   룰 기반 문장 조립 — LLM 호출 0, 신규 API 0. 읽기 전용(발송/기록/예약생성 없음).

   데이터 소스(전부 기존):
   - GET /today/brief : 매출(오늘/어제), 매출 미기록 수
   - window.Booking.list : 오늘 예약(완료/취소), 내일 예약(건수 + 첫 손님)

   홈 잇비 카드의 저녁 칩(v41-renderers.js)이 이 모듈로 진입 —
   seen 키('itdasy:closing_report_seen::YYYY-MM-DD')는 여기(run)서 기록, 칩은 그 키로 하루 1번만 표시. */
(function () {
  'use strict';
  if (window.ItdasyClosingReport) return;

  // 마감 '리포트' 요청만 감지. "마감 몇시/언제" 같은 영업시간 질문은 제외.
  // "오늘 정리/요약"은 daily-briefing 몫 그대로 둠(겹침 방지 — 여긴 마감/결산 계열만).
  const _RE = /(마감\s*(리포트|리폿|보고|요약|정리)?|하루\s*(결산|마무리)|오늘\s*(결산|정산)|퇴근\s*전\s*(정리|요약|리포트))/;
  const _NOT = /(몇\s*시|언제|시간|영업|주문|신청)/;

  function detect(text) {
    const t = String(text || '').trim();
    if (!t) return false;
    return _RE.test(t) && !_NOT.test(t);
  }

  function _ymd(d) {
    const t = d || new Date();
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  }
  function _seenKey() { return 'itdasy:closing_report_seen::' + _ymd(); }
  function _markSeen() { try { localStorage.setItem(_seenKey(), '1'); } catch (_e) { void 0; } }

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

  // offsetDays(0=오늘, 1=내일) 예약 → {count, cancelled, first:{at,name,service}}
  async function _dayBookings(offsetDays) {
    const out = { count: 0, cancelled: 0, first: null };
    if (!(window.Booking && typeof window.Booking.list === 'function')) return out;
    const s = new Date(); s.setDate(s.getDate() + offsetDays); s.setHours(0, 0, 0, 0);
    const e = new Date(s); e.setHours(23, 59, 59, 0);
    let items = [];
    try { items = (await window.Booking.list(s.toISOString(), e.toISOString())) || []; } catch (_e) { items = []; }
    items = items.filter((b) => b && b.starts_at);
    out.cancelled = items.filter((b) => b.status === 'cancelled').length;
    const live = items.filter((b) => b.status !== 'cancelled')
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    out.count = live.length;
    if (live.length) {
      out.first = { at: new Date(live[0].starts_at), name: live[0].customer_name || '', service: live[0].service_name || '' };
    }
    return out;
  }

  async function run() {
    const [brief, today, tomorrow] = await Promise.all([_fetchBrief(), _dayBookings(0), _dayBookings(1)]);
    _markSeen();   // 홈 저녁 칩은 오늘 더 안 보이게

    const lines = [];
    const actions = [];

    // 오늘 결산 — 매출 + 예약 건수 (어제 대비 한 마디)
    if (brief && brief.revenue_total > 0) {
      let cmp = '';
      if (brief.today_total != null && brief.yesterday_total != null) {
        if (brief.today_total > brief.yesterday_total) cmp = ' — 어제보다 좋았어요';
        else if (brief.today_total < brief.yesterday_total) cmp = ' — 어제보단 조금 낮아요';
      }
      lines.push(`오늘 매출 ${_man(brief.revenue_total)} · 예약 ${today.count}건 마감${cmp}`);
    } else if (today.count > 0) {
      lines.push(`오늘 예약 ${today.count}건 마감 (매출 기록은 아직 없어요)`);
    } else {
      lines.push('오늘은 기록된 매출·예약이 없었어요');
    }
    if (today.cancelled > 0) lines.push(`취소 ${today.cancelled}건이 있었어요`);

    // 매출 미기록 — 자기 전 정리 유도 (버튼은 기존 브리핑 runAction 경로 재사용)
    if (brief && brief.unrecorded_count > 0) {
      lines.push(`매출 미기록 ${brief.unrecorded_count}건 — 주무시기 전에 정리해두면 내일이 편해요`);
      actions.push({ id: 'unrecorded_revenue', kind: 'open_unrecorded', label: '매출 미기록 정리', safety: 'safe', payload: { count: brief.unrecorded_count } });
    }

    // 내일 미리보기
    if (tomorrow.count > 0 && tomorrow.first) {
      const f = tomorrow.first;
      lines.push(`내일은 ${tomorrow.count}건 — 첫 손님 ${_hhmm(f.at)} ${f.name ? f.name + '님' : ''}${f.service ? '(' + f.service + ')' : ''}`.replace(/\s+—/, ' —'));
    } else {
      lines.push('내일 예약은 아직 없어요. 여유 있게 시작하셔도 돼요');
    }

    const msg = '🌙 오늘 하루 마감 리포트예요.\n\n'
      + lines.map((l) => '• ' + l).join('\n')
      + '\n\n오늘도 수고 많으셨어요!';
    try { window.ItdasyAssistantContext && window.ItdasyAssistantContext.markRecentAction('마감 리포트'); } catch (_e) { void 0; }
    return { message: msg, actions };
  }

  window.ItdasyClosingReport = { detect, run };
})();
