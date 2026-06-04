/* 사진 편집기 — L3 생성형 사진편집 동의
   서버 동의가 권위. 거부 시 생성 API 호출 0. */
(function () {
  'use strict';
  if (window.PhotoEditorGenerativeConsent) return;

  var LS_KEY = 'itdasy_ai_generative_consent';
  var CONSENT_TYPE = 'ai_generative_photo';

  function _authHeader() {
    try { return (typeof window.authHeader === 'function') ? window.authHeader() : {}; }
    catch (_e) { return {}; }
  }

  function uiCached() {
    try { return !!(window.localStorage && localStorage.getItem(LS_KEY) === '1'); }
    catch (_e) { return false; }
  }

  function _setCache(v) {
    try {
      if (!window.localStorage) return;
      if (v) localStorage.setItem(LS_KEY, '1');
      else localStorage.removeItem(LS_KEY);
    } catch (_e) { /* noop */ }
  }

  function record() {
    return window.apiFetch('/persona/consent', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, _authHeader()),
      body: JSON.stringify({ consent_type: CONSENT_TYPE, version: '1.0', agreed: true }),
    }).then(function (res) {
      if (res && res.ok) { _setCache(true); return true; }
      return false;
    }).catch(function () { return false; });
  }

  function showModal(onAgree, onDeny) {
    var prev = document.querySelector('[data-generative-consent]');
    if (prev) prev.remove();
    var ov = document.createElement('div');
    ov.className = 'pe-l3-consent-ov';
    ov.setAttribute('data-generative-consent', '');
    ov.innerHTML =
      '<div class="pe-l3-consent" role="dialog" aria-modal="true">' +
        '<div class="pe-l3-consent-title">생성형 홍보컷 동의</div>' +
        '<div class="pe-l3-consent-body">홍보컷 미리보기를 만들기 위해 현재 사진이 백엔드를 거쳐 처리돼요. ' +
        'Gate 2에서는 mock 결과만 만들고 원본은 저장하지 않아요.</div>' +
        '<div class="pe-l3-consent-cost">Pro 크레딧 1장 사용 예정 · mock 단계에서는 차감되지 않아요.</div>' +
        '<div class="pe-l3-consent-btns">' +
          '<button type="button" class="pe-chip-btn" data-generative-deny>취소</button>' +
          '<button type="button" class="pe-btn-primary" data-generative-agree>동의하고 만들기</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);

    function close() { if (ov && ov.parentNode) ov.parentNode.removeChild(ov); }
    ov.querySelector('[data-generative-deny]').addEventListener('click', function () {
      close(); if (onDeny) onDeny();
    });
    ov.querySelector('[data-generative-agree]').addEventListener('click', function () {
      var btn = ov.querySelector('[data-generative-agree]');
      btn.disabled = true; btn.textContent = '동의 기록 중...';
      record().then(function (ok) {
        close();
        if (ok) { if (onAgree) onAgree(); return; }
        if (window.showToast) window.showToast('동의 기록에 실패했어요. 잠시 후 다시 시도해주세요');
        if (onDeny) onDeny();
      });
    });
    ov.addEventListener('click', function (e) { if (e.target === ov) { close(); if (onDeny) onDeny(); } });
  }

  window.PhotoEditorGenerativeConsent = {
    uiCached: uiCached,
    record: record,
    showModal: showModal,
    clearCache: function () { _setCache(false); },
    CONSENT_TYPE: CONSENT_TYPE,
  };
})();

