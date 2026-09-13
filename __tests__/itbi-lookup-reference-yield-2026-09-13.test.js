/* [ITBI Closeout 2026-09-13 · CASE-034] 예약 조회 지름길이 가리키는 말을 이름으로 짐작했다.
 *
 * 실측(전용 프로필 · user 4 · FE e6b6890 · BE 3c204be2 · 최종 회귀 CASE-028):
 *   "회원권 잔액 남은 손님 알려줘" → "두 번째 손님 마지막 방문 언제야?" → "첫 번째 손님 누구야?"
 *   → "아까 그분 예약 있어?"  ⇒  "🔍 아까님을 못 찾았어요. 이름을 다시 확인해 주세요."
 *   서버엔 요청이 가지 않았다(프론트 지름길이 답함). 서버는 세션으로 E2E_F_회원권만 을 풀 수 있다.
 *
 * 원인: `_extractLookupTarget` 이 호칭 근거가 없으면 `[가-힣]{2,5}` 낱말 중 금지목록에 없는 첫 낱말을
 *   이름으로 고른다 — 블랙리스트. "아까" 는 목록에 없었다.
 * 계약: (1) 가리키는 말이 있으면 지름길은 손을 뗀다(null). (2) 호칭 없이 고른 이름이 목록에 없으면
 *   "못 찾았어요" 로 단정하지 않고 손을 뗀다. (3) 호칭('님')이 붙은 이름은 예전처럼 없다고 말한다.
 */
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'assistant-intent-router.js'), 'utf8');

function load(customers) {
  const calls = [];
  const win = {};
  const apiFetch = async (p) => {
    calls.push(p);
    const body = p.startsWith('/customers') ? { items: customers } : { items: [] };
    return { ok: true, status: 200, json: async () => body };
  };
  const ls = { getItem: () => null, setItem: () => {} };
  // eslint-disable-next-line no-new-func
  new Function('window', 'apiFetch', 'localStorage', SRC)(win, apiFetch, ls);
  return { I: win.AssistantIntent, calls };
}

const CUSTOMERS = [{ id: 1, name: 'E2E_F_회원권만' }, { id: 2, name: '김호영' }];

describe('가리키는 말은 서버로 넘긴다', () => {
  test.each([
    '아까 그분 예약 있어?',
    '그분 예약 있어?',
    '그 고객 예약 언제야?',
    '이 손님 예약 있어?',
    '첫 번째 손님 예약 있어?',
    '방금 그 사람 예약 알려줘',
    '맨 위 손님 예약 있어?',
  ])('%s → null (고객 목록 조회도 안 함)', async (q) => {
    const { I, calls } = load(CUSTOMERS);
    expect(await I.tryLookupBooking(q)).toBeNull();
    expect(calls).toEqual([]);
  });
});

describe('호칭 없는 짐작은 단정하지 않는다', () => {
  test('"요즘 예약 있어?" 같은 낱말 짐작이 목록에 없으면 null', async () => {
    const { I } = load(CUSTOMERS);
    const r = await I.tryLookupBooking('다음달쯤 예약 있어?');
    expect(r === null || !/못 찾았어요/.test(r.text || '')).toBe(true);
  });
});

describe('기존 동작 보존', () => {
  test('호칭 붙은 없는 이름은 여전히 "못 찾았어요"', async () => {
    const { I } = load(CUSTOMERS);
    const r = await I.tryLookupBooking('박없음님 예약 있어?');
    expect(r && r.text).toMatch(/박없음님을 못 찾았어요/);
  });
  test('호칭 붙은 있는 이름은 지름길이 답한다', async () => {
    const { I } = load(CUSTOMERS);
    const r = await I.tryLookupBooking('김호영님 예약 있어?');
    expect(r && r.matched).toBe(true);
    expect(r.text).toMatch(/김호영님/);
  });
});

describe('② 숫자 규칙(가게 전체)도 특정인 지칭엔 손을 뗀다', () => {
  test.each([
    '아까 그분 예약 있어?', '그분 예약 몇 건이야?', '그 고객 예약 있어?', '첫 번째 손님 예약 있어?', '이 사람 오늘 예약 있어?',
  ])('%s → findAsyncRule null', (q) => {
    const { I } = load(CUSTOMERS);
    expect(I.findAsyncRule(q)).toBeNull();
  });
  test.each(['오늘 예약 있어?', '예약 뭐 있어?', '이번 주 예약 몇 건이야?', '오늘 손님 예약 몇 건?'])('가게 전체 질문 %s 는 그대로 규칙이 받는다', (q) => {
    const { I } = load(CUSTOMERS);
    expect(I.findAsyncRule(q)).not.toBeNull();
  });
});
