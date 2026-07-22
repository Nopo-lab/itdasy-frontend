/* AI 잇비 — 사진/보정 결과 클릭 처리
   app-assistant.js의 큰 클릭 처리 함수에서 사진 관련 경로만 분리. */
(function () {
  'use strict';

  function _bodyContains(el) {
    const body = document.getElementById('asstBody');
    return !!(el && body && body.contains(el));
  }

  function _sheetContains(el) {
    const sheet = document.getElementById('assistantSheet');
    return !!(el && sheet && sheet.contains(el));
  }

  function _safeToast(message) {
    if (typeof window.showToast === 'function') window.showToast(message);
  }

  function _captionPrefill() {
    try {
      if (window.CaptionPrefill && typeof window.CaptionPrefill.get === 'function') {
        return window.CaptionPrefill.get() || '';
      }
    } catch (_e) {
      void _e;
    }
    return '';
  }

  function _downloadDataUrl(dataUrl) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'itdasy-' + Date.now() + '.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function _handlePendingRemove(e, deps) {
    const el = e.target.closest('[data-pending-remove]');
    if (!el || !_sheetContains(el)) return false;
    const i = parseInt(el.dataset.pendingRemove, 10);
    try { URL.revokeObjectURL(deps.pendingThumbs[i]); } catch (_e) { void _e; }
    deps.pendingFiles.splice(i, 1);
    deps.pendingThumbs.splice(i, 1);
    deps.renderPending();
    if (!deps.pendingFiles.length) document.getElementById('asstInput')?.focus();
    return true;
  }

  function _handleUploadPhotoClick(e, deps) {
    const el = e.target.closest('[data-asst-photo]');
    if (!el || !_bodyContains(el)) return false;
    const [hi, pi] = el.dataset.asstPhoto.split(':').map(n => parseInt(n, 10));
    const msg = deps.history[hi];
    const photos = (msg && Array.isArray(msg.photos) && msg.photos.length)
      ? msg.photos
      : (msg && msg.thumb ? [msg.thumb] : []);
    if (photos.length) deps.openLightbox(photos, pi || 0);
    return true;
  }

  function _handlePhotoResultClick(e, deps) {
    const el = e.target.closest('[data-asst-photo-result]');
    if (!el || !_bodyContains(el)) return false;
    const hi = parseInt(el.dataset.asstPhotoResult, 10);
    const msg = deps.history[hi];
    if (msg && msg.photo_result && msg.photo_result.dataUrl) {
      deps.openLightbox([msg.photo_result.dataUrl], 0);
    }
    return true;
  }

  function _handleIntentChip(e, deps) {
    const el = e.target.closest('[data-asst-intent-chip]');
    if (!el || !_bodyContains(el)) return false;
    if (deps.isSendInFlight()) return true;
    const [hiStr, chipId] = el.dataset.asstIntentChip.split(':');
    const hi = parseInt(hiStr, 10);
    const chipMsg = deps.history[hi];
    const userMsg = deps.history[hi - 1];
    if (!chipMsg || !Array.isArray(chipMsg.intent_chips) || !userMsg) return true;
    const chip = chipMsg.intent_chips.find(c => c.id === chipId);
    if (!chip) return true;
    const photoUrl = userMsg.thumb || (Array.isArray(userMsg.photos) ? userMsg.photos[0] : '');
    const photos = Array.isArray(userMsg.photos) ? userMsg.photos : (photoUrl ? [photoUrl] : []);
    if (!photoUrl) return true;
    // [잇비↔작업실 2026-07-21] 채팅 사진 카드의 모든 버튼 → 현재 작업실(WorkspaceFlow)의 알맞은 모드.
    //   ws_post=게시글(레이아웃-퍼스트) · ws_ba=전후 · ws_review=후기 · ws_edit=바로 보정. (구 'workspace' 칩도 흡수)
    var WS_CAT = { workspace: null, ws_post: null, ws_ba: 'ba', ws_review: 'review', ws_edit: null };
    if (Object.prototype.hasOwnProperty.call(WS_CAT, chip.id)) {
      var _cat = WS_CAT[chip.id];
      // [2026-07-22] '사진 편집'(ws_edit)은 인스타식 편집기(ItdEditor)로 — 옛 슬라이더 'edit' 화면 아님.
      var _isEdit = chip.id === 'ws_edit';
      try { if (window.ItdasySourceImage) window.ItdasySourceImage.noteChatPhoto({ dataUrl: photoUrl, messageId: 'chat-ws' }); } catch (_e) { void _e; }
      deps.history.splice(hi - 1, 2);
      deps.renderHistory();
      // photo 그룹(지연 로드) 먼저 보장 후 열기 — WorkspaceFlow 미로드 시 조용히 폴백하던 버그 방지.
      (async function () {
        try {
          if (window.AppLoader && window.AppLoader.ensure && !(window.AppLoader.loaded && window.AppLoader.loaded('photo'))) {
            await window.AppLoader.ensure('photo');
          }
        } catch (_l) { void _l; }
        if (window.WorkspaceFlow && typeof window.WorkspaceFlow.command === 'function') {
          try { if (typeof window.closeAssistant === 'function') window.closeAssistant(); } catch (_c) { void _c; }   // 잇비 시트 닫아 작업실이 위로 보이게
          window.WorkspaceFlow.command(_isEdit
            ? { type: 'storyedit', photoUrls: photos }
            : { type: 'open', photoUrls: photos, cat: _cat });
        } else if (typeof deps.runChatAutoEdit === 'function') {
          deps.runChatAutoEdit({ photoUrl: photoUrl, photos: photos, question: '사진 편집', customerCtx: null });
        }
      })();
      return true;
    }
    deps.history.splice(hi - 1, 2);
    deps.renderHistory();
    if (chip.id === 'template' && typeof deps.openTemplatePicker === 'function') {
      deps.openTemplatePicker({ photoUrl, photos, question: chip.question, customerCtx: null });
      return true;
    }
    deps.runChatAutoEdit({ photoUrl, photos, question: chip.question, customerCtx: null });
    return true;
  }

  function _handlePhotoAction(e, deps) {
    const el = e.target.closest('[data-asst-photo-act]');
    if (!el || !_bodyContains(el)) return false;
    const [hiStr, actId] = el.dataset.asstPhotoAct.split(':');
    const hi = parseInt(hiStr, 10);
    const msg = deps.history[hi];
    if (!msg || !msg.photo_result || !msg.photo_result.dataUrl) return true;
    _runPhotoAction(actId, hi, msg, deps);
    return true;
  }

  function _runPhotoAction(actId, hi, msg, deps) {
    const dataUrl = msg.photo_result.dataUrl;
    if (actId === 'instagram') _openInstagram(dataUrl, msg.photo_result.ratio || '4:5');
    else if (actId === 'editor') _openEditor(dataUrl);
    else if (actId === 'save') _savePhotoResult(dataUrl);
    else if (actId === 'retry') _retryPhotoEdit(hi, deps);
  }

  function _openInstagram(dataUrl, ratio) {
    if (typeof window.openInstagramPreview !== 'function') return;
    try {
      window.openInstagramPreview({ src: dataUrl, ratio, caption: _captionPrefill(), enableUpload: true });
    } catch (_e) {
      void _e;
    }
  }

  function _openEditor(dataUrl) {
    // [2026-07-22] 옛 PhotoEditor 대신 현재 인스타식 편집기(ItdEditor)로.
    (function () {
      var go = function () {
        try { if (typeof window.closeAssistant === 'function') window.closeAssistant(); } catch (_c) { void _c; }
        if (window.WorkspaceFlow && typeof window.WorkspaceFlow.command === 'function') {
          window.WorkspaceFlow.command({ type: 'storyedit', photoUrls: dataUrl ? [dataUrl] : null });
        } else if (window.showToast) {
          window.showToast('작업실을 여는 중이에요. 잠시 후 다시 눌러주세요');   // [2026-07-22] 옛 PhotoEditor 폴백 제거
        }
      };
      if (window.AppLoader && window.AppLoader.ensure && !(window.AppLoader.loaded && window.AppLoader.loaded('photo'))) {
        Promise.resolve(window.AppLoader.ensure('photo')).then(go, go);
      } else { go(); }
    })();
  }

  function _savePhotoResult(dataUrl) {
    try {
      _downloadDataUrl(dataUrl);
      _safeToast('저장 완료');
    } catch (_e) {
      _safeToast('저장 실패');
    }
  }

  function _retryPhotoEdit(hi, deps) {
    const userMsg = deps.history[hi - 1];
    if (!userMsg || !userMsg.thumb) return;
    const photoUrl = userMsg.thumb;
    const photos = Array.isArray(userMsg.photos) ? userMsg.photos : [photoUrl];
    const question = userMsg.text || '예쁘게 보정해줘';
    deps.history.splice(hi - 1, 2);
    deps.renderHistory();
    deps.runChatAutoEdit({ photoUrl, photos, question, customerCtx: null });
  }

  function handleClick(e, deps) {
    return _handlePendingRemove(e, deps)
      || _handleUploadPhotoClick(e, deps)
      || _handlePhotoResultClick(e, deps)
      || _handleIntentChip(e, deps)
      || _handlePhotoAction(e, deps);
  }

  window.ItdasyAssistantPhotoActions = { handleClick };
})();
