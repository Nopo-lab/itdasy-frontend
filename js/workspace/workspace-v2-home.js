/* Workspace V2 — 작업실 첫 화면 렌더러 (Phase 1)
   의존: WorkspaceState (workspace-state.js), 기존 전역 handleGalleryUpload / openSlotEditor /
        loadSlotsFromDB / showToast (app-gallery-workshop.js, app-gallery-slot-editor.js, app-gallery-db.js).
   설계: 프로토타입(itdasy_prototype_latest.html)의 작업실 홈을 분해 이식.
        - 콘텐츠 카드 + 상태 배지 + 다음 추천 작업 + 업로드 카드
        - 기존 기능 연결은 "최소" (업로드=handleGalleryUpload, 카드 탭=openSlotEditor)
        - Phase 2 에서 어댑터로 보정/캡션/고객/미리보기 정밀 라우팅 추가 */
(function () {
  'use strict';

  var ST = function () { return window.WorkspaceState; };
  var _filter = 'all'; // all | progress | ready | done
  var _lastRoot = null;

  function _esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function _thumb(slot) {
    var p = (slot.photos || [])[0];
    if (!p) return '';
    return p.editedDataUrl || p.dataUrl || '';
  }

  function _roleHint(slot) {
    var n = (slot.photos || []).length;
    if (n >= 2) return '전후';
    if (n === 1) return '홍보컷';
    return '사진 없음';
  }

  function _cardHTML(slot) {
    var st = ST();
    var status = st.deriveStatus(slot);
    var meta = st.statusMeta(status);
    var next = st.nextAction(slot);
    var img = _thumb(slot);
    var count = (slot.photos || []).length;
    return '' +
      '<article class="wsv2-card" data-wsv2-slot="' + _esc(slot.id) + '" data-haptic="light">' +
        '<div class="wsv2-card__thumb"' + (img ? ' style="background-image:url(' + _esc(img) + ')"' : '') + '>' +
          (img ? '' : '<i class="ph-duotone ph-image" aria-hidden="true"></i>') +
        '</div>' +
        '<div class="wsv2-card__body">' +
          '<span class="wsv2-badge wsv2-badge--' + meta.tone + '">' + _esc(meta.label) + '</span>' +
          '<div class="wsv2-card__title">' + _esc(slot.label || '제목 없음') + '</div>' +
          '<div class="wsv2-card__meta">' +
            '<span><i class="ph-duotone ph-images" aria-hidden="true"></i>' + count + '장</span>' +
            '<span><i class="ph-duotone ph-tag" aria-hidden="true"></i>' + _esc(_roleHint(slot)) + '</span>' +
          '</div>' +
        '</div>' +
        '<button type="button" class="wsv2-card__next" data-wsv2-next="' + _esc(slot.id) + '" data-haptic="light">' +
          _esc(next.label) +
          '<i class="ph-duotone ph-arrow-right" aria-hidden="true"></i>' +
        '</button>' +
      '</article>';
  }

  function _tabsHTML(slots) {
    var st = ST();
    var groups = { all: slots.length, progress: 0, ready: 0, done: 0 };
    slots.forEach(function (s) { groups[st.filterGroup(s)]++; });
    var tabs = [
      { key: 'all',      label: '전체' },
      { key: 'progress', label: '진행 중' },
      { key: 'ready',    label: '게시 준비' },
      { key: 'done',     label: '완료' },
    ];
    return '<div class="wsv2-tabs" role="tablist">' + tabs.map(function (t) {
      return '<button type="button" class="wsv2-tab' + (_filter === t.key ? ' is-active' : '') +
        '" data-wsv2-filter="' + t.key + '" data-haptic="light">' +
        _esc(t.label) + '<b>' + (groups[t.key] || 0) + '</b></button>';
    }).join('') + '</div>';
  }

  function _shellHTML(slots) {
    var st = ST();
    var visible = _filter === 'all' ? slots : slots.filter(function (s) { return st.filterGroup(s) === _filter; });
    var list = visible.length
      ? '<div class="wsv2-list">' + visible.map(_cardHTML).join('') + '</div>'
      : '<div class="wsv2-empty-list"><i class="ph-duotone ph-folder-open" aria-hidden="true"></i>' +
        '<p>' + (slots.length ? '이 상태의 콘텐츠가 없어요' : '아직 콘텐츠가 없어요') + '</p></div>';

    return '' +
      '<section class="wsv2" data-wsv2-root>' +
        '<header class="wsv2-greet">' +
          '<p class="wsv2-greet__sub">사진을 올리면 글까지 자동으로.</p>' +
          '<h1 class="wsv2-greet__title">작업실</h1>' +
        '</header>' +

        '<button type="button" class="wsv2-upload" data-wsv2-upload data-haptic="medium">' +
          '<span class="wsv2-upload__ico"><i class="ph-duotone ph-camera" aria-hidden="true"></i></span>' +
          '<span class="wsv2-upload__copy">' +
            '<b>새 콘텐츠 시작하기</b>' +
            '<span>사진을 올리면 편집부터 캡션까지 도와드려요</span>' +
          '</span>' +
          '<i class="ph-duotone ph-plus wsv2-upload__plus" aria-hidden="true"></i>' +
        '</button>' +
        '<input type="file" accept="image/*" multiple data-wsv2-file hidden>' +

        '<div class="wsv2-sec-head"><h2>내 콘텐츠</h2></div>' +
        _tabsHTML(slots) +
        list +
      '</section>';
  }

  function render(root, opts) {
    if (!root) return;
    _lastRoot = root;
    var slots = (opts && opts.slots) || [];
    root.innerHTML = _shellHTML(slots);
    _bind(root);
  }

  // DB 에서 다시 읽어 재렌더 (업로드/편집 후)
  function refresh() {
    if (!_lastRoot) return;
    if (typeof loadSlotsFromDB !== 'function') return;
    Promise.resolve(loadSlotsFromDB()).then(function (slots) {
      render(_lastRoot, { slots: slots || [] });
    }).catch(function () { /* ignore */ });
  }

  function _bind(root) {
    if (root.dataset.wsv2Bound === '1') { /* re-render: 이벤트는 위임이라 1회면 충분 */ }
    // innerHTML 교체 시마다 새 노드라 위임 핸들러를 매번 건다 (중복 방지 위해 플래그 사용 안 함)
    root.onclick = function (e) {
      var up = e.target.closest('[data-wsv2-upload]');
      if (up) { root.querySelector('[data-wsv2-file]') && root.querySelector('[data-wsv2-file]').click(); return; }

      var tab = e.target.closest('[data-wsv2-filter]');
      if (tab) { _filter = tab.getAttribute('data-wsv2-filter'); refresh(); return; }

      var next = e.target.closest('[data-wsv2-next]');
      if (next) { e.stopPropagation(); _openSlot(next.getAttribute('data-wsv2-next')); return; }

      var card = e.target.closest('[data-wsv2-slot]');
      if (card) { _openSlot(card.getAttribute('data-wsv2-slot')); return; }
    };

    var fileInput = root.querySelector('[data-wsv2-file]');
    if (fileInput) {
      fileInput.onchange = function (e) {
        var files = Array.from((e.target && e.target.files) || []);
        if (!files.length) return;
        e.target.value = '';
        _ingest(files);
      };
    }
  }

  function _openSlot(slotId) {
    // Phase 1: 카드/추천작업 → 기존 슬롯 편집 흐름으로 위임 (Phase 2 에서 단계별 정밀 라우팅)
    if (typeof openSlotEditor === 'function') openSlotEditor(slotId);
    else if (window.showToast) window.showToast('편집 화면을 불러오지 못했어요');
  }

  function _ingest(files) {
    // 기존 업로드 파이프라인 재사용 (handleGalleryUpload 가 슬롯 자동분류 + DB 저장)
    if (typeof handleGalleryUpload !== 'function') {
      if (window.showToast) window.showToast('업로드 모듈이 아직 로드되지 않았어요');
      return;
    }
    Promise.resolve(handleGalleryUpload(files)).then(function () {
      refresh();
    }).catch(function (err) {
      console.warn('[wsv2] 업로드 실패', err);
      if (window.showToast) window.showToast('사진을 추가하지 못했어요');
    });
  }

  window.WorkspaceV2 = { render: render, refresh: refresh };
})();
