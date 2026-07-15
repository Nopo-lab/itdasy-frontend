/* Workspace V2 — 작업실 첫 화면 렌더러 (개편 2026-07-15: 프로필 헤더 + 이어서 카드 + 세그 + 3열 피드)
   의존: WorkspaceState (workspace-state.js), 기존 전역: loadSlotsFromDB / initWorkshopTab / showToast. */
(function () {
  'use strict';

  var ST = function () { return window.WorkspaceState; };
  var _filter = 'all';   // [conceptC] all | progress | done
  var _lastRoot = null;
  var _slotsCache = [];
  var _menuOpen = false;            // [개편 2026-07-15] 헤더 ⋯ 드롭다운(선택/설정) 열림 상태
  var _selectMode = false;          // [v547] 내 콘텐츠 일괄 작업 선택 모드
  var _selected = {};               // id → true
  var _enteredCardId = null;        // [v547] 카드→편집 진입 시 저장 → 복귀 후 그 카드로 스크롤 복원
  var _drawerSlotId = null;
  var DRAWER_HINT = '추천 작업부터 이어서 진행해요';
  // [요청1 2026-07-13] '인스타 미리보기'는 요청6에서 캡션 화면에 흡수됨 → preview 대신 caption 으로 딥링크.
  //   (안 그러면 캡션 완성 슬롯 '이어서 편집' 시 폐지된 단독 preview 화면으로 새어 '예전 화면' 처럼 보였음)
  var ACT2SCREEN = { '사진 편집':'edit', '누끼/배경':'edit', '비율 자르기':'edit', '템플릿':'edit', '게시글 생성':'caption', '인스타 미리보기':'caption', '고객 연결':'connect' };
  // [요청1 2026-07-13] 상태머신 preview/done 도 caption 으로(통합 화면 = 결과+발행+피드). 캡션 있는 슬롯은 open() 이 d.caption 복원 → 결과 화면 표시.
  var KEY2SCREEN = { upload:'upload', edit:'edit', caption:'caption', customer:'connect', preview:'caption', done:'caption' };

  function _esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch];
    });
  }
  function _toast(msg) { if (window.showToast) window.showToast(msg); }

  function _thumb(slot) {
    // [이슈2] 전후 템플릿 적용본이 있으면 저장카드도 그 합성 결과를 보여준다.
    //   (원본 사진은 더 이상 합성본으로 덮어쓰지 않으므로 여기서 명시적으로 우선 참조)
    // [다중pair] 페어별 결과물 배열(templateOutputs)이 있으면 첫 결과물, 없으면 단일 templateOutput 폴백.
    if (slot.templateOutputs && slot.templateOutputs.length && slot.templateOutputs[0].outputUrl) return slot.templateOutputs[0].outputUrl;
    if (slot.templateOutput) return slot.templateOutput;
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

  // [v531] 유형별 기본 템플릿 저장(localStorage). flow.js 가 get/set 으로 공유(window).
  if (!window.WorkspaceDefaultTpl) {
    window.WorkspaceDefaultTpl = {
      _k: function (cat) { return 'itdasy:wsv2_default_tpl_' + cat; },
      get: function (cat) { try { return localStorage.getItem(this._k(cat)) || ''; } catch (_e) { return ''; } },
      set: function (cat, id) { try { localStorage.setItem(this._k(cat), id); return true; } catch (_e) { return false; } },
    };
  }

  /* ── [conceptC] 작업실 홈 디자인 — 프로필 헤더 + 이어서 카드 + 세그 + 콘텐츠 그리드 ── */
  function _shopName() {
    try { var s = localStorage.getItem('shop_name'); if (s && s.trim()) return s.trim(); } catch (_e) { /* noop */ }
    return '내 샵';
  }
  function _igProfile() {
    try {
      if (window.WorkspaceAdapter && typeof window.WorkspaceAdapter.instagramProfile === 'function') return window.WorkspaceAdapter.instagramProfile() || {};
    } catch (_e) { /* noop */ }
    return {};
  }


  // [인스타 피드 홈] 좌상단 + = 바로 업로드, 나머지 칸 = 우리가 만든 콘텐츠(정사각 타일).
  var _PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>';
  var _PHIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
  function _feedTile(slot) {
    var img = _thumb(slot), sel = !!_selected[slot.id];
    // [개편 2026-07-15] 타일 뱃지 소음 제거 — 발행된 타일은 사진만. 진행 중만 좌하단 흰 칩 하나('작성 중', 예약 발행은 '예약').
    var chip = _isPub(slot) ? ''
      : '<span class="wf-chip">' + ((slot.publish && slot.publish.status === 'scheduled') ? '예약' : '작성 중') + '</span>';
    return '<button type="button" class="wf-tile' + (_selectMode ? ' wf-tile--sel' : '') + (sel ? ' is-sel' : '') +
      '" data-wsv2-slot="' + _esc(slot.id) + '" data-haptic="light"' + (img ? ' style="background-image:url(' + _esc(img) + ')"' : '') + '>' +
      (_selectMode ? '<span class="wf-check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>' : '') +
      chip +
      (img ? '' : '<span class="wf-ph" aria-hidden="true">' + _PHIC + '</span>') +
      '</button>';
  }
  function _segsHTML(slots) {
    var done = slots.filter(_isPub).length;
    var F = [['all', '전체', slots.length], ['progress', '진행중', slots.length - done], ['done', '발행됨', done]];
    return '<div class="wf-segs">' + F.map(function (f) {
      return '<button type="button" class="wf-seg' + (_filter === f[0] ? ' on' : '') + '" data-wsv2-filter="' + f[0] + '">' +
        f[1] + '<span class="wf-seg__n">' + f[2] + '</span></button>';
    }).join('') + '</div>';
  }
  // [개편 2026-07-15] 이어서 카드 — 썸네일 + 제목 + 상태 한 줄 + 검정 '이어서' 버튼(목업 ① 톤).
  function _resumeMsg(slot) {
    var photos = slot.photos || [];
    var edited = photos.some(function (p) { return p && (p.editedDataUrl || p.storyEdited || p.cropMeta); });
    if (!edited) return '사진 완료 · 편집이 남았어요';
    if (!(slot.caption && String(slot.caption).trim())) return '편집까지 완료 · 캡션이 남았어요';
    return '캡션까지 완료 · 발행만 남았어요';
  }
  function _resumeCardHTML(slots) {
    var cand = slots.filter(function (s) { return !_isPub(s) && (s.photos || []).length; });
    if (!cand.length) return '';
    cand.sort(function (a, b) { return (b.createdAt || b.completedAt || 0) - (a.createdAt || a.completedAt || 0); });
    var slot = cand[0], img = _thumb(slot);
    return '<button type="button" class="wf-resume" data-wsv2-resume="' + _esc(slot.id) + '" data-haptic="light">' +
      '<span class="wf-resume__thumb"' + (img ? ' style="background-image:url(' + _esc(img) + ')"' : '') + '></span>' +
      '<span class="wf-resume__body">' +
        '<span class="wf-resume__title">' + _esc(slot.label || '제목 없음') + '</span>' +
        '<span class="wf-resume__sub">' + _esc(_resumeMsg(slot)) + '</span>' +
      '</span>' +
      '<span class="wf-resume__go">이어서</span>' +
    '</button>';
  }
  // [개편 2026-07-15] 헤더 — @인스타핸들 + 샵이름(미연결이면 샵이름 크게 + '인스타 연결').
  //   설정 톱니·선택 버튼은 ⋯ 드롭다운(선택/설정) 하나로 통합, '할 일·이번 달 발행' 줄은 세그 카운트와 중복이라 삭제.
  function _pheadHTML() {
    var ig = _igProfile(), shop = _shopName();
    var connected = !!(ig.connected && ig.handle);
    var initial = _esc((((connected ? ig.handle.replace(/^@/, '') : shop).charAt(0)) || 'N').toUpperCase());
    var ava = '<span class="wshc-ava"' + (ig.profilePic ? ' style="background-image:url(' + _esc(ig.profilePic) + ')"' : '') + ' aria-hidden="true">' + (ig.profilePic ? '' : initial) + '</span>';
    var who = connected
      ? '<div class="wshc-who"><b>' + _esc(ig.handle) + '</b><span>' + _esc(shop) + '</span></div>'
      : '<button type="button" class="wshc-who wshc-who--connect" data-wsv2-igconnect data-haptic="light"><b>' + _esc(shop) + '</b><span class="wshc-who__link">인스타 연결</span></button>';
    var DOTS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="5" cy="12" r=".8"/><circle cx="12" cy="12" r=".8"/><circle cx="19" cy="12" r=".8"/></svg>';
    var menu = !_menuOpen ? '' : '<div class="wshc-menu" data-wsv2-menu>' +
      '<button type="button" data-wsv2-menu-act="select" data-haptic="light">' + (_selectMode ? '선택 취소' : '선택') + '</button>' +
      '<button type="button" data-wsv2-menu-act="settings" data-haptic="light">설정</button>' +
    '</div>';
    return '<div class="wshc-phead">' + ava + who +
      '<button type="button" class="wshc-more' + (_menuOpen ? ' on' : '') + '" data-wsv2-more data-haptic="light" aria-label="더보기" aria-expanded="' + (_menuOpen ? 'true' : 'false') + '">' + DOTS + '</button>' +
      menu +
    '</div>';
  }
  function _shellHTML(slots) {
    var visible = _filter === 'all' ? slots : slots.filter(function (s) {
      return _filter === 'done' ? _isPub(s) : !_isPub(s);
    });
    // [버그9 2026-07-14] 인스타 피드처럼 최신이 위로 — 기존엔 slots 순서를 그대로 써서 '+ 새 게시물' 옆에 가장 오래된 게 붙었음.
    //   (이어서카드는 이미 최신순 정렬하는데 그리드만 안 해서 순서가 반대로 보였다.) 원본 배열 오염 방지로 slice() 후 정렬.
    visible = visible.slice().sort(function (a, b) {
      return (b.createdAt || b.completedAt || 0) - (a.createdAt || a.completedAt || 0);
    });
    var addCell = '<button type="button" class="wf-add" data-wsv2-upload data-haptic="medium" aria-label="새 게시물 업로드">' +
      '<span class="wf-add__ic">' + _PLUS + '</span><span class="wf-add__t">새 게시물</span></button>';
    var feed = '<div class="wf-feed">' + addCell + visible.map(_feedTile).join('') + '</div>';
    return '' +
      '<section class="wsv2 wshc wshc--feed" data-wsv2-root>' +
        _pheadHTML() +
        _resumeCardHTML(slots) +
        _segsHTML(slots) +
        '<input type="file" accept="image/*" multiple data-wsv2-file hidden>' +
        feed +
        (_selectMode ? _bulkBarHTML() : '') +
      '</section>';
  }
  // [v547] 일괄 작업 하단 sticky action bar — 선택된 카드에만 적용.
  function _bulkBarHTML() {
    var n = Object.keys(_selected).length;
    return '<div class="wsv2-bulkbar' + (n ? ' on' : '') + '">' +
      '<span class="wsv2-bulkbar__n">' + n + '개 선택</span>' +
      '<div class="wsv2-bulkbar__acts">' +
        '<button type="button" data-wsv2-bulk="publish"' + (n ? '' : ' disabled') + '>게시 완료</button>' +
        '<button type="button" data-wsv2-bulk="unpublish"' + (n ? '' : ' disabled') + '>해제</button>' +
        '<button type="button" class="wsv2-bulkbar__del" data-wsv2-bulk="delete"' + (n ? '' : ' disabled') + '>삭제</button>' +
      '</div>' +
    '</div>';
  }

  /* ── [버그2] 홈 스크롤 위치 보존 — render()가 innerHTML 통째 교체로 맨 위로 튕기던 문제 ── */
  var _homeScrollY = 0;
  var _scrollHostEl = null;
  function _findScrollHost(root) {
    var node = root;
    while (node && node !== document.body && node !== document.documentElement) {
      var oy = '';
      try { oy = getComputedStyle(node).overflowY; } catch (_e) { /* noop */ }
      if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && (node.scrollHeight - node.clientHeight) > 4) return node;
      node = node.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }
  function _isDocHost(h) { return h === document.documentElement || h === document.scrollingElement || h === document.body; }
  function _hostTop(h) { return _isDocHost(h) ? (window.scrollY || (document.scrollingElement || document.documentElement).scrollTop || 0) : (h.scrollTop || 0); }
  function _bindHomeScroll(root) {
    var host = _findScrollHost(root);
    if (!host || _scrollHostEl === host) { _scrollHostEl = host; return; }
    _scrollHostEl = host;
    var tgt = _isDocHost(host) ? window : host;
    tgt.addEventListener('scroll', function () { _homeScrollY = _hostTop(host); }, { passive: true });
  }
  // [v547] 카드→편집 진입 후 복귀 시 그 카드로 정밀 스크롤(삭제됐으면 _homeScrollY 근처 복원으로 폴백).
  function _scrollToEnteredCard() {
    var id = _enteredCardId; if (!id || !_lastRoot) return;
    _enteredCardId = null;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var sel = '[data-wsv2-slot="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]';
        var card = _lastRoot.querySelector(sel);
        if (card && card.scrollIntoView) { try { card.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch (_e) { try { card.scrollIntoView(); } catch (_e2) { /* ignore */ } } }
      });
    });
  }
  function _restoreHomeScroll() {
    var host = _scrollHostEl; if (!host || !_homeScrollY) return;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var max = Math.max(0, host.scrollHeight - host.clientHeight);
        var y = Math.min(_homeScrollY, max);
        if (_isDocHost(host)) window.scrollTo(0, y); else host.scrollTop = y;
      });
    });
  }

  /* ── 렌더 ── */
  function render(root, opts) {
    if (!root) return;
    _lastRoot = root;
	    _slotsCache = (opts && opts.slots) || [];
	    root.innerHTML = _shellHTML(_slotsCache);
	    _bind(root);
	    _bindHeroFile(root);
	    _bindHomeScroll(root);   // [버그2] 스크롤 호스트에 1회 캡처 리스너
	    _restoreHomeScroll();    // [버그2] 재렌더 후 이전 스크롤 위치 복원
	    _scrollToEnteredCard();  // [v547] 카드에서 진입했었다면 복귀 후 그 카드로 정밀 복원
	  }

	  function refresh() {
	    if (typeof initWorkshopTab === 'function') { Promise.resolve(initWorkshopTab()).catch(function () {}); return; }
	    if (!_lastRoot || typeof loadSlotsFromDB !== 'function') return;
	    Promise.resolve(loadSlotsFromDB()).then(function (s) { render(_lastRoot, { slots: s || [] }); }).catch(function () {});
	  }

	  function _pickHeroFiles(root) {
	    var input = root && root.querySelector('[data-wsv2-file]');
	    if (!input) { _launchFlow(null, 'upload'); return; }
	    input.click();
	  }

	  function _bindHeroFile(root) {
	    var input = root && root.querySelector('[data-wsv2-file]');
	    if (!input || input._wsv2Bound) return;
	    input._wsv2Bound = true;
	    input.addEventListener('change', function (e) {
	      var files = Array.from(e.target.files || []);
	      e.target.value = '';
	      if (!files.length) return;
	      // [v564·필수1] 시작하기→파일선택 후 중간 업로드 화면 없이 바로 편집 창으로.
	      // [cleanup] 심플 플로우 상시 — 시작하기→파일선택 후 바로 캡션 생성으로.
      _launchFlow(null, 'caption', { files: files });
	    });
	  }

	  function _bind(root) {
    root.onclick = function (e) {
      // [개편 2026-07-15] 헤더 ⋯ 드롭다운 — 열린 상태에서 바깥 탭 = 닫기(탭 소비, 표준 드롭다운 UX).
      if (_menuOpen && !e.target.closest('[data-wsv2-menu]') && !e.target.closest('[data-wsv2-more]')) {
        _menuOpen = false; render(_lastRoot, { slots: _slotsCache }); return;
      }
      if (e.target.closest('[data-wsv2-more]')) {
        _menuOpen = !_menuOpen; render(_lastRoot, { slots: _slotsCache }); return;
      }
      var mact = e.target.closest('[data-wsv2-menu-act]');
      if (mact) {
        var mk = mact.getAttribute('data-wsv2-menu-act');
        _menuOpen = false;
        if (mk === 'settings') {
          render(_lastRoot, { slots: _slotsCache });
          if (window.WorkspaceSettings && window.WorkspaceSettings.open) window.WorkspaceSettings.open();
          else _toast('설정을 불러오지 못했어요');
        } else {   // 선택 모드 토글(기존 seltoggle 로직 그대로)
          _selectMode = !_selectMode; if (!_selectMode) _selected = {};
          render(_lastRoot, { slots: _slotsCache });
        }
        return;
      }
      // [개편 2026-07-15] 미연결 헤더 '인스타 연결' — 기존 연결 플로우(WorkspaceAdapter.connectInstagram) 재사용, 없으면 설정으로.
      if (e.target.closest('[data-wsv2-igconnect]')) {
        var cr = (window.WorkspaceAdapter && window.WorkspaceAdapter.connectInstagram) ? window.WorkspaceAdapter.connectInstagram() : null;
        if (!cr || !cr.ok) {
          if (window.WorkspaceSettings && window.WorkspaceSettings.open) window.WorkspaceSettings.open();
          else _toast('인스타 연결 화면을 불러오지 못했어요');
        }
        return;
      }
      // [v547] 일괄 작업 — 일괄 액션 / 선택 모드 카드 탭 = 선택
      var bulk = e.target.closest('[data-wsv2-bulk]');
      if (bulk) { _onBulk(bulk.getAttribute('data-wsv2-bulk')); return; }
      if (_selectMode) {
        var selCard = e.target.closest('[data-wsv2-slot]');
        if (selCard) { var sid0 = selCard.getAttribute('data-wsv2-slot'); if (_selected[sid0]) delete _selected[sid0]; else _selected[sid0] = true; render(_lastRoot, { slots: _slotsCache }); return; }
      }
      // 히어로 업로드 CTA
	      if (e.target.closest('[data-wsv2-upload]')) { _pickHeroFiles(root); return; }
      // 필터 탭
      var tab = e.target.closest('[data-wsv2-filter]');
      if (tab) { _filter = tab.getAttribute('data-wsv2-filter'); render(_lastRoot, { slots: _slotsCache }); return; }
      // "이어서" 버튼 — 직접 해당 단계 진입
      var resume = e.target.closest('[data-wsv2-resume]');
      if (resume) { e.stopPropagation(); var sid = resume.getAttribute('data-wsv2-resume'); _resumeSlot(sid); return; }
      // 카드 탭 — Lightbox(풀스크린 보기) 오픈. 오류/이미지 없으면 드로어로 폴백.
      var card = e.target.closest('[data-wsv2-slot]');
      if (card) { _openLightbox(card.getAttribute('data-wsv2-slot')); return; }
    };
  }

  // [Lightbox] 콘텐츠 타일 탭 → 풀스크린 보기(사진 스와이프) + '이어서 편집'. 화면 잘림 방지로 사이드바 위(z 10005).
  var _lbEl = null;
  function _slotImages(slot) {
    var out = [];
    if (slot.templateOutputs && slot.templateOutputs.length) slot.templateOutputs.forEach(function (o) { if (o.outputUrl) out.push(o.outputUrl); });
    else if (slot.templateOutput) out.push(slot.templateOutput);
    (slot.photos || []).forEach(function (p) { var u = p && (p.editedDataUrl || p.dataUrl); if (u && out.indexOf(u) < 0) out.push(u); });
    return out;
  }
  function _closeLightbox() { if (_lbEl && _lbEl.parentNode) _lbEl.parentNode.removeChild(_lbEl); _lbEl = null; try { if (window._markSheetClosed) window._markSheetClosed('wshcLightbox'); } catch (_e) { void _e; } }
  function _openLightbox(slotId) {
    try {
      var slot = _slotsCache.filter(function (s) { return s.id === slotId; })[0]; if (!slot) return;
      var imgs = _slotImages(slot); if (!imgs.length) { _openDrawer(slotId); return; }
      _closeLightbox();
      var idx = 0;
      var ov = document.createElement('div'); ov.className = 'wshc-lb';
      ov.innerHTML = '<button type="button" class="wshc-lb__x" data-lb-close aria-label="닫기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
        '<div class="wshc-lb__stage">' + imgs.map(function (u, i) { return '<div class="wshc-lb__slide' + (i === 0 ? ' on' : '') + '" style="background-image:url(' + _esc(u) + ')"></div>'; }).join('') + '</div>' +
        (imgs.length > 1 ? '<div class="wshc-lb__dots">' + imgs.map(function (u, i) { return '<span' + (i === 0 ? ' class="on"' : '') + '></span>'; }).join('') + '</div>' : '') +
        '<div class="wshc-lb__bar"><button type="button" class="wshc-lb__edit" data-lb-edit>이어서 편집 →</button></div>';
      document.body.appendChild(ov); _lbEl = ov;
      // [#1] 시스템/하드웨어 back 으로 라이트박스가 먼저 닫히게 등록 → 뒤로가기 시 작업실 홈으로.
      try { if (window._registerSheet) window._registerSheet('wshcLightbox', _closeLightbox); if (window._markSheetOpen) window._markSheetOpen('wshcLightbox'); } catch (_e) { void _e; }
      (window.requestAnimationFrame || function (f) { return setTimeout(f, 16); })(function () { ov.classList.add('is-open'); });
      var go = function (n) { idx = Math.max(0, Math.min(imgs.length - 1, n)); ov.querySelectorAll('.wshc-lb__slide').forEach(function (s, i) { s.classList.toggle('on', i === idx); }); ov.querySelectorAll('.wshc-lb__dots span').forEach(function (dd, i) { dd.classList.toggle('on', i === idx); }); };
      ov.addEventListener('click', function (e) {
        if (e.target.closest('[data-lb-edit]')) { _closeLightbox(); _openDrawer(slotId); return; }
        if (e.target.closest('[data-lb-close]') || e.target === ov) { _closeLightbox(); return; }
      });
      var sx = 0; var stage = ov.querySelector('.wshc-lb__stage');
      stage.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
      stage.addEventListener('touchend', function (e) { var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1)); }, { passive: true });
    } catch (_e) { _openDrawer(slotId); }
  }

  // cat(유형 프리셋)은 잇비 NL 경로(WorkspaceFlow.command)에서만 들어온다 — 홈에서는 안 넘긴다.
  function _launchFlow(slotId, screen, extra) {
    if (slotId) _enteredCardId = slotId;   // [v547] 복귀 시 이 카드로 스크롤 복원
    var slot = slotId ? _slotsCache.filter(function (s) { return s.id === slotId; })[0] : null;
    if (window.WorkspaceFlow && typeof window.WorkspaceFlow.open === 'function') {
      _closeDrawer();
      window.WorkspaceFlow.open(Object.assign({ slot: slot, startScreen: screen || 'upload' }, extra || {}));
    } else { _toast('작업실 플로우를 불러오지 못했어요'); }
  }

  // 상태머신 기반 이어서 진입
  function _resumeSlot(slotId) {
    var slot = _slotsCache.filter(function (s) { return s.id === slotId; })[0];
    if (!slot) return;
    var st = ST();
    var next = st.nextAction(slot);
    var screen = KEY2SCREEN[next.key] || 'edit';
    _launchFlow(slotId, screen);
  }

  function _onDrawerAct(actKey) {
    // [v542] 콘텐츠 관리 액션 — 게시 완료 토글 / 삭제(확인).
    if (actKey === '게시 완료' || actKey === '게시 완료 해제') { _togglePublished(_drawerSlotId, actKey === '게시 완료'); return; }
    if (actKey === '삭제') { _confirmDelete(_drawerSlotId); return; }
    var screen;
    if (actKey === 'next') {
      var slot = _slotsCache.filter(function (s) { return s.id === _drawerSlotId; })[0];
      var k = slot ? ST().nextAction(slot).key : 'edit';
      screen = KEY2SCREEN[k] || 'edit';
    } else { screen = ACT2SCREEN[actKey] || 'edit'; }
    // [v540] 편집 버튼 의도별 딥링크 — 사진편집/누끼·배경/비율자르기/템플릿이 각자 위치로 진입(기존 콘텐츠 유지).
    var FOCUS = { '사진 편집': 'photo-edit', '누끼/배경': 'background', '비율 자르기': 'crop', '템플릿': 'template' };
    var extra = FOCUS[actKey] ? { focus: FOCUS[actKey] } : null;
    _launchFlow(_drawerSlotId, screen, extra);
  }

  // [v542] 게시 완료 토글 — slot.publish 상태를 IndexedDB(saveSlotToDB)에 영구 저장 → 카드 green badge 유지.
  function _togglePublished(slotId, on) {
    var slot = _slotsCache.filter(function (s) { return s.id === slotId; })[0];
    if (!slot) return;
    if (on) { slot.publish = slot.publish || {}; slot.publish.status = 'published'; slot.publish.publishedAt = Date.now(); slot.status = 'published'; slot.instagramPublished = true; }
    else { if (slot.publish) slot.publish.status = 'draft'; if (slot.status === 'published') slot.status = null; slot.instagramPublished = false; }
    if (typeof window.saveSlotToDB === 'function') { Promise.resolve(window.saveSlotToDB(slot)).catch(function () {}); }
    _closeDrawer();
    if (_lastRoot) render(_lastRoot, { slots: _slotsCache });
    _toast(on ? '게시 완료로 표시했어요' : '게시 완료를 해제했어요');
  }
  // [v542] 삭제 — 확인 시트 후 IndexedDB(deleteSlotFromDB)에서 영구 제거(새로고침 후에도 유지).
  function _confirmDelete(slotId) {
    var slot = _slotsCache.filter(function (s) { return s.id === slotId; })[0];
    if (!slot) return;
    var ov = document.createElement('div');
    ov.className = 'wsv2-confirm'; ov.setAttribute('data-wsv2-confirm', '');
    ov.innerHTML =
      '<div class="wsv2-confirm__backdrop" data-wsv2-confirm-cancel></div>' +
      '<div class="wsv2-confirm__sheet" role="dialog" aria-label="콘텐츠 삭제 확인">' +
        '<div class="wsv2-confirm__title">이 콘텐츠를 삭제할까요?</div>' +
        '<div class="wsv2-confirm__desc">삭제하면 작업실에서 다시 볼 수 없어요.</div>' +
        '<div class="wsv2-confirm__btns">' +
          '<button type="button" class="wsv2-confirm__cancel" data-wsv2-confirm-cancel>취소</button>' +
          '<button type="button" class="wsv2-confirm__ok" data-wsv2-confirm-ok="' + _esc(slotId) + '">삭제</button>' +
        '</div></div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('open'); });
    ov.addEventListener('click', function (e) {
      if (e.target.closest('[data-wsv2-confirm-cancel]')) { _closeConfirm(); return; }
      var ok = e.target.closest('[data-wsv2-confirm-ok]');
      if (ok) { _doDelete(ok.getAttribute('data-wsv2-confirm-ok')); _closeConfirm(); }
    });
  }
  function _closeConfirm() { var c = document.querySelector('[data-wsv2-confirm]'); if (c && c.parentNode) c.parentNode.removeChild(c); }
  function _doDelete(slotId) {
    _slotsCache = _slotsCache.filter(function (s) { return s.id !== slotId; });   // 낙관적 즉시 제거
    if (typeof window.deleteSlotFromDB === 'function') { Promise.resolve(window.deleteSlotFromDB(slotId)).catch(function () {}); }
    _closeDrawer();
    if (_lastRoot) render(_lastRoot, { slots: _slotsCache });
    _toast('콘텐츠를 삭제했어요');
  }
  // [v547] 게시 상태만 변경/저장(렌더 없음) — 단일/일괄 공용.
  function _setPublished(slot, on) {
    if (!slot) return;
    if (on) { slot.publish = slot.publish || {}; slot.publish.status = 'published'; slot.publish.publishedAt = Date.now(); slot.status = 'published'; slot.instagramPublished = true; }
    else { if (slot.publish) slot.publish.status = 'draft'; if (slot.status === 'published') slot.status = null; slot.instagramPublished = false; }
    if (typeof window.saveSlotToDB === 'function') { Promise.resolve(window.saveSlotToDB(slot)).catch(function () {}); }
  }
  // [v547] 일괄 작업 — 선택된 카드에만 게시완료/해제/삭제 적용(IndexedDB 영속).
  function _onBulk(action) {
    var ids = Object.keys(_selected); if (!ids.length) return;
    if (action === 'delete') { _confirmBulk(ids); return; }
    var on = action === 'publish';
    ids.forEach(function (id) { _setPublished(_slotsCache.filter(function (s) { return s.id === id; })[0], on); });
    _selectMode = false; _selected = {};
    if (_lastRoot) render(_lastRoot, { slots: _slotsCache });
    _toast(on ? ids.length + '개를 게시 완료로 표시했어요' : ids.length + '개의 게시 완료를 해제했어요');
  }
  function _confirmBulk(ids) {
    _showConfirm(ids.length + '개 콘텐츠를 삭제할까요?', '삭제하면 작업실에서 다시 볼 수 없어요.', function () {
      _slotsCache = _slotsCache.filter(function (s) { return ids.indexOf(s.id) < 0; });
      if (typeof window.deleteSlotFromDB === 'function') { ids.forEach(function (id) { Promise.resolve(window.deleteSlotFromDB(id)).catch(function () {}); }); }
      _selectMode = false; _selected = {};
      if (_lastRoot) render(_lastRoot, { slots: _slotsCache });
      _toast(ids.length + '개를 삭제했어요');
    });
  }
  // [v547] 범용 확인 시트(단일 삭제·일괄 삭제 공용).
  function _showConfirm(title, desc, onOk) {
    _closeConfirm();
    var ov = document.createElement('div');
    ov.className = 'wsv2-confirm'; ov.setAttribute('data-wsv2-confirm', '');
    ov.innerHTML =
      '<div class="wsv2-confirm__backdrop" data-wsv2-confirm-cancel></div>' +
      '<div class="wsv2-confirm__sheet" role="dialog" aria-label="확인">' +
        '<div class="wsv2-confirm__title">' + _esc(title) + '</div>' +
        '<div class="wsv2-confirm__desc">' + _esc(desc) + '</div>' +
        '<div class="wsv2-confirm__btns">' +
          '<button type="button" class="wsv2-confirm__cancel" data-wsv2-confirm-cancel>취소</button>' +
          '<button type="button" class="wsv2-confirm__ok" data-wsv2-confirm-go>삭제</button>' +
        '</div></div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('open'); });
    ov.addEventListener('click', function (e) {
      if (e.target.closest('[data-wsv2-confirm-cancel]')) { _closeConfirm(); return; }
      if (e.target.closest('[data-wsv2-confirm-go]')) { _closeConfirm(); onOk(); }
    });
  }

  /* ── V2 카드 상세 drawer ── */
  function _drawerEl() {
    var el = document.getElementById('wsv2Drawer');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'wsv2Drawer';
    el.className = 'wsv2 wsv2-drawer';
    el.innerHTML = '<div class="wsv2-drawer__bd" data-wsv2-drawer-close></div>' +
      '<div class="wsv2-drawer__card" id="wsv2DrawerCard"></div>';
    document.body.appendChild(el);
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-wsv2-drawer-close]')) { _closeDrawer(); return; }
      var act = e.target.closest('[data-wsv2-act]');
      if (act) { _onDrawerAct(act.getAttribute('data-wsv2-act')); return; }
    });
    return el;
  }

  function _openDrawer(slotId) {
    var slot = _slotsCache.filter(function (s) { return s.id === slotId; })[0];
    if (!slot) return;
    _drawerSlotId = slotId;
    var st = ST();
    var meta = st.statusMeta(st.deriveStatus(slot));
    var next = st.nextAction(slot);
    var img = _thumb(slot);
    var pub = _isPub(slot);
    // [#6] 실제 작업 흐름 4단계 — 편집도구(누끼/비율/템플릿)는 편집기 안에 있으니 '사진 편집' 하나로 통합.
    var editDone = (slot.photos || []).some(function (p) { return p && (p.editedDataUrl || p.storyEdited || p.cropMeta); });
    var capDone = !!(slot.caption && String(slot.caption).trim());
    var STEPS = [
      { act: '사진 편집', label: '사진 편집', done: editDone, hint: '다시 편집' },
      { act: '게시글 생성', label: '게시글 생성', done: capDone, hint: '수정' },
      { act: '인스타 미리보기', label: '미리보기·게시', done: pub, hint: '보기' },
      { act: '고객 연결', label: '고객 연결', done: !!slot.customer_id, hint: '연결' }
    ];
    var curIdx = -1; for (var _i = 0; _i < STEPS.length; _i++) { if (!STEPS[_i].done) { curIdx = _i; break; } }
    var CHK = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    var CHV = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
    var steps = STEPS.map(function (s, i) {
      var badge = s.done
        ? '<span style="width:26px;height:26px;border-radius:50%;background:#F0FBF4;color:#0F6E56;display:grid;place-items:center;flex:none">' + CHK + '</span>'
        : '<span style="width:26px;height:26px;border-radius:50%;flex:none;display:grid;place-items:center;font-size:12px;font-weight:700;' + (i === curIdx ? 'background:var(--brand-bg,#F7EFF0);color:var(--brand-strong,#BC6675);border:1.5px solid var(--brand-strong,#BC6675)' : 'background:var(--surface-2,#F4F5F7);color:var(--text-subtle,#8A939F)') + '">' + (i + 1) + '</span>';
      var right = s.done ? '<span style="font-size:12px;color:var(--text3,#8A939F)">' + _esc(s.hint) + '</span>'
        : '<span style="color:var(--text3,#98A1AC);display:flex">' + CHV + '</span>';
      return '<button type="button" data-wsv2-act="' + _esc(s.act) + '" style="display:flex;align-items:center;gap:11px;padding:10px 2px;background:none;border:0;' + (i ? 'border-top:0.5px solid var(--border,rgba(0,0,0,.06));' : '') + 'width:100%;text-align:left;cursor:pointer">' +
        badge +
        '<span style="flex:1;font-size:14px;font-weight:' + (i === curIdx ? '700' : '500') + ';color:var(--text,#191F28)">' + _esc(s.label) + (i === curIdx ? ' <span style="font-size:11px;font-weight:700;color:var(--accent-strong,#BC6675)">· 남은 단계</span>' : '') + '</span>' +
        right + '</button>';
    }).join('');
    var html = '' +
      '<div class="wsv2-drawer__grip"></div>' +
      '<div class="wsv2-drawer__hero"' + (img ? ' style="background-image:url(' + _esc(img) + ')"' : '') + '>' +
        (img ? '' : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>') + '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;margin:2px 0 3px">' +
        '<span style="font-size:16px;font-weight:800;color:var(--text,#191F28)">' + _esc(slot.label || '제목 없음') + '</span>' +
        '<span class="wsv2-badge wsv2-badge--' + meta.tone + '">' + _esc(meta.label) + '</span></div>' +
      '<div class="wsv2-drawer__status" style="margin-bottom:14px">' + (slot.photos || []).length + '장 · ' + _esc(_roleHint(slot)) +
        (_relTime(slot) ? ' · 수정 ' + _esc(_relTime(slot)) : '') + '</div>' +
      '<div style="font-size:11px;font-weight:700;color:var(--text3,#8A939F);margin-bottom:4px">작업 흐름</div>' +
      '<div style="margin-bottom:14px">' + steps + '</div>' +
      // [#6] 남은 단계가 있으면 그 단계로, 전부 끝났으면 '완료'. (published 여도 고객연결 남으면 그리로)
      '<button type="button" class="wsv2-drawer__primary" data-wsv2-act="' + (curIdx >= 0 ? _esc(STEPS[curIdx].act) : 'next') + '">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>' +
        (curIdx >= 0 ? _esc(STEPS[curIdx].label) + ' 하기' : _esc(next.label)) + '</button>' +
      // [v542] 콘텐츠 관리 — 게시 완료 토글 + 삭제(위험, 확인 후).
      '<div class="wsv2-drawer__manage">' +
        (pub
          ? '<button type="button" class="wsv2-drawer__mng" data-wsv2-act="게시 완료 해제"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.4 2.6L3 8"/><path d="M3 3v5h5"/></svg>게시 완료 해제</button>'
          : '<button type="button" class="wsv2-drawer__mng wsv2-drawer__mng--ok" data-wsv2-act="게시 완료"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>게시 완료</button>') +
        '<button type="button" class="wsv2-drawer__mng wsv2-drawer__mng--danger" data-wsv2-act="삭제"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>삭제</button>' +
      '</div>';
    var el = _drawerEl();
    document.getElementById('wsv2DrawerCard').innerHTML = html;
    // [#1] 드로어도 back 시스템에 등록 → 뒤로가기 시 드로어 닫고 작업실 홈.
    try { if (window._registerSheet) window._registerSheet('wsv2Drawer', _closeDrawer); if (window._markSheetOpen) window._markSheetOpen('wsv2Drawer'); } catch (_e) { void _e; }
    requestAnimationFrame(function () { el.classList.add('is-open'); });
  }
  function _isPub(slot) { return !!(slot && (slot.status === 'published' || slot.instagramPublished || (slot.publish && slot.publish.status === 'published'))); }

  function _closeDrawer() {
    var el = document.getElementById('wsv2Drawer');
    if (el) el.classList.remove('is-open');
    try { if (window._markSheetClosed) window._markSheetClosed('wsv2Drawer'); } catch (_e) { void _e; }
  }

  window.WorkspaceV2 = { render: render, refresh: refresh, _closeDrawer: _closeDrawer };
})();
