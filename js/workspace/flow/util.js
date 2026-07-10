/* workspace/flow/util.js — flow.js 순수 헬퍼 분리 (T-104 P0, 2026-07-10)
   상태(d/cur/el/navStack) 안 건드리는 무상태 함수만 모음. flow.js 는 window.WSFlowUtil 을
   로컬 별칭으로 재수입(var esc = WSU.esc …)해서 호출부는 한 글자도 안 바뀐다.
   ⚠️ 여기 함수는 flow.js 클로저 상태를 참조하면 안 됨(순수 유지). */
(function () {
  'use strict';
  function uid() { return (typeof window._uid === 'function') ? window._uid() : 'wf_' + Math.random().toString(36).slice(2); }
  function toast(m) { if (window.showToast) window.showToast(m); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fileToDataUrl(f) {
    if (typeof window._fileToDataUrl === 'function') return window._fileToDataUrl(f);
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(f); });
  }
  function _isRealShopName(n) {
    n = String(n || '').trim();
    if (n.length < 2) return false;
    if (/(뷰티샵|헤어샵|네일샵|왁싱샵|미용실|살롱|스튜디오|에스테틱|샵|점)$/.test(n)) return true;   // 명확한 상호 접미사
    if (/[가-힣]{2,}/.test(n)) return true;   // 한글 2자 이상 = 상호로 간주
    return false;   // 'Dd'·'aa' 등 라틴 짧은 placeholder → 상호 아님
  }
  function _thEsc(s) { return String(s || '').replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  function barClass(vc) {
    if (vc >= 10) return 'b3';
    if (vc >= 3) return 'b2';
    return 'b1';
  }
  function _caret(open) { return '<svg class="ed-fold__caret" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-chevron-' + (open ? 'up' : 'down') + '"/></svg>'; }
  function _purposeCat(purpose) { return { before_after: 'ba', review: 'review', event: 'event', feed: 'flex', story: 'flex' }[purpose] || 'flex'; }
  function _containBlit(ctx, srcCanvas, dw, dh) {
    var iw = srcCanvas.width, ih = srcCanvas.height; if (!iw || !ih) return;
    var s = Math.min(dw / iw, dh / ih), rw = iw * s, rh = ih * s;
    var dx = (dw - rw) / 2, dy = (dh - rh) / 2;
    ctx.drawImage(srcCanvas, 0, 0, iw, ih, dx, dy, rw, rh);
  }
  function clone(o) { return JSON.parse(JSON.stringify(o || {})); }
  function _parseHashes(text) {
    var seen = Object.create(null), out = [];
    String(text || '').split(/[\s,]+/).forEach(function (t) {
      var tag = t.trim().replace(/^#+/, ''); if (!tag) return;
      var k = tag.toLowerCase(); if (seen[k]) return; seen[k] = 1; out.push('#' + tag);
    });
    return out;
  }
  window.WSFlowUtil = {
    uid: uid, toast: toast, esc: esc, fileToDataUrl: fileToDataUrl,
    _isRealShopName: _isRealShopName, _thEsc: _thEsc, barClass: barClass, _caret: _caret,
    _purposeCat: _purposeCat, _containBlit: _containBlit, clone: clone, _parseHashes: _parseHashes
  };
})();
