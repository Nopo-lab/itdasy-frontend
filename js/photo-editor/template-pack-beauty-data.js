/* 뷰티 템플릿 팩 — 데이터 전용 (BP-2, 2026-06-09)

   업로드 레퍼런스를 editable 캔버스 템플릿으로 재현하기 위한 TOP3 메타데이터.
   - 이 파일은 "데이터"만 소유한다(렌더 X / 연결 X).
   - market-data.js 가 window.PhotoEditorBeautyPackData.TEMPLATES 를 읽어 "조회(lookupById/v3ById)"
     리스트에만 합류시킨다(갤러리 visibleTemplates 에는 미노출 = apply-only).
   - 렌더는 template-renderer-beauty-pack.js(window.PhotoEditorBeautyPack)가, 매핑은 premium-templates META 가 담당.
   - 좌표/카피 고퀄 튜닝은 BP-3. 현재(BP-2)는 skeleton 검증용 메타데이터.

   엔트리 형태(= V3_TOP5 와 동일 키 + 선택 키):
     { id, cat, tier, label, kind, industry, accent, prefillText, palette{bg,ink,sub,accent,line,badge},
       ratio, defaultCopy{...}(BP-3에서 사용, 현재 inert), previewMeta{decor[],photoSlots[]} }

   참고: apply 시 slotValues 는 template-slots.getDefaultValues(kind 기반)에서 생성된다(defaultCopy 미사용).
        그래서 BP-2 에서는 defaultCopy 가 inert 여도 가격/후기/전후 기본 카피로 skeleton 이 의미있게 그려진다.
*/
(function () {
  'use strict';
  if (window.PhotoEditorBeautyPackData) return;

  var TEMPLATES = [
    {
      id: 'bp-price-blackgold', cat: 'price', tier: 'free',
      label: '가격표 · 블랙골드 프리미엄', kind: 'price', purpose: 'price', industry: 'skin',
      accent: 'gold', prefillText: 'PREMIUM CARE', ratio: '4:5',
      palette: { bg: '#14110E', ink: '#F3E9D6', sub: '#B9A98C', accent: '#C9A24B', line: '#3A3024', badge: '#C9A24B' },
      previewMeta: { decor: ['gold-emblem', 'diamond-divider', 'ribbon-badge', 'gold-pill', 'light-streak'], photoSlots: ['main'] },
      // [BP-3] 레퍼런스(⑲ 에끌레르) 카피로 채움 — 현재 inert.
      defaultCopy: {
        shop_name: '에끌레르 에스테틱', shop_name_en: 'ÉCLAT ESTHETIC',
        headline: '프리미엄 케어 프로그램', subtitle: '고객 맞춤 집중 관리',
        services: [
          { name: '리프팅 탄력 케어', desc: '탄탄한 인상을 위한 집중 탄력 관리', origPrice: '220,000원', price: '189,000원', badge: 'PREMIUM' },
          { name: '수분 광채 케어', desc: '촉촉하고 맑은 윤기를 살리는 보습 관리', origPrice: '', price: '129,000원' },
          { name: '문제성 진정 관리', desc: '예민한 피부를 차분하게 정돈하는 밸런싱', origPrice: '', price: '149,000원' },
          { name: '화이트 브라이트 케어', desc: '환하고 깨끗한 인상을 위한 톤 정리', origPrice: '', price: '159,000원' },
        ],
        cta: '카카오 예약', phone: '예약 문의 010-9876-4321',
      },
    },
    {
      id: 'bp-ba-nail-polaroid', cat: 'ba', tier: 'free',
      label: '시술 전후 · 네일 SNS 폴라로이드', kind: 'before_after', purpose: 'before_after', industry: 'nail',
      accent: 'primary', prefillText: 'Before & After', ratio: '4:5',
      palette: { bg: '#FCDDE9', ink: '#4A3B3B', sub: '#9B7E86', accent: '#F2789F', line: '#F6D3DD', badge: '#EC4E86' },
      previewMeta: { decor: ['watercolor', 'sparkle', 'heart', 'polaroid', 'washi-tape', 'paperclip', 'torn-paper'], photoSlots: ['before', 'after'] },
      defaultCopy: {
        shop_name: '루미네일', shop_name_en: 'LUMI NAIL',
        headline: '전후 변화', headline_accent: '네일', subtitle: '손끝 분위기가 달라지는 순간 ♡',
        before_caption: '밋밋한 손끝,\n생기 없는 컬러 :(', after_caption: '',
        tags: ['컬러 정리', '광택 포인트', '손끝 무드 업 ↗'],
        cta: 'DM / 예약문의 ♡', footer_left: '예쁜 네일은 기분까지 빛나게 해줘요♥', footer_right: '오늘의 네일, 내일의 기분♥',
      },
    },
    {
      id: 'bp-review-lash-blue', cat: 'card', tier: 'free',
      label: '후기 · 속눈썹 블루 카드', kind: 'review', purpose: 'review', industry: 'lash',
      accent: 'primary', prefillText: 'REAL REVIEW', ratio: '4:5',
      palette: { bg: '#EAF1F8', ink: '#4E6E8E', sub: '#8A98A8', accent: '#6E93B4', line: '#DCE6F0', badge: '#6E93B4' },
      previewMeta: { decor: ['watercolor-flower', 'sparkle', 'soft-card', 'quote', 'stars', 'line-icon'], photoSlots: ['main'] },
      defaultCopy: {
        shop_name: '모어래쉬', shop_name_en: 'MORE LASH',
        headline: '속눈썹 후기', subtitle: '또렷하고 자연스러운 눈매 변화',
        review_text: '원하던 느낌을 정확히 잡아주셔서 너무 만족했어요. 과하지 않게 또렷해 보여서 데일리로 딱 좋아요.',
        customer_label: '서연님', service_name: '속눈썹 펌', date: '2026.06', rating: 5,
        thanks: '소중한 후기 감사합니다. ♡', cta: '상담 / 예약',
      },
    },
  ];

  window.PhotoEditorBeautyPackData = { VERSION: 'bp-2026060901', TEMPLATES: TEMPLATES };
  if (typeof module !== 'undefined' && module.exports) module.exports = window.PhotoEditorBeautyPackData;
})();
