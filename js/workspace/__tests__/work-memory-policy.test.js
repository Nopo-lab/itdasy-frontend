'use strict';

const fs = require('fs');
const path = require('path');

function load() {
  global.window = {};
  // 정책 파일은 실제 앱처럼 작업기억보다 먼저 읽는다.
  eval(fs.readFileSync(path.join(__dirname, '..', 'work-memory-policy.js'), 'utf8'));
  return window.WorkMemoryPolicy;
}

describe('작업 기억 안전 정책', () => {
  test('서비스명은 허용된 업종으로만 좁히고 모르면 unknown으로 둔다', () => {
    const P = load();
    expect(P.context({ service: '젤네일' }).industry).toBe('네일');
    expect(P.context({ service: '처음 보는 메뉴' }).industry).toBe('unknown');
  });

  test('기억하기 전 레코드와 unknown은 자동 적용 후보가 아니다', () => {
    const P = load();
    const ctx = P.context({ service: '젤네일', occasion: '완성샷', accountId: '5' });
    expect(P.canAutoApply({ industry: '네일', occasion: '완성샷', consentVersion: null, autoApplyAllowed: true }, ctx)).toBe(false);
    expect(P.canAutoApply({ industry: '네일', occasion: '완성샷', consentVersion: P.VERSION, autoApplyAllowed: true, ownerId: '5' }, ctx)).toBe(true);
    expect(P.canAutoApply({ industry: '헤어', occasion: '완성샷', consentVersion: P.VERSION, autoApplyAllowed: true, ownerId: '5' }, ctx)).toBe(false);
    expect(P.canAutoApply({ industry: '네일', occasion: '완성샷', consentVersion: P.VERSION, autoApplyAllowed: true, ownerId: '9' }, ctx)).toBe(false);
  });

  test('기억하기는 자동 적용 동의를 함께 켜지 않는다', () => {
    const P = load();
    expect(P.metadata({ service: '네일', occasion: '완성샷' }, true)).toMatchObject({
      industry: '네일', occasion: '완성샷', consentVersion: P.VERSION, autoApplyAllowed: false
    });
  });

  test('추천은 자동 적용 동의 없이도 같은 계정·업종·목적에서만 보인다', () => {
    const P = load();
    const rec = { industry: '네일', occasion: '완성샷', consentVersion: P.VERSION, autoApplyAllowed: false, ownerId: '5' };
    expect(P.canRecommend(rec, { industry: '네일', occasion: '완성샷', accountId: '5' })).toBe(true);
    expect(P.canRecommend(rec, { industry: '헤어', occasion: '완성샷', accountId: '5' })).toBe(false);
    expect(P.canAutoApply(rec, { industry: '네일', occasion: '완성샷', accountId: '5' })).toBe(false);
  });

  test('일반 시술 사진과 전후 사진은 서로 다른 목적으로 저장한다', () => {
    const P = load();
    expect(P.context({ service: '헤어', kind: 'service' }).occasion).toBe('완성샷');
    expect(P.context({ service: '헤어', kind: 'service', hasBeforeAfter: true }).occasion).toBe('전후사진');
  });

  test('완성샷과 리터치는 자동 적용에서 섞이지 않는다', () => {
    const P = load();
    const rec = { industry: '헤어', occasion: '리터치', consentVersion: P.VERSION, autoApplyAllowed: true, ownerId: '5' };
    expect(P.canAutoApply(rec, { industry: '헤어', occasion: '완성샷', accountId: '5' })).toBe(false);
  });

  test('업종 9종은 다른 업종으로 자동 적용되지 않는다', () => {
    const P = load(); const kinds = P.INDUSTRIES.filter((x) => x !== 'unknown');
    kinds.forEach((from) => kinds.forEach((to) => {
      const rec = { industry: from, occasion: '완성샷', consentVersion: P.VERSION, autoApplyAllowed: true, ownerId: '5' };
      expect(P.canAutoApply(rec, { industry: to, occasion: '완성샷', accountId: '5' })).toBe(from === to);
    }));
  });

  test('목적 7종은 다른 목적으로 자동 적용되지 않는다', () => {
    const P = load(); const uses = P.OCCASIONS.filter((x) => x !== 'unknown');
    uses.forEach((from) => uses.forEach((to) => {
      const rec = { industry: '네일', occasion: from, consentVersion: P.VERSION, autoApplyAllowed: true, ownerId: '5' };
      expect(P.canAutoApply(rec, { industry: '네일', occasion: to, accountId: '5' })).toBe(from === to);
    }));
  });
});
