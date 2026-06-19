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
  // beautyPack 렌더러는 1080 기준 절대 px 폰트 사용 → 썸네일 작은 캔버스로 균등 축소.
  function _designWH(ratio) {
    if (ratio === '9:16') return { w: 1080, h: 1920 };
    if (ratio === '1:1') return { w: 1080, h: 1080 };
    return { w: 1080, h: 1350 };
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
  function _isBeautyPack(id) {
    var BP = window.PhotoEditorBeautyPack;
    return !!(BP && BP.has && BP.has(id));
  }

  // [WM] beautyPack(wm-/bp-) 템플릿용 data 매핑 — premium-templates 의 매핑과 동일 키.
  //   (드리프트 주의: premium _premiumHook 의 data 구성이 바뀌면 여기도 맞춰야 함.)
  function _beautyData(found, sv) {
    var pal = (found && found.palette) || null;
    return {
      type: 'beautyPack', kicker: (found && found.prefillText) || '', palette: pal,
      head: sv.headline || (found && (found.prefillText || found.label)) || '',
      sub: sv.subtitle, shop: sv.shop_name, accent: pal && pal.accent,
      services: sv.services, cta: sv.cta, phone: sv.phone,
      customer: sv.customer_label, serviceName: sv.service_name, review: sv.review_text,
      beforeLabel: sv.before_label, afterLabel: sv.after_label,
      beforeCap: sv.before_caption, afterCap: sv.after_caption,
    };
  }

  // 업로드 사진(opts.photo/beforePhoto)을 beautyPack/BA 렌더가 읽는 state 형태로.
  function _stateFromOpts(opts) {
    if (!opts || !opts.photo) return null;
    return { editedImg: opts.photo, originalImg: opts.photo, img: opts.photo, secondImg: opts.beforePhoto || opts.photo };
  }

  // 단일 템플릿 썸네일 dataURL 생성. 실패/미지원 시 null.
  //   tpl: {id,label,prefillText,accent,...}
  //   opts:{ ratio, accent(hex), shopName, logo, base, photo, beforePhoto, photoKey, noCache }
  function make(tpl, opts) {
    if (!tpl || !tpl.id) return null;
    opts = opts || {};
    var key = tpl.id + '|' + (opts.ratio || '') + '|' + (opts.accent || '') + '|' + (opts.photoKey || 'noimg');
    if (!opts.noCache && _cache[key]) return _cache[key];
    var base = opts.base || 320;
    var dim = _ratioWH(opts.ratio, base);
    var brand = { bg: opts.accent || '#c98a95', shopName: opts.shopName || '잇데이 스튜디오', logo: opts.logo || '' };
    var url = null;
    try {
      var cv = document.createElement('canvas'); cv.width = dim.w; cv.height = dim.h;
      var ctx = cv.getContext('2d');
      var state = _stateFromOpts(opts);
      if (_isBeautyPack(tpl.id)) {
        // wm-/bp- : 실제 beautyPack 렌더러로 — 업로드 사진 적용(없으면 렌더러가 placeholder 박스).
        var MD = window.PhotoEditorTemplateMarketData;
        var found = (MD && MD.lookupById && MD.lookupById(tpl.id)) || tpl;
        var TS = window.PhotoEditorTemplateSlots;
        var sv = (TS && TS.getDefaultValues) ? TS.getDefaultValues(tpl.id, found, { shopName: opts.shopName }) : {};
        var data = _beautyData(found, sv);
        var tplObj = { id: tpl.id, slotValues: sv, imageSlots: {} };
        // 1080 디자인 좌표로 그리고 썸네일 크기로 균등 축소(폰트/여백 비율 보존).
        var dz = _designWH(opts.ratio);
        ctx.save(); ctx.scale(dim.w / dz.w, dim.h / dz.h);
        window.PhotoEditorBeautyPack.draw(ctx, dz.w, dz.h, state, tplObj, data);
        ctx.restore();
      } else if (_isBA(tpl.id)) {
        if (!(window.PhotoEditorBACompose && window.PhotoEditorBACompose.draw)) return null;
        // 업로드 사진 있으면 그걸로, 없으면 코드 placeholder(살롱톤).
        if (!state) { var ph = _placeholderPhoto(dim.w, dim.h, opts.accent); ctx.drawImage(ph, 0, 0, dim.w, dim.h); }
        window.PhotoEditorBACompose.draw(ctx, dim.w, dim.h, state, tpl, {});
      } else {
        if (!(window.PhotoEditorTemplateOverlay && window.PhotoEditorTemplateOverlay.draw)) return null;
        if (state && state.editedImg) {   // 사진 있으면 배경으로 깔고 오버레이
          try { ctx.drawImage(state.editedImg, 0, 0, dim.w, dim.h); } catch (_e2) { void _e2; }
        }
        window.PhotoEditorTemplateOverlay.draw(ctx, dim.w, dim.h, tpl, brand);
      }
      url = cv.toDataURL('image/png');
    } catch (_e) { url = null; }
    if (url && !opts.noCache) _cache[key] = url;
    return url;
  }

  function supportKind(id) {
    if (_isBeautyPack(id)) return 'beautyPack';
    if (_isBA(id)) return (window.PhotoEditorBACompose && window.PhotoEditorBACompose.draw) ? 'ba' : 'fallback';
    return (window.PhotoEditorTemplateOverlay && window.PhotoEditorTemplateOverlay.draw) ? 'overlay' : 'fallback';
  }

  window.PhotoEditorTemplateThumb = { make, supportKind, _isBA };
})();
