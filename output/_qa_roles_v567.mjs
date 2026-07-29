import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('file://' + process.cwd() + '/output/_qa_roles_v567.html', { waitUntil: 'load' });
const r = await p.evaluate(() => {
  const g = (sel) => getComputedStyle(document.querySelector(sel)).backgroundColor;
  return { beforeRole: g('#b .tpls-slide__role'), afterRole: g('#a .tpls-slide__role') };
});
// 전=초록 #2EA36B=rgb(46,163,107) / 후=분홍(brand-strong)
const greenOK = /rgb\(46,\s*163,\s*107\)/.test(r.beforeRole);
const pinkOK  = /rgb\((18[0-9]|19[0-9]|2[0-4][0-9]),/.test(r.afterRole) && !/rgb\(46,/.test(r.afterRole);
console.log('전(before) role bg =', r.beforeRole, greenOK ? 'PASS(green)' : 'FAIL');
console.log('후(after)  role bg =', r.afterRole, pinkOK ? 'PASS(pink)' : 'FAIL');
console.log(greenOK && pinkOK ? 'RESULT: PASS' : 'RESULT: FAIL');
await b.close();
