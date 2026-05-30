#!/usr/bin/env node
/* 사진편집기 출시 QA — 통합 검증 하니스 (1회성, 프로덕션 코드 미수정)
   T-120(BA/템플릿 피드백) + T-119(저장/export/slot) 현황 파악용.
   누끼 API 는 route mock(과금 0). BA 2nd 사진은 임시 PNG 를 setInputFiles.

   실행: python3 -m http.server 8099 (레포 루트) 후
        node scripts/release-qa.js
   결과: output/playwright/photoqa_*.png + 콘솔 JSON 리포트 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'output', 'playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=1&v=relqa';

// ── 의존성 0 PNG 인코더 (RGBA) ──
const _CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
function _crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = _CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function _chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0); const t = Buffer.from(type, 'ascii'); const crc = Buffer.alloc(4); crc.writeUInt32BE(_crc32(Buffer.concat([t, data])), 0); return Buffer.concat([len, t, data, crc]); }
function encodePng(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  return Buffer.concat([sig, _chunk('IHDR', ihdr), _chunk('IDAT', zlib.deflateSync(raw)), _chunk('IEND', Buffer.alloc(0))]);
}
function solidPng(w, h, r, g, b) { const a = Buffer.alloc(w * h * 4); for (let i = 0; i < w * h; i++) { a[i * 4] = r; a[i * 4 + 1] = g; a[i * 4 + 2] = b; a[i * 4 + 3] = 255; } return encodePng(w, h, a); }
function cutoutPng() { const w = 200, h = 250, a = Buffer.alloc(w * h * 4); const cx = w / 2, cy = h * 0.46, rx = w * 0.34, ry = h * 0.4; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; const dx = (x - cx) / rx, dy = (y - cy) / ry; const ins = dx * dx + dy * dy <= 1; a[i] = 235; a[i + 1] = 200; a[i + 2] = 175; a[i + 3] = ins ? 255 : 0; } return encodePng(w, h, a); }

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const tmpB = path.join(os.tmpdir(), 'qa_second.png');
  fs.writeFileSync(tmpB, solidPng(600, 800, 240, 150, 170)); // 분홍 after 사진

  const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 430, height: 920 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

  const CUT = cutoutPng();
  let removeBgCalls = 0;
  await page.route('**/image/remove-bg', async route => { removeBgCalls++; await route.fulfill({ status: 200, contentType: 'image/png', body: CUT }); });

  await page.addInitScript(() => {
    window.APP_BUILD = window.APP_BUILD || 'qa-release';
    window.__toastLog = [];
    const hook = () => { if (window.showToast && !window.showToast.__w) { const o = window.showToast; window.showToast = function (m) { try { window.__toastLog.push(String(m)); } catch (_e) { void _e; } return o.apply(this, arguments); }; window.showToast.__w = true; } };
    const iv = setInterval(hook, 50); setTimeout(() => clearInterval(iv), 9000);
    window.__photo = function (kind) {
      const c = document.createElement('canvas'); c.width = 800; c.height = 1000; const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 1000); gr.addColorStop(0, '#dfe7f0'); gr.addColorStop(1, '#b9c6d8'); g.fillStyle = gr; g.fillRect(0, 0, 800, 1000);
      g.fillStyle = '#e8b89a'; g.beginPath(); g.arc(400, 430, 175, 0, 7); g.fill();
      if (kind === 'nail') { g.fillStyle = '#a23b52'; for (let i = 0; i < 4; i++) g.fillRect(300 + i * 55, 320, 38, 70); }
      return c.toDataURL('image/png');
    };
    window.__open = async function (opts) {
      document.body.classList.remove('itdasy-locked');
      const lock = document.getElementById('lockOverlay'); if (lock) lock.classList.add('hidden');
      const PE = window.PhotoEditor;
      PE.open(Object.assign({ src: window.__photo('face'), shopName: 'QA 살롱', initial_tab: 'auto' }, opts || {}));
      await new Promise((res, rej) => { const t0 = Date.now(); const t = () => { const s = PE._internal.getState(); if (s && s.originalImg && s.originalImg.naturalWidth) return res(); if (Date.now() - t0 > 20000) return rej(new Error('load timeout')); setTimeout(t, 80); }; t(); });
      const NV = window.PhotoEditorNavV7; if (NV) { try { NV.setEnabled(true); NV.mount(); } catch (_e) { void _e; } }
      await new Promise(r => setTimeout(r, 200));
    };
    window.__chip = async function (id) { const NV = window.PhotoEditorNavV7; if (NV && NV.setSubChip) NV.setSubChip(id); await new Promise(r => setTimeout(r, 350)); };
    window.__canvas = function () { const cv = document.getElementById('peCanvas'); if (!cv) return null; const x = cv.getContext('2d', { willReadFrequently: true }); const w = cv.width, h = cv.height; const p = (px, py) => { const d = x.getImageData(px, py, 1, 1).data; return [d[0], d[1], d[2]]; }; return { w, h, tl: p(4, 4), tr: p(w - 5, 4), c: p(w >> 1, h >> 1), bl: p(4, h - 5) }; };
    window.__state = function () { const s = window.PhotoEditor._internal.getState(); return { tab: s.activeTab, tplId: s.template && s.template.id, ratio: s.ratio, hasSecond: !!s.secondImg, bgId: s.bg && s.bg.id }; };
    window.__clickTpl = async function (id) { const p = document.getElementById('pePanel'); const b = p.querySelector(`[data-pe-tpl="${id}"]`); if (!b) return false; b.click(); await new Promise(r => setTimeout(r, 450)); return true; };
    window.__save = async function () { const b = document.querySelector('#photoEditorSheet [data-pe-act="save"]'); if (b) b.click(); await new Promise(r => setTimeout(r, 800)); };
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.PhotoEditor && window.PhotoEditorNavV7 && window.PhotoEditorBgCompose, null, { timeout: 45000 });
  await page.waitForTimeout(1200);

  const report = { url: BASE_URL, ba: {}, template: {}, slot: {}, exportc: {}, removeBgCalls: 0 };

  // ── BA / 전후사진 ──
  await page.evaluate(() => window.__open());
  await page.evaluate(() => window.__chip('tpl-ba'));
  report.ba.entryState = await page.evaluate(() => window.__state());
  report.ba.panelHasPick = await page.evaluate(() => !!document.querySelector('#pePanel [data-ba-pick]'));
  // 1장 상태에서 export 시도 → 안내 토스트
  await page.evaluate(() => { window.__toastLog = []; const b = document.querySelector('#pePanel [data-ba-export]'); if (b) b.click(); });
  await page.waitForTimeout(300);
  report.ba.exportWithoutSecond = await page.evaluate(() => window.__toastLog.slice());
  // 2nd 사진 픽 (setInputFiles)
  const baPicker = await page.$('#pePanel #baPicker');
  const beforeBA = await page.evaluate(() => window.__canvas());
  // 픽 직후(150ms·100ms tick 내) 캔버스 변화 + 안정화(400ms) 둘 다 측정
  if (baPicker) { await baPicker.setInputFiles(tmpB); }
  await page.waitForTimeout(160);
  report.ba.canvasAt160ms = await page.evaluate(() => window.__canvas());
  await page.waitForTimeout(400);
  report.ba.afterPick = { state: await page.evaluate(() => window.__state()), toast: await page.evaluate(() => window.__toastLog.slice(-3)) };
  const afterBA = await page.evaluate(() => window.__canvas());
  report.ba.canvasChanged = JSON.stringify(beforeBA) !== JSON.stringify(afterBA);
  report.ba.before = beforeBA; report.ba.after = afterBA;
  await page.screenshot({ path: path.join(OUT, 'photoqa_ba_result.png') });

  // ── 템플릿 (template 탭 7종 칩) ──
  await page.evaluate(() => window.__open());
  await page.evaluate(() => window.__chip('tpl-feed')); // → tab 'template'
  report.template.entryTab = (await page.evaluate(() => window.__state())).tab;
  report.template.chips = {};
  for (const id of ['ba-h', 'service', 'price', 'review', 'story']) {
    const before = await page.evaluate(() => window.__canvas());
    const clicked = await page.evaluate(i => window.__clickTpl(i), id);
    const st = await page.evaluate(() => window.__state());
    const after = await page.evaluate(() => window.__canvas());
    report.template.chips[id] = { clicked, tplId: st.tplId, ratio: st.ratio, canvasChanged: JSON.stringify(before) !== JSON.stringify(after), after };
  }
  await page.screenshot({ path: path.join(OUT, 'photoqa_template_result.png') });

  // ── slot bridge (onSave) — 템플릿 적용 후 저장 → onSave dataUrl ──
  const slot = await page.evaluate(async () => {
    let saved = null;
    await window.__open({ onSave: d => { saved = d; }, initial_tab: 'template' });
    await window.__chip('tpl-feed');
    await window.__clickTpl('price');
    await window.__save();
    let dim = null, corner = null;
    if (saved) { const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = saved; }); dim = [img.width, img.height]; const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0); const d = cx.getImageData(4, 4, 1, 1).data; corner = [d[0], d[1], d[2]]; }
    return { saved: !!saved, dim, corner };
  });
  report.slot.onSave = slot;
  await page.screenshot({ path: path.join(OUT, 'photoqa_slot_bridge.png') });

  // slot fallback 분기 (PE_WORKSHOP_NEW_EDITOR_DISABLE)
  report.slot.fallback = await page.evaluate(() => ({ openSlotPhotoInEditor: typeof window.openSlotPhotoInEditor === 'function', openBgPanel: typeof window.openBgPanel === 'function', openTemplatePanel: typeof window.openTemplatePanel === 'function' }));

  // ── export (standalone) — 배경 적용 후 PNG export 반영 ──
  const exportc = await page.evaluate(async () => {
    await window.__open({ initial_tab: 'bg' });
    await window.__chip('tpl-bg');
    const p = document.getElementById('pePanel'); const b = p.querySelector('[data-pe-bg-id="bg_black_lux"]'); if (b) b.click();
    const PE = window.PhotoEditor;
    await new Promise(res => { const t0 = Date.now(); const t = () => { const s = PE._internal.getState(); if (s.bg && s.bg.id === 'bg_black_lux') return res(); if (Date.now() - t0 > 15000) return res(); setTimeout(t, 100); }; t(); });
    await new Promise(r => setTimeout(r, 300));
    const cv = document.getElementById('peCanvas'); const url = cv.toDataURL('image/png');
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0); const d = cx.getImageData(4, 4, 1, 1).data;
    return { exported: true, dim: [img.width, img.height], corner: [d[0], d[1], d[2]] };
  });
  report.exportc = exportc;
  await page.screenshot({ path: path.join(OUT, 'photoqa_export_result.png') });

  report.removeBgCalls = removeBgCalls;
  report.toastSample = await page.evaluate(() => (window.__toastLog || []).slice(0, 30));
  report.severeErrors = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK/i.test(e));
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
}

main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
