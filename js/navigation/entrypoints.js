/* 공통 화면 진입점
   같은 화면을 여는 코드가 여러 파일에 흩어지지 않도록 모은다. */
(function () {
  'use strict';

  function _toast(msg) {
    if (typeof window.showToast === 'function') window.showToast(msg);
  }

  function _finishButton() {
    return document.querySelector('.tab-bar__btn[data-tab="finish"]');
  }

  function openFinishTab() {
    let opened = false;
    try {
      if (typeof window.showTab === 'function') {
        window.showTab('finish', _finishButton() || null);
        opened = true;
      }
      if (typeof window.initFinishTab === 'function') window.initFinishTab();
    } catch (e) {
      console.warn('[entrypoints] 마무리 화면 열기 실패:', e);
      opened = false;
    }
    if (!opened) _toast('마무리 화면을 여는 중이에요. 잠시 후 다시 눌러주세요');
    return opened;
  }

  function openPhotoEditorFromAction(opts) {
    try {
      if (window.PhotoEditor && typeof window.PhotoEditor.openFromAction === 'function') {
        window.PhotoEditor.openFromAction(opts || {});
        return true;
      }
      if (window.PhotoEditor && typeof window.PhotoEditor.open === 'function') {
        window.PhotoEditor.open(opts || {});
        return true;
      }
    } catch (e) {
      console.warn('[entrypoints] 사진 편집기 열기 실패:', e);
    }
    _toast('사진 편집기를 여는 중이에요. 잠시 후 다시 눌러주세요');
    return false;
  }

  window.openFinishTab = openFinishTab;
  window.openPhotoEditorFromAction = openPhotoEditorFromAction;
})();
