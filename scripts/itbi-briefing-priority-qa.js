#!/usr/bin/env node
/* ④ 잇비 브리핑 매출 우선순위 랭킹 QA (런타임 미수정, 신호 스텁 — 실데이터 불필요)
   - rank: 신호 점수화 → 매출영향 큰 순 TOP3, 항목별 이유/효과/버튼
   - 항목별 Action Hub 버튼 2~3개, danger 0, confirm 안내(자동실행 X)
   - fallback: 신호 0 → 대체 추천(빈 화면 방지)
   - 매출 추정: avgTicket 있을 때만 "추정", 없으면 정성 표현(허위예측 0)
   - runAction 신규 kind: at_risk_revisit/promo_from_photo/record_revenue 안전
   - 안전성: send/Booking.create/Revenue.create/publish 자동호출 0
   실행: python3 -m http.server 8099 후 node scripts/itbi-briefing-priority-qa.js */

const { chromium } = require('playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=bprqa';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 430, height: 920 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 140)); });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.ItdasyBriefingPriority && window.ItdasyDailyBriefing, null, { timeout: 45000 });

  const out = await page.evaluate(() => {
    const PR = window.ItdasyBriefingPriority, DB = window.ItdasyDailyBriefing;
    const r = {};
    // 풀세트 랭킹(avgTicket 있음)
    const full = PR.rank({ retouch: { count: 3, customers: [{ id: 1, name: '김민지' }] }, unrecorded: { count: 1 }, emptySlots: [{ from: '14:00' }, { from: '17:00' }], atRisk: { count: 2 }, unlinked: { count: 2 }, revenueTotal: 540000, avgTicket: 60000 }, { limit: 3 });
    r.full = { count: full.items.length, keys: full.items.map(i => i.key),
      allHaveReason: full.items.every(i => !!i.reason), allHaveBtns: full.items.every(i => (i.actions || []).length >= 2 && (i.actions || []).length <= 3),
      hasEstimate: /추정/.test(full.items.map(i => i.title).join(' ')), summary: full.summaryLine };
    // avgTicket 없음 → 추정 금액 없이 정성 표현
    const noTicket = PR.rank({ retouch: { count: 2, customers: [] } }, { limit: 3 });
    r.noTicketNoWon = !/추정 \d+만원/.test(noTicket.items.map(i => i.title).join(' '));
    // fallback
    const empty = PR.rank({}, { limit: 3 });
    r.fallback = { isFallback: empty.fallback, hasActions: (empty.fallbackActions || []).length > 0, summary: empty.summaryLine.slice(0, 25) };
    // 항목별 버튼 kind/phase
    const u = full.items.find(i => i.key === 'unrecorded');
    r.unrecBtns = (u.actions || []).map(a => a.kind + '/' + (a.safety || 'safe'));
    // danger 없는지
    r.anyDanger = full.items.some(i => (i.actions || []).some(a => a.safety === 'danger'));
    // runAction 신규 kind + 안전성
    const calls = [];
    window.publishInstagram = () => calls.push('pub'); window.sendMessage = () => calls.push('send');
    window.Booking = Object.assign(window.Booking || {}, { create: () => calls.push('bk') });
    window.Revenue = Object.assign(window.Revenue || {}, { create: () => calls.push('rev') });
    window.TreatmentLink = Object.assign(window.TreatmentLink || {}, { attachPhotoToCustomer: () => calls.push('tl') });
    const a1 = DB.runAction({ kind: 'at_risk_revisit', payload: {} });
    const a2 = DB.runAction({ kind: 'promo_from_photo', payload: {} });
    const a3 = DB.runAction({ kind: 'record_revenue', payload: {} });
    r.newKinds = { revisitChat: !!a1.chatInput, promoChat: !!a2.chatInput, recRevConfirmOnly: !!(a3.message && !a3.chatInput) };
    r.safety = { pub: calls.filter(c => c === 'pub').length, send: calls.filter(c => c === 'send').length, bk: calls.filter(c => c === 'bk').length, rev: calls.filter(c => c === 'rev').length, tl: calls.filter(c => c === 'tl').length };
    return r;
  });

  out.severeErrors = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK/i.test(e));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
}
main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
