#!/usr/bin/env node
/* v340/v341 검증용 헤드리스 마스크 QA (1회성 도구, 커밋 대상 아님)
   공개 얼굴 사진을 받아 PhotoEditor 에 넣고:
     - RegionMaskQA.measureAll → eyeMask 좌/우 coverage, eyelashBandMask conf
     - PE_MASK_DEBUG 오버레이 스크린샷
     - redraw 시간(렉 프록시)
   결과 JSON + 스크린샷을 output/playwright/ 에 저장. */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'output', 'playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8097/?v=maskqa';

async function toDataUrl(url, fallbackMime) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mime = (res.headers.get('content-type') || fallbackMime || 'image/jpeg').split(';')[0];
    if (!/^image\//.test(mime)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > 12 * 1024 * 1024) return null;
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch (_e) { return null; }
}

function commonsUrl(term) {
  const p = new URLSearchParams({
    action: 'query', generator: 'search', gsrnamespace: '6', gsrlimit: '20',
    gsrsearch: term, prop: 'imageinfo', iiprop: 'url|mime', iiurlwidth: '2600',
    format: 'json', origin: '*',
  });
  return `https://commons.wikimedia.org/w/api.php?${p.toString()}`;
}

// 모드별 검색어 / LoremFlickr 태그 (face=얼굴 QA, nail=네일 클로즈업 QA)
const QA_MODE = process.env.PHOTO_QA_MODE || 'face';
const TERM_SETS = {
  face: ['woman face portrait makeup', 'eyelash makeup closeup face', 'beauty model portrait face'],
  nail: ['manicure nail art hand', 'fingernail manicure closeup', 'gel nail polish hand', 'painted fingernails'],
  // v321 헤어 Tier 1 false-positive 검증: 어두운배경/단발/모자/밝은컬러 엣지케이스
  hair: ['woman dark background studio portrait', 'short bob haircut woman', 'woman wearing hat portrait', 'blonde long hair woman portrait', 'silver grey hair woman'],
};
const FLICKR_TAGS = { face: 'face,portrait,makeup', nail: 'manicure,nails,fingernail', hair: 'hairstyle,portrait,woman' };

async function fetchFaces(n) {
  const out = [];
  const terms = TERM_SETS[QA_MODE] || TERM_SETS.face;
  for (const t of terms) {
    if (out.length >= n) break;
    try {
      const res = await fetch(commonsUrl(t));
      const json = await res.json();
      const pages = Object.values((json && json.query && json.query.pages) || {});
      for (const page of pages) {
        if (out.length >= n) break;
        const info = page.imageinfo && page.imageinfo[0];
        if (!info || !/^image\//.test(info.mime || '')) continue;
        if (!/\.(jpe?g|png)$/i.test(String(page.title || ''))) continue;
        const dataUrl = await toDataUrl(info.thumburl, info.mime);
        if (!dataUrl) continue;
        out.push({ title: page.title, url: dataUrl });
      }
    } catch (_e) { /* next term */ }
  }
  // LoremFlickr fallback
  const tags = FLICKR_TAGS[QA_MODE] || FLICKR_TAGS.face;
  for (let i = 0; out.length < n && i < 8; i++) {
    const u = `https://loremflickr.com/1200/1500/${tags}?lock=${500 + i}`;
    const d = await toDataUrl(u, 'image/jpeg');
    if (d) out.push({ title: `LoremFlickr ${QA_MODE} ${i + 1}`, url: d });
  }
  return out.slice(0, n);
}

// 레퍼런스 로컬 사진 (원장님 제공) → dataURL
const REF_PHOTOS = [
  { label: 'Image#1 정면증명', path: '/Users/kang-yeonjun/Downloads/KakaoTalk_Photo_2026-05-29-00-51-40.jpeg' },
  { label: 'Image#2 눈클로즈업', path: '/Users/kang-yeonjun/Downloads/KakaoTalk_Photo_2026-05-29-00-50-28.jpeg' },
  { label: 'Image#3 IVE 헤어+손', path: '/Users/kang-yeonjun/Downloads/KakaoTalk_Photo_2026-05-29-00-27-11.jpeg' },
];
function loadLocalFaces() {
  // PHOTO_QA_FILES=경로1,경로2,... → 그 파일들로 대체 (실제 원장님 사진 QA용)
  let photos = REF_PHOTOS;
  if (process.env.PHOTO_QA_FILES) {
    photos = process.env.PHOTO_QA_FILES.split(',').map((p, i) => ({ label: `Local#${i + 1} ${path.basename(p.trim())}`, path: p.trim() }));
  }
  return photos.map(p => {
    try {
      const buf = fs.readFileSync(p.path);
      const ext = (p.path.split('.').pop() || 'jpeg').toLowerCase();
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
      return { title: p.label, url: `data:${mime};base64,${buf.toString('base64')}` };
    } catch (e) { return { title: p.label, url: null, err: e.message }; }
  }).filter(x => x.url);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  // nail/hair 모드는 항상 원격(로컬 엣지케이스 없음), 5장. face 모드는 PHOTO_QA_REMOTE=1 일 때만 원격.
  const wantRemote = QA_MODE === 'nail' || QA_MODE === 'hair' || process.env.PHOTO_QA_REMOTE === '1';
  const faces = wantRemote ? await fetchFaces(QA_MODE === 'face' ? 3 : 5) : loadLocalFaces();
  if (!faces.length) throw new Error('레퍼런스 사진 로드 실패 (경로 확인)');

  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',   // 시스템 Google Chrome 사용 (playwright chromium 버전 다운로드 회피)
    args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 430, height: 920 }, deviceScaleFactor: 2, serviceWorkers: 'block', bypassCSP: true });
  // 모든 .js 요청에 고유 nonce → 헤드리스 캐시 무력화 (항상 최신 디스크 파일 로드)
  await context.route('**/*.js?*', async route => {
    try { const u = new URL(route.request().url()); u.searchParams.set('_nc', String(Date.now()) + Math.random().toString(36).slice(2)); await route.continue({ url: u.toString() }); }
    catch (_e) { await route.continue(); }
  });
  await context.route('**/*.js', async route => {
    try { const u = new URL(route.request().url()); u.searchParams.set('_nc', String(Date.now()) + Math.random().toString(36).slice(2)); await route.continue({ url: u.toString() }); }
    catch (_e) { await route.continue(); }
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.addInitScript(() => {
    try { localStorage.setItem('PE_MASK_DEBUG', '1'); } catch (_e) { /* noop */ }
    try { localStorage.removeItem('PE_MASK_DISABLE'); } catch (_e) { /* noop */ }
    // QA: 서비스워커 비활성 (구 스크립트 캐시 서빙 방지 → 항상 최신 파일 로드)
    try { if (navigator.serviceWorker && navigator.serviceWorker.register) navigator.serviceWorker.register = () => Promise.reject(new Error('sw disabled for qa')); } catch (_e) { /* noop */ }
  });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.PhotoEditor && window.RegionMaskQA && window.MediaPipeLoader, null, { timeout: 60000 });
  await page.waitForTimeout(1500);

  const results = [];
  for (let i = 0; i < faces.length; i++) {
    const face = faces[i];
    try {
      const r = await page.evaluate(async (src) => {
        const PE = window.PhotoEditor;
        try { document.body.classList.remove('itdasy-locked'); } catch (_e) { /* noop */ }
        const lock = document.getElementById('lockOverlay'); if (lock) lock.classList.add('hidden');
        PE.open({ src: src, shopName: 'QA', initial_tab: 'beauty' });
        // 이미지 로드 대기
        const st = await new Promise((resolve, reject) => {
          const t0 = Date.now();
          const tick = () => {
            const s = PE._internal && PE._internal.getState && PE._internal.getState();
            if (s && s.originalImg && s.originalImg.naturalWidth) return resolve(s);
            if (Date.now() - t0 > 20000) return reject(new Error('img load timeout'));
            setTimeout(tick, 80);
          };
          tick();
        });
        const img = st.originalImg;
        const natural = { w: img.naturalWidth, h: img.naturalHeight };
        // 디버그: computeCrop 직접 호출 (preview 캡 동작 격리 확인)
        const _ccF = window.PhotoEditorRenderer.computeCrop(img, st.ratio || 'original', false);
        const _ccP = window.PhotoEditorRenderer.computeCrop(img, st.ratio || 'original', true);
        const ccDirect = { ratio: st.ratio, full: _ccF.dw + 'x' + _ccF.dh, preview: _ccP.dw + 'x' + _ccP.dh };
        const redrawArity = (PE._internal && PE._internal.helpers && PE._internal.helpers.redraw && PE._internal.helpers.redraw.length) || 0;
        // 마스크 측정 (measureAll 이 각 getMask 를 await → MediaPipe 실행+캐시)
        const qa = await window.RegionMaskQA.measureAll(img);
        // v343 드래그 시뮬: preview(redraw(true)) vs final(redraw(false)), 매프레임 값변경(캐시미스)
        st.beauty.lashSharp = 60;
        const previewMs = [];
        for (let k = 0; k < 6; k++) {
          st.beauty.skin = 20 + k * 9;
          const t0 = performance.now();
          await PE._internal.helpers.redraw(true);   // preview 저해상도
          previewMs.push(+(performance.now() - t0).toFixed(1));
        }
        const cvP = document.getElementById('peCanvas');
        const previewDims = { w: cvP.width, h: cvP.height };
        const finalMs = [];
        for (let k = 0; k < 3; k++) {
          st.beauty.skin = 71 + k * 3;
          const t0 = performance.now();
          await PE._internal.helpers.redraw(false);  // final 풀해상도
          finalMs.push(+(performance.now() - t0).toFixed(1));
        }
        const cv = document.getElementById('peCanvas');
        const canvasDims = { w: cv.width, h: cv.height };   // final 기준
        const times = finalMs;
        const eye = (qa.results && qa.results.eyeMask) || {};
        const lash = (qa.results && qa.results.eyelashBandMask) || {};
        const skin = (qa.results && qa.results.skinMask) || {};
        const hair = (qa.results && qa.results.hairMask) || {};
        const lip = (qa.results && qa.results.lipMask) || {};
        const nail = (qa.results && qa.results.nailMask) || {};
        const hand = (qa.results && qa.results.handSkinMask) || {};
        const bg = (qa.results && qa.results.backgroundMask) || {};
        const fp = qa.fpChecks || {};
        return {
          natural, canvasDims, previewDims, ccDirect, redrawArity,
          previewMs, finalMs,
          redrawMs: times,
          eyeLeftCoverage: qa.eyeLeftCoverage, eyeRightCoverage: qa.eyeRightCoverage, eyeOneSideWarn: qa.eyeOneSideWarn,
          eye: { tier: eye.sourceTier, status: eye.status, coverage: eye.coverage, confidence: eye.confidence },
          lash: { tier: lash.sourceTier, status: lash.status, coverage: lash.coverage, confidence: lash.confidence },
          skin: { tier: skin.sourceTier, status: skin.status, coverage: skin.coverage, confidence: skin.confidence },
          hair: { tier: hair.sourceTier, status: hair.status, coverage: hair.coverage, confidence: hair.confidence },
          lip: { tier: lip.sourceTier, status: lip.status, coverage: lip.coverage, confidence: lip.confidence },
          nail: { tier: nail.sourceTier, status: nail.status, coverage: nail.coverage, confidence: nail.confidence },
          hand: { tier: hand.sourceTier, status: hand.status, coverage: hand.coverage, confidence: hand.confidence },
          bg: { tier: bg.sourceTier, status: bg.status, coverage: bg.coverage, confidence: bg.confidence },
          fpChecks: fp,
        };
      }, face.url);

      // 오버레이 스크린샷 (precompute 가 PE_MASK_DEBUG 로 오버레이 렌더)
      await page.evaluate(() => {
        const img = window.PhotoEditor._internal.getState().originalImg;
        window.RegionMaskProvider.invalidate(img);
        return window.RegionMaskProvider.precompute(img).catch(() => {});
      });
      await page.waitForTimeout(2500);
      const shot = path.join(OUT, `maskqa-${QA_MODE}-${i + 1}.png`);
      const wrap = await page.$('.pe-canvas-wrap');
      if (wrap) await wrap.screenshot({ path: shot }); else await page.screenshot({ path: shot });
      r.title = face.title; r.screenshot = shot;
      results.push(r);
      await page.evaluate(() => window.PhotoEditor.close(true));
      await page.waitForTimeout(300);
    } catch (e) {
      results.push({ title: face.title, error: String(e && e.message || e) });
    }
  }

  const build = await page.evaluate(() => window.APP_BUILD || window.__LATEST_BUILD__ || 'local');
  await browser.close();
  const report = { build, baseUrl: BASE_URL, faces: faces.length, severeErrors: errors.filter(e => !/favicon|ResizeObserver|tasks-vision|model/i.test(e)).slice(0, 10), results };
  console.log(JSON.stringify(report, null, 2));
}

main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
