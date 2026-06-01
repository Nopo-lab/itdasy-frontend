/* 템플릿 실미리보기 썸네일 생성 (TPL-1 · 2026-06-02)

   목표: 템플릿 카드가 이름/배지만이 아니라 "실제 레이아웃이 보이는 썸네일"을 표시.
   - overlay 기반(사진 불필요·자체 렌더): PhotoEditorTemplateOverlay.draw(ctx,dw,dh,t,brand)
   - BA compose 기반(전후 2분할 등 사진 의존): PhotoEditorBACompose.draw(ctx,w,h,state,tpl,data)
       → 썸네일엔 코드로 그린 placeholder 살롱톤 더미사진 사용(실사진 자산 추가 0).
   - 둘 다 불가 시 null 반환 → 호출측이 기존 gradient 카드로 fallback.
   결과는 dataURL(PNG) 1회 생성 후 캐시. 실제 적용 draw 경로는 미변경(결과 동일). */
(function () {
  'use strict';
  if (window.PhotoEditorTemplateThumb) return;

  var _cache = {};   // id+ratio+accent → dataURL

  function _ratioWH(ratio, base) {
    if (ratio === '9:16') return { w: Math.round(base * 9 / 16), h: base };
    if (ratio === '1:1') return { w: base, h: base };
    return { w: Math.round(base * 4 / 5), h: base };   // 4:5 기본
  }

  // 코드 생성 placeholder "사진" — 실사진 아님. 살롱톤 그라데이션 + 부드러운 형태.
  function _placeholderPhoto(w, h, accent) {
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d');
    var g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#f3e9ea'); g.addColorStop(1, accent || '#d8b6bd');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // 중앙 부드러운 원형(인물/시술 부위 근사)
    var rg = ctx.createRadialGradient(w * 0.5, h * 0.46, 2, w * 0.5, h * 0.46, w * 0.42);
    rg.addColorStop(0, 'rgba(255,255,255,0.5)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(w * 0.5, h * 0.46, w * 0.42, 0, Math.PI * 2); ctx.fill();
    return cv;
  }

  function _isBA(id) { return typeof id === 'string' && id.indexOf('ba-') === 0; }

  // 단일 템플릿 썸네일 dataURL 생성. 실패/미지원 시 null.
  //   tpl: {id,label,prefillText,accent,...}, opts:{ratio, accent(hex), shopName, base}
  function make(tpl, opts) {
    if (!tpl || !tpl.id) return null;
    opts = opts || {};
    var key = tpl.id + '|' + (opts.ratio || '') + '|' + (opts.accent || '');
    if (_cache[key]) return _cache[key];
    var base = opts.base || 320;
    var dim = _ratioWH(opts.ratio, base);
    var brand = { bg: opts.accent || '#c98a95', shopName: opts.shopName || '잇데이 스튜디오', logo: opts.logo || '' };
    var url = null;
    try {
      var cv = document.createElement('canvas'); cv.width = dim.w; cv.height = dim.h;
      var ctx = cv.getContext('2d');
      if (_isBA(tpl.id)) {
        if (!(window.PhotoEditorBACompose && window.PhotoEditorBACompose.draw)) return null;
        // after = placeholder, before = state 없으면 흑백 자동
        var ph = _placeholderPhoto(dim.w, dim.h, opts.accent);
        ctx.drawImage(ph, 0, 0, dim.w, dim.h);
        window.PhotoEditorBACompose.draw(ctx, dim.w, dim.h, null, tpl, {});
      } else {
        if (!(window.PhotoEditorTemplateOverlay && window.PhotoEditorTemplateOverlay.draw)) return null;
        window.PhotoEditorTemplateOverlay.draw(ctx, dim.w, dim.h, tpl, brand);
      }
      url = cv.toDataURL('image/png');
    } catch (_e) { url = null; }
    if (url) _cache[key] = url;
    return url;
  }

  function supportKind(id) {
    if (_isBA(id)) return (window.PhotoEditorBACompose && window.PhotoEditorBACompose.draw) ? 'ba' : 'fallback';
    return (window.PhotoEditorTemplateOverlay && window.PhotoEditorTemplateOverlay.draw) ? 'overlay' : 'fallback';
  }

  window.PhotoEditorTemplateThumb = { make, supportKind, _isBA };
})();
