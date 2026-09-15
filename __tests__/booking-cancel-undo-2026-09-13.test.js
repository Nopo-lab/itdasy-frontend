/**
 * @jest-environment jsdom
 */
'use strict';
/**
 * [2026-09-13 UX] 실수로 취소한 예약을 되돌릴 길이 잇비에게 말하는 것뿐이었다 · 되돌리기 토스트는 눌러도 반응 없음.
 * 라이브 실측: 완료 예약 취소 → +40,000 / -40,000(합계 0) · status=confirmed 로 되돌려도 매출행 그대로(합계 0).
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CORE = fs.readFileSync(path.join(ROOT, 'app-core.js'), 'utf8');
function slice(start, end) { const i = CORE.indexOf(start); const j = CORE.indexOf(end, i); if (i < 0 || j < 0) throw new Error(start); return CORE.slice(i, j); }

function loadToast() {
  document.body.innerHTML = '';
  const src = 'const TOAST_MAX_DURATION = 5000; let _toastQueue = [], _toastActive = false, _toastHideTimer = null, _toastNextTimer = null;\n'
    + slice('function showToast(msg, opts) {', '// [버그5] 예약 메모 표시용')
    + slice("window._bookingCancelMsg = function (booking) {", '// 2중 확인 유틸')
    + '; return { showToast };';
  window._isInternalErrorText = () => false; window._userSafeToastText = (x) => x;
  global.requestAnimationFrame = (f) => f();
  // eslint-disable-next-line no-new-func
  return new Function('window', src)(window);
}

describe('토스트 버튼', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  test('action 을 주면 누를 수 있는 버튼이 생기고 누르면 실행된다', () => {
    const { showToast } = loadToast();
    const fn = jest.fn();
    showToast('예약을 취소했어요', { action: { label: '되돌리기', onClick: fn } });
    const b = document.querySelector('#itdToast button');
    expect(b).not.toBeNull();
    expect(b.textContent).toBe('되돌리기');
    b.click();
    expect(fn).toHaveBeenCalledTimes(1);
  });
  test('action 없으면 버튼 없음(기존 토스트 그대로)', () => {
    const { showToast } = loadToast();
    showToast('저장했어요');
    expect(document.querySelector('#itdToast button')).toBeNull();
  });
});

describe('🔴 취소 → 되돌리기', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  async function run(prev) {
    loadToast();
    window.Booking = { update: jest.fn(async () => ({})) };
    const after = jest.fn();
    window._showBookingCancelledToast(855, prev, after);
    document.querySelector('#itdToast button').click();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    return { upd: window.Booking.update, after };
  }
  test('확정 예약은 확정으로 되돌리고 화면을 새로 그린다', async () => {
    const { upd, after } = await run('confirmed');
    expect(upd).toHaveBeenCalledWith(855, { status: 'confirmed' });
    expect(after).toHaveBeenCalled();
  });
  test('완료였던 예약은 매출을 몰래 되살리지 않도록 "확정" 으로만 되돌린다', async () => {
    const { upd } = await run('completed');
    expect(upd).toHaveBeenCalledWith(855, { status: 'confirmed' });
  });
  test('세 취소 경로가 모두 되돌리기 토스트를 쓴다', () => {
    const CAL = fs.readFileSync(path.join(ROOT, 'app-calendar-view.js'), 'utf8');
    const CF = fs.readFileSync(path.join(ROOT, 'app-complete-flow.js'), 'utf8');
    expect((CAL.match(/window\._showBookingCancelledToast\(/g) || []).length).toBe(2);
    expect(CF).toMatch(/window\._showBookingCancelledToast\(ctx\.booking_id, ctx\.status/);
  });
  test('확인창은 회계 용어(상계) 대신 원장 말로', () => {
    loadToast();
    const m = window._bookingCancelMsg({ status: 'completed', amount: 40000 });
    expect(m).not.toMatch(/상계/);
    expect(m).toMatch(/40,000원/);
    expect(m).toMatch(/되돌릴 수 있어요/);
  });
});
