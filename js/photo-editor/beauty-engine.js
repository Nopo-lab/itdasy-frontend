/* 사진 편집기 — 뷰티 픽셀 엔진 */
(function () {
  'use strict';

  if (window.PhotoEditorBeautyEngine) return;

  // ── 네일 광택 튜닝 상수 (v348 자연 강화 — 과하면 여기 숫자만 조정) ──
  //   nailW 휴리스틱: 스페큘러/글리터 하이라이트 + 폴리시 채도만 잡고, 맨살·배경 배제
  const NAIL_SPEC_LUM = 205;      // 이 휘도 이상 = 유리질 광택/글리터 하이라이트 (>210 제외 문제 해소)
  const NAIL_SPEC_DESAT = 48;     // 하이라이트는 거의 무채색 — 붉은 피부 번들거림 제외용
  const NAIL_BRIGHT_MIN = 150;    // 밝은 네일면 시작 휘도
  const NAIL_SAT_MIN = 50;        // 폴리시 색 채도 시작 (색감 네일 가중)
  const NAIL_SUBJECT_MIN = 0.45;  // 손/네일 주피사체 영역만 (배경 번짐 방지)
  const NAIL_SKIN_SUPPRESS = 0.25; // 비광택 맨살 억제 배율 (손가락 전체 번짐 방지)
  //   nailGloss 적용 강도 (현재 flat +18 → 광택 타겟 강화)
  const NAIL_GLOSS_BASE = 14;     // 기본 밝힘 (번들거림 억제 위해 절제)
  const NAIL_GLOSS_SPEC = 30;     // 하이라이트 추가 광택 (체감 핵심 — 글리터/반짝임)
  // v350 — nailMask(ready) 연결 시 휴리스틱 최소 union 배율.
  //   mask 가 손톱면을 작게/일부만 잡아도 보정이 완전히 사라지지 않게 휴리스틱을 이 배율로 유지.
  const NAIL_MASK_FALLBACK = 0.45;

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

  function _unsharpMask(ctx, w, h, strength) {
    try {
      strength = Math.min(Math.max(strength || 0, 0), 0.6);
      const src = ctx.getImageData(0, 0, w, h);
      const blur = _boxBlur(src, w, h, 1);
      const out = ctx.createImageData(w, h);
      const k = 1 + strength * 0.5;
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

  // v348 — 네일 후보 가중 (자연 강화). specular/글리터 하이라이트(>210 포함) + 폴리시 채도만 잡고,
  //   subjectW/skin/edge 조건으로 손가락 전체·배경 번짐 방지. nailMask 미연결 → 항상 휴리스틱.
  function _nailWeight(lum0, hairSat0, subjectW, edgeBg, isSkin) {
    if (edgeBg || subjectW <= NAIL_SUBJECT_MIN) return 0;
    const whitish = hairSat0 < NAIL_SPEC_DESAT;                                  // 유리질 광택 = 무채색
    const specW = (lum0 > NAIL_SPEC_LUM && whitish) ? Math.min(1, (lum0 - NAIL_SPEC_LUM) / 45) : 0;
    const briW  = (lum0 > NAIL_BRIGHT_MIN && lum0 <= NAIL_SPEC_LUM) ? (lum0 - NAIL_BRIGHT_MIN) / (NAIL_SPEC_LUM - NAIL_BRIGHT_MIN) : 0;
    const satW  = hairSat0 > NAIL_SAT_MIN ? Math.min(0.5, (hairSat0 - NAIL_SAT_MIN) / 110) : 0;
    let base = Math.max(specW, briW * 0.6 + satW * 0.7);
    if (isSkin && specW < 0.25) base *= NAIL_SKIN_SUPPRESS;                      // 비광택 맨살 강력 억제
    return Math.min(1, base);
  }

  // v350 — nailMask 안전 blend. useM.nailMask(게이트 통과)면 mask primary + 휴리스틱 최소 union,
  //   미연결이면 휴리스틱 그대로 반환(noHand/저신뢰 → 절대 0 아님 → v348 픽셀단위 동일).
  function _nailBlend(useM, sc, midx, heuristicW) {
    if (useM && useM.nailMask) {
      const mv = (useM.nailMask[midx] || 0) * ((sc && sc.nailMask) || 1);
      const fb = heuristicW * NAIL_MASK_FALLBACK;
      return mv > fb ? mv : fb;                                                  // max(mask, 휴리스틱×0.45)
    }
    return heuristicW;
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

  // v316 — regionMasks 인자 추가 (있으면 픽셀 좌표 lookup, 없으면 기존 v312 휴리스틱).
  //   regionMasks = { useMasks: {skinMask, hairMask, lipMask, eyeMask, hairBoundaryMask}, _scale: {key→0.6|1.0} }
  //   useMasks 에 없는 key 는 자동으로 v312 휴리스틱 fallback.
  //   nailW 는 v350 부터 nailMask(ready 게이트 통과) 있으면 _nailBlend, 없으면 v348 휴리스틱.
  function _pixel(d, i, w, h, SmartMask, regionMasks) {
    const r = d[i], g = d[i + 1], bl = d[i + 2];
    const lum0 = r * 0.299 + g * 0.587 + bl * 0.114;
    const maxCh0 = Math.max(r, g, bl), minCh0 = Math.min(r, g, bl);
    const hairSat0 = maxCh0 - minCh0;
    const px = i >> 2, x = px % w, y = (px / w) | 0;
    const subjectW = Math.max(0, 1 - (Math.abs((x + 0.5) / w - 0.5) * 1.44 + Math.abs((y + 0.5) / h - 0.48) * 1.04));
    const edgeBg = subjectW < 0.5 || y < h * 0.02 || y > h * 0.96;
    const isSkin = !edgeBg && r > 60 && r > g - 6 && g > bl - 10 && (r - bl) > 5 && (r - bl) < 120 && lum0 > 45 && lum0 < 248;
    const isReddish = !edgeBg && subjectW > 0.55 && r > 80 && r > g && (r - bl) > 10 && (r - bl) < 140;
    const ny = (y + 0.5) / h;
    const upperHalf = ny < 0.55;
    const hairLike = !edgeBg && subjectW > 0.3 && lum0 > 14 && lum0 < 220 && (
      (!isSkin && ((hairSat0 < 110 && lum0 < 195) || lum0 < 110 || (bl < 95 && hairSat0 < 150)))
      || (upperHalf && lum0 < 160 && hairSat0 < 100)
    );
    const mask = SmartMask && SmartMask.classify ? SmartMask.classify({ r, g, b: bl, lum: lum0, maxCh: maxCh0, minCh: minCh0, x, y, w, h, isSkinFallback: isSkin, hairFallback: hairLike }) : null;

    // v316 — RegionMask 우선 lookup. 미적용 키는 v312 휴리스틱 fallback.
    //   v340 — 마스크는 원본(maskW×maskH) 해상도. 캔버스(w×h)가 다운스케일됐으면 좌표 환산.
    //   동일 해상도(대부분 경우)면 midx = y*w+x 그대로 (무변화·빠른 경로).
    const useM = regionMasks && regionMasks.useMasks;
    const sc = regionMasks && regionMasks._scale;
    const mw = (regionMasks && regionMasks.maskW) || w;
    const mh = (regionMasks && regionMasks.maskH) || h;
    let midx;
    if (mw === w && mh === h) {
      midx = y * w + x;                                   // 동일 해상도 — 빠른 경로 (무변화)
    } else {
      const mx = Math.min(mw - 1, Math.max(0, (x * mw / w) | 0));   // 경계 clamp (out-of-range 방지)
      const my = Math.min(mh - 1, Math.max(0, (y * mh / h) | 0));
      midx = my * mw + mx;
    }
    function _rm(key, fallback) {
      if (useM && useM[key]) return (useM[key][midx] || 0) * (sc[key] || 1);
      return fallback;
    }

    return {
      r, g, bl, lum0,
      skinW: _rm('skinMask', mask ? mask.skin : (isSkin ? 1 : 0)),
      hairW: _rm('hairMask', mask ? mask.hair : (hairLike ? 1 : 0)),
      eyeW:  _rm('eyeMask',  mask ? mask.eye : (ny > 0.30 && ny < 0.48 && lum0 < 140 ? 0.2 : 0)),
      lipW:  _rm('lipMask', 1),                          // lipMask 없으면 1 (기존 색 기반 검출 유지)
      boundaryW: _rm('hairBoundaryMask', 0),             // 없으면 0 → hairEnd 는 hairW fallback
      nailW: _nailBlend(useM, sc, midx, mask ? mask.nail : _nailWeight(lum0, hairSat0, subjectW, edgeBg, isSkin)), // v350 nailMask 안전 조건부 (미연결 시 v348 휴리스틱 동일)
      redW: mask ? mask.redness : (isReddish ? 1 : 0),
    };
  }

  function _applyEye(d, i, p, c) {
    if (c.eyeRedK > 0 && p.eyeW > 0.10 && p.lum0 > 95 && p.r > p.g + 6 && p.r > p.bl + 2 && Math.max(p.g, p.bl) > 60) {
      d[i] = _clamp(d[i] - 52 * c.eyeRedK * p.eyeW);
      d[i + 1] = _clamp(d[i + 1] + 12 * c.eyeRedK * p.eyeW);
      d[i + 2] = _clamp(d[i + 2] + 16 * c.eyeRedK * p.eyeW);
    }
    if (c.irisK > 0 && p.eyeW > 0.14 && p.lum0 > 16 && p.lum0 < 135 && p.skinW < 0.55) {
      _contrastFromLum(d, i, p.lum0, 1 + 0.75 * c.irisK * p.eyeW, 0);
    }
    if (c.catchK > 0 && p.eyeW > 0.06 && p.lum0 > 155 && Math.max(p.r, p.g, p.bl) - Math.min(p.r, p.g, p.bl) < 65) {
      d[i] = _clamp(d[i] + 26 * c.catchK * p.eyeW);
      d[i + 1] = _clamp(d[i + 1] + 26 * c.catchK * p.eyeW);
      d[i + 2] = _clamp(d[i + 2] + 30 * c.catchK * p.eyeW);
    }
  }

  function _contrastFromLum(d, i, lum, contrast, lift) {
    d[i] = _clamp(lum + (d[i] - lum) * contrast + lift);
    d[i + 1] = _clamp(lum + (d[i + 1] - lum) * contrast + lift);
    d[i + 2] = _clamp(lum + (d[i + 2] - lum) * contrast + lift);
  }

  function _applySkinTone(d, i, p, c) {
    if (c.redK > 0 && p.redW > 0.14) {
      d[i] = _clamp(d[i] - 48 * c.redK * p.redW);
      d[i + 1] = _clamp(d[i + 1] + 8 * c.redK * p.redW);
      d[i + 2] = _clamp(d[i + 2] + 10 * c.redK * p.redW);
    }
    if (c.yelK > 0 && (p.r - p.bl) > 12 && (p.r - p.bl) < 95 && p.r >= p.g && (p.g - p.bl) > 5 && p.r > 72 && p.skinW > 0.10) {
      d[i] = _clamp(d[i] - 8 * c.yelK * p.skinW);
      d[i + 1] = _clamp(d[i + 1] - 26 * c.yelK * p.skinW);
      d[i + 2] = _clamp(d[i + 2] + 20 * c.yelK * p.skinW);
    }
    if (p.skinW <= 0.10) return;
    if (c.skinK > 0) _add(d, i, 10 * c.skinK * p.skinW, 5 * c.skinK * p.skinW, 2.5 * c.skinK * p.skinW);
    if (c.handK > 0) _add(d, i, 8 * c.handK * p.skinW, 4 * c.handK * p.skinW, -3 * c.handK * p.skinW);
    if (c.coolK > 0 && (p.bl > p.r - 10) && (p.bl - p.g) > 5) _add(d, i, 12 * c.coolK * p.skinW, 4 * c.coolK * p.skinW, -16 * c.coolK * p.skinW);
  }

  function _add(d, i, r, g, b) {
    d[i] = _clamp(d[i] + r);
    d[i + 1] = _clamp(d[i + 1] + g);
    d[i + 2] = _clamp(d[i + 2] + b);
  }

  function _applySkinTexture(d, i, p, c, blurD) {
    if (p.skinW <= 0.10) return;
    if (c.txK > 0 && blurD) _mixBlur(d, i, blurD, 0.65 * c.txK * p.skinW, 0);
    if (c.blemishK > 0 && blurD) {
      const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      const blum = blurD[i] * 0.299 + blurD[i + 1] * 0.587 + blurD[i + 2] * 0.114;
      if (Math.abs(lum - blum) > 8) _mixBlur(d, i, blurD, 0.85 * c.blemishK * p.skinW, 0);
    }
    if (c.eyeShK > 0 && d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114 < 140) {
      const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      const w2 = (140 - lum) / 140;
      _add(d, i, 22 * c.eyeShK * w2 * p.skinW, 18 * c.eyeShK * w2 * p.skinW, 14 * c.eyeShK * w2 * p.skinW);
    }
    if (c.underK > 0 && p.lum0 < 155) {
      const w3 = (155 - p.lum0) / 155;
      _add(d, i, 20 * c.underK * w3 * p.skinW, 18 * c.underK * w3 * p.skinW, 14 * c.underK * w3 * p.skinW);
    }
  }

  function _mixBlur(d, i, blurD, mix, lift) {
    d[i] = _clamp(d[i] * (1 - mix) + blurD[i] * mix + lift);
    d[i + 1] = _clamp(d[i + 1] * (1 - mix) + blurD[i + 1] * mix + lift);
    d[i + 2] = _clamp(d[i + 2] * (1 - mix) + blurD[i + 2] * mix + lift);
  }

  function _applyHair(d, i, p, c, blurD) {
    if (p.hairW <= 0.14) return;
    if (c.hairK > 0 && p.lum0 > 45 && p.lum0 < 210 && Math.abs(d[i] - d[i + 1]) < 55 && Math.abs(d[i + 1] - d[i + 2]) < 55) {
      const specBoost = p.lum0 > 120 ? (p.lum0 - 120) / 80 * 0.8 + 1 : 1;
      _add(d, i, 22 * c.hairK * specBoost * p.hairW, 28 * c.hairK * specBoost * p.hairW, 12 * c.hairK * specBoost * p.hairW);
    }
    if (c.hairVolK > 0) _contrastFromLum(d, i, p.lum0, 1 + 0.65 * c.hairVolK * p.hairW, (p.lum0 > 100 ? 30 * c.hairVolK : -18 * c.hairVolK) * p.hairW);
    // v316 — hairEndK 는 boundary mask 있으면 우선 사용 (경계만 끝정리), 없으면 hairW
    if (c.hairEndK > 0 && blurD) {
      const ew = (p.boundaryW || 0) > 0.10 ? p.boundaryW : p.hairW;
      _mixBlur(d, i, blurD, 0.6 * c.hairEndK * ew, p.lum0 < 90 ? 8 * c.hairEndK * ew : 0);
    }
    if (c.hairColK !== 0 && p.lum0 < 175) _add(d, i, 18 * c.hairColK * p.hairW, 6 * c.hairColK * p.hairW, -18 * c.hairColK * p.hairW);
    if (c.hairPopK > 0) _applyHairPop(d, i, p, c);
    if (c.scalpK > 0 && p.lum0 < 115 && Math.abs(p.r - p.g) < 38 && Math.abs(p.g - p.bl) < 38) {
      _add(d, i, 20 * c.scalpK * p.hairW, 20 * c.scalpK * p.hairW, 12 * c.scalpK * p.hairW);
    }
  }

  function _applyHairPop(d, i, p, c) {
    const maxCh = Math.max(p.r, p.g, p.bl), minCh = Math.min(p.r, p.g, p.bl);
    if (maxCh - minCh <= 10 || p.lum0 >= 195) return;
    const k = 1.4 * c.hairPopK * p.hairW;
    d[i] = _clamp(p.r + (p.r - p.lum0) * k);
    d[i + 1] = _clamp(p.g + (p.g - p.lum0) * k);
    d[i + 2] = _clamp(p.bl + (p.bl - p.lum0) * k);
  }

  function _applyDetail(d, i, p, c) {
    // nail gloss — v348 자연 강화. 기본 밝힘 + 하이라이트 추가 광택(글리터/반짝임), nailW(네일면)만.
    //   강도는 상단 NAIL_GLOSS_* 상수로 조정. 번들거림 나면 SPEC 먼저 낮춤.
    if (c.nailK > 0 && p.nailW > 0.12) {
      const gw = c.nailK * p.nailW;
      const spec = p.lum0 > 195 ? Math.min(1, (p.lum0 - 195) / 55) : 0;
      const add = (NAIL_GLOSS_BASE + NAIL_GLOSS_SPEC * spec) * gw;
      _add(d, i, add, add, add * 1.04);   // 하이라이트 살짝 차갑게(파랑 +4%) = 유리질 광택감
    }
    // lip — v316 lipMask 연결. mask 있으면 lipW 기반 가중, 없으면 lipW=1 + 색 기반 검출 (v312 동일)
    if (c.lipK > 0 && p.r > p.g + 10 && p.r > p.bl + 10 && p.lum0 > 50 && p.lum0 < 210) {
      const lw = p.lipW != null ? p.lipW : 1;
      _add(d, i, 28 * c.lipK * lw, -6 * c.lipK * lw, -6 * c.lipK * lw);
    }
    if (c.eyeK > 0 && p.eyeW > 0.10 && p.lum0 < 100) {
      d[i] = _clamp(d[i] + (p.r - p.lum0) * 0.9 * c.eyeK * p.eyeW);
      d[i + 1] = _clamp(d[i + 1] + (p.g - p.lum0) * 0.9 * c.eyeK * p.eyeW);
      d[i + 2] = _clamp(d[i + 2] + (p.bl - p.lum0) * 0.9 * c.eyeK * p.eyeW);
    }
    if (c.armK > 0 && p.skinW > 0.10 && p.lum0 < 140) _add(d, i, 16 * c.armK * p.skinW, 14 * c.armK * p.skinW, 10 * c.armK * p.skinW);
  }

  // v317 — 영역 한정 unsharp (lashSharp 용). mask>임계 픽셀만 샤픈, 나머지는 원본 유지.
  //   mask 는 원본(mw×mh) 해상도 → 캔버스(w×h) 좌표 환산 + 경계 clamp (v340 정합과 동일 규칙).
  function _unsharpMaskRegion(ctx, w, h, strength, mask, scale, mw, mh) {
    try {
      strength = Math.min(Math.max(strength || 0, 0), 0.6);
      const src = ctx.getImageData(0, 0, w, h);
      const blur = _boxBlur(src, w, h, 1);
      const out = ctx.createImageData(w, h);
      const k = 1 + strength * 0.5;
      const same = (mw === w && mh === h);
      for (let i = 0, idx = 0; i < src.data.length; i += 4, idx++) {
        let midx;
        if (same) midx = idx;
        else {
          const x = idx % w, y = (idx / w) | 0;
          const mx = Math.min(mw - 1, Math.max(0, (x * mw / w) | 0));
          const my = Math.min(mh - 1, Math.max(0, (y * mh / h) | 0));
          midx = my * mw + mx;
        }
        const mwgt = Math.min(1, (mask[midx] || 0) * (scale || 1));
        if (mwgt <= 0.01) {
          out.data[i] = src.data[i]; out.data[i + 1] = src.data[i + 1];
          out.data[i + 2] = src.data[i + 2]; out.data[i + 3] = src.data[i + 3];
          continue;
        }
        const sr = _clamp(src.data[i] + (src.data[i] - blur.data[i]) * (k - 1));
        const sg = _clamp(src.data[i + 1] + (src.data[i + 1] - blur.data[i + 1]) * (k - 1));
        const sb = _clamp(src.data[i + 2] + (src.data[i + 2] - blur.data[i + 2]) * (k - 1));
        out.data[i] = src.data[i] * (1 - mwgt) + sr * mwgt;
        out.data[i + 1] = src.data[i + 1] * (1 - mwgt) + sg * mwgt;
        out.data[i + 2] = src.data[i + 2] * (1 - mwgt) + sb * mwgt;
        out.data[i + 3] = src.data[i + 3];
      }
      ctx.putImageData(out, 0, 0);
    } catch (_e) { void _e; }
  }

  function _applySharpen(ctx, w, h, b, regionMasks, nailMaskArr) {
    if (b.hairDetail > 10) _unsharpMask(ctx, w, h, b.hairDetail / 150);
    if (b.hairVolume > 10) _unsharpMask(ctx, w, h, b.hairVolume / 260);
    // v317 — lashSharp: eyelashBandMask(conf≥0.4) 있으면 밴드만 샤픈, 아니면 기존 전역 unsharp(회귀안전)
    if (b.lashSharp > 10) {
      const lm = regionMasks && regionMasks.lashMask;
      if (lm) _unsharpMaskRegion(ctx, w, h, b.lashSharp / 65, lm, regionMasks.lashScale || 1, regionMasks.maskW || w, regionMasks.maskH || h);
      else _unsharpMask(ctx, w, h, b.lashSharp / 65);
    }
    if (b.closeUpDetail > 10) _unsharpMask(ctx, w, h, b.closeUpDetail / 80);
    if (b.irisClear > 10) _unsharpMask(ctx, w, h, b.irisClear / 130);
    if (b.browSharp > 10) _unsharpMask(ctx, w, h, b.browSharp / 90);
    // v348 — nailShape: 전역 unsharp 대신 nailW 영역만 샤픈 → 네일 표면만 또렷, 손가락/배경 안 건드림
    if (b.nailShape > 10) {
      if (nailMaskArr) _unsharpMaskRegion(ctx, w, h, b.nailShape / 90, nailMaskArr, 1, w, h);
      else _unsharpMask(ctx, w, h, b.nailShape / 100);
    }
  }

  // v316 — regionMasks 인자 추가. null/undefined 면 기존 v312 휴리스틱 동작 (완전 동등).
  function apply(ctx, w, h, b, skinSmoothed, regionMasks) {
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
    const needCpuSmooth = !skinSmoothed && (c.blemishK > 0 || c.txK > 0);
    if (needCpuSmooth || c.hairEndK > 0) {
      try { blurD = _boxBlur(data, w, h, 2).data; } catch (_e) { blurD = null; }
    }
    // v348 — nailShape 를 nailW 영역만 샤픈하기 위해 픽셀 walk 중 네일 가중치 수집
    let nailMaskArr = null;
    if (b.nailShape > 10) { try { nailMaskArr = new Float32Array(w * h); } catch (_e) { nailMaskArr = null; } }
    for (let i = 0; i < d.length; i += 4) {
      const p = _pixel(d, i, w, h, window.PhotoEditorSmartMask, regionMasks);
      if (nailMaskArr) nailMaskArr[i >> 2] = p.nailW;
      _applyEye(d, i, p, c);
      _applySkinTone(d, i, p, c);
      _applySkinTexture(d, i, p, c, blurD);
      _applyHair(d, i, p, c, blurD);
      _applyDetail(d, i, p, c);
    }
    ctx.putImageData(data, 0, 0);
    _applySharpen(ctx, w, h, b, regionMasks, nailMaskArr);
  }

  window.PhotoEditorBeautyEngine = { apply };
})();
