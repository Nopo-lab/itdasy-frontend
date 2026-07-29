import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 430, height: 700 }, deviceScaleFactor: 2 });
await p.goto('http://localhost:8080/output/_v554_prectabs.html', { waitUntil: 'networkidle' });
const info = await p.evaluate(() => {
  const f = document.getElementById('f375');
  const fr = f.getBoundingClientRect();
  const tabs = [...f.querySelectorAll('.ed-tab')].map(t => {
    const r = t.getBoundingClientRect();
    const cs = getComputedStyle(t);
    return { txt: t.textContent, w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), color: cs.color, display: getComputedStyle(t.parentElement).display };
  });
  const panelCS = getComputedStyle(f.querySelector('.ed-tabs'));
  return { frame: {w:Math.round(fr.width), h:Math.round(fr.height)}, tabsDisplay: panelCS.display, gridCols: panelCS.gridTemplateColumns, tabs };
});
console.log(JSON.stringify(info, null, 2));
await b.close();
