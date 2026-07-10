/* workspace/flow/publish-progress.js — 인스타 발행 진행 오버레이 분리 (T-104 P3, 2026-07-10)
   "올리는 중… → 글 입히는 중… → 게시 완료!" 3단계 오버레이 애니메이션. el(루트)만 참조, d 상태 안 씀.
   window.WSFlowPubProgress.create(ctx={el}) → { _pubShow, _pubHide, _pubFinish }. flow.js 가 별칭 재수입. */
(function () {
  'use strict';
  function create(ctx) {
    function EL() { return ctx.el(); }
    var PUB_MSG = [
      ['올리는 중…', '사진을 인스타로 보내고 있어요'],
      ['글 입히는 중…', '게시글·해시태그를 붙이는 중'],
      ['게시 완료!', '인스타그램에 올라갔어요']
    ];
    var _pubTimer = null;
    function _pubQ(sel) { var e = EL(); return e ? e.querySelector(sel) : null; }
    function _pubStage(i) {
      var t = _pubQ('[data-fl-pub-t]'), s = _pubQ('[data-fl-pub-s]');
      if (t) t.textContent = PUB_MSG[i][0];
      if (s) s.textContent = PUB_MSG[i][1];
      var e = EL();
      var steps = e ? e.querySelectorAll('[data-fl-pub-steps] i') : null;
      if (steps && steps.length) Array.prototype.forEach.call(steps, function (n, j) { n.className = j < i ? 'done' : (j === i ? 'on' : ''); });
      var card = _pubQ('.wsv2pub__card'); if (card) card.classList.toggle('is-done', i >= 2);
    }
    function _pubShow() {
      var p = _pubQ('[data-fl-pub]'); if (!p) return;
      p.hidden = false; p.classList.add('is-open'); _pubStage(0);
      if (_pubTimer) clearTimeout(_pubTimer);
      _pubTimer = setTimeout(function () { _pubStage(1); }, 1100);
    }
    function _pubHide() {
      if (_pubTimer) { clearTimeout(_pubTimer); _pubTimer = null; }
      var p = _pubQ('[data-fl-pub]'); if (p) { p.hidden = true; p.classList.remove('is-open'); }
    }
    function _pubFinish(cb) {
      if (_pubTimer) { clearTimeout(_pubTimer); _pubTimer = null; }
      _pubStage(1);
      setTimeout(function () { _pubStage(2); setTimeout(function () { _pubHide(); if (cb) cb(); }, 1200); }, 350);
    }
    return { _pubShow: _pubShow, _pubHide: _pubHide, _pubFinish: _pubFinish };
  }
  window.WSFlowPubProgress = { create: create };
})();
