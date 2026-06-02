/* 사진편집 효과 실사진 수동 검증 도구 (런타임 미수정 — 측정/미리보기 전용)
   앱에서 실제 사진을 연 상태에서 DevTools 콘솔에 명령을 붙여 모든 보정 기능을 0/50/100 비교.
   엔진/라벨/라우팅은 절대 수정하지 않음. 라이브 캔버스는 훼손하지 않고 오프스크린에서 적용 후 패널에 표시.

   사용(DevTools):
     PhotoEffectManualDebug.captureCurrent()
     PhotoEffectManualDebug.preview('nailGloss', 80)
     PhotoEffectManualDebug.previewSteps('nailGloss')
     PhotoEffectManualDebug.previewAll()
     PhotoEffectManualDebug.previewSuspects()
     PhotoEffectManualDebug.previewItbi('네일 광택 살려줘')
     PhotoEffectManualDebug.inspectItbiRoutes()
     PhotoEffectManualDebug.exportReport()
     PhotoEffectManualDebug.reset()

   ⚠️ 실사진 ROI 는 추정값(estimated)이며, 최종 판단은 before/after 육안 + 수치 리포트를 함께 본다. */
(function () {
  'use strict';
  if (window.PhotoEffectManualDebug) return;

  // 정직화 라벨(app-photo-editor-beauty.js SLIDERS 미러 — 표시용, 엔진 무관)
  var LABELS = {
    skin: '피부톤 정리', redness: '붉은기 완화', yellowness: '노란기 완화', coolness: '푸른기 완화(손)',
    handSkin: '손/발 피부톤', blemish: '잡티 완화', textureSmooth: '결 정리(자연)',
    eyeShadow: '눈가 그림자', underEyeClean: '눈밑 칙칙함', eyeRedness: '눈 붉음 완화', irisClear: '눈동자 또렷',
    catchLight: '눈빛 반짝임', lashSharp: '속눈썹 선명도', closeUpDetail: '전체 선명도(클로즈업)', browSharp: '선명도(눈썹 포함)',
    lipPop: '입술 발색', eyeColor: '아이 색감', hairShine: '모발 윤기', hairVolume: '머리 풍성감',
    hairEndsClean: '머리끝 정리', hairDetail: '머리결 선명도(전체)', hairColor: '모발 색감', hairColorPop: '염색 컬러 강조',
    scalpBoost: '두피 톤(풍성감)', hairyArm: '팔/다리 톤 보정', nailGloss: '네일 광택', nailShape: '네일 경계 선명',
  };
  var PARAMS = Object.keys(LABELS);
  var SUSPECTS = ['nailGloss', 'nailShape', 'hairyArm', 'hairVolume', 'blemish', 'textureSmooth', 'catchLight',
    'browSharp', 'hairDetail', 'closeUpDetail', 'handSkin', 'eyeShadow', 'underEyeClean', 'coolness'];

  // 잇비 명령 → param 참조 매핑(intent-parser.js _beautySteps 미러 — 표시·미리보기용. 실파서 아님).
  var ITBI_ROUTES = [
    { cmd: '피부 톤 정리해줘', param: 'skin', track: 'T-160' }, { cmd: '붉은기 빼줘', param: 'redness', track: 'T-160' },
    { cmd: '노란기 줄여줘', param: 'yellowness', track: 'T-160' }, { cmd: '잡티 정리해줘', param: 'blemish', track: 'T-160' },
    { cmd: '피부결 매끄럽게', param: 'textureSmooth', track: 'T-160' }, { cmd: '다크서클 정리해줘', param: 'eyeShadow', track: 'T-160' },
    { cmd: '눈밑 칙칙함 정리', param: 'underEyeClean', track: 'T-160' }, { cmd: '눈동자 또렷하게', param: 'irisClear', track: 'T-160' },
    { cmd: '눈빛 반짝이게', param: 'catchLight', track: 'T-160' }, { cmd: '속눈썹 또렷하게', param: 'lashSharp', track: 'T-160' },
    { cmd: '입술 발색 살려줘', param: 'lipPop', track: 'T-160' }, { cmd: '아이섀도 색 살려줘', param: 'eyeColor', track: 'T-160' },
    { cmd: '머리 윤기나게', param: 'hairShine', track: 'T-160' }, { cmd: '머리 풍성하게', param: 'hairVolume', track: 'T-160' },
    { cmd: '머리끝 정리해줘', param: 'hairEndsClean', track: 'T-160' }, { cmd: '염색 컬러 살려줘', param: 'hairColorPop', track: 'T-160' },
    { cmd: '네일 광택 살려줘', param: 'nailGloss', track: 'T-160' },
    { cmd: '머리결 더 선명하게', param: 'hairDetail', track: 'T-161' }, { cmd: '머릿결 더 또렷', param: 'hairDetail', track: 'T-161' },
    { cmd: '네일 경계 선명하게', param: 'nailShape', track: 'T-161' }, { cmd: '손 피부톤 정리', param: 'handSkin', track: 'T-161' },
    { cmd: '눈썹 선명하게', param: 'browSharp', track: 'T-161' }, { cmd: '두피 풍성하게', param: 'scalpBoost', track: 'T-161' },
    { cmd: '모발 색 차분하게', param: 'hairColor', track: 'T-161' }, { cmd: '입술 더 진하게', param: 'lipPop', track: 'T-161' },
    { cmd: '눈빛 조금만', param: 'catchLight', track: 'T-161' }, { cmd: '속눈썹 살짝만', param: 'lashSharp', track: 'T-161' },
    { cmd: '윤기 조금 더', param: 'hairShine', track: 'T-161' },
  ];
  // 미연결(슬라이더 전용) — intent-parser 미발견
  var ITBI_UNROUTED = ['eyeRedness', 'closeUpDetail', 'hairyArm'];

  var _before = null;   // {canvas, w, h, imageData(Uint8ClampedArray)}
  var _liveCanvas = null;
  var _report = {};
  var PANEL_ID = 'pemDebugPanel';

  // ── 캔버스 탐지 ──
  function _detectCanvas() {
    var c = document.getElementById('peCanvas');
    if (c && c.width > 1) return { canvas: c, how: '#peCanvas' };
    try {
      var PE = window.PhotoEditor, st = PE && PE._internal && PE._internal.getState && PE._internal.getState();
      if (st && st.canvas && st.canvas.width > 1) return { canvas: st.canvas, how: 'PhotoEditor._internal.getState().canvas' };
    } catch (_e) { void 0; }
    var all = [].slice.call(document.querySelectorAll('canvas')).filter(function (cv) { return cv.width > 32 && cv.height > 32 && cv.offsetParent !== null; });
    all.sort(function (a, b) { return b.width * b.height - a.width * a.height; });
    if (all.length) return { canvas: all[0], how: '가장 큰 visible canvas (fallback)' };
    return null;
  }

  function captureCurrent() {
    var det = _detectCanvas();
    if (!det) { console.error('[ManualDebug] 캔버스를 못 찾음 — #peCanvas / PhotoEditor state / canvas 태그 모두 실패. 사진편집을 먼저 열어주세요.'); return false; }
    _liveCanvas = det.canvas;
    var w = det.canvas.width, h = det.canvas.height;
    var ctx = det.canvas.getContext('2d');
    try {
      var data = ctx.getImageData(0, 0, w, h);
      _before = { w: w, h: h, imageData: new Uint8ClampedArray(data.data) };
      console.log('[ManualDebug] 캡처 성공 ✅ — ' + det.how + ' (' + w + '×' + h + ')');
      return true;
    } catch (e) { console.error('[ManualDebug] getImageData 실패(tainted canvas?) — 파일에서 사진을 다시 불러와 주세요.', e.message); return false; }
  }

  function _ensureBefore() { if (!_before) { console.warn('[ManualDebug] captureCurrent() 를 먼저 실행하세요. 자동 시도…'); return captureCurrent(); } return true; }

  // 오프스크린에 before 복원 + patch 적용 → after ImageData (라이브 캔버스 무손상)
  function _applyOff(patch) {
    var w = _before.w, h = _before.h;
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d', { willReadFrequently: true });
    var id = ctx.createImageData(w, h); id.data.set(_before.imageData); ctx.putImageData(id, 0, 0);
    var eng = window.PhotoEditorBeautyEngine;
    var masks = null;
    try {
      var MA = window.MaskApplication, st = window.PhotoEditor && window.PhotoEditor._internal && window.PhotoEditor._internal.getState && window.PhotoEditor._internal.getState();
      var img = st && st.originalImg;
      if (MA && typeof MA.getMasksForBeautySync === 'function' && img) masks = MA.getMasksForBeautySync(img) || null;
    } catch (_e) { masks = null; }
    if (eng && eng.apply) { try { eng.apply(ctx, w, h, patch, false, masks); } catch (e) { console.warn('[ManualDebug] apply 오류', e.message); } }
    return { canvas: cv, ctx: ctx, after: ctx.getImageData(0, 0, w, h).data, usedMask: !!masks };
  }

  function _lum(d, i) { return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; }

  // 변화 지표 + ROI 밖 오염(추정 — 바깥 테두리 20%를 비대상 추정으로 사용)
  function _metrics(after) {
    var b = _before.imageData, w = _before.w, h = _before.h;
    var n = 0, chg = 0, sAbs = 0, sL = 0, sR = 0, sG = 0, sB = 0, outN = 0, outChg = 0;
    var bx = w * 0.18, by = h * 0.18;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var i = (y * w + x) * 4;
      var dch = Math.max(Math.abs(after[i] - b[i]), Math.abs(after[i + 1] - b[i + 1]), Math.abs(after[i + 2] - b[i + 2]));
      n++; if (dch > 3) chg++; sAbs += dch; sL += _lum(after, i) - _lum(b, i);
      sR += after[i] - b[i]; sG += after[i + 1] - b[i + 1]; sB += after[i + 2] - b[i + 2];
      if (x < bx || x > w - bx || y < by || y > h - by) { outN++; if (dch > 3) outChg++; }   // 추정 비대상 테두리
    }
    return {
      changedRatio: +(chg / n).toFixed(3), avgDelta: +(sAbs / n).toFixed(2), lumDelta: +(sL / n).toFixed(2),
      dR: +(sR / n).toFixed(2), dG: +(sG / n).toFixed(2), dB: +(sB / n).toFixed(2),
      outsidePollution_est: outN ? +(outChg / outN).toFixed(3) : 0,
    };
  }

  function _suspect(param, m, mono) {
    if (m.changedRatio < 0.004) return '효과 거의 없음';
    if (m.outsidePollution_est > 0.4) return '비대상(테두리) 오염 큼(추정)';
    if (mono === false) return '강도 단조증가 아님';
    if (SUSPECTS.indexOf(param) >= 0) return '집중 확인 대상';
    return '';
  }

  // ── UI 패널 ──
  function _panel() {
    var p = document.getElementById(PANEL_ID);
    if (p) return p;
    p = document.createElement('div'); p.id = PANEL_ID;
    p.style.cssText = 'position:fixed;right:0;bottom:0;z-index:2147483600;width:min(96vw,520px);max-height:86vh;overflow:auto;'
      + 'background:#fff;border:1px solid #d0d4da;border-radius:14px 0 0 0;box-shadow:0 8px 30px rgba(0,0,0,.25);'
      + 'font:12px/1.4 -apple-system,system-ui,sans-serif;color:#191f28;padding:10px 12px 16px;';
    var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;position:sticky;top:0;background:#fff;padding-bottom:6px;';
    bar.innerHTML = '<b style="font-size:13px;">🔬 사진효과 수동검증</b>';
    var btns = document.createElement('div');
    var rs = document.createElement('button'); rs.textContent = 'reset'; rs.style.cssText = 'margin-right:6px;padding:4px 10px;border:1px solid #c0c4ca;border-radius:8px;background:#f2f4f6;cursor:pointer;';
    rs.onclick = function () { reset(); };
    var cl = document.createElement('button'); cl.textContent = '닫기'; cl.style.cssText = 'padding:4px 10px;border:1px solid #c0c4ca;border-radius:8px;background:#fff;cursor:pointer;';
    cl.onclick = function () { p.remove(); };
    btns.appendChild(rs); btns.appendChild(cl); bar.appendChild(btns); p.appendChild(bar);
    var body = document.createElement('div'); body.id = PANEL_ID + 'Body'; p.appendChild(body);
    document.body.appendChild(p); return p;
  }
  function _body() { _panel(); return document.getElementById(PANEL_ID + 'Body'); }

  function _thumb(srcData, w, h, maxW) {
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var id = cv.getContext('2d').createImageData(w, h); id.data.set(srcData); cv.getContext('2d').putImageData(id, 0, 0);
    var sc = Math.min(1, (maxW || 150) / w);
    var out = document.createElement('canvas'); out.width = Math.round(w * sc); out.height = Math.round(h * sc);
    out.style.cssText = 'border:1px solid #e5e8eb;border-radius:8px;width:' + out.width + 'px;height:' + out.height + 'px;';
    out.getContext('2d').drawImage(cv, 0, 0, out.width, out.height);
    return out;
  }
  function _diffThumb(after, maxW) {
    var b = _before.imageData, w = _before.w, h = _before.h, dd = new Uint8ClampedArray(w * h * 4);
    for (var i = 0; i < dd.length; i += 4) {
      var v = Math.min(255, (Math.abs(after[i] - b[i]) + Math.abs(after[i + 1] - b[i + 1]) + Math.abs(after[i + 2] - b[i + 2])) * 2);
      dd[i] = v; dd[i + 1] = v; dd[i + 2] = v; dd[i + 3] = 255;
    }
    return _thumb(dd, w, h, maxW);
  }

  function _card(title, sub, suspect) {
    var c = document.createElement('div');
    c.style.cssText = 'border:' + (suspect ? '2px solid #e5484d' : '1px solid #e5e8eb') + ';border-radius:10px;padding:8px;margin:8px 0;';
    var hd = document.createElement('div'); hd.style.cssText = 'font-weight:700;margin-bottom:4px;';
    hd.textContent = title + (suspect ? '  ⚠ ' + suspect : '');
    if (suspect) hd.style.color = '#e5484d';
    c.appendChild(hd);
    if (sub) { var s = document.createElement('div'); s.style.cssText = 'color:#6b7280;margin-bottom:6px;'; s.textContent = sub; c.appendChild(s); }
    var row = document.createElement('div'); row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;'; c.appendChild(row);
    c._row = row; return c;
  }
  function _labeled(canvas, label) {
    var wrap = document.createElement('div'); wrap.style.cssText = 'text-align:center;';
    var l = document.createElement('div'); l.style.cssText = 'font-size:10px;color:#8b95a1;margin-bottom:2px;'; l.textContent = label;
    wrap.appendChild(l); wrap.appendChild(canvas); return wrap;
  }

  // ── 공개 API ──
  function preview(param, strength) {
    if (!_ensureBefore()) return null;
    strength = strength == null ? 80 : strength;
    var patch = {}; patch[param] = strength;
    var res = _applyOff(patch); var m = _metrics(res.after);
    var c = _card(param + ' · ' + (LABELS[param] || '?') + ' @' + strength, 'mask=' + (res.usedMask ? 'production' : '휴리스틱') + ' · ROI밖오염=추정', _suspect(param, m, null));
    c._row.appendChild(_labeled(_thumb(_before.imageData, _before.w, _before.h, 150), 'before'));
    c._row.appendChild(_labeled(_thumb(res.after, _before.w, _before.h, 150), 'after'));
    c._row.appendChild(_labeled(_diffThumb(res.after, 150), 'diff×2'));
    _body().prepend(c);
    var rep = { param: param, label: LABELS[param], strength: strength, changedRatio: m.changedRatio, avgDelta: m.avgDelta, lumDelta: m.lumDelta, dR: m.dR, dG: m.dG, dB: m.dB, outsidePollution_est: m.outsidePollution_est, mask: res.usedMask ? 'production' : 'heuristic' };
    _report[param] = rep; if (console.table) console.table([rep]);
    return rep;
  }

  function previewSteps(param) {
    if (!_ensureBefore()) return null;
    var steps = [0, 50, 100], metr = [];
    var c = _card(param + ' · ' + (LABELS[param] || '?') + ' — 단계 비교', '0 / 50 / 100 + diff(100)', '');
    steps.forEach(function (s) {
      var patch = {}; patch[param] = s; var res = _applyOff(patch); var m = _metrics(res.after); metr.push(m);
      c._row.appendChild(_labeled(_thumb(res.after, _before.w, _before.h, 120), s === 0 ? 'before(0)' : '@' + s));
      if (s === 100) c._row.appendChild(_labeled(_diffThumb(res.after, 120), 'diff'));
    });
    var mono = metr[1].changedRatio <= metr[2].changedRatio + 0.005 && metr[1].avgDelta <= metr[2].avgDelta + 0.3;
    c.querySelector('div').textContent += mono ? '  ✓ monotonic' : '  ✗ non-monotonic';
    if (!mono) c.style.border = '2px solid #e5484d';
    _body().prepend(c);
    var rep = { param: param, label: LABELS[param], steps: { '50': metr[1], '100': metr[2] }, monotonic: mono, suspect: _suspect(param, metr[2], mono) };
    _report[param] = rep; console.log('[previewSteps]', param, JSON.stringify(rep));
    return rep;
  }

  function _batch(list, label) {
    if (!_ensureBefore()) return null;
    console.log('[ManualDebug] ' + label + ' — ' + list.length + '개 순회…');
    var grid = _card(label + ' (각 @100, 클릭=확대)', list.length + '개', '');
    grid._row.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;';
    var out = [];
    list.forEach(function (param, idx) {
      var patch = {}; patch[param] = 100; var res = _applyOff(patch); var m = _metrics(res.after);
      var sus = _suspect(param, m, null);
      var cell = document.createElement('div'); cell.style.cssText = 'cursor:pointer;text-align:center;border:' + (sus ? '2px solid #e5484d' : '1px solid #e5e8eb') + ';border-radius:8px;padding:4px;';
      cell.appendChild(_thumb(res.after, _before.w, _before.h, 100));
      var t = document.createElement('div'); t.style.cssText = 'font-size:10px;margin-top:2px;' + (sus ? 'color:#e5484d;font-weight:700;' : '');
      t.textContent = param + '\n' + (LABELS[param] || '') + '\nchg ' + m.changedRatio + (sus ? ' ⚠' : '');
      t.style.whiteSpace = 'pre-line'; cell.appendChild(t);
      cell.onclick = (function (pp) { return function () { preview(pp, 100); }; })(param);
      grid._row.appendChild(cell);
      out.push({ param: param, label: LABELS[param], changedRatio: m.changedRatio, lumDelta: m.lumDelta, outsidePollution_est: m.outsidePollution_est, suspect: sus });
      _report[param] = out[out.length - 1];
      if ((idx + 1) % 9 === 0) console.log('  진행 ' + (idx + 1) + '/' + list.length);
    });
    _body().prepend(grid);
    if (console.table) console.table(out);
    return out;
  }
  function previewAll() { return _batch(PARAMS, '전체 기능'); }
  function previewSuspects() { return _batch(SUSPECTS, 'suspect 후보'); }

  function reset(opts) {
    if (!_before || !_liveCanvas) { console.warn('[ManualDebug] 복구할 캡처 없음.'); return false; }
    try {
      var ctx = _liveCanvas.getContext('2d'); var id = ctx.createImageData(_before.w, _before.h);
      id.data.set(_before.imageData); ctx.putImageData(id, 0, 0);
      console.log('[ManualDebug] 라이브 캔버스 원본 복구 ✅ (오프스크린 미리보기였으면 원래 무손상)');
      if (opts && opts.closePanel) { var p = document.getElementById(PANEL_ID); if (p) p.remove(); }
      return true;
    } catch (e) { console.error('[ManualDebug] 복구 실패', e.message); return false; }
  }

  function inspectItbiRoutes() {
    var rows = ITBI_ROUTES.map(function (r) {
      var hype = /완벽|확실|보장|무조건|최고|기적/.test(r.cmd);   // 과장어 기존 기준
      return { track: r.track, cmd: r.cmd, param: r.param, label: LABELS[r.param] || '?', routed: 'O', hype: hype ? 'Y' : '' };
    });
    ITBI_UNROUTED.forEach(function (p) { rows.push({ track: '-', cmd: '(자연어 미연결)', param: p, label: LABELS[p], routed: 'X', hype: '' }); });
    if (console.table) console.table(rows);
    console.log('[inspectItbiRoutes] T-160/T-161 참조 매핑(intent-parser 미러). 미연결:', ITBI_UNROUTED.join(', '));
    return rows;
  }

  function _routeOf(text) {
    var hit = ITBI_ROUTES.find(function (r) { return text.indexOf(r.cmd) >= 0 || r.cmd.indexOf(text) >= 0; });
    if (hit) return hit.param;
    var t = text;
    if (/네일|손톱/.test(t) && /광택|윤/.test(t)) return 'nailGloss';
    if (/네일|손톱/.test(t) && /경계|모양|또렷|선명/.test(t)) return 'nailShape';
    if (/머리|모발/.test(t) && /풍성|볼륨/.test(t)) return 'hairVolume';
    if (/머리|모발/.test(t) && /윤|광/.test(t)) return 'hairShine';
    if (/붉은기|홍조/.test(t)) return 'redness';
    if (/잡티/.test(t)) return 'blemish';
    if (/입술/.test(t)) return 'lipPop';
    return null;
  }
  function previewItbi(text, strength) {
    var param = _routeOf(text);
    if (!param) { console.warn('[previewItbi] 매핑 param 미발견:', text, '— inspectItbiRoutes() 참고'); return null; }
    console.log('[previewItbi] "' + text + '" → ' + param + ' (' + LABELS[param] + ') · 슬라이더 preview(\'' + param + '\') 와 동일 엔진 경로');
    return preview(param, strength == null ? 80 : strength);
  }

  function exportReport() {
    var report = { ts: window.APP_BUILD || 'dev',
      note: '실사진 수동 검증의 ROI는 추정값(estimated)이며, 최종 판단은 before/after 육안 확인과 수치 리포트를 함께 본다.',
      checked: Object.keys(_report).length, results: _report };
    console.log('=== PHOTO EFFECT MANUAL REPORT ===');
    console.log(JSON.stringify(report, null, 2));
    return report;
  }

  // [PE-ER5 진단] eyeRedness 게이트 내부값 계측 — 엔진 _pixel/_applyEye 로직을 그대로 복제(읽기 전용).
  //   왜 k(scleraW)가 0인지 숫자로: eyeW 후보 수, scleraW 0 원인(bright/neutral/sat/warmBrown/red/skin), max/avg.
  function inspectEyeRednessGate(opts) {
    if (!_ensureBefore()) return null;
    opts = opts || {};
    var w = _before.w, h = _before.h, b = _before.imageData;
    var regionMasks = null;
    try {
      var MA = window.MaskApplication, st = window.PhotoEditor && window.PhotoEditor._internal && window.PhotoEditor._internal.getState && window.PhotoEditor._internal.getState();
      var img = st && st.originalImg;
      if (MA && typeof MA.getMasksForBeautySync === 'function' && img) regionMasks = MA.getMasksForBeautySync(img) || null;
    } catch (_e) { regionMasks = null; }
    var SM = window.PhotoEditorSmartMask;
    var useM = regionMasks && regionMasks.useMasks, sc = regionMasks && regionMasks._scale;
    var mw = (regionMasks && regionMasks.maskW) || w, mh = (regionMasks && regionMasks.maskH) || h;
    function rm(key, midx, fb) { return (useM && useM[key]) ? (useM[key][midx] || 0) * ((sc && sc[key]) || 1) : fb; }
    var a = { total: w * h, eyeMaskPresent: !!(useM && useM.eyeMask), skinMaskPresent: !!(useM && useM.skinMask),
      eyeWPass: 0, redCondPass: 0, brightZero: 0, neutralZero: 0, satZero: 0, warmBrownBlocked: 0,
      skinPenalty02: 0, scleraWover008: 0, maxScleraW: 0, sumScleraW: 0, samples: [] };
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var i = (y * w + x) * 4, r = b[i], g = b[i + 1], bl = b[i + 2];
      var lum0 = r * 0.299 + g * 0.587 + bl * 0.114;
      var maxc = Math.max(r, g, bl), minc = Math.min(r, g, bl), sat = maxc - minc;
      var subjectW = Math.max(0, 1 - (Math.abs((x + 0.5) / w - 0.5) * 1.44 + Math.abs((y + 0.5) / h - 0.48) * 1.04));
      var edgeBg = subjectW < 0.5 || y < h * 0.02 || y > h * 0.96;
      var isSkin = !edgeBg && r > 60 && r > g - 6 && g > bl - 10 && (r - bl) > 5 && (r - bl) < 120 && lum0 > 45 && lum0 < 248;
      var ny = (y + 0.5) / h;
      var hairLike = !edgeBg && subjectW > 0.3 && lum0 > 14 && lum0 < 220 && ((!isSkin && ((sat < 110 && lum0 < 195) || lum0 < 110 || (bl < 95 && sat < 150))) || (ny < 0.55 && lum0 < 160 && sat < 100));
      var mask = (SM && SM.classify) ? SM.classify({ r: r, g: g, b: bl, lum: lum0, maxCh: maxc, minCh: minc, x: x, y: y, w: w, h: h, isSkinFallback: isSkin, hairFallback: hairLike }) : null;
      var midx; if (mw === w && mh === h) midx = y * w + x; else { var mx = Math.min(mw - 1, Math.max(0, (x * mw / w) | 0)), my = Math.min(mh - 1, Math.max(0, (y * mh / h) | 0)); midx = my * mw + mx; }
      var eyeW = rm('eyeMask', midx, mask ? mask.eye : (ny > 0.30 && ny < 0.48 && lum0 < 140 ? 0.2 : 0));
      if (eyeW <= 0.10) continue;
      a.eyeWPass++;
      var skinW = rm('skinMask', midx, mask ? mask.skin : (isSkin ? 1 : 0));
      var warmBrown = (r - g > 18 && r - bl > 28);
      var brightW = Math.min(1, Math.max(0, (lum0 - 135) / 45));
      var neutralW = Math.min(1, Math.max(0, (42 - sat) / 22));
      var satW = Math.min(1, Math.max(0, (48 - sat) / 28));
      var skinPenalty = skinW > 0.70 ? 0.2 : (skinW > 0.35 ? 0.45 : 1);
      var scleraW = brightW * neutralW * satW * skinPenalty * (warmBrown ? 0 : 1);
      var redCond = (r > g + 3 && r > bl + 1);
      if (brightW === 0) a.brightZero++;
      if (neutralW === 0) a.neutralZero++;
      if (satW === 0) a.satZero++;
      if (warmBrown) a.warmBrownBlocked++;
      if (skinPenalty === 0.2) a.skinPenalty02++;
      if (redCond) a.redCondPass++;
      if (scleraW > a.maxScleraW) a.maxScleraW = scleraW;
      a.sumScleraW += scleraW;
      if (scleraW > 0.08 && redCond) a.scleraWover008++;
      if (a.samples.length < 8 && eyeW > 0.10) a.samples.push({ x: x, y: y, lum0: Math.round(lum0), satCh: sat, chSpan: sat, skinW: +skinW.toFixed(2), brightW: +brightW.toFixed(2), neutralW: +neutralW.toFixed(2), satW: +satW.toFixed(2), skinPenalty: skinPenalty, scleraW: +scleraW.toFixed(3), warmBrown: warmBrown, redCond: redCond });
    }
    a.avgScleraW = a.eyeWPass ? +(a.sumScleraW / a.eyeWPass).toFixed(4) : 0;
    a.maxScleraW = +a.maxScleraW.toFixed(4);
    var rec;
    if (a.eyeWPass === 0) rec = 'eyeW>0.10 후보 0개 — 눈/흰자 영역 자체가 미검출(eyeMask 없음+fallback 미발화). scleraW와 무관. → eyeW 게이트/eyeMask가 1차 원인.';
    else if (a.scleraWover008 > 0) rec = 'scleraW>0.08 후보 ' + a.scleraWover008 + '개 존재 → 엔진은 작동해야 함. 적용부/다른 원인 재확인.';
    else {
      var c = [], n = a.eyeWPass;
      if (a.brightZero / n > 0.4) c.push('brightW(lum<135)');
      if (a.neutralZero / n > 0.4) c.push('neutralW(chSpan>42)');
      if (a.satZero / n > 0.4) c.push('satW(satCh>48)');
      if (a.warmBrownBlocked / n > 0.4) c.push('warmBrown(r-g>18&r-b>28)');
      if (a.redCondPass === 0) c.push('redCond(r>g+3) 통과 0');
      rec = 'eyeW 후보 ' + n + '개 중 scleraW>0.08 가 0. 주원인: ' + (c.join(', ') || '복합(maxScleraW=' + a.maxScleraW + ', 문턱 0.08 근처)') + '. samples 참고.';
    }
    a.recommendedFix = rec;
    console.log('=== eyeRedness GATE DIAG (PE-ER5) ===');
    console.log(JSON.stringify(a, null, 2));
    return a;
  }

  window.PhotoEffectManualDebug = {
    captureCurrent: captureCurrent, preview: preview, previewSteps: previewSteps, previewAll: previewAll,
    previewSuspects: previewSuspects, reset: reset, exportReport: exportReport,
    inspectItbiRoutes: inspectItbiRoutes, previewItbi: previewItbi, inspectEyeRednessGate: inspectEyeRednessGate,
    LABELS: LABELS, PARAMS: PARAMS, SUSPECTS: SUSPECTS,
  };
  console.log('[PhotoEffectManualDebug] 로드됨. PhotoEffectManualDebug.captureCurrent() 부터 시작하세요.');
})();
