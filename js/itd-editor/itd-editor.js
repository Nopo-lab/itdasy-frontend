/* itd-editor.js — 인스타 스토리식 사진 편집기 (Phase 2/3)
   window.ItdEditor.open({ photo, onDone(dataUrl), onCancel })
   도구: 텍스트 · 스티커 · 레이아웃(반달) · 그리기. 색은 --accent 토큰.
   설계: 레이어(텍스트/스티커)는 DOM, 그리기는 canvas. 완료 시 canvas 합성으로 dataURL. */
(function () {
  'use strict';
  if (window.ItdEditor) return;

  var FONTS = [
    { key: 'pretendard', label: '모던',  family: 'Pretendard, sans-serif',    weight: 800 },
    { key: 'serif',      label: '클래식', family: '"Noto Serif KR", serif',    weight: 700 },
    { key: 'black',      label: '또렷',  family: '"Black Han Sans", sans-serif', weight: 400 },
    { key: 'dodum',      label: '도톰',  family: '"Gowun Dodum", sans-serif',  weight: 400 },
    { key: 'pen',        label: '감성',  family: '"Nanum Pen Script", cursive', weight: 400 }
  ];
  var COLORS = ['#FFFFFF', '#15181D', '#BC6675', '#E08A6E', '#E6B45A', '#86B06E', '#6E9BC4', '#A98AC4'];
  var SHOP_STK = ['🌸', '✨', '💗', '🎀', '👑'];
  var EMOJI = ['💄', '💅', '🔥', '😍', '🥰', '💎', '🌟', '🫶', '💖', '🌿', '☁️', '🎉'];
  var LAYOUTS = [
    { key: 'none', label: '기본',     frame: '' },
    { key: 'soft', label: '감성 무드', frame: 'fr-soft' },
    { key: 'mini', label: '미니멀',   frame: 'fr-mini' },
    { key: 'black', label: '블랙',    frame: 'fr-black' }
  ];
  var BRUSHES = ['pen', 'marker', 'neon', 'eraser'];

  function svg(path, sw) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.8) + '" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>'; }
  var IC = {
    x: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
    text: 'Aa',
    sticker: svg('<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4 4 0 0 0 7 0"/><circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/>'),
    layout: svg('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 9v12"/>'),
    draw: svg('<path d="M12 19l7-7-3-3-7 7-1 4 4-1z"/><path d="M16 8l3 3"/>'),
    alnL: svg('<path d="M4 6h16M4 12h10M4 18h13"/>'),
    alnC: svg('<path d="M4 6h16M7 12h10M6 18h12"/>'),
    alnR: svg('<path d="M4 6h16M10 12h10M7 18h13"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>'),
    loc: svg('<path d="M12 21s-7-5.2-7-10a7 7 0 0 1 14 0c0 4.8-7 10-7 10z"/><circle cx="12" cy="11" r="2.2"/>'),
    book: svg('<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/>'),
    price: svg('<path d="M20 12l-8 8-9-9V3h8l9 9z"/><circle cx="7.5" cy="7.5" r="1.3"/>'),
    time: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    pen: svg('<path d="M12 19l7-7-3-3-7 7-1 4 4-1z"/><path d="M16 8l3 3"/>'),
    marker: svg('<path d="M5 19h14"/><path d="M9 15l8-8 3 3-8 8H9v-3z"/>'),
    neon: svg('<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>'),
    eraser: svg('<path d="M7 21h13"/><path d="M5 15l6-6 7 7-4 4H9l-4-4z"/>')
  };

  var S = null;   // session state
  var root = null, refs = {};

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function build() {
    root = el('div', 'itded');
    root.innerHTML =
      '<div class="itded__stage" data-r="stage">' +
        '<div class="itded__photo" data-r="photo"></div>' +
        '<div class="itded__scrim"></div>' +
        '<div class="itded__frame" data-r="frame"></div>' +
        '<canvas class="itded__draw" data-r="draw"></canvas>' +
        '<div class="itded__layers" data-r="layers"></div>' +
      '</div>' +
      '<div class="itded__top">' +
        '<button class="itded__ic" data-r="cancel" aria-label="닫기">' + IC.x + '</button>' +
        '<button class="itded__done" data-r="done">완료</button>' +
      '</div>' +
      '<div class="itded__rail" data-r="rail">' +
        '<button class="itrb on" data-tool="text">Aa</button>' +
        '<button class="itrb" data-tool="sticker">' + IC.sticker + '</button>' +
        '<button class="itrb" data-tool="layout">' + IC.layout + '</button>' +
        '<button class="itrb" data-tool="draw">' + IC.draw + '</button>' +
      '</div>' +
      buildText() + buildSticker() + buildLayout() + buildDraw();
    document.body.appendChild(root);
    cacheRefs();
    wire();
  }

  function buildText() {
    var fonts = FONTS.map(function (f, i) {
      return '<button class="itfont' + (i === 0 ? ' on' : '') + '" data-font="' + f.key + '" style="font-family:' + f.family + (f.key === 'pen' ? ';font-size:20px' : '') + '">' + f.label + '</button>';
    }).join('');
    var colors = COLORS.map(function (c, i) {
      return '<button class="itsw' + (i === 0 ? ' on' : '') + '" data-color="' + c + '" style="background:' + c + '"></button>';
    }).join('');
    return '<div class="itpanel ittext is-open" data-panel="text">' +
        '<div class="ittext__top">' +
          '<span class="italn" data-r="aln">' +
            '<button data-aln="left" class="on">' + IC.alnL + '</button>' +
            '<button data-aln="center">' + IC.alnC + '</button>' +
            '<button data-aln="right">' + IC.alnR + '</button>' +
          '</span>' +
          '<span class="itsize">크기<input type="range" min="0.5" max="2.6" step="0.02" value="1" data-r="size"></span>' +
        '</div>' +
        '<div class="itfonts" data-r="fonts">' + fonts + '</div>' +
        '<div class="itcolors" data-r="colors">' + colors + '</div>' +
      '</div>';
  }
  function buildSticker() {
    var shop = SHOP_STK.map(function (s) { return '<button data-stk="' + s + '">' + s + '</button>'; }).join('');
    var emo = EMOJI.map(function (s) { return '<button data-stk="' + s + '">' + s + '</button>'; }).join('');
    return '<div class="itpanel" data-panel="sticker">' +
      '<div class="itstk" data-r="stkSheet">' +
        '<div class="itgrip"></div>' +
        '<div class="itstk__search">' + IC.search + '스티커 검색</div>' +
        '<div class="itfstk">' +
          '<span class="itfs loc">' + IC.loc + '강남 글로우라운지</span>' +
          '<span class="itfs book">' + IC.book + '예약하기</span>' +
          '<span class="itfs price">' + IC.price + '가격</span>' +
          '<span class="itfs time">' + IC.time + '시간</span>' +
        '</div>' +
        '<div class="itssub">우리샵 에셋</div><div class="itsgrid">' + shop + '</div>' +
        '<div class="itssub" style="margin-top:14px">이모지</div><div class="itsgrid">' + emo + '</div>' +
      '</div></div>';
  }
  function buildLayout() {
    var circ = LAYOUTS.map(function (l, i) {
      return '<button class="itfan' + (i === 0 ? ' on' : '') + '" data-lay="' + i + '"></button>';
    }).join('');
    return '<div class="itpanel itlay" data-panel="layout">' +
      '<div class="itlay__arc" data-r="arc"></div>' + circ +
      '<div class="itlay__hd"><b data-r="layName">기본</b><span>돌려서 사진에 바로 적용</span></div>' +
    '</div>';
  }
  function buildDraw() {
    var brushes = BRUSHES.map(function (b, i) {
      return '<button class="itbrush' + (i === 0 ? ' on' : '') + '" data-brush="' + b + '">' + IC[b] + '</button>';
    }).join('');
    var colors = COLORS.map(function (c, i) {
      return '<button class="itdsw' + (i === 2 ? ' on' : '') + '" data-dcolor="' + c + '" style="background:' + c + '"></button>';
    }).join('');
    return '<div class="itpanel" data-panel="draw">' +
      '<div class="itdraw__top">' + brushes + '</div>' +
      '<div class="itbsize"><input type="range" min="3" max="40" step="1" value="10" data-r="brushSize"></div>' +
      '<div class="itdraw__colors">' + colors + '</div>' +
    '</div>';
  }

  function cacheRefs() {
    ['stage', 'photo', 'frame', 'draw', 'layers', 'rail', 'cancel', 'done', 'aln', 'size', 'fonts', 'colors', 'stkSheet', 'arc', 'layName', 'brushSize'].forEach(function (k) {
      refs[k] = root.querySelector('[data-r="' + k + '"]');
    });
    refs.panels = {};
    root.querySelectorAll('[data-panel]').forEach(function (p) { refs.panels[p.getAttribute('data-panel')] = p; });
    refs.ctx = refs.draw.getContext('2d');
  }

  /* ── 도구 전환 ── */
  function setTool(tool) {
    S.tool = tool;
    root.querySelectorAll('.itrb').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tool') === tool); });
    Object.keys(refs.panels).forEach(function (k) { refs.panels[k].classList.toggle('is-open', k === tool); });
    var drawing = tool === 'draw';
    refs.draw.classList.toggle('is-armed', drawing);
    refs.draw.style.zIndex = drawing ? '5' : '3';
    refs.layers.style.pointerEvents = drawing ? 'none' : '';
    if (tool === 'text' && !S.layers.some(function (l) { return l.type === 'text'; })) addText();
    if (tool === 'layout') layoutFanPositions();
  }

  /* ── 레이어 공통(드래그) ── */
  function makeLayer(type) {
    var box = el('div', 'itl');
    box.innerHTML = '<button class="itl__del">' + svg('<path d="M18 6L6 18M6 6l12 12"/>', 2.4) + '</button>';
    var L = { type: type, el: box, x: 0, y: 0, scale: 1 };
    box.addEventListener('pointerdown', function (e) { onLayerDown(e, L); });
    box.querySelector('.itl__del').addEventListener('click', function (e) { e.stopPropagation(); removeLayer(L); });
    refs.layers.appendChild(box);
    S.layers.push(L);
    return L;
  }
  function placeCenter(L, w, h) {
    var r = refs.stage.getBoundingClientRect();
    L.x = r.width / 2 - (w || L.el.offsetWidth) / 2;
    L.y = r.height / 2 - (h || L.el.offsetHeight) / 2;
    applyXf(L);
  }
  function applyXf(L) { L.el.style.transform = 'translate(' + L.x + 'px,' + L.y + 'px) scale(' + L.scale + ')'; }
  function selectLayer(L) {
    S.active = L;
    S.layers.forEach(function (x) { x.el.classList.toggle('is-active', x === L); });
    if (L && L.type === 'text') syncTextControls(L);
  }
  function removeLayer(L) {
    var i = S.layers.indexOf(L); if (i >= 0) S.layers.splice(i, 1);
    L.el.remove(); if (S.active === L) S.active = null;
  }
  var drag = null;
  function onLayerDown(e, L) {
    e.preventDefault(); selectLayer(L);
    if (L.type === 'text' && L._tapEdit && Date.now() - L._tapEdit < 350) { editText(L); return; }
    L._tapEdit = Date.now();
    drag = { L: L, sx: e.clientX, sy: e.clientY, ox: L.x, oy: L.y };
    try { L.el.setPointerCapture(e.pointerId); } catch (_) { void _; }
    L.el.style.cursor = 'grabbing';
  }
  document.addEventListener('pointermove', function (e) {
    if (!drag) return;
    drag.L.x = drag.ox + (e.clientX - drag.sx);
    drag.L.y = drag.oy + (e.clientY - drag.sy);
    applyXf(drag.L);
  });
  document.addEventListener('pointerup', function () { if (drag) { drag.L.el.style.cursor = 'grab'; drag = null; } });

  /* ── 텍스트 ── */
  function addText() {
    var L = makeLayer('text');
    L.font = FONTS[0]; L.color = COLORS[0]; L.align = 'center'; L.fontSize = 30; L.text = '내용을 입력하세요';
    var t = el('div', 'itl-text'); t.textContent = L.text; t.style.cssText = 'font-family:' + L.font.family + ';font-weight:' + L.font.weight + ';color:' + L.color + ';text-align:center;font-size:' + L.fontSize + 'px';
    L.el.appendChild(t); L.tx = t;
    placeCenter(L, 180, 50); selectLayer(L);
    setTimeout(function () { editText(L); }, 30);
    return L;
  }
  function editText(L) {
    L.tx.setAttribute('contenteditable', 'true'); L.tx.focus();
    document.execCommand && document.execCommand('selectAll', false, null);
    L.tx.addEventListener('blur', function () {
      L.tx.removeAttribute('contenteditable'); L.text = L.tx.textContent || '';
    }, { once: true });
  }
  function syncTextControls(L) {
    root.querySelectorAll('[data-font]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-font') === L.font.key); });
    root.querySelectorAll('[data-color]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-color') === L.color); });
    refs.aln.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-aln') === L.align); });
    refs.size.value = L.scale;
  }
  function applyFont(key) { var L = activeText(); if (!L) return; var f = FONTS.filter(function (x) { return x.key === key; })[0]; L.font = f; L.tx.style.fontFamily = f.family; L.tx.style.fontWeight = f.weight; }
  function applyColor(c) { var L = activeText(); if (!L) return; L.color = c; L.tx.style.color = c; }
  function applyAlign(a) { var L = activeText(); if (!L) return; L.align = a; L.tx.style.textAlign = a; }
  function applyScale(v) { var L = S.active; if (!L) return; L.scale = parseFloat(v); applyXf(L); }
  function activeText() { return S.active && S.active.type === 'text' ? S.active : null; }

  /* ── 스티커 ── */
  function addSticker(emoji) {
    var L = makeLayer('sticker'); L.emoji = emoji; L.fontSize = 64;
    var s = el('div', 'itl-sticker'); s.textContent = emoji; L.el.appendChild(s); L.tx = s;
    placeCenter(L, 64, 64); selectLayer(L);
  }

  /* ── 레이아웃 반달 fan ── */
  function layoutFanPositions() {
    var btn = root.querySelector('.itrb[data-tool="layout"]').getBoundingClientRect();
    var cx = btn.left + btn.width / 2, cy = btn.top + btn.height / 2, R = 116;
    var ang = [135, 165, 195, 225];
    var fans = root.querySelectorAll('.itfan');
    fans.forEach(function (f, i) {
      var s = f.classList.contains('on') ? 64 : 54;
      f.style.width = f.style.height = s + 'px';
      var rad = ang[i] * Math.PI / 180;
      var x = cx + R * Math.cos(rad), y = cy - R * Math.sin(rad);
      f.style.left = (x - s / 2) + 'px'; f.style.top = (y - s / 2) + 'px';
      f.style.backgroundImage = S.photoCss;
    });
    var d = 2 * R;
    refs.arc.style.width = refs.arc.style.height = d + 'px';
    refs.arc.style.left = (cx - R) + 'px'; refs.arc.style.top = (cy - R) + 'px';
  }
  function selectLayout(i) {
    S.layout = LAYOUTS[i];
    refs.frame.className = 'itded__frame ' + (S.layout.frame || '');
    refs.layName.textContent = S.layout.label;
    root.querySelectorAll('.itfan').forEach(function (f, idx) { f.classList.toggle('on', idx === i); });
    layoutFanPositions();
  }

  /* ── 그리기 ── */
  function initCanvas() {
    var r = refs.stage.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    refs.draw.width = Math.round(r.width * dpr); refs.draw.height = Math.round(r.height * dpr);
    refs.draw.style.width = r.width + 'px'; refs.draw.style.height = r.height + 'px';
    refs.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); refs.ctx.lineCap = 'round'; refs.ctx.lineJoin = 'round';
  }
  function strokeStyle() {
    var c = refs.ctx; c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.shadowBlur = 0; c.shadowColor = 'transparent';
    c.lineWidth = S.brushSize; c.strokeStyle = S.drawColor;
    if (S.brush === 'marker') { c.globalAlpha = 0.4; c.lineWidth = S.brushSize * 1.8; }
    else if (S.brush === 'neon') { c.shadowBlur = 12; c.shadowColor = S.drawColor; }
    else if (S.brush === 'eraser') { c.globalCompositeOperation = 'destination-out'; c.lineWidth = S.brushSize * 1.6; }
  }
  var dpos = null;
  function drawDown(e) {
    if (S.tool !== 'draw') return;
    var r = refs.stage.getBoundingClientRect(); dpos = { x: e.clientX - r.left, y: e.clientY - r.top };
    strokeStyle(); refs.ctx.beginPath(); refs.ctx.moveTo(dpos.x, dpos.y); refs.ctx.lineTo(dpos.x + 0.1, dpos.y + 0.1); refs.ctx.stroke();
    try { refs.draw.setPointerCapture(e.pointerId); } catch (_) { void _; }
  }
  function drawMove(e) {
    if (!dpos || S.tool !== 'draw') return;
    var r = refs.stage.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    refs.ctx.beginPath(); refs.ctx.moveTo(dpos.x, dpos.y); refs.ctx.lineTo(x, y); refs.ctx.stroke();
    dpos = { x: x, y: y };
  }
  function drawUp() { dpos = null; }

  /* ── 합성 내보내기 ── */
  function exportComposite(cb) {
    var r = refs.stage.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = function () {
      // cover
      var iw = img.width, ih = img.height, sc = Math.max(r.width / iw, r.height / ih);
      var dw = iw * sc, dh = ih * sc;
      c.drawImage(img, (r.width - dw) / 2, (r.height - dh) / 2, dw, dh);
      c.drawImage(refs.draw, 0, 0, r.width, r.height);   // 드로잉
      S.layers.forEach(function (L) {
        var b = L.el.getBoundingClientRect();
        var cx = b.left - r.left + b.width / 2, cy = b.top - r.top + b.height / 2;
        if (L.type === 'sticker') {
          c.font = (L.fontSize * L.scale) + 'px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(L.emoji, cx, cy);
        } else {
          var lines = (L.text || '').split('\n'); var fs = L.fontSize * L.scale;
          c.font = L.font.weight + ' ' + fs + 'px ' + L.font.family; c.fillStyle = L.color;
          c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowBlur = 8; c.shadowColor = 'rgba(0,0,0,.35)';
          var total = lines.length * fs * 1.16, sy = cy - total / 2 + fs * 0.58;
          lines.forEach(function (ln, i) { c.fillText(ln, cx, sy + i * fs * 1.16); });
          c.shadowBlur = 0;
        }
      });
      try { cb(cv.toDataURL('image/jpeg', 0.92)); } catch (e) { cb(null); }
    };
    img.onerror = function () { cb(null); };
    img.src = S.photoUrl;
  }

  /* ── 배선 ── */
  function wire() {
    refs.rail.addEventListener('click', function (e) { var b = e.target.closest('[data-tool]'); if (b) setTool(b.getAttribute('data-tool')); });
    refs.stage.addEventListener('pointerdown', function (e) { if (e.target === refs.stage || e.target === refs.photo || e.target.classList.contains('itded__scrim')) selectLayer(null); });
    // 텍스트 컨트롤
    refs.fonts.addEventListener('click', function (e) { var b = e.target.closest('[data-font]'); if (!b) return; applyFont(b.getAttribute('data-font')); root.querySelectorAll('[data-font]').forEach(function (x) { x.classList.toggle('on', x === b); }); });
    refs.colors.addEventListener('click', function (e) { var b = e.target.closest('[data-color]'); if (!b) return; applyColor(b.getAttribute('data-color')); root.querySelectorAll('[data-color]').forEach(function (x) { x.classList.toggle('on', x === b); }); });
    refs.aln.addEventListener('click', function (e) { var b = e.target.closest('[data-aln]'); if (!b) return; applyAlign(b.getAttribute('data-aln')); refs.aln.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); });
    refs.size.addEventListener('input', function () { applyScale(refs.size.value); });
    // 스티커
    refs.stkSheet.addEventListener('click', function (e) { var b = e.target.closest('[data-stk]'); if (b) addSticker(b.getAttribute('data-stk')); });
    refs.stkSheet.querySelector('.itgrip').addEventListener('click', function () { refs.stkSheet.classList.toggle('is-tall'); });
    // 레이아웃
    refs.panels.layout.addEventListener('click', function (e) { var b = e.target.closest('[data-lay]'); if (b) selectLayout(+b.getAttribute('data-lay')); });
    // 그리기
    root.querySelector('[data-panel="draw"] .itdraw__top').addEventListener('click', function (e) { var b = e.target.closest('[data-brush]'); if (!b) return; S.brush = b.getAttribute('data-brush'); root.querySelectorAll('[data-brush]').forEach(function (x) { x.classList.toggle('on', x === b); }); });
    refs.brushSize.addEventListener('input', function () { S.brushSize = +refs.brushSize.value; });
    root.querySelector('[data-panel="draw"] .itdraw__colors').addEventListener('click', function (e) { var b = e.target.closest('[data-dcolor]'); if (!b) return; S.drawColor = b.getAttribute('data-dcolor'); root.querySelectorAll('[data-dcolor]').forEach(function (x) { x.classList.toggle('on', x === b); }); });
    refs.draw.addEventListener('pointerdown', drawDown);
    refs.draw.addEventListener('pointermove', drawMove);
    refs.draw.addEventListener('pointerup', drawUp);
    // 닫기/완료
    refs.cancel.addEventListener('click', function () { close(); if (S && S.onCancel) S.onCancel(); });
    refs.done.addEventListener('click', function () {
      var cb = S.onDone; refs.done.textContent = '저장 중…'; refs.done.disabled = true;
      exportComposite(function (url) {
        close(); refs.done.textContent = '완료'; refs.done.disabled = false;
        if (cb) cb(url, { layers: metaLayers() });   // StoryEditor 계약 호환(meta.layers)
      });
    });
  }
  function metaLayers() {
    return S.layers.map(function (L) {
      return L.type === 'text'
        ? { type: 'text', text: L.text, color: L.color, font: L.font && L.font.key }
        : { type: 'emoji', emoji: L.emoji };
    });
  }

  function open(opts) {
    opts = opts || {};
    if (!root) build();
    var photo = opts.photo || opts.photoUrl || '';   // StoryEditor 계약(photoUrl) 호환
    S = { layers: [], active: null, tool: 'text', layout: LAYOUTS[0],
      brush: 'pen', brushSize: 10, drawColor: COLORS[2],
      photoUrl: photo, photoCss: 'url("' + photo + '")',
      onDone: opts.onDone, onCancel: opts.onCancel };
    refs.layers.innerHTML = ''; refs.frame.className = 'itded__frame';
    refs.photo.style.backgroundImage = S.photoCss;
    root.classList.add('is-open');
    requestAnimationFrame(function () { initCanvas(); setTool('text'); });
  }
  function close() { if (root) root.classList.remove('is-open'); }

  window.ItdEditor = { open: open, close: close, isOpen: function () { return !!(root && root.classList.contains('is-open')); } };
})();
