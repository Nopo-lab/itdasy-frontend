#!/usr/bin/env node
/* T-144/145/146 의미기반 close-up QA (1회성, 런타임 미수정)
   원본 풀해상도 오프스크린에 엔진(PhotoEditorBeautyEngine.apply) 직접 적용 → 대상 마스크 bbox 로
   고해상도 crop + before/after side-by-side. 영역별 diff(target/주변/배경/full)로 "기능명대로 변화 +
   침범 없음" 판정. 실사진 env 주입(커밋 금지).

   실행: python3 -m http.server 8099 후
     NAIL_IMG=<네일> FACE_IMG=<얼굴> node scripts/feature-effect-qa.js
   (NAIL_IMG → nailShape / FACE_IMG → lipPop·eyeColor) */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'output', 'playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=featqa';
const NAIL_IMG = process.env.NAIL_IMG;
const FACE_IMG = process.env.FACE_IMG;

if (!NAIL_IMG && !FACE_IMG) { console.error('사용법: NAIL_IMG=<네일.jpg> FACE_IMG=<얼굴.jpg> node scripts/feature-effect-qa.js'); process.exit(2); }
function dataUrl(p) { const b = fs.readFileSync(p); const e = p.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'; return `data:image/${e};base64,${b.toString('base64')}`; }

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 140)); });

  await page.addInitScript(() => {
    window.__loadMasks = async function (src) {
      const img = await new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
      window.__img = img;
      const RP = window.RegionMaskProvider;
      for (const t of ['skinMask', 'hairMask', 'lipMask', 'eyeMask', 'hairBoundaryMask', 'nailMask']) { try { await RP.getMask(img, t); } catch (_e) { void _e; } }
      await new Promise(r => setTimeout(r, 300));
      const MA = window.MaskApplication; const rm = MA && MA.getMasksForBeautySync ? MA.getMasksForBeautySync(img) : null;
      return { w: img.naturalWidth, h: img.naturalHeight, keys: rm ? Object.keys(rm.useMasks || {}) : [], maskW: rm && rm.maskW, maskH: rm && rm.maskH };
    };
    window.__renderFull = function (beautyObj) {
      const img = window.__img, w = img.naturalWidth, h = img.naturalHeight;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0, w, h);
      const MA = window.MaskApplication; const rm = MA && MA.getMasksForBeautySync ? MA.getMasksForBeautySync(img) : null;
      window.PhotoEditorBeautyEngine.apply(ctx, w, h, beautyObj, false, rm);
      return cv;
    };
    // 마스크 bbox(원본 좌표). maskKey 없으면(nail no-hand 등) null → 색기반 추정 bbox 사용.
    window.__bboxOf = function (maskKey, thresh) {
      const img = window.__img; const MA = window.MaskApplication; const rm = MA.getMasksForBeautySync(img);
      if (!rm || !rm.useMasks || !rm.useMasks[maskKey]) return null;
      const m = rm.useMasks[maskKey], mw = rm.maskW, mh = rm.maskH; const th = thresh || 0.25;
      let minX = mw, minY = mh, maxX = -1, maxY = -1;
      for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) { if (m[y * mw + x] > th) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; } }
      if (maxX < 0) return null;
      const sx = img.naturalWidth / mw, sy = img.naturalHeight / mh;
      return { x: minX * sx, y: minY * sy, w: (maxX - minX + 1) * sx, h: (maxY - minY + 1) * sy };
    };
    window.__diffCanvas = function (baseCv, modCv, regions) {
      const w = baseCv.width, h = baseCv.height;
      const a = baseCv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
      const b = modCv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
      const box = (r) => { const x0 = Math.max(0, (r[0] * w) | 0), y0 = Math.max(0, (r[1] * h) | 0), x1 = Math.min(w, ((r[0] + r[2]) * w) | 0), y1 = Math.min(h, ((r[1] + r[3]) * h) | 0); let s = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * w + x) * 4; s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); n++; } return n ? +(s / (n * 3)).toFixed(2) : 0; };
      let fs = 0, fn = 0; for (let i = 0; i < a.length; i += 16) { fs += Math.abs(a[i] - b[i]); fn++; }
      const out = { full: +(fs / fn).toFixed(2) }; for (const k in regions) out[k] = box(regions[k]); return out;
    };
    window.__crop = function (cv, box, scale) { const sc = scale || 3; const out = document.createElement('canvas'); out.width = Math.round(box.w * sc); out.height = Math.round(box.h * sc); const ctx = out.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.drawImage(cv, box.x, box.y, box.w, box.h, 0, 0, out.width, out.height); return out.toDataURL('image/png'); };
    window.__sbs = function (urls) { return new Promise((resolve) => { const imgs = urls.map(u => { const i = new Image(); i.src = u; return i; }); Promise.all(imgs.map(i => new Promise(r => { if (i.complete) r(); else i.onload = r; }))).then(() => { const gap = 8, h = Math.max(...imgs.map(i => i.height)); const w = imgs.reduce((a, i) => a + i.width, 0) + gap * (imgs.length - 1); const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const ctx = cv.getContext('2d'); ctx.fillStyle = '#222'; ctx.fillRect(0, 0, w, h); let x = 0; for (const i of imgs) { ctx.drawImage(i, x, 0); x += i.width + gap; } resolve(cv.toDataURL('image/png')); }); }); };
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.PhotoEditorBeautyEngine && window.RegionMaskProvider && window.MaskApplication, null, { timeout: 45000 });
  await page.waitForTimeout(1200);

  const report = { cases: {}, severeErrors: [] };
  const save = (durl, name) => fs.writeFileSync(path.join(OUT, name), Buffer.from(durl.split(',')[1], 'base64'));

  // ── nailShape (네일 사진) ──
  if (NAIL_IMG) {
    const meta = await page.evaluate(s => window.__loadMasks(s), dataUrl(NAIL_IMG));
    // nailMask 없으면(no-hand) 손 중앙 영역을 target box 로(휴리스틱 nailW 영역 근사: 상단 중앙 손톱)
    let bb = await page.evaluate(() => window.__bboxOf('nailMask', 0.25));
    const usedColorBox = !bb;
    if (!bb) bb = { x: meta.w * 0.2, y: meta.h * 0.05, w: meta.w * 0.6, h: meta.h * 0.45 };  // 손톱 추정(상단)
    const nx = bb.x / meta.w, ny = bb.y / meta.h, nw = bb.w / meta.w, nh = bb.h / meta.h;
    const R = { nailEdge: [nx, ny, nw, nh], fingerSkin: [nx, Math.min(0.95, ny + nh * 1.1), nw, nh * 0.6], bg: [0.02, 0.02, 0.1, 0.1] };
    const cb = { x: Math.max(0, bb.x - bb.w * 0.1), y: Math.max(0, bb.y - bb.h * 0.1), w: Math.min(meta.w, bb.w * 1.2), h: Math.min(meta.h, bb.h * 1.2) };
    const res = await page.evaluate(({ R, cb }) => { const base = window.__renderFull({}); const mod = window.__renderFull({ nailShape: 100 }); return { d: window.__diffCanvas(base, mod, R), b: window.__crop(base, cb, 2), m: window.__crop(mod, cb, 2) }; }, { R, cb });
    const sbs = await page.evaluate(([a, b]) => window.__sbs([a, b]), [res.b, res.m]);
    save(res.b, 'feat_nail_before_crop.png'); save(res.m, 'feat_nail_after_crop.png'); save(sbs, 'feat_nail_sbs.png');
    report.cases.nailShape = { meta, usedColorBox, diff: res.d };
  }

  // ── lipPop / eyeColor (얼굴 사진) ──
  if (FACE_IMG) {
    const meta = await page.evaluate(s => window.__loadMasks(s), dataUrl(FACE_IMG));
    // lipPop
    const lb = await page.evaluate(() => window.__bboxOf('lipMask', 0.2));
    if (lb) {
      const nx = lb.x / meta.w, ny = lb.y / meta.h, nw = lb.w / meta.w, nh = lb.h / meta.h;
      const R = { lip: [nx, ny, nw, nh], aroundSkin: [nx, Math.min(0.95, ny + nh * 1.3), nw, nh], teethArea: [nx + nw * 0.25, ny + nh * 0.3, nw * 0.5, nh * 0.4], bg: [0.02, 0.02, 0.1, 0.1] };
      const cb = { x: Math.max(0, lb.x - lb.w * 0.3), y: Math.max(0, lb.y - lb.h * 0.6), w: Math.min(meta.w, lb.w * 1.6), h: Math.min(meta.h, lb.h * 2.2) };
      const res = await page.evaluate(({ R, cb }) => { const base = window.__renderFull({}); const mod = window.__renderFull({ lipPop: 100 }); return { d: window.__diffCanvas(base, mod, R), b: window.__crop(base, cb, 3), m: window.__crop(mod, cb, 3) }; }, { R, cb });
      const sbs = await page.evaluate(([a, b]) => window.__sbs([a, b]), [res.b, res.m]);
      save(res.b, 'feat_lip_before_crop.png'); save(res.m, 'feat_lip_after_crop.png'); save(sbs, 'feat_lip_sbs.png');
      report.cases.lipPop = { lipBox: { x: Math.round(lb.x), y: Math.round(lb.y), w: Math.round(lb.w), h: Math.round(lb.h) }, diff: res.d };
    } else report.cases.lipPop = { err: 'no lipMask bbox' };
    // eyeColor
    const eb = await page.evaluate(() => window.__bboxOf('eyeMask', 0.25));
    if (eb) {
      const nx = eb.x / meta.w, ny = eb.y / meta.h, nw = eb.w / meta.w, nh = eb.h / meta.h;
      const R = { lid: [nx, Math.max(0, ny - nh * 0.6), nw, nh * 0.6], eyeball: [nx, ny, nw, nh], cheek: [nx, Math.min(0.95, ny + nh * 1.8), nw, nh], bg: [0.02, 0.02, 0.1, 0.1] };
      const cb = { x: Math.max(0, eb.x - eb.w * 0.2), y: Math.max(0, eb.y - eb.h * 1.4), w: Math.min(meta.w, eb.w * 1.4), h: Math.min(meta.h, eb.h * 3.2) };
      const res = await page.evaluate(({ R, cb }) => { const base = window.__renderFull({}); const mod = window.__renderFull({ eyeColor: 100 }); return { d: window.__diffCanvas(base, mod, R), b: window.__crop(base, cb, 3), m: window.__crop(mod, cb, 3) }; }, { R, cb });
      const sbs = await page.evaluate(([a, b]) => window.__sbs([a, b]), [res.b, res.m]);
      save(res.b, 'feat_eyecolor_before_crop.png'); save(res.m, 'feat_eyecolor_after_crop.png'); save(sbs, 'feat_eyecolor_sbs.png');
      report.cases.eyeColor = { eyeBox: { x: Math.round(eb.x), y: Math.round(eb.y), w: Math.round(eb.w), h: Math.round(eb.h) }, diff: res.d };
    } else report.cases.eyeColor = { err: 'no eyeMask bbox' };
  }

  report.severeErrors = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK/i.test(e));
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
}

main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
