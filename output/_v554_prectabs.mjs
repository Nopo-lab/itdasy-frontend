import { chromium } from 'playwright';
const b = await chromium.launch();
// 한 페이지에 360/375/414 세 프레임이 다 있으니 414 viewport로 한 번만 로드해 전체 캡처 + 판정값 일괄 수집
const p = await b.newPage({ viewport: { width: 430, height: 700 }, deviceScaleFactor: 2 });
await p.goto('http://localhost:8080/output/_v554_prectabs.html', { waitUntil: 'networkidle' });
const qa = await p.evaluate(() => window.__QA__);
for (const r of qa) console.log(`[${r.id}] count=${r.count} oneRow=${r.oneRow} clipped=${r.clipped} tops=${JSON.stringify(r.tops)}`);
await p.screenshot({ path: 'output/_v554_prectabs_all.png', fullPage: true });
await b.close();
console.log('shot: output/_v554_prectabs_all.png');
