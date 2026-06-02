#!/usr/bin/env node
/* 사진편집 수동 검증 도구 주입/스모크 QA (런타임 미수정)
   photo-effect-manual-debug.js 를 실페이지에 주입 → API 존재·캡처·preview 생성·패널 DOM·잇비 매핑만 검증.
   ※ 실제 엔진 품질 판단은 사람이 DevTools 에서 실사진으로 확인한다(이 QA 는 스모크만).
   실행: python3 -m http.server 8099 후 node scripts/photo-effect-manual-debug-qa.js */

const path = require('path');
const { chromium } = require('playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=pemqa';
const MODULE = path.resolve(__dirname, '../js/photo-editor/photo-effect-manual-debug.js');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 140)); });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.PhotoEditorBeautyEngine && typeof window.PhotoEditorBeautyEngine.apply === 'function', null, { timeout: 45000 });
  await page.addScriptTag({ path: MODULE });
  await page.waitForFunction(() => window.PhotoEffectManualDebug, null, { timeout: 15000 });

  const out = await page.evaluate(() => {
    const M = window.PhotoEffectManualDebug;
    const api = ['captureCurrent', 'preview', 'previewSteps', 'previewAll', 'previewSuspects', 'reset', 'exportReport', 'inspectItbiRoutes', 'previewItbi'];
    const apiOk = api.every(k => typeof M[k] === 'function');
    // 합성 #peCanvas 주입(헤드리스엔 실사진 없음) — 캡처 대상 제공
    let cv = document.getElementById('peCanvas');
    if (!cv) { cv = document.createElement('canvas'); cv.id = 'peCanvas'; document.body.appendChild(cv); }
    cv.width = 200; cv.height = 200;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.fillStyle = '#ebc8b0'; cx.fillRect(0, 0, 200, 200);
    cx.fillStyle = '#d98a7a'; cx.fillRect(40, 40, 60, 60);
    const captured = M.captureCurrent();
    const prev = M.preview('redness', 80);
    const steps = M.previewSteps('skin');
    const routes = M.inspectItbiRoutes();
    const itbi = M.previewItbi('붉은기 빼줘');
    const rep = M.exportReport();
    const panel = !!document.getElementById('pemDebugPanel');
    const resetOk = M.reset();
    return {
      apiOk, apiCount: api.length, captured,
      previewHasMetrics: !!(prev && typeof prev.changedRatio === 'number' && prev.label),
      stepsHasMono: !!(steps && typeof steps.monotonic === 'boolean'),
      routesCount: Array.isArray(routes) ? routes.length : 0,
      itbiRouted: !!(itbi && itbi.param === 'redness'),
      reportNote: !!(rep && /추정값/.test(rep.note)),
      panelCreated: panel, resetOk,
      labelsCount: Object.keys(M.LABELS).length, suspectsCount: M.SUSPECTS.length,
    };
  });

  out.severeErrors = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK|Failed to load resource|ERR_/i.test(e));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
}
main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
