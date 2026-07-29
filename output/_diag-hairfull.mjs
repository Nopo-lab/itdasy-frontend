import { chromium } from 'playwright';
const PORT = process.env.QA_PORT || '8091';
const b = await chromium.launch();
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
await p.goto('http://localhost:' + PORT + '/output/_diag-effects.html', { waitUntil: 'load' });
const out = await p.evaluate(() => {
  const W = 200, H = 200;
  function synthHair() {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#b9bcc2'; ctx.fillRect(0, 0, W, H);            // 배경(머리 아님)
    ctx.fillStyle = '#4a3526'; ctx.fillRect(40, 10, 120, 170);     // 머리 블록(갈색)
    // 빈틈(밝은 두피 비침) + 노이즈 가닥
    const img = ctx.getImageData(40, 10, 120, 170), d = img.data; let s = 11;
    for (let i = 0; i < d.length; i += 4) { s = (s * 1103515245 + 12345) & 0x7fffffff; const n = ((s % 100) - 50) / 50 * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    ctx.putImageData(img, 40, 10);
    ctx.fillStyle = '#a98f74'; ctx.fillRect(70, 30, 10, 10); ctx.fillRect(110, 60, 8, 8); // 빈틈
    return { cv, ctx, hairRoi: { x: 40, y: 10, w: 120, h: 170 }, bgRoi: { x: 2, y: 2, w: 30, h: 30 } };
  }
  function meanAbs(a, bData, roi) {
    let sum = 0, n = 0;
    for (let y = roi.y; y < roi.y + roi.h; y++) for (let x = roi.x; x < roi.x + roi.w; x++) {
      const i = (y * W + x) * 4;
      sum += Math.abs(a[i] - bData[i]) + Math.abs(a[i + 1] - bData[i + 1]) + Math.abs(a[i + 2] - bData[i + 2]); n += 3;
    }
    return +(sum / n).toFixed(3);
  }
  const eng = window.PhotoEditorBeautyEngine;
  const res = {};
  for (const strength of [0, 50, 100]) {
    const { cv, ctx, hairRoi, bgRoi } = synthHair();
    const before = ctx.getImageData(0, 0, W, H).data.slice();
    eng.apply(ctx, W, H, { hairFull: strength }, false, null);
    const after = ctx.getImageData(0, 0, W, H).data;
    res['s' + strength] = { hair: meanAbs(before, after, hairRoi), bg: meanAbs(before, after, bgRoi) };
  }
  return res;
});
console.log('hairFull synthetic (hair ROI delta / background pollution):');
console.log(JSON.stringify(out, null, 2));
if (errs.length) console.log('ERRORS:', errs);
await b.close();
