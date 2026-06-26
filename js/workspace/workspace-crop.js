/* Workspace V2 크롭 모달 (Phase 3) — 자체완결 캔버스 크롭. PhotoEditor 코어 미수정(회귀 0).
   비율: 원본 / 1:1 / 4:5 / 9:16 / 자유. 드래그 패닝 + 휠/핀치/슬라이더 줌. 모바일 터치 지원.
   결과: onApply(photoId, dataUrl, meta). originalUrl 미변경(입력은 editedDataUrl||dataUrl).
   출력: long edge ≤2048, 소스가 PNG면 PNG(투명 유지), 아니면 JPEG 0.92. */
(function () {
  'use strict';
  var MAX_EDGE = 2048;
  var RATIOS = [
    { k: 'original', label: '원본', r: 0 },
    { k: '1:1', label: '1:1', r: 1 },
    { k: '4:5', label: '4:5', r: 4 / 5 },
    { k: '9:16', label: '9:16', r: 9 / 16 },
    { k: '16:9', label: '16:9', r: 16 / 9 },   // [v536] 가로형 추가
    { k: 'free', label: '자유', r: -1 },
  ];

  var el, cv, ctx, S;

  function toast(m) { if (window.showToast) window.showToast(m); }

  function shell() {
    return '<div class="wscrop__bd" data-wc="cancel"></div>' +
      '<div class="wscrop__card">' +
        '<div class="wscrop__bar">' +
          '<button class="wscrop__x" data-wc="cancel" aria-label="취소"><i class="ph-bold ph-x"></i></button>' +
          '<div class="wscrop__title">비율 자르기</div>' +
          '<button class="wscrop__apply" data-wc="apply">적용</button>' +
        '</div>' +
        '<div class="wscrop__stage"><canvas class="wscrop__cv" data-wc-cv></canvas></div>' +
        '<div class="wscrop__strip" data-wc-strip></div>' +
        '<div class="wscrop__ratios" data-wc-ratios></div>' +
        '<div class="wscrop__zoom"><i class="ph-duotone ph-magnifying-glass-minus"></i>' +
          '<input type="range" min="100" max="400" value="100" data-wc-zoom>' +
          '<i class="ph-duotone ph-magnifying-glass-plus"></i>' +
          '<button class="wscrop__reset" data-wc="reset">리셋</button></div>' +
      '</div>';
  }

  function ensureEl() {
    el = document.getElementById('wsCropModal');
    if (el) return;
    el = document.createElement('div');
    el.id = 'wsCropModal'; el.className = 'wscrop';
    el.innerHTML = shell();
    document.body.appendChild(el);
    bind();
  }

  function _loadImg(src) {
    return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = rej; im.src = src; });
  }

  var HANDLE = 9;   // [v568·B-4] 자유 비율 핸들 크기/히트영역
  function _frame() {
    // 캔버스 내 크롭 프레임(여백 16). 비율별 최대 fit. original/free 는 사용가능영역 비율.
    var pad = 16, W = cv.width, H = cv.height, aw = W - pad * 2, ah = H - pad * 2;
    // [v568·B-4] 자유 비율 + 사용자가 핸들로 조정한 박스가 있으면 그 박스를 그대로 사용.
    if (S.ratioK === 'free' && S.freeRect) {
      var fr = S.freeRect;
      return { x: fr.x, y: fr.y, w: fr.w, h: fr.h, r: fr.w / fr.h };
    }
    var r = S.ratioR;
    if (r === 0) r = S.img.width / S.img.height;        // 원본
    if (r === -1) r = aw / ah;                            // 자유 = 스테이지 비율
    var fw = aw, fh = aw / r;
    if (fh > ah) { fh = ah; fw = ah * r; }
    return { x: (W - fw) / 2, y: (H - fh) / 2, w: fw, h: fh, r: r };
  }
  // [v568·B-4] 이미지가 실제로 덮는 영역 ∩ 캔버스 여백 — 자유박스는 이 범위를 벗어나지 못함(cover 불변식 유지).
  function _bounds() {
    var pad = 16;
    var ix0 = S.ox, iy0 = S.oy, ix1 = S.ox + S.img.width * S.scale, iy1 = S.oy + S.img.height * S.scale;
    return { x0: Math.max(pad, ix0), y0: Math.max(pad, iy0), x1: Math.min(cv.width - pad, ix1), y1: Math.min(cv.height - pad, iy1) };
  }
  // 자유 박스 코너 핸들 히트 테스트 — px,py 는 캔버스 좌표.
  function _hitHandle(px, py) {
    if (S.ratioK !== 'free') return null;
    var f = S.frame; if (!f) return null;
    var t = HANDLE + 7;
    var corners = { tl: [f.x, f.y], tr: [f.x + f.w, f.y], bl: [f.x, f.y + f.h], br: [f.x + f.w, f.y + f.h] };
    for (var k in corners) { if (Math.abs(px - corners[k][0]) <= t && Math.abs(py - corners[k][1]) <= t) return k; }
    return null;
  }

  function _clampOffset(f) {
    var iw = S.img.width * S.scale, ih = S.img.height * S.scale;
    // 이미지가 프레임을 항상 덮도록 offset 클램프
    S.ox = Math.min(f.x, Math.max(f.x + f.w - iw, S.ox));
    S.oy = Math.min(f.y, Math.max(f.y + f.h - ih, S.oy));
  }

  function draw() {
    var f = S.frame = _frame();
    var base = Math.max(f.w / S.img.width, f.h / S.img.height); // cover baseline
    S.scale = base * S.zoom;
    if (S.ox == null) { S.ox = f.x + (f.w - S.img.width * S.scale) / 2; S.oy = f.y + (f.h - S.img.height * S.scale) / 2; }
    _clampOffset(f);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#1f1b18'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(S.img, S.ox, S.oy, S.img.width * S.scale, S.img.height * S.scale);
    // 프레임 밖 어둡게
    ctx.fillStyle = 'rgba(31,27,24,.62)';
    ctx.fillRect(0, 0, cv.width, f.y);
    ctx.fillRect(0, f.y + f.h, cv.width, cv.height - f.y - f.h);
    ctx.fillRect(0, f.y, f.x, f.h);
    ctx.fillRect(f.x + f.w, f.y, cv.width - f.x - f.w, f.h);
    // 프레임 테두리
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(f.x + 1, f.y + 1, f.w - 2, f.h - 2);
    // [v568·B-4] 자유 비율일 때만 코너 핸들 노출 — 드래그로 박스 크기 직접 조정.
    if (S.ratioK === 'free') {
      var hs = HANDLE;
      var cs = [[f.x, f.y], [f.x + f.w, f.y], [f.x, f.y + f.h], [f.x + f.w, f.y + f.h]];
      ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1;
      for (var ci = 0; ci < cs.length; ci++) { ctx.fillRect(cs[ci][0] - hs / 2, cs[ci][1] - hs / 2, hs, hs); ctx.strokeRect(cs[ci][0] - hs / 2, cs[ci][1] - hs / 2, hs, hs); }
    }
  }
  // [v568·B-4] 코너 드래그 → 자유 박스 리사이즈. 반대 코너 고정, 최소 40px, 이미지 덮는 범위로 클램프.
  function _resizeFree(corner, px, py) {
    var f = S.frame, b = _bounds(), MIN = 40;
    var left = f.x, top = f.y, right = f.x + f.w, bottom = f.y + f.h;
    var nx = Math.max(b.x0, Math.min(b.x1, px)), ny = Math.max(b.y0, Math.min(b.y1, py));
    if (corner === 'tl' || corner === 'bl') left = Math.min(nx, right - MIN); else right = Math.max(nx, left + MIN);
    if (corner === 'tl' || corner === 'tr') top = Math.min(ny, bottom - MIN); else bottom = Math.max(ny, top + MIN);
    S.freeRect = { x: left, y: top, w: right - left, h: bottom - top };
    draw();
  }

  function renderChips() {
    el.querySelector('[data-wc-ratios]').innerHTML = RATIOS.map(function (r) {
      return '<button class="wscrop__chip' + (S.ratioK === r.k ? ' on' : '') + '" data-wc-ratio="' + r.k + '">' + r.label + '</button>';
    }).join('');
    var strip = el.querySelector('[data-wc-strip]');
    if (S.photos.length > 1) {
      strip.style.display = 'flex';
      strip.innerHTML = S.photos.map(function (p, i) {
        var src = p.editedDataUrl || p.dataUrl;
        var tag = p.role === 'before' ? '전' : (p.role === 'after' ? '후' : '');
        return '<button class="wscrop__thumb' + (i === S.index ? ' on' : '') + '" data-wc-photo="' + i + '" style="background-image:url(' + src + ')">' + (tag ? '<span>' + tag + '</span>' : '') + '</button>';
      }).join('');
    } else { strip.style.display = 'none'; }
  }

  function loadPhoto(i) {
    S.index = i;
    var p = S.photos[i];
    var src = p.editedDataUrl || p.dataUrl;
    S.ox = S.oy = null; S.zoom = 1; S.freeRect = null;
    var zr = el.querySelector('[data-wc-zoom]'); if (zr) zr.value = 100;
    return _loadImg(src).then(function (im) { S.img = im; draw(); renderChips(); });
  }

  function _sizeCanvas() {
    var stage = el.querySelector('.wscrop__stage');
    var w = Math.min(stage.clientWidth || 340, 360);
    var h = Math.min(Math.round(w * 1.18), (window.innerHeight || 700) * 0.52);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cv.width = w; cv.height = h; // 좌표는 CSS px 기준으로 단순화 (dpr 무시: 출력은 소스 픽셀 기준이라 품질 무관)
  }

  function _export() {
    var p = S.photos[S.index];
    var f = S.frame;
    var srcPng = /^data:image\/png/i.test(p.editedDataUrl || p.dataUrl || '');
    var out = document.createElement('canvas');
    if (S.ratioK === 'original') {
      // 크롭 없음 — 전체(캡)
      var ow = S.img.width, oh = S.img.height, k0 = Math.min(1, MAX_EDGE / Math.max(ow, oh));
      out.width = Math.round(ow * k0); out.height = Math.round(oh * k0);
      out.getContext('2d').drawImage(S.img, 0, 0, out.width, out.height);
    } else {
      var sx = (f.x - S.ox) / S.scale, sy = (f.y - S.oy) / S.scale, sw = f.w / S.scale, sh = f.h / S.scale;
      var k = Math.min(1, MAX_EDGE / Math.max(sw, sh));
      out.width = Math.max(1, Math.round(sw * k)); out.height = Math.max(1, Math.round(sh * k));
      out.getContext('2d').drawImage(S.img, sx, sy, sw, sh, 0, 0, out.width, out.height);
    }
    var dataUrl = srcPng ? out.toDataURL('image/png') : out.toDataURL('image/jpeg', 0.92);
    var meta = { ratio: S.ratioK, rect: { sx: f ? f.x : 0, sy: f ? f.y : 0, w: f ? f.w : 0, h: f ? f.h : 0 }, zoom: S.zoom, offset: { x: S.ox, y: S.oy }, createdAt: Date.now() };
    return { photoId: p.id, dataUrl: dataUrl, meta: meta };
  }

  function bind() {
    cv = el.querySelector('[data-wc-cv]'); ctx = cv.getContext('2d');
    el.addEventListener('click', function (e) {
      var a = e.target.closest('[data-wc]'); var k = a && a.getAttribute('data-wc');
      if (k === 'cancel') { close(); return; }
      if (k === 'reset') { S.ox = S.oy = null; S.zoom = 1; S.freeRect = null; el.querySelector('[data-wc-zoom]').value = 100; draw(); return; }
      if (k === 'apply') {
        var r = _export();
        if (S.onApply) S.onApply(r.photoId, r.dataUrl, r.meta);
        // 여러 장이면 다음 미크롭으로 안내, 아니면 닫기
        close(); toast('적용했어요');
        return;
      }
      var rc = e.target.closest('[data-wc-ratio]'); if (rc) { S.ratioK = rc.getAttribute('data-wc-ratio'); S.ratioR = (RATIOS.filter(function (x) { return x.k === S.ratioK; })[0] || {}).r; S.ox = S.oy = null; S.freeRect = null; draw(); renderChips(); if (S.ratioK === 'free') toast('모서리를 끌어 자유롭게 잘라요'); return; }
      var ph = e.target.closest('[data-wc-photo]'); if (ph) { loadPhoto(+ph.getAttribute('data-wc-photo')); return; }
    });
    el.querySelector('[data-wc-zoom]').addEventListener('input', function (e) { S.zoom = (+e.target.value) / 100; draw(); });
    // 드래그 패닝 (포인터) + 핀치 줌
    var dragging = false, lastX = 0, lastY = 0, pts = {}, pinchBase = 0, pinchZoom0 = 1, resizing = null;
    function _cvXY(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    cv.addEventListener('pointerdown', function (e) {
      cv.setPointerCapture(e.pointerId); pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (Object.keys(pts).length === 1) {
        var lp = _cvXY(e); var hc = _hitHandle(lp.x, lp.y);   // [v568·B-4] 코너 핸들 먼저 검사 → 박스 리사이즈
        if (hc) { resizing = hc; dragging = false; return; }
        dragging = true; lastX = e.clientX; lastY = e.clientY;
      } else if (Object.keys(pts).length === 2) { var k = Object.keys(pts); pinchBase = _dist(pts[k[0]], pts[k[1]]); pinchZoom0 = S.zoom; dragging = false; resizing = null; }
    });
    cv.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) return; pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (resizing) { var lp = _cvXY(e); _resizeFree(resizing, lp.x, lp.y); return; }
      var ids = Object.keys(pts);
      if (ids.length === 2 && pinchBase) { var dz = _dist(pts[ids[0]], pts[ids[1]]) / pinchBase; S.zoom = Math.min(4, Math.max(1, pinchZoom0 * dz)); el.querySelector('[data-wc-zoom]').value = Math.round(S.zoom * 100); draw(); return; }
      if (dragging) { S.ox += (e.clientX - lastX); S.oy += (e.clientY - lastY); lastX = e.clientX; lastY = e.clientY; draw(); }
    });
    function endPt(e) { delete pts[e.pointerId]; if (Object.keys(pts).length < 2) pinchBase = 0; if (Object.keys(pts).length === 0) { dragging = false; resizing = null; } }
    cv.addEventListener('pointerup', endPt); cv.addEventListener('pointercancel', endPt);
    cv.addEventListener('wheel', function (e) { e.preventDefault(); S.zoom = Math.min(4, Math.max(1, S.zoom * (e.deltaY < 0 ? 1.08 : 0.92))); el.querySelector('[data-wc-zoom]').value = Math.round(S.zoom * 100); draw(); }, { passive: false });
  }
  function _dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function open(opts) {
    opts = opts || {};
    var photos = (opts.photos || []).filter(function (p) { return p && (p.editedDataUrl || p.dataUrl); });
    if (!photos.length) { toast('자를 사진이 없어요'); return; }
    ensureEl();
    S = { photos: photos, index: opts.index || 0, onApply: opts.onApply,
      ratioK: opts.ratio || '4:5', ratioR: (RATIOS.filter(function (x) { return x.k === (opts.ratio || '4:5'); })[0] || RATIOS[2]).r,
      zoom: 1, ox: null, oy: null, img: null, freeRect: null };
    el.classList.add('is-open');
    _sizeCanvas();
    loadPhoto(S.index);
  }
  function close() { if (el) el.classList.remove('is-open'); }

  window.WorkspaceCrop = { open: open, close: close };
})();
