/* photo-mode-support.shouldStart 회귀 가드 (2026-06-14 이슈1)
 *
 *   사진이 함께 올라온 편집/홍보 발화는 명사("사진")가 없어도 사진편집 모드로 진입해야 하고,
 *   가격표/메뉴판/문자/DM/발송/OCR(영수증) 은 진입하면 안 된다(레거시 BA 가로채기 제거의 안전판).
 *   IIFE + window 전역 등록 → node 에서 window stub 후 eval 로드.
 */
'use strict';
const fs = require('fs');
const path = require('path');

function load() {
  global.window = {};
  // eslint-disable-next-line no-eval
  eval(fs.readFileSync(path.join(__dirname, '..', 'photo-mode-support.js'), 'utf8'));
  return global.window.ItdasyPhotoModeSupport;
}
const S = load();

describe('shouldStart — 사진 동반이면 일원화 진입(이슈1/6)', () => {
  test.each([
    '홍보용으로 예쁘게 해줘', '이거 보정해줘', '예쁘게 꾸며줘',
    '전후로 만들어줘', '후기 카드로', '자연스럽게 정리해줘',
    '이거 둘 다 해줘', '해줘', '',   // 동사/명사 없어도 사진 동반이면 진입(레거시 BA 가로채기 제거)
  ])('사진+"%s" → 진입', (q) => {
    expect(S.shouldStart(q, { hasPhoto: true })).toBe(true);
  });
});

describe('shouldStart — 비-사진편집 의도는 진입 금지(이슈9 회귀)', () => {
  test.each([
    '가격표 만들어줘', '메뉴판으로 만들어줘', 'DM 보내줘',
    '문자 발송해줘', '카톡 보내줘', '알림톡 발송', '영수증 정리해줘',
  ])('사진+"%s" → 비진입', (q) => {
    expect(S.shouldStart(q, { hasPhoto: true })).toBe(false);
  });

  test('텍스트만(사진 없음) "예쁘게 해줘" → 비진입(텍스트 동사만으론 시작 안 함)', () => {
    expect(S.shouldStart('예쁘게 해줘', { hasPhoto: false })).toBe(false);
  });
});
