/* itd-editor.js — 인스타 스토리식 사진 편집기 (Phase 2/3)
   window.ItdEditor.open({ photo, onDone(dataUrl), onCancel })
   도구: 텍스트 · 스티커 · 레이아웃(반달) · 그리기. 색은 --accent 토큰.
   설계: 레이어(텍스트/스티커)는 DOM, 그리기는 canvas. 완료 시 canvas 합성으로 dataURL. */
(function () {
  'use strict';
  if (window.ItdEditor) return;

  // 모두 OFL/오픈소스(Google Fonts) — 상업 사용 자유, 법적 문제 없음. index.html 의 fonts.googleapis 링크와 동기화.
  var FONTS = [
    { key: 'pretendard', label: '모던',  family: 'Pretendard, sans-serif',     weight: 800 },
    { key: 'black',      label: '또렷',  family: '"Black Han Sans", sans-serif', weight: 400 },
    { key: 'jua',        label: '동글',  family: '"Jua", sans-serif',           weight: 400 },
    { key: 'dohyeon',    label: '진한',  family: '"Do Hyeon", sans-serif',      weight: 400 },
    { key: 'gothica1',   label: '깔끔',  family: '"Gothic A1", sans-serif',     weight: 800 },
    { key: 'serif',      label: '클래식', family: '"Noto Serif KR", serif',     weight: 700 },
    { key: 'songmyung',  label: '단정',  family: '"Song Myung", serif',         weight: 400 },
    { key: 'dodum',      label: '도톰',  family: '"Gowun Dodum", sans-serif',   weight: 400 },
    { key: 'gaegu',      label: '손글씨', family: '"Gaegu", cursive',           weight: 700 },
    { key: 'pen',        label: '감성',  family: '"Nanum Pen Script", cursive', weight: 400 },
    { key: 'gamja',      label: '귀염',  family: '"Gamja Flower", cursive',     weight: 400 },
    { key: 'himelody',   label: '하늘',  family: '"Hi Melody", cursive',        weight: 400 }
  ];
  var COLORS = ['#FFFFFF', '#15181D', '#BC6675', '#E08A6E', '#E6B45A', '#86B06E', '#6E9BC4', '#A98AC4'];
  var SHOP_STK = ['🌸', '✨', '💗', '🎀', '👑'];
  var EMOJI = ['💄', '💅', '🔥', '😍', '🥰', '💎', '🌟', '🫶', '💖', '🌿', '☁️', '🎉'];
  var LAYOUTS = [
    { key: 'single', label: '1장',     kind: 'single', frame: '' },
    { key: 'soft',   label: '감성 무드', kind: 'single', frame: 'fr-soft' },
    { key: 'duo',    label: '좌우 2장', kind: 'grid2' },
    { key: 'quad',   label: '4장',     kind: 'grid4' }
  ];
  var BRUSHES = ['pen', 'marker', 'neon', 'eraser'];
  // [#8] 도형 — 편집 가능한 레이어로 삽입(드래그/회전/크기). 그리기와 달리 '한번 세팅하면 그대로 재사용'.
  var SHAPES = [
    { key: 'line', label: '선' }, { key: 'rect', label: '사각형' },
    { key: 'round', label: '둥근사각' }, { key: 'circle', label: '원' }
  ];
  var STK_KEY = 'itdasy:itd_stickers';   // [#7] 내 스티커(업로드) 로컬 저장(무료, 클라이언트)

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
    eraser: svg('<path d="M7 21h13"/><path d="M5 15l6-6 7 7-4 4H9l-4-4z"/>'),
    shape: svg('<rect x="3" y="3" width="11" height="11" rx="2"/><circle cx="16.5" cy="16.5" r="5"/>'),
    rs: svg('<path d="M21 15v6h-6M3 9V3h6M21 21l-7-7M3 3l7 7"/>', 2.2),
    upload: svg('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 20h16"/>')
  };

  // [#6] 오리지널 데코 스티커 — 직접 그린 SVG(저작권 안전). img(svg dataURL) 레이어로 올림.
  function svgStk(inner) {
    return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">' + inner + '</svg>');
  }
  var DECO = [
    svgStk('<path d="M60 104 24 64c-12-13-11-30 2-39 11-7 24-3 32 8 8-11 21-15 32-8 13 9 14 26 2 39z" fill="#E8536B"/>'),
    svgStk('<path d="M60 14 72 46l34 2-26 22 8 33-28-18-28 18 8-33-26-22 34-2z" fill="#E6B45A"/>'),
    svgStk('<path d="M60 16c4 22 6 24 28 28-22 4-24 6-28 28-4-22-6-24-28-28 22-4 24-6 28-28z" fill="#F6D365"/>'),
    svgStk('<g fill="#F2A6B6"><circle cx="60" cy="32" r="16"/><circle cx="88" cy="52" r="16"/><circle cx="78" cy="84" r="16"/><circle cx="42" cy="84" r="16"/><circle cx="32" cy="52" r="16"/></g><circle cx="60" cy="58" r="13" fill="#E6B45A"/>'),
    svgStk('<path d="M30 34 40 58 22 58z M90 34 80 58 98 58z" fill="#C9A78F"/><circle cx="60" cy="64" r="34" fill="#E8D3C2"/><circle cx="49" cy="60" r="4" fill="#3a2a22"/><circle cx="71" cy="60" r="4" fill="#3a2a22"/><path d="M55 72q5 5 10 0" stroke="#3a2a22" stroke-width="2.5" fill="none" stroke-linecap="round"/>'),
    svgStk('<ellipse cx="30" cy="52" rx="12" ry="20" fill="#B07A4F"/><ellipse cx="90" cy="52" rx="12" ry="20" fill="#B07A4F"/><circle cx="60" cy="62" r="32" fill="#D9A36B"/><circle cx="50" cy="58" r="4" fill="#3a2a22"/><circle cx="70" cy="58" r="4" fill="#3a2a22"/><ellipse cx="60" cy="72" rx="6" ry="4" fill="#3a2a22"/>'),
    svgStk('<circle cx="38" cy="40" r="12" fill="#B98A5E"/><circle cx="82" cy="40" r="12" fill="#B98A5E"/><circle cx="60" cy="62" r="32" fill="#D2A878"/><circle cx="50" cy="58" r="3.5" fill="#3a2a22"/><circle cx="70" cy="58" r="3.5" fill="#3a2a22"/><circle cx="60" cy="70" r="7" fill="#7a5638"/>'),
    svgStk('<ellipse cx="48" cy="28" rx="8" ry="22" fill="#F0E0E6"/><ellipse cx="72" cy="28" rx="8" ry="22" fill="#F0E0E6"/><circle cx="60" cy="70" r="30" fill="#FBF1F4"/><circle cx="51" cy="66" r="3.5" fill="#C06A7A"/><circle cx="69" cy="66" r="3.5" fill="#C06A7A"/><circle cx="60" cy="76" r="4" fill="#E8839A"/>'),
    svgStk('<path d="M58 60 28 42v36z M62 60 92 42v36z" fill="#E07A99"/><circle cx="60" cy="60" r="9" fill="#C85F82"/>'),
    svgStk('<g fill="#ffffff" stroke="#D9CFC9" stroke-width="2"><circle cx="44" cy="66" r="18"/><circle cx="70" cy="60" r="22"/><circle cx="86" cy="70" r="14"/></g><rect x="40" y="70" width="50" height="16" rx="8" fill="#ffffff"/>'),
    svgStk('<path d="M28 84 24 44l18 16 18-26 18 26 18-16-4 40z" fill="#E6B45A"/><rect x="28" y="84" width="64" height="8" rx="3" fill="#D29B3E"/>'),
    svgStk('<path d="M60 56c-10-12-30-10-34 0 6 4 6 10 0 12 12 10 24 10 34 4 10 6 22 6 34-4-6-2-6-8 0-12-4-10-24-12-34 0z" fill="#D64C6A"/>'),
    svgStk('<rect x="14" y="20" width="92" height="56" rx="16" fill="#ffffff" stroke="#E6C9D2" stroke-width="2"/><path d="M40 76 38 94 56 76z" fill="#ffffff" stroke="#E6C9D2" stroke-width="2"/><text x="60" y="54" font-family="Pretendard,sans-serif" font-size="22" font-weight="800" fill="#BC6675" text-anchor="middle">예뻐요</text>'),
    svgStk('<g stroke="#7C8B9A" stroke-width="5" fill="none" stroke-linecap="round"><circle cx="34" cy="84" r="10"/><circle cx="34" cy="54" r="10"/><path d="M42 78 96 36M42 60 96 100"/></g>')
  ];

  var S = null;   // session state
  var root = null, refs = {};

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function build() {
    root = el('div', 'itded');
    root.innerHTML =
      '<div class="itded__stage" data-r="stage">' +
        '<div class="itded__photowrap" data-r="photowrap"><div class="itded__photo" data-r="photo"></div><div class="itded__collage" data-r="collage" hidden></div></div>' +
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
        '<button class="itrb" data-tool="shape">' + IC.shape + '</button>' +
        '<button class="itrb" data-tool="draw">' + IC.draw + '</button>' +
      '</div>' +
      buildText() + buildSticker() + buildLayout() + buildShape() + buildDraw();
    document.body.appendChild(root);
    cacheRefs();
    wire();
  }

  function buildText() {
    var fonts = FONTS.map(function (f, i) {
      // 칩에는 폰트 이름 대신 그 폰트로 렌더된 샘플 글자(Aa가) — 인스타식
      return '<button class="itfont' + (i === 0 ? ' on' : '') + '" data-font="' + f.key + '" aria-label="' + f.label + '" style="font-family:' + f.family + (f.key === 'pen' ? ';font-size:22px' : '') + '">Aa가</button>';
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
    var deco = DECO.map(function (u, i) { return '<button class="itdeco" data-deco="' + i + '"><img src="' + u + '" alt="" draggable="false"></button>'; }).join('');
    return '<div class="itpanel" data-panel="sticker">' +
      '<div class="itstk" data-r="stkSheet">' +
        '<div class="itgrip"></div>' +
        '<div class="itstk__search">' + IC.search + '스티커 검색</div>' +
        '<div class="itfstk">' +
          '<button type="button" class="itfs loc" data-feat="loc" data-r="featLoc">' + IC.loc + '<span data-r="featLocTx">우리샵</span></button>' +
          '<button type="button" class="itfs book" data-feat="book">' + IC.book + '예약하기</button>' +
          '<button type="button" class="itfs price" data-feat="price">' + IC.price + '가격</button>' +
          '<button type="button" class="itfs time" data-feat="time">' + IC.time + '시간</button>' +
        '</div>' +
        // [#7] 내 스티커 — 업로드 버튼 + 저장된 내 스티커 그리드(동적 렌더)
        '<div class="itssub itssub--row"><span>내 스티커</span>' +
          '<label class="itstk__up">' + IC.upload + '추가<input type="file" accept="image/*" data-r="stkUpload" hidden></label></div>' +
        '<div class="itsgrid itsgrid--my" data-r="myStk"></div>' +
        // [#6] 캐릭터·데코(오리지널 SVG)
        '<div class="itssub" style="margin-top:14px">캐릭터·데코</div><div class="itsgrid">' + deco + '</div>' +
        '<div class="itssub" style="margin-top:14px">우리샵 에셋</div><div class="itsgrid">' + shop + '</div>' +
        '<div class="itssub" style="margin-top:14px">이모지</div><div class="itsgrid">' + emo + '</div>' +
      '</div></div>';
  }
  // [#8] 도형 패널(하단바) — 선/사각형/둥근사각/원 + 채움 토글 + 굵기 + 색.
  function buildShape() {
    var chips = SHAPES.map(function (s) {
      return '<button class="itshp" data-shape="' + s.key + '" aria-label="' + s.label + '"><span class="itshp__ic itshp__ic--' + s.key + '"></span><em>' + s.label + '</em></button>';
    }).join('');
    var colors = COLORS.map(function (c, i) {
      return '<button class="itscw' + (i === 2 ? ' on' : '') + '" data-scolor="' + c + '" style="background:' + c + '"></button>';
    }).join('');
    return '<div class="itpanel itshape" data-panel="shape">' +
      '<div class="itshape__row">' + chips + '</div>' +
      '<div class="itshape__opts">' +
        '<span class="itshape__fill" data-r="shapeFill"><button data-shapefill="0" class="on">선만</button><button data-shapefill="1">채움</button></span>' +
        '<span class="itshape__thick">굵기<input type="range" min="2" max="26" step="1" value="6" data-r="shapeThick"></span>' +
      '</div>' +
      '<div class="itshape__colors">' + colors + '</div>' +
    '</div>';
  }
  // [레이아웃] 목업식 — 타입 칩(1장/좌우2장/4장) + 렌더된 사진을 순서대로 탭해 자리에 채움.
  var LAY_TYPES = [{ i: 0, name: '1장' }, { i: 2, name: '좌우 2장' }, { i: 3, name: '4장' }];
  function buildLayout() {
    var chips = LAY_TYPES.map(function (t, idx) {
      return '<button class="itlaytype' + (idx === 0 ? ' on' : '') + '" data-lay="' + t.i + '">' + t.name + '</button>';
    }).join('');
    return '<div class="itpanel itlay2" data-panel="layout">' +
      '<div class="itlay2__hint" data-r="layHint"></div>' +
      '<div class="itlay2__types">' + chips + '</div>' +
      '<div class="itlay2__sub">렌더된 사진 — 순서대로 누르세요</div>' +
      '<div class="itlay2__strip" data-r="layStrip"></div>' +
    '</div>';
  }
  function _layPos(kind) { return kind === 'grid4' ? ['좌상', '우상', '좌하', '우하'] : ['왼쪽', '오른쪽']; }
  function _layNeed(kind) { return kind === 'grid4' ? 4 : (kind === 'grid2' ? 2 : 1); }
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
    ['stage', 'photowrap', 'photo', 'collage', 'frame', 'draw', 'layers', 'rail', 'cancel', 'done', 'aln', 'size', 'fonts', 'colors', 'stkSheet', 'layHint', 'layStrip', 'brushSize', 'featLocTx', 'myStk', 'stkUpload', 'shapeThick'].forEach(function (k) {
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
    if (tool === 'layout') { renderLayoutStrip(); renderLayoutHint(); }
    if (tool === 'sticker') renderMyStickers();
  }

  /* ── 레이어 공통(드래그) ── */
  function makeLayer(type) {
    var box = el('div', 'itl');
    box.innerHTML = '<button class="itl__del">' + svg('<path d="M18 6L6 18M6 6l12 12"/>', 2.4) + '</button>' +
      '<button class="itl__rot">' + svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>', 2.2) + '</button>' +
      '<button class="itl__rs">' + IC.rs + '</button>';
    var L = { type: type, el: box, x: 0, y: 0, scale: 1, rot: 0 };
    box.addEventListener('pointerdown', function (e) { onLayerDown(e, L); });
    box.querySelector('.itl__del').addEventListener('click', function (e) { e.stopPropagation(); removeLayer(L); });
    box.querySelector('.itl__rot').addEventListener('pointerdown', function (e) { onRotDown(e, L); });
    box.querySelector('.itl__rs').addEventListener('pointerdown', function (e) { onRsDown(e, L); });
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
  function applyXf(L) { L.el.style.transform = 'translate(' + L.x + 'px,' + L.y + 'px) rotate(' + (L.rot || 0) + 'deg) scale(' + L.scale + ')'; }
  var rotd = null;
  function onRotDown(e, L) {
    e.preventDefault(); e.stopPropagation(); selectLayer(L);
    var b = L.el.getBoundingClientRect();
    rotd = { L: L, cx: b.left + b.width / 2, cy: b.top + b.height / 2, start: (L.rot || 0), a0: Math.atan2(e.clientY - (b.top + b.height / 2), e.clientX - (b.left + b.width / 2)) };
    try { e.target.setPointerCapture(e.pointerId); } catch (_) { void _; }
  }
  // 크기조절 핸들 — 중심에서의 거리 비율로 scale 조정(모든 레이어 공통).
  var rsd = null;
  function onRsDown(e, L) {
    e.preventDefault(); e.stopPropagation(); selectLayer(L);
    var b = L.el.getBoundingClientRect(); var cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    rsd = { L: L, cx: cx, cy: cy, d0: Math.max(8, Math.hypot(e.clientX - cx, e.clientY - cy)), s0: (L.scale || 1) };
    try { e.target.setPointerCapture(e.pointerId); } catch (_) { void _; }
  }
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
    if (rsd) {
      var d = Math.hypot(e.clientX - rsd.cx, e.clientY - rsd.cy);
      rsd.L.scale = Math.max(0.2, Math.min(6, rsd.s0 * d / rsd.d0)); applyXf(rsd.L);
      if (rsd.L.type === 'text' && refs.size) refs.size.value = rsd.L.scale; return;
    }
    if (rotd) {
      var a = Math.atan2(e.clientY - rotd.cy, e.clientX - rotd.cx);
      rotd.L.rot = rotd.start + (a - rotd.a0) * 180 / Math.PI; applyXf(rotd.L); return;
    }
    if (!drag) return;
    drag.L.x = drag.ox + (e.clientX - drag.sx);
    drag.L.y = drag.oy + (e.clientY - drag.sy);
    applyXf(drag.L);
  });
  document.addEventListener('pointerup', function () { if (drag) { drag.L.el.style.cursor = 'grab'; drag = null; } rotd = null; rsd = null; });

  /* ── 사진 핀치 확대/이동 (두 손가락, 빈 배경에서) ── */
  var pinchPts = {}, pinch0 = null;
  function pdist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function applyPz() { refs.photowrap.style.transform = 'translate(' + S.pz.tx + 'px,' + S.pz.ty + 'px) scale(' + S.pz.scale + ')'; }
  function stageDown(e) {
    if (S.tool === 'draw' || (e.target.closest && (e.target.closest('.itl') || e.target.closest('.itrb') || e.target.closest('.itpanel')))) return;
    pinchPts[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pinchPts);
    if (ids.length === 2) { var a = pinchPts[ids[0]], b = pinchPts[ids[1]]; pinch0 = { d: pdist(a, b), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, s: S.pz.scale, tx: S.pz.tx, ty: S.pz.ty }; }
  }
  function stageMove(e) {
    if (!pinchPts[e.pointerId]) return;
    pinchPts[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pinchPts);
    if (ids.length === 2 && pinch0) {
      var a = pinchPts[ids[0]], b = pinchPts[ids[1]], d = pdist(a, b);
      S.pz.scale = Math.max(1, Math.min(4, pinch0.s * d / pinch0.d));
      S.pz.tx = pinch0.tx + ((a.x + b.x) / 2 - pinch0.mx);
      S.pz.ty = pinch0.ty + ((a.y + b.y) / 2 - pinch0.my);
      applyPz();
    }
  }
  function stageUp(e) { delete pinchPts[e.pointerId]; if (Object.keys(pinchPts).length < 2) pinch0 = null; }

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
  /* ── 우리샵 스타일 입력 레이어 렌더(학습 round-trip용) ── */
  function fontByKey(k) { for (var i = 0; i < FONTS.length; i++) { if (FONTS[i].key === k) return FONTS[i]; } return null; }
  function addShopLayer(spec, R) {
    if (spec.type === 'image') return addShopImage(spec, R);
    var isBadge = spec.type === 'badge';
    var L = makeLayer(isBadge ? 'badge' : 'text');
    L.role = spec.role || '';
    L.font = fontByKey(spec.font) || FONTS[0];
    L.color = spec.color || '#FFFFFF';
    L.align = spec.align || 'center';
    L.fontSize = Math.max(12, Math.round((spec.size != null ? spec.size : 0.06) * R.height));
    L.text = spec.text || '';
    L.stroke = !!(spec.outline && spec.outline.on) || !!spec.stroke;
    L.shadow = isBadge || !!(spec.shadow && spec.shadow.on) || !!spec.shadow;
    var t = el('div', 'itl-text'); t.textContent = L.text;
    var css = 'font-family:' + L.font.family + ';font-weight:' + (spec.weight || L.font.weight) + ';color:' + L.color + ';text-align:' + L.align + ';font-size:' + L.fontSize + 'px;white-space:pre-wrap';
    if (spec.w != null) css += ';max-width:' + Math.round(spec.w * R.width) + 'px';
    if (L.stroke) css += ';-webkit-text-stroke:1px rgba(0,0,0,.5)';
    if (L.shadow) css += ';text-shadow:0 2px 8px rgba(0,0,0,.35)';
    if (isBadge) css += ';background:' + (spec.bg || 'rgba(0,0,0,.32)') + ';padding:4px 10px;border-radius:8px';
    if (spec.opacity != null) css += ';opacity:' + spec.opacity;
    t.style.cssText = css; L.el.appendChild(t); L.tx = t;
    var bw = L.el.offsetWidth, bh = L.el.offsetHeight;
    L.x = (spec.x != null ? spec.x : 0.5) * R.width - bw / 2;
    L.y = (spec.y != null ? spec.y : 0.5) * R.height - bh / 2;
    applyXf(L);
    return L;
  }
  function addShopImage(spec, R) {
    var L = makeLayer('image'); L.role = spec.role || 'logo'; L.src = spec.src;
    var im = document.createElement('img'); im.src = spec.src; im.alt = '';
    im.style.cssText = 'display:block;width:' + Math.round((spec.w != null ? spec.w : 0.24) * R.width) + 'px;height:auto;opacity:' + (spec.opacity != null ? spec.opacity : 1) + ';pointer-events:none';
    L.el.appendChild(im); L.tx = im;
    var place = function () {
      var bw = L.el.offsetWidth || ((spec.w || 0.24) * R.width), bh = L.el.offsetHeight || bw;
      L.x = (spec.x != null ? spec.x : 0.82) * R.width - bw / 2;
      L.y = (spec.y != null ? spec.y : 0.1) * R.height - bh / 2; applyXf(L);
    };
    if (im.complete && im.naturalWidth) place(); else im.onload = place;
    place();
    return L;
  }
  function renderIncoming(layers) {
    if (!Array.isArray(layers) || !layers.length) return;
    var R = refs.stage.getBoundingClientRect();
    layers.forEach(function (spec) { try { addShopLayer(spec, R); } catch (_) { void _; } });
    S.active = null; S.layers.forEach(function (x) { x.el.classList.remove('is-active'); });
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
    closeStickerSheet();   // [②] 스티커 하나 고르면 하단 시트 내려가고 사진 위에서 바로 배치
  }
  // [③] 우리샵 피처 칩(위치/예약/가격/시간) — 탭하면 텍스트 레이어로 사진 위에 올림(클릭 동작).
  function addFeatureLayer(kind) {
    var map = {
      loc:   { text: (S.shopName || '우리샵'),   color: '#FFFFFF', accent: false },
      book:  { text: '예약하기',                 color: '#FFFFFF', accent: true  },
      price: { text: '가격 문의',                color: '#FFFFFF', accent: false },
      time:  { text: '영업시간 안내',            color: '#FFFFFF', accent: false }
    };
    var m = map[kind]; if (!m) return;
    var L = makeLayer('text');
    L.font = FONTS[0]; L.color = m.color; L.align = 'center'; L.fontSize = 26; L.text = m.text;
    L.shadow = true; L.role = (kind === 'loc' ? 'shop' : kind);
    var t = el('div', 'itl-text'); t.textContent = m.text;
    var css = 'font-family:' + L.font.family + ';font-weight:800;color:' + m.color + ';text-align:center;font-size:26px;text-shadow:0 2px 8px rgba(0,0,0,.4)';
    if (m.accent) { css += ';background:linear-gradient(135deg,#D58A95,#BC6675);padding:8px 18px;border-radius:999px;text-shadow:none'; L.badge = true; }
    t.style.cssText = css; L.el.appendChild(t); L.tx = t;
    placeCenter(L, 150, 46); selectLayer(L);
    closeStickerSheet();
  }
  // [②] 스티커 시트 닫기 — 도구 비활성(사진 위에서 바로 만지도록). 닫아도 우측 레일은 그대로.
  function closeStickerSheet() {
    S.tool = null;
    root.querySelectorAll('.itrb').forEach(function (b) { b.classList.remove('on'); });
    if (refs.panels.sticker) refs.panels.sticker.classList.remove('is-open');
    if (refs.stkSheet) refs.stkSheet.classList.remove('is-tall');
    refs.draw.classList.remove('is-armed'); refs.draw.style.zIndex = '3';
    refs.layers.style.pointerEvents = '';
  }
  /* ── 이미지 스티커(데코·내 스티커) #6/#7 ── */
  function addImageSticker(src) {
    var L = makeLayer('image'); L.role = 'sticker'; L.src = src;
    var im = document.createElement('img'); im.src = src; im.alt = ''; im.setAttribute('draggable', 'false');
    im.style.cssText = 'display:block;width:120px;height:auto;pointer-events:none';
    L.el.appendChild(im); L.tx = im;
    var place = function () { placeCenter(L, L.el.offsetWidth || 120, L.el.offsetHeight || 120); };
    if (im.complete && im.naturalWidth) place(); else im.onload = place;
    place(); selectLayer(L); closeStickerSheet();
  }
  function loadMyStk() { try { return JSON.parse(localStorage.getItem(STK_KEY) || '[]'); } catch (_) { return []; } }
  function saveMyStk(arr) { try { localStorage.setItem(STK_KEY, JSON.stringify(arr.slice(-30))); } catch (_) { void _; } }
  function renderMyStickers() {
    if (!refs.myStk) return;
    var arr = loadMyStk();
    if (!arr.length) { refs.myStk.innerHTML = '<div class="itstk__empty">사진을 올리면 내 스티커로 저장돼 언제든 쓸 수 있어요</div>'; return; }
    refs.myStk.innerHTML = arr.map(function (u, i) {
      return '<button class="itdeco itmine" data-mine="' + i + '"><img src="' + u + '" alt="" draggable="false"><span class="itmine__x" data-minedel="' + i + '">×</span></button>';
    }).join('');
  }
  function addMyStickerFromFile(file) {
    if (!file || !/^image\//.test(file.type)) return;
    var rd = new FileReader();
    rd.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 256, sc = Math.min(1, max / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * sc)), h = Math.max(1, Math.round(img.height * sc));
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        var url; try { url = cv.toDataURL('image/png'); } catch (_) { url = rd.result; }
        var arr = loadMyStk(); arr.push(url); saveMyStk(arr); renderMyStickers();
      };
      img.onerror = function () { var arr = loadMyStk(); arr.push(rd.result); saveMyStk(arr); renderMyStickers(); };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  }
  function delMyStk(i) { var arr = loadMyStk(); arr.splice(i, 1); saveMyStk(arr); renderMyStickers(); }

  /* ── 도형 #8 ── */
  function styleShape(d, L) {
    var c = L.color, sw = L.strokeW || 6;
    if (L.shape === 'line') {
      // 박스는 잡기 쉽게(>=22px), 보이는 막대는 굵기(sw)만큼 가운데 — 내보내기도 sw 두께로 그림.
      d.style.cssText = 'width:180px;height:' + Math.max(sw, 22) + 'px;border-radius:' + (sw / 2) + 'px;background:linear-gradient(' + c + ',' + c + ') center/100% ' + sw + 'px no-repeat';
    } else {
      var base = 'box-sizing:border-box;width:120px;height:120px;';
      base += L.fill ? ('background:' + c + ';border:0;') : ('background:transparent;border:' + sw + 'px solid ' + c + ';');
      base += L.shape === 'circle' ? 'border-radius:50%' : (L.shape === 'round' ? 'border-radius:18px' : 'border-radius:0');
      d.style.cssText = base;
    }
  }
  function addShape(kind) {
    var L = makeLayer('shape');
    L.shape = kind; L.color = S.shapeColor; L.fill = !!S.shapeFill; L.strokeW = S.shapeThick;
    var d = el('div', 'itl-shape'); styleShape(d, L); L.el.appendChild(d); L.tx = d;
    var w = kind === 'line' ? 180 : 120, h = kind === 'line' ? Math.max(L.strokeW || 6, 22) : 120;
    placeCenter(L, w, h); selectLayer(L);
  }
  // [①] PC/모바일 공통 — 가로 스크롤 줄(폰트/색/칩)을 드래그로 넘김(인스타식 스와이프).
  function enableDragScroll(elm) {
    if (!elm || elm._dragScroll) return; elm._dragScroll = true;
    var down = false, sx = 0, sl = 0, moved = 0;
    elm.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;   // 터치는 네이티브 관성 스크롤 그대로
      down = true; sx = e.clientX; sl = elm.scrollLeft; moved = 0; elm.classList.add('is-dragging');
    });
    elm.addEventListener('pointermove', function (e) {
      if (!down) return; var dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx)); elm.scrollLeft = sl - dx;
    });
    var up = function () { down = false; elm.classList.remove('is-dragging'); };
    elm.addEventListener('pointerup', up); elm.addEventListener('pointerleave', up);
    // 드래그였으면 버튼 클릭 무효화(드래그 끝의 의도치 않은 선택 방지)
    elm.addEventListener('click', function (e) { if (moved > 6) { e.stopPropagation(); e.preventDefault(); moved = 0; } }, true);
  }

  /* ── 레이아웃(타입 칩 + 사진 순서 선택) ── */
  function selectLayout(i) {
    S.layout = LAYOUTS[i];
    S.layoutOrder = [];   // 타입 바꾸면 자리 선택 초기화
    refs.frame.className = 'itded__frame ' + (S.layout.frame || '');
    root.querySelectorAll('.itlaytype').forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-lay') === i); });
    renderCollage(); renderLayoutStrip(); renderLayoutHint();
  }
  // 사진 순서 탭 — grid면 자리(좌우/4분할)에 순서대로 배정, 1장이면 그 사진을 단일 배경으로.
  function onLayThumb(idx) {
    var kind = S.layout.kind || 'single';
    if (kind === 'single') {
      S.photoUrl = S.photos[idx]; S.photoCss = 'url("' + S.photos[idx] + '")';
      refs.photo.style.backgroundImage = S.photoCss;
      renderLayoutStrip(); renderLayoutHint(); return;
    }
    var at = S.layoutOrder.indexOf(idx);
    if (at >= 0) S.layoutOrder.splice(at, 1);              // 다시 누르면 해제(뒤 번호 당겨짐)
    else if (S.layoutOrder.length < _layNeed(kind)) S.layoutOrder.push(idx);
    renderCollage(); renderLayoutStrip(); renderLayoutHint();
  }
  function renderLayoutStrip() {
    if (!refs.layStrip) return;
    var kind = S.layout.kind || 'single';
    refs.layStrip.innerHTML = (S.photos || []).map(function (u, i) {
      var ord = (kind === 'single') ? (S.photoUrl === u ? 0 : -1) : S.layoutOrder.indexOf(i);
      var badge = (kind !== 'single' && ord >= 0) ? '<span class="itlaybadge">' + (ord + 1) + '</span>' : '';
      var sel = (kind === 'single' && S.photoUrl === u) ? ' on' : (ord >= 0 ? ' on' : '');
      return '<button class="itlaythumb' + sel + '" data-laythumb="' + i + '" style="background-image:url(\'' + u + '\')">' + badge + '</button>';
    }).join('');
  }
  function renderLayoutHint() {
    if (!refs.layHint) return;
    var kind = S.layout.kind || 'single';
    if (kind === 'single') { refs.layHint.textContent = '1장 — 넣을 사진 하나를 누르세요.'; return; }
    var pos = _layPos(kind), need = _layNeed(kind);
    refs.layHint.innerHTML = '<b>' + S.layout.label + '</b> · 사진을 순서대로 누르세요 — ' +
      pos.map(function (p, i) { return (i + 1) + '=' + p; }).join(' · ') + ' (' + S.layoutOrder.length + '/' + need + ')';
  }
  // 콜라주(좌우2장/4장) — 단일이면 collage 숨김. grid면 선택 순서(layoutOrder)대로 칸 채움(미선택=자리표시).
  function renderCollage() {
    var kind = S.layout.kind || 'single';
    if (kind === 'single') { refs.collage.hidden = true; refs.collage.className = 'itded__collage'; refs.collage.innerHTML = ''; refs.photo.style.backgroundImage = S.photoCss; return; }
    refs.collage.className = 'itded__collage is-' + kind;   // is-grid2 / is-grid4 → 2열/2x2 그리드
    var n = _layNeed(kind), pos = _layPos(kind), cells = '';
    for (var k = 0; k < n; k++) {
      var idx = S.layoutOrder[k];
      if (idx != null && S.photos[idx]) cells += '<div class="itded__cell" style="background-image:url(\'' + S.photos[idx] + '\')"></div>';
      else cells += '<div class="itded__cell itded__cell--empty">' + (k + 1) + '번<br>' + pos[k] + '</div>';
    }
    refs.collage.innerHTML = cells; refs.collage.hidden = false;
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
  var dpos = null, _drawRect = null;
  function drawDown(e) {
    if (S.tool !== 'draw') return;
    _drawRect = refs.stage.getBoundingClientRect();   // [⑤렉] 스트로크 시작 때 1회만 측정 → move 마다 reflow 제거
    dpos = { x: e.clientX - _drawRect.left, y: e.clientY - _drawRect.top };
    strokeStyle(); refs.ctx.beginPath(); refs.ctx.moveTo(dpos.x, dpos.y); refs.ctx.lineTo(dpos.x + 0.1, dpos.y + 0.1); refs.ctx.stroke();
    try { refs.draw.setPointerCapture(e.pointerId); } catch (_) { void _; }
  }
  function drawMove(e) {
    if (!dpos || S.tool !== 'draw') return;
    var r = _drawRect || refs.stage.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    refs.ctx.beginPath(); refs.ctx.moveTo(dpos.x, dpos.y); refs.ctx.lineTo(x, y); refs.ctx.stroke();
    dpos = { x: x, y: y };
  }
  function drawUp() { dpos = null; }

  /* ── 합성 내보내기 (사진 줌·콜라주·레이어 회전 반영) ── */
  function loadImg(url) { return new Promise(function (res) { var im = new Image(); im.crossOrigin = 'anonymous'; im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = url; }); }
  function coverRect(im, w, h) { var sc = Math.max(w / im.width, h / im.height); return { dw: im.width * sc, dh: im.height * sc }; }
  function rrPath(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath();
    if (c.roundRect) { c.roundRect(x, y, w, h, r); return; }
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  // 도형 캔버스 합성 — 회전/스케일은 호출부에서 translate+rotate 후, 비회전 크기(ow/oh)로 그림.
  function drawShape(c, L, ow, oh) {
    var sw = (L.strokeW || 6) * (L.scale || 1);
    c.fillStyle = L.color; c.strokeStyle = L.color; c.lineWidth = sw; c.lineJoin = 'round';
    if (L.shape === 'line') { rrPath(c, -ow / 2, -sw / 2, ow, sw, sw / 2); c.fill(); return; }
    if (L.shape === 'circle') {
      var rx = Math.max(1, (ow - (L.fill ? 0 : sw)) / 2), ry = Math.max(1, (oh - (L.fill ? 0 : sw)) / 2);
      c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); if (L.fill) c.fill(); else c.stroke(); return;
    }
    var rad = (L.shape === 'round' ? 18 : 0) * (L.scale || 1);
    if (L.fill) { rrPath(c, -ow / 2, -oh / 2, ow, oh, rad); c.fill(); }
    else { rrPath(c, -ow / 2 + sw / 2, -oh / 2 + sw / 2, ow - sw, oh - sw, Math.max(0, rad - sw / 2)); c.stroke(); }
  }
  function exportComposite(cb) {
    var r = refs.stage.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var cv = document.createElement('canvas'); cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var kind = S.layout.kind || 'single';
    var baseDone;
    if (kind === 'single') {
      baseDone = loadImg(S.photoUrl).then(function (img) {
        if (!img) return; var cr = coverRect(img, r.width, r.height);
        c.save();
        c.translate(S.pz.tx, S.pz.ty); c.translate(r.width / 2, r.height / 2); c.scale(S.pz.scale, S.pz.scale); c.translate(-r.width / 2, -r.height / 2);
        c.drawImage(img, (r.width - cr.dw) / 2, (r.height - cr.dh) / 2, cr.dw, cr.dh);
        c.restore();
      });
    } else {
      var n = kind === 'grid4' ? 4 : 2;
      var urls = []; for (var k = 0; k < n; k++) { var oi = S.layoutOrder[k]; urls.push((oi != null && S.photos[oi]) || S.photos[k] || S.photos[k % S.photos.length] || S.photoUrl); }
      baseDone = Promise.all(urls.map(loadImg)).then(function (imgs) {
        var cols = kind === 'grid4' ? 2 : 2, rows = kind === 'grid4' ? 2 : 1;
        if (kind === 'grid2') { cols = 2; rows = 1; }
        var cw = r.width / cols, ch = r.height / rows;
        imgs.forEach(function (img, idx) {
          if (!img) return; var cxp = (idx % cols) * cw, cyp = Math.floor(idx / cols) * ch;
          var cr = coverRect(img, cw, ch);
          c.save(); c.beginPath(); c.rect(cxp + 1, cyp + 1, cw - 2, ch - 2); c.clip();
          c.drawImage(img, cxp + (cw - cr.dw) / 2, cyp + (ch - cr.dh) / 2, cr.dw, cr.dh); c.restore();
        });
      });
    }
    baseDone.then(function () {
      c.drawImage(refs.draw, 0, 0, r.width, r.height);   // 드로잉
      S.layers.forEach(function (L) {
        var b = L.el.getBoundingClientRect();
        var cx = b.left - r.left + b.width / 2, cy = b.top - r.top + b.height / 2;
        // 비회전 크기(레이아웃 기준 × scale) — 회전 레이어도 정확히 합성(AABB 왜곡 방지)
        var ow = (L.el.offsetWidth || b.width) * (L.scale || 1), oh = (L.el.offsetHeight || b.height) * (L.scale || 1);
        c.save(); c.translate(cx, cy); if (L.rot) c.rotate(L.rot * Math.PI / 180);
        if (L.type === 'shape') {
          drawShape(c, L, ow, oh);
        } else if (L.type === 'image') {
          try { c.drawImage(L.tx, -ow / 2, -oh / 2, ow, oh); } catch (_ei) { void _ei; }
        } else if (L.type === 'sticker') {
          c.font = (L.fontSize * L.scale) + 'px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(L.emoji, 0, 0);
        } else {
          var lines = (L.text || '').split('\n'); var fs = L.fontSize * L.scale;
          c.font = L.font.weight + ' ' + fs + 'px ' + L.font.family; c.fillStyle = L.color;
          c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowBlur = 8; c.shadowColor = 'rgba(0,0,0,.35)';
          var total = lines.length * fs * 1.16, sy = -total / 2 + fs * 0.58;
          lines.forEach(function (ln, i) { c.fillText(ln, 0, sy + i * fs * 1.16); });
          c.shadowBlur = 0;
        }
        c.restore();
      });
      try { cb(cv.toDataURL('image/jpeg', 0.92)); } catch (e) { void e; cb(null); }
    });
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
    // 스티커 — 이모지/우리샵 칩/데코/내 스티커 탭 → 레이어로 추가
    refs.stkSheet.addEventListener('click', function (e) {
      var del = e.target.closest('[data-minedel]'); if (del) { e.stopPropagation(); delMyStk(+del.getAttribute('data-minedel')); return; }
      var mine = e.target.closest('[data-mine]'); if (mine) { var arr = loadMyStk(); var u = arr[+mine.getAttribute('data-mine')]; if (u) addImageSticker(u); return; }
      var dc = e.target.closest('[data-deco]'); if (dc) { addImageSticker(DECO[+dc.getAttribute('data-deco')]); return; }
      var f = e.target.closest('[data-feat]'); if (f) { addFeatureLayer(f.getAttribute('data-feat')); return; }
      var b = e.target.closest('[data-stk]'); if (b) addSticker(b.getAttribute('data-stk'));
    });
    // [#7] 내 스티커 업로드(사진 선택 → 축소 저장 → 그리드 갱신)
    if (refs.stkUpload) refs.stkUpload.addEventListener('change', function () { var fl = refs.stkUpload.files && refs.stkUpload.files[0]; if (fl) addMyStickerFromFile(fl); refs.stkUpload.value = ''; });
    // [#8] 도형 패널 — 도형 탭=삽입, 채움 토글, 굵기, 색
    refs.panels.shape.addEventListener('click', function (e) {
      var sh = e.target.closest('[data-shape]'); if (sh) { addShape(sh.getAttribute('data-shape')); return; }
      var fl = e.target.closest('[data-shapefill]'); if (fl) { S.shapeFill = fl.getAttribute('data-shapefill') === '1'; refs.panels.shape.querySelectorAll('[data-shapefill]').forEach(function (x) { x.classList.toggle('on', x === fl); }); return; }
      var sc = e.target.closest('[data-scolor]'); if (sc) { S.shapeColor = sc.getAttribute('data-scolor'); refs.panels.shape.querySelectorAll('[data-scolor]').forEach(function (x) { x.classList.toggle('on', x === sc); }); return; }
    });
    refs.shapeThick.addEventListener('input', function () { S.shapeThick = +refs.shapeThick.value; });
    // [②] grip — 클릭=더 펼치기 토글, 아래로 드래그=시트 닫기(PC 마우스 포함)
    var grip = refs.stkSheet.querySelector('.itgrip');
    var gd = null;
    grip.addEventListener('pointerdown', function (e) { gd = { y: e.clientY, moved: false }; try { grip.setPointerCapture(e.pointerId); } catch (_) { void _; } });
    grip.addEventListener('pointermove', function (e) { if (!gd) return; var dy = e.clientY - gd.y; if (Math.abs(dy) > 4) gd.moved = true; });
    grip.addEventListener('pointerup', function (e) {
      if (!gd) { return; } var dy = e.clientY - gd.y; var was = gd; gd = null;
      if (dy > 56) { closeStickerSheet(); return; }              // 아래로 끌면 닫기
      if (dy < -40) { refs.stkSheet.classList.add('is-tall'); return; }   // 위로 끌면 더 펼치기
      if (!was.moved) refs.stkSheet.classList.toggle('is-tall');  // 그냥 탭이면 토글
    });
    // [①] 가로 스크롤 줄 드래그 스와이프(폰트/색/칩)
    enableDragScroll(refs.fonts); enableDragScroll(refs.colors);
    enableDragScroll(refs.stkSheet.querySelector('.itfstk'));
    enableDragScroll(refs.panels.shape.querySelector('.itshape__row'));
    enableDragScroll(refs.panels.shape.querySelector('.itshape__colors'));
    // 레이아웃 — 타입 칩 선택 + 렌더된 사진 순서 탭(자리에 순서대로 채움)
    refs.panels.layout.addEventListener('click', function (e) {
      var t = e.target.closest('[data-lay]'); if (t) { selectLayout(+t.getAttribute('data-lay')); return; }
      var th = e.target.closest('[data-laythumb]'); if (th) { onLayThumb(+th.getAttribute('data-laythumb')); return; }
    });
    enableDragScroll(refs.layStrip); enableDragScroll(refs.panels.layout.querySelector('.itlay2__types'));
    // 그리기
    root.querySelector('[data-panel="draw"] .itdraw__top').addEventListener('click', function (e) { var b = e.target.closest('[data-brush]'); if (!b) return; S.brush = b.getAttribute('data-brush'); root.querySelectorAll('[data-brush]').forEach(function (x) { x.classList.toggle('on', x === b); }); });
    refs.brushSize.addEventListener('input', function () { S.brushSize = +refs.brushSize.value; });
    root.querySelector('[data-panel="draw"] .itdraw__colors').addEventListener('click', function (e) { var b = e.target.closest('[data-dcolor]'); if (!b) return; S.drawColor = b.getAttribute('data-dcolor'); root.querySelectorAll('[data-dcolor]').forEach(function (x) { x.classList.toggle('on', x === b); }); });
    refs.draw.addEventListener('pointerdown', drawDown);
    refs.draw.addEventListener('pointermove', drawMove);
    refs.draw.addEventListener('pointerup', drawUp);
    // 사진 핀치 확대/이동
    refs.stage.addEventListener('pointerdown', stageDown);
    refs.stage.addEventListener('pointermove', stageMove);
    refs.stage.addEventListener('pointerup', stageUp);
    refs.stage.addEventListener('pointercancel', stageUp);
    // 닫기/완료
    refs.cancel.addEventListener('click', function () { close(); if (S && S.onCancel) S.onCancel(); });
    refs.done.addEventListener('click', function () {
      var cb = S.onDone; refs.done.textContent = '저장 중…'; refs.done.disabled = true;
      exportComposite(function (url) {
        var meta = { layers: metaLayers() };   // [학습] close() 전에 좌표 계산(닫으면 stage rect=0 → NaN)
        close(); refs.done.textContent = '완료'; refs.done.disabled = false;
        if (cb) cb(url, meta);   // StoryEditor 계약 호환(meta.layers)
      });
    });
  }
  // 저장 시 레이어를 ShopStyle 학습 계약으로 — role·정규화 중심좌표(x/y)·폭·폰트·색·크기·외곽선/그림자.
  function metaLayers() {
    var R = refs.stage.getBoundingClientRect();
    return S.layers.map(function (L) {
      // 도형·장식용 이미지 스티커는 '우리샵 스타일' 학습 대상 아님(결과 이미지엔 이미 합성됨).
      if (L.type === 'shape') return null;
      if (L.type === 'image' && L.role === 'sticker') return null;
      var b = L.el.getBoundingClientRect();
      var cx = (b.left - R.left + b.width / 2) / R.width;
      var cy = (b.top - R.top + b.height / 2) / R.height;
      var w = b.width / R.width;
      if (L.type === 'image') return { type: 'image', role: L.role || 'logo', src: L.src, x: cx, y: cy, w: w };
      if (L.type === 'sticker') return { type: 'emoji', emoji: L.emoji, x: cx, y: cy };
      var fs = (L.fontSize || 30) * (L.scale || 1);
      return { type: 'text', role: L.role || '', text: L.text, x: cx, y: cy, w: w,
        font: L.font && L.font.key, color: L.color, align: L.align,
        size: fs / R.height, weight: L.font && L.font.weight,
        stroke: !!L.stroke, shadow: !!L.shadow };
    }).filter(Boolean);
  }

  function open(opts) {
    opts = opts || {};
    if (!root) build();
    var photo = opts.photo || opts.photoUrl || '';   // StoryEditor 계약(photoUrl) 호환
    var photos = (opts.photos && opts.photos.length) ? opts.photos.slice() : [photo];
    S = { layers: [], active: null, tool: 'text', layout: LAYOUTS[0], layoutOrder: [],
      brush: 'pen', brushSize: 10, drawColor: COLORS[2],
      shapeColor: COLORS[2], shapeFill: false, shapeThick: 6,
      photoUrl: photo, photoCss: 'url("' + photo + '")', photos: photos,
      shopName: (opts.shopName || '').trim(),
      pz: { scale: 1, tx: 0, ty: 0 }, incoming: (opts.layers || []),
      onDone: opts.onDone, onCancel: opts.onCancel };
    if (refs.featLocTx) refs.featLocTx.textContent = S.shopName || '우리샵';   // [③] 위치 칩에 실제 샵 이름
    refs.layers.innerHTML = ''; refs.frame.className = 'itded__frame';
    refs.photo.style.backgroundImage = S.photoCss;
    refs.collage.hidden = true; refs.collage.innerHTML = '';
    refs.photowrap.style.transform = '';
    root.classList.add('is-open');
    // 우리샵 자동배치 텍스트/로고/워터마크를 먼저 올린 뒤 도구 표시(기본 빈 텍스트 자동생성 방지).
    requestAnimationFrame(function () { initCanvas(); renderIncoming(S.incoming); setTool('text'); });
  }
  function close() { if (root) root.classList.remove('is-open'); }

  window.ItdEditor = { open: open, close: close, isOpen: function () { return !!(root && root.classList.contains('is-open')); } };
})();
