/**
 * [2026-09-13 AUTH] 세션이 만료되는 순간 편집 중이던 초안이 빈 초안으로 덮이던 것.
 *
 * 만료 처리가 `body.itdasy-locked` 로 잠그면 편집기가 display:none 이 된다.
 * `_serLayer` 는 스테이지 크기가 0 이면 레이어를 버리므로, 숨겨진 동안의 스냅샷은 layers:[] 이고
 * 2초 틱이 좋은 초안을 그걸로 덮었다. 재로그인하면 되살릴 게 없었다.
 * 실측(Chrome 실엔진 · 갱신 실패 목서버 · 토큰 35초, 스토리지 추적):
 *   수정 전 — 'EXPIREKEEP'(touched:true) → 만료 10초 뒤 같은 페이지에서 layers:[] 로 교체(재로드·삭제·외부 open 없음)
 *   수정 후 — 만료·잠금 뒤에도 초안 ['EXPIREKEEP'] → 같은 계정 재로그인 → 이어서 편집 → 복구 → 저장 → 재편집 유지
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'itd-editor.js'), 'utf8');
function ext(name) {
  const i = SRC.indexOf('function ' + name + '('); expect(i).toBeGreaterThan(0);
  let d = 0; const j = SRC.indexOf('{', i);
  for (let k = j; k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (d === 0) return SRC.slice(i, k + 1); } }
  throw new Error(name);
}

/* _draftSnap 을 실제로 돌린다 — 스테이지 크기만 바꿔 가며 sessionStorage 에 무엇이 쓰이는지 본다. */
function run(stageWidth, layers) {
  const store = {};
  const ctx = {
    JSON, Date,
    S: {}, root: { classList: { contains: (c) => c === 'is-open' } },
    refs: { stage: { getBoundingClientRect: () => ({ width: stageWidth, height: stageWidth ? 600 : 0 }) } },
    sessionStorage: { setItem: (k, v) => { store[k] = v; }, getItem: (k) => store[k] || null },
    DRAFT_KEY: 'D', _draftLastJson: '', _draftBaseLight: '{}', _draftMediaSig: '',
    _flushEditingText: () => {},
    _exportState: () => ({ layers }),
    _splitDraft: (st) => ({ light: { layers: st.layers }, media: { photos: ['p'] } }),
    _photosSig: () => 'sig', _mediaSig: () => 'm', window: {},
  };
  vm.createContext(ctx);
  vm.runInContext(ext('_draftSnap') + '; this._draftSnap = _draftSnap;', ctx);
  return { store, snap: (sync) => ctx._draftSnap(sync) };
}

describe('숨겨진 편집기는 초안을 덮지 않는다', () => {
  test('🔴 스테이지 폭 0(잠금으로 숨김) → 아무것도 쓰지 않는다', () => {
    const r = run(0, []); r.snap(false);
    expect(r.store.D).toBeUndefined();
  });
  test('pagehide(동기) 경로도 숨겨져 있으면 쓰지 않는다', () => {
    const r = run(0, []); r.snap(true);
    expect(r.store.D).toBeUndefined();
  });
  test('보이는 편집기는 예전처럼 쓴다', () => {
    const r = run(480, [{ text: 'EXPIREKEEP' }]); r.snap(false);
    expect(r.store.D).toContain('EXPIREKEEP');
  });
  test('판정은 쓰기 **전에** — is-open 확인 바로 뒤', () => {
    const b = ext('_draftSnap');
    const g = b.indexOf('if (!_sr || !_sr.width) return;');
    expect(g).toBeGreaterThan(0);
    expect(g).toBeLessThan(b.indexOf('_exportState()'));
    expect(g).toBeLessThan(b.indexOf('sessionStorage.setItem(DRAFT_KEY'));
  });
});

describe('로그인 화면이 작업 보관을 말한다(두 만료 경로 모두)', () => {
  const CORE = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'app-core.js'), 'utf8');
  test('토큰 만료 판정(웹 인라인 · 보안저장 헬퍼) 둘 다 안내 배너를 켠다', () => {
    expect((CORE.match(/const _em = document\.getElementById\('sessionExpiredMsg'\); if \(_em\) _em\.style\.display = 'block';/g) || []).length).toBe(2);
  });
  test('401 경로(_handle401)도 배너를 켠다', () => {
    const i = CORE.indexOf('function _handle401()');
    expect(CORE.slice(i, i + 400)).toMatch(/getElementById\('sessionExpiredMsg'\);\s*if \(msg\) msg\.style\.display = 'block';/);
  });
});
