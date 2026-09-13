/** @jest-environment jsdom */
/* [ITBI Closeout 2026-09-13 · P1] 잇비 창(z 10500) 위에서 연 신고 모달이 뒤(z 10050)에 깔려 제출 불가였다. */
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'app-content-report.js'), 'utf8');

function boot() {
  document.body.innerHTML = '';
  // eslint-disable-next-line no-new-func
  new Function(SRC)();
}

test('잇비 창이 떠 있으면 모달이 그 위로 올라간다', () => {
  boot();
  const sheet = document.createElement('div');
  sheet.id = 'assistantSheet'; sheet.style.position = 'fixed'; sheet.style.zIndex = '10500';
  document.body.appendChild(sheet);
  window.openContentReport({ contentType: 'chat_answer', snippet: 'x' });
  const m = document.getElementById('aiContentReportModal');
  expect(m.style.display).toBe('flex');
  expect(parseInt(m.style.zIndex, 10)).toBeGreaterThan(10500);
});

test('아무것도 없으면 기존 값(10050)', () => {
  boot();
  window.openContentReport({ contentType: 'caption', snippet: 'y' });
  expect(document.getElementById('aiContentReportModal').style.zIndex).toBe('10050');
});

test('숨은 레이어·최댓값 배너는 기준에서 뺀다', () => {
  boot();
  const hidden = document.createElement('div'); hidden.style.position = 'fixed'; hidden.style.zIndex = '20000'; hidden.style.display = 'none';
  const banner = document.createElement('div'); banner.style.position = 'fixed'; banner.style.zIndex = '2147483647';
  document.body.append(hidden, banner);
  window.openContentReport({ contentType: 'caption', snippet: 'z' });
  expect(document.getElementById('aiContentReportModal').style.zIndex).toBe('10050');
});
