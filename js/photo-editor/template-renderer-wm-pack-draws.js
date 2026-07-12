/* Warm Minimal 팩 — id별 드로 함수 (WM, 2026-06-18)

   역할: core(template-renderer-beauty-pack.js)의 공용 프리미티브를 받아 WM 12종 캔버스를 그린다.
   - core 가 먼저 로드 → window.PhotoEditorBeautyPack._kit / ._register 제공.
   - 무드: 아이보리/크림/웜화이트 배경 · 블랙 텍스트 · 차분한 로즈 포인트 · 얇은 라인 · 넉넉한 여백.
     이모지/과한 그라데이션/덕지덕지 뱃지 금지(에디토리얼 인스타 무드).
   - 데이터: data.head, sub, cta, shop, services, beforeLabel/afterLabel, beforeCap/afterCap,
            customer, review, serviceName, mainPhoto(=슬롯 경유). 커스텀 키(event_period,
            event_benefit, shop_handle, status_badge)는 tpl.slotValues 에서 직접 읽는다.
   - 사진: main = _main(state,tpl)(슬롯 없으면 현재 보정 사진) · after = _resolveAfter · before = state.secondImg.
   - throw 0 — core.draw 가 try/catch 로 감싼다.
*/
(function () {
  'use strict';
  var BP = window.PhotoEditorBeautyPack;
  if (!BP || !BP._kit || !BP._register) { return; }
  var K = BP._kit;
  var _rr = K._rr, _coverDraw = K._coverDraw, _text = K._text;
  var _resolveAfter = K._resolveAfter, _resolveMain = K._resolveMain, _fitLine = K._fitLine;

  var F_SERIF = '"Noto Serif KR", serif';
  var F_SANS = '"Noto Sans KR", sans-serif';
  var F_LATIN = '"Playfair Display", "Noto Serif KR", serif';

  // ── 공용 프리미티브 ──────────────────────────────────────
  function _bg(ctx, dw, dh, c) { ctx.fillStyle = c.bg; ctx.fillRect(0, 0, dw, dh); }

  // 현재 보정 사진을 main 기본값으로(슬롯 비었을 때) — 보정→템플릿 흐름에서 바로 보이게.
  function _main(state, tpl) {
    var img = _resolveMain(tpl);
    if (!img) { var base = state && (state.editedImg || state.originalImg || state.img); if (base) img = base; }
    return img;
  }
  function _before(state, tpl) {
    var b = (state && state.secondImg) ? state.secondImg : null;
    var slot = tpl && tpl.imageSlots && tpl.imageSlots.before_photo;
    if (b && slot) { b._focal = slot.focal; b._zoom = slot.zoom; }
    return b;
  }

  // 사진 cover-crop, 없으면 라인색 박스 + 안내 라벨.
  function _photo(ctx, img, x, y, w, h, r, c, label) {
    ctx.save(); _rr(ctx, x, y, w, h, r || 0); ctx.clip();
    var drew = img ? _coverDraw(ctx, img, x, y, w, h, img._focal, img._zoom) : false;
    if (!drew) {
      ctx.fillStyle = c.line; ctx.fillRect(x, y, w, h);
      _text(ctx, label || '＋ 사진', x + w / 2, y + h / 2 + 8, '500 26px ' + F_SANS, c.sub, 'center');
    }
    ctx.restore();
    return drew;
  }
  function _frame(ctx, x, y, w, h, r, color, lw) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw || 1.5; _rr(ctx, x, y, w, h, r || 0); ctx.stroke(); ctx.restore();
  }
  // 자간 있는 라틴 소형 라벨(kicker).
  function _spaced(ctx, s, x, y, font, color, align, ls) {
    s = String(s == null ? '' : s); if (!s) return;
    ctx.save(); ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'left';
    ls = ls || 0; var w = [], total = 0, i;
    for (i = 0; i < s.length; i++) { var cw = ctx.measureText(s[i]).width; w.push(cw); total += cw + ls; }
    total -= ls;
    var sx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    for (i = 0; i < s.length; i++) { ctx.fillText(s[i], sx, y); sx += w[i] + ls; }
    ctx.restore();
  }
  function _rule(ctx, cx, y, w, color) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(cx - w / 2, y); ctx.lineTo(cx + w / 2, y); ctx.stroke(); ctx.restore();
  }
  function _dotted(ctx, x1, x2, y, color) {
    if (x2 <= x1) return;
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([2, 9]); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke(); ctx.restore();
  }
  function _scrimBottom(ctx, x, y, w, h, alpha) {
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(20,18,16,0)'); g.addColorStop(1, 'rgba(20,18,16,' + (alpha || 0.55) + ')');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  }
  function _ctaBar(ctx, x, y, w, h, text, c) {
    if (!text) return;
    ctx.save(); ctx.fillStyle = c.badge; _rr(ctx, x, y, w, h, h / 2); ctx.fill(); ctx.restore();
    _text(ctx, text, x + w / 2, y + h * 0.64, '600 ' + Math.round(h * 0.40) + 'px ' + F_SANS, '#FFF9F4', 'center');
  }
  function _tag(ctx, x, y, text, c, accent) {
    if (!text) return;
    ctx.save(); ctx.font = '500 24px ' + F_SANS; var pad = 20, w = ctx.measureText(text).width + pad * 2, h = 48;
    ctx.fillStyle = accent ? c.accent : 'rgba(255,249,244,0.94)'; _rr(ctx, x, y, w, h, h / 2); ctx.fill(); ctx.restore();
    _text(ctx, text, x + w / 2, y + h * 0.66, '500 24px ' + F_SANS, accent ? '#FFF9F4' : c.ink, 'center');
  }
  // [전후 고도화] 사진 위 코너 라벨 pill (cx 중심, 작고 정제 + 부드러운 그림자).
  function _cornerPill(ctx, cx, y, text, c, accent) {
    if (!text) return;
    ctx.save(); ctx.font = '600 22px ' + F_SANS;
    var pad = 18, w = ctx.measureText(text).width + pad * 2, h = 46, x = cx - w / 2;
    ctx.shadowColor = 'rgba(31,27,24,0.20)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
    ctx.fillStyle = accent ? c.accent : 'rgba(255,249,244,0.96)';
    _rr(ctx, x, y, w, h, h / 2); ctx.fill(); ctx.restore();
    _text(ctx, text, cx, y + h * 0.66, '600 22px ' + F_SANS, accent ? '#FFF9F4' : c.ink, 'center');
  }
  // [전후 고도화] 변화 화살표 배지(원형 + 링 + 화살표). dir: 'right' | 'down'.
  function _arrowBadge(ctx, cx, cy, r, c, dir) {
    ctx.save();
    ctx.shadowColor = 'rgba(31,27,24,0.18)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
    ctx.fillStyle = c.bg; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.strokeStyle = c.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = c.ink; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var a = r * 0.46; ctx.beginPath();
    if (dir === 'down') {
      ctx.moveTo(cx, cy - a); ctx.lineTo(cx, cy + a);
      ctx.moveTo(cx - a * 0.55, cy + a * 0.35); ctx.lineTo(cx, cy + a); ctx.lineTo(cx + a * 0.55, cy + a * 0.35);
    } else {
      ctx.moveTo(cx - a, cy); ctx.lineTo(cx + a, cy);
      ctx.moveTo(cx + a * 0.35, cy - a * 0.55); ctx.lineTo(cx + a, cy); ctx.lineTo(cx + a * 0.35, cy + a * 0.55);
    }
    ctx.stroke(); ctx.restore();
  }
  // [전후 고도화] 변화 포인트 칩 행(가운데 정렬, 외곽선 pill + 로즈 점). 빈 항목은 제외.
  function _chipRow(ctx, cx, y, items, c) {
    items = (items || []).filter(function (s) { return s && String(s).trim(); });
    if (!items.length) return;
    ctx.save(); ctx.font = '500 22px ' + F_SANS;
    var h = 50, gap = 14, padX = 22, dot = 6, dotGap = 11;
    var ws = items.map(function (s) { return ctx.measureText(s).width + padX * 2 + dot * 2 + dotGap; });
    var total = ws.reduce(function (a, b) { return a + b; }, 0) + gap * (items.length - 1);
    var x = cx - total / 2;
    for (var i = 0; i < items.length; i++) {
      var w = ws[i];
      ctx.strokeStyle = c.line; ctx.lineWidth = 1.5; _rr(ctx, x, y, w, h, h / 2); ctx.stroke();
      ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(x + padX + dot, y + h / 2, dot, 0, Math.PI * 2); ctx.fill();
      _text(ctx, items[i], x + padX + dot * 2 + dotGap, y + h * 0.64, '500 22px ' + F_SANS, c.ink, 'left');
      x += w + gap;
    }
    ctx.restore();
  }
  // [전후 고도화] 사진 위 캡션(그림자로 가독성 확보, 스크림 사각 아티팩트 없음).
  function _photoCap(ctx, cx, y, text, c) {
    if (!text) return;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 1;
    _text(ctx, text, cx, y, '600 24px ' + F_SANS, '#FFFFFF', 'center');
    ctx.restore();
  }

  // 본문 줄바꿈(\n 존중 + 폭 래핑) → 그린 줄 수 반환.
  function _wrap(ctx, s, x, y, maxW, lh, font, color, align, maxLines) {
    s = String(s == null ? '' : s); ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align || 'left';
    var paras = s.split('\n'), out = [], p, i;
    for (p = 0; p < paras.length; p++) {
      var words = paras[p].split(' '), cur = '';
      for (i = 0; i < words.length; i++) {
        var test = cur ? cur + ' ' + words[i] : words[i];
        if (ctx.measureText(test).width > maxW && cur) { out.push(cur); cur = words[i]; } else cur = test;
      }
      out.push(cur);
    }
    if (maxLines) out = out.slice(0, maxLines);
    for (i = 0; i < out.length; i++) ctx.fillText(out[i], x, y + i * lh);
    return out.length;
  }

  // ════ ① 전후 비교 · 피드 4:5 (플래그십 고도화) ════
  //   코너 라벨 pill + 중앙 변화 화살표 + 변화 포인트 칩 + 시술명/CTA/핸들. 전부 editable.
  function _wmBaFeed(ctx, dw, dh, state, tpl, data, c) {
    var sv = (tpl && tpl.slotValues) || {};
    _bg(ctx, dw, dh, c);
    var m = dw * 0.065;
    // 헤더
    _spaced(ctx, data.kicker || 'BEFORE & AFTER', dw / 2, dh * 0.066, '400 22px ' + F_LATIN, c.accent, 'center', 5);
    _fitLine(ctx, data.head || '시술 전후', dw / 2, dh * 0.116, dw * 0.86, 50, F_SERIF, c.ink);
    if (data.sub) _text(ctx, data.sub, dw / 2, dh * 0.150, '400 23px ' + F_SANS, c.sub, 'center');
    _rule(ctx, dw / 2, dh * 0.176, dw * 0.10, c.line);
    // 사진 2장 + 코너 pill + 중앙 화살표
    var gap = dw * 0.028, pw = (dw - 2 * m - gap) / 2, py = dh * 0.213, ph = dh * 0.50;
    var bx = m, ax = m + pw + gap;
    _photo(ctx, _before(state, tpl), bx, py, pw, ph, 12, c, '＋ 시술 전');
    _photo(ctx, _resolveAfter(state, tpl), ax, py, pw, ph, 12, c, '＋ 시술 후');
    _frame(ctx, bx, py, pw, ph, 12, c.line, 1.5); _frame(ctx, ax, py, pw, ph, 12, c.line, 1.5);
    _cornerPill(ctx, bx + pw / 2, py + ph - dh * 0.052, data.beforeLabel || 'BEFORE', c, false);
    _cornerPill(ctx, ax + pw / 2, py + ph - dh * 0.052, data.afterLabel || 'AFTER', c, true);
    _arrowBadge(ctx, dw / 2, py + ph - dh * 0.03, dw * 0.043, c, 'right');
    // 캡션(크림 영역)
    _text(ctx, data.beforeCap || '시술 전', bx + pw / 2, py + ph + dh * 0.04, '400 23px ' + F_SANS, c.sub, 'center');
    _text(ctx, data.afterCap || '시술 후', ax + pw / 2, py + ph + dh * 0.04, '600 23px ' + F_SANS, c.ink, 'center');
    // 변화 포인트 칩
    _chipRow(ctx, dw / 2, dh * 0.778, [sv.highlight_1, sv.highlight_2, sv.highlight_3], c);
    // 시술명 + CTA + 핸들
    if (data.serviceName) _text(ctx, data.serviceName, dw / 2, dh * 0.862, '500 27px ' + F_SERIF, c.ink, 'center');
    _ctaBar(ctx, dw * 0.30, dh * 0.885, dw * 0.40, dh * 0.052, data.cta, c);
    if (sv.shop_handle) _text(ctx, sv.shop_handle, dw / 2, dh * 0.965, '500 21px ' + F_SANS, c.sub, 'center');
  }

  // ════ ② 전후 비교 · 스토리 9:16 (플래그십 고도화) ════
  function _wmBaStory(ctx, dw, dh, state, tpl, data, c) {
    var sv = (tpl && tpl.slotValues) || {};
    _bg(ctx, dw, dh, c);
    var m = dw * 0.08;
    _spaced(ctx, data.kicker || 'BEFORE & AFTER', dw / 2, dh * 0.064, '400 22px ' + F_LATIN, c.accent, 'center', 6);
    _fitLine(ctx, data.head || '오늘의 변화 기록', dw / 2, dh * 0.102, dw * 0.84, 54, F_SERIF, c.ink);
    if (data.sub) _text(ctx, data.sub, dw / 2, dh * 0.131, '400 26px ' + F_SANS, c.sub, 'center');
    _rule(ctx, dw / 2, dh * 0.150, dw * 0.10, c.line);
    var pw = dw - 2 * m, ph = dh * 0.30, gap = dh * 0.04, y1 = dh * 0.183, y2 = y1 + ph + gap;
    // before
    _photo(ctx, _before(state, tpl), m, y1, pw, ph, 12, c, '＋ 시술 전'); _frame(ctx, m, y1, pw, ph, 12, c.line, 1.5);
    _tag(ctx, m + dw * 0.035, y1 + dh * 0.02, data.beforeLabel || 'BEFORE', c, false);
    _photoCap(ctx, m + pw / 2, y1 + ph - dh * 0.022, data.beforeCap, c);
    // after
    _photo(ctx, _resolveAfter(state, tpl), m, y2, pw, ph, 12, c, '＋ 시술 후'); _frame(ctx, m, y2, pw, ph, 12, c.line, 1.5);
    _tag(ctx, m + dw * 0.035, y2 + dh * 0.02, data.afterLabel || 'AFTER', c, true);
    _photoCap(ctx, m + pw / 2, y2 + ph - dh * 0.022, data.afterCap, c);
    // 중앙 변화 화살표(아래 방향)
    _arrowBadge(ctx, dw / 2, y1 + ph + gap / 2, dw * 0.055, c, 'down');
    // 변화 포인트 칩 + CTA + 핸들
    _chipRow(ctx, dw / 2, y2 + ph + dh * 0.022, [sv.highlight_1, sv.highlight_2, sv.highlight_3], c);
    _ctaBar(ctx, dw * 0.22, y2 + ph + dh * 0.072, dw * 0.56, dh * 0.046, data.cta, c);
    if (sv.shop_handle) _text(ctx, sv.shop_handle, dw / 2, y2 + ph + dh * 0.122, '500 22px ' + F_SANS, c.sub, 'center');
  }

  // ════ ③ 시술 자랑 · 피드 4:5 (사진 주인공) ════
  function _wmShowFeed(ctx, dw, dh, state, tpl, data, c) {
    var sv = (tpl && tpl.slotValues) || {};
    _bg(ctx, dw, dh, c);
    var ph = dh * 0.81;
    _photo(ctx, _main(state, tpl), 0, 0, dw, ph, 0, c, '＋ 사진을 올려주세요');
    ctx.fillStyle = c.bg; ctx.fillRect(0, ph, dw, dh - ph);
    _rule(ctx, dw / 2, ph, dw, c.line);
    var by = ph + dh * 0.06;
    _text(ctx, data.head || '오늘의 시술', dw * 0.07, by, '600 34px ' + F_SERIF, c.ink, 'left');
    if (data.sub) _text(ctx, data.sub, dw * 0.07, by + dh * 0.04, '400 23px ' + F_SANS, c.sub, 'left');
    _text(ctx, sv.shop_handle || data.shop || '', dw * 0.93, by, '500 23px ' + F_SANS, c.accent, 'right');
  }

  // ════ ④ 시술 자랑 · 정사각 1:1 ════
  function _wmShowSquare(ctx, dw, dh, state, tpl, data, c) {
    var sv = (tpl && tpl.slotValues) || {};
    _bg(ctx, dw, dh, c);
    var ph = dh * 0.79;
    _photo(ctx, _main(state, tpl), 0, 0, dw, ph, 0, c, '＋ 사진');
    ctx.fillStyle = c.bg; ctx.fillRect(0, ph, dw, dh - ph);
    _rule(ctx, dw / 2, ph, dw, c.line);
    var by = ph + dh * 0.085;
    _text(ctx, data.head || '오늘의 시술', dw * 0.07, by, '600 38px ' + F_SERIF, c.ink, 'left');
    _text(ctx, sv.shop_handle || data.shop || '', dw * 0.93, by, '500 24px ' + F_SANS, c.accent, 'right');
  }

  // ════ ⑤ 고객 후기 · 피드 4:5 ════
  function _wmReviewFeed(ctx, dw, dh, state, tpl, data, c) {
    _bg(ctx, dw, dh, c);
    _photo(ctx, _main(state, tpl), 0, 0, dw, dh * 0.50, 0, c, '＋ 사진 또는 배경');
    var cx = dw * 0.08, cy = dh * 0.42, cw = dw * 0.84, ch = dh * 0.47;
    ctx.save(); ctx.shadowColor = 'rgba(31,27,24,0.12)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
    ctx.fillStyle = c.bg; _rr(ctx, cx, cy, cw, ch, 18); ctx.fill(); ctx.restore();
    _text(ctx, '“', cx + dw * 0.05, cy + dh * 0.085, '700 96px ' + F_SERIF, c.accent, 'left');
    _wrap(ctx, data.review || '손질이 훨씬 편해졌어요.', cx + dw * 0.07, cy + dh * 0.15, cw - dw * 0.14, dh * 0.052, '500 33px ' + F_SERIF, c.ink, 'left', 4);
    _text(ctx, '— ' + (data.customer || '고객 후기'), cx + dw * 0.07, cy + ch - dh * 0.06, '400 24px ' + F_SANS, c.sub, 'left');
    _ctaBar(ctx, cx + cw - dw * 0.30, cy + ch - dh * 0.085, dw * 0.26, dh * 0.05, data.cta, c);
  }

  // ════ ⑥ 고객 후기 · 스토리 9:16 ════
  function _wmReviewStory(ctx, dw, dh, state, tpl, data, c) {
    _bg(ctx, dw, dh, c);
    _photo(ctx, _main(state, tpl), 0, 0, dw, dh * 0.42, 0, c, '＋ 사진');
    var cx = dw * 0.08, cy = dh * 0.34, cw = dw * 0.84, ch = dh * 0.55;
    ctx.save(); ctx.shadowColor = 'rgba(31,27,24,0.12)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
    ctx.fillStyle = c.bg; _rr(ctx, cx, cy, cw, ch, 20); ctx.fill(); ctx.restore();
    _spaced(ctx, data.kicker || 'REVIEW', cx + dw * 0.07, cy + dh * 0.05, '400 22px ' + F_LATIN, c.accent, 'left', 4);
    _text(ctx, '“', cx + dw * 0.05, cy + dh * 0.12, '700 100px ' + F_SERIF, c.accent, 'left');
    _wrap(ctx, data.review || '손질이 훨씬 편해졌어요.', cx + dw * 0.07, cy + dh * 0.175, cw - dw * 0.14, dh * 0.05, '500 36px ' + F_SERIF, c.ink, 'left', 5);
    _text(ctx, '— ' + (data.customer || '고객 후기'), cx + dw * 0.07, cy + ch - dh * 0.095, '400 26px ' + F_SANS, c.sub, 'left');
    _ctaBar(ctx, cx + dw * 0.07, cy + ch - dh * 0.065, cw - dw * 0.14, dh * 0.044, data.cta, c);
  }

  // ════ ⑦ 이벤트 안내 · 피드 4:5 ════
  function _wmEventFeed(ctx, dw, dh, state, tpl, data, c) {
    var sv = (tpl && tpl.slotValues) || {};
    _bg(ctx, dw, dh, c);
    _frame(ctx, dw * 0.05, dh * 0.04, dw * 0.90, dh * 0.92, 16, c.line, 1.5);
    var px = dw * 0.10, py = dh * 0.10, pw = dw * 0.80, ph = dh * 0.33;
    _photo(ctx, _main(state, tpl), px, py, pw, ph, 10, c, '＋ 사진 (선택)'); _frame(ctx, px, py, pw, ph, 10, c.line, 1.2);
    _spaced(ctx, data.kicker || 'EVENT', dw / 2, dh * 0.52, '400 24px ' + F_LATIN, c.accent, 'center', 6);
    _fitLine(ctx, data.head || '첫 방문 고객 20% OFF', dw / 2, dh * 0.585, dw * 0.80, 50, F_SERIF, c.ink);
    _rule(ctx, dw / 2, dh * 0.62, dw * 0.12, c.line);
    _text(ctx, sv.event_period || '6월 한 달 · 평일 예약 한정', dw / 2, dh * 0.665, '400 26px ' + F_SANS, c.sub, 'center');
    _text(ctx, sv.event_benefit || data.sub || '', dw / 2, dh * 0.71, '500 28px ' + F_SANS, c.ink, 'center');
    _ctaBar(ctx, dw * 0.25, dh * 0.84, dw * 0.50, dh * 0.058, data.cta || '예약 문의는 DM', c);
  }

  // ════ ⑧ 이벤트 안내 · 스토리 9:16 ════
  function _wmEventStory(ctx, dw, dh, state, tpl, data, c) {
    var sv = (tpl && tpl.slotValues) || {};
    _bg(ctx, dw, dh, c);
    _frame(ctx, dw * 0.06, dh * 0.035, dw * 0.88, dh * 0.93, 18, c.line, 1.5);
    _spaced(ctx, data.kicker || 'EVENT', dw / 2, dh * 0.135, '400 26px ' + F_LATIN, c.accent, 'center', 8);
    var lines = (data.head || '첫 방문 고객\n20% OFF').split('\n');
    for (var i = 0; i < Math.min(lines.length, 3); i++) {
      _fitLine(ctx, lines[i], dw / 2, dh * 0.22 + i * dh * 0.075, dw * 0.78, 70, F_SERIF, c.ink);
    }
    _rule(ctx, dw / 2, dh * 0.41, dw * 0.14, c.line);
    _text(ctx, sv.event_period || '6월 한 달 · 평일 예약 한정', dw / 2, dh * 0.465, '400 30px ' + F_SANS, c.sub, 'center');
    _text(ctx, sv.event_benefit || '전 시술 20% 할인', dw / 2, dh * 0.515, '500 34px ' + F_SANS, c.ink, 'center');
    var px = dw * 0.16, py = dh * 0.56, pw = dw * 0.68, ph = dh * 0.26;
    _photo(ctx, _main(state, tpl), px, py, pw, ph, 12, c, '＋ 사진 (선택)'); _frame(ctx, px, py, pw, ph, 12, c.line, 1.2);
    _ctaBar(ctx, dw * 0.16, dh * 0.88, dw * 0.68, dh * 0.05, data.cta || '예약 문의는 DM', c);
  }

  // ════ ⑨ 홍보컷 · 피드 4:5 (텍스트 최소) ════
  function _wmPromoFeed(ctx, dw, dh, state, tpl, data, c) {
    var sv = (tpl && tpl.slotValues) || {};
    _bg(ctx, dw, dh, c);
    var drew = _photo(ctx, _main(state, tpl), 0, 0, dw, dh, 0, c, '＋ 보정 완료 사진');
    ctx.save(); ctx.strokeStyle = drew ? 'rgba(255,249,244,0.6)' : c.line; ctx.lineWidth = 1.5;
    _rr(ctx, dw * 0.04, dh * 0.03, dw * 0.92, dh * 0.94, 10); ctx.stroke(); ctx.restore();
    if (data.head) _text(ctx, data.head, dw * 0.06, dh * 0.10, '600 34px ' + F_SERIF, drew ? '#FFF9F4' : c.ink, 'left');
    if (sv.shop_handle) {
      if (drew) _scrimBottom(ctx, 0, dh * 0.85, dw, dh * 0.15, 0.4);
      _text(ctx, sv.shop_handle, dw / 2, dh * 0.94, '500 26px ' + F_SANS, drew ? '#FFF9F4' : c.sub, 'center');
    }
  }

  // ════ ⑩ 홍보컷 · 스토리 9:16 ════
  function _wmPromoStory(ctx, dw, dh, state, tpl, data, c) {
    var sv = (tpl && tpl.slotValues) || {};
    _bg(ctx, dw, dh, c);
    var drew = _photo(ctx, _main(state, tpl), 0, 0, dw, dh, 0, c, '＋ 사진');
    if (drew) _scrimBottom(ctx, 0, dh * 0.70, dw, dh * 0.30, 0.6);
    if (sv.shop_handle) _text(ctx, sv.shop_handle, dw / 2, dh * 0.86, '500 28px ' + F_SANS, drew ? 'rgba(255,249,244,0.9)' : c.sub, 'center');
    _ctaBar(ctx, dw * 0.18, dh * 0.89, dw * 0.64, dh * 0.05, data.cta || '예약 문의는 DM', c);
  }

  // ════ ⑪ 가격/시술 안내 · 피드 4:5 ════
  function _wmPriceFeed(ctx, dw, dh, state, tpl, data, c) {
    _bg(ctx, dw, dh, c);
    var m = dw * 0.10;
    _spaced(ctx, data.kicker || 'PRICE', dw / 2, dh * 0.10, '400 22px ' + F_LATIN, c.accent, 'center', 6);
    _fitLine(ctx, data.head || '시술 안내', dw / 2, dh * 0.155, dw * 0.80, 50, F_SERIF, c.ink);
    if (data.sub) _text(ctx, data.sub, dw / 2, dh * 0.198, '400 24px ' + F_SANS, c.sub, 'center');
    _rule(ctx, dw / 2, dh * 0.228, dw * 0.12, c.line);
    var svc = (data.services && data.services.length) ? data.services
      : [{ name: '컷', price: '45,000' }, { name: '컬러', price: '90,000~' }, { name: '클리닉', price: '120,000~' }];
    var n = Math.min(svc.length, 5), top = dh * 0.30, rowH = Math.min(dh * 0.095, (dh * 0.78 - top) / n);
    for (var i = 0; i < n; i++) {
      var s = svc[i] || {}, ry = top + i * rowH, mid = ry + rowH * 0.5;
      var nf = '500 34px ' + F_SERIF, pf = '500 34px ' + F_SANS;
      ctx.font = nf; var nameW = ctx.measureText(s.name || '시술').width;
      ctx.font = pf; var priceW = ctx.measureText(s.price || '').width;
      _text(ctx, s.name || '시술', m, mid + (s.desc ? -2 : 10), nf, c.ink, 'left');
      if (s.desc) _text(ctx, s.desc, m, mid + 28, '400 20px ' + F_SANS, c.sub, 'left');
      _text(ctx, s.price || '', dw - m, mid + 10, pf, c.ink, 'right');
      _dotted(ctx, m + nameW + 24, dw - m - priceW - 24, mid + 4, c.line);
    }
    _ctaBar(ctx, dw * 0.28, dh * 0.86, dw * 0.44, dh * 0.055, data.cta, c);
  }

  // ════ ⑫ 작업실 썸네일 카드 · 1:1 (사진 + 상태 + 시술명) ════
  function _wmThumbCard(ctx, dw, dh, state, tpl, data, c) {
    var sv = (tpl && tpl.slotValues) || {};
    _bg(ctx, dw, dh, c);
    var drew = _photo(ctx, _main(state, tpl), 0, 0, dw, dh, 0, c, '＋ 사진');
    var badge = sv.status_badge || '게시 준비';
    ctx.save(); ctx.font = '600 26px ' + F_SANS; var bw = ctx.measureText(badge).width + 44, bh = 54;
    ctx.fillStyle = c.badge; _rr(ctx, dw * 0.05, dh * 0.05, bw, bh, bh / 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(dw * 0.05 + 26, dh * 0.05 + bh / 2, 6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    _text(ctx, badge, dw * 0.05 + bw / 2 + 8, dh * 0.05 + bh * 0.66, '600 26px ' + F_SANS, '#FFF9F4', 'center');
    if (drew) _scrimBottom(ctx, 0, dh * 0.70, dw, dh * 0.30, 0.62);
    _text(ctx, data.serviceName || sv.service_name || '시술명', dw * 0.06, dh * 0.91, '600 42px ' + F_SERIF, drew ? '#FFF9F4' : c.ink, 'left');
  }

  // ── 등록(done=true → SKELETON 워터마크 없음) ──────────────
  BP._register('wm-ba-feed', _wmBaFeed, true);
  BP._register('wm-ba-story', _wmBaStory, true);
  BP._register('wm-show-feed', _wmShowFeed, true);
  BP._register('wm-show-square', _wmShowSquare, true);
  BP._register('wm-review-feed', _wmReviewFeed, true);
  BP._register('wm-review-story', _wmReviewStory, true);
  BP._register('wm-event-feed', _wmEventFeed, true);
  BP._register('wm-event-story', _wmEventStory, true);
  BP._register('wm-promo-feed', _wmPromoFeed, true);
  BP._register('wm-promo-story', _wmPromoStory, true);
  BP._register('wm-price-feed', _wmPriceFeed, true);
  BP._register('wm-thumb-card', _wmThumbCard, true);
})();
