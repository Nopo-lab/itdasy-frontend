#!/usr/bin/env node
/* 예약 완료 → 매출 연결 UI 경로 재검증 (1회성, 런타임 미수정)
   단순 PATCH(write-e2e-qa 의 우회 경로)와 달리, 실제 UI 완료 플로우(CompleteFlow.startFromBooking
   → #cfSave)를 타고 백엔드 completion_effects.revenue_created 로 매출이 자동 생성되는지 검증.
   QA_BETA prefix + cleanup(자동 생성 매출 포함). staging 전용.
   실행: node scripts/complete-flow-qa.js */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'output', 'playwright');
const PAGES = process.env.BETA_URL || 'https://nopo-lab.github.io/itdasy-frontend-test-yeunjun/';
const EMAIL = process.env.DEMO_EMAIL || 'review@itdasy.com';
const PW = process.env.DEMO_PW || '';

function stamp() { const d = new Date(); const p = n => String(n).padStart(2, '0'); return `QA_BETA_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`; }

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const PREFIX = stamp();
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 430, height: 920 }, deviceScaleFactor: 2 });
  let pageErr = null; const errors = [];
  page.on('pageerror', e => { pageErr = String(e.message || e); errors.push('pageerror: ' + pageErr); });
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 140)); });

  await page.addInitScript(() => {
    window.__login = async (email, pw) => { const t = document.getElementById('emailFoldBtn'); if (t) t.click(); await new Promise(r => setTimeout(r, 500)); document.getElementById('loginEmail').value = email; document.getElementById('loginPassword').value = pw; document.getElementById('loginBtn').click(); };
    window.__revIds = async () => { const l = (await window.Revenue.list('month').catch(() => [])) || []; return l.map(r => r.id).filter(Boolean); };
    window.__revSummary = async () => { const a = window.authHeader ? window.authHeader() : {}; try { const r = await window.apiFetch('/revenue/summary?period=month', { headers: a }); if (r.ok) { const d = await r.json(); return { count: d.count, total: d.total }; } } catch (_e) { void _e; } return null; };
  });

  const report = { prefix: PREFIX, steps: [], created: { customer: null, booking: null, autoRevenueIds: [] }, cleanup: {}, severeErrors: [] };
  const step = (name, expected, actual, ok, note) => report.steps.push({ name, expected, actual, ok, note: note || '' });
  const ev = (fn, arg) => page.evaluate(fn, arg);

  try {
    await page.goto(PAGES, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);
    await ev(([e, p]) => window.__login(e, p), [EMAIL, PW]);
    await page.waitForFunction(() => { const l = document.getElementById('lockOverlay'); const o = document.getElementById('appLoadingOverlay'); return (!l || l.classList.contains('hidden')) && (!o || getComputedStyle(o).display === 'none'); }, null, { timeout: 40000 });
    await page.waitForFunction(() => window.Customer && window.Booking && window.Revenue && window.CompleteFlow, null, { timeout: 20000 });
    step('login', '로그인+CompleteFlow 준비', 'ok', true);

    const baseSummary = await ev(() => window.__revSummary());
    const baseRevIds = await ev(() => window.__revIds());
    step('baseline', '매출 기준', JSON.stringify(baseSummary), true);

    // 고객 + 예약(amount 50000) 생성
    const cust = await ev(p => window.Customer.create({ name: p + ' 손님', phone: '01000000000', memo: p }).then(c => ({ id: c.id })).catch(e => ({ err: String(e.message) })), PREFIX);
    report.created.customer = cust.id || null;
    step('create_customer', 'id', JSON.stringify(cust), !!cust.id);
    if (!cust.id) throw new Error('고객 생성 실패');

    const book = await ev(({ p, cid }) => { const n = new Date(); const s = new Date(n); s.setHours(11, 0, 0, 0); const e = new Date(n); e.setHours(12, 0, 0, 0); return window.Booking.create({ starts_at: s.toISOString(), ends_at: e.toISOString(), customer_id: cid, customer_name: p + ' 손님', service_name: p + ' 시술', amount: 50000 }).then(b => ({ id: b.id, obj: b })).catch(err => ({ err: String(err.message) })); }, { p: PREFIX, cid: cust.id });
    report.created.booking = book.id || null;
    step('create_booking', 'id+amount', JSON.stringify({ id: book.id }), !!book.id);
    if (!book.id || pageErr) throw new Error('예약 생성 실패: ' + (pageErr || JSON.stringify(book)));

    // ── 실제 UI 완료 플로우: CompleteFlow 모달 → #cfSave ──
    await ev(b => { window.CompleteFlow.startFromBooking(b); }, book.obj);
    await page.waitForTimeout(1500);
    const modalUp = await ev(() => !!document.getElementById('cfSave'));
    const amtPrefill = await ev(() => { const i = document.getElementById('cfAmtInput'); return i ? i.value : null; });
    step('complete_modal', 'CompleteFlow 모달 노출+금액 prefill', `modal=${modalUp}, amount=${amtPrefill}`, modalUp);
    if (!modalUp) throw new Error('CompleteFlow 모달 미노출');
    try { await page.screenshot({ path: path.join(OUT, 'complete_flow_modal.png') }); } catch (_e) { void _e; }

    await page.click('#cfSave', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(3000);  // PATCH + completion_effects + 캐시 반영

    // 매출 자동 생성 확인
    const afterSummary = await ev(() => window.__revSummary());
    const afterRevIds = await ev(() => window.__revIds());
    const newRevIds = afterRevIds.filter(id => !baseRevIds.includes(id));
    report.created.autoRevenueIds = newRevIds;
    const autoCreated = (baseSummary && afterSummary && afterSummary.count > baseSummary.count) || newRevIds.length > 0;
    step('revenue_auto_via_ui', '완료(UI) 시 매출 자동 생성', `summary ${baseSummary && baseSummary.count}/${baseSummary && baseSummary.total} → ${afterSummary && afterSummary.count}/${afterSummary && afterSummary.total}; newRevIds=${JSON.stringify(newRevIds)}`, autoCreated);

    // 예약 완료 상태 확인
    const bookDone = await ev(async ({ bid }) => { const n = new Date(); const f = new Date(n.getFullYear(), n.getMonth(), 1).toISOString(); const t = new Date(n.getFullYear(), n.getMonth() + 1, 0, 23, 59).toISOString(); const list = (await window.Booking.list(f, t).catch(() => [])) || []; const b = list.find(x => x.id === bid); return b ? b.status : null; }, { bid: book.id });
    step('booking_completed', "status='completed'", String(bookDone), bookDone === 'completed');

    // 대시보드 반영
    await page.click('.tab-bar__btn[data-tab="dashboard"]').catch(() => {});
    await page.waitForTimeout(2000);
    try { await page.screenshot({ path: path.join(OUT, 'complete_flow_dashboard.png') }); } catch (_e) { void _e; }

  } catch (e) {
    report.aborted = String(e && e.message);
  } finally {
    const cl = {};
    // 자동 생성 매출 → 예약 → 고객 정리
    for (const rid of (report.created.autoRevenueIds || [])) {
      const r = await ev(async id => { try { await window.Revenue.remove(id); return true; } catch (e) { return String(e.message); } }, rid).catch(e => String(e));
      cl['revenue_' + rid] = r;
    }
    if (report.created.booking) cl['booking_' + report.created.booking] = await ev(async id => { try { await window.Booking.remove(id); return true; } catch (e) { return String(e.message); } }, report.created.booking).catch(e => String(e));
    if (report.created.customer) cl['customer_' + report.created.customer] = await ev(async id => { try { await window.Customer.remove(id); return true; } catch (e) { return String(e.message); } }, report.created.customer).catch(e => String(e));
    report.cleanup = cl;
    try { report.afterCleanupSummary = await ev(() => window.__revSummary()); } catch (_e) { void _e; }
    report.severeErrors = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK|sw\.js/i.test(e));
    await browser.close();
    console.log(JSON.stringify(report, null, 2));
  }
}

main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
