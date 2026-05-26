/* 사진 편집기 — 말로 추가 수정 */
(function () {
  'use strict';
  if (window.PhotoEditorNLModify) return;

  function plan(text) {
    const input = String(text || '');
    if (/원래대로|되돌/.test(input)) return { steps: [{ action: 'undo', params: {}, description_ko: '되돌리기' }] };
    if (/배경.*흐리|아웃/.test(input)) return { steps: [{ action: 'apply_bgblur', params: { strength: 60 }, description_ko: '배경 흐림' }] };
    if (/로고.*빼|워터마크.*빼/.test(input)) return { steps: [{ action: 'set_watermark', params: { value: '' }, description_ko: '로고 제거' }] };
    if (/가격.*넣/.test(input)) return { steps: [{ action: 'add_text', params: { value: '가격 문의', y: 0.82 }, description_ko: '가격 문구' }] };
    if (/스토리/.test(input)) return { steps: [{ action: 'set_ratio', params: { ratio: '9:16' }, description_ko: '스토리 비율' }] };
    if (/덜|과해|줄여/.test(input)) return _lessPlan();
    if (/더|늘려/.test(input)) return _morePlan(input);
    return null;
  }

  function _lessPlan() {
    return { steps: [
      { action: 'set_adjust', params: { brightness: 104, saturate: 104, sharpness: 8 }, description_ko: '보정 줄이기' },
      { action: 'set_beauty', params: { skin: 10, redness: 10, blemish: 8, textureSmooth: 6 }, description_ko: '뷰티 줄이기' },
    ] };
  }

  function _morePlan(input) {
    if (/밝/.test(input)) return { steps: [{ action: 'set_adjust', params: { brightness: 118 }, description_ko: '더 밝게' }] };
    if (/선명/.test(input)) return { steps: [{ action: 'set_adjust', params: { sharpness: 28 }, description_ko: '더 선명하게' }] };
    return { steps: [{ action: 'set_adjust', params: { brightness: 112, saturate: 112 }, description_ko: '조금 더 강하게' }] };
  }

  window.PhotoEditorNLModify = { plan };
})();
