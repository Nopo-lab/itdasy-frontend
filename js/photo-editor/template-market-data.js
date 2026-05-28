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

  window.PhotoEditorTemplateMarketData = { CATS, TEMPLATES };
})();
