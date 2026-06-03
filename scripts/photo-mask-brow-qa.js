#!/usr/bin/env node
/* PE-M2 browMask QA 러너 (런타임 미수정, 합성 측정 전용, 실사진 0)

   자동 검증(얼굴 불필요):
     A. 와이어링 — MaskBrowAdapter / getBrowMaskSync / LAZY browMask / confidence 0.75
     B. 게이트 — _browGatePass: tier2/conf≥0.4/coverage 0.0003~0.04 경계(과도 coverage reject)
     C. 엔진 불변식 — browSharp=100 에서 (browMask 없음)==(빈 regionMasks) pixel-identical
     D. 엔진 기능 — browMask=1 → 샤픈 적용(원본과 다름), browMask=0 → 미적용(원본 동일)
     E. PE_BROW_MASK_DISABLE → getBrowMaskSync null
     F. pageerror 0
   ※ 눈썹 영역 정확도(눈/피부/배경 비번짐)는 MediaPipe 실사진 + overlay 수동 검증.
   실행: python3 -m http.server 8099 후 node scripts/photo-mask-brow-qa.js */

const { chromium } = require('playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=brow-qa';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 160)); });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.PhotoEditorBeautyEngine && window.MaskApplication && window.MaskConfidence, null, { timeout: 45000 });

  const res = await page.evaluate(() => {
    const checks = [];
    const ok = (name, cond, detail) => checks.push({ name, pass: !!cond, detail: detail || '' });
    const MA = window.MaskApplication, MC = window.MaskConfidence, RP = window.RegionMaskProvider, ENG = window.PhotoEditorBeautyEngine;

    // A. 와이어링
    ok('A1 MaskBrowAdapter loaded', !!(window.MaskBrowAdapter && typeof window.MaskBrowAdapter.browMask === 'function'));
    ok('A2 getBrowMaskSync export', typeof MA.getBrowMaskSync === 'function');
    ok('A3 LAZY browMask 등록', !!(RP && RP._LAZY_REGIONS && RP._LAZY_REGIONS.indexOf('browMask') >= 0));
    const conf = MC.compute('browMask', { status: 'ready', mask: new Float32Array([1]), sourceTier: 2, coverage: 0.01 });
    ok('A4 confidence(browMask,tier2)=0.75', conf === 0.75, 'got ' + conf);

    // B. 게이트
    const G = MA._browGatePass;
    const base = { status: 'ready', mask: new Float32Array([1]), sourceTier: 2, confidence: 0.75, coverage: 0.01 };
    ok('B1 정상 통과', G(Object.assign({}, base)) === true);
    ok('B2 coverage<min 거부', G(Object.assign({}, base, { coverage: 0.0001 })) === false);
    ok('B3 coverage>max 거부(번짐 추정)', G(Object.assign({}, base, { coverage: 0.05 })) === false);
    ok('B4 tier!=2 거부', G(Object.assign({}, base, { sourceTier: 3 })) === false);
    ok('B5 conf<0.4 거부', G(Object.assign({}, base, { confidence: 0.3 })) === false);
    ok('B6 status!=ready 거부', G(Object.assign({}, base, { status: 'fallback' })) === false);

    // C/D. 엔진 (하드 엣지 패턴으로 unsharp 효과 측정)
    const W = 120, H = 80;
    function edgeCanvas() {
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const c = cv.getContext('2d');
      c.fillStyle = 'rgb(80,80,80)'; c.fillRect(0, 0, W / 2, H);
      c.fillStyle = 'rgb(185,185,185)'; c.fillRect(W / 2, 0, W / 2, H);
      return c;
    }
    function sumRGB(c) { const d = c.getImageData(0, 0, W, H).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return s; }
    const B = { browSharp: 100 };
    const orig = sumRGB(edgeCanvas());

    let c = edgeCanvas(); ENG.apply(c, W, H, B, null, null); const sNull = sumRGB(c);
    c = edgeCanvas(); ENG.apply(c, W, H, B, null, { useMasks: {}, _scale: {}, maskW: W, maskH: H }); const sEmpty = sumRGB(c);
    ok('C1 browMask 없음: null == 빈 regionMasks (pixel-identical)', sNull === sEmpty, 'null=' + sNull + ' empty=' + sEmpty);

    const ones = new Float32Array(W * H).fill(1);
    const zeros = new Float32Array(W * H);
    c = edgeCanvas(); ENG.apply(c, W, H, B, null, { browMask: ones, browScale: 1, maskW: W, maskH: H }); const sOnes = sumRGB(c);
    c = edgeCanvas(); ENG.apply(c, W, H, B, null, { browMask: zeros, browScale: 1, maskW: W, maskH: H }); const sZeros = sumRGB(c);
    ok('D1 browMask=1 → 샤픈 적용(원본과 다름)', sOnes !== orig, 'ones=' + sOnes + ' orig=' + orig);
    ok('D2 browMask=0 → 미적용(원본 동일)', sZeros === orig, 'zeros=' + sZeros + ' orig=' + orig);
    ok('D3 browMask=1 ≠ browMask=0 (영역 게이트 작동)', sOnes !== sZeros, 'ones=' + sOnes + ' zeros=' + sZeros);

    return checks;
  });

  // E. disable flag
  await page.evaluate(() => { try { localStorage.setItem('PE_BROW_MASK_DISABLE', '1'); } catch (_e) { /* ignore */ } });
  const disabled = await page.evaluate(() => {
    const img = document.createElement('canvas'); img.width = 10; img.height = 10;
    return window.MaskApplication.getBrowMaskSync(img);
  });
  res.push({ name: 'E1 PE_BROW_MASK_DISABLE=1 → null', pass: disabled === null, detail: 'got ' + JSON.stringify(disabled) });
  await page.evaluate(() => { try { localStorage.removeItem('PE_BROW_MASK_DISABLE'); } catch (_e) { /* ignore */ } });

  const severe = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK|Failed to load resource|ERR_|tfjs|WebGL|backend/i.test(e));
  res.push({ name: 'F1 severe pageerror 0', pass: severe.length === 0, detail: severe.join(' | ').slice(0, 200) });

  const pass = res.filter(r => r.pass).length, fail = res.length - pass;
  console.log(JSON.stringify({ checks: res, summary: pass + ' pass / ' + fail + ' fail' }, null, 2));
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
}
main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
