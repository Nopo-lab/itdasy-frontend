/* 작업실 초고도화 — 인터랙티브 슬롯 스테이지 (ITDASY_WS_HYPER)
   레이아웃 슬롯에 사진을 배치하고, 슬롯 안에서 드래그(focal 이동)·핀치(zoom)로 맞춘다.
   라이브 미리보기는 CSS(object-position/scale). 최종 이미지는 composeLayout(캔버스)로 굽는다.
   flow/편집기와 분리 — window.WorkspaceSlotStage 로만 노출. */
(function () {
  'use strict';
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function _src(p) { return p && (p.editedDataUrl || p.dataUrl || p.baseUrl || (typeof p === 'string' ? p : '')); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function mount(host, opts) {
    opts = opts || {};
    var layout = opts.layout; if (!host || !layout) return null;
    var photos = opts.photos || [];
    var onChange = opts.onChange || function () {};
    var WL = window.WorkspaceLayout;
    var assign = opts.assign || (WL && WL.autoAssign(photos, layout)) || {};
    var slots = layout.photoSlots || [];

    var ar = WL ? WL.ratioWH(layout.ratio || '4:5') : { w: 4, h: 5 };
    host.innerHTML = '';
    host.className = 'wsl-stage';
    host.style.aspectRatio = ar.w + ' / ' + ar.h;

    slots.forEach(function (sl) {
      var cell = document.createElement('div');
      cell.className = 'wsl-slot'; cell.setAttribute('data-slot', sl.id);
      cell.style.left = (sl.rect.x * 100) + '%'; cell.style.top = (sl.rect.y * 100) + '%';
      cell.style.width = (sl.rect.w * 100) + '%'; cell.style.height = (sl.rect.h * 100) + '%';
      var src = _src(assign[sl.id]);
      if (src) {
        var img = document.createElement('img');
        img.className = 'wsl-slot__img'; img.src = src; img.alt = ''; img.draggable = false;
        _applyImg(img, sl);
        cell.appendChild(img);
        _bind(cell, img, sl);
      } else {
        cell.classList.add('wsl-slot--empty');
        cell.innerHTML = '<span>빈 칸</span>';
      }
      host.appendChild(cell);
    });

    function _applyImg(img, sl) {
      img.style.objectPosition = (clamp(sl.focal.x, 0, 1) * 100) + '% ' + (clamp(sl.focal.y, 0, 1) * 100) + '%';
      img.style.transform = 'scale(' + (sl.zoom || 1) + ')';
    }
    function _bind(cell, img, sl) {
      var pts = {};        // pointerId -> {x,y}
      var drag = null;     // {startFocal, sx, sy}
      var pin = null;      // {d0, z0}
      function down(e) {
        cell.setPointerCapture && cell.setPointerCapture(e.pointerId);
        pts[e.pointerId] = { x: e.clientX, y: e.clientY };
        var ids = Object.keys(pts);
        if (ids.length === 1) { drag = { fx: sl.focal.x, fy: sl.focal.y, sx: e.clientX, sy: e.clientY }; pin = null; }
        else if (ids.length === 2) { pin = { d0: dist(pts[ids[0]], pts[ids[1]]), z0: sl.zoom || 1 }; drag = null; }
        e.preventDefault();
      }
      function move(e) {
        if (!(e.pointerId in pts)) return;
        pts[e.pointerId] = { x: e.clientX, y: e.clientY };
        var ids = Object.keys(pts);
        var rect = cell.getBoundingClientRect();
        if (pin && ids.length >= 2) {
          var dd = dist(pts[ids[0]], pts[ids[1]]);
          sl.zoom = clamp(pin.z0 * (dd / (pin.d0 || 1)), 1, 3.5);
        } else if (drag) {
          // 손가락을 오른쪽으로 끌면 사진이 오른쪽으로 → 왼쪽이 보임 → focal.x 감소.
          // GAIN: 셀 폭의 절반만 끌어도 좌우 끝까지 가도록 감도를 키운다(원장 피드백: 끝까지 안 밀림).
          //   k(=1/zoom)는 확대했을 때 미세 조정이 되도록 유지.
          var k = 1 / Math.max(1, (sl.zoom || 1));
          var GAIN = 1.8;
          sl.focal.x = clamp(drag.fx - (e.clientX - drag.sx) / Math.max(1, rect.width) * k * GAIN, 0, 1);
          sl.focal.y = clamp(drag.fy - (e.clientY - drag.sy) / Math.max(1, rect.height) * k * GAIN, 0, 1);
        }
        _applyImg(img, sl);
        e.preventDefault();
      }
      function up(e) {
        delete pts[e.pointerId];
        var ids = Object.keys(pts);
        if (ids.length === 1) { drag = { fx: sl.focal.x, fy: sl.focal.y, sx: pts[ids[0]].x, sy: pts[ids[0]].y }; pin = null; }
        else if (ids.length === 0) { drag = null; pin = null; try { onChange(layout, sl); } catch (_e) { void _e; } }
      }
      cell.addEventListener('pointerdown', down);
      cell.addEventListener('pointermove', move);
      cell.addEventListener('pointerup', up);
      cell.addEventListener('pointercancel', up);
    }
    return { getLayout: function () { return layout; }, getAssign: function () { return assign; } };
  }

  window.WorkspaceSlotStage = { mount: mount };
})();
