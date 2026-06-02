/* 사진편집 효과 DevTools 검증 디버그 모듈 (런타임 미수정 — 측정 전용, 실사진 0)
   window.PhotoEffectDebug 로 노출. beauty-engine.apply 를 합성 캔버스에 강도별로 돌려
   before/after pixel diff · ROI 안/밖 변화량 · 방향성 · monotonic · 기능명-효과 정합을 계측.

   사용(DevTools):
     PhotoEffectDebug.runOne('redness', { strength: 80 })
     PhotoEffectDebug.runAll()
     PhotoEffectDebug.comparePreset('promo_nail')
     PhotoEffectDebug.exportReport()

   엔진/라벨/라우팅은 절대 수정하지 않음. 마스크 없이(regionMasks=null) 휴리스틱 경로를 검증. */
(function () {
  'use strict';
  if (window.PhotoEffectDebug) return;

  var W = 256, H = 256;

  // ── 합성 이미지 5종 (코드 생성) — 각 ROI 는 ground-truth 사각형 ──
  function _base(ctx) {                       // 비피부 배경(오염 측정용) — 텍스처 포함(샤픈 오염 감지)
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#c9ccd2'); g.addColorStop(1, '#aeb3bb');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    _noise(ctx, 0, 0, W, H, 9);               // 배경 고주파 — 전역 샤픈이 배경까지 먹는지 측정
  }
  function _noise(ctx, x, y, w, h, amp) {      // 결/디테일 — 의도적 고주파(샤픈/스무딩 측정용)
    var img = ctx.getImageData(x, y, w, h), d = img.data, seed = 7;
    for (var i = 0; i < d.length; i += 4) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      var n = ((seed % 100) - 50) / 50 * amp;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(img, x, y);
  }
  function _synth(kind) {
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d', { willReadFrequently: true });
    _base(ctx);
    var rois = {};
    if (kind === 'face') {
      ctx.fillStyle = '#ebc8b0'; ctx.fillRect(56, 40, 144, 180);          // 피부(lum≈210)
      rois.skin = { x: 56, y: 40, w: 144, h: 180 };
      _noise(ctx, 56, 40, 144, 180, 10);
      ctx.fillStyle = '#d0968e'; ctx.fillRect(66, 128, 28, 24);           // 붉은 볼(현실적 채도 — 입술 아님)
      rois.redCheek = { x: 66, y: 128, w: 28, h: 24 };
      // [v2] 잡티 — 주변 피부톤보다 ~25 어두운 옅은 점(엔진 BLEMISH_DARK 9~45 범위). 큰점/검정 제외 규칙 회피.
      ctx.fillStyle = '#c3a48f'; ctx.fillRect(150, 116, 6, 6); ctx.fillRect(120, 150, 6, 6); ctx.fillRect(96, 124, 5, 5);
      rois.blemishDot = { x: 92, y: 112, w: 70, h: 44 };
      ctx.fillStyle = '#3a2a22'; ctx.fillRect(92, 82, 28, 4); ctx.fillRect(140, 82, 28, 4);   // 눈썹
      rois.brow = { x: 92, y: 80, w: 76, h: 8 };
      // [v2] 눈 영역(eyeMask 주입용) — 흰자+홍채. _eyeUnderROI(눈 아래 falloff)가 눈밑 ROI 생성.
      ctx.fillStyle = '#f2efe9'; ctx.fillRect(96, 92, 64, 14);
      ctx.fillStyle = '#5a4030'; ctx.beginPath(); ctx.arc(128, 99, 7, 0, 7); ctx.fill();
      rois.eye = { x: 96, y: 92, w: 64, h: 14 };
      // [v2] 눈밑 그림자 — 어둡게(lum≈115<145) 해야 fallback/ROI 둘 다 발화
      ctx.fillStyle = '#876c60'; ctx.fillRect(96, 108, 28, 12); ctx.fillRect(132, 108, 28, 12);
      rois.underEye = { x: 96, y: 108, w: 64, h: 12 };
      ctx.fillStyle = '#b84a52'; ctx.fillRect(108, 184, 40, 14);          // 입술
      rois.lip = { x: 108, y: 184, w: 40, h: 14 };
      rois.subject = { x: 56, y: 40, w: 144, h: 180 };
    } else if (kind === 'nail') {
      ctx.fillStyle = '#d6ab8e'; ctx.fillRect(40, 60, 176, 150);          // 손 피부(현실적 톤 — 네일급 과밝음 아님)
      rois.handSkin = { x: 40, y: 60, w: 176, h: 150 };
      _noise(ctx, 40, 60, 176, 150, 8);
      var nailC = ['#e8c9b8', '#d8d2c8', '#b03a4a', '#caa0b0', '#7a6a60']; // 누드/무채/레드/글리터풍/다크
      rois.nail = { x: 60, y: 70, w: 136, h: 26 };
      for (var k = 0; k < 5; k++) { ctx.fillStyle = nailC[k]; ctx.fillRect(60 + k * 28, 70, 22, 26); }
      ctx.strokeStyle = '#5a4a42'; ctx.lineWidth = 1.5;                   // 아트/젤 경계 라인
      for (var n2 = 0; n2 < 5; n2++) ctx.strokeRect(60 + n2 * 28, 70, 22, 26);
      rois.nailEdge = { x: 60, y: 70, w: 136, h: 26 };
    } else if (kind === 'hair') {
      ctx.fillStyle = '#ebc8b0'; ctx.fillRect(96, 150, 64, 70);          // 얼굴(오염 체크)
      rois.face = { x: 96, y: 150, w: 64, h: 70 };
      ctx.fillStyle = '#4a3528'; ctx.fillRect(40, 20, 176, 140);         // 헤어 본체
      rois.hair = { x: 40, y: 20, w: 176, h: 140 };
      _noise(ctx, 40, 20, 176, 140, 14);                                 // 가닥
      rois.hairEnds = { x: 40, y: 140, w: 176, h: 24 };                  // 머리끝
      rois.scalp = { x: 96, y: 22, w: 64, h: 24 };                       // 두피 라인
    } else if (kind === 'eye') {
      ctx.fillStyle = '#ebc8b0'; ctx.fillRect(0, 0, W, H);               // 눈가 피부
      ctx.fillStyle = '#f2efe9'; ctx.fillRect(70, 110, 116, 44);        // 흰자
      rois.sclera = { x: 70, y: 110, w: 116, h: 44 };
      ctx.fillStyle = '#dccfc0'; ctx.fillRect(72, 112, 30, 18);          // 흰자 붉은기 시뮬(약한 R)
      ctx.fillStyle = '#6b4a30'; ctx.beginPath(); ctx.arc(128, 132, 22, 0, 7); ctx.fill(); // 홍채
      rois.iris = { x: 106, y: 110, w: 44, h: 44 };
      _noise(ctx, 106, 110, 44, 44, 10);
      ctx.fillStyle = '#2a1c14'; ctx.fillRect(70, 100, 116, 8);          // 속눈썹 라인
      rois.lashLine = { x: 70, y: 98, w: 116, h: 12 };
      rois.lid = { x: 70, y: 86, w: 116, h: 16 };                        // 눈꺼풀
    } else if (kind === 'arm') {
      ctx.fillStyle = '#c79878'; ctx.fillRect(30, 30, 196, 196);         // 팔 피부(약간 어둡/따뜻)
      rois.armSkin = { x: 30, y: 30, w: 196, h: 196 };
      _noise(ctx, 30, 30, 196, 196, 6);
      ctx.strokeStyle = '#6e5038'; ctx.lineWidth = 1;                    // 잔털 비슷한 어두운 선
      for (var a = 0; a < 14; a++) { ctx.beginPath(); ctx.moveTo(50 + a * 12, 60); ctx.lineTo(54 + a * 12, 110); ctx.stroke(); }
      rois.armHair = { x: 48, y: 58, w: 180, h: 56 };
      // [v2] 푸른기 도는 피부 패치 — isSkin(r-bl 5~120) ∧ coolness 게이트(bl>r-10 ∧ bl-g>5) 동시 충족
      ctx.fillStyle = '#a5969e'; ctx.fillRect(60, 150, 130, 60);         // (165,150,158)
      rois.coolPatch = { x: 60, y: 150, w: 130, h: 60 };
    }
    return { canvas: cv, ctx: ctx, rois: rois };
  }

  // ── param → 기대 사양(이미지/ROI/효과 종류/방향) — 기능명-효과 정합 기준 ──
  var SPEC = {
    skin:         { img: 'face', roi: 'skin',       kind: 'tone',     intent: '피부톤 정리' },
    redness:      { img: 'face', roi: 'redCheek',   kind: 'color', ch: 'R', sign: -1, intent: '붉은기(R) 완화' },
    yellowness:   { img: 'face', roi: 'skin',       kind: 'color', ch: 'RG', sign: -1, intent: '노란기 완화' },
    coolness:     { img: 'arm',  roi: 'coolPatch',  kind: 'color', ch: 'B', sign: -1, intent: '푸른기 완화(손)' },
    handSkin:     { img: 'nail', roi: 'handSkin',   kind: 'tone',     intent: '손/발 피부톤', pollutionRoi: 'nail' },
    blemish:      { img: 'face', roi: 'blemishDot', kind: 'smooth',   intent: '잡티 완화' },
    textureSmooth:{ img: 'face', roi: 'skin',       kind: 'smooth',   intent: '결 정리(자연)' },
    eyeShadow:    { img: 'face', roi: 'underEye',   kind: 'tone',     intent: '눈가 그림자 완화', useMask: 'eye' },
    underEyeClean:{ img: 'face', roi: 'underEye',   kind: 'tone',     intent: '눈밑 칙칙함 완화', useMask: 'eye' },
    eyeRedness:   { img: 'eye',  roi: 'sclera',     kind: 'color', ch: 'R', sign: -1, intent: '눈 붉음 완화' },
    irisClear:    { img: 'eye',  roi: 'iris',       kind: 'sharpen',  intent: '눈동자 또렷' },
    catchLight:   { img: 'eye',  roi: 'iris',       kind: 'bright',   intent: '눈빛 반짝임' },
    lashSharp:    { img: 'eye',  roi: 'lashLine',   kind: 'sharpen',  intent: '속눈썹 선명도' },
    closeUpDetail:{ img: 'face', roi: 'subject',    kind: 'sharpen',  intent: '전체 선명도(클로즈업)', global: true, pollutionRoi: '_bg' },
    browSharp:    { img: 'face', roi: 'brow',       kind: 'sharpen',  intent: '선명도(눈썹 포함)', global: true, pollutionRoi: '_bg' },
    lipPop:       { img: 'face', roi: 'lip',        kind: 'sat',      intent: '입술 발색' },
    eyeColor:     { img: 'eye',  roi: 'lid',        kind: 'any',      intent: '아이 색감' },
    hairShine:    { img: 'hair', roi: 'hair',       kind: 'bright',   intent: '모발 윤기' },
    hairVolume:   { img: 'hair', roi: 'hair',       kind: 'contrast', intent: '머리 풍성감' },
    hairEndsClean:{ img: 'hair', roi: 'hairEnds',   kind: 'any',      intent: '머리끝 정리' },
    hairDetail:   { img: 'hair', roi: 'hair',       kind: 'sharpen',  intent: '머리결 선명도(전체)', global: true, pollutionRoi: 'face' },
    hairColor:    { img: 'hair', roi: 'hair',       kind: 'color', ch: 'B', sign: -1, intent: '모발 색감' },
    hairColorPop: { img: 'hair', roi: 'hair',       kind: 'sat',      intent: '염색 컬러 강조' },
    scalpBoost:   { img: 'hair', roi: 'scalp',      kind: 'any',      intent: '두피 톤(풍성감)' },
    hairyArm:     { img: 'arm',  roi: 'armSkin',    kind: 'tone',     intent: '팔/다리 톤 보정', pollutionRoi: '_bg' },
    nailGloss:    { img: 'nail', roi: 'nail',       kind: 'bright',   intent: '네일 광택', pollutionRoi: 'handSkin' },
    nailShape:    { img: 'nail', roi: 'nailEdge',   kind: 'sharpen',  intent: '네일 경계 선명', pollutionRoi: 'handSkin' },
  };

  function _inRect(x, y, r) { return r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h; }
  function _lum(d, i) { return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; }
  function _sat(d, i) { var mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); return mx <= 0 ? 0 : (mx - mn) / mx; }

  // ROI 내부 grad energy(샤픈/스무딩 방향 판정) — |수평+수직 lum diff| 합 / 픽셀수
  function _gradEnergy(d, roi) {
    var sum = 0, n = 0;
    for (var y = roi.y; y < roi.y + roi.h - 1; y++) for (var x = roi.x; x < roi.x + roi.w - 1; x++) {
      var i = (y * W + x) * 4;
      sum += Math.abs(_lum(d, i) - _lum(d, i + 4)) + Math.abs(_lum(d, i) - _lum(d, i + W * 4)); n++;
    }
    return n ? sum / n : 0;
  }

  function _measure(before, after, roi, polRoi) {
    var inN = 0, outN = 0, inChg = 0, outChg = 0, inAbs = 0, outAbs = 0, dR = 0, dG = 0, dB = 0, dL = 0, dS = 0;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var i = (y * W + x) * 4;
      // 변경 판정 = 채널 최대 Δ (순수 색상 변화도 포착 — ΔL 만 보면 채도 변화 놓침)
      var dch = Math.max(Math.abs(after[i] - before[i]), Math.abs(after[i + 1] - before[i + 1]), Math.abs(after[i + 2] - before[i + 2]));
      var dl = dch;
      var inRoi = _inRect(x, y, roi);
      var inPol = polRoi === '_bg' ? !inRoi : _inRect(x, y, polRoi);
      if (inRoi) {
        inN++; if (dl > 3) inChg++; inAbs += Math.abs(_lum(after, i) - _lum(before, i));
        dR += after[i] - before[i]; dG += after[i + 1] - before[i + 1]; dB += after[i + 2] - before[i + 2];
        dL += _lum(after, i) - _lum(before, i); dS += _sat(after, i) - _sat(before, i);
      }
      if (polRoi && inPol && !inRoi) { outN++; if (dl > 3) outChg++; outAbs += dl; }
    }
    return {
      changedRatioIn: inN ? +(inChg / inN).toFixed(3) : 0,
      meanAbsIn: inN ? +(inAbs / inN).toFixed(2) : 0,
      dR: inN ? +(dR / inN).toFixed(2) : 0, dG: inN ? +(dG / inN).toFixed(2) : 0,
      dB: inN ? +(dB / inN).toFixed(2) : 0, dL: inN ? +(dL / inN).toFixed(2) : 0, dSat: inN ? +(dS / inN).toFixed(3) : 0,
      pollutionRatio: outN ? +(outChg / outN).toFixed(3) : 0, meanAbsOut: outN ? +(outAbs / outN).toFixed(2) : 0,
    };
  }

  function _engine() { return window.PhotoEditorBeautyEngine; }

  // [v2] synthetic ROI 사각형 → regionMasks 주입(production 마스크 경로 실증). 현재 eyeMask 지원.
  function _buildMasks(rois, kind) {
    if (kind === 'eye' && rois.eye) {
      var m = new Float32Array(W * H), e = rois.eye;
      for (var y = e.y; y < e.y + e.h; y++) for (var x = e.x; x < e.x + e.w; x++) m[y * W + x] = 1;
      return { useMasks: { eyeMask: m }, _scale: {}, maskW: W, maskH: H };
    }
    return null;
  }

  // 단일 param/preset 적용 결과 측정. patch = {param:strength,...}. maskKind: regionMasks 주입 종류(없으면 휴리스틱).
  function _applyMeasure(img, patch, roiKey, polKey, maskKind) {
    var s = _synth(img);
    var roi = s.rois[roiKey] || s.rois.subject || { x: 0, y: 0, w: W, h: H };
    var polRoi = polKey === '_bg' ? '_bg' : (s.rois[polKey] || null);
    var before = s.ctx.getImageData(0, 0, W, H);
    var beforeData = new Uint8ClampedArray(before.data);
    var gBefore = _gradEnergy(before.data, roi);
    var eng = _engine();
    if (!eng || typeof eng.apply !== 'function') return { error: 'PhotoEditorBeautyEngine 없음' };
    var masks = maskKind ? _buildMasks(s.rois, maskKind) : null;   // v2 마스크 주입(없으면 v1 휴리스틱)
    eng.apply(s.ctx, W, H, patch, false, masks);
    var after = s.ctx.getImageData(0, 0, W, H);
    var gAfter = _gradEnergy(after.data, roi);
    var m = _measure(beforeData, after.data, roi, polRoi);
    m.gradRatio = gBefore > 0.01 ? +(gAfter / gBefore).toFixed(3) : 1;
    return m;
  }

  function runOne(param, opts) {
    opts = opts || {};
    var spec = SPEC[param];
    if (!spec) { console.warn('[PhotoEffectDebug] 알 수 없는 param:', param); return null; }
    var strength = opts.strength != null ? opts.strength : 80;
    var p = {}; p[param] = strength;
    var r = _applyMeasure(spec.img, p, spec.roi, spec.pollutionRoi, spec.useMask);
    r.param = param; r.label = spec.intent; r.strength = strength; r.img = spec.img; r.kind = spec.kind; r.mask = spec.useMask || 'none';
    if (!opts.silent) console.log('[PhotoEffectDebug.runOne]', param, JSON.stringify(r));
    return r;
  }

  // 방향성 판정(기능명-효과 정합)
  function _dirOK(spec, r) {
    // smooth 는 픽셀당 Δ가 작아 changedRatio 가 낮아도 grad 하락이면 효과 인정(early-exit 제외).
    if (spec.kind === 'smooth') return r.gradRatio < 0.97;
    if (spec.kind === 'tone') return r.dL > 0.3;                  // 국소 톤 효과는 changedRatio 희석돼도 dL 로 판정
    if (r.changedRatioIn < 0.02) return false;                    // 그 외: 효과 거의 없음
    if (spec.kind === 'color') {
      if (spec.ch === 'R') return spec.sign < 0 ? r.dR < -0.5 : r.dR > 0.5;
      if (spec.ch === 'B') return spec.sign < 0 ? r.dB < -0.5 : r.dB > 0.5;
      if (spec.ch === 'RG') return spec.sign < 0 ? (r.dR + r.dG) < -1 : (r.dR + r.dG) > 1;
    }
    if (spec.kind === 'tone') return r.dL > 0.3;                  // 톤 보정 = 밝아짐 기대
    if (spec.kind === 'bright') return r.dL > 0.3 || r.gradRatio > 1.02;
    if (spec.kind === 'sat') return r.dSat > 0.003 || Math.max(Math.abs(r.dR), Math.abs(r.dG), Math.abs(r.dB)) > 3; // 채도 or 강한 채널 변화
    if (spec.kind === 'sharpen') return r.gradRatio > 1.03;       // 선명 = grad↑
    if (spec.kind === 'smooth') return r.gradRatio < 0.97;        // 결정리 = grad↓
    if (spec.kind === 'contrast') return r.gradRatio > 1.02 || r.meanAbsIn > 1;
    return r.changedRatioIn > 0.02;                              // any
  }

  function runAll(opts) {
    opts = opts || {};
    var rows = [];
    Object.keys(SPEC).forEach(function (param) {
      var spec = SPEC[param];
      var r50 = runOne(param, { strength: 50, silent: true });
      var r100 = runOne(param, { strength: 100, silent: true });
      var monotonic = r100.changedRatioIn >= r50.changedRatioIn - 0.005 && r100.meanAbsIn >= r50.meanAbsIn - 0.3;
      var dirOK = _dirOK(spec, r100);
      var matchLabel = dirOK;   // dirOK 가 이미 종류별 효과 유무·방향을 판정함
      rows.push({
        param: param, label: spec.intent, img: spec.img, kind: spec.kind,
        chgRatio50: r50.changedRatioIn, chgRatio100: r100.changedRatioIn,
        meanAbs100: r100.meanAbsIn, dL: r100.dL, dR: r100.dR, dB: r100.dB, dSat: r100.dSat, gradRatio: r100.gradRatio,
        pollution100: r100.pollutionRatio, dir: dirOK ? 'OK' : 'WEAK/OFF',
        monotonic: monotonic ? 'Y' : 'N', labelMatch: matchLabel ? 'Y' : 'N',
      });
    });
    PhotoEffectDebug._last = rows;
    if (!opts.silent && console.table) console.table(rows);
    return rows;
  }

  function comparePreset(presetId) {
    var LOOKS = window.PhotoEditorBeautyLooks || (window.PhotoEditor && window.PhotoEditor._beautyLooks) || null;
    var look = LOOKS && (Array.isArray(LOOKS) ? LOOKS.find(function (l) { return l.id === presetId; }) : LOOKS[presetId]);
    var patch = look ? (look.patch || look) : (typeof presetId === 'object' ? presetId : null);
    if (!patch) { console.warn('[PhotoEffectDebug] preset 미발견:', presetId); return null; }
    var imgs = ['face', 'nail', 'hair', 'eye', 'arm'], out = {};
    imgs.forEach(function (im) {
      var s = _synth(im); var before = new Uint8ClampedArray(s.ctx.getImageData(0, 0, W, H).data);
      _engine().apply(s.ctx, W, H, patch, false, null);
      var after = s.ctx.getImageData(0, 0, W, H);
      var m = _measure(before, after.data, s.rois.subject || s.rois.skin || s.rois.hair || { x: 0, y: 0, w: W, h: H }, '_bg');
      out[im] = { changedRatioIn: m.changedRatioIn, meanAbsIn: m.meanAbsIn, pollution: m.pollutionRatio };
    });
    console.log('[PhotoEffectDebug.comparePreset]', presetId, JSON.stringify(out, null, 2));
    return { preset: presetId, patch: patch, byImage: out };
  }

  function exportReport() {
    var rows = PhotoEffectDebug._last || runAll({ silent: true });
    var report = { ts: window.APP_BUILD || 'dev', total: rows.length,
      issues: rows.filter(function (r) { return r.labelMatch === 'N' || r.monotonic === 'N' || r.pollution100 > 0.15; }),
      rows: rows };
    console.log('=== PHOTO EFFECT REPORT ===');
    console.log(JSON.stringify(report, null, 2));
    return report;
  }

  window.PhotoEffectDebug = { runOne: runOne, runAll: runAll, comparePreset: comparePreset, exportReport: exportReport, _synth: _synth, SPEC: SPEC };
})();
