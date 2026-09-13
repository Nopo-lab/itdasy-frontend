/**
 * [2026-09-13 ZH P3-E→P2] 서버에 못 올라갔는데 원장은 알 방법이 없던 것 + PC 플로우 뒤로 버튼이 앱 헤더에 깔리던 것.
 *
 * 실측(라이브 계정 · upsert 를 500 으로 막음): push 2회 실패·dirty 유지, 화면 안내 0. `syncState` 를 읽는 UI 가 없었다.
 * 실측(Chrome 1147×844): 플로우 '뒤로'(248,11) elementFromPoint = .app-header(fixed · z 11000).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SYNC = fs.readFileSync(path.join(__dirname, '..', 'workspace-sync.js'), 'utf8');
const HOME = fs.readFileSync(path.join(__dirname, '..', 'workspace-v2-home.js'), 'utf8');
const FLOWCSS = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'css', 'workspace-v2-flow.css'), 'utf8');
function ext(src, name) {
  const i = src.indexOf('function ' + name + '('); expect(i).toBeGreaterThan(0);
  let d = 0; const j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } }
  throw new Error(name);
}

function harness() {
  const toasts = [], events = [], timers = [];
  const ctx = {
    Date, CustomEvent: function (n, o) { this.type = n; this.detail = o && o.detail; },
    window: { showToast: (m) => toasts.push(m), dispatchEvent: (e) => events.push(e.detail) },
    document: { hidden: false },
    setTimeout: (f, ms) => { timers.push(ms); return timers.length; }, clearTimeout: () => {},
    pushAll: () => {},
  };
  vm.createContext(ctx);
  vm.runInContext(
    "var _status = { pending: 0, failed: false, at: 0 }; var _roundFailed = false, _retryTimer = null;\n" +
    ext(SYNC, 'status') + '\n' + ext(SYNC, '_publishStatus') +
    '\nthis.pub = function(slots, failed){ _roundFailed = failed; _publishStatus(slots); }; this.status = status;', ctx);
  return { ctx, toasts, events, timers };
}
const dirty = (n) => Array.from({ length: n }, (_, i) => ({ id: 'd' + i, syncState: 'dirty' }));
const synced = (n) => Array.from({ length: n }, (_, i) => ({ id: 's' + i, syncState: 'synced' }));

describe('동기화 상태 — 실패는 알리고, 회복도 알린다(전이에서 한 번씩)', () => {
  test('🔴 push 실패 + 남은 슬롯 → 이 기기에 있다고 한 번 말한다', () => {
    const h = harness(); h.ctx.pub(dirty(1).concat(synced(3)), true);
    expect(h.toasts).toEqual(['서버에 아직 못 올렸어요 — 작업은 이 기기에 있어요. 연결되면 자동으로 올라가요']);
    expect(h.ctx.status()).toMatchObject({ pending: 1, failed: true });
    expect(h.events[0]).toMatchObject({ pending: 1, failed: true });
  });
  test('계속 실패해도 토스트를 반복하지 않는다(소음 금지)', () => {
    const h = harness(); for (let i = 0; i < 5; i++) h.ctx.pub(dirty(1), true);
    expect(h.toasts.length).toBe(1);
  });
  test('실패 중이면 1분 뒤 다시 올려 본다(서버가 회복돼도 트리거가 없던 것)', () => {
    const h = harness(); h.ctx.pub(dirty(2), true);
    expect(h.timers).toContain(60000);
  });
  test('회복 → 올렸다고 한 번 말하고 재시도 타이머는 멈춘다', () => {
    const h = harness(); h.ctx.pub(dirty(2), true); h.timers.length = 0;
    h.ctx.pub(synced(2), false);
    expect(h.toasts[1]).toBe('이 기기에 있던 작업을 서버에 올렸어요');
    expect(h.timers).not.toContain(60000);
    expect(h.ctx.status()).toMatchObject({ pending: 0, failed: false });
  });
  test('정상 저장(막 저장해서 dirty 인데 실패 아님)은 아무 말도 안 한다', () => {
    const h = harness(); h.ctx.pub(dirty(1), false);
    expect(h.toasts.length).toBe(0);
    expect(h.ctx.status().failed).toBe(false);
  });
  test('실패했지만 남은 게 없으면(다른 경로로 올라감) 실패로 보지 않는다', () => {
    const h = harness(); h.ctx.pub(synced(3), true);
    expect(h.ctx.status().failed).toBe(false);
    expect(h.toasts.length).toBe(0);
  });
});

describe('실패를 제대로 센다', () => {
  const C = SYNC.replace(/\/\*[\s\S]*?\*\//g, ' ');
  test('서버가 OK 가 아니면(409 병합 제외) 실패', () => {
    const i = C.indexOf("if (r.status === 409)");
    const j = C.indexOf('if (!r.ok) _roundFailed = true;', i);
    expect(i).toBeGreaterThan(0); expect(j).toBeGreaterThan(i);
  });
  test('네트워크 예외도 실패', () => {
    expect(C).toMatch(/log\('pushSlot err', slot && slot\.id, e\);\s*_roundFailed = true;/);
  });
  test('라운드 시작에 초기화하고, 끝나면 로컬을 다시 읽어 상태를 알린다', () => {
    const b = ext(C, 'pushAll');
    expect(b).toMatch(/_pushing = true;\s*_roundFailed = false;/);
    expect(b).toMatch(/loadAllLocal\(\)\.then\(_publishStatus/);
  });
  test('status() 를 밖에 연다', () => {
    expect(SYNC).toMatch(/window\.WorkspaceSync = \{ enabled: true, status: status,/);
  });
});

describe('홈 타일이 기기에만 있는 슬롯을 말한다', () => {
  test('실패 상태 + 미동기 슬롯이면 칩이 "기기에만 저장"', () => {
    const b = ext(HOME, '_feedTile');
    expect(b).toMatch(/var _local = !!\(_ss && _ss\.failed && slot\.syncState && slot\.syncState !== 'synced'\);/);
    expect(b).toMatch(/var chip = _local \? '<span class="wf-chip wf-chip--local">기기에만 저장<\/span>'/);
  });
  test('상태가 바뀌면 보이는 홈을 다시 그린다', () => {
    expect(HOME).toMatch(/addEventListener\('itdasy:sync-status', function \(\) \{ if \(_lastRoot && _lastRoot\.isConnected && !document\.hidden\) refresh\(\); \}\)/);
  });
});

describe('PC 플로우 상단바가 앱 헤더 아래에서 시작한다', () => {
  test('≥768px 에서 top: var(--app-header-h)', () => {
    const i = FLOWCSS.indexOf('@media (width >= 768px) and (height >= 600px) {');
    expect(FLOWCSS.slice(i, i + 800)).toMatch(/\.wsv2flow \{ left: var\(--side-nav-width\); top: var\(--app-header-h\); \}/);
  });
});
