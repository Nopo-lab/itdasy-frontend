// P3-1/P3-4 — 실제 새 함수 소스를 추출해 스텁과 함께 실행(canvas 필요분은 chromium).
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

// 중괄호 매칭으로 함수 소스 추출(실제 출고 코드 그대로 테스트)
function extractFn(src, name) {
  const start = src.indexOf('function ' + name);
  if (start < 0) throw new Error('not found: ' + name);
  let i = src.indexOf('{', start), depth = 0, end = -1;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return src.slice(start, end);
}

const prov = readFileSync('js/photo-editor/region-mask-provider.js', 'utf8');
const ma   = readFileSync('js/photo-editor/mask-application.js', 'utf8');
const fnExtrude = extractFn(prov, '_extrudeForeheadUp');
const fnNail    = extractFn(prov, '_tier3_nailHeuristic');
const fnGate    = extractFn(ma, '_nailGatePass');

const browser = await chromium.launch();
const page = await browser.newPage();
const out = await page.evaluate(async ({ fnExtrude, fnNail, fnGate }) => {
  // ── 스텁 ──
  const _imgSize = (img) => ({ w: img.width, h: img.height });
  const _getRefine = () => ({
    gaussianFeather: (m) => m,
    maskCoverage: (m) => { let c = 0; for (const v of m) if (v > 0.3) c++; return c / m.length; },
  });
  const _emptyResult = (s, r) => ({ status: s, reason: r, mask: null });
  // gate 상수(소스와 동일)
  const NAIL_CONF_MIN = 0.7, NAIL_COV_MIN = 0.0005, NAIL_COV_MAX = 0.08;
  const NAIL_HEUR_COV_MIN = 0.003, NAIL_HEUR_COV_MAX = 0.10;
  eval(fnExtrude); eval(fnNail); eval(fnGate);

  const res = {};

  // ── P3-4: forehead extrude ──
  // 100x100 마스크 — 아래쪽(y>=40)만 채움. bb top=40. ext=10 연장 → y 30~39 가 채워져야.
  {
    const w = 100, h = 100; const mask = new Float32Array(w * h);
    for (let y = 40; y < 90; y++) for (let x = 30; x < 70; x++) mask[y * w + x] = 1;
    const bb = { x: 30, y: 40, w: 40, h: 50 };
    const ext = 10;
    const o = _extrudeForeheadUp(mask, w, h, bb, ext);
    const colX = 50;
    let topBefore = -1, topAfter = -1;
    for (let y = 0; y < h; y++) { if (mask[y * w + colX] > 0.3 && topBefore < 0) topBefore = y; if (o[y * w + colX] > 0.3 && topAfter < 0) topAfter = y; }
    const aboveExt = o[(40 - ext - 3) * w + colX]; // ext 한참 위 = 0 이어야(경계)
    res.forehead = { topBefore, topAfter, extended: topBefore - topAfter, boundedOk: aboveExt < 0.05 };
  }

  // ── P3-1: nail heuristic ──
  function makeImg(draw) { const c = document.createElement('canvas'); c.width = 120; c.height = 120; const x = c.getContext('2d'); x.fillStyle = '#d8b49a'; x.fillRect(0, 0, 120, 120); draw(x); return c; }
  // (a) 선명 빨강 네일 블롭 4개(중앙권) → 마스크 검출 + coverage 밴드 내
  const imgNails = makeImg((x) => { x.fillStyle = '#d11'; for (const [cx, cy] of [[45,55],[60,50],[72,55],[84,60]]) { x.beginPath(); x.ellipse(cx, cy, 5, 8, 0, 0, 7); x.fill(); } });
  const rNails = await _tier3_nailHeuristic(imgNails);
  // (b) 살색만(네일 없음) → null
  const imgSkin = makeImg(() => {});
  const rSkin = await _tier3_nailHeuristic(imgSkin);
  // (c) 화면 절반 빨강(옷/배경) → coverage 초과 → null
  const imgBig = makeImg((x) => { x.fillStyle = '#d11'; x.fillRect(0, 0, 120, 70); });
  const rBig = await _tier3_nailHeuristic(imgBig);

  res.nail = {
    nailsDetected: !!(rNails && rNails.mask && rNails._nailHeuristic),
    nailsCov: rNails ? +(rNails.coverage * 100).toFixed(2) : null,
    skinNull: rSkin === null,
    bigRejected: rBig === null,
  };

  // ── P3-1: gate ──
  res.gate = {
    heurInBand: _nailGatePass({ _nailHeuristic: true, mask: [1], coverage: 0.02 }) === true,
    heurTooBig: _nailGatePass({ _nailHeuristic: true, mask: [1], coverage: 0.2 }) === false,
    heurTooSmall: _nailGatePass({ _nailHeuristic: true, mask: [1], coverage: 0.0001 }) === false,
    tier1Ready: _nailGatePass({ status: 'ready', sourceTier: 1, mask: [1], confidence: 0.8, coverage: 0.02 }) === true,
    tier3NonHeur: _nailGatePass({ status: 'fallback', sourceTier: 3, mask: [1], coverage: 0.02 }) === false,
  };
  return res;
}, { fnExtrude, fnNail, fnGate });

console.log(JSON.stringify(out, null, 2));
const fh = out.forehead, nl = out.nail, gt = out.gate;
const p3_4 = fh.extended >= 8 && fh.extended <= 11 && fh.boundedOk;     // 위로 ~ext 연장, 그 위는 비어있음
const p3_1a = nl.nailsDetected && nl.nailsCov >= 0.3 && nl.skinNull && nl.bigRejected;
const p3_1b = gt.heurInBand && gt.heurTooBig && gt.heurTooSmall && gt.tier1Ready && gt.tier3NonHeur;
console.log('P3-4 (이마 연장):', p3_4 ? 'PASS' : 'FAIL', `(${fh.topBefore}→${fh.topAfter}, +${fh.extended}px, bounded=${fh.boundedOk})`);
console.log('P3-1 휴리스틱:', p3_1a ? 'PASS' : 'FAIL', `(네일검출=${nl.nailsDetected} cov=${nl.nailsCov}% / 살색null=${nl.skinNull} / 큰빨강거부=${nl.bigRejected})`);
console.log('P3-1 게이트:', p3_1b ? 'PASS' : 'FAIL', JSON.stringify(gt));
await browser.close();
process.exit(p3_4 && p3_1a && p3_1b ? 0 : 1);
