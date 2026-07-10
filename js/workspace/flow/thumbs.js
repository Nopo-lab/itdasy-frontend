/* workspace/flow/thumbs.js — 템플릿 카드 썸네일 렌더 클러스터 분리 (T-104 P1, 2026-07-10)
   flow.js 상태(d/cur/el) 안 건드림. 사진 없이 '템플릿 디자인 자체'만 그려 dataURL 반환(id별 1회 캐시).
   외부엔 _tplThumb 만 노출(flow.js 는 로컬 별칭으로 재수입). _TPL_EX·캐시·내부 헬퍼는 private. */
(function () {
  'use strict';
  var _TPL_EX = {
    before_after: 'assets/workshop-cats/cat-1.jpg',
    feed:         'assets/workshop-cats/cat-3.jpg',
    review:       'assets/workshop-cats/cat-4.jpg',
    event:        'assets/workshop-cats/cat-5.jpg',
    story:        'assets/workshop-cats/cat-3.jpg'
  };
  function _tplExample(tpl) { return _TPL_EX[tpl.purpose] || _TPL_EX.feed; }
  var _tplThumbCache = {};
  // [v561] 붙이기 카드 썸네일 — 사진 없이 분할 레이아웃(좌우/상하)만 그려 의도를 명확히.
  function _collageThumb(layout) {
    try {
      var W = 320, H = 400, gap = 6, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var ctx = cv.getContext('2d'); ctx.fillStyle = '#EFE7EA'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#C9B3BC';
      if (layout === 'tb') { var hh = (H - gap) / 2; ctx.fillRect(0, 0, W, hh); ctx.fillRect(0, hh + gap, W, hh); }
      else { var hw = (W - gap) / 2; ctx.fillRect(0, 0, hw, H); ctx.fillRect(hw + gap, 0, hw, H); }
      ctx.fillStyle = '#7A5C66'; ctx.font = '700 30px Pretendard, "Noto Sans KR", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(layout === 'tb' ? '상하' : '좌우', W / 2, H / 2);
      return cv.toDataURL('image/png');
    } catch (_e) { return _TPL_EX.feed; }
  }
  // [v535] 템플릿 카드 썸네일 = 사진 없는 '템플릿 디자인 자체'만 렌더(레이아웃/배지/카피).
  function _tplThumb(tpl) {
    if (_tplThumbCache[tpl.id]) return _tplThumbCache[tpl.id];
    if (tpl.purpose === 'collage') { var cu = _collageThumb(tpl.collage || 'lr'); _tplThumbCache[tpl.id] = cu; return cu; }
    var url = null;
    try {
      if (window.PhotoEditorTemplateThumb && window.PhotoEditorTemplateThumb.make) {
        var ratio = tpl.purpose === 'story' ? '9:16' : (tpl.purpose === 'event' ? '1:1' : '4:5');
        var shop = '';
        try { shop = localStorage.getItem('shop_name') || ''; } catch (_e) { shop = ''; }
        url = window.PhotoEditorTemplateThumb.make({ id: tpl.id, label: tpl.label }, { ratio: ratio, shopName: shop });
      }
    } catch (_e2) { url = null; }
    url = url || _tplExample(tpl);
    _tplThumbCache[tpl.id] = url;
    return url;
  }
  window.WSFlowThumbs = { _tplThumb: _tplThumb };
})();
