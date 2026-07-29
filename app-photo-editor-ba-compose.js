/* 사진 편집기 — Canva식 Before/After 합성 */
(function () {
  'use strict';
  if (window.PhotoEditorBACompose) return;

  // [TPL-1 fix] rounded-rect path 헬퍼 — _roundedPhoto/_pill 등이 호출하나 정의 누락(Reference1Error)으로
  //   cream/polaroid 계열 BA 템플릿(_flowerShadow/_polaroid)이 적용·썸네일 모두 실패하던 기존 버그 복구.
  //   path 만 그림(clip/stroke 는 호출측). ctx.roundRect 있으면 사용, 없으면 arcTo 폴백.
  function _rr(ctx, x, y, w, h, r) {
    const rad = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') { ctx.roundRect(x, y, w, h, rad); return; }
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  // [UX-BA-2] 시술 전 사진(secondImg) 없으면 true → before 슬롯을 가짜 흑백 대신 placeholder 로.
  //   draw() 진입마다 갱신. 썸네일(null state)·미리보기·실제 적용 모두 동일 정책.
  let _hasBefore = false;
  const SLOT_IMAGE_CACHE = {};

  const LABELS = {
    'ba-flower-shadow': ['Before', 'After'],
    'ba-polaroid': ['Before', 'After'],
    'ba-editorial': ['Before', 'After'],
    'ba-2split-h': ['BEFORE', 'AFTER'],
    'ba-2split-v': ['BEFORE', 'AFTER'],
    'ba-3process': ['BEFORE', 'PROCESS', 'AFTER'],
    'ba-4grid': ['DETAIL', 'STYLE', 'BEFORE', 'AFTER'],
    'ba-price': ['BEFORE', 'AFTER'],
    'ba-event': ['BEFORE', 'AFTER'],
    'ba-review': ['BEFORE', 'AFTER'],
    'ba-arch-salon': ['BEFORE', 'AFTER'],
  };

  function draw(ctx, w, h, state, tpl, data) {
    _hasBefore = !!(state && state.secondImg);   // [UX-BA-2] 시술 전 사진 유무
    const after = _afterCanvas(state, _copyCanvas(ctx.canvas));
    const before = _beforeCanvas(state, after);   // secondImg 있을 때만 실제 사용 (없으면 placeholder)
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = _bg(tpl, data);
    ctx.fillRect(0, 0, w, h);
    _layout(ctx, w, h, before, after, tpl && tpl.id, data || {});
    ctx.restore();
  }

  function _copyCanvas(canvas) {
    const out = document.createElement('canvas');
    out.width = canvas.width; out.height = canvas.height;
    out.getContext('2d').drawImage(canvas, 0, 0);
    return out;
  }

  function _primeImage(src, img) {
    if (src && img) SLOT_IMAGE_CACHE[src] = img;
  }

  function _slotImage(src) {
    if (!src) return null;
    const cached = SLOT_IMAGE_CACHE[src];
    if (cached && (cached.complete || cached.naturalWidth || cached.width)) return cached;
    const img = cached || new Image();
    SLOT_IMAGE_CACHE[src] = img;
    img.onload = () => {
      /* [2026-07-22] 옛 PhotoEditor 캔버스 redraw 넛지 제거 — 편집기가 없어져 no-op 였다.
         현재 작업실은 합성 시점에 직접 렌더하므로 필요 없음. */
    };
    img.onerror = () => { delete SLOT_IMAGE_CACHE[src]; };
    if (!cached) img.src = src;
    return (img.complete || img.naturalWidth || img.width) ? img : null;
  }

  function _afterCanvas(state, fallback) {
    const slot = state && state.tplV2 && state.tplV2.imageSlots && state.tplV2.imageSlots.after_photo;
    const src = slot && slot.src;
    const img = _slotImage(src);
    if (!img) return fallback;
    const out = document.createElement('canvas');
    out.width = fallback.width; out.height = fallback.height;
    _cover(out.getContext('2d'), img, 0, 0, out.width, out.height, slot.focal, slot.zoom);   // [S4]
    return out;
  }

  function _beforeCanvas(state, fallback) {
    const out = document.createElement('canvas');
    out.width = fallback.width; out.height = fallback.height;
    const ctx = out.getContext('2d');
    // [요청] 시술 전 사진(secondImg) 없으면 — after 의 흑백 복사를 '가짜 before'로 쓰지 않는다(가짜 전후 금지).
    //   대신 '시술 전 사진 추가' 플레이스홀더를 그려 한 장 더 업로드를 유도(사진 가림 방지).
    if (!(state && state.secondImg)) {
      ctx.fillStyle = '#f1ece8';
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.fillStyle = '#b8a99a';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const fs = Math.max(14, Math.round(out.width * 0.07));
      ctx.font = '700 ' + fs + 'px sans-serif';
      ctx.fillText('＋ 시술 전 사진', out.width / 2, out.height / 2 - fs * 0.6);
      ctx.font = '500 ' + Math.round(fs * 0.62) + 'px sans-serif';
      ctx.fillText('한 장 더 추가해 주세요', out.width / 2, out.height / 2 + fs * 0.7);
      return out;
    }
    // [S4] before_photo 슬롯이 조정(focal≠0.5 또는 zoom>1)됐을 때만 cover+focal/zoom 적용.
    //   기본값(0.5/1)이면 기존 stretch 그대로 → 무회귀.
    const bslot = state.tplV2 && state.tplV2.imageSlots && state.tplV2.imageSlots.before_photo;
    const adjusted = bslot && (((bslot.focal) && (bslot.focal.x !== 0.5 || bslot.focal.y !== 0.5)) || (isFinite(bslot.zoom) && bslot.zoom > 1));
    ctx.filter = 'brightness(92%) saturate(90%)';
    if (adjusted) _cover(ctx, state.secondImg, 0, 0, out.width, out.height, bslot.focal, bslot.zoom);
    else ctx.drawImage(state.secondImg, 0, 0, out.width, out.height);
    ctx.filter = 'none';
    return out;
  }

  function _layout(ctx, w, h, before, after, id, data) {
    if (id === 'ba-arch-salon') return _archSalon(ctx, w, h, before, after, data);   // [ARCH-1]
    if (id === 'ba-flower-shadow') return _flowerShadow(ctx, w, h, before, after, data);
    if (id === 'ba-polaroid') return _polaroid(ctx, w, h, before, after, data);
    if (id === 'ba-editorial') return _editorial(ctx, w, h, before, after, data);
    if (id === 'ba-2split-v' || id === 'ba-event') return _vertical(ctx, w, h, before, after, id, data);
    if (id === 'ba-3process') return _process(ctx, w, h, before, after, data);
    if (id === 'ba-4grid') return _grid(ctx, w, h, before, after, data);
    // [HF2] v3 clean BA — palette + id 가드(legacy 무회귀)
    if (data && data.palette && /^v3-ba-clean-/.test(id)) return _v3BAClean(ctx, w, h, before, after, id, data);
    // [HF3] v3 sns pink BA — SNS 감성(폴라로이드/하트/스파클)
    if (data && data.palette && id === 'v3-ba-sns-pink') return _v3BASns(ctx, w, h, before, after, id, data);
    // v326 BA 12종 시리즈 — 스타일 suffix 로 기존 함수 라우팅
    if (typeof id === 'string' && /^ba-(hair|nail|lash|skin)-/.test(id)) {
      if (/-cream$/.test(id))    return _flowerShadow(ctx, w, h, before, after, data);
      if (/-polaroid$/.test(id)) return _polaroid(ctx, w, h, before, after, data);
      // -dark 등 그 외는 기본 horizontal (다크 배경은 _bg() 에서 처리)
    }
    _horizontal(ctx, w, h, before, after, id, data);
  }

  function _horizontal(ctx, w, h, before, after, id, data) {
    const pad = w * 0.08, gap = w * 0.035, top = h * 0.16;
    const boxW = (w - pad * 2 - gap) / 2, boxH = h * 0.56;
    _title(ctx, w, h, data, id);
    _photo(ctx, before, pad, top, boxW, boxH, true);
    _photo(ctx, after, pad + boxW + gap, top, boxW, boxH, false);
    _labels(ctx, [[pad, top, boxW], [pad + boxW + gap, top, boxW]], h, _baLabels(id, data), data);
    // [S2] before/after 캡션(편집값) — 사진 박스 아래.
    _baCaption(ctx, pad + boxW / 2, top + boxH, data.beforeCap, data);
    _baCaption(ctx, pad + boxW + gap + boxW / 2, top + boxH, data.afterCap, data);
    if (id === 'ba-price') _priceRows(ctx, w, h, data);
    else if (id === 'ba-review') _review(ctx, w, h, data);
    else _footer(ctx, w, h, data);
  }

  // [HF2] 텍스트 폭 클립
  function _clipBA(ctx, text, maxW) {
    let s = String(text == null ? '' : text);
    if (ctx.measureText(s).width <= maxW) return s;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
  }
  // [HF2] 라운드 pill 라벨(BEFORE/AFTER)
  function _baPill(ctx, cx, cy, text, bgC, h) {
    ctx.font = `800 ${Math.round(h * 0.017)}px "Noto Sans KR", sans-serif`;
    const tw = ctx.measureText(text).width; const padX = h * 0.014, ph = h * 0.033;
    const pw = tw + padX * 2, px = cx - pw / 2, py = cy - ph / 2;
    _rr(ctx, px, py, pw, ph, ph / 2); ctx.fillStyle = bgC; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, cx, cy + h * 0.001); ctx.textBaseline = 'alphabetic';
  }

  // [HF2] v3 clean BA — 라운드 프레임 + pill 라벨 + 중앙 arrow + 효과 포인트 + CTA. rose/blue 는 palette 로 색 구분.
  function _v3BAClean(ctx, w, h, before, after, id, data) {
    const ink = _pbg(data, 'ink') || '#3A2C2C';
    const sub = _pbg(data, 'sub') || '#9A8585';
    const accent = _pbg(data, 'accent') || '#C57E7E';
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
    // 헤더
    let y = h * 0.075;
    if (data.shop) { ctx.fillStyle = accent; ctx.font = `800 ${Math.round(h * 0.017)}px "Noto Sans KR", sans-serif`; ctx.fillText(_clipBA(ctx, String(data.shop).toUpperCase(), w * 0.8), w / 2, y); y += h * 0.04; }
    ctx.fillStyle = ink; ctx.font = `800 ${Math.round(h * 0.044)}px "Noto Serif KR", serif`; ctx.fillText(_clipBA(ctx, data.head || '시술 전후', w * 0.86), w / 2, y); y += h * 0.032;
    if (data.sub) { ctx.fillStyle = sub; ctx.font = `500 ${Math.round(h * 0.018)}px "Noto Sans KR", sans-serif`; ctx.fillText(_clipBA(ctx, data.sub, w * 0.82), w / 2, y); }
    // 사진 2분할(라운드)
    const pad = w * 0.07, gap = w * 0.05, top = h * 0.205;
    const boxW = (w - pad * 2 - gap) / 2, boxH = h * 0.45, r = w * 0.045;
    _roundedPhoto(ctx, before, pad, top, boxW, boxH, r, true, false);
    _roundedPhoto(ctx, after, pad + boxW + gap, top, boxW, boxH, r, false, false);
    // pill 라벨
    const labels = _baLabels(id, data);
    _baPill(ctx, pad + boxW * 0.5, top + h * 0.032, labels[0] || 'BEFORE', ink, h);
    _baPill(ctx, pad + boxW + gap + boxW * 0.5, top + h * 0.032, labels[1] || 'AFTER', accent, h);
    // 중앙 화살표 원
    const ax = pad + boxW + gap / 2, ay = top + boxH / 2, ar = w * 0.046;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ax, ay, ar * 1.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${Math.round(ar * 1.4)}px sans-serif`; ctx.fillText('›', ax, ay + ar * 0.04); ctx.textBaseline = 'alphabetic';
    // caption
    const capY = top + boxH;
    if (data.beforeCap) _baCaption(ctx, pad + boxW / 2, capY, data.beforeCap, data);
    if (data.afterCap) _baCaption(ctx, pad + boxW + gap + boxW / 2, capY, data.afterCap, data);
    // 효과 포인트 3개
    const fx = ['피부결 개선', '톤 정리', '윤기 케어'];
    const fyY = h * 0.80;
    fx.forEach((t, i) => {
      const cxp = w * (0.22 + i * 0.28);
      ctx.fillStyle = accent; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(cxp, fyY - h * 0.02, w * 0.011, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.font = `600 ${Math.round(h * 0.018)}px "Noto Sans KR", sans-serif`; ctx.fillText(t, cxp, fyY + h * 0.02);
    });
    // CTA pill
    if (data.cta) {
      const cw = w * 0.46, ch = h * 0.05, cx = w / 2 - cw / 2, cy = h * 0.89;
      _rr(ctx, cx, cy, cw, ch, ch / 2); ctx.fillStyle = accent; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `800 ${Math.round(h * 0.021)}px "Noto Sans KR", sans-serif`; ctx.fillText(_clipBA(ctx, data.cta, cw * 0.85), w / 2, cy + ch * 0.64);
    }
  }

  // [HF3] 유니코드 글리프 데코(♥/✦ — 이모지 아님, 단색 글리프)
  function _glyph(ctx, ch, cx, cy, size, color, alpha) {
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.fillStyle = color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${Math.round(size)}px sans-serif`;
    ctx.fillText(ch, cx, cy); ctx.restore();
  }
  // [HF3] 회전 폴라로이드
  function _rotPolaroid(ctx, img, x, y, w, h, rad, label, kor, before) {
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rad);
    _polaroidPhoto(ctx, img, -w / 2, -h / 2, w, h, label, kor, before);
    ctx.restore();
  }

  // [HF3] v3 sns pink — 폴라로이드 2장 + 하트/스파클 + 손글씨 라벨. 핑크/크림 SNS 감성.
  function _v3BASns(ctx, w, h, before, after, id, data) {
    const ink = _pbg(data, 'ink') || '#3F2C32';
    const sub = _pbg(data, 'sub') || '#A2868E';
    const accent = _pbg(data, 'accent') || '#F24E86';
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
    // 헤더
    let y = h * 0.08;
    if (data.shop) { ctx.fillStyle = accent; ctx.font = `800 ${Math.round(h * 0.017)}px "Noto Sans KR", sans-serif`; ctx.fillText(_clipBA(ctx, String(data.shop).toUpperCase(), w * 0.7), w / 2, y); y += h * 0.042; }
    ctx.fillStyle = ink; ctx.font = `800 ${Math.round(h * 0.046)}px "Noto Serif KR", serif`;
    const head = _clipBA(ctx, data.head || '시술 전후', w * 0.7);
    ctx.fillText(head, w / 2, y);
    const hw = ctx.measureText(head).width;
    _glyph(ctx, '♥', w / 2 + hw / 2 + w * 0.045, y - h * 0.014, h * 0.034, accent, 0.95);   // 헤드 옆 하트
    _glyph(ctx, '✦', w / 2 - hw / 2 - w * 0.04, y - h * 0.02, h * 0.026, accent, 0.7);
    y += h * 0.03;
    if (data.sub) { ctx.fillStyle = sub; ctx.font = `500 ${Math.round(h * 0.018)}px "Noto Sans KR", sans-serif`; ctx.fillText(_clipBA(ctx, data.sub, w * 0.78), w / 2, y); }
    // 폴라로이드 2장(살짝 회전)
    const pw = w * 0.42, ph = h * 0.40, topY = h * 0.24;
    _rotPolaroid(ctx, before, w * 0.05, topY, pw, ph, -0.055, (data.beforeLabel || 'Before'), '시술전', true);
    _rotPolaroid(ctx, after, w * 0.53, topY, pw, ph, 0.055, (data.afterLabel || 'After'), '시술후', false);
    // 스파클/하트 데코
    _glyph(ctx, '✦', w * 0.5, topY + ph * 0.2, h * 0.03, accent, 0.85);
    _glyph(ctx, '♥', w * 0.5, topY + ph * 0.75, h * 0.026, accent, 0.8);
    _glyph(ctx, '✦', w * 0.92, topY + ph * 0.5, h * 0.022, accent, 0.5);
    _glyph(ctx, '✦', w * 0.06, topY + ph * 0.9, h * 0.02, accent, 0.45);
    // caption (폴라로이드 아래)
    const capY = topY + ph + h * 0.05;
    if (data.beforeCap || data.afterCap) {
      ctx.fillStyle = ink; ctx.font = `600 ${Math.round(h * 0.018)}px "Noto Sans KR", sans-serif`;
      if (data.beforeCap) ctx.fillText(_clipBA(ctx, data.beforeCap, w * 0.42), w * 0.26, capY);
      if (data.afterCap) ctx.fillText(_clipBA(ctx, data.afterCap, w * 0.42), w * 0.74, capY);
    }
    // CTA pill
    if (data.cta) {
      const cw = w * 0.5, ch = h * 0.052, cx = w / 2 - cw / 2, cy = h * 0.88;
      _rr(ctx, cx, cy, cw, ch, ch / 2); ctx.fillStyle = accent; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `800 ${Math.round(h * 0.021)}px "Noto Sans KR", sans-serif`;
      ctx.fillText(_clipBA(ctx, data.cta, cw * 0.85), w / 2, cy + ch * 0.64);
      _glyph(ctx, '♥', cx + cw + w * 0.03, cy + ch / 2, h * 0.024, accent, 0.8);
    }
  }

  // ── [ARCH-1] 아치형 전후 비교 — Canva 레퍼런스(베이지+다크그린 아치) slot 재구현 ──────────
  //   palette(default/rose-ivory/mono-charcoal) 색으로 그림. 구도/프레임/화살표/pill 은 고정,
  //   사진(before/after)·제목(head)·카테고리·라벨·핸들만 편집값으로 교체.
  function _archPath(ctx, x, y, w, h) {
    const r = w / 2;
    ctx.beginPath();
    ctx.moveTo(x, y + r);
    ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 2, false);   // 상단 반원(아치)
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
  }

  // 자간 적용 폭/중앙 그리기(라벨·eyebrow 용 — 폰트는 호출측에서 set)
  function _trackedWidth(ctx, text, tracking) {
    let sum = 0;
    for (const ch of String(text)) sum += ctx.measureText(ch).width + tracking;
    return Math.max(0, sum - tracking);
  }
  function _drawTrackedCentered(ctx, text, cx, cy, tracking) {
    const total = _trackedWidth(ctx, text, tracking);
    const prevAlign = ctx.textAlign, prevBase = ctx.textBaseline;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    let x = cx - total / 2;
    for (const ch of String(text)) { ctx.fillText(ch, x, cy); x += ctx.measureText(ch).width + tracking; }
    ctx.textAlign = prevAlign; ctx.textBaseline = prevBase;
  }

  // 제목 자동 줄바꿈(공백 우선) — maxLines 초과/폭 초과 시 폰트 축소. 굵은 한글 가독성 유지.
  function _wrapWords(ctx, text, maxW) {
    const words = String(text).trim().split(/\s+/);
    const lines = []; let cur = '';
    words.forEach((wd) => {
      const t = cur ? cur + ' ' + wd : wd;
      if (!cur || ctx.measureText(t).width <= maxW) cur = t;
      else { lines.push(cur); cur = wd; }
    });
    if (cur) lines.push(cur);
    return lines;
  }
  function _fitTitle(ctx, text, maxW, basePx, maxLines) {
    let px = basePx;
    for (let i = 0; i < 9; i++) {
      ctx.font = `800 ${px}px "Noto Serif KR", "Noto Sans KR", serif`;
      if (ctx.measureText(text).width <= maxW) return { lines: [text], px };
      const lines = _wrapWords(ctx, text, maxW);
      if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxW)) return { lines, px };
      px = Math.round(px * 0.9);
      if (px <= basePx * 0.55) { ctx.font = `800 ${px}px "Noto Serif KR", "Noto Sans KR", serif`; return { lines: _wrapWords(ctx, text, maxW).slice(0, maxLines), px }; }
    }
    return { lines: [text], px };
  }

  function _archPhoto(ctx, photo, x, y, w, h, frame, frameInner, isBefore) {
    ctx.save();
    _archPath(ctx, x, y, w, h);
    ctx.clip();
    if (isBefore && !_hasBefore) {
      _beforePlaceholder(ctx, x, y, w, h, false);   // 가짜 before 금지 — '시술 전 사진 추가' 안내
    } else {
      ctx.filter = isBefore ? 'brightness(97%) saturate(96%)' : 'brightness(103%) saturate(106%)';
      _cover(ctx, photo, x, y, w, h);
      ctx.filter = 'none';
    }
    ctx.restore();
    // 외곽 굵은 테두리(다크그린 등) + 안쪽 얇은 라인 = 정돈된 이중 테두리
    ctx.save();
    _archPath(ctx, x, y, w, h);
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, w * 0.05);
    ctx.strokeStyle = frame;
    ctx.stroke();
    ctx.restore();
    const inset = Math.max(2, w * 0.03);
    ctx.save();
    _archPath(ctx, x + inset, y + inset, w - inset * 2, h - inset);
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, w * 0.006);
    ctx.strokeStyle = frameInner;
    ctx.stroke();
    ctx.restore();
  }

  // 중앙 곡선 화살표(원본 손그림 곡선을 매끈하게 정돈) — 좌→상단 호→우하 + 화살촉
  function _archArrow(ctx, cx, cy, hw, hh, color) {
    const x0 = cx - hw, y0 = cy + hh * 0.18;
    const x1 = cx + hw * 0.92, y1 = cy + hh * 0.78;
    const cpx = cx - hw * 0.05, cpy = cy - hh * 0.55;
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = Math.max(2.5, hw * 0.07);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cpx, cpy, x1, y1); ctx.stroke();
    const ang = Math.atan2(y1 - cpy, x1 - cpx);
    const ah = Math.max(7, hw * 0.3);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - ah * Math.cos(ang - 0.42), y1 - ah * Math.sin(ang - 0.42));
    ctx.lineTo(x1 - ah * Math.cos(ang + 0.42), y1 - ah * Math.sin(ang + 0.42));
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function _archPill(ctx, cx, cy, text, bg, fg, h) {
    const fs = Math.round(h * 0.026);
    const tracking = fs * 0.14;
    ctx.save();
    ctx.font = `800 ${fs}px "Noto Sans KR", sans-serif`;
    const label = String(text || '');
    const tw = _trackedWidth(ctx, label, tracking);
    const padX = h * 0.03, ph = h * 0.06;
    const pw = Math.max(tw + padX * 2, h * 0.13);
    const px = cx - pw / 2, py = cy - ph / 2;
    ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = h * 0.012; ctx.shadowOffsetY = h * 0.004;
    ctx.fillStyle = bg; _rr(ctx, px, py, pw, ph, ph / 2); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = fg;
    _drawTrackedCentered(ctx, label, cx, cy, tracking);
    ctx.restore();
  }

  function _archSalon(ctx, w, h, before, after, data) {
    const P = (data && data.palette) || {};
    const ink = P.ink || '#1A1A1A';
    const eyebrow = P.eyebrow || ink;
    const subc = P.sub || '#6B6258';
    const frame = P.frame || '#23291E';
    const frameInner = P.frameInner || 'rgba(0,0,0,0.5)';
    const arrowC = P.arrow || '#281C18';
    const pillC = P.pill || '#111111';
    const pillFg = P.pillText || '#FFFFFF';
    ctx.textBaseline = 'alphabetic';

    // 1) 상단 카테고리(eyebrow) — 자간 넓은 산세리프
    const cat = (data.categoryLabel != null && data.categoryLabel !== '') ? data.categoryLabel : (data.kicker || 'BEAUTY SALON');
    const eyeFs = Math.round(h * 0.023);
    ctx.fillStyle = eyebrow; ctx.font = `700 ${eyeFs}px "Noto Sans KR", sans-serif`;
    _drawTrackedCentered(ctx, String(cat).toUpperCase(), w / 2, h * 0.05, eyeFs * 0.22);

    // 2) 큰 제목 — 자동 줄바꿈/축소(굵은 한글). eyebrow 아래 고정 top 스택(1·2줄 모두 충돌 없음).
    const fit = _fitTitle(ctx, data.head || '시술 전후', w * 0.86, Math.round(h * 0.078), 2);
    ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = `800 ${fit.px}px "Noto Serif KR", "Noto Sans KR", serif`;
    const lineH = fit.px * 1.08;
    const firstBaseline = h * 0.155;   // 첫 줄 baseline 고정 → 위 eyebrow 와 항상 분리
    fit.lines.forEach((ln, i) => ctx.fillText(ln, w / 2, firstBaseline + i * lineH));
    const titleBottom = firstBaseline + (fit.lines.length - 1) * lineH;

    // 3) optional 캡션 한 줄(subtitle) — 있을 때만
    if (data.sub) {
      ctx.fillStyle = subc; ctx.font = `500 ${Math.round(h * 0.02)}px "Noto Sans KR", sans-serif`;
      ctx.fillText(_clipBA(ctx, data.sub, w * 0.8), w / 2, titleBottom + h * 0.045);
    }

    // 4) 좌우 아치(대칭) — 원본 좌표 비율 재현
    const archW = w * 0.372, archH = h * 0.555, archY = h * 0.315;
    const lx = w * 0.097, rx = w * 0.531;
    _archPhoto(ctx, before, lx, archY, archW, archH, frame, frameInner, true);
    _archPhoto(ctx, after, rx, archY, archW, archH, frame, frameInner, false);

    // 5) 중앙 곡선 화살표(아치 상단 갭)
    _archArrow(ctx, w * 0.5, archY - h * 0.01, w * 0.11, h * 0.085, arrowC);

    // 6) BEFORE/AFTER pill — 사진 하단에 안정적으로 겹침
    const labels = _baLabels('ba-arch-salon', data);
    const pillY = archY + archH * 0.96;
    _archPill(ctx, lx + archW / 2, pillY, labels[0] || 'BEFORE', pillC, pillFg, h);
    _archPill(ctx, rx + archW / 2, pillY, labels[1] || 'AFTER', pillC, pillFg, h);

    // 7) before/after 캡션(선택 입력 시에만 — 원본은 pill 만)
    if (data.beforeCap) _baCaption(ctx, lx + archW / 2, archY + archH, data.beforeCap, data);
    if (data.afterCap) _baCaption(ctx, rx + archW / 2, archY + archH, data.afterCap, data);

    // 8) 샵 핸들(하단) — shop_handle 없으면 샵명 fallback
    const handle = (data.shopHandle != null && data.shopHandle !== '') ? data.shopHandle : data.shop;
    if (handle) {
      ctx.fillStyle = subc; ctx.textAlign = 'center';
      ctx.font = `600 ${Math.round(h * 0.02)}px "Noto Sans KR", sans-serif`;
      ctx.fillText(_clipBA(ctx, String(handle), w * 0.7), w / 2, h * 0.965);
    }
  }

  // [S2] 편집 가능 라벨 — slotValues.before_label/after_label 우선, 없으면 프리셋.
  function _baLabels(id, data) {
    const base = (LABELS[id] || LABELS['ba-2split-h']).slice();
    if (data && data.beforeLabel) base[0] = data.beforeLabel;
    if (data && data.afterLabel) base[1] = data.afterLabel;
    return base;
  }

  function _baCaption(ctx, cx, boxBottom, text, data) {
    if (!text) return;
    const h = ctx.canvas.height;
    ctx.save();
    ctx.fillStyle = _pbg(data, 'ink') || 'rgba(17,18,23,0.74)';   // [V3] palette.ink 우선
    ctx.textAlign = 'center';
    ctx.font = `600 ${Math.round(h * 0.018)}px "Noto Sans KR", sans-serif`;
    ctx.fillText(String(text).slice(0, 24), cx, boxBottom + h * 0.032);
    ctx.restore();
  }

  function _flowerShadow(ctx, w, h, before, after, data) {
    _softBotanical(ctx, w, h);
    ctx.fillStyle = '#141414';
    ctx.textAlign = 'center';
    ctx.font = `400 ${Math.round(h * 0.052)}px Georgia, "Times New Roman", serif`;
    ctx.fillText(data.head || 'Before & After', w / 2, h * 0.1);
    ctx.font = `400 ${Math.round(h * 0.025)}px "Noto Serif KR", serif`;
    ctx.fillText(data.sub || '시술 전후 모습을 확인해 보세요!', w / 2, h * 0.145);
    ctx.strokeStyle = '#151515';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(w * 0.1, h * 0.21); ctx.lineTo(w * 0.9, h * 0.21); ctx.stroke();
    const pad = w * 0.1, gap = w * 0.045, top = h * 0.29;
    const boxW = (w - pad * 2 - gap) / 2, boxH = h * 0.44;
    _roundedPhoto(ctx, before, pad, top, boxW, boxH, 22, true, true);
    _roundedPhoto(ctx, after, pad + boxW + gap, top, boxW, boxH, 22, false, true);
    _scriptLabel(ctx, pad + boxW / 2, h * 0.79, 'Before', '전');
    _scriptLabel(ctx, pad + boxW + gap + boxW / 2, h * 0.79, 'After', '후');
    _smallBrand(ctx, w, h, data, '#171717');
  }

  function _polaroid(ctx, w, h, before, after, data) {
    ctx.fillStyle = '#eee9e2'; ctx.fillRect(0, 0, w, h);
    _softShadow(ctx, w * 0.52, h * 0.03, w * 0.42, h * 0.12);
    ctx.fillStyle = '#5f4a3e';
    ctx.textAlign = 'center';
    ctx.font = `400 ${Math.round(h * 0.072)}px Georgia, "Times New Roman", serif`;
    ctx.fillText(data.head || 'Before & After', w / 2, h * 0.19);
    const pad = w * 0.055, gap = w * 0.02, top = h * 0.29;
    const boxW = (w - pad * 2 - gap) / 2, boxH = h * 0.5;
    _polaroidPhoto(ctx, before, pad, top, boxW, boxH, 'Before', '시술전', true);
    _polaroidPhoto(ctx, after, pad + boxW + gap, top, boxW, boxH, 'After', '시술후', false);
    _searchPill(ctx, w, h, data.shop || '@itdasy');
  }

  function _editorial(ctx, w, h, before, after, data) {
    ctx.fillStyle = '#f6f1e9'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d9c8b3'; ctx.fillRect(0, h * 0.82, w, h * 0.18);
    ctx.fillStyle = '#3a2d27';
    ctx.textAlign = 'center';
    ctx.font = `700 ${Math.round(h * 0.018)}px "Noto Sans KR", sans-serif`;
    ctx.fillText('@' + String(data.shop || 'itdasy').replace(/^@/, ''), w / 2, h * 0.09);
    ctx.font = `400 ${Math.round(h * 0.065)}px Georgia, "Times New Roman", serif`;
    ctx.fillText(data.head || 'Before & After', w / 2, h * 0.19);
    const pad = w * 0.08, gap = w * 0.035, top = h * 0.29;
    const boxW = (w - pad * 2 - gap) / 2, boxH = h * 0.46;
    _framedPhoto(ctx, before, pad, top, boxW, boxH, true);
    _framedPhoto(ctx, after, pad + boxW + gap, top, boxW, boxH, false);
    _searchPill(ctx, w, h, '@' + String(data.shop || 'itdasy').replace(/^@/, '').toUpperCase());
    ctx.fillStyle = '#fff';
    ctx.font = `600 ${Math.round(h * 0.032)}px Georgia, "Times New Roman", serif`;
    ctx.fillText(data.shop || 'Itdasy beauty salon', w / 2, h * 0.9);
  }

  function _vertical(ctx, w, h, before, after, id, data) {
    const pad = w * 0.08, gap = h * 0.022, top = h * 0.12;
    const boxH = (h * 0.68 - gap) / 2;
    _title(ctx, w, h, data, id);
    _photo(ctx, before, pad, top, w - pad * 2, boxH, true);
    _photo(ctx, after, pad, top + boxH + gap, w - pad * 2, boxH, false);
    _labels(ctx, [[pad, top, w - pad * 2], [pad, top + boxH + gap, w - pad * 2]], h, _baLabels(id, data));
    if (id === 'ba-event') _eventBand(ctx, w, h, data);
    else _footer(ctx, w, h, data);
  }

  function _process(ctx, w, h, before, after, data) {
    const pad = w * 0.07, gap = w * 0.025, y = h * 0.22;
    const boxW = (w - pad * 2 - gap * 2) / 3, boxH = h * 0.46;
    _title(ctx, w, h, data, 'ba-3process');
    _photo(ctx, before, pad, y, boxW, boxH, true);
    _photo(ctx, after, pad + boxW + gap, y, boxW, boxH, false, 0.75);
    _photo(ctx, after, pad + (boxW + gap) * 2, y, boxW, boxH, false);
    _labels(ctx, [[pad, y, boxW], [pad + boxW + gap, y, boxW], [pad + (boxW + gap) * 2, y, boxW]], h, LABELS['ba-3process']);
    _footer(ctx, w, h, data);
  }

  function _grid(ctx, w, h, before, after, data) {
    const pad = w * 0.08, gap = w * 0.03, y = h * 0.16;
    const box = (w - pad * 2 - gap) / 2;
    _title(ctx, w, h, data, 'ba-4grid');
    [[after, 0, 0], [after, 1, 0], [before, 0, 1], [after, 1, 1]].forEach((item, idx) => {
      const x = pad + item[1] * (box + gap), yy = y + item[2] * (box + gap);
      _photo(ctx, item[0], x, yy, box, box, idx === 2);
    });
    _footer(ctx, w, h, data);
  }

  // [UX-BA-2] 시술 전 사진 없을 때 before 슬롯 placeholder (가짜 흑백 금지).
  //   점선 박스 + 카메라(+) + 안내문구. 썸네일처럼 작으면 텍스트 생략.
  function _beforePlaceholder(ctx, x, y, w, h, rounded) {
    ctx.save();
    if (rounded) _rr(ctx, x, y, w, h, Math.min(22, w * 0.08));
    else { ctx.beginPath(); ctx.rect(x, y, w, h); }
    ctx.fillStyle = 'rgba(0,0,0,0.045)';
    ctx.fill();
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = Math.max(2, w * 0.012);
    ctx.strokeStyle = 'rgba(90,78,64,0.55)';
    ctx.stroke();
    ctx.setLineDash([]);
    const cx = x + w / 2, cy = y + h * 0.42, r = Math.min(w, h) * 0.11;
    ctx.strokeStyle = 'rgba(90,78,64,0.62)';
    ctx.lineWidth = Math.max(2, w * 0.014);
    ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();
    if (w >= 140) {                                   // 썸네일/소형은 텍스트 생략(가독 불가)
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(74,62,48,0.9)';
      ctx.font = `700 ${Math.round(Math.min(w, h) * 0.092)}px "Noto Sans KR", sans-serif`;
      ctx.fillText('시술 전 사진 추가', cx, cy + h * 0.2);
      ctx.fillStyle = 'rgba(120,108,92,0.85)';
      ctx.font = `400 ${Math.round(Math.min(w, h) * 0.062)}px "Noto Sans KR", sans-serif`;
      ctx.fillText('추가하면 전후 비교가', cx, cy + h * 0.31);
      ctx.fillText('완성돼요', cx, cy + h * 0.39);
    }
    ctx.restore();
  }

  function _photo(ctx, img, x, y, w, h, before, alpha) {
    if (before && !_hasBefore) { _beforePlaceholder(ctx, x, y, w, h, false); return; }   // [UX-BA-2]
    ctx.save();
    ctx.globalAlpha = alpha || 1;
    // before 를 너무 칙칙하게(가짜로) 만들지 않음 — 전·후 둘 다 자연스럽게 보이도록 desaturate 완화.
    ctx.filter = before ? 'brightness(96%) grayscale(6%)' : 'saturate(108%) brightness(103%)';
    _cover(ctx, img, x, y, w, h);
    ctx.filter = 'none';
    ctx.strokeStyle = 'rgba(255,255,255,0.86)';
    ctx.lineWidth = Math.max(2, w * 0.012);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  function _roundedPhoto(ctx, img, x, y, w, h, r, before, dashed) {
    if (before && !_hasBefore) { _beforePlaceholder(ctx, x, y, w, h, true); return; }   // [UX-BA-2]
    ctx.save();
    _rr(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.filter = before ? 'brightness(97%) saturate(96%)' : 'brightness(104%) saturate(108%) contrast(104%)';
    _cover(ctx, img, x, y, w, h);
    ctx.restore();
    ctx.save();
    _rr(ctx, x, y, w, h, r);
    ctx.strokeStyle = dashed ? 'rgba(20,20,20,0.8)' : 'rgba(255,255,255,0.9)';
    ctx.lineWidth = Math.max(2, w * 0.008);
    if (dashed) ctx.setLineDash([10, 6]);
    ctx.stroke();
    ctx.restore();
  }

  function _polaroidPhoto(ctx, img, x, y, w, h, label, kor, before) {
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    _photo(ctx, img, x + w * 0.045, y + w * 0.045, w * 0.91, h * 0.76, before);
    ctx.fillStyle = '#5f4a3e';
    ctx.font = `400 ${Math.round(h * 0.052)}px Georgia, "Times New Roman", serif`;
    ctx.textAlign = 'left';
    ctx.fillText(label, x + w * 0.09, y + h * 0.92);
    ctx.font = `500 ${Math.round(h * 0.038)}px "Noto Serif KR", serif`;
    ctx.textAlign = 'right';
    ctx.fillText(kor, x + w * 0.91, y + h * 0.92);
  }

  function _framedPhoto(ctx, img, x, y, w, h, before) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, w, h);
    if (before && !_hasBefore) _beforePlaceholder(ctx, x + w * 0.045, y + w * 0.045, w * 0.91, h * 0.78, false);   // [UX-BA-2]
    else _cover(ctx, img, x + w * 0.045, y + w * 0.045, w * 0.91, h * 0.78);
    ctx.fillStyle = '#5f4a3e';
    ctx.font = `400 ${Math.round(h * 0.05)}px Georgia, "Times New Roman", serif`;
    ctx.textAlign = 'left';
    ctx.fillText(before ? 'Before' : 'After', x + w * 0.08, y + h * 0.92);
    ctx.font = `500 ${Math.round(h * 0.035)}px "Noto Serif KR", serif`;
    ctx.textAlign = 'right';
    ctx.fillText(before ? '시술전' : '시술후', x + w * 0.92, y + h * 0.92);
  }

  function _scriptLabel(ctx, x, y, en, ko) {
    ctx.fillStyle = '#202020';
    ctx.textAlign = 'center';
    ctx.font = `400 42px "Brush Script MT", "Segoe Script", cursive`;
    ctx.fillText(en, x, y);
    ctx.font = '400 28px "Noto Serif KR", serif';
    ctx.fillText(ko, x, y + 42);
  }

  function _smallBrand(ctx, w, h, data, color) {
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.font = `600 ${Math.round(h * 0.02)}px "Noto Sans KR", sans-serif`;
    ctx.fillText(String(data.shop || 'REALLYGREATSITE.COM').toUpperCase(), w / 2, h * 0.94);
  }

  function _softBotanical(ctx, w, h) {
    ctx.fillStyle = '#e7e5de';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#6e756c';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(w * (0.78 + i * 0.03), h * (0.3 + i * 0.09), w * 0.04, h * 0.16, -0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    _softShadow(ctx, w * 0.08, h * 0.76, w * 0.35, h * 0.1);
  }

  function _softShadow(ctx, x, y, w, h) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#151515';
    ctx.filter = 'blur(18px)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function _searchPill(ctx, w, h, label) {
    const x = w * 0.32, y = h * 0.8, pw = w * 0.36, ph = h * 0.052;
    ctx.save();
    ctx.fillStyle = '#fff';
    _rr(ctx, x, y, pw, ph, ph / 2);
    ctx.fill();
    ctx.fillStyle = '#6b5a50';
    ctx.font = `700 ${Math.round(ph * 0.34)}px "Noto Sans KR", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + pw / 2, y + ph / 2);
    ctx.restore();
  }

  // [S4] cover crop + focal(0~1)·zoom(>=1). focal=0.5/zoom=1 → 기존 중앙 cover 와 동일(무회귀).
  function _coverCrop(iw, ih, dw, dh, focal, zoom) {
    const fx = (focal && isFinite(focal.x)) ? Math.max(0, Math.min(1, focal.x)) : 0.5;
    const fy = (focal && isFinite(focal.y)) ? Math.max(0, Math.min(1, focal.y)) : 0.5;
    const z = (isFinite(zoom) && zoom > 1) ? zoom : 1;
    const sAR = iw / ih, dAR = dw / dh;
    let sw, sh;
    if (sAR > dAR) { sh = ih; sw = sh * dAR; } else { sw = iw; sh = sw / dAR; }
    sw /= z; sh /= z;
    let sx = (iw - sw) * fx, sy = (ih - sh) * fy;
    sx = Math.max(0, Math.min(iw - sw, sx));
    sy = Math.max(0, Math.min(ih - sh, sy));
    return { sx, sy, sw, sh };
  }
  function _cover(ctx, img, x, y, w, h, focal, zoom) {
    const iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight;
    const c = _coverCrop(iw, ih, w, h, focal, zoom);
    ctx.drawImage(img, c.sx, c.sy, c.sw, c.sh, x, y, w, h);
  }

  function _title(ctx, w, h, data, id) {
    // [V3] palette.ink 우선(없으면 기존색 — 무회귀)
    ctx.fillStyle = _pbg(data, 'ink') || (id === 'ba-event' ? '#fff' : '#17181d');
    ctx.textAlign = 'center';
    ctx.font = `800 ${Math.round(h * 0.042)}px "Noto Serif KR", serif`;
    ctx.fillText(data.head || 'Before & After', w / 2, h * 0.09);
  }
  // [V3] palette 키 안전 추출 — 없으면 '' (falsy → 기존색 fallback)
  function _pbg(data, key) {
    const p = data && data.palette;
    return (p && typeof p[key] === 'string' && p[key]) ? p[key] : '';
  }

  function _labels(ctx, boxes, h, labels, data) {
    // [V3] after 라벨 = palette.accent, before 라벨 = palette.ink (없으면 기존색)
    const aft = _pbg(data, 'accent') || '#D58A95';
    const bef = _pbg(data, 'ink') || '#111217';
    boxes.forEach((box, i) => {
      ctx.fillStyle = i === boxes.length - 1 ? aft : bef;
      ctx.fillRect(box[0] + 10, box[1] + 10, Math.min(box[2] * 0.45, 126), h * 0.036);
      ctx.fillStyle = '#fff';
      ctx.font = `800 ${Math.round(h * 0.017)}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(labels[i] || '', box[0] + 18, box[1] + h * 0.034);
    });
  }

  function _footer(ctx, w, h, data) {
    ctx.textAlign = 'center';
    const acc = _pbg(data, 'accent') || '#D58A95';
    const subc = _pbg(data, 'sub') || '#555';
    // [S2] cta/phone(편집값) 있으면 표기, 없으면 기존 샵명. [V3] palette 색 우선.
    if (data.cta || data.phone) {
      ctx.fillStyle = acc;
      ctx.font = `800 ${Math.round(h * 0.02)}px "Noto Sans KR", sans-serif`;
      ctx.fillText(data.cta || '예약 문의', w / 2, h * 0.88);
      if (data.phone) {
        ctx.fillStyle = subc;
        ctx.font = `600 ${Math.round(h * 0.02)}px sans-serif`;
        ctx.fillText(data.phone, w / 2, h * 0.915);
      }
      return;
    }
    ctx.fillStyle = subc;
    ctx.font = `600 ${Math.round(h * 0.018)}px sans-serif`;
    ctx.fillText(data.shop || '잇데이 스튜디오', w / 2, h * 0.88);
  }

  function _priceRows(ctx, w, h, data) {
    ctx.fillStyle = 'rgba(17,18,23,0.08)';
    ctx.fillRect(w * 0.14, h * 0.78, w * 0.72, h * 0.08);
    ctx.fillStyle = '#111217';
    ctx.font = `800 ${Math.round(h * 0.024)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(data.price || '가격 문의', w / 2, h * 0.83);
  }

  function _review(ctx, w, h, data) {
    ctx.fillStyle = '#111217';
    ctx.font = `700 ${Math.round(h * 0.022)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(data.review || '실제로 달라진 결과를 확인해보세요', w / 2, h * 0.82);
  }

  function _eventBand(ctx, w, h, data) {
    ctx.fillStyle = '#D58A95';
    ctx.fillRect(w * 0.12, h * 0.84, w * 0.76, h * 0.06);
    ctx.fillStyle = '#fff';
    ctx.font = `900 ${Math.round(h * 0.025)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(data.sub || '이번 주 예약 가능', w / 2, h * 0.88);
  }

  function _bg(tpl, data) {
    // [V3-1] v3 템플릿이면 palette.bg 우선(없으면 기존 분기 — 무회귀).
    if (data && data.palette && typeof data.palette.bg === 'string' && data.palette.bg) return data.palette.bg;
    if (tpl && tpl.id === 'ba-flower-shadow') return '#e7e5de';
    if (tpl && tpl.id === 'ba-polaroid') return '#eee9e2';
    if (tpl && tpl.id === 'ba-editorial') return '#f6f1e9';
    if (tpl && tpl.id === 'ba-dark') return '#24252B';
    if (tpl && tpl.id === 'ba-sage') return '#E5EADF';
    // v326 BA 12종 시리즈 배경 (스타일 suffix 별)
    if (tpl && tpl.id) {
      if (/-cream$/.test(tpl.id))    return '#e7e5de';
      if (/-polaroid$/.test(tpl.id)) return '#eee9e2';
      if (/-dark$/.test(tpl.id))     return '#24252B';
    }
    return '#FFFAF2';
  }

  window.PhotoEditorBACompose = { draw, primeImage: _primeImage };
})();
