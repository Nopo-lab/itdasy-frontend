/* [2026-06-26] 인스타 1:1 스레드 점프 링크 공용 헬퍼.
 *   sender_username 있으면 ig.me/m/{username}, 없으면 인스타 inbox 폴백.
 *   app-dm-autoreply.js(_igThreadLink) · app-dm-confirm-queue.js(위험 카드) 공용 1곳.
 *   중복 함수 금지 원칙 — 두 파일이 이 헬퍼에 위임한다. 두 파일보다 먼저 로드돼야 함.
 */
(function () {
  'use strict';
  window.itdasyIgThreadLink = function (c) {
    const u = ((c && c.sender_username) || '').trim();
    return u
      ? 'https://ig.me/m/' + encodeURIComponent(u)
      : 'https://www.instagram.com/direct/inbox/';
  };
})();
