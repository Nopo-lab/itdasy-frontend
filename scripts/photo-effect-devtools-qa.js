#!/usr/bin/env node
/* 사진편집 효과 DevTools QA 러너 (런타임 미수정 — 측정 전용, 실사진 0)
   실페이지(엔진+SmartMask 로드)에 photo-effect-debug.js 를 주입(index.html 미수정·코덱스 무접촉)하고
   PhotoEffectDebug.runAll() 로 28 param × 강도 0/50/100 을 합성 5종에서 계측 → 결과표/이슈 JSON.
   실행: python3 -m http.server 8099 후 node scripts/photo-effect-devtools-qa.js (PHOTO_QA_URL 지정 가능) */

const path = require('path');
const { chromium } = require('playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=peqa';
const DEBUG_MODULE = path.resolve(__dirname, '../js/photo-editor/photo-effect-debug.js');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 160)); });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  // 엔진 로드 대기 (SmartMask 는 휴리스틱이라 있으면 사용, 없어도 엔진 fallback 동작)
  await page.waitForFunction(() => window.PhotoEditorBeautyEngine && typeof window.PhotoEditorBeautyEngine.apply === 'function', null, { timeout: 45000 });
  // debug 모듈 주입 (런타임 등록 — index.html 미수정)
  await page.addScriptTag({ path: DEBUG_MODULE });
  await page.waitForFunction(() => window.PhotoEffectDebug && typeof window.PhotoEffectDebug.runAll === 'function', null, { timeout: 15000 });

  const out = await page.evaluate(() => {
    const rows = window.PhotoEffectDebug.runAll({ silent: true });
    const report = window.PhotoEffectDebug.exportReport();
    return { rows, issues: report.issues, hasSmartMask: !!window.PhotoEditorSmartMask, build: window.APP_BUILD || null };
  });

  out.severeErrors = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK|Failed to load resource|ERR_/i.test(e));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
}
main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
