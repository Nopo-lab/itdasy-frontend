/* [ITBI Closeout 2026-09-13 · §7] 프론트에서만 보이는 실패가 서버 [ITBI] 로 가는가.
 *
 * 서버 /assistant/client-event 허용목록엔 network_error · client_render_error ·
 * recommendation_click_error · unsupported_request 가 있었지만 **프론트가 한 번도 보내지 않았다**
 * (app-assistant.js 의 client-event 호출은 turn 1곳뿐이었다). 이벤트 이름만 있고 원천이 없었다.
 */
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'app-assistant.js'), 'utf8');

function cut(name) {
  const i = SRC.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('함수 없음: ' + name);
  let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) {
    if (SRC[k] === '{') d++;
    else if (SRC[k] === '}') { d--; if (d === 0) return SRC.slice(i, k + 1); }
  }
  throw new Error('중괄호');
}

describe('_networkErrorCode — 응답이 없던 실패만 센다', () => {
  // eslint-disable-next-line no-new-func
  const f = (onLine) => new Function('navigator', cut('_networkErrorCode') + '\nreturn _networkErrorCode;')({ onLine });
  test('서버가 응답한 4xx/5xx 는 null (서버가 이미 기록)', () => {
    expect(f(true)(new Error('504: AI 응답이 오래'))).toBeNull();
    expect(f(true)(new Error('HTTP 500'))).toBeNull();
  });
  test('오프라인', () => { expect(f(false)(new TypeError('Failed to fetch'))).toBe('offline'); });
  test('fetch 실패', () => { expect(f(true)(new TypeError('Failed to fetch'))).toBe('fetch_failed'); });
  test('사파리 Load failed', () => { expect(f(true)(new TypeError('Load failed'))).toBe('fetch_failed'); });
  test('클라 타임아웃', () => { expect(f(true)(new Error('request timed out'))).toBe('client_timeout'); });
});

describe('_reportClientEvent — 원문 답변·예외 메시지를 싣지 않는다', () => {
  test('body 에 answer / message 필드가 없다', () => {
    const body = cut('_reportClientEvent');
    expect(body).not.toMatch(/answer\s*:/);
    expect(body).not.toMatch(/\.message/);
    expect(body).toMatch(/__itdasyAuthDead/);   // 세션 죽으면 안 보낸다(401 폭주 방지)
  });
});

describe('배선 — 네 곳에서 실제로 부른다', () => {
  test('전송 실패 → network_error', () => {
    expect(cut('_handleSendError')).toMatch(/_reportClientEvent\('network_error'/);
  });
  test('렌더 예외 → client_render_error (그리고 다시 던진다)', () => {
    const b = cut('_renderHistory');
    expect(b).toMatch(/_reportClientEvent\('client_render_error'/);
    expect(b).toMatch(/throw err/);
  });
  test('추천칩 클릭 예외 → recommendation_click_error', () => {
    expect(cut('_handleSuggestionClick')).toMatch(/_reportClientEvent\('recommendation_click_error'/);
  });
  test('미지원 안내 → unsupported_request', () => {
    const b = cut('_tryUnsupportedGuide');
    expect(b).toMatch(/_reportClientEvent\('unsupported_request'/);
    expect(b).toMatch(/unsupported_capability/);
  });
});
