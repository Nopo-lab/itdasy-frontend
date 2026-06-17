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
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () {
          var cv, ctx, png;
          try {
            cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
            ctx = cv.getContext('2d', { willReadFrequently: true });
            var contrast = Math.max(0, 1 + (a.contrast || 0) / 100);   // 대비: 워커 미지원 → 캔버스 필터
            ctx.filter = contrast !== 1 ? ('contrast(' + contrast.toFixed(3) + ')') : 'none';
            ctx.drawImage(img, 0, 0); ctx.filter = 'none';
            png = /^data:image\/png/i.test(opts.src);
          } catch (_e) { resolve({ ok: false, reason: 'canvas' }); return; }
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
        };
        img.onerror = function () { resolve({ ok: false, reason: 'bad_image' }); };
        img.src = opts.src;
      });
    },

    // 배경/누끼 — PhotoEditorBgCompose.compose 순수 함수만 호출(UI 無). 실패 사유 분기.
    applyWorkspaceBgAction: function (opts) {
      opts = opts || {};
      if (!(window.PhotoEditorBgCompose && has(window.PhotoEditorBgCompose.compose))) {
        return Promise.resolve({ ok: false, reason: 'no_bg_engine', toast: '배경 엔진을 불러오지 못했어요' });
      }
      if (!opts.src) return Promise.resolve({ ok: false, reason: 'no_image', toast: '배경을 적용할 사진이 없어요' });
      var bg = opts.action === 'color' ? { type: 'procedural', color: opts.color || '#ffffff' }
        : opts.action === 'blur' ? { type: 'blur' } : { type: 'none' };
      return Promise.resolve(window.PhotoEditorBgCompose.compose({ srcUrl: opts.src, bg: bg, targetRatio: opts.ratio || 'original' }))
        .then(function (r) {
          if (!r) return { ok: false, reason: 'compose_empty', toast: '배경 처리에 실패했어요' };
          var url = opts.action === 'removeBg' ? (r.removedBgDataUrl || r.composedDataUrl) : (r.composedDataUrl || r.removedBgDataUrl);
          return url ? { ok: true, dataUrl: url } : { ok: false, reason: 'no_output', toast: '배경 처리 결과가 없어요' };
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
      var connected = igConnected();
      return { connected: connected, next: connected ? 'publish' : 'prepare' };
    },
    // 실제 업로드(연결+확인 시에만 호출). 기존 doPublishFromCaption/doActualPublish 재사용.
    publishInstagram: function (slot) {
      if (!igConnected()) { return Promise.resolve({ ok: false, reason: 'not_connected' }); }
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
      if (!igConnected()) return Promise.resolve({ ok: false, reason: 'not_connected' });
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
