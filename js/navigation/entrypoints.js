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
    // [2026-07-22] 옛 PhotoEditor 진입 전면 폐지 → 현재 작업실(WorkspaceFlow)로 일원화.
    //   이 함수가 사진편집 진입의 중앙 초크포인트(ai-hub·photo-local-handlers 가 위임)라
    //   여기만 돌리면 모든 옛 편집기 경로가 현재 작업실로 모인다.
    // [2026-06-11 로딩분할] 작업실 그룹 미로드면 로드 후 재진입.
    if (window.AppLoader && !window.AppLoader.loaded('photo') && !window.WorkspaceFlow) {
      _toast('사진 도구 준비 중…');
      window.AppLoader.ensure('photo').then(() => openPhotoEditorFromAction(opts));
      return true;
    }
    try {
      if (window.WorkspaceFlow && typeof window.WorkspaceFlow.command === 'function') {
        const src = opts && (opts.src || opts.photoUrl);
        window.WorkspaceFlow.command({ type: 'storyedit', photoUrls: src ? [src] : null });
        return true;
      }
    } catch (e) {
      console.warn('[entrypoints] 작업실 열기 실패:', e);
    }
    _toast('작업실을 여는 중이에요. 잠시 후 다시 눌러주세요');
    return false;
  }

  window.openFinishTab = openFinishTab;
  window.openPhotoEditorFromAction = openPhotoEditorFromAction;
})();
