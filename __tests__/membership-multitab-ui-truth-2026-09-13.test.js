'use strict';
/**
 * [2026-09-13 여러 탭 실측 · 계정5 · 고객 717]
 * S1: 두 탭이 같은 예약을 1ms 차로 '시술 완료(회원권 30,000)' → 서버 차감 1건(잔액 40,000·원장합 일치) ✅
 *     그런데 늦은 탭 토스트가 "시술 완료했어요 · 매출에는 넣지 않았어요" — 원장은 안 빠진 줄 알고 다시 차감할 수 있다.
 * S2: 잔액 50,000 · 두 탭 40,000 동시 차감 → 한 건만 성공(10,000) ✅ · 진 탭 시트 머리말은 "현재 잔액 50,000원" 그대로.
 */
const fs = require('fs');
const path = require('path');
const CF = fs.readFileSync(path.join(__dirname, '..', 'app-complete-flow.js'), 'utf8');
const MS = fs.readFileSync(path.join(__dirname, '..', 'app-membership.js'), 'utf8');

test('🔴 서버가 기존 기록 id 만 돌려주면(이미 완료) "한 번만 반영돼 있어요" 로 말한다', () => {
  const i = CF.indexOf('if (eff.membership_deducted) {');
  const block = CF.slice(i, i + 1400);
  const idx = block.indexOf('else if (eff.revenue_id)');
  expect(idx).toBeGreaterThan(0);
  expect(block.slice(idx, idx + 300)).toMatch(/회원권 차감은 한 번만 반영돼 있어요/);
  // '매출에는 넣지 않았어요' 는 원장이 매출 제외를 골랐을 때만
  expect(block).toMatch(/window\.showToast\(includeRev \? '시술 완료했어요' : '시술 완료했어요 · 매출에는 넣지 않았어요'\)/);
  expect(block.indexOf('else if (eff.revenue_id)')).toBeLessThan(block.indexOf("includeRev ? '시술 완료했어요'"));
});

test('🔴 회원권 사용 실패 시 시트의 잔액·내역을 서버 값으로 다시 맞춘다', () => {
  const i = MS.indexOf("sheet.querySelector('#msUseConfirm').addEventListener('click'");
  const catchIdx = MS.indexOf('} catch (e) {', i);
  expect(MS.slice(catchIdx, catchIdx + 900)).toMatch(/_refreshUseSheet\(sheet, customerId, customerName\);/);
  const f = MS.slice(MS.indexOf('async function _refreshUseSheet'), MS.indexOf('function openUseSheet('));
  expect(f).toMatch(/_fetch\('GET', '\/customers\/' \+ encodeURIComponent\(customerId\)\)/);
  expect(f).toMatch(/현재 잔액 \$\{formatMoney\(bal\)\}/);
  expect(f).toMatch(/_loadHistory\(customerId/);
});

test('시술 완료가 실패하면(다른 탭이 잔액을 먼저 씀) 회원권 잔액 줄을 다시 읽는다', () => {
  expect(CF).toMatch(/if \(ctx\.method === 'membership'\) \{ ctx\._memBal = undefined; ctx\._memBalLoading = false; _render\(\); \}/);
});
