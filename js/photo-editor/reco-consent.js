/* 사진 편집기 — PE-AI-1B Vision 동의
   서버 동의가 권위(POST /persona/consent, consent_type="ai_vision_photo").
   localStorage 는 모달 반복 방지용 UI 캐시일 뿐 — 서버 동의 없는 analyze 호출은 백엔드가 403 으로 막음.
   동의 전 analyze 호출 0. 거부 시 AI-1A 유지. */
(function () {
  'use strict';
  if (window.PhotoEditorRecoConsent) return;

  var LS_KEY = 'itdasy_ai_vision_consent';   // UI 캐시(보조)
  var CONSENT_TYPE = 'ai_vision_photo';

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
      if (window.localStorage) {
        if (v) localStorage.setItem(LS_KEY, '1'); else localStorage.removeItem(LS_KEY);
      }
    } catch (_e) { /* noop */ }
  }

  // 서버에 동의 기록. 성공 시 UI 캐시 set. (서버가 권위)
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

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]);
    });
  }

  // 동의 모달. onAgree() = 서버 기록 성공 후. onDeny() = 거부/실패.
  function showModal(onAgree, onDeny) {
    var prev = document.querySelector('[data-reco-consent]');
    if (prev) prev.remove();
    var ov = document.createElement('div');
    ov.className = 'pe-reco-consent-ov';
    ov.setAttribute('data-reco-consent', '');
    ov.innerHTML =
      '<div class="pe-reco-consent" role="dialog" aria-modal="true">' +
        '<div class="pe-reco-consent-title">AI 정밀 추천 동의</div>' +
        '<div class="pe-reco-consent-body">AI 정밀 추천을 위해 이 사진이 Google Vertex AI로 전송·분석될 수 있어요. ' +
        '원본은 저장하지 않고, 분석 결과만 잠시 보관해요.</div>' +
        '<div class="pe-reco-consent-btns">' +
          '<button type="button" class="pe-chip-btn" data-reco-consent-deny>기본 추천만</button>' +
          '<button type="button" class="pe-btn-primary" data-reco-consent-agree>동의하고 분석</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);

    function close() { if (ov && ov.parentNode) ov.parentNode.removeChild(ov); }
    ov.querySelector('[data-reco-consent-deny]').addEventListener('click', function () {
      close(); if (onDeny) onDeny();
    });
    ov.querySelector('[data-reco-consent-agree]').addEventListener('click', function () {
      var btn = ov.querySelector('[data-reco-consent-agree]');
      btn.disabled = true; btn.textContent = '기록 중…';
      record().then(function (ok) {
        close();
        if (ok) { if (onAgree) onAgree(); }
        else { if (window.showToast) window.showToast('동의 기록에 실패했어요. 잠시 후 다시 시도해주세요'); if (onDeny) onDeny(); }
      });
    });
    ov.addEventListener('click', function (e) { if (e.target === ov) { close(); if (onDeny) onDeny(); } });
  }

  window.PhotoEditorRecoConsent = {
    uiCached: uiCached, record: record, showModal: showModal,
    clearCache: function () { _setCache(false); }, CONSENT_TYPE: CONSENT_TYPE,
  };
})();
