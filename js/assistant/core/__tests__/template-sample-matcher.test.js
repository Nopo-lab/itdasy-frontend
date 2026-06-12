/* 잇비 템플릿 추천 품질 회귀 가드 */
'use strict';

const catalog = require('../template-sample-catalog');

function loadMatcher() {
  global.window = { ItdasyTemplateSampleCatalog: catalog };
  require('../template-sample-matcher');
  return global.window.ItdasyTemplateSampleMatcher;
}

const MATCHER = loadMatcher();

function matchedPayload(q, ctx) {
  const sample = MATCHER.matchTemplateSample(q, ctx || { photoCount: 0 });
  return sample ? MATCHER.toAutoApplyPayload(sample, q, ctx || {}) : null;
}

describe('잇비 템플릿 추천 — 필수 발화', () => {
  it.each([
    ['레이어드컷 가격표 만들어줘', 'price', 'hair', '레이어드컷'],
    ['남자펌 가격표 만들어줘', 'price', 'hair', '남자펌'],
    ['염색 가격표 만들어줘', 'price', 'hair', '염색'],
    ['네일 이달의 아트 카드 만들어줘', 'price', 'nail', '이달의 아트'],
    ['속눈썹 연장 가격표 만들어줘', 'price', 'lash', '속눈썹 연장'],
  ])('%s', (q, purpose, industry, serviceName) => {
    const payload = matchedPayload(q);
    expect(payload).toBeTruthy();
    expect(payload.purpose).toBe(purpose);
    expect(payload.industry).toBe(industry);
    expect(payload.slotValues.services[0].name).toBe(serviceName);
  });

  it.each([
    ['후기 카드 만들어줘', 'review'],
    ['전후사진 카드 만들어줘', 'before_after'],
    ['할인 이벤트 하나', 'event'],
  ])('%s 목적 후보가 섞이지 않는다', (q, purpose) => {
    const top = MATCHER.rankTemplateSamples(q, { photoCount: 2 }, 1)[0];
    expect(top.sample.purpose).toBe(purpose);
  });

  it('피부관리 이벤트는 피부 이벤트 후보가 먼저 나온다', () => {
    const top = MATCHER.rankTemplateSamples('피부관리 이벤트 만들어줘', { photoCount: 2 }, 1)[0];
    expect(top.sample.purpose).toBe('event');
    expect(top.sample.industry).toBe('skin');
  });

  it('전화번호를 가격으로 읽지 않는다', () => {
    expect(MATCHER.parsePriceServices('문의 010-1234-5678 가격표 만들어줘')).toEqual([]);
    expect(MATCHER.parsePriceServices('물광 8만원 문의 010-1234-5678 가격표 만들어줘')[0].price).toBe('80,000원');
  });
});
