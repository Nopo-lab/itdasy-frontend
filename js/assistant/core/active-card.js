/* 잇비 활성 카드(activeCard) — 멀티턴 문맥 포인터 (2026-06-12)

   문제(P0): "가격표 만들어줘"로 카드를 만든 직후 "그거 저장/수정/다시 보여줘" 하면,
     직전 산출물을 가리키는 포인터가 없어서 saved-cards 조회(loadSlotsFromDB)로 빠지고,
     저장 전이라 DB가 비어 "저장된 카드가 없어요"라는 거짓 안내가 나갔다.
   해결: "방금 생성했거나 편집 중인 카드"를 인메모리로 기억한다(새로고침 전까지 유지).
     - 저장된 카드보다 activeCard 우선. activeCard 없을 때만 저장카드 탐색.
     - 생성 시 set, 작업실 슬롯 선택 시 set, 저장 시 slotId 연결.
     - 저장 전에도 존재(slotId=null). 저장되면 slotId 로 저장카드와 연결.

   외부: window.ItbiActiveCard = { set, get, clear, linkSlot, has, classifyRef } */
(function () {
  'use strict';
  if (window.ItbiActiveCard) return;

  var _active = null;   // 인메모리 — 새로고침하면 사라짐(의도: "새로고침 전까지 유지")

  // card: { purpose, label, templateId?, slotId?(null=미저장), available?(false=event 등 미생성), origin }
  function set(card) {
    if (!card) return;
    _active = {
      purpose: card.purpose || 'generic',
      label: card.label || '카드',
      templateId: card.templateId || null,
      slotId: card.slotId != null ? card.slotId : null,
      available: card.available !== false,   // 기본 true
      origin: card.origin || 'create',
      ts: Date.now(),
    };
  }
  function get() { return _active; }
  function has() { return !!_active; }
  function clear() { _active = null; }
  // 저장 완료 시 저장 슬롯과 연결.
  function linkSlot(slotId, dataUrl) {
    if (!_active) return;
    if (slotId != null) _active.slotId = slotId;
    if (dataUrl) _active.dataUrl = dataUrl;
    _active.ts = Date.now();
  }

  // 직전 산출물을 가리키는 대명사 발화인지 + 동사(저장/수정/조회) 판정.
  //   매칭되면 app-assistant 가 activeCard 를 대상으로 저장/편집/표시한다.
  var PRON_RE = /(그거|이거|저거|그것|그\s*걸|그\s*카드|이\s*카드|방금\s*(거|것|만든|그)|아까\s*(거|것|그)|최근\s*(거|것)|마지막\s*(거|것)|다시\s*(열|보여|보기))/;
  var SAVE_RE = /(저장|보관|간직|저장해)/;
  var EDIT_RE = /(수정|편집|고쳐|고치|바꿔|바꾸|글자)/;
  function classifyRef(q) {
    var t = String(q || '').trim();
    if (!t || !PRON_RE.test(t)) return null;
    if (SAVE_RE.test(t)) return { verb: 'save' };
    if (EDIT_RE.test(t)) return { verb: 'edit' };
    return { verb: 'show' };   // 다시/보여/열어
  }

  window.ItbiActiveCard = {
    set: set, get: get, has: has, clear: clear, linkSlot: linkSlot, classifyRef: classifyRef,
  };
})();
