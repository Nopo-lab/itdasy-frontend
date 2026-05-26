/* 사진 편집기 — Canva식 Before/After 합성 */
(function () {
  'use strict';
  if (window.PhotoEditorBACompose) return;

  const LABELS = {
    'ba-2split-h': ['BEFORE', 'AFTER'],
    'ba-2split-v': ['BEFORE', 'AFTER'],
    'ba-3process': ['BEFORE', 'PROCESS', 'AFTER'],
    'ba-4grid': ['DETAIL', 'STYLE', 'BEFORE', 'AFTER'],
    'ba-price': ['BEFORE', 'AFTER'],
    'ba-event': ['BEFORE', 'AFTER'],
    'ba-review': ['BEFORE', 'AFTER'],
  };

  function draw(ctx, w, h, state, tpl, data) {
    const after = _copyCanvas(ctx.canvas);
    const before = _beforeCanvas(state, after);
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = _bg(tpl);
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

  function _beforeCanvas(state, fallback) {
    const src = state && state.secondImg ? state.secondImg : fallback;
    const out = document.createElement('canvas');
    out.width = fallback.width; out.height = fallback.height;
    const ctx = out.getContext('2d');
    ctx.filter = state && state.secondImg ? 'brightness(92%) saturate(90%)' : 'brightness(92%) grayscale(18%) sepia(8%)';
    ctx.drawImage(src, 0, 0, out.width, out.height);
    ctx.filter = 'none';
    return out;
  }

  function _layout(ctx, w, h, before, after, id, data) {
    if (id === 'ba-2split-v' || id === 'ba-event') return _vertical(ctx, w, h, before, after, id, data);
    if (id === 'ba-3process') return _process(ctx, w, h, before, after, data);
    if (id === 'ba-4grid') return _grid(ctx, w, h, before, after, data);
    _horizontal(ctx, w, h, before, after, id, data);
  }

  function _horizontal(ctx, w, h, before, after, id, data) {
    const pad = w * 0.08, gap = w * 0.035, top = h * 0.16;
    const boxW = (w - pad * 2 - gap) / 2, boxH = h * 0.56;
    _title(ctx, w, h, data, id);
    _photo(ctx, before, pad, top, boxW, boxH, true);
    _photo(ctx, after, pad + boxW + gap, top, boxW, boxH, false);
    _labels(ctx, [[pad, top, boxW], [pad + boxW + gap, top, boxW]], h, LABELS[id] || LABELS['ba-2split-h']);
    if (id === 'ba-price') _priceRows(ctx, w, h, data);
    else if (id === 'ba-review') _review(ctx, w, h, data);
    else _footer(ctx, w, h, data);
  }

  function _vertical(ctx, w, h, before, after, id, data) {
    const pad = w * 0.08, gap = h * 0.022, top = h * 0.12;
    const boxH = (h * 0.68 - gap) / 2;
    _title(ctx, w, h, data, id);
    _photo(ctx, before, pad, top, w - pad * 2, boxH, true);
    _photo(ctx, after, pad, top + boxH + gap, w - pad * 2, boxH, false);
    _labels(ctx, [[pad, top, w - pad * 2], [pad, top + boxH + gap, w - pad * 2]], h, LABELS[id]);
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

  function _photo(ctx, img, x, y, w, h, before, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha || 1;
    ctx.filter = before ? 'brightness(92%) grayscale(15%)' : 'saturate(108%) brightness(103%)';
    _cover(ctx, img, x, y, w, h);
    ctx.filter = 'none';
    ctx.strokeStyle = 'rgba(255,255,255,0.86)';
    ctx.lineWidth = Math.max(2, w * 0.012);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  function _cover(ctx, img, x, y, w, h) {
    const iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight;
    const ar = w / h, iar = iw / ih;
    const sw = iar > ar ? ih * ar : iw, sh = iar > ar ? ih : iw / ar;
    ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
  }

  function _title(ctx, w, h, data, id) {
    ctx.fillStyle = id === 'ba-event' ? '#fff' : '#17181d';
    ctx.textAlign = 'center';
    ctx.font = `800 ${Math.round(h * 0.042)}px "Noto Serif KR", serif`;
    ctx.fillText(data.head || 'Before & After', w / 2, h * 0.09);
  }

  function _labels(ctx, boxes, h, labels) {
    boxes.forEach((box, i) => {
      ctx.fillStyle = i === boxes.length - 1 ? '#D58A95' : '#111217';
      ctx.fillRect(box[0] + 10, box[1] + 10, Math.min(box[2] * 0.45, 126), h * 0.036);
      ctx.fillStyle = '#fff';
      ctx.font = `800 ${Math.round(h * 0.017)}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(labels[i] || '', box[0] + 18, box[1] + h * 0.034);
    });
  }

  function _footer(ctx, w, h, data) {
    ctx.fillStyle = '#555';
    ctx.font = `600 ${Math.round(h * 0.018)}px sans-serif`;
    ctx.textAlign = 'center';
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

  function _bg(tpl) {
    if (tpl && tpl.id === 'ba-dark') return '#24252B';
    if (tpl && tpl.id === 'ba-sage') return '#E5EADF';
    return '#FFFAF2';
  }

  window.PhotoEditorBACompose = { draw };
})();
