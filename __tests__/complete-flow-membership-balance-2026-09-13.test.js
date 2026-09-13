/**
 * @jest-environment jsdom
 */
'use strict';
/**
 * [2026-09-13 UX·돈] 시술 완료에서 회원권을 고르면 잔액이 어디에도 안 보였다.
 * 라이브 실측: 충전 100,000 → 30,000 차감 → 잔액 70,000(서버). 화면엔 잔액 표시 0곳, 토스트 '회원권 30,000원 차감 완료'.
 */
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'app-complete-flow.js'), 'utf8');

function pick(name) {
  const i = SRC.indexOf('  function ' + name + '(');
  if (i < 0) throw new Error(name);
  let d = 0, st = false;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) {
    if (SRC[k] === '{') { d++; st = true; } else if (SRC[k] === '}') { d--; if (st && d === 0) return SRC.slice(i, k + 1); }
  }
  throw new Error(name);
}
function load(fetchImpl) {
  const env = { renders: 0 };
  // eslint-disable-next-line no-new-func
  const f = new Function('window', 'env',
    'let _ctx = null; function _render(){ env.renders++; }\n' + pick('_won') + pick('_memBalanceHtml') + pick('_loadMemBalance')
    + '; return { html: _memBalanceHtml, setCtx: (c) => { _ctx = c; } };');
  const api = f({ apiFetch: fetchImpl }, env);
  return { api, env };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

test('🔴 잔액을 읽어 "지금 → 차감 후" 를 보여준다', async () => {
  const { api, env } = load(async () => ({ ok: true, json: async () => ({ membership_balance: 100000 }) }));
  const c = { customer_id: 716, amount: 30000, method: 'membership' };
  api.setCtx(c);
  expect(api.html(c)).toMatch(/확인 중/);
  await flush(); await flush();
  expect(env.renders).toBe(1);
  const h = api.html(c);
  expect(h).toMatch(/남은 잔액 <b>100,000원<\/b> → 차감 후 <b>70,000원<\/b>/);
});

test('모자라면 저장 전에 얼마 모자라는지 말한다', async () => {
  const { api } = load(async () => ({ ok: true, json: async () => ({ membership_balance: 20000 }) }));
  const c = { customer_id: 716, amount: 30000 };
  api.setCtx(c); api.html(c); await flush(); await flush();
  expect(api.html(c)).toMatch(/10,000원 모자라요/);
});

test('못 읽으면 0원이라고 하지 않는다', async () => {
  const { api } = load(async () => ({ ok: false }));
  const c = { customer_id: 716, amount: 30000 };
  api.setCtx(c); api.html(c); await flush(); await flush();
  const h = api.html(c);
  expect(h).toMatch(/확인하지 못했어요/);
  expect(h).not.toMatch(/0원/);
});

test('완료 폼에서 회원권일 때만 붙고, 노쇼 폼엔 안 붙는다 · 매출 설명은 원장 말로', () => {
  expect((SRC.match(/_memBalanceHtml\(c\)/g) || []).length).toBe(2);   // 호출 1 + 정의 안 재귀 없음 → 정의 시그니처 1
  expect(SRC).toMatch(/\$\{c\.method === 'membership' \? _memBalanceHtml\(c\) : ''\}/);
  expect(SRC).not.toMatch(/회원권 차감은 항상 기록돼요/);
});
