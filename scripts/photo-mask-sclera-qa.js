#!/usr/bin/env node
/* PE-M1 scleraMask QA 러너 (런타임 미수정 — 합성 픽셀 측정 전용, 실사진 0)

   자동 검증(얼굴 불필요):
     A. 와이어링 — MaskScleraAdapter / getScleraMaskSync / LAZY 'scleraMask' / confidence 0.8
     B. 게이트   — _scleraGatePass: tier/conf/coverage(min 0.0002, max 0.03) 경계
     C. 엔진 불변식 — eyeRedness=100 에서 (regionMasks=null) == (scleraMask 미포함 빈 마스크) pixel-identical
     D. 게이트 동작 — scleraMask=0 → eyeRedness 억제(R 합 ↑), scleraMask=1 → 강화(R 합 ↓)  ≠ null
     E. PE_SCLERA_MASK_DISABLE=1 → getScleraMaskSync null
     F. pageerror 0 / T-160·T-161 hype 0

   ※ 흰자 영역정확도(정면/갈색눈/안경/측면/얼굴없음)는 MediaPipe 실사진 + overlay(PE_MASK_DEBUG=1) 수동 검증.
      → 자동 QA 는 "no-face → fallback → 게이트 제외" 경로만 확인(합성 캔버스엔 얼굴 없음).

   실행: python3 -m http.server 8099 후 node scripts/photo-mask-sclera-qa.js  (PHOTO_QA_URL 지정 가능) */

const { chromium } = require('playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=sclera-qa';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 160)); });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() =>
    window.PhotoEditorBeautyEngine && typeof window.PhotoEditorBeautyEngine.apply === 'function'
    && window.MaskApplication && window.MaskConfidence, null, { timeout: 45000 });

  const out = await page.evaluate(() => {
    const res = { checks: [], pass: 0, fail: 0 };
    const ok = (name, cond, detail) => { res.checks.push({ name, pass: !!cond, detail: detail || '' }); cond ? res.pass++ : res.fail++; };

    const MA = window.MaskApplication, MC = window.MaskConfidence, RP = window.RegionMaskProvider, ENG = window.PhotoEditorBeautyEngine;

    // ── A. 와이어링 ───────────────────────────────
    ok('A1 MaskScleraAdapter loaded', !!(window.MaskScleraAdapter && typeof window.MaskScleraAdapter.scleraMask === 'function'));
    ok('A2 getScleraMaskSync export', typeof MA.getScleraMaskSync === 'function');
    ok('A3 LAZY scleraMask 등록', !!(RP && RP._LAZY_REGIONS && RP._LAZY_REGIONS.indexOf('scleraMask') >= 0));
    const conf = MC.compute('scleraMask', { status: 'ready', mask: new Float32Array([1]), sourceTier: 2, coverage: 0.005 });
    ok('A4 confidence(scleraMask,tier2)=0.8', conf === 0.8, 'got ' + conf);

    // ── B. 게이트 경계 ─────────────────────────────
    const G = MA._scleraGatePass;
    const base = { status: 'ready', mask: new Float32Array([1]), sourceTier: 2, confidence: 0.8, coverage: 0.005 };
    ok('B1 정상 통과', G(Object.assign({}, base)) === true);
    ok('B2 coverage<min 거부', G(Object.assign({}, base, { coverage: 0.0001 })) === false);
    ok('B3 coverage>max 거부', G(Object.assign({}, base, { coverage: 0.05 })) === false);
    ok('B4 tier!=2 거부', G(Object.assign({}, base, { sourceTier: 3 })) === false);
    ok('B5 conf<0.4 거부', G(Object.assign({}, base, { confidence: 0.3 })) === false);
    ok('B6 status!=ready 거부', G(Object.assign({}, base, { status: 'fallback' })) === false);
    ok('B7 mask 없음 거부', G(Object.assign({}, base, { mask: null })) === false);

    // ── C/D. 엔진 불변식 + 게이트 동작 (합성 캔버스) ──
    const W = 80, H = 100;
    function makeCanvas() {
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d');
      // 배경 어두운 회색 + 눈높이(ny 0.30~0.47) 밴드: 밝은(lum≈139) 약붉은 중성 픽셀 → eyeW-fallback eyeRedness 발화
      ctx.fillStyle = 'rgb(60,60,62)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgb(142,138,137)'; ctx.fillRect(0, Math.round(H * 0.30), W, Math.round(H * 0.17));
      return ctx;
    }
    function sumR(ctx) { const d = ctx.getImageData(0, 0, W, H).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i]; return s; }
    const B = { eyeRedness: 100 };

    let ctx = makeCanvas(); ENG.apply(ctx, W, H, B, null, null); const sNull = sumR(ctx);
    ctx = makeCanvas(); ENG.apply(ctx, W, H, B, null, { useMasks: {}, _scale: {}, maskW: W, maskH: H }); const sEmpty = sumR(ctx);
    ok('C1 null == 빈마스크(scleraMask 미포함) pixel-identical', sNull === sEmpty, 'null=' + sNull + ' empty=' + sEmpty);

    const baseline = makeCanvas(); const sBaseline = sumR(baseline);  // 보정 전 R 합
    ok('C2 eyeRedness 실제 발화(검증 유효)', sNull < sBaseline, 'baseline=' + sBaseline + ' applied=' + sNull);

    const zero = new Float32Array(W * H);                 // scleraMask 전부 0 → 영역 게이트 닫힘
    const one = new Float32Array(W * H).fill(1);          // 전부 1 → 영역 게이트 열림
    ctx = makeCanvas(); ENG.apply(ctx, W, H, B, null, { useMasks: { scleraMask: zero }, _scale: { scleraMask: 1 }, maskW: W, maskH: H }); const sZero = sumR(ctx);
    ctx = makeCanvas(); ENG.apply(ctx, W, H, B, null, { useMasks: { scleraMask: one }, _scale: { scleraMask: 1 }, maskW: W, maskH: H }); const sOne = sumR(ctx);
    ok('D1 scleraMask=0 → eyeRedness 억제(R↑ vs null)', sZero > sNull, 'zero=' + sZero + ' null=' + sNull);
    ok('D2 scleraMask=0 == baseline(완전 무보정)', sZero === sBaseline, 'zero=' + sZero + ' baseline=' + sBaseline);
    ok('D3 scleraMask=1 → eyeRedness 강화(R↓ vs null)', sOne < sNull, 'one=' + sOne + ' null=' + sNull);

    return res;
  });

  // ── E. disable 플래그 ─────────────────────────
  await page.evaluate(() => { try { localStorage.setItem('PE_SCLERA_MASK_DISABLE', '1'); } catch (_e) { /* ignore */ } });
  const disabled = await page.evaluate(() => {
    const img = document.createElement('canvas'); img.width = 10; img.height = 10;
    return window.MaskApplication.getScleraMaskSync(img);   // disable → null
  });
  out.checks.push({ name: 'E1 PE_SCLERA_MASK_DISABLE=1 → null', pass: disabled === null, detail: 'got ' + JSON.stringify(disabled) });
  disabled === null ? out.pass++ : out.fail++;
  await page.evaluate(() => { try { localStorage.removeItem('PE_SCLERA_MASK_DISABLE'); } catch (_e) { /* ignore */ } });

  // ── F. 에러/hype ──────────────────────────────
  const severe = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK|Failed to load resource|ERR_|tfjs|WebGL|backend/i.test(e));
  out.checks.push({ name: 'F1 severe pageerror 0', pass: severe.length === 0, detail: severe.join(' | ').slice(0, 300) });
  severe.length === 0 ? out.pass++ : out.fail++;

  out.severeErrors = severe;
  out.summary = out.pass + ' pass / ' + out.fail + ' fail';
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
  process.exit(out.fail === 0 ? 0 : 1);
}
main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
