/**
 * @jest-environment jsdom
 */
'use strict';
/**
 * [2026-09-14] 작업 기억 자동 적용은 기본 OFF. 원장이 켜도 같은 계정·업종·목적의
 * 동의한 기억만 적용한다. ★ 기본은 추천 순서일 뿐 자동 적용 동의를 우회하지 않는다.
 */
const fs = require('fs');
const path = require('path');

function boot() {
  document.body.innerHTML = '';
  localStorage.clear();
  localStorage.setItem('last_user_id', 'qa-owner');
  window.ITDASY_WORK_MEMORY = true;
  window.apiFetch = () => Promise.reject(new Error('offline'));
  window.fetch = () => Promise.reject(new Error('offline'));
  window.showToast = jest.fn();
  window.requestAnimationFrame = (f) => setTimeout(f, 0);
  for (const f of ['work-memory-policy.js', 'work-memory.js', 'work-memory-engine.js', 'workspace-settings.js']) {
    // eslint-disable-next-line no-eval
    window.eval(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'));
  }
  window.WorkMemory.captureFromSlot({ id: 'h', service: '붙임머리', photos: [{ editState: {
    v: 1, layoutIdx: 0, ratio: '4:5', layoutOrder: [], cellCrop: [], adj: [], photoDraw: {}, photoBg: {}, photos: ['x'],
    layers: [{ type: 'sticker', emoji: '💎', x: 0.5, y: 0.5, size: 0.1 }] } }] },
  { service: '붙임머리', industry: '붙임머리', occasion: '완성샷' }, { consent: true });
  window.WorkMemory.clearDefault();
  return window.WorkMemoryEngine;
}
const ctx = { restore: false, incoming: [], photoCount: 1, service: '붙임머리',
  industry: '붙임머리', occasion: '완성샷', accountId: 'qa-owner' };
const stk = (E) => (E.forEditor(ctx) || { layers: [] })
  .layers.filter((l) => l.type === 'sticker').length;

test('자동 적용은 기본 OFF이고, 설정에서 원장이 켠 뒤에만 적용된다', () => {
  const E = boot();
  expect(stk(E)).toBe(0);
  window.WorkspaceSettings.open();
  let sw = document.querySelector('[data-wm-auto]');
  expect(sw).not.toBeNull();
  expect(sw.getAttribute('aria-checked')).toBe('false');
  expect(sw.closest('.ss-toggle').textContent).toContain('추천을 눌러야');
  sw.click();
  expect(window.WorkMemory.autoOn()).toBe(true);
  sw = document.querySelector('[data-wm-auto]');   // 다시 그려진 스위치
  expect(sw.getAttribute('aria-checked')).toBe('true');
  expect(sw.closest('.ss-toggle').textContent).toContain('같은 업종·목적');
  expect(stk(E)).toBe(1);
});

test('다시 끄면 자동 적용이 멈추고 설정은 저장된다', () => {
  const E = boot();
  window.WorkspaceSettings.open();
  document.querySelector('[data-wm-auto]').click();
  document.querySelector('[data-wm-auto]').click();
  expect(localStorage.getItem('itdasy:work_memory:auto')).toBe('false');
  expect(window.WorkMemory.autoOn()).toBe(false);
  expect(stk(E)).toBe(0);
});

test('★ 기본도 자동 적용 OFF를 우회하지 않고 한 탭 추천으로만 보인다', () => {
  const E = boot();
  window.WorkMemory.setDefault(window.WorkMemory.list()[0].id);
  expect(stk(E)).toBe(0);
  expect(E.recommendForEditor(ctx).state.layers.filter((l) => l.type === 'sticker')).toHaveLength(1);
});
