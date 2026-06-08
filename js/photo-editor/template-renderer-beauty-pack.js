/* 뷰티 템플릿 팩 — 캔버스 렌더러 (BP-2 skeleton, 2026-06-09)

   역할: premium-templates 의 _premiumHook 이 meta[0]==='beautyPack' 일 때 위임받아 그린다.
     window.PhotoEditorBeautyPack.draw(ctx, dw, dh, state, tpl, data)

   원칙(엄수):
   - 이번(BP-2)은 "skeleton"만 — 템플릿별로 구분 가능한 placeholder(배경/존 아웃라인/데이터·사진 흐름 증명).
     고퀄 좌표/장식 튜닝은 BP-3. 여기서 픽셀 디자인을 완성하지 않는다.
   - 실제 편집기 캔버스가 단일 진실원 — onSave 가 그대로 캡처한다(onSave 무수정).
   - 사진: main=imageSlots.main_photo / after=imageSlots.after_photo(없으면 베이스=현재 사진) / before=state.secondImg.
     focal/zoom 은 S4 가 기록한 slot 값을 읽기만 한다(S4 무수정).
   - throw 0 — 실패해도 배경만 칠하고 조용히 끝낸다.
*/
(function () {
  'use strict';
  if (window.PhotoEditorBeautyPack) return;

  // ── 공용 프리미티브(최소) ─────────────────────────────
  function _rr(ctx, x, y, w, h, r) {
    r = Math.min(r || 0, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function _pal(data) {
    var p = (data && data.palette) || {};
    return {
      bg: p.bg || '#F4F4F4', ink: p.ink || '#222', sub: p.sub || '#888',
      accent: p.accent || '#C9A24B', line: p.line || '#DDD', badge: p.badge || p.accent || '#C9A24B',
    };
  }
  // cover-crop(focal/zoom) — premium-templates _coverCrop 와 동일 규칙.
  function _coverDraw(ctx, img, x, y, w, h, focal, zoom) {
    var iw = img && (img.naturalWidth || img.width), ih = img && (img.naturalHeight || img.height);
    if (!iw || !ih) return false;
    var fx = (focal && isFinite(focal.x)) ? Math.max(0, Math.min(1, focal.x)) : 0.5;
    var fy = (focal && isFinite(focal.y)) ? Math.max(0, Math.min(1, focal.y)) : 0.5;
    var z = (isFinite(zoom) && zoom > 1) ? zoom : 1;
    var sAR = iw / ih, dAR = w / h, sw, sh;
    if (sAR > dAR) { sh = ih; sw = sh * dAR; } else { sw = iw; sh = sw / dAR; }
    sw /= z; sh /= z;
    var sx = Math.max(0, Math.min(iw - sw, (iw - sw) * fx));
    var sy = Math.max(0, Math.min(ih - sh, (ih - sh) * fy));
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    return true;
  }
  function _slotImg(src) {
    if (!src) return null;
    var c = _slotImg._cache || (_slotImg._cache = {});
    var hit = c[src];
    if (hit) return hit.ready ? hit.img : null;
    var img = new Image();
    var rec = { img: img, ready: false };
    c[src] = rec;
    img.onload = function () {
      rec.ready = true;
      try {
        var PE = window.PhotoEditor, h = PE && PE._internal && PE._internal.helpers;
        if (h && h.scheduleRedraw) h.scheduleRedraw();
      } catch (_e) { void _e; }
    };
    img.src = src;
    return null;
  }
  function _text(ctx, s, x, y, font, color, align) {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align || 'left';
    ctx.fillText(String(s == null ? '' : s), x, y);
  }
  // 사진 존: src 있으면 cover-draw, 없으면 점선 아웃라인 + 라벨(흐름 증명용).
  function _photoZone(ctx, img, x, y, w, h, c, label) {
    ctx.save();
    _rr(ctx, x, y, w, h, 18); ctx.clip();
    var drew = img ? _coverDraw(ctx, img, x, y, w, h, img._focal, img._zoom) : false;
    if (!drew) { ctx.fillStyle = c.line; ctx.fillRect(x, y, w, h); }
    ctx.restore();
    ctx.save();
    ctx.setLineDash([10, 8]); ctx.strokeStyle = c.accent; ctx.lineWidth = 2;
    _rr(ctx, x, y, w, h, 18); ctx.stroke();
    if (!drew) _text(ctx, label || '사진', x + w / 2, y + h / 2, '600 26px Noto Sans KR, sans-serif', c.sub, 'center');
    ctx.restore();
  }
  function _zone(ctx, x, y, w, h, c, label) {
    ctx.save();
    ctx.setLineDash([6, 6]); ctx.strokeStyle = c.line; ctx.lineWidth = 1.5;
    _rr(ctx, x, y, w, h, 12); ctx.stroke();
    if (label) _text(ctx, label, x + 12, y + 26, '500 18px Noto Sans KR, sans-serif', c.sub, 'left');
    ctx.restore();
  }
  function _watermark(ctx, dw, dh, id, c) {
    _text(ctx, 'SKELETON · ' + id, dw / 2, dh - 28, '600 20px Noto Sans KR, sans-serif', c.sub, 'center');
  }

  function _resolveAfter(state, tpl) {
    var slot = tpl && tpl.imageSlots && tpl.imageSlots.after_photo;
    var img = _slotImg(slot && slot.src);
    if (!img) { var base = state && (state.editedImg || state.originalImg || state.img); if (base) img = base; }
    if (img && slot) { img._focal = slot.focal; img._zoom = slot.zoom; }
    return img;
  }
  function _resolveMain(tpl) {
    var slot = tpl && tpl.imageSlots && tpl.imageSlots.main_photo;
    var img = _slotImg(slot && slot.src);
    if (img && slot) { img._focal = slot.focal; img._zoom = slot.zoom; }
    return img;
  }

  // ── skeleton 1 · 블랙골드 가격표 ─────────────────────
  function _skBlackGold(ctx, dw, dh, state, tpl, data, c) {
    ctx.fillStyle = c.bg; ctx.fillRect(0, 0, dw, dh);
    ctx.save(); ctx.strokeStyle = c.line; ctx.lineWidth = 2; _rr(ctx, dw * 0.022, dh * 0.018, dw * 0.956, dh * 0.964, 16); ctx.stroke(); ctx.restore();
    // 엠블럼 존
    _zone(ctx, dw * 0.24, dh * 0.045, dw * 0.12, dh * 0.085, c, '엠블럼');
    _text(ctx, data.shop || '샵명', dw * 0.30, dh * 0.16, '700 30px Noto Serif KR, serif', c.ink, 'center');
    _text(ctx, data.head || '헤드라인', dw * 0.36, dh * 0.215, '700 46px Noto Serif KR, serif', c.ink, 'center');
    // 우측 인물 사진
    _photoZone(ctx, _resolveMain(tpl), dw * 0.58, dh * 0.06, dw * 0.40, dh * 0.56, c, '인물 사진');
    // 가격 행(services 개수만큼 라인)
    var svc = (data.services && data.services.length) ? data.services : [0, 0, 0, 0];
    var n = Math.min(svc.length, 6), top = dh * 0.37, rowH = (dh * 0.80 - top) / n;
    for (var i = 0; i < n; i++) {
      var ry = top + i * rowH;
      _text(ctx, '0' + (i + 1), dw * 0.055, ry + rowH * 0.55, '700 30px Playfair Display, serif', c.accent, 'left');
      _text(ctx, (svc[i] && svc[i].name) || ('시술 ' + (i + 1)), dw * 0.12, ry + rowH * 0.42, '700 28px Noto Serif KR, serif', c.ink, 'left');
      _text(ctx, (svc[i] && svc[i].price) || '0원', dw * 0.56, ry + rowH * 0.5, '700 30px Noto Sans KR, sans-serif', c.accent, 'right');
      ctx.save(); ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(dw * 0.055, ry + rowH); ctx.lineTo(dw * 0.58, ry + rowH); ctx.stroke(); ctx.restore();
    }
    // CTA
    ctx.fillStyle = c.accent; _rr(ctx, dw * 0.18, dh * 0.84, dw * 0.64, dh * 0.075, 50); ctx.fill();
    _text(ctx, data.cta || '예약', dw / 2, dh * 0.888, '700 30px Noto Sans KR, sans-serif', c.bg, 'center');
    _text(ctx, data.phone || '', dw / 2, dh * 0.95, '500 22px Noto Sans KR, sans-serif', c.accent, 'center');
  }

  // ── skeleton 2 · 네일 폴라로이드 전후 ────────────────
  function _skNailPolaroid(ctx, dw, dh, state, tpl, data, c) {
    ctx.fillStyle = c.bg; ctx.fillRect(0, 0, dw, dh);
    _text(ctx, data.shop || '루미네일', dw / 2, dh * 0.085, '700 30px Gaegu, sans-serif', c.accent, 'center');
    _text(ctx, ((data.headlineAccent || '') + ' ' + (data.head || '전후 변화')).trim(), dw / 2, dh * 0.17, '700 56px Black Han Sans, sans-serif', c.ink, 'center');
    _text(ctx, data.sub || '', dw / 2, dh * 0.225, '400 28px Gowun Dodum, sans-serif', c.ink, 'center');
    var before = state && state.secondImg ? state.secondImg : null;
    if (before && tpl.imageSlots && tpl.imageSlots.before_photo) { before._focal = tpl.imageSlots.before_photo.focal; before._zoom = tpl.imageSlots.before_photo.zoom; }
    // BEFORE 폴라로이드 −5°
    ctx.save(); ctx.translate(dw * 0.28, dh * 0.46); ctx.rotate(-0.0873);
    ctx.fillStyle = '#fff'; _rr(ctx, -dw * 0.195, -dh * 0.17, dw * 0.39, dh * 0.35, 10); ctx.fill();
    _photoZone(ctx, before, -dw * 0.175, -dh * 0.15, dw * 0.35, dh * 0.265, c, 'BEFORE 사진');
    _text(ctx, 'BEFORE', 0, dh * 0.135, '400 34px Nanum Pen Script, cursive', c.ink, 'center');
    ctx.restore();
    // AFTER 폴라로이드 +5°
    ctx.save(); ctx.translate(dw * 0.71, dh * 0.61); ctx.rotate(0.0873);
    ctx.fillStyle = '#fff'; _rr(ctx, -dw * 0.205, -dh * 0.18, dw * 0.41, dh * 0.37, 10); ctx.fill();
    _photoZone(ctx, _resolveAfter(state, tpl), -dw * 0.185, -dh * 0.16, dw * 0.37, dh * 0.28, c, 'AFTER 사진');
    _text(ctx, 'AFTER', 0, dh * 0.145, '400 48px Nanum Pen Script, cursive', c.badge, 'center');
    ctx.restore();
    // 찢긴 메모 + CTA
    _zone(ctx, dw * 0.04, dh * 0.42, dw * 0.20, dh * 0.10, c, '메모');
    ctx.fillStyle = c.accent; _rr(ctx, dw * 0.33, dh * 0.85, dw * 0.34, dh * 0.07, 45); ctx.fill();
    _text(ctx, data.cta || 'DM / 예약문의 ♡', dw / 2, dh * 0.895, '700 28px Gowun Dodum, sans-serif', '#fff', 'center');
  }

  // ── skeleton 3 · 속눈썹 후기 카드 ────────────────────
  function _skLashReview(ctx, dw, dh, state, tpl, data, c) {
    ctx.fillStyle = c.bg; ctx.fillRect(0, 0, dw, dh);
    _text(ctx, data.shop || '모어래쉬', dw / 2, dh * 0.095, '500 26px Noto Serif KR, serif', c.accent, 'center');
    _text(ctx, data.head || '속눈썹 후기', dw / 2, dh * 0.19, '700 64px Noto Serif KR, serif', c.ink, 'center');
    _text(ctx, data.sub || '', dw / 2, dh * 0.245, '400 22px Noto Sans KR, sans-serif', c.sub, 'center');
    // 카드
    ctx.save(); ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.86; _rr(ctx, dw * 0.065, dh * 0.28, dw * 0.87, dh * 0.50, 28); ctx.fill(); ctx.restore();
    // 서클 포토
    var main = _resolveMain(tpl), cx = dw * 0.28, cy = dh * 0.475, r = dw * 0.16;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    if (!(main && _coverDraw(ctx, main, cx - r, cy - r, r * 2, r * 2, main._focal, main._zoom))) { ctx.fillStyle = c.line; ctx.fillRect(cx - r, cy - r, r * 2, r * 2); }
    ctx.restore();
    ctx.save(); ctx.strokeStyle = c.accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    if (!main) _text(ctx, '사진', cx, cy, '600 24px Noto Sans KR, sans-serif', c.sub, 'center');
    // 인용문
    _text(ctx, '“', dw * 0.52, dh * 0.37, '700 70px Noto Serif KR, serif', c.accent, 'left');
    _zone(ctx, dw * 0.52, dh * 0.35, dw * 0.38, dh * 0.18, c, '후기 문구');
    // 3컬럼
    var cols = [[data.customer || '고객님', '고객님'], [data.serviceName || '시술 항목', '시술 항목'], [data.reviewDate || '날짜', '시술 날짜']];
    for (var i = 0; i < 3; i++) {
      var col = cols[i], colx = dw * (0.22 + i * 0.29);
      _text(ctx, col[0], colx, dh * 0.68, '700 24px Noto Sans KR, sans-serif', c.ink, 'center');
      _text(ctx, col[1], colx, dh * 0.71, '400 15px Noto Sans KR, sans-serif', c.sub, 'center');
    }
    _text(ctx, '★★★★★', dw / 2, dh * 0.83, '400 34px serif', c.accent, 'center');
    ctx.fillStyle = c.accent; _rr(ctx, dw * 0.33, dh * 0.88, dw * 0.34, dh * 0.07, 45); ctx.fill();
    _text(ctx, data.cta || '상담 / 예약', dw / 2, dh * 0.925, '700 28px Gowun Dodum, sans-serif', '#fff', 'center');
  }

  var ROUTES = {
    'bp-price-blackgold': _skBlackGold,
    'bp-ba-nail-polaroid': _skNailPolaroid,
    'bp-review-lash-blue': _skLashReview,
  };

  function draw(ctx, dw, dh, state, tpl, data) {
    try {
      var id = (tpl && tpl.id) || '';
      var c = _pal(data);
      var fn = ROUTES[id];
      if (fn) fn(ctx, dw, dh, state, tpl, data, c);
      else { ctx.fillStyle = c.bg; ctx.fillRect(0, 0, dw, dh); }
      _watermark(ctx, dw, dh, id, c);
    } catch (e) {
      try { console.warn('[beauty-pack] skeleton draw failed', e); } catch (_l) { void _l; }
      try { ctx.fillStyle = '#F4F4F4'; ctx.fillRect(0, 0, dw, dh); } catch (_e) { void _e; }
    }
  }

  window.PhotoEditorBeautyPack = { draw: draw };
})();
