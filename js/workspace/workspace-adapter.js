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
          var sub = [c.phone || '', (c.visit_count ? c.visit_count + '회' : '')].filter(Boolean).join(' · ');
          return { id: c.id, n: c.name, p: sub };
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
