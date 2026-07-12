/* harmony-presets.js — '색·폰트 어울림 조합' 추천 (새 큐레이션, 옛 템플릿 데이터 미사용)
   [P2-3] window.WSHarmony: 한 번 탭하면 우리샵 스타일의 제목/본문 폰트 + 글자색을 어울리게 일괄 적용.
   폰트 key 는 itd-editor FONTS 와 동일(songmyung/dodum/jua/gothica1/pretendard/dohyeon/pen/black).
   필드: key·label·titleFont·bodyFont·color(제목/본문 글자색)·sub(부제/본문 보조색, 없으면 color)·sw(스와치 미리보기 색). */
(function () {
  'use strict';
  if (window.WSHarmony) return;
  window.WSHarmony = [
    // ── 웜 크림/로즈 계열(기존) ──
    { key: 'cream',   label: '크림 에디토리얼', titleFont: 'songmyung', bodyFont: 'dodum',      color: '#3A2A22', sub: '#7A6E78', sw: ['#FBF7F5', '#3A2A22', '#BC6675'] },
    { key: 'rose',    label: '로즈 화이트',     titleFont: 'jua',       bodyFont: 'dodum',      color: '#FFFFFF', sub: '#FBEFEF', sw: ['#BC6675', '#FFFFFF', '#E08A6E'] },
    { key: 'mono',    label: '모던 모노',       titleFont: 'gothica1',  bodyFont: 'pretendard', color: '#15181D', sub: '#5A5560', sw: ['#FFFFFF', '#15181D', '#9DB7C9'] },
    { key: 'soft',    label: '소프트 핑크',     titleFont: 'dohyeon',   bodyFont: 'dodum',      color: '#BC6675', sub: '#B98AA0', sw: ['#FBF7F5', '#BC6675', '#E6C9D2'] },
    { key: 'classic', label: '클래식 명조',     titleFont: 'songmyung', bodyFont: 'songmyung',  color: '#2C2226', sub: '#7A6E78', sw: ['#F4E9E4', '#2C2226', '#C9A06A'] },
    { key: 'hand',    label: '손글씨 감성',     titleFont: 'pen',       bodyFont: 'dodum',      color: '#3A2A22', sub: '#8A7E78', sw: ['#FFFFFF', '#3A2A22', '#E8839A'] },
    // ── 확장(다양성 팩, 2026-07-12) — 피부과·Y2K네일 등이 같은 핑크 쓰던 문제 해소 ──
    { key: 'clinic',    label: '클리닉 블루',   titleFont: 'gothica1',  bodyFont: 'pretendard', color: '#12324A', sub: '#5A7A92', sw: ['#EAF2F8', '#12324A', '#4A90C9'] },
    { key: 'noir',      label: '누아르 골드',   titleFont: 'black',     bodyFont: 'gothica1',   color: '#C9A06A', sub: '#B9A88F', sw: ['#15181D', '#C9A06A', '#8A7A5A'] },
    { key: 'y2k',       label: 'Y2K 라일락',    titleFont: 'jua',       bodyFont: 'dodum',      color: '#8A5FC0', sub: '#8FB43A', sw: ['#EDE4F7', '#8A5FC0', '#B4E33D'] },
    { key: 'botanical', label: '보태니컬 세이지', titleFont: 'songmyung', bodyFont: 'dodum',    color: '#40513B', sub: '#7E9478', sw: ['#F2EFE6', '#40513B', '#8DA88F'] },
    { key: 'bold',      label: '볼드 블랙레드', titleFont: 'black',     bodyFont: 'pretendard', color: '#15181D', sub: '#D0342C', sw: ['#FFFFFF', '#15181D', '#E23B34'] },
    { key: 'spring',    label: '봄 로즈핑크',   titleFont: 'jua',       bodyFont: 'dodum',      color: '#D46A8C', sub: '#7FA84E', sw: ['#FDF0F4', '#D46A8C', '#A8D66E'] },
    { key: 'winter',    label: '겨울 딥네이비', titleFont: 'songmyung', bodyFont: 'pretendard', color: '#1E2A44', sub: '#7C879E', sw: ['#EEF1F6', '#1E2A44', '#9DA9C0'] }
  ];
})();
