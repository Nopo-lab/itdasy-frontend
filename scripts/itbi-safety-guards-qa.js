#!/usr/bin/env node
/* 잇비 안전 가드 1차 패치 QA (A4 / B10 / B4) — 런타임 스텁 주입, 실데이터 불필요.
   A4: 고객명 정확 일치(100)만 자동 확정, 유사(60/80/90)는 확인·후보 안내로 멈춤(create/cancel/draft).
   B10: 가격 0건이면 가격표 성공 금지(priceMissing), 가격 있으면 정상.
   B4: 캡션/카피 의도("예약 유도 문구 포함 캡션")는 caption 기능으로, "유도" 고객명 추출 금지, 문자초안 무회귀.
   실행: python3 -m http.server 8099 후 node scripts/itbi-safety-guards-qa.js (PHOTO_QA_URL 지정 가능) */

const { chromium } = require('playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=itbiqa';

function ok(cond) { return cond ? 'PASS' : 'FAIL'; }

async function main() {
  const browser = await chromium.launch({ headless: true });
  // SW 차단: 버전 불일치 캐시버스트 리로드가 send 클릭 도중 페이지를 새로고침하는 것 방지(테스트 격리)
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 430, height: 920 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 160)); });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.AssistantIntent
    && typeof window.AssistantIntent.tryCreateBooking === 'function'
    && window.ItdasyAssistantPriceList
    && typeof window.openAssistant === 'function', null, { timeout: 45000 });

  // ── A4 / B10: 순수 로직(AssistantIntent / PriceList) ──────────────────────
  const logic = await page.evaluate(async () => {
    try { localStorage.removeItem('assistant_router_disabled'); localStorage.setItem('shop_type', '네일'); } catch (_e) { void 0; }
    if (typeof window.authHeader !== 'function') window.authHeader = function () { return {}; };
    const I = window.AssistantIntent;
    const P = window.ItdasyAssistantPriceList;

    // 고객 스텁: 황민지·문하영 존재(김민지·윤하영 없음). Booking 없음(충돌체크 skip).
    const CUSTOMERS = [
      { id: 1, name: '황민지', phone: '010-0000-0001' },
      { id: 2, name: '문하영', phone: '010-0000-0002' },
    ];
    window.apiFetch = async function (path) {
      if (/\/customers/.test(path)) return { ok: true, json: async () => ({ items: CUSTOMERS }) };
      if (/\/bookings/.test(path)) return { ok: true, json: async () => ({ items: [] }) };
      return { ok: true, json: async () => ({}) };
    };
    window.loadGalleryItemsByCustomer = async function () { return [{ id: 1, label: '젤네일' }]; };

    const r = {};
    // A4-1 create 유사(김민지→황민지 60) 자동확정 금지
    const c1 = await I.tryCreateBooking('내일 오후 3시 김민지 커트 예약 잡아줘', {});
    r.a4_create_fuzzy = { kind: c1 && c1.kind, isAsk: !!(c1 && c1.kind === 'message' && /정확히 일치/.test(c1.text || '')) };
    // A4-2 create 정확(황민지 100) → 카드(무회귀)
    const c2 = await I.tryCreateBooking('내일 오후 3시 황민지 커트 예약 잡아줘', {});
    r.a4_create_exact = { kind: c2 && c2.kind, isCard: !!(c2 && c2.kind === 'card') };
    // A4-3 윤하영→문하영(60) 자동확정 금지
    const c3 = await I.tryCreateBooking('내일 3시 윤하영 예약 잡아줘', {});
    r.a4_create_yoon = { kind: c3 && c3.kind, isAsk: !!(c3 && c3.kind === 'message' && /정확히 일치/.test(c3.text || '')) };
    // A4-4 cancel 유사 자동확정 금지
    const c4 = await I.tryCancelBooking('김민지 예약 취소해줘');
    r.a4_cancel_fuzzy = { kind: c4 && c4.kind, isAsk: !!(c4 && c4.kind === 'message' && /정확히 일치/.test(c4.text || '')) };
    // A4-5 draft 유사 자동확정 금지(황민지로 실행 안 됨)
    const c5 = await I.tryDraftMessage('김민지 안부 문자 써줘', {});
    r.a4_draft_fuzzy = { kind: c5 && c5.kind, isAsk: !!(c5 && c5.kind === 'message' && /정확히 일치/.test(c5.text || '')) };
    // A4-6 draft 정확(무회귀) → '정확히 일치' ask 아님
    const c6 = await I.tryDraftMessage('황민지 안부 문자 써줘', {});
    r.a4_draft_exact = { kind: c6 && c6.kind, notAsk: !(c6 && /정확히 일치/.test(c6.text || '')) };

    // B10-1 가격 없는 홍보물 → 성공 금지 + priceMissing
    const p1 = P.parseRequest('가격 없는 홍보물로 가격표 만들어줘');
    r.b10_nopriced = { matched: p1.matched, priceMissing: p1.priceMissing, priced: p1.priced };
    // B10-2 정상 가격표 → 성공(무회귀)
    const p2 = P.parseRequest('컷 30000원 펌 50000원 가격표 만들어줘');
    r.b10_full = { matched: p2.matched, priced: p2.priced };
    // B10-3 일부 누락 → 가격 있는 행 유지(matched)
    const p3 = P.parseRequest('컷 30000원 펌 가격표 만들어줘');
    r.b10_partial = { matched: p3.matched, priced: p3.priced };
    // B10-4 전화번호만 → 가격으로 오인 금지(성공 금지)
    const p4 = P.parseRequest('문의 010-1234-5678 홍보물 가격표 만들어줘');
    r.b10_phone = { matched: p4.matched, priced: p4.priced, priceMissing: p4.priceMissing };

    // B4(router) "유도" 고객명 추출 금지 — '유도님 못찾음' 안 나와야
    const b1 = await I.tryDraftMessage('예약 유도 문구 포함해서 캡션 만들어줘', {});
    r.b4_yudo_notname = { kind: b1 && b1.kind, noYudo: !(b1 && /유도/.test(b1.text || '')) };
    return r;
  });

  // ── B4: 통합 라우팅(캡션 우선 → openInstantCaption) ───────────────────────
  await page.evaluate(() => { window.openAssistant(); });
  await page.waitForSelector('#asstInput', { state: 'attached', timeout: 8000 });
  await page.evaluate(() => {
    window.openInstantCaption = function () { window.__capCalls = (window.__capCalls || 0) + 1; };
    if (typeof window.authHeader !== 'function') window.authHeader = function () { return {}; };
    window.apiFetch = async function (path) {
      if (/\/customers/.test(path)) return { ok: true, json: async () => ({ items: [{ id: 1, name: '황민지', phone: '010-0000-0001' }] }) };
      return { ok: true, json: async () => ({ answer: '(stub)', actions: [] }) };
    };
  });

  async function sendAndCount(text) {
    await page.evaluate((t) => {
      window.__capCalls = 0;
      const input = document.getElementById('asstInput');
      input.value = t;
      document.getElementById('asstSend').click();
    }, text);
    await page.waitForTimeout(700);
    return await page.evaluate(() => window.__capCalls || 0);
  }

  // [§4 qa-D] 캡션은 1초캡션 팝업(openInstantCaption)으로 가면 안 되고 잇비 대화 안에서 처리 → capCalls 항상 0.
  const route = {};
  route.cap_plain = await sendAndCount('캡션 만들어줘');            // → 대화형(팝업 0)
  route.cap_insta = await sendAndCount('인스타 캡션 만들어줘');      // → 대화형(팝업 0)
  route.cap_yudo  = await sendAndCount('예약 유도 문구 포함해서 캡션 만들어줘');  // → 대화형(팝업 0)
  route.cap_hash  = await sendAndCount('해시태그도 같이 만들어줘');  // → 대화형(팝업 0)
  route.cap_insta_again = await sendAndCount('더 인스타스럽게 다시');  // → 대화형 재생성(팝업 0)
  route.draft_msg = await sendAndCount('황민지 고객에게 예약 확인 문자 써줘');     // → draft(캡션 아님)=0

  await browser.close();

  // ── 결과 출력 ──────────────────────────────────────────────────────────
  const L = logic;
  const checks = [
    ['A4 create 유사 자동확정 금지', L.a4_create_fuzzy.isAsk],
    ['A4 create 정확 무회귀(카드)', L.a4_create_exact.isCard],
    ['A4 윤하영→문하영 금지', L.a4_create_yoon.isAsk],
    ['A4 cancel 유사 금지', L.a4_cancel_fuzzy.isAsk],
    ['A4 draft 유사 금지', L.a4_draft_fuzzy.isAsk],
    ['A4 draft 정확 무회귀', L.a4_draft_exact.notAsk],
    ['B10 가격없음 성공금지', L.b10_nopriced.matched === false && L.b10_nopriced.priceMissing === true],
    ['B10 정상 가격표 무회귀', L.b10_full.matched === true && L.b10_full.priced >= 2],
    ['B10 일부누락 가격행 유지', L.b10_partial.matched === true && L.b10_partial.priced >= 1],
    ['B10 전화번호 오인 금지', L.b10_phone.matched === false],
    ['B4 "유도" 고객명 추출금지', L.b4_yudo_notname.noYudo],
    ['B4 캡션 1초팝업 금지(plain)', route.cap_plain === 0],
    ['B4 캡션 1초팝업 금지(insta)', route.cap_insta === 0],
    ['B4 유도문구캡션 1초팝업 금지', route.cap_yudo === 0],
    ['B4 해시태그 1초팝업 금지', route.cap_hash === 0],
    ['B4 "더 인스타스럽게 다시" 1초팝업 금지', route.cap_insta_again === 0],
    ['B4 문자초안 무회귀(caption=0)', route.draft_msg === 0],
  ];
  console.log('\n=== 잇비 안전 가드 QA (A4 / B10 / B4) ===');
  let pass = 0;
  checks.forEach(([name, cond]) => { console.log(`[${ok(cond)}] ${name}`); if (cond) pass++; });
  console.log(`\n결과: ${pass}/${checks.length} PASS`);
  console.log('상세:', JSON.stringify({ logic: L, route }, null, 2));
  if (errors.length) console.log('\n페이지 에러:\n' + errors.slice(0, 8).join('\n'));
  process.exit(pass === checks.length ? 0 : 1);
}

main().catch(e => { console.error('QA 실행 실패:', e); process.exit(2); });
