#!/usr/bin/env node
/* 사진편집 기능명 계약 QA: 기능명이 약속한 체감 효과가 실제로 생기는지 검사한다. */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const HARNESS = path.join(ROOT, 'scripts', 'photo-beauty-contract-harness.js');
const OUT = path.join(ROOT, 'output', 'photo-beauty-contract-qa-report.json');
const PORT = Number(process.env.PHOTO_CONTRACT_PORT || 8099);
const BASE_URL = process.env.PHOTO_CONTRACT_URL || `http://127.0.0.1:${PORT}/?v=beauty-contract`;

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startServer() {
  if (process.env.PHOTO_CONTRACT_URL) return null;
  const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 40; i++) {
    const res = await fetch(BASE_URL).catch(() => null);
    if (res && res.ok) return server;
    await wait(150);
  }
  server.kill();
  throw new Error('로컬 사진 QA 서버를 열지 못했어요.');
}

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 430, height: 920 }, deviceScaleFactor: 2 });
  await page.addInitScript(() => {
    try { navigator.serviceWorker.register = () => Promise.reject(new Error('qa sw off')); } catch (_e) { /* noop */ }
    try { localStorage.setItem('shop_type', '네일아트'); } catch (_e) { /* noop */ }
  });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.PhotoEditor && window.PhotoEditorBeautyEngine, null, { timeout: 45000 });
  await page.addScriptTag({ path: HARNESS });
  return page;
}

async function runCases(page) {
  return page.evaluate(() => window.__PhotoBeautyContractQa.runCases());
}

function writeReport(report) {
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  const failed = report.results.filter(result => !result.ok);
  if (!failed.length) {
    process.stdout.write(`${JSON.stringify({ ok: true, count: report.results.length, report: OUT }, null, 2)}\n`);
    return;
  }
  process.stderr.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(1);
}

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  try {
    const page = await openPage(browser);
    const results = await runCases(page);
    writeReport({ checkedAt: new Date().toISOString(), results });
  } finally {
    await browser.close();
    if (server) server.kill();
  }
}

main().catch(err => {
  process.stderr.write(`${err.stack || err}\n`);
  process.exit(1);
});
