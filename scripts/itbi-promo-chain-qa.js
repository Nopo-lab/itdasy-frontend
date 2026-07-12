#!/usr/bin/env node
/* 사진모드 지원 도우미 QA (옛 promo-chain 검사 대체)
   실행: python3 -m http.server 8099 후 node scripts/itbi-promo-chain-qa.js */

const { chromium } = require('playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=pmqa';
const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lJ6S5wAAAABJRU5ErkJggg==';

async function openPage(browser, errors) {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 140)); });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.ItdasyPhotoMode && window.ItdasyPhotoModeSupport && window.ItdasyActionHub, null, { timeout: 45000 });
  return page;
}

async function runSupportChecks(page, img) {
  return await page.evaluate((src) => {
    const PM = window.ItdasyPhotoMode;
    const S = window.ItdasyPhotoModeSupport;
    const FORBID = /완전|무조건|영구|치료|개선\s*보장|효과\s*보장|의료/;
    const caps = ['nail_focus', 'hair_focus', 'lash_focus', 'natural', 'glam', 'brow_focus', 'lip_focus'].map(k => S.buildCaptionDraft(k));
    const acts = S.buildActions({ currentCustomer: { id: 1, name: '김민지' } }, 'nail_focus', '캡션', ['a', 'b'], src);
    return {
      detect: {
        promo: PM.shouldStart('이 사진 홍보용으로 예쁘게 해줘', { hasPhoto: true }),
        insta: PM.shouldStart('이 사진 인스타 글까지 만들어줘', { hasPhoto: true }),
        review: PM.shouldStart('후기 카드 만들어줘', { hasPhoto: false }),
        beforeAfter: PM.shouldStart('전후 카드 만들어줘', { hasPhoto: false }),
        price: PM.shouldStart('가격표 만들어줘', { hasPhoto: false }),
        dm: PM.shouldStart('이 사진 DM으로 보내줘', { hasPhoto: true }),
      },
      copy: { nailish: /네일|손끝|광택/.test(S.buildCaptionDraft('nail_focus')), forbidden: caps.filter(c => FORBID.test(c)) },
      actions: { count: acts.length, phases: acts.map(a => a.phase), kinds: acts.map(a => a.kind),
        hasPublish: acts.some(a => /publish|게시/.test(a.kind) || /게시/.test(a.label)), hasDanger: acts.some(a => a.phase === 'danger') },
    };
  }, img);
}

async function runModeChecks(page, img) {
  return await page.evaluate(async (src) => {
    const PM = window.ItdasyPhotoMode;
    window.Booking = { list: async () => [] };
    window.ChatAutoEdit = { processPhoto: async (o) => ({ dataUrl: o.src, preset_label: 'QA' }) };
    window.fetch = async () => ({ ok: true, json: async () => ({ caption: '오늘 작업 완성본이에요.', hashtags: ['itbi'] }) });
    PM.exit();
    const askPhoto = await PM.handleText('이 사진 인스타 홍보용으로 예쁘게 해줘', {});
    PM.exit();
    const captionAsk = await PM.handlePhotos([src], '캡션 만들어줘', {});
    PM.exit();
    return {
      textStartAsksPhoto: /사진/.test(askPhoto.text || ''),
      captionStep: /어떤 시술/.test(captionAsk.text || ''),
      oldGlobalsGone: !window.ItdasyPhotoFlow && !window.ItdasyPromoPhotoChain,
    };
  }, img);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const page = await openPage(browser, errors);
  const support = await runSupportChecks(page, IMG);
  const mode = await runModeChecks(page, IMG);
  const out = { ...support, mode, severeErrors: errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK/i.test(e)) };
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
}

main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
