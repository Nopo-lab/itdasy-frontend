/* 잇비 SourceImage — "잇비가 지금 어떤 사진에 대해 작업하는지"를 한 곳에서 결정 (P0a · 2026-06-06)

   문제: 사진 입력 경로가 2개(작업실 active photo / 챗봇 직접 업로드)인데 공유 컨텍스트가 없어
        잇비/템플릿/인스타/업로드 버튼이 source image 를 못 잡고 무반응처럼 보였다.

   해결: 두 경로가 같은 store 에 사진을 기록하고, resolve() 가 우선순위로 하나를 돌려준다.

   우선순위(스펙): 1) 채팅에 새로 업로드한 사진(≤5분)  2) 작업실 active photo  3) 편집기 현재 사진  4) 없음.
     단 "오래된 채팅 사진이 방금 들어간 작업실을 가리는" 문제 방지로 ts 비교를 둔다
     (방금 업로드한 채팅 > 오래된 작업실, 방금 들어간 작업실 > 오래된 채팅).

   설계 원칙: 전부 try/catch + 가드 — 실패해도 null 반환(하위호환). 자동 저장/게시/발송 0.
*/
(function () {
  'use strict';

  if (window.ItdasySourceImage) return;

  var CHAT_TTL_MS = 5 * 60 * 1000;   // 채팅 업로드 사진 신선도 한도
  var PRIO = { chat: 0, workshop: 1, editor: 2 };

  var _workshop = null;   // { origin:'workshop', dataUrl, originalUrl, editedDataUrl, slotId, photoId, customerId, ts }
  var _chat = null;       // { origin:'chat', dataUrl, messageId, customerId, ts }

  function _now() { try { return Date.now(); } catch (_e) { return 0; } }

  // 작업실 active photo 기록 — slot-editor 가 active 바뀔 때마다 호출.
  function setWorkshop(o) {
    try {
      o = o || {};
      if (!o.dataUrl) { return; }
      _workshop = {
        origin: 'workshop',
        dataUrl: o.dataUrl,
        originalUrl: o.originalUrl || o.dataUrl,
        editedDataUrl: o.editedDataUrl || null,
        slotId: o.slotId != null ? o.slotId : null,
        photoId: o.photoId != null ? o.photoId : null,
        customerId: o.customerId != null ? o.customerId : null,
        ts: _now(),
      };
    } catch (_e) { void _e; }
  }
  function clearWorkshop() { _workshop = null; }

  // 채팅 직접 업로드 사진 기록 — _uploadPhotos 에서 사진 dataUrl 생긴 직후 호출.
  function noteChatPhoto(o) {
    try {
      o = o || {};
      if (!o.dataUrl) { return; }
      _chat = {
        origin: 'chat',
        dataUrl: o.dataUrl,
        originalUrl: o.dataUrl,
        editedDataUrl: null,
        messageId: o.messageId != null ? o.messageId : null,
        customerId: o.customerId != null ? o.customerId : null,
        ts: _now(),
      };
    } catch (_e) { void _e; }
  }
  function clearChat() { _chat = null; }

  // 편집기가 화면에 떠있고 사진이 로드돼 있으면 그 사진을 마지막 후보로.
  function _editorSource() {
    try {
      var sheet = document.getElementById('photoEditorSheet');
      if (!sheet || sheet.style.display === 'none') return null;
      var pe = window.PhotoEditor && window.PhotoEditor._internal;
      var st = (pe && typeof pe.getState === 'function') ? pe.getState() : null;
      if (!st || !st.originalImg || !st.originalSrc) return null;
      return {
        origin: 'editor',
        dataUrl: st.originalSrc,
        originalUrl: st.originalSrc,
        editedDataUrl: null,
        customerId: st.customerId || null,
        ts: 0,   // 편집기는 최후순위 — 다른 후보 없을 때만.
      };
    } catch (_e) { return null; }
  }

  // 현재 잇비 처리 대상 사진을 우선순위로 결정. 없으면 null.
  function resolve() {
    try {
      var now = _now();
      var chatFresh = !!(_chat && _chat.dataUrl && (now - _chat.ts) <= CHAT_TTL_MS);
      var hasWs = !!(_workshop && _workshop.dataUrl);
      if (chatFresh && (!hasWs || _chat.ts >= _workshop.ts)) return _enrich(_chat);
      if (hasWs) return _enrich(_workshop);
      if (chatFresh) return _enrich(_chat);
      var ed = _editorSource();
      if (ed) return _enrich(ed);
      return null;
    } catch (_e) { return null; }
  }

  // 필드 채워서 복사본 반환(호출측이 requestedAction 등 덧붙일 수 있게).
  function _enrich(src) {
    return {
      origin: src.origin,
      dataUrl: src.dataUrl,
      originalUrl: src.originalUrl || src.dataUrl,
      editedDataUrl: src.editedDataUrl || null,
      slotId: src.slotId != null ? src.slotId : null,
      photoId: src.photoId != null ? src.photoId : null,
      messageId: src.messageId != null ? src.messageId : null,
      customerId: src.customerId != null ? src.customerId : null,
      inferredServiceType: src.inferredServiceType || null,
      requestedAction: src.requestedAction || null,
      ts: src.ts || 0,
    };
  }

  // resolve() + null 이면 조용히 실패하지 말고 안내 토스트.
  function resolveOrNotify(requestedAction) {
    var src = resolve();
    if (src) { if (requestedAction) src.requestedAction = requestedAction; return src; }
    try { if (window.showToast) window.showToast('사진을 먼저 선택하거나 업로드해 주세요'); } catch (_e) { void _e; }
    return null;
  }

  window.ItdasySourceImage = {
    setWorkshop: setWorkshop,
    clearWorkshop: clearWorkshop,
    noteChatPhoto: noteChatPhoto,
    clearChat: clearChat,
    resolve: resolve,
    resolveOrNotify: resolveOrNotify,
  };
})();
