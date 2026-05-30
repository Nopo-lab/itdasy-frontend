#!/usr/bin/env node
/* T-118 슬라이더 체감 검증 (1회성, 프로덕션 코드 미수정)
   합성 사진(피부/머리/네일/눈 색 영역)에 각 beauty 슬라이더를 0→max 로 바꿔
   대상영역/배경 pixel diff 를 측정. beauty-engine 은 regionMasks 없으면 색 기반
   휴리스틱(v312)으로 동작하므로 합성 사진으로도 픽셀 반영 측정 가능(실제 사진은
   MediaPipe 마스크로 더 정확 — 본 하니스는 휴리스틱 경로 기준).

   실행: python3 -m http.server 8099 (레포 루트) 후 node scripts/t118-slider-qa.js
   결과: output/playwright/t118_*.png + 콘솔 JSON 리포트 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'output', 'playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=t118';

// 사진별 관련 슬라이더
const GROUPS = {
  skin: { photo: 'face', keys: ['skin', 'redness', 'blemish', 'textureSmooth', 'yellowness', 'eyeShadow', 'hairyArm'] },
  makeup: { photo: 'face', keys: ['lipPop', 'eyeColor', 'browSharp'] },
  hair: { photo: 'hair', keys: ['hairShine', 'hairVolume', 'hairEndsClean', 'hairColor', 'hairDetail', 'hairColorPop', 'scalpBoost'] },
  nail: { photo: 'nail', keys: ['handSkin', 'nailGloss', 'coolness', 'nailShape'] },
  eye: { photo: 'eye', keys: ['eyeRedness', 'irisClear', 'catchLight', 'underEyeClean', 'lashSharp', 'closeUpDetail'] },
};

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 430, height: 920 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

  await page.addInitScript(() => {
    window.__photo = function (kind) {
      const c = document.createElement('canvas'); c.width = 720; c.height = 900; const g = c.getContext('2d');
      g.fillStyle = '#3a5570'; g.fillRect(0, 0, 720, 900); // 배경(파랑) — 영역 정확도 측정용
      if (kind === 'face' || kind === 'eye') {
        // 피부 타원
        const gr = g.createRadialGradient(360, 420, 60, 360, 420, 320); gr.addColorStop(0, '#f0c9aa'); gr.addColorStop(1, '#d6a886');
        g.fillStyle = gr; g.beginPath(); g.ellipse(360, 430, 230, 300, 0, 0, 7); g.fill();
        // 잡티(어두운 점) + 붉은기 반점
        g.fillStyle = '#8a5a44'; for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(280 + (i * 37) % 180, 360 + (i * 53) % 220, 5, 0, 7); g.fill(); }
        g.fillStyle = 'rgba(200,70,70,0.5)'; g.beginPath(); g.arc(300, 500, 40, 0, 7); g.fill(); g.beginPath(); g.arc(430, 500, 40, 0, 7); g.fill();
        // 눈(흰자+홍채) + 속눈썹 + 입술 + 눈썹
        g.fillStyle = '#fafafa'; g.beginPath(); g.ellipse(300, 380, 45, 26, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(430, 380, 45, 26, 0, 0, 7); g.fill();
        g.fillStyle = '#5a3a22'; g.beginPath(); g.arc(300, 380, 16, 0, 7); g.fill(); g.beginPath(); g.arc(430, 380, 16, 0, 7); g.fill();
        g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(300, 380, 7, 0, 7); g.fill(); g.beginPath(); g.arc(430, 380, 7, 0, 7); g.fill();
        g.strokeStyle = '#222'; g.lineWidth = 3; g.beginPath(); g.moveTo(255, 360); g.lineTo(345, 358); g.moveTo(385, 358); g.lineTo(475, 360); g.stroke(); // 눈썹
        g.lineWidth = 2; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(262 + i * 10, 358); g.lineTo(260 + i * 10, 348); g.stroke(); } // 속눈썹
        g.fillStyle = '#c0506a'; g.beginPath(); g.ellipse(360, 560, 60, 22, 0, 0, 7); g.fill(); // 입술
      } else if (kind === 'hair') {
        // 머리(갈색 질감)
        g.fillStyle = '#4a2f1c'; g.beginPath(); g.ellipse(360, 360, 280, 300, 0, 0, 7); g.fill();
        for (let i = 0; i < 400; i++) { g.strokeStyle = `rgba(${90 + (i % 60)},${55 + (i % 40)},${30 + (i % 30)},0.4)`; g.lineWidth = 1.5; g.beginPath(); const x = 120 + (i * 53) % 480; g.moveTo(x, 120 + (i * 31) % 120); g.lineTo(x + 8, 500 + (i * 17) % 160); g.stroke(); }
        g.fillStyle = '#e0b070'; g.fillRect(250, 250, 16, 300); g.fillRect(420, 230, 16, 320); // 염색 하이라이트 가닥
      } else if (kind === 'nail') {
        g.fillStyle = '#e8b89a'; g.fillRect(200, 300, 320, 480); // 손(살색)
        for (let i = 0; i < 4; i++) { // 손톱(폴리시 + 광택 하이라이트)
          const x = 230 + i * 70; g.fillStyle = '#b03a55'; g.beginPath(); g.ellipse(x, 340, 26, 40, 0, 0, 7); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.ellipse(x - 6, 325, 7, 14, 0.3, 0, 7); g.fill(); // 스페큘러
        }
      }
      return c.toDataURL('image/png');
    };
    window.__openPE = async function (kind) {
      document.body.classList.remove('itdasy-locked');
      const lock = document.getElementById('lockOverlay'); if (lock) lock.classList.add('hidden');
      const PE = window.PhotoEditor;
      PE.open({ src: window.__photo(kind), shopName: 'QA', initial_tab: 'beauty' });
      await new Promise((res, rej) => { const t0 = Date.now(); const t = () => { const s = PE._internal.getState(); if (s && s.originalImg && s.originalImg.naturalWidth) return res(); if (Date.now() - t0 > 20000) return rej(new Error('load')); setTimeout(t, 80); }; t(); });
      await new Promise(r => setTimeout(r, 250));
    };
    window.__redrawSync = async function () { const h = window.PhotoEditor._internal.helpers; await h.redraw(); await new Promise(r => setTimeout(r, 180)); };
    window.__setBeauty = function (key, val) { const s = window.PhotoEditor._internal.getState(); s.beauty = {}; if (val) s.beauty[key] = val; };
    window.__snap = function () { const cv = document.getElementById('peCanvas'); const x = cv.getContext('2d', { willReadFrequently: true }); return { w: cv.width, h: cv.height, data: Array.from(x.getImageData(0, 0, cv.width, cv.height).data) }; };
    // 대상영역 박스(캔버스 비율 기준)와 배경 코너 박스의 mean abs diff
    window.__diff = function (a, b, region) {
      const w = a.w, h = a.h, da = a.data, db = b.data;
      function box(rx, ry, rw, rh) {
        const x0 = (rx * w) | 0, y0 = (ry * h) | 0, x1 = ((rx + rw) * w) | 0, y1 = ((ry + rh) * h) | 0;
        let sum = 0, n = 0;
        for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { const i = (y * w + x) * 4; sum += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]); n++; }
        return n ? +(sum / (n * 3)).toFixed(2) : 0;
      }
      const target = box(region[0], region[1], region[2], region[3]);
      const bg = box(0.01, 0.01, 0.12, 0.12); // 좌상단 코너=배경
      return { target, bg };
    };
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.PhotoEditor && window.PhotoEditorBeautyEngine, null, { timeout: 45000 });
  await page.waitForTimeout(1200);

  // 사진별 대상영역(캔버스 비율): 중앙 인물/머리/손/눈
  const REGION = { face: [0.25, 0.3, 0.5, 0.45], hair: [0.2, 0.1, 0.6, 0.6], nail: [0.28, 0.33, 0.44, 0.3], eye: [0.33, 0.36, 0.34, 0.12] };
  const report = { groups: {}, errors: [] };

  for (const [gname, g] of Object.entries(GROUPS)) {
    await page.evaluate(k => window.__openPE(k), g.photo);
    const region = REGION[g.photo];
    report.groups[gname] = {};
    for (const key of g.keys) {
      const max = key === 'hairColor' ? 50 : 100;
      await page.evaluate(k => window.__setBeauty(k, 0), key);
      await page.evaluate(() => window.__redrawSync());
      const base = await page.evaluate(() => window.__snap());
      await page.evaluate(([k, v]) => window.__setBeauty(k, v), [key, max]);
      await page.evaluate(() => window.__redrawSync());
      const mod = await page.evaluate(() => window.__snap());
      const d = await page.evaluate(([a, b, r]) => window.__diff(a, b, r), [base, mod, region]);
      report.groups[gname][key] = d;
    }
    // 대표 슬라이더 max 적용 상태로 스크린샷
    await page.screenshot({ path: path.join(OUT, `t118_${gname}_before_after.png`) });
  }

  report.severeErrors = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK/i.test(e));
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
}

main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
