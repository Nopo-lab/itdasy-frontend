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

  // ── [T-140 hairVolume 볼륨 착시 / T-141 hairEndsClean 머리끝] 튜닝 상수 ──
  //   과보정/배경 침범 시 여기 숫자만 조정. rollback: HAIR_VOL_*=0, HAIR_VOL_CONTRAST=0.65, HAIR_ENDS_*=기존값.
  //   원리: hairBoundaryMask(경계 band) 안에서 hairW(머리쪽) 높은 픽셀의 명부엔 rim highlight,
  //         암부엔 미세 depth shadow → 외곽 라인·입체감 부각(형태 warping 없이). 배경(hairW 낮음)은 제외.
  const HAIR_VOL_RIM_HI = 26;       // [1차상향] 경계 명부 rim highlight (16→26) 외곽 더 또렷
  const HAIR_VOL_RIM_LO = 22;       // [1차상향] 경계 암부 depth shadow (14→22) 입체 음영
  const HAIR_VOL_ROOT_LIFT = 14;    // [1차상향] 상단/뿌리 lift (9→14) 정수리 풍성
  const HAIR_VOL_ROOT_TOP = 0.42;   // 뿌리 영역 상단 비율
  const HAIR_VOL_CONTRAST = 0.42;   // [1차상향] contrast 보조 (0.32→0.42, 기존 0.65 보단 낮게)
  const HAIR_VOL_RIM_LUM = 120;     // rim 명/암 분기 휘도
  const HAIR_VOL_WEAK_RIM = 0.5;    // [신규] boundaryMask WEAK/없을 때 hairW 기반 rim 보강 배율
  // T-141 — 외곽 부스스함만 soften. 본체(hairW 높음) 보존.
  const HAIR_ENDS_MIX = 0.42;       // 외곽 띠 soften 강도
  const HAIR_ENDS_FALLBACK = 0.3;   // hairMask 없을 때 hairW fallback soften (과장 금지 — 약하게)
  // ── [v537 hairFull 헤어 풍성하게] 볼륨(rim/입체)과 구분되는 "숱·밀도" 착시 ──
  //   원리: ① 머리 영역 전반 mild contrast(가닥 분리감) ② 상단/뿌리 넓은 lift(정수리 숱)
  //         ③ 머리 영역 안의 밝은 빈틈(두피 비침/성긴 부분, lum 높음)을 머리톤 쪽으로 살짝 채움(fill).
  //   마스크 없이 hairW 휴리스틱만으로도 체감되게(폴백 강함). 색은 안 바꾸고 명암/밀도만.
  const HAIR_FULL_CONTRAST = 0.34;  // 머리 가닥 분리 contrast
  const HAIR_FULL_ROOT_LIFT = 16;   // 상단/뿌리 숱 lift
  const HAIR_FULL_ROOT_TOP = 0.55;  // 뿌리 lift 적용 상단 비율(볼륨보다 넓게)
  const HAIR_FULL_FILL = 16;        // 머리 속 밝은 빈틈 채우기(darken) 상한
  const HAIR_FULL_FILL_LUM = 135;   // 이 휘도 이상 = 빈틈/두피 비침 후보(머리 본체보다 밝음)

  // ── [T-142 catchLight / T-143 lashSharp] 눈 효과 상수 ──
  const CATCH_OPACITY = 0.38;       // [2차조정] catchLight 중심 alpha (0.42→0.38, 고해상도 눈동자 뜸 추가 후퇴)
  const CATCH_RAD_RATIO = 0.10;     // 한쪽 눈 폭 대비 반경 + 눈높이×0.20 상한(아래) — 작은 반짝 점
  const CATCH_COV_MIN = 0.0003;     // eyeMask bbox 면적 하한(이하=비정상 → 합성 스킵)
  const CATCH_COV_MAX = 0.15;       // 상한(이상=오검출 → 스킵)
  const LASH_ROI_BOT = 0.45;        // eyeMask bbox 상단 0~45% = 속눈썹/눈 위 라인 ROI
  const LASH_GLOBAL_FALLBACK = 120; // eyeMask 도 없을 때 전역 unsharp 분모 (기존 65 → 약화)
  const EYE_MASK_THRESH = 0.25;     // eyeMask 임계 — tier2 polygon 은 feather 로 max≈0.43 라 0.5 면 전부 탈락(작동X). 0.25 로.
  const LASH_DARKEN = 0.22;         // [1차조정] lashSharp ROI 어두운 선 darken 강도(속눈썹 진하게). unsharp 보완.
  const EYE_COLOR_SAT_MIN = 28;     // [T-146 조정] eyeColor — 채도 임계 14→28. 맨 눈꺼풀 살구빛 제외, 진짜 아이섀도(채도 높음)만 강화(과함 방지).
  const NAIL_SHAPE_DARKEN = 0.18;   // [T-144 2차] nailW ROI 어두운 아트 라인/젤 경계 darken(윤곽 또렷). lum<150 만 → 광택면 보존.
  const TEXTURE_EDGE_TAU = 22;      // [T-152] edge-preserving 임계 — lum 차 이상이면 edge(보존), 이하 평탄(블러)
  const BLEMISH_DARK_TAU = 9;       // [T-151] 잡티 검출 하한 — 넓은블러(주변 피부톤)보다 이만큼 어두운 작은 점만
  const BLEMISH_DARK_MAX = 45;      // [T-151] 상한 — 이보다 어두우면 잡티 아님(속눈썹/눈썹/머리=검정) → 제외
  const BLEMISH_LUM_MIN = 70;       // [T-151] 이보다 어두운 픽셀 제외(검은 눈매/눈썹). 잡티는 피부톤 영역.
  const BLEMISH_BLEND = 0.8;        // [T-151] 잡티 → 주변 피부톤 blend 상한(흐림 아닌 채움)

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

  // [T-141 재구현] hairMask 외곽 띠 = hairMask AND NOT(erosion). 내부 본체/가닥은 제외.
  //   separable min-filter(반경 r)로 erosion → 머리 외곽선(배경 인접)만 1, 내부는 0.
  //   mask: Float32Array(0~1), mw×mh. 반환: Float32Array outerBand(0/1).
  function _hairOuterBand(mask, mw, mh, r) {
    const n = mw * mh;
    const bin = new Float32Array(n);
    for (let i = 0; i < n; i++) bin[i] = mask[i] > 0.5 ? 1 : 0;
    const tmp = new Float32Array(n);
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {  // horizontal min
      let m = 1; for (let k = -r; k <= r; k++) { const xx = x + k < 0 ? 0 : x + k >= mw ? mw - 1 : x + k; const v = bin[y * mw + xx]; if (v < m) m = v; }
      tmp[y * mw + x] = m;
    }
    const ero = new Float32Array(n);
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {  // vertical min
      let m = 1; for (let k = -r; k <= r; k++) { const yy = y + k < 0 ? 0 : y + k >= mh ? mh - 1 : y + k; const v = tmp[yy * mw + x]; if (v < m) m = v; }
      ero[y * mw + x] = m;
    }
    const band = new Float32Array(n);
    for (let i = 0; i < n; i++) band[i] = (bin[i] > 0.5 && ero[i] < 0.5) ? 1 : 0;  // 머리 ∧ ¬내부 = 외곽 띠
    return band;
  }

  // [T-142/143] eyeMask 픽셀 bbox (mask 좌표). 없으면 null.
  function _eyeBBox(mask, mw, mh) {
    let minX = mw, minY = mh, maxX = -1, maxY = -1, cnt = 0;
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
      if (mask[y * mw + x] > EYE_MASK_THRESH) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; cnt++; }
    }
    if (maxX < 0) return null;
    return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1, cnt };
  }

  // [T-142] eyeMask 좌/우 눈 무게중심에 작은 soft highlight 합성(눈 생기). 흰자/피부 회피 위해
  //   작은 반경 + 무게중심(눈동자 근처)에만. opacity 절제. 그린 눈 수 반환.
  function _drawCatchlight(ctx, w, h, mask, mw, mh, opacity) {
    const bb = _eyeBBox(mask, mw, mh);
    if (!bb) return 0;
    const cov = bb.cnt / (mw * mh);
    if (cov < CATCH_COV_MIN || cov > CATCH_COV_MAX) return 0;   // 비정상 bbox → 스킵
    const sx = w / mw, sy = h / mh, midX = (bb.minX + bb.maxX) / 2;
    const halves = [[bb.minX, Math.floor(midX)], [Math.ceil(midX), bb.maxX]];
    let drawn = 0;
    ctx.save();
    for (const [x0, x1] of halves) {
      let sxx = 0, syy = 0, c = 0;
      for (let y = bb.minY; y <= bb.maxY; y++) for (let x = x0; x <= x1; x++) { if (mask[y * mw + x] > EYE_MASK_THRESH) { sxx += x; syy += y; c++; } }
      if (c < 5) continue;                                       // 한쪽만 인식 시 빈쪽 스킵
      const ecx = (sxx / c) * sx, ecy = (syy / c) * sy - bb.h * 0.05 * sy;  // 무게중심 약간 위
      // [1차조정] 반경을 눈동자 크기(눈 높이) 기준으로 제한 — 고해상도에서 눈 전체 밝힘 방지.
      //   min(한눈폭×0.10, 눈높이×0.30). 눈동자보다 작은 "생기 점".
      const eyeW = (x1 - x0 + 1) * sx, eyeH = bb.h * sy;
      const rad = Math.max(2, Math.min(eyeW * CATCH_RAD_RATIO, eyeH * 0.20));  // [2차] 0.30→0.20 더 작은 점
      const grad = ctx.createRadialGradient(ecx, ecy, 0, ecx, ecy, rad);
      grad.addColorStop(0, 'rgba(255,255,255,' + opacity + ')');
      grad.addColorStop(0.45, 'rgba(255,255,255,' + (opacity * 0.4) + ')');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(ecx, ecy, rad, 0, Math.PI * 2); ctx.fill();
      drawn++;
    }
    ctx.restore();
    return drawn;
  }

  // [T-143] eyeMask bbox 상단 0~LASH_ROI_BOT(45%) ∩ eyeMask = 속눈썹/눈 위 라인 ROI (mask 좌표).
  function _eyeUpperROI(mask, mw, mh) {
    const bb = _eyeBBox(mask, mw, mh);
    if (!bb) return null;
    const botY = bb.minY + bb.h * LASH_ROI_BOT;
    const roi = new Float32Array(mw * mh);
    for (let y = bb.minY; y <= botY && y < mh; y++) for (let x = bb.minX; x <= bb.maxX; x++) {
      const idx = y * mw + x; if (mask[idx] > EYE_MASK_THRESH) roi[idx] = 1;   // eyeMask 내부 상단만
    }
    return roi;
  }

  // [T-146] 눈꺼풀/언더(아이섀도) ROI = eyeMask bbox 위(0.7×h)·아래(0.5×h) 확장 − eyeMask 내부(흰자/홍채 제외).
  function _eyeLidROI(mask, mw, mh) {
    const bb = _eyeBBox(mask, mw, mh);
    if (!bb) return null;
    const topY = Math.max(0, Math.floor(bb.minY - bb.h * 0.7));
    const botY = Math.min(mh - 1, Math.ceil(bb.maxY + bb.h * 0.5));
    const roi = new Float32Array(mw * mh);
    for (let y = topY; y <= botY; y++) for (let x = bb.minX; x <= bb.maxX; x++) {
      const idx = y * mw + x;
      if (mask[idx] > EYE_MASK_THRESH) continue;   // 눈알(흰자/홍채) 제외
      roi[idx] = 1;                                 // 눈꺼풀/언더(주변)만
    }
    return roi;
  }

  // [T-153] 눈밑/눈가 ROI(0~1 falloff) = eyeMask bbox 아래(언더아이) 확장 − 눈알.
  //   중심(눈 바로 아래) 1.0, 아래·옆으로 갈수록 0 → 광대/얼굴 번짐 방지. eyeShadow/underEyeClean 공용.
  function _eyeUnderROI(mask, mw, mh) {
    const bb = _eyeBBox(mask, mw, mh);
    if (!bb) return null;
    const topY = Math.floor(bb.maxY - bb.h * 0.15);          // 눈 하단부터
    const botY = Math.min(mh - 1, Math.ceil(bb.maxY + bb.h * 0.9));  // 아래로 0.9×h
    const cx = (bb.minX + bb.maxX) / 2, halfW = Math.max(1, (bb.maxX - bb.minX) / 2);
    const span = Math.max(1, botY - topY);
    const roi = new Float32Array(mw * mh);
    for (let y = topY; y <= botY; y++) {
      const vf = 1 - Math.max(0, (y - topY) / span);          // 세로 falloff(눈에 가까울수록 강)
      for (let x = bb.minX; x <= bb.maxX; x++) {
        const idx = y * mw + x;
        if (mask[idx] > EYE_MASK_THRESH) continue;            // 눈알 제외
        const hf = 1 - Math.min(1, Math.abs(x - cx) / halfW); // 가로 falloff(중앙 강)
        const w = vf * Math.max(0.25, hf);
        if (w > roi[idx]) roi[idx] = w;
      }
    }
    return roi;
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
      || b.hairVolume || b.hairEndsClean || b.hairFull);
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
      hairFullK: (b.hairFull || 0) / 100,   // [v537] 헤어 풍성하게 — 볼륨(입체)과 구분되는 밀도/숱 착시
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
      r, g, bl, lum0, ny,                                // [T-140] ny = 세로 정규화 위치 (뿌리/상단 lift 용)
      hasHairMask: !!(useM && useM.hairMask),             // [T-140/141] hairMask 실제 연결 여부 (fallback 분기)
      hasBoundaryMask: !!(useM && useM.hairBoundaryMask), // [T-140/141] 경계 band 마스크 연결 여부
      hasEyeMask: !!(useM && useM.eyeMask),               // [T-142] eyeMask 연결 시 catchLight 는 합성으로 대체
      hasLipMask: !!(useM && useM.lipMask),               // [T-145] lipMask 연결 시 색게이트 완화 + 발색 강화
      hasNailMask: !!(useM && useM.nailMask),             // [PE-2] nailMask 연결 시 nailGloss 풀강도, 없으면 안전 fallback
      hasScleraMask: !!(useM && useM.scleraMask),         // [PE-M1] scleraMask 연결 시 eyeRedness 영역 게이트로 사용
      scleraW: _rm('scleraMask', 0),                      // [PE-M1] 흰자 마스크 가중 (미연결 시 0 — _applyEye 가 eyeW 폴백)
      skinW: _rm('skinMask', mask ? mask.skin : (isSkin ? 1 : 0)),
      hairW: _rm('hairMask', mask ? mask.hair : (hairLike ? 1 : 0)),
      eyeW:  _rm('eyeMask',  mask ? mask.eye : (ny > 0.30 && ny < 0.48 && lum0 < 140 ? 0.2 : 0)),
      lipW:  _rm('lipMask', 1),                          // lipMask 없으면 1 (기존 색 기반 검출 유지)
      boundaryW: _rm('hairBoundaryMask', 0),             // 없으면 0 → hairEnd 는 hairW fallback
      hairOuterW: (regionMasks && regionMasks._hairOuterBand) ? (regionMasks._hairOuterBand[midx] || 0) : -1,  // [T-141] erosion 외곽 띠(1=외곽, 0=본체, -1=마스크없음)
      eyeLidW: (regionMasks && regionMasks._eyeLidROI) ? (regionMasks._eyeLidROI[midx] || 0) : 0,  // [T-146] 눈꺼풀/언더 ROI
      eyeUnderW: (regionMasks && regionMasks._eyeUnderROI) ? (regionMasks._eyeUnderROI[midx] || 0) : 0,  // [T-153] 눈밑/눈가 ROI(falloff)
      satCh: hairSat0,                                   // [T-146] 채도(max-min) — 색 있는 곳만 eyeColor 적용
      nailW: _nailBlend(useM, sc, midx, mask ? mask.nail : _nailWeight(lum0, hairSat0, subjectW, edgeBg, isSkin)), // v350 nailMask 안전 조건부 (미연결 시 v348 휴리스틱 동일)
      redW: mask ? mask.redness : (isReddish ? 1 : 0),
    };
  }

  function _applyEye(d, i, p, c) {
    // [PE-ER3] eyeRedness — 2차 hard gate(skinW<0.35 등)가 흰자 오분류 시 기능을 죽여 no-op이 됨.
    //   hard cutoff 대신 sclera-like soft weight(밝음·중성·저채도·비피부 penalty·warm제외)로 강도 조절.
    //   흰자/충혈엔 약하게라도 적용, 눈썹/갈색 눈가는 weight≈0. 계수/방향 유지.
    // [PE-M1] scleraMask 연결 시 영역 게이트를 eyeW→scleraW 로 정밀화. 아래 색 refine(bright/neutral/sat/
    //   skinPenalty/warmBrown)은 그대로 유지 — 마스크는 영역만 좁힘, 내부 강제 적용 아님(청록 재발 방지).
    const regionW = p.hasScleraMask ? p.scleraW : p.eyeW;
    if (c.eyeRedK > 0 && regionW > 0.10) {
      const chSpan = Math.max(p.r, p.g, p.bl) - Math.min(p.r, p.g, p.bl);
      const warmBrown = (p.r - p.g > 18 && p.r - p.bl > 28);
      const brightW = Math.min(1, Math.max(0, (p.lum0 - 135) / 45));
      const neutralW = Math.min(1, Math.max(0, (42 - chSpan) / 22));
      const satW = Math.min(1, Math.max(0, (48 - p.satCh) / 28));
      const skinPenalty = p.skinW > 0.70 ? 0.2 : (p.skinW > 0.35 ? 0.45 : 1);   // [PE-ER4] 흰자 skin 오분류(>0.70) no-op 방지 — 0→0.2 (warm/neutral 가중이 갈색 청록 재발은 계속 차단)
      const scleraW = brightW * neutralW * satW * skinPenalty * (warmBrown ? 0 : 1);
      if (scleraW > 0.08 && p.r > p.g + 3 && p.r > p.bl + 1) {
        const k = c.eyeRedK * regionW * scleraW;
        d[i] = _clamp(d[i] - 52 * k);
        d[i + 1] = _clamp(d[i + 1] + 12 * k);
        d[i + 2] = _clamp(d[i + 2] + 16 * k);
      }
    }
    if (c.irisK > 0 && p.eyeW > 0.14 && p.lum0 > 16 && p.lum0 < 135 && p.skinW < 0.55) {
      _contrastFromLum(d, i, p.lum0, 1 + 0.75 * c.irisK * p.eyeW, 0);
    }
    // [T-142] eyeMask 있으면 catchLight 는 루프 후 _drawCatchlight 합성으로 대체(여기선 스킵).
    //   eyeMask 없을 때만 기존 "밝은 픽셀 강조" fallback 유지(과장 금지 — 기존 강도 그대로).
    if (c.catchK > 0 && !p.hasEyeMask && p.eyeW > 0.06 && p.lum0 > 155 && Math.max(p.r, p.g, p.bl) - Math.min(p.r, p.g, p.bl) < 65) {
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
    // [PE-TONE] redness — 피부 전체 일괄(redW 0/1·계수 48)로 회색/초록 시체톤 되던 문제.
    //   실제 붉은 정도(redExcess) 비례 + 계수 48→26 + 입술/눈/머리 제외 → 진짜 붉은 픽셀만 보정.
    if (c.redK > 0 && p.skinW > 0.10 && p.eyeW < 0.12 && p.hairW < 0.5) {
      const redExcess = Math.min(1, Math.max(0, ((p.r - Math.max(p.g, p.bl)) - 18) / 40));   // 0~1 graded
      const lipGuard = (p.hasLipMask && p.lipW > 0.20) || (p.satCh > 70 && p.r > p.g + 40);   // 입술/진한 적색 메이크업 보존
      const rw = redExcess * (p.redW > 0.14 ? 1 : 0.25);                                      // redW 없으면 fallback 약하게(0.25)
      const k = lipGuard ? 0 : c.redK * rw;
      if (k > 0) {
        d[i] = _clamp(d[i] - 26 * k);
        d[i + 1] = _clamp(d[i + 1] + 5 * k);
        d[i + 2] = _clamp(d[i + 2] + 6 * k);
      }
    }
    // [PE-TONE] yellowness — skinW 균일(계수 -26G/+20B)로 보라/분홍 마스크 되던 문제.
    //   실제 노란 정도(yelExcess) 비례 + 계수 하향 + hue 안전장치(B는 R 넘지 않음) → 노란 피부만 보정.
    if (c.yelK > 0 && p.skinW > 0.10 && p.eyeW < 0.12 && p.hairW < 0.5 && p.r > 72) {
      const lipGuardY = (p.hasLipMask && p.lipW > 0.20) || (p.satCh > 70 && p.r > p.g + 40);
      const yelExcess = Math.min(1, Math.max(0, ((p.g - p.bl) - 8) / 28));                    // 0~1 graded
      const ky = lipGuardY ? 0 : c.yelK * p.skinW * yelExcess;
      if (ky > 0) {
        const nb = _clamp(d[i + 2] + 10 * ky);                                                // B 증가 20→10
        d[i] = _clamp(d[i] - 4 * ky);
        d[i + 1] = _clamp(d[i + 1] - 13 * ky);                                                // G 감소 26→13
        d[i + 2] = Math.min(nb, d[i] - 4);                                                    // hue 안전: B ≤ R-4 (보라/분홍 차단)
      }
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

  function _applySkinTexture(d, i, p, c, blurD, wideBlurD) {
    if (p.skinW <= 0.10) return;
    // [T-152] textureSmooth — edge-preserving. 평탄한 피부(모공/결, lum 차 작음)만 블러, 눈/입/윤곽
    //   edge(blurD 와 lum 차 큼)는 보존 → 플라스틱 방지. 강도 0.65→0.55(보수적).
    if (c.txK > 0 && blurD) {
      const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      const blum = blurD[i] * 0.299 + blurD[i + 1] * 0.587 + blurD[i + 2] * 0.114;
      const edge = Math.min(1, Math.abs(lum - blum) / TEXTURE_EDGE_TAU);   // 0(평탄)~1(edge)
      const mix = 0.55 * c.txK * p.skinW * (1 - edge);                     // edge 일수록 블러 0
      if (mix > 0.001) _mixBlur(d, i, blurD, mix, 0);
    }
    // [T-151] blemish — 작은 잡티(넓은블러=주변 피부톤보다 어두운 작은 점)만 주변톤으로 blend(inpaint-like).
    //   흐림 아닌 "주변 피부색 채움". 밝은 점·큰 음영·윤곽은 제외(피부결 보존). 큰 점/흉터 완전제거는 목표 아님.
    if (c.blemishK > 0 && wideBlurD) {
      const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      const wlum = wideBlurD[i] * 0.299 + wideBlurD[i + 1] * 0.587 + wideBlurD[i + 2] * 0.114;
      const dark = wlum - lum;                                   // 주변 피부톤보다 어두운 정도
      // 잡티 = 주변보다 "약간" 어두운(TAU~MAX) 피부톤 점. 속눈썹/눈썹/머리(매우 어두움 or lum 낮음) 제외 → 눈 오염 방지.
      if (dark > BLEMISH_DARK_TAU && dark < BLEMISH_DARK_MAX && lum > BLEMISH_LUM_MIN && p.eyeW < 0.12) {
        const spotW = Math.min(1, (dark - BLEMISH_DARK_TAU) / 30);
        _mixBlur(d, i, wideBlurD, BLEMISH_BLEND * c.blemishK * p.skinW * spotW, 0);  // 주변 피부톤으로 채움
      }
    }
    // [T-153] eyeShadow/underEyeClean — eyeMask 언더 ROI(falloff)의 어두운 픽셀만 밝힘 → 눈밑/눈가만,
    //   얼굴 전체 X. eyeMask 없으면 기존보다 약한 fallback(얼굴 전체 어두운 곳).
    if (c.eyeShK > 0 || c.underK > 0) {
      const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      const strength = c.eyeShK + c.underK;                      // 두 슬라이더 합산(같은 눈밑/눈가 다크 완화)
      if (p.hasEyeMask) {
        const uw = p.eyeUnderW || 0;
        if (uw > 0.05 && lum < 175 && p.skinW > 0.10) {
          const dk = (175 - lum) / 175;                          // 어두울수록 강하게
          const k = strength * uw * p.skinW * dk;
          _add(d, i, 24 * k, 21 * k, 16 * k);                    // skin tone(R>G>B) 보정 밝힘
        }
      } else {
        // fallback (eyeMask 없음) — 얼굴 전체 어두운 곳, 기존보다 약하게(22→13)
        if (lum < 145) { const w2 = (145 - lum) / 145; const k = strength * w2 * p.skinW * 0.55; _add(d, i, 24 * k, 21 * k, 16 * k); }
      }
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
    // [T-140] 머리 풍성감 — 색만 변하지 않게 "볼륨 착시" 강화.
    //   ① 경계 band(boundaryW) ∩ 머리쪽(hairW) 에 rim highlight(명부)/depth shadow(암부) → 외곽 입체.
    //   ② 상단/뿌리(ny<ROOT_TOP) 머리에 약한 lift → 정수리 풍성.
    //   ③ 기존 명암 contrast 는 보조로 절반 이하. 배경(hairW 낮음)·얼굴(skinW)은 가드로 제외.
    if (c.hairVolK > 0) {
      _contrastFromLum(d, i, p.lum0, 1 + HAIR_VOL_CONTRAST * c.hairVolK * p.hairW, 0);
      // rim/뿌리 효과는 hairMask 가 실제 연결됐을 때만(색기반 휴리스틱 오검출로 배경 안 건드림).
      //   [얼굴 가드 강화] skinW<0.25 (기존 0.35) — 머리카락-얼굴 경계 침범 축소.
      if (p.hasHairMask && p.skinW < 0.25 && p.hairW > 0.25) {
        // 경계 가중 edgeW: boundaryMask 가 또렷하면 그대로, WEAK/없으면 hairW 중간대역(0.5 근처
        //   = 머리↔배경 전이 = 경계 근사)으로 보강. 배경(hairW<0.25)은 위 게이트로 제외.
        const bw = p.boundaryW || 0;
        let edgeW = (p.hasBoundaryMask && bw > 0.12) ? bw : 0;
        if (edgeW < 0.12 && p.hairW < 0.8) {
          edgeW = HAIR_VOL_WEAK_RIM * Math.max(0, 1 - Math.abs(p.hairW - 0.5) / 0.3);  // hairW 0.5 근처 최대
        }
        if (edgeW > 0.06) {
          const rim = c.hairVolK * edgeW;
          if (p.lum0 > HAIR_VOL_RIM_LUM) _add(d, i, HAIR_VOL_RIM_HI * rim, HAIR_VOL_RIM_HI * rim, HAIR_VOL_RIM_HI * rim * 0.9);
          else _add(d, i, -HAIR_VOL_RIM_LO * rim, -HAIR_VOL_RIM_LO * rim, -HAIR_VOL_RIM_LO * rim);
        }
        // 상단/뿌리 lift — 정수리 풍성 (머리 본체 위쪽)
        if (p.ny != null && p.ny < HAIR_VOL_ROOT_TOP && p.hairW > 0.4) {
          const rootW = c.hairVolK * p.hairW * (1 - p.ny / HAIR_VOL_ROOT_TOP);
          _add(d, i, HAIR_VOL_ROOT_LIFT * rootW, HAIR_VOL_ROOT_LIFT * rootW, HAIR_VOL_ROOT_LIFT * rootW * 0.9);
        }
      }
    }
    // [v537] hairFull 헤어 풍성하게 — 마스크 없이도(hairW) 숱·밀도 착시. 볼륨(rim)과 독립.
    if (c.hairFullK > 0) {
      const fk = c.hairFullK * p.hairW;
      // ① 가닥 분리 contrast(머리 본체)
      _contrastFromLum(d, i, p.lum0, 1 + HAIR_FULL_CONTRAST * fk, 0);
      // ② 상단/뿌리 넓은 lift — 정수리/가르마 숱(skin 영역 제외로 이마 침범 방지)
      if (p.ny != null && p.ny < HAIR_FULL_ROOT_TOP && p.hairW > 0.3 && p.skinW < 0.3) {
        const rootW = c.hairFullK * p.hairW * (1 - p.ny / HAIR_FULL_ROOT_TOP);
        _add(d, i, HAIR_FULL_ROOT_LIFT * rootW, HAIR_FULL_ROOT_LIFT * rootW, HAIR_FULL_ROOT_LIFT * rootW * 0.92);
      }
      // ③ 머리 속 밝은 빈틈(두피 비침/성긴 부분)을 머리톤 쪽으로 채움(darken) — 숱 많아 보이게
      if (p.lum0 > HAIR_FULL_FILL_LUM && p.lum0 < 235 && p.hairW > 0.35 && p.skinW < 0.25) {
        const fillW = fk * Math.min(1, (p.lum0 - HAIR_FULL_FILL_LUM) / 70);
        _add(d, i, -HAIR_FULL_FILL * fillW, -HAIR_FULL_FILL * fillW, -HAIR_FULL_FILL * fillW);
      }
    }
    // [T-141 재구현] 머리끝/잔머리 정리 — hairMask erosion 외곽 띠(hairOuterW)에서만 soften.
    //   eroded 내부 본체/가닥/웨이브는 hairOuterW=0 → 절대 미접촉(본체 디테일 보존).
    //   hairOuterW: 1=외곽 띠, 0=본체, -1=hairMask 없음(약한 fallback).
    if (c.hairEndK > 0 && blurD) {
      if (p.hairOuterW > 0.5) {
        // 진짜 외곽 띠만 — 배경 방향 soften (부스스함 정돈)
        _mixBlur(d, i, blurD, HAIR_ENDS_MIX * c.hairEndK, p.lum0 < 90 ? 6 * c.hairEndK : 0);
      } else if (p.hairOuterW < 0 && !p.hasHairMask) {
        // hairMask 없음 → 약한 hairW fallback (과장 금지, 본체 과블러 방지)
        _mixBlur(d, i, blurD, HAIR_ENDS_FALLBACK * c.hairEndK * p.hairW, 0);
      }
      // hairOuterW===0 (본체) → 미접촉
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
    // [PE-2] nailMask 있으면 기존(임계 0.12·풀강도), 없으면 안전 fallback(임계 0.35·강도 0.5)
    //   → 마스크/저신뢰 시 매끈·밝은 손/배경/소매에 광택 번지던 문제 차단. 확실한 네일 후보는 유지.
    if (c.nailK > 0) {
      const nthr = p.hasNailMask ? 0.12 : 0.45;
      const nconf = p.hasNailMask ? 1 : 0.4;
      if (p.nailW > nthr) {
        const gw = c.nailK * p.nailW * nconf;
        const spec = p.lum0 > 195 ? Math.min(1, (p.lum0 - 195) / 55) : 0;
        const add = (NAIL_GLOSS_BASE + NAIL_GLOSS_SPEC * spec) * gw;
        _add(d, i, add, add, add * 1.04);   // 하이라이트 살짝 차갑게(파랑 +4%) = 유리질 광택감
      }
    }
    // [T-145] lipPop 입술 발색 — lipMask(max≈0.82) 있으면 ROI 한정 + 색게이트 완화로 누드/연한 입술도
    //   발색. 채도/value 강화 + 약한 gloss. 치아(흰색 r≈g≈b)·피부는 lipMask/색게이트로 제외.
    if (c.lipK > 0) {
      let inLip, lw;
      if (p.hasLipMask) { inLip = p.lipW > 0.20; lw = Math.min(1, p.lipW * 1.4); }     // 마스크 영역 — 색게이트 불필요
      else { inLip = (p.r > p.g + 10 && p.r > p.bl + 10); lw = 1; }                    // 마스크 없음 — 기존 색 검출
      if (inLip && p.lum0 > 45 && p.lum0 < 220) {
        const lk = c.lipK * lw;
        _add(d, i, 30 * lk, -8 * lk, -5 * lk);                                         // 붉은 발색
        d[i] = _clamp(d[i] + (p.r - p.lum0) * 0.45 * lk);                              // 채도(발색) 강화
        if (p.lum0 > 155) { const g = 12 * lk * ((p.lum0 - 155) / 65); _add(d, i, g, g, g * 1.02); }  // 약한 gloss
      }
    }
    // [T-146] eyeColor 아이 색감 — 눈꺼풀/언더 ROI(eyeLidW)의 "색 있는 곳(채도>SAT_MIN)"만 채도 강화.
    //   무채색 맨피부는 satCh 작아 거의 무효 → 피부 오염 방지. 눈알(흰자/홍채)은 ROI 에서 제외됨.
    if (c.eyeK > 0) {
      if (p.eyeLidW > 0.5 && p.satCh > EYE_COLOR_SAT_MIN && p.lum0 > 30 && p.lum0 < 225) {
        const ek = c.eyeK * Math.min(1, (p.satCh - EYE_COLOR_SAT_MIN) / 70);   // 채도 클수록 강하게
        d[i] = _clamp(p.r + (p.r - p.lum0) * 0.5 * ek);                         // [조정] 0.7→0.5
        d[i + 1] = _clamp(p.g + (p.g - p.lum0) * 0.5 * ek);
        d[i + 2] = _clamp(p.bl + (p.bl - p.lum0) * 0.5 * ek);
      } else if (!p.hasEyeMask && p.eyeW > 0.10 && p.lum0 < 100) {
        // eyeMask 없을 때만 기존 색기반 fallback(어두운 눈 영역)
        d[i] = _clamp(d[i] + (p.r - p.lum0) * 0.9 * c.eyeK * p.eyeW);
        d[i + 1] = _clamp(d[i + 1] + (p.g - p.lum0) * 0.9 * c.eyeK * p.eyeW);
        d[i + 2] = _clamp(d[i + 2] + (p.bl - p.lum0) * 0.9 * c.eyeK * p.eyeW);
      }
    }
    // [PE-3] hairyArm(팔/다리 톤 보정) — hard cutoff lum<140 이 밝은 팔/손 피부를 전부 제외해 no-op 이던 문제.
    //   falloff 가중으로 변경: 전 피부(lum<215)에 적용하되 어두운 부위 강·밝은 부위 약(최소 0.35) → 과미백 방지.
    //   방향(밝게/약warm)·계수(16/14/10)·skinW 게이트 유지. 털/선 강조 아님(per-pixel 톤).
    if (c.armK > 0 && p.skinW > 0.10 && p.lum0 < 215) {
      const armW = c.armK * p.skinW * Math.min(1, Math.max(0.35, (205 - p.lum0) / 130));
      _add(d, i, 16 * armW, 14 * armW, 10 * armW);
    }
  }

  // v317 — 영역 한정 unsharp (lashSharp 용). mask>임계 픽셀만 샤픈, 나머지는 원본 유지.
  //   mask 는 원본(mw×mh) 해상도 → 캔버스(w×h) 좌표 환산 + 경계 clamp (v340 정합과 동일 규칙).
  function _unsharpMaskRegion(ctx, w, h, strength, mask, scale, mw, mh, maxS, minW) {
    try {
      strength = Math.min(Math.max(strength || 0, 0), maxS || 0.6);   // [T-144] maxS 로 상한 조정(기본 0.6)
      const mw0 = minW || 0.01;                                       // [T-144] mask 가중 하한 — 이하 픽셀은 미적용(손가락 살 제외)
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
        if (mwgt <= mw0) {
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

  // [T-143] ROI 내부 "어두운 선"(속눈썹/눈 위 라인)만 약하게 darken → 라인이 진해 보임.
  //   밝은 픽셀(피부/흰자)은 안 건드림 → 노이즈/거칠어짐 방지. mask>임계 & 주변보다 어두운 픽셀만.
  function _darkenRegionDarkLines(ctx, w, h, strength, mask, mw, mh, mthresh) {
    try {
      const th = mthresh || 0.25;                                  // [T-144] nail 은 0.55(확실한 손톱면만 → 손가락 살 제외)
      const src = ctx.getImageData(0, 0, w, h);
      const d = src.data, same = (mw === w && mh === h);
      for (let idx = 0; idx < w * h; idx++) {
        const i = idx << 2;
        let midx;
        if (same) midx = idx; else { const x = idx % w, y = (idx / w) | 0; midx = Math.min(mh - 1, (y * mh / h) | 0) * mw + Math.min(mw - 1, (x * mw / w) | 0); }
        const m = mask[midx] || 0;
        if (m <= th) continue;                                     // ROI 밖
        const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        if (lum >= 150) continue;                                  // 밝은 피부/흰자 제외 — 어두운 선만
        const dk = strength * m * (1 - lum / 150);                 // 어두울수록 더 진하게
        d[i] = _clamp(d[i] * (1 - dk)); d[i + 1] = _clamp(d[i + 1] * (1 - dk)); d[i + 2] = _clamp(d[i + 2] * (1 - dk));
      }
      ctx.putImageData(src, 0, 0);
    } catch (_e) { void _e; }
  }

  function _applySharpen(ctx, w, h, b, regionMasks, nailMaskArr) {
    // [PE-5] hairDetail(머리결 선명) — hairMask 있으면 머리 영역만 샤픈, 없으면 배경/얼굴/옷 오염 줄이려 약화 전역.
    if (b.hairDetail > 10) {
      const hm = regionMasks && regionMasks.useMasks && regionMasks.useMasks.hairMask;
      const mw = (regionMasks && regionMasks.maskW) || w, mh = (regionMasks && regionMasks.maskH) || h;
      if (hm) _unsharpMaskRegion(ctx, w, h, b.hairDetail / 150, hm, (regionMasks._scale && regionMasks._scale.hairMask) || 1, mw, mh);
      else _unsharpMask(ctx, w, h, b.hairDetail / 300);   // 약화 전역(기존 150 → 300)
    }
    if (b.hairVolume > 10) _unsharpMask(ctx, w, h, b.hairVolume / 260);
    // [T-143] lashSharp: lashMask(밴드) 우선 → 없으면 eyeMask 상단 ROI → 둘 다 없으면 약화된 전역.
    //   전역 샤픈(사진 전체)으로 빠지던 문제 해소: eyeMask 만 있어도 눈 위 라인만 샤픈.
    if (b.lashSharp > 10) {
      const lm = regionMasks && regionMasks.lashMask;
      const em = regionMasks && regionMasks.useMasks && regionMasks.useMasks.eyeMask;
      const mw = (regionMasks && regionMasks.maskW) || w, mh = (regionMasks && regionMasks.maskH) || h;
      const dk = LASH_DARKEN * Math.min(1, b.lashSharp / 100);      // 어두운 선 darken 강도
      if (lm) {
        _unsharpMaskRegion(ctx, w, h, b.lashSharp / 65, lm, regionMasks.lashScale || 1, mw, mh);
        _darkenRegionDarkLines(ctx, w, h, dk, lm, mw, mh);
      } else if (em) {
        const roi = _eyeUpperROI(em, mw, mh);                       // eyeMask bbox 상단 ROI
        if (roi) { _unsharpMaskRegion(ctx, w, h, b.lashSharp / 65, roi, 1, mw, mh); _darkenRegionDarkLines(ctx, w, h, dk, roi, mw, mh); }
        else _unsharpMask(ctx, w, h, b.lashSharp / LASH_GLOBAL_FALLBACK);
      } else {
        _unsharpMask(ctx, w, h, b.lashSharp / LASH_GLOBAL_FALLBACK);  // 약화된 전역(기존 65→120)
      }
    }
    // [PE-5] closeUpDetail(전역 선명도) — divisor 80 은 strength≈48 부터 0.6 clamp 라 50/100 동일했음.
    //   167 로 조정 → 0~100 이 0~0.6 선형(50≈0.30 < 100≈0.60), @100 최대치는 기존(0.6)과 동일.
    if (b.closeUpDetail > 10) _unsharpMask(ctx, w, h, b.closeUpDetail / 167);
    if (b.irisClear > 10) _unsharpMask(ctx, w, h, b.irisClear / 130);
    // [PE-5] browSharp(눈썹 포함 선명) — eyeMask 상단 ROI(눈/눈썹 라인) 있으면 그 영역만 샤픈.
    //   눈/눈썹 ROI 없으면(예: 헤어 뒷모습) 거의 no-op(매우 약한 전역) → hairDetail 처럼 전역 샤픈되지 않게.
    if (b.browSharp > 10) {
      const bm = regionMasks && regionMasks.browMask;                                                      // [PE-M2] 눈썹 마스크 있으면 우선
      const em = regionMasks && regionMasks.useMasks && regionMasks.useMasks.eyeMask;
      const mw = (regionMasks && regionMasks.maskW) || w, mh = (regionMasks && regionMasks.maskH) || h;
      if (bm) _unsharpMaskRegion(ctx, w, h, b.browSharp / 90, bm, regionMasks.browScale || 1, mw, mh);      // [PE-M2] browMask ROI 만 샤픈(계수 동일)
      else {                                                                                               // [PE-M2] browMask 없음 → 기존 eyeMask 상단 ROI → 약한 전역 fallback 그대로
        const roi = em ? _eyeUpperROI(em, mw, mh) : null;
        if (roi) _unsharpMaskRegion(ctx, w, h, b.browSharp / 90, roi, 1, mw, mh);
        else _unsharpMask(ctx, w, h, b.browSharp / 400);   // 거의 no-op(기존 90 → 400)
      }
    }
    // [T-144] nailShape: nailW(휴리스틱/마스크) 영역만 강하게 경계 샤픈 → 젤 컬러·아트 라인·경계 또렷.
    //   nailMaskArr 는 no-hand 여도 _nailWeight 휴리스틱(폴리시 색/광택/밝기)으로 채워짐 → 손/배경 제외.
    //   maxS 2.0 으로 unsharp 상한 상향(기존 clamp 0.6 은 k=1.3 으로 약했음). 전역 fallback 은 매우 약화.
    if (b.nailShape > 10) {
      if (nailMaskArr) {
        // [2차→롤백+게이트] darken/과샤픈은 글리터 네일에서 손가락 살 침범(fingerSkin>nailEdge) → 제거.
        //   nailW 가 충분히 높은(손톱면 확실) 픽셀만 darken 하도록 _darkenRegionDarkLines 임계를 nailW 로 상향.
        // [2차 안전] unsharp 은 nailW>0.4(확실 손톱면)만 → 누드/글리터에서 손가락 살(nailW 낮음) 침범 차단.
        //   darken 도 nailW>0.55. 색 뚜렷한 네일은 손톱 nailW 높아 작동, 누드/글리터는 약효지만 침범 없음(nailGloss 가 반짝 담당).
        _unsharpMaskRegion(ctx, w, h, b.nailShape / 55, nailMaskArr, 1, w, h, 1.6, 0.4);
        _darkenRegionDarkLines(ctx, w, h, NAIL_SHAPE_DARKEN * Math.min(1, b.nailShape / 100), nailMaskArr, w, h, 0.55);
      } else _unsharpMask(ctx, w, h, b.nailShape / 200);   // nailW 수집 안 됨 → 거의 no-op(전역 샤픈 회피)
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
    // [T-151] blemish 용 넓은 블러(주변 피부톤 추정, r≈6). blemishK>0 일 때만 1패스.
    let wideBlurD = null;
    if (c.blemishK > 0) { try { wideBlurD = _boxBlur(data, w, h, 6).data; } catch (_e) { wideBlurD = null; } }
    // [T-141 재구현] hairEndsClean 외곽 띠 1회 생성(hairMask erosion). 본체/내부가닥은 띠에서 빠짐.
    //   regionMasks._hairOuterBand 에 붙여 _pixel 에서 lookup. hairMask 없으면 null → 약한 fallback.
    if (regionMasks && regionMasks.useMasks && regionMasks.useMasks.hairMask && c.hairEndK > 0) {
      try {
        const hm = regionMasks.useMasks.hairMask;
        const mw = regionMasks.maskW || w, mh = regionMasks.maskH || h;
        const r = Math.max(2, Math.round(Math.min(mw, mh) * 0.015));   // 외곽 띠 두께 ≈ 1.5%
        regionMasks._hairOuterBand = _hairOuterBand(hm, mw, mh, r);
      } catch (_e) { regionMasks._hairOuterBand = null; }
    } else if (regionMasks) { regionMasks._hairOuterBand = null; }
    // [T-146] eyeColor 눈꺼풀/언더 ROI 1회 생성(eyeMask bbox 확장 − 눈알). regionMasks._eyeLidROI.
    if (regionMasks && regionMasks.useMasks && regionMasks.useMasks.eyeMask && c.eyeK > 0) {
      try { regionMasks._eyeLidROI = _eyeLidROI(regionMasks.useMasks.eyeMask, regionMasks.maskW || w, regionMasks.maskH || h); }
      catch (_e) { regionMasks._eyeLidROI = null; }
    } else if (regionMasks) { regionMasks._eyeLidROI = null; }
    // [T-153] eyeShadow/underEyeClean 눈밑/눈가 ROI 1회 생성(eyeMask bbox 아래 falloff − 눈알).
    if (regionMasks && regionMasks.useMasks && regionMasks.useMasks.eyeMask && (c.eyeShK > 0 || c.underK > 0)) {
      try { regionMasks._eyeUnderROI = _eyeUnderROI(regionMasks.useMasks.eyeMask, regionMasks.maskW || w, regionMasks.maskH || h); }
      catch (_e) { regionMasks._eyeUnderROI = null; }
    } else if (regionMasks) { regionMasks._eyeUnderROI = null; }
    // v348 — nailShape 를 nailW 영역만 샤픈하기 위해 픽셀 walk 중 네일 가중치 수집
    let nailMaskArr = null;
    if (b.nailShape > 10) { try { nailMaskArr = new Float32Array(w * h); } catch (_e) { nailMaskArr = null; } }
    for (let i = 0; i < d.length; i += 4) {
      const p = _pixel(d, i, w, h, window.PhotoEditorSmartMask, regionMasks);
      if (nailMaskArr) nailMaskArr[i >> 2] = p.nailW;
      _applyEye(d, i, p, c);
      _applySkinTone(d, i, p, c);
      _applySkinTexture(d, i, p, c, blurD, wideBlurD);
      _applyHair(d, i, p, c, blurD);
      _applyDetail(d, i, p, c);
    }
    ctx.putImageData(data, 0, 0);
    // [T-142] catchLight 합성 — eyeMask 있을 때 좌/우 눈동자 근처에 작은 하이라이트(생기).
    //   eyeMask 없으면 _applyEye 의 fallback(밝은 픽셀 강조)이 이미 처리됨.
    if (c.catchK > 0 && regionMasks && regionMasks.useMasks && regionMasks.useMasks.eyeMask) {
      try {
        _drawCatchlight(ctx, w, h, regionMasks.useMasks.eyeMask, regionMasks.maskW || w, regionMasks.maskH || h, CATCH_OPACITY * c.catchK);
      } catch (_e) { void _e; }
    }
    _applySharpen(ctx, w, h, b, regionMasks, nailMaskArr);
  }

  window.PhotoEditorBeautyEngine = { apply };
})();
