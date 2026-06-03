#!/usr/bin/env node
/* PE-M3(B안) nailMask 게이트/안전 QA (런타임 미수정, 합성 측정 전용, 실사진 0)

   검증:
     A. 게이트 _nailGatePass — Tier1 + conf≥0.7 + coverage 0.0005~0.08 경계(작음/손전체 reject)
     B. PE_NAIL_MASK_DISABLE → getNailMaskSync null
     C. 엔진 안전 — nailGloss 적용 시 배경(edge)·매트 피부 번짐 0, 글리터(광택) 효과 유지, 누드(매트) 과탐 없음
     D. nailMask 있음 vs 없음 — 마스크 있으면 글리터에 더 강하게(신뢰), 없으면 휴리스틱 경로
     E. nailShape 적용 pageerror 0
     F. handSkin 상태 — 고신뢰 stub여도 '정밀 적용됨' 표시 금지(항상 fallback/준비 중)
     G. pageerror 0
   ※ beauty-engine 무수정. 실네일 손/배경 비번짐 최종 확인은 실사진 overlay 수동.
   실행: python3 -m http.server 8099 후 node scripts/photo-mask-nail-qa.js */

const { chromium } = require('playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=nail-qa';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 160)); });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.PhotoEditorBeautyEngine && window.MaskApplication && window.MaskStatusUI, null, { timeout: 45000 });

  const res = await page.evaluate(() => {
    const checks = [];
    const ok = (name, cond, detail) => checks.push({ name, pass: !!cond, detail: detail || '' });
    const MA = window.MaskApplication, ENG = window.PhotoEditorBeautyEngine, UI = window.MaskStatusUI;

    // A. 게이트
    const G = MA._nailGatePass;
    const base = { status: 'ready', mask: new Float32Array([1]), sourceTier: 1, confidence: 0.8, coverage: 0.01 };
    ok('A1 정상 통과(Tier1·conf0.8·cov0.01)', G(Object.assign({}, base)) === true);
    ok('A2 conf<0.7 거부', G(Object.assign({}, base, { confidence: 0.6 })) === false);
    ok('A3 cov<0.0005 거부(너무 작음)', G(Object.assign({}, base, { coverage: 0.0001 })) === false);
    ok('A4 cov>0.08 거부(손 전체/배경)', G(Object.assign({}, base, { coverage: 0.1 })) === false);
    ok('A5 Tier3(휴리스틱) 거부', G(Object.assign({}, base, { sourceTier: 3 })) === false);
    ok('A6 status!=ready 거부', G(Object.assign({}, base, { status: 'noHand' })) === false);

    // C/D. 엔진 — 합성 패치(중앙=주피사체, 가장자리=배경)
    const W = 200, H = 140;
    function mk() {
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const c = cv.getContext('2d');
      c.fillStyle = 'rgb(60,60,62)'; c.fillRect(0, 0, W, H);                     // 배경(가장자리 포함)
      c.fillStyle = 'rgb(150,120,108)'; c.fillRect(W * 0.28, H * 0.40, W * 0.10, H * 0.18); // 매트 피부(중앙)
      c.fillStyle = 'rgb(233,233,238)'; c.fillRect(W * 0.40, H * 0.40, W * 0.10, H * 0.18); // 글리터/광택(중앙)
      c.fillStyle = 'rgb(205,180,172)'; c.fillRect(W * 0.52, H * 0.40, W * 0.10, H * 0.18); // 누드(중앙)
      return c;
    }
    const px = (c, x, y) => { const d = c.getImageData(Math.round(x * W), Math.round(y * H), 1, 1).data; return d[0] * 0.299 + d[1] * 0.587 + d[2] * 0.114; };
    const SAMP = { glitter: [0.45, 0.47], nude: [0.57, 0.47], skin: [0.33, 0.47], bgEdge: [0.02, 0.47] };
    function deltas(regionMasks) {
      const c = mk(); const pre = {}; Object.keys(SAMP).forEach(k => pre[k] = px(c, SAMP[k][0], SAMP[k][1]));
      ENG.apply(c, W, H, { nailGloss: 100 }, null, regionMasks);
      const out = {}; Object.keys(SAMP).forEach(k => out[k] = +(px(c, SAMP[k][0], SAMP[k][1]) - pre[k]).toFixed(2));
      return out;
    }
    const dNull = deltas(null);
    ok('C1 배경(edge) 번짐 0', Math.abs(dNull.bgEdge) < 1.5, 'bgEdge Δ=' + dNull.bgEdge);
    ok('C2 매트 피부 번짐 거의 0', Math.abs(dNull.skin) < 4, 'skin Δ=' + dNull.skin);
    ok('C3 글리터(광택) 효과 유지', dNull.glitter > 6, 'glitter Δ=' + dNull.glitter);
    ok('C4 누드 < 글리터 (과탐 없음)', dNull.nude < dNull.glitter, 'nude Δ=' + dNull.nude + ' glitter Δ=' + dNull.glitter);

    // 현실적 마스크: 네일(글리터) 영역에만 1 (게이트가 cov<0.08 로 손전체/배경 마스크는 reject → 국한 마스크가 정상)
    const nailM = new Float32Array(W * H);
    for (let y = Math.floor(H * 0.40); y < Math.floor(H * 0.58); y++) {
      for (let x = Math.floor(W * 0.40); x < Math.floor(W * 0.50); x++) nailM[y * W + x] = 1;
    }
    const dMask = deltas({ useMasks: { nailMask: nailM }, _scale: { nailMask: 1 }, maskW: W, maskH: H });
    ok('D1 nailMask(네일 한정) → 글리터 효과 ≥ 휴리스틱', dMask.glitter >= dNull.glitter - 0.5, 'mask=' + dMask.glitter + ' null=' + dNull.glitter);
    ok('D2 nailMask 네일 한정 → 배경(edge) 번짐 0', Math.abs(dMask.bgEdge) < 1.5, 'bgEdge Δ=' + dMask.bgEdge);

    // E. nailShape 적용 pageerror 0 (크래시 없음)
    let shapeOk = true;
    try { const c = mk(); ENG.apply(c, W, H, { nailShape: 100 }, null, { useMasks: { nailMask: nailM }, _scale: { nailMask: 1 }, maskW: W, maskH: H }); } catch (_e) { shapeOk = false; }
    ok('E1 nailShape 적용 크래시 없음', shapeOk);

    // F. handSkin 상태 — 고신뢰 stub 주입해도 정밀 아님
    const RP = window.RegionMaskProvider;
    const orig = RP.getStats;
    RP.getStats = () => ([{ maskType: 'handSkinMask', confidence: 0.95, status: 'ready', sourceTier: 1, coverage: 0.1 }]);
    let handRow;
    try { handRow = UI.buildModel({ originalImg: {} }).rows.find(r => r.id === 'handSkinMask'); } finally { RP.getStats = orig; }
    ok('F1 handSkin 고신뢰여도 정밀 적용됨 아님', handRow.status === '기본 보정으로 처리 중' && handRow.tone === 'fallback', handRow.status);
    ok('F2 handSkin 정직 안내(준비 중)', /준비 중/.test(handRow.detail));

    return checks;
  });

  // B. disable
  await page.evaluate(() => { try { localStorage.setItem('PE_NAIL_MASK_DISABLE', '1'); } catch (_e) { /* ignore */ } });
  const disabled = await page.evaluate(() => {
    const img = document.createElement('canvas'); img.width = 10; img.height = 10;
    return window.MaskApplication.getNailMaskSync(img);
  });
  res.push({ name: 'B1 PE_NAIL_MASK_DISABLE=1 → getNailMaskSync null', pass: disabled === null, detail: 'got ' + JSON.stringify(disabled) });
  await page.evaluate(() => { try { localStorage.removeItem('PE_NAIL_MASK_DISABLE'); } catch (_e) { /* ignore */ } });

  const severe = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK|Failed to load resource|ERR_|tfjs|WebGL|backend/i.test(e));
  res.push({ name: 'G1 severe pageerror 0', pass: severe.length === 0, detail: severe.join(' | ').slice(0, 200) });

  const pass = res.filter(c => c.pass).length, fail = res.length - pass;
  console.log(JSON.stringify({ checks: res, summary: pass + ' pass / ' + fail + ' fail' }, null, 2));
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
}
main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
