/* 통합 인박스 채널 마크 — 인스타/카톡/네이버 톡톡 공통 글리프 (2026-06-16).
   window.ChannelMark.norm(channel) / .mark(channel[, opt]) — 실시간 DM·홈 카드 공용(중복 정의 금지).
   BE channel: 'instagram' | 'kakao' | 'naver'(talktalk 정규화). 브랜드 글리프(이모지 금지). */
(function () {
  'use strict';

  function norm(c) {
    var v = String(c || 'instagram').toLowerCase();
    if (v === 'talktalk') return 'naver';
    return (v === 'kakao' || v === 'naver') ? v : 'instagram';
  }

  // opt: { size:18, pos:'css for position' }. 기본 = 우상단 absolute 배지.
  function mark(channel, opt) {
    opt = opt || {};
    var ch = norm(channel);
    var size = opt.size || 18;
    var pos = (opt.pos != null) ? opt.pos : 'position:absolute;top:11px;right:11px;';
    var base = pos + 'width:' + size + 'px;height:' + size + 'px;border-radius:6px;display:inline-flex;'
      + 'align-items:center;justify-content:center;z-index:2;box-shadow:0 0 0 1.5px #fff;';
    if (ch === 'kakao') {
      return '<span aria-label="카톡" style="' + base + 'background:#FEE500;"><svg width="' + Math.round(size * 0.6) + '" height="' + Math.round(size * 0.6) + '" viewBox="0 0 24 24"><path d="M12 4C7 4 3 7.1 3 10.9c0 2.4 1.6 4.5 4.1 5.7-.2.6-.6 2.2-.7 2.5-.1.4.1.4.3.3.2-.1 2.2-1.5 3.1-2.1.4.05.8.08 1.2.08 5 0 9-3.1 9-6.9S17 4 12 4z" fill="#3c1e1e"/></svg></span>';
    }
    if (ch === 'naver') {
      return '<span aria-label="네이버 톡톡" style="' + base + 'background:#03C75A;color:#fff;font-size:' + Math.round(size * 0.6) + 'px;font-weight:800;line-height:1;">N</span>';
    }
    return '<span aria-label="인스타" style="' + base + 'background:#E1306C;"><svg width="' + Math.round(size * 0.55) + '" height="' + Math.round(size * 0.55) + '" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><rect x="3" y="3" width="18" height="18" rx="6"/><circle cx="12" cy="12" r="4.5"/></svg></span>';
  }

  window.ChannelMark = { norm: norm, mark: mark };
})();
