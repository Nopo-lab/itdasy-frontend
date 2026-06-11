/* 잇비 인텐트 라우팅 회귀 가드 (2026-06-12 QA 퍼징 라운드)
 *
 *   memory-intent / saved-cards-intent 두 순수 분류기를 실사용 변형(동사생략·대명사·축약·반말)
 *   코퍼스로 검증한다. create 경로(template-sample-matcher)는 별도 모듈이라 여기서 다루지 않는다.
 *
 *   두 모듈은 IIFE + window 전역에 등록 → node 환경에서 window 를 stub 한 뒤 eval 로드.
 */
'use strict';
const fs = require('fs');
const path = require('path');

function loadModules() {
  global.window = {};
  const core = path.join(__dirname, '..');
  // eslint-disable-next-line no-eval
  eval(fs.readFileSync(path.join(core, 'memory-intent.js'), 'utf8'));
  // eslint-disable-next-line no-eval
  eval(fs.readFileSync(path.join(core, 'saved-cards-intent.js'), 'utf8'));
  return { MEM: global.window.ItbiMemoryIntent, SAVED: global.window.ItbiSavedCardsIntent };
}
const { MEM, SAVED } = loadModules();

// 통합 라우팅(생성 매처 제외): memory → saved(open/query/edit) → none
function route(q) {
  const m = MEM.classify(q);
  if (m && ['save', 'recall', 'forget', 'save_empty'].includes(m.mode)) return 'memory';
  const s = SAVED.classify(q);
  if (s && s.matched) return 'saved:' + s.mode;
  return 'none';
}
function accepts(exp, got) {
  if (exp === 'view') return got === 'saved:query' || got === 'saved:open';
  if (exp === 'open_loose') return got === 'saved:open' || got === 'saved:query';
  if (exp === 'open') return got === 'saved:open';
  if (exp === 'query') return got === 'saved:query';
  if (exp === 'edit') return got === 'saved:edit';
  return got === exp; // memory | none
}

describe('잇비 작업실 열기(open)', () => {
  it.each([
    '작업실 열어줘', '작업실 보여줘', '작업실 들어가자', '작업실 가자', '작업실 좀 열어봐',
    '편집 화면 열어줘', '카드 만드는 화면 열어줘', '템플릿 편집 화면 열어줘', '작업실로 가', '작업실 ㄱㄱ', '작업실',
  ])('"%s" → open', (q) => expect(accepts('open_loose', route(q))).toBe(true));
});

describe('잇비 저장 카드 조회(query/view) — 동사생략·대명사·축약 포함', () => {
  it.each([
    ['저장된 카드 보여줘', 'query'], ['내가 저장한 카드 보여줘', 'query'], ['아까 저장한 거 보여줘', 'query'],
    ['최근 작업물 보여줘', 'query'], ['레이어드컷 가격표 다시 보여줘', 'query'], ['저장 카드 목록', 'query'],
    ['아까 그 가격표', 'view'], ['내가 저장했던 거', 'view'], ['저장된 거 다시', 'view'],
    ['가격표 다시 좀', 'view'], ['저장한 거 어디갔어', 'view'], ['지난번 카드 보여줘', 'query'],
    ['그거 보여줘', 'view'], ['방금 거 다시', 'view'], ['마지막 거 열어', 'view'],
  ])('"%s"', (q, exp) => expect(accepts(exp, route(q))).toBe(true));
});

describe('잇비 저장 카드 수정(edit)', () => {
  it.each([
    '저장한 카드 수정해줘', '방금 만든 카드 수정해줘', '아까 저장한 가격표 수정해줘',
    '레이어드컷 가격표 글자 바꿔줘', '저장한 템플릿 열어서 수정해줘', '최근 작업물 수정해줘',
    '가격표 수정', '카드 편집', '고객한테 보낼 거 수정', '그거 수정해줘',
  ])('"%s" → edit', (q) => expect(accepts('edit', route(q))).toBe(true));
});

describe('잇비 메모리 — 저장/회상/삭제', () => {
  it.each([
    ['보정 전 확인하는 거 기억해', 'memory'], ['예약 답변은 짧게 해줘 기억해', 'memory'],
    ['보정전 확인하는거 기억', 'memory'], ['내가 뭐 기억하라 했지?', 'memory'],
    ['기억하고 있는 거 보여줘', 'memory'], ['내가 기억하라고 한 거 뭐였지', 'memory'],
    ['보정 전 확인하는 거 잊어줘', 'memory'], ['메모 다 지워줘', 'memory'], ['가격표 말투 기억하지 마', 'memory'],
  ])('"%s" → memory', (q) => expect(route(q)).toBe('memory'));
});

describe('타도메인/생성/사진 — 저장카드로 새지 않음', () => {
  it.each([
    '고객 카드 보여줘', '예약 카드 보여줘', '손님 카드 보여줘', '오늘 매출 보여줘', '회원 명단 보여줘',
    '이거 인스타 올려', '이 사진 보정해줘', '저장해줘', '그냥 보여줘', '예약 목록 보여줘',
  ])('"%s" → none', (q) => expect(route(q)).toBe('none'));
});

describe('메모 의미 dedupe(병합 안전) — isSimilar', () => {
  it('의역 변형은 동일 메모로 인정', () => {
    expect(MEM.isSimilar('보정전 확인하는 거', '사진 보정 전 먼저 확인')).toBe(true);
  });
  it.each([
    ['화요일 예약 확인', '수요일 예약 확인'], ['김민지 고객 메모', '김민수 고객 메모'],
    ['건물 앞에서 만나기', '건물 뒤에서 만나기'], ['3만원 할인', '5만원 할인'],
  ])('구별 토큰 다르면 병합 금지: "%s" vs "%s"', (a, b) => expect(MEM.isSimilar(a, b)).toBe(false));
});
