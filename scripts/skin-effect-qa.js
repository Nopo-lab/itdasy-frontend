#!/usr/bin/env node
/* T-151/152/153 피부 핵심 효과 의미기반 QA (1회성, 런타임 미수정)
   원본 풀해상도 오프스크린에 엔진 직접 적용 → 얼굴 영역 crop + before/after side-by-side.
   영역별 diff 로 "기능명대로 + edge 보존 + 얼굴 전체 X" 판정. 실사진 env 주입(커밋 금지).
   실행: python3 -m http.server 8099 후 FACE_IMG=<얼굴.jpg> node scripts/skin-effect-qa.js */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'output', 'playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=skinqa';
const FACE_IMG = process.env.FACE_IMG;
if (!FACE_IMG) { console.error('사용법: FACE_IMG=<얼굴.jpg> node scripts/skin-effect-qa.js'); process.exit(2); }
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
      for (const t of ['skinMask', 'hairMask', 'lipMask', 'eyeMask']) { try { await RP.getMask(img, t); } catch (_e) { void _e; } }
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
    window.__bboxOf = function (maskKey, th) {
      const img = window.__img; const rm = window.MaskApplication.getMasksForBeautySync(img);
      if (!rm || !rm.useMasks || !rm.useMasks[maskKey]) return null;
      const m = rm.useMasks[maskKey], mw = rm.maskW, mh = rm.maskH; const t = th || 0.25;
      let minX = mw, minY = mh, maxX = -1, maxY = -1;
      for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) { if (m[y * mw + x] > t) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; } }
      if (maxX < 0) return null;
      const sx = img.naturalWidth / mw, sy = img.naturalHeight / mh;
      return { x: minX * sx, y: minY * sy, w: (maxX - minX + 1) * sx, h: (maxY - minY + 1) * sy };
    };
    window.__diff = function (baseCv, modCv, regions) {
      const w = baseCv.width, h = baseCv.height;
      const a = baseCv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
      const b = modCv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
      const box = (r) => { const x0 = Math.max(0, (r[0] * w) | 0), y0 = Math.max(0, (r[1] * h) | 0), x1 = Math.min(w, ((r[0] + r[2]) * w) | 0), y1 = Math.min(h, ((r[1] + r[3]) * h) | 0); let s = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * w + x) * 4; s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); n++; } return n ? +(s / (n * 3)).toFixed(2) : 0; };
      let fs = 0, fn = 0; for (let i = 0; i < a.length; i += 16) { fs += Math.abs(a[i] - b[i]); fn++; }
      const out = { full: +(fs / fn).toFixed(2) }; for (const k in regions) out[k] = box(regions[k]); return out;
    };
    window.__crop = function (cv, box, scale) { const sc = scale || 2; const out = document.createElement('canvas'); out.width = Math.round(box.w * sc); out.height = Math.round(box.h * sc); const ctx = out.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.drawImage(cv, box.x, box.y, box.w, box.h, 0, 0, out.width, out.height); return out.toDataURL('image/png'); };
    window.__sbs = function (urls) { return new Promise((resolve) => { const imgs = urls.map(u => { const i = new Image(); i.src = u; return i; }); Promise.all(imgs.map(i => new Promise(r => { if (i.complete) r(); else i.onload = r; }))).then(() => { const gap = 8, h = Math.max(...imgs.map(i => i.height)); const w = imgs.reduce((a, i) => a + i.width, 0) + gap * (imgs.length - 1); const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const ctx = cv.getContext('2d'); ctx.fillStyle = '#222'; ctx.fillRect(0, 0, w, h); let x = 0; for (const i of imgs) { ctx.drawImage(i, x, 0); x += i.width + gap; } resolve(cv.toDataURL('image/png')); }); }); };
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.PhotoEditorBeautyEngine && window.RegionMaskProvider && window.MaskApplication, null, { timeout: 45000 });
  await page.waitForTimeout(1200);

  const report = { cases: {}, severeErrors: [] };
  const save = (durl, name) => fs.writeFileSync(path.join(OUT, name), Buffer.from(durl.split(',')[1], 'base64'));
  const meta = await page.evaluate(s => window.__loadMasks(s), dataUrl(FACE_IMG));
  const sb = await page.evaluate(() => window.__bboxOf('skinMask', 0.4));
  const eb = await page.evaluate(() => window.__bboxOf('eyeMask', 0.25));
  const lb = await page.evaluate(() => window.__bboxOf('lipMask', 0.2));
  report.meta = { ...meta, skinBox: sb, eyeBox: eb };
  if (!sb) { report.cases = { err: 'no skinMask bbox' }; console.log(JSON.stringify(report, null, 2)); await browser.close(); return; }

  // ROI(원본 정규화): 뺨(피부결), 이마, 눈밑(eyeMask 아래), edge(눈/입 윤곽), 배경
  const nx = sb.x / meta.w, ny = sb.y / meta.h, nw = sb.w / meta.w, nh = sb.h / meta.h;
  const cheek = [nx + nw * 0.1, ny + nh * 0.55, nw * 0.3, nh * 0.2];
  const forehead = [nx + nw * 0.3, ny + nh * 0.08, nw * 0.4, nh * 0.12];
  const R = { cheek, forehead, full: [0, 0, 1, 1], bg: [0.02, 0.02, 0.1, 0.1] };
  if (eb) {
    R.underEye = [eb.x / meta.w, (eb.y + eb.h) / meta.h, eb.w / meta.w, eb.h / meta.h * 0.7];
    R.eyeball = [eb.x / meta.w, eb.y / meta.h, eb.w / meta.w, eb.h / meta.h];     // 오염 확인
  }
  if (lb) R.lipEdge = [lb.x / meta.w, lb.y / meta.h, lb.w / meta.w, lb.h / meta.h]; // edge 보존 확인
  // 눈/입 윤곽 edge ROI (textureSmooth 보존 확인) — eyeBox 사용
  if (eb) R.eyeEdge = [eb.x / meta.w, eb.y / meta.h, eb.w / meta.w, eb.h / meta.h];

  const cropBox = sb;  // 얼굴 전체 crop
  const runOne = async (beautyObj, tag) => {
    const res = await page.evaluate(({ R, cropBox, beautyObj }) => {
      const base = window.__renderFull({}); const mod = window.__renderFull(beautyObj);
      return { d: window.__diff(base, mod, R), b: window.__crop(base, cropBox, 2), m: window.__crop(mod, cropBox, 2) };
    }, { R, cropBox, beautyObj });
    const sbs = await page.evaluate(([a, b]) => window.__sbs([a, b]), [res.b, res.m]);
    save(res.b, `skin_${tag}_before.png`); save(res.m, `skin_${tag}_after.png`); save(sbs, `skin_${tag}_sbs.png`);
    return res.d;
  };

  report.cases.underEyeClean = await runOne({ underEyeClean: 100 }, 'undereye');
  report.cases.eyeShadow = await runOne({ eyeShadow: 100 }, 'eyeshadow');
  report.cases.textureSmooth = await runOne({ textureSmooth: 100 }, 'texture');
  report.cases.blemish = await runOne({ blemish: 100 }, 'blemish');

  report.severeErrors = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK/i.test(e));
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
}

main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
