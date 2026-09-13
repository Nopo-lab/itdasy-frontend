/**
 * [2026-09-13 AUTH] 토큰 자동 갱신이 구조상 한 번도 성공할 수 없던 것.
 *
 * BE 액세스 토큰 24h · `/auth/refresh` 는 **유효한** 토큰이 있어야 새 토큰을 준다.
 * FE 는 401 핸들러에서만 `_tryRefresh()` 를 불렀다 → 401 이면 이미 만료 → 갱신도 401 → 24h 마다 강제 로그아웃.
 * 수정: 만료 10분 전부터(긴 요청은 그 요청이 끝날 때까지) **만료 전에** 갱신. 실패해도 로그아웃하지 않는다.
 *
 * 실제 app-core.js 의 함수 본문을 떼어 가짜 의존성 위에서 **돌려서** 판정한다(문자열 모양만 보는 가드는 우회된다).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'app-core.js'), 'utf8');

function ext(name) {
  const re = new RegExp('(async\\s+)?function ' + name + '\\(');
  const m = re.exec(SRC); expect(m).toBeTruthy();
  let d = 0; const j = SRC.indexOf('{', m.index);
  for (let k = j; k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (d === 0) return SRC.slice(m.index, k + 1); } }
  throw new Error(name);
}
function constVal(name) {
  const m = new RegExp('const ' + name + ' = ([^;]+);').exec(SRC); expect(m).toBeTruthy(); return m[1];
}
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwt = (expSec) => 'h.' + b64u({ sub: '4', exp: expSec }) + '.s';
const nowSec = () => Math.floor(Date.now() / 1000);

function harness({ token, refreshImpl }) {
  const calls = { refresh: 0, handle401: 0 };
  const ctx = {
    // 브라우저 atob 처럼 **엄격하게** — Node Buffer 는 base64url(-, _)을 관대하게 받아서 결함을 가린다
    atob: (s) => { if (/[^A-Za-z0-9+/=]/.test(s)) throw new Error('InvalidCharacterError'); return Buffer.from(s, 'base64').toString('binary'); },
    Date, JSON, Math, Object, Headers: global.Headers,
    _token: token,
    getToken: () => ctx._token,
    _handle401: () => { calls.handle401++; },
    _tryRefresh: async () => { calls.refresh++; return refreshImpl(ctx); },
  };
  vm.createContext(ctx);
  vm.runInContext(
    'const REFRESH_AHEAD_SEC = ' + constVal('REFRESH_AHEAD_SEC') + ';\n' +
    'const REFRESH_FAIL_COOLDOWN_MS = ' + constVal('REFRESH_FAIL_COOLDOWN_MS') + ';\n' +
    'let _lastRefreshFailAt = 0;\n' +
    ext('_tokenExpSec') + '\n' + ext('_ensureFreshToken') + '\n' + ext('_swapBearer') + '\n' +
    'this._ensureFreshToken = _ensureFreshToken; this._tokenExpSec = _tokenExpSec; this._swapBearer = _swapBearer;', ctx);
  return { ctx, calls };
}

describe('선제 갱신 — 만료 전에 새 토큰', () => {
  test('만료까지 30분 남음 → 갱신 안 함', async () => {
    const t = jwt(nowSec() + 1800);
    const h = harness({ token: t, refreshImpl: () => 'NEW' });
    expect(await h.ctx._ensureFreshToken()).toBe(t);
    expect(h.calls.refresh).toBe(0);
  });

  test('🔴 만료까지 5분 남음 → 갱신하고 새 토큰을 돌려준다', async () => {
    const t = jwt(nowSec() + 300), n = jwt(nowSec() + 86400);
    const h = harness({ token: t, refreshImpl: (c) => { c._token = n; return n; } });
    expect(await h.ctx._ensureFreshToken()).toBe(n);
    expect(h.calls.refresh).toBe(1);
  });

  test('🔴 갱신 실패 → 로그아웃하지 않고 아직 유효한 옛 토큰을 그대로 쓴다', async () => {
    const t = jwt(nowSec() + 300);
    const h = harness({ token: t, refreshImpl: () => { throw new Error('refresh_failed'); } });
    expect(await h.ctx._ensureFreshToken()).toBe(t);
    expect(h.calls.handle401).toBe(0);
  });

  test('갱신 실패 직후엔 다시 두드리지 않는다(쿨다운) — 무한 갱신 루프 없음', async () => {
    const t = jwt(nowSec() + 300);
    const h = harness({ token: t, refreshImpl: () => { throw new Error('x'); } });
    for (let i = 0; i < 10; i++) await h.ctx._ensureFreshToken();
    expect(h.calls.refresh).toBe(1);
  });

  test('이미 만료된 토큰은 갱신을 시도하지 않는다(어차피 401 — 서버를 헛 두드리지 않게)', async () => {
    const t = jwt(nowSec() - 5);
    const h = harness({ token: t, refreshImpl: () => 'NEW' });
    await h.ctx._ensureFreshToken();
    expect(h.calls.refresh).toBe(0);
  });

  test('토큰이 없으면 아무것도 안 한다', async () => {
    const h = harness({ token: null, refreshImpl: () => 'NEW' });
    expect(await h.ctx._ensureFreshToken()).toBe(null);
    expect(h.calls.refresh).toBe(0);
  });

  test('🔴 긴 요청(LLM 120초): 만료까지 3분 → 10분 기준으론 아직이지만 요청 기준으론 갱신 먼저', async () => {
    const t = jwt(nowSec() + 180), n = jwt(nowSec() + 86400);
    const h = harness({ token: t, refreshImpl: (c) => { c._token = n; return n; } });
    // 래퍼는 LLM 이면 minSec = max(600, 120+120) = 600 을, 7분짜리 커스텀 요청이면 540 을 넘긴다
    expect(await h.ctx._ensureFreshToken(120 + 120)).toBe(n);
    expect(h.calls.refresh).toBe(1);
  });

  test('base64url(-, _) 이 섞인 JWT 도 exp 를 읽는다', () => {
    const h = harness({ token: null, refreshImpl: () => null });
    // '?' 와 '>' 가 base64 에서 '/' '+' 를 만든다 → base64url 에선 '_' '-'
    const tok = 'h.' + b64u({ exp: 1789999999, note: '??>>??>>' }) + '.s';
    expect(tok.split('.')[1]).toMatch(/[-_]/);
    expect(h.ctx._tokenExpSec(tok)).toBe(1789999999);
  });
});

describe('요청 헤더의 옛 토큰을 새 토큰으로', () => {
  test('일반 객체 헤더 — 옛 Bearer 만 바꾼다', () => {
    const h = harness({ token: null, refreshImpl: () => null });
    const out = h.ctx._swapBearer({ method: 'POST', headers: { Authorization: 'Bearer OLD', 'X-A': '1' } }, 'OLD', 'NEW');
    expect(out.headers.Authorization).toBe('Bearer NEW');
    expect(out.headers['X-A']).toBe('1');
    expect(out.method).toBe('POST');
  });
  test('다른 토큰을 달고 있으면 건드리지 않는다(남의 헤더를 바꾸지 않게)', () => {
    const h = harness({ token: null, refreshImpl: () => null });
    const init = { headers: { authorization: 'Bearer SOMEONE' } };
    expect(h.ctx._swapBearer(init, 'OLD', 'NEW')).toBe(init);
  });
  test('Headers 인스턴스도 처리', () => {
    const h = harness({ token: null, refreshImpl: () => null });
    const out = h.ctx._swapBearer({ headers: new Headers({ Authorization: 'Bearer OLD' }) }, 'OLD', 'NEW');
    expect(out.headers.get('Authorization')).toBe('Bearer NEW');
  });
});

describe('배선 — 실제로 불린다', () => {
  const C = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ');
  test('1분 주기 · 화면 복귀 · 부팅 직후', () => {
    expect(C).toMatch(/setInterval\(function \(\) \{ _ensureFreshToken\(REFRESH_AHEAD_SEC\); \}, 60000\);/);
    expect(C).toMatch(/visibilitychange', function \(\) \{ if \(document\.visibilityState === 'visible'\) _ensureFreshToken\(REFRESH_AHEAD_SEC\); \}\);/);
    expect(C).toMatch(/setTimeout\(function \(\) \{ _ensureFreshToken\(REFRESH_AHEAD_SEC\); \}, 3000\);/);
  });
  test('API 요청 직전 — 긴 요청은 그 요청 시간 + 2분을 요구하고, 갱신되면 헤더를 바꾼다', () => {
    const i = C.indexOf('window.fetch = async function(input, init) {');
    const body = C.slice(i, i + 3000);
    expect(body).toMatch(/if \(_isApiOrigin\(input\) && !_isAuthFreePath\(input\)\) \{/);
    expect(body).toMatch(/const _needSec = Math\.max\(REFRESH_AHEAD_SEC, _longMs \? Math\.ceil\(_longMs \/ 1000\) \+ 120 : 0\);/);
    expect(body).toMatch(/if \(_freshTok && _beforeTok && _freshTok !== _beforeTok\) init = _swapBearer\(init, _beforeTok, _freshTok\);/);
    // 실제 네트워크 호출보다 먼저여야 한다
    const call = body.indexOf('await _ensureFreshToken(_needSec)');
    expect(call).toBeGreaterThan(0);   // 없으면 indexOf -1 이라 아래 비교가 거짓으로 통과한다
    expect(call).toBeLessThan(body.indexOf('_fetchWithTimeout(input, init, _tmo)'));
  });
  test('/auth/* 는 선제 갱신을 거치지 않는다 · 갱신 호출은 래퍼 밖(_origFetch) — 재귀 없음', () => {
    expect(SRC).toMatch(/const _AUTH_FREE_RE = \/\^\\\/\(auth\|/);
    const tr = ext('_tryRefresh');
    expect(tr).toMatch(/_origFetch\(apiUrl\('\/auth\/refresh'\)/);
  });
});

describe('세션 만료 안내는 작업 보존을 사실대로 말한다', () => {
  test('만료 배너·토스트 문구', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    expect(html).toMatch(/id="sessionExpiredMsg"[^>]*>로그인이 필요해요\.<br>작업 중이던 내용은 이 기기에 보관했어요\.<br>다시 로그인하면 이어서 저장할 수 있어요\.<\/div>/);
    expect((SRC.match(/showToast\('로그인이 필요해요\. 작업 중이던 내용은 이 기기에 보관했어요'\)/g) || []).length).toBe(2);
    expect(SRC).not.toMatch(/로그인이 만료되었어요\. 다시 로그인해주세요/);
  });
  test('🔴 그 말이 참이려면 — 만료 처리(_handle401)는 로컬 작업을 지우지 않는다', () => {
    const b = ext('_handle401');
    expect(b).not.toMatch(/_purgeUserScopedDB|_purgeUserScopedStorage|clearGalleryDB|clearLocal|indexedDB|sessionStorage\.clear|localStorage\.clear/);
  });
  test('재로그인이 같은 계정이면 로컬을 지우지 않는다(다른 계정일 때만 — 개인정보 격리)', () => {
    const b = ext('applyNewSession');
    expect(b).toMatch(/if \(newUserId && prevUserId && newUserId !== prevUserId\) \{\s*_purgeUserScopedStorage\(\);\s*await _purgeUserScopedDB\(\);/);
  });
});
