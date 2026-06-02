#!/usr/bin/env node
/* W 시리즈 첫 경험 QA
   - 430x920 모바일 기준
   - 실사진/스크린샷 저장 없음
   - 홈 CTA, 사진 첨부 칩, Instagram Ready 카드, 안전 버튼을 확인 */

const { chromium } = require('playwright');
const { execSync } = require('child_process');

const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=firstwow';

function gitNames(cmd) {
  try { return execSync(cmd, { encoding: 'utf8' }).split(/\n+/).filter(Boolean); }
  catch (_e) { return []; }
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 430, height: 920 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 160)); });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => (
    window.HomeV41Render && window.HomeV41ItbiPrompts &&
    window.ItdasyAssistantPendingPhotos && window.ItdasyPromoPhotoChain &&
    window.ItdasyPromoResultCard && window.ItdasyActionHub
  ), null, { timeout: 45000 });

  const out = await page.evaluate(async () => {
    const calls = [];
    window.openInstagramPreview = function () { calls.push('openInstagramPreview'); };
    window.publishInstagram = function () { calls.push('publishInstagram'); };
    window.sendMessage = function () { calls.push('sendMessage'); };
    window.Booking = Object.assign(window.Booking || {}, { create: function () { calls.push('Booking.create'); } });

    const r = {};
    const homeHtml = window.HomeV41Render.compose({ shop_name: '테스트샵' }, 0, 0);
    const home = document.createElement('div');
    home.innerHTML = homeHtml;
    const promptBtns = Array.from(home.querySelectorAll('[data-itbi-prompt]'));
    r.home = {
      hasPhotoPromo: /사진 홍보용으로 만들기/.test(home.textContent || ''),
      order: promptBtns.map(b => b.textContent.trim()),
      firstStrong: /background:#191F28|background:\s*#191F28/i.test(promptBtns[0] && promptBtns[0].getAttribute('style') || ''),
    };

    const noPhoto = window.ItdasyPromoPhotoChain.runPromoPhotoChain('이 사진 인스타 홍보용으로 예쁘게 해줘', {});
    r.noPhoto = {
      needsPhoto: !!noPhoto.needsPhoto,
      hasOpenPhoto: (noPhoto.hubActions || []).some(a => /사진 열기/.test(a.label || '')),
    };

    const chips = window.ItdasyAssistantPendingPhotos.PHOTO_CHIPS || [];
    const madeWrap = !document.getElementById('asstPending');
    const madeInput = !document.getElementById('asstInput');
    const wrap = document.getElementById('asstPending') || document.createElement('div');
    const input = document.getElementById('asstInput') || document.createElement('input');
    if (madeWrap) { wrap.id = 'asstPending'; document.body.appendChild(wrap); }
    if (madeInput) { input.id = 'asstInput'; document.body.appendChild(input); }
    wrap.innerHTML = '';
    input.value = '';
    let sendCount = 0;
    const pending = window.ItdasyAssistantPendingPhotos.create({ send: () => { sendCount += 1; }, esc: s => String(s) });
    pending.add([new File(['fake'], 'wow.png', { type: 'image/png' })]);
    wrap.querySelector('[data-photo-chip]')?.click();
    r.chips = {
      firstLabel: chips[0] && chips[0].label,
      labels: chips.map(c => c.label),
      sendCount,
      inputText: input.value,
      startsPromo: window.ItdasyPromoPhotoChain.detectPromoPhotoChain(input.value),
    };
    if (madeWrap) wrap.remove();
    if (madeInput) input.remove();

    const recos = window.ItdasyPromoPhotoChain.buildPromoTemplateRecos('네일 사진 홍보용으로 해줘', {});
    const caption = window.ItdasyPromoPhotoChain.buildPromoCaptionDraft('nail_focus');
    const actions = window.ItdasyPromoPhotoChain.buildPromoActions(
      { currentCustomer: null }, 'nail_focus', caption, recos, 'data:image/png;base64,after'
    );
    const msg = {
      role: 'assistant',
      text: '',
      hub_actions: actions,
      photo_result: { dataUrl: 'data:image/png;base64,after', ratio: '4:5' },
      promo_result: {
        recipeId: 'nail_focus',
        industryLabel: '네일',
        effect: window.ItdasyPromoPhotoChain.buildPromoEffectText('nail_focus'),
        caption,
        templateRecos: recos,
        beforeDataUrl: 'data:image/png;base64,before',
        afterDataUrl: 'data:image/png;base64,after',
        customerName: '',
      },
    };
    const card = document.createElement('div');
    card.innerHTML = window.ItdasyPromoResultCard.render(msg, 4, { esc: s => String(s).replace(/[&<>"']/g, '') });
    document.body.appendChild(card);
    const text = card.textContent || '';
    const rect = card.firstElementChild.getBoundingClientRect();
    r.card = {
      hasCard: !!card.querySelector('.asst-promo-result'),
      hasBadge: /Instagram Ready/.test(text),
      hasBeforeAfter: /Before/.test(text) && /After/.test(text),
      hasImage: card.querySelectorAll('img').length >= 1,
      hasCaption: /캡션 초안/.test(text) && caption.length > 10,
      templateThumbs: card.querySelectorAll('.asst-tpl-recos > *').length,
      ctas: actions.map(a => a.label),
      hasSaveGuide: /고객을 선택하면 시술 기록으로 저장할 수 있어요/.test(text),
      noAutoWords: !/자동\s*(게시|발송)|바로\s*(게시|발송)|게시했어요|발송했어요|보냈어요/.test(text),
      mobileWidthOk: rect.width <= 430,
    };
    actions.forEach(a => {
      try { window.ItdasyActionHub.handleActionClick(a, {}); } catch (_e) { /* ignore */ }
    });
    r.safety = {
      publish: calls.filter(c => c === 'publishInstagram').length,
      send: calls.filter(c => c === 'sendMessage').length,
      bookingCreate: calls.filter(c => c === 'Booking.create').length,
      previewCalls: calls.filter(c => c === 'openInstagramPreview').length,
      dangerActions: actions.filter(a => a.phase === 'danger').length,
    };
    r.regression = {
      cf1: !!noPhoto.needsPhoto,
      cf4: typeof window.ItdasyActionHub.handleActionClick === 'function',
      tpl: recos.length === 3,
      j1: !!window.ItdasyActionHub,
      j2: !!window.ItdasyPromoPhotoChain,
      j3: !!window.ItdasyCustomerStatusCard,
      j5: !!window.ItdasyMarketingDraftPolicy,
      briefing: !!window.ItdasyDailyBriefing,
      customerCard: !!window.ItdasyCustomerStatusCard,
    };
    return r;
  });

  out.severeErrors = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK/i.test(e));
  const changed = gitNames('git diff --name-only');
  out.diffGuard = {
    beautyEngineTouched: changed.some(n => /beauty-engine\.js$/.test(n)),
    metaTouched: changed.some(n => /(^|\/)(meta|instagram|oauth)/i.test(n)),
    outputTouched: changed.some(n => /^output\/playwright\//.test(n)),
    changedFiles: changed,
  };
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
}

main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
