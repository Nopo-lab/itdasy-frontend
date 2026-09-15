/**
 * P2 회귀 — **서버가 준 시각(UTC, tz-aware)을 문자열 그대로 잘라 화면에 쓰던 것.**
 *
 * 실측(2026-09-13, cbt4):
 *   서버 `recorded_at = 2026-09-12T18:00:00+00:00`  (= KST 2026-09-13 03:00, 예약 시각과 일치)
 *   고객 시술 기록 화면          → **09/12**   (하루 빠름)
 *   회원권 내역 화면             → **09-13 03:36** (실제 12:36, 9시간 빠름)
 *
 * 원인:
 *   app-customer-dashboard.js  `String(r.recorded_at||'').slice(5,10)`
 *   app-membership.js          `(it.recorded_at||'').replace('T',' ').slice(5,16)`
 *   둘 다 timezone 변환 없이 UTC 문자열을 자른다.
 *
 * 같은 레포 app-revenue-calendar.js `_kstDay()` 는 이미 Asia/Seoul 로 제대로 바꾼다 —
 * **같은 기능이 두 벌이고 한쪽에만 가드가 있던** 전형적 패턴이라, 세 번째 복붙을 만들지 않고
 * 이미 날짜 포맷을 모아 둔 format-money.js 에 공용 헬퍼로 올린다.
 *
 * 경계값이 핵심이다: UTC 15:00 이 KST 자정이라 그 앞뒤로 날짜가 갈린다.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MONEY = fs.readFileSync(path.join(ROOT, 'format-money.js'), 'utf8');
const DASH = fs.readFileSync(path.join(ROOT, 'app-customer-dashboard.js'), 'utf8');
const MEM = fs.readFileSync(path.join(ROOT, 'app-membership.js'), 'utf8');

/** format-money.js 를 그대로 실행해 window 에 붙은 헬퍼를 꺼낸다. */
function loadHelpers() {
  const win = {};
  // eslint-disable-next-line no-new-func
  new Function('window', MONEY)(win);
  return win;
}

/** 소스에서 `dt` 를 만드는 줄을 원문 그대로 떼어 실행한다(문자열 grep 아님). */
function runDtLine(src, marker, row, win) {
  const i = src.indexOf(marker);
  expect(i).toBeGreaterThan(-1);
  const end = src.indexOf('\n', i);
  const line = src.slice(i, end).trim().replace(/;$/, '');
  // eslint-disable-next-line no-new-func
  return new Function('r', 'it', 'window', 'fmtKMonthDay', 'fmtKShortDateTime',
    line + '\n; return dt;')(row, row, win, win.fmtKMonthDay, win.fmtKShortDateTime);
}

const CASES = [
  { utc: '2026-09-12T14:59:59+00:00', day: '09/12', dt: '09-12 23:59', why: 'KST 자정 1초 전' },
  { utc: '2026-09-12T15:00:00+00:00', day: '09/13', dt: '09-13 00:00', why: 'KST 자정 정각 — 날짜가 넘어간다' },
  { utc: '2026-09-12T18:00:00+00:00', day: '09/13', dt: '09-13 03:00', why: '실측 사례 (예약 9/13 03:00)' },
  { utc: '2026-09-13T03:36:00+00:00', day: '09/13', dt: '09-13 12:36', why: '실측 사례 (회원권 충전 12:36)' },
];

describe('P2 · 공용 KST 헬퍼', () => {
  test('🔴 fmtKMonthDay / fmtKShortDateTime 가 존재한다', () => {
    const win = loadHelpers();
    expect(typeof win.fmtKMonthDay).toBe('function');
    expect(typeof win.fmtKShortDateTime).toBe('function');
  });

  CASES.forEach((c) => {
    test(`🔴 ${c.utc} → 날짜 ${c.day} (${c.why})`, () => {
      expect(loadHelpers().fmtKMonthDay(c.utc)).toBe(c.day);
    });
    test(`🔴 ${c.utc} → 일시 ${c.dt} (${c.why})`, () => {
      expect(loadHelpers().fmtKShortDateTime(c.utc)).toBe(c.dt);
    });
  });

  test('빈 값·잘못된 값은 빈 문자열 (오탐 방지)', () => {
    const win = loadHelpers();
    ['', null, undefined, 'not-a-date'].forEach((v) => {
      expect(win.fmtKMonthDay(v)).toBe('');
      expect(win.fmtKShortDateTime(v)).toBe('');
    });
  });
});

describe('P2 · 고객 시술 기록 날짜', () => {
  CASES.forEach((c) => {
    test(`🔴 ${c.utc} → ${c.day}`, () => {
      const win = loadHelpers();
      expect(runDtLine(DASH, 'const dt = ', { recorded_at: c.utc }, win)).toBe(c.day);
    });
  });
});

describe('P2 · 회원권 내역 일시', () => {
  CASES.forEach((c) => {
    test(`🔴 ${c.utc} → ${c.dt}`, () => {
      const win = loadHelpers();
      expect(runDtLine(MEM, 'const dt = ', { recorded_at: c.utc }, win)).toBe(c.dt);
    });
  });
});

describe('P2 · UTC 문자열을 그대로 자르지 않는다', () => {
  test('🔴 고객 대시보드에 recorded_at 문자열 slice 가 남아 있지 않다', () => {
    expect(DASH).not.toMatch(/recorded_at[^\n]*\)\s*\.\s*slice\s*\(\s*5\s*,\s*10\s*\)/);
  });
  test('🔴 회원권 내역에 recorded_at 문자열 slice 가 남아 있지 않다', () => {
    expect(MEM).not.toMatch(/recorded_at[^\n]*replace\s*\(\s*'T'/);
  });
});
