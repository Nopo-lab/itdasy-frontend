'use strict';
/**
 * [2026-09-13 ZH 🔴 계정 격리] 같은 브라우저의 다른 탭에서 다른 계정으로 로그인하면 이 탭의 작업이 그 계정 서버로 올라갔다.
 * 라이브 실측: 계정 5 탭에서 네일 글 저장(07:58:31Z) → 다른 탭이 계정 4 로그인 → 07:58:55Z upsert 가 계정 4 토큰으로 발신
 * → 계정 4 의 GET /workspace/slots 에 계정 5 글 `mtzft4mt5urkd` 가 생김.
 * 토큰·last_user_id·itdasy_gdb_owner 가 전부 탭 공용 localStorage 라 기존 소유자 도장 가드가 통과했다.
 */
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'workspace-sync.js'), 'utf8');
const C = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/[^\n]*$/gm, '');

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const tok = (sub) => 'h.' + b64u({ sub: String(sub), exp: 9999999999 }) + '.s';

function load() {
  const i = SRC.indexOf('  var _sessionUser = null, _switchWarned = false;');
  const j = SRC.indexOf('  function ready() {', i);
  expect(i).toBeGreaterThan(0); expect(j).toBeGreaterThan(i);
  const listeners = {};
  const env = { current: tok(5), toasts: [], events: [] };
  const win = {
    showToast: (m) => env.toasts.push(m),
    dispatchEvent: (e) => { env.events.push(e.type); (listeners[e.type] || []).forEach((f) => f(e)); },
    addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
  };
  // eslint-disable-next-line no-new-func
  const api = new Function('window', 'authHeader', 'atob', 'CustomEvent',
    SRC.slice(i, j) + '; return { sessionUser: sessionUser, accountSwitched: accountSwitched, foreignSlot: foreignSlot, adopt: _adoptSession };')(
    win, () => ({ Authorization: 'Bearer ' + env.current }),
    (s) => Buffer.from(s, 'base64').toString('binary'),
    function (type, init) { this.type = type; this.detail = init && init.detail; });
  return { api, env, win };
}

describe('탭 세션 계정 vs 지금 토큰 계정', () => {
  test('같은 계정(토큰 갱신 포함)은 계속 동작한다', () => {
    const { api, env } = load();
    expect(api.sessionUser()).toBe('5');
    env.current = tok(5);   // 선제 갱신으로 토큰 문자열이 바뀌어도 같은 계정
    expect(api.accountSwitched()).toBe(false);
    expect(env.toasts).toHaveLength(0);
  });
  test('🔴 다른 탭이 계정 4 로 로그인 → 이 탭은 멈추고 한 번만 알린다', () => {
    const { api, env } = load();
    api.sessionUser();
    env.current = tok(4);
    expect(api.accountSwitched()).toBe(true);
    expect(api.accountSwitched()).toBe(true);
    expect(env.toasts).toHaveLength(1);
    expect(env.toasts[0]).toMatch(/다른 계정으로 로그인/);
    expect(env.events).toContain('itdasy:account-switched');
  });
  test('같은 탭에서 로그인(session-ready)하면 새 계정이 이 탭의 주인이 된다', () => {
    const { api, env } = load();
    api.sessionUser();
    env.current = tok(4);
    api.adopt({ type: 'itdasy:session-ready', detail: { userId: '4' } });
    expect(api.accountSwitched()).toBe(false);
  });
  test('🔴 다른 계정 도장이 찍힌 슬롯은 어느 탭에서도 올리지 않는다(도장 없는 옛 슬롯은 기존 동작)', () => {
    const { api, env } = load();
    env.current = tok(4);
    expect(api.foreignSlot({ id: 'mtzft4mt5urkd', _owner: '5' })).toBe(true);
    expect(api.foreignSlot({ id: 'a', _owner: '4' })).toBe(false);
    expect(api.foreignSlot({ id: 'legacy' })).toBe(false);
  });
  test('토큰이 없거나 깨졌으면 판정하지 않는다(로그인 게이트가 따로 막는다)', () => {
    const { api, env } = load();
    api.sessionUser();
    env.current = 'garbage';
    expect(api.accountSwitched()).toBe(false);
  });
});

describe('배선 — 서버에 닿는 모든 길목', () => {
  test('같은 탭 로그인 신호가 주인 교체를 sync 보다 먼저 부른다', () => {
    expect(SRC).toMatch(/window\.addEventListener\('itdasy:session-ready', function \(e\) \{ try \{ _adoptSession\(e\); \} catch \(_a\) \{ void _a; \} sync\(\); \}\);/);
  });
  test('ready() 가 계정 전환을 본다(sync/pull/pushAll/migrate/schedulePush 공통 입구)', () => {
    expect(C).toMatch(/function ready\(\) \{ return enabled\(\) && loggedIn\(\) && has\(window\.apiFetch\) && has\(window\.saveSlotToDB\) && !accountSwitched\(\); \}/);
  });
  test('🔴 pushAll 은 다른 계정 도장 슬롯을 거른다', () => {
    expect(C).toMatch(/s\.syncState !== 'synced' && !foreignSlot\(s\)/);
  });
  test('🔴 업로드를 기다린 뒤 upsert 직전에 한 번 더 막는다', () => {
    const i = C.indexOf("window.apiFetch('/workspace/slots/upsert'");
    const pre = C.slice(i - 260, i);
    expect(pre).toMatch(/if \(accountSwitched\(\) \|\| foreignSlot\(slot\)\) \{ _roundFailed = true; return null; \}/);
  });
  test('삭제(tombstone)도 다른 계정 토큰으로 보내지 않는다', () => {
    const i = C.indexOf("method: 'DELETE'");
    expect(C.slice(i - 260, i)).toMatch(/if \(accountSwitched\(\)\) return null;/);
  });
  test('받기: 요청한 토큰의 계정 도장을 찍고, 받는 사이 바뀌면 쓰지 않는다', () => {
    expect(C).toMatch(/_pullUser = _tokenSub\(\);/);
    expect(C).toMatch(/if \(accountSwitched\(\)\) return;[^\n]*\n\s*var _rl = remoteToLocal\(rs\); if \(_rl && _pullUser\) _rl\._owner = _pullUser;/);
  });
  test('저장 래퍼가 이 탭 세션 계정 도장을 찍는다 · payload 에는 안 실린다', () => {
    expect(C).toMatch(/if \(!slot\._owner && sessionUser\(\)\) slot\._owner = sessionUser\(\);/);
    const i = C.indexOf('payload: {'); const j = C.indexOf('};', i);
    expect(C.slice(i, j)).not.toMatch(/_owner/);
  });
});
