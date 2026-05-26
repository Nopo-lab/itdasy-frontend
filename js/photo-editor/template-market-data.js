/* 사진 편집기 — 템플릿 마켓 데이터 */
(function () {
  'use strict';

  if (window.PhotoEditorTemplateMarketData) return;

const CATS = [
    { id: 'feed',    label: '피드',    ratio: '4:5', size: [1080, 1350] },
    { id: 'story',   label: '스토리',  ratio: '9:16', size: [1080, 1920] },
    { id: 'reels',   label: '세로 홍보', ratio: '9:16', size: [1080, 1920] },
    { id: 'event',   label: '이벤트',  ratio: '1:1', size: [1080, 1080] },
    { id: 'price',   label: '가격표',  ratio: '4:5', size: [1080, 1350] },
    { id: 'card',    label: '명함',    ratio: '1:1', size: [1080, 1080] },
  ];

  // 30종 템플릿 데이터 — 각 템플릿은 layout 함수 가짐
  const TEMPLATES = [
    // ── 피드 5 ──
    { id: 'feed-showcase',   cat: 'feed',  label: '시술 자랑',  prefillText: '오늘의 시술', accent: 'primary' },
    { id: 'feed-new-menu',   cat: 'feed',  label: '신메뉴 소개', prefillText: '신메뉴 출시', accent: 'primary' },
    { id: 'feed-review',     cat: 'feed',  label: '고객 후기',  prefillText: '"정말 만족해요"', accent: 'soft' },
    { id: 'feed-price',      cat: 'feed',  label: '가격 강조',  prefillText: '특가 진행 중', accent: 'gold' },
    { id: 'feed-notice',     cat: 'feed',  label: '안내사항',  prefillText: '안내 드립니다', accent: 'soft' },
    // ── 스토리 5 ──
    { id: 'story-count',     cat: 'story', label: '카운트다운', prefillText: 'D-3', accent: 'primary' },
    { id: 'story-open',      cat: 'story', label: '오픈 알림',  prefillText: 'OPEN', accent: 'primary' },
    { id: 'story-attend',    cat: 'story', label: '출석체크',  prefillText: 'CHECK-IN', accent: 'soft' },
    { id: 'story-qa',        cat: 'story', label: 'Q&A 받기', prefillText: 'Q&A 받습니다', accent: 'soft' },
    { id: 'story-poll',      cat: 'story', label: '투표',     prefillText: '어떤 게 좋아요?', accent: 'primary' },
    // ── 세로 홍보 5 ──
    { id: 'reels-ba',        cat: 'reels', label: '비포애프터', prefillText: 'BEFORE → AFTER', accent: 'gold' },
    { id: 'reels-price',     cat: 'reels', label: '가격 공개',  prefillText: '가격 공개!', accent: 'gold' },
    { id: 'reels-newmenu',   cat: 'reels', label: '신메뉴',    prefillText: 'NEW', accent: 'primary' },
    { id: 'reels-review',    cat: 'reels', label: '고객 후기',  prefillText: 'REAL REVIEW', accent: 'soft' },
    { id: 'reels-process',   cat: 'reels', label: '시술 과정',  prefillText: 'PROCESS', accent: 'primary' },
    // ── 이벤트 5 ──
    { id: 'event-discount',  cat: 'event', label: '할인',      prefillText: '50% OFF', accent: 'gold' },
    { id: 'event-member',    cat: 'event', label: '회원가',    prefillText: 'MEMBER ONLY', accent: 'primary' },
    { id: 'event-newcomer',  cat: 'event', label: '신규 할인',  prefillText: '신규 -30%', accent: 'gold' },
    { id: 'event-deadline',  cat: 'event', label: '마감 임박',  prefillText: '오늘까지!', accent: 'gold' },
    { id: 'event-gift',      cat: 'event', label: '무료 증정',  prefillText: '+ FREE GIFT', accent: 'soft' },
    // ── 가격표 5 ──
    { id: 'price-hair',      cat: 'price', label: '헤어 가격표',     prefillText: 'HAIR MENU', accent: 'soft' },
    { id: 'price-nail',      cat: 'price', label: '네일 가격표',     prefillText: 'NAIL MENU', accent: 'soft' },
    { id: 'price-lash',      cat: 'price', label: '속눈썹 가격표',    prefillText: 'LASH MENU', accent: 'soft' },
    { id: 'price-makeup',    cat: 'price', label: '메이크업 가격표',  prefillText: 'MAKEUP', accent: 'soft' },
    { id: 'price-wax',       cat: 'price', label: '왁싱 가격표',     prefillText: 'WAX MENU', accent: 'soft' },
    // ── Before/After 프리미엄 3 ──
    { id: 'ba-cream',   cat: 'feed', label: 'B/A 크림',   prefillText: 'Before & After', accent: 'soft' },
    { id: 'ba-sage',    cat: 'feed', label: 'B/A 세이지',  prefillText: 'Before & After', accent: 'soft' },
    { id: 'ba-dark',    cat: 'feed', label: 'B/A 다크',    prefillText: 'Before & After', accent: 'gold' },
    // ── 명함 5 ──
    { id: 'card-minimal',    cat: 'card',  label: '미니멀',   prefillText: '샵 안내', accent: 'soft' },
    { id: 'card-gold',       cat: 'card',  label: '골드',     prefillText: 'OUR SHOP', accent: 'gold' },
    { id: 'card-pink',       cat: 'card',  label: '핑크',     prefillText: 'WELCOME', accent: 'primary' },
    { id: 'card-dark',       cat: 'card',  label: '다크',     prefillText: 'STUDIO', accent: 'soft' },
    { id: 'card-nature',     cat: 'card',  label: '내추럴',   prefillText: 'STUDIO', accent: 'soft' },
  ];

  window.PhotoEditorTemplateMarketData = { CATS, TEMPLATES };
})();
