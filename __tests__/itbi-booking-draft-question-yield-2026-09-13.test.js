/* [ITBI Closeout 2026-09-13 · P1] '예약 잡기' 초안이 무장된 채 이후 질문을 전부 예약 슬롯으로 먹던 것. */
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js/assistant/core/booking-draft.js'), 'utf8');

function load() {
  const w = {
    AssistantIntent: {
      resolveDateBase: () => null,
      resolveTime: (q) => (/(\d{1,2})\s*시/.test(q) ? { concrete: true, hour: 15, min: 0 } : null),
      extractService: () => '',
      resolveCustomer: async (n) => (n === '박지우' ? { customer: { id: 1, name: '박지우' } } : { none: true }),
      composeBooking: async (c) => ({ kind: 'card', action: { kind: 'create_booking' }, text: c.name }),
    },
    SHOP_CONFIG: {},
  };
  const ls = { getItem: () => '' };
  // eslint-disable-next-line no-new-func
  new Function('window', 'localStorage', SRC)(w, ls);
  return w.ItbiBookingDraft;
}

describe('초안이 떠 있어도 질문은 양보한다', () => {
  test.each([
    '오늘 빈 시간 알려줘', '댓글 뭐 달렸어?', '회원권 잔액 얼마 남았어?', '첫 번째 손님 누구야?',
    '이번 주에 새로 온 고객 있어?', 'E2E_A_박지우님 마지막 방문 언제야?', '단골 누구야?',
  ])('%s → null · 초안 유지', async (q) => {
    const BD = load();
    BD.arm({ customer: { id: 1, name: '박지우' } });
    expect(await BD.tryDraft(q)).toBeNull();
    expect(BD.isActive()).toBe(true);
  });
});

describe('슬롯 답은 그대로 초안이 받는다', () => {
  test('질문 뒤에 "3시 커트" 라고 하면 예약이 이어진다', async () => {
    const BD = load();
    BD.arm({ customer: { id: 1, name: '박지우' } });
    expect(await BD.tryDraft('오늘 빈 시간 알려줘')).toBeNull();
    const r = await BD.tryDraft('오후 3시 커트');
    expect(r).not.toBeNull();
  });
  test('"3시에 가능해?" 는 시간 답이다(물음표여도)', async () => {
    const BD = load();
    BD.arm({ customer: { id: 1, name: '박지우' } });
    expect(await BD.tryDraft('3시에 가능해?')).not.toBeNull();
  });
  test('"시술 뭐 있어?" 는 초안의 시술 되묻기 몫', async () => {
    const BD = load();
    BD.arm({ customer: { id: 1, name: '박지우' } });
    expect(await BD.tryDraft('시술 뭐 있어?')).not.toBeNull();
  });
  test('취소는 여전히 초안을 끝낸다', async () => {
    const BD = load();
    BD.arm({ customer: { id: 1, name: '박지우' } });
    await BD.tryDraft('취소');
    expect(BD.isActive()).toBe(false);
  });
});
