#!/usr/bin/env node
/* T-147 의미기반 효과 QA 하니스 (1회성, 런타임 미수정)
   "기능명대로 사용자가 체감하는가 + 영역 번짐 없는가"를 영역별 pixel diff 로 판정한다.
   단순 전체 diff 가 아니라: 대상영역(머리/눈/네일) 변화 ↑  vs  배경/얼굴/본체 침범 ↓ 를 본다.
   엔진(beauty-engine)·마스크(RegionMaskProvider, 클라이언트 MediaPipe wasm)는 브라우저에서 동작 →
   로컬 http 서버 + 로컬 실사진(커밋 금지)으로 로컬 수정 엔진을 그대로 검증한다(백엔드 무관).

   실행: python3 -m http.server 8099 (레포 루트) 후
        T147_HAIR1=<정면> T147_HAIR2=<측면/뒷모습> node scripts/semantic-effect-qa.js
   결과: output/playwright/semantic_*.png + 콘솔 JSON */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'output', 'playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=t147';

const PHOTOS = {};
if (process.env.T147_HAIR1) PHOTOS.hair1 = process.env.T147_HAIR1;
if (process.env.T147_HAIR2) PHOTOS.hair2 = process.env.T147_HAIR2;
if (process.env.T147_FACE) PHOTOS.face = process.env.T147_FACE;
if (process.env.T147_NAIL) PHOTOS.nail = process.env.T147_NAIL;

function usage() {
  console.error('사용법: T147_HAIR1=<정면.jpg> T147_HAIR2=<측면.jpg> [T147_FACE=..] [T147_NAIL=..] node scripts/semantic-effect-qa.js\n실사진 경로는 env 주입(커밋 금지).');
  process.exit(2);
}
function dataUrl(p) { const b = fs.readFileSync(p); const e = p.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'; return `data:image/${e};base64,${b.toString('base64')}`; }

async function main() {
  if (!PHOTOS.hair1) usage();
  for (const [k, p] of Object.entries(PHOTOS)) if (!fs.existsSync(p)) { console.error('사진 없음:', k, p); process.exit(2); }
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 430, height: 920 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 140)); });

  await page.addInitScript(() => {
    window.__open = async function (src) {
      document.body.classList.remove('itdasy-locked');
      const lock = document.getElementById('lockOverlay'); if (lock) lock.classList.add('hidden');
      const PE = window.PhotoEditor;
      PE.open({ src, shopName: 'QA', initial_tab: 'beauty' });
      await new Promise((res, rej) => { const t0 = Date.now(); const t = () => { const s = PE._internal.getState(); if (s && s.originalImg && s.originalImg.naturalWidth) return res(); if (Date.now() - t0 > 25000) return rej(new Error('load')); setTimeout(t, 100); }; t(); });
      await new Promise(r => setTimeout(r, 400));
    };
    // RegionMaskQA 로 마스크 tier/coverage 기록 (클라이언트 MediaPipe)
    window.__mask = async function () {
      if (!(window.RegionMaskQA && window.RegionMaskQA.runOnCurrentImage)) return { err: 'no RegionMaskQA' };
      try { const r = await window.RegionMaskQA.runOnCurrentImage(); return r ? { table: r.table } : { err: 'null' }; } catch (e) { return { err: String(e && e.message) }; }
    };
    // ⚠️ 앱 실제 렌더 경로는 scheduleRedraw (helpers.redraw 직접 호출은 beauty hook 갱신을
    //   제대로 안 거쳐 모든 효과가 동일 diff 로 나옴 — 하니스 측정 버그였음).
    window.__redraw = async function () { window.PhotoEditor._internal.helpers.scheduleRedraw(); await new Promise(r => setTimeout(r, 500)); };
    window.__setBeauty = function (obj) { const s = window.PhotoEditor._internal.getState(); s.beauty = Object.assign({}, obj); };
    // [OOM 방지] 픽셀 배열을 Node 로 보내지 않는다. baseline 을 브라우저 전역에 보관하고,
    //   diff 는 브라우저 안에서 계산해 스칼라(영역별 평균 abs diff)만 반환한다.
    window.__captureBase = function () {
      const cv = document.getElementById('peCanvas'); const x = cv.getContext('2d', { willReadFrequently: true });
      window.__baseImg = x.getImageData(0, 0, cv.width, cv.height); window.__baseW = cv.width; window.__baseH = cv.height;
    };
    // 영역별 + 전체 diff 를 한 번에 계산(base 는 직전 __captureBase 시점).
    window.__diffAll = function (outer, body) {
      const cv = document.getElementById('peCanvas'); const x = cv.getContext('2d', { willReadFrequently: true });
      const cur = x.getImageData(0, 0, cv.width, cv.height); const da = window.__baseImg.data, db = cur.data;
      const w = cv.width, h = cv.height;
      const box = (r) => {
        const x0 = (r[0] * w) | 0, y0 = (r[1] * h) | 0, x1 = ((r[0] + r[2]) * w) | 0, y1 = ((r[1] + r[3]) * h) | 0;
        let s = 0, n = 0;
        for (let y = y0; y < y1; y += 2) for (let xx = x0; xx < x1; xx += 2) { const i = (y * w + xx) * 4; s += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]); n++; }
        return n ? +(s / (n * 3)).toFixed(2) : 0;
      };
      let fs = 0, fn = 0;
      for (let i = 0; i < da.length; i += 16) { fs += Math.abs(da[i] - db[i]); fn++; }
      return {
        outer: box(outer), body: box(body),
        bgTL: box([0.01, 0.01, 0.12, 0.12]), bgTR: box([0.87, 0.01, 0.12, 0.12]),
        face: box([0.36, 0.5, 0.28, 0.22]),   // 하단 중앙(얼굴/어깨/옷) 침범 확인
        full: +(fs / fn).toFixed(2),
      };
    };
    // 효과 1개를 깨끗한 baseline 대비 독립 측정(연속측정 race 제거).
    window.__measure = async function (beautyObj, outer, body) {
      window.__setBeauty({}); await window.__redraw(); await window.__redraw(); window.__captureBase();
      window.__setBeauty(beautyObj); await window.__redraw(); await window.__redraw();
      return window.__diffAll(outer, body);
    };
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.PhotoEditor && window.PhotoEditorBeautyEngine && window.RegionMaskProvider && window.RegionMaskQA, null, { timeout: 45000 });
  await page.waitForTimeout(1500);

  const report = { masks: {}, cases: {}, severeErrors: [] };
  // 머리 외곽/뿌리 = 상단·좌우 영역. 본체 = 중앙. 배경 = 코너.
  const HAIR_OUTER = [0.12, 0.08, 0.76, 0.45];   // 머리 상단/외곽
  const HAIR_BODY = [0.32, 0.42, 0.36, 0.3];     // 머리 본체 중앙(보존 확인)

  for (const key of ['hair1', 'hair2']) {
    if (!PHOTOS[key]) continue;
    await page.evaluate(s => window.__open(s), dataUrl(PHOTOS[key]));
    report.masks[key] = await page.evaluate(() => window.__mask());
    await page.waitForTimeout(300);
    // BEFORE 스크린샷(reset 상태)
    await page.evaluate(() => window.__setBeauty({}));
    await page.evaluate(() => window.__redraw());
    await page.screenshot({ path: path.join(OUT, `semantic_${key}_BEFORE.png`) });

    // T-140 hairVolume — 독립 측정(깨끗한 base 대비)
    const vol = await page.evaluate(([o, b]) => window.__measure({ hairVolume: 100 }, o, b), [HAIR_OUTER, HAIR_BODY]);
    await page.screenshot({ path: path.join(OUT, `semantic_${key}_volume.png`) });
    // T-141 hairEndsClean — 독립 측정
    const ends = await page.evaluate(([o, b]) => window.__measure({ hairEndsClean: 100 }, o, b), [HAIR_OUTER, HAIR_BODY]);
    await page.screenshot({ path: path.join(OUT, `semantic_${key}_ends.png`) });

    report.cases[key] = { hairVolume: vol, hairEndsClean: ends };
  }

  report.severeErrors = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK/i.test(e));
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
}

main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
