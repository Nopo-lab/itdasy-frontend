/* work-memory-consent-ui.js — 작업 기억 저장 동의 카드.
   저장 정책과 화면 코드를 분리해 work-memory.js가 다시 커지지 않게 한다. */
(function () {
  'use strict';
  if (window.WorkMemoryConsentUI) return;

  var pending = null;
  function close(el) {
    pending = null;
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
  function save(el) {
    var p = pending; close(el);
    var WM = window.WorkMemory;
    var rec = p && WM && WM.captureFromSlot
      ? WM.captureFromSlot(p.slot, p.data, { consent: true }) : null;
    if (!rec) return;
    var policy = window.WorkMemoryPolicy;
    if (policy && !policy.isLegacy(rec)) showAutoChoice(rec);
    else if (WM.showCaptureCard) WM.showCaptureCard(rec);
  }
  function finishAuto(el, rec, on) {
    var WM = window.WorkMemory; close(el);
    if (on && WM) {
      if (WM.allowAuto) WM.allowAuto(rec.id, true);
      if (WM.setAutoOn) WM.setAutoOn(true);
    }
    if (WM && WM.showCaptureCard) WM.showCaptureCard(WM.get(rec.id) || rec);
  }
  function showAutoChoice(rec) {
    var el = document.createElement('div'); el.id = 'wmAutoChoiceCard'; el.className = 'wm-cap wm-cap--consent';
    el.innerHTML = '<div class="wm-cap__c"><div class="wm-cap__k">다음 ' + rec.industry + ' 사진에 자동으로 적용할까요?</div>' +
      '<div class="wm-cap__m">같은 목적의 사진에서만 적용해요.</div></div>' +
      '<button type="button" class="wm-cap__once">추천만 보기</button>' +
      '<button type="button" class="wm-cap__save">자동 적용 켜기</button>';
    el.querySelector('.wm-cap__once').addEventListener('click', function () { finishAuto(el, rec, false); });
    el.querySelector('.wm-cap__save').addEventListener('click', function () { finishAuto(el, rec, true); });
    document.body.appendChild(el); void el.offsetWidth; el.classList.add('is-on');
  }
  function show(slot, data) {
    try {
      var old = document.getElementById('wmConsentCard');
      if (old && old.parentNode) old.parentNode.removeChild(old);
      var el = document.createElement('div'); el.id = 'wmConsentCard'; el.className = 'wm-cap wm-cap--consent';
      el.innerHTML = '<div class="wm-cap__c"><div class="wm-cap__k">이번 스타일을 기억할까요?</div>' +
        '<div class="wm-cap__m">다음에 비슷한 업종·목적의 사진에 추천해드려요.</div></div>' +
        '<button type="button" class="wm-cap__once">이번만</button>' +
        '<button type="button" class="wm-cap__save">기억하기</button>';
      pending = { slot: slot, data: data };
      el.querySelector('.wm-cap__once').addEventListener('click', function () { close(el); });
      el.querySelector('.wm-cap__save').addEventListener('click', function () { save(el); });
      document.body.appendChild(el); void el.offsetWidth; el.classList.add('is-on');
      return true;
    } catch (_e) { console.warn('[work-memory] 동의 카드 표시 실패', _e); return false; }
  }

  window.WorkMemoryConsentUI = { show: show };
}());
