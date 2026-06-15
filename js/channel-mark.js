/* 통합 인박스 채널 마크 — 인스타/카톡/네이버 톡톡 공통 브랜드 글리프 (2026-06-16).
   window.ChannelMark.norm(channel) / .mark(channel[, opt]) — 실시간 DM·홈 카드·설정·연동화면 공용(중복 정의 금지).
   정품 브랜드 마크(이모지·타이핑 글자 금지): 네이버=공식 로고타입 N, 인스타=카메라, 카카오=말풍선.
   BE channel: 'instagram' | 'kakao' | 'naver'(talktalk 정규화).
   opt: { size:18, pos:'css', ring:true(흰 테두리), radius:px } */
(function () {
  'use strict';

  function norm(c) {
    var v = String(c || 'instagram').toLowerCase();
    if (v === 'talktalk') return 'naver';
    return (v === 'kakao' || v === 'naver') ? v : 'instagram';
  }

  function mark(channel, opt) {
    opt = opt || {};
    var ch = norm(channel);
    var size = opt.size || 18;
    var radius = (opt.radius != null) ? opt.radius : Math.max(4, Math.round(size * 0.28));
    var pos = (opt.pos != null) ? opt.pos : 'position:absolute;top:11px;right:11px;';
    var ring = (opt.ring === false) ? '' : 'box-shadow:0 0 0 1.5px #fff;';
    var box = pos + 'width:' + size + 'px;height:' + size + 'px;border-radius:' + radius
      + 'px;display:inline-flex;align-items:center;justify-content:center;flex:none;z-index:2;' + ring;

    if (ch === 'kakao') {
      var k = Math.round(size * 0.66);
      return '<span aria-label="카카오톡" style="' + box + 'background:#FEE500;">'
        + '<svg width="' + k + '" height="' + k + '" viewBox="0 0 24 24" fill="#3C1E1E" aria-hidden="true">'
        + '<path d="M12 4.6C7 4.6 3 7.7 3 11.5c0 2.4 1.6 4.6 4.1 5.8-.18.65-.66 2.4-.76 2.78-.12.47.17.46.36.34.15-.1 2.36-1.6 3.32-2.25.65.09 1.31.13 1.98.13 5 0 9-3.1 9-6.9S17 4.6 12 4.6z"/></svg></span>';
    }
    if (ch === 'naver') {
      // 네이버 공식 로고타입 N (그린 사각형 + 흰 N). path = Naver brand logogram.
      var n = Math.round(size * 0.5);
      return '<span aria-label="네이버 톡톡" style="' + box + 'background:#03C75A;">'
        + '<svg width="' + n + '" height="' + n + '" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">'
        + '<path d="M16.273 12.845 7.376 0H0v24h7.726V11.155L16.624 24H24V0h-7.727z"/></svg></span>';
    }
    // instagram — 카메라(라운드 사각 + 렌즈 + 우상단 점)
    var i = Math.round(size * 0.62);
    return '<span aria-label="인스타그램" style="' + box + 'background:#E1306C;">'
      + '<svg width="' + i + '" height="' + i + '" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" aria-hidden="true">'
      + '<rect x="3" y="3" width="18" height="18" rx="5.4"/><circle cx="12" cy="12" r="4"/>'
      + '<circle cx="17.2" cy="6.8" r="1.15" fill="#fff" stroke="none"/></svg></span>';
  }

  window.ChannelMark = { norm: norm, mark: mark };
})();
