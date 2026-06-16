#!/usr/bin/env node
/* 잇비 사진편집 모드 가이드형 흐름 QA
   실행: python3 -m http.server 8099 후 node scripts/photo-mode-guided-qa.js */

const { chromium } = require('playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&debug=1&v=pmguided';
const A = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR42mP8z8BQz0AEYBxVSFIAFJ0CBTSy2TQAAAAASUVORK5CYII=';
const B = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR42mNkYPjPwMDAwMDAAAAKfAIC8TQvSAAAAABJRU5ErkJggg==';

async function openPage(browser, errors) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 160)); });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.ItdasyPhotoMode && window.ItdasyPhotoModeSupport && window.ItdasyActionHub, null, { timeout: 45000 });
  return page;
}

async function installStubs(page, imgs) {
  await page.evaluate(({ a }) => {
    window.Booking = { list: async () => [] };
    window.PhotoEditorTemplateMarketData = Object.assign(window.PhotoEditorTemplateMarketData || {}, {
      CATS: [{ id: 'feed', ratio: '4:5' }, { id: 'ba', ratio: '4:5' }],
      lookupById: (id) => ({ id, cat: /^ba/.test(id) ? 'ba' : 'feed', label: /^ba/.test(id) ? '시술 전후' : '시술 완성' }),
      recommendTemplates: () => [{ id: 'feed-showcase' }, { id: 'feed-review' }, { id: 'ba-cream' }],
    });
    window.PhotoEditorTemplateGallery = { previewURL: () => a };
    window.ChatAutoEdit = { processPhoto: async (o) => ({ dataUrl: o.src, preset_label: 'QA 보정' }) };
    window.saveAssistantTemplateResult = async () => ({ gallery: true, slot: true });
    window.TreatmentLink = { attachPhotoToCustomer: async () => ({ ok: true }) };
    window.fetch = async () => ({ ok: true, json: async () => ({ caption: '레이어드 컷 완성본이에요.', hashtags: ['itbi', 'hair'] }) });
  }, imgs);
}

async function checkRouting(page) {
  return await page.evaluate(() => {
    const PM = window.ItdasyPhotoMode;
    return {
      promoPhoto: PM.shouldStart('이 사진 홍보용으로 예쁘게 해줘', { hasPhoto: true }),
      captionPhoto: PM.shouldStart('캡션 만들어줘', { hasPhoto: true }),
      price: PM.shouldStart('가격표 만들어줘', { hasPhoto: false }),
      dm: PM.shouldStart('이 사진 DM으로 보내줘', { hasPhoto: true }),
      oldGlobalsGone: !window.ItdasyPhotoFlow && !window.ItdasyPromoPhotoChain,
    };
  });
}

async function checkBeforeAfter(page, imgs) {
  return await page.evaluate(async ({ a, b }) => {
    const PM = window.ItdasyPhotoMode;
    PM.exit();
    const start = await PM.handleText('전후 카드 만들어줘', {});
    await PM.handlePhotos([a], '홍보용으로 예쁘게 해줘', {});
    const askSecond = await PM.handleText('전후 카드 만들어줘', {});
    const second = await PM.handlePhotos([b], '', {});
    PM.exit();
    const direct = await PM.handlePhotos([a, b], '전후 카드 만들어줘', {});
    const ctas = (direct.related || []).join(',');
    PM.exit();
    return { startAsksPhoto: /사진/.test(start.text || ''),
      asksSecond: /사진 2장|사진 1장 더/.test(askSecond.text || ''),
      secondHasResult: !!(second && second.photo_result && second.photo_result.dataUrl),
      directHasResult: !!(direct && direct.photo_result && direct.photo_result.dataUrl),
      editCtas: /전 사진 편집/.test(ctas) && /후 사진 편집/.test(ctas) };
  }, imgs);
}

async function checkCaption(page, imgs) {
  return await page.evaluate(async ({ a }) => {
    const PM = window.ItdasyPhotoMode;
    PM.exit();
    const capPrompt = await PM.handlePhotos([a], '캡션 만들어줘', {});
    const capDone = await PM.handleText('레이어드 컷', {});
    PM.exit();
    return { asksTreatment: /어떤 시술/.test(capPrompt.text || ''),
      hasResult: !!(capDone.photo_result && capDone.photo_result.dataUrl),
      hasCaption: /레이어드 컷|완성본/.test(capDone.photo_caption || ''),
      hasActions: Array.isArray(capDone.hub_actions) && capDone.hub_actions.length >= 3 };
  }, imgs);
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader'] });
  const errors = [];
  const page = await openPage(browser, errors);
  await installStubs(page, { a: A, b: B });
  const route = await checkRouting(page);
  const beforeAfter = await checkBeforeAfter(page, { a: A, b: B });
  const caption = await checkCaption(page, { a: A, b: B });
  const out = { route, beforeAfter, caption, severeErrors: errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK/i.test(e)) };
  out.PASS = route.promoPhoto && route.captionPhoto && !route.price && !route.dm && route.oldGlobalsGone
    && beforeAfter.startAsksPhoto && beforeAfter.asksSecond && beforeAfter.secondHasResult
    && beforeAfter.directHasResult && beforeAfter.editCtas
    && caption.asksTreatment && caption.hasResult && caption.hasCaption && caption.hasActions
    && out.severeErrors.length === 0;
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
  process.exit(out.PASS ? 0 : 1);
}

main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
