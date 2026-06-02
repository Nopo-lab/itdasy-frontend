/* 사진 편집기 — 템플릿 마켓 데이터 (v326 2026-05-28 tier 정리 + BA 12종 시리즈) */
(function () {
  'use strict';

  if (window.PhotoEditorTemplateMarketData) return;

// v320-B — 초보 원장님 우선순위 6개(전후사진/피드/스토리/가격표/명함/이벤트) 먼저 노출.
//   세로 홍보(reels)는 삭제하지 않고 끝에 유지(기존 데이터 보존).
  const CATS = [
    { id: 'ba',      label: '전후사진', ratio: '4:5', size: [1080, 1350] },
    { id: 'feed',    label: '피드',    ratio: '4:5', size: [1080, 1350] },
    { id: 'story',   label: '스토리',  ratio: '9:16', size: [1080, 1920] },
    { id: 'price',   label: '가격표',  ratio: '4:5', size: [1080, 1350] },
    { id: 'card',    label: '명함',    ratio: '1:1', size: [1080, 1080] },
    { id: 'event',   label: '이벤트',  ratio: '1:1', size: [1080, 1080] },
    { id: 'reels',   label: '세로 홍보', ratio: '9:16', size: [1080, 1920] },
  ];

  // 템플릿 데이터 — 각 템플릿은 layout 함수 가짐
  // tier: 'free' = 초보 원장님 무료 노출, 'pro' = 향후 구독 사용자 노출
  const TEMPLATES = [
    // ── 피드 5 (free 3 / pro 2) ──
    { id: 'feed-showcase',   cat: 'feed',  tier: 'free', label: '시술 자랑',  prefillText: '오늘의 시술', accent: 'primary' },
    { id: 'feed-new-menu',   cat: 'feed',  tier: 'pro',  label: '신메뉴 소개', prefillText: '신메뉴 출시', accent: 'primary' },
    { id: 'feed-review',     cat: 'feed',  tier: 'free', label: '고객 후기',  prefillText: '"정말 만족해요"', accent: 'soft' },
    { id: 'feed-price',      cat: 'feed',  tier: 'pro',  label: '가격 강조',  prefillText: '특가 진행 중', accent: 'gold' },
    { id: 'feed-notice',     cat: 'feed',  tier: 'free', label: '안내사항',  prefillText: '안내 드립니다', accent: 'soft' },
    // ── 스토리 5 (free 3 / pro 2) ──
    { id: 'story-count',     cat: 'story', tier: 'pro',  label: '카운트다운', prefillText: 'D-3', accent: 'primary' },
    { id: 'story-open',      cat: 'story', tier: 'free', label: '오픈 알림',  prefillText: 'OPEN', accent: 'primary' },
    { id: 'story-attend',    cat: 'story', tier: 'free', label: '출석체크',  prefillText: 'CHECK-IN', accent: 'soft' },
    { id: 'story-qa',        cat: 'story', tier: 'free', label: 'Q&A 받기', prefillText: 'Q&A 받습니다', accent: 'soft' },
    { id: 'story-poll',      cat: 'story', tier: 'pro',  label: '투표',     prefillText: '어떤 게 좋아요?', accent: 'primary' },
    // ── 세로 홍보 5 (free 2 / pro 3) ──
    { id: 'reels-ba',        cat: 'reels', tier: 'free', label: '비포애프터', prefillText: 'BEFORE → AFTER', accent: 'gold' },
    { id: 'reels-price',     cat: 'reels', tier: 'pro',  label: '가격 공개',  prefillText: '가격 공개!', accent: 'gold' },
    { id: 'reels-newmenu',   cat: 'reels', tier: 'pro',  label: '신메뉴',    prefillText: 'NEW', accent: 'primary' },
    { id: 'reels-review',    cat: 'reels', tier: 'pro',  label: '고객 후기',  prefillText: 'REAL REVIEW', accent: 'soft' },
    { id: 'reels-process',   cat: 'reels', tier: 'free', label: '시술 과정',  prefillText: 'PROCESS', accent: 'primary' },
    // ── 이벤트 5 (free 2 / pro 3) ──
    { id: 'event-discount',  cat: 'event', tier: 'free', label: '할인',      prefillText: '50% OFF', accent: 'gold' },
    { id: 'event-member',    cat: 'event', tier: 'pro',  label: '회원가',    prefillText: 'MEMBER ONLY', accent: 'primary' },
    { id: 'event-newcomer',  cat: 'event', tier: 'pro',  label: '신규 할인',  prefillText: '신규 -30%', accent: 'gold' },
    { id: 'event-deadline',  cat: 'event', tier: 'pro',  label: '마감 임박',  prefillText: '오늘까지!', accent: 'gold' },
    { id: 'event-gift',      cat: 'event', tier: 'free', label: '무료 증정',  prefillText: '+ FREE GIFT', accent: 'soft' },
    // ── 가격표 5 (free 4 / pro 1) ──
    { id: 'price-hair',      cat: 'price', tier: 'free', label: '헤어 가격표',     prefillText: 'HAIR MENU', accent: 'soft' },
    { id: 'price-nail',      cat: 'price', tier: 'free', label: '네일 가격표',     prefillText: 'NAIL MENU', accent: 'soft' },
    { id: 'price-lash',      cat: 'price', tier: 'free', label: '속눈썹 가격표',    prefillText: 'LASH MENU', accent: 'soft' },
    { id: 'price-makeup',    cat: 'price', tier: 'free', label: '메이크업 가격표',  prefillText: 'MAKEUP', accent: 'soft' },
    { id: 'price-wax',       cat: 'price', tier: 'pro',  label: '왁싱 가격표',     prefillText: 'WAX MENU', accent: 'soft' },
    // ── Before/After 기존 13 (free 3 / pro 10) ──
    { id: 'ba-cream',        cat: 'ba', tier: 'free', label: 'B/A 크림',      prefillText: 'Before & After', accent: 'soft' },
    { id: 'ba-flower-shadow',cat: 'ba', tier: 'free', label: '꽃 그림자 전후', prefillText: 'Before & After', accent: 'soft' },
    { id: 'ba-polaroid',     cat: 'ba', tier: 'free', label: '폴라로이드 전후', prefillText: 'Before & After', accent: 'soft' },
    { id: 'ba-editorial',    cat: 'ba', tier: 'pro',  label: '에디토리얼 전후', prefillText: 'Before & After', accent: 'gold' },
    { id: 'ba-sage',         cat: 'ba', tier: 'pro',  label: 'B/A 세이지',     prefillText: 'Before & After', accent: 'soft' },
    { id: 'ba-dark',         cat: 'ba', tier: 'pro',  label: 'B/A 다크',       prefillText: 'Before & After', accent: 'gold' },
    { id: 'ba-2split-h',     cat: 'ba', tier: 'pro',  label: '2분할 피드',     prefillText: 'Before & After', accent: 'soft' },
    { id: 'ba-2split-v',     cat: 'ba', tier: 'pro',  label: '2분할 스토리',   prefillText: 'Before & After', accent: 'primary' },
    { id: 'ba-3process',     cat: 'ba', tier: 'pro',  label: '3단계 과정',     prefillText: 'Before → After', accent: 'gold' },
    { id: 'ba-4grid',        cat: 'ba', tier: 'pro',  label: '2x2 포트폴리오', prefillText: 'Portfolio', accent: 'soft' },
    { id: 'ba-price',        cat: 'ba', tier: 'pro',  label: '전후 + 가격표',  prefillText: 'Before & After', accent: 'gold' },
    { id: 'ba-event',        cat: 'ba', tier: 'pro',  label: '전후 + 이벤트',  prefillText: 'Event Before', accent: 'primary' },
    { id: 'ba-review',       cat: 'ba', tier: 'pro',  label: '전후 + 후기',    prefillText: 'Real Review', accent: 'soft' },
    // ── BA 시리즈 12종 (v326 신규, 모두 free) ─────────────────────
    //   부위별(헤어/네일/속눈썹/피부) × 스타일별(cream/polaroid/dark)
    //   렌더는 기존 _flowerShadow/_polaroid/_horizontal+dark 함수 재활용 (ba-compose.js 의 id 분기에 추가)
    // 헤어
    { id: 'ba-hair-cream',    cat: 'ba', tier: 'free', label: '헤어 전후 (크림)', prefillText: 'Hair Transformation', accent: 'soft' },
    { id: 'ba-hair-polaroid', cat: 'ba', tier: 'free', label: '헤어 전후 (폴라)', prefillText: 'Hair Before & After', accent: 'soft' },
    { id: 'ba-hair-dark',     cat: 'ba', tier: 'free', label: '헤어 전후 (다크)', prefillText: 'Hair Style Change', accent: 'gold' },
    // 네일
    { id: 'ba-nail-cream',    cat: 'ba', tier: 'free', label: '네일 전후 (크림)', prefillText: 'Nail Before & After', accent: 'soft' },
    { id: 'ba-nail-polaroid', cat: 'ba', tier: 'free', label: '네일 전후 (폴라)', prefillText: 'Fresh Nail Look', accent: 'soft' },
    { id: 'ba-nail-dark',     cat: 'ba', tier: 'free', label: '네일 전후 (다크)', prefillText: 'Nail Art Detail', accent: 'gold' },
    // 속눈썹
    { id: 'ba-lash-cream',    cat: 'ba', tier: 'free', label: '속눈썹 전후 (크림)', prefillText: 'Lash Before & After', accent: 'soft' },
    { id: 'ba-lash-polaroid', cat: 'ba', tier: 'free', label: '속눈썹 전후 (폴라)', prefillText: 'New Lash Look', accent: 'soft' },
    { id: 'ba-lash-dark',     cat: 'ba', tier: 'free', label: '속눈썹 전후 (다크)', prefillText: 'Lash Volume Detail', accent: 'gold' },
    // 피부
    { id: 'ba-skin-cream',    cat: 'ba', tier: 'free', label: '피부 전후 (크림)', prefillText: 'Skin Care Result', accent: 'soft' },
    { id: 'ba-skin-polaroid', cat: 'ba', tier: 'free', label: '피부 전후 (폴라)', prefillText: 'Clear Skin Glow', accent: 'soft' },
    { id: 'ba-skin-dark',     cat: 'ba', tier: 'free', label: '피부 전후 (다크)', prefillText: 'Skin Texture Detail', accent: 'gold' },
    // ── 명함 5 (free 2 / pro 3) ──
    { id: 'card-minimal',    cat: 'card',  tier: 'free', label: '미니멀',   prefillText: '샵 안내', accent: 'soft' },
    { id: 'card-gold',       cat: 'card',  tier: 'pro',  label: '골드',     prefillText: 'OUR SHOP', accent: 'gold' },
    { id: 'card-pink',       cat: 'card',  tier: 'pro',  label: '핑크',     prefillText: 'WELCOME', accent: 'primary' },
    { id: 'card-dark',       cat: 'card',  tier: 'pro',  label: '다크',     prefillText: 'STUDIO', accent: 'soft' },
    { id: 'card-nature',     cat: 'card',  tier: 'free', label: '내추럴',   prefillText: 'STUDIO', accent: 'soft' },
  ];

  // [TPL-2] 업종/용도 태그 — id·cat·label 키워드로 자동 도출(55종 수동태깅 대신 견고).
  //   industry: nail/hair/lash/brow/skin/makeup/common · purpose: before_after/review/price/event/retouch/booking/story/reel_cover/portfolio/feed/promo
  const INDUSTRY_LABEL = { nail: '네일', hair: '헤어', lash: '속눈썹', brow: '눈썹', skin: '피부', makeup: '메이크업', common: '공통' };
  const PURPOSE_LABEL = {
    before_after: '전후', review: '후기', price: '가격표', event: '이벤트', retouch: '리터치',
    booking: '예약', story: '스토리', reel_cover: '릴스', portfolio: '포트폴리오', feed: '피드', promo: '홍보',
  };
  function industryOf(t) {
    const s = (t.id + ' ' + (t.label || '') + ' ' + (t.prefillText || ''));
    if (/nail|네일|손톱|젤/.test(s)) return 'nail';
    if (/hair|헤어|머리|염색|펌|컷/.test(s)) return 'hair';
    if (/lash|eyelash|속눈썹|연장/.test(s)) return 'lash';
    if (/brow|눈썹/.test(s)) return 'brow';
    if (/skin|facial|피부|결|wax|왁싱/.test(s)) return 'skin';
    if (/makeup|메이크업|화장/.test(s)) return 'makeup';
    return 'common';
  }
  function purposeOf(t) {
    const id = t.id, cat = t.cat, s = (id + ' ' + (t.label || '') + ' ' + (t.prefillText || ''));
    if (/^ba-|before|after|전후|compare|2split|3process|4grid/.test(id)) return 'before_after';
    if (/review|후기|testimonial/.test(s)) return 'review';
    if (/price|가격|menu|메뉴/.test(s)) return 'price';
    if (/event|이벤트|sale|할인|discount|gift|증정|deadline|마감|member|회원|newcomer|신규/.test(s)) return 'event';
    if (/retouch|리터치|revisit|rebook|재방문/.test(s)) return 'retouch';
    if (cat === 'card' || /명함|booking|예약|attend|출석|qa|q&a/.test(s)) return 'booking';
    if (cat === 'story') return 'story';
    if (cat === 'reels') return 'reel_cover';
    if (/portfolio|포트폴리오|showcase|자랑/.test(s)) return 'portfolio';
    if (cat === 'feed') return 'feed';
    return 'promo';
  }
  // 모든 템플릿에 industry/purpose 주입(1회).
  TEMPLATES.forEach((t) => { if (!t.industry) t.industry = industryOf(t); if (!t.purpose) t.purpose = purposeOf(t); });

  // 추천 상황 문구(큰 미리보기용).
  function recommendText(t) {
    const ind = INDUSTRY_LABEL[t.industry] || '공통';
    const pur = PURPOSE_LABEL[t.purpose] || '홍보';
    const indPart = t.industry === 'common' ? '' : (ind + ' ');
    return indPart + pur + '에 추천';
  }

  // [TPL-4] Pro 가치문구 — "왜 Pro인지" 1줄. id 구조/카테고리/용도 기반 자동(수동 0).
  //   단순 색변경이 아니라 구조적 고급(다분할/정보내장/타이포)을 강조.
  function proValueText(t) {
    const id = t.id;
    if (/2split|3process|4grid|grid/.test(id)) return '다분할 고급 레이아웃';
    if (/editorial|dark|sage|gold/.test(id)) return '브랜드 무드 고급 디자인';
    if (t.purpose === 'price' || /price|가격/.test(id)) return '가격·메뉴 정보 포함 구성';
    if (t.purpose === 'review') return '후기 강조 레이아웃';
    if (t.purpose === 'event') return '이벤트 홍보 최적화 구성';
    if (t.purpose === 'retouch' || t.purpose === 'booking') return '예약·리터치 안내 구성';
    if (t.cat === 'story' || t.cat === 'reels') return '세로 스토리 홍보 최적화';
    if (t.cat === 'feed') return '피드용 고급 타이포';
    return '브랜드형 고급 홍보 디자인';
  }

  window.PhotoEditorTemplateMarketData = { CATS, TEMPLATES, INDUSTRY_LABEL, PURPOSE_LABEL, industryOf, purposeOf, recommendText, proValueText };
})();
