/* Workspace V2 어댑터 (Phase 2) — V2 UI 에서 기존 앱 기능을 "직접 구현 없이" 연결.
   원칙: 구 slot 팝업/openSlotPopup/nav-sheet 직접 노출 금지. 기존 함수는 내부 재사용.
   - 보정/누끼/템플릿: PhotoEditor.open() 직접 호출(모던 에디터) — openSlotPhotoInEditor(구 컨텍스트) 미사용.
   - 캡션: window.CaptionEngine.generate (DOM 비의존, /persona/generate 재사용).
   - 고객: window.Customer.pick → {id,name}.
   - 가격표: window.openPricelistUpload (사진편집 흐름과 분리).
   - 저장: window.saveSlotToDB / saveToGallery.
   - 인스타: 연결(localStorage itdasy:ig_connected_cache)일 때만 실제 업로드, 아니면 준비/연결/복사/저장.
   각 함수는 {ok, reason?, toast?, ...} 또는 Promise 로 결과 반환. */
(function () {
  'use strict';
	  function toast(m) { if (window.showToast) window.showToast(m); }
	  function has(fn) { return typeof fn === 'function'; }
	  function igConnected() { try { return localStorage.getItem('itdasy:ig_connected_cache') === '1'; } catch (_e) { return false; } }
	  function _hasValues(obj) { return !!(obj && Object.keys(obj).some(function (k) { return +obj[k] !== 0; })); }
	  function _loadImage(src) {
	    return new Promise(function (resolve, reject) {
	      var img = new Image();
	      img.onload = function () { resolve(img); };
	      img.onerror = reject;
	      img.src = src;
	    });
	  }
	  // [이슈10] 디코드 캐시(소형 LRU) — 같은 src 를 슬라이더 commit 마다 다시 디코드하던 비용 제거.
	  //   Image 는 로드 후 불변이고 매번 새 캔버스에 draw 하므로 재사용 안전. 손 떼고 다시 조작 시 즉시 hit.
	  var _imgCache = [];
	  function _loadImageCached(src) {
	    for (var i = 0; i < _imgCache.length; i++) {
	      if (_imgCache[i].src === src) { var hit = _imgCache.splice(i, 1)[0]; _imgCache.push(hit); return Promise.resolve(hit.img); }
	    }
	    return _loadImage(src).then(function (img) {
	      _imgCache.push({ src: src, img: img }); if (_imgCache.length > 4) _imgCache.shift();
	      return img;
	    });
	  }
	  function _encode(cv, src) {
	    return /^data:image\/png/i.test(src || '') ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.92);
	  }
	  function _cover(ctx, img, x, y, w, h) {
	    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
	    if (!iw || !ih) return;
	    var scale = Math.max(w / iw, h / ih);
	    var sw = w / scale, sh = h / scale;
	    var sx = Math.max(0, (iw - sw) / 2), sy = Math.max(0, (ih - sh) / 2);
	    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
	  }
	  function _brand() {
	    var b = {};
	    try { if (window.BrandKit && has(window.BrandKit.get)) b = window.BrandKit.get() || {}; } catch (_e) { b = {}; }
	    try { if (!b.shop_name && localStorage.getItem('shop_name')) b.shop_name = localStorage.getItem('shop_name'); } catch (_e2) { void _e2; }
	    return { shopName: b.shop_name || b.shopName || '잇데이 스튜디오', primary: b.primary || '#BC6675', soft: b.soft || '#FBEFEF' };
	  }
	  function _igProfile() {
	    var s = null;
	    try { s = window.IGState && has(window.IGState.get) ? window.IGState.get() : null; } catch (_e) { s = null; }
	    var connected = !!(s && s.connected) || igConnected();
	    var handle = '';
	    var pic = '';
	    try {
	      handle = (s && s.handle) || localStorage.getItem('itdasy:ig_handle') || window._instaHandle || '';
	      pic = (s && (s.profile_picture_url || s.profilePic)) || localStorage.getItem('itdasy:ig_profile_pic') || '';
	    } catch (_e2) { void _e2; }
	    handle = String(handle || '').replace(/^@/, '');
	    return { connected: connected, handle: handle ? ('@' + handle) : '', profilePic: pic, displayName: handle ? ('@' + handle) : '' };
	  }
	  function _eyeMasks(masks, img, b) {
    var MA = window.MaskApplication;
    function ensure() { return masks || (masks = { useMasks: {}, _scale: {}, maskW: img.naturalWidth || img.width, maskH: img.naturalHeight || img.height }); }
    try {
      if ((b.lashSharp || 0) > 10 && MA && has(MA.getLashMaskSync)) { var lash = MA.getLashMaskSync(img); if (lash) { ensure().lashMask = lash.mask; masks.lashScale = lash.scale; } }
      if ((b.eyeRedness || 0) > 0 && MA && has(MA.getScleraMaskSync)) { var sc = MA.getScleraMaskSync(img); if (sc) { ensure().useMasks.scleraMask = sc.mask; masks._scale.scleraMask = sc.scale; } }
      if ((b.browSharp || 0) > 10 && MA && has(MA.getBrowMaskSync)) { var br = MA.getBrowMaskSync(img); if (br) { ensure().browMask = br.mask; masks.browScale = br.scale; } }
      // [v537] 네일 — 작업실 네일 탭 신설. nailMask 있으면 정밀, 없으면 엔진 휴리스틱 폴백.
      if (((b.nailGloss || 0) > 0 || (b.nailShape || 0) > 10) && MA && has(MA.getNailMaskSync)) { var nl = MA.getNailMaskSync(img); if (nl) { ensure().useMasks.nailMask = nl.mask; masks._scale.nailMask = nl.scale; } }
    } catch (_e3) { /* eye/nail 마스크 실패 무시 — 베이스 마스크 유지 */ }
    return masks;
  }
  // [#1 FIX] 피부/헤어 마스크는 async getMasksForBeauty 로 실제 계산해서 받는다.
  //   기존 getMasksForBeautySync 는 캐시 hit 일 때만 반환 → 작업실은 재호출 루프가 없어 항상 null → 피부/헤어 무반응.
  //   maskKey(사진별)로 1회만 계산해 캐시 → 슬라이더 놓을 때마다 재계산하던 느림도 제거.
  var _maskCache = {};
  var MASK_TIMEOUT = 2500;   // 모델 첫 로딩 등으로 마스크가 늦으면 이번 패스는 전역 보정으로(행 방지). 다음 슬라이더에서 캐시 사용.
  function _finishMasks(base, img, b) {
    var m = base ? { useMasks: Object.assign({}, base.useMasks), _scale: Object.assign({}, base._scale), meta: base.meta, maskW: base.maskW, maskH: base.maskH } : null;
    return _eyeMasks(m, img, b);
  }
  function _beautyMasksAsync(img, b, key) {
    var MA = window.MaskApplication;
    if (!MA) return Promise.resolve(_eyeMasks(null, img, b));
    // 캐시 hit → 즉시.
    if (key && Object.prototype.hasOwnProperty.call(_maskCache, key)) return Promise.resolve(_finishMasks(_maskCache[key], img, b));
    // 계산 시작 — 완료되면 캐시에 저장(타임아웃돼도 백그라운드로 채워져 다음 호출에서 사용).
    var compute;
    if (has(MA.getMasksForBeauty)) compute = Promise.resolve(MA.getMasksForBeauty(img)).catch(function () { return null; }).then(function (m) { if (key) _maskCache[key] = m || null; return m; });
    else compute = Promise.resolve(has(MA.getMasksForBeautySync) ? MA.getMasksForBeautySync(img) : null);
    var timed = new Promise(function (res) { setTimeout(function () { res('__t__'); }, MASK_TIMEOUT); });
    return Promise.race([compute, timed]).then(function (w) { return _finishMasks(w === '__t__' ? null : w, img, b); });
  }
  function _applyBeautyAdjust(opts) {
    opts = opts || {};
    if (!opts.src) return Promise.resolve({ ok: false, reason: 'no_image' });
    if (!(window.PhotoEditorBeautyEngine && has(window.PhotoEditorBeautyEngine.apply))) return Promise.resolve({ ok: false, reason: 'no_beauty_engine' });
    if (!_hasValues(opts.beauty)) return Promise.resolve({ ok: true, dataUrl: opts.src });
    return _loadImageCached(opts.src).then(function (img) {
      return _beautyMasksAsync(img, opts.beauty || {}, opts.maskKey).then(function (masks) {
        // [v539] 프리뷰 다운스케일 — 드래그/release 체감 렉의 핵심은 풀해상도(naturalW×H) 픽셀 walk.
        //   previewMaxPx 주면 긴 변을 그 값으로 줄여 처리(화면 표시는 background cover 라 동일하게 보임).
        //   마스크는 풀 dims(maskW/H) 유지 → 엔진 _maskAt 가 캔버스↔마스크 비례 매핑하므로 정합 유지.
        //   최종 저장/적용(applyEditToPhoto)은 previewMaxPx 없이 호출 → 풀해상도 품질 보존.
        var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
        var mx = opts.previewMaxPx || 0, w = iw, h = ih;
        if (mx && Math.max(iw, ih) > mx) { var s = mx / Math.max(iw, ih); w = Math.max(1, Math.round(iw * s)); h = Math.max(1, Math.round(ih * s)); }
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        var ctx = cv.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, h);
        var _t0 = (window.performance && performance.now) ? performance.now() : 0;
        window.PhotoEditorBeautyEngine.apply(ctx, cv.width, cv.height, opts.beauty || {}, false, masks);
        if (window.__ITDASY_PHOTO_DEBUG__ && _t0) { try { console.log('[photofx] apply ' + w + 'x' + h + ' (src ' + iw + 'x' + ih + ') path=' + (mx ? 'preview' : 'final') + ' time=' + Math.round(performance.now() - _t0) + 'ms'); } catch (_e) { void _e; } }
        return { ok: true, dataUrl: _encode(cv, opts.src) };
      });
    }).catch(function (e) { console.warn('[wsadapter] beauty', e); return { ok: false, reason: 'beauty' }; });
  }
  function _templateById(id) {
	    var MD = window.PhotoEditorTemplateMarketData;
	    if (MD && has(MD.lookupById)) return MD.lookupById(id);
	    var list = window.PhotoEditorTemplatesV2 && window.PhotoEditorTemplatesV2.TEMPLATES;
	    return Array.isArray(list) ? list.filter(function (t) { return t.id === id; })[0] : null;
	  }
	  function _templateSize(tpl) {
	    var cats = (window.PhotoEditorTemplateMarketData && window.PhotoEditorTemplateMarketData.CATS) || (window.PhotoEditorTemplatesV2 && window.PhotoEditorTemplatesV2.CATS) || [];
	    var cat = cats.filter(function (c) { return c.id === tpl.cat; })[0] || {};
	    return cat.size ? { w: cat.size[0], h: cat.size[1] } : { w: 1080, h: 1350 };
	  }
	  function _pickPhoto(photos, role, fallbackIdx) {
	    photos = photos || [];
	    return photos.filter(function (p) { return p && p.role === role; })[0] || photos[fallbackIdx || 0] || photos[0] || null;
	  }
	  function _applyWorkspaceTemplate(opts) {
	    opts = opts || {};
	    var t = opts.template || {};
	    var found = _templateById(t.id) || t;
	    if (!found || !found.id) return Promise.resolve({ ok: false, reason: 'no_template', toast: '템플릿을 찾지 못했어요' });
	    if (!(window.PhotoEditorPremiumTemplates && has(window.PhotoEditorPremiumTemplates.renderHook))) return Promise.resolve({ ok: false, reason: 'no_renderer', toast: '템플릿 모듈을 아직 불러오지 못했어요' });
	    var photos = opts.photos || [];
	    var roleAfter = photos.filter(function (p) { return p && p.role === 'after'; })[0];
	    var roleHero = photos.filter(function (p) { return p && p.role === 'hero'; })[0];
	    var after = t.purpose === 'before_after' ? (_pickPhoto(photos, 'after', 1) || roleHero) : (roleAfter || roleHero || photos[0]);
	    var before = t.purpose === 'before_after' ? _pickPhoto(photos, 'before', 0) : null;
	    var afterSrc = after && (after.editedDataUrl || after.dataUrl);
	    var beforeSrc = before && (before.editedDataUrl || before.dataUrl);
	    if (!afterSrc) return Promise.resolve({ ok: false, reason: 'no_image', toast: '템플릿에 넣을 사진이 없어요' });
	    return Promise.all([_loadImage(afterSrc), beforeSrc ? _loadImage(beforeSrc).catch(function () { return null; }) : Promise.resolve(null)]).then(function (imgs) {
	      var bk = _brand(), size = _templateSize(found), cv = document.createElement('canvas'), ctx = null;
	      cv.width = size.w; cv.height = size.h; ctx = cv.getContext('2d');
	      _cover(ctx, imgs[0], 0, 0, cv.width, cv.height);
	      if (window.PhotoEditorPremiumTemplates.primeImage) window.PhotoEditorPremiumTemplates.primeImage(afterSrc, imgs[0]);
	      if (window.PhotoEditorBACompose && window.PhotoEditorBACompose.primeImage) window.PhotoEditorBACompose.primeImage(afterSrc, imgs[0]);
	      if (beforeSrc && imgs[1] && window.PhotoEditorBACompose && window.PhotoEditorBACompose.primeImage) window.PhotoEditorBACompose.primeImage(beforeSrc, imgs[1]);
	      var state = { originalImg: imgs[0], editedImg: imgs[0], img: imgs[0], secondImg: imgs[1],
	        tplV2: { id: found.id, label: found.label || t.label, bg: bk.primary, shopName: bk.shopName, cat: found.cat,
	          imageSlots: { main_photo: { src: afterSrc, focal: { x: 0.5, y: 0.5 }, zoom: 1 }, after_photo: { src: afterSrc, focal: { x: 0.5, y: 0.5 }, zoom: 1 }, before_photo: { src: beforeSrc || '', focal: { x: 0.5, y: 0.5 }, zoom: 1 } },
	          slotValues: { headline: found.prefillText || t.label, subtitle: t.use || found.label || '', shop_name: bk.shopName, service_name: opts.service || '', review_text: opts.caption || '', customer_label: opts.customerName || '' } } };
	      var drew = window.PhotoEditorPremiumTemplates.renderHook(ctx, cv.width, cv.height, state);
	      return drew ? { ok: true, dataUrl: _encode(cv, afterSrc), template: found } : { ok: false, reason: 'not_supported', toast: '이 템플릿은 작업실에서 아직 적용하지 못해요' };
	    }).catch(function (e) { console.warn('[wsadapter] template', e); return { ok: false, reason: 'template', toast: '템플릿 적용에 실패했어요' }; });
	  }

  // PhotoEditor 직접 호출(구 slot 팝업 우회). onSave(dataUrl) 로 editedDataUrl 회수.
  function _openEditor(photo, tab, ctx) {
    ctx = ctx || {};
    if (!(window.PhotoEditor && has(window.PhotoEditor.open))) { toast('편집기를 불러오지 못했어요'); return { ok: false, reason: 'no_editor' }; }
    var src = photo && (photo.editedDataUrl || photo.dataUrl);
    if (!src) { toast('편집할 사진이 없어요'); return { ok: false, reason: 'no_photo' }; }
    var opening = {
      src: src,
      initial_tab: tab || 'beauty',
      inline: false,
      customer_name: ctx.customerName || '',
      onSave: function (dataUrl) {
        if (dataUrl && photo) { photo.editedDataUrl = dataUrl; photo.mode = 'enhanced'; }
        if (has(ctx.onSaved)) ctx.onSaved(dataUrl);
      },
    };
    if (ctx.initialState) opening.initialState = ctx.initialState;
    window.PhotoEditor.open(opening);
    return { ok: true };
  }

  var WorkspaceAdapter = {
    // 보정 / 누끼 / 템플릿 — 전부 모던 PhotoEditor 의 해당 탭으로
    openRetouch: function (photo, ctx) { return _openEditor(photo, 'beauty', ctx); },
    openRemoveBg: function (photo, ctx) { return _openEditor(photo, 'bg', ctx); },
    openTemplate: function (photo, ctx) { return _openEditor(photo, 'template', ctx); },

    // 크롭 — V2 전용 모달(WorkspaceCrop). PhotoEditor 코어 미수정.
    openCrop: function (opts) {
      if (!(window.WorkspaceCrop && has(window.WorkspaceCrop.open))) { toast('크롭 모듈을 불러오지 못했어요'); return { ok: false, reason: 'no_crop' }; }
      window.WorkspaceCrop.open(opts || {});
      return { ok: true };
    },

    // 경량 보정 — 실 픽셀 워커(PhotoEditorWorkerFilter) 재사용. UI/PhotoEditor 라우팅 없음.
    //  지원: brightness/saturation/color(=temperature)/sharpness(=unsharp) = 워커, contrast = 캔버스 필터.
    //  (워커 schema: workers/photo-filter-worker.js — adjust{brightness,saturate,temperature}, unsharp{strength})
	    applyPixelAdjust: function (opts) {
      opts = opts || {};
      var a = opts.adjust || {};
      if (!opts.src) return Promise.resolve({ ok: false, reason: 'no_image' });
      return _loadImageCached(opts.src).then(function (img) {   // [이슈10] 캐시 디코드 — 반복 commit 가속
        var cv, ctx, png;
        try {
          cv = document.createElement('canvas'); cv.width = img.naturalWidth || img.width; cv.height = img.naturalHeight || img.height;
          ctx = cv.getContext('2d', { willReadFrequently: true });
          var contrast = Math.max(0, 1 + (a.contrast || 0) / 100);   // 대비: 워커 미지원 → 캔버스 필터
          var soft = (a.sharpness || 0) < 0 ? (Math.min(100, -(a.sharpness || 0)) * 0.02) : 0;  // 선명도 좌(-)=부드러움
          var cf = [];
          if (contrast !== 1) cf.push('contrast(' + contrast.toFixed(3) + ')');
          if (soft > 0) cf.push('blur(' + soft.toFixed(2) + 'px)');
          ctx.filter = cf.length ? cf.join(' ') : 'none';
          ctx.drawImage(img, 0, 0); ctx.filter = 'none';
          png = /^data:image\/png/i.test(opts.src);
        } catch (_e) { return { ok: false, reason: 'canvas' }; }
        return new Promise(function (resolve) {
          var finish = function () {
            try { resolve({ ok: true, dataUrl: png ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.92) }); }
            catch (_e2) { resolve({ ok: false, reason: 'encode' }); }
          };
          var wf = window.PhotoEditorWorkerFilter;
          if (!wf || !has(wf.adjustCanvas)) { finish(); return; }   // 워커 없으면 대비만 적용한 결과 반환
          var adj = { brightness: 100 + (a.brightness || 0) * 0.6, saturate: 100 + (a.saturation || 0) * 0.8, temperature: (a.color || 0) * 0.6 };
          wf.adjustCanvas(cv, adj).then(function () {
            var sh = Math.max(0, (a.sharpness || 0));
            if (sh > 0 && has(wf.unsharpCanvas)) { wf.unsharpCanvas(cv, sh / 100).then(finish, finish); }
            else finish();
          }, function () { finish(); });
        });
      }).catch(function () { return { ok: false, reason: 'bad_image' }; });
	    },

	    // [이슈9] 편집 진입 시 부위 마스크/모델 사전 워밍업 — 슬라이더 조작 전에 마스크가 준비되게 함.
	    //   근본 원인: 작업실은 sclera/brow/eyelash 를 sync 게터(getCachedSync)로만 조회하는데, MediaPipe(Tier2)
	    //   모델이 로드돼 있지 않으면 캐시가 영영 비어 헤어볼륨/눈썹/눈가가 전역 fallback(거의 no-op)으로 떨어진다.
	    //   여기서 모델 로드 + getMasksForBeauty(skin/hair/eye…) + 눈/눈썹/속눈썹 LAZY 마스크를 미리 트리거해
	    //   RegionMaskProvider 캐시를 채워두면, 이후 commit 의 sync 게터가 실제 Tier2 마스크를 반환한다.
	    //   전부 추가형(기존 경로 무변경)·실패 무해(휴리스틱 폴백 유지).
	    warmMasks: function (src) {
	      try {
	        if (window.MediaPipeLoader && has(window.MediaPipeLoader.load) &&
	            !(has(window.MediaPipeLoader.isReady) && window.MediaPipeLoader.isReady())) {
	          Promise.resolve(window.MediaPipeLoader.load()).catch(function () {});
	        }
	      } catch (_e) { /* ignore */ }
	      if (!src) return Promise.resolve(false);
	      return _loadImageCached(src).then(function (img) {
	        var MA = window.MaskApplication;
	        if (!MA) return false;
	        var jobs = [];
	        if (has(MA.getMasksForBeauty)) jobs.push(Promise.resolve(MA.getMasksForBeauty(img)).catch(function () { return null; }));
	        try { if (has(MA.getLashMaskSync)) MA.getLashMaskSync(img); } catch (_e2) { /* ignore */ }
	        try { if (has(MA.getScleraMaskSync)) MA.getScleraMaskSync(img); } catch (_e3) { /* ignore */ }
	        try { if (has(MA.getBrowMaskSync)) MA.getBrowMaskSync(img); } catch (_e4) { /* ignore */ }
	        return Promise.all(jobs).then(function () { return true; }).catch(function () { return false; });
	      }).catch(function () { return false; });
	    },

	    applyBeautyAdjust: _applyBeautyAdjust,
	    applyWorkspaceCorrections: function (opts) {
	      opts = opts || {};
	      if (!opts.src) return Promise.resolve({ ok: false, reason: 'no_image' });
	      var src = opts.src;
	      var base = _hasValues(opts.adjust) ? WorkspaceAdapter.applyPixelAdjust({ src: src, adjust: opts.adjust }) : Promise.resolve({ ok: true, dataUrl: src });
	      return base.then(function (r) {
	        src = (r && r.ok && r.dataUrl) ? r.dataUrl : src;
	        return _hasValues(opts.beauty) ? _applyBeautyAdjust({ src: src, beauty: opts.beauty, maskKey: opts.maskKey, previewMaxPx: opts.previewMaxPx }) : { ok: true, dataUrl: src };
	      });
	    },
	    applyWorkspaceTemplate: _applyWorkspaceTemplate,

    // 배경/누끼 — PhotoEditorBgCompose.compose 순수 함수만 호출(UI 無). 실패 사유 분기.
    applyWorkspaceBgAction: function (opts) {
      opts = opts || {};
      if (!(window.PhotoEditorBgCompose && has(window.PhotoEditorBgCompose.compose))) {
        return Promise.resolve({ ok: false, reason: 'no_bg_engine', toast: '배경 엔진을 불러오지 못했어요' });
      }
      if (!opts.src) return Promise.resolve({ ok: false, reason: 'no_image', toast: '배경을 적용할 사진이 없어요' });
      if (opts.action === 'image' && !opts.bgImage) return Promise.resolve({ ok: false, reason: 'no_bg_image', toast: '배경 이미지를 먼저 선택해 주세요' });
      var bg = opts.action === 'image' ? { imageData: opts.bgImage }
        : opts.action === 'color' ? { type: 'procedural', color: opts.color || '#ffffff' }
        : opts.action === 'blur' ? { type: 'blur' } : { type: 'none' };
      return Promise.resolve(window.PhotoEditorBgCompose.compose({ srcUrl: opts.src, bg: bg, targetRatio: opts.ratio || 'original' }))
        .then(function (r) {
          if (!r) return { ok: false, reason: 'compose_empty', toast: '배경 처리에 실패했어요' };
          var url = opts.action === 'removeBg' ? (r.removedBgDataUrl || r.composedDataUrl) : (r.composedDataUrl || r.removedBgDataUrl);
          // removedBg(투명 인물 누끼)를 함께 반환 → 작업실이 배경/인물을 분리 보관해, 이후 보정을 인물에만 적용하고 재합성.
          return url ? { ok: true, dataUrl: url, removedBg: r.removedBgDataUrl || null } : { ok: false, reason: 'no_output', toast: '배경 처리 결과가 없어요' };
        }).catch(function (e) {
          // 에러 메시지 추출 — Error 면 .message, Event(이미지/네트워크 onerror) 면 .type 으로.
          var isEvent = (typeof Event !== 'undefined' && e instanceof Event) || (e && e.target && e.type && !e.message);
          var msg = isEvent ? ('event:' + (e.type || 'error')) : String((e && e.message) || e || '');
          var offline = (typeof navigator !== 'undefined' && navigator.onLine === false);
          var reason, t;
          if (/한도|429|quota/i.test(msg)) { reason = 'quota'; t = (e && e.message) || '오늘 배경 제거 한도를 다 썼어요'; }
          else if (offline) { reason = 'network'; t = '네트워크 연결을 확인해 주세요'; }
          else if (/imgly|removeBackground|_lazyImgly/i.test(msg)) { reason = 'imgly'; t = '누끼 모듈을 불러오지 못했어요 — 잠시 후 다시'; }
          else if (/누끼|배경|remove-bg|서버|HTTP|status|40\d|50\d|fetch|network/i.test(msg)) { reason = 'server_removebg'; t = '서버 누끼 처리에 실패했어요 — 잠시 후 다시'; }
          else if (/image|load|decode|invalid|unsupported|format|event:error/i.test(msg)) { reason = 'bad_image'; t = '이 사진은 배경 처리를 못 했어요 — 다른 사진으로 시도해 주세요'; }
          // 사유 특정 불가 — 꾸며내지 않고 정직하게 재시도 안내
          else { reason = 'bg_process'; t = '배경 처리에 실패했어요 — 잠시 후 다시 시도해 주세요'; }
          console.warn('[wsadapter] bg fail', reason, msg);
          return { ok: false, reason: reason, toast: t };
        });
    },

    // 캡션 — DOM 비의존 엔진. 시술 내역/맥락 없으면 안내(무작정 생성 금지).
    generateCaption: function (opts) {
      opts = opts || {};
      if (!(window.CaptionEngine && has(window.CaptionEngine.generate))) {
        return Promise.resolve({ ok: false, reason: 'no_engine', toast: '캡션 엔진을 불러오지 못했어요' });
      }
      if (!String(opts.service || opts.photo_context || '').trim()) {
        return Promise.resolve({ ok: false, reason: 'need_service', toast: '시술 내역을 먼저 입력해 주세요' });
      }
      return window.CaptionEngine.generate(opts).then(function (r) {
        return { ok: true, caption: r.caption, hashtags: r.hashtags, hashtagsText: r.hashtagsText, log_id: r.log_id };
      }).catch(function (e) {
        console.warn('[wsadapter] caption', e);
        return { ok: false, reason: 'api', toast: '캡션 생성에 실패했어요 — 잠시 후 다시' };
      });
    },

    // 고객 연결 — Customer.pick (자체 오버레이 z-10800, 위에 정상 표시)
    // 고정 꼬리말(caption_template) 영속화 — PUT /shop/persona. 빈 값이면 BE가 자동첨부 생략.
    setCaptionTemplate: function (text) {
      var headers = window.authHeader ? window.authHeader() : {};
      headers['Content-Type'] = 'application/json';
      var url = (typeof window.apiUrl === 'function') ? window.apiUrl('/shop/persona') : ((window.API || '') + '/shop/persona');
      return fetch(url, { method: 'PUT', headers: headers, body: JSON.stringify({ caption_template: String(text == null ? '' : text) }) })
        .then(function (res) { return res.ok ? { ok: true } : res.json().catch(function () { return {}; }).then(function (j) { return { ok: false, toast: j.detail || ('저장 실패 (' + res.status + ')') }; }); })
        .catch(function () { return { ok: false, toast: '네트워크 오류로 저장하지 못했어요' }; });
    },

    pickCustomer: function (selectedId) {
      if (!(window.Customer && has(window.Customer.pick))) {
        return Promise.resolve({ ok: false, reason: 'no_customer', toast: '고객 모듈을 불러오지 못했어요' });
      }
      return Promise.resolve(window.Customer.pick({ selectedId: selectedId || null })).then(function (picked) {
        if (!picked || picked.id == null) return { ok: false, reason: 'cancel' };
        return { ok: true, id: picked.id, name: picked.name };
      });
    },

    // 최근 고객(실데이터) — Customer.list (SWR 캐시). 없으면 [] → V2 가 empty-state 표시. 데모데이터 없음.
    recentCustomers: function (limit) {
      if (!(window.Customer && has(window.Customer.list))) return Promise.resolve([]);
      return Promise.resolve(window.Customer.list()).then(function (items) {
        items = Array.isArray(items) ? items.slice() : [];
        items.sort(function (a, b) { return new Date((b && b.last_visit_at) || 0) - new Date((a && a.last_visit_at) || 0); });
        return items.slice(0, limit || 5).map(function (c) {
          var vc = c.visit_count || 0;
          var sub = [c.phone || '', (vc ? vc + '회' : '')].filter(Boolean).join(' · ');
          return { id: c.id, n: c.name, p: sub, vc: vc };
        });
      }).catch(function () { return []; });
    },

    // 인스타 게이트 — 연결 안 됐으면 실제 업로드 노출 금지
	    instagram: function () {
	      var connected = _igProfile().connected;
	      return { connected: connected, next: connected ? 'publish' : 'prepare' };
	    },
	    instagramProfile: _igProfile,
    // 실제 업로드(연결+확인 시에만 호출). 기존 doPublishFromCaption/doActualPublish 재사용.
	    publishInstagram: function (slot) {
	      if (!_igProfile().connected) { return Promise.resolve({ ok: false, reason: 'not_connected' }); }
      try { if (slot && slot.id) window._captionSlotId = slot.id; } catch (_e) { /* ignore */ }
      if (has(window.doPublishFromCaption)) { return Promise.resolve(window.doPublishFromCaption()).then(function () { return { ok: true }; }).catch(function (e) { return { ok: false, reason: 'api', error: String(e) }; }); }
      if (has(window.doActualPublish)) { return Promise.resolve(window.doActualPublish()).then(function () { return { ok: true }; }).catch(function (e) { return { ok: false, reason: 'api', error: String(e) }; }); }
      return Promise.resolve({ ok: false, reason: 'no_publish_fn' });
    },
    // [Phase 5-2] V2 전용 실게시 — 레거시 baCanvas/previewFinalCaption/_captionSlotId 의존 제거.
    //  저장된 slot 의 이미지(dataUrl)→blob→/instagram/publish-file. 서버 200 + body 성공마커 확인 시에만 ok.
    //  성공 애매(200이나 마커 없음) → reason:'ambiguous' (호출부에서 게시 준비까지만 처리).
	    publishInstagramV2: function (opts) {
	      opts = opts || {};
	      if (!_igProfile().connected) return Promise.resolve({ ok: false, reason: 'not_connected' });
      if (!opts.imageUrl) return Promise.resolve({ ok: false, reason: 'blob' });
      if (!has(window.apiFetch)) return Promise.resolve({ ok: false, reason: 'api' });
      return Promise.resolve(fetch(opts.imageUrl).then(function (r) { return r.blob(); }).catch(function () { return null; }))
        .then(function (blob) {
          if (!blob) return { ok: false, reason: 'blob' };
          var fd = new FormData();
          fd.append('image', blob, 'itdasy_v2.png');
          fd.append('caption', opts.caption || '');
          return window.apiFetch('/instagram/publish-file', { method: 'POST', headers: (has(window.authHeader) ? window.authHeader() : {}), body: fd })
            .then(function (res) {
              return Promise.resolve(res.json().catch(function () { return {}; })).then(function (data) {
                data = data || {};
                if (!res.ok) return { ok: false, reason: 'server', detail: data.detail || data.error || ('HTTP ' + res.status) };
                if (data.error || data.detail) return { ok: false, reason: 'server', detail: data.error || data.detail };
                var ok = data.ok === true || data.success === true || data.published === true ||
                  data.id || data.media_id || data.permalink || data.status === 'published' || data.status === 'success';
                return ok ? { ok: true, data: data } : { ok: false, reason: 'ambiguous' };
              });
            }).catch(function (e) { console.warn('[wsadapter] publishV2', e); return { ok: false, reason: 'api' }; });
        });
    },
    connectInstagram: function () { if (has(window.connectInstagram)) { window.connectInstagram(); return { ok: true }; } return { ok: false, reason: 'no_fn' }; },
    copyText: function (text) {
      try { if (navigator.clipboard) { navigator.clipboard.writeText(text || ''); toast('캡션을 복사했어요'); return { ok: true }; } } catch (_e) { /* ignore */ }
      return { ok: false, reason: 'no_clipboard' };
    },
    saveImage: function (dataUrl, name) {
      if (!dataUrl) return { ok: false, reason: 'no_image' };
      try { var a = document.createElement('a'); a.href = dataUrl; a.download = (name || 'itdasy') + '.jpg'; document.body.appendChild(a); a.click(); a.remove(); toast('이미지를 저장했어요'); return { ok: true }; } catch (_e) { return { ok: false }; }
    },

    // 가격표 — 전용 OCR 흐름 (사진 편집/홍보 흐름과 분리)
    openPriceList: function () {
      if (has(window.openPricelistUpload)) { window.openPricelistUpload(); return { ok: true }; }
      return { ok: false, reason: 'not_impl', toast: '가격표 기능을 불러오지 못했어요' };
    },

    // 작업실 저장 — saveSlotToDB + saveToGallery(dedupeKey). base64 중복 저장 안 함(slot.photos 그대로).
    saveItem: function (slot) {
      if (!has(window.saveSlotToDB)) return Promise.resolve({ ok: false, reason: 'no_db' });
      return Promise.resolve(window.saveSlotToDB(slot)).then(function () {
        if (has(window.saveToGallery)) { try { window.saveToGallery(slot); } catch (_e) { /* ignore */ } }
        return { ok: true };
      }).catch(function (e) { console.warn('[wsadapter] save', e); return { ok: false, reason: 'db' }; });
    },
  };

  window.WorkspaceAdapter = WorkspaceAdapter;
})();
