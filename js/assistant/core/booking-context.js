/* 잇비 예약 문맥 기억
   - "내일 예약"으로 보여준 1건을 "그거 취소해"로 이어서 처리
   - 방금 취소한 예약을 "복구해/되돌리기"로 되살림 */
(function () {
  'use strict';

  const TTL_MS = 10 * 60 * 1000;
  const S = { lastList: null, lastCancelled: null, lastCreated: null };

  function _trim(s) { return String(s == null ? '' : s).trim(); }
  function _fresh(x) { return x && Date.now() - (x.ts || 0) < TTL_MS; }
  function _active(b) { return b && !['cancelled', 'completed', 'no_show'].includes(b.status); }
  function _name(b) { return _trim((b && (b.customer_name || b.name)) || '고객'); }

  function _fmt(b) {
    try {
      const d = new Date(b.starts_at);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      return `${mm}/${dd} ${hh}:${mi}`;
    } catch (_e) { return ''; }
  }

  function _dayRange(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const s = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
    const e = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
    return { from: s.toISOString(), to: e.toISOString() };
  }

  function _dateHint(q) {
    const t = _trim(q);
    if (/오늘|금일/.test(t)) return { offset: 0 };
    if (/내일/.test(t)) return { offset: 1 };
    if (/모레/.test(t)) return { offset: 2 };
    const md = t.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/) || t.match(/(\d{1,2})\/(\d{1,2})/);
    if (!md) return null;
    return { month: parseInt(md[1], 10), day: parseInt(md[2], 10) };
  }

  function _matchDate(b, hint) {
    if (!hint || !b || !b.starts_at) return true;
    const d = new Date(b.starts_at);
    if (hint.offset != null) {
      const r = new Date();
      r.setDate(r.getDate() + hint.offset);
      return d.getFullYear() === r.getFullYear() && d.getMonth() === r.getMonth() && d.getDate() === r.getDate();
    }
    return (d.getMonth() + 1) === hint.month && d.getDate() === hint.day;
  }

  function _timeHint(q) {
    const t = _trim(q);
    const m = t.match(/(\d{1,2}):(\d{2})/) || t.match(/(\d{1,2})\s*시\s*(\d{1,2})?\s*분?/);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    if (/(오후|저녁|밤)/.test(t) && h < 12) h += 12;
    if (/(오전|아침)/.test(t) && h === 12) h = 0;
    return { h, min };
  }

  function _matchTime(b, hint) {
    if (!hint || !b || !b.starts_at) return true;
    const d = new Date(b.starts_at);
    return d.getHours() === hint.h && d.getMinutes() === hint.min;
  }

  function _nameHint(q) {
    let s = _trim(q).replace(/(오늘|내일|모레|예약|취소|삭제|지워|없애|캔슬|그거|그|응|네|하라고|해줘|해|님)/g, ' ');
    s = s.replace(/\d{1,2}:\d{2}|\d+\s*시\s*(\d+\s*분)?|\d+\s*월\s*\d+\s*일/g, ' ');
    const m = s.match(/[가-힣]{2,5}/);
    return m ? m[0] : '';
  }

  async function _fetchByDateHint(hint) {
    if (!hint || hint.offset == null || typeof window.apiFetch !== 'function') return [];
    const r = _dayRange(hint.offset);
    const path = `/bookings?from=${encodeURIComponent(r.from)}&to=${encodeURIComponent(r.to)}`;
    const res = await window.apiFetch(path, { headers: window.authHeader ? window.authHeader() : {} });
    if (!res || !res.ok) return [];
    const data = await res.json().catch(() => ({}));
    return ((data && data.items) || []).filter(_active);
  }

  function _rememberList(result) {
    if (!result || !/^bookings_/.test(result.type || '')) return;
    const items = (result.data && Array.isArray(result.data.items)) ? result.data.items.filter(_active) : [];
    S.lastList = { ts: Date.now(), type: result.type, items };
  }

  function _bookingFromAction(action, data) {
    const p = (action && action.payload) || {};
    const b = (action && action._context_booking) || (data && (data.booking || data.item)) || {};
    return {
      id: p.booking_id || b.id || (data && (data.booking_id || data.id)) || null,
      customer_id: p.customer_id || b.customer_id || null,
      customer_name: p.customer_name || b.customer_name || p.name || '',
      service_name: p.service_name || b.service_name || '',
      starts_at: p.starts_at || b.starts_at || '',
      ends_at: p.ends_at || b.ends_at || '',
      status: b.status || '',
    };
  }

  function _rememberAction(action, data) {
    const kind = (action && action.kind) || (data && data.kind) || '';
    const booking = _bookingFromAction(action, data);
    if (kind === 'create_booking' && booking.id) S.lastCreated = { ts: Date.now(), booking };
    if (kind === 'cancel_booking' && booking.id) S.lastCancelled = { ts: Date.now(), booking };
    if (kind === 'restore_booking') S.lastCancelled = null;
  }

  function _cancelAction(b, source) {
    return {
      kind: 'cancel_booking',
      payload: { booking_id: b.id, customer_id: b.customer_id || null, customer_name: _name(b) },
      confirmation_text: `${_name(b)}님 ${_fmt(b)}${b.service_name ? ' ' + b.service_name : ''} 예약 취소할까요?`,
      _source_question: source,
      _context_booking: b,
    };
  }

  function _restoreAction(b, source) {
    return {
      kind: 'restore_booking',
      payload: { booking_id: b.id, customer_id: b.customer_id || null, customer_name: _name(b) },
      confirmation_text: `${_name(b)}님 ${_fmt(b)}${b.service_name ? ' ' + b.service_name : ''} 예약 복구할까요?`,
      _source_question: source,
      _context_booking: b,
    };
  }

  function _askMany(list) {
    const lines = list.slice(0, 5).map((b) => `· ${_fmt(b)} ${_name(b)}${b.service_name ? ' ' + b.service_name : ''}`);
    return `어느 예약을 취소할까요? 시간이나 고객 이름을 같이 알려주세요.\n${lines.join('\n')}`;
  }

  async function _pickCancelTarget(q) {
    const hint = _dateHint(q);
    const time = _timeHint(q);
    const name = _nameHint(q);
    let list = (_fresh(S.lastList) && S.lastList.items) ? S.lastList.items.slice() : [];
    if (hint && hint.offset != null && (!list.length || !list.some((b) => _matchDate(b, hint)))) {
      list = await _fetchByDateHint(hint);
    }
    list = list.filter((b) => _matchDate(b, hint) && _matchTime(b, time));
    if (name) list = list.filter((b) => _name(b).includes(name) || name.includes(_name(b)));
    if (list.length === 1) return { booking: list[0] };
    if (list.length > 1) return { ask: _askMany(list) };
    return null;
  }

  function _looksCancel(q) {
    return /(취소|삭제|지워|없애|캔슬)/.test(_trim(q));
  }

  function _looksRestore(q) {
    return /(복구|되돌리|되살|취소\s*취소|다시\s*살)/.test(_trim(q)) && /예약|그거|내일|오늘|방금|되돌/.test(_trim(q));
  }

  async function tryRun(text) {
    const q = _trim(text);
    if (!q) return null;
    if (_looksRestore(q)) return _restoreResult(q);
    if (!_looksCancel(q)) return null;
    const picked = await _pickCancelTarget(q);
    if (!picked) return null;
    if (picked.ask) return { matched: true, kind: 'message', text: picked.ask };
    return { matched: true, kind: 'card', action: _cancelAction(picked.booking, text) };
  }

  function _restoreResult(q) {
    if (!_fresh(S.lastCancelled) || !S.lastCancelled.booking || !S.lastCancelled.booking.id) {
      return { matched: true, kind: 'message', text: '방금 취소한 예약을 찾지 못했어요. 바로 전에 취소한 예약만 복구할 수 있어요.' };
    }
    return { matched: true, kind: 'card', action: _restoreAction(S.lastCancelled.booking, q) };
  }

  function _installActionSupport() {
    const api = window.ItdasyAssistant;
    if (!api || typeof api.registerLocalHandler !== 'function') return;
    if (typeof api.registerKindMeta === 'function') {
      api.registerKindMeta({ restore_booking: { icon: 'ic-refresh-cw', label: '예약 복구', color: 'var(--brand)' } });
    }
    if (api.RISKY_ACTION_KINDS && typeof api.RISKY_ACTION_KINDS.add === 'function') api.RISKY_ACTION_KINDS.add('restore_booking');
    api.registerLocalHandler('restore_booking', async (action) => {
      const p = (action && action.payload) || {};
      if (!p.booking_id) return { message: '복구할 예약을 찾지 못했어요' };
      if (!window.Booking || typeof window.Booking.update !== 'function') throw new Error('예약 기능을 불러오지 못했어요');
      const updated = await window.Booking.update(p.booking_id, { status: 'confirmed' });
      const b = Object.assign({}, action._context_booking || {}, updated || {});
      return { message: `📅 ${_name(b)}님 ${_fmt(b)} 예약 복구했어요`, booking: b };
    });
  }

  _installActionSupport();
  window.ItdasyBookingContext = { rememberList: _rememberList, rememberAction: _rememberAction, tryRun };
})();
