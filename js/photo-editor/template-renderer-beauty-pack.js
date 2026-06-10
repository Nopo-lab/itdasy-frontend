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
  // 4점 스파클(공용 — 리뷰/SNS팩).
  function _sparkle(ctx, cx, cy, s, color) {
    ctx.save(); ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(cx, cy - s); ctx.quadraticCurveTo(cx, cy, cx + s, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy + s); ctx.quadraticCurveTo(cx, cy, cx - s, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy - s); ctx.fill(); ctx.restore();
  }

  // ── 골드팩 프리미티브 ────────────────────────────────
  function _fitLine(ctx, s, cx, y, maxW, size, family, color) {
    s = String(s == null ? '' : s);
    var fs = size;
    do { ctx.font = '700 ' + fs + 'px ' + family; if (ctx.measureText(s).width <= maxW || fs <= 18) break; fs -= 2; } while (fs > 18);
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.fillText(s, cx, y);
  }
  function _strike(ctx, s, xRight, y, font, color) {
    ctx.save(); ctx.font = font; var w = ctx.measureText(String(s)).width;
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(xRight - w, y - 7); ctx.lineTo(xRight, y - 7); ctx.stroke(); ctx.restore();
  }
  function _photoArch(ctx, img, x, y, w, h, c, r) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
    ctx.clip();
    if (img) { img._focal = img._focal; if (!_coverDraw(ctx, img, x, y, w, h, img._focal, img._zoom)) { ctx.fillStyle = c.line; ctx.fillRect(x, y, w, h); } }
    else { ctx.fillStyle = c.line; ctx.fillRect(x, y, w, h); _text(ctx, '인물 사진', x + w / 2, y + h / 2, '600 26px "Noto Sans KR", sans-serif', c.sub, 'center'); }
    ctx.restore();
  }
  function _goldEmblem(ctx, cx, cy, s, letter, c) {
    ctx.save(); ctx.strokeStyle = c.accent; ctx.lineWidth = 1.6;
    _rr(ctx, cx - s / 2, cy - s / 2, s, s, s * 0.18); ctx.stroke();
    _rr(ctx, cx - s / 2 + 5, cy - s / 2 + 5, s - 10, s - 10, s * 0.14); ctx.lineWidth = 0.8; ctx.stroke();
    ctx.restore();
    _text(ctx, letter, cx, cy + s * 0.18, '700 ' + Math.round(s * 0.5) + 'px "Playfair Display", serif', c.accent, 'center');
  }
  function _ribbon(ctx, x, y, label, c) {
    ctx.save(); ctx.font = '700 13px "Noto Sans KR", sans-serif';
    var w = ctx.measureText(label).width + 22;
    var g = ctx.createLinearGradient(x, y, x + w, y); g.addColorStop(0, '#E3C77A'); g.addColorStop(1, '#C9A24B');
    ctx.fillStyle = g; _rr(ctx, x, y, w, 24, 4); ctx.fill();
    ctx.fillStyle = '#1B140A'; ctx.textAlign = 'left'; ctx.fillText(label, x + 11, y + 17); ctx.restore();
  }
  function _goldPill(ctx, x, y, w, h, c) {
    ctx.save(); var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#E7CE8C'); g.addColorStop(0.5, '#C9A24B'); g.addColorStop(1, '#9C7A33');
    ctx.shadowColor = 'rgba(201,162,75,0.4)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
    ctx.fillStyle = g; _rr(ctx, x, y, w, h, h / 2); ctx.fill(); ctx.restore();
  }
  function _kakaoChip(ctx, cx, cy, c) {
    ctx.save(); ctx.fillStyle = '#3A2A18'; ctx.beginPath(); ctx.arc(cx, cy, 19, 0, Math.PI * 2); ctx.fill();
    _text(ctx, 'TALK', cx, cy + 4, '700 11px "Noto Sans KR", sans-serif', '#F3E9D6', 'center'); ctx.restore();
  }


  // ── 핑크 SNS팩 프리미티브 ────────────────────────────
  function _heartPath(ctx, cx, cy, s) {
    ctx.beginPath(); ctx.moveTo(cx, cy + s * 0.72);
    ctx.bezierCurveTo(cx - s * 1.1, cy - s * 0.2, cx - s * 0.5, cy - s * 1.0, cx, cy - s * 0.32);
    ctx.bezierCurveTo(cx + s * 0.5, cy - s * 1.0, cx + s * 1.1, cy - s * 0.2, cx, cy + s * 0.72); ctx.closePath();
  }
  function _heart(ctx, cx, cy, s, fill, stroke) {
    ctx.save(); _heartPath(ctx, cx, cy, s);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2.5; ctx.stroke(); } ctx.restore();
  }
  function _gemHeart(ctx, cx, cy, s, color) {
    ctx.save(); _heartPath(ctx, cx, cy, s); ctx.clip();
    var g = ctx.createLinearGradient(cx - s, cy - s, cx + s, cy + s); g.addColorStop(0, '#FBD3E0'); g.addColorStop(0.5, color); g.addColorStop(1, '#E0356F');
    ctx.fillStyle = g; ctx.fillRect(cx - s * 1.2, cy - s * 1.2, s * 2.4, s * 2.4);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.3); ctx.lineTo(cx, cy + s * 0.7); ctx.moveTo(cx - s * 0.7, cy); ctx.lineTo(cx + s * 0.7, cy); ctx.stroke(); ctx.restore();
  }
  function _outlinePill(ctx, cx, cy, w, h, color) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2; _rr(ctx, cx - w / 2, cy - h / 2, w, h, h / 2); ctx.stroke(); ctx.restore();
  }
  function _brushUnderline(ctx, x1, x2, y, color) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.bezierCurveTo(x1 + (x2 - x1) * 0.3, y - 6, x1 + (x2 - x1) * 0.7, y + 5, x2, y - 2); ctx.stroke(); ctx.restore();
  }
  function _brushHighlight(ctx, x, y, w, h, color) {
    ctx.save(); ctx.fillStyle = color; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.moveTo(x, y + h * 0.5);
    ctx.quadraticCurveTo(x, y, x + w * 0.04, y); ctx.lineTo(x + w * 0.97, y - 3);
    ctx.quadraticCurveTo(x + w, y, x + w, y + h * 0.5); ctx.quadraticCurveTo(x + w, y + h, x + w * 0.95, y + h);
    ctx.lineTo(x + w * 0.03, y + h + 2); ctx.quadraticCurveTo(x, y + h, x, y + h * 0.5); ctx.fill(); ctx.restore();
  }
  function _paperclip(ctx, cx, cy, color) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 8, cy + 28); ctx.lineTo(cx - 8, cy - 20); ctx.arc(cx, cy - 20, 8, Math.PI, 0); ctx.lineTo(cx + 8, cy + 20); ctx.arc(cx + 2, cy + 20, 6, 0, Math.PI); ctx.lineTo(cx - 4, cy - 14); ctx.stroke(); ctx.restore();
  }
  function _washiTape(ctx, cx, cy, w, h, rot, color, label) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.fillStyle = color;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    if (label) _text(ctx, label, 0, 5, '700 16px "Nanum Pen Script", cursive', '#7A2E48', 'center'); ctx.restore();
  }
  function _tornPaper(ctx, x, y, w, h, color, ink, lines) {
    ctx.save(); ctx.fillStyle = color; ctx.shadowColor = 'rgba(0,0,0,0.1)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    ctx.beginPath(); var n = 8, sx = w / n; ctx.moveTo(x, y + 4);
    for (var i = 0; i <= n; i++) ctx.lineTo(x + i * sx, y + ((i % 2) ? 0 : 7));
    ctx.lineTo(x + w, y + h - 4);
    for (var j = n; j >= 0; j--) ctx.lineTo(x + j * sx, y + h - ((j % 2) ? 7 : 0));
    ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.save(); ctx.fillStyle = ink; ctx.font = '400 24px "Nanum Pen Script", cursive'; ctx.textAlign = 'left';
    (lines || []).forEach(function (ln, k) { ctx.fillText(ln, x + 14, y + 36 + k * 30); }); ctx.restore();
  }
  function _chipPill(ctx, x, y, w, h, text, c) {
    ctx.save(); ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = c.line; ctx.lineWidth = 2; _rr(ctx, x, y, w, h, h / 2); ctx.fill(); ctx.stroke(); ctx.restore();
    _heart(ctx, x + h * 0.55, y + h / 2, h * 0.18, c.accent, null);
    _text(ctx, text, x + h * 0.95, y + h * 0.64, '700 22px "Gowun Dodum", sans-serif', '#5A4248', 'left');
  }
  function _pinkPill(ctx, x, y, w, h, c) {
    ctx.save(); var g = ctx.createLinearGradient(x, y, x + w, y); g.addColorStop(0, '#F2789F'); g.addColorStop(1, '#EC4E86');
    ctx.shadowColor = 'rgba(236,78,134,0.35)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4; ctx.fillStyle = g; _rr(ctx, x, y, w, h, h / 2); ctx.fill(); ctx.restore();
  }
  function _polaroid(ctx, cx, cy, w, h, rot, img, label, labelSize, labelColor, c, deco) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
    var pad = w * 0.05, capH = h * 0.16;
    ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 18; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 9;
    ctx.fillStyle = '#FFFFFF'; _rr(ctx, -w / 2, -h / 2, w, h, 8); ctx.fill();
    ctx.shadowColor = 'transparent';
    var px = -w / 2 + pad, py = -h / 2 + pad, pw = w - pad * 2, ph = h - pad - capH;
    ctx.save(); _rr(ctx, px, py, pw, ph, 2); ctx.clip();
    if (!(img && _coverDraw(ctx, img, px, py, pw, ph, img._focal, img._zoom))) { ctx.fillStyle = '#EFE2E6'; ctx.fillRect(px, py, pw, ph); _text(ctx, '＋ 사진', 0, py + ph / 2, '600 24px "Noto Sans KR", sans-serif', '#B79AA2', 'center'); }
    ctx.restore();
    _text(ctx, label, 0, h / 2 - capH * 0.3, '400 ' + labelSize + 'px "Nanum Pen Script", cursive', labelColor, 'center');
    if (deco && deco.tape) _washiTape(ctx, -w / 2 + pw * 0.18, -h / 2 - 4, w * 0.42, 50, -0.32, 'rgba(242,140,170,0.6)', deco.tapeLabel);
    if (deco && deco.clip) _paperclip(ctx, 0, -h / 2 + 6, '#B9C0C9');
    ctx.restore();
  }


  // 말풍선 메모(흰 둥근 사각 + 꼬리) — 핑크 SNS팩 코너 노트용.
  function _speechNote(ctx, cx, cy, w, h, text, c) {
    ctx.save();
    ctx.shadowColor = 'rgba(236,78,134,0.18)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = c.accent || '#F2789F'; ctx.lineWidth = 2;
    _rr(ctx, cx - w / 2, cy - h / 2, w, h, h / 2); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.16, cy + h / 2 - 2); ctx.lineTo(cx - w * 0.28, cy + h / 2 + h * 0.5); ctx.lineTo(cx - w * 0.02, cy + h / 2 - 2); ctx.closePath();
    ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = c.accent || '#F2789F'; ctx.stroke();
    ctx.restore();
    _text(ctx, text, cx, cy + 6, '400 19px "Nanum Pen Script", cursive', '#E07FA0', 'center');
  }


  // ── 블루 리뷰팩 프리미티브 ───────────────────────────
  function _blob(ctx, cx, cy, r, color, a) {
    ctx.save(); ctx.globalAlpha = a; var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function _flower(ctx, cx, cy, r, color) {
    ctx.save(); ctx.fillStyle = color; ctx.globalAlpha = 0.7;
    for (var i = 0; i < 5; i++) { var a = i * 2 * Math.PI / 5; ctx.save(); ctx.translate(cx, cy); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(0, -r * 0.6, r * 0.34, r * 0.62, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    ctx.globalAlpha = 0.9; ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.24, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function _softCard(ctx, x, y, w, h, r) {
    ctx.save(); ctx.shadowColor = 'rgba(80,110,140,0.18)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
    ctx.fillStyle = 'rgba(255,255,255,0.88)'; _rr(ctx, x, y, w, h, r); ctx.fill(); ctx.restore();
  }
  function _star(ctx, cx, cy, r, color) {
    ctx.save(); ctx.fillStyle = color; ctx.beginPath();
    for (var i = 0; i < 5; i++) { var a = -Math.PI / 2 + i * 2 * Math.PI / 5; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); var a2 = a + Math.PI / 5; ctx.lineTo(cx + Math.cos(a2) * r * 0.45, cy + Math.sin(a2) * r * 0.45); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function _stars(ctx, cx, cy, n, r, gap, color) { var x = cx - (n - 1) * gap / 2; for (var i = 0; i < n; i++) _star(ctx, x + i * gap, cy, r, color); }
  function _lineIcon(ctx, type, cx, cy, s, color) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.fillStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (type === 'person') { ctx.beginPath(); ctx.arc(cx, cy - s * 0.25, s * 0.26, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy + s * 0.55, s * 0.5, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
    else if (type === 'lash') { ctx.beginPath(); ctx.arc(cx, cy + s * 0.1, s * 0.55, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); for (var i = 0; i < 5; i++) { var a = Math.PI * (1.2 + i * 0.15); var x1 = cx + Math.cos(a) * s * 0.55, y1 = cy + s * 0.1 + Math.sin(a) * s * 0.55; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + Math.cos(a) * s * 0.3, y1 + Math.sin(a) * s * 0.3); ctx.stroke(); } }
    else if (type === 'calendar') { _rr(ctx, cx - s * 0.45, cy - s * 0.4, s * 0.9, s * 0.8, 4); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.45, cy - s * 0.15); ctx.lineTo(cx + s * 0.45, cy - s * 0.15); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.2, cy - s * 0.55); ctx.lineTo(cx - s * 0.2, cy - s * 0.3); ctx.moveTo(cx + s * 0.2, cy - s * 0.55); ctx.lineTo(cx + s * 0.2, cy - s * 0.3); ctx.stroke(); }
    else if (type === 'chat') { _rr(ctx, cx - s * 0.5, cy - s * 0.4, s, s * 0.7, s * 0.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.15, cy + s * 0.3); ctx.lineTo(cx - s * 0.3, cy + s * 0.5); ctx.lineTo(cx - s * 0.02, cy + s * 0.3); ctx.stroke(); }
    ctx.restore();
  }


  // ── 전후팩 공용 프리미티브(둥근 사진 카드 + 라벨 pill) ──
  function _labelPill(ctx, x, y, w, h, text, bg, fg) {
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    ctx.fillStyle = bg; _rr(ctx, x, y, w, h, h / 2); ctx.fill(); ctx.restore();
    _text(ctx, text, x + w / 2, y + h * 0.68, '700 ' + Math.round(h * 0.46) + 'px "Noto Sans KR", sans-serif', fg, 'center');
  }
  // 흰 테두리 둥근 사진 카드(cover crop) + 상단 코너 라벨. 폴라로이드와 달리 깔끔한 매거진 카드.
  function _photoLabeled(ctx, img, x, y, w, h, r, label, labelBg, align, c) {
    ctx.save(); ctx.shadowColor = 'rgba(180,120,140,0.22)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#FFFFFF'; _rr(ctx, x, y, w, h, r); ctx.fill(); ctx.restore();
    ctx.save(); _rr(ctx, x, y, w, h, r); ctx.clip();
    if (!(img && _coverDraw(ctx, img, x, y, w, h, img._focal, img._zoom))) {
      ctx.fillStyle = c.line; ctx.fillRect(x, y, w, h);
      _text(ctx, '＋ 사진', x + w / 2, y + h / 2, '600 22px "Noto Sans KR", sans-serif', c.sub, 'center');
    }
    ctx.restore();
    var lw = w * 0.46, lh = h * 0.12, lx = (align === 'right') ? x + w - lw - w * 0.05 : x + w * 0.05, ly = y + h * 0.05;
    _labelPill(ctx, lx, ly, lw, lh, label, labelBg, '#FFFFFF');
  }

  // ── 프리미티브 키트 export — id별 드로 함수는 template-renderer-beauty-pack-draws.js 가 _register 로 등록 ──
  var _KIT = {
    _rr: _rr,     _pal: _pal,     _coverDraw: _coverDraw,     _slotImg: _slotImg,
    _text: _text,     _photoZone: _photoZone,     _zone: _zone,     _watermark: _watermark,
    _resolveAfter: _resolveAfter,     _resolveMain: _resolveMain,     _sparkle: _sparkle,     _fitLine: _fitLine,
    _strike: _strike,     _photoArch: _photoArch,     _goldEmblem: _goldEmblem,     _ribbon: _ribbon,
    _goldPill: _goldPill,     _kakaoChip: _kakaoChip,     _heartPath: _heartPath,     _heart: _heart,
    _gemHeart: _gemHeart,     _outlinePill: _outlinePill,     _brushUnderline: _brushUnderline,     _brushHighlight: _brushHighlight,
    _paperclip: _paperclip,     _washiTape: _washiTape,     _tornPaper: _tornPaper,     _chipPill: _chipPill,
    _pinkPill: _pinkPill,     _polaroid: _polaroid,     _speechNote: _speechNote,     _blob: _blob,
    _flower: _flower,     _softCard: _softCard,     _star: _star,     _stars: _stars,
    _lineIcon: _lineIcon,     _labelPill: _labelPill,     _photoLabeled: _photoLabeled,
  };
  var ROUTES = {}, DONE = {};
  function register(id, fn, done) {
    if (!id || typeof fn !== 'function') return;
    ROUTES[id] = fn; if (done) DONE[id] = true;
  }

  function draw(ctx, dw, dh, state, tpl, data) {
    try {
      var id = (tpl && tpl.id) || '';
      var c = _pal(data);
      var fn = ROUTES[id];
      if (fn) fn(ctx, dw, dh, state, tpl, data, c);
      else { ctx.fillStyle = c.bg; ctx.fillRect(0, 0, dw, dh); }
      if (!DONE[id]) _watermark(ctx, dw, dh, id, c);
    } catch (e) {
      try { console.warn('[beauty-pack] skeleton draw failed', e); } catch (_l) { void _l; }
      try { ctx.fillStyle = '#F4F4F4'; ctx.fillRect(0, 0, dw, dh); } catch (_e) { void _e; }
    }
  }

  window.PhotoEditorBeautyPack = { draw: draw, _kit: _KIT, _register: register };
})();
