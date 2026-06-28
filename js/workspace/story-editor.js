/*
 * story-editor.js — 인스타 스토리식 텍스트 편집기 (자체 완결)  [Phase B-1]
 *
 * 작업실 전용. 구 PhotoEditor 에 의존/라우팅하지 않는다(작업실 규칙). DOM 기반 텍스트 레이어:
 *   드래그 이동 / 핀치·핸들 확대 / 회전 / 선택 / 삭제, 하단 기본 타이포(글꼴·크기·색·굵기·정렬).
 *   '저장' 시 캔버스로 구워(bake) onDone(dataUrl) 콜백. (전체 타이포/이모지=B-2, 스티커=B-3)
 *
 * 진입: window.StoryEditor.open({ photoUrl, layers?, ratio?, onDone, onCancel })
 *   layers = [{ id?, text, role?, x,y,w, size, color, weight, align, rot?, lineHeight?, opacity? }]
 *     좌표 x/y/w 는 스테이지(프레임) 기준 0..1 상대값. size 는 짧은 변 대비 비율(0..1).
 *   없으면 빈 캔버스. ratio 예: '4:5'|'1:1'|'9:16'(기본 active ShopStyle, 없으면 4:5)
 *
 * PC 풀스크린 오버레이는 style-responsive.css 의 hub-overlay 목록에 #seOverlay 등록(사이드바 가림 방지).
 */
(function () {
  'use strict';
  if (window.StoryEditor) return;

  var CSS_HREF = 'css/story-editor.css';
  function _ensureCss() {
    if (document.querySelector('link[data-se-css]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = CSS_HREF; l.setAttribute('data-se-css', '1');
    document.head.appendChild(l);
  }

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return (typeof window._uid === 'function') ? window._uid() : 'se_' + Math.random().toString(36).slice(2, 8); }
  function toast(m) { if (window.showToast) window.showToast(m); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  var FONTS = [
    { v: 'Pretendard', l: 'Pretendard' },
    { v: '"Apple SD Gothic Neo", Pretendard, sans-serif', l: '애플산돌고딕' },
    { v: '"Nanum Myeongjo", serif', l: '나눔명조' },
    { v: '"Gowun Dodum", sans-serif', l: '고운돋움' }
  ];
  var COLORS = ['#ffffff', '#000000', '#D58A95', '#1f1f1f', '#f7d9df', '#3b6fb6', '#e8b04b', '#5a8a5a'];

  // ── 상태 ──────────────────────────────────────────────────
  var S = null;   // { root, stage, photoUrl, ratio, layers[], selId, onDone, onCancel, undo[], redo[] }

  function open(opts) {
    opts = opts || {};
    _ensureCss();
    var ratio = opts.ratio || (window.ShopStyle && window.ShopStyle.getActive() && window.ShopStyle.getActive().frame.ratio) || '4:5';
    S = {
      photoUrl: opts.photoUrl || '',
      ratio: ratio,
      layers: (opts.layers || []).map(_normLayer),
      selId: null,
      onDone: typeof opts.onDone === 'function' ? opts.onDone : null,
      onCancel: typeof opts.onCancel === 'function' ? opts.onCancel : null,
      panelTab: 'font',
      undo: [], redo: []
    };
    if (S.layers.length) S.selId = S.layers[0].id;
    _mount();
    _snapshot(true);
    return S;
  }

  function _normLayer(l) {
    return {
      id: l.id || uid(),
      text: l.text != null ? String(l.text) : '텍스트',
      role: l.role || 'body',
      x: l.x != null ? l.x : 0.5,
      y: l.y != null ? l.y : 0.5,
      w: l.w != null ? l.w : 0.8,
      size: l.size != null ? l.size : 0.06,
      color: l.color || '#ffffff',
      weight: l.weight != null ? l.weight : 700,
      align: l.align || 'center',
      rot: l.rot || 0,
      lineHeight: l.lineHeight != null ? l.lineHeight : 1.25,
      letterSpacing: l.letterSpacing != null ? l.letterSpacing : 0,
      opacity: l.opacity != null ? l.opacity : 1,
      font: l.font || 'Pretendard',
      shadow: l.shadow !== false
    };
  }

  // ── 마운트/렌더 ───────────────────────────────────────────
  function _mount() {
    var old = document.getElementById('seOverlay'); if (old) old.remove();
    var root = document.createElement('div');
    root.id = 'seOverlay'; root.className = 'se-overlay';
    root.innerHTML =
      '<div class="se-top">' +
        '<button class="se-icobtn" data-se="cancel" aria-label="닫기"><i class="ph-duotone ph-x"></i></button>' +
        '<div class="se-top__mid">' +
          '<button class="se-icobtn" data-se="undo" aria-label="되돌리기"><i class="ph-duotone ph-arrow-counter-clockwise"></i></button>' +
          '<button class="se-icobtn" data-se="redo" aria-label="다시"><i class="ph-duotone ph-arrow-clockwise"></i></button>' +
        '</div>' +
        '<button class="se-savebtn" data-se="save">저장</button>' +
      '</div>' +
      '<div class="se-body">' +
        '<div class="se-stagewrap"><div class="se-stage" data-se-stage></div></div>' +
        '<div class="se-tools">' +
          '<button class="se-tool" data-se="addtext"><span class="se-tool__ic se-tool__aa">Aa</span><span class="se-tool__l">텍스트</span></button>' +
          '<button class="se-tool" data-se="sticker"><span class="se-tool__ic"><i class="ph-duotone ph-sticker"></i></span><span class="se-tool__l">스티커</span></button>' +
          '<button class="se-tool" data-se="addphoto"><span class="se-tool__ic"><i class="ph-duotone ph-image"></i></span><span class="se-tool__l">사진 추가</span></button>' +
          '<button class="se-tool" data-se="emoji"><span class="se-tool__ic"><i class="ph-duotone ph-smiley"></i></span><span class="se-tool__l">이모지</span></button>' +
          '<button class="se-tool" data-se="more"><span class="se-tool__ic"><i class="ph-duotone ph-dots-three"></i></span><span class="se-tool__l">더보기</span></button>' +
        '</div>' +
      '</div>' +
      '<div class="se-panel" data-se-panel hidden></div>';
    document.body.appendChild(root);
    S.root = root;
    S.stage = root.querySelector('[data-se-stage]');
    _applyRatio();
    _renderStage();
    _renderPanel();
    _bind();
    // 시스템 back 으로 닫히게(있으면)
    try { if (window._registerSheet) window._registerSheet('seOverlay', { close: cancel, isOpen: function () { return !!document.getElementById('seOverlay'); } }); } catch (_e) { void _e; }
  }

  function _applyRatio() {
    S.stage.style.backgroundImage = S.photoUrl ? 'url(' + S.photoUrl + ')' : 'none';
    _fitStage();
    if (!S._resizeBound) {
      S._resizeBound = function () { _fitStage(); _renderStage(); };
      window.addEventListener('resize', S._resizeBound);
    }
  }
  // 스테이지(프레임) 크기를 가용 영역 + 비율에 맞춰 px 로 명시. 절대배치 레이어라 CSS aspect 만으론 0 붕괴.
  function _fitStage() {
    var wrap = S.stage.parentElement; if (!wrap) return;
    var aw = wrap.clientWidth, ah = wrap.clientHeight;
    if (!aw || !ah) return;   // 숨김(인증 게이트 등) 상태면 보류
    var parts = String(S.ratio).split(':'); var rw = +parts[0] || 4, rh = +parts[1] || 5;
    var w = aw, h = w * rh / rw;
    if (h > ah) { h = ah; w = h * rw / rh; }
    S.stage.style.width = Math.floor(w) + 'px';
    S.stage.style.height = Math.floor(h) + 'px';
  }

  function _renderStage() {
    // 텍스트 레이어 외 배경/핸들 유지 — 레이어만 다시 그림
    [].slice.call(S.stage.querySelectorAll('.se-layer')).forEach(function (n) { n.remove(); });
    S.layers.forEach(function (l) { S.stage.appendChild(_layerEl(l)); });
  }

  function _layerEl(l) {
    var rect = S.stage.getBoundingClientRect();
    var base = rect.width || 320, baseH = rect.height || 400;
    var shortSide = Math.min(base, baseH);
    var el = document.createElement('div');
    el.className = 'se-layer' + (l.id === S.selId ? ' sel' : '');
    el.setAttribute('data-se-layer', l.id);
    el.style.left = (l.x * 100) + '%';
    el.style.top = (l.y * 100) + '%';
    el.style.width = (l.w * 100) + '%';
    el.style.transform = 'translate(-50%,-50%) rotate(' + l.rot + 'deg)';
    var txt = document.createElement('div');
    txt.className = 'se-layer__txt';
    txt.contentEditable = 'true';
    txt.spellcheck = false;
    txt.textContent = l.text;
    txt.style.fontFamily = l.font;
    txt.style.fontSize = (l.size * shortSide) + 'px';
    txt.style.color = l.color;
    txt.style.fontWeight = l.weight;
    txt.style.textAlign = l.align;
    txt.style.lineHeight = l.lineHeight;
    txt.style.letterSpacing = (l.letterSpacing) + 'em';
    txt.style.opacity = l.opacity;
    txt.style.textShadow = l.shadow ? '0 2px 8px rgba(0,0,0,.45)' : 'none';
    el.appendChild(txt);
    // 핸들(선택 시)
    el.insertAdjacentHTML('beforeend',
      '<button class="se-h se-h--del" data-se-h="del" aria-label="삭제"><i class="ph-duotone ph-x"></i></button>' +
      '<button class="se-h se-h--rot" data-se-h="rot" aria-label="크기·회전"><i class="ph-duotone ph-arrows-out-cardinal"></i></button>');
    return el;
  }

  function _selLayer() { for (var i = 0; i < S.layers.length; i++) if (S.layers[i].id === S.selId) return S.layers[i]; return null; }

  function _select(id) {
    S.selId = id;
    [].slice.call(S.stage.querySelectorAll('.se-layer')).forEach(function (n) { n.classList.toggle('sel', n.getAttribute('data-se-layer') === id); });
    _renderPanel();
  }

  // ── 하단 타이포 패널(B-1: 글꼴/크기/색/굵기/정렬) ──────────
  function _renderPanel() {
    var panel = S.root.querySelector('[data-se-panel]');
    var l = _selLayer();
    // 패널 표시 여부가 바뀌면 se-body 높이가 변함 → 스테이지 재맞춤(+레이어 재렌더, 단 편집 중엔 보호).
    var nowHidden = !l;
    if (S._panelHidden !== nowHidden) {
      S._panelHidden = nowHidden;
      var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
      raf(function () {
        if (!S || !S.stage) return;
        _fitStage();
        var ae = document.activeElement;
        if (!(ae && ae.classList && ae.classList.contains('se-layer__txt'))) _renderStage();
      });
    }
    if (!l) { panel.hidden = true; panel.innerHTML = ''; return; }
    panel.hidden = false;
    var tabs = [['font', '글꼴'], ['style', '스타일'], ['color', '색상'], ['align', '정렬']];
    var tabBar = '<div class="se-panel__tabs">' + tabs.map(function (t) {
      return '<button class="se-ptab' + (S.panelTab === t[0] ? ' on' : '') + '" data-se-ptab="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div>';
    var body = '';
    if (S.panelTab === 'font') {
      body = '<div class="se-prow se-prow--fonts">' + FONTS.map(function (f) {
        return '<button class="se-fontchip' + (l.font === f.v ? ' on' : '') + '" data-se-font="' + esc(f.v) + '" style="font-family:' + f.v + '">' + esc(f.l) + '</button>';
      }).join('') + '</div>' +
      '<div class="se-prow"><span class="se-plabel">크기</span><input type="range" min="2" max="18" step="0.5" value="' + (l.size * 100).toFixed(1) + '" data-se-size></div>';
    } else if (S.panelTab === 'style') {
      body = '<div class="se-prow">' +
        '<button class="se-sbtn' + (l.weight >= 800 ? ' on' : '') + '" data-se-weight><b>B</b> 굵게</button>' +
        '<button class="se-sbtn' + (l.shadow ? ' on' : '') + '" data-se-shadow><i class="ph-duotone ph-drop"></i> 그림자</button>' +
        '</div>' +
        '<div class="se-prow"><span class="se-plabel">투명도</span><input type="range" min="20" max="100" step="5" value="' + Math.round(l.opacity * 100) + '" data-se-opacity></div>';
    } else if (S.panelTab === 'color') {
      body = '<div class="se-prow se-prow--colors">' + COLORS.map(function (c) {
        return '<button class="se-color' + (l.color.toLowerCase() === c.toLowerCase() ? ' on' : '') + '" data-se-color="' + c + '" style="background:' + c + '"></button>';
      }).join('') + '</div>';
    } else if (S.panelTab === 'align') {
      body = '<div class="se-prow">' + [['left', 'ph-text-align-left'], ['center', 'ph-text-align-center'], ['right', 'ph-text-align-right']].map(function (a) {
        return '<button class="se-sbtn' + (l.align === a[0] ? ' on' : '') + '" data-se-align="' + a[0] + '"><i class="ph-duotone ' + a[1] + '"></i></button>';
      }).join('') + '</div>';
    }
    panel.innerHTML = tabBar + '<div class="se-panel__body">' + body + '</div>';
  }

  // ── 입력/조작 바인딩 ──────────────────────────────────────
  function _bind() {
    var root = S.root;
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-se]'); if (!b) return;
      var a = b.getAttribute('data-se');
      if (a === 'cancel') return cancel();
      if (a === 'save') return save();
      if (a === 'undo') return _undo();
      if (a === 'redo') return _redo();
      if (a === 'addtext') return _addText();
      if (a === 'sticker' || a === 'addphoto' || a === 'emoji' || a === 'more') { toast('곧 제공돼요'); return; }   // B-2/B-3
    });
    // 패널 탭/컨트롤
    root.addEventListener('click', function (e) {
      var pt = e.target.closest('[data-se-ptab]'); if (pt) { S.panelTab = pt.getAttribute('data-se-ptab'); _renderPanel(); return; }
      var fc = e.target.closest('[data-se-font]'); if (fc) { _patch({ font: fc.getAttribute('data-se-font') }); return; }
      var cc = e.target.closest('[data-se-color]'); if (cc) { _patch({ color: cc.getAttribute('data-se-color') }); return; }
      var al = e.target.closest('[data-se-align]'); if (al) { _patch({ align: al.getAttribute('data-se-align') }); return; }
      if (e.target.closest('[data-se-weight]')) { var l1 = _selLayer(); _patch({ weight: (l1 && l1.weight >= 800) ? 600 : 800 }); return; }
      if (e.target.closest('[data-se-shadow]')) { var l2 = _selLayer(); _patch({ shadow: !(l2 && l2.shadow) }); return; }
    });
    root.addEventListener('input', function (e) {
      if (e.target.matches('[data-se-size]')) { _patch({ size: (+e.target.value) / 100 }, true); }
      else if (e.target.matches('[data-se-opacity]')) { _patch({ opacity: (+e.target.value) / 100 }, true); }
    });
    root.addEventListener('change', function (e) {
      if (e.target.matches('[data-se-size],[data-se-opacity]')) _snapshot();
    });
    // 레이어 텍스트 편집
    S.stage.addEventListener('input', function (e) {
      var t = e.target.closest('.se-layer__txt'); if (!t) return;
      var host = t.closest('[data-se-layer]'); var l = _findLayer(host.getAttribute('data-se-layer'));
      if (l) l.text = t.textContent;
    });
    S.stage.addEventListener('blur', function (e) { if (e.target.closest && e.target.closest('.se-layer__txt')) _snapshot(); }, true);
    // 레이어 선택/삭제/드래그/회전
    _bindStagePointer();
  }

  function _findLayer(id) { for (var i = 0; i < S.layers.length; i++) if (S.layers[i].id === id) return S.layers[i]; return null; }

  function _patch(patch, live) {
    var l = _selLayer(); if (!l) return;
    Object.assign(l, patch);
    _renderStage(); _renderPanel();
    if (!live) _snapshot();
  }

  function _addText() {
    var l = _normLayer({ text: '새 텍스트', role: 'body', x: 0.5, y: 0.4, w: 0.8, size: 0.07, align: 'center' });
    S.layers.push(l); S.selId = l.id;
    _renderStage(); _renderPanel(); _snapshot();
    // 새 레이어 바로 편집 포커스
    var host = S.stage.querySelector('[data-se-layer="' + l.id + '"] .se-layer__txt'); if (host) { host.focus(); document.execCommand && document.execCommand('selectAll', false, null); }
  }

  // 드래그 이동 + 핀치(터치) + 핸들(회전·크기) + 선택/삭제
  function _bindStagePointer() {
    var drag = null, pinch = null, rotsz = null;
    function stagePx() { var r = S.stage.getBoundingClientRect(); return { w: r.width, h: r.height, left: r.left, top: r.top, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }

    S.stage.addEventListener('pointerdown', function (e) {
      var hb = e.target.closest('[data-se-h]');
      var host = e.target.closest('[data-se-layer]');
      if (hb && host) {
        var id = host.getAttribute('data-se-layer'); _select(id);
        if (hb.getAttribute('data-se-h') === 'del') { _removeLayer(id); return; }
        // 회전·크기 핸들
        var l = _findLayer(id); var sp = stagePx();
        rotsz = { id: id, sp: sp, startRot: l.rot, startSize: l.size };
        e.preventDefault();
        S.stage.setPointerCapture && S.stage.setPointerCapture(e.pointerId);
        return;
      }
      if (host) {
        var lid = host.getAttribute('data-se-layer'); _select(lid);
        // 텍스트 편집 중(focus)엔 드래그 안 함
        if (e.target.closest('.se-layer__txt') && document.activeElement === e.target.closest('.se-layer__txt')) return;
        var ll = _findLayer(lid);
        drag = { id: lid, startX: e.clientX, startY: e.clientY, ox: ll.x, oy: ll.y, sp: stagePx() };
        S.stage.setPointerCapture && S.stage.setPointerCapture(e.pointerId);
      }
    });
    S.stage.addEventListener('pointermove', function (e) {
      if (rotsz) {
        var l = _findLayer(rotsz.id); var sp = rotsz.sp;
        var ang = Math.atan2(e.clientY - sp.cy, e.clientX - sp.cx) * 180 / Math.PI;
        var dist = Math.hypot(e.clientX - sp.cx, e.clientY - sp.cy);
        var ref = Math.min(sp.w, sp.h);
        l.rot = Math.round(ang + 90);
        l.size = clamp(dist / ref * 0.5, 0.02, 0.2);
        _renderStage();
        return;
      }
      if (drag) {
        var ld = _findLayer(drag.id);
        ld.x = clamp(drag.ox + (e.clientX - drag.startX) / drag.sp.w, 0.02, 0.98);
        ld.y = clamp(drag.oy + (e.clientY - drag.startY) / drag.sp.h, 0.02, 0.98);
        var node = S.stage.querySelector('[data-se-layer="' + drag.id + '"]');
        if (node) { node.style.left = (ld.x * 100) + '%'; node.style.top = (ld.y * 100) + '%'; }
      }
    });
    function end() { if (drag || rotsz) { drag = null; rotsz = null; _renderStage(); _renderPanel(); _snapshot(); } }
    S.stage.addEventListener('pointerup', end);
    S.stage.addEventListener('pointercancel', end);

    // 터치 핀치(2손가락) 크기·회전
    S.stage.addEventListener('touchmove', function (e) {
      if (e.touches.length !== 2) return;
      var host = e.target.closest('[data-se-layer]'); if (!host) return;
      var l = _findLayer(host.getAttribute('data-se-layer')); if (!l) return;
      e.preventDefault();
      var t1 = e.touches[0], t2 = e.touches[1];
      var dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      var ang = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180 / Math.PI;
      if (!pinch || pinch.id !== l.id) { pinch = { id: l.id, d0: dist, a0: ang, s0: l.size, r0: l.rot }; return; }
      l.size = clamp(pinch.s0 * (dist / pinch.d0), 0.02, 0.2);
      l.rot = Math.round(pinch.r0 + (ang - pinch.a0));
      _renderStage();
    }, { passive: false });
    S.stage.addEventListener('touchend', function (e) { if (e.touches.length < 2 && pinch) { pinch = null; _renderStage(); _snapshot(); } });
  }

  function _removeLayer(id) {
    S.layers = S.layers.filter(function (l) { return l.id !== id; });
    if (S.selId === id) S.selId = S.layers.length ? S.layers[0].id : null;
    _renderStage(); _renderPanel(); _snapshot();
  }

  // ── undo/redo ─────────────────────────────────────────────
  function _snapshot(reset) {
    var snap = JSON.stringify({ layers: S.layers, selId: S.selId });
    if (reset) { S.undo = [snap]; S.redo = []; return; }
    if (S.undo[S.undo.length - 1] === snap) return;
    S.undo.push(snap); if (S.undo.length > 40) S.undo.shift(); S.redo = [];
  }
  function _restore(snap) { var o = JSON.parse(snap); S.layers = o.layers.map(_normLayer); S.selId = o.selId; _renderStage(); _renderPanel(); }
  function _undo() { if (S.undo.length < 2) { toast('되돌릴 게 없어요'); return; } S.redo.push(S.undo.pop()); _restore(S.undo[S.undo.length - 1]); }
  function _redo() { if (!S.redo.length) { toast('다시 실행할 게 없어요'); return; } var s = S.redo.pop(); S.undo.push(s); _restore(s); }

  // ── bake(캔버스로 굽기) ───────────────────────────────────
  function bake() {
    return new Promise(function (resolve) {
      var parts = String(S.ratio).split(':'); var rw = +parts[0] || 4, rh = +parts[1] || 5;
      var W = 1080, H = Math.round(W * rh / rw);
      var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var ctx = cv.getContext('2d');
      function drawText() {
        var shortSide = Math.min(W, H);
        S.layers.forEach(function (l) {
          ctx.save();
          ctx.translate(l.x * W, l.y * H);
          ctx.rotate(l.rot * Math.PI / 180);
          ctx.globalAlpha = l.opacity;
          var fs = l.size * shortSide;
          ctx.font = l.weight + ' ' + fs + 'px ' + l.font;
          ctx.fillStyle = l.color;
          ctx.textAlign = l.align;
          ctx.textBaseline = 'middle';
          if (l.shadow) { ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = fs * 0.18; ctx.shadowOffsetY = fs * 0.05; }
          var maxW = l.w * W;
          var lines = _wrap(ctx, l.text, maxW);
          var lh = fs * l.lineHeight;
          var startY = -(lines.length - 1) * lh / 2;
          var ax = l.align === 'left' ? -maxW / 2 : (l.align === 'right' ? maxW / 2 : 0);
          lines.forEach(function (ln, i) { ctx.fillText(ln, ax, startY + i * lh); });
          ctx.restore();
        });
        resolve(cv.toDataURL('image/jpeg', 0.92));
      }
      if (S.photoUrl) {
        var img = new Image(); img.crossOrigin = 'anonymous';
        img.onload = function () { _coverDraw(ctx, img, W, H); drawText(); };
        img.onerror = function () { ctx.fillStyle = '#222'; ctx.fillRect(0, 0, W, H); drawText(); };
        img.src = S.photoUrl;
      } else { ctx.fillStyle = '#222'; ctx.fillRect(0, 0, W, H); drawText(); }
    });
  }
  function _coverDraw(ctx, img, W, H) {
    var ir = img.width / img.height, fr = W / H, dw, dh, dx, dy;
    if (ir > fr) { dh = H; dw = H * ir; dx = (W - dw) / 2; dy = 0; }
    else { dw = W; dh = W / ir; dx = 0; dy = (H - dh) / 2; }
    ctx.drawImage(img, dx, dy, dw, dh);
  }
  function _wrap(ctx, text, maxW) {
    var out = [];
    String(text).split('\n').forEach(function (para) {
      var words = para.split(/(\s+)/), line = '';
      words.forEach(function (w) {
        var test = line + w;
        if (ctx.measureText(test).width > maxW && line) { out.push(line.replace(/\s+$/, '')); line = w.replace(/^\s+/, ''); }
        else line = test;
      });
      out.push(line);
    });
    return out;
  }

  function save() {
    bake().then(function (dataUrl) {
      var cb = S.onDone, layers = S.layers.map(function (l) { return Object.assign({}, l); });
      _teardown();
      if (cb) cb(dataUrl, { layers: layers });
    });
  }
  function cancel() { var cb = S.onCancel; _teardown(); if (cb) cb(); }
  function _teardown() {
    if (!S) return;
    try { if (window._unregisterSheet) window._unregisterSheet('seOverlay'); } catch (_e) { void _e; }
    if (S._resizeBound) { try { window.removeEventListener('resize', S._resizeBound); } catch (_e2) { void _e2; } }
    if (S.root) S.root.remove();
    S = null;
  }

  window.StoryEditor = { open: open, isOpen: function () { return !!(S && S.root); }, bake: function () { return S ? bake() : Promise.resolve(null); }, close: cancel };
})();
