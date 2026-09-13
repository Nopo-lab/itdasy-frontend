'use strict';
/**
 * [2026-09-13 ZH S20 Run4] 캡션까지 만든 게시물이 새로고침 한 번에 통째로 사라지던 것.
 * 실측(라이브): 전·후 2장 → 합치기 → 답 3개 → 캡션 생성 → 새로고침 → 새 슬롯 0 · 초안 0.
 */
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'workspace-v2-flow.js'), 'utf8');
const C = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, '');

function genBody() {
  const i = C.indexOf('function doGenerate(');
  const j = C.indexOf("} else { toast(r.toast || '게시글 생성에 실패했어요'); }", i);
  expect(i).toBeGreaterThan(0); expect(j).toBeGreaterThan(i);
  return { ok: C.slice(i, j), after: C.slice(j, j + 400) };
}

test('🔴 글이 만들어지면(성공 분기) 조용히 슬롯에 적는다 — logId 까지 채운 뒤', () => {
  const { ok } = genBody();
  const li = ok.lastIndexOf('d.logId = r.log_id || d.logId || null;');
  const pi = ok.lastIndexOf('_persistEditQuiet()');
  expect(li).toBeGreaterThan(0);
  expect(pi).toBeGreaterThan(li);
});

test('실패 분기에서는 적지 않는다(빈 글로 슬롯을 만들지 않음)', () => {
  const { after } = genBody();
  const k = after.indexOf("setScreen('caption')");
  expect(after.slice(0, k)).not.toMatch(/_persistEditQuiet/);
});

test('조용한 저장은 토스트·갤러리·학습을 안 부른다(저장 완료 신호가 아님)', () => {
  const i = C.indexOf('function _persistEditQuiet()');
  const body = C.slice(i, C.indexOf('function save()', i));
  expect(body).toMatch(/window\.saveSlotToDB\(buildSlot\(\)\)/);
  expect(body).not.toMatch(/toast\(|saveItem|WorkMemory|WMLearn/);
});

test('닫힌 뒤 늦게 온 응답은 적지 않는다(토큰 게이트가 저장보다 앞)', () => {
  const { ok } = genBody();
  const gate = ok.indexOf("if (_myToken !== _genToken) { if (cur === 'caption') setScreen('caption'); return; }");
  expect(gate).toBeGreaterThan(0);
  expect(gate).toBeLessThan(ok.lastIndexOf('_persistEditQuiet()'));
});
