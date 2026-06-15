/* Booking deposit overlay for revenue summaries. */
(function () {
  'use strict';

  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const EXCLUDED_STATUS = new Set(['cancelled', 'completed', 'no_show']);

  function _num(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  }

  function _currentYearMonth() {
    const kst = new Date(Date.now() + KST_OFFSET_MS);
    return { year: kst.getUTCFullYear(), month: kst.getUTCMonth() + 1 };
  }

  function _resolveYearMonth(source) {
    const cur = _currentYearMonth();
    const year = Number(source && source.year) || cur.year;
    const month = Number(source && source.month) || cur.month;
    return { year, month };
  }

  function _monthRange(year, month) {
    const mm = String(month).padStart(2, '0');
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const dd = String(last).padStart(2, '0');
    return {
      from: `${year}-${mm}-01T00:00:00+09:00`,
      to: `${year}-${mm}-${dd}T23:59:59+09:00`,
    };
  }

  function _kstParts(value) {
    const ms = new Date(value || '').getTime();
    if (!Number.isFinite(ms)) return null;
    const kst = new Date(ms + KST_OFFSET_MS);
    return { year: kst.getUTCFullYear(), month: kst.getUTCMonth() + 1 };
  }

  function _inMonth(booking, year, month) {
    const p = _kstParts(booking && booking.starts_at);
    return !!p && p.year === year && p.month === month;
  }

  function _isActive(booking) {
    if (!booking || booking.deleted_at) return false;
    const status = String(booking.status || 'confirmed').toLowerCase();
    return !EXCLUDED_STATUS.has(status);
  }

  function _isFuture(booking, nowMs) {
    const ms = new Date(booking && booking.starts_at).getTime();
    return Number.isFinite(ms) && ms > nowMs;
  }

  function summarizeBookings(bookings, opts) {
    const ym = _resolveYearMonth(opts);
    const nowMs = opts && opts.now ? new Date(opts.now).getTime() : Date.now();
    const out = _emptySummary();
    (Array.isArray(bookings) ? bookings : []).forEach((booking) => {
      _addBooking(out, booking, ym, nowMs);
    });
    return out;
  }

  function _emptySummary() {
    return {
      booking_count: 0,
      booking_deposit_count: 0,
      confirmed_deposit_total: 0,
      pending_bookings_total: 0,
      pending_booking_amount_total: 0,
      pending_booking_remaining_total: 0,
    };
  }

  function _addBooking(out, booking, ym, nowMs) {
    if (!_isActive(booking) || !_inMonth(booking, ym.year, ym.month)) return;
    const amount = _num(booking.amount);
    const deposit = _num(booking.deposit);
    out.booking_count += 1;
    out.confirmed_deposit_total += deposit;
    if (deposit > 0) out.booking_deposit_count += 1;
    if (!_isFuture(booking, nowMs)) return;
    const remaining = Math.max(amount - deposit, 0);
    out.pending_booking_amount_total += amount;
    out.pending_booking_remaining_total += remaining;
    out.pending_bookings_total += remaining;
  }

  function _depositPatch(base, agg) {
    const known = Math.max(_num(base.confirmed_deposit_total), _num(base.booking_deposit_total));
    const target = Math.max(known, _num(agg && agg.confirmed_deposit_total));
    return { target, delta: Math.max(0, target - known) };
  }

  function mergeSummary(summary, agg) {
    const out = Object.assign({}, summary || {});
    const patch = _depositPatch(out, agg || {});
    out.confirmed_deposit_total = patch.target;
    out.booking_deposit_total = patch.target;
    out.total = _num(out.total) + patch.delta;
    _addDepositToOptionalMoney(out, patch.delta);
    _mergePending(out, agg || {});
    _mergeProjection(out, patch.delta);
    out._booking_revenue_overlay = _overlayMeta(patch, agg);
    return out;
  }

  function _addDepositToOptionalMoney(out, delta) {
    if (!delta) return;
    ['net_total', 'net_profit'].forEach((key) => {
      if (out[key] != null) out[key] = _num(out[key]) + delta;
    });
  }

  function _mergePending(out, agg) {
    const pending = _num(agg.pending_bookings_total);
    if (agg.booking_count > 0 || pending > 0) out.pending_bookings_total = pending;
    out.pending_booking_amount_total = _num(agg.pending_booking_amount_total);
    out.pending_booking_remaining_total = _num(agg.pending_booking_remaining_total);
  }

  function _mergeProjection(out, depositDelta) {
    if (out.is_past) {
      out.projected_total = _num(out.total);
      return;
    }
    const current = _num(out.projected_total);
    const pace = current > 0 ? current + depositDelta : _num(out.total);
    const knownBookings = _num(out.total) + _num(out.pending_bookings_total);
    out.projected_total = Math.max(pace, knownBookings);
  }

  function mergeBrief(brief, agg) {
    const out = Object.assign({}, brief || {});
    const patch = _depositPatch(out, agg || {});
    out.confirmed_deposit_total = patch.target;
    out.booking_deposit_total = patch.target;
    out.this_month_total = _num(out.this_month_total) + patch.delta;
    _mergePending(out, agg || {});
    _mergeBriefProjection(out, patch.delta);
    _mergePaymentBreakdown(out, patch.delta);
    out._booking_revenue_overlay = _overlayMeta(patch, agg);
    return out;
  }

  function _mergeBriefProjection(out, depositDelta) {
    const current = _num(out.projected_total);
    const pace = current > 0 ? current + depositDelta : _num(out.this_month_total);
    const knownBookings = _num(out.this_month_total) + _num(out.pending_bookings_total);
    out.projected_total = Math.max(pace, knownBookings);
  }

  function _mergePaymentBreakdown(out, depositDelta) {
    if (!depositDelta) return;
    const pm = Object.assign({}, out.payment_breakdown || {});
    pm.booking_deposit = _num(pm.booking_deposit) + depositDelta;
    out.payment_breakdown = pm;
  }

  function _overlayMeta(patch, agg) {
    return {
      deposit_delta: patch.delta,
      deposit_total: patch.target,
      booking_count: _num(agg && agg.booking_count),
      pending_remaining_total: _num(agg && agg.pending_booking_remaining_total),
    };
  }

  async function _loadBookings(year, month, opts) {
    if (opts && Array.isArray(opts.bookings)) return opts.bookings;
    const range = _monthRange(year, month);
    if (window.Booking && typeof window.Booking.list === 'function') {
      return await window.Booking.list(range.from, range.to);
    }
    return await _fetchBookings(range);
  }

  async function _fetchBookings(range) {
    const headers = window.authHeader ? window.authHeader() : null;
    if (!headers || !headers.Authorization || typeof window.apiFetch !== 'function') return [];
    const qs = new URLSearchParams({ from: range.from, to: range.to });
    const res = await window.apiFetch('/bookings?' + qs.toString(), { headers });
    if (!res.ok) throw new Error('bookings HTTP ' + res.status);
    const data = await res.json();
    return Array.isArray(data && data.items) ? data.items : [];
  }

  async function enrichSummary(summary, opts) {
    const ym = _resolveYearMonth(Object.assign({}, summary || {}, opts || {}));
    try {
      const bookings = await _loadBookings(ym.year, ym.month, opts || {});
      return mergeSummary(summary, summarizeBookings(bookings, Object.assign({}, opts || {}, ym)));
    } catch (err) {
      console.warn('[booking-revenue] 매출 예약금 보강 실패:', err);
      return summary;
    }
  }

  async function enrichBrief(brief, opts) {
    const ym = _resolveYearMonth(opts || {});
    try {
      const bookings = await _loadBookings(ym.year, ym.month, opts || {});
      return mergeBrief(brief, summarizeBookings(bookings, Object.assign({}, opts || {}, ym)));
    } catch (err) {
      console.warn('[booking-revenue] 내샵 예약금 보강 실패:', err);
      return brief;
    }
  }

  window.BookingRevenueOverlay = {
    summarizeBookings,
    mergeSummary,
    mergeBrief,
    enrichSummary,
    enrichBrief,
    _monthRange,
  };
})();
