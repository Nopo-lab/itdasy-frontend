#!/usr/bin/env node
/* v234 사진편집 현실 사진 QA
   Wikimedia Commons 공개 사진을 가져와 네일/헤어/피부 계열 보정과 30종 템플릿 렌더링을 확인한다. */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'output', 'playwright');
const REPORT = path.join(ROOT, 'output', 'photo-editor-realistic-qa-report.json');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8092/?v=qa';
const LIMIT = Number(process.env.PHOTO_QA_LIMIT || 18);

const SEARCHES = [
  { kind: 'nail', recipe: 'nail-color', q: 'manicure nails closeup', cats: ['Category:Nail art', 'Category:Manicure'] },
  { kind: 'hair', recipe: 'hair-shine', q: 'hairstyle hair salon portrait', cats: ['Category:Hairdressing', 'Category:Hairdressers'] },
  { kind: 'skin', recipe: 'skin-even', q: 'makeup portrait skin', cats: ['Category:Make-up'] },
  { kind: 'makeup', recipe: 'lash-crisp', q: 'makeup portrait eyelashes', cats: ['Category:Make-up'] },
];

const FALLBACK_PHOTOS = [
  { kind: 'nail', recipe: 'nail-color', tags: 'nail,manicure', start: 110 },
  { kind: 'hair', recipe: 'hair-shine', tags: 'hair,salon', start: 210 },
  { kind: 'skin', recipe: 'skin-even', tags: 'skincare,face', start: 310 },
  { kind: 'makeup', recipe: 'lash-crisp', tags: 'makeup,beauty', start: 410 },
];

const TEMPLATE_IDS = [
  'feed-showcase', 'feed-new-menu', 'feed-review', 'feed-price', 'feed-notice',
  'story-count', 'story-open', 'story-attend', 'story-qa', 'story-poll',
  'reels-ba', 'reels-price', 'reels-newmenu', 'reels-review', 'reels-process',
  'event-discount', 'event-member', 'event-newcomer', 'event-deadline', 'event-gift',
  'price-hair', 'price-nail', 'price-lash', 'price-makeup', 'price-wax',
  'card-minimal', 'card-gold', 'card-pink', 'card-dark', 'card-nature',
];

function commonsUrl(term) {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrnamespace: '6',
    gsrlimit: '24',
    gsrsearch: term,
    prop: 'imageinfo',
    iiprop: 'url|mime',
    iiurlwidth: '1600',
    format: 'json',
    origin: '*',
  });
  return `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
}

function commonsCategoryUrl(cat) {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'categorymembers',
    gcmtitle: cat,
    gcmtype: 'file',
    gcmlimit: '30',
    prop: 'imageinfo',
    iiprop: 'url|mime',
    iiurlwidth: '1600',
    format: 'json',
    origin: '*',
  });
  return `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
}

async function collectSamples() {
  const out = [];
  for (const item of SEARCHES) {
    for (const cat of item.cats || []) await collectFrom(out, item, commonsCategoryUrl(cat));
    await collectFrom(out, item, commonsUrl(item.q));
  }
  if (out.length < LIMIT) await collectFallback(out);
  return out.filter(x => x.url).slice(0, LIMIT);
}

async function collectFallback(out) {
  for (const item of FALLBACK_PHOTOS) {
    for (let i = 0; i < 8 && out.length < LIMIT; i++) {
      if (out.filter(x => x.kind === item.kind).length >= 5) break;
      const sourceUrl = `https://loremflickr.com/1280/1600/${item.tags}?lock=${item.start + i}`;
      if (out.some(x => x.sourceUrl === sourceUrl)) continue;
      const dataUrl = await toDataUrl(sourceUrl, 'image/jpeg');
      if (!dataUrl) continue;
      out.push({ kind: item.kind, recipe: item.recipe, url: dataUrl, sourceUrl, title: `LoremFlickr ${item.tags} ${i + 1}` });
    }
  }
}

async function collectFrom(out, item, url) {
  if (out.filter(x => x.kind === item.kind).length >= 5) return;
  try {
    const res = await fetch(url);
    const json = await res.json();
    const pages = Object.values((json && json.query && json.query.pages) || {});
    for (const page of pages) {
      const info = page.imageinfo && page.imageinfo[0];
      if (!/\.(jpe?g|png|webp)$/i.test(String(page.title || ''))) continue;
      if (!info || !/^image\//.test(info.mime || '')) continue;
      const imgUrl = info.url;
      if (!imgUrl || !/\.(jpe?g|png|webp)(\?|$)/i.test(imgUrl)) continue;
      if (out.some(x => x.sourceUrl === imgUrl)) continue;
      const dataUrl = await toDataUrl(info.thumburl, info.mime) || await toDataUrl(imgUrl, info.mime);
      if (!dataUrl) continue;
      out.push({ kind: item.kind, recipe: item.recipe, url: dataUrl, sourceUrl: imgUrl, title: page.title });
      if (out.filter(x => x.kind === item.kind).length >= 5) break;
    }
  } catch (_e) { /* 다른 검색 경로가 이어서 채운다 */ }
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
  } catch (_e) {
    return null;
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  const samples = await collectSamples();
  if (samples.length < 10) {
    throw new Error(`현실 사진 샘플이 ${samples.length}장뿐입니다. 최소 10장이 필요합니다.`);
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message || e)));
  page.on('console', msg => {
    if (['error'].includes(msg.type())) errors.push(msg.text());
  });

  await installPageHelpers(page);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.PhotoEditor && window.PhotoEditorStudioPresets && window.PhotoEditorTemplatesV2 && window.PhotoEditorPremiumTemplates, null, { timeout: 45000 });
  await page.waitForTimeout(2600);
  await page.waitForFunction(() => window.PhotoEditor && window.PhotoEditorStudioPresets && window.PhotoEditorTemplatesV2 && window.PhotoEditorPremiumTemplates, null, { timeout: 45000 });

  const runs = [];
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const templateId = TEMPLATE_IDS[i % TEMPLATE_IDS.length];
    runs.push(await runOne(page, sample, templateId));
  }
  const templateAudit = await runTemplateAudit(page, samples[0].url);
  await page.evaluate(async sample => window.__photoQaPreview(sample), samples[0]);
  const screenshot = path.join(OUT_DIR, 'photo-editor-v234-studio.png');
  await page.screenshot({ path: screenshot, fullPage: false });
  await browser.close();

  const report = {
    build: '20260519-v234-studio-editor',
    checkedAt: new Date().toISOString(),
    source: 'Wikimedia Commons + LoremFlickr 공개 키워드 사진을 임시 data URL 로 테스트',
    sampleCount: samples.length,
    kinds: countBy(samples, 'kind'),
    severeBrowserErrors: errors.filter(e => !/favicon|ResizeObserver/i.test(e)),
    failures: runs.filter(r => !r.ok).concat(templateAudit.filter(r => !r.ok)),
    runs,
    templateAudit,
    screenshot,
  };
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  if (report.severeBrowserErrors.length || report.failures.length) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({
    sampleCount: report.sampleCount,
    kinds: report.kinds,
    templateCount: templateAudit.length,
    screenshot,
    report: REPORT,
  }, null, 2));
}

async function runOne(page, sample, templateId) {
  return page.evaluate(async ({ sample, templateId }) => {
    return window.__photoQaRun(sample, templateId);
  }, { sample, templateId });
}

async function runTemplateAudit(page, src) {
  return page.evaluate(async ({ src, ids }) => {
    const out = [];
    for (const id of ids) out.push(await window.__photoQaRun({ kind: 'template', recipe: 'salon-clean', url: src, title: id }, id));
    return out;
  }, { src, ids: TEMPLATE_IDS });
}

function countBy(list, key) {
  return list.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + 1;
    return acc;
  }, {});
}

async function installPageHelpers(page) {
  await page.addInitScript(() => {
    window.APP_BUILD = '20260519-v234-studio-editor';
    window.__photoQaRun = async function (sample, templateId) {
      const PE = window.PhotoEditor;
      PE.open({ src: sample.url, shopName: '잇데이 QA 살롱', initial_tab: 'auto' });
      const state = await waitForImage();
      const recipe = (window.PhotoEditorStudioPresets.RECIPES || []).find(r => r.id === sample.recipe);
      if (recipe) {
        state.adjust = Object.assign({ brightness: 100, saturate: 100, sharpness: 0, temperature: 0 }, recipe.adjust);
        state.beauty = Object.assign({}, state.beauty || {}, recipe.beauty);
        state.film = Object.assign({ presetId: null, strength: 0 }, recipe.film);
      }
      const tpl = window.PhotoEditorTemplatesV2.TEMPLATES.find(t => t.id === templateId);
      const cat = window.PhotoEditorTemplatesV2.CATS.find(c => c.id === tpl.cat);
      state.ratio = cat.ratio;
      state.tplV2 = { id: tpl.id, label: tpl.label, cat: tpl.cat, bg: '#c69b63', shopName: '잇데이 QA 살롱' };
      PE._internal.helpers.redraw();
      await new Promise(r => setTimeout(r, 90));
      const metrics = canvasStats();
      PE.close(true);
      return Object.assign({
        ok: metrics.width > 0 && metrics.height > 0 && metrics.mean > 18 && metrics.mean < 238 &&
          metrics.whiteRatio < 0.42 && metrics.pinkRatio < 0.18 && metrics.alphaZeroRatio < 0.02,
        kind: sample.kind,
        recipe: sample.recipe,
        templateId,
        title: sample.title,
      }, metrics);
    };

    window.__photoQaPreview = async function (sample) {
      document.body.classList.remove('itdasy-locked');
      const lock = document.getElementById('lockOverlay');
      if (lock) lock.classList.add('hidden');
      const PE = window.PhotoEditor;
      PE.open({ src: sample.url, shopName: '잇데이 QA 살롱', initial_tab: 'auto' });
      const state = await waitForImage();
      const recipe = (window.PhotoEditorStudioPresets.RECIPES || []).find(r => r.id === sample.recipe);
      if (recipe) {
        state.adjust = Object.assign({ brightness: 100, saturate: 100, sharpness: 0, temperature: 0 }, recipe.adjust);
        state.beauty = Object.assign({}, state.beauty || {}, recipe.beauty);
        state.film = Object.assign({ presetId: null, strength: 0 }, recipe.film);
      }
      state.activeTab = 'auto';
      PE._internal.helpers.redraw();
      PE._internal.helpers.renderPanel();
      await new Promise(r => setTimeout(r, 300));
    };

    function waitForImage() {
      return new Promise((resolve, reject) => {
        const started = Date.now();
        const tick = () => {
          const st = window.PhotoEditor && window.PhotoEditor._internal && window.PhotoEditor._internal.getState();
          if (st && st.originalImg && st.originalImg.naturalWidth) return resolve(st);
          if (Date.now() - started > 20000) return reject(new Error('사진 로드 지연'));
          setTimeout(tick, 80);
        };
        tick();
      });
    }

    function canvasStats() {
      const cv = document.getElementById('peCanvas');
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
      const step = Math.max(4, Math.floor(data.length / 70000) * 4);
      let n = 0, sum = 0, white = 0, pink = 0, alphaZero = 0;
      for (let i = 0; i < data.length; i += step) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        n += 1;
        sum += (r + g + b) / 3;
        if (r > 245 && g > 245 && b > 245) white += 1;
        if (r > 225 && g < 135 && b > 165) pink += 1;
        if (a < 10) alphaZero += 1;
      }
      return {
        width: cv.width,
        height: cv.height,
        mean: +(sum / Math.max(1, n)).toFixed(2),
        whiteRatio: +(white / Math.max(1, n)).toFixed(4),
        pinkRatio: +(pink / Math.max(1, n)).toFixed(4),
        alphaZeroRatio: +(alphaZero / Math.max(1, n)).toFixed(4),
      };
    }
  });
}

main().catch(async e => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
