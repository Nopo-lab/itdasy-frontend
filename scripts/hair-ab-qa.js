#!/usr/bin/env node
/* hair A/B QA 하니스 (1회성, 커밋 대상 아님 — 프로덕션 코드 변경 없음)

   목적: hairMask 연결 정책 A안(current) vs B안(tier1Strict) 을 같은 사진 세트에서 비교.
     A안: conf>=0.4 면 tier 무관 hairMask 사용 (현재 배포 방식)
     B안: Tier1 hair_segmenter ready + conf>=0.7 + coverage 정상일 때만 hairMask primary,
          아니면 hairMask 제외 → beauty-engine hairLike 휴리스틱 fallback (강제 0 금지)

   ⚠️ 이 스크립트는 window.PhotoEditorBeautyEngine.apply 를 하니스에서 직접 호출하며
      mask-application.js / beauty-engine.js 의 디스크 코드는 전혀 수정하지 않는다.

   실행:
     PHOTO_QA_MODE=hair_ab \
     PHOTO_QA_URL=http://127.0.0.1:8080/?v=hairab \
     [PHOTO_QA_FILES=경로1,경로2] [PHOTO_QA_REMOTE=1] \
     node scripts/hair-ab-qa.js

   결과: output/playwright/hairab-*-A.png / -B.png + 콘솔 JSON 리포트 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'output', 'playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8080/?v=hairab';

// B안 게이트 상수 (보고용 — 실제 코드 반영은 승인 후)
const HAIR_CONF_MIN = 0.7;
const HAIR_COV_MIN = 0.02;   // 너무 적게 잡히면 머리카락 손실
const HAIR_COV_MAX = 0.6;    // 너무 크게 잡히면 배경/옷 번짐

// ── 원장님 실제 헤어 뒷모습 2장 (로컬) ──
const REF_HAIR = [
  { label: '원장님헤어#1 롱+하이라이트', path: '/Users/kang-yeonjun/Downloads/KakaoTalk_Photo_2026-05-29-12-52-22 001.jpeg' },
  { label: '원장님헤어#2 붙임머리 전후', path: '/Users/kang-yeonjun/Downloads/KakaoTalk_Photo_2026-05-29-12-52-22 002.jpeg' },
];

function loadLocal(list) {
  return list.map(p => {
    try {
      const buf = fs.readFileSync(p.path);
      const ext = (p.path.split('.').pop() || 'jpeg').toLowerCase();
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
      return { title: p.label, url: `data:${mime};base64,${buf.toString('base64')}` };
    } catch (e) { return { title: p.label, url: null, err: e.message }; }
  }).filter(x => x.url);
}

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

// 엣지케이스: 어두운배경/단발/염색/롱헤어/밝은배경
const EDGE_TAGS = [
  { q: 'woman dark background studio portrait back', tag: 'hairstyle,dark' },
  { q: 'short bob haircut woman back', tag: 'bob,haircut' },
  { q: 'blonde long hair woman back', tag: 'blonde,longhair' },
  { q: 'dyed colorful hair woman', tag: 'haircolor,dyed' },
  { q: 'woman white background long hair', tag: 'longhair,portrait' },
];
function commonsUrl(term) {
  const p = new URLSearchParams({
    action: 'query', generator: 'search', gsrnamespace: '6', gsrlimit: '6',
    gsrsearch: term, prop: 'imageinfo', iiprop: 'url|mime', iiurlwidth: '2200',
    format: 'json', origin: '*',
  });
  return `https://commons.wikimedia.org/w/api.php?${p.toString()}`;
}
async function fetchEdge(n) {
  const out = [];
  for (const e of EDGE_TAGS) {
    if (out.length >= n) break;
    try {
      const res = await fetch(commonsUrl(e.q));
      const json = await res.json();
      const pages = Object.values((json && json.query && json.query.pages) || {});
      let got = null;
      for (const page of pages) {
        const info = page.imageinfo && page.imageinfo[0];
        if (!info || !/^image\//.test(info.mime || '')) continue;
        if (!/\.(jpe?g|png)$/i.test(String(page.title || ''))) continue;
        const d = await toDataUrl(info.thumburl, info.mime);
        if (d) { got = { title: 'edge:' + e.q.slice(0, 24), url: d }; break; }
      }
      if (!got) { const d = await toDataUrl(`https://loremflickr.com/1100/1400/${e.tag}?lock=${700 + out.length}`, 'image/jpeg'); if (d) got = { title: 'flickr:' + e.tag, url: d }; }
      if (got) out.push(got);
    } catch (_e) { /* next */ }
  }
  return out.slice(0, n);
}

// ── 페이지 내부: 한 정책으로 렌더 + 델타 측정 (engine.apply 직접 호출, 프로덕션 미수정) ──
// 반환: { totalDelta, bgBleed, skinBleed }  (0~255 평균 절대차)
const PAGE_RENDER = function (imgEl, policy, gate) {
  const PE = window.PhotoEditor;
  const RP = window.RegionMaskProvider;
  const MA = window.MaskApplication;
  const ENG = window.PhotoEditorBeautyEngine;
  if (!ENG || !ENG.apply) return { err: 'engine missing' };

  const natW = imgEl.naturalWidth, natH = imgEl.naturalHeight;
  const cap = 900, k = Math.min(1, cap / Math.max(natW, natH));
  const W = Math.max(1, Math.round(natW * k)), H = Math.max(1, Math.round(natH * k));

  const hair = RP.getCachedSync(imgEl, 'hairMask') || {};
  const bg = RP.getCachedSync(imgEl, 'backgroundMask') || {};
  const skin = RP.getCachedSync(imgEl, 'skinMask') || {};

  // 정책별 regionMasks 구성 (하니스 내부 결정 — 디스크 코드 안 건드림)
  function buildRegionMasks() {
    const conf = hair.confidence || 0, cov = hair.coverage || 0;
    let useHair = false, scale = 0, decided = 'fallback(heuristic)';
    if (policy === 'A') {
      // current: conf>=0.4 면 사용 (tier 무관). scale 은 _scaleOf 모사 (>=0.7→1.0, >=0.4→0.6)
      if (hair.mask && conf >= 0.4) { useHair = true; scale = conf >= 0.7 ? 1.0 : 0.6; decided = 'current(conf>=0.4)'; }
    } else {
      // B tier1Strict
      const pass = hair.mask && hair.status === 'ready' && hair.sourceTier === 1 &&
        conf >= gate.conf && cov >= gate.covMin && cov <= gate.covMax;
      if (pass) { useHair = true; scale = 1.0; decided = 'tier1Strict'; }
    }
    if (!useHair) return { rm: null, decided };
    const dims = hair._dims || { w: natW, h: natH };
    return {
      rm: { useMasks: { hairMask: hair.mask }, _scale: { hairMask: scale }, maskW: dims.w | 0, maskH: dims.h | 0 },
      decided, scale,
    };
  }
  const built = buildRegionMasks();

  function renderToData(beauty) {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.drawImage(imgEl, 0, 0, W, H);
    try { ENG.apply(ctx, W, H, beauty, false, built.rm); } catch (e) { return { err: String(e && e.message) }; }
    return { data: ctx.getImageData(0, 0, W, H).data, cv };
  }

  const base = renderToData({});                                   // 슬라이더 0
  const applied = renderToData({ hairShine: 50, hairDetail: 50, hairVolume: 50 });
  if (base.err || applied.err) return { err: base.err || applied.err };
  const d0 = base.data, d1 = applied.data;

  // 마스크 좌표 샘플러 (canvas px → mask px)
  function sampler(m) {
    const dims = m._dims || { w: natW, h: natH };
    const arr = m.mask;
    if (!arr) return null;
    return function (x, y) {
      const mx = Math.min(dims.w - 1, (x * dims.w / W) | 0);
      const my = Math.min(dims.h - 1, (y * dims.h / H) | 0);
      return arr[my * dims.w + mx] || 0;
    };
  }
  const bgS = sampler(bg), skinS = sampler(skin);

  let totSum = 0, totN = 0;
  let bgSum = 0, bgW = 0, skSum = 0, skW = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const dd = (Math.abs(d1[i] - d0[i]) + Math.abs(d1[i + 1] - d0[i + 1]) + Math.abs(d1[i + 2] - d0[i + 2])) / 3;
      totSum += dd; totN++;
      if (bgS) { const w = bgS(x, y); if (w > 0.5) { bgSum += dd * w; bgW += w; } }
      if (skinS) { const w = skinS(x, y); if (w > 0.5) { skSum += dd * w; skW += w; } }
    }
  }
  // 스크린샷용 applied 캔버스를 화면에 부착
  try {
    const host = document.getElementById('peCanvas');
    if (host && host.getContext) { host.width = W; host.height = H; host.getContext('2d').putImageData(applied.data instanceof ImageData ? applied.data : new ImageData(applied.data, W, H), 0, 0); }
  } catch (_e) { /* noop */ }

  return {
    decided: built.decided, scale: built.scale || 0,
    hair: { tier: hair.sourceTier, status: hair.status, coverage: hair.coverage, confidence: hair.confidence },
    W, H,
    totalDelta: +(totSum / Math.max(1, totN)).toFixed(3),
    bgBleed: +(bgSum / Math.max(1, bgW)).toFixed(3),
    skinBleed: +(skSum / Math.max(1, skW)).toFixed(3),
    bgPixels: Math.round(bgW), skinPixels: Math.round(skW),
  };
};

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  let imgs = [];
  if (process.env.PHOTO_QA_FILES) {
    imgs = loadLocal(process.env.PHOTO_QA_FILES.split(',').map((p, i) => ({ label: `Local#${i + 1} ${path.basename(p.trim())}`, path: p.trim() })));
  } else {
    imgs = loadLocal(REF_HAIR);
    if (process.env.PHOTO_QA_REMOTE !== '0') {
      const edge = await fetchEdge(5);
      imgs = imgs.concat(edge);
    }
  }
  if (!imgs.length) throw new Error('테스트 이미지 로드 실패');

  const browser = await chromium.launch({
    headless: true, channel: 'chrome',
    args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 430, height: 920 }, deviceScaleFactor: 2, serviceWorkers: 'block', bypassCSP: true });
  await context.route('**/*.js*', async route => {
    try { const u = new URL(route.request().url()); u.searchParams.set('_nc', Date.now() + Math.random().toString(36).slice(2)); await route.continue({ url: u.toString() }); }
    catch (_e) { await route.continue(); }
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    try { localStorage.setItem('PE_MASK_DEBUG', '1'); localStorage.removeItem('PE_MASK_DISABLE'); } catch (_e) { /* noop */ }
    try { if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('sw off')); } catch (_e) { /* noop */ }
  });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.PhotoEditor && window.RegionMaskQA && window.MediaPipeLoader && window.PhotoEditorBeautyEngine, null, { timeout: 60000 });
  await page.waitForTimeout(1200);

  const results = [];
  for (let i = 0; i < imgs.length; i++) {
    const im = imgs[i];
    try {
      // 이미지 로드 + 전 마스크 계산
      await page.evaluate(async (src) => {
        const PE = window.PhotoEditor;
        try { document.body.classList.remove('itdasy-locked'); } catch (_e) { /* noop */ }
        const lock = document.getElementById('lockOverlay'); if (lock) lock.classList.add('hidden');
        PE.open({ src, shopName: 'QA', initial_tab: 'beauty' });
        const st = await new Promise((resolve, reject) => {
          const t0 = Date.now();
          (function tick() {
            const s = PE._internal && PE._internal.getState && PE._internal.getState();
            if (s && s.originalImg && s.originalImg.naturalWidth) return resolve(s);
            if (Date.now() - t0 > 20000) return reject(new Error('img timeout'));
            setTimeout(tick, 80);
          })();
        });
        await window.RegionMaskQA.measureAll(st.originalImg);   // 전 마스크 캐시 + MediaPipe 실행
      }, im.url);

      const gate = { conf: HAIR_CONF_MIN, covMin: HAIR_COV_MIN, covMax: HAIR_COV_MAX };
      const A = await page.evaluate(({ p, g, fn }) => {
        const img = window.PhotoEditor._internal.getState().originalImg;
        return (new Function('return ' + fn))()(img, p, g);
      }, { p: 'A', g: gate, fn: PAGE_RENDER.toString() });
      const shotA = path.join(OUT, `hairab-${i + 1}-A.png`);
      const wrapA = await page.$('.pe-canvas-wrap'); if (wrapA) await wrapA.screenshot({ path: shotA }); else await page.screenshot({ path: shotA });

      const B = await page.evaluate(({ p, g, fn }) => {
        const img = window.PhotoEditor._internal.getState().originalImg;
        return (new Function('return ' + fn))()(img, p, g);
      }, { p: 'B', g: gate, fn: PAGE_RENDER.toString() });
      const shotB = path.join(OUT, `hairab-${i + 1}-B.png`);
      const wrapB = await page.$('.pe-canvas-wrap'); if (wrapB) await wrapB.screenshot({ path: shotB }); else await page.screenshot({ path: shotB });

      // hair_vs_bg / hair_vs_skin (measureAll fpChecks)
      const fp = await page.evaluate(async () => {
        const img = window.PhotoEditor._internal.getState().originalImg;
        const qa = await window.RegionMaskQA.measureAll(img);
        return qa.fpChecks || {};
      });

      results.push({
        title: im.title,
        hair_vs_bg: fp.hair_vs_bg != null ? +fp.hair_vs_bg.toFixed(3) : null,
        hair_vs_skin: fp.hair_vs_skin != null ? +fp.hair_vs_skin.toFixed(3) : null,
        A, B,
        screenshots: { A: shotA, B: shotB },
      });
      await page.evaluate(() => window.PhotoEditor.close(true));
      await page.waitForTimeout(250);
    } catch (e) {
      results.push({ title: im.title, error: String(e && e.message || e) });
    }
  }

  const build = await page.evaluate(() => window.__LATEST_BUILD__ || 'local');
  await browser.close();
  const report = {
    build, baseUrl: BASE_URL, gate: { HAIR_CONF_MIN, HAIR_COV_MIN, HAIR_COV_MAX },
    images: imgs.length,
    severeErrors: errors.filter(e => !/favicon|ResizeObserver|tasks-vision|model|404/i.test(e)).slice(0, 8),
    results,
  };
  console.log('\n===== HAIR A/B REPORT =====');
  console.log(JSON.stringify(report, null, 2));
}

main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
