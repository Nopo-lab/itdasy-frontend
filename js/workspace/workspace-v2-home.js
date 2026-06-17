/* Workspace V2 — 작업실 첫 화면 렌더러 (Phase 1.5: 디자인 표면 완전 이식)
   의존: WorkspaceState (workspace-state.js), 기존 전역: handleGalleryUpload / loadSlotsFromDB /
        initWorkshopTab / showToast (app-gallery / app-core).
   설계: 프로토타입(itdasy_prototype_latest.html)의 작업실 home 을 컴포넌트로 분해 이식.
        - 메인 시작 CTA + 새 콘텐츠 만들기(카테고리) + 내 콘텐츠(필터탭 + 카드) + V2 카드 상세 drawer
   [Phase 1.5 원칙 — 구 UI 누수 완전 차단]
        - 카드 탭 → V2 drawer (구 openSlotEditor/slot 팝업 직접 호출 금지)
        - drawer 액션 버튼 → V2 toast 만 (기존 기능 연결은 Phase 2)
        - 메인 CTA / 카테고리 탭 → 기존 업로드(handleGalleryUpload)만 허용
        - 새 기능/크롭/구조변경 없음. 폴백(ITDASY_WORKSPACE_V2=false) 유지. */
(function () {
  'use strict';

  var ST = function () { return window.WorkspaceState; };
  var _filter = 'all';        // all | progress | ready | done
  var _lastRoot = null;
  var _slotsCache = [];
  var PHASE2_MSG = '기존 기능 연결은 Phase 2에서 진행돼요';

  var CATS = [
    { key: 'ba',     label: '전후 콘텐츠', ic: 'ph-arrows-left-right', tone: 'pink' },
    { key: 'flex',   label: '시술 자랑',   ic: 'ph-sparkle',          tone: 'amber' },
    { key: 'review', label: '고객 후기',   ic: 'ph-chat-circle-dots', tone: 'blue' },
    { key: 'event',  label: '이벤트',      ic: 'ph-megaphone',        tone: 'green' },
    { key: 'price',  label: '가격표',      ic: 'ph-receipt',          tone: 'purple' },
  ];

  function _esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function _toast(msg) { if (window.showToast) window.showToast(msg); }

  function _thumb(slot) {
    var p = (slot.photos || [])[0];
    return p ? (p.editedDataUrl || p.dataUrl || '') : '';
  }
  function _roleHint(slot) {
    var n = (slot.photos || []).length;
    return n >= 2 ? '전후' : (n === 1 ? '홍보컷' : '사진 없음');
  }
  function _relTime(slot) {
    var t = slot.createdAt || slot.completedAt || 0;
    if (!t) return '';
    var d = Date.now() - t;
    if (d < 60000) return '방금 전';
    if (d < 3600000) return Math.floor(d / 60000) + '분 전';
    if (d < 86400000) return Math.floor(d / 3600000) + '시간 전';
    return Math.floor(d / 86400000) + '일 전';
  }

  /* ── 컴포넌트 ── */
  function _uploadCardHTML() {
    return '' +
      '<button type="button" class="wsv2-upload" data-wsv2-upload data-haptic="medium">' +
        '<div class="wsv2-upload__h">새 콘텐츠 시작하기</div>' +
        '<div class="wsv2-upload__p">사진을 올리면 편집부터 캡션까지 알아서 도와드려요.</div>' +
        '<span class="wsv2-upload__btn"><i class="ph-duotone ph-upload-simple" aria-hidden="true"></i>사진으로 시작하기</span>' +
      '</button>' +
      '<input type="file" accept="image/*" multiple data-wsv2-file hidden>';
  }

  function _categoryHTML() {
    var cards = CATS.map(function (c) {
      return '<button type="button" class="wsv2-cat wsv2-cat--' + c.tone + '" data-wsv2-cat="' + c.key + '" data-haptic="light">' +
        '<span class="wsv2-cat__ic"><i class="ph-duotone ' + c.ic + '" aria-hidden="true"></i></span>' +
        '<span class="wsv2-cat__t">' + _esc(c.label) + '</span>' +
      '</button>';
    }).join('');
    return '' +
      '<div class="wsv2-sec-head"><h2>새 콘텐츠 만들기</h2><span class="wsv2-sec-sub">목적을 골라보세요</span></div>' +
      '<div class="wsv2-cats">' + cards + '</div>';
  }

  function _cardHTML(slot) {
    var st = ST();
    var meta = st.statusMeta(st.deriveStatus(slot));
    var img = _thumb(slot);
    var sub = _relTime(slot);
    return '' +
      '<article class="wsv2-card" data-wsv2-slot="' + _esc(slot.id) + '" data-haptic="light">' +
        '<div class="wsv2-card__thumb"' + (img ? ' style="background-image:url(' + _esc(img) + ')"' : '') + '>' +
          (img ? '' : '<i class="ph-duotone ph-image" aria-hidden="true"></i>') +
        '</div>' +
        '<div class="wsv2-card__body">' +
          '<span class="wsv2-badge wsv2-badge--' + meta.tone + '">' + _esc(meta.label) + '</span>' +
          '<div class="wsv2-card__title">' + _esc(slot.label || '제목 없음') + '</div>' +
          (sub ? '<div class="wsv2-card__sub">수정 ' + _esc(sub) + '</div>' : '') +
          '<div class="wsv2-card__meta">' +
            '<span><i class="ph-duotone ph-images" aria-hidden="true"></i>' + (slot.photos || []).length + '장</span>' +
            '<span><i class="ph-duotone ph-tag" aria-hidden="true"></i>' + _esc(_roleHint(slot)) + '</span>' +
          '</div>' +
        '</div>' +
        '<span class="wsv2-card__dots"><i class="ph-duotone ph-dots-three-outline" aria-hidden="true"></i></span>' +
      '</article>';
  }

  function _tabsHTML(slots) {
    var st = ST();
    var g = { all: slots.length, progress: 0, ready: 0, done: 0 };
    slots.forEach(function (s) { g[st.filterGroup(s)]++; });
    var tabs = [
      { key: 'all', label: '전체' }, { key: 'progress', label: '진행 중' },
      { key: 'ready', label: '게시 준비' }, { key: 'done', label: '완료' },
    ];
    return '<div class="wsv2-tabs" role="tablist">' + tabs.map(function (t) {
      return '<button type="button" class="wsv2-tab' + (_filter === t.key ? ' is-active' : '') +
        '" data-wsv2-filter="' + t.key + '" data-haptic="light">' + _esc(t.label) +
        '<b>' + (g[t.key] || 0) + '</b></button>';
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
        _uploadCardHTML() +
        _categoryHTML() +
        '<div class="wsv2-sec-head"><h2>내 콘텐츠</h2></div>' +
        _tabsHTML(slots) +
        list +
      '</section>';
  }

  /* ── 렌더 ── */
  function render(root, opts) {
    if (!root) return;
    _lastRoot = root;
    _slotsCache = (opts && opts.slots) || [];
    root.innerHTML = _shellHTML(_slotsCache);
    _bind(root);
  }

  // 재렌더 — initWorkshopTab 경유로 작업실 모듈 _slots 동기화 (업로드 직후 최신 반영)
  function refresh() {
    if (typeof initWorkshopTab === 'function') { Promise.resolve(initWorkshopTab()).catch(function () {}); return; }
    if (!_lastRoot || typeof loadSlotsFromDB !== 'function') return;
    Promise.resolve(loadSlotsFromDB()).then(function (s) { render(_lastRoot, { slots: s || [] }); }).catch(function () {});
  }

  function _bind(root) {
    root.onclick = function (e) {
      if (e.target.closest('[data-wsv2-upload]') || e.target.closest('[data-wsv2-cat]')) { _openUpload(root); return; }
      var tab = e.target.closest('[data-wsv2-filter]');
      if (tab) { _filter = tab.getAttribute('data-wsv2-filter'); render(_lastRoot, { slots: _slotsCache }); return; }
      var card = e.target.closest('[data-wsv2-slot]');
      if (card) { _openDrawer(card.getAttribute('data-wsv2-slot')); return; }
    };
    var fi = root.querySelector('[data-wsv2-file]');
    if (fi) fi.onchange = function (e) {
      var files = Array.from((e.target && e.target.files) || []);
      if (!files.length) return; e.target.value = '';
      _ingest(files);
    };
  }

  function _openUpload(root) {
    var fi = (root || _lastRoot) && (root || _lastRoot).querySelector('[data-wsv2-file]');
    if (fi) fi.click();
  }

  function _ingest(files) {
    if (typeof handleGalleryUpload !== 'function') { _toast('업로드 모듈이 아직 로드되지 않았어요'); return; }
    Promise.resolve(handleGalleryUpload(files)).then(function () { refresh(); })
      .catch(function (err) { console.warn('[wsv2] 업로드 실패', err); _toast('사진을 추가하지 못했어요'); });
  }

  /* ── V2 카드 상세 drawer (구 slot 팝업 대신) ── */
  function _drawerEl() {
    var el = document.getElementById('wsv2Drawer');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'wsv2Drawer';
    el.className = 'wsv2 wsv2-drawer';   // .wsv2 토큰 상속용
    el.innerHTML = '<div class="wsv2-drawer__bd" data-wsv2-drawer-close></div>' +
      '<div class="wsv2-drawer__card" id="wsv2DrawerCard"></div>';
    document.body.appendChild(el);
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-wsv2-drawer-close]')) { _closeDrawer(); return; }
      if (e.target.closest('[data-wsv2-act]')) { _toast(PHASE2_MSG); return; }
    });
    return el;
  }

  function _openDrawer(slotId) {
    var slot = _slotsCache.filter(function (s) { return s.id === slotId; })[0];
    if (!slot) return;
    var st = ST();
    var meta = st.statusMeta(st.deriveStatus(slot));
    var next = st.nextAction(slot);
    var img = _thumb(slot);
    var acts = [
      { ic: 'ph-magic-wand',        label: '사진 편집' },
      { ic: 'ph-layout',            label: '템플릿' },
      { ic: 'ph-pencil-line',       label: '캡션 생성' },
      { ic: 'ph-instagram-logo',    label: '인스타 미리보기' },
      { ic: 'ph-user-circle-plus',  label: '고객 연결' },
    ];
    var html = '' +
      '<div class="wsv2-drawer__grip"></div>' +
      '<div class="wsv2-drawer__hero"' + (img ? ' style="background-image:url(' + _esc(img) + ')"' : '') + '>' +
        (img ? '' : '<i class="ph-duotone ph-image" aria-hidden="true"></i>') + '</div>' +
      '<span class="wsv2-badge wsv2-badge--' + meta.tone + '">' + _esc(meta.label) + '</span>' +
      '<div class="wsv2-drawer__title">' + _esc(slot.label || '제목 없음') + '</div>' +
      '<div class="wsv2-drawer__status">' + (slot.photos || []).length + '장 · ' + _esc(_roleHint(slot)) +
        (_relTime(slot) ? ' · 수정 ' + _esc(_relTime(slot)) : '') + '</div>' +
      '<button type="button" class="wsv2-drawer__primary" data-wsv2-act="next">' +
        '<i class="ph-duotone ph-arrow-right" aria-hidden="true"></i>다음 작업: ' + _esc(next.label) + '</button>' +
      '<div class="wsv2-drawer__hint">' + _esc(PHASE2_MSG) + '</div>' +
      '<div class="wsv2-drawer__grid">' + acts.map(function (a) {
        return '<button type="button" class="wsv2-drawer__act" data-wsv2-act="' + _esc(a.label) + '">' +
          '<i class="ph-duotone ' + a.ic + '" aria-hidden="true"></i>' + _esc(a.label) + '</button>';
      }).join('') + '</div>';
    var el = _drawerEl();
    document.getElementById('wsv2DrawerCard').innerHTML = html;
    requestAnimationFrame(function () { el.classList.add('is-open'); });
  }

  function _closeDrawer() {
    var el = document.getElementById('wsv2Drawer');
    if (el) el.classList.remove('is-open');
  }

  window.WorkspaceV2 = { render: render, refresh: refresh, _closeDrawer: _closeDrawer };
})();
