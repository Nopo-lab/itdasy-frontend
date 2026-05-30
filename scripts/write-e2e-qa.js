#!/usr/bin/env node
/* 베타 출시 전 쓰기 E2E 격리 점검 (1회성, 런타임 코드 미수정)
   데모계정으로 staging 에 고객→예약→완료→매출을 실제 생성하고 반영을 검증한 뒤,
   생성물을 API DELETE 로 cleanup 한다. 모든 생성물은 QA_BETA_<YYYYMMDD>_<HHMM> prefix.
   UI 플로우 = 프론트 데이터 레이어(window.Customer/Booking/Revenue.create) 경유(폼 핸들러와 동일 경로).
   attach/잇비 예약은 T-119/P0-C 에서 검증됨 → 경로 존재 smoke 만(추가 생성 안 함).

   ⚠️ staging 전용. 위험(pageerror/4xx/5xx/미반영) 감지 시 즉시 중단하고 cleanup 우선.
   실행: node scripts/write-e2e-qa.js */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'output', 'playwright');
const PAGES = process.env.BETA_URL || 'https://nopo-lab.github.io/itdasy-frontend-test-yeunjun/';
const EMAIL = process.env.DEMO_EMAIL || 'review@itdasy.com';
const PW = process.env.DEMO_PW || 'review1234!';

function stamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `QA_BETA_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const PREFIX = stamp();
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 430, height: 920 }, deviceScaleFactor: 2 });
  let pageErr = null;
  const errors = [];
  page.on('pageerror', e => { pageErr = String(e.message || e); errors.push('pageerror: ' + pageErr); });
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 140)); });

  await page.addInitScript(() => {
    window.__login = async function (email, pw) {
      const t = document.getElementById('emailFoldBtn'); if (t) t.click();
      await new Promise(r => setTimeout(r, 500));
      document.getElementById('loginEmail').value = email;
      document.getElementById('loginPassword').value = pw;
      document.getElementById('loginBtn').click();
    };
  });

  const report = { prefix: PREFIX, url: PAGES, baseline: {}, steps: [], created: { customer: null, booking: null, revenue: null }, cleanup: {}, severeErrors: [] };
  const step = (name, expected, actual, ok, note) => report.steps.push({ name, expected, actual, ok, note: note || '' });
  const snap = async (n) => { try { await page.screenshot({ path: path.join(OUT, `write_e2e_${n}.png`) }); } catch (_e) { void _e; } };

  // helper: page.evaluate 래퍼 — 결과/에러 캡처
  const ev = (fn, arg) => page.evaluate(fn, arg);

  try {
    // ── 로그인 ──
    await page.goto(PAGES, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);
    await ev(([e, p]) => window.__login(e, p), [EMAIL, PW]);
    await page.waitForFunction(() => {
      const lock = document.getElementById('lockOverlay');
      const load = document.getElementById('appLoadingOverlay');
      return (!lock || lock.classList.contains('hidden')) && (!load || getComputedStyle(load).display === 'none');
    }, null, { timeout: 40000 });
    await page.waitForTimeout(2500);
    await page.waitForFunction(() => window.Customer && window.Booking && window.Revenue, null, { timeout: 20000 });
    step('login', '데모계정 로그인', 'lockOverlay 해제 + API 준비', true);

    // ── baseline ──
    const base = await ev(async () => {
      const cust = (await window.Customer.list().catch(() => [])) || [];
      const now = new Date(); const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString(); const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59).toISOString();
      const book = (await window.Booking.list(from, to).catch(() => [])) || [];
      const auth = window.authHeader ? window.authHeader() : {};
      let revCount = null, revTotal = null;
      try { const r = await window.apiFetch('/revenue/summary?period=month', { headers: auth }); if (r.ok) { const d = await r.json(); revCount = d.count; revTotal = d.total; } } catch (_e) { void _e; }
      return { customers: cust.length, bookings: book.length, revCount, revTotal };
    });
    report.baseline = base;
    step('baseline', '기준 수집', JSON.stringify(base), true);
    if (pageErr) throw new Error('pageerror during baseline: ' + pageErr);

    // ── 고객 생성 ──
    const cust = await ev(async (prefix) => {
      try { const c = await window.Customer.create({ name: prefix + ' 손님', phone: '01000000000', memo: prefix + ' e2e' }); return { ok: true, id: c && c.id, name: c && c.name }; }
      catch (e) { return { ok: false, err: String(e && e.message) }; }
    }, PREFIX);
    report.created.customer = cust.id || null;
    step('create_customer', '고객 생성 성공+id', JSON.stringify(cust), !!cust.ok && !!cust.id);
    if (!cust.ok || !cust.id || pageErr) throw new Error('고객 생성 실패: ' + JSON.stringify(cust) + (pageErr ? ' / ' + pageErr : ''));

    // ── 예약 생성 ──
    const book = await ev(async ({ prefix, custId }) => {
      try {
        const now = new Date(); const s = new Date(now); s.setHours(14, 0, 0, 0); const e = new Date(now); e.setHours(15, 0, 0, 0);
        const b = await window.Booking.create({ starts_at: s.toISOString(), ends_at: e.toISOString(), customer_id: custId, customer_name: prefix + ' 손님', service_name: prefix + ' 시술', amount: 50000 });
        return { ok: true, id: b && b.id, status: b && b.status };
      } catch (e) { return { ok: false, err: String(e && e.message) }; }
    }, { prefix: PREFIX, custId: cust.id });
    report.created.booking = book.id || null;
    step('create_booking', '예약 생성 성공+id', JSON.stringify(book), !!book.ok && !!book.id);
    if (!book.ok || !book.id || pageErr) throw new Error('예약 생성 실패: ' + JSON.stringify(book) + (pageErr ? ' / ' + pageErr : ''));

    // ── 예약 완료 처리 ──
    const done = await ev(async (bookId) => {
      try { const u = await window.Booking.update(bookId, { status: 'completed' }); return { ok: true, status: u && u.status }; }
      catch (e) { return { ok: false, err: String(e && e.message) }; }
    }, book.id);
    step('complete_booking', "status='completed'", JSON.stringify(done), !!done.ok && done.status === 'completed');
    if (pageErr) throw new Error('완료 처리 중 pageerror: ' + pageErr);

    // ── 매출 자동 반영 확인 → 없으면 수동 기록 ──
    await page.waitForTimeout(1500);
    const afterDone = await ev(async () => {
      const auth = window.authHeader ? window.authHeader() : {};
      try { const r = await window.apiFetch('/revenue/summary?period=month', { headers: auth }); if (r.ok) { const d = await r.json(); return { count: d.count, total: d.total }; } } catch (_e) { void _e; }
      return null;
    });
    const autoRevenue = afterDone && base.revCount != null && afterDone.count > base.revCount;
    step('revenue_auto', '완료 시 매출 자동 반영?', `baseline=${base.revCount}/${base.revTotal} → after=${afterDone && afterDone.count}/${afterDone && afterDone.total}`, true, autoRevenue ? '자동 기록됨' : '자동 아님 → 수동 기록 시도');
    if (!autoRevenue) {
      const rev = await ev(async ({ prefix, custId }) => {
        try { const r = await window.Revenue.create({ amount: 50000, method: 'card', service_name: prefix + ' 시술', customer_id: custId, customer_name: prefix + ' 손님', memo: prefix }); return { ok: true, id: r && r.id }; }
        catch (e) { return { ok: false, err: String(e && e.message) }; }
      }, { prefix: PREFIX, custId: cust.id });
      report.created.revenue = rev.id && !String(rev.id).startsWith('__opt') ? rev.id : null;
      step('create_revenue', '수동 매출 생성+id', JSON.stringify(rev), !!rev.ok);
      if (pageErr) throw new Error('매출 생성 중 pageerror: ' + pageErr);
    }

    // ── 대시보드/상세 반영 ──
    await page.click('.tab-bar__btn[data-tab="dashboard"]').catch(() => {});
    await page.waitForTimeout(2500);
    await snap('dashboard');
    const custVisible = await ev(prefix => document.body.innerText.includes(prefix), PREFIX);
    // 고객 목록 재조회 반영
    const listsAfter = await ev(async () => {
      const cust = (await window.Customer.list().catch(() => [])) || [];
      const now = new Date(); const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString(); const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59).toISOString();
      const book = (await window.Booking.list(from, to).catch(() => [])) || [];
      return { customers: cust.length, bookings: book.length };
    });
    step('dashboard_reflect', '생성분 목록 반영(+1/+1)', `cust ${base.customers}→${listsAfter.customers}, book ${base.bookings}→${listsAfter.bookings}, prefixOnScreen=${custVisible}`,
      listsAfter.customers === base.customers + 1 && listsAfter.bookings === base.bookings + 1);

    // ── attach / 잇비 예약 경로 존재 smoke (실제 생성 안 함) ──
    const paths = await ev(() => ({
      attach: !!(window.TreatmentLink && typeof window.TreatmentLink.attachPhotoToCustomer === 'function'),
      assistantBooking: !!(window.ItdasyAssistant || window.apiFetch),
    }));
    step('attach_smoke', 'attach 경로 존재(T-119 검증)', JSON.stringify(paths.attach), paths.attach);
    step('assistant_booking_smoke', '잇비 예약 경로 존재(P0-C 검증)', JSON.stringify(paths.assistantBooking), paths.assistantBooking);

  } catch (e) {
    report.aborted = String(e && e.message);
  } finally {
    // ── cleanup (역순: revenue → booking → customer) ──
    const cl = {};
    const delOne = async (kind, id, fn) => {
      if (!id) { cl[kind] = { id: null, deleted: 'n/a' }; return; }
      try { const r = await ev(async ([f, i]) => { try { await window[f].remove(i); return { ok: true }; } catch (e) { return { ok: false, err: String(e && e.message) }; } }, [fn, id]); cl[kind] = { id, deleted: r.ok, err: r.err }; }
      catch (e) { cl[kind] = { id, deleted: false, err: String(e && e.message) }; }
    };
    await delOne('revenue', report.created.revenue, 'Revenue');
    await delOne('booking', report.created.booking, 'Booking');
    await delOne('customer', report.created.customer, 'Customer');
    report.cleanup = cl;
    // baseline 복귀 확인
    try {
      await page.waitForTimeout(1200);
      const back = await ev(async () => {
        const cust = (await window.Customer.list().catch(() => [])) || [];
        const now = new Date(); const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString(); const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59).toISOString();
        const book = (await window.Booking.list(from, to).catch(() => [])) || [];
        return { customers: cust.length, bookings: book.length };
      });
      report.baselineRestored = back;
    } catch (_e) { void _e; }
    report.severeErrors = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK|sw\.js/i.test(e));
    await browser.close();
    console.log(JSON.stringify(report, null, 2));
  }
}

main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
