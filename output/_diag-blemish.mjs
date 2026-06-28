import { chromium } from 'playwright';
const PORT = process.env.QA_PORT || '8091';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('http://localhost:' + PORT + '/output/_diag-effects.html', { waitUntil: 'load' });
const out = await p.evaluate(() => {
  const W = 120, H = 120;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#ebc8b0'; ctx.fillRect(0, 0, W, H);            // 피부 전면
  // 잡티: 주변보다 ~25 어두운 작은 점들
  ctx.fillStyle = '#c3a48f';
  const dots = [[30, 30], [60, 50], [80, 80], [45, 70]];
  dots.forEach(([x, y]) => ctx.fillRect(x, y, 5, 5));
  // skinW 측정 (SmartMask)
  const SM = window.PhotoEditorSmartMask;
  let skinWsamples = [];
  if (SM && SM.classify) {
    [[10, 10], [60, 60]].forEach(([x, y]) => {
      const id = ctx.getImageData(x, y, 1, 1).data;
      const r = id[0], g = id[1], bl = id[2], lum = r * .299 + g * .587 + bl * .114;
      const pr = SM.classify({ r, g, b: bl, lum, maxCh: Math.max(r, g, bl), minCh: Math.min(r, g, bl), x, y, w: W, h: H });
      skinWsamples.push({ at: [x, y], skin: +(pr.skin || 0).toFixed(3) });
    });
  }
  // blemish 적용 — 점 위 최대 델타 측정
  const before = ctx.getImageData(0, 0, W, H).data.slice();
  window.PhotoEditorBeautyEngine.apply(ctx, W, H, { blemish: 100 }, false, null);
  const after = ctx.getImageData(0, 0, W, H).data;
  let maxDelta = 0, dotDelta = 0, dn = 0;
  dots.forEach(([x, y]) => {
    for (let yy = y; yy < y + 5; yy++) for (let xx = x; xx < x + 5; xx++) {
      const i = (yy * W + xx) * 4;
      const dd = Math.abs(after[i] - before[i]) + Math.abs(after[i + 1] - before[i + 1]) + Math.abs(after[i + 2] - before[i + 2]);
      dotDelta += dd; dn++; if (dd > maxDelta) maxDelta = dd;
    }
  });
  return { skinWsamples, maxDotDelta: maxDelta, meanDotDelta: +(dotDelta / dn).toFixed(2) };
});
console.log(JSON.stringify(out, null, 2));
await b.close();
