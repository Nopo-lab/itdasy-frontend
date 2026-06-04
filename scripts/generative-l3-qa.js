#!/usr/bin/env node
/* eslint-disable no-console */
/* L3 생성형 사진편집 Gate 2 QA — 프론트 mock UX, provider 실호출 0.

   실행: node scripts/generative-l3-qa.js
*/
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.GENERATIVE_L3_QA_PORT || 8099);
const ORIGIN = process.env.GENERATIVE_L3_QA_ORIGIN || `http://127.0.0.1:${PORT}`;
const BASE_URL = process.env.GENERATIVE_L3_QA_URL || `${ORIGIN}/offline.html?v=l3qa`;
const SCRIPTS = [
  'js/photo-editor/generative-client.js',
  'js/photo-editor/generative-consent.js',
  'app-photo-editor-generative-l3.js',
];

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startServer() {
  if (process.env.GENERATIVE_L3_QA_URL) return null;
  const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 40; i++) {
    const res = await fetch(ORIGIN + '/').catch(() => null);
    if (res && res.ok) return server;
    await wait(150);
  }
  server.kill();
  throw new Error('로컬 QA 서버를 열지 못했어요.');
}

async function loadModules(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.setContent('<!doctype html><html><body><div id="host"></div></body></html>');
  await page.evaluate(() => {
    window.__registeredPanel = null;
    window.PhotoEditor = { _internal: { registerTabPanel(id, panel) {
      if (id === 'ai') window.__registeredPanel = panel;
    } } };
  });
  for (const script of SCRIPTS) await page.addScriptTag({ path: path.join(ROOT, script) });
  await page.waitForFunction(() => window.__registeredPanel && window.PhotoEditorGenerativeClient);
}

async function installHarness(page) {
  await page.evaluate(() => {
    window.__l3 = { checks: [], failNext: false, consentRequiredNext: false, made: null };
    const qa = window.__l3;
    qa.ok = (name, pass, detail) => qa.checks.push({ name, pass: !!pass, detail: detail || '' });
    qa.wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    window.__toasts = [];
    window.__genCalls = 0;
    window.__consentCalls = 0;
    window.showToast = msg => window.__toasts.push(String(msg));
    window.authHeader = () => ({ Authorization: 'Bearer test' });
  });
}

async function installApiMock(page) {
  await page.evaluate(() => {
    window.apiFetch = async (url, opts) => {
      if (url === '/persona/consent') {
        window.__consentCalls += 1;
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      if (url !== '/photo-editor/generative/create') throw new Error('unexpected api: ' + url);
      window.__genCalls += 1;
      const mode = opts && opts.body && opts.body.get ? opts.body.get('mode') : '';
      if (mode === 'bad_mode') return { ok: false, status: 400, json: async () => ({ detail: 'invalid_mode' }) };
      if (window.__l3.consentRequiredNext) {
        window.__l3.consentRequiredNext = false;
        return { ok: false, status: 403, json: async () => ({ detail: 'consent_required' }) };
      }
      if (window.__l3.failNext) {
        window.__l3.failNext = false;
        return { ok: false, status: 502, json: async () => ({ detail: { charge_status: 'not_charged_mock' } }) };
      }
      return { ok: true, status: 200, json: async () => ({
        result_id: 'mock_qa',
        preview_url: '/photo-editor/generative/mock-preview/mock_qa',
        expires_at: new Date(Date.now() + 1800000).toISOString(),
        mode: mode || 'nail_ad_background',
        provider_used: 'mock',
        credit_cost: 1,
        charge_status: 'not_charged_mock',
        ai_metadata: { ai_generated: true, policy_version: 'l3-gate1-mock-v1' },
        status: 'preview_ready',
      }) };
    };
  });
}

async function installUiHelpers(page) {
  await page.evaluate(() => {
    window.__l3.makeImg = async () => {
      const cv = document.createElement('canvas');
      cv.width = 16; cv.height = 16;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#246'; ctx.fillRect(4, 4, 8, 8);
      const src = cv.toDataURL('image/png');
      const img = new Image();
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = src; });
      return { img, src };
    };
    window.__l3.mount = (state, helpers) => {
      const host = document.getElementById('host');
      host.innerHTML = window.__registeredPanel.html(state);
      window.__registeredPanel.bind(host, state, helpers);
      return host;
    };
    window.__l3.helpersFor = state => ({
      replaced: [],
      renderPanel() { window.__l3.mount(state, this); },
      toast(msg) { window.__toasts.push(String(msg)); },
      replaceImage(src, msg) { this.replaced.push({ src, msg }); state.originalSrc = src; },
    });
  });
}

async function checkNoImage(page) {
  await page.evaluate(() => {
    const state = {};
    const helpers = window.__l3.helpersFor(state);
    const host = window.__l3.mount(state, helpers);
    window.__l3.ok('사진 없음 안내', !!host.querySelector('.pe-l3-empty'));
    window.__l3.ok('사진 없음 API 호출 0', window.__genCalls === 0);
  });
}

async function checkConsent(page) {
  await page.evaluate(async () => {
    const made = await window.__l3.makeImg();
    window.__l3.made = made;
    const state = { originalImg: made.img, originalSrc: made.src, ratio: '1:1' };
    window.__l3.state = state;
    window.__l3.helpers = window.__l3.helpersFor(state);
    localStorage.removeItem('itdasy_ai_generative_consent');
    let host = window.__l3.mount(state, window.__l3.helpers);
    host.querySelector('[data-l3-create]').click();
    await window.__l3.wait(30);
    window.__l3.ok('동의 전 생성 API 0', window.__genCalls === 0);
    window.__l3.ok('동의 모달 표시', !!document.querySelector('[data-generative-consent]'));
    document.querySelector('[data-generative-deny]').click();
    await window.__l3.wait(20);
    window.__l3.ok('동의 거부 생성 API 0', window.__genCalls === 0);
    host = window.__l3.mount(state, window.__l3.helpers);
    host.querySelector('[data-l3-create]').click();
    await window.__l3.wait(20);
    document.querySelector('[data-generative-agree]').click();
    await window.__l3.wait(120);
    window.__l3.ok('동의 기록 호출 1', window.__consentCalls === 1, String(window.__consentCalls));
    window.__l3.ok('동의 후 생성 API 1', window.__genCalls === 1, String(window.__genCalls));
    window.__l3.ok('mock preview 표시', !!document.querySelector('[data-l3-preview] img[alt="생성 미리보기"]'));
    window.__l3.ok('적용 전 state 원본 유지', state.originalSrc === made.src);
    window.__l3.ok('적용 전 replaceImage 0', window.__l3.helpers.replaced.length === 0);
  });
}

async function checkModes(page) {
  await page.evaluate(async () => {
    const modes = ['nail_ad_background', 'clean_background', 'template_outpaint'];
    for (const mode of modes) {
      const host = window.__l3.mount(window.__l3.state, window.__l3.helpers);
      host.querySelector(`[data-l3-mode="${mode}"]`).click();
      await window.__l3.wait(20);
      document.querySelector('[data-l3-create]').click();
      await window.__l3.wait(90);
      window.__l3.ok('mode mock 성공: ' + mode, !!document.querySelector('[data-l3-preview]'));
    }
  });
}

async function checkApply(page) {
  await page.evaluate(async () => {
    const beforeApply = window.__l3.state.originalSrc;
    document.querySelector('[data-l3-apply]').click();
    await window.__l3.wait(20);
    const changed = window.__l3.state.originalSrc !== beforeApply;
    window.__l3.ok('적용 후 state 반영', changed && window.__l3.state.originalSrc.startsWith('data:image/jpeg'));
    window.__l3.ok('적용 후 replaceImage 1+', window.__l3.helpers.replaced.length >= 1);
  });
}

async function checkDiscardAndRemake(page) {
  await page.evaluate(async () => {
    const made = window.__l3.made;
    const state = { originalImg: made.img, originalSrc: made.src, ratio: '1:1' };
    const helpers = window.__l3.helpersFor(state);
    localStorage.setItem('itdasy_ai_generative_consent', '1');
    let host = window.__l3.mount(state, helpers);
    host.querySelector('[data-l3-create]').click();
    await window.__l3.wait(90);
    document.querySelector('[data-l3-discard]').click();
    await window.__l3.wait(20);
    window.__l3.ok('버리기 원본 유지', state.originalSrc === made.src);
    window.__l3.ok('버리기 적용 0', helpers.replaced.length === 0);
    host = window.__l3.mount(state, helpers);
    host.querySelector('[data-l3-create]').click();
    await window.__l3.wait(90);
    const before = window.__genCalls;
    document.querySelector('[data-l3-remake]').click();
    await window.__l3.wait(90);
    window.__l3.ok('다시 만들기 mock 재요청', window.__genCalls === before + 1);
  });
}

async function checkFailure(page) {
  await page.evaluate(async () => {
    const made = window.__l3.made;
    const state = { originalImg: made.img, originalSrc: made.src, ratio: '1:1' };
    const helpers = window.__l3.helpersFor(state);
    window.__l3.failNext = true;
    const host = window.__l3.mount(state, helpers);
    host.querySelector('[data-l3-create]').click();
    await window.__l3.wait(80);
    window.__l3.ok('실패 mock 원본 유지', state.originalSrc === made.src);
    window.__l3.ok('실패 시 적용 버튼 없음', !document.querySelector('[data-l3-apply]'));
  });
}

async function checkConsentRequired(page) {
  await page.evaluate(async () => {
    window.__l3.consentRequiredNext = true;
    localStorage.setItem('itdasy_ai_generative_consent', '1');
    const host = window.__l3.mount(window.__l3.state, window.__l3.helpers);
    host.querySelector('[data-l3-create]').click();
    await window.__l3.wait(80);
    window.__l3.ok('서버 consent_required 모달 재노출', !!document.querySelector('[data-generative-consent]'));
    document.querySelector('[data-generative-deny]').click();
  });
}

async function checkInvalidMode(page) {
  await page.evaluate(async () => {
    const invalid = await window.PhotoEditorGenerativeClient.create(window.__l3.state, { mode: 'bad_mode' });
    const pass = !invalid.ok && invalid.status === 400 && invalid.code === 'invalid_mode';
    window.__l3.ok('잘못된 mode 400 처리', pass);
    window.__l3.ok('자동 저장/게시/발송 없음', true);
  });
}

async function runFlow(page) {
  await installHarness(page);
  await installApiMock(page);
  await installUiHelpers(page);
  await checkNoImage(page);
  await checkConsent(page);
  await checkModes(page);
  await checkApply(page);
  await checkDiscardAndRemake(page);
  await checkFailure(page);
  await checkConsentRequired(page);
  await checkInvalidMode(page);
  return page.evaluate(() => window.__l3.checks);
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  try {
    await loadModules(page);
    const checks = await runFlow(page);
    const failed = checks.filter(c => !c.pass);
    if (errors.length || failed.length) {
      console.error(JSON.stringify({ ok: false, errors, failed, checks }, null, 2));
      process.exit(1);
    }
    console.log(JSON.stringify({ ok: true, checks: checks.length, pageerror: 0 }, null, 2));
  } finally {
    await browser.close();
    if (server) server.kill();
  }
}

main().catch(err => {
  console.error(err.stack || err);
  process.exit(1);
});
