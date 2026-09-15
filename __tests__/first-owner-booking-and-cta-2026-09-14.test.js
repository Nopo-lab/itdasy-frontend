'use strict';
/* [2026-09-14 첫원장 라이브]
 *  ① 새 손님으로 예약 저장 → 그 손님 상세를 열면 예약 흔적 0 ('0회 방문 · 0만' 뿐).
 *     서버 /customers/{id}/dashboard 는 recent_bookings 에 방금 예약을 담아 보냈는데 화면이 안 그렸다.
 *  ② 작업실 캡션 화면의 '나중에 이어서하기'(ghost CTA) 가 시그니처 로즈 그라데이션에 덮여
 *     회색 글자·분홍 바탕(대비 ~1.2:1) — 위 '인스타에 바로 올리기' 와 같은 버튼 두 개로 보였다. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'app-customer-dashboard.js'), 'utf8');

function pick(name) {
  const i = SRC.indexOf('  function ' + name + '(');
  if (i < 0) throw new Error(name);
  let d = 0, st = false;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) {
    if (SRC[k] === '{') { d++; st = true; } else if (SRC[k] === '}') { d--; if (st && d === 0) return SRC.slice(i, k + 1); }
  }
  throw new Error(name);
}
function load() {
  const cst = SRC.match(/  const _BK_STATUS = [^\n]+\n/)[0];
  const win = { fmtKShortDateTime: (iso) => { const d = new Date(new Date(iso).getTime() + 9 * 3600e3); const p = (n) => String(n).padStart(2, '0'); return p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()); } };
  // eslint-disable-next-line no-new-func
  return new Function('window', 'function _esc(s){return String(s==null?"":s).replace(/[<>&"]/g,"");}\n' + cst + pick('_renderBookingSection') + '; return _renderBookingSection;')(win);
}

test('🔴 방금 잡은 예약이 고객 상세에 보인다 (KST 시각 · 시술 · 예정)', () => {
  const r = load();
  const future = new Date(Date.now() + 86400e3).toISOString();
  const h = r([{ id: 862, starts_at: future, service_name: 'QA 붙임머리 100모', status: 'confirmed' }]);
  expect(h).toMatch(/<span>예약<\/span>/);
  expect(h).toMatch(/QA 붙임머리 100모/);
  expect(h).toMatch(/>예정</);
  expect(h).toMatch(/\d\d\/\d\d \d\d:\d\d/);
});

test('지난 예약은 상태 그대로(완료·취소·노쇼), 예약이 없으면 칸 자체를 안 만든다', () => {
  const r = load();
  const past = '2026-09-01T06:00:00+00:00';
  const h = r([
    { starts_at: past, service_name: 'A', status: 'completed' },
    { starts_at: past, service_name: 'B', status: 'cancelled' },
    { starts_at: past, service_name: 'C', status: 'no_show' },
  ]);
  expect(h).toMatch(/>완료</); expect(h).toMatch(/>취소</); expect(h).toMatch(/>노쇼</);
  expect(h).toMatch(/09\/01 15:00/);
  expect(r([])).toBe('');
  expect(r(undefined)).toBe('');
});

test('상세 화면 조립에 예약 칸이 들어가 있다', () => {
  expect(SRC).toMatch(/\$\{_renderBookingSection\(d && d\.recent_bookings\)\}/);
});

test('🔴 시그니처 스킨이 보조 CTA(ghost·alt) 를 로즈 그라데이션으로 덮지 않는다', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css', 'workspace-signature.css'), 'utf8');
  const gi = css.indexOf('body.ws-sig .wsv2flow .wsv2flow__cta,');
  const oi = css.indexOf('body.ws-sig .wsv2flow .wsv2flow__cta--ghost,');
  expect(gi).toBeGreaterThan(-1);
  expect(oi).toBeGreaterThan(gi);            // 뒤에 와야 이긴다(명시도 동일)
  const block = css.slice(oi, css.indexOf('}', oi));
  expect(block).toMatch(/wsv2flow__cta--alt/);
  expect(block).toMatch(/background:\s*var\(--surface\)/);
});
