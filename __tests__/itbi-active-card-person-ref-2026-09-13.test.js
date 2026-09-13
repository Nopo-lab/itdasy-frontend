/* [ITBI Closeout 2026-09-13 · CASE-035] 사람을 가리키는 말이 '방금 만든 카드' 지칭으로 먹혀 작업실로 튕겼다. */
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js/assistant/core/active-card.js'), 'utf8');
function load() { const w = {}; new Function('window', SRC)(w); return w.ItbiActiveCard; }  // eslint-disable-line no-new-func

describe('사람 지칭은 카드 지칭이 아니다', () => {
  test.each([
    '아까 그분 예약 있어?', '아까 그분 메모 있어?', '방금 그 사람 얼마 썼어?', '방금 그 고객 마지막 방문 언제야?',
    '아까 그 손님 다시 보여줘', '그분 수정할 거 있어?',
  ])('%s → null', (q) => { expect(load().classifyRef(q)).toBeNull(); });
});

describe('카드 지칭은 그대로', () => {
  test.each([
    ['그거 저장해줘', 'save'], ['방금 만든 거 수정', 'edit'], ['아까 거 다시 보여줘', 'show'],
    ['이 카드 저장', 'save'], ['아까 그거 고쳐줘', 'edit'], ['방금 그 카드 보여줘', 'show'],
  ])('%s → %s', (q, verb) => { expect(load().classifyRef(q)).toEqual({ verb }); });
});

describe('저장카드 분류도 사람 지칭엔 손을 뗀다', () => {
  const S = fs.readFileSync(path.join(__dirname, '..', 'js/assistant/core/saved-cards-intent.js'), 'utf8');
  const loadS = () => { const w = {}; new Function('window', S)(w); return w.ItbiSavedCardsIntent; };  // eslint-disable-line no-new-func
  test.each(['아까 그분 메모 있어?', '방금 그 사람 얼마 썼어?', '아까 그 고객 생일 언제야?', '방금 그분 몇 번 왔어?'])('%s → null', (q) => {
    expect(loadS().classify(q)).toBeNull();
  });
  test.each(['아까 그 가격표 보여줘', '방금 거 수정', '저장한 카드 보여줘', '아까 그거 다시'])('카드 지칭 %s 는 그대로 잡는다', (q) => {
    expect(loadS().classify(q)).not.toBeNull();
  });
});
