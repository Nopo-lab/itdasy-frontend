/**
 * @jest-environment jsdom
 */
'use strict';
/**
 * [2026-09-13 UX] 홈이 불러오기에 실패했는데 "없어요" 로 말하던 것.
 * 라이브 재현(/assistant/brief 503): "오늘 예약 없음" + "오늘은 여유 있는 하루네요" — 원장은 예약이 없는 줄 안다.
 * 고객 메시지: /dm-confirm-queue 실패 시 스켈레톤이 영영 돌고, ↻ 는 실패해도 "새로 불러왔어요 ✓".
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

function loadRenderers() {
  window.HomeV41Config = { BOOKING_EMPTY_DISPLAY: 'show' };
  // eslint-disable-next-line no-eval
  window.eval(fs.readFileSync(path.join(ROOT, 'js/home/v41-renderers.js'), 'utf8'));
  return window.HomeV41Render;
}

describe('홈 — 실패와 빈 상태를 구분', () => {
  test('🔴 brief 실패 → "오늘 예약 없음"·"여유 있는 하루" 를 말하지 않고 실패+다시 시도', () => {
    const R = loadRenderers();
    const html = R.compose({ _briefFailed: true }, 0);
    expect(html).not.toMatch(/오늘 예약 없음/);
    expect(html).not.toMatch(/여유 있는 하루/);
    expect(html).toMatch(/오늘 예약을 불러오지 못했어요 · 다시 시도/);
    expect(html).toMatch(/data-hv-act="retryBrief">오늘 예약을 불러오지 못했어요/);
    expect(html).toMatch(/오늘 정보를 못 불러왔어요/);
  });
  test('진짜 0건이면 기존대로 "오늘 예약 없음"', () => {
    const R = loadRenderers();
    const html = R.compose({ today_bookings: [], this_month_total: 0 }, 0);
    expect(html).toMatch(/오늘 예약 없음/);
    expect(html).not.toMatch(/불러오지 못했어요/);
  });
});

describe('고객 메시지 — 실패 시 스켈레톤 고착·거짓 성공 토스트 없음', () => {
  function boot(fetchImpl) {
    document.body.innerHTML = '<section id="hv5Cmsg"><span id="hv5CmsgCount"></span><div id="hv5CmsgRow"></div><button id="hv5CmsgRefresh"></button></section>';
    window.authHeader = () => ({ Authorization: 'Bearer x' });
    global.apiFetch = window.apiFetch = fetchImpl;
    window.showToast = jest.fn();
    jest.useFakeTimers();
    // eslint-disable-next-line no-eval
    window.eval(fs.readFileSync(path.join(ROOT, 'app-home-customer-msgs.js'), 'utf8'));
    return window.HomeCustomerMsgs;
  }
  afterEach(() => jest.useRealTimers());

  test('🔴 첫 로드 실패 → 스켈레톤이 아니라 "불러오지 못했어요"', async () => {
    const M = boot(async () => ({ ok: false, status: 503, headers: { get: () => null } }));
    const ok = await M.refresh();
    expect(ok).toBe(false);
    const row = document.getElementById('hv5CmsgRow').textContent;
    expect(row).toMatch(/메시지를 불러오지 못했어요/);
    expect(row).not.toMatch(/새 메시지 없어요/);
  });
  test('성공 0건이면 "새 메시지 없어요"', async () => {
    const M = boot(async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => [] }));
    expect(await M.refresh()).toBe(true);
    expect(document.getElementById('hv5CmsgRow').textContent).toMatch(/새 메시지 없어요/);
  });
  test('↻ 토스트는 결과대로 말한다', () => {
    const src = fs.readFileSync(path.join(ROOT, 'app-home-customer-msgs.js'), 'utf8');
    expect(src).toMatch(/window\.showToast\(ok !== false \? '메시지를 새로 불러왔어요 ✓' : '메시지를 불러오지 못했어요/);
  });
});
