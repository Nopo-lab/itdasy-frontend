/* 사진 편집기 — 캔버스 렌더러 */
(function () {
  'use strict';

  if (window.PhotoEditorRenderer) return;

  const FONT_FAM = {
    sans: 'Pretendard, "Noto Sans KR", sans-serif',
    serif: 'Georgia, "Noto Serif KR", serif',
    playfair: '"Playfair Display", "Noto Serif KR", Georgia, serif',
    nserif: '"Noto Serif KR", "Nanum Myeongjo", serif',
    bhan: '"Black Han Sans", "Noto Sans KR", sans-serif',
    gowun: '"Gowun Dodum", "Noto Sans KR", sans-serif',
    gaegu: '"Gaegu", "Noto Sans KR", cursive',
    nanumpen: '"Nanum Pen Script", "Gaegu", cursive',
    hand: '"Brush Script MT", "Nanum Pen Script", cursive',
  };
  const WM_POS = {
    tl: ['left', 'top', 0, 0, 1, 1],
    tr: ['right', 'top', 1, 0, -1, 1],
    bl: ['left', 'bottom', 0, 1, 1, -1],
    br: ['right', 'bottom', 1, 1, -1, -1],
  };

  function computeCrop(img, ratio) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    if (ratio === 'original') {
      const maxPixels = 16777216;
      const k = iw * ih > maxPixels ? Math.sqrt(maxPixels / (iw * ih)) : 1;
      return { sx: 0, sy: 0, sw: iw, sh: ih, dw: Math.round(iw * k), dh: Math.round(ih * k) };
    }
    const [rw, rh] = ratio.split(':').map(Number);
    const targetAR = rw / rh, imgAR = iw / ih;
    let sw, sh, sx, sy;
    if (imgAR > targetAR) { sh = ih; sw = Math.round(ih * targetAR); sx = Math.round((iw - sw) / 2); sy = 0; }
    else { sw = iw; sh = Math.round(iw / targetAR); sx = 0; sy = Math.round((ih - sh) / 2); }
    const outW = Math.min(1080, sw), outH = Math.round(outW / targetAR);
    return { sx, sy, sw, sh, dw: outW, dh: outH };
  }

  function _clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

  function _boxBlur(img, w, h, r) {
    const d = img.data;
    const tmp = new Uint8ClampedArray(d.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let rS = 0, gS = 0, bS = 0, n = 0;
      for (let kx = -r; kx <= r; kx++) {
        const xx = Math.min(w - 1, Math.max(0, x + kx)), p = (y * w + xx) * 4;
        rS += d[p]; gS += d[p + 1]; bS += d[p + 2]; n++;
      }
      const p = (y * w + x) * 4;
      tmp[p] = rS / n; tmp[p + 1] = gS / n; tmp[p + 2] = bS / n; tmp[p + 3] = d[p + 3];
    }
    const out = new ImageData(w, h);
    const o = out.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let rS = 0, gS = 0, bS = 0, n = 0;
      for (let ky = -r; ky <= r; ky++) {
        const yy = Math.min(h - 1, Math.max(0, y + ky)), p = (yy * w + x) * 4;
        rS += tmp[p]; gS += tmp[p + 1]; bS += tmp[p + 2]; n++;
      }
      const p = (y * w + x) * 4;
      o[p] = rS / n; o[p + 1] = gS / n; o[p + 2] = bS / n; o[p + 3] = tmp[p + 3];
    }
    return out;
  }

  function unsharpMask(ctx, w, h, strength) {
    try {
      const src = ctx.getImageData(0, 0, w, h);
      const blur = _boxBlur(src, w, h, 1);
      const out = ctx.createImageData(w, h);
      const k = 1 + strength * 0.8;
      for (let i = 0; i < src.data.length; i += 4) {
        out.data[i] = _clamp(src.data[i] + (src.data[i] - blur.data[i]) * (k - 1));
        out.data[i + 1] = _clamp(src.data[i + 1] + (src.data[i + 1] - blur.data[i + 1]) * (k - 1));
        out.data[i + 2] = _clamp(src.data[i + 2] + (src.data[i + 2] - blur.data[i + 2]) * (k - 1));
        out.data[i + 3] = src.data[i + 3];
      }
      ctx.putImageData(out, 0, 0);
    } catch (_e) { void _e; }
  }

  async function _applySharpness(env, cv, ctx, dw, dh) {
    const a = env.state.adjust;
    if (a.sharpness <= 10) return true;
    const hooks = env.drawHooks;
    const useGLBlur = typeof hooks.gl_blur === 'function' && window.PhotoEditorGLCtx && window.PhotoEditorGLCtx.supported;
    if (useGLBlur) {
      try { hooks.gl_blur(cv, a.sharpness, env.helpers); } catch (_e) { unsharpMask(ctx, dw, dh, a.sharpness / 100); }
      return true;
    }
    const WF = window.PhotoEditorWorkerFilter;
    if (WF && WF.shouldUse && WF.shouldUse(cv)) {
      try {
        await WF.unsharpCanvas(cv, a.sharpness / 100);
        if (env.seq !== env.getSeq()) return false;
      } catch (_e) { unsharpMask(ctx, dw, dh, a.sharpness / 100); }
      return true;
    }
    unsharpMask(ctx, dw, dh, a.sharpness / 100);
    return true;
  }

  function _drawBase(env, cv, ctx, img, crop) {
    const { sx, sy, sw, sh, dw, dh } = crop;
    const a = env.state.adjust, temp = a.temperature;
    const hooks = env.drawHooks;
    const useGLTone = typeof hooks.gl_tone === 'function' && window.PhotoEditorGLCtx && window.PhotoEditorGLCtx.supported;
    if (!useGLTone) {
      const sepia = Math.max(0, temp) / 100, contrast = 100 + Math.max(0, -temp) * 0.3;
      ctx.filter = `brightness(${a.brightness}%) saturate(${a.saturate}%) contrast(${contrast}%) sepia(${sepia})`;
    } else ctx.filter = 'none';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
    ctx.filter = 'none';
    if (useGLTone) {
      try { hooks.gl_tone(cv, env.state.adjust, env.helpers); } catch (_e) { void _e; }
    }
  }

  function _applyDrawHooks(env, cv, ctx, dw, dh) {
    const hooks = env.drawHooks, state = env.state, helpers = env.helpers;
    if (typeof hooks.bgBlur === 'function') try { hooks.bgBlur(cv, state, helpers); } catch (_e) { void _e; }
    if (typeof hooks.relight === 'function') try { hooks.relight(cv, state, helpers); } catch (e) { console.warn('[renderer] relight hook 오류:', e.message); }
    if (typeof hooks.beauty === 'function') try { hooks.beauty(ctx, dw, dh, state.beauty, helpers); } catch (e) { console.warn('[renderer] beauty hook 오류:', e.message); }
    if (typeof hooks.gl_selective === 'function') try { hooks.gl_selective(cv, state, helpers); } catch (_e) { void _e; }
    if (typeof hooks.gl_curve === 'function') try { hooks.gl_curve(cv, state, helpers); } catch (_e) { void _e; }
    if (typeof hooks.gl_hsl === 'function') try { hooks.gl_hsl(cv, state, helpers); } catch (_e) { void _e; }
    if (typeof hooks.gl_film === 'function') try { hooks.gl_film(cv, state, helpers); } catch (_e) { void _e; }
  }

  function _drawTextLayers(ctx, w, h, state) {
    if (Array.isArray(state.layers) && state.layers.length > 0) {
      state.layers.forEach(l => { if (l && l.value) drawText(ctx, w, h, l); });
    } else if (state.text && state.text.value) {
      drawText(ctx, w, h, state.text);
    }
  }

  function drawText(ctx, w, h, t) {
    if (!t.value) return;
    if (t.curve && t.curve !== 'none') return _drawCurvedText(ctx, w, h, t);
    ctx.save();
    const fs = Math.round(w * ((t.size || 6) / 100));
    const fam = FONT_FAM[t.font] || FONT_FAM.sans;
    ctx.font = `${t.font === 'hand' || t.font === 'serif' ? '700' : '800'} ${fs}px ${fam}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tx = w * t.x, ty = h * t.y, rot = +t.rot || 0;
    if (rot !== 0) { ctx.translate(tx, ty); ctx.rotate(rot * Math.PI / 180); ctx.translate(-tx, -ty); }
    _drawTextBox(ctx, w, t, fs, tx, ty);
    const lines = String(t.value).split('\n').filter(s => s.length > 0);
    const lineH = Math.round(fs * 1.25), startY = ty - ((lineH * lines.length) - lineH) / 2;
    ctx.fillStyle = t.color || '#ffffff';
    lines.forEach((ln, i) => {
      const y = startY + i * lineH;
      if (t.stroke) ctx.strokeText(ln, tx, y, w * 0.9);
      ctx.fillText(ln, tx, y, w * 0.9);
    });
    ctx.restore();
  }

  function _drawCurvedText(ctx, w, h, t) {
    ctx.save();
    const fs = Math.round(w * ((t.size || 6) / 100));
    const fam = FONT_FAM[t.font] || FONT_FAM.sans;
    ctx.font = `${t.font === 'hand' || t.font === 'serif' ? '700' : '800'} ${fs}px ${fam}`;
    ctx.fillStyle = t.color || '#ffffff';
    if (t.stroke) {
      ctx.lineWidth = Math.max(2, Math.round(fs * 0.08));
      ctx.lineJoin = 'round';
      ctx.strokeStyle = t.color === '#ffffff' || t.color === '#FFC83D' ? '#000' : '#fff';
    }
    if (!t.stroke && !t.bg) { ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = Math.round(fs * 0.18); }
    const tx = w * t.x, ty = h * t.y;
    const text = String(t.value).replace(/\n/g, ' ');
    const chars = [...text];
    const totalW = ctx.measureText(text).width;
    if (t.curve === 'arch') {
      const radius = Math.max(totalW * 0.55, fs * 3);
      const arcLen = totalW / radius;
      const startAngle = -Math.PI / 2 - arcLen / 2;
      let angle = startAngle;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      chars.forEach(ch => {
        const cw = ctx.measureText(ch).width;
        angle += cw / 2 / radius;
        const cx = tx + Math.cos(angle) * radius;
        const cy = ty + radius + Math.sin(angle) * radius;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle + Math.PI / 2);
        if (t.stroke) ctx.strokeText(ch, 0, 0);
        ctx.fillText(ch, 0, 0);
        ctx.restore();
        angle += cw / 2 / radius;
      });
    } else if (t.curve === 'wave') {
      const amp = fs * 0.8;
      const freq = Math.PI * 2 / Math.max(totalW, 1);
      let offsetX = -totalW / 2;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      chars.forEach(ch => {
        const cw = ctx.measureText(ch).width;
        offsetX += cw / 2;
        const cx = tx + offsetX;
        const cy = ty + Math.sin(offsetX * freq) * amp;
        const slope = Math.cos(offsetX * freq) * amp * freq;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.atan(slope));
        if (t.stroke) ctx.strokeText(ch, 0, 0);
        ctx.fillText(ch, 0, 0);
        ctx.restore();
        offsetX += cw / 2;
      });
    } else if (t.curve === 'circle') {
      const radius = Math.max(totalW / (Math.PI * 1.5), fs * 2.5);
      const arcLen = totalW / radius;
      let angle = -arcLen / 2;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      chars.forEach(ch => {
        const cw = ctx.measureText(ch).width;
        angle += cw / 2 / radius;
        const cx = tx + Math.cos(angle - Math.PI / 2) * radius;
        const cy = ty + Math.sin(angle - Math.PI / 2) * radius;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        if (t.stroke) ctx.strokeText(ch, 0, 0);
        ctx.fillText(ch, 0, 0);
        ctx.restore();
        angle += cw / 2 / radius;
      });
    }
    ctx.restore();
  }

  function _drawTextBox(ctx, w, t, fs, tx, ty) {
    if (t.bg) {
      const lines = String(t.value).split('\n').filter(s => s.length > 0);
      const lineH = Math.round(fs * 1.25), totalH = lineH * lines.length;
      const maxW = lines.reduce((m, ln) => Math.max(m, ctx.measureText(ln).width), 0);
      const padX = Math.round(fs * 0.4), padY = Math.round(fs * 0.25);
      ctx.fillStyle = t.color === '#ffffff' || t.color === '#FFC83D' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.85)';
      ctx.fillRect(tx - Math.min(w * 0.95, maxW + padX * 2) / 2, ty - (totalH + padY * 2) / 2, Math.min(w * 0.95, maxW + padX * 2), totalH + padY * 2);
    } else if (!t.stroke) {
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = Math.round(fs * 0.18);
    }
    if (t.stroke) {
      ctx.lineWidth = Math.max(2, Math.round(fs * 0.08));
      ctx.lineJoin = 'round';
      ctx.strokeStyle = t.color === '#ffffff' || t.color === '#FFC83D' ? '#000' : '#fff';
    }
  }

  function drawWatermark(ctx, w, h, wm) {
    ctx.save();
    const fs = Math.max(12, Math.round(w * 0.022));
    ctx.font = `600 ${fs}px Pretendard, "Noto Sans KR", sans-serif`;
    ctx.globalAlpha = wm.opacity;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4;
    const pad = Math.round(w * 0.025), c = WM_POS[wm.position] || WM_POS.br;
    ctx.textAlign = c[0]; ctx.textBaseline = c[1];
    ctx.fillText(wm.value, w * c[2] + pad * c[4], h * c[3] + pad * c[5]);
    ctx.restore();
  }

  let _fxCache = null;
  function _fxHash(s) {
    const a = s.adjust;
    return s.originalSrc + '|' + s.ratio + '|' + (s.template && s.template.id || '') + '|' +
      a.brightness + ',' + a.saturate + ',' + a.sharpness + ',' + a.temperature + '|' +
      Object.values(s.beauty).join(',') + '|' +
      (s.relight ? s.relight.direction + ',' + s.relight.warmth + ',' + s.relight.intensity + ',' + s.relight.ambientBoost + ',' + s.relight.flash : '') + '|' +
      (s.shadow ? s.shadow.mode : '') + '|' + (s.film ? JSON.stringify(s.film) : '') + '|' +
      (s.curve ? JSON.stringify(s.curve) : '') + '|' +
      (s.hsl ? JSON.stringify(s.hsl) : '') + '|' +
      (s.selective ? JSON.stringify(s.selective) : '') + '|' +
      (s.bgBlur ? s.bgBlur.strength : 0);
  }

  async function redraw(env) {
    const cv = env.canvas, empty = env.empty, state = env.state;
    if (!cv || !state) return;
    if (!state.originalImg) { cv.style.display = 'none'; if (empty) empty.style.display = 'flex'; return; }
    if (empty) empty.style.display = 'none';
    cv.style.display = 'block';
    if (state.template.id && typeof env.drawHooks.template === 'function') {
      try { env.drawHooks.template(cv, state.originalImg, state, env.helpers); return; } catch (_e) { void _e; }
    }
    const crop = computeCrop(state.originalImg, state.ratio);
    cv.width = crop.dw; cv.height = crop.dh;
    const ctx = cv.getContext('2d');
    if (state.showOriginal) { ctx.filter = 'none'; ctx.drawImage(state.originalImg, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.dw, crop.dh); return; }
    const hash = _fxHash(state);
    if (_fxCache && _fxCache.hash === hash && _fxCache.w === crop.dw && _fxCache.h === crop.dh) {
      ctx.drawImage(_fxCache.cv, 0, 0);
    } else {
      ctx.clearRect(0, 0, crop.dw, crop.dh);
      _drawBase(env, cv, ctx, state.originalImg, crop);
      if (await _applySharpness(env, cv, ctx, crop.dw, crop.dh) === false) return;
      _applyDrawHooks(env, cv, ctx, crop.dw, crop.dh);
      const cc = document.createElement('canvas');
      cc.width = crop.dw; cc.height = crop.dh;
      cc.getContext('2d').drawImage(cv, 0, 0);
      _fxCache = { cv: cc, hash, w: crop.dw, h: crop.dh };
    }
    ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    _drawTextLayers(ctx, crop.dw, crop.dh, state);
    if (state.watermark.value) drawWatermark(ctx, crop.dw, crop.dh, state.watermark);
    if (typeof env.drawHooks.tplV2_overlay === 'function') {
      try { env.drawHooks.tplV2_overlay(ctx, crop.dw, crop.dh, state, env.helpers); } catch (_e) { void _e; }
    }
  }

  window.PhotoEditorRenderer = { redraw, unsharpMask, drawWatermark, computeCrop };
})();
