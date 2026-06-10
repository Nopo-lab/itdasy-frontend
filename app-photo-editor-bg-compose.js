/* 사진편집/갤러리 공용 — 누끼 배경 합성 + 무료 자동 그림자 */
(function () {
  'use strict';
  if (window.PhotoEditorBgCompose) return;

  const SHADOWS = {
    none:     { label: '그림자 없음', blur: 0,  opacity: 0,    x: 0,  y: 0,  scaleY: 1 },
    soft:     { label: '부드럽게',     blur: 22, opacity: 0.22, x: 0,  y: 26, scaleY: 1 },
    hard:     { label: '또렷하게',     blur: 10, opacity: 0.28, x: 14, y: 18, scaleY: 1 },
    floating: { label: '떠 있는 느낌', blur: 18, opacity: 0.26, x: 0,  y: 44, scaleY: 0.26 },
  };

  function ratioToSize(ratio, srcImg) {
    if (ratio === '4:5') return { w: 1080, h: 1350 };
    if (ratio === '9:16') return { w: 1080, h: 1920 };
    if (ratio === '1:1') return { w: 1080, h: 1080 };
    // 'original'/미지정 — 원본 비율 유지(긴 변 1440 캡). 세로 사진을 정사각으로 욱여넣어 작아 보이던 문제 방지.
    const iw = (srcImg && (srcImg.naturalWidth || srcImg.width)) || 1080;
    const ih = (srcImg && (srcImg.naturalHeight || srcImg.height)) || 1080;
    const LONG = 1440;
    const s = Math.min(1, LONG / Math.max(iw, ih));
    return { w: Math.max(1, Math.round(iw * s)), h: Math.max(1, Math.round(ih * s)) };
  }

  function _blobFromDataUrl(dataUrl) {
    const parts = String(dataUrl).split(',');
    const mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/jpeg';
    const bin = atob(parts[1] || '');
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  function _loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function _dataUrlFromAny(srcUrl) {
    if (!srcUrl) throw new Error('이미지 없음');
    if (String(srcUrl).startsWith('data:')) return srcUrl;
    const res = await fetch(srcUrl);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function _drawCover(ctx, img, x, y, w, h) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale, dh = ih * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  function _drawProcedural(ctx, render, w, h) {
    const fill = (g, stops) => { stops.forEach(s => g.addColorStop(s[0], s[1])); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); };
    if (render === 'beige') return fill(ctx.createLinearGradient(0, 0, 0, h), [[0, '#f7eee1'], [1, '#ebdcc4']]);
    if (render === 'pink_radial') return fill(ctx.createRadialGradient(w * 0.5, h * 0.42, w * 0.04, w * 0.5, h * 0.42, Math.max(w, h) * 0.75), [[0, '#fde2e8'], [0.55, '#fbb8c6'], [1, '#D58A95']]);
    if (render === 'black_lux') return fill(ctx.createLinearGradient(0, 0, 0, h), [[0, '#22222a'], [0.6, '#1a1a1f'], [1, '#0f0f13']]);
    fill(ctx.createLinearGradient(0, 0, w, h), [[0, '#f8f6f3'], [0.5, '#ececea'], [1, '#f4f2ef']]);
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      ctx.strokeStyle = `rgba(110,110,118,${0.05 + Math.random() * 0.12})`;
      ctx.lineWidth = (w / 540) * (0.8 + Math.random() * 1.4);
      ctx.beginPath();
      ctx.moveTo(Math.random() * w, Math.random() * h * 0.3);
      ctx.bezierCurveTo(Math.random() * w, h * (0.2 + Math.random() * 0.3), Math.random() * w, h * (0.5 + Math.random() * 0.3), Math.random() * w, h * (0.6 + Math.random() * 0.4));
      ctx.stroke();
    }
    ctx.restore();
  }

  async function _removeBg(srcDataUrl) {
    try {
      const fd = new FormData();
      fd.append('file', _blobFromDataUrl(srcDataUrl), 'photo.jpg');
      const res = await apiFetch('/image/remove-bg', { method: 'POST', headers: authHeader(), body: fd });
      if (res.status === 429) throw new Error('오늘 누끼따기 한도를 다 썼어요');
      if (!res.ok) throw new Error('서버 누끼 실패');
      return await res.blob();
    } catch (serverErr) {
      console.warn('[bg-compose] 서버 누끼 실패, 클라이언트 폴백:', serverErr);
      if (typeof imglyRemoveBackground === 'undefined' && typeof window._lazyImgly === 'function') await window._lazyImgly();
      if (typeof imglyRemoveBackground !== 'function') throw serverErr;
      return await imglyRemoveBackground(_blobFromDataUrl(srcDataUrl), {
        publicPath: 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/dist/',
      });
    }
  }

  function _alphaBBox(img) {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, w, h).data;
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] < 12) continue;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  function _personPlacement(personImg, CW, CH) {
    const bbox = _alphaBBox(personImg);
    const pw0 = bbox ? bbox.w : (personImg.naturalWidth || personImg.width);
    const ph0 = bbox ? bbox.h : (personImg.naturalHeight || personImg.height);
    const scale = Math.min((CW * 0.92) / pw0, (CH * 0.92) / ph0);
    return { bbox, dx: (CW - pw0 * scale) / 2, dy: (CH - ph0 * scale) / 2, dw: pw0 * scale, dh: ph0 * scale };
  }

  function _silhouette(personImg, place) {
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(place.dw));
    cv.height = Math.max(1, Math.round(place.dh));
    const ctx = cv.getContext('2d');
    const b = place.bbox;
    if (b) ctx.drawImage(personImg, b.x, b.y, b.w, b.h, 0, 0, cv.width, cv.height);
    else ctx.drawImage(personImg, 0, 0, cv.width, cv.height);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cv.width, cv.height);
    return cv;
  }

  function _drawShadow(ctx, personImg, place, shadow) {
    const opt = SHADOWS[(shadow && shadow.mode) || shadow || 'none'] || SHADOWS.none;
    if (!opt.opacity || !opt.blur) return;
    const sil = _silhouette(personImg, place);
    ctx.save();
    ctx.globalAlpha = opt.opacity;
    ctx.filter = `blur(${opt.blur}px)`;
    ctx.translate(place.dx + opt.x, place.dy + opt.y + place.dh * (1 - opt.scaleY) / 2);
    ctx.scale(1, opt.scaleY);
    ctx.drawImage(sil, 0, 0, place.dw, place.dh);
    ctx.restore();
  }

  async function _backgroundCanvas(bg, w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    if (bg.imageData) _drawCover(ctx, await _loadImage(bg.imageData), 0, 0, w, h);
    else if (bg.type === 'procedural' && bg.render) _drawProcedural(ctx, bg.render, w, h);
    else { ctx.fillStyle = bg.color || '#fff'; ctx.fillRect(0, 0, w, h); }
    return cv;
  }

  async function compose(opts) {
    const srcDataUrl = await _dataUrlFromAny(opts.srcUrl);
    let removedUrl = opts.preRemovedBgUrl || null;
    if (!removedUrl) {
      const blob = await _removeBg(srcDataUrl);
      const tmpUrl = URL.createObjectURL(blob);
      const tmpImg = await _loadImage(tmpUrl);
      URL.revokeObjectURL(tmpUrl);
      const cache = document.createElement('canvas');
      cache.width = tmpImg.width; cache.height = tmpImg.height;
      cache.getContext('2d').drawImage(tmpImg, 0, 0);
      removedUrl = cache.toDataURL('image/png');
    }
    const personImg = await _loadImage(removedUrl);
    const size = ratioToSize(opts.targetRatio || '1:1', personImg);
    const bgCanvas = await _backgroundCanvas(opts.bg || {}, size.w, size.h);
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = size.w; finalCanvas.height = size.h;
    const ctx = finalCanvas.getContext('2d');
    ctx.drawImage(bgCanvas, 0, 0);
    const place = _personPlacement(personImg, size.w, size.h);
    _drawShadow(ctx, personImg, place, opts.shadow);
    const b = place.bbox;
    if (b) ctx.drawImage(personImg, b.x, b.y, b.w, b.h, place.dx, place.dy, place.dw, place.dh);
    else ctx.drawImage(personImg, place.dx, place.dy, place.dw, place.dh);
    return { composedDataUrl: finalCanvas.toDataURL('image/jpeg', 0.9), removedBgDataUrl: removedUrl };
  }

  window.PhotoEditorBgCompose = { compose, ratioToSize, shadows: SHADOWS };
})();
