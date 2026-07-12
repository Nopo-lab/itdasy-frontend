/* 잇비 템플릿 샘플 카탈로그 — 가격표(price) 12개. 데이터 전용. (2026-06-08)
   집계: template-sample-catalog.js. 카피/구조 변경 시 그쪽 QA 함께 통과시킬 것. */
(function () {
  'use strict';

  var SAMPLES = [
    {
      id: 'skin_price_glow_rejuran', purpose: 'price', industry: 'skin',
      templateId: 'v3-price-clean-rose', tier: 'free',
      title: '물광·리쥬란 케어 가격표',
      triggers: ['물광', '리쥬란', '스킨부스터', '광채 케어', '피부 가격표'],
      negativeTriggers: ['후기', '전후', '비교'],
      scoreHints: { purpose: 10, industry: 8, style: 3 },
      match: { strong: ['물광', '리쥬란', '스킨부스터'], weak: ['피부', '케어', '가격표'], exclude: ['후기', '전후', '비교'] },
      slotValues: {
        shop_name: '', headline: '물광·리쥬란 케어 가격표',
        subtitle: '피부결과 광채를 함께 정리하는 오늘의 추천 관리',
        services: [
          { name: '물광 케어', desc: '건조한 피부에 수분과 윤기를 더하는 관리', price: '80,000원', badge: 'BEST', origPrice: '100,000원' },
          { name: '리쥬란 케어', desc: '피부 결과 탄력을 함께 정돈하는 집중 관리', price: '120,000원', badge: '', origPrice: '' },
          { name: '수분 진정 케어', desc: '예민해진 피부를 차분하게 가라앉히는 관리', price: '70,000원', badge: '', origPrice: '' },
        ],
        cta: '예약 문의 주세요', phone: '',
      },
    },
    {
      id: 'skin_price_acne_calm', purpose: 'price', industry: 'skin',
      templateId: 'v3-price-clean-rose', tier: 'free',
      title: '여드름·진정 케어 가격표',
      triggers: ['여드름', '트러블', '진정 케어', '여드름 가격표'],
      negativeTriggers: ['후기', '전후', '비교'],
      scoreHints: { purpose: 10, industry: 8, style: 3 },
      match: { strong: ['여드름', '트러블', '진정'], weak: ['피부', '케어', '가격표'], exclude: ['후기', '전후', '비교'] },
      slotValues: {
        shop_name: '', headline: '여드름·진정 케어 가격표',
        subtitle: '트러블로 지친 피부를 차분하게 돌보는 관리',
        services: [
          { name: '트러블 진정 케어', desc: '붉은기와 예민함을 가라앉히는 진정 관리', price: '70,000원', badge: 'BEST', origPrice: '90,000원' },
          { name: '딥클렌징 케어', desc: '모공 속 노폐물을 부드럽게 정리하는 관리', price: '60,000원', badge: '', origPrice: '' },
          { name: 'LED 진정 관리', desc: '시술 후 피부를 편안하게 마무리하는 케어', price: '50,000원', badge: '', origPrice: '' },
        ],
        cta: '예약 문의 주세요', phone: '',
      },
    },
    {
      id: 'skin_price_lifting_firm', purpose: 'price', industry: 'skin',
      templateId: 'v3-price-clean-rose', tier: 'free',
      title: '탄력·리프팅 케어 가격표',
      triggers: ['리프팅', '탄력', '탄력 케어', '리프팅 가격표'],
      negativeTriggers: ['후기', '전후', '비교'],
      scoreHints: { purpose: 10, industry: 8, style: 3 },
      match: { strong: ['리프팅', '탄력'], weak: ['피부', '케어', '가격표', '라인'], exclude: ['후기', '전후', '비교'] },
      slotValues: {
        shop_name: '', headline: '탄력·리프팅 케어 가격표',
        subtitle: '얼굴 라인과 탄력을 함께 정돈하는 관리',
        services: [
          { name: '탄력 리프팅 케어', desc: '늘어진 라인을 또렷하게 정돈하는 관리', price: '100,000원', badge: 'BEST', origPrice: '130,000원' },
          { name: '고주파 탄력 케어', desc: '피부 속부터 탄탄하게 다지는 집중 관리', price: '130,000원', badge: '', origPrice: '' },
          { name: 'V라인 집중 관리', desc: '얼굴 윤곽을 깔끔하게 정리하는 관리', price: '90,000원', badge: '', origPrice: '' },
        ],
        cta: '예약 문의 주세요', phone: '',
      },
    },
    {
      id: 'nail_price_basic_gel', purpose: 'price', industry: 'nail',
      templateId: 'v3-price-clean-rose', tier: 'free',
      title: '기본 젤네일 가격표',
      triggers: ['젤네일', '기본 네일', '원컬러', '네일 가격표', '손젤'],
      negativeTriggers: ['후기', '전후', '비교'],
      scoreHints: { purpose: 10, industry: 8, style: 3 },
      match: { strong: ['젤네일', '원컬러', '손젤'], weak: ['네일', '케어', '가격표'], exclude: ['후기', '전후', '비교'] },
      slotValues: {
        shop_name: '', headline: '기본 젤네일 가격표',
        subtitle: '깔끔한 손끝을 완성하는 베이직 메뉴',
        services: [
          { name: '원컬러 젤네일', desc: '깔끔한 단색으로 완성하는 데일리 네일', price: '40,000원', badge: 'BEST', origPrice: '' },
          { name: '기본 케어 + 젤', desc: '파일·큐티클 정리에 단색 젤까지', price: '50,000원', badge: '', origPrice: '' },
          { name: '젤 제거 + 케어', desc: '손톱에 무리 없이 깔끔하게 제거', price: '10,000원', badge: '', origPrice: '' },
        ],
        cta: '예약 문의 주세요', phone: '',
      },
    },
    {
      id: 'nail_price_art_monthly', purpose: 'price', industry: 'nail',
      templateId: 'v3-price-clean-rose', tier: 'free',
      title: '이달의 아트 네일 가격표',
      triggers: ['아트 네일', '이달의 아트', '디자인 네일', '시즌 네일'],
      negativeTriggers: ['후기', '전후', '비교'],
      scoreHints: { purpose: 10, industry: 8, style: 4 },
      match: { strong: ['아트', '디자인 네일', '시즌 네일'], weak: ['네일', '가격표'], exclude: ['후기', '전후', '비교'] },
      slotValues: {
        shop_name: '', headline: '이달의 아트 네일 가격표',
        subtitle: '이번 시즌 분위기를 손끝에 담은 디자인',
        services: [
          { name: '이달의 아트', desc: '트렌디한 시즌 컬러와 디자인', price: '79,000원', badge: 'PICK', origPrice: '' },
          { name: '심플 아트', desc: '포인트 하나로 분위기 있는 손끝', price: '60,000원', badge: '', origPrice: '' },
          { name: '글리터 아트', desc: '은은하게 반짝이는 데일리 아트', price: '65,000원', badge: '', origPrice: '' },
        ],
        cta: '예약 문의 주세요', phone: '',
      },
    },
    {
      id: 'nail_price_care_pedi', purpose: 'price', industry: 'nail',
      templateId: 'v3-price-clean-rose', tier: 'free',
      title: '발 관리·페디 가격표',
      triggers: ['페디', '발네일', '발 관리', '패디', '발각질'],
      negativeTriggers: ['후기', '전후', '비교'],
      scoreHints: { purpose: 10, industry: 8, style: 3 },
      match: { strong: ['페디', '패디', '발네일'], weak: ['네일', '발', '케어', '가격표'], exclude: ['후기', '전후', '비교'] },
      slotValues: {
        shop_name: '', headline: '발 관리·페디 가격표',
        subtitle: '발끝까지 깔끔하게 정리하는 케어',
        services: [
          { name: '페디 케어', desc: '발각질 정리에 매끈한 마무리까지', price: '60,000원', badge: 'BEST', origPrice: '' },
          { name: '원컬러 페디', desc: '깔끔한 단색으로 완성하는 발네일', price: '45,000원', badge: '', origPrice: '' },
          { name: '발각질 집중 케어', desc: '거칠어진 발 뒤꿈치를 부드럽게 정리', price: '35,000원', badge: '', origPrice: '' },
        ],
        cta: '예약 문의 주세요', phone: '',
      },
    },
    {
      id: 'lash_price_perm_natural', purpose: 'price', industry: 'lash',
      templateId: 'v3-price-clean-rose', tier: 'free',
      title: '속눈썹 펌 가격표',
      triggers: ['속눈썹 펌', '래쉬 펌', '눈썹펌', '속눈썹 가격표'],
      negativeTriggers: ['후기', '전후', '비교'],
      scoreHints: { purpose: 10, industry: 8, style: 3 },
      match: { strong: ['속눈썹 펌', '래쉬 펌'], weak: ['속눈썹', '래쉬', '가격표'], exclude: ['후기', '전후', '비교'] },
      slotValues: {
        shop_name: '', headline: '속눈썹 펌 가격표',
        subtitle: '뷰러 없이도 또렷한 눈매를 만드는 메뉴',
        services: [
          { name: '내추럴 펌', desc: '자연스러운 컬로 또렷한 눈매 연출', price: '40,000원', badge: 'BEST', origPrice: '' },
          { name: '컬링 펌 + 케어', desc: '컬 유지와 속눈썹 영양 케어까지', price: '50,000원', badge: '', origPrice: '' },
          { name: '아래 속눈썹 펌', desc: '아래 눈매까지 또렷하게 정리', price: '20,000원', badge: '', origPrice: '' },
        ],
        cta: '예약 문의 주세요', phone: '',
      },
    },
    {
      id: 'lash_price_volume_extension', purpose: 'price', industry: 'lash',
      templateId: 'v3-price-clean-rose', tier: 'free',
      title: '속눈썹 연장 가격표',
      triggers: ['속눈썹 연장', '래쉬 연장', '볼륨 래쉬', '연장 가격표'],
      negativeTriggers: ['후기', '전후', '비교'],
      scoreHints: { purpose: 10, industry: 8, style: 3 },
      match: { strong: ['속눈썹 연장', '볼륨 래쉬', '래쉬 연장'], weak: ['속눈썹', '연장', '가격표'], exclude: ['후기', '전후', '비교'] },
      slotValues: {
        shop_name: '', headline: '속눈썹 연장 가격표',
        subtitle: '자연모처럼 가벼운 디자인과 유지력',
        services: [
          { name: '내추럴 래쉬', desc: '자연스러운 디자인으로 부담 없는 눈매', price: '45,000원', badge: 'BEST', origPrice: '' },
          { name: '볼륨 래쉬', desc: '풍성하고 또렷한 눈매를 원할 때', price: '70,000원', badge: '', origPrice: '' },
          { name: '리터치 (2주 내)', desc: '빠진 부분을 채워 컬을 유지', price: '30,000원', badge: '', origPrice: '' },
        ],
        cta: '예약 문의 주세요', phone: '',
      },
    },
    {
      id: 'hair_price_root_clinic', purpose: 'price', industry: 'hair',
      templateId: 'v3-price-clean-rose', tier: 'free',
      title: '모발 클리닉 가격표',
      triggers: ['클리닉', '모발 케어', '두피 케어', '헤어 가격표'],
      negativeTriggers: ['후기', '전후', '비교'],
      scoreHints: { purpose: 10, industry: 8, style: 3 },
      match: { strong: ['클리닉', '모발 케어', '두피'], weak: ['헤어', '머리', '가격표'], exclude: ['후기', '전후', '비교'] },
      slotValues: {
        shop_name: '', headline: '모발 클리닉 가격표',
        subtitle: '손상된 모발과 두피를 차분하게 돌보는 케어',
        services: [
          { name: '모발 클리닉', desc: '푸석해진 머릿결에 윤기를 더하는 케어', price: '90,000원', badge: 'BEST', origPrice: '' },
          { name: '두피 스케일링', desc: '두피를 시원하게 정리하는 관리', price: '50,000원', badge: '', origPrice: '' },
          { name: '홈케어 처방 상담', desc: '집에서 이어갈 관리법까지 안내', price: '10,000원', badge: '', origPrice: '' },
        ],
        cta: '예약 문의 주세요', phone: '',
      },
    },
    {
      id: 'hair_price_dye_design', purpose: 'price', industry: 'hair',
      templateId: 'v3-price-clean-rose', tier: 'free',
      title: '헤어 디자인 가격표',
      triggers: ['염색', '디자인 염색', '커트', '컷', '레이어드컷', '남자펌', '펌', '붙임머리', '헤어 가격표'],
      negativeTriggers: ['후기', '전후', '비교'],
      scoreHints: { purpose: 10, industry: 8, style: 4 },
      match: { strong: ['염색', '레이어드컷', '남자펌', '붙임머리', '디자인 염색'], weak: ['헤어', '커트', '컷', '펌', '가격표'], exclude: ['후기', '전후', '비교'] },
      slotValues: {
        shop_name: '', headline: '헤어 디자인 가격표',
        subtitle: '컷·펌·염색까지 스타일 변화를 한눈에 정리했어요',
        services: [
          { name: '레이어드컷', desc: '얼굴형과 기장에 맞춘 자연스러운 레이어', price: '35,000원', badge: 'BEST', origPrice: '' },
          { name: '남자펌', desc: '손질하기 쉬운 볼륨과 컬 디자인', price: '80,000원', badge: '', origPrice: '' },
          { name: '디자인 염색', desc: '톤과 분위기를 맞춘 맞춤 컬러 (탈색 별도)', price: '120,000원', badge: 'BEST', origPrice: '' },
        ],
        cta: '예약 문의 주세요', phone: '',
      },
    },
    {
      id: 'waxing_price_basic', purpose: 'price', industry: 'waxing',
      templateId: 'v3-price-clean-rose', tier: 'free',
      title: '왁싱 가격표',
      triggers: ['왁싱', '제모', '왁싱 가격표', '브라질리언'],
      negativeTriggers: ['후기', '전후', '비교'],
      scoreHints: { purpose: 10, industry: 8, style: 3 },
      match: { strong: ['왁싱', '제모', '브라질리언'], weak: ['케어', '가격표'], exclude: ['후기', '전후', '비교'] },
      slotValues: {
        shop_name: '', headline: '왁싱 가격표',
        subtitle: '위생적으로 깔끔하게, 매끈한 마무리',
        services: [
          { name: '겨드랑이 왁싱', desc: '짧은 시간에 깔끔하게 정리', price: '20,000원', badge: 'BEST', origPrice: '' },
          { name: '다리 전체 왁싱', desc: '매끈하게 정돈하는 라인 케어', price: '60,000원', badge: '', origPrice: '' },
          { name: '브라질리언', desc: '1인 룸에서 편안하게 진행하는 케어', price: '70,000원', badge: '', origPrice: '' },
        ],
        cta: '예약 문의 주세요', phone: '',
      },
    },
    {
      id: 'makeup_price_daily', purpose: 'price', industry: 'makeup',
      templateId: 'v3-price-clean-rose', tier: 'free',
      title: '메이크업 가격표',
      triggers: ['메이크업', '화장', '데일리 메이크업', '메이크업 가격표', '웨딩 메이크업'],
      negativeTriggers: ['후기', '전후', '비교'],
      scoreHints: { purpose: 10, industry: 8, style: 4 },
      match: { strong: ['메이크업', '화장', '웨딩 메이크업'], weak: ['케어', '가격표', '글램'], exclude: ['후기', '전후', '비교'] },
      slotValues: {
        shop_name: '', headline: '메이크업 가격표',
        subtitle: '오늘의 분위기에 맞춘 화사한 메이크업',
        services: [
          { name: '데일리 메이크업', desc: '자연스럽고 화사한 일상 메이크업', price: '50,000원', badge: 'BEST', origPrice: '' },
          { name: '행사 메이크업', desc: '또렷하고 화사하게 분위기 있는 연출', price: '80,000원', badge: '', origPrice: '' },
          { name: '속눈썹 포함', desc: '메이크업에 인조 속눈썹까지', price: '15,000원', badge: '', origPrice: '' },
        ],
        cta: '예약 문의 주세요', phone: '',
      },
    },
  ];

  if (typeof window !== 'undefined') window.ItdasyTemplateSampleCatalogPrice = SAMPLES;
  if (typeof module !== 'undefined' && module.exports) module.exports = SAMPLES;
})();
