/**
 * @jest-environment jsdom
 */
'use strict';
/** [2026-09-13 UX·돈] 매출을 못 불러왔는데 0원·N건(로컬 목록으로 지은 합계)을 보여주던 것 · 지난달 달력에 이번달 목록. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
function boot() {
  document.body.innerHTML = '<div id="t"></div>';
  window.Revenue = { _rerender: jest.fn() };
  global.formatMoney = window.formatMoney = (n) => Number(n).toLocaleString('ko-KR') + '원';
  global.formatEstimate = window.formatEstimate = global.formatMoney;
  // eslint-disable-next-line no-eval
  window.eval(fs.readFileSync(path.join(ROOT, 'app-revenue-month.js'), 'utf8'));
  return window.RevenueMonth;
}
test('🔴 _loadFailed 요약이면 금액을 그리지 않고 실패+다시 불러오기 (모바일·PC)', () => {
  const M = boot();
  const t = document.getElementById('t');
  M.renderMobile(t, { _loadFailed: true }, []);
  expect(t.textContent).toMatch(/매출을 불러오지 못했어요/);
  expect(t.textContent).not.toMatch(/0원/);
  expect(t.querySelector('[data-rvm-act="retry-load"]')).not.toBeNull();
  M.renderPC(t, { _loadFailed: true }, []);
  expect(t.textContent).toMatch(/매출을 불러오지 못했어요/);
});
test('정상 요약은 기존대로 금액', () => {
  const M = boot();
  const t = document.getElementById('t');
  M.renderMobile(t, { total: 40000, count: 1 }, []);
  expect(t.textContent).toMatch(/40,000/);
});
test('호출부: 오프라인 모드가 아니면 로컬 합계를 짓지 않는다 · 지난달 목록 실패는 빈 목록으로 삼키지 않는다', () => {
  const R = fs.readFileSync(path.join(ROOT, 'app-revenue.js'), 'utf8');
  expect(R).toMatch(/summary = _isOffline \? window\.RevenueMonth\.fallbackSummary\(_items\) : \{ _loadFailed: true \};/);
  const RM = fs.readFileSync(path.join(ROOT, 'app-revenue-month.js'), 'utf8');
  expect(RM).toMatch(/if \(!r2\.ok\) throw new Error\('HTTP ' \+ r2\.status\);/);
  expect(RM).not.toMatch(/\} else \{ _viewItems = \[\]; \}/);
});
