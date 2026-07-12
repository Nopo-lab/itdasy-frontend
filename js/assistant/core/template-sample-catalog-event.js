/* 잇비 템플릿 샘플 카탈로그 — 이벤트(event) 5개. 데이터 전용. (2026-06-08)
   v3 이벤트 템플릿 대비 데이터만 준비(templateId: null). 집계: template-sample-catalog.js. */
(function () {
  'use strict';

  var SAMPLES = [
    {
      id: 'event_first_visit', purpose: 'event', industry: 'common',
      templateId: null, tier: 'free',
      title: '첫 방문 이벤트',
      triggers: ['첫방문 이벤트', '첫 방문 할인', '신규 이벤트', '오픈 이벤트'],
      negativeTriggers: ['가격표', '후기', '전후'],
      scoreHints: { purpose: 10, industry: 4, style: 5 },
      match: { strong: ['첫방문 이벤트', '신규 이벤트'], weak: ['이벤트', '할인'], exclude: ['후기', '전후'] },
      slotValues: {
        headline: '첫 방문 고객 이벤트', subtitle: '처음 오시는 분께 드리는 특별한 혜택',
        period: '', perks: ['첫 방문 10% 할인', '시술 후 홈케어 샘플 증정', '1:1 맞춤 상담 무료'],
        cta: '예약 문의 주세요',
      },
    },
    {
      id: 'event_monthly_pick', purpose: 'event', industry: 'common',
      templateId: null, tier: 'free',
      title: '이달의 추천 이벤트',
      triggers: ['이달의 이벤트', '이달의 추천', '월간 이벤트', '이달의 픽'],
      negativeTriggers: ['가격표', '후기', '전후'],
      scoreHints: { purpose: 10, industry: 4, style: 5 },
      match: { strong: ['이달의 이벤트', '이달의 추천'], weak: ['이벤트', '추천'], exclude: ['후기', '전후'] },
      slotValues: {
        headline: '이달의 추천 이벤트', subtitle: '이번 달 가장 인기 있는 메뉴를 특별가로',
        period: '', perks: ['이달의 추천 메뉴 할인', '재방문 고객 추가 혜택', '리뷰 작성 시 포인트 적립'],
        cta: '예약 문의 주세요',
      },
    },
    {
      id: 'event_revisit', purpose: 'event', industry: 'common',
      templateId: null, tier: 'free',
      title: '재방문 감사 이벤트',
      triggers: ['재방문 이벤트', '단골 이벤트', '재방문 혜택'],
      negativeTriggers: ['가격표', '후기', '전후'],
      scoreHints: { purpose: 10, industry: 4, style: 4 },
      match: { strong: ['재방문 이벤트', '단골 이벤트'], weak: ['이벤트', '혜택'], exclude: ['후기', '전후'] },
      slotValues: {
        headline: '재방문 감사 이벤트', subtitle: '다시 찾아주신 분께 드리는 감사 혜택',
        period: '', perks: ['재방문 고객 10% 할인', '추천 시 양쪽 모두 혜택', '다음 예약 시 사용 가능한 적립'],
        cta: '예약 문의 주세요',
      },
    },
    {
      id: 'event_skin_care', purpose: 'event', industry: 'skin',
      templateId: null, tier: 'free',
      title: '피부관리 이벤트',
      triggers: ['피부관리 이벤트', '피부 이벤트', '관리 이벤트', '피부 할인'],
      negativeTriggers: ['가격표', '후기', '전후'],
      scoreHints: { purpose: 10, industry: 8, style: 5 },
      match: { strong: ['피부관리 이벤트', '피부 할인'], weak: ['피부', '관리', '이벤트', '할인'], exclude: ['후기', '전후'] },
      slotValues: {
        headline: '피부관리 이벤트', subtitle: '이번 달 인기 관리를 부담 없이 경험해보세요',
        period: '', perks: ['인기 피부관리 할인', '첫 방문 상담 혜택', '재방문 예약 시 추가 혜택'],
        cta: '예약 문의 주세요',
      },
    },
    {
      id: 'event_season_nail', purpose: 'event', industry: 'nail',
      templateId: null, tier: 'free',
      title: '시즌 네일 이벤트',
      triggers: ['시즌 이벤트', '네일 이벤트', '봄 네일 이벤트', '여름 네일 이벤트'],
      negativeTriggers: ['가격표', '후기', '전후'],
      scoreHints: { purpose: 10, industry: 8, style: 5 },
      match: { strong: ['네일 이벤트', '시즌 네일'], weak: ['이벤트', '네일', '시즌'], exclude: ['후기', '전후'] },
      slotValues: {
        headline: '시즌 네일 이벤트', subtitle: '이번 시즌 분위기를 담은 디자인을 특별가로',
        period: '', perks: ['시즌 디자인 네일 할인', '예쁜 후기 작성 시 추가 혜택', '재방문 고객 우선 예약'],
        cta: '예약 문의 주세요',
      },
    },
  ];

  if (typeof window !== 'undefined') window.ItdasyTemplateSampleCatalogEvent = SAMPLES;
  if (typeof module !== 'undefined' && module.exports) module.exports = SAMPLES;
})();
