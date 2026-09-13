/* [ITBI Remaining Zero 2026-09-14] 로고 요청 정직 안내 · 세션 만료 질문 보관/수동 복구. */
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'app-assistant.js'), 'utf8');

function cut(marker) {
  const i = SRC.indexOf(marker);
  if (i < 0) throw new Error('못 찾음: ' + marker);
  let depth = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) {
    if (SRC[k] === '{') depth++; else if (SRC[k] === '}') { depth--; if (depth === 0) return SRC.slice(i, k + 1); }
  }
  throw new Error('안 닫힘');
}
const constLine = (name) => { const m = SRC.match(new RegExp('  const ' + name + ' = [^\\n]+\\n')); if (!m) throw new Error(name); return m[0]; };

describe('로고·디자인 제작 요청은 지원 범위 밖 안내', () => {
  // eslint-disable-next-line no-new-func
  const looks = new Function(constLine('_DESIGN_OOS_RE') + constLine('_DESIGN_OOS_VERB_RE') + constLine('_DESIGN_OOS_SKIP_RE') + cut('  function _looksDesignOutOfScope(') + '\nreturn _looksDesignOutOfScope;')();
  test.each([
    '포토샵으로 로고 디자인해줘', '로고 만들어줘', '우리 샵 로고 디자인해줘', '간판 로고 시안 만들어줘',
    '브랜드 로고 추천해줘', '로고 이미지 만들어줘', '심볼 만들어줘', '미용실 로고 그려줘',
  ])('%s → 범위 밖', (q) => expect(looks(q)).toBe(true));
  test.each([
    '가격표 만들어줘', '인스타 캡션 만들어줘', '홍보 문구 만들어줘', '로고 사진에 넣어줘', '로고 워터마크 올려줘', '오늘 예약 알려줘',
  ])('%s → 해당 없음', (q) => expect(looks(q)).toBe(false));

  test('어떤 앞단 지름길보다 먼저 판정한다(문구 편집 시트·작업실·사진모드로 새지 않게)', () => {
    const send = cut('  async function _send() {');
    const a = send.indexOf('_tryDesignOutOfScope(input, q, _via0)');
    expect(a).toBeGreaterThan(0);
    ['_tryMemoryShortcut(input', 'ItdasyWorkspaceNL?.tryOpen', 'ItdasyPhotoModeSupport;', '_tryCreateIntentFallback(input', 'await _trySendShortcuts(input'].forEach((k) => {
      expect(send.indexOf(k)).toBeGreaterThan(a);
    });
  });
  test('안내는 못 한다고 말하고, 칩은 지금 되는 것만', () => {
    const fn = cut('  function _tryDesignOutOfScope(');
    expect(fn).toMatch(/지원하지 않아요/);
    expect(fn).toMatch(/unsupported_request/);
    const chips = SRC.match(/const _DESIGN_OOS_CHIPS = \[([^\]]+)\]/)[1];
    expect(chips).not.toMatch(/로고|디자인/);
  });
});

describe('세션 만료 질문 보관 · 수동 복구', () => {
  function env(userId, token) {
    const store = {};
    const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
    if (userId) store.last_user_id = String(userId);
    const window = { getToken: () => token, __itdasyAuthDead: false, addEventListener: () => {} };
    const h = { history: [], rendered: 0 };
    const body = [constLine('_FAILED_ASK_PREFIX'), constLine('_FAILED_ASK_TTL'), constLine('_FAILED_ASK_WRITE_RE'),
      cut('  function _failedAskKey('), cut('  function _readFailedAsks('), cut('  function _writeFailedAsks('),
      cut('  function _saveFailedAsk('), cut('  function _offerFailedAsks(')].join('\n');
    // eslint-disable-next-line no-new-func
    const api = new Function('localStorage', 'window', 'H', `let _history = H.history; const _sessionId = 77; function _renderHistory(){ H.rendered++; }
      ${body}
      return { save: _saveFailedAsk, read: _readFailedAsks, write: _writeFailedAsks, offer: _offerFailedAsks };`)(localStorage, window, h);
    return { api, store, h, window };
  }

  test('보관은 계정별 키에만, 서버 전송 코드 없음', () => {
    const { api, store } = env(4, 'tok');
    api.save('E2E_A_박지우님 마지막 방문 언제야?');
    expect(Object.keys(store)).toContain('itdasy_itbi_failed_ask::4');
    expect(cut('  function _saveFailedAsk(')).not.toMatch(/apiFetch|fetch\(|_reportClient/);
  });
  test('로그인 상태에서만 제안 · 자동 재전송 없음(제안만 붙는다)', () => {
    const { api, h, window } = env(4, 'tok');
    api.save('단골 누구야?');
    window.__itdasyAuthDead = true; api.offer(); expect(h.history).toHaveLength(0);
    window.__itdasyAuthDead = false; api.offer();
    expect(h.history).toHaveLength(1);
    expect(h.history[0].failed_ask_id).toBeTruthy();
    api.offer(); expect(h.history).toHaveLength(1);   // 두 번 열어도 한 번만
  });
  test('쓰기 말이면 확인 카드부터라고 알린다', () => {
    const { api, h } = env(4, 'tok');
    api.save('김호영님 매출 5만원 기록해줘'); api.offer();
    expect(h.history[0].text).toMatch(/확인 카드부터/);
  });
  test('다른 계정으로 로그인하면 보이지 않는다', () => {
    const e = env(4, 'tok'); e.api.save('단골 누구야?');
    e.store.last_user_id = '5'; e.api.offer();
    expect(e.h.history).toHaveLength(0);
  });
  test('만료(6시간)·최대 3개', () => {
    const { api, store } = env(4, 'tok');
    ['a1?', 'a2?', 'a3?', 'a4?'].forEach(q => api.save(q));
    expect(api.read().map(x => x.q)).toEqual(['a2?', 'a3?', 'a4?']);
    const k = 'itdasy_itbi_failed_ask::4';
    const l = JSON.parse(store[k]); l.forEach(x => { x.expires_at = Date.now() - 1; }); store[k] = JSON.stringify(l);
    expect(api.read()).toEqual([]);
  });
  test('다시 보내기는 보관본을 먼저 지우고 한 번만 보낸다(클릭 처리 구조)', () => {
    const i = SRC.indexOf("const sb = e.target.closest('[data-asst-fa-send]')");
    const blk = SRC.slice(i, i + 900);
    expect(blk.indexOf('_writeFailedAsks(')).toBeLessThan(blk.indexOf('_send()'));
  });
  test('401 은 두 경로(한글 detail 응답·throw) 모두 보관으로 이어진다', () => {
    expect(SRC).toMatch(/res\.status === 401\) return \{[^}]*_authExpired: true/);
    expect(cut('  async function _askServer(')).toMatch(/_resp && _resp\._authExpired\) \{\s*_saveFailedAsk\(q\)/);
    expect(cut('  function _handleSendError(')).toMatch(/HTTP 401[\s\S]*_saveFailedAsk/);
  });
});

describe('요금제 팝업은 요금제를 가리킬 때만', () => {
  const fn = cut('  function _tryUtilityShortcut(');
  function run(q) {
    let opened = 0;
    // eslint-disable-next-line no-new-func
    const f = new Function('window', '_runSheetShortcut', '_tryPlanShortcut', fn + '\nreturn _tryUtilityShortcut;')(
      {}, () => {}, () => { opened++; return true; });
    f(null, q);
    return opened;
  }
  test.each(['잇비가 알아서 결제해?', '결제 금액 얼마야?', '카드 결제한 매출 알려줘', '회원권 결제했어', 'profile 사진 바꿔줘'])('%s → 팝업 안 뜸', (q) => {
    expect(run(q)).toBe(0);
  });
  test.each(['플랜 변경', '요금제 보여줘', '구독 관리', '업그레이드 하고 싶어', 'Pro 가입', '결제 수단 변경'])('%s → 요금제 팝업', (q) => {
    expect(run(q)).toBe(1);
  });
});


describe('기능 질문은 앞단 지름길을 건너뛰고 서버로', () => {
  // eslint-disable-next-line no-new-func
  const looks = new Function(constLine('_CAP_Q_RE') + constLine('_CAP_Q_NOT_RE') + cut('  function _looksCapabilityQuestion(') + '\nreturn _looksCapabilityQuestion;')();
  const POS = ['잇비 뭐 할 수 있어?', '잇비 사용법 알려줘', '고객 관련 뭐 물어볼 수 있어?', '예약 관련 뭐 할 수 있어?', '매출 관련 뭐 물어봐도 돼?',
    '회원권도 물어볼 수 있어?', '인스타 댓글도 돼?', '사진으로 뭐 할 수 있어?', '잇비가 직접 문자 보내?', '잇비가 댓글 자동으로 달아?',
    '잇비가 돈 처리도 해?', '추천질문은 뭐야?', '신고는 어떻게 해?', '이 기능 어디까지 돼?', '잇비는 뭘 도와줄 수 있어?', 'DM도 돼?',
    '잇비 기능 알려줘', '재고도 물어볼 수 있어?', '리뷰도 물어볼 수 있어?', '잇비가 예약 알아서 바꿔?', '잇비가 알아서 결제해?', '작업실도 돼?',
    '잇비 쓰는 법 알려줘', '문자도 보낼 수 있어?', '이 단골들에게 메시지 보낼 수 있어?', '잇비가 혼자 DM 답장해?', '어떤 걸 물어봐도 돼?',
    '생일도 물어볼 수 있어?', '잇비 어디까지 돼?', '신고하려면 어떻게 해?'];
  test('30문장 전부 서버로', () => { expect(POS.filter(q => !looks(q))).toEqual([]); expect(POS).toHaveLength(30); });
  test.each(['오늘 예약 알려줘', '작업실 열어줘', '가격표 만들어줘', '김호영님 예약 있어?', '문자 보내줘', '예약 취소해도 돼?', '단골 누구야?', '댓글 뭐 달렸어?'])(
    '%s → 평소 경로', (q) => expect(looks(q)).toBe(false));
  test('입구 판정이 모든 지름길보다 앞', () => {
    const send = cut('  async function _send() {');
    const a = send.indexOf('_looksCapabilityQuestion(q)');
    expect(a).toBeGreaterThan(send.indexOf('_tryDesignOutOfScope(input, q, _via0)'));
    ['_tryMemoryShortcut(input', 'ItdasyWorkspaceNL?.tryOpen', '_tryCreateIntentFallback(input', 'await _trySendShortcuts(input'].forEach(k => expect(send.indexOf(k)).toBeGreaterThan(a));
  });
});
