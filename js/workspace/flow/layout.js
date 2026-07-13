/* workspace/flow/layout.js — 레이아웃 고르기 화면 클러스터 분리 (T-104 P2, 2026-07-10)
   ws-hyper 레이아웃 선택/슬롯배치/내 레이아웃 저장·삭제/편집기 브리지/후기·가격 텍스트 주입.
   flow.js 상태는 context 주입으로 접근: D()=현재 d, CUR()=현재 화면, EL()=루트 엘리먼트.
   setScreen/editablePhotos/photoUrl/_cleanBase 는 ctx에서 로컬 별칭으로 받아 호출부 무변경.
   window.WSFlowLayout.create(ctx) → 화면 함수 묶음 반환. flow.js 가 별칭으로 재수입. */
(function () {
  'use strict';
  function create(ctx) {
    var WSU = window.WSFlowUtil || {}, esc = WSU.esc, toast = WSU.toast;
    var setScreen = ctx.setScreen, editablePhotos = ctx.editablePhotos, photoUrl = ctx.photoUrl, _cleanBase = ctx.cleanBase;
    function D() { return ctx.d(); }       // 현재 상태 객체(open 마다 새로 할당되므로 접근자)
    function CUR() { return ctx.cur(); }   // 현재 화면 이름
    function EL() { return ctx.el(); }     // 플로우 루트 엘리먼트

    function _wsRatioPad(ratio) { return 100 * ({ '1:1': 1, '4:5': 1.25, '9:16': 1.778, '3:4': 1.333 }[ratio] || 1.25); }
    // [요청5 2026-07-13] 썸네일을 사진편집기(ITD) 레이아웃 칩과 같은 SVG rect 와이어프레임 느낌으로 통일.
    //   기존 HTML <i> 절대배치 → viewBox 안의 <rect>(inset·rx). viewBox 는 각 레이아웃 비율로 맞춰 왜곡 없음.
    function _wsLayoutFrame(layout) {
      var ar = ({ '1:1': 1, '4:5': 0.8, '9:16': 0.5625, '3:4': 0.75 })[layout.ratio || '4:5'] || 0.8;
      var VH = 30, VW = 30 * ar, PAD = 1, RX = 1.4;   // ITD _layThumbSvg 와 동일 비례(30 스케일, 1 inset, 1.4 라운드)
      var rects = (layout.photoSlots || []).map(function (s) { var r = s.rect;
        return '<rect x="' + (r.x * VW + PAD).toFixed(2) + '" y="' + (r.y * VH + PAD).toFixed(2) +
          '" width="' + Math.max(0, r.w * VW - PAD * 2).toFixed(2) + '" height="' + Math.max(0, r.h * VH - PAD * 2).toFixed(2) +
          '" rx="' + RX + '"/>'; }).join('');
      return '<span class="wsl-fbox"><span class="wsl-frame wsl-frame--svg" style="aspect-ratio:' + ar + '">' +
        '<svg class="wsl-lay-svg" viewBox="0 0 ' + VW.toFixed(2) + ' ' + VH + '" aria-hidden="true">' + rects + '</svg>' +
        '</span></span>';
    }
    function _wsLayoutCard(layout, on, isMine) {
      var card = '<button type="button" class="wsl-card' + (on ? ' on' : '') + '" data-haptic="light" aria-pressed="' + (on ? 'true' : 'false') + '" data-fl-layoutpick="' + esc(layout.id) + '">' +
        _wsLayoutFrame(layout) + '<span class="wsl-card__name">' + esc(layout.name) + '</span></button>';
      if (!isMine) return card;
      return '<span class="wsl-cardwrap">' + card + '<button type="button" class="wsl-card-del" data-haptic="light" aria-label="' + esc(layout.name) + ' 삭제" data-fl-dellayout="' + esc(layout.id) + '">×</button></span>';
    }
    function renderLayout() {
      var WL = window.WorkspaceLayout;
      var starters = (WL && WL.getStarters()) || [];
      var mine = (WL && WL.getMyLayouts()) || [];
      var sel = D().wsLayout;
      var stageHtml = sel
        ? '<div class="wsl-stage-host" data-fl-stage></div><div class="wsl-stage-hint">사진을 드래그해 위치, 두 손가락으로 확대</div>'
        : '<div class="wsl-preview wsl-preview--empty"><span>레이아웃을 고르면<br>여기서 사진을 맞춰요</span></div>';
      function grid(list, isMine) { return '<div class="wsl-grid">' + list.map(function (L) { return _wsLayoutCard(L, sel && sel.id === L.id, isMine); }).join('') + '</div>'; }
      var saveBtn = sel ? '<button type="button" class="wsl-save" data-haptic="success" data-fl="savelayout"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>이 레이아웃 저장</button>' : '';
      return '<div class="wsl-wrap">' + stageHtml + saveBtn + (sel ? _wsPhotoTray() : '') +
        (mine.length ? '<div class="wsl-sec-t">내 레이아웃</div>' + grid(mine, true) : '') +
        '<div class="wsl-sec-t">추천 레이아웃 · 전후 비교부터</div>' + grid(starters) +
        '<button type="button" class="wsl-skip" data-haptic="light" data-fl="skiplayout">레이아웃 없이 진행 (사진 그대로)</button></div>';
    }
    function _wsSaveMyLayout() {
      if (!D().wsLayout || !(window.ShopStyle && window.ShopStyle.create)) { toast('저장할 레이아웃이 없어요'); return; }
      var L = D().wsLayout;
      var slots = (L.photoSlots || []).map(function (s) { return { id: s.id, role: s.role, rect: Object.assign({}, s.rect), focal: Object.assign({ x: 0.5, y: 0.5 }, s.focal), zoom: s.zoom || 1, fit: s.fit || 'cover' }; });
      var layers = (L.layers || []).map(function (x) { return Object.assign({}, x); });
      var n = (window.WorkspaceLayout && window.WorkspaceLayout.getMyLayouts) ? window.WorkspaceLayout.getMyLayouts().length : 0;
      try {
        window.ShopStyle.create({ name: '내 레이아웃 ' + (n + 1), kind: L.kind || 'custom', ratio: L.ratio || '4:5', photoSlots: slots, layers: layers, _wsMyLayout: true });
        toast('내 레이아웃에 저장했어요');
        if (CUR() === 'layout') setScreen('layout', { push: false });
      } catch (_e) { toast('저장을 못했어요'); }
    }
    function _wsDeleteMyLayout(id) {
      try { if (window.ShopStyle && window.ShopStyle.remove) window.ShopStyle.remove(id); } catch (_e) { void _e; }
      if (D().wsLayout && D().wsLayout.id === id) { D().wsLayout = null; D().templateOutput = null; }
      toast('삭제했어요');
      if (CUR() === 'layout') setScreen('layout', { push: false });
    }
    // 사진 트레이 — 탭한 순서대로 슬롯에 채움. 배정된 사진엔 순번 뱃지.
    function _wsPhotoTray() {
      var photos = editablePhotos(); if (!photos.length || !D().wsLayout) return '';
      var slots = (D().wsLayout.photoSlots || []).map(function (s) { return s.id; });
      var assign = D()._wsAssign || {};
      function orderOf(pid) { for (var i = 0; i < slots.length; i++) { var ap = assign[slots[i]]; if (ap && ap.id === pid) return i + 1; } return 0; }
      return '<div class="wsl-sec-t">사진 순서 · 탭해서 슬롯에 넣기</div><div class="wsl-tray">' +
        photos.map(function (p) { var n = orderOf(p.id);
          return '<button type="button" class="wsl-tray__ph' + (n ? ' on' : '') + '" data-haptic="light" aria-label="' + (n ? (n + '번 슬롯에 배정됨, 탭해서 빼기') : '탭해서 슬롯에 넣기') + '" data-fl-trayph="' + esc(p.id) + '" style="background-image:url(' + esc(photoUrl(p)) + ')">' + (n ? '<span class="wsl-tray__n">' + n + '</span>' : '') + '</button>';
        }).join('') + '</div>';
    }
    function _wsTrayPick(pid) {
      if (!D().wsLayout) return;
      var slots = (D().wsLayout.photoSlots || []).map(function (s) { return s.id; });
      var assign = D()._wsAssign || (D()._wsAssign = {});
      var p = editablePhotos().filter(function (x) { return x.id === pid; })[0]; if (!p) return;
      var assignedSlot = slots.filter(function (sid) { return assign[sid] && assign[sid].id === pid; })[0];
      if (assignedSlot) { delete assign[assignedSlot]; }                                  // 다시 탭 = 해제
      else {
        var empty = slots.filter(function (sid) { return !assign[sid]; })[0];
        if (empty) assign[empty] = p;
        else { toast('빈 슬롯이 없어요. 배정된 사진을 탭해 빼고 넣어주세요'); return; }
      }
      if (CUR() === 'layout') setScreen('layout', { push: false });                        // 스테이지+트레이 재렌더
    }
    function _wsMountStage() {   // 스크린 렌더 직후 인터랙티브 스테이지 장착 (host 는 innerHTML 로 이미 존재)
      if (!D().wsLayout || !window.WorkspaceSlotStage || !EL()) return;
      var host = EL().querySelector('[data-fl-stage]'); if (!host) return;
      window.WorkspaceSlotStage.mount(host, { layout: D().wsLayout, photos: editablePhotos(), assign: D()._wsAssign,
        onChange: function () { D().previewUrl = null; D().templateOutput = null; } });   // 재조정 시 옛 합성본 무효화
    }
    function _wsSelectLayout(id) {
      var WL = window.WorkspaceLayout; if (!WL) return;
      var L = WL.getById(id) || (WL.getMyLayouts() || []).filter(function (x) { return x.id === id; })[0];
      if (!L) return;
      D().wsLayout = L;
      D()._wsAssign = WL.autoAssign(editablePhotos(), L);
      if (CUR() === 'layout') setScreen('layout', { push: false });
    }
    // ws-hyper→ItdEditor: 활성 레이아웃을 편집기 콜라주로. 프리셋 매칭이면 슬롯 재조정 가능, 아니면 합성본 보존.
    //   편집기 LAYOUTS idx: 0=single 1=v2(좌우) 2=h2(상하) 3=v3 4=grid4 5=l1r2 6=t1b2 7=ba(전후)
    function _matchItdPreset(slots) {
      var PRESETS = [
        { idx: 0, cells: [[0, 0, 1, 1]] },
        { idx: 1, cells: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] },
        { idx: 2, cells: [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]] },
        { idx: 3, cells: [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]] },
        { idx: 4, cells: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },
        { idx: 5, cells: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },
        { idx: 6, cells: [[0, 0, 1, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },
        { idx: 7, cells: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] }
      ];
      var TOL = 0.02;
      function eq(a, b) { return Math.abs(a - b) <= TOL; }
      function rectEq(r, c) { return r && eq(r.x, c[0]) && eq(r.y, c[1]) && eq(r.w, c[2]) && eq(r.h, c[3]); }
      for (var pi = 0; pi < PRESETS.length; pi++) {
        var P = PRESETS[pi];
        if (P.cells.length !== slots.length) continue;
        var order = [], used = {}, ok = true;
        for (var ci = 0; ci < P.cells.length; ci++) {
          var found = -1;
          for (var sj = 0; sj < slots.length; sj++) { if (!used[sj] && rectEq(slots[sj].rect, P.cells[ci])) { found = sj; break; } }
          if (found < 0) { ok = false; break; }
          used[found] = 1; order.push(found);
        }
        if (ok) return { idx: P.idx, order: order };
      }
      return null;
    }
    function _wsLayoutEditState() {
      try {
        var L = D().wsLayout; if (!L || !Array.isArray(L.photoSlots) || !L.photoSlots.length) return null;
        var slots = L.photoSlots;
        var photos = editablePhotos() || [];
        var assign = D()._wsAssign || (window.WorkspaceLayout && window.WorkspaceLayout.autoAssign(photos, L)) || {};
        var m = _matchItdPreset(slots);
        if (m && L.kind === 'before_after' && m.idx === 1) m.idx = 7;   // 전후면 좌우(v2) 대신 BEFORE/AFTER(ba)
        if (m) {
          var urls = [], crop = [];
          m.order.forEach(function (si) {
            var sl = slots[si], ph = assign[sl.id];
            urls.push((ph && (ph.editedDataUrl || _cleanBase(ph) || photoUrl(ph))) || '');
            crop.push({ s: Math.max(1, Math.min(4, sl.zoom || 1)), tx: 0, ty: 0 });   // zoom만 이식(focal은 편집기서 재조정)
          });
          if (urls.every(function (u) { return !u; })) return null;
          return { mode: 'collage', photos: urls, editState: {
            v: 1, layoutIdx: m.idx, layoutOrder: urls.map(function (_u, i) { return i; }),
            cellCrop: crop, fitMode: 'cover', ratio: (L.ratio || '4:5') } };
        }
        if (D().templateOutput) return { mode: 'composite', photoUrl: D().templateOutput };
        return null;
      } catch (_e) { return null; }
    }
    // 후기/가격 레이아웃에 실제 텍스트 자동채움(모델은 안 건드리고 클론에 주입). compose 직전에만 호출.
    function _fillLayoutText(layout) {
      if (!layout || !Array.isArray(layout.layers)) return layout;
      var kind = layout.kind;
      var layers = layout.layers.map(function (L) { return Object.assign({}, L); });
      // [다양성 팩] 시술명 분해 → 헤드라인/자막바/부제 자동 채움(review/price 외 kind 도 텍스트 살아있게).
      var parts = {};
      try { parts = (window.WSCaptionText && window.WSCaptionText.splitServiceForLayers) ? window.WSCaptionText.splitServiceForLayers(D().service || '') : {}; } catch (_e0) { parts = {}; }
      var svcTitle = (parts && parts.title) || String(D().service || '').split(/[\n,·]/)[0].trim();
      layers.forEach(function (L) {
        if (L.role === 'headline' || L.role === 'caption_bar') { if (svcTitle) L.text = svcTitle; }
        else if (L.role === 'sub2') { if (parts && parts.sub) L.text = parts.sub; }
      });
      if (kind === 'review') {
        layers.forEach(function (L) {
          if (L.role === 'title') { L.text = D().customerName ? (D().customerName + '님 후기') : (L.text || '고객 후기'); }
          else if (L.role === 'body') {
            var t = String(D().caption || D().service || '').replace(/\s+/g, ' ').trim();
            if (t) L.text = t.length > 120 ? (t.slice(0, 120) + '…') : t;   // layout-model 이 자동 줄바꿈+축소로 맞춤
          }
        });
      } else if (kind === 'price') {
        var rows = null;
        try { rows = (window.ItdasyPriceMenu && window.ItdasyPriceMenu.shopMenu) ? window.ItdasyPriceMenu.shopMenu() : null; } catch (_e) { rows = null; }
        if (rows && rows.length) {
          // [좌우 메뉴 지원] panel 위치를 읽어 가격줄 배치 — 사진 절반+우측 메뉴/상단 사진+하단 표 둘 다 대응.
          var panel = layers.filter(function (L) { return L.role === 'panel'; })[0];
          var px = panel && panel.x ? panel.x : 0, pw = panel && panel.w ? panel.w : 1, py = panel && panel.y != null ? panel.y : 0.5;
          var rx = px + 0.04, rw = pw - 0.08, ry0 = py + 0.14;
          rows.slice(0, 7).forEach(function (row, i) {
            layers.push({ type: 'text', role: 'price_row', text: row, x: rx, y: ry0 + i * 0.058, w: rw,
              size: 0.03, weight: 600, color: '#4E5968', align: 'left', bg: null, shadow: false });
          });
        }
      }
      return Object.assign({}, layout, { layers: layers });
    }

    // [refactor S4] 레이아웃 화면 전용 클릭 핸들러 — flow.js 익명 리스너에서 이관(무동작변경).
    //   이 버튼들(dellayout·layoutpick·trayph·savelayout·skiplayout)은 renderLayout 에서만 렌더되는 스텝 전용.
    //   처리하면 true. 서로 겹치지 않는(비중첩) 요소라 검사 순서 무관.
    function handleClick(t, a) {
      var dl = t.closest('[data-fl-dellayout]'); if (dl) { _wsDeleteMyLayout(dl.getAttribute('data-fl-dellayout')); return true; }   // [E3] 내 레이아웃 삭제(×)
      var lp = t.closest('[data-fl-layoutpick]'); if (lp) { _wsSelectLayout(lp.getAttribute('data-fl-layoutpick')); return true; }   // [ws-hyper] 레이아웃 카드 선택
      var tp = t.closest('[data-fl-trayph]'); if (tp) { _wsTrayPick(tp.getAttribute('data-fl-trayph')); return true; }   // 사진 트레이 탭
      if (a === 'savelayout') { _wsSaveMyLayout(); return true; }   // [E2] 내 레이아웃 저장
      if (a === 'skiplayout') { D().wsLayout = null; D().templateOutput = null; setScreen('caption'); return true; }   // 레이아웃 없이 진행
      return false;
    }

    return {
      renderLayout: renderLayout, _wsSaveMyLayout: _wsSaveMyLayout, _wsDeleteMyLayout: _wsDeleteMyLayout,
      _wsTrayPick: _wsTrayPick, _wsMountStage: _wsMountStage, _wsSelectLayout: _wsSelectLayout,
      _wsLayoutEditState: _wsLayoutEditState, _fillLayoutText: _fillLayoutText, handleClick: handleClick
    };
  }
  window.WSFlowLayout = { create: create };
})();
