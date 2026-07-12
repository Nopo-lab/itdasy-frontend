/* 작업실 초고도화 — 레이아웃 모델 + 합성기 (ITDASY_WS_HYPER)
   레이아웃 = 재사용 홍보 틀: photoSlots(사진 자리 geometry+focal/zoom) + layers(텍스트).
   - 스타터 A~H (전후 비교 우선) 내장. '내 레이아웃'은 ShopStyle.list() 확장(Phase 2 동기화).
   - composeLayout(layout, photos): 사진을 슬롯에 cover-crop 배치해 미리보기 dataURL 생성.
   flow/편집기와 분리 — window.WorkspaceLayout 로만 노출. 플래그 OFF면 아무도 안 부름. */
(function () {
  'use strict';

  // rect: 캔버스 0..1 정규 좌표. focal: 0..1 크롭 중심. zoom>=1.
  function slot(id, role, x, y, w, h, opts) {
    opts = opts || {};
    return { id: id, role: role, rect: { x: x, y: y, w: w, h: h }, focal: { x: opts.fx == null ? 0.5 : opts.fx, y: opts.fy == null ? 0.5 : opts.fy }, zoom: opts.zoom || 1, fit: 'cover' };
  }
  function label(role, text, x, y, w, opts) {
    opts = opts || {};
    return { type: 'text', role: role, text: text, x: x, y: y, w: w, size: opts.size || 0.045, weight: opts.weight || 800, color: opts.color || '#fff', align: opts.align || 'center', bg: opts.bg || null, shadow: opts.shadow !== false };
  }

  // ── 스타터 (다양성 팩, 2026-07-12) ─────────────────────────────
  //   전후(before_after)는 2~3개로 리밸런스, 나머지는 그리드·스토리·후기·가격·과정·폴라로이드로 폭 확장.
  //   text 롤(headline/caption_bar/sub2)은 flow/layout.js _fillLayoutText 가 시술명으로 자동 채움.
  var STARTERS = [
    // ── 전후 비교 (3) ──
    { id: 'wsl-ba-lr', name: '전후 · 좌우', kind: 'before_after', ratio: '1:1',
      photoSlots: [slot('before', 'before', 0, 0, 0.5, 1), slot('after', 'after', 0.5, 0, 0.5, 1)],
      layers: [label('badge_before', 'BEFORE', 0.02, 0.03, 0.46, { size: 0.032, align: 'left', bg: 'rgba(0,0,0,.42)' }),
               label('badge_after', 'AFTER', 0.52, 0.03, 0.46, { size: 0.032, align: 'left', bg: 'rgba(188,102,117,.85)' })] },
    { id: 'wsl-ba-tb', name: '전후 · 상하', kind: 'before_after', ratio: '4:5',
      photoSlots: [slot('before', 'before', 0, 0, 1, 0.5), slot('after', 'after', 0, 0.5, 1, 0.5)],
      layers: [label('badge_before', 'BEFORE', 0.03, 0.02, 0.5, { size: 0.03, align: 'left', bg: 'rgba(0,0,0,.42)' }),
               label('badge_after', 'AFTER', 0.03, 0.52, 0.5, { size: 0.03, align: 'left', bg: 'rgba(188,102,117,.85)' })] },
    { id: 'wsl-ba-frame', name: '전후 · 인셋', kind: 'before_after', ratio: '4:5',
      photoSlots: [slot('after', 'after', 0, 0, 1, 1), slot('before', 'before', 0.63, 0.66, 0.33, 0.29)],
      layers: [label('badge_before', 'BEFORE', 0.63, 0.615, 0.33, { size: 0.024, align: 'center', bg: 'rgba(0,0,0,.5)' })] },
    // ── 과정 3컷 (전/중/후 · 왁싱·펌 과정) ──
    { id: 'wsl-process-3', name: '과정 · 전·중·후', kind: 'before_after', ratio: '1:1',
      photoSlots: [slot('before', 'before', 0, 0, 1 / 3, 1), slot('mid', 'mid', 1 / 3, 0, 1 / 3, 1), slot('after', 'after', 2 / 3, 0, 1 / 3, 1)],
      layers: [label('badge_before', 'BEFORE', 0.01, 0.03, 0.31, { size: 0.026, align: 'left', bg: 'rgba(0,0,0,.42)' }),
               label('badge_mid', '과정', 0.35, 0.03, 0.30, { size: 0.026, align: 'left', bg: 'rgba(0,0,0,.42)' }),
               label('badge_after', 'AFTER', 0.68, 0.03, 0.31, { size: 0.026, align: 'left', bg: 'rgba(188,102,117,.85)' })] },
    // ── 그리드/스트립 ──
    { id: 'wsl-grid-4', name: '4컷 · 그리드', kind: 'collage', ratio: '1:1',
      photoSlots: [slot('a', 'a', 0, 0, 0.5, 0.5), slot('b', 'b', 0.5, 0, 0.5, 0.5), slot('c', 'c', 0, 0.5, 0.5, 0.5), slot('d', 'd', 0.5, 0.5, 0.5, 0.5)], layers: [] },
    { id: 'wsl-strip-3', name: '3분할 · 스트립', kind: 'collage', ratio: '1:1',
      photoSlots: [slot('a', 'a', 0, 0, 1 / 3, 1), slot('b', 'b', 1 / 3, 0, 1 / 3, 1), slot('c', 'c', 2 / 3, 0, 1 / 3, 1)], layers: [] },
    { id: 'wsl-collage-2', name: '2장 · 좌우', kind: 'collage', ratio: '1:1',
      photoSlots: [slot('a', 'a', 0, 0, 0.5, 1), slot('b', 'b', 0.5, 0, 0.5, 1)], layers: [] },
    { id: 'wsl-collage-3', name: '3장 · 1+2', kind: 'collage', ratio: '4:5',
      photoSlots: [slot('main', 'main', 0, 0, 1, 0.62), slot('a', 'a', 0, 0.62, 0.5, 0.38), slot('b', 'b', 0.5, 0.62, 0.5, 0.38)], layers: [] },
    // ── 한 장 ──
    { id: 'wsl-single', name: '한 장 · 꽉', kind: 'single', ratio: '4:5',
      photoSlots: [slot('main', 'main', 0, 0, 1, 1)], layers: [] },
    { id: 'wsl-story', name: '스토리 · 세로', kind: 'single', ratio: '9:16',
      photoSlots: [slot('main', 'main', 0, 0, 1, 1)], layers: [] },
    { id: 'wsl-hero-caption', name: '히어로 · 자막바', kind: 'headline', ratio: '4:5',
      photoSlots: [slot('main', 'main', 0, 0, 1, 0.86, { fy: 0.42 })],
      layers: [label('panel', '', 0, 0.86, 1, { size: 0.001, bg: '#15181D' }),
               label('caption_bar', '', 0.06, 0.895, 0.88, { size: 0.046, weight: 800, color: '#fff', align: 'center', shadow: false })] },
    { id: 'wsl-polaroid', name: '폴라로이드', kind: 'headline', ratio: '4:5',
      photoSlots: [slot('main', 'main', 0.07, 0.06, 0.86, 0.72)],
      layers: [label('caption_bar', '', 0.07, 0.83, 0.86, { size: 0.05, weight: 700, color: '#3A2A22', align: 'center', shadow: false })] },
    // ── 후기 ──
    { id: 'wsl-review', name: '후기 · 사진+글', kind: 'review', ratio: '4:5',
      photoSlots: [slot('main', 'main', 0, 0, 1, 0.66)],
      layers: [label('panel', '', 0, 0.66, 1, { size: 0.001, bg: '#fff' }),
               label('title', '고객 후기', 0.08, 0.71, 0.84, { size: 0.05, weight: 800, color: '#191F28', align: 'left', shadow: false }),
               label('body', '', 0.08, 0.79, 0.84, { size: 0.032, weight: 500, color: '#4E5968', align: 'left', shadow: false })] },
    { id: 'wsl-review-star', name: '후기 · 별점 카드', kind: 'review', ratio: '4:5',
      photoSlots: [slot('main', 'main', 0, 0, 1, 0.55)],
      layers: [label('panel', '', 0, 0.55, 1, { size: 0.001, bg: '#FBF7F5' }),
               label('quote', '“', 0.05, 0.55, 0.3, { size: 0.11, weight: 800, color: '#E6C9D2', align: 'left', shadow: false }),
               label('stars', '★★★★★', 0.08, 0.635, 0.84, { size: 0.042, weight: 800, color: '#F5A623', align: 'left', shadow: false }),
               label('title', '고객 후기', 0.08, 0.70, 0.84, { size: 0.044, weight: 800, color: '#191F28', align: 'left', shadow: false }),
               label('body', '', 0.08, 0.77, 0.84, { size: 0.032, weight: 500, color: '#4E5968', align: 'left', shadow: false })] },
    // ── 번호 스텝(홈케어 팁) ──
    { id: 'wsl-steps', name: '홈케어 · 번호 팁', kind: 'steps', ratio: '4:5',
      photoSlots: [slot('main', 'main', 0, 0, 1, 0.44)],
      layers: [label('panel', '', 0, 0.44, 1, { size: 0.001, bg: '#fff' }),
               label('title', '홈케어 팁', 0.08, 0.48, 0.84, { size: 0.046, weight: 800, color: '#191F28', align: 'left', shadow: false }),
               label('step_1', '1  깨끗한 손으로 관리해요', 0.08, 0.58, 0.84, { size: 0.03, weight: 600, color: '#4E5968', align: 'left', shadow: false }),
               label('step_2', '2  전용 제품으로 결을 정돈해요', 0.08, 0.66, 0.84, { size: 0.03, weight: 600, color: '#4E5968', align: 'left', shadow: false }),
               label('step_3', '3  2~3주마다 리터치 받아요', 0.08, 0.74, 0.84, { size: 0.03, weight: 600, color: '#4E5968', align: 'left', shadow: false })] },
    // ── 가격 ──
    { id: 'wsl-price', name: '가격 · 사진+표', kind: 'price', ratio: '4:5',
      photoSlots: [slot('main', 'main', 0, 0, 1, 0.5)],
      layers: [label('panel', '', 0, 0.5, 1, { size: 0.001, bg: '#fff' }),
               label('title', '시술 안내', 0.08, 0.55, 0.84, { size: 0.05, weight: 800, color: '#191F28', align: 'left', shadow: false })] },
    { id: 'wsl-price-split', name: '가격 · 좌우 메뉴', kind: 'price', ratio: '4:5',
      photoSlots: [slot('main', 'main', 0, 0, 0.5, 1)],
      layers: [label('panel', '', 0.5, 0, 0.5, { size: 0.001, bg: '#fff' }),
               label('title', '시술 안내', 0.55, 0.07, 0.42, { size: 0.042, weight: 800, color: '#191F28', align: 'left', shadow: false })] },
  ];

  function getStarters() { return STARTERS.map(function (s) { return clone(s); }); }
  function getById(id) { var s = STARTERS.filter(function (x) { return x.id === id; })[0]; return s ? clone(s) : null; }
  // 내 레이아웃 = ShopStyle 확장(있으면). 없으면 빈 배열.
  function getMyLayouts() {
    try {
      var SS = window.ShopStyle;
      if (!SS || typeof SS.list !== 'function') return [];
      return (SS.list() || []).filter(function (s) { return s && s.photoSlots && s.photoSlots.length; }).map(function (s) { return clone(s); });
    } catch (_e) { return []; }
  }
  function clone(o) { try { return JSON.parse(JSON.stringify(o)); } catch (_e) { return o; } }

  function ratioWH(ratio, base) {
    base = base || 1080;
    var m = { '1:1': [1, 1], '4:5': [4, 5], '9:16': [9, 16], '3:4': [3, 4] }[ratio] || [4, 5];
    var w = base, h = Math.round(base * m[1] / m[0]);
    if (h > 1600) { h = 1600; w = Math.round(1600 * m[0] / m[1]); }
    return { w: w, h: h };
  }

  // 업로드 사진을 슬롯에 자동 할당(순서/역할). photos = [{id, editedDataUrl|dataUrl, role}]
  function autoAssign(photos, layout) {
    photos = (photos || []).filter(Boolean);
    var slots = layout.photoSlots || [];
    var used = {};
    var map = {};
    // 1) 역할 매칭 우선(before/after)
    slots.forEach(function (sl) {
      var byRole = photos.filter(function (p, i) { return !used[i] && p.role === sl.role; });
      if (byRole.length) { var idx = photos.indexOf(byRole[0]); used[idx] = true; map[sl.id] = photos[idx]; }
    });
    // 2) 남은 슬롯은 순서대로
    var free = photos.map(function (p, i) { return used[i] ? null : p; }).filter(Boolean);
    var fi = 0;
    slots.forEach(function (sl) { if (!map[sl.id] && free[fi]) { map[sl.id] = free[fi]; fi++; } });
    return map; // {slotId: photo}
  }

  function _src(p) { return p && (p.editedDataUrl || p.dataUrl || p.baseUrl || p._src || (typeof p === 'string' ? p : '')); }
  function _load(src) {
    return new Promise(function (res) {
      if (!src) { res(null); return; }
      var img = new Image();
      if (/^https?:/.test(src)) img.crossOrigin = 'anonymous';   // 동기화된 https 이미지 캔버스 export 위해
      img.onload = function () { res(img); }; img.onerror = function () { res(null); };
      img.src = src;
    });
  }
  // cover-crop: 이미지(iw,ih)를 (dw,dh) 슬롯에 focal 중심·zoom 배율로 꽉 채움
  function _drawCover(ctx, img, dx, dy, dw, dh, focal, zoom) {
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    var scale = Math.max(dw / iw, dh / ih) * (zoom || 1);
    var sw = dw / scale, sh = dh / scale;
    var sx = (iw - sw) * (focal ? focal.x : 0.5);
    var sy = (ih - sh) * (focal ? focal.y : 0.5);
    sx = Math.max(0, Math.min(iw - sw, sx)); sy = Math.max(0, Math.min(ih - sh, sy));
    ctx.save(); ctx.beginPath(); ctx.rect(dx, dy, dw, dh); ctx.clip();
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh); ctx.restore();
  }
  // [2026-07-10] 캔버스 자동 줄바꿈 — 폭(maxW) 기준으로 줄을 나눔. 공백에서 우선 끊고, 긴 토큰(한글 등)은 글자 단위로.
  function _wrapCanvasText(ctx, text, maxW) {
    var lines = [];
    String(text).split('\n').forEach(function (para) {
      var line = '';
      for (var i = 0; i < para.length; i++) {
        var ch = para[i];
        var test = line + ch;
        if (line && ctx.measureText(test).width > maxW) {
          var sp = line.lastIndexOf(' ');
          if (sp > 0 && ch !== ' ') { lines.push(line.slice(0, sp)); line = line.slice(sp + 1) + ch; }   // 마지막 공백에서 끊기(더 자연스럽게)
          else { lines.push(line); line = (ch === ' ' ? '' : ch); }
        } else { line = test; }
      }
      lines.push(line);
    });
    return lines;
  }
  function _drawText(ctx, L, W, H) {
    var x = L.x * W, y = L.y * H, w = (L.w || 0.8) * W, size = (L.size || 0.04) * Math.min(W, H);
    if (L.bg && (L.role === 'panel' || L.text)) {   // 패널/뱃지 배경 (빈 자막바·빈 밴드는 그리지 않음)
      var padY = L.role && L.role.indexOf('badge') === 0 ? size * 0.5 : (L.role === 'panel' ? 0 : size * 0.4);
      var bh = L.role === 'panel' ? (H - y) : (size + padY * 2);
      ctx.fillStyle = L.bg; ctx.fillRect(x, y, w, bh);
      if (L.role === 'panel') return;
      y += padY;
    }
    if (!L.text) return;
    var isBadge = L.role && L.role.indexOf('badge') === 0;
    ctx.fillStyle = L.color || '#fff'; ctx.textAlign = L.align || 'center'; ctx.textBaseline = 'top';
    if (L.shadow) { ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = size * 0.25; ctx.shadowOffsetY = size * 0.05; }
    var tx = L.align === 'left' ? x : (L.align === 'right' ? x + w : x + w / 2);
    if (isBadge) {   // 배지(BEFORE/AFTER)는 배경이 1줄 기준 → 한 줄 유지
      ctx.font = (L.weight || 700) + ' ' + Math.round(size) + 'px Pretendard, -apple-system, sans-serif';
      ctx.fillText(String(L.text), tx, y);
    } else {   // [2026-07-10] 긴 시술명/후기도 안 잘리게 — 자동 줄바꿈 + 세로 공간 넘치면 폰트 자동 축소
      var fsize = size, lines, lineH, availH = Math.max(size, H - y - size * 0.3), guard = 0;
      do {
        ctx.font = (L.weight || 700) + ' ' + Math.round(fsize) + 'px Pretendard, -apple-system, sans-serif';
        lines = _wrapCanvasText(ctx, String(L.text), w);
        lineH = fsize * 1.28;
        if (lines.length * lineH <= availH || fsize <= 15) break;
        fsize -= Math.max(1, Math.round(size * 0.08));
      } while (guard++ < 24);
      for (var li = 0; li < lines.length; li++) { ctx.fillText(lines[li], tx, y + li * lineH); }
    }
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  }

  // 레이아웃 + 사진 → 미리보기 dataURL. assign(옵션)=슬롯별 photo 지정, 없으면 autoAssign.
  function composeLayout(layout, photos, assign) {
    if (!layout) return Promise.resolve(null);
    var dim = ratioWH(layout.ratio || (layout.frame && layout.frame.ratio) || '4:5');
    var map = assign || autoAssign(photos, layout);
    var slots = layout.photoSlots || [];
    return Promise.all(slots.map(function (sl) { return _load(_src(map[sl.id])); })).then(function (imgs) {
      var cv = document.createElement('canvas'); cv.width = dim.w; cv.height = dim.h;
      var ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, dim.w, dim.h);
      slots.forEach(function (sl, i) {
        var r = sl.rect, dx = r.x * dim.w, dy = r.y * dim.h, dw = r.w * dim.w, dh = r.h * dim.h;
        if (imgs[i]) _drawCover(ctx, imgs[i], dx, dy, dw, dh, sl.focal, sl.zoom);
        else { ctx.fillStyle = '#EDEFF2'; ctx.fillRect(dx, dy, dw, dh); }
      });
      (layout.layers || []).forEach(function (L) { try { _drawText(ctx, L, dim.w, dim.h); } catch (_e) { void _e; } });
      try { return cv.toDataURL('image/jpeg', 0.9); } catch (_e) { return null; }
    });
  }

  window.WorkspaceLayout = {
    getStarters: getStarters, getMyLayouts: getMyLayouts, getById: getById,
    autoAssign: autoAssign, composeLayout: composeLayout, ratioWH: ratioWH,
    _debug: { STARTERS: STARTERS, _drawCover: _drawCover },
  };
})();
