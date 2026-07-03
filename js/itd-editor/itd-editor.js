/* itd-editor.js — 인스타 스토리식 사진 편집기 (Phase 2/3)
   window.ItdEditor.open({ photo, onDone(dataUrl), onCancel })
   도구: 텍스트 · 스티커 · 레이아웃(반달) · 그리기. 색은 --accent 토큰.
   설계: 레이어(텍스트/스티커)는 DOM, 그리기는 canvas. 완료 시 canvas 합성으로 dataURL. */
(function () {
  'use strict';
  if (window.ItdEditor) return;

  // 모두 OFL/오픈소스(Google Fonts) — 상업 사용 자유, 법적 문제 없음. index.html 의 fonts.googleapis 링크와 동기화.
  // family 는 작은따옴표 — HTML 속성(큰따옴표) 안 inline style 에 넣어도 안 깨지게(이전: 큰따옴표라 폰트 적용이 깨져 전부 같아 보였음).
  var FONTS = [
    { key: 'pretendard', label: '모던',  family: "Pretendard, sans-serif",      weight: 800 },
    { key: 'black',      label: '또렷',  family: "'Black Han Sans', sans-serif", weight: 400 },
    { key: 'jua',        label: '동글',  family: "'Jua', sans-serif",           weight: 400 },
    { key: 'dohyeon',    label: '진한',  family: "'Do Hyeon', sans-serif",      weight: 400 },
    { key: 'gothica1',   label: '깔끔',  family: "'Gothic A1', sans-serif",     weight: 800 },
    { key: 'serif',      label: '클래식', family: "'Noto Serif KR', serif",     weight: 700 },
    { key: 'songmyung',  label: '단정',  family: "'Song Myung', serif",         weight: 400 },
    { key: 'dodum',      label: '도톰',  family: "'Gowun Dodum', sans-serif",   weight: 400 },
    { key: 'gaegu',      label: '손글씨', family: "'Gaegu', cursive",           weight: 700 },
    { key: 'pen',        label: '감성',  family: "'Nanum Pen Script', cursive", weight: 400 },
    { key: 'gamja',      label: '귀염',  family: "'Gamja Flower', cursive",     weight: 400 },
    { key: 'himelody',   label: '하늘',  family: "'Hi Melody', cursive",        weight: 400 }
  ];
  var COLORS = ['#FFFFFF', '#15181D', '#BC6675', '#E08A6E', '#E6B45A', '#86B06E', '#6E9BC4', '#A98AC4'];
  var SHOP_STK = ['🌸', '✨', '💗', '🎀', '👑'];
  var EMOJI = ['💄', '💅', '🔥', '😍', '🥰', '💎', '🌟', '🫶', '💖', '🌿', '☁️', '🎉'];
  // [레이아웃 재설계] 셀 좌표 단일화(SSOT) — cells:[[x,y,w,h]…](0~1 비율).
  //   화면 렌더(renderCollage)와 내보내기(exportComposite)가 같은 좌표를 써 WYSIWYG 100% 보장.
  //   새 레이아웃은 cells 한 줄만 추가하면 됨. kind: single=단일 배경, grid=콜라주.
  var LAYOUTS = [
    { key: 'single', label: '1장',  kind: 'single', cells: [[0, 0, 1, 1]] },
    { key: 'v2',   label: '좌우',   kind: 'grid', cells: [[0, 0, .5, 1], [.5, 0, .5, 1]], pos: ['왼쪽', '오른쪽'] },
    { key: 'h2',   label: '상하',   kind: 'grid', cells: [[0, 0, 1, .5], [0, .5, 1, .5]], pos: ['위', '아래'] },
    { key: 'v3',   label: '세로 3', kind: 'grid', cells: [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]], pos: ['왼쪽', '가운데', '오른쪽'] },
    { key: 'grid4', label: '4분할', kind: 'grid', cells: [[0, 0, .5, .5], [.5, 0, .5, .5], [0, .5, .5, .5], [.5, .5, .5, .5]], pos: ['좌상', '우상', '좌하', '우하'] },
    { key: 'l1r2', label: '1+2',   kind: 'grid', cells: [[0, 0, .5, 1], [.5, 0, .5, .5], [.5, .5, .5, .5]], pos: ['왼쪽 큰', '우상', '우하'] },
    { key: 't1b2', label: '2+1',   kind: 'grid', cells: [[0, 0, 1, .5], [0, .5, .5, .5], [.5, .5, .5, .5]], pos: ['위 큰', '좌하', '우하'] },
    { key: 'ba',   label: '전/후',  kind: 'grid', cells: [[0, 0, .5, 1], [.5, 0, .5, 1]], pos: ['BEFORE', 'AFTER'], ba: true }
  ];
  function isSingleL(L) { return !L || (L.kind || 'single') === 'single' || (L.cells && L.cells.length === 1); }
  function _layCells() { return (S.layout && S.layout.cells) || [[0, 0, 1, 1]]; }
  function _layN() { return _layCells().length; }
  function _layPosArr() { return (S.layout && S.layout.pos) || []; }
  // 레이아웃 타입 선택 칩용 미니 도형 썸네일(셀 좌표 그대로 그림)
  function _layThumbSvg(L) {
    var rects = (L.cells || [[0, 0, 1, 1]]).map(function (c) {
      return '<rect x="' + (c[0] * 22 + 1).toFixed(1) + '" y="' + (c[1] * 28 + 1).toFixed(1) + '" width="' + (c[2] * 22 - 2).toFixed(1) + '" height="' + (c[3] * 28 - 2).toFixed(1) + '" rx="1.4"/>';
    }).join('');
    return '<svg viewBox="0 0 24 30" width="24" height="30" aria-hidden="true">' + rects + '</svg>';
  }
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
    phone: svg('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>'),
    pen: svg('<path d="M12 19l7-7-3-3-7 7-1 4 4-1z"/><path d="M16 8l3 3"/>'),
    marker: svg('<path d="M5 19h14"/><path d="M9 15l8-8 3 3-8 8H9v-3z"/>'),
    neon: svg('<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>'),
    eraser: svg('<path d="M7 21h13"/><path d="M5 15l6-6 7 7-4 4H9l-4-4z"/>'),
    shape: svg('<rect x="3" y="3" width="11" height="11" rx="2"/><circle cx="16.5" cy="16.5" r="5"/>'),
    rs: svg('<path d="M21 15v6h-6M3 9V3h6M21 21l-7-7M3 3l7 7"/>', 2.2),
    upload: svg('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 20h16"/>'),
    adjust: svg('<path d="M4 7h11M19 7h1M4 12h3M11 12h9M4 17h7M15 17h5"/><circle cx="17" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="13" cy="17" r="2"/>'),
    addphoto: svg('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="9" cy="9" r="1.6"/>'),
    cut: svg('<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.1 8.1 20 18M8.1 15.9 20 6"/>')
  };
  // [보정] 사진별 보정값 — CSS filter / canvas ctx.filter 동일 문법으로 라이브·내보내기 일치.
  function defAdj() { return { b: 100, c: 100, s: 100, w: 0, sh: 0, rot: 0 }; }
  function filterStr(a) {
    if (!a) return 'none';
    var con = (a.c + a.sh * 0.4) / 100;   // 선명도는 대비 가산 근사(canvas sharpen 미지원 대체)
    var f = 'brightness(' + (a.b / 100).toFixed(2) + ') contrast(' + con.toFixed(2) + ') saturate(' + (a.s / 100).toFixed(2) + ')';
    if (a.w > 0) f += ' sepia(' + (a.w / 100 * 0.45).toFixed(2) + ')';
    return f;
  }
  var ADJ_CTRLS = [
    { k: 'b', label: '밝기', min: 60, max: 140 }, { k: 'c', label: '대비', min: 60, max: 140 },
    { k: 's', label: '채도', min: 0, max: 200 }, { k: 'w', label: '온도', min: 0, max: 100 },
    { k: 'sh', label: '선명도', min: 0, max: 100 }
  ];

  // [#6] 오리지널 데코 스티커 — 직접 그린 SVG(저작권 안전). img(svg dataURL) 레이어로 올림.
  var DECO = (window.ItdDecos || []);   // [B-분할] 데코 스티커 데이터 → js/itd-editor/data/itd-decos.js

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
        '<div class="itded__grid" data-r="grid"></div>' +
      '</div>' +
      '<div class="itded__top">' +
        '<button class="itded__ic" data-r="cancel" aria-label="닫기">' + IC.x + '</button>' +
        '<div class="itded__hist">' +
          '<button class="itded__ic" data-r="undo" aria-label="되돌리기" disabled>' + svg('<path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 2.6-7.8L3 7"/>', 2.1) + '</button>' +
          '<button class="itded__ic" data-r="redo" aria-label="다시 실행" disabled>' + svg('<path d="M21 7v6h-6"/><path d="M21 13a9 9 0 1 1-2.6-7.8L21 7"/>', 2.1) + '</button>' +
          '<button class="itded__ic" data-r="peek" aria-label="사진 전체 보기">' + svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>', 2) + '</button>' +
        '</div>' +
        '<button class="itded__done" data-r="done">완료</button>' +
      '</div>' +
      '<div class="itded__rail" data-r="rail">' +
        '<button class="itrb on" data-tool="text">Aa</button>' +
        '<button class="itrb" data-tool="adjust">' + IC.adjust + '</button>' +
        '<button class="itrb" data-tool="sticker">' + IC.sticker + '</button>' +
        '<button class="itrb" data-tool="layout">' + IC.layout + '</button>' +
        '<button class="itrb" data-tool="shape">' + IC.shape + '</button>' +
        '<button class="itrb" data-tool="draw">' + IC.draw + '</button>' +
      '</div>' +
      buildText() + buildAdjust() + buildSticker() + buildLayout() + buildShape() + buildDraw();
    document.body.appendChild(root);
    cacheRefs();
    wire();
    preloadFonts();   // [#6] 폰트칩이 각 폰트 디자인대로 보이도록 즉시 로드(지연/FOUT 방지)
  }
  // [#6] 칩에 쓰는 폰트를 강제 로드 — 안 그러면 첫 렌더 때 폴백되어 'Aa가'가 다 똑같아 보임.
  function preloadFonts() {
    if (!document.fonts || !document.fonts.load) return;
    FONTS.forEach(function (f) { try { document.fonts.load((f.weight || 700) + ' 16px ' + f.family); } catch (_) { void _; } });
  }

  function buildText() {
    var fonts = FONTS.map(function (f, i) {
      // [#8] 'Aa가'를 그 폰트 그대로 렌더(이름표 없음). family 는 작은따옴표라 큰따옴표 속성 안에서도 안 깨짐.
      var big = (f.key === 'pen' || f.key === 'gamja' || f.key === 'himelody' || f.key === 'gaegu') ? ';font-size:26px' : '';
      return '<button class="itfont' + (i === 0 ? ' on' : '') + '" data-font="' + f.key + '" aria-label="' + f.label + '" style="font-family:' + f.family + big + '">Aa가</button>';
    }).join('');
    var colors = COLORS.map(function (c, i) {
      return '<button class="itsw' + (i === 0 ? ' on' : '') + '" data-color="' + c + '" style="background:' + c + '"></button>';
    }).join('');
    return '<div class="itpanel ittext is-open" data-panel="text">' +
        '<div class="itgrip itgrip--p" data-pgrip></div>' +
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
  // [보정] 사진별 보정 패널 — 위 사진 스트립에서 사진 고르고 아래 슬라이더로 그 사진만 보정.
  function buildAdjust() {
    var sliders = ADJ_CTRLS.map(function (c) {
      return '<div class="itadj__row"><span>' + c.label + '</span>' +
        '<input type="range" min="' + c.min + '" max="' + c.max + '" step="1" data-adj="' + c.k + '">' +
        '<b data-adjout="' + c.k + '">0</b></div>';
    }).join('');
    return '<div class="itpanel itadj" data-panel="adjust">' +
        '<div class="itgrip itgrip--p" data-pgrip></div>' +
              '<div class="itadj__sub">보정할 사진을 고르세요</div>' +
      '<div class="itadj__strip" data-r="adjStrip"></div>' +
      '<div class="itadj__bgrow"><button class="itadj__bg" data-r="adjCut">' + IC.cut + ' 배경 지우기(누끼)</button>' +
        '<button class="itadj__bg itadj__bg--undo" data-r="adjUncut">원본</button></div>' +
      // [#4] 누끼 배경을 바로 옆에서 — 색 탭/사진 업로드. 한 번 누끼하면 색 변경은 0초(매트 캐시 재사용).
      '<div class="itadj__cutbg" data-r="adjCutBg">' +
        BG_COLORS.map(function (c, i) { return '<button class="itlaybg' + (i === 0 ? ' on' : '') + '" data-cutbg="' + c + '" style="background:' + c + '"></button>'; }).join('') +
        '<label class="itlaybg itlaybg--up" aria-label="배경 사진"><input type="file" accept="image/*" data-r="adjBgImg" hidden>' + IC.addphoto + '</label>' +
        // [#2] 최근 업로드 배경 재사용 스와치(있을 때만 보임)
        (function () { try { var rb = localStorage.getItem('itdasy:itd_bgimg'); return rb ? '<button class="itlaybg itlaybg--recent" data-cutbgimg="1" aria-label="최근 배경 재사용" style="background-image:url(\'' + rb + '\')"></button>' : ''; } catch (_e) { return ''; } })() +
      '</div>' +
      '<div class="itadj__row itadj__rotrow"><span>수평</span>' +
        '<input type="range" min="-15" max="15" step="0.5" value="0" data-r="adjRot"><b data-r="adjRotOut">0°</b></div>' +
      sliders +
      '<button class="itadj__reset" data-r="adjReset">이 사진 보정 초기화</button>' +
    '</div>';
  }
  // [#5] 스티커 시트 — 카테고리 탭 + 활성 탭 그리드 1개(탭 전환 = _renderStkTab).
  var STK_TABS = [['reco', '추천'], ['beauty', '뷰티'], ['cute', '귀여움'], ['mz', '트렌디'], ['text', '글자'], ['deco', '도형'], ['my', '내 스티커']];
  function buildSticker() {
    var tabs = STK_TABS.map(function (t, i) {
      return '<button type="button" class="itstk__tab' + (i === 0 ? ' on' : '') + '" data-sttab="' + t[0] + '">' + t[1] + '</button>';
    }).join('');
    return '<div class="itpanel" data-panel="sticker">' +
      '<div class="itstk" data-r="stkSheet">' +
        '<div class="itgrip itgrip--p" data-pgrip></div>' +   // [#3] 다른 패널과 동일한 큰 그립 → 아래로 긁으면 닫힘
        '<div class="itstk__tabs" data-r="stkTabs">' + tabs + '</div>' +
        '<div class="itstk__body" data-r="stkBody"></div>' +
      '</div></div>';
  }
  function _emGrid(arr) {
    return '<div class="itsgrid">' + (arr || []).map(function (s) { return '<button data-stk="' + s + '">' + s + '</button>'; }).join('') + '</div>';
  }
  function _svgGrid(cat, arr) {
    return '<div class="itsgrid">' + (arr || []).map(function (u, i) {
      return '<button class="itdeco" data-stkcat="' + cat + '" data-stkidx="' + i + '"><img src="' + u + '" alt="" draggable="false"></button>';
    }).join('') + '</div>';
  }
  function _txtGrid(arr) {
    return '<div class="itsgrid itsgrid--txt">' + (arr || []).map(function (o, i) {
      var f = fontByKey(o.f) || FONTS[0];
      return '<button class="ittxtstk" data-txtstk="' + i + '" style="font-family:' + f.family + ';font-weight:' + f.weight + '">' + o.t + '</button>';
    }).join('') + '</div>';
  }
  function _recoChips() {
    return '<div class="itfstk">' +
      '<button type="button" class="itfs loc" data-feat="loc" data-r="featLoc">' + IC.loc + '<span data-r="featLocTx">위치</span></button>' +
      '<button type="button" class="itfs book" data-feat="book">' + IC.book + '예약 링크</button>' +
      '<button type="button" class="itfs phone" data-feat="phone">' + IC.phone + '전화</button>' +
      '<button type="button" class="itfs price" data-feat="price">' + IC.price + '가격</button>' +
      '<button type="button" class="itfs time" data-feat="time">' + IC.time + '시간</button>' +
    '</div>';
  }
  // 활성 탭 그리드만 렌더 + 동적 refs 재캡처/바인딩(featLocTx·myStk·stkUpload).
  function _renderStkTab(key) {
    if (!refs.stkBody) return;
    var ST = window.ItdStickers || {};
    var html = '';
    if (key === 'reco') {
      var st = (localStorage.getItem('shop_type') || '').trim();
      var em = ST.shopEmojiByType && ST.shopEmojiByType[st];
      html = _recoChips() + _emGrid(em && em.length ? em.concat(ST.beautyEmoji || []) : (ST.beautyEmoji || EMOJI));
    } else if (key === 'beauty') {
      html = _emGrid(ST.beautyEmoji || EMOJI);
    } else if (key === 'cute') {
      html = _emGrid(ST.cuteEmoji || SHOP_STK);
    } else if (key === 'mz') {
      html = _emGrid(ST.mzEmoji || EMOJI) + _svgGrid('mood', ST.moodSvg);
    } else if (key === 'text') {
      html = _txtGrid(ST.textStk) + _svgGrid('badge', ST.badgeSvg);
    } else if (key === 'deco') {
      html = '<div class="itsgrid">' + DECO.map(function (u, i) { return '<button class="itdeco" data-deco="' + i + '"><img src="' + u + '" alt="" draggable="false"></button>'; }).join('') + '</div>';
    } else if (key === 'my') {
      html = '<div class="itssub itssub--row"><span>내 스티커</span>' +
        '<label class="itstk__up">' + IC.upload + '추가<input type="file" accept="image/*" data-r="stkUpload" hidden></label></div>' +
        '<div class="itsgrid itsgrid--my" data-r="myStk"></div>';
    }
    refs.stkBody.innerHTML = html;
    refs.stkBody.scrollTop = 0;
    refs.featLocTx = refs.stkBody.querySelector('[data-r="featLocTx"]');
    refs.myStk = refs.stkBody.querySelector('[data-r="myStk"]');
    refs.stkUpload = refs.stkBody.querySelector('[data-r="stkUpload"]');
    if (refs.featLocTx) refs.featLocTx.textContent = S.shopName || '우리샵';
    if (refs.stkUpload) refs.stkUpload.addEventListener('change', function () { var fl = refs.stkUpload.files && refs.stkUpload.files[0]; if (fl) addMyStickerFromFile(fl); refs.stkUpload.value = ''; });
    if (refs.myStk) renderMyStickers();
    enableDragScroll(refs.stkBody.querySelector('.itfstk'));
  }
  // 캘리 글자 스티커 → 손글씨 폰트 텍스트 레이어(SVG-img는 웹폰트 불가 → 텍스트로).
  function addTextSticker(text, fontKey) {
    var L = makeLayer('text');
    L.font = fontByKey(fontKey) || FONTS[0]; L.color = COLORS[0]; L.align = 'center'; L.fontSize = 40; L.text = text; L.shadow = true;
    var t = el('div', 'itl-text'); t.textContent = text;
    t.style.cssText = 'font-family:' + L.font.family + ';font-weight:' + L.font.weight + ';color:' + L.color + ';text-align:center;font-size:' + L.fontSize + 'px;white-space:pre-wrap;text-shadow:0 2px 8px rgba(0,0,0,.35)';
    L.el.appendChild(t); L.tx = t;
    placeCenter(L, 200, 60); selectLayer(L);
    _pushOp({ op: 'add', L: L });
    closeStickerSheet();
    return L;
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
        '<div class="itgrip itgrip--p" data-pgrip></div>' +
              '<div class="itshape__row">' + chips + '</div>' +
      '<div class="itshape__opts">' +
        '<span class="itshape__fill" data-r="shapeFill"><button data-shapefill="0" class="on">선만</button><button data-shapefill="1">채움</button></span>' +
        '<span class="itshape__thick">굵기<input type="range" min="2" max="26" step="1" value="6" data-r="shapeThick"></span>' +
      '</div>' +
      '<div class="itshape__colors">' + colors + '</div>' +
    '</div>';
  }
  // [레이아웃 재설계] 도형 미니썸네일 피커(LAYOUTS 그대로) + 렌더된 사진을 순서대로 탭해 자리에 채움.
  var BG_COLORS = ['#FFFFFF', '#FBF7F5', '#F4E9E4', '#E8D3C2', '#F2D7DE', '#E6C9D2', '#D9B8C4', '#BC6675', '#E08A6E', '#E6B45A', '#BFD0C4', '#A7C4B5', '#9DB7C9', '#C9C2E0', '#7A6E78', '#2C2226', '#15181D'];
  function buildLayout() {
    var chips = LAYOUTS.map(function (L, idx) {
      return '<button class="itlaytype' + (idx === 0 ? ' on' : '') + '" data-lay="' + idx + '" aria-label="' + L.label + '">' +
        '<span class="itlaytype__d">' + _layThumbSvg(L) + '</span><em>' + L.label + '</em></button>';
    }).join('');
    var bg = BG_COLORS.map(function (c, i) { return '<button class="itlaybg' + (i === 0 ? ' on' : '') + '" data-bg="' + c + '" style="background:' + c + '"></button>'; }).join('');
    return '<div class="itpanel itlay2" data-panel="layout">' +
        '<div class="itgrip itgrip--p" data-pgrip></div>' +
      '<div class="itlay2__types">' + chips + '</div>' +
      '<div class="itlay2__hint" data-r="layHint"></div>' +
      '<div class="itlay2__strip" data-r="layStrip"></div>' +
      '<div class="itlay2__ctrls">' +
        '<span class="itlay2__fit" data-r="layFit"><button data-fit="cover">꽉 채움</button><button data-fit="contain" class="on">전체</button></span>' +
        '<span class="itlay2__gap">간격<input type="range" min="0" max="24" step="1" value="3" data-r="layGap"></span>' +
        '<span class="itlay2__bg">' + bg + '</span>' +
        '<label class="itlay2__add itlay2__bgimg">' + IC.addphoto + '배경<input type="file" accept="image/*" data-r="layBgImg" hidden></label>' +
        '<label class="itlay2__add">' + IC.addphoto + '사진<input type="file" accept="image/*" data-r="layAdd" hidden></label>' +
      '</div>' +
    '</div>';
  }
  var BRUSH_LABEL = { pen: '펜', marker: '형광펜', neon: '네온', eraser: '지우개' };
  // [#6] 그리기 패널 — 하단 시트로 명확화(세로 슬라이더/아이콘만 지우기 → 라벨 붙은 붓·굵기·색·전체지우기).
  function buildDraw() {
    var brushes = BRUSHES.map(function (b, i) {
      return '<button class="itbrush2' + (i === 0 ? ' on' : '') + '" data-brush="' + b + '" aria-label="' + (BRUSH_LABEL[b] || b) + '">' + IC[b] + '<em>' + (BRUSH_LABEL[b] || b) + '</em></button>';
    }).join('');
    var colors = COLORS.map(function (c, i) {
      return '<button class="itdsw' + (i === 2 ? ' on' : '') + '" data-dcolor="' + c + '" style="background:' + c + '"></button>';
    }).join('');
    return '<div class="itpanel itdrawp" data-panel="draw">' +
      '<div class="itgrip itgrip--p" data-pgrip></div>' +
      '<div class="itdrawp__tools">' + brushes +
        '<button class="itdrawp__clear" data-r="drawClear">' + svg('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>', 2) + '전체 지우기</button></div>' +
      '<div class="itdrawp__size"><span class="itdrawp__lbl">굵기</span><input type="range" min="3" max="40" step="1" value="10" data-r="brushSize"></div>' +
      '<div class="itdrawp__colors">' + colors + '</div>' +
    '</div>';
  }

  function cacheRefs() {
    ['stage', 'photowrap', 'photo', 'collage', 'frame', 'draw', 'layers', 'rail', 'cancel', 'done', 'aln', 'size', 'fonts', 'colors', 'stkSheet', 'layHint', 'layStrip', 'layGap', 'layAdd', 'brushSize', 'featLocTx', 'myStk', 'stkUpload', 'stkTabs', 'stkBody', 'shapeThick', 'adjStrip', 'adjReset', 'adjRot', 'adjRotOut', 'grid', 'adjCut', 'adjUncut', 'adjCutBg', 'adjBgImg', 'layFit', 'layBgImg', 'undo', 'redo', 'peek', 'drawClear', 'addText'].forEach(function (k) {
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
    var drawing = tool === 'draw', inLayout = tool === 'layout';
    refs.draw.classList.toggle('is-armed', drawing);
    refs.draw.style.zIndex = drawing ? '5' : '3';
    // [셀 크롭] 레이아웃 도구에선 콜라주 칸이 포인터를 받게(레이어/캔버스 아래로) → 칸 드래그/핀치 재구도
    refs.draw.style.pointerEvents = inLayout ? 'none' : 'auto';
    // [#3] 레이아웃 중에도 텍스트/스티커는 이동·선택 가능해야(레이어는 콜라주 위). 칸 크롭은 레이어 없는 빈 곳에서.
    refs.layers.style.pointerEvents = drawing ? 'none' : '';
    refs.collage.classList.toggle('is-cropping', inLayout);
    // [#4] Aa 탭 — 텍스트가 '선택된' 상태면 새로 안 만들고 패널만. 아무것도 선택 안 됐을 때만 새 텍스트.
    if (tool === 'text' && !(S.active && S.active.type === 'text')) addText();
    if (tool === 'layout') { renderLayoutStrip(); renderLayoutHint(); }
    if (tool === 'sticker' && refs.stkBody && !refs.stkBody.innerHTML) _renderStkTab('reco');   // [#5] 첫 진입 시 추천 탭
    if (tool === 'adjust') renderAdjust();
    if (S && S._peek) { S._peek = false; if (refs.peek) refs.peek.classList.remove('on'); }   // [P2-2] 도구 바꾸면 전체보기 해제
    fitStageToRatio();   // [P2-2] 패널 열림/닫힘에 맞춰 스테이지 위로/가운데 재배치
  }
  // [P2-2] '사진 전체 보기' — 패널을 잠깐 내려 사진 전체 확인(편집 상태 유지).
  function togglePeek() {
    if (!S) return;
    S._peek = !S._peek;
    root.classList.toggle('itded--peek', S._peek);
    if (refs.peek) refs.peek.classList.toggle('on', S._peek);
    fitStageToRatio();
  }

  /* ── 레이어 공통(드래그) ── */
  function makeLayer(type) {
    var box = el('div', 'itl');
    box.innerHTML = '<button class="itl__del">' + svg('<path d="M18 6L6 18M6 6l12 12"/>', 2.4) + '</button>' +
      '<button class="itl__dup" aria-label="복제">' + svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>', 2.1) + '</button>' +
      '<button class="itl__rot">' + svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>', 2.2) + '</button>' +
      '<button class="itl__rs">' + IC.rs + '</button>';
    var L = { type: type, el: box, x: 0, y: 0, scale: 1, rot: 0 };
    box.addEventListener('pointerdown', function (e) { onLayerDown(e, L); });
    box.querySelector('.itl__del').addEventListener('click', function (e) { e.stopPropagation(); removeLayer(L, true); });
    box.querySelector('.itl__dup').addEventListener('click', function (e) { e.stopPropagation(); duplicateLayer(L); });
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
  // [#2] 직각 자석 — 0·90·180·270 근처(±7°)면 딱 맞춤(수직/수평 느낌으로 중력이 잡아주듯).
  function snapAngle(deg) {
    var n = Math.round(deg / 90) * 90;
    return Math.abs(deg - n) <= 7 ? n : deg;
  }
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
  function removeLayer(L, track) {
    var i = S.layers.indexOf(L); if (i >= 0) S.layers.splice(i, 1);
    L.el.remove(); if (S.active === L) S.active = null;
    if (track) _pushOp({ op: 'del', L: L, idx: i });   // [P1-3] 실수 삭제 되돌리기
  }
  // [P1-3] 구조적 undo/redo — 추가/삭제/복제만 추적(실제 DOM 노드 보존, 재생성 안 함 → 안전).
  //   이동·색변경 등 속성 변화는 드래그로 쉽게 재조정 가능하므로 제외. 가장 치명적인 '실수 삭제'를 확실히 커버.
  function _pushOp(op) { if (!S.undo) S.undo = []; S.undo.push(op); S.redo = []; if (S.undo.length > 40) S.undo.shift(); _syncHist(); }
  function _applyInverse(op, undo) {
    var add = (op.op === 'add') === undo;   // undo: add→제거, del→복원 / redo: 반대
    if (add) { if (refs.layers && op.L.el) refs.layers.appendChild(op.L.el); if (S.layers.indexOf(op.L) < 0) { var at = (op.idx != null && op.idx <= S.layers.length) ? op.idx : S.layers.length; S.layers.splice(at, 0, op.L); } selectLayer(op.L); }
    else { var i = S.layers.indexOf(op.L); if (i >= 0) S.layers.splice(i, 1); op.L.el.remove(); if (S.active === op.L) S.active = null; }
  }
  function _undo() { if (!S.undo || !S.undo.length) return; var op = S.undo.pop(); _applyInverse(op, true); S.redo = S.redo || []; S.redo.push(op); _syncHist(); }
  function _redo() { if (!S.redo || !S.redo.length) return; var op = S.redo.pop(); _applyInverse(op, false); S.undo = S.undo || []; S.undo.push(op); _syncHist(); }
  function _syncHist() {
    if (refs.undo) refs.undo.disabled = !(S.undo && S.undo.length);
    if (refs.redo) refs.redo.disabled = !(S.redo && S.redo.length);
  }
  // [P1-3] 선택 레이어 복제 — 내용 DOM 노드를 그대로 복제(스타일 보존) + 데이터 복사, 18px 오프셋.
  function duplicateLayer(L) {
    if (!L) L = S.active; if (!L) return;
    var c = makeLayer(L.type);
    ['font', 'color', 'align', 'fontSize', 'text', 'role', 'stroke', 'shadow', 'badge', 'emoji', 'src', 'shape', 'fill', 'thick', 'fontSizePx'].forEach(function (k) { if (L[k] !== undefined) c[k] = L[k]; });
    if (L.tx) { var node = L.tx.cloneNode(true); node.removeAttribute('contenteditable'); c.el.appendChild(node); c.tx = node; }
    c.x = (L.x || 0) + 18; c.y = (L.y || 0) + 18; c.scale = L.scale || 1; c.rot = L.rot || 0;
    applyXf(c); selectLayer(c);
    _pushOp({ op: 'add', L: c });
  }
  var drag = null, lpinch = null;
  function onLayerDown(e, L) {
    e.preventDefault(); selectLayer(L);
    L._pts = L._pts || {}; L._pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    try { L.el.setPointerCapture(e.pointerId); } catch (_) { void _; }
    var ids = Object.keys(L._pts);
    if (ids.length >= 2) {   // [#4] 두 손가락 → 핀치(크기+회전), 단일 드래그 중지
      drag = null;
      var q1 = L._pts[ids[0]], q2 = L._pts[ids[1]];
      lpinch = { L: L, ids: [ids[0], ids[1]], d0: Math.max(8, Math.hypot(q1.x - q2.x, q1.y - q2.y)), a0: Math.atan2(q2.y - q1.y, q2.x - q1.x), s0: L.scale || 1, r0: L.rot || 0 };
      return;
    }
    if (L.type === 'text' && L._tapEdit && Date.now() - L._tapEdit < 350) { editText(L); return; }
    L._tapEdit = Date.now();
    drag = { L: L, pid: e.pointerId, sx: e.clientX, sy: e.clientY, ox: L.x, oy: L.y };
    L.el.style.cursor = 'grabbing';
  }
  document.addEventListener('pointermove', function (e) {
    if (lpinch) {
      var L = lpinch.L; if (L._pts[e.pointerId]) L._pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var p1 = L._pts[lpinch.ids[0]], p2 = L._pts[lpinch.ids[1]]; if (!p1 || !p2) return;
      var dd = Math.hypot(p1.x - p2.x, p1.y - p2.y), aa = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      L.scale = Math.max(0.2, Math.min(8, lpinch.s0 * dd / lpinch.d0));
      L.rot = snapAngle(lpinch.r0 + (aa - lpinch.a0) * 180 / Math.PI); applyXf(L);
      if (L.type === 'text' && refs.size) refs.size.value = L.scale; return;
    }
    if (rsd) {
      var d = Math.hypot(e.clientX - rsd.cx, e.clientY - rsd.cy);
      rsd.L.scale = Math.max(0.2, Math.min(6, rsd.s0 * d / rsd.d0)); applyXf(rsd.L);
      if (rsd.L.type === 'text' && refs.size) refs.size.value = rsd.L.scale; return;
    }
    if (rotd) {
      var a = Math.atan2(e.clientY - rotd.cy, e.clientX - rotd.cx);
      rotd.L.rot = snapAngle(rotd.start + (a - rotd.a0) * 180 / Math.PI); applyXf(rotd.L); return;
    }
    if (!drag) return;
    if (S) S._userMoved = true;   // [P2-1] 사용자가 직접 옮기면 자동 회피 우선권 해제
    drag.L.x = drag.ox + (e.clientX - drag.sx);
    drag.L.y = drag.oy + (e.clientY - drag.sy);
    applyXf(drag.L);
  });
  document.addEventListener('pointerup', cleanupLayerPointer);
  document.addEventListener('pointercancel', cleanupLayerPointer);
  function cleanupLayerPointer(e) {
    // [#1 드래그 회귀] 어느 경로로 끝나든 모든 레이어의 포인터 추적을 지운다(안 지우면 stale 포인터로 다음 드래그가 핀치로 오인됨).
    (S && S.layers || []).forEach(function (L) { if (L._pts) delete L._pts[e.pointerId]; });
    if (lpinch && (!lpinch.L._pts || Object.keys(lpinch.L._pts).length < 2)) lpinch = null;
    if (drag) { drag.L.el.style.cursor = 'grab'; drag = null; }
    rotd = null; rsd = null;
  }

  /* ── 사진 핀치 확대/이동 (두 손가락, 빈 배경에서) ── */
  var pinchPts = {}, pinch0 = null;
  function pdist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  // [#3] 사진 수평 맞추기 — 회전 시 빈 모서리 안 생기게 cover 스케일 보정.
  function coverScaleForRot(deg) {
    var r = Math.abs(deg) * Math.PI / 180; var st = refs.stage.getBoundingClientRect(); var W = st.width || 1, H = st.height || 1;
    return Math.max((W * Math.cos(r) + H * Math.sin(r)) / W, (W * Math.sin(r) + H * Math.cos(r)) / H, 1);
  }
  function applyPhotoTransform() {
    // [#2] 콜라주(레이아웃)에선 photowrap 을 회전하면 '전체'가 휘어버린다 → 단일 모드에서만 회전 적용.
    //   콜라주는 각 셀 이미지가 자기 사진의 수평보정을 개별로 반영(renderCollage).
    var deg = 0;
    if (isSingleL(S.layout)) {
      // [#7] 슬라이더는 adjOf(S.adjSel).rot 에 쓰므로 활성 사진(adjSel) 기준으로 읽는다(누끼 후 URL 매칭 실패 방지).
      try { var idx = (S.adjSel != null && S.photos[S.adjSel] != null) ? S.adjSel : S.photos.indexOf(S.photoUrl); deg = (adjOf(idx < 0 ? 0 : idx).rot) || 0; } catch (_) { void _; }
    }
    var cs = deg ? coverScaleForRot(deg) : 1;
    refs.photowrap.style.transform = 'translate(' + S.pz.tx + 'px,' + S.pz.ty + 'px) scale(' + ((S.pz.scale || 1) * cs) + ') rotate(' + deg + 'deg)';
  }
  function applyPz() { applyPhotoTransform(); }
  function applyStraighten() { applyPhotoTransform(); if (!isSingleL(S.layout)) renderCollage(); }   // [#2] 콜라주 모드에선 셀별 회전을 즉시 다시 그림(슬라이더 실시간 반영)
  function stageDown(e) {
    if (S.tool === 'draw' || (e.target.closest && (e.target.closest('.itl') || e.target.closest('.itrb') || e.target.closest('.itpanel')))) return;
    // [보스#9] 레이어(텍스트/스티커) 밖 빈 곳을 탭하면 선택 해제 → 핸들(×·회전·크기) 숨김.
    if (S.active) selectLayer(null);
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
    _pushOp({ op: 'add', L: L });   // [P1-3] 추가 되돌리기
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
    if (spec.type === 'line') return addShopLine(spec, R);
    if (spec.type === 'rect') return addShopRect(spec, R);
    if (spec.type === 'sticker' || spec.type === 'emoji') return addShopSticker(spec, R);   // [#5/#6] 이모지 스티커도 복원/합성(compose)에서 렌더
    return _addShopLayerText(spec, R);   // 기본: 텍스트/배지
  }
  // [#5/#6] 이모지 스티커 레이어 재생성 — 재편집 복원 + 헤드리스 compose 양쪽에서 사용.
  function addShopSticker(spec, R) {
    var L = makeLayer('sticker'); L.emoji = spec.emoji; L.fontSize = 64; L.rot = spec.rot || 0;
    L.scale = spec.size != null ? (spec.size * R.height) / 64 : (spec.scale || 1);
    var s = el('div', 'itl-sticker'); s.textContent = spec.emoji; L.el.appendChild(s); L.tx = s;
    L.x = (spec.x != null ? spec.x : 0.5) * R.width - 32;
    L.y = (spec.y != null ? spec.y : 0.5) * R.height - 32; applyXf(L);
    return L;
  }
  function _addShopLayerText(spec, R) {
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
  // [#14] 우리샵 스타일에서 들어온 구분선 → 편집 가능한 line 도형 레이어로.
  function addShopLine(spec, R) {
    var L = makeLayer('shape'); L.shape = 'line'; L.color = spec.color || '#ffffff'; L.fill = true; L.role = 'rule'; L.rot = spec.rot || 0;
    L.strokeW = Math.max(2, Math.round((spec.size != null ? spec.size : 0.006) * R.height));
    var w = Math.round((spec.w != null ? spec.w : 0.11) * R.width);
    var d = el('div', 'itl-shape'); styleShape(d, L); d.style.width = w + 'px'; L.el.appendChild(d); L.tx = d;
    var bh = Math.max(L.strokeW, 22);
    L.x = (spec.x != null ? spec.x : 0.5) * R.width - w / 2;
    L.y = (spec.y != null ? spec.y : 0.88) * R.height - bh / 2;
    applyXf(L);
    return L;
  }
  // [#1] 채움 '면'(반투명 패널/악센트 블록) — 텍스트 뒤 가독성·디자인용. 색은 rgba 권장(반투명).
  function addShopRect(spec, R) {
    var L = makeLayer('shape'); L.shape = (spec.shape === 'rect' ? 'rect' : 'round'); L.fill = true;
    L.color = spec.color || 'rgba(20,16,18,.30)'; L.role = spec.role || 'panel'; L.rot = spec.rot || 0;
    var w = Math.round((spec.w != null ? spec.w : 0.8) * R.width);
    var h = Math.round((spec.h != null ? spec.h : 0.12) * R.height);
    var d = el('div', 'itl-shape');
    d.style.cssText = 'box-sizing:border-box;width:' + w + 'px;height:' + h + 'px;background:' + L.color + ';border-radius:' + (spec.radius != null ? spec.radius : 16) + 'px';
    L.el.appendChild(d); L.tx = d;
    L.x = (spec.x != null ? spec.x : 0.5) * R.width - w / 2;
    L.y = (spec.y != null ? spec.y : 0.85) * R.height - h / 2;
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
    _deOverlapIncoming();   // [#2] 텍스트 길이 무관 — 자동배치 글자/선이 서로 안 겹치게 세로로 벌림
    S.active = null; S.layers.forEach(function (x) { x.el.classList.remove('is-active'); });
    _applySafeZone();   // [P2-1] 얼굴/피사체 위 자동 텍스트 비켜놓기(비동기, 폴백 안전)
  }
  // [P2-1] 자동배치 텍스트가 얼굴/피사체를 덮으면 비켜 배치. 비동기(마스크/휴리스틱) → 계산 후 한 번 이동.
  //   보수적: 세로로 겹치는 자동 역할 레이어만, 빈 쪽(아래/위)으로 밀고 스테이지 안으로 클램프. 실패/저신뢰=폴백.
  function _applySafeZone() {
    if (!S || S._safeApplied || S._userMoved) return;
    if (!(window.ItdSafeZone && window.ItdSafeZone.avoidBox)) return;
    var url = S.photoUrl; if (!url) return;
    S._safeApplied = true;   // 1회만
    window.ItdSafeZone.avoidBox(url).then(function (box) {
      if (!box || !S || S._userMoved || (S.layout && (S.layout.kind || 'single') !== 'single')) return;
      var R = refs.stage.getBoundingClientRect(); if (!R.height) return;
      var atop = box.y * R.height, abot = (box.y + box.h) * R.height;
      var faceUpper = (atop + (abot - atop) / 2) < R.height * 0.55;
      var auto = S.layers.filter(function (L) { return ((L.type === 'text' || L.type === 'badge') && L.role) || (L.type === 'shape' && L.role === 'rule'); });
      if (!auto.length) return;
      var moved = false, pad = R.height * 0.03;
      auto.forEach(function (L) {
        var b = L.el.getBoundingClientRect(); var top = b.top - R.top, bot = b.bottom - R.top;
        if (bot > atop && top < abot) {   // 얼굴과 세로로 겹침
          if (faceUpper) { var dn = (abot + pad) - top; if (dn > 0) { L.y += dn; moved = true; } }
          else { var up = bot - (atop - pad); if (up > 0) { L.y -= up; moved = true; } }
        }
      });
      if (!moved) return;
      _deOverlapIncoming();
      auto.forEach(function (L) {
        var b = L.el.getBoundingClientRect();
        if (b.top - R.top < 0) { L.y += (R.top - b.top) + 4; applyXf(L); }
        if (b.bottom - R.top > R.height) { L.y -= (b.bottom - R.top - R.height) + 4; applyXf(L); }
      });
    });
  }
  // [#2] 자동배치 역할 레이어(시술명/내용/선)가 겹치면 세로로 벌리고, 화면 밖이면 그룹을 위로 당겨 유지.
  function _deOverlapIncoming() {
    var R = refs.stage.getBoundingClientRect(); if (!R.height) return;
    var arr = S.layers.filter(function (L) { return ((L.type === 'text' || L.type === 'badge') && L.role) || (L.type === 'shape' && L.role === 'rule'); });
    if (arr.length < 2) return;
    arr.sort(function (a, b) { return a.el.getBoundingClientRect().top - b.el.getBoundingClientRect().top; });
    var GAP = R.height * 0.010, moved = false;
    for (var i = 1; i < arr.length; i++) {
      var pb = arr[i - 1].el.getBoundingClientRect(), cb = arr[i].el.getBoundingClientRect();
      if (cb.top < pb.bottom + GAP) { arr[i].y += (pb.bottom + GAP) - cb.top; applyXf(arr[i]); moved = true; }
    }
    if (moved) {
      var last = arr[arr.length - 1].el.getBoundingClientRect();
      var overflow = last.bottom - (R.bottom - R.height * 0.02);
      if (overflow > 0) arr.forEach(function (L) { L.y -= overflow; applyXf(L); });
    }
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
    placeCenter(L, 64, 64); selectLayer(L); _pushOp({ op: 'add', L: L });
    closeStickerSheet();   // [②] 스티커 하나 고르면 하단 시트 내려가고 사진 위에서 바로 배치
  }
  // [③] 우리샵 피처 칩(위치/예약/가격/시간) — 탭하면 텍스트 레이어로 사진 위에 올림(클릭 동작).
  // [기능 스티커] 가게 정보 저장 — 한 번 입력하면 이후 자동으로 실제 값이 박히고, 게시 캡션에도 활용(피드용).
  var SHOP_INFO_KEY = { loc: 'itdasy:shop_loc', book: 'itdasy:shop_book', phone: 'itdasy:shop_phone', price: 'itdasy:shop_price', time: 'itdasy:shop_hours', handle: 'itdasy:shop_handle' };
  function shopInfoGet(k) { try { return String(localStorage.getItem(SHOP_INFO_KEY[k]) || '').trim(); } catch (_) { return ''; } }
  function shopInfoSet(k, v) { try { localStorage.setItem(SHOP_INFO_KEY[k], v); } catch (_) { void _; } }
  function addFeatureLayer(kind) {
    // 실제 값을 불러오고, 없으면 '한 번만' 물어봐서 저장(다음부터 자동).
    var conf = {
      loc:   { ask: '가게 위치·동네를 입력하세요 (예: 인천 구월동)', val: function () { return shopInfoGet('loc'); }, fmt: function (v) { return '📍 ' + v; } },
      phone: { ask: '가게 전화번호를 입력하세요',                  val: function () { return shopInfoGet('phone'); }, fmt: function (v) { return '☎ ' + v; } },
      book:  { ask: '예약 링크(URL)를 입력하세요 (예: naver.me/xxxx)', val: function () { return shopInfoGet('book'); }, fmt: function () { return '예약하기 →'; }, accent: true },
      price: { ask: '가격 안내를 입력하세요 (예: 컷 3만원~)',      val: function () { return shopInfoGet('price'); }, fmt: function (v) { return v; } },
      time:  { ask: '영업시간을 입력하세요 (예: 매일 10-20시)',    val: function () { return shopInfoGet('time'); }, fmt: function (v) { return '🕐 ' + v; } },
      handle:{ ask: '인스타 아이디를 입력하세요 (@ 없이)',        val: function () { return shopInfoGet('handle'); }, fmt: function (v) { return '@' + String(v).replace(/^@/, ''); } }
    };
    var c = conf[kind]; if (!c) return;
    var v = c.val();
    if (!v) {
      var input = window.prompt(c.ask, '');   // [MVP] 첫 입력만 프롬프트 — 이후 저장돼서 자동(추후 인라인 입력으로 업글)
      if (input == null) return;
      v = String(input).trim(); if (!v) return;
      if (SHOP_INFO_KEY[kind]) shopInfoSet(kind, v);   // 저장 → 다음부터 자동
    }
    var text = c.fmt(v);
    var L = makeLayer('text');
    L.font = FONTS[0]; L.color = '#FFFFFF'; L.align = 'center'; L.fontSize = 26; L.text = text;
    L.shadow = true; L.role = (kind === 'loc' ? 'shop' : kind); L.featKind = kind; L.featValue = v;   // 캡션 연동용 메타
    var t = el('div', 'itl-text'); t.textContent = text;
    var css = 'font-family:' + L.font.family + ';font-weight:800;color:#FFFFFF;text-align:center;font-size:26px;text-shadow:0 2px 8px rgba(0,0,0,.4)';
    if (c.accent) { css += ';background:linear-gradient(135deg,#D58A95,#BC6675);padding:8px 18px;border-radius:999px;text-shadow:none'; L.badge = true; }
    t.style.cssText = css; L.el.appendChild(t); L.tx = t;
    placeCenter(L, 150, 46); selectLayer(L); _pushOp({ op: 'add', L: L });
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
  // [#7] 하단 도구패널 전체 닫기 — 아무 도구도 선택 안 한 상태로(모든 패널 내림).
  function _closeToolPanel() {
    S.tool = null;
    root.querySelectorAll('.itrb').forEach(function (b) { b.classList.remove('on'); });
    Object.keys(refs.panels).forEach(function (k) { refs.panels[k].classList.remove('is-open'); });
    if (refs.stkSheet) refs.stkSheet.classList.remove('is-tall');
    refs.draw.classList.remove('is-armed'); refs.draw.style.zIndex = '3'; refs.draw.style.pointerEvents = 'auto';
    refs.layers.style.pointerEvents = '';
    if (refs.collage) refs.collage.classList.remove('is-cropping');
    fitStageToRatio();
  }
  // [#7] 패널 상단을 아래로 긁으면 닫히게 — grip 요소가 있는 모든 패널에 스와이프 부착.
  // [#3·#6] 그립 스와이프 — 시트(패널) 전체가 손가락 따라 내려가고, 놓으면 닫히거나(슬라이드-다운) 부드럽게 제자리로.
  function _attachSheetSwipe(gripEl) {
    if (!gripEl) return;
    var panel = (gripEl.closest && gripEl.closest('.itpanel')) || gripEl.parentElement;
    var gd = null;
    gripEl.addEventListener('pointerdown', function (e) { gd = { y: e.clientY }; if (panel) panel.style.transition = 'none'; try { gripEl.setPointerCapture(e.pointerId); } catch (_) { void _; } });
    gripEl.addEventListener('pointermove', function (e) { if (!gd || !panel) return; var dy = e.clientY - gd.y; if (dy > 0) panel.style.transform = 'translateY(' + dy + 'px)'; });
    gripEl.addEventListener('pointerup', function (e) { if (!gd) return; var dy = e.clientY - gd.y; gd = null; if (panel) { panel.style.transition = ''; panel.style.transform = ''; } if (dy > 60) _closeToolPanel(); });
    gripEl.addEventListener('pointercancel', function () { gd = null; if (panel) { panel.style.transition = ''; panel.style.transform = ''; } });
  }
  /* ── 이미지 스티커(데코·내 스티커) #6/#7 ── */
  function addImageSticker(src) {
    var L = makeLayer('image'); L.role = 'sticker'; L.src = src;
    var im = document.createElement('img'); im.src = src; im.alt = ''; im.setAttribute('draggable', 'false');
    im.style.cssText = 'display:block;width:120px;height:auto;pointer-events:none';
    L.el.appendChild(im); L.tx = im;
    var place = function () { placeCenter(L, L.el.offsetWidth || 120, L.el.offsetHeight || 120); };
    if (im.complete && im.naturalWidth) place(); else im.onload = place;
    place(); selectLayer(L); _pushOp({ op: 'add', L: L }); closeStickerSheet();
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
  // [#5] 활성 도형에 색/채움/굵기 즉시 반영(새로 만드는 것뿐 아니라 선택된 것에도).
  function applyShapeStyle() {
    var L = S.active; if (!L || L.type !== 'shape') return;
    L.color = S.shapeColor; L.fill = !!S.shapeFill; L.strokeW = S.shapeThick;
    if (L.shape === 'line') { var cw = parseFloat(L.tx.style.width) || L.tx.offsetWidth || 180; styleShape(L.tx, L); L.tx.style.width = cw + 'px'; }
    else styleShape(L.tx, L);
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
    S.layoutOrder = []; S.cellCrop = [];   // 타입 바꾸면 자리 선택·셀 크롭 초기화
    refs.frame.className = 'itded__frame';
    root.querySelectorAll('.itlaytype').forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-lay') === i); });
    // [#3] 콜라주 기본을 '전체보기(contain)'로 — 상하/좌우 분할에서 사진이 잘려보이던 문제 해소(뷰티 전후컷은 잘리면 안 됨).
    //   꽉 채움(cover)을 원하면 fit 토글로 전환. 단일도 전체.
    if (!S._fitManual) { S.fitMode = 'contain'; _syncFitToggle(); }
    _syncBaLabels();   // [전/후] 전/후 레이아웃이면 BEFORE·AFTER 라벨 자동, 아니면 제거
    applyPhotoTransform();   // [#2] 단일↔콜라주 전환 시 photowrap 회전 리셋(콜라주 전체 휘어짐 방지)
    renderCollage(); renderLayoutStrip(); renderLayoutHint();
  }
  // [전/후 비교] BEFORE/AFTER 코너 라벨(배지) — 전/후 레이아웃 선택 시 자동 삽입, 해제 시 제거.
  function _syncBaLabels() {
    S.layers.slice().forEach(function (L) { if (L.role === 'balabel') removeLayer(L, false); });
    if (!(S.layout && S.layout.ba)) return;
    var R = refs.stage.getBoundingClientRect();
    [['BEFORE', 0.25], ['AFTER', 0.75]].forEach(function (p) {
      var L = addShopLayer({ type: 'badge', text: p[0], x: p[1], y: 0.09, size: 0.03, align: 'center', color: '#fff', bg: 'rgba(21,24,29,.55)', weight: 800, role: 'balabel' }, R);
      L.role = 'balabel'; _pushOp({ op: 'add', L: L });
    });
  }
  function _syncFitToggle() {
    if (!refs.layFit) return;
    refs.layFit.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-fit') === (S.fitMode || 'cover')); });
  }
  // 사진 순서 탭 — grid면 자리(좌우/4분할)에 순서대로 배정, 1장이면 그 사진을 단일 배경으로.
  function onLayThumb(idx) {
    if (isSingleL(S.layout)) {
      if (idx !== S.adjSel) { _switchPhotoDraw(S.adjSel, idx); _switchPhotoLayers(S.adjSel, idx); S.adjSel = idx; }   // [#9] 그리기 + [#5/#6] 텍스트·스티커도 사진별로
      S.photoUrl = S.photos[idx]; S.photoCss = 'url("' + S.photos[idx] + '")';
      refs.photo.style.backgroundImage = S.photoCss;
      renderLayoutStrip(); renderLayoutHint(); return;
    }
    var at = S.layoutOrder.indexOf(idx);
    if (at >= 0) S.layoutOrder.splice(at, 1);              // 다시 누르면 해제(뒤 번호 당겨짐)
    else if (S.layoutOrder.length < _layN()) S.layoutOrder.push(idx);
    renderCollage(); renderLayoutStrip(); renderLayoutHint();
  }
  function renderLayoutStrip() {
    if (!refs.layStrip) return;
    var single = isSingleL(S.layout);
    refs.layStrip.innerHTML = (S.photos || []).map(function (u, i) {
      var ord = single ? (S.photoUrl === u ? 0 : -1) : S.layoutOrder.indexOf(i);
      var badge = (!single && ord >= 0) ? '<span class="itlaybadge">' + (ord + 1) + '</span>' : '';
      var sel = (single && S.photoUrl === u) ? ' on' : (ord >= 0 ? ' on' : '');
      return '<button class="itlaythumb' + sel + '" data-laythumb="' + i + '" style="background-image:url(\'' + u + '\')">' + badge + '</button>';
    }).join('');
  }
  function renderLayoutHint() {
    if (!refs.layHint) return;
    if (isSingleL(S.layout)) { refs.layHint.textContent = '넣을 사진 하나를 누르세요'; return; }
    var pos = _layPosArr(), need = _layN();
    var filled = S.layoutOrder.length;
    refs.layHint.innerHTML = '<b>' + S.layout.label + '</b> 순서대로 탭 · ' +
      pos.map(function (p, i) { return (i + 1) + '=' + p; }).join(' ') + ' <b class="itlay2__cnt">' + filled + '/' + need + '</b>' +
      (filled ? '<span class="itlay2__tip">칸 끌어 위치 · 두 손가락 확대</span>' : '');
  }
  // 콜라주(좌우2장/4장) — 단일이면 collage 숨김. grid면 선택 순서(layoutOrder)대로 칸 채움(미선택=자리표시).
  function renderCollage() {
    var fit = S.fitMode || 'cover';
    if (isSingleL(S.layout)) { refs.collage.hidden = true; refs.collage.className = 'itded__collage'; refs.collage.innerHTML = ''; refs.photo.style.backgroundImage = S.photoCss; refs.photo.style.backgroundSize = fit; refs.photo.style.backgroundColor = (fit === 'contain' ? (S.collageBg || '#fff') : 'transparent'); return; }
    // [SSOT] 셀 좌표 그대로 절대배치 — 비대칭(1+2·2+1) 포함 모든 모양 지원, export와 동일 좌표.
    var cellsSpec = _layCells(), pos = _layPosArr(), gap = (S.collageGap != null ? S.collageGap : 3), cells = '';
    for (var k = 0; k < cellsSpec.length; k++) {
      var cc = cellsSpec[k];
      var st = 'left:calc(' + (cc[0] * 100) + '% + ' + (gap / 2) + 'px);top:calc(' + (cc[1] * 100) + '% + ' + (gap / 2) + 'px);' +
        'width:calc(' + (cc[2] * 100) + '% - ' + gap + 'px);height:calc(' + (cc[3] * 100) + '% - ' + gap + 'px)';
      var idx = S.layoutOrder[k];
      // [#2] 셀마다 그 사진의 수평보정(rot)을 개별 반영 — 콜라주 전체가 아니라 각 칸만 회전.
      var _rdeg = (idx != null ? (adjOf(idx).rot || 0) : 0);
      var _rot = _rdeg ? (' rotate(' + _rdeg + 'deg) scale(' + coverScaleForRot(_rdeg) + ')') : '';
      if (idx != null && S.photos[idx]) cells += '<div class="itded__cell" data-ci="' + idx + '" data-cell="' + k + '" style="' + st + ';filter:' + filterStr(adjOf(idx)) + '"><img class="itcellimg" src="' + S.photos[idx] + '" draggable="false" style="object-fit:' + fit + ';transform:' + cropXf(k) + _rot + '"></div>';
      else cells += '<div class="itded__cell itded__cell--empty" data-cell="' + k + '" style="' + st + '">' + (k + 1) + '번<br>' + (pos[k] || '') + '</div>';
    }
    refs.collage.className = 'itded__collage is-abs';
    refs.collage.style.gap = '';
    refs.collage.style.background = S.collageBgImg ? ('center/cover no-repeat url("' + S.collageBgImg + '")') : (S.collageBg || '#fff');
    refs.collage.innerHTML = cells; refs.collage.hidden = false;
  }
  // [#5] 꽉 채움(cover)/전체(contain) — 풀 사진이 잘리지 않게 '전체'면 여백에 배경색.
  function applyFit() {
    var fit = S.fitMode || 'cover';
    if ((S.layout.kind || 'single') === 'single') {
      refs.photo.style.backgroundSize = fit; refs.photo.style.backgroundColor = (fit === 'contain' ? (S.collageBg || '#fff') : 'transparent');
    } else { renderCollage(); }
  }
  // [#2 단일화·WYSIWYG] 스테이지를 게시물 비율(4:5 등) 박스로 고정 — 화면 전체로 늘어나지 않게.
  //   편집기(실기기)·헤드리스 compose(432px) 모두 같은 종횡비 → 줄바꿈/겹침방지/내보내기 100% 일치(#2).
  //   바깥 여백은 .itded 어두운 배경, 상단바·우측레일·하단패널은 absolute 오버레이라 겹쳐도 OK.
  function fitStageToRatio() {
    if (!root || !refs.stage) return;
    var rp = String(S && S.ratio || '4:5').split(':'); var rw = +rp[0] || 4, rh = +rp[1] || 5;
    var availW = root.clientWidth || 432, availH = root.clientHeight || 540;
    var w = availW, h = w * rh / rw;
    if (h > availH) { h = availH; w = h * rw / rh; }
    refs.stage.style.flex = '0 0 auto';
    refs.stage.style.width = Math.round(w) + 'px';
    refs.stage.style.height = Math.round(h) + 'px';
    refs.stage.style.margin = 'auto';   // 항상 가운데(자동 위로-이동은 하단 텍스트를 패널 밑으로 숨겨 제거 — #7). 사진 전체 확인은 peek 토글로.
  }
  /* ── 셀별 크롭(콜라주 칸마다 드래그/핀치 재구도) ── */
  function cropOf(k) { if (!S.cellCrop[k]) S.cellCrop[k] = { s: 1, tx: 0, ty: 0 }; return S.cellCrop[k]; }
  function cropXf(k) { var c = (S.cellCrop && S.cellCrop[k]) || { s: 1, tx: 0, ty: 0 }; return 'translate(' + c.tx + 'px,' + c.ty + 'px) scale(' + c.s + ')'; }
  function cellElByK(k) { return refs.collage.querySelector('[data-cell="' + k + '"]'); }
  function clampCrop(k) { var c = cropOf(k), el2 = cellElByK(k); if (!el2) return; var r = el2.getBoundingClientRect(); var mx = (c.s - 1) * r.width / 2, my = (c.s - 1) * r.height / 2; c.tx = Math.max(-mx, Math.min(mx, c.tx)); c.ty = Math.max(-my, Math.min(my, c.ty)); }
  function applyCrop(k) { clampCrop(k); var el2 = cellElByK(k); var im = el2 && el2.querySelector('.itcellimg'); if (im) im.style.transform = cropXf(k); }
  function selectCell(k) { S.cellSel = k; refs.collage.querySelectorAll('[data-cell]').forEach(function (c) { c.classList.toggle('is-cellsel', +c.getAttribute('data-cell') === k); }); }
  var cropDrag = null, cropPinch = null, cellPts = {};
  function onCellDown(e) {
    if (refs.collage.hidden) return;
    var cell = e.target.closest && e.target.closest('[data-cell]'); if (!cell) return;
    e.preventDefault();
    var k = +cell.getAttribute('data-cell'); selectCell(k);
    cellPts[k] = cellPts[k] || {}; cellPts[k][e.pointerId] = { x: e.clientX, y: e.clientY };
    try { refs.collage.setPointerCapture(e.pointerId); } catch (_) { void _; }
    var ids = Object.keys(cellPts[k]); var c = cropOf(k);
    if (ids.length >= 2) { cropDrag = null; var p1 = cellPts[k][ids[0]], p2 = cellPts[k][ids[1]]; cropPinch = { k: k, ids: [ids[0], ids[1]], d0: Math.max(8, Math.hypot(p1.x - p2.x, p1.y - p2.y)), s0: c.s }; return; }
    cropDrag = { k: k, sx: e.clientX, sy: e.clientY, tx0: c.tx, ty0: c.ty };
  }
  function onCellMove(e) {
    if (cropPinch) {
      var k = cropPinch.k; if (cellPts[k] && cellPts[k][e.pointerId]) cellPts[k][e.pointerId] = { x: e.clientX, y: e.clientY };
      var p1 = cellPts[k] && cellPts[k][cropPinch.ids[0]], p2 = cellPts[k] && cellPts[k][cropPinch.ids[1]]; if (!p1 || !p2) return;
      var c = cropOf(k); c.s = Math.max(1, Math.min(4, cropPinch.s0 * Math.hypot(p1.x - p2.x, p1.y - p2.y) / cropPinch.d0)); applyCrop(k); return;
    }
    if (cropDrag) { var c2 = cropOf(cropDrag.k); c2.tx = cropDrag.tx0 + (e.clientX - cropDrag.sx); c2.ty = cropDrag.ty0 + (e.clientY - cropDrag.sy); applyCrop(cropDrag.k); }
  }
  function onCellUp(e) {
    var kk; for (kk in cellPts) { if (cellPts[kk] && cellPts[kk][e.pointerId]) delete cellPts[kk][e.pointerId]; }
    if (cropPinch && (!cellPts[cropPinch.k] || Object.keys(cellPts[cropPinch.k]).length < 2)) cropPinch = null;
    cropDrag = null;
  }

  /* ── 사진별 보정(밝기/대비/채도/온도/선명도) ── */
  function adjOf(i) { if (!S.adj[i]) S.adj[i] = defAdj(); return S.adj[i]; }
  function adjReadout(c, v) { return (c.k === 'w' || c.k === 'sh') ? ('' + v) : ((v - 100 >= 0 ? '+' : '') + (v - 100)); }
  var _adjRaf = 0;
  function applyAdjThrottled() { if (_adjRaf) return; var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); }; _adjRaf = raf(function () { _adjRaf = 0; applyAdjToDisplay(); }); }
  function applyAdjToDisplay() {
    if ((S.layout.kind || 'single') === 'single') {
      var idx = S.photos.indexOf(S.photoUrl); refs.photo.style.filter = filterStr(adjOf(idx < 0 ? 0 : idx));   // straighten 은 회전/사진전환 때만(여기선 호출 안 함 → 매 틱 reflow 제거)
    } else {
      // [#1 끊김] 셀 innerHTML 재생성(배경이미지 재디코딩) 대신 필터만 in-place 갱신
      refs.collage.querySelectorAll('.itded__cell[data-ci]').forEach(function (cell) { cell.style.filter = filterStr(adjOf(+cell.getAttribute('data-ci'))); });
    }
  }
  function syncAdjSliders() {
    var a = adjOf(S.adjSel);
    ADJ_CTRLS.forEach(function (c) {
      var inp = root.querySelector('[data-adj="' + c.k + '"]'); if (inp) inp.value = a[c.k];
      var out = root.querySelector('[data-adjout="' + c.k + '"]'); if (out) out.textContent = adjReadout(c, a[c.k]);
    });
    if (refs.adjRot) refs.adjRot.value = a.rot || 0;
    if (refs.adjRotOut) refs.adjRotOut.textContent = (a.rot || 0) + '°';
  }
  function renderAdjust() {
    if (!refs.adjStrip) return;
    refs.adjStrip.innerHTML = (S.photos || []).map(function (u, i) {
      return '<button class="itadjthumb' + (i === S.adjSel ? ' on' : '') + '" data-adjthumb="' + i + '" style="background-image:url(\'' + u + '\');filter:' + filterStr(adjOf(i)) + '"></button>';
    }).join('');
    syncAdjSliders();
  }
  function onAdjThumb(i) {
    if (i === S.adjSel) return;
    _switchPhotoDraw(S.adjSel, i);   // [#9] 그리기는 사진별 — 전환 시 저장/복원(다른 사진에 안 넘어감)
    S.adjSel = i;
    if ((S.layout.kind || 'single') === 'single') { S.photoUrl = S.photos[i]; S.photoCss = 'url("' + S.photos[i] + '")'; refs.photo.style.backgroundImage = S.photoCss; }
    applyAdjToDisplay(); applyStraighten(); renderAdjust();
  }
  // [#9] 편집기 안에서 사진을 바꿀 때 그리기(캔버스)를 사진별로 보관·복원 — 한 사진에 그린 게 다른 사진에 안 뜨게.
  function _switchPhotoDraw(oldIdx, newIdx) {
    if (oldIdx === newIdx || !refs.ctx || !refs.draw) return;
    if (!S.photoDraw) S.photoDraw = {};
    var c = refs.ctx;
    try { S.photoDraw[oldIdx] = refs.draw.toDataURL(); } catch (_e) { void _e; }
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, refs.draw.width, refs.draw.height); c.restore();
    var saved = S.photoDraw[newIdx];
    if (saved) { var im = new Image(); im.onload = function () { try { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(im, 0, 0); c.restore(); } catch (_e2) { void _e2; } }; im.src = saved; }
  }
  // [#5/#6] 사진별 텍스트/스티커 분리 — 단일모드에서 장 전환 시 현재 레이어를 그 장에 보관하고, 넘어간 장의 레이어를 복원.
  //   좌우(사진 스트립)로 넘기며 각 사진에 다른 글/스티커/링크를 얹을 수 있다(인스타 캐러셀 장별 편집).
  function _switchPhotoLayers(oldIdx, newIdx) {
    if (oldIdx === newIdx) return;
    if (!S.layersByPhoto) S.layersByPhoto = {};
    S.layersByPhoto[oldIdx] = (S.layers || []).map(_serLayer).filter(Boolean);   // 현재 장 레이어 직렬화 보관
    S.layers.slice().forEach(function (L) { try { if (L.el && L.el.remove) L.el.remove(); } catch (_e) { void _e; } });
    S.layers = []; S.active = null; S.undo = []; S.redo = [];
    var saved = S.layersByPhoto[newIdx];
    if (saved && saved.length) _restoreLayers(saved);   // 넘어간 장 레이어 복원
  }
  // [#4] 배경 선호(색/이미지) 기억 — 다음에도 같은 배경.
  function loadBgPref() { try { return JSON.parse(localStorage.getItem('itdasy:itd_bg') || '{}'); } catch (_) { return {}; } }
  function saveBgPref() { try { localStorage.setItem('itdasy:itd_bg', JSON.stringify({ color: S.collageBg, img: S.collageBgImg || null })); } catch (_) { void _; } }
  // [누끼] 사진 배경 제거 → '고른 배경'(색/이미지)으로 합성. 매트(removedBg)를 캐시해 다음 배경 변경은 0초(API 0).
  function doCutout(idx, silent) {
    if (!(window.PhotoEditorBgCompose && window.PhotoEditorBgCompose.compose)) { if (!silent) toastIt('배경 제거 모듈을 불러오지 못했어요'); return; }
    var i = (idx != null ? idx : S.adjSel);
    if (!S.origPhotos) S.origPhotos = []; if (S.origPhotos[i] == null) S.origPhotos[i] = S.photos[i];   // 원본 1회 보관
    var src = S.origPhotos[i]; if (!src) return;
    S.matte = S.matte || {}; S.cutSet = S.cutSet || {};
    var cached = S.matte[i] || null;   // 매트 있으면 누끼 재요청 없이 배경만 다시 입힘(빠름)
    if (!silent && refs.adjCut) { refs.adjCut.disabled = true; refs.adjCut.classList.add('is-busy'); }
    if (!silent) toastIt(cached ? '배경 입히는 중…' : '배경 지우는 중…');
    // [#8] 누끼 배경은 사진별 — S.photoBg[i] 우선(없으면 흰색). 한 사진 배경 바꿔도 다른 사진 안 바뀜.
    S.photoBg = S.photoBg || {};
    var _pb = S.photoBg[i];
    var bg = _pb ? (_pb.img ? { imageData: _pb.img } : { color: _pb.color || '#FFFFFF' }) : { color: '#FFFFFF' };
    var _sess = S;   // [audit] 세션 스냅샷 — 누끼 대기 중 back으로 닫고 재진입하면 옛 결과가 새 세션 사진을 덮던 버그 방지.
    window.PhotoEditorBgCompose.compose({ srcUrl: src, bg: bg, targetRatio: '4:5', preRemovedBgUrl: cached }).then(function (r) {
      if (S !== _sess || !root.classList.contains('is-open')) return;   // 편집기 닫혔거나 다른 세션 → 무시(유령 반영 방지)
      if (!silent && refs.adjCut) { refs.adjCut.disabled = false; refs.adjCut.classList.remove('is-busy'); }
      if (!r || !r.composedDataUrl) { if (!silent) toastIt('배경 제거에 실패했어요'); return; }
      if (r.removedBgDataUrl) S.matte[i] = r.removedBgDataUrl;   // 매트 캐시
      S.cutSet[i] = true;
      S.photos[i] = r.composedDataUrl;
      // [#1] 누끼 대기 중 장을 바꿔도 어긋나지 않게 — 완료 시 '지금 보고 있는 장'을 항상 최신 S.photos 로 반영.
      //   (예전엔 누끼 시작 시점의 장이 그대로 표시 중일 때만 갱신해서, 대기 중 전환하면 사진이 안 바뀌어 보였음)
      if (isSingleL(S.layout)) {
        var _curU = S.photos[S.adjSel];
        if (_curU) { S.photoUrl = _curU; S.photoCss = 'url("' + _curU + '")'; refs.photo.style.backgroundImage = S.photoCss; }
      }
      renderAdjust(); renderLayoutStrip(); renderCollage(); applyAdjToDisplay(); applyPhotoTransform();   // [#7] 누끼 후에도 수평(회전) 유지·반영
      if (!silent) toastIt('배경을 정리했어요');
    }).catch(function (e) {
      if (S !== _sess || !root.classList.contains('is-open')) return;   // 닫힌/다른 세션 → 무시
      if (!silent && refs.adjCut) { refs.adjCut.disabled = false; refs.adjCut.classList.remove('is-busy'); }
      // [#2] 실패 사유를 사람말로 — 한도(429)·로그인·네트워크 구분(무엇이 막혔는지 보이게).
      var msg = String((e && e.message) || e || '');
      var human = /한도|429/.test(msg) ? msg
        : /401|auth|로그인/.test(msg) ? '로그인이 필요해요(누끼는 서버 처리예요)'
        : '배경 제거에 실패했어요 — 네트워크/한도를 확인해 주세요';
      if (!silent) toastIt(human);
    });
  }
  // 배경(색/이미지) 바뀌면 이미 누끼한 사진들을 캐시 매트로 즉시 재합성(0초).
  // [#8] 배경 바꾸면 '현재 사진'만 재합성(0초, 매트캐시). 예전엔 누끼한 모든 사진을 다 바꿔 '전체 배경 변경'이었음.
  function recutWithBg() { if (S.cutSet && S.cutSet[S.adjSel]) doCutout(S.adjSel, true); }
  // [#2] 배경(색/사진) 바꾸면 적용 — 이미 누끼면 0초 교체, 아직 안 했으면 지금 누끼하며 배경 적용(눈에 보이게).
  function applyBgChange() {
    if (S.cutSet && S.cutSet[S.adjSel]) recutWithBg();
    else doCutout(S.adjSel);   // 처음 배경 고르면 자동 누끼로 반영(예전엔 아무 일도 안 나 '적용 안 됨')
  }
  function undoCutout() {
    var i = S.adjSel; if (!(S.origPhotos && S.origPhotos[i] != null)) { toastIt('되돌릴 원본이 없어요'); return; }
    var wasShown = (S.photoUrl === S.photos[i]); var orig = S.origPhotos[i];
    S.photos[i] = orig; if (S.cutSet) S.cutSet[i] = false;
    if (wasShown) { S.photoUrl = orig; S.photoCss = 'url("' + orig + '")'; refs.photo.style.backgroundImage = S.photoCss; }
    renderAdjust(); renderLayoutStrip(); renderCollage(); applyAdjToDisplay();
    toastIt('원본으로 되돌렸어요');
  }
  function toastIt(m) { try { (window.showToast || function () {})(m); } catch (_) { void _; } }
  function addPhotoFromFile(file) {
    if (!file || !/^image\//.test(file.type)) return;
    var rd = new FileReader();
    rd.onload = function () {
      S.photos.push(rd.result); S.adj.push(defAdj());
      renderLayoutStrip(); renderAdjust();
    };
    rd.readAsDataURL(file);
  }
  // [#4] 배경 사진 업로드 — 축소 저장 → 콜라주/누끼 배경으로 + 기억(persist).
  function addBgImageFromFile(file) {
    if (!file || !/^image\//.test(file.type)) return;
    var rd = new FileReader();
    rd.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 900, sc = Math.min(1, max / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * sc)), h = Math.max(1, Math.round(img.height * sc));
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(img, 0, 0, w, h);
        var _u; try { _u = cv.toDataURL('image/jpeg', 0.85); } catch (_) { _u = rd.result; }
        S.photoBg = S.photoBg || {}; S.photoBg[S.adjSel] = { img: _u };   // [#8] 현재 사진 배경만
        try { localStorage.setItem('itdasy:itd_bgimg', _u); } catch (_e3) { void _e3; }   // [#2] 다음에도 재사용
        if (refs.adjCutBg) { var rb = refs.adjCutBg.querySelector('[data-cutbgimg]'); if (rb) rb.style.backgroundImage = 'url(\'' + _u + '\')'; }
        renderCollage(); applyFit(); applyBgChange(); toastIt('배경 사진을 적용했어요');   // [#2] 처음이면 자동 누끼로 바로 반영
      };
      img.onerror = function () { S.collageBgImg = rd.result; saveBgPref(); renderCollage(); applyFit(); };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
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
    // [#5] 네온 — 진한 색 글로우(강한 shadowBlur)로 빛나는 느낌. 코어는 얇게 두고 글로우가 번지게.
    else if (S.brush === 'neon') { c.shadowBlur = Math.max(16, S.brushSize * 1.6); c.shadowColor = S.drawColor; c.lineWidth = Math.max(3, S.brushSize * 0.7); c.lineCap = 'round'; c.lineJoin = 'round'; }
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
  function containRect(im, w, h) { var sc = Math.min(w / im.width, h / im.height); return { dw: im.width * sc, dh: im.height * sc }; }
  function fitRect(im, w, h) { return (S.fitMode === 'contain') ? containRect(im, w, h) : coverRect(im, w, h); }
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
    var baseDone;
    if (isSingleL(S.layout)) {
      var sIdx = S.photos.indexOf(S.photoUrl);
      var sDeg = (adjOf(sIdx < 0 ? 0 : sIdx).rot) || 0, sCs = sDeg ? coverScaleForRot(sDeg) : 1;
      if (S.fitMode === 'contain') { c.fillStyle = S.collageBg || '#fff'; c.fillRect(0, 0, r.width, r.height); }   // [#5] 전체 모드 여백 배경
      baseDone = loadImg(S.photoUrl).then(function (img) {
        if (!img) return; var cr = fitRect(img, r.width, r.height);
        c.save();
        c.translate(S.pz.tx, S.pz.ty); c.translate(r.width / 2, r.height / 2);
        c.scale(S.pz.scale * sCs, S.pz.scale * sCs); c.rotate(sDeg * Math.PI / 180); c.translate(-r.width / 2, -r.height / 2);
        c.filter = filterStr(adjOf(sIdx < 0 ? 0 : sIdx));
        c.drawImage(img, (r.width - cr.dw) / 2, (r.height - cr.dh) / 2, cr.dw, cr.dh);
        c.restore();
      });
    } else {
      // [SSOT] 화면 renderCollage 와 동일한 셀 좌표로 내보내기 → WYSIWYG.
      var cellsSpec = _layCells(), gap = S.collageGap != null ? S.collageGap : 3;
      c.fillStyle = S.collageBg || '#fff'; c.fillRect(0, 0, r.width, r.height);   // 간격 사이 배경색
      var idxs = []; for (var k = 0; k < cellsSpec.length; k++) { var oi = S.layoutOrder[k]; idxs.push((oi != null && S.photos[oi] != null) ? oi : (S.photos[k] != null ? k : 0)); }
      var urls = idxs.map(function (i) { return S.photos[i] || S.photoUrl; });
      baseDone = Promise.all(urls.map(loadImg)).then(function (imgs) {
        imgs.forEach(function (img, k) {
          if (!img) return;
          var cc = cellsSpec[k];
          var x = cc[0] * r.width + gap / 2, y = cc[1] * r.height + gap / 2, w = cc[2] * r.width - gap, h = cc[3] * r.height - gap;
          var cr = fitRect(img, w, h);
          c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
          c.filter = filterStr(adjOf(idxs[k]));
          var cp = (S.cellCrop && S.cellCrop[k]) || { s: 1, tx: 0, ty: 0 };   // [셀 크롭] 재구도 반영(중심 기준 scale+translate)
          if (cp.s !== 1 || cp.tx || cp.ty) { var ccx = x + w / 2, ccy = y + h / 2; c.translate(ccx + cp.tx, ccy + cp.ty); c.scale(cp.s, cp.s); c.translate(-ccx, -ccy); }
          // [#2] 셀별 수평보정(rot) — 각 칸 중심 기준 회전 + cover 보정(모서리 빈틈 방지).
          var rdeg = (adjOf(idxs[k]).rot) || 0;
          if (rdeg) { var rcx = x + w / 2, rcy = y + h / 2, rsc = coverScaleForRot(rdeg); c.translate(rcx, rcy); c.rotate(rdeg * Math.PI / 180); c.scale(rsc, rsc); c.translate(-rcx, -rcy); }
          c.drawImage(img, x + (w - cr.dw) / 2, y + (h - cr.dh) / 2, cr.dw, cr.dh); c.restore();
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
    refs.rail.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tool]'); if (!b) return;
      var tool = b.getAttribute('data-tool');
      // [보스#8] Aa 버튼은 항상 새 텍스트 생성(인스타식). 이미 텍스트가 선택돼 있어도 새로 추가.
      //   addText()가 새 텍스트를 active로 만들므로 뒤이은 setTool('text')의 자동생성(L362)은 건너뜀 → 정확히 1개.
      if (tool === 'text') addText();
      setTool(tool);
    });
    refs.stage.addEventListener('pointerdown', function (e) { if (e.target === refs.stage || e.target === refs.photo || e.target.classList.contains('itded__scrim')) selectLayer(null); });
    // 텍스트 컨트롤
    refs.fonts.addEventListener('click', function (e) { var b = e.target.closest('[data-font]'); if (!b) return; applyFont(b.getAttribute('data-font')); root.querySelectorAll('[data-font]').forEach(function (x) { x.classList.toggle('on', x === b); }); });
    refs.colors.addEventListener('click', function (e) { var b = e.target.closest('[data-color]'); if (!b) return; applyColor(b.getAttribute('data-color')); root.querySelectorAll('[data-color]').forEach(function (x) { x.classList.toggle('on', x === b); }); });
    refs.aln.addEventListener('click', function (e) { var b = e.target.closest('[data-aln]'); if (!b) return; applyAlign(b.getAttribute('data-aln')); refs.aln.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); });
    refs.size.addEventListener('input', function () { applyScale(refs.size.value); });
    // [#5] 스티커 — 카테고리 탭 전환 + 이모지/글자스티커/SVG/우리샵칩/데코/내 스티커 → 레이어로 추가
    refs.stkSheet.addEventListener('click', function (e) {
      var tab = e.target.closest('[data-sttab]'); if (tab) { refs.stkTabs.querySelectorAll('[data-sttab]').forEach(function (x) { x.classList.toggle('on', x === tab); }); _renderStkTab(tab.getAttribute('data-sttab')); return; }
      var del = e.target.closest('[data-minedel]'); if (del) { e.stopPropagation(); delMyStk(+del.getAttribute('data-minedel')); return; }
      var mine = e.target.closest('[data-mine]'); if (mine) { var arr = loadMyStk(); var u = arr[+mine.getAttribute('data-mine')]; if (u) addImageSticker(u); return; }
      var sc = e.target.closest('[data-stkcat]'); if (sc) { var cat = sc.getAttribute('data-stkcat'); var list = (window.ItdStickers || {})[cat + 'Svg'] || []; var su = list[+sc.getAttribute('data-stkidx')]; if (su) addImageSticker(su); return; }
      var dc = e.target.closest('[data-deco]'); if (dc) { addImageSticker(DECO[+dc.getAttribute('data-deco')]); return; }
      var tx = e.target.closest('[data-txtstk]'); if (tx) { var o = ((window.ItdStickers || {}).textStk || [])[+tx.getAttribute('data-txtstk')]; if (o) addTextSticker(o.t, o.f); return; }
      var f = e.target.closest('[data-feat]'); if (f) { addFeatureLayer(f.getAttribute('data-feat')); return; }
      var b = e.target.closest('[data-stk]'); if (b) addSticker(b.getAttribute('data-stk'));
    });
    enableDragScroll(refs.stkTabs);   // [#5] 탭 줄 가로 드래그
    // [#8] 도형 패널 — 도형 탭=삽입, 채움 토글, 굵기, 색
    refs.panels.shape.addEventListener('click', function (e) {
      var sh = e.target.closest('[data-shape]'); if (sh) { addShape(sh.getAttribute('data-shape')); return; }
      var fl = e.target.closest('[data-shapefill]'); if (fl) { S.shapeFill = fl.getAttribute('data-shapefill') === '1'; refs.panels.shape.querySelectorAll('[data-shapefill]').forEach(function (x) { x.classList.toggle('on', x === fl); }); applyShapeStyle(); return; }
      var sc = e.target.closest('[data-scolor]'); if (sc) { S.shapeColor = sc.getAttribute('data-scolor'); refs.panels.shape.querySelectorAll('[data-scolor]').forEach(function (x) { x.classList.toggle('on', x === sc); }); applyShapeStyle(); return; }
    });
    refs.shapeThick.addEventListener('input', function () { S.shapeThick = +refs.shapeThick.value; applyShapeStyle(); });
    // [#3] 스티커 시트 그립은 이제 data-pgrip → 아래 _attachSheetSwipe 가 일괄 처리(다른 패널과 동일하게 스와이프-닫기).
    // [#7] 각 도구패널 상단 grip 아래로 긁으면 닫기(스티커 포함)
    root.querySelectorAll('[data-pgrip]').forEach(function (g) { _attachSheetSwipe(g); });
    // [①] 가로 스크롤 줄 드래그 스와이프(폰트/색/칩)
    enableDragScroll(refs.fonts); enableDragScroll(refs.colors);
    enableDragScroll(refs.panels.shape.querySelector('.itshape__row'));
    enableDragScroll(refs.panels.shape.querySelector('.itshape__colors'));
    // 레이아웃 — 타입 칩 선택 + 렌더된 사진 순서 탭 + 배경색
    refs.panels.layout.addEventListener('click', function (e) {
      var t = e.target.closest('[data-lay]'); if (t) { selectLayout(+t.getAttribute('data-lay')); return; }
      var th = e.target.closest('[data-laythumb]'); if (th) { onLayThumb(+th.getAttribute('data-laythumb')); return; }
      var bg = e.target.closest('[data-bg]'); if (bg) { S.collageBg = bg.getAttribute('data-bg'); S.collageBgImg = null; saveBgPref(); refs.panels.layout.querySelectorAll('[data-bg]').forEach(function (x) { x.classList.toggle('on', x === bg); }); renderCollage(); applyFit(); recutWithBg(); return; }
      var ft = e.target.closest('[data-fit]'); if (ft) { S.fitMode = ft.getAttribute('data-fit'); S._fitManual = true; refs.layFit.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === ft); }); applyFit(); return; }
    });
    enableDragScroll(refs.layStrip); enableDragScroll(refs.panels.layout.querySelector('.itlay2__types'));
    refs.layGap.addEventListener('input', function () { S.collageGap = +refs.layGap.value; renderCollage(); });
    refs.layAdd.addEventListener('change', function () { var fl = refs.layAdd.files && refs.layAdd.files[0]; if (fl) addPhotoFromFile(fl); refs.layAdd.value = ''; });
    if (refs.layBgImg) refs.layBgImg.addEventListener('change', function () { var fl = refs.layBgImg.files && refs.layBgImg.files[0]; if (fl) addBgImageFromFile(fl); refs.layBgImg.value = ''; });
    // [셀 크롭] 콜라주 칸 드래그/핀치 재구도(레이아웃 도구에서만 포인터 활성)
    refs.collage.addEventListener('pointerdown', onCellDown);
    document.addEventListener('pointermove', onCellMove);
    document.addEventListener('pointerup', onCellUp);
    // 보정 — 사진 선택 + 슬라이더(선택 사진만) + 초기화
    refs.panels.adjust.addEventListener('click', function (e) { var t = e.target.closest('[data-adjthumb]'); if (t) onAdjThumb(+t.getAttribute('data-adjthumb')); });
    refs.panels.adjust.addEventListener('input', function (e) {
      var s = e.target.closest('[data-adj]'); if (!s) return; var k = s.getAttribute('data-adj'); adjOf(S.adjSel)[k] = +s.value;
      var c0 = ADJ_CTRLS.filter(function (x) { return x.k === k; })[0]; var out = root.querySelector('[data-adjout="' + k + '"]'); if (out) out.textContent = adjReadout(c0, +s.value);
      applyAdjThrottled(); var th = refs.adjStrip && refs.adjStrip.querySelector('[data-adjthumb="' + S.adjSel + '"]'); if (th) th.style.filter = filterStr(adjOf(S.adjSel));
    });
    // [#3] 수평 슬라이더 — 가이드 그리드 표시 + 사진 회전
    if (refs.adjRot) refs.adjRot.addEventListener('input', function () {
      var rv = +refs.adjRot.value; if (Math.abs(rv) < 1.5) { rv = 0; refs.adjRot.value = 0; }   // [#2] 0° 근처면 수평으로 잠금
      adjOf(S.adjSel).rot = rv; if (refs.adjRotOut) refs.adjRotOut.textContent = rv.toFixed(1).replace(/\.0$/, '') + '°';
      root.classList.add('is-leveling'); clearTimeout(S._lvlT); S._lvlT = setTimeout(function () { root.classList.remove('is-leveling'); }, 900);
      applyStraighten();
    });
    refs.adjReset.addEventListener('click', function () { S.adj[S.adjSel] = defAdj(); syncAdjSliders(); applyAdjToDisplay(); applyStraighten(); renderAdjust(); });
    if (refs.adjCut) refs.adjCut.addEventListener('click', function () { doCutout(); });
    if (refs.adjUncut) refs.adjUncut.addEventListener('click', undoCutout);
    // [#4] 누끼 배경 색 — 탭하면 즉시 재합성(매트 캐시 있으면 0초). 누끼 전이면 배경만 기억.
    if (refs.adjCutBg) refs.adjCutBg.addEventListener('click', function (e) {
      var rbtn = e.target.closest('[data-cutbgimg]');   // [#2] 최근 배경 사진 재사용(원탭)
      if (rbtn) {
        var rb = ''; try { rb = localStorage.getItem('itdasy:itd_bgimg') || ''; } catch (_e) { rb = ''; }
        if (!rb) { toastIt('저장된 배경 사진이 없어요'); return; }
        S.photoBg = S.photoBg || {}; S.photoBg[S.adjSel] = { img: rb };
        refs.adjCutBg.querySelectorAll('[data-cutbg],[data-cutbgimg]').forEach(function (x) { x.classList.toggle('on', x === rbtn); });
        applyFit(); applyBgChange(); toastIt('저장한 배경을 적용했어요'); return;
      }
      var b = e.target.closest('[data-cutbg]'); if (!b) return;
      S.photoBg = S.photoBg || {}; S.photoBg[S.adjSel] = { color: b.getAttribute('data-cutbg'), img: null };   // [#8] 현재 사진 배경만
      refs.adjCutBg.querySelectorAll('[data-cutbg],[data-cutbgimg]').forEach(function (x) { x.classList.toggle('on', x === b); });
      applyFit(); applyBgChange();   // [#2] 처음이면 자동 누끼로 반영
    });
    if (refs.adjBgImg) refs.adjBgImg.addEventListener('change', function () { var fl = refs.adjBgImg.files && refs.adjBgImg.files[0]; if (fl) addBgImageFromFile(fl); refs.adjBgImg.value = ''; });
    enableDragScroll(refs.adjStrip);
    // 그리기
    root.querySelector('[data-panel="draw"] .itdrawp__tools').addEventListener('click', function (e) {
      if (e.target.closest('[data-r="drawClear"]')) { if (refs.ctx && refs.draw) { refs.ctx.clearRect(0, 0, refs.draw.width, refs.draw.height); toastIt('그림을 지웠어요'); } return; }   // [#6] 그리기 전체 지우기
      var b = e.target.closest('[data-brush]'); if (!b) return; S.brush = b.getAttribute('data-brush'); root.querySelectorAll('[data-brush]').forEach(function (x) { x.classList.toggle('on', x === b); });
    });
    refs.brushSize.addEventListener('input', function () { S.brushSize = +refs.brushSize.value; });
    root.querySelector('[data-panel="draw"] .itdrawp__colors').addEventListener('click', function (e) { var b = e.target.closest('[data-dcolor]'); if (!b) return; S.drawColor = b.getAttribute('data-dcolor'); root.querySelectorAll('[data-dcolor]').forEach(function (x) { x.classList.toggle('on', x === b); }); });
    refs.draw.addEventListener('pointerdown', drawDown);
    refs.draw.addEventListener('pointermove', drawMove);
    refs.draw.addEventListener('pointerup', drawUp);
    // 사진 핀치 확대/이동
    refs.stage.addEventListener('pointerdown', stageDown);
    refs.stage.addEventListener('pointermove', stageMove);
    refs.stage.addEventListener('pointerup', stageUp);
    refs.stage.addEventListener('pointercancel', stageUp);
    // 닫기/완료
    refs.cancel.addEventListener('click', function () { if (S) S._cancelled = true; close(); if (S && S.onCancel) S.onCancel(); });
    if (refs.undo) refs.undo.addEventListener('click', function () { _undo(); });   // [P1-3]
    if (refs.redo) refs.redo.addEventListener('click', function () { _redo(); });
    if (refs.peek) refs.peek.addEventListener('click', function () { togglePeek(); });   // [P2-2]
    if (refs.addText) refs.addText.addEventListener('click', function () { addText(); });   // [#4] 글자 추가(항상 새 텍스트)
    refs.done.addEventListener('click', function () {
      if (S._saving) return;   // [audit] 완료 더블탭 방지(저장 중 재클릭 무시)
      S._saving = true;
      var cb = S.onDone, _sess = S; refs.done.textContent = '저장 중…'; refs.done.disabled = true;
      exportComposite(function (url) {
        if (S !== _sess || _sess._cancelled) { _sess._saving = false; return; }   // [audit] 저장 중 back/취소로 닫혔거나 재진입 → onDone 이중발화 안 함
        var meta = { layers: metaLayers(), editState: _exportState() };   // [학습] close() 전에 좌표 계산(닫으면 stage rect=0 → NaN). editState=재편집 이어가기(#4/#8/#11/#16)
        meta.perPhoto = _collectPerPhoto();   // [#5/#6] 사진별 레이어(단일모드) — 플로우가 각 장을 자기 레이어로 합성
        S._saving = false;
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

  // [#4/#8/#11/#16] 재편집 이어가기 — 편집기 '전체 상태'를 직렬화/복원.
  //   metaLayers 는 '우리샵 학습'용이라 도형·스티커를 버린다. 재편집은 전부 보존해야 하므로 별도 직렬화.
  function _serLayer(L) {
    var R = refs.stage.getBoundingClientRect(); if (!R.width) return null;
    var b = L.el.getBoundingClientRect();
    var base = { x: (b.left - R.left + b.width / 2) / R.width, y: (b.top - R.top + b.height / 2) / R.height,
      w: b.width / R.width, rot: L.rot || 0, scale: L.scale || 1, role: L.role || '' };
    if (L.type === 'sticker') { base.type = 'sticker'; base.emoji = L.emoji; base.size = ((L.fontSize || 64) * (L.scale || 1)) / R.height; return base; }
    if (L.type === 'image') { base.type = 'image'; base.src = L.src; return base; }
    if (L.type === 'shape') {
      base.color = L.color; base.h = b.height / R.height;
      if (L.shape === 'line') { base.type = 'line'; base.size = (L.strokeW || 3) / R.height; }
      else { base.type = 'rect'; base.shape = L.shape; }
      return base;
    }
    var fs = ((L.fontSize || 30) * (L.scale || 1)) / R.height;
    base.type = (L.type === 'badge') ? 'badge' : 'text';
    base.text = L.text; base.font = L.font && L.font.key; base.color = L.color; base.align = L.align;
    base.size = fs; base.weight = L.font && L.font.weight; base.stroke = !!L.stroke; base.shadow = !!L.shadow;
    return base;
  }
  // [#5/#6] 사진별 레이어 수집 — 단일모드에서 각 장(현재 장 포함)이 가진 텍스트/스티커 레이어를 { idx, photoUrl, layers } 로.
  //   플로우가 이걸로 각 장을 자기 레이어와 합성해 캐러셀 장별로 다른 글/스티커가 실제 게시되게 한다.
  function _collectPerPhoto() {
    try {
      if (!isSingleL(S.layout)) return null;   // 콜라주는 한 장 합성(장별 아님)
      if (!S.layersByPhoto) S.layersByPhoto = {};
      S.layersByPhoto[S.adjSel] = (S.layers || []).map(_serLayer).filter(Boolean);   // 현재 장도 포함
      var out = [];
      (S.photos || []).forEach(function (u, i) {
        var ls = S.layersByPhoto[i];
        if (ls && ls.length) out.push({ idx: i, photoUrl: u, layers: ls });
      });
      return out.length ? out : null;
    } catch (_e) { return null; }
  }
  function _exportState() {
    try {
      return { v: 1, layoutIdx: LAYOUTS.indexOf(S.layout), layoutOrder: (S.layoutOrder || []).slice(),
        cellCrop: (S.cellCrop || []).slice(), collageBg: S.collageBg, collageBgImg: S.collageBgImg || null,
        collageGap: S.collageGap, fitMode: S.fitMode, ratio: S.ratio,
        adj: (S.adj || []).map(function (a) { return Object.assign({}, a); }),
        photoDraw: Object.assign({}, S.photoDraw), photoBg: Object.assign({}, S.photoBg),
        photos: (S.photos || []).slice(), layers: (S.layers || []).map(_serLayer).filter(Boolean) };
    } catch (_e) { return null; }
  }
  // editState 를 S 에 반영(open 안에서 S 생성 직후 호출) + 레이어 복원.
  function _restoreState(st) {
    if (!st) return;
    if (st.layoutIdx != null && LAYOUTS[st.layoutIdx]) S.layout = LAYOUTS[st.layoutIdx];
    if (Array.isArray(st.layoutOrder)) S.layoutOrder = st.layoutOrder.slice();
    if (Array.isArray(st.cellCrop)) S.cellCrop = st.cellCrop.slice();
    if (st.collageBg) S.collageBg = st.collageBg;
    if (st.collageBgImg) S.collageBgImg = st.collageBgImg;
    if (st.collageGap != null) S.collageGap = st.collageGap;
    if (st.fitMode) S.fitMode = st.fitMode;
    if (Array.isArray(st.adj) && st.adj.length) S.adj = st.adj.map(function (a) { return Object.assign(defAdj(), a); });
    if (st.photoDraw) S.photoDraw = Object.assign({}, st.photoDraw);
    if (st.photoBg) S.photoBg = Object.assign({}, st.photoBg);
    if (Array.isArray(st.photos) && st.photos.length) { S.photos = st.photos.slice(); S.photoUrl = S.photos[0]; S.photoCss = 'url("' + S.photos[0] + '")'; }
  }
  // stage 크기 — 레이아웃 flush 전(rect=0)엔 fitStageToRatio 가 박아둔 explicit px 로 폴백.
  function _stageWH() {
    var r = refs.stage.getBoundingClientRect();
    var w = r.width || parseFloat(refs.stage.style.width) || refs.stage.offsetWidth || 0;
    var h = r.height || parseFloat(refs.stage.style.height) || refs.stage.offsetHeight || 0;
    return { width: w, height: h, left: r.left, top: r.top };
  }
  function _restoreLayers(specs) {
    var R = _stageWH(); if (!R.width) return;
    (specs || []).forEach(function (spec) {
      try { var L2 = addShopLayer(spec, R); if (L2 && spec.rot) { L2.rot = spec.rot; applyXf(L2); } } catch (_e) { void _e; }
    });
    S.active = null; S.layers.forEach(function (x) { x.el.classList.remove('is-active'); });
  }

  function open(opts) {
    opts = opts || {};
    if (!root) build();
    var photo = opts.photo || opts.photoUrl || '';   // StoryEditor 계약(photoUrl) 호환
    var photos = (opts.photos && opts.photos.length) ? opts.photos.slice() : [photo];
    S = { layers: [], active: null, tool: 'text', layout: LAYOUTS[0], layoutOrder: [],
      brush: 'pen', brushSize: 10, drawColor: COLORS[2],
      shapeColor: COLORS[2], shapeFill: false, shapeThick: 6,
      adj: photos.map(function () { return defAdj(); }), adjSel: 0, collageGap: 3,
      collageBg: (loadBgPref().color || '#FFFFFF'), collageBgImg: null, cellCrop: [], cellSel: -1, fitMode: 'contain',   // [#5] 배경색만 기억, 배경'이미지'는 매번 초기화(예전 stale 배경이 누끼에 자동적용되던 문제)
      ratio: (opts.ratio || '4:5'), undo: [], redo: [], photoDraw: {}, photoBg: {}, layersByPhoto: {},   // [#5/#6] 사진별 레이어 보관
      photoUrl: photo, photoCss: 'url("' + photo + '")', photos: photos,
      shopName: (opts.shopName || '').trim(),
      pz: { scale: 1, tx: 0, ty: 0 }, incoming: (opts.layers || []),
      onDone: opts.onDone, onCancel: opts.onCancel };
    var _ed = (opts.editState && opts.editState.v) ? opts.editState : null;   // [#4/#8/#11/#16] 재편집 이어가기
    if (_ed) { try { _restoreState(_ed); } catch (_re) { _ed = null; } }   // 복원 실패 시 일반 열기로 폴백(앱 안전)
    if (refs.featLocTx) refs.featLocTx.textContent = S.shopName || '우리샵';   // [③] 위치 칩에 실제 샵 이름
    refs.layers.innerHTML = ''; refs.frame.className = 'itded__frame';
    refs.photo.style.backgroundImage = S.photoCss; refs.photo.style.filter = ''; refs.photo.style.backgroundSize = 'cover'; refs.photo.style.backgroundColor = 'transparent';
    refs.collage.hidden = true; refs.collage.innerHTML = '';
    refs.photowrap.style.transform = '';
    root.classList.add('is-open');
    // [#9] 시스템 back 으로 편집기가 '먼저' 닫히게 — history 엔트리 1개 push + flow 가 단계 pop 안 하도록 __seOpen 플래그.
    try {
      window.__seOpen = true;
      S._popHandler = function () {
        if (!root || !root.classList.contains('is-open')) return;
        S._histPushed = false; S._cancelled = true;   // [audit] 저장(export) 진행 중 back → onDone 이중발화 차단
        window.__seSwallowPop = true; setTimeout(function () { window.__seSwallowPop = false; }, 0);
        _teardownBack(true); root.classList.remove('is-open');
        if (S && S.onCancel) S.onCancel();   // 시스템 back = 취소로 닫기
      };
      window.addEventListener('popstate', S._popHandler);
      history.pushState({ itded: 1 }, ''); S._histPushed = true;
    } catch (_e) { void _e; }
    // 우리샵 자동배치 텍스트/로고/워터마크를 먼저 올린 뒤 도구 표시(기본 빈 텍스트 자동생성 방지).
    fitStageToRatio();   // [#2] 스테이지를 게시물 비율로 고정(미리보기=편집기 일치)
    refs.photo.style.backgroundSize = S.fitMode; refs.photo.style.backgroundColor = (S.fitMode === 'contain' ? (S.collageBg || '#fff') : 'transparent');
    // [#4/#8/#11/#16] 저장된 편집 이어가기 — 레이아웃/콜라주/레이어 즉시 복원(동기: fitStageToRatio 가 이미 stage 크기 확정).
    if (_ed) { try { _applyRestore(_ed); } catch (_re2) { void _re2; } }
    requestAnimationFrame(function () {
      initCanvas();
      if (!_ed) renderIncoming(S.incoming);   // 복원 모드가 아니면 우리샵 자동배치 레이어
      else if (!isSingleL(S.layout)) renderCollage();   // 콜라주는 캔버스 초기화 뒤 한 번 더 그려 셀 사진 확실히 반영
      // [#5] 시술내용 텍스트가 이미 올라왔으면 그걸 선택 → setTool('text')이 빈 '내용을 입력하세요'를 덧붙이지 않음.
      var firstText = S.layers.filter(function (L) { return L.type === 'text'; })[0];
      if (firstText) selectLayer(firstText);
      setTool('text');
    });
  }
  // [#4/#8/#11/#16] 복원 렌더 — 레이아웃 버튼/콜라주/레이어 반영(동기 호출 가능).
  function _applyRestore(st) {
    root.querySelectorAll('.itlaytype').forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-lay') === LAYOUTS.indexOf(S.layout)); });
    S._fitManual = true; _syncFitToggle();
    applyPhotoTransform(); if (!isSingleL(S.layout)) renderCollage();
    renderLayoutStrip(); renderLayoutHint();
    _restoreLayers(st.layers);
  }
  function _teardownBack(fromPop) {
    window.__seOpen = false;
    if (S && S._popHandler) { try { window.removeEventListener('popstate', S._popHandler); } catch (_e) { void _e; } S._popHandler = null; }
    if (!fromPop && S && S._histPushed) { S._histPushed = false; window.__seSwallowPop = true; setTimeout(function () { window.__seSwallowPop = false; }, 0); try { history.back(); } catch (_e2) { void _e2; } }
  }
  function close() { if (!root || !root.classList.contains('is-open')) return; _teardownBack(false); root.classList.remove('is-open'); }

  // [#2 단일화] 헤드리스 합성 — 캡션 미리보기를 '편집기와 동일한 렌더러'로 그린다(미리보기=편집기).
  //   화면 밖 고정크기로 렌더 → 폰트/줄바꿈/겹침방지까지 편집기와 100% 동일. 편집 중이면 스킵(상태 충돌 방지).
  // 공유 root/S 를 쓰므로 동시 호출(멀티포토)을 직렬화한다.
  var _composeQ = Promise.resolve();
  function compose(opts) { var run = function () { return _composeOne(opts); }; _composeQ = _composeQ.then(run, run); return _composeQ; }
  function _composeOne(opts) {
    opts = opts || {};
    if (!root) build();
    if (root.classList.contains('is-open')) return Promise.resolve(null);
    var photo = opts.photoUrl || opts.photo || '';
    var photos = (opts.photos && opts.photos.length) ? opts.photos.slice() : [photo];
    var rp = String(opts.ratio || '4:5').split(':'); var rw = +rp[0] || 4, rh = +rp[1] || 5;
    var Wpx = 432, Hpx = Math.round(Wpx * rh / rw);
    S = { layers: [], active: null, tool: null, layout: LAYOUTS[0], layoutOrder: [],
      brush: 'pen', brushSize: 10, drawColor: COLORS[2], shapeColor: COLORS[2], shapeFill: false, shapeThick: 6,
      adj: photos.map(function () { return defAdj(); }), adjSel: 0, collageGap: 3, collageBg: '#FFFFFF', collageBgImg: null, cellCrop: [], cellSel: -1, fitMode: 'contain',
      ratio: (opts.ratio || '4:5'),
      photoUrl: photo, photoCss: 'url("' + photo + '")', photos: photos, shopName: '', pz: { scale: 1, tx: 0, ty: 0 }, incoming: (opts.layers || []) };
    refs.layers.innerHTML = ''; refs.frame.className = 'itded__frame';
    refs.photo.style.backgroundImage = S.photoCss; refs.photo.style.filter = ''; refs.photo.style.backgroundSize = S.fitMode; refs.photo.style.backgroundColor = (S.fitMode === 'contain' ? (S.collageBg || '#fff') : 'transparent');
    refs.collage.hidden = true; refs.collage.innerHTML = ''; refs.photowrap.style.transform = '';
    // display:flex !important + right/bottom:auto — 베이스 .itded{display:none}·inset:0 와의 충돌 방지(off-screen 0크기 방지).
    root.style.cssText = 'display:flex !important;position:fixed;left:-99999px;top:0;right:auto;bottom:auto;width:' + Wpx + 'px;height:' + Hpx + 'px;opacity:0;pointer-events:none;z-index:-1';
    fitStageToRatio();   // [#2] off-screen 스테이지도 같은 비율 박스로(이전 open()이 남긴 inline px 리셋 포함)
    return new Promise(function (res) {
      var done = false;
      var fin = function (url) { if (done) return; done = true; root.style.cssText = ''; res(url); };
      // 폰트 로드를 기다리되 무한대기 방지(최대 500ms). off-screen rAF throttle 회피로 setTimeout 사용.
      var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
      Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 500); })]).then(function () {
        setTimeout(function () {
          try { initCanvas(); renderIncoming(S.incoming); } catch (_e) { void _e; }
          setTimeout(function () { try { exportComposite(fin); } catch (_e2) { fin(null); } }, 40);
        }, 0);
      });
      setTimeout(function () { fin(null); }, 6000);   // 안전망 — 어떤 경우에도 행 방지
    });
  }

  window.ItdEditor = { open: open, close: close, compose: compose, isOpen: function () { return !!(root && root.classList.contains('is-open')); } };
})();
