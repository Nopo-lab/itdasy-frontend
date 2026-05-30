#!/usr/bin/env node
/* T-142/T-143 눈 효과 close-up QA (1회성, 런타임 미수정)
   ⚠️ PhotoEditor 캔버스는 letterbox 라 눈이 44×15px 로 작아 육안 불가.
   → 원본 이미지를 풀해상도 오프스크린 캔버스에 그리고 동일 엔진(PhotoEditorBeautyEngine.apply)을
     직접 적용 → eyeMask bbox(원본 좌표)로 눈 영역 고해상도 crop → before/after/side-by-side 저장.
   의미 기준: eye/upperEye ROI diff > cheek/bg diff, full diff 낮음. 실사진 env 주입(커밋 금지).

   실행: python3 -m http.server 8099 후 EYE_FACE=<정면 얼굴.jpg> node scripts/eye-effect-qa.js */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'output', 'playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=eyeqa';
const PHOTOS = {};
if (process.env.EYE_FACE) PHOTOS.face1 = process.env.EYE_FACE;
if (process.env.EYE_FACE2) PHOTOS.face2 = process.env.EYE_FACE2;

function usage() { console.error('사용법: EYE_FACE=<정면 얼굴.jpg> [EYE_FACE2=..] node scripts/eye-effect-qa.js (실사진 커밋 금지)'); process.exit(2); }
function dataUrl(p) { const b = fs.readFileSync(p); const e = p.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'; return `data:image/${e};base64,${b.toString('base64')}`; }

async function main() {
  if (!PHOTOS.face1) usage();
  for (const [k, p] of Object.entries(PHOTOS)) if (!fs.existsSync(p)) { console.error('사진 없음:', k, p); process.exit(2); }
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 140)); });

  await page.addInitScript(() => {
    window.__loadMasks = async function (src) {
      // 이미지 로드 + RegionMaskProvider 로 마스크 캐시(클라이언트 MediaPipe). 원본 좌표 마스크 확보.
      const img = await new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
      window.__img = img;
      // RegionMaskProvider.getMask 로 eyeMask 강제 생성(캐시)
      const RP = window.RegionMaskProvider;
      for (const t of ['skinMask', 'hairMask', 'lipMask', 'eyeMask', 'hairBoundaryMask']) {
        try { await RP.getMask(img, t); } catch (_e) { void _e; }
      }
      await new Promise(r => setTimeout(r, 300));
      const MA = window.MaskApplication;
      const rm = MA && MA.getMasksForBeautySync ? MA.getMasksForBeautySync(img) : null;
      return { w: img.naturalWidth, h: img.naturalHeight, hasEye: !!(rm && rm.useMasks && rm.useMasks.eyeMask), maskW: rm && rm.maskW, maskH: rm && rm.maskH };
    };
    // 원본 풀해상도 오프스크린에 엔진 직접 적용. beauty 객체 적용본 캔버스 반환(전역 보관).
    window.__renderFull = function (beautyObj) {
      const img = window.__img, w = img.naturalWidth, h = img.naturalHeight;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      const MA = window.MaskApplication;
      const rm = MA && MA.getMasksForBeautySync ? MA.getMasksForBeautySync(img) : null;
      let rm2 = rm;
      if (beautyObj.lashSharp && MA && MA.getLashMaskSync) {  // lashMask 있으면 합쳐줌(실제 경로 동일)
        try { const lash = MA.getLashMaskSync(img); if (lash) { rm2 = Object.assign({}, rm); rm2.lashMask = lash.mask; rm2.lashScale = lash.scale; } } catch (_e) { void _e; }
      }
      window.PhotoEditorBeautyEngine.apply(ctx, w, h, beautyObj, false, rm2);
      return cv;
    };
    // eyeMask bbox(원본 좌표). 임계 0.25.
    window.__eyeBoxOrig = function () {
      const img = window.__img; const MA = window.MaskApplication;
      const rm = MA.getMasksForBeautySync(img); if (!rm || !rm.useMasks || !rm.useMasks.eyeMask) return null;
      const m = rm.useMasks.eyeMask, mw = rm.maskW, mh = rm.maskH;
      let minX = mw, minY = mh, maxX = -1, maxY = -1;
      for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) { if (m[y * mw + x] > 0.25) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; } }
      if (maxX < 0) return null;
      const sx = img.naturalWidth / mw, sy = img.naturalHeight / mh;
      return { x: minX * sx, y: minY * sy, w: (maxX - minX + 1) * sx, h: (maxY - minY + 1) * sy, iw: img.naturalWidth, ih: img.naturalHeight };
    };
    // 두 캔버스(base, mod)의 영역 diff. region=[x,y,w,h] 정규화(원본 기준)
    window.__diffCanvas = function (baseCv, modCv, regions) {
      const w = baseCv.width, h = baseCv.height;
      const a = baseCv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
      const b = modCv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
      const box = (r) => { const x0 = (r[0] * w) | 0, y0 = (r[1] * h) | 0, x1 = ((r[0] + r[2]) * w) | 0, y1 = ((r[1] + r[3]) * h) | 0; let s = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * w + x) * 4; s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); n++; } return n ? +(s / (n * 3)).toFixed(2) : 0; };
      let fs = 0, fn = 0; for (let i = 0; i < a.length; i += 16) { fs += Math.abs(a[i] - b[i]); fn++; }
      const out = { full: +(fs / fn).toFixed(2) }; for (const k in regions) out[k] = box(regions[k]); return out;
    };
    // crop: 원본 좌표 박스를 확대(scale배)해 dataURL 반환
    window.__crop = function (cv, box, scale) {
      const sc = scale || 3;
      const out = document.createElement('canvas'); out.width = Math.round(box.w * sc); out.height = Math.round(box.h * sc);
      const ctx = out.getContext('2d'); ctx.imageSmoothingEnabled = true;
      ctx.drawImage(cv, box.x, box.y, box.w, box.h, 0, 0, out.width, out.height);
      return out.toDataURL('image/png');
    };
    // side-by-side: [before, catch, lash] crop 가로 결합
    window.__sideBySide = function (cropUrls) {
      return new Promise((resolve) => {
        const imgs = cropUrls.map(u => { const i = new Image(); i.src = u; return i; });
        Promise.all(imgs.map(i => new Promise(r => { if (i.complete) r(); else i.onload = r; }))).then(() => {
          const gap = 8, h = Math.max(...imgs.map(i => i.height));
          const w = imgs.reduce((a, i) => a + i.width, 0) + gap * (imgs.length - 1);
          const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          const ctx = cv.getContext('2d'); ctx.fillStyle = '#222'; ctx.fillRect(0, 0, w, h);
          let x = 0; for (const i of imgs) { ctx.drawImage(i, x, 0); x += i.width + gap; }
          resolve(cv.toDataURL('image/png'));
        });
      });
    };
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.PhotoEditorBeautyEngine && window.RegionMaskProvider && window.MaskApplication, null, { timeout: 45000 });
  await page.waitForTimeout(1200);

  const report = { cases: {}, severeErrors: [] };
  const saveDataUrl = (durl, name) => { const b64 = durl.split(',')[1]; fs.writeFileSync(path.join(OUT, name), Buffer.from(b64, 'base64')); };

  for (const key of Object.keys(PHOTOS)) {
    const meta = await page.evaluate(s => window.__loadMasks(s), dataUrl(PHOTOS[key]));
    if (!meta.hasEye) { report.cases[key] = { err: 'no eyeMask', meta }; continue; }
    const eb = await page.evaluate(() => window.__eyeBoxOrig());
    if (!eb) { report.cases[key] = { err: 'no eyeMask bbox', meta }; continue; }
    // 원본 정규화 ROI
    const nx = eb.x / eb.iw, ny = eb.y / eb.ih, nw = eb.w / eb.iw, nh = eb.h / eb.ih;
    const R = { eye: [nx, ny, nw, nh], upperEye: [nx, ny, nw, nh * 0.45], cheek: [nx, Math.min(0.96, ny + nh * 1.6), nw, nh], bg: [0.02, 0.02, 0.1, 0.1] };
    // crop box: 눈 주변 여유(가로 50%, 세로 120%)
    const cb = { x: Math.max(0, eb.x - eb.w * 0.5), y: Math.max(0, eb.y - eb.h * 1.2), w: Math.min(eb.iw, eb.w * 2), h: Math.min(eb.ih, eb.h * 3.4) };

    // 렌더 3종 + diff + crop (브라우저 안에서 캔버스 보관)
    const res = await page.evaluate(({ R, cb }) => {
      const base = window.__renderFull({});
      const cat = window.__renderFull({ catchLight: 100 });
      const lash = window.__renderFull({ lashSharp: 100 });
      const dCat = window.__diffCanvas(base, cat, R);
      const dLash = window.__diffCanvas(base, lash, R);
      return {
        dCat, dLash,
        cropBefore: window.__crop(base, cb, 3),
        cropCat: window.__crop(cat, cb, 3),
        cropLash: window.__crop(lash, cb, 3),
      };
    }, { R, cb });
    const sbsCat = await page.evaluate(([a, b]) => window.__sideBySide([a, b]), [res.cropBefore, res.cropCat]);
    const sbsLash = await page.evaluate(([a, b]) => window.__sideBySide([a, b]), [res.cropBefore, res.cropLash]);

    saveDataUrl(res.cropBefore, `eye_${key}_BEFORE_crop.png`);
    saveDataUrl(res.cropCat, `eye_${key}_catchlight_crop.png`);
    saveDataUrl(res.cropLash, `eye_${key}_lashsharp_crop.png`);
    saveDataUrl(sbsCat, `eye_${key}_catchlight_sbs.png`);
    saveDataUrl(sbsLash, `eye_${key}_lashsharp_sbs.png`);

    report.cases[key] = { meta, eyeBox: { x: Math.round(eb.x), y: Math.round(eb.y), w: Math.round(eb.w), h: Math.round(eb.h) }, catchLight: res.dCat, lashSharp: res.dLash };
  }
  report.severeErrors = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK/i.test(e));
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
}

main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
