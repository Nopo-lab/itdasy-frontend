/* Workspace V2 — 작업실 첫 화면 렌더러 (C3: 홈 상단 히어로/퀵/카테고리/라이브러리 재구성)
   의존: WorkspaceState (workspace-state.js), 기존 전역: loadSlotsFromDB / initWorkshopTab / showToast. */
(function () {
  'use strict';

  var ST = function () { return window.WorkspaceState; };
  var _filter = 'all';
  var TABS = [{ key:'all', label:'전체' }, { key:'pending', label:'업로드 대기' }, { key:'edited', label:'편집 완료' }, { key:'ready', label:'업로드 준비' }, { key:'done', label:'완료' }];
  var _lastRoot = null;
  var _slotsCache = [];
  var _drawerSlotId = null;
  var DRAWER_HINT = '추천 작업부터 이어서 진행해요';
  var ACT2SCREEN = { '사진 편집':'edit', '누끼/배경':'edit', '비율 자르기':'edit', '템플릿':'edit', '게시글 생성':'caption', '인스타 미리보기':'preview', '고객 연결':'connect' };
  var KEY2SCREEN = { upload:'upload', edit:'edit', caption:'caption', customer:'connect', publish:'preview', done:'preview' };

  // 카테고리 — 스펙에 맞춘 레이블 + 가격표는 준비중
  // TODO: assets/workshop-cats/cat-1.jpg ~ cat-5.jpg 파일을 원영님이 직접 넣어주세요 (1:1 매핑)
  var CATS = [
    { key: 'ba',     label: '전후 비교',      disabled: false, split: true },          // cat-1(전)+cat-2(후)
    { key: 'flex',   label: '시술 완료 사진', disabled: false, img: 'cat-3' },
    { key: 'review', label: '고객 후기 사진', disabled: false, img: 'cat-4' },
    { key: 'event',  label: '이벤트 홍보',   disabled: false, img: 'cat-5' },
    { key: 'price',  label: '가격표',         disabled: true  },
  ];

  function _esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch];
    });
  }
  function _toast(msg) { if (window.showToast) window.showToast(msg); }

  function _thumb(slot) {
    // [이슈2] 전후 템플릿 적용본(templateOutput)이 있으면 저장카드도 그 합성 결과를 보여준다.
    //   (원본 사진은 더 이상 합성본으로 덮어쓰지 않으므로 여기서 명시적으로 우선 참조)
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

  // 히어로 — 시안 A(담백 카드): 흰 카드 가로 레이아웃, 작은 검정 pill, 카메라 라인아이콘(로즈 틴트 박스)
  function _heroHTML() {
    return '' +
      '<button type="button" class="wsv2-hero" data-wsv2-upload data-haptic="medium">' +
        '<div class="wsv2-hero__tx">' +
          '<div class="wsv2-hero__eye">오늘 작업</div>' +
          '<div class="wsv2-hero__tt">사진 올려<br>게시물 만들기</div>' +
          '<div class="wsv2-hero__sub">사진 올리면 보정·글까지 한 번에</div>' +
          '<span class="wsv2-hero__go">시작하기 <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>' +
        '</div>' +
        '<span class="wsv2-hero__ill"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"/><circle cx="12" cy="13" r="4"/></svg></span>' +
      '</button>';
  }

  // 퀵 2칸: 잇비한테 맡기기 + 게시글만 쓰기
  function _quickHTML() {
    return '' +
      '<div class="wsv2-quick">' +
        '<button type="button" class="wsv2-quick__btn wsv2-quick__btn--rose" data-wsv2-quick="itbi" data-haptic="light">' +
          '<svg class="wsv2-quick__ic--float" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--brand-strong)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-bot"/></svg>' +
          '<span class="wsv2-quick__label">잇비한테 맡기기</span>' +
          '<span class="wsv2-quick__sub">사진 주면 알아서</span>' +
        '</button>' +
        '<button type="button" class="wsv2-quick__btn" data-wsv2-quick="textonly" data-haptic="light">' +
          '<span class="wsv2-quick__ic">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>' +
          '</span>' +
          '<span class="wsv2-quick__label">게시글만 쓰기</span>' +
          '<span class="wsv2-quick__sub">사진 없이 글만</span>' +
        '</button>' +
      '</div>';
  }

  function _categoryHTML() {
    var cards = CATS.map(function (c) {
      var dis = c.disabled ? ' wsv2-cat--disabled' : '';
      var thumb;
      if (c.split) {
        thumb = '<div class="wsv2-cat__thumb wsv2-cat__split" aria-hidden="true">' +
          '<img class="wsv2-cat__img" src="assets/workshop-cats/cat-1.jpg" alt="전">' +
          '<img class="wsv2-cat__img" src="assets/workshop-cats/cat-2.jpg" alt="후">' +
          '</div>';
      } else if (c.img) {
        thumb = '<div class="wsv2-cat__thumb" aria-hidden="true">' +
          '<img class="wsv2-cat__img" src="assets/workshop-cats/' + c.img + '.jpg" alt="' + _esc(c.label) + '">' +
          '</div>';
      } else {
        thumb = '<div class="wsv2-cat__thumb wsv2-cat__thumb--empty" aria-hidden="true"></div>';
      }
      return '<button type="button" class="wsv2-cat' + dis + '" data-wsv2-cat="' + c.key + '" data-haptic="light"' + (c.disabled ? ' disabled' : '') + '>' +
        thumb +
        '<span class="wsv2-cat__t">' + _esc(c.label) + '</span>' +
        (c.disabled ? '<span class="wsv2-cat__badge">준비중</span>' : '') +
      '</button>';
    }).join('');
    return '' +
      '<div class="wsv2-sec-head"><h2>새 콘텐츠 만들기</h2><span class="wsv2-sec-sub">유형을 골라보세요</span></div>' +
      '<div class="wsv2-cats">' + cards + '</div>';
  }

  function _cardHTML(slot) {
    var st = ST();
    var meta = st.statusMeta(st.deriveStatus(slot));
    var next = st.nextAction(slot);
    var img = _thumb(slot);
    var sub = _relTime(slot);
    return '' +
      '<article class="wsv2-card" data-wsv2-slot="' + _esc(slot.id) + '" data-haptic="light">' +
        '<div class="wsv2-card__thumb"' + (img ? ' style="background-image:url(' + _esc(img) + ')"' : '') + '>' +
          (img ? '' : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>') +
        '</div>' +
        '<div class="wsv2-card__body">' +
          '<span class="wsv2-badge wsv2-badge--' + meta.tone + '">' + _esc(meta.label) + '</span>' +
          '<div class="wsv2-card__title">' + _esc(slot.label || '제목 없음') + '</div>' +
          (sub ? '<div class="wsv2-card__sub">수정 ' + _esc(sub) + '</div>' : '') +
          '<div class="wsv2-card__next">다음: ' + _esc(next.label) + '</div>' +
          '<button type="button" class="wsv2-card__resume" data-wsv2-resume="' + _esc(slot.id) + '">이어서 ›</button>' +
        '</div>' +
        '<span class="wsv2-card__dots" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>' +
        '</span>' +
      '</article>';
  }

  function _bucket(slot) {
    var s = ST().deriveStatus(slot);
    if (s === 'published') return 'done';
    if (s === 'ready') return 'ready';
    if (s === 'needs_caption' || s === 'needs_customer') return 'edited';
    return 'pending';
  }

  function _tabsHTML(slots) {
    var g = { all: slots.length, pending: 0, edited: 0, ready: 0, done: 0 };
    slots.forEach(function (s) { g[_bucket(s)]++; });
    return '<div class="wsv2-tabs" role="tablist">' + TABS.map(function (t) {
      return '<button type="button" class="wsv2-tab' + (_filter === t.key ? ' is-active' : '') +
        '" data-wsv2-filter="' + t.key + '" data-haptic="light">' + _esc(t.label) +
        '<b>' + (g[t.key] || 0) + '</b></button>';
    }).join('') + '</div>';
  }

  function _shellHTML(slots) {
    var visible = _filter === 'all' ? slots : slots.filter(function (s) { return _bucket(s) === _filter; });
    var list = visible.length
      ? '<div class="wsv2-list">' + visible.map(_cardHTML).join('') + '</div>'
      : '<div class="wsv2-empty-list">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>' +
        '<p>' + (slots.length ? '이 상태의 콘텐츠가 없어요' : '아직 콘텐츠가 없어요') + '</p></div>';
    return '' +
      '<section class="wsv2" data-wsv2-root>' +
        '<header class="wsv2-greet">' +
          '<p class="wsv2-greet__sub">오늘 작업, 한 번에.</p>' +
          '<h1 class="wsv2-greet__title">작업실</h1>' +
        '</header>' +
	        _heroHTML() +
	        '<input type="file" accept="image/*" multiple data-wsv2-file hidden>' +
	        _quickHTML() +
        _categoryHTML() +
        '<div class="wsv2-sec-head"><h2>내 콘텐츠</h2></div>' +
        _tabsHTML(slots) +
        list +
      '</section>';
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
	  }

	  function refresh() {
	    if (typeof initWorkshopTab === 'function') { Promise.resolve(initWorkshopTab()).catch(function () {}); return; }
	    if (!_lastRoot || typeof loadSlotsFromDB !== 'function') return;
	    Promise.resolve(loadSlotsFromDB()).then(function (s) { render(_lastRoot, { slots: s || [] }); }).catch(function () {});
	  }

	  function _pickHeroFiles(root) {
	    var input = root && root.querySelector('[data-wsv2-file]');
	    if (!input) { _launchFlow(null, 'upload', null); return; }
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
	      _launchFlow(null, 'upload', null, { files: files });
	    });
	  }

	  function _bind(root) {
    root.onclick = function (e) {
      // 카테고리 클릭 — 타입 프리셋으로 플로우 진입
      var catBtn = e.target.closest('[data-wsv2-cat]');
      if (catBtn) {
        var ck = catBtn.getAttribute('data-wsv2-cat');
        if (ck === 'price') { if (window.WorkspaceAdapter) window.WorkspaceAdapter.openPriceList(); else _toast('가격표 기능을 불러오지 못했어요'); return; }
        _launchFlow(null, 'upload', ck); return;
      }
      // 히어로 업로드 CTA
	      if (e.target.closest('[data-wsv2-upload]')) { _pickHeroFiles(root); return; }
      // 퀵 버튼
      var quick = e.target.closest('[data-wsv2-quick]');
      if (quick) {
        var qk = quick.getAttribute('data-wsv2-quick');
        if (qk === 'itbi') {
          // 잇비 챗봇으로 위임
          if (window.openAssistant) window.openAssistant();
          else if (typeof openItbiTab === 'function') openItbiTab();
          else _toast('잇비를 불러오지 못했어요');
          return;
	        }
        if (qk === 'textonly') {
          // 사진 없이 게시글만 — 플로우 진입 시 사진종류 축 없이
          _launchFlow(null, 'caption', null, { textOnly: true }); return;
        }
        return;
      }
      // 필터 탭
      var tab = e.target.closest('[data-wsv2-filter]');
      if (tab) { _filter = tab.getAttribute('data-wsv2-filter'); render(_lastRoot, { slots: _slotsCache }); return; }
      // "이어서" 버튼 — 직접 해당 단계 진입
      var resume = e.target.closest('[data-wsv2-resume]');
      if (resume) { e.stopPropagation(); var sid = resume.getAttribute('data-wsv2-resume'); _resumeSlot(sid); return; }
      // 카드 탭 — 드로어 오픈
      var card = e.target.closest('[data-wsv2-slot]');
      if (card) { _openDrawer(card.getAttribute('data-wsv2-slot')); return; }
    };
  }

  function _launchFlow(slotId, screen, cat, extra) {
    var slot = slotId ? _slotsCache.filter(function (s) { return s.id === slotId; })[0] : null;
    if (window.WorkspaceFlow && typeof window.WorkspaceFlow.open === 'function') {
      _closeDrawer();
      window.WorkspaceFlow.open(Object.assign({ slot: slot, startScreen: screen || 'upload', cat: cat || null }, extra || {}));
    } else { _toast('작업실 플로우를 불러오지 못했어요'); }
  }

  // 상태머신 기반 이어서 진입
  function _resumeSlot(slotId) {
    var slot = _slotsCache.filter(function (s) { return s.id === slotId; })[0];
    if (!slot) return;
    var st = ST();
    var next = st.nextAction(slot);
    var screen = KEY2SCREEN[next.key] || 'edit';
    _launchFlow(slotId, screen, null);
  }

  function _onDrawerAct(actKey) {
    var screen;
    if (actKey === 'next') {
      var slot = _slotsCache.filter(function (s) { return s.id === _drawerSlotId; })[0];
      var k = slot ? ST().nextAction(slot).key : 'edit';
      screen = KEY2SCREEN[k] || 'edit';
    } else { screen = ACT2SCREEN[actKey] || 'edit'; }
    _launchFlow(_drawerSlotId, screen, null);
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
    var acts = [
      { ic: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5', label: '사진 편집' },
      { ic: 'M6 2v6m0 0L2 12m4-4 4-4m6 2v6m0 0 4 4m-4-4-4-4', label: '누끼/배경' },
      { ic: 'M6 2H2v4M2 18v4h4M22 6V2h-4M18 22h4v-4M9 9h6v6H9z', label: '비율 자르기' },
      { ic: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z', label: '템플릿' },
      { ic: 'M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z', label: '게시글 생성' },
      { ic: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7', label: '인스타 미리보기' },
      { ic: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', label: '고객 연결' },
    ];
    var html = '' +
      '<div class="wsv2-drawer__grip"></div>' +
      '<div class="wsv2-drawer__hero"' + (img ? ' style="background-image:url(' + _esc(img) + ')"' : '') + '>' +
        (img ? '' : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>') + '</div>' +
      '<span class="wsv2-badge wsv2-badge--' + meta.tone + '">' + _esc(meta.label) + '</span>' +
      '<div class="wsv2-drawer__title">' + _esc(slot.label || '제목 없음') + '</div>' +
      '<div class="wsv2-drawer__status">' + (slot.photos || []).length + '장 · ' + _esc(_roleHint(slot)) +
        (_relTime(slot) ? ' · 수정 ' + _esc(_relTime(slot)) : '') + '</div>' +
      '<button type="button" class="wsv2-drawer__primary" data-wsv2-act="next">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>' +
        '다음 작업: ' + _esc(next.label) + '</button>' +
      '<div class="wsv2-drawer__hint">' + _esc(DRAWER_HINT) + '</div>' +
      '<div class="wsv2-drawer__grid">' + acts.map(function (a) {
        return '<button type="button" class="wsv2-drawer__act" data-wsv2-act="' + _esc(a.label) + '">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + a.ic + '"/></svg>' + _esc(a.label) + '</button>';
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
