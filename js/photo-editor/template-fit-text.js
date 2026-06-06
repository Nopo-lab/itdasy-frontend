/* 사진 편집기 — 템플릿 안전 텍스트/이미지 helper (PR-S1 2026-06-06)

   목표: 사용자가 문구를 바꿔도 레이아웃이 안 깨지게.
   - 한글/영문/숫자 줄바꿈
   - maxLines 초과 시 fontSize 축소 → minFontSize 이하이면 말줄임
   - 가격 포맷/파싱, 가격표 row, 이미지 슬롯 cover/contain

   외부 노출: window.PhotoEditorTemplateFitText
*/
(function () {
  'use strict';
  if (window.PhotoEditorTemplateFitText) return;

  // ── 줄바꿈 (한글=글자단위, 영문=단어우선) ────────────────
  function wrapText(ctx, text, maxWidth, style) {
    style = style || {};
    if (style.font) ctx.font = style.font;
    const src = String(text == null ? '' : text);
    const lines = [];
    src.split('\n').forEach((para) => {
      if (para === '') { lines.push(''); return; }
      let line = '';
      for (let i = 0; i < para.length; i++) {
        const ch = para[i];
        const test = line + ch;
        if (ctx.measureText(test).width > maxWidth && line !== '') {
          // 영문 단어 중간이면 마지막 공백에서 끊기
          const sp = line.lastIndexOf(' ');
          if (sp > 0 && /[A-Za-z0-9]/.test(ch)) {
            lines.push(line.slice(0, sp));
            line = line.slice(sp + 1) + ch;
          } else {
            lines.push(line);
            line = ch;
          }
        } else {
          line = test;
        }
      }
      lines.push(line);
    });
    return lines;
  }

  function _fontStr(style, size) {
    const weight = style.weight || 600;
    const family = style.fontFamily || 'Pretendard, "Noto Sans KR", sans-serif';
    return `${weight} ${size}px ${family}`;
  }

  // box 에 맞춰 fontSize 자동 축소 + maxLines 초과 시 말줄임. 그린 뒤 결과 반환.
  function drawFitText(ctx, text, box, style) {
    style = style || {};
    const maxFont = style.maxFontSize || 48;
    const minFont = style.minFontSize || 18;
    const maxLines = style.maxLines || 3;
    const lhRatio = style.lineHeight || 1.28;
    let size = maxFont, lines = [];
    for (; size >= minFont; size -= 2) {
      ctx.font = _fontStr(style, size);
      lines = wrapText(ctx, text, box.w, { font: ctx.font });
      if (lines.length <= maxLines) break;
    }
    let truncated = false;
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      let last = lines[maxLines - 1];
      while (last.length && ctx.measureText(last + '…').width > box.w) last = last.slice(0, -1);
      lines[maxLines - 1] = last + '…';
      truncated = true;
    }
    ctx.font = _fontStr(style, size);
    ctx.fillStyle = style.color || '#111';
    ctx.textAlign = style.align || 'left';
    ctx.textBaseline = 'top';
    const lh = size * lhRatio;
    const totalH = lh * lines.length;
    let y = box.y;
    if (style.valign === 'middle') y = box.y + (box.h - totalH) / 2;
    else if (style.valign === 'bottom') y = box.y + (box.h - totalH);
    const x = style.align === 'center' ? box.x + box.w / 2 : (style.align === 'right' ? box.x + box.w : box.x);
    lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * lh));
    return { fontSize: size, lines, truncated, height: totalH };
  }

  // ── 가격 ────────────────────────────────────────────────
  //   80000 → 80,000원 · 8만원 → 80,000원 · 80,000원 유지 · 150000 → 150,000원
  function formatPrice(value) {
    if (value == null || value === '') return '';
    let s = String(value).trim();
    let won = 0;
    const manMatch = s.match(/(\d+(?:\.\d+)?)\s*만/);
    if (manMatch) {
      won = Math.round(parseFloat(manMatch[1]) * 10000);
      const rest = s.replace(/\d+(?:\.\d+)?\s*만\s*원?/, '');
      const tail = (rest.match(/(\d[\d,]*)\s*원?/) || [])[1];
      if (tail) won += parseInt(tail.replace(/,/g, ''), 10) || 0;
    } else {
      const digits = s.replace(/[^\d]/g, '');
      if (!digits) return s;   // 숫자 없으면 원문 유지
      won = parseInt(digits, 10);
    }
    if (!isFinite(won) || won <= 0) return s;
    return won.toLocaleString('en-US') + '원';
  }

  // "물광케어 8만원" / "진정관리 120000" / "리프팅관리 150,000원" → [{name, price}]
  function parseServicePrices(text) {
    const out = [];
    String(text == null ? '' : text).split('\n').forEach((raw) => {
      const line = raw.trim();
      if (!line) return;
      // 구분자(| , 탭, 다중공백) 또는 끝의 가격 토큰 분리
      let m = line.split(/\s*[|\t]\s*/);
      if (m.length >= 2) {
        out.push({ name: m[0].trim(), price: formatPrice(m.slice(1).join(' ')) });
        return;
      }
      const pm = line.match(/^(.*?)[\s]+([\d][\d,]*\s*(?:만\s*)?원?|\d+\s*만\s*원?)\s*$/);
      if (pm) out.push({ name: pm[1].trim(), price: formatPrice(pm[2]) });
      else out.push({ name: line, price: '' });
    });
    return out;
  }

  // rows: [{name, desc?, price}] — box 안에 균등 배치. name 좌, price 우.
  function drawPriceRows(ctx, rows, box, style) {
    style = style || {};
    const list = (rows || []).slice(0, style.maxRows || 6);
    if (!list.length) return;
    const gap = box.h / list.length;
    const fs = Math.min(style.fontSize || 30, gap * 0.5);
    list.forEach((row, i) => {
      const cy = box.y + gap * i + gap / 2;
      ctx.textBaseline = 'middle';
      ctx.font = _fontStr({ weight: 600, fontFamily: style.fontFamily }, fs);
      ctx.fillStyle = style.nameColor || '#222';
      ctx.textAlign = 'left';
      ctx.fillText(row.name || '', box.x, cy);
      if (row.desc) {
        ctx.font = _fontStr({ weight: 500, fontFamily: style.fontFamily }, fs * 0.7);
        ctx.fillStyle = style.descColor || '#999';
        ctx.fillText(row.desc, box.x, cy + fs * 0.7);
      }
      if (row.price) {
        ctx.font = _fontStr({ weight: 700, fontFamily: style.fontFamily }, fs);
        ctx.fillStyle = style.priceColor || '#7c3aed';
        ctx.textAlign = 'right';
        ctx.fillText(row.price, box.x + box.w, cy);
      }
    });
  }

  // ── 이미지 슬롯 (cover/contain + focal) ────────────────
  function drawImageSlot(ctx, image, frame, options) {
    if (!image) return;
    options = options || {};
    const iw = image.naturalWidth || image.width, ih = image.naturalHeight || image.height;
    if (!iw || !ih) return;
    const fit = options.fit || 'cover';
    const focal = options.focal || { x: 0.5, y: 0.5 };
    ctx.save();
    if (options.radius) {
      _roundRect(ctx, frame.x, frame.y, frame.w, frame.h, options.radius);
      ctx.clip();
    }
    if (fit === 'contain') {
      const scale = Math.min(frame.w / iw, frame.h / ih);
      const dw = iw * scale, dh = ih * scale;
      ctx.drawImage(image, frame.x + (frame.w - dw) / 2, frame.y + (frame.h - dh) / 2, dw, dh);
    } else {
      const sAR = iw / ih, dAR = frame.w / frame.h;
      let sw, sh;
      if (sAR > dAR) { sh = ih; sw = sh * dAR; } else { sw = iw; sh = sw / dAR; }
      const sx = Math.max(0, Math.min(iw - sw, (iw - sw) * (focal.x * 2)));
      const sy = Math.max(0, Math.min(ih - sh, (ih - sh) * (focal.y * 2)));
      ctx.drawImage(image, sx, sy, sw, sh, frame.x, frame.y, frame.w, frame.h);
    }
    ctx.restore();
  }

  function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  window.PhotoEditorTemplateFitText = {
    wrapText, drawFitText, formatPrice, parseServicePrices, drawPriceRows, drawImageSlot,
  };
})();
