#!/usr/bin/env node
/* J-1 잇비 Action Hub QA (런타임 미수정, 텍스트/DOM만 — 실사진 불필요)
   - normalizeActions/isDangerAction/PHASE 단위 검증
   - handleActionClick: safe 연결 / confirm 안내(자동실행X) / danger 차단
   - 안전성: send_message·publish_instagram·Booking.create 직접 호출 0, 고객 자동추측 0
   - 렌더: 브리핑/사진 결과에 hub 버튼(phase 태깅) 표시
   실행: python3 -m http.server 8099 후 node scripts/itbi-action-hub-qa.js (PHOTO_QA_URL 지정 가능) */

const { chromium } = require('playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=hubqa';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 140)); });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.ItdasyActionHub, null, { timeout: 45000 });

  const out = await page.evaluate(() => {
    const H = window.ItdasyActionHub;
    const calls = [];
    // 위험/네비 함수 스텁 — 호출 추적
    const stub = (name) => { window[name] = function () { calls.push(name); }; };
    ['openInstagramPreview', 'openCalendarView', 'openCustomers', 'openRevenueHub', 'showTab'].forEach(stub);
    window.PhotoEditor = { open: function () { calls.push('PhotoEditor.open'); } };
    // 절대 호출되면 안 되는 것들
    window.Booking = Object.assign(window.Booking || {}, { create: function () { calls.push('Booking.create'); } });
    window.sendMessage = function () { calls.push('sendMessage'); };
    window.publishInstagram = function () { calls.push('publishInstagram'); };

    const r = {};
    // 1. PHASE/normalize/isDanger
    r.phase = {
      safe: H.PHASE.copy_caption === 'safe' && H.PHASE.open_calendar === 'safe',
      confirm: H.PHASE.save_photo_to_customer === 'confirm' && H.PHASE.create_booking === 'confirm',
      danger: H.PHASE.send_message === 'danger' && H.PHASE.publish_instagram === 'danger' && H.PHASE.auto_book === 'danger',
    };
    const norm = H.normalizeActions([
      { id: 'a', label: '캡션 복사', kind: 'copy_caption' },
      { id: 'b', label: '저장', kind: 'save_photo_to_customer' },
      { id: 'c', label: '발송', kind: 'send_message' },
      { id: 'bad' },           // label 없음 → 제외
    ]);
    r.normalize = { count: norm.length, phases: norm.map(a => a.phase) };
    r.isDanger = H.isDangerAction({ kind: 'publish_instagram' }) === true && H.isDangerAction({ kind: 'copy_caption' }) === false;

    // 2. handleActionClick — phase별
    const res = {};
    res.danger_send = H.handleActionClick({ kind: 'send_message', phase: 'danger' });
    res.danger_publish = H.handleActionClick({ kind: 'publish_instagram', phase: 'danger' });
    res.danger_autobook = H.handleActionClick({ kind: 'auto_book', phase: 'danger' });
    res.confirm_save = H.handleActionClick({ kind: 'save_photo_to_customer', phase: 'confirm' });
    res.confirm_booking = H.handleActionClick({ kind: 'create_booking', phase: 'confirm' });
    const callsBeforeSafe = calls.length;
    res.safe_calendar = H.handleActionClick({ kind: 'open_calendar', phase: 'safe', payload: {} });
    res.safe_editor = H.handleActionClick({ kind: 'open_photo_editor', phase: 'safe', payload: { dataUrl: 'data:,' } });
    res.safe_template = H.handleActionClick({ kind: 'open_template_panel', phase: 'safe', payload: { dataUrl: 'data:,' } });
    res.safe_revenue = H.handleActionClick({ kind: 'open_revenue', phase: 'safe' });
    const safeCalls = calls.slice(callsBeforeSafe);

    r.handle = {
      danger_blocked: !!(res.danger_send.blocked && res.danger_publish.blocked && res.danger_autobook.blocked),
      danger_msg: res.danger_send.message,
      confirm_no_exec: !!(res.confirm_save.message && !res.confirm_save.navigated && !res.confirm_save.blocked),
      confirm_msg: res.confirm_save.message,
      safe_navigated: !!(res.safe_calendar.navigated && res.safe_editor.navigated),
      safeCalls,
    };
    // 3. 안전성 — 위험 함수 호출 0
    r.safety = {
      bookingCreate: calls.filter(c => c === 'Booking.create').length,
      sendMessage: calls.filter(c => c === 'sendMessage').length,
      publishInstagram: calls.filter(c => c === 'publishInstagram').length,
      allCalls: calls.slice(),
    };
    // 4. 렌더 — phase 태깅 + 올바른 data-attr
    const html = H.renderActionHub([
      { id: 'a', label: '캡션 복사', kind: 'copy_caption' },
      { id: 'b', label: '고객기록에 저장', kind: 'save_photo_to_customer', route: 'hub' },
      { id: 'c', label: '인스타 미리보기', kind: 'open_instagram', route: 'photo' },
    ], { idx: 7 });
    // 브리핑 route → data-asst-brief-act (T-115 기존 클릭 핸들러 유지)
    const briefHtml = H.renderActionHub([
      { id: 'unlinked_photos', label: '미연결 사진 확인', kind: 'open_unlinked_photos', safety: 'safe' },
      { id: 'retouch_draft', label: '리터치 안내 초안', kind: 'retouch_draft', safety: 'safe' },
    ], { idx: 3, defaultRoute: 'brief' });
    r.render = {
      hasHubAttr: /data-asst-hub-act="7:a"/.test(html),
      hasPhotoAttr: /data-asst-photo-act="7:c"/.test(html),
      hasPhaseSafe: /data-hub-phase="safe"/.test(html),
      hasPhaseConfirm: /data-hub-phase="confirm"/.test(html),
      briefAttr: /data-asst-brief-act="3:unlinked_photos"/.test(briefHtml) && /data-asst-brief-act="3:retouch_draft"/.test(briefHtml),
    };
    return r;
  });

  out.severeErrors = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK/i.test(e));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
}
main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
