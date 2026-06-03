#!/usr/bin/env node
/* J-6 원장 하루 운영 E2E (런타임 미수정, 읽기 위주 — 생성/발송/게시 0)
   배포본 + 데모계정으로 실제 잇비 채팅 흐름을 구동:
   브리핑 → 추천 클릭 → 고객 상태 → 사진 체인(사진없음) → 리터치 초안.
   안전성: 실행 전/후 staging 고객·예약 수 비교(자동 생성 0), pageerror 수집.
   실행: node scripts/itbi-day-e2e-qa.js (BETA_URL/DEMO_EMAIL/DEMO_PW env 가능) */

const { chromium } = require('playwright');
const PAGES = process.env.BETA_URL || 'https://nopo-lab.github.io/itdasy-frontend-test-yeunjun/';
const API = 'https://itdasy-backend-staging-644329093453.asia-northeast3.run.app';
const EMAIL = process.env.DEMO_EMAIL || 'review@itdasy.com';
const PW = process.env.DEMO_PW || 'review1234!';

async function apiCounts() {
  const fetchJson = async (url, opts) => { const r = await fetch(url, opts); return r.ok ? r.json() : null; };
  const tok = (await fetchJson(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PW }) }) || {}).access_token;
  const H = { Authorization: 'Bearer ' + tok };
  const custs = await fetchJson(API + '/customers', { headers: H }) || [];
  const c = Array.isArray(custs) ? custs : (custs.items || []);
  const from = new Date(Date.now() - 7 * 86400000).toISOString(), to = new Date(Date.now() + 30 * 86400000).toISOString();
  const bks = await fetchJson(API + '/bookings?from=' + from + '&to=' + to, { headers: H }) || [];
  const b = Array.isArray(bks) ? bks : (bks.items || []);
  return { customers: c.length, bookings: b.length, firstName: (c[0] && c[0].name) || '', token: tok };
}

async function ask(page, text) {
  const before = await page.evaluate(() => document.querySelectorAll('#asstBody .asst-msg--ai').length);
  await page.fill('#asstInput', text);
  await page.click('#asstSend');
  try {
    await page.waitForFunction((b) => {
      const ai = document.querySelectorAll('#asstBody .asst-msg--ai');
      if (ai.length <= b) return false;
      const last = ai[ai.length - 1];
      return last && !/생성 중|분석 중|답변 생성|loading/i.test(last.textContent || '') && (last.textContent || '').trim().length > 1;
    }, before, { timeout: 30000 });
  } catch (_e) { void 0; }
  await page.waitForTimeout(800);
  return page.evaluate(() => {
    const ai = document.querySelectorAll('#asstBody .asst-msg--ai');
    const last = ai[ai.length - 1];
    if (!last) return { text: '', buttons: [] };
    const btns = [...last.querySelectorAll('button')].filter(x => x.hasAttribute('data-asst-hub-act') || x.hasAttribute('data-asst-brief-act'))
      .map(x => ({ label: x.textContent.trim(), phase: x.getAttribute('data-hub-phase') || '', route: x.hasAttribute('data-asst-hub-act') ? 'hub' : 'brief' }));
    return { text: (last.textContent || '').replace(/신고$/, '').trim().slice(0, 160), buttons: btns };
  });
}

async function main() {
  const before = await apiCounts();
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 430, height: 920 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 140)); });

  const report = { url: PAGES, build: '', steps: {}, errors: [] };
  await page.goto(PAGES, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  report.build = await page.evaluate(() => window.APP_BUILD || '');

  // 로그인
  try { await page.click('#emailFoldBtn', { timeout: 5000 }); } catch (_e) { void 0; }
  await page.waitForTimeout(500);
  await page.fill('#loginEmail', EMAIL); await page.fill('#loginPassword', PW);
  await page.click('#loginBtn');
  let loggedIn = false;
  try { await page.waitForFunction(() => { const l = document.getElementById('lockOverlay'); return !l || l.classList.contains('hidden') || l.style.display === 'none'; }, null, { timeout: 40000 }); loggedIn = true; } catch (_e) { void 0; }
  await page.waitForTimeout(2000);
  report.steps['1_login'] = { loggedIn, build: report.build };

  // 잇비 열기
  await page.evaluate(() => window.openAssistant && window.openAssistant());
  await page.waitForSelector('#asstInput', { state: 'visible', timeout: 15000 });
  await page.waitForTimeout(800);

  // 2. 오늘 브리핑
  report.steps['2_briefing'] = await ask(page, '오늘 뭐 해야 돼?');
  // 3. 브리핑 추천 클릭(있으면 첫 번째)
  const recoClicked = await page.evaluate(() => { const b = document.querySelector('#asstBody .asst-msg--ai:last-child [data-asst-brief-act]'); if (b) { b.click(); return b.textContent.trim(); } return null; });
  if (recoClicked) { await page.waitForTimeout(1500); report.steps['3_reco_expand'] = await page.evaluate(() => { const ai = document.querySelectorAll('#asstBody .asst-msg--ai'); const last = ai[ai.length - 1]; return { clicked: true, buttons: [...last.querySelectorAll('button')].filter(x => x.hasAttribute('data-asst-hub-act')).map(x => ({ label: x.textContent.trim(), phase: x.getAttribute('data-hub-phase') })) }; }); }
  else report.steps['3_reco_expand'] = { clicked: false, note: '브리핑 추천 버튼 없음(조용한 날 가능)' };

  // 4. 고객 상태 카드 (staging 실제 고객명)
  const nm = before.firstName || '민지';
  report.steps['4_customer_status'] = await ask(page, nm + '님 뭐 챙겨야 돼?');
  // 5. 리터치 초안 (draft-only)
  report.steps['5_retouch_draft'] = await ask(page, nm + '님 리터치 안내 문구 만들어줘');
  // 6. 홍보 사진 체인 (사진 없음 → 안내)
  report.steps['6_promo_no_photo'] = await ask(page, '이 사진 인스타 홍보용으로 정리해줘');

  report.errors = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK|the server responded|Failed to load resource/i.test(e)).slice(0, 8);
  await browser.close();

  const after = await apiCounts();
  report.autoCreate = { customersBefore: before.customers, customersAfter: after.customers, bookingsBefore: before.bookings, bookingsAfter: after.bookings,
    noCustomerCreated: before.customers === after.customers, noBookingCreated: before.bookings === after.bookings };
  console.log(JSON.stringify(report, null, 2));
}
main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
