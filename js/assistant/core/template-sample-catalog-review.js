/* 잇비 템플릿 샘플 카탈로그 — 후기(review) 10개. 데이터 전용. (2026-06-08)
   집계: template-sample-catalog.js. 카피/구조 변경 시 그쪽 QA 함께 통과시킬 것. */
(function () {
  'use strict';

  var SAMPLES = [
    {
      id: 'skin_review_glow_texture', purpose: 'review', industry: 'skin',
      templateId: 'v3-review-card', tier: 'free',
      title: '피부 결·광채 후기',
      triggers: ['피부 후기', '물광 후기', '피부결 후기', '광채 후기'],
      negativeTriggers: ['가격표', '전후'],
      scoreHints: { purpose: 10, industry: 8, style: 2 },
      match: { strong: ['물광 후기', '피부결 후기'], weak: ['피부', '후기', '케어'], exclude: ['가격표', '전후', '비교'] },
      slotValues: {
        headline: '고객님의 진심 후기', subtitle: '시술 후 남겨주신 소중한 한마디',
        review_text: '관리받고 나서 피부결이 한결 매끈해지고 화장도 잘 먹어요. 꾸준히 받아보려고 해요.',
        customer_label: '고객님', service_name: '물광 피부관리', date: '', cta: '예약 문의 주세요',
      },
    },
    {
      id: 'skin_review_calm_sensitive', purpose: 'review', industry: 'skin',
      templateId: 'v3-review-card', tier: 'free',
      title: '민감·진정 후기',
      triggers: ['진정 후기', '민감성 후기', '피부 진정 후기'],
      negativeTriggers: ['가격표', '전후'],
      scoreHints: { purpose: 10, industry: 8, style: 2 },
      match: { strong: ['진정 후기', '민감성 후기'], weak: ['피부', '후기'], exclude: ['가격표', '전후', '비교'] },
      slotValues: {
        headline: '고객님의 진심 후기', subtitle: '시술 후 남겨주신 소중한 한마디',
        review_text: '예민해서 늘 조심스러웠는데 관리받는 동안 편안했어요. 붉은기도 한결 차분해진 느낌이에요.',
        customer_label: '고객님', service_name: '진정 케어', date: '', cta: '예약 문의 주세요',
      },
    },
    {
      id: 'skin_review_acne_confidence', purpose: 'review', industry: 'skin',
      templateId: 'v3-review-card', tier: 'free',
      title: '여드름 케어 후기',
      triggers: ['여드름 후기', '트러블 후기', '여드름 케어 후기'],
      negativeTriggers: ['가격표', '전후'],
      scoreHints: { purpose: 10, industry: 8, style: 2 },
      match: { strong: ['여드름 후기', '트러블 후기'], weak: ['피부', '후기', '케어'], exclude: ['가격표', '전후', '비교'] },
      slotValues: {
        headline: '고객님의 진심 후기', subtitle: '꾸준한 관리로 달라진 이야기',
        review_text: '트러블 때문에 스트레스였는데 관리받으면서 피부가 차분해졌어요. 이제 쌩얼도 한결 편해졌어요.',
        customer_label: '고객님', service_name: '여드름 케어', date: '', cta: '예약 문의 주세요',
      },
    },
    {
      id: 'nail_review_retention', purpose: 'review', industry: 'nail',
      templateId: 'v3-review-card', tier: 'free',
      title: '네일 유지력 후기',
      triggers: ['네일 후기', '유지력', '젤네일 후기', '손젤 후기'],
      negativeTriggers: ['가격표', '전후'],
      scoreHints: { purpose: 10, industry: 8, style: 3 },
      match: { strong: ['네일 후기', '젤네일 후기', '유지력'], weak: ['네일', '후기'], exclude: ['가격표', '전후', '비교'] },
      slotValues: {
        headline: '고객님의 네일 후기', subtitle: '시술 후 남겨주신 소중한 한마디',
        review_text: '컬러도 마음에 들고 유지력도 좋아서 다음 예약도 바로 잡았어요. 손끝이 예뻐지니 기분도 좋아요.',
        customer_label: '고객님', service_name: '젤네일', date: '', cta: '예약 문의 주세요',
      },
    },
    {
      id: 'nail_review_art_satisfaction', purpose: 'review', industry: 'nail',
      templateId: 'v3-review-card', tier: 'free',
      title: '네일 아트 만족 후기',
      triggers: ['아트 후기', '디자인 네일 후기', '네일 아트 후기'],
      negativeTriggers: ['가격표', '전후'],
      scoreHints: { purpose: 10, industry: 8, style: 3 },
      match: { strong: ['아트 후기', '디자인 네일 후기'], weak: ['네일', '후기', '아트'], exclude: ['가격표', '전후', '비교'] },
      slotValues: {
        headline: '고객님의 네일 후기', subtitle: '손끝에 담은 오늘의 디자인',
        review_text: '원하던 분위기 그대로 디자인해 주셔서 너무 만족해요. 주변에서도 예쁘다고 많이 물어봐요.',
        customer_label: '고객님', service_name: '디자인 네일', date: '', cta: '예약 문의 주세요',
      },
    },
    {
      id: 'lash_review_natural_perm', purpose: 'review', industry: 'lash',
      templateId: 'v3-review-card', tier: 'free',
      title: '속눈썹 펌 후기',
      triggers: ['속눈썹 후기', '래쉬 후기', '속눈썹 펌 후기', '눈매 후기'],
      negativeTriggers: ['가격표', '전후'],
      scoreHints: { purpose: 10, industry: 8, style: 3 },
      match: { strong: ['속눈썹 후기', '래쉬 후기', '속눈썹 펌 후기'], weak: ['속눈썹', '후기'], exclude: ['가격표', '전후', '비교'] },
      slotValues: {
        headline: '고객님의 속눈썹 후기', subtitle: '시술 후 남겨주신 소중한 한마디',
        review_text: '뷰러 안 써도 눈매가 또렷해서 아침이 편해졌어요. 자연스러운 컬이 딱 제 스타일이에요.',
        customer_label: '고객님', service_name: '속눈썹 펌', date: '', cta: '예약 문의 주세요',
      },
    },
    {
      id: 'lash_review_volume_design', purpose: 'review', industry: 'lash',
      templateId: 'v3-review-card', tier: 'free',
      title: '속눈썹 연장 후기',
      triggers: ['속눈썹 연장 후기', '볼륨 래쉬 후기', '연장 후기'],
      negativeTriggers: ['가격표', '전후'],
      scoreHints: { purpose: 10, industry: 8, style: 3 },
      match: { strong: ['속눈썹 연장 후기', '볼륨 래쉬 후기'], weak: ['속눈썹', '연장', '후기'], exclude: ['가격표', '전후', '비교'] },
      slotValues: {
        headline: '고객님의 속눈썹 후기', subtitle: '또렷해진 눈매 이야기',
        review_text: '디자인 상담을 꼼꼼히 해주셔서 눈매에 잘 어울려요. 가볍고 자연스러워서 만족스러워요.',
        customer_label: '고객님', service_name: '속눈썹 연장', date: '', cta: '예약 문의 주세요',
      },
    },
    {
      id: 'hair_review_clinic_smooth', purpose: 'review', industry: 'hair',
      templateId: 'v3-review-card', tier: 'free',
      title: '모발 클리닉 후기',
      triggers: ['헤어 후기', '클리닉 후기', '머릿결 후기', '모발 후기'],
      negativeTriggers: ['가격표', '전후'],
      scoreHints: { purpose: 10, industry: 8, style: 2 },
      match: { strong: ['클리닉 후기', '머릿결 후기'], weak: ['헤어', '후기', '모발'], exclude: ['가격표', '전후', '비교'] },
      slotValues: {
        headline: '고객님의 헤어 후기', subtitle: '관리 후 남겨주신 소중한 한마디',
        review_text: '푸석했던 머릿결이 한결 부드러워지고 윤기가 도는 느낌이에요. 손질도 훨씬 편해졌어요.',
        customer_label: '고객님', service_name: '모발 클리닉', date: '', cta: '예약 문의 주세요',
      },
    },
    {
      id: 'hair_review_dye_color', purpose: 'review', industry: 'hair',
      templateId: 'v3-review-card', tier: 'free',
      title: '염색 컬러 후기',
      triggers: ['염색 후기', '컬러 후기', '헤어 컬러 후기'],
      negativeTriggers: ['가격표', '전후'],
      scoreHints: { purpose: 10, industry: 8, style: 3 },
      match: { strong: ['염색 후기', '컬러 후기'], weak: ['헤어', '후기', '염색'], exclude: ['가격표', '전후', '비교'] },
      slotValues: {
        headline: '고객님의 헤어 후기', subtitle: '나에게 어울리는 컬러 이야기',
        review_text: '피부톤이랑 잘 맞는 컬러로 추천해 주셔서 분위기가 확 살았어요. 색도 곱게 잘 나왔어요.',
        customer_label: '고객님', service_name: '디자인 염색', date: '', cta: '예약 문의 주세요',
      },
    },
    {
      id: 'waxing_review_clean_firsttime', purpose: 'review', industry: 'waxing',
      templateId: 'v3-review-card', tier: 'free',
      title: '왁싱 첫 방문 후기',
      triggers: ['왁싱 후기', '제모 후기', '왁싱 첫방문 후기'],
      negativeTriggers: ['가격표', '전후'],
      scoreHints: { purpose: 10, industry: 8, style: 2 },
      match: { strong: ['왁싱 후기', '제모 후기'], weak: ['후기', '케어'], exclude: ['가격표', '전후', '비교'] },
      slotValues: {
        headline: '고객님의 왁싱 후기', subtitle: '편안하게 받고 가신 한마디',
        review_text: '처음이라 긴장했는데 편안하게 진행해 주셔서 좋았어요. 깔끔하게 정리돼서 만족스러워요.',
        customer_label: '고객님', service_name: '왁싱', date: '', cta: '예약 문의 주세요',
      },
    },
  ];

  if (typeof window !== 'undefined') window.ItdasyTemplateSampleCatalogReview = SAMPLES;
  if (typeof module !== 'undefined' && module.exports) module.exports = SAMPLES;
})();
