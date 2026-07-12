#!/usr/bin/env node
/* T-119 attach/dedupe 심층 검증 (1회성, 프로덕션 코드 미수정)
   TreatmentLink.attachPhotoToCustomer 를 직접 호출(고객 picker 는 opts.customer 주입으로 우회)하고
   IndexedDB(loadGalleryItemsByCustomer)를 조회해 dedupe 5종 + 백엔드 성공/실패(graceful)를 검증.
   백엔드 /treatments 는 route mock(실제 호출/과금 0). 각 시나리오 전 clearGalleryDB 로 격리.

   실행: python3 -m http.server 8099 (레포 루트) 후 node scripts/t119-attach-qa.js
   결과: 콘솔 JSON 리포트 + output/playwright/t119_*.png */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'output', 'playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?v=t119';

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 430, height: 920 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

  // 백엔드 /treatments mock — 전역 플래그로 성공/실패 전환 (실제 호출 0)
  let treatmentsPost = 0;
  let backendMode = 'ok';
  await page.route('**/treatments', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    treatmentsPost++;
    if (backendMode === 'fail') return route.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"fail"}' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"id":123}' });
  });

  await page.addInitScript(() => {
    window.APP_BUILD = window.APP_BUILD || 'qa-t119';
    window.__toastLog = [];
    const hook = () => { if (window.showToast && !window.showToast.__w) { const o = window.showToast; window.showToast = function (m) { try { window.__toastLog.push(String(m)); } catch (_e) { void _e; } return o.apply(this, arguments); }; window.showToast.__w = true; } };
    const iv = setInterval(hook, 50); setTimeout(() => clearInterval(iv), 9000);
    window.__attach = async function (opts) {
      // Customer picker 우회를 위해 opts.customer 주입 형태로 호출
      return await window.TreatmentLink.attachPhotoToCustomer(opts);
    };
    window.__byCustomer = async function (cid) { return await window.loadGalleryItemsByCustomer(cid); };
    window.__allGallery = async function () { return await window.loadGalleryItems(); };
    window.__clearGallery = async function () { window.__toastLog = []; return await window.clearGalleryDB(); };
    window.__saveLegacy = async function () {
      // customer_id=null 레거시 항목 직접 삽입
      return await window.saveToGallery({ id: 'legacy_' + Date.now(), label: 'legacy', photos: [{ id: 'p', dataUrl: 'data:,legacy', mode: 'after' }], customer_id: null, dedupeKey: null });
    };
    // ── export 경로(T-119-A) E2E 헬퍼 ──
    window.__openPE = async function () {
      document.body.classList.remove('itdasy-locked');
      const lock = document.getElementById('lockOverlay'); if (lock) lock.classList.add('hidden');
      const c = document.createElement('canvas'); c.width = 600; c.height = 600;
      const g = c.getContext('2d'); g.fillStyle = '#cdb'; g.fillRect(0, 0, 600, 600); g.fillStyle = '#a86'; g.beginPath(); g.arc(300, 300, 150, 0, 7); g.fill();
      const PE = window.PhotoEditor;
      PE.open({ src: c.toDataURL('image/png'), shopName: 'QA', initial_tab: 'export' });
      await new Promise((res, rej) => { const t0 = Date.now(); const t = () => { const s = PE._internal.getState(); if (s && s.originalImg && s.originalImg.naturalWidth) return res(); if (Date.now() - t0 > 20000) return rej(new Error('load')); setTimeout(t, 80); }; t(); });
      // Customer.pick mock — picker 우회(고정 고객)
      window.Customer = window.Customer || {};
      window.Customer.pick = async () => ({ id: 88, name: '익스포트' });
      const NV = window.PhotoEditorNavV7; if (NV) { try { NV.setEnabled(true); NV.mount(); NV.setSubChip('export-save'); } catch (_e) { void _e; } }
      await new Promise(r => setTimeout(r, 300));
    };
    window.__exportAttach = async function () {
      window.__toastLog = [];
      // export 탭 PNG 저장 → next-steps 모달 → 고객 기록 첨부
      const png = document.querySelector('#pePanel [data-pe-export="png"]');
      if (!png) return { err: 'no export btn' };
      png.click();
      await new Promise(r => setTimeout(r, 500)); // toBlob + 모달
      const attach = document.querySelector('#peNextStepsModal [data-pe-ns="attach"]');
      if (!attach) return { err: 'no attach btn', toasts: window.__toastLog.slice() };
      attach.click();
      // attachPhotoToCustomer 완료(서버실패 시 apiFetch 재시도로 수 초)까지 폴링 후, export 추가 토스트 반영 대기
      for (let i = 0; i < 80; i++) {
        await new Promise(r => setTimeout(r, 100));
        if (window.__toastLog.some(t => /연결했어요|저장에 실패/.test(t))) break;
      }
      await new Promise(r => setTimeout(r, 600));
      return { toasts: window.__toastLog.slice() };
    };
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.TreatmentLink && window.saveToGallery && window.loadGalleryItemsByCustomer && window.clearGalleryDB && window.PhotoEditor && window.PhotoEditorNavV7, null, { timeout: 45000 });
  await page.waitForTimeout(1000);

  const A = 'data:image/png;base64,AAAA1111photoA_unique_content_for_hash_stability_0001';
  const B = 'data:image/png;base64,BBBB2222photoB_different_edited_result_for_hash_0002';
  const report = { scenarios: {}, backend: {}, errors: [] };

  // ── 9. same customer + same photo → 1개, 2nd wasDuplicate ──
  backendMode = 'ok';
  await page.evaluate(() => window.__clearGallery());
  const s9a = await page.evaluate(a => window.__attach({ customer: { id: 1, name: '김민지' }, dataUrl: a, serviceName: '컷', source: 'photoeditor_attach' }), A);
  const s9b = await page.evaluate(a => window.__attach({ customer: { id: 1, name: '김민지' }, dataUrl: a, serviceName: '컷', source: 'photoeditor_attach' }), A);
  const s9list = await page.evaluate(() => window.__byCustomer(1));
  report.scenarios.s9_same_same = { firstWasDup: s9a.wasDuplicate, secondWasDup: s9b.wasDuplicate, count: s9list.length, expectCount: 1 };

  // ── 10. same customer + different edited photo → 2개 ──
  await page.evaluate(() => window.__clearGallery());
  await page.evaluate(a => window.__attach({ customer: { id: 1, name: '김민지' }, dataUrl: a, source: 'photoeditor_attach' }), A);
  const s10b = await page.evaluate(b => window.__attach({ customer: { id: 1, name: '김민지' }, dataUrl: b, source: 'photoeditor_attach' }), B);
  const s10list = await page.evaluate(() => window.__byCustomer(1));
  report.scenarios.s10_same_diff = { secondWasDup: s10b.wasDuplicate, count: s10list.length, expectCount: 2 };

  // ── 11. different customer + same photo → 각 1개 ──
  await page.evaluate(() => window.__clearGallery());
  await page.evaluate(a => window.__attach({ customer: { id: 1, name: 'A' }, dataUrl: a, source: 'photoeditor_attach' }), A);
  const s11b = await page.evaluate(a => window.__attach({ customer: { id: 2, name: 'B' }, dataUrl: a, source: 'photoeditor_attach' }), A);
  const c1 = await page.evaluate(() => window.__byCustomer(1));
  const c2 = await page.evaluate(() => window.__byCustomer(2));
  report.scenarios.s11_diff_same = { secondWasDup: s11b.wasDuplicate, c1: c1.length, c2: c2.length, expect: '1/1' };

  // ── legacy customer_id=null 제외 ──
  await page.evaluate(() => window.__clearGallery());
  await page.evaluate(() => window.__saveLegacy());
  await page.evaluate(a => window.__attach({ customer: { id: 7, name: 'L' }, dataUrl: a, source: 'photoeditor_attach' }), A);
  const c7 = await page.evaluate(() => window.__byCustomer(7));
  const allWithLegacy = await page.evaluate(() => window.__allGallery());
  report.scenarios.legacy_null = { byCustomer7: c7.length, totalIncludingLegacy: allWithLegacy.length, note: 'legacy(null) 은 byCustomer 에서 제외, 전체엔 보존' };

  // ── 12. backend POST failure → local preserved + 결과 플래그 ──
  backendMode = 'fail';
  await page.evaluate(() => window.__clearGallery());
  const postBefore = treatmentsPost;
  const s12 = await page.evaluate(a => window.__attach({ customer: { id: 3, name: '서버실패' }, dataUrl: a, source: 'photoeditor_attach' }), A);
  const s12list = await page.evaluate(() => window.__byCustomer(3));
  report.scenarios.s12_backend_fail = { res_ok: s12.ok, res_local: s12.local, res_remote: s12.remote, localCount: s12list.length, toastAfter: await page.evaluate(() => window.__toastLog.slice(-2)), postCalls: treatmentsPost - postBefore };

  // ── backend success 기준선 + 중복 시 POST 반복 여부 ──
  backendMode = 'ok';
  await page.evaluate(() => window.__clearGallery());
  const okBefore = treatmentsPost;
  const ok1 = await page.evaluate(a => window.__attach({ customer: { id: 5, name: 'OK' }, dataUrl: a, source: 'photoeditor_attach' }), A);
  const ok2 = await page.evaluate(a => window.__attach({ customer: { id: 5, name: 'OK' }, dataUrl: a, source: 'photoeditor_attach' }), A);
  report.backend = { successRes: { ok: ok1.ok, remote: ok1.remote }, dupSecondWasDup: ok2.wasDuplicate, postCallsForTwoAttach: treatmentsPost - okBefore, note: '중복이어도 _createBackend 는 매번 POST(중복 시 backend 반복 — 관찰값)' };

  // ── 옛 photo-flow 제거 확인: 고객 저장 안내는 사진모드/ActionHub 쪽에서 처리 ──
  report.scenarios.no_customer = await page.evaluate(async () => {
    return {
      oldPhotoFlowGone: !window.ItdasyPhotoFlow,
      photoModeReady: !!(window.ItdasyPhotoMode && window.ItdasyPhotoModeSupport),
      note: '옛 photo-flow 저장 확인은 제거. 고객 저장 버튼은 사진모드 결과의 ActionHub 확인 경로 사용.',
    };
  });

  // ── export 경로 토스트 분기 (T-119-A): 성공 / 중복 / 서버실패 ──
  backendMode = 'ok';
  await page.evaluate(() => window.__clearGallery());
  await page.evaluate(() => window.__openPE());
  const expSuccess = await page.evaluate(() => window.__exportAttach());  // 1회차 = 성공
  const expDup = await page.evaluate(() => window.__exportAttach());      // 2회차 = 같은 사진/고객 = 중복
  backendMode = 'fail';
  await page.evaluate(() => window.__clearGallery());
  await page.evaluate(() => window.__openPE());
  const expFail = await page.evaluate(() => window.__exportAttach());     // 서버 실패
  report.exportPath = {
    success: { toasts: expSuccess.toasts, hasConnected: (expSuccess.toasts || []).some(t => /연결했어요/.test(t)), noDupNoFail: !(expSuccess.toasts || []).some(t => /중복|서버 동기화/.test(t)) },
    duplicate: { toasts: expDup.toasts, hasDupMsg: (expDup.toasts || []).some(t => /중복 저장하지 않았어요/.test(t)) },
    serverFail: { toasts: expFail.toasts, hasFailMsg: (expFail.toasts || []).some(t => /서버 동기화는 실패/.test(t)) },
  };
  await page.screenshot({ path: path.join(OUT, 't119_attach_success.png') });

  report.backend.treatmentsPostTotal = treatmentsPost;
  report.severeErrors = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK|status of 500/i.test(e));
  await page.screenshot({ path: path.join(OUT, 't119_dedupe_check.png') });
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
}

main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
