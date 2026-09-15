/**
 * @jest-environment jsdom
 */
'use strict';
/* [2026-09-14 첫원장 라이브] 새 원장이 시술 메뉴를 처음 열었을 때
 *  ① 빈 화면 가운데 [첫 시술 추가] 가 아무 반응이 없었다(emptyState 버튼만 그리고 바인딩 0).
 *  ② 추가 폼 칸이 2fr 1fr 80px 라 input 최소폭 때문에 안 줄어 411px 폰에서 '분' 칸이 화면 밖(x=536)
 *     → 걸리는 시간을 넣을 방법이 없었다.
 *  ③ 입구(내 샵 관리 > 샵 관리) 부제에 '시술 메뉴' 가 없어 어디서 등록하는지 못 찾음. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'app-service-templates.js'), 'utf8');
const EMPTY = fs.readFileSync(path.join(ROOT, 'app-empty-state.js'), 'utf8');

function boot(items) {
  document.body.innerHTML = '<div id="sheet"></div>';
  window._esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  window.openSheet = ({ body }) => { document.getElementById('sheet').innerHTML = body; };
  window.getToken = () => 't';
  window.showToast = () => {};
  global.fetch = window.fetch = async () => ({ ok: true, status: 200, json: async () => ({ items }), text: async () => '' });
  Element.prototype.scrollIntoView = function () {};
  // eslint-disable-next-line no-eval
  window.eval(EMPTY); window.eval(SRC);
}
const tick = (ms) => new Promise((r) => setTimeout(r, ms));

test('🔴 빈 화면 [첫 시술 추가] 를 누르면 추가 폼이 열린다', async () => {
  boot([]);
  await window.openServiceTemplates();
  await tick(80);
  const panel = document.getElementById('svc-add-panel');
  expect(panel.style.display).toBe('none');
  const cta = document.querySelector('[data-empty-cta]');
  expect(cta).toBeTruthy();
  cta.click();
  expect(panel.style.display).toBe('');
  // 한 번 더 눌러도 닫히지 않는다(열기 전용)
  cta.click();
  expect(panel.style.display).toBe('');
});

test('상단 [+ 새 시술 추가] 는 여전히 열고 닫는다', async () => {
  boot([]);
  await window.openServiceTemplates();
  await tick(80);
  const panel = document.getElementById('svc-add-panel');
  document.querySelector('.svc-add-btn').click();
  expect(panel.style.display).toBe('');
  document.querySelector('.svc-add-btn').click();
  expect(panel.style.display).toBe('none');
});

test('🔴 폼 칸이 좁은 폰에서 줄어들 수 있고(minmax 0 + min-width 0) 칸 이름이 보인다', () => {
  expect(SRC).not.toMatch(/grid-template-columns:2fr 1fr 80px/);
  expect(SRC).toMatch(/grid-template-columns:minmax\(0,2fr\) minmax\(0,1\.3fr\) minmax\(0,1fr\)/);
  for (const id of ['svc-name', 'svc-price', 'svc-dur']) {
    const m = SRC.match(new RegExp('<input id="' + id + '"[^>]*>'));
    expect(m && m[0]).toMatch(/min-width:0/);
  }
  expect(SRC).toMatch(/<span>시간\(분\)<\/span>/);
});

test('샵 관리 부제에 시술 메뉴가 보인다', () => {
  const M = fs.readFileSync(path.join(ROOT, 'js', 'myshop-menu.js'), 'utf8');
  expect(M).toMatch(/meta: '샵 정보 · 시술 메뉴 · 백업'/);
});
