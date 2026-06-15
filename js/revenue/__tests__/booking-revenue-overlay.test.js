'use strict';

const fs = require('fs');
const path = require('path');

function loadOverlay() {
  global.window = {};
  const file = path.join(__dirname, '..', 'booking-revenue-overlay.js');
  // eslint-disable-next-line no-eval
  eval(fs.readFileSync(file, 'utf8'));
  return global.window.BookingRevenueOverlay;
}

const bookings = [
  {
    starts_at: '2026-06-16T12:00:00+09:00',
    status: 'confirmed',
    amount: 100000,
    deposit: 20000,
  },
  {
    starts_at: '2026-06-17T12:00:00+09:00',
    status: 'completed',
    amount: 90000,
    deposit: 10000,
  },
  {
    starts_at: '2026-06-18T12:00:00+09:00',
    status: 'cancelled',
    amount: 70000,
    deposit: 20000,
  },
  {
    starts_at: '2026-07-01T12:00:00+09:00',
    status: 'confirmed',
    amount: 50000,
    deposit: 5000,
  },
];

describe('BookingRevenueOverlay', () => {
  const O = loadOverlay();

  test('confirmed current-month bookings add deposit and remaining expected revenue', () => {
    const agg = O.summarizeBookings(bookings, {
      year: 2026,
      month: 6,
      now: '2026-06-15T10:00:00+09:00',
    });
    expect(agg.confirmed_deposit_total).toBe(20000);
    expect(agg.pending_bookings_total).toBe(80000);
    expect(agg.pending_booking_amount_total).toBe(100000);
    expect(agg.booking_count).toBe(1);
  });

  test('revenue summary adds missing deposit once and fixes projection floor', () => {
    const agg = O.summarizeBookings(bookings, {
      year: 2026,
      month: 6,
      now: '2026-06-15T10:00:00+09:00',
    });
    const merged = O.mergeSummary({ total: 100000, count: 1, projected_total: 120000 }, agg);
    expect(merged.total).toBe(120000);
    expect(merged.confirmed_deposit_total).toBe(20000);
    expect(merged.pending_bookings_total).toBe(80000);
    expect(merged.projected_total).toBe(200000);
  });

  test('summary does not double count when backend already included the deposit', () => {
    const agg = O.summarizeBookings(bookings, {
      year: 2026,
      month: 6,
      now: '2026-06-15T10:00:00+09:00',
    });
    const merged = O.mergeSummary({
      total: 120000,
      count: 1,
      confirmed_deposit_total: 20000,
      projected_total: 200000,
    }, agg);
    expect(merged.total).toBe(120000);
    expect(merged.confirmed_deposit_total).toBe(20000);
    expect(merged.projected_total).toBe(200000);
  });

  test('brief total and payment breakdown include missing booking deposit', () => {
    const agg = O.summarizeBookings(bookings, {
      year: 2026,
      month: 6,
      now: '2026-06-15T10:00:00+09:00',
    });
    const merged = O.mergeBrief({ this_month_total: 0, payment_breakdown: {} }, agg);
    expect(merged.this_month_total).toBe(20000);
    expect(merged.payment_breakdown.booking_deposit).toBe(20000);
    expect(merged.pending_bookings_total).toBe(80000);
    expect(merged.projected_total).toBe(100000);
  });
});
