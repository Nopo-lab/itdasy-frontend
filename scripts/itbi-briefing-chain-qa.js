#!/usr/bin/env node
/* J-4 브리핑 추천 액션 강화 QA (런타임 미수정, 스텁 — 실데이터 불필요)
   - 5종 추천(retouch/unlinked/empty_slot/at_risk/unrecorded) runAction → {message, hubActions}
   - 체인 버튼 phase(safe/confirm) + 연결 kind 검증, danger 0
   - 체인 버튼 클릭(ActionHub) 안전성: send/Booking.create/publish/TreatmentLink/Revenue 자동실행 0
   - confirm 버튼은 안내까지만(자동 실행 X), safe chat_suggest 는 chatInput 만
   실행: python3 -m http.server 8099 후 node scripts/itbi-briefing-chain-qa.js (PHOTO_QA_URL 지정 가능) */

const { chromium } = require('playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=bchainqa';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 140)); });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.ItdasyDailyBriefing && window.ItdasyActionHub, null, { timeout: 45000 });

  const out = await page.evaluate(() => {
    const B = window.ItdasyDailyBriefing; const H = window.ItdasyActionHub;
    const calls = [];
    window.sendMessage = function () { calls.push('sendMessage'); };
    window.publishInstagram = function () { calls.push('publishInstagram'); };
    window.openCalendarView = function () {}; window.openCustomers = function () {};
    window.openRevenueHub = function () {}; window.showTab = function () {};
    window.Booking = Object.assign(window.Booking || {}, { create: function () { calls.push('Booking.create'); } });
    window.TreatmentLink = Object.assign(window.TreatmentLink || {}, { attachPhotoToCustomer: function () { calls.push('TreatmentLink.attach'); } });
    window.Revenue = Object.assign(window.Revenue || {}, { create: function () { calls.push('Revenue.create'); } });

    const ACTIONS = [
      { id: 'retouch_draft', kind: 'retouch_draft', label: '리터치 안내 초안', safety: 'safe', payload: { customers: [{ id: 10, name: '김민지' }] } },
      { id: 'unlinked_photos', kind: 'open_unlinked_photos', label: '미연결 사진 확인', safety: 'safe', payload: { count: 2 } },
      { id: 'empty_slot', kind: 'open_empty_slot', label: '공백 시간 활용', safety: 'safe', payload: { first: '14:00' } },
      { id: 'at_risk', kind: 'open_at_risk', label: '이탈 고객 확인', safety: 'safe', payload: { count: 3 } },
      { id: 'unrecorded_revenue', kind: 'open_unrecorded', label: '매출 미기록 정리', safety: 'safe', payload: { count: 1 } },
    ];

    const r = { cards: {}, danger: [], confirmExec: [] };
    ACTIONS.forEach((a) => {
      const res = B.runAction(a);
      const acts = res.hubActions || [];
      r.cards[a.kind] = {
        hasMsg: !!res.message,
        count: acts.length,
        kinds: acts.map(x => x.kind),
        phases: acts.map(x => H.normalizeActions([x])[0].phase),
      };
      // 각 체인 버튼 클릭 — 안전성/반환 확인
      acts.forEach((btn) => {
        const norm = H.normalizeActions([btn])[0];
        if (norm.phase === 'danger') r.danger.push(a.kind + ':' + btn.kind);
        const out2 = H.handleActionClick(norm, {});
        // confirm 버튼이 실제 실행(navigated) 되면 위반
        if (norm.phase === 'confirm' && out2 && out2.navigated) r.confirmExec.push(a.kind + ':' + btn.kind);
      });
    });
    r.safety = {
      sendMessage: calls.filter(c => c === 'sendMessage').length,
      bookingCreate: calls.filter(c => c === 'Booking.create').length,
      publish: calls.filter(c => c === 'publishInstagram').length,
      treatmentAttach: calls.filter(c => c === 'TreatmentLink.attach').length,
      revenueCreate: calls.filter(c => c === 'Revenue.create').length,
    };
    return r;
  });

  out.severeErrors = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK/i.test(e));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
}
main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
