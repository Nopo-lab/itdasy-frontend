/* 템플릿 리빌드 팩 v3 — 데이터 (2026-06-07 · 브랜치 claude/template-pack-v3)
 *
 * 순수 데이터 팩. 함수/렌더 없음. 앱에 연결하지 않는다(독립 preview 전용).
 * defaultCopy 키는 template-slots.js 의 slot kind 키와 100% 일치 → 나중에 slotValues 로 무손실 매핑.
 *
 * kind: price | review | before_after | generic
 * cat : price | ba | event | card   (기존 CATS 호환)
 * industry: nail | hair | lash | brow | skin | makeup | common
 * styleFamily: clean | pastel | luxe
 * ratio/size: price·ba = 4:5 [1080,1350] · event·card = 1:1 [1080,1080]
 *
 * 외부 노출: window.PhotoEditorTemplatePackV3
 */
(function () {
  'use strict';
  if (window.PhotoEditorTemplatePackV3) return;

  // ── 스타일군 공통 토큰 ────────────────────────────────────
  const STYLE_FAMILIES = {
    clean: {
      label: 'Clean Premium',
      fontPair: { head: "'Noto Serif KR', serif", body: "'Pretendard', sans-serif" },
      radius: 18,
    },
    pastel: {
      label: 'Soft Pastel SNS',
      fontPair: { head: "'Gmarket Sans', 'Pretendard', sans-serif", body: "'Pretendard', sans-serif" },
      radius: 22,
    },
    luxe: {
      label: 'Luxe Dark',
      fontPair: { head: "'Noto Serif KR', serif", body: "'Pretendard', sans-serif" },
      radius: 12,
    },
  };

  const R45 = { ratio: '4:5', size: [1080, 1350] };
  const R11 = { ratio: '1:1', size: [1080, 1080] };

  // 가격표 샘플(업종별) — defaultCopy.services 에 그대로 들어감
  const SVC_SKIN = [
    { name: '물광 피부관리', desc: '수분 집중 케어', price: '69,000원' },
    { name: '리프팅 관리', desc: '탄력 개선 · 또렷한 페이스라인', price: '99,000원' },
    { name: 'MTS 스킨부스터', desc: '피부 재생 · 탄력 개선', price: '119,000원' },
    { name: '화이트닝 관리', desc: '맑고 환한 브라이트닝', price: '79,000원' },
  ];
  const SVC_LASH = [
    { name: '내추럴 속눈썹 연장', desc: '자연스러운 디자인', price: '50,000원' },
    { name: '볼륨 래쉬 (3D/4D)', desc: '풍성하고 또렷한 눈매', price: '70,000원' },
    { name: '속눈썹 펌', desc: '뷰러 없이 또렷한 컬', price: '45,000원' },
    { name: '언더 속눈썹', desc: '또렷한 눈매 완성', price: '20,000원' },
  ];
  const SVC_MULTI = [
    { name: '수분 진정 관리', desc: '피부 · 수분 공급 & 진정', price: '60,000원' },
    { name: '자연 속눈썹 연장', desc: '속눈썹 · 내추럴 디자인', price: '50,000원' },
    { name: '젤 네일 (단색)', desc: '네일 · 깔끔한 단색 젤', price: '40,000원' },
    { name: '젤 네일 (디자인)', desc: '네일 · 감각적인 아트', price: '60,000원' },
  ];

  // ── 16종 ─────────────────────────────────────────────────
  const TEMPLATES = [

    // ① 가격표 — 클린 로즈
    Object.assign({
      id: 'v3-price-clean-rose', label: '가격표 · 클린 로즈', cat: 'price', tier: 'free',
      industry: 'skin', styleFamily: 'clean', kind: 'price',
      prefillText: 'PRICE LIST', accent: 'soft',
      palette: { bg: '#FBEFEF', ink: '#3A2C2C', sub: '#9A8585', accent: '#C57E7E', line: '#E7CFCF', badge: '#C57E7E' },
      defaultCopy: {
        shop_name: 'BEAUTÉ', headline: '시술 가격표',
        subtitle: '프리미엄 시술로 더 아름다운 변화를 경험하세요.',
        services: clone(SVC_SKIN), cta: '예약 및 문의', phone: '02-1234-5678',
      },
      previewMeta: { decor: ['hashtags'], photoSlots: [] },
    }, R45),

    // ② 가격표 — 클린 멀티섹션
    Object.assign({
      id: 'v3-price-clean-multi', label: '가격표 · 3섹션(피부·속눈썹·네일)', cat: 'price', tier: 'free',
      industry: 'common', styleFamily: 'clean', kind: 'price',
      prefillText: 'TOTAL CARE', accent: 'soft',
      palette: { bg: '#FFFFFF', ink: '#2E2A33', sub: '#8C8794', accent: '#D98BA5', line: '#EDE7EF', badge: '#B49AD6' },
      defaultCopy: {
        shop_name: 'BEAUTY DAY', headline: '시술 가격표',
        subtitle: '아름다움을 위한 특별한 관리, 합리적인 가격으로 만나보세요.',
        services: clone(SVC_MULTI), cta: '예약 및 문의', phone: '010-1234-5678',
      },
      previewMeta: { decor: ['section-tabs'], photoSlots: ['main'] },
    }, R45),

    // ③ 가격표 — 럭셔리 다크
    Object.assign({
      id: 'v3-price-luxe-dark', label: '가격표 · 럭셔리 블랙골드', cat: 'price', tier: 'pro',
      industry: 'skin', styleFamily: 'luxe', kind: 'price',
      prefillText: 'PREMIUM CARE', accent: 'gold',
      palette: { bg: '#14110E', ink: '#F3E9D6', sub: '#B9A98C', accent: '#C9A24B', line: '#3A3024', badge: '#C9A24B' },
      defaultCopy: {
        shop_name: 'LUMIÈRE', headline: '프리미엄 관리 가격표',
        subtitle: '당신의 피부, 가장 빛나는 순간으로',
        services: [
          { name: '프리미엄 리프팅 관리', desc: '탄력 개선 · 얼굴 라인 리프팅', price: '180,000원' },
          { name: '물광 피부 재생 관리', desc: '수분 충전 · 피부 장벽 강화', price: '150,000원' },
          { name: '화이트닝 톤업 관리', desc: '칙칙한 피부톤 개선 · 광채', price: '130,000원' },
          { name: '고주파 탄력 관리', desc: '탄력 강화 · 주름 개선 집중', price: '160,000원' },
        ],
        cta: '예약 & 상담문의', phone: '02-1234-5678',
      },
      previewMeta: { decor: ['gold-divider'], photoSlots: ['main'] },
    }, R45),

    // ④ 가격표 — 클린 사진+카드행
    Object.assign({
      id: 'v3-price-clean-photo', label: '가격표 · 사진+카드행', cat: 'price', tier: 'free',
      industry: 'skin', styleFamily: 'clean', kind: 'price',
      prefillText: 'PRICE LIST', accent: 'soft',
      palette: { bg: '#FCEEEF', ink: '#2B2526', sub: '#9C8E8F', accent: '#E08A9A', line: '#F2DADE', badge: '#E08A9A' },
      defaultCopy: {
        shop_name: 'BEAUTY STUDIO', headline: '시술 가격표',
        subtitle: '아름다움을 위한 투자, 합리적인 가격으로 최상의 만족을 드립니다.',
        services: [
          { name: '기본 관리', desc: '피부 타입에 맞춘 베이직 스킨 케어', price: '50,000원' },
          { name: '수분 케어', desc: '건조한 피부에 수분과 영양 집중 공급', price: '70,000원' },
          { name: '속눈썹 펌', desc: '자연스러운 컬링으로 또렷한 눈매', price: '45,000원' },
          { name: '젤네일 기본', desc: '깔끔한 기본 케어 + 단색 젤네일', price: '55,000원' },
        ],
        cta: '예약 및 문의', phone: '010-1234-5678',
      },
      previewMeta: { decor: ['row-badges'], photoSlots: ['main'] },
    }, R45),

    // ⑤ 가격표 — 파스텔 SNS(번호+썸네일)
    Object.assign({
      id: 'v3-price-sns-pastel', label: '가격표 · 파스텔 SNS', cat: 'price', tier: 'free',
      industry: 'common', styleFamily: 'pastel', kind: 'price',
      prefillText: '이달의 가격표', accent: 'primary',
      palette: { bg: '#F6ECFB', ink: '#3A2E45', sub: '#9385A0', accent: '#E25BA0', line: '#E7D6F0', badge: '#B47BE0' },
      defaultCopy: {
        shop_name: 'BEAUTY SALON', headline: '이달의 가격표',
        subtitle: '예뻐지는 계절, 지금이 찬스!',
        services: [
          { name: '붙임머리', desc: '고급 인모 100% · 자연스러운 핏', price: '350,000원~' },
          { name: '속눈썹 연장', desc: '자연스러운 디자인 · 컬 유지력 UP', price: '45,000원~' },
          { name: '젤 네일', desc: '시즌 트렌드 아트 · 컬러 200가지', price: '50,000원~' },
          { name: '패디 플래닝', desc: '발각질 케어 + 젤 · 매끈한 발', price: '60,000원~' },
        ],
        cta: '예약은 DM 문의', phone: '',
      },
      previewMeta: { decor: ['number-thumb', 'sticker-heart'], photoSlots: ['main'] },
    }, R45),

    // ⑥ 가격표 — 파스텔 아이콘행
    Object.assign({
      id: 'v3-price-sns-icon', label: '가격표 · 파스텔 아이콘', cat: 'price', tier: 'free',
      industry: 'lash', styleFamily: 'pastel', kind: 'price',
      prefillText: 'LASH & NAIL', accent: 'primary',
      palette: { bg: '#FBE9F1', ink: '#3D2C39', sub: '#9A8794', accent: '#F25CA2', line: '#F3D6E5', badge: '#C99BE0' },
      defaultCopy: {
        shop_name: 'BEAUTY NAIL', headline: '이달의 가격표',
        subtitle: '예뻐지는 건 타이밍! 지금이 기회예요',
        services: clone(SVC_LASH), cta: '카카오톡 예약', phone: '',
      },
      previewMeta: { decor: ['icon-circle', 'pick-card'], photoSlots: ['main'] },
    }, R45),

    // ⑦ 전후 — 클린 로즈
    Object.assign({
      id: 'v3-ba-clean-rose', label: '시술 전후 · 클린 로즈', cat: 'ba', tier: 'free',
      industry: 'skin', styleFamily: 'clean', kind: 'before_after',
      prefillText: 'BEFORE & AFTER', accent: 'soft',
      palette: { bg: '#F7EBE6', ink: '#4A3B38', sub: '#9C8983', accent: '#B97F7A', line: '#E6D2CC', badge: '#8C7A76' },
      defaultCopy: {
        shop_name: 'LUMIÈRE BEAUTY', headline: '시술 전후',
        subtitle: '한 눈에 비교해보세요. 달라진 아름다움의 차이',
        before_label: 'BEFORE', after_label: 'AFTER',
        before_caption: '칙칙하고 생기 없는 피부 톤', after_caption: '맑고 균일한 피부 톤',
        cta: '상담 예약하기',
      },
      previewMeta: { decor: ['leaf', 'effect-4'], photoSlots: ['before', 'after'] },
    }, R45),

    // ⑧ 전후 — 클린 블루
    Object.assign({
      id: 'v3-ba-clean-blue', label: '시술 전후 · 클린 블루', cat: 'ba', tier: 'free',
      industry: 'skin', styleFamily: 'clean', kind: 'before_after',
      prefillText: 'BEFORE & AFTER', accent: 'primary',
      palette: { bg: '#EEF3F8', ink: '#28384A', sub: '#7E8C9A', accent: '#5B82B0', line: '#D6E0EC', badge: '#5B82B0' },
      defaultCopy: {
        shop_name: 'PURELLE BEAUTY', headline: '시술 전후',
        subtitle: '칙칙하고 건조했던 피부가 촉촉하고 맑게 빛나는 변화를 경험해보세요.',
        before_label: 'BEFORE', after_label: 'AFTER',
        before_caption: '건조하고 푸석한 피부', after_caption: '맑고 환한 피부 톤',
        cta: '상담 예약하기',
      },
      previewMeta: { decor: ['arrow-mid', 'effect-3'], photoSlots: ['before', 'after'] },
    }, R45),

    // ⑨ 전후 — 파스텔 핑크
    Object.assign({
      id: 'v3-ba-sns-pink', label: '시술 전후 · 파스텔 핑크', cat: 'ba', tier: 'free',
      industry: 'nail', styleFamily: 'pastel', kind: 'before_after',
      prefillText: '시술 전후', accent: 'primary',
      palette: { bg: '#FCE9EE', ink: '#3F2C32', sub: '#A2868E', accent: '#F24E86', line: '#F6D3DD', badge: '#F24E86' },
      defaultCopy: {
        shop_name: 'NAIL SALON', headline: '시술 전후',
        subtitle: '달라진 손톱, 눈으로 확인해보세요!',
        before_label: 'BEFORE', after_label: 'AFTER',
        before_caption: '거칠고 건조한 손톱', after_caption: '매끄럽고 촉촉한 손톱',
        cta: '예약 문의 DM',
      },
      previewMeta: { decor: ['sticker-heart', 'sparkle', 'checklist'], photoSlots: ['before', 'after'] },
    }, R45),

    // ⑩ 전후 — 폴라로이드
    Object.assign({
      id: 'v3-ba-polaroid', label: '시술 전후 · 폴라로이드', cat: 'ba', tier: 'free',
      industry: 'hair', styleFamily: 'pastel', kind: 'before_after',
      prefillText: 'BEFORE & AFTER', accent: 'primary',
      palette: { bg: '#F2EBFA', ink: '#352B45', sub: '#8E83A0', accent: '#C45BBE', line: '#E2D6F0', badge: '#C45BBE' },
      defaultCopy: {
        shop_name: 'HAIR SALON', headline: '붙임머리 전후',
        subtitle: '볼륨감이 달라지는 순간',
        before_label: 'BEFORE', after_label: 'AFTER',
        before_caption: '밋밋하고 힘없는 모발', after_caption: '풍성하고 자연스러운 볼륨',
        cta: '상담 가능',
      },
      previewMeta: { decor: ['polaroid', 'tape', 'arrow-curve'], photoSlots: ['before', 'after'] },
    }, R45),

    // ⑪ 전후 — 럭셔리 다크
    Object.assign({
      id: 'v3-ba-luxe-dark', label: '시술 전후 · 럭셔리 블랙골드', cat: 'ba', tier: 'pro',
      industry: 'skin', styleFamily: 'luxe', kind: 'before_after',
      prefillText: 'BEFORE & AFTER', accent: 'gold',
      palette: { bg: '#16120D', ink: '#F4EAD6', sub: '#B7A684', accent: '#C9A24B', line: '#3A3024', badge: '#C9A24B' },
      defaultCopy: {
        shop_name: 'PREMIUM SKINCARE', headline: '시술 전후',
        subtitle: '결과로 증명되는 프리미엄 스킨 솔루션',
        before_label: 'BEFORE', after_label: 'AFTER',
        before_caption: '칙칙한 피부 톤 · 늘어진 모공', after_caption: '맑고 투명한 피부 톤 · 매끈한 결',
        cta: '예약 문의',
      },
      previewMeta: { decor: ['gold-frame', 'effect-5'], photoSlots: ['before', 'after'] },
    }, R45),

    // ⑫ 이벤트 — 스크랩북 콜라주
    Object.assign({
      id: 'v3-event-scrapbook', label: '이벤트 · 스크랩북 콜라주', cat: 'event', tier: 'free',
      industry: 'common', styleFamily: 'pastel', kind: 'generic',
      prefillText: '봄 시즌 이벤트', accent: 'primary',
      palette: { bg: '#FAE7EC', ink: '#3E2C33', sub: '#9E858D', accent: '#EF6F9A', line: '#F4D2DC', badge: '#EF6F9A' },
      defaultCopy: {
        shop_name: 'BEAUTY SALON', headline: '봄 시즌 이벤트',
        subtitle: '봄 분위기 가득, 더 예뻐질 지금! 속눈썹·네일 특별 할인 혜택을 놓치지 마세요',
        cta: '예약하기', main_photo: '',
      },
      previewMeta: { decor: ['torn-paper', 'tape', 'flower', 'sticker-heart'], photoSlots: ['main'] },
    }, R11),

    // ⑬ 이벤트 — 볼드 할인
    Object.assign({
      id: 'v3-event-bold', label: '이벤트 · 볼드 할인 배지', cat: 'event', tier: 'free',
      industry: 'common', styleFamily: 'pastel', kind: 'generic',
      prefillText: '50% OFF', accent: 'primary',
      palette: { bg: '#FDE7F0', ink: '#3E2330', sub: '#A07F8D', accent: '#FF4D94', line: '#F8CFE0', badge: '#FFD24D' },
      defaultCopy: {
        shop_name: 'YOUR SALON', headline: '피부 상태 체크 무료!',
        subtitle: '지금 바로 예약하고 깨끗한 피부 만나보세요',
        cta: '예약하기', main_photo: '',
      },
      previewMeta: { decor: ['big-badge', 'cta-bar', 'sparkle'], photoSlots: ['main'] },
    }, R11),

    // ⑭ 이벤트 — 쿠폰 절취선
    Object.assign({
      id: 'v3-event-coupon', label: '이벤트 · 쿠폰 절취선', cat: 'event', tier: 'pro',
      industry: 'common', styleFamily: 'clean', kind: 'generic',
      prefillText: '신규 -30%', accent: 'gold',
      palette: { bg: '#FBF3EE', ink: '#33291F', sub: '#9A8A78', accent: '#C98A5E', line: '#E9D8C8', badge: '#C98A5E' },
      defaultCopy: {
        shop_name: 'BEAUTY STUDIO', headline: '신규 고객 30% 할인',
        subtitle: '첫 방문 고객님께 드리는 특별 혜택 · 네이버 예약 시 적용',
        cta: '쿠폰 사용하기', main_photo: '',
      },
      previewMeta: { decor: ['coupon-perforation', 'dashed-line'], photoSlots: ['main'] },
    }, R11),

    // ⑮ 후기 — 카드형
    Object.assign({
      id: 'v3-review-card', label: '후기 · 인용 카드', cat: 'card', tier: 'free',
      industry: 'skin', styleFamily: 'clean', kind: 'review',
      prefillText: 'REAL REVIEW', accent: 'soft',
      palette: { bg: '#FBEFEF', ink: '#3A2C2C', sub: '#9A8585', accent: '#C57E7E', line: '#E7CFCF', badge: '#C57E7E' },
      defaultCopy: {
        shop_name: 'SOFTGLOW SKIN', headline: '고객님의 진심 후기',
        subtitle: '시술 후 달라진 변화를 직접 확인해보세요.',
        review_text: '평소에 트러블 때문에 화장도 잘 안 먹고 스트레스였는데, 2주만에 피부가 진정되고 결이 매끈해졌어요! 이제는 쌩얼에도 자신감이 생겼어요',
        customer_label: '30대 / 단골 고객님', cta: '상담 예약하기',
      },
      previewMeta: { decor: ['quote', 'stars', 'profile'], photoSlots: ['main'] },
    }, R11),

    // ⑯ 샵소개 — 미니멀 카드
    Object.assign({
      id: 'v3-card-shop-intro', label: '샵 소개 · 미니멀 카드', cat: 'card', tier: 'free',
      industry: 'common', styleFamily: 'clean', kind: 'generic',
      prefillText: 'OUR SHOP', accent: 'soft',
      palette: { bg: '#F4F0EC', ink: '#2E2A26', sub: '#8C857C', accent: '#B79B79', line: '#E2DAD0', badge: '#B79B79' },
      defaultCopy: {
        shop_name: 'PURE DAY BEAUTY', headline: '깨끗한 피부, 맑은 하루',
        subtitle: '피부 · 속눈썹 · 네일 토탈 뷰티케어\n서울시 강남구 도산대로 123, 2층 · 평일 10:00–20:00',
        cta: '예약은 DM 문의', main_photo: '',
      },
      previewMeta: { decor: ['logo', 'info-rows'], photoSlots: ['main'] },
    }, R11),
  ];

  // ⓘ 데이터 위생: ① styleFamily 오타 가드(클린 표현식 정리)
  TEMPLATES.forEach((t) => { if (t.styleFamily === undefined || typeof t.styleFamily !== 'string') t.styleFamily = 'clean'; });

  function clone(arr) { return arr.map((o) => Object.assign({}, o)); }

  window.PhotoEditorTemplatePackV3 = { VERSION: 'v3.0', STYLE_FAMILIES, TEMPLATES };
})();
