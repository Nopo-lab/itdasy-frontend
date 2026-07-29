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

  // [2026-07-22] _loadSecond 제거 — 옛 편집기 state 에 before 를 사후 주입하던 헬퍼.
  //   headless 복원에서는 state._beforeUrl 을 넘기면 composeCard 가 렌더 '전에' secondImg 를 채운다.

  function _tplData(id) {
    try {
      var MD = window.PhotoEditorTemplateMarketData;
      return (MD && typeof MD.lookupById === 'function' && MD.lookupById(id)) || null;
    } catch (_e) { return null; }
  }

  // slot.templateMeta 기반 복원. onSave(dataUrl): 재편집 저장 콜백(호출측이 슬롯 갱신).
  //   onSave 를 쓰면 편집기가 임베드 모드 → 저장이 _saveViaCallback(onSave) 으로 라우팅(다운로드 아님).
  //   성공 true / 복원 불가(메타·모듈 부재) false → 호출측 baked 폴백.
  // [2026-07-22] 옛 PhotoEditor(PE.open + TV.apply + _internal) 경로 폐지 →
  //   template-autoapply 와 같은 headless 파이프라인으로 재구축.
  //   상태를 meta 에서 직접 복원하고, 문구 편집 시트는 그대로, 저장 시 현재 작업실 편집기로.
  window.restoreAssistantTemplate = function (slot, photo, onSave) {
    var TA = window.ItdasyTemplateAutoApply;
    var ES = window.PhotoEditorTemplateEditSheet;
    var PT = window.PhotoEditorPremiumTemplates;
    var meta = slot && slot.templateMeta;
    if (!meta || !meta.templateId) return false;
    if (!TA || typeof TA.composeAndHandOff !== 'function' || !PT || typeof PT.renderHook !== 'function') return false;
    try {
      var src = meta.baseSrc || (photo && (photo.editedDataUrl || photo.dataUrl)) || '';
      var st = {
        tplV2: {
          id: meta.templateId,
          slotValues: Object.assign({}, meta.slotValues || {}),
          imageSlots: meta.imageSlots || { main_photo: { src: src } },
        },
        _beforeUrl: meta.secondImg || '',   // 전후 before — 합성 전에 secondImg 로 주입
        onSave: (typeof onSave === 'function') ? onSave : null,
      };
      if (!st.tplV2.imageSlots.main_photo) st.tplV2.imageSlots.main_photo = { src: src };
      if (meta.ratio) st.ratio = meta.ratio;
      if (typeof TA.setActiveState === 'function') TA.setActiveState(st);

      var helpers = {
        scheduleRedraw: function () {},
        renderPanel: function () {},
        pushHistory: function () {},
        applyStatePatch: function () {},
        save: function () { return TA.composeAndHandOff(st, onSave); },
      };
      // ⚠️ 작업실 편집기는 여기서 열지 않는다 — 시트 DOM 이 날아간다(template-autoapply 주석 참조).
      if (ES && typeof ES.open === 'function') {
        ES.open({ templateId: meta.templateId, templateData: _tplData(meta.templateId), state: st, helpers: helpers, onChange: function () { return undefined; } });
      }
      return true;
    } catch (e) {
      try { console.warn('[asst-restore] 복원 실패', e && e.message); } catch (_l) { void _l; }
      return false;
    }
  };
})();
