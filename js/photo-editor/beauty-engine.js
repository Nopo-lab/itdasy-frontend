/* 사진 편집기 — 뷰티 픽셀 엔진 */
(function () {
  'use strict';

  if (window.PhotoEditorBeautyEngine) return;

  function _clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

  function _boxBlur(img, w, h, r) {
    const out = new ImageData(w, h);
    const d = img.data, o = out.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let rSum = 0, gSum = 0, bSum = 0, n = 0;
        for (let kx = -r; kx <= r; kx++) {
          const xx = Math.min(w - 1, Math.max(0, x + kx));
          const p = (y * w + xx) * 4;
          rSum += d[p]; gSum += d[p + 1]; bSum += d[p + 2]; n++;
        }
        const p = (y * w + x) * 4;
        o[p] = rSum / n; o[p + 1] = gSum / n; o[p + 2] = bSum / n; o[p + 3] = d[p + 3];
      }
    }
    return out;
  }

  function _unsharpMask(ctx, w, h, strength) {
    try {
      const src = ctx.getImageData(0, 0, w, h);
      const blur = _boxBlur(src, w, h, 1);
      const out = ctx.createImageData(w, h);
      const k = 1 + strength * 1.2;
      for (let i = 0; i < src.data.length; i += 4) {
        out.data[i] = _clamp(src.data[i] + (src.data[i] - blur.data[i]) * (k - 1));
        out.data[i + 1] = _clamp(src.data[i + 1] + (src.data[i + 1] - blur.data[i + 1]) * (k - 1));
        out.data[i + 2] = _clamp(src.data[i + 2] + (src.data[i + 2] - blur.data[i + 2]) * (k - 1));
        out.data[i + 3] = src.data[i + 3];
      }
      ctx.putImageData(out, 0, 0);
    } catch (_e) { void _e; }
  }

  function _hasAny(b) {
    return !!(b.skin || b.redness || b.hairShine || b.nailGloss || b.lashSharp
      || b.blemish || b.handSkin || b.hairColor || b.hairDetail || b.eyeShadow
      || b.yellowness || b.coolness || b.textureSmooth || b.hairColorPop || b.closeUpDetail
      || b.lipPop || b.eyeColor || b.browSharp || b.nailShape || b.scalpBoost || b.hairyArm
      || b.eyeRedness || b.irisClear || b.catchLight || b.underEyeClean
      || b.hairVolume || b.hairEndsClean);
  }

  function _coeffs(b) {
    return {
      skinK: (b.skin || 0) / 100, redK: (b.redness || 0) / 100,
      hairK: (b.hairShine || 0) / 100, hairVolK: (b.hairVolume || 0) / 100,
      hairEndK: (b.hairEndsClean || 0) / 100, nailK: (b.nailGloss || 0) / 100,
      blemishK: (b.blemish || 0) / 100, handK: (b.handSkin || 0) / 100,
      eyeShK: (b.eyeShadow || 0) / 100, hairColK: (b.hairColor || 0) / 100,
      yelK: (b.yellowness || 0) / 100, coolK: (b.coolness || 0) / 100,
      txK: (b.textureSmooth || 0) / 100, hairPopK: (b.hairColorPop || 0) / 100,
      lipK: (b.lipPop || 0) / 100, eyeK: (b.eyeColor || 0) / 100,
      scalpK: (b.scalpBoost || 0) / 100, armK: (b.hairyArm || 0) / 100,
      eyeRedK: (b.eyeRedness || 0) / 100, irisK: (b.irisClear || 0) / 100,
      catchK: (b.catchLight || 0) / 100, underK: (b.underEyeClean || 0) / 100,
    };
  }

  function _pixel(d, i, w, h, SmartMask) {
    const r = d[i], g = d[i + 1], bl = d[i + 2];
    const lum0 = r * 0.299 + g * 0.587 + bl * 0.114;
    const maxCh0 = Math.max(r, g, bl), minCh0 = Math.min(r, g, bl);
    const hairSat0 = maxCh0 - minCh0;
    const px = i >> 2, x = px % w, y = (px / w) | 0;
    const subjectW = Math.max(0, 1 - (Math.abs((x + 0.5) / w - 0.5) * 1.44 + Math.abs((y + 0.5) / h - 0.48) * 1.04));
    const edgeBg = subjectW < 0.5 || y < h * 0.02 || y > h * 0.96;
    const isSkin = !edgeBg && r > 82 && r > g + 4 && g > bl - 6 && (r - bl) > 18 && (r - bl) < 105 && lum0 > 68 && lum0 < 238;
    const isReddish = !edgeBg && subjectW > 0.55 && r > 80 && r > g && (r - bl) > 10 && (r - bl) < 140;
    const hairLike = !edgeBg && subjectW > 0.5 && !isSkin && lum0 > 18 && lum0 < 205 && ((hairSat0 < 88 && lum0 < 170) || lum0 < 92 || (bl < 80 && hairSat0 < 120));
    const mask = SmartMask && SmartMask.classify ? SmartMask.classify({ r, g, b: bl, lum: lum0, maxCh: maxCh0, minCh: minCh0, x, y, w, h, isSkinFallback: isSkin, hairFallback: hairLike }) : null;
    return {
      r, g, bl, lum0,
      skinW: mask ? mask.skin : (isSkin ? 1 : 0),
      hairW: mask ? mask.hair : (hairLike ? 1 : 0),
      eyeW: mask ? mask.eye : 1,
      nailW: mask ? mask.nail : 1,
      redW: mask ? mask.redness : (isReddish ? 1 : 0),
    };
  }

  function _applyEye(d, i, p, c) {
    if (c.eyeRedK > 0 && p.eyeW > 0.12 && p.lum0 > 105 && p.r > p.g + 8 && p.r > p.bl + 4 && Math.max(p.g, p.bl) > 70) {
      d[i] = _clamp(d[i] - 34 * c.eyeRedK * p.eyeW);
      d[i + 1] = _clamp(d[i + 1] + 7 * c.eyeRedK * p.eyeW);
      d[i + 2] = _clamp(d[i + 2] + 10 * c.eyeRedK * p.eyeW);
    }
    if (c.irisK > 0 && p.eyeW > 0.18 && p.lum0 > 18 && p.lum0 < 120 && p.skinW < 0.5) {
      _contrastFromLum(d, i, p.lum0, 1 + 0.45 * c.irisK * p.eyeW, 0);
    }
    if (c.catchK > 0 && p.eyeW > 0.08 && p.lum0 > 168 && Math.max(p.r, p.g, p.bl) - Math.min(p.r, p.g, p.bl) < 55) {
      d[i] = _clamp(d[i] + 12 * c.catchK * p.eyeW);
      d[i + 1] = _clamp(d[i + 1] + 12 * c.catchK * p.eyeW);
      d[i + 2] = _clamp(d[i + 2] + 14 * c.catchK * p.eyeW);
    }
  }

  function _contrastFromLum(d, i, lum, contrast, lift) {
    d[i] = _clamp(lum + (d[i] - lum) * contrast + lift);
    d[i + 1] = _clamp(lum + (d[i + 1] - lum) * contrast + lift);
    d[i + 2] = _clamp(lum + (d[i + 2] - lum) * contrast + lift);
  }

  function _applySkinTone(d, i, p, c) {
    if (c.redK > 0 && p.redW > 0.18) {
      d[i] = _clamp(d[i] - 30 * c.redK * p.redW);
      d[i + 1] = _clamp(d[i + 1] + 4 * c.redK * p.redW);
      d[i + 2] = _clamp(d[i + 2] + 5 * c.redK * p.redW);
    }
    if (c.yelK > 0 && (p.r - p.bl) > 15 && (p.r - p.bl) < 90 && p.r >= p.g && (p.g - p.bl) > 8 && p.r > 80 && p.skinW > 0.12) {
      d[i] = _clamp(d[i] - 4 * c.yelK * p.skinW);
      d[i + 1] = _clamp(d[i + 1] - 15 * c.yelK * p.skinW);
      d[i + 2] = _clamp(d[i + 2] + 12 * c.yelK * p.skinW);
    }
    if (p.skinW <= 0.12) return;
    if (c.skinK > 0) _add(d, i, 4 * c.skinK * p.skinW, 2 * c.skinK * p.skinW, c.skinK * p.skinW);
    if (c.handK > 0) _add(d, i, 3 * c.handK * p.skinW, 1.5 * c.handK * p.skinW, -c.handK * p.skinW);
    if (c.coolK > 0 && (p.bl > p.r - 10) && (p.bl - p.g) > 5) _add(d, i, 6 * c.coolK * p.skinW, 2 * c.coolK * p.skinW, -8 * c.coolK * p.skinW);
  }

  function _add(d, i, r, g, b) {
    d[i] = _clamp(d[i] + r);
    d[i + 1] = _clamp(d[i + 1] + g);
    d[i + 2] = _clamp(d[i + 2] + b);
  }

  function _applySkinTexture(d, i, p, c, blurD) {
    if (p.skinW <= 0.12) return;
    if (c.txK > 0 && blurD) _mixBlur(d, i, blurD, 0.4 * c.txK * p.skinW, 0);
    if (c.blemishK > 0 && blurD) {
      const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      const blum = blurD[i] * 0.299 + blurD[i + 1] * 0.587 + blurD[i + 2] * 0.114;
      if (Math.abs(lum - blum) > 12) _mixBlur(d, i, blurD, 0.6 * c.blemishK * p.skinW, 0);
    }
    if (c.eyeShK > 0 && d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114 < 130) {
      const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      const w2 = (130 - lum) / 130;
      _add(d, i, 12 * c.eyeShK * w2 * p.skinW, 10 * c.eyeShK * w2 * p.skinW, 8 * c.eyeShK * w2 * p.skinW);
    }
    if (c.underK > 0 && p.lum0 < 145) {
      const w3 = (145 - p.lum0) / 145;
      _add(d, i, 10 * c.underK * w3 * p.skinW, 9 * c.underK * w3 * p.skinW, 7 * c.underK * w3 * p.skinW);
    }
  }

  function _mixBlur(d, i, blurD, mix, lift) {
    d[i] = _clamp(d[i] * (1 - mix) + blurD[i] * mix + lift);
    d[i + 1] = _clamp(d[i + 1] * (1 - mix) + blurD[i + 1] * mix + lift);
    d[i + 2] = _clamp(d[i + 2] * (1 - mix) + blurD[i + 2] * mix + lift);
  }

  function _applyHair(d, i, p, c, blurD) {
    if (p.hairW <= 0.18) return;
    if (c.hairK > 0 && p.lum0 > 60 && p.lum0 < 200 && Math.abs(d[i] - d[i + 1]) < 45 && Math.abs(d[i + 1] - d[i + 2]) < 45) {
      const specBoost = p.lum0 > 130 ? (p.lum0 - 130) / 70 * 0.6 + 1 : 1;
      _add(d, i, 10 * c.hairK * specBoost * p.hairW, 14 * c.hairK * specBoost * p.hairW, 6 * c.hairK * specBoost * p.hairW);
    }
    if (c.hairVolK > 0) _contrastFromLum(d, i, p.lum0, 1 + 0.34 * c.hairVolK * p.hairW, (p.lum0 > 108 ? 16 * c.hairVolK : -10 * c.hairVolK) * p.hairW);
    if (c.hairEndK > 0 && blurD) _mixBlur(d, i, blurD, 0.38 * c.hairEndK * p.hairW, p.lum0 < 90 ? 4 * c.hairEndK * p.hairW : 0);
    if (c.hairColK !== 0 && p.lum0 < 160) _add(d, i, 10 * c.hairColK * p.hairW, 3 * c.hairColK * p.hairW, -10 * c.hairColK * p.hairW);
    if (c.hairPopK > 0) _applyHairPop(d, i, p, c);
    if (c.scalpK > 0 && p.lum0 < 100 && Math.abs(p.r - p.g) < 30 && Math.abs(p.g - p.bl) < 30) {
      _add(d, i, 10 * c.scalpK * p.hairW, 10 * c.scalpK * p.hairW, 6 * c.scalpK * p.hairW);
    }
  }

  function _applyHairPop(d, i, p, c) {
    const maxCh = Math.max(p.r, p.g, p.bl), minCh = Math.min(p.r, p.g, p.bl);
    if (maxCh - minCh <= 15 || p.lum0 >= 180) return;
    const k = 0.85 * c.hairPopK * p.hairW;
    d[i] = _clamp(p.r + (p.r - p.lum0) * k);
    d[i + 1] = _clamp(p.g + (p.g - p.lum0) * k);
    d[i + 2] = _clamp(p.bl + (p.bl - p.lum0) * k);
  }

  function _applyDetail(d, i, p, c) {
    if (c.nailK > 0 && p.nailW > 0.12 && p.lum0 > 180) _add(d, i, 8 * c.nailK * p.nailW, 8 * c.nailK * p.nailW, 8 * c.nailK * p.nailW);
    if (c.lipK > 0 && p.r > p.g + 15 && p.r > p.bl + 15 && p.lum0 > 60 && p.lum0 < 200) _add(d, i, 15 * c.lipK, -3 * c.lipK, -3 * c.lipK);
    if (c.eyeK > 0 && p.eyeW > 0.12 && p.lum0 < 90) {
      d[i] = _clamp(d[i] + (p.r - p.lum0) * 0.5 * c.eyeK * p.eyeW);
      d[i + 1] = _clamp(d[i + 1] + (p.g - p.lum0) * 0.5 * c.eyeK * p.eyeW);
      d[i + 2] = _clamp(d[i + 2] + (p.bl - p.lum0) * 0.5 * c.eyeK * p.eyeW);
    }
    if (c.armK > 0 && p.skinW > 0.12 && p.lum0 < 130) _add(d, i, 8 * c.armK * p.skinW, 7 * c.armK * p.skinW, 5 * c.armK * p.skinW);
  }

  function _applySharpen(ctx, w, h, b) {
    if (b.hairDetail > 10) _unsharpMask(ctx, w, h, b.hairDetail / 300);
    if (b.hairVolume > 10) _unsharpMask(ctx, w, h, b.hairVolume / 520);
    if (b.lashSharp > 10) _unsharpMask(ctx, w, h, b.lashSharp / 130);
    if (b.closeUpDetail > 10) _unsharpMask(ctx, w, h, b.closeUpDetail / 160);
    if (b.irisClear > 10) _unsharpMask(ctx, w, h, b.irisClear / 260);
    if (b.browSharp > 10) _unsharpMask(ctx, w, h, b.browSharp / 180);
    if (b.nailShape > 10) _unsharpMask(ctx, w, h, b.nailShape / 200);
  }

  function apply(ctx, w, h, b) {
    if (!b || !_hasAny(b)) return;
    let data;
    try { data = ctx.getImageData(0, 0, w, h); } catch (e) {
      console.warn('[beauty-engine] getImageData 실패 — canvas tainted?', e.message);
      if (!apply._warned) { apply._warned = true; if (window.showToast) window.showToast('뷰티 보정 불가 — 사진을 파일에서 다시 불러와 주세요'); }
      return;
    }
    const d = data.data;
    const c = _coeffs(b);
    let blurD = null;
    if (c.blemishK > 0 || c.txK > 0 || c.hairEndK > 0) {
      try { blurD = _boxBlur(data, w, h, 1).data; } catch (_e) { blurD = null; }
    }
    for (let i = 0; i < d.length; i += 4) {
      const p = _pixel(d, i, w, h, window.PhotoEditorSmartMask);
      _applyEye(d, i, p, c);
      _applySkinTone(d, i, p, c);
      _applySkinTexture(d, i, p, c, blurD);
      _applyHair(d, i, p, c, blurD);
      _applyDetail(d, i, p, c);
    }
    ctx.putImageData(data, 0, 0);
    _applySharpen(ctx, w, h, b);
  }

  window.PhotoEditorBeautyEngine = { apply };
})();
