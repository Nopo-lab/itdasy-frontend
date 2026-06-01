#!/usr/bin/env node
/* J-3 고객 상태 카드 QA (런타임 미수정 — 실사진/실데이터 불필요, 스텁 주입)
   - 감지: 상태류 true / 예약·발송 명령 false
   - 고객 식별: 명시 1명 / 동명이인 후보 / 고객 없음 안내 (자동추측 X)
   - 상태 카드: 최근시술·방문·다음예약·사진기록·체크포인트 + 추천
   - 버튼 ≤5, 전부 safe, 발송/예약 버튼 없음
   - 안전성: send_message/Booking.create/publish_instagram/TreatmentLink 자동실행 0
   실행: python3 -m http.server 8099 후 node scripts/itbi-customer-status-qa.js (PHOTO_QA_URL 지정 가능) */

const { chromium } = require('playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=cstatqa';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 140)); });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.ItdasyCustomerStatusCard && window.ItdasyActionHub, null, { timeout: 45000 });

  const out = await page.evaluate(async () => {
    const C = window.ItdasyCustomerStatusCard;
    const calls = [];
    // 위험 함수 스텁 — 자동 실행 추적
    window.sendMessage = function () { calls.push('sendMessage'); };
    window.publishInstagram = function () { calls.push('publishInstagram'); };
    window.Booking = Object.assign(window.Booking || {}, {
      create: function () { calls.push('Booking.create'); },
      list: async function () { return [{ id: 1, customer_id: 10, customer_name: '김민지', service_name: '젤네일', starts_at: new Date(Date.now() - 19 * 86400000).toISOString(), status: 'done' }]; },
    });
    window.TreatmentLink = Object.assign(window.TreatmentLink || {}, { attachPhotoToCustomer: function () { calls.push('TreatmentLink.attach'); } });
    window.loadGalleryItemsByCustomer = async function () { return [{ id: 5, customer_id: 10, label: '젤네일 그라데이션', savedAt: Date.now() - 5 * 86400000 }]; };
    window.apiFetch = async function () { return { ok: true, json: async function () { return { retouch_due_customers: [{ id: 10, name: '김민지' }] }; } }; };
    // 고객 캐시 스텁 (동명이인 포함)
    window.Customer = Object.assign(window.Customer || {}, {
      search: function (q) {
        const all = [{ id: 10, name: '김민지' }, { id: 11, name: '이민지' }, { id: 12, name: '박소연' }];
        return all.filter(c => c.name.includes(q) || (q === '민지' && c.name.includes('민지')));
      },
    });

    const r = {};
    // 1. 감지
    r.detect = {
      s1: C.detectCustomerStatusIntent('민지님 뭐 챙겨야 돼?'),
      s2: C.detectCustomerStatusIntent('이 손님 리터치 해야 돼?'),
      s3: C.detectCustomerStatusIntent('오래 안 온 손님 챙겨줘'),
      s4: C.detectCustomerStatusIntent('리터치 대상 누구야?'),
      not_book: C.detectCustomerStatusIntent('민지님 예약 잡아줘'),
      not_send: C.detectCustomerStatusIntent('민지님한테 문자 보내줘'),
    };
    // 2. 명시 고객(소연=유일) → 카드
    const okRes = await C.run('박소연님 뭐 챙겨야 돼?', {});
    r.single = { hasCard: /상태를 정리했어요/.test(okRes.message), noSendNote: /실제 발송이나 예약은 하지 않았어요/.test(okRes.message), actions: (okRes.hubActions || []).length, phases: (okRes.hubActions || []).map(a => a.phase) };
    // 3. 동명이인(민지 → 김민지/이민지) → 후보
    const ambRes = await C.run('민지님 뭐 챙겨야 돼?', {});
    r.ambiguous = { isCandidate: /누구 상태를 볼까요|여러 고객/.test(ambRes.message), autoPicked: /상태를 정리했어요/.test(ambRes.message) };
    // 4. 고객 없음
    const noneRes = await C.run('이 손님 리터치 해야 돼?', {});
    r.none = { guide: /고객을 먼저 선택/.test(noneRes.message) };
    // 5. 리스트(리터치 대상)
    const listRes = await C.run('리터치 대상 누구야?', {});
    r.list = { hasNames: /김민지/.test(listRes.message), buttons: (listRes.hubActions || []).length };
    // 6. 버튼 phase/내용 (현재고객 컨텍스트로 카드)
    const ctxRes = await C.run('이 손님 뭐 챙겨야 돼?', { currentCustomer: { id: 10, name: '김민지' } });
    r.ctxCard = {
      hasCard: /김민지님 상태/.test(ctxRes.message),
      retouchCheckpoint: /리터치 안내를 보내기 좋은/.test(ctxRes.message),
      allSafe: (ctxRes.hubActions || []).every(a => a.phase === 'safe'),
      kinds: (ctxRes.hubActions || []).map(a => a.kind),
      count: (ctxRes.hubActions || []).length,
    };
    // 7. 버튼 클릭 안전성 — 위험함수 0
    window.openCustomers = function () {}; window.openCalendarView = function () {}; window.showTab = function () {};
    (ctxRes.hubActions || []).forEach(a => { try { window.ItdasyActionHub.handleActionClick(a, {}); } catch (_e) { void 0; } });
    r.safety = { sendMessage: calls.filter(c => c === 'sendMessage').length, bookingCreate: calls.filter(c => c === 'Booking.create').length, publish: calls.filter(c => c === 'publishInstagram').length, treatmentAttach: calls.filter(c => c === 'TreatmentLink.attach').length };
    return r;
  });

  out.severeErrors = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK/i.test(e));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
}
main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
