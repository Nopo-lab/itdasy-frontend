/* 피드 플래너 (app-feed-planner.js) — 인스타 3열 그리드에 대기 게시물을 배치·드래그 정렬 + 톤 어울림 힌트.
 *
 * 기존 _feedPreview(정적 미리보기) 보강판. 클라이언트 100%(서버비 0).
 *   window.FeedPlanner.open({ photos:[url...], onSave:fn })  → 정렬 결과 순서 배열 콜백
 * 디자인: 라이트모드 기준(아이보리/로즈), 14px+ radius, safe-area, data-haptic.
 */
(function () {
  'use strict';
  if (window.FeedPlanner) return;
  var COLS = 3, FILL = 9; // 최소 9칸(3줄)까지 placeholder 채움

  function esc(s) { return String(s == null ? '' : s).replace(/"/g, '&quot;'); }
  function haptic(el, t) { if (el) el.setAttribute('data-haptic', t || 'light'); }

  /* ── 톤 어울림: 각 셀 평균 밝기 표준편차로 판정(캔버스 8px 샘플) ── */
  function avgL(url) {
    return new Promise(function (res) {
      var img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = function () {
        try {
          var c = document.createElement('canvas'); c.width = c.height = 8;
          var x = c.getContext('2d'); x.drawImage(img, 0, 0, 8, 8);
          var d = x.getImageData(0, 0, 8, 8).data, s = 0, n = 0;
          for (var i = 0; i < d.length; i += 4) { s += (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]); n++; }
          res(s / n / 255);
        } catch (_e) { res(null); }
      };
      img.onerror = function () { res(null); };
      img.src = url;
    });
  }
  function harmony(urls) {
    return Promise.all(urls.map(avgL)).then(function (ls) {
      ls = ls.filter(function (v) { return v != null; });
      if (ls.length < 3) return null;
      var m = ls.reduce(function (a, b) { return a + b; }, 0) / ls.length;
      var sd = Math.sqrt(ls.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / ls.length);
      if (sd < 0.11) return { ok: true, msg: '톤이 잘 어울려요' };
      if (sd < 0.18) return { ok: true, msg: '무난하게 어울려요' };
      return { ok: false, msg: '밝기가 좀 튀어요 · 보정으로 맞춰보세요' };
    });
  }

  /* ── 렌더 ── */
  function cellHtml(url, i, isNew) {
    if (!url) return '<div class="fplan__cell fplan__cell--ph" data-i="' + i + '"></div>';
    return '<div class="fplan__cell" draggable="false" data-i="' + i + '" style="background-image:url(&quot;' + esc(url) + '&quot;)">' +
      (isNew ? '<span class="fplan__badge">NEW</span>' : '') +
      '<span class="fplan__grip"></span></div>';
  }

  function gridInner(state) {
    var cells = '';
    for (var i = 0; i < Math.max(FILL, state.order.length); i++) {
      var u = state.order[i];
      cells += cellHtml(u, i, state.newSet.indexOf(u) !== -1 && !!u);
    }
    return cells;
  }

  function build(state) {
    var cells = gridInner(state);
    return '' +
      '<div class="fplan" role="dialog" aria-label="피드 플래너">' +
      '  <div class="fplan__head">' +
      '    <button class="fplan__close" data-fp="close" aria-label="닫기" data-haptic="light">' +
      '      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
      '    <div class="fplan__ttl"><b>피드 정렬</b><span>' + esc(state.handle || '내 피드') + '</span></div>' +
      '    <button class="fplan__save" data-fp="save" data-haptic="success">완료</button>' +
      '  </div>' +
      '  <div class="fplan__hint" id="fplanHint"><span class="fplan__dot"></span>톤 확인 중…</div>' +
      '  <div class="fplan__grid" id="fplanGrid">' + cells + '</div>' +
      '  <p class="fplan__tip">칸을 끌어서 순서를 바꿔보세요 · 위에서부터 최신 게시물이에요</p>' +
      '</div>';
  }

  /* ── 드래그 정렬(포인터, 터치+마우스) ── */
  function wireDrag(grid, state, refreshHint) {
    var dragEl = null, ghost = null, fromI = -1;
    function cellAt(x, y) {
      var el = document.elementFromPoint(x, y);
      while (el && !el.classList.contains('fplan__cell') && el !== grid) el = el.parentElement;
      return (el && el.classList.contains('fplan__cell')) ? el : null;
    }
    grid.addEventListener('pointerdown', function (e) {
      var cell = e.target.closest('.fplan__cell');
      if (!cell || cell.classList.contains('fplan__cell--ph')) return;
      fromI = +cell.getAttribute('data-i'); dragEl = cell;
      try { cell.setPointerCapture(e.pointerId); } catch (_e) { void _e; }
      ghost = cell.cloneNode(true); ghost.className = 'fplan__cell fplan__ghost';
      var r = cell.getBoundingClientRect();
      ghost.style.width = r.width + 'px'; ghost.style.height = r.height + 'px';
      document.body.appendChild(ghost); cell.classList.add('fplan__lift');
      moveGhost(e.clientX, e.clientY);
    });
    function moveGhost(x, y) { if (ghost) { ghost.style.left = x + 'px'; ghost.style.top = y + 'px'; } }
    grid.addEventListener('pointermove', function (e) {
      if (!dragEl) return; e.preventDefault(); moveGhost(e.clientX, e.clientY);
      var over = cellAt(e.clientX, e.clientY);
      Array.prototype.forEach.call(grid.children, function (c) { c.classList.remove('fplan__over'); });
      if (over && over !== dragEl) over.classList.add('fplan__over');
    });
    grid.addEventListener('pointerup', function (e) {
      if (!dragEl) return;
      var over = cellAt(e.clientX, e.clientY);
      if (over && over !== dragEl) {
        var toI = +over.getAttribute('data-i');
        var arr = state.order, item = arr.splice(fromI, 1)[0];
        arr.splice(toI, 0, item);
      }
      if (ghost) ghost.remove(); ghost = null; dragEl = null;
      grid.innerHTML = gridInner(state); // 자식만 교체 — 이벤트는 grid에 위임돼 유지
      Array.prototype.forEach.call(grid.children, function (c) { c.classList.remove('fplan__over', 'fplan__lift'); });
      refreshHint();
    });
  }

  function open(opts) {
    opts = opts || {};
    var photos = (opts.photos || []).filter(Boolean);
    var state = { order: photos.slice(), newSet: photos.slice(0, opts.newCount || photos.length), handle: opts.handle || '' };

    var host = document.createElement('div');
    host.className = 'fplan-overlay';
    // 앱 전역 CSS가 body 하위 오버레이를 숨기는 경우 대비 — 핵심 레이아웃은 인라인 !important 로 자기방어
    host.style.setProperty('display', 'flex', 'important');
    host.style.setProperty('position', 'fixed', 'important');
    host.style.setProperty('inset', '0', 'important');
    host.style.setProperty('z-index', '10050', 'important');
    host.innerHTML = build(state);
    document.body.appendChild(host);
    requestAnimationFrame(function () { host.classList.add('is-open'); });

    var grid = host.querySelector('#fplanGrid');
    function refreshHint() {
      var urls = state.order.filter(Boolean).slice(0, 9);
      harmony(urls).then(function (h) {
        var el = host.querySelector('#fplanHint'); if (!el) return;
        if (!h) { el.style.display = 'none'; return; }
        el.className = 'fplan__hint ' + (h.ok ? 'is-ok' : 'is-warn');
        el.innerHTML = '<span class="fplan__dot"></span>' + h.msg;
      });
    }
    wireDrag(grid, state, refreshHint);
    refreshHint();

    function close() { host.classList.remove('is-open'); setTimeout(function () { host.remove(); }, 260); }
    host.addEventListener('click', function (e) {
      var b = e.target.closest('[data-fp]'); if (!b) return;
      if (b.getAttribute('data-fp') === 'close') close();
      if (b.getAttribute('data-fp') === 'save') { if (opts.onSave) opts.onSave(state.order.filter(Boolean)); close(); }
    });
  }

  window.FeedPlanner = { open: open };
})();
