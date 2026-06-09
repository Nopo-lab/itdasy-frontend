/* 잇비 템플릿 재편집 복원 — P2-2a (2026-06-09)

   목적: 작업실 슬롯에 slot.templateMeta 가 있으면, baked 이미지가 아니라
        templateId/slotValues/imageSlots 기반으로 "템플릿 상태"를 복원해 재편집 가능하게 한다.
        (가격표/후기/전후 3경로) 복원은 기존 적용 패턴(TV.apply + slot 주입)을 재사용한다.

   원칙(엄수):
   - DB/스키마/renderer 미수정. PhotoEditor/TemplatesV2/EditSheet 전역만 호출.
   - templateMeta 없으면 호출측이 기존 baked 편집 경로를 쓴다(이 모듈 미진입).
   - 실패해도 throw 0(false 반환) → 호출측이 baked 편집으로 폴백 가능.
*/
(function () {
  'use strict';
  if (window.restoreAssistantTemplate) return;

  // meta.secondImg(before) dataURL → state.secondImg 비동기 로드(ba 전용). app-photo-editor _loadBeforeIntoState 와 동일 효과.
  function _loadSecond(PE, helpers, src) {
    try {
      var img = new Image();
      img.onload = function () {
        try {
          var st = PE._internal.getState && PE._internal.getState();
          if (st) { st.secondImg = img; if (helpers.scheduleRedraw) helpers.scheduleRedraw(); if (helpers.pushHistory) helpers.pushHistory(); }
        } catch (_e) { void _e; }
      };
      img.src = src;
    } catch (_e) { void _e; }
  }

  function _tplData(id) {
    try {
      var MD = window.PhotoEditorTemplateMarketData;
      return (MD && typeof MD.lookupById === 'function' && MD.lookupById(id)) || null;
    } catch (_e) { return null; }
  }

  // slot.templateMeta 기반 복원. onSave(dataUrl): 재편집 저장 콜백(호출측이 슬롯 갱신).
  //   onSave 를 쓰면 편집기가 임베드 모드 → 저장이 _saveViaCallback(onSave) 으로 라우팅(다운로드 아님).
  //   성공 true / 복원 불가(메타·모듈 부재) false → 호출측 baked 폴백.
  window.restoreAssistantTemplate = function (slot, photo, onSave) {
    var PE = window.PhotoEditor, TV = window.PhotoEditorTemplatesV2, ES = window.PhotoEditorTemplateEditSheet;
    var meta = slot && slot.templateMeta;
    if (!meta || !meta.templateId) return false;
    if (!PE || !PE.open || !PE._internal || !TV || typeof TV.apply !== 'function') return false;
    try {
      var src = meta.baseSrc || (photo && (photo.editedDataUrl || photo.dataUrl)) || '';
      PE.open({
        src: src,
        initial_tab: 'template',
        inline: true,
        onSave: (typeof onSave === 'function') ? onSave : undefined,
      });
      TV.apply(meta.templateId);
      var st = PE._internal.getState && PE._internal.getState();
      if (!st || !st.tplV2) return false;
      // 슬롯값/이미지슬롯/비율 복원
      st.tplV2.slotValues = Object.assign({}, st.tplV2.slotValues || {}, meta.slotValues || {});
      if (meta.imageSlots) st.tplV2.imageSlots = meta.imageSlots;
      if (meta.ratio) st.ratio = meta.ratio;
      var helpers = PE._internal.helpers || {};
      if (helpers.renderPanel) { try { helpers.renderPanel(); } catch (_e) { void _e; } }
      if (helpers.scheduleRedraw) { try { helpers.scheduleRedraw(); } catch (_e) { void _e; } }
      if (helpers.pushHistory) { try { helpers.pushHistory(); } catch (_e) { void _e; } }
      // 전후(before) 사진 복원
      if (meta.secondImg) _loadSecond(PE, helpers, meta.secondImg);
      // 문구 편집 시트 오픈
      try { if (ES && typeof ES.open === 'function') ES.open({ templateId: meta.templateId, templateData: _tplData(meta.templateId), state: st, helpers: helpers, onChange: function () { return undefined; } }); } catch (_e) { void _e; }
      return true;
    } catch (e) {
      try { console.warn('[asst-restore] 복원 실패', e && e.message); } catch (_l) { void _l; }
      return false;
    }
  };
})();
