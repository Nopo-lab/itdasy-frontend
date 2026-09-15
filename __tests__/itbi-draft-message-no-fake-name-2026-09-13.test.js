/* [2026-09-13 UX] 문자 초안 지름길이 "손님 전화번호 전부 엑셀로 뽑아서 문자로 보내줘" 에
 * "🔍 전화번호님을 못 찾았어요" 라고 답했다(라이브). CASE-034 의 조회 지름길과 같은 계약을 문자 초안에도:
 *   호칭 없이 짐작한 이름이 손님 목록에 없으면 단정하지 않고 손을 뗀다(null → 백엔드).
 *   호칭('님'·'씨')이 붙은 없는 이름은 예전처럼 없다고 말한다. */
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'assistant-intent-router.js'), 'utf8');

function load(customers) {
  const win = {};
  const apiFetch = async (p) => ({ ok: true, status: 200, json: async () => (p.startsWith('/customers') ? { items: customers } : { items: [] }) });
  const ls = { getItem: () => null, setItem: () => {} };
  // eslint-disable-next-line no-new-func
  new Function('window', 'apiFetch', 'localStorage', SRC)(win, apiFetch, ls);
  return win.AssistantIntent;
}
const CUSTOMERS = [{ id: 2, name: '김호영' }];

test('🔴 짐작한 낱말이 손님이 아니면 "…님을 못 찾았어요" 로 답하지 않는다', async () => {
  const I = load(CUSTOMERS);
  const r = await I.tryDraftMessage('손님 전화번호 전부 엑셀로 뽑아서 문자로 보내줘', {});
  expect(r === null || !/님을 못 찾았어요/.test((r && r.text) || '')).toBe(true);
});

test('호칭 붙은 없는 이름은 여전히 없다고 말한다', async () => {
  const I = load(CUSTOMERS);
  const r = await I.tryDraftMessage('박없음님한테 문자 보내줘', {});
  expect(r && r.text).toMatch(/박없음님을 못 찾았어요/);
});
