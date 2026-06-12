/* 잇비 템플릿 결과 저장 어댑터 — P0-C (2026-06-09)

   목적: 잇비 자동적용 결과(가격표/후기/전후)를 "저장"할 때
        ① 마무리 탭 갤러리(gallery 스토어)  ② 작업실 슬롯 그리드(slots 스토어)
        둘 다에 baked 이미지로 남긴다.

   원칙(엄수):
   - 기존 전역 window.saveToGallery / window.saveSlotToDB 만 호출(재사용). DB 함수/스키마 미수정.
   - 재편집 메타(templateId/slotValues/imageSlots) 저장 안 함 = baked 이미지 1장만. (복원은 P2-2)
   - dedupe: gallery=dedupeKey, slot=안정 id(둘 다 같은 rid 파생) → 재저장은 양쪽 갱신, 새 요청만 새 항목.
   - 실패해도 throw 0(부분 저장 허용). renderer/matcher/autoapply 로직과 무관.
*/
(function () {
  'use strict';
  if (window.saveAssistantTemplateResult) return;

  function _rid() {
    try { return Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
    catch (_e) { return 'r' + Date.now(); }
  }

  // IndexedDB put 가 깨지지 않도록 구조화복제 안전(JSON 직렬화 가능)한 값만 남긴다(Image/함수 제거).
  function _safeClone(o) { try { return o == null ? null : JSON.parse(JSON.stringify(o)); } catch (_e) { return null; } }

  // [P2-2a] 저장/재편집 시 편집기 state(tplV2)에서 재편집용 메타를 캡처. 비직렬화 값은 제거.
  //   prev: 재편집 시 이전 메타(누락 필드 보존용).
  window.buildAssistantTemplateMeta = function (st, purpose, prev) {
    try {
      if (!st || !st.tplV2 || !st.tplV2.id) return prev || null;
      return {
        ver: 1,
        purpose: purpose || (prev && prev.purpose) || '',
        templateId: st.tplV2.id,
        slotValues: _safeClone(st.tplV2.slotValues) || {},
        imageSlots: _safeClone(st.tplV2.imageSlots) || null,
        secondImg: (st.secondImg && st.secondImg.src) || (prev && prev.secondImg) || null,
        baseSrc: st.originalSrc || (prev && prev.baseSrc) || null,
        ratio: st.ratio || (prev && prev.ratio) || null,
        updatedAt: Date.now(),
      };
    } catch (_e) { return prev || null; }
  };

  // baked dataUrl → 작업실 슬롯 스키마 미러(app-gallery-workshop.js 슬롯 모양). 재편집 메타 없음.
  //   status:'done' = 완성 결과물 → 그리드 노출(published 아님) + 미완 배너 미유발.
  function _buildSlot(dataUrl, rid, label, templateMeta) {
    var ts = Date.now();
    var slot = {
      id: 'asst_' + rid,
      label: label || '잇비 결과',
      order: ts,                 // loadSlotsFromDB order 오름차순 → 뒤쪽 배치
      photos: [{ id: 'p_' + rid, dataUrl: dataUrl, mode: 'after' }],
      caption: '', hashtags: '',
      status: 'done',
      instagramPublished: false, deferredAt: null,
      createdAt: ts,
    };
    if (templateMeta) slot.templateMeta = templateMeta;   // [P2-2a] 재편집 복원 메타(스키마리스 추가)
    return slot;
  }

  // meta: { purpose, label, rid? }  rid 주면 gallery/slot 동일 키로 묶임(재저장 갱신).
  window.saveAssistantTemplateResult = function (dataUrl, meta) {
    var m = meta || {};
    if (!dataUrl) return { gallery: false, slot: false };
    var rid = m.rid || _rid();
    var label = m.label || '잇비 결과';
    var purpose = m.purpose || '';
    var saved = { gallery: false, slot: false };

    // ① 마무리 갤러리 (P0-B 동작 유지)
    try {
      if (typeof window.saveToGallery === 'function') {
        window.saveToGallery({
          id: 'asst_' + rid,
          label: label,
          photos: [{ id: 'p_' + rid, dataUrl: dataUrl, mode: 'after' }],
          caption: '', hashtags: '',
          source: 'assistant_template',
          dedupeKey: 'asst_tpl:' + purpose + ':' + rid,
        });
        saved.gallery = true;
      }
    } catch (e) { try { console.warn('[asst-save] gallery 실패', e && e.message); } catch (_l) { void _l; } }

    // ② 작업실 슬롯 (P0-C) + 재편집 메타(P2-2a)
    // [2026-06-11 B7/B8] fire-and-forget → 완료 대기. 성공 시 최근 저장 기억 + 작업실 즉시 갱신.
    var slotId = 'asst_' + rid;
    var slotPromise = Promise.resolve(false);
    try {
      if (typeof window.saveSlotToDB === 'function') {
        slotPromise = Promise.resolve(window.saveSlotToDB(_buildSlot(dataUrl, rid, label, m.templateMeta || null)))
          .then(function () { return true; })
          .catch(function (e) {
            try { console.warn('[asst-save] slot 실패', e && e.message); } catch (_l) { void _l; }
            return false;
          });
      }
    } catch (e) { try { console.warn('[asst-save] slot 실패', e && e.message); } catch (_l) { void _l; } }

    return slotPromise.then(function (ok) {
      saved.slot = ok;
      if (ok || saved.gallery) {
        window._lastAssistantSave = { slotId: slotId, rid: rid, label: label, ts: Date.now() };
        // [2026-06-11 QA] 새로고침하면 기억이 증발하던 버그 — localStorage 영속화
        try { localStorage.setItem('itdasy_last_asst_save', JSON.stringify(window._lastAssistantSave)); } catch (_p) { void _p; }
        // [activeCard P0] 저장 완료 → 직전 산출물 포인터를 저장 슬롯과 연결("그거 저장" 후 "그거 수정"이 저장본 로드).
        try { if (window.ItbiActiveCard && window.ItbiActiveCard.has()) window.ItbiActiveCard.linkSlot(slotId, dataUrl); } catch (_ac) { void _ac; }
        // 작업실이 이미 떠 있으면 리스트 즉시 갱신 (미로드 상태면 진입 시 어차피 DB 재로드)
        try {
          if (typeof window.initWorkshopTab === 'function' && !window.initWorkshopTab._loaderStub &&
              document.getElementById('workshopRoot')) {
            window.initWorkshopTab();
          }
        } catch (_r) { void _r; }
      }
      return saved;
    });
  };
})();
