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

  // ── 1 · 블랙골드 프리미엄 가격표 (ref ⑲) ─────────────
  function _skBlackGold(ctx, dw, dh, state, tpl, data, c) {
    var sv = (tpl && tpl.slotValues) || {};
    // 배경: 다크 라디얼 + 상단 골드 광선
    var g = ctx.createRadialGradient(dw * 0.5, dh * 0.30, dw * 0.08, dw * 0.5, dh * 0.5, dw * 0.85);
    g.addColorStop(0, '#1C1712'); g.addColorStop(1, '#0C0A07');
    ctx.fillStyle = g; ctx.fillRect(0, 0, dw, dh);
    var lg = ctx.createLinearGradient(0, 0, dw * 0.7, dh * 0.2);
    lg.addColorStop(0, 'rgba(201,162,75,0.16)'); lg.addColorStop(1, 'rgba(201,162,75,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, dw, dh * 0.24);
    // 인셋 프레임(이중 골드)
    ctx.save(); ctx.strokeStyle = '#3A3024'; ctx.lineWidth = 1.5; _rr(ctx, dw * 0.022, dh * 0.018, dw * 0.956, dh * 0.964, 14); ctx.stroke();
    ctx.strokeStyle = 'rgba(201,162,75,0.4)'; ctx.lineWidth = 1; _rr(ctx, dw * 0.03, dh * 0.026, dw * 0.94, dh * 0.948, 12); ctx.stroke(); ctx.restore();
    // 우측 인물 사진(먼저 → 가격 숫자가 위로 겹침)
    _photoArch(ctx, _resolveMain(tpl), dw * 0.55, dh * 0.072, dw * 0.45, dh * 0.52, c, dw * 0.05);
    // 좌측 가독성 스크림
    var sc = ctx.createLinearGradient(dw * 0.45, 0, dw * 0.72, 0);
    sc.addColorStop(0, 'rgba(12,10,7,0.92)'); sc.addColorStop(1, 'rgba(12,10,7,0)');
    ctx.fillStyle = sc; ctx.fillRect(dw * 0.45, dh * 0.30, dw * 0.30, dh * 0.52);
    // 브랜드(좌중앙 상단)
    var bx = dw * 0.40;
    _goldEmblem(ctx, bx, dh * 0.072, dw * 0.085, (data.shop || 'S').slice(0, 1), c);
    _text(ctx, data.shop || '샵명', bx, dh * 0.128, '700 28px "Noto Serif KR", serif', c.accent, 'center');
    if (sv.shop_name_en) _text(ctx, sv.shop_name_en, bx, dh * 0.153, '700 14px "Playfair Display", serif', c.sub, 'center');
    _fitLine(ctx, data.head || '프리미엄 케어 프로그램', bx, dh * 0.213, dw * 0.62, 50, '"Noto Serif KR", serif', c.ink);
    _text(ctx, data.sub || '고객 맞춤 집중 관리', bx, dh * 0.255, '400 22px "Noto Serif KR", serif', c.sub, 'center');
    // 컬럼 헤더
    _text(ctx, '정상가', dw * 0.70, dh * 0.315, '500 17px "Noto Sans KR", sans-serif', c.sub, 'right');
    _text(ctx, '이벤트가', dw * 0.925, dh * 0.315, '700 17px "Noto Sans KR", sans-serif', c.accent, 'right');
    // 가격 행
    var svc = (data.services && data.services.length) ? data.services : [{}, {}, {}, {}];
    var n = Math.max(1, Math.min(svc.length, 6)), top = dh * 0.345, rowH = (dh * 0.80 - top) / n;
    for (var i = 0; i < n; i++) {
      var s = svc[i] || {}, ry = top + i * rowH, mid = ry + rowH * 0.5;
      ctx.save(); ctx.strokeStyle = 'rgba(201,162,75,0.5)'; ctx.lineWidth = 1.2; _rr(ctx, dw * 0.05, mid - dh * 0.026, dw * 0.06, dh * 0.052, 6); ctx.stroke(); ctx.restore();
      _text(ctx, '0' + (i + 1), dw * 0.08, mid + 10, 'italic 700 28px "Playfair Display", serif', c.accent, 'center');
      if (s.badge) _ribbon(ctx, dw * 0.135, ry + rowH * 0.13, s.badge, c);
      _text(ctx, s.name || ('시술 ' + (i + 1)), dw * 0.135, mid - (s.desc ? 4 : -8), '700 27px "Noto Serif KR", serif', c.ink, 'left');
      if (s.desc) _text(ctx, s.desc, dw * 0.135, mid + 22, '400 16px "Noto Sans KR", sans-serif', c.sub, 'left');
      var orig = s.origPrice || s.price || '', struck = !!(s.origPrice && s.origPrice !== s.price);
      if (orig) { _text(ctx, orig, dw * 0.70, mid + 8, '400 21px "Noto Sans KR", sans-serif', c.sub, 'right'); if (struck) _strike(ctx, orig, dw * 0.70, mid + 8, '400 21px "Noto Sans KR", sans-serif', c.sub); }
      _text(ctx, s.price || '', dw * 0.925, mid + 10, '700 30px "Noto Sans KR", sans-serif', c.accent, 'right');
      ctx.save(); ctx.strokeStyle = 'rgba(201,162,75,0.22)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(dw * 0.05, ry + rowH); ctx.lineTo(dw * 0.925, ry + rowH); ctx.stroke(); ctx.restore();
    }
    // CTA + 전화
    _goldPill(ctx, dw * 0.16, dh * 0.85, dw * 0.68, dh * 0.062, c);
    _kakaoChip(ctx, dw * 0.27, dh * 0.881, c);
    _text(ctx, data.cta || '카카오 예약', dw * 0.55, dh * 0.888, '700 28px "Noto Sans KR", sans-serif', '#1B140A', 'center');
    _text(ctx, sv.phone || data.phone || '', dw * 0.5, dh * 0.95, '500 22px "Noto Sans KR", sans-serif', c.accent, 'center');
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

  // ── 2 · 네일 SNS 전후 폴라로이드 (ref ㉒) · 최난이도 ──
  function _skNailPolaroid(ctx, dw, dh, state, tpl, data, c) {
    var sv = (tpl && tpl.slotValues) || {};
    var g = ctx.createLinearGradient(0, 0, 0, dh); g.addColorStop(0, '#FFF1F6'); g.addColorStop(1, '#FCDDE9');
    ctx.fillStyle = g; ctx.fillRect(0, 0, dw, dh);
    _blob(ctx, dw * 0.17, dh * 0.22, dw * 0.26, '#FFFFFF', 0.5); _blob(ctx, dw * 0.82, dh * 0.4, dw * 0.3, '#FFFFFF', 0.45); _blob(ctx, dw * 0.3, dh * 0.78, dw * 0.28, '#FFE3EE', 0.5);
    _gemHeart(ctx, dw * 0.085, dh * 0.11, 36, '#F48FB1'); _gemHeart(ctx, dw * 0.93, dh * 0.88, 40, '#F48FB1');
    var spk = [[0.14, 0.09], [0.40, 0.11], [0.9, 0.32], [0.11, 0.42], [0.92, 0.57], [0.53, 0.19], [0.88, 0.73]];
    spk.forEach(function (s, i) { _sparkle(ctx, dw * s[0], dh * s[1], 10 + (i % 3) * 6, i % 2 ? '#F2789F' : '#FFFFFF'); });
    _heart(ctx, dw * 0.24, dh * 0.085, 11, null, '#F2789F'); _heart(ctx, dw * 0.84, dh * 0.23, 13, '#F8B5CC', null); _heart(ctx, dw * 0.14, dh * 0.74, 12, null, '#F2789F');
    // 로고
    _outlinePill(ctx, dw / 2, dh * 0.072, dw * 0.30, dh * 0.05, '#F2789F');
    _text(ctx, data.shop || '루미네일', dw / 2, dh * 0.073, '700 28px "Gaegu", sans-serif', '#F2789F', 'center');
    if (sv.shop_name_en) _text(ctx, sv.shop_name_en, dw / 2, dh * 0.095, '700 12px "Playfair Display", serif', '#C97E96', 'center');
    // 헤드라인(강조어 + 본문) + 브러시 밑줄
    ctx.font = '400 86px "Black Han Sans", sans-serif';
    var acc = sv.headline_accent || '네일', head = data.head || '전후 변화';
    var wAcc = ctx.measureText(acc).width, wHead = ctx.measureText(head).width, gapW = 22, totW = wAcc + gapW + wHead, sx = dw / 2 - totW / 2;
    _text(ctx, acc, sx, dh * 0.165, '400 86px "Black Han Sans", sans-serif', '#F2789F', 'left');
    _text(ctx, head, sx + wAcc + gapW, dh * 0.165, '400 86px "Black Han Sans", sans-serif', c.ink, 'left');
    _brushUnderline(ctx, sx + wAcc + gapW, sx + totW, dh * 0.185, '#F2789F');
    _sparkle(ctx, sx + totW + 24, dh * 0.10, 16, '#F2789F');
    // 서브(브러시 하이라이트)
    _brushHighlight(ctx, dw * 0.24, dh * 0.205, dw * 0.52, dh * 0.04, '#F8B5CC');
    _text(ctx, data.sub || '손끝 분위기가 달라지는 순간 ♡', dw / 2, dh * 0.232, '400 30px "Gowun Dodum", sans-serif', c.ink, 'center');
    // 찢긴 메모(좌)
    var memo = (sv.before_caption || data.beforeCap || '밋밋한 손끝,\n생기 없는 컬러 :(').split('\n');
    _tornPaper(ctx, dw * 0.03, dh * 0.41, dw * 0.21, dh * 0.10, '#FBF3EE', '#5A4248', memo);
    // BEFORE 폴라로이드 −5°
    var before = state && state.secondImg ? state.secondImg : null;
    if (before && tpl.imageSlots && tpl.imageSlots.before_photo) { before._focal = tpl.imageSlots.before_photo.focal; before._zoom = tpl.imageSlots.before_photo.zoom; }
    _polaroid(ctx, dw * 0.30, dh * 0.46, dw * 0.40, dh * 0.345, -0.087, before, 'BEFORE', 36, '#5A4248', c, { clip: true });
    // AFTER 폴라로이드 +5° (위에 겹침)
    _polaroid(ctx, dw * 0.71, dh * 0.605, dw * 0.42, dh * 0.365, 0.087, _resolveAfter(state, tpl), 'AFTER', 56, '#EC4E86', c, { tape: true, tapeLabel: '♥ ' + (sv.shop_name_en || 'LUMI NAIL') });
    // 불릿 칩 3
    var tags = (sv.tags && sv.tags.length) ? sv.tags : ['컬러 정리', '광택 포인트', '손끝 무드 업 ↗'];
    for (var i = 0; i < Math.min(tags.length, 3); i++) _chipPill(ctx, dw * 0.05, dh * (0.665 + i * 0.052), dw * 0.27, dh * 0.042, tags[i], c);
    // CTA + 코너 손글씨
    _pinkPill(ctx, dw * 0.33, dh * 0.85, dw * 0.34, dh * 0.062, c);
    _text(ctx, data.cta || 'DM / 예약문의 ♡', dw / 2, dh * 0.888, '700 28px "Gowun Dodum", sans-serif', '#FFFFFF', 'center');
    if (sv.footer_left) { ctx.save(); ctx.translate(dw * 0.13, dh * 0.945); ctx.rotate(-0.06); _text(ctx, sv.footer_left, 0, 0, '400 20px "Nanum Pen Script", cursive', '#E07FA0', 'center'); ctx.restore(); }
    if (sv.footer_right) { ctx.save(); ctx.translate(dw * 0.87, dh * 0.95); ctx.rotate(0.06); _text(ctx, sv.footer_right, 0, 0, '400 20px "Nanum Pen Script", cursive', '#E07FA0', 'center'); ctx.restore(); }
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

  // ── 2b · 네일 핑크 수채화 전후 폴라로이드 (ref: 루미네일) ──
  //   기존 _skNailPolaroid 의 검증된 좌표/프리미티브를 재사용하되, 핑크 수채화 톤 + 말풍선/하단 찢긴 메모로 차별화.
  //   기존 bp-ba-nail-polaroid 는 그대로 두고 신규 id 로만 동작(대체 X).
  function _skNailPinkPolaroid(ctx, dw, dh, state, tpl, data, c) {
    var sv = (tpl && tpl.slotValues) || {};
    // 배경: 핑크 수채화(3-stop + 블롭 다수)
    var g = ctx.createLinearGradient(0, 0, 0, dh); g.addColorStop(0, '#FFF3F7'); g.addColorStop(0.55, '#FCE3EC'); g.addColorStop(1, '#F9D3E1');
    ctx.fillStyle = g; ctx.fillRect(0, 0, dw, dh);
    _blob(ctx, dw * 0.16, dh * 0.20, dw * 0.30, '#FFFFFF', 0.55); _blob(ctx, dw * 0.84, dh * 0.30, dw * 0.34, '#FFE6F0', 0.5);
    _blob(ctx, dw * 0.50, dh * 0.50, dw * 0.40, '#FFFFFF', 0.32); _blob(ctx, dw * 0.22, dh * 0.80, dw * 0.30, '#FFDCEA', 0.5);
    // 반짝이 + 하트 보석/장식
    _gemHeart(ctx, dw * 0.075, dh * 0.10, 34, '#F06EA0'); _gemHeart(ctx, dw * 0.92, dh * 0.41, 30, '#F48FB1'); _gemHeart(ctx, dw * 0.90, dh * 0.67, 26, '#F06EA0');
    var spk = [[0.12, 0.085], [0.42, 0.10], [0.90, 0.30], [0.10, 0.40], [0.93, 0.55], [0.55, 0.18], [0.86, 0.72], [0.30, 0.06]];
    spk.forEach(function (s, i) { _sparkle(ctx, dw * s[0], dh * s[1], 9 + (i % 3) * 6, i % 2 ? '#F2789F' : '#FFFFFF'); });
    _heart(ctx, dw * 0.25, dh * 0.085, 12, null, '#F2789F'); _heart(ctx, dw * 0.83, dh * 0.22, 13, '#F8B5CC', null); _heart(ctx, dw * 0.14, dh * 0.72, 11, null, '#F2789F');
    // 상단 로고(타원 라인 + 하트)
    _outlinePill(ctx, dw / 2, dh * 0.072, dw * 0.30, dh * 0.05, '#F2789F');
    _heart(ctx, dw / 2 + dw * 0.135, dh * 0.072, 7, '#F2789F', null);
    _text(ctx, data.shop || '루미네일', dw / 2, dh * 0.073, '700 28px "Gaegu", sans-serif', '#F2789F', 'center');
    _text(ctx, sv.shop_name_en || 'LUMI NAIL', dw / 2, dh * 0.097, '700 12px "Playfair Display", serif', '#C97E96', 'center');
    // 헤드라인: 강조어(핑크 브러시) + 본문(블랙 손글씨) + 밑줄/하트
    var acc = sv.headline_accent || '네일', head = data.head || '전후 변화';
    ctx.font = '400 86px "Black Han Sans", sans-serif';
    var wAcc = ctx.measureText(acc).width, wHead = ctx.measureText(head).width, gapW = 24, totW = wAcc + gapW + wHead, sx = dw / 2 - totW / 2;
    _text(ctx, acc, sx, dh * 0.165, '400 86px "Black Han Sans", sans-serif', '#F2789F', 'left');
    _text(ctx, head, sx + wAcc + gapW, dh * 0.165, '400 86px "Black Han Sans", sans-serif', c.ink, 'left');
    _brushUnderline(ctx, sx + wAcc + gapW, sx + totW, dh * 0.186, '#F2789F');
    _heart(ctx, sx - 18, dh * 0.137, 12, '#F8B5CC', '#F2789F');
    // 서브: 핑크 브러시 배너 위 텍스트
    _brushHighlight(ctx, dw * 0.22, dh * 0.205, dw * 0.56, dh * 0.042, '#F8B5CC');
    _text(ctx, data.sub || '손끝 분위기가 달라지는 순간 ♡', dw / 2, dh * 0.233, '400 30px "Gowun Dodum", sans-serif', c.ink, 'center');
    // 좌측 찢긴 메모(before_caption)
    var memo = (sv.before_caption || '밋밋한 손끝,\n생기 없는 컬러 :(').split('\n');
    _tornPaper(ctx, dw * 0.03, dh * 0.40, dw * 0.21, dh * 0.10, '#FBF1F4', '#7A5560', memo);
    // BEFORE 폴라로이드(좌, 작게, −5°, 클립)
    var before = state && state.secondImg ? state.secondImg : null;
    if (before && tpl.imageSlots && tpl.imageSlots.before_photo) { before._focal = tpl.imageSlots.before_photo.focal; before._zoom = tpl.imageSlots.before_photo.zoom; }
    _polaroid(ctx, dw * 0.30, dh * 0.46, dw * 0.40, dh * 0.345, -0.087, before, 'BEFORE', 36, '#5A4248', c, { clip: true });
    // AFTER 폴라로이드(우, 크게, +5°, 핑크 테이프, 위 겹침)
    _polaroid(ctx, dw * 0.71, dh * 0.605, dw * 0.42, dh * 0.365, 0.087, _resolveAfter(state, tpl), 'AFTER', 56, '#EC4E86', c, { tape: true, tapeLabel: '♥ ' + (sv.shop_name_en || 'LUMI NAIL') });
    // 특징 칩 3
    var tags = (sv.tags && sv.tags.length) ? sv.tags : ['컬러 정리', '광택 포인트', '손끝 무드 업 ↗'];
    for (var i = 0; i < Math.min(tags.length, 3); i++) _chipPill(ctx, dw * 0.05, dh * (0.665 + i * 0.052), dw * 0.27, dh * 0.042, tags[i], c);
    // CTA(핑크 rounded pill + 하트)
    _pinkPill(ctx, dw * 0.33, dh * 0.85, dw * 0.34, dh * 0.062, c);
    _text(ctx, data.cta || 'DM / 예약문의', dw * 0.485, dh * 0.881, '700 26px "Gowun Dodum", sans-serif', '#FFFFFF', 'center');
    _heart(ctx, dw * 0.605, dh * 0.879, 9, '#FFFFFF', null);
    // 하단 찢긴 메모(footer_left) + 우하단 말풍선(footer_right)
    if (sv.footer_left) _tornPaper(ctx, dw * 0.02, dh * 0.90, dw * 0.22, dh * 0.075, '#FBF1F4', '#7A5560', [sv.footer_left]);
    if (sv.footer_right) _speechNote(ctx, dw * 0.78, dh * 0.93, dw * 0.30, dh * 0.06, sv.footer_right, c);
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

  // ── 3 · 속눈썹 후기 블루 카드 (ref ⑱) ────────────────
  function _skLashReview(ctx, dw, dh, state, tpl, data, c) {
    var sv = (tpl && tpl.slotValues) || {};
    var g = ctx.createLinearGradient(0, 0, 0, dh); g.addColorStop(0, '#FBFCFE'); g.addColorStop(1, '#EAF1F8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, dw, dh);
    _blob(ctx, dw * 0.1, dh * 0.88, dw * 0.34, '#C9D9EA', 0.7); _blob(ctx, dw * 0.92, dh * 0.9, dw * 0.3, '#C9D9EA', 0.6); _blob(ctx, dw * 0.95, dh * 0.12, dw * 0.18, '#D7E4F0', 0.5);
    _flower(ctx, dw * 0.14, dh * 0.85, dw * 0.07, '#AFC6DE'); _flower(ctx, dw * 0.22, dh * 0.92, dw * 0.05, '#C9D9EA'); _flower(ctx, dw * 0.9, dh * 0.56, dw * 0.06, '#AFC6DE');
    // 로고
    _text(ctx, data.shop || '모어래쉬', dw / 2, dh * 0.085, '700 28px "Noto Serif KR", serif', c.accent, 'center');
    if (sv.shop_name_en) _text(ctx, sv.shop_name_en, dw / 2, dh * 0.108, '700 13px "Playfair Display", serif', c.sub, 'center');
    // 헤드라인 + Review 스크립트 + 스파클
    _text(ctx, data.head || '속눈썹 후기', dw / 2, dh * 0.185, '700 66px "Noto Serif KR", serif', c.ink, 'center');
    _text(ctx, 'Review', dw * 0.70, dh * 0.155, '400 38px "Nanum Pen Script", cursive', c.accent, 'left');
    _sparkle(ctx, dw * 0.75, dh * 0.135, 16, c.accent);
    // 서브 + 라인 디바이더
    _text(ctx, data.sub || '또렷하고 자연스러운 눈매 변화', dw / 2, dh * 0.235, '400 23px "Noto Sans KR", sans-serif', c.sub, 'center');
    ctx.save(); ctx.strokeStyle = c.line; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(dw * 0.2, dh * 0.231); ctx.lineTo(dw * 0.27, dh * 0.231); ctx.moveTo(dw * 0.73, dh * 0.231); ctx.lineTo(dw * 0.8, dh * 0.231); ctx.stroke(); ctx.restore();
    // 카드
    _softCard(ctx, dw * 0.065, dh * 0.285, dw * 0.87, dh * 0.49, 30);
    // 서클 포토
    var main = _resolveMain(tpl), ccx = dw * 0.285, ccy = dh * 0.46, r = dw * 0.155;
    ctx.save(); ctx.beginPath(); ctx.arc(ccx, ccy, r, 0, Math.PI * 2); ctx.clip();
    if (!(main && _coverDraw(ctx, main, ccx - r, ccy - r, r * 2, r * 2, main._focal, main._zoom))) { ctx.fillStyle = c.line; ctx.fillRect(ccx - r, ccy - r, r * 2, r * 2); }
    ctx.restore();
    ctx.save(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(ccx, ccy, r, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = c.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ccx, ccy, r + 4, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    if (!main) _text(ctx, '사진', ccx, ccy, '600 24px "Noto Sans KR", sans-serif', c.sub, 'center');
    // 인용문 + 후기
    _text(ctx, '“', dw * 0.50, dh * 0.375, '700 80px "Noto Serif KR", serif', c.accent, 'left');
    var rt = data.review || sv.review_text || '원하던 느낌을 정확히 잡아주셔서 너무 만족했어요.';
    if (window.PhotoEditorTemplateFitText && window.PhotoEditorTemplateFitText.drawFitText) {
      window.PhotoEditorTemplateFitText.drawFitText(ctx, rt, { x: dw * 0.50, y: dh * 0.40, w: dw * 0.40, h: dh * 0.16 }, { maxFontSize: 30, minFontSize: 20, maxLines: 4, lineHeight: 1.55, color: c.ink, align: 'left', valign: 'top', weight: '400', fontFamily: '"Noto Sans KR", sans-serif' });
    } else { _text(ctx, rt.slice(0, 30), dw * 0.50, dh * 0.45, '400 26px "Noto Sans KR", sans-serif', c.ink, 'left'); }
    _text(ctx, '”', dw * 0.88, dh * 0.565, '700 80px "Noto Serif KR", serif', c.accent, 'right');
    // 3컬럼(아이콘 + 값 + 라벨 + 세로 구분선)
    var cols = [['person', data.customer || '고객님', '고객님'], ['lash', data.serviceName || '시술 항목', '시술 항목'], ['calendar', data.reviewDate || '날짜', '시술 날짜']];
    var cyTop = dh * 0.635;
    for (var i = 0; i < 3; i++) {
      var colx = dw * (0.275 + i * 0.225);
      _lineIcon(ctx, cols[i][0], colx, cyTop, 26, c.accent);
      _text(ctx, cols[i][1], colx, cyTop + 44, '700 23px "Noto Sans KR", sans-serif', c.ink, 'center');
      _text(ctx, cols[i][2], colx, cyTop + 70, '400 15px "Noto Sans KR", sans-serif', c.sub, 'center');
      if (i < 2) { ctx.save(); ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(dw * (0.275 + i * 0.225) + dw * 0.1125, cyTop - 20); ctx.lineTo(dw * (0.275 + i * 0.225) + dw * 0.1125, cyTop + 75); ctx.stroke(); ctx.restore(); }
    }
    // 별점 + 감사 + CTA
    var rating = (sv.rating != null) ? Math.max(0, Math.min(5, sv.rating | 0)) : 5;
    _stars(ctx, dw / 2, dh * 0.825, rating, 18, 44, c.accent);
    _text(ctx, sv.thanks || '소중한 후기 감사합니다. ♡', dw / 2, dh * 0.865, '400 28px "Nanum Pen Script", cursive', c.accent, 'center');
    var g2 = ctx.createLinearGradient(dw * 0.33, 0, dw * 0.67, 0); g2.addColorStop(0, '#6E93B4'); g2.addColorStop(1, '#587E9F');
    ctx.save(); ctx.shadowColor = 'rgba(80,110,140,0.3)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4; ctx.fillStyle = g2; _rr(ctx, dw * 0.33, dh * 0.895, dw * 0.34, dh * 0.062, 45); ctx.fill(); ctx.restore();
    _lineIcon(ctx, 'chat', dw * 0.42, dh * 0.926, 22, '#fff');
    _text(ctx, data.cta || '상담 / 예약', dw * 0.535, dh * 0.934, '700 28px "Gowun Dodum", sans-serif', '#fff', 'center');
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

  // ── 4 · 여드름 케어 전후 (핑크 집중관리, ref-8) ───────
  function _skSkinAcnePink(ctx, dw, dh, state, tpl, data, c) {
    var sv = (tpl && tpl.slotValues) || {};
    var g = ctx.createLinearGradient(0, 0, 0, dh); g.addColorStop(0, '#FFF4F7'); g.addColorStop(0.5, '#FCE9EF'); g.addColorStop(1, '#FBE0EA');
    ctx.fillStyle = g; ctx.fillRect(0, 0, dw, dh);
    _blob(ctx, dw * 0.14, dh * 0.10, dw * 0.30, '#FFFFFF', 0.5); _blob(ctx, dw * 0.90, dh * 0.16, dw * 0.26, '#FFE2EC', 0.5);
    _blob(ctx, dw * 0.88, dh * 0.80, dw * 0.30, '#FFD9E6', 0.45); _blob(ctx, dw * 0.12, dh * 0.60, dw * 0.24, '#FFFFFF', 0.4);
    _gemHeart(ctx, dw * 0.07, dh * 0.205, 24, '#F48FB1'); _heart(ctx, dw * 0.93, dh * 0.10, 12, '#F8B5CC', null);
    [[0.90, 0.30], [0.10, 0.42], [0.94, 0.55]].forEach(function (s, i) { _sparkle(ctx, dw * s[0], dh * s[1], 9 + (i % 2) * 5, '#F2789F'); });
    // 상단 서브 + 좌상단 손글씨 스티커
    _text(ctx, data.sub || '깨끗한 피부, 자신감 UP!', dw / 2, dh * 0.05, '700 22px "Gowun Dodum", sans-serif', c.sub, 'center');
    if (sv.top_sticker) { ctx.save(); ctx.translate(dw * 0.20, dh * 0.088); ctx.rotate(-0.1); _heart(ctx, -dw * 0.085, -dh * 0.011, 8, '#F8B5CC', null); _text(ctx, sv.top_sticker, 0, 0, '400 20px "Nanum Pen Script", cursive', '#E06B98', 'center'); ctx.restore(); }
    // 헤드라인: 본문(ink) + 강조어(핑크, 하이라이트)
    var head = data.head || '여드름 케어', acc = sv.headline_accent || '전후';
    ctx.font = '400 70px "Black Han Sans", sans-serif';
    var wHead = ctx.measureText(head).width, wAcc = ctx.measureText(acc).width, gapW = 22, totW = wHead + gapW + wAcc, sx = dw / 2 - totW / 2;
    _brushHighlight(ctx, sx + wHead + gapW - 8, dh * 0.123, wAcc + 16, dh * 0.05, '#F8B5CC');
    _text(ctx, head, sx, dh * 0.155, '400 70px "Black Han Sans", sans-serif', c.ink, 'left');
    _text(ctx, acc, sx + wHead + gapW, dh * 0.155, '400 70px "Black Han Sans", sans-serif', c.accent, 'left');
    // 핑크 배지 pill + 스파클
    var badge = sv.badge || '2주 집중 관리 결과';
    ctx.font = '700 22px "Gowun Dodum", sans-serif'; var bw = ctx.measureText(badge).width + 80;
    _pinkPill(ctx, dw / 2 - bw / 2, dh * 0.185, bw, dh * 0.042, c);
    _sparkle(ctx, dw / 2 - bw / 2 + 26, dh * 0.206, 9, '#FFFFFF'); _sparkle(ctx, dw / 2 + bw / 2 - 26, dh * 0.206, 9, '#FFFFFF');
    _text(ctx, badge, dw / 2, dh * 0.214, '700 22px "Gowun Dodum", sans-serif', '#FFFFFF', 'center');
    // 해시태그 한 줄
    var tags = (sv.hashtags && sv.hashtags.length) ? sv.hashtags : ['#여드름진정', '#피부결개선', '#민감성피부OK', '#자신감회복'];
    _text(ctx, tags.join('   '), dw / 2, dh * 0.262, '700 18px "Noto Sans KR", sans-serif', '#C77E97', 'center');
    // 전후 사진 2분할(둥근 매거진 카드) + 중앙 화살표
    var pad = dw * 0.045, gap = dw * 0.03, cardW = (dw - pad * 2 - gap) / 2, cardY = dh * 0.29, cardH = dh * 0.295;
    var before = state && state.secondImg ? state.secondImg : null;
    if (before && tpl.imageSlots && tpl.imageSlots.before_photo) { before._focal = tpl.imageSlots.before_photo.focal; before._zoom = tpl.imageSlots.before_photo.zoom; }
    _photoLabeled(ctx, before, pad, cardY, cardW, cardH, 18, data.beforeLabel || 'BEFORE', '#5A4248', 'left', c);
    _photoLabeled(ctx, _resolveAfter(state, tpl), pad + cardW + gap, cardY, cardW, cardH, 18, data.afterLabel || 'AFTER', c.accent, 'right', c);
    var acx = pad + cardW + gap / 2, acy = cardY + cardH / 2;
    ctx.save(); ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(acx, acy, dw * 0.032, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#FFF'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(acx - 5, acy - 8); ctx.lineTo(acx + 6, acy); ctx.lineTo(acx - 5, acy + 8); ctx.stroke(); ctx.restore();
    // 사진 아래 손글씨 캡션
    _text(ctx, data.beforeCap || '붉은 트러블·울퉁불퉁한 결', pad + cardW / 2, cardY + cardH + 30, '400 19px "Nanum Pen Script", cursive', c.sub, 'center');
    _text(ctx, data.afterCap || '피부 진정·매끈해진 결', pad + cardW + gap + cardW / 2, cardY + cardH + 30, '400 19px "Nanum Pen Script", cursive', '#E06B98', 'center');
    // 후기 박스(흰 카드 + 원형 고객사진 + 인용)
    var rbY = dh * 0.655, rbX = dw * 0.06, rbW = dw * 0.88, rbH = dh * 0.205;
    _softCard(ctx, rbX, rbY, rbW, rbH, 24);
    var rcx = rbX + rbH * 0.6, rcy = rbY + rbH / 2, rr = rbH * 0.34;
    ctx.save(); ctx.beginPath(); ctx.arc(rcx, rcy, rr, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = '#F3DCE4'; ctx.fillRect(rcx - rr, rcy - rr, rr * 2, rr * 2); ctx.restore();
    ctx.save(); ctx.strokeStyle = '#FFF'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(rcx, rcy, rr, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    _text(ctx, '＋', rcx, rcy + 8, '600 24px "Noto Sans KR", sans-serif', '#C99', 'center');
    var qx = rcx + rr + dw * 0.045;
    _text(ctx, '“', qx - 4, rbY + dh * 0.052, '700 54px "Noto Serif KR", serif', c.accent, 'left');
    _text(ctx, sv.review_quote || '화장 밀림이 줄었어요!', qx + 30, rbY + dh * 0.045, '700 24px "Gowun Dodum", sans-serif', c.accent, 'left');
    var rb = sv.review_body || '평소 트러블 때문에 화장도 잘 안 먹고 스트레스였는데, 2주 만에 피부가 진정되고 결이 매끈해졌어요!';
    if (window.PhotoEditorTemplateFitText && window.PhotoEditorTemplateFitText.drawFitText) {
      window.PhotoEditorTemplateFitText.drawFitText(ctx, rb, { x: qx, y: rbY + dh * 0.065, w: rbW - (qx - rbX) - dw * 0.05, h: rbH - dh * 0.085 }, { maxFontSize: 18, minFontSize: 14, maxLines: 4, lineHeight: 1.5, color: '#6A565C', align: 'left', valign: 'top', weight: '400', fontFamily: '"Noto Sans KR", sans-serif' });
    } else { _text(ctx, rb.slice(0, 28), qx, rbY + dh * 0.095, '400 16px "Noto Sans KR", sans-serif', '#6A565C', 'left'); }
    // 우상단 회전 CTA 배지 + 하단 @handle
    if (data.cta) { ctx.save(); ctx.translate(dw * 0.85, dh * 0.62); ctx.rotate(0.13); _outlinePill(ctx, 0, 0, dw * 0.26, dh * 0.036, c.accent); _text(ctx, data.cta, 0, dh * 0.009, '700 15px "Gowun Dodum", sans-serif', c.accent, 'center'); ctx.restore(); }
    _text(ctx, sv.profile_handle || '@softglow_skin', dw / 2, dh * 0.95, '700 22px "Noto Sans KR", sans-serif', c.accent, 'center');
  }

  // ── 5 · 붙임머리 전후 (라벤더 폴라로이드, ref-9) ──────
  function _skHairExtPolaroid(ctx, dw, dh, state, tpl, data, c) {
    var sv = (tpl && tpl.slotValues) || {};
    var g = ctx.createLinearGradient(0, 0, dw, dh); g.addColorStop(0, '#EFE6F6'); g.addColorStop(0.5, '#F6E6F0'); g.addColorStop(1, '#FBE3EC');
    ctx.fillStyle = g; ctx.fillRect(0, 0, dw, dh);
    _blob(ctx, dw * 0.16, dh * 0.14, dw * 0.30, '#FFFFFF', 0.5); _blob(ctx, dw * 0.86, dh * 0.20, dw * 0.28, '#EAD9F2', 0.5);
    _blob(ctx, dw * 0.50, dh * 0.55, dw * 0.40, '#FFFFFF', 0.3); _blob(ctx, dw * 0.20, dh * 0.84, dw * 0.28, '#F6D7E6', 0.45);
    [[0.12, 0.10], [0.42, 0.07], [0.92, 0.34], [0.08, 0.46], [0.90, 0.60]].forEach(function (s, i) { _sparkle(ctx, dw * s[0], dh * s[1], 9 + (i % 3) * 5, i % 2 ? '#C9A6E0' : '#F2789F'); });
    _heart(ctx, dw * 0.60, dh * 0.10, 13, '#F8B5CC', null);
    // 좌상단 라벨 + 상단 손글씨
    _text(ctx, sv.shop_label || '#HAIR EXTENSION', dw * 0.06, dh * 0.045, '700 16px "Noto Sans KR", sans-serif', c.sub, 'left');
    _text(ctx, data.sub || '자연스럽게 길어지고, 예뻐지는 마법', dw * 0.50, dh * 0.06, '400 24px "Nanum Pen Script", cursive', '#9B6FB0', 'center');
    // BEST 배지(우상단 보라 원형)
    var bbx = dw * 0.86, bby = dh * 0.10;
    ctx.save(); var bg2 = ctx.createLinearGradient(bbx - 50, bby - 30, bbx + 50, bby + 30); bg2.addColorStop(0, '#C9A6E0'); bg2.addColorStop(1, '#A678C8');
    ctx.shadowColor = 'rgba(166,120,200,0.4)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4; ctx.fillStyle = bg2;
    ctx.beginPath(); ctx.arc(bbx, bby, dw * 0.08, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    _text(ctx, sv.best_badge || 'BEST', bbx, bby + 8, '800 26px "Montserrat", sans-serif', '#FFFFFF', 'center');
    // 헤드라인: 본문(ink) + 강조어(핑크, 하이라이트)
    var head = data.head || '붙임머리', acc = sv.headline_accent || '전후';
    ctx.font = '400 76px "Black Han Sans", sans-serif';
    var wHead = ctx.measureText(head).width, wAcc = ctx.measureText(acc).width, gapW = 22, totW = wHead + gapW + wAcc, sx = dw / 2 - totW / 2;
    _text(ctx, head, sx, dh * 0.175, '400 76px "Black Han Sans", sans-serif', c.ink, 'left');
    _brushHighlight(ctx, sx + wHead + gapW - 6, dh * 0.135, wAcc + 14, dh * 0.052, '#F8B5CC');
    _text(ctx, acc, sx + wHead + gapW, dh * 0.175, '400 76px "Black Han Sans", sans-serif', c.accent, 'left');
    // 검정 리본 배너
    var rib = sv.ribbon || '볼륨감이 달라지는 순간';
    ctx.font = '700 24px "Gowun Dodum", sans-serif'; var rw = ctx.measureText(rib).width + 96, rx = dw / 2 - rw / 2, ry = dh * 0.205;
    ctx.save(); ctx.fillStyle = '#2A2230'; _rr(ctx, rx, ry, rw, dh * 0.046, 6); ctx.fill(); ctx.restore();
    _sparkle(ctx, rx + 30, ry + dh * 0.023, 9, '#F2C9DC'); _sparkle(ctx, rx + rw - 30, ry + dh * 0.023, 9, '#F2C9DC');
    _text(ctx, rib, dw / 2, ry + dh * 0.032, '700 24px "Gowun Dodum", sans-serif', '#FFFFFF', 'center');
    // 폴라로이드 2장(캡션=before/after 설명)
    var before = state && state.secondImg ? state.secondImg : null;
    if (before && tpl.imageSlots && tpl.imageSlots.before_photo) { before._focal = tpl.imageSlots.before_photo.focal; before._zoom = tpl.imageSlots.before_photo.zoom; }
    _polaroid(ctx, dw * 0.29, dh * 0.45, dw * 0.40, dh * 0.34, -0.05, before, data.beforeCap || '밋밋하고 힘없는 모발', 23, '#6A5566', c, {});
    _polaroid(ctx, dw * 0.71, dh * 0.47, dw * 0.42, dh * 0.355, 0.05, _resolveAfter(state, tpl), data.afterCap || '풍성하고 자연스러운 볼륨', 23, '#E06B98', c, {});
    // BEFORE/AFTER 코너 라벨
    _labelPill(ctx, dw * 0.11, dh * 0.335, dw * 0.18, dh * 0.04, data.beforeLabel || 'BEFORE', '#2A2230', '#FFFFFF');
    _labelPill(ctx, dw * 0.71, dh * 0.345, dw * 0.18, dh * 0.04, data.afterLabel || 'AFTER', c.accent, '#FFFFFF');
    // 중앙 곡선 화살표
    ctx.save(); ctx.strokeStyle = '#3A2F40'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(dw * 0.45, dh * 0.50); ctx.quadraticCurveTo(dw * 0.50, dh * 0.46, dw * 0.55, dh * 0.50); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(dw * 0.55, dh * 0.50); ctx.lineTo(dw * 0.527, dh * 0.487); ctx.moveTo(dw * 0.55, dh * 0.50); ctx.lineTo(dw * 0.534, dh * 0.515); ctx.stroke(); ctx.restore();
    // 포인트 칩 3(좌하단)
    var tags = (sv.tags && sv.tags.length) ? sv.tags : ['자연스러운 연결', '풍성한 볼륨감', '긴머리 변신 완성'];
    for (var i = 0; i < Math.min(tags.length, 3); i++) _chipPill(ctx, dw * 0.05, dh * (0.70 + i * 0.058), dw * 0.40, dh * 0.046, tags[i], c);
    // 하단 중앙 손글씨
    if (sv.bottom_memo) { ctx.save(); ctx.translate(dw * 0.68, dh * 0.79); ctx.rotate(-0.04); _text(ctx, sv.bottom_memo, 0, 0, '400 21px "Nanum Pen Script", cursive', '#8A6FA0', 'center'); ctx.restore(); }
    // 우하단 CTA pill(채팅 아이콘 + 텍스트 + 화살표)
    _pinkPill(ctx, dw * 0.55, dh * 0.86, dw * 0.40, dh * 0.06, c);
    _lineIcon(ctx, 'chat', dw * 0.615, dh * 0.888, 20, '#FFFFFF');
    _text(ctx, data.cta || '상담 가능', dw * 0.74, dh * 0.898, '700 24px "Gowun Dodum", sans-serif', '#FFFFFF', 'center');
    ctx.save(); ctx.strokeStyle = '#FFF'; ctx.lineWidth = 3; ctx.lineCap = 'round'; var ax = dw * 0.885, ay = dh * 0.89; ctx.beginPath(); ctx.moveTo(ax - 5, ay - 7); ctx.lineTo(ax + 5, ay); ctx.lineTo(ax - 5, ay + 7); ctx.stroke(); ctx.restore();
    // 푸터
    _text(ctx, sv.footer || 'YOUR BEAUTY, OUR PASSION', dw / 2, dh * 0.965, '700 16px "Noto Sans KR", sans-serif', c.sub, 'center');
  }

  var ROUTES = {
    'bp-price-blackgold': _skBlackGold,
    'bp-ba-nail-polaroid': _skNailPolaroid,
    'bp-ba-nail-pink-polaroid': _skNailPinkPolaroid,
    'bp-ba-skin-acne-pink': _skSkinAcnePink,
    'bp-ba-hair-extension-polaroid': _skHairExtPolaroid,
    'bp-review-lash-blue': _skLashReview,
  };
  // 좌표 튜닝 완료된 id — 워터마크 미표시. 미완성(스텁)만 SKELETON 표기.
  var DONE = { 'bp-price-blackgold': true, 'bp-review-lash-blue': true, 'bp-ba-nail-polaroid': true, 'bp-ba-nail-pink-polaroid': true, 'bp-ba-skin-acne-pink': true, 'bp-ba-hair-extension-polaroid': true };

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

  window.PhotoEditorBeautyPack = { draw: draw };
})();
