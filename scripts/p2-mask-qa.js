#!/usr/bin/env node
/* P2 마스크 의존 슬라이더 실사진 재검증 (1회성, 프로덕션 코드 미수정)
   T-118 합성 사진 한계로 약하게 측정된 마스크 의존 슬라이더를 실제 인물/뷰티 사진으로 재검증.
   RegionMaskQA.runOnCurrentImage() 로 마스크 tier/coverage/confidence/번짐(fpChecks)을 기록하고,
   각 슬라이더 0→max canvas pixel diff(대상영역/배경/피부비대상)를 측정.

   ⚠️ 사용 사진은 로컬 전용(커밋 금지). 외부 API 과금/업로드 없음. 강도 조정 없음(검증만).

   실사진 경로는 env 로 주입한다(하드코딩·커밋 금지):
     P2_FACE=<정면 얼굴>  P2_HAIR=<헤어>  P2_NAIL=<네일/손>  \
     [P2_EYE=<눈 클로즈업>] [P2_LIP=<입술 클로즈업>] \
     python3 -m http.server 8099 (레포 루트) 후
     P2_FACE=... P2_HAIR=... P2_NAIL=... node scripts/p2-mask-qa.js */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'output', 'playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&mask_debug=1&v=p2';

// 실사진 경로는 env 주입(로컬 전용 — 커밋 금지). face/hair/nail 필수, eye/lip optional.
const PHOTOS = {};
if (process.env.P2_FACE) PHOTOS.face = process.env.P2_FACE;
if (process.env.P2_HAIR) PHOTOS.hair = process.env.P2_HAIR;
if (process.env.P2_NAIL) PHOTOS.nail = process.env.P2_NAIL;
if (process.env.P2_EYE) PHOTOS.eye = process.env.P2_EYE;
if (process.env.P2_LIP) PHOTOS.lip = process.env.P2_LIP;

function usageAndExit() {
  console.error([
    'P2 마스크 의존 슬라이더 실사진 재검증 하니스',
    '',
    '사용법: 실사진 경로를 env 로 주입하세요(파일은 커밋 금지).',
    '  P2_FACE=<정면 얼굴 사진>   (필수)',
    '  P2_HAIR=<헤어 사진>        (필수)',
    '  P2_NAIL=<네일/손 사진>     (필수)',
    '  P2_EYE=<눈 클로즈업>       (선택)',
    '  P2_LIP=<입술 클로즈업>     (선택)',
    '',
    '예: python3 -m http.server 8099   # 레포 루트, 별도 터미널',
    '    P2_FACE="~/Downloads/face.jpg" P2_HAIR="~/Downloads/hair.jpg" \\',
    '    P2_NAIL="~/Downloads/nail.jpg" node scripts/p2-mask-qa.js',
  ].join('\n'));
  process.exit(2);
}

// 슬라이더 → 사진 + 대상영역 box(캔버스 비율 [x,y,w,h])
const TARGETS = {
  // 피부(얼굴 전체) — 회귀 확인
  skin: ['face', [0.25, 0.2, 0.5, 0.55]], redness: ['face', [0.25, 0.2, 0.5, 0.55]], yellowness: ['face', [0.25, 0.2, 0.5, 0.55]],
  // 마스크 의존 — 피부
  blemish: ['face', [0.28, 0.3, 0.44, 0.4]], textureSmooth: ['face', [0.28, 0.3, 0.44, 0.4]], eyeShadow: ['face', [0.3, 0.28, 0.4, 0.12]],
  // 메이크업
  lipPop: ['face', [0.36, 0.52, 0.28, 0.12]], eyeColor: ['face', [0.3, 0.28, 0.4, 0.12]], browSharp: ['face', [0.3, 0.22, 0.4, 0.08]],
  // 눈/속눈썹
  irisClear: ['face', [0.3, 0.28, 0.4, 0.12]], lashSharp: ['face', [0.3, 0.26, 0.4, 0.12]], catchLight: ['face', [0.3, 0.28, 0.4, 0.12]],
  closeUpDetail: ['face', [0.3, 0.26, 0.4, 0.14]], underEyeClean: ['face', [0.3, 0.34, 0.4, 0.1]], eyeRedness: ['face', [0.3, 0.28, 0.4, 0.12]],
  // 네일/손
  nailShape: ['nail', [0.2, 0.05, 0.6, 0.5]], coolness: ['nail', [0.2, 0.5, 0.6, 0.4]], nailGloss: ['nail', [0.2, 0.05, 0.6, 0.5]], handSkin: ['nail', [0.2, 0.5, 0.6, 0.4]],
  // 헤어
  hairDetail: ['hair', [0.2, 0.15, 0.6, 0.6]], hairShine: ['hair', [0.2, 0.15, 0.6, 0.6]], hairVolume: ['hair', [0.2, 0.1, 0.6, 0.6]], hairColorPop: ['hair', [0.2, 0.15, 0.6, 0.6]],
};

function dataUrl(p) {
  const buf = fs.readFileSync(p);
  const ext = p.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
  return `data:image/${ext};base64,${buf.toString('base64')}`;
}

async function main() {
  if (!PHOTOS.face || !PHOTOS.hair || !PHOTOS.nail) usageAndExit();
  // optional 정밀 사진 주입 시 눈/입술 슬라이더를 전용 사진으로 재매핑
  if (PHOTOS.eye) for (const k of ['eyeShadow', 'eyeColor', 'irisClear', 'lashSharp', 'catchLight', 'closeUpDetail', 'underEyeClean', 'eyeRedness']) if (TARGETS[k]) TARGETS[k][0] = 'eye';
  if (PHOTOS.lip && TARGETS.lipPop) TARGETS.lipPop[0] = 'lip';
  fs.mkdirSync(OUT, { recursive: true });
  for (const [k, p] of Object.entries(PHOTOS)) if (!fs.existsSync(p)) { console.error('사진 없음:', k, p); process.exit(2); }

  const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 430, height: 920 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

  await page.addInitScript(() => {
    window.__openSrc = async function (src) {
      document.body.classList.remove('itdasy-locked');
      const lock = document.getElementById('lockOverlay'); if (lock) lock.classList.add('hidden');
      const PE = window.PhotoEditor;
      PE.open({ src, shopName: 'QA', initial_tab: 'beauty' });
      await new Promise((res, rej) => { const t0 = Date.now(); const t = () => { const s = PE._internal.getState(); if (s && s.originalImg && s.originalImg.naturalWidth) return res(); if (Date.now() - t0 > 25000) return rej(new Error('load')); setTimeout(t, 100); }; t(); });
      await new Promise(r => setTimeout(r, 400));
    };
    window.__mask = async function () {
      if (!(window.RegionMaskQA && window.RegionMaskQA.runOnCurrentImage)) return { err: 'no RegionMaskQA' };
      try { const r = await window.RegionMaskQA.runOnCurrentImage(); return r ? { table: r.table, fpChecks: r.fpChecks, eyeL: r.eyeLeftCoverage, eyeR: r.eyeRightCoverage } : { err: 'null' }; }
      catch (e) { return { err: String(e && e.message) }; }
    };
    window.__redrawSync = async function () { const h = window.PhotoEditor._internal.helpers; await h.redraw(); await new Promise(r => setTimeout(r, 220)); };
    window.__setBeauty = function (key, val) { const s = window.PhotoEditor._internal.getState(); s.beauty = {}; if (val) s.beauty[key] = val; };
    window.__snap = function () { const cv = document.getElementById('peCanvas'); const x = cv.getContext('2d', { willReadFrequently: true }); return { w: cv.width, h: cv.height, data: Array.from(x.getImageData(0, 0, cv.width, cv.height).data) }; };
    window.__diff = function (a, b, region) {
      const w = a.w, h = a.h, da = a.data, db = b.data;
      function box(r) {
        const x0 = (r[0] * w) | 0, y0 = (r[1] * h) | 0, x1 = ((r[0] + r[2]) * w) | 0, y1 = ((r[1] + r[3]) * h) | 0;
        let sum = 0, n = 0;
        for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { const i = (y * w + x) * 4; sum += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]); n++; }
        return n ? +(sum / (n * 3)).toFixed(2) : 0;
      }
      return { target: box(region), bg: box([0.01, 0.01, 0.12, 0.12]), bgR: box([0.87, 0.01, 0.12, 0.12]) };
    };
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.PhotoEditor && window.PhotoEditorBeautyEngine && window.RegionMaskProvider && window.RegionMaskQA, null, { timeout: 45000 });
  await page.waitForTimeout(1500);

  const srcs = {}; for (const [k, p] of Object.entries(PHOTOS)) srcs[k] = dataUrl(p);
  const report = { masks: {}, sliders: {}, photos: Object.keys(PHOTOS) };

  // 슬라이더를 사진별로 그룹
  const byPhoto = {};
  for (const [key, [photo]] of Object.entries(TARGETS)) { (byPhoto[photo] = byPhoto[photo] || []).push(key); }

  for (const photo of Object.keys(PHOTOS)) {
    await page.evaluate(s => window.__openSrc(s), srcs[photo]);
    // 마스크 품질
    report.masks[photo] = await page.evaluate(() => window.__mask());
    await page.waitForTimeout(300);
    // 슬라이더 diff
    for (const key of (byPhoto[photo] || [])) {
      const region = TARGETS[key][1];
      const max = key === 'hairColor' ? 50 : 100;
      await page.evaluate(k => window.__setBeauty(k, 0), key);
      await page.evaluate(() => window.__redrawSync());
      const base = await page.evaluate(() => window.__snap());
      await page.evaluate(([k, v]) => window.__setBeauty(k, v), [key, max]);
      await page.evaluate(() => window.__redrawSync());
      const mod = await page.evaluate(() => window.__snap());
      report.sliders[key] = await page.evaluate(([a, b, r]) => window.__diff(a, b, r), [base, mod, region]);
    }
    const shotName = { face: 'p2_mask_skin', hair: 'p2_mask_hair', nail: 'p2_mask_nail', eye: 'p2_mask_eye', lip: 'p2_mask_lip' }[photo] || ('p2_mask_' + photo);
    await page.screenshot({ path: path.join(OUT, `${shotName}_before_after.png`) });
  }

  report.severeErrors = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK/i.test(e));
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
}

main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
