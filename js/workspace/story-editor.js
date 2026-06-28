/*
 * story-editor.js — 인스타 스토리식 텍스트/스티커 편집기 (자체 완결)  [Phase B-1r]
 *
 * 작업실 전용. 구 PhotoEditor 비의존. 사진 중심 UI:
 *   - 캔버스(사진) 최대화 · 우측 툴바는 사진 위에 떠 있음(검은 여백 최소)
 *   - 하단 속성 패널은 '텍스트/스티커 선택 시에만' 뜨는 컨텍스트 패널(빈 곳 탭=선택 해제)
 *   - 우측 툴바: 텍스트(Aa)/스티커/사진/우리샵 스타일/더보기 (아이콘 중심)
 *   - 스티커 = '우리샵 에셋'(로고·워터마크·예약가능·NEW·BEST·EVENT…) 우선 + 기본 이모지
 *   - AI 자동 배치 완료 배너 + 'AI 다시 배치'(같은 우리샵 스타일 유지, 배치안 빠르게 비교)
 *
 * 레이어 타입: text(편집) | emoji(글리프) | badge(브랜드 배지) | image(로고 등)
 * 진입: window.StoryEditor.open({ photoUrl, layers?, ratio?, autoArranged?, onDone, onCancel })
 *   좌표 x/y/w 는 스테이지 기준 0..1. size 는 짧은 변 대비 비율(0..1).
 * 아이콘: duotone 스타일시트만 로드 → ph-duotone 만 사용.
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

  // [v582] font-family 값은 홑따옴표 — 쌍따옴표는 인라인 style="font-family:..." 속성을 깨뜨림(폰트칩 미적용 버그).
  var FONTS = [
    { v: 'Pretendard', l: 'Pretendard' },
    { v: "'Apple SD Gothic Neo', Pretendard, sans-serif", l: '애플산돌고딕' },
    { v: "'Nanum Myeongjo', serif", l: '나눔명조' },
    { v: "'Gowun Dodum', sans-serif", l: '고운돋움' }
  ];
  // 흰·검 뒤로 빨강부터 스펙트럼 순(통일성). 빨→주→노→초→청록→파→보→핑.
  var COLORS = ['#ffffff', '#000000', '#e7443b', '#f5862e', '#f7c948', '#5aa469', '#2bb6b6', '#3b8fd4', '#7a5cc4', '#e06b9b'];

  // 같은 우리샵 스타일(폰트·색·크기)을 유지한 채 '배치'만 바꾸는 변형안 — 'AI 다시 배치'가 순환.
  var ARRANGE = [
    { name: '중앙', title: { x: 0.5, y: 0.44, w: 0.84, align: 'center' }, sub: { x: 0.5, y: 0.55, w: 0.84, align: 'center' }, body: { x: 0.5, y: 0.65, w: 0.84, align: 'center' } },
    { name: '하단', title: { x: 0.5, y: 0.66, w: 0.84, align: 'center' }, sub: { x: 0.5, y: 0.76, w: 0.84, align: 'center' }, body: { x: 0.5, y: 0.85, w: 0.84, align: 'center' } },
    { name: '상단', title: { x: 0.5, y: 0.13, w: 0.84, align: 'center' }, sub: { x: 0.5, y: 0.23, w: 0.84, align: 'center' }, body: { x: 0.5, y: 0.32, w: 0.84, align: 'center' } },
    { name: '좌하단', title: { x: 0.34, y: 0.66, w: 0.6, align: 'left' }, sub: { x: 0.34, y: 0.75, w: 0.6, align: 'left' }, body: { x: 0.34, y: 0.83, w: 0.6, align: 'left' } }
  ];

  // 우리샵 에셋 스티커 정의 — 브랜드 자산 우선.
  function _brand() { try { return (window.BrandKit && window.BrandKit.get) ? window.BrandKit.get() : {}; } catch (_e) { return {}; } }
  function _assetStickers() {
    var b = _brand();
    var brandColor = b.brand_color || '#D58A95';
    var list = [];
    if ((b.shop_name || '').trim()) list.push({ k: 'logo', label: '로고', type: 'badge', text: b.shop_name.trim(), bg: brandColor, color: '#fff' });
    if ((b.watermark_text || '').trim()) list.push({ k: 'wm', label: '워터마크', type: 'badge', text: b.watermark_text.trim(), bg: 'rgba(0,0,0,.35)', color: '#fff' });
    list.push({ k: 'book', label: '예약가능', type: 'badge', text: '예약가능', bg: '#3fae6a', color: '#fff' });
    list.push({ k: 'new', label: 'NEW', type: 'badge', text: 'NEW', bg: '#1f1f1f', color: '#fff' });
    list.push({ k: 'best', label: 'BEST', type: 'badge', text: 'BEST', bg: brandColor, color: '#fff' });
    list.push({ k: 'event', label: 'EVENT', type: 'badge', text: 'EVENT', bg: '#e0556b', color: '#fff' });
    list.push({ k: 'sale', label: 'SALE', type: 'badge', text: 'SALE', bg: '#e8a23b', color: '#fff' });
    list.push({ k: 'hot', label: 'HOT', type: 'badge', text: 'HOT', bg: '#d6453f', color: '#fff' });
    return list;
  }
  var EMOJIS = ['✨', '❤️', '⭐', '🎉', '👍', '🔥', '💕', '😊', '💎', '🌿'];

  var S = null;

  function open(opts) {
    opts = opts || {};
    _ensureCss();
    var ratio = opts.ratio || (window.ShopStyle && window.ShopStyle.getActive() && window.ShopStyle.getActive().frame.ratio) || '4:5';
    S = {
      photoUrl: opts.photoUrl || '',
      ratio: ratio,
      layers: (opts.layers || []).map(_normLayer),
      selId: null,                 // [B-1r] 처음엔 선택 안 함 → 패널 숨김·캔버스 최대
      onDone: typeof opts.onDone === 'function' ? opts.onDone : null,
      onCancel: typeof opts.onCancel === 'function' ? opts.onCancel : null,
      panelTab: 'font',
      arrangeIdx: 0,
      autoArranged: !!opts.autoArranged,
      undo: [], redo: [], _panelHidden: true
    };
    _mount();
    _snapshot(true);
    return S;
  }

  function _normLayer(l) {
    var type = l.type || 'text';
    return {
      id: l.id || uid(), type: type,
      text: l.text != null ? String(l.text) : (type === 'emoji' ? '✨' : '텍스트'),
      role: l.role || (type === 'text' ? 'body' : type),
      x: l.x != null ? l.x : 0.5, y: l.y != null ? l.y : 0.5, w: l.w != null ? l.w : (type === 'text' ? 0.8 : 0.22),
      size: l.size != null ? l.size : (type === 'emoji' ? 0.12 : type === 'badge' ? 0.05 : 0.06),
      color: l.color || '#ffffff',
      bg: l.bg || null,
      src: l.src || null,
      weight: l.weight != null ? l.weight : 700,
      align: l.align || 'center',
      rot: l.rot || 0,
      lineHeight: l.lineHeight != null ? l.lineHeight : 1.25,
      letterSpacing: l.letterSpacing != null ? l.letterSpacing : 0,
      opacity: l.opacity != null ? l.opacity : 1,
      font: l.font || 'Pretendard',
      shadow: l.shadow !== false && type !== 'badge'
    };
  }

  // ── 마운트 ────────────────────────────────────────────────
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
        '<div class="se-banner" data-se-banner hidden></div>' +
        '<div class="se-tools">' +
          '<button class="se-tool" data-se="addtext" aria-label="텍스트"><span class="se-tool__ic se-tool__aa">Aa</span></button>' +
          '<button class="se-tool" data-se="sticker" aria-label="스티커"><span class="se-tool__ic"><i class="ph-duotone ph-sticker"></i></span></button>' +
          '<button class="se-tool" data-se="addphoto" aria-label="사진"><span class="se-tool__ic"><i class="ph-duotone ph-image"></i></span></button>' +
          '<button class="se-tool" data-se="style" aria-label="우리샵 스타일"><span class="se-tool__ic"><i class="ph-duotone ph-paint-brush-broad"></i></span></button>' +
          '<button class="se-tool" data-se="more" aria-label="더보기"><span class="se-tool__ic"><i class="ph-duotone ph-dots-three"></i></span></button>' +
        '</div>' +
      '</div>' +
      '<div class="se-panel" data-se-panel hidden></div>' +
      '<div class="se-sheet" data-se-sheet hidden></div>' +
      '<input type="file" accept="image/*" data-se-photofile hidden>';
    document.body.appendChild(root);
    S.root = root;
    S.stage = root.querySelector('[data-se-stage]');
    _applyRatio();
    _renderStage();
    _renderPanel();
    _renderBanner();
    _bind();
    try { if (window._registerSheet) window._registerSheet('seOverlay', { close: cancel, isOpen: function () { return !!document.getElementById('seOverlay'); } }); } catch (_e) { void _e; }
  }

  function _applyRatio() {
    S.stage.style.backgroundImage = S.photoUrl ? 'url(' + S.photoUrl + ')' : 'none';
    _fitStageRetry(0);   // [v582] 진입 직후 레이아웃이 아직 0이면 다음 프레임에 재시도 → 검은화면(사진·텍스트 안 뜸) 해소
    if (!S._resizeBound) { S._resizeBound = function () { _fitStage(); _renderStage(); }; window.addEventListener('resize', S._resizeBound); }
  }
  // 스테이지 wrap 의 레이아웃 크기가 잡힐 때까지 재시도. 잡히면 사진(배경)+레이어를 즉시 렌더.
  function _fitStageRetry(n) {
    if (!S || !S.stage) return;
    if (_fitStage()) { _renderStage(); return; }
    if (n < 30) { var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); }; raf(function () { _fitStageRetry(n + 1); }); }
  }
  function _fitStage() {
    var wrap = S.stage.parentElement; if (!wrap) return false;
    var aw = wrap.clientWidth, ah = wrap.clientHeight;
    if (!aw || !ah) return false;
    var parts = String(S.ratio).split(':'); var rw = +parts[0] || 4, rh = +parts[1] || 5;
    var w = aw, h = w * rh / rw;
    if (h > ah) { h = ah; w = h * rw / rh; }
    S.stage.style.width = Math.floor(w) + 'px';
    S.stage.style.height = Math.floor(h) + 'px';
    return true;
  }

  function _renderStage() {
    [].slice.call(S.stage.querySelectorAll('.se-layer')).forEach(function (n) { n.remove(); });
    S.layers.forEach(function (l) { S.stage.appendChild(_layerEl(l)); });
  }

  // [stability] 드래그·핀치·회전 중 DOM 재생성 없이 기존 노드만 갱신(제스처 대상 노드 보존 → 핀치 끊김 방지).
  function _liveUpdate(l) {
    var node = S.stage.querySelector('[data-se-layer="' + l.id + '"]'); if (!node) return;
    node.style.left = (l.x * 100) + '%'; node.style.top = (l.y * 100) + '%'; node.style.width = (l.w * 100) + '%';
    node.style.transform = 'translate(-50%,-50%) rotate(' + l.rot + 'deg)';
    node.style.opacity = l.opacity;
    var inner = node.firstChild;
    if (inner && inner.style && l.type !== 'image') {
      var rect = S.stage.getBoundingClientRect();
      inner.style.fontSize = (l.size * Math.min(rect.width || 320, rect.height || 400)) + 'px';
    }
  }

  function _layerEl(l) {
    var rect = S.stage.getBoundingClientRect();
    var shortSide = Math.min(rect.width || 320, rect.height || 400);
    var el = document.createElement('div');
    el.className = 'se-layer se-layer--' + l.type + (l.id === S.selId ? ' sel' : '') + (l._justAdded ? ' se-layer--pop' : '');
    if (l._justAdded) l._justAdded = false;   // 등장 애니메이션은 최초 1회만
    el.setAttribute('data-se-layer', l.id);
    el.style.left = (l.x * 100) + '%'; el.style.top = (l.y * 100) + '%'; el.style.width = (l.w * 100) + '%';
    el.style.transform = 'translate(-50%,-50%) rotate(' + l.rot + 'deg)';
    el.style.opacity = l.opacity;
    var inner;
    if (l.type === 'image') {
      inner = document.createElement('img'); inner.className = 'se-layer__img'; inner.src = l.src || ''; inner.draggable = false;
    } else if (l.type === 'badge') {
      inner = document.createElement('div'); inner.className = 'se-layer__badge';
      inner.textContent = l.text; inner.style.background = l.bg || '#1f1f1f'; inner.style.color = l.color;
      inner.style.fontSize = (l.size * shortSide) + 'px'; inner.style.fontFamily = l.font; inner.style.fontWeight = 800;
    } else if (l.type === 'emoji') {
      inner = document.createElement('div'); inner.className = 'se-layer__emoji'; inner.textContent = l.text;
      inner.style.fontSize = (l.size * shortSide) + 'px';
    } else {
      inner = document.createElement('div'); inner.className = 'se-layer__txt'; inner.contentEditable = 'true'; inner.spellcheck = false;
      inner.textContent = l.text;
      inner.style.fontFamily = l.font; inner.style.fontSize = (l.size * shortSide) + 'px'; inner.style.color = l.color;
      inner.style.fontWeight = l.weight; inner.style.textAlign = l.align; inner.style.lineHeight = l.lineHeight;
      inner.style.letterSpacing = l.letterSpacing + 'em'; inner.style.textShadow = l.shadow ? '0 2px 8px rgba(0,0,0,.45)' : 'none';
    }
    el.appendChild(inner);
    el.insertAdjacentHTML('beforeend',
      '<button class="se-h se-h--del" data-se-h="del" aria-label="삭제"><i class="ph-duotone ph-x"></i></button>' +
      '<button class="se-h se-h--rot" data-se-h="rot" aria-label="크기·회전"><i class="ph-duotone ph-arrows-out-cardinal"></i></button>');
    return el;
  }

  function _selLayer() { for (var i = 0; i < S.layers.length; i++) if (S.layers[i].id === S.selId) return S.layers[i]; return null; }
  function _selByIdHelper(id) { for (var i = 0; i < S.layers.length; i++) if (S.layers[i].id === id) return S.layers[i]; return null; }

  function _select(id) {
    S.selId = id;
    [].slice.call(S.stage.querySelectorAll('.se-layer')).forEach(function (n) { n.classList.toggle('sel', n.getAttribute('data-se-layer') === id); });
    _renderPanel();
  }
  function _deselect() { if (S.selId !== null) { S.selId = null; _renderStage(); _renderPanel(); } }

  // ── 컨텍스트 패널(선택 시에만) ─────────────────────────────
  // [stability] 패널은 사진을 밀지 않는 오버레이(CSS absolute). 사진 위치/크기는 절대 안 바뀜 → 재맞춤 호출 제거.
  function _renderPanel() {
    var panel = S.root.querySelector('[data-se-panel]');
    var l = _selLayer();
    if (!l) { panel.hidden = true; panel.innerHTML = ''; return; }
    panel.hidden = false;
    panel.innerHTML = (l.type === 'text') ? _textPanel(l) : _objPanel(l);
  }
  function _textPanel(l) {
    var tabs = [['font', '글꼴'], ['style', '스타일'], ['color', '색상'], ['align', '정렬']];
    var bar = '<div class="se-panel__tabs">' + tabs.map(function (t) { return '<button class="se-ptab' + (S.panelTab === t[0] ? ' on' : '') + '" data-se-ptab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
    var body = '';
    if (S.panelTab === 'font') {
      // [v582] 폰트명 나열 대신 각 폰트로 렌더한 'Aa'만(보고 고르게).
      body = '<div class="se-prow se-prow--fonts">' + FONTS.map(function (f) { return '<button class="se-fontchip' + (l.font === f.v ? ' on' : '') + '" data-se-font="' + esc(f.v) + '" style="font-family:' + f.v + '" aria-label="' + esc(f.l) + '" title="' + esc(f.l) + '">Aa</button>'; }).join('') + '</div>' +
        '<div class="se-prow"><span class="se-plabel">크기</span><input type="range" min="2" max="18" step="0.5" value="' + (l.size * 100).toFixed(1) + '" data-se-size></div>';
    } else if (S.panelTab === 'style') {
      body = '<div class="se-prow">' +
        '<button class="se-sbtn' + (l.weight >= 800 ? ' on' : '') + '" data-se-weight><b>B</b> 굵게</button>' +
        '<button class="se-sbtn' + (l.shadow ? ' on' : '') + '" data-se-shadow><i class="ph-duotone ph-drop"></i> 그림자</button></div>' +
        '<div class="se-prow"><span class="se-plabel">투명도</span><input type="range" min="20" max="100" step="5" value="' + Math.round(l.opacity * 100) + '" data-se-opacity></div>';
    } else if (S.panelTab === 'color') {
      body = '<div class="se-prow se-prow--colors">' + COLORS.map(function (c) { return '<button class="se-color' + (l.color.toLowerCase() === c.toLowerCase() ? ' on' : '') + '" data-se-color="' + c + '" style="background:' + c + '"></button>'; }).join('') + '</div>';
    } else {
      body = '<div class="se-prow">' + [['left', 'ph-text-align-left'], ['center', 'ph-text-align-center'], ['right', 'ph-text-align-right']].map(function (a) { return '<button class="se-sbtn' + (l.align === a[0] ? ' on' : '') + '" data-se-align="' + a[0] + '"><i class="ph-duotone ' + a[1] + '"></i></button>'; }).join('') + '</div>';
    }
    return bar + '<div class="se-panel__body">' + body + '</div>';
  }
  function _objPanel(l) {
    var title = l.type === 'badge' ? '배지' : (l.type === 'emoji' ? '스티커' : '이미지');
    var body = '<div class="se-prow"><span class="se-plabel">크기</span><input type="range" min="3" max="30" step="0.5" value="' + (l.size * 100).toFixed(1) + '" data-se-size></div>' +
      '<div class="se-prow"><span class="se-plabel">투명도</span><input type="range" min="20" max="100" step="5" value="' + Math.round(l.opacity * 100) + '" data-se-opacity></div>';
    if (l.type === 'badge') {
      body += '<div class="se-prow se-prow--colors">' + ['#1f1f1f', '#D58A95', '#3fae6a', '#e0556b', '#e8a23b', '#3b6fb6'].map(function (c) { return '<button class="se-color' + ((l.bg || '').toLowerCase() === c.toLowerCase() ? ' on' : '') + '" data-se-bg="' + c + '" style="background:' + c + '"></button>'; }).join('') + '</div>';
    }
    return '<div class="se-panel__tabs"><span class="se-ptab on">' + title + '</span></div><div class="se-panel__body">' + body + '</div>';
  }

  // ── AI 자동 배치 배너 ─────────────────────────────────────
  function _renderBanner() {
    var b = S.root.querySelector('[data-se-banner]');
    if (!S.autoArranged) { b.hidden = true; b.innerHTML = ''; return; }
    b.hidden = false;
    b.innerHTML =
      '<span class="se-banner__t"><i class="ph-duotone ph-sparkle"></i> AI 자동 배치 완료</span>' +
      '<button class="se-banner__re" data-se="relayout"><i class="ph-duotone ph-arrows-clockwise"></i> AI 다시 배치</button>' +
      '<button class="se-banner__x" data-se="banner-x" aria-label="닫기"><i class="ph-duotone ph-x"></i></button>';
  }

  // 같은 스타일 유지, 배치만 다음 변형안으로.
  function _relayout(toIdx) {
    S.arrangeIdx = (toIdx != null) ? toIdx : (S.arrangeIdx + 1) % ARRANGE.length;
    var v = ARRANGE[S.arrangeIdx];
    S.layers.forEach(function (l) {
      var p = v[l.role];
      if (p) { l.x = p.x; l.y = p.y; l.w = p.w; if (l.type === 'text') l.align = p.align; }
    });
    S.autoArranged = true;
    _renderStage(); _renderBanner(); _snapshot();
    toast('배치안 ' + (S.arrangeIdx + 1) + '/' + ARRANGE.length + ' · ' + v.name);
  }

  // ── 스티커 시트(우리샵 에셋) ──────────────────────────────
  function _openSticker() {
    var sheet = S.root.querySelector('[data-se-sheet]');
    var assets = _assetStickers();
    sheet.innerHTML =
      '<div class="se-sheet__bar"><b>스티커</b><button class="se-icobtn se-icobtn--sm" data-se="sheet-x" aria-label="닫기"><i class="ph-duotone ph-x"></i></button></div>' +
      '<div class="se-sheet__sec">우리샵 에셋</div>' +
      '<div class="se-sheet__grid">' + assets.map(function (a, i) {
        return '<button class="se-asset" data-se-asset="' + i + '"><span class="se-asset__pill" style="background:' + (a.bg || '#1f1f1f') + ';color:' + (a.color || '#fff') + '">' + esc(a.text) + '</span><small>' + esc(a.label) + '</small></button>';
      }).join('') + '</div>' +
      '<div class="se-sheet__sec">기본 스티커</div>' +
      '<div class="se-sheet__grid se-sheet__grid--emoji">' + EMOJIS.map(function (e, i) { return '<button class="se-emojibtn" data-se-emoji="' + i + '">' + e + '</button>'; }).join('') + '</div>';
    sheet.hidden = false;
    sheet._assets = assets;
  }
  function _closeSheet() { var sheet = S.root.querySelector('[data-se-sheet]'); sheet.hidden = true; sheet.innerHTML = ''; }
  function _addSticker(asset) {
    var l = _normLayer({ type: asset.type, text: asset.text, bg: asset.bg, color: asset.color, role: 'sticker', x: 0.5, y: 0.42, size: 0.06, w: 0.4 });
    l._justAdded = true;
    S.layers.push(l); _closeSheet(); _select(l.id); _renderStage(); _snapshot();
  }
  function _addEmoji(glyph) {
    var l = _normLayer({ type: 'emoji', text: glyph, role: 'sticker', x: 0.5, y: 0.42, size: 0.14, w: 0.22 });
    l._justAdded = true;
    S.layers.push(l); _closeSheet(); _select(l.id); _renderStage(); _snapshot();
  }

  // ── 바인딩 ────────────────────────────────────────────────
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
      if (a === 'sticker') return _openSticker();
      if (a === 'sheet-x') return _closeSheet();
      if (a === 'addphoto') { var f = root.querySelector('[data-se-photofile]'); if (f) f.click(); return; }
      if (a === 'style') return _relayout(0);            // 우리샵 스타일대로 정렬(+배너)
      if (a === 'relayout') return _relayout();          // 다음 배치안
      if (a === 'banner-x') { S.autoArranged = false; _renderBanner(); return; }
      if (a === 'more') { toast('곧 제공돼요'); return; }
    });
    // 패널 컨트롤
    root.addEventListener('click', function (e) {
      var pt = e.target.closest('[data-se-ptab]'); if (pt && pt.hasAttribute('data-se-ptab')) { S.panelTab = pt.getAttribute('data-se-ptab'); _renderPanel(); return; }
      var fc = e.target.closest('[data-se-font]'); if (fc) { _patch({ font: fc.getAttribute('data-se-font') }); return; }
      var cc = e.target.closest('[data-se-color]'); if (cc) { _patch({ color: cc.getAttribute('data-se-color') }); return; }
      var bgc = e.target.closest('[data-se-bg]'); if (bgc) { _patch({ bg: bgc.getAttribute('data-se-bg') }); return; }
      var al = e.target.closest('[data-se-align]'); if (al) { _patch({ align: al.getAttribute('data-se-align') }); return; }
      if (e.target.closest('[data-se-weight]')) { var l1 = _selLayer(); _patch({ weight: (l1 && l1.weight >= 800) ? 600 : 800 }); return; }
      if (e.target.closest('[data-se-shadow]')) { var l2 = _selLayer(); _patch({ shadow: !(l2 && l2.shadow) }); return; }
      var as = e.target.closest('[data-se-asset]'); if (as) { var sheet = root.querySelector('[data-se-sheet]'); _addSticker(sheet._assets[+as.getAttribute('data-se-asset')]); return; }
      var em = e.target.closest('[data-se-emoji]'); if (em) { _addEmoji(EMOJIS[+em.getAttribute('data-se-emoji')]); return; }
    });
    root.addEventListener('input', function (e) {
      if (e.target.matches('[data-se-size]')) _patch({ size: (+e.target.value) / 100 }, true);
      else if (e.target.matches('[data-se-opacity]')) _patch({ opacity: (+e.target.value) / 100 }, true);
    });
    root.addEventListener('change', function (e) {
      if (e.target.matches('[data-se-size],[data-se-opacity]')) _snapshot();
      if (e.target.matches('[data-se-photofile]')) _onPhotoFile(e.target.files && e.target.files[0]);
    });
    S.stage.addEventListener('input', function (e) {
      var t = e.target.closest('.se-layer__txt'); if (!t) return;
      var l = _selByIdHelper(t.closest('[data-se-layer]').getAttribute('data-se-layer')); if (l) l.text = t.textContent;
    });
    S.stage.addEventListener('blur', function (e) { if (e.target.closest && e.target.closest('.se-layer__txt')) _snapshot(); }, true);
    _bindStagePointer();
  }

  function _onPhotoFile(file) {
    if (!file) return;
    var fr = new FileReader();
    fr.onload = function () {
      var l = _normLayer({ type: 'image', src: fr.result, role: 'sticker', x: 0.5, y: 0.42, w: 0.4 });
      l._justAdded = true;
      S.layers.push(l); _select(l.id); _renderStage(); _snapshot();
    };
    fr.readAsDataURL(file);
  }

  function _patch(patch, live) {
    var l = _selLayer(); if (!l) return;
    Object.assign(l, patch);
    _renderStage(); _renderPanel();
    if (!live) _snapshot();
  }
  function _addText() {
    var l = _normLayer({ text: '새 텍스트', role: 'body', x: 0.5, y: 0.4, w: 0.8, size: 0.07, align: 'center' });
    l._justAdded = true;
    S.layers.push(l); _select(l.id); _renderStage(); _snapshot();
    var node = S.stage.querySelector('[data-se-layer="' + l.id + '"] .se-layer__txt'); if (node) { node.focus(); if (document.execCommand) try { document.execCommand('selectAll', false, null); } catch (_e) { void _e; } }
  }

  function _stagePx() { var r = S.stage.getBoundingClientRect(); return { w: r.width, h: r.height, left: r.left, top: r.top, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }
  function _capture(id) { try { if (S.stage.setPointerCapture) S.stage.setPointerCapture(id); } catch (_e) { void _e; } }
  function _bindStagePointer() {
    var drag = null, rotsz = null;
    S.stage.addEventListener('pointerdown', function (e) {
      var hb = e.target.closest('[data-se-h]'); var host = e.target.closest('[data-se-layer]');
      if (hb && host) {
        var id = host.getAttribute('data-se-layer'); _select(id);
        if (hb.getAttribute('data-se-h') === 'del') { _removeLayer(id); return; }
        var l = _selByIdHelper(id);
        rotsz = { id: id, sp: _stagePx(), startRot: l.rot, startSize: l.size }; e.preventDefault();
        _capture(e.pointerId); return;
      }
      if (host) {
        var lid = host.getAttribute('data-se-layer'); _select(lid);
        if (e.target.closest('.se-layer__txt') && document.activeElement === e.target.closest('.se-layer__txt')) return;
        var ll = _selByIdHelper(lid);
        drag = { id: lid, startX: e.clientX, startY: e.clientY, ox: ll.x, oy: ll.y, sp: _stagePx() };
        _capture(e.pointerId);
      } else if (e.target === S.stage) {
        _deselect();   // [B-1r] 빈 캔버스 탭 → 선택 해제(패널 닫힘·캔버스 최대)
      }
    });
    S.stage.addEventListener('pointermove', function (e) {
      if (rotsz) {
        var l = _selByIdHelper(rotsz.id); var sp = rotsz.sp;
        var ang = Math.atan2(e.clientY - sp.cy, e.clientX - sp.cx) * 180 / Math.PI;
        var dist = Math.hypot(e.clientX - sp.cx, e.clientY - sp.cy);
        l.rot = Math.round(ang + 90);
        l.size = clamp(dist / Math.min(sp.w, sp.h) * 0.5, 0.02, 0.5);
        _liveUpdate(l); return;
      }
      if (drag) {
        var ld = _selByIdHelper(drag.id);
        ld.x = clamp(drag.ox + (e.clientX - drag.startX) / drag.sp.w, 0.02, 0.98);
        ld.y = clamp(drag.oy + (e.clientY - drag.startY) / drag.sp.h, 0.02, 0.98);
        _liveUpdate(ld);
      }
    });
    function end() { if (drag || rotsz) { drag = null; rotsz = null; _renderStage(); _renderPanel(); _snapshot(); } }
    S.stage.addEventListener('pointerup', end); S.stage.addEventListener('pointercancel', end);
    _bindStageTouch();
  }
  function _bindStageTouch() {
    var pinch = null;
    S.stage.addEventListener('touchmove', function (e) {
      if (e.touches.length !== 2) return;
      // 두 손가락이 레이어를 정확히 안 짚어도 '선택된 레이어'를 대상으로 핀치(견고화).
      var host = e.target.closest('[data-se-layer]');
      var l = host ? _selByIdHelper(host.getAttribute('data-se-layer')) : _selLayer();
      if (!l) return; e.preventDefault();
      var t1 = e.touches[0], t2 = e.touches[1];
      var dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      var ang = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180 / Math.PI;
      if (!pinch || pinch.id !== l.id) { pinch = { id: l.id, d0: dist, a0: ang, s0: l.size, r0: l.rot }; if (S.selId !== l.id) _select(l.id); return; }
      l.size = clamp(pinch.s0 * (dist / pinch.d0), 0.02, 0.5); l.rot = Math.round(pinch.r0 + (ang - pinch.a0));
      _liveUpdate(l);   // DOM 재생성 없이 갱신 → 제스처 노드 보존(핀치 안 끊김)
    }, { passive: false });
    S.stage.addEventListener('touchend', function (e) { if (e.touches.length < 2 && pinch) { pinch = null; _renderStage(); _renderPanel(); _snapshot(); } });
  }

  function _removeLayer(id) {
    S.layers = S.layers.filter(function (l) { return l.id !== id; });
    if (S.selId === id) S.selId = null;
    _renderStage(); _renderPanel(); _snapshot();
  }

  // ── undo/redo ─────────────────────────────────────────────
  function _snapshot(reset) {
    var snap = JSON.stringify({ layers: S.layers, selId: S.selId, arrangeIdx: S.arrangeIdx });
    if (reset) { S.undo = [snap]; S.redo = []; return; }
    if (S.undo[S.undo.length - 1] === snap) return;
    S.undo.push(snap); if (S.undo.length > 40) S.undo.shift(); S.redo = [];
  }
  function _restore(snap) { var o = JSON.parse(snap); S.layers = o.layers.map(_normLayer); S.selId = o.selId; S.arrangeIdx = o.arrangeIdx || 0; _renderStage(); _renderPanel(); }
  function _undo() { if (S.undo.length < 2) { toast('되돌릴 게 없어요'); return; } S.redo.push(S.undo.pop()); _restore(S.undo[S.undo.length - 1]); }
  function _redo() { if (!S.redo.length) { toast('다시 실행할 게 없어요'); return; } var s = S.redo.pop(); S.undo.push(s); _restore(s); }

  // ── bake ──────────────────────────────────────────────────
  function _loadImg(src) { return new Promise(function (res) { if (!src) return res(null); var i = new Image(); i.crossOrigin = 'anonymous'; i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = src; }); }
  function bake() {
    var parts = String(S.ratio).split(':'); var rw = +parts[0] || 4, rh = +parts[1] || 5;
    var W = 1080, H = Math.round(W * rh / rw), shortSide = Math.min(W, H);
    var imgSrcs = [S.photoUrl].concat(S.layers.filter(function (l) { return l.type === 'image'; }).map(function (l) { return l.src; }));
    return Promise.all(imgSrcs.map(_loadImg)).then(function (imgs) {
      var photo = imgs[0]; var imgMap = {}; var ii = 1;
      S.layers.forEach(function (l) { if (l.type === 'image') imgMap[l.id] = imgs[ii++]; });
      var cv = document.createElement('canvas'); cv.width = W; cv.height = H; var ctx = cv.getContext('2d');
      if (photo) _coverDraw(ctx, photo, W, H); else { ctx.fillStyle = '#222'; ctx.fillRect(0, 0, W, H); }
      S.layers.forEach(function (l) {
        ctx.save(); ctx.translate(l.x * W, l.y * H); ctx.rotate(l.rot * Math.PI / 180); ctx.globalAlpha = l.opacity;
        var fs = l.size * shortSide;
        if (l.type === 'image' && imgMap[l.id]) {
          var im = imgMap[l.id], bw = l.w * W, bh = bw * im.height / im.width;
          ctx.drawImage(im, -bw / 2, -bh / 2, bw, bh);
        } else if (l.type === 'emoji') {
          ctx.font = fs + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(l.text, 0, 0);
        } else if (l.type === 'badge') {
          ctx.font = '800 ' + fs + 'px ' + l.font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          var padX = fs * 0.6, padY = fs * 0.34, tw = ctx.measureText(l.text).width, bw2 = tw + padX * 2, bh2 = fs + padY * 2, r = bh2 / 2;
          ctx.fillStyle = l.bg || '#1f1f1f'; _roundRect(ctx, -bw2 / 2, -bh2 / 2, bw2, bh2, r); ctx.fill();
          ctx.fillStyle = l.color || '#fff'; ctx.fillText(l.text, 0, fs * 0.06);
        } else {
          ctx.font = l.weight + ' ' + fs + 'px ' + l.font; ctx.fillStyle = l.color; ctx.textAlign = l.align; ctx.textBaseline = 'middle';
          if (l.shadow) { ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = fs * 0.18; ctx.shadowOffsetY = fs * 0.05; }
          var maxW = l.w * W, lines = _wrap(ctx, l.text, maxW), lh = fs * l.lineHeight, sy = -(lines.length - 1) * lh / 2;
          var ax = l.align === 'left' ? -maxW / 2 : (l.align === 'right' ? maxW / 2 : 0);
          lines.forEach(function (ln, i) { ctx.fillText(ln, ax, sy + i * lh); });
        }
        ctx.restore();
      });
      return cv.toDataURL('image/jpeg', 0.92);
    });
  }
  function _roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function _coverDraw(ctx, img, W, H) { var ir = img.width / img.height, fr = W / H, dw, dh, dx, dy; if (ir > fr) { dh = H; dw = H * ir; dx = (W - dw) / 2; dy = 0; } else { dw = W; dh = W / ir; dx = 0; dy = (H - dh) / 2; } ctx.drawImage(img, dx, dy, dw, dh); }
  function _wrap(ctx, text, maxW) {
    var out = [];
    String(text).split('\n').forEach(function (para) {
      var words = para.split(/(\s+)/), line = '';
      words.forEach(function (w) { var test = line + w; if (ctx.measureText(test).width > maxW && line) { out.push(line.replace(/\s+$/, '')); line = w.replace(/^\s+/, ''); } else line = test; });
      out.push(line);
    });
    return out;
  }

  function save() { bake().then(function (dataUrl) { var cb = S.onDone, layers = S.layers.map(function (l) { return Object.assign({}, l); }); _teardown(); if (cb) cb(dataUrl, { layers: layers }); }); }
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
