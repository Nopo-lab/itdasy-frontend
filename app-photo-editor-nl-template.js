/* 사진 편집기 — 말로 전후사진 템플릿 선택 */
(function () {
  'use strict';
  if (window.PhotoEditorNLTemplate) return;

  function plan(text) {
    const input = String(text || '');
    if (!/전후|비포|애프터|인스타|피드|스토리|홍보|템플|가격표|후기/.test(input)) return null;
    const tpl = _template(input);
    return {
      steps: [{ action: 'apply_template', params: tpl, description_ko: '홍보 템플릿 적용' }],
    };
  }

  function _template(input) {
    if (/스토리/.test(input)) return { template: 'ba-2split-v', ratio: '9:16', label: '스토리 전후사진' };
    if (/가격/.test(input)) return { template: 'ba-price', ratio: '4:5', label: '가격표 전후사진' };
    if (/후기|리뷰/.test(input)) return { template: 'ba-review', ratio: '4:5', label: '후기 전후사진' };
    if (/과정|프로세스/.test(input)) return { template: 'ba-3process', ratio: '4:5', label: '과정 전후사진' };
    if (/이벤트|할인/.test(input)) return { template: 'ba-event', ratio: '9:16', label: '이벤트 전후사진' };
    if (/인스타|피드/.test(input)) return { template: 'ba-2split-h', ratio: '4:5', label: '피드 전후사진' };
    return { template: 'ba-cream', ratio: '4:5', label: '전후사진' };
  }

  window.PhotoEditorNLTemplate = { plan };
})();
