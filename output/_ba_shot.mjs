import fs from 'fs'; import { chromium } from 'playwright';
const IDS = ['bp-ba-premium-infographic','bp-ba-luxury-review','bp-ba-story-signature','bp-ba-classic-poster','bp-ba-care-guide'];
const b = await chromium.launch(); const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('http://localhost:8097/output/_ba_render.html', { waitUntil: 'load' });
const ready = await p.evaluate(() => window.__ready);
console.log('renderer ready:', ready);
for (const id of IDS) {
  const has = await p.evaluate(i => window.__has(i), id);
  const url = await p.evaluate(i => window.__renderBA(i, true), id);
  const buf = Buffer.from(url.split(',')[1], 'base64');
  fs.writeFileSync('output/ba-' + id + '.png', buf);
  console.log(id, 'has=' + has, 'bytes=' + buf.length);
}
console.log('errors:', errs.slice(0, 5));
await b.close();
