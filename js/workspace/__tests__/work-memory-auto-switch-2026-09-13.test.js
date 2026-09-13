/**
 * @jest-environment jsdom
 */
'use strict';
/**
 * [2026-09-13 ZH P3-D] 작업 기억 '자동 올리기'를 끌 방법이 화면에 없었다.
 * 설정 문구는 "★ 기본으로 고른 건 다음 사진에 자동으로" 였지만 실제 자동 선택(autoOn, 기본 ON)은
 * ★ 와 무관하게 기억 중 1등을 얹었다 → ★ 해제로는 안 멈춤. setAutoOn 을 부르는 곳 0.
 */
const fs = require('fs');
const path = require('path');

function boot() {
  document.body.innerHTML = '';
  localStorage.clear();
  window.ITDASY_WORK_MEMORY = true;
  window.apiFetch = () => Promise.reject(new Error('offline'));
  window.fetch = () => Promise.reject(new Error('offline'));
  window.showToast = jest.fn();
  window.requestAnimationFrame = (f) => setTimeout(f, 0);
  for (const f of ['work-memory.js', 'work-memory-engine.js', 'workspace-settings.js']) {
    // eslint-disable-next-line no-eval
    window.eval(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'));
  }
  window.WorkMemory.captureFromSlot({ id: 'h', service: '붙임머리', photos: [{ editState: {
    v: 1, layoutIdx: 0, ratio: '4:5', layoutOrder: [], cellCrop: [], adj: [], photoDraw: {}, photoBg: {}, photos: ['x'],
    layers: [{ type: 'sticker', emoji: '💎', x: 0.5, y: 0.5, size: 0.1 }] } }] }, { service: '붙임머리' });
  window.WorkMemory.clearDefault();   // ★ 해제 상태 — 예전 문구대로면 아무것도 안 올라가야 한다
  return window.WorkMemoryEngine;
}
const stk = (E) => (E.forEditor({ restore: false, incoming: [], photoCount: 1, service: '붙임머리' }) || { layers: [] })
  .layers.filter((l) => l.type === 'sticker').length;

test('설정 작업 기억 카드에 자동 올리기 스위치가 있고, 끄면 ★ 없는 기억은 안 올라간다', () => {
  const E = boot();
  expect(stk(E)).toBe(1);                       // 사실 확인: ★ 해제해도 자동으로 올라감(스위치가 필요한 이유)
  window.WorkspaceSettings.open();
  let sw = document.querySelector('[data-wm-auto]');
  expect(sw).not.toBeNull();
  expect(sw.getAttribute('aria-checked')).toBe('true');
  expect(sw.closest('.ss-toggle').textContent).toContain('같은 시술');
  sw.click();
  expect(window.WorkMemory.autoOn()).toBe(false);
  sw = document.querySelector('[data-wm-auto]');   // 다시 그려진 스위치
  expect(sw.getAttribute('aria-checked')).toBe('false');
  expect(sw.closest('.ss-toggle').textContent).toContain('꺼져 있어요');
  expect(stk(E)).toBe(0);
});

test('다시 켜면 돌아온다 · 설정은 새로고침 뒤에도 유지(localStorage)', () => {
  const E = boot();
  window.WorkspaceSettings.open();
  document.querySelector('[data-wm-auto]').click();
  expect(localStorage.getItem('itdasy:work_memory:auto')).toBe('false');
  document.querySelector('[data-wm-auto]').click();
  expect(window.WorkMemory.autoOn()).toBe(true);
  expect(stk(E)).toBe(1);
});

test('꺼도 ★ 기본으로 고른 건 올라간다(원장이 명시로 고른 것)', () => {
  const E = boot();
  window.WorkMemory.setAutoOn(false);
  window.WorkMemory.setDefault(window.WorkMemory.list()[0].id);
  expect(stk(E)).toBe(1);
});
