// 진단: 마스크 없는(휴리스틱) 경로에서 각 뷰티 슬라이더가 실제 픽셀을 바꾸는가
import { chromium } from 'playwright';
const PORT = process.env.QA_PORT || '8091';
const b = await chromium.launch();
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
p.on('console', m => { if (m.type() === 'error') errs.push('console:' + m.text()); });
const html = `<!doctype html><html><head><meta charset=utf-8></head><body>
<script src="/app-photo-editor-smart-mask.js"></script>
<script src="/js/photo-editor/beauty-engine.js"></script>
<script src="/js/photo-editor/photo-effect-debug.js"></script>
</body></html>`;
import fs from 'fs';
fs.writeFileSync('output/_diag-effects.html', html);
await p.goto('http://localhost:' + PORT + '/output/_diag-effects.html', { waitUntil: 'load' });
const out = await p.evaluate(() => {
  const r = { hasEngine: !!(window.PhotoEditorBeautyEngine && window.PhotoEditorBeautyEngine.apply),
              hasSmartMask: !!window.PhotoEditorSmartMask,
              hasDebug: !!(window.PhotoEffectDebug && window.PhotoEffectDebug.runAll) };
  if (!r.hasDebug) return r;
  try {
    const rows = window.PhotoEffectDebug.runAll({ silent: true, strength: 100 });
    r.rows = rows;
  } catch (e) { r.err = String(e && e.stack || e); }
  return r;
});
console.log('hasEngine=%s hasSmartMask=%s hasDebug=%s', out.hasEngine, out.hasSmartMask, out.hasDebug);
if (out.err) console.log('RUN ERR:', out.err);
if (out.rows) {
  // rows 구조 자동 탐색
  console.log('--- runAll rows (raw keys) ---');
  const sample = Array.isArray(out.rows) ? out.rows[0] : out.rows;
  console.log('type:', Array.isArray(out.rows) ? 'array len ' + out.rows.length : typeof out.rows);
  console.log(JSON.stringify(out.rows, null, 1).slice(0, 6000));
}
if (errs.length) console.log('PAGE ERRORS:', errs.slice(0, 10));
await b.close();
