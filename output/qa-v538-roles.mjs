// v538 QA — '전·후 사진 확인' 인라인 역할 재지정 패널
import fs from 'fs'; import path from 'path'; import { chromium } from 'playwright';
const ROOT = path.resolve('.');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const CSS = rd('css/workspace-v2-flow.css');
const STACK = [
  'js/photo-editor/template-fit-text.js', 'js/photo-editor/template-slots.js',
  'js/photo-editor/template-pack-beauty-data.js', 'js/photo-editor/template-market-data.js',
  'js/photo-editor/template-renderer-beauty-pack.js', 'js/photo-editor/template-renderer-beauty-pack-draws.js',
  'js/photo-editor/template-renderer-wm-pack-draws.js', 'js/photo-editor/premium-templates.js',
  'js/photo-editor/template-thumb.js', 'js/workspace/workspace-tpl-edit.js',
  'js/workspace/workspace-v2-home.js', 'js/workspace/workspace-v2-flow.js',
].map(rd).join('\n;\n');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF8FAGW2BPHFsbpRAAAAAElFTkSuQmCC';
const r = []; const ck = (n, c, d) => r.push({ n, p: !!c, d: d || '' });
const b = await chromium.launch();
const HTML = `<!doctype html><html><head><meta charset=utf-8><style>${CSS}</style></head><body><script>
 window._uid=()=>'id_'+Math.random().toString(36).slice(2); window.uid=window._uid; window.showToast=(m)=>{window.__toast=m;}; window.confirm=()=>true;
 window.renderScenarioSelector=(c,cb)=>{c.innerHTML='';}; window.__ai=0;
 window.WorkspaceAdapter={ applyWorkspaceTemplate:o=>{return Promise.resolve({ok:true,dataUrl:'data:img/x'});},
   generateCaption:o=>Promise.resolve({ok:true,caption:'x',hashtags:[]}), instagram:()=>({connected:false}), instagramProfile:()=>({connected:false}), recentCustomers:()=>Promise.resolve([]), saveItem:()=>Promise.resolve({ok:true}), setCaptionTemplate:()=>Promise.resolve({ok:true}) };
 window.Customer={search:()=>[],list:()=>Promise.resolve([])}; window.WorkspaceV2={refresh:()=>{}};
</script><script>${STACK}</script></body></html>`;
fs.writeFileSync(path.join(ROOT, 'output/_v538qa.html'), HTML);
const PORT = process.env.QA_PORT || '8091';
const fe = [];
const p = await b.newPage();
p.on('pageerror', e => fe.push(String(e)));
p.on('console', m => { if (m.type() === 'error' && !/INVALID_URL|net::|Failed to load/.test(m.text())) fe.push(m.text()); });
await p.goto('http://localhost:' + PORT + '/output/_v538qa.html', { waitUntil: 'load' });

const six = { id: 'six', workspaceContext: { templatePurpose: 'before_after', type: 'before_after' },
  photos: [0,1,2,3,4,5].map(i => ({ id: (i%2?'a':'b')+i, dataUrl: PNG, role: i%2?'after':'before' })) };
await p.evaluate(s => window.WorkspaceFlow.open({ startScreen: 'edit', cat: 'ba', slot: s }), six);
await p.waitForTimeout(100);

// 고급 fold 는 기본 열림 — tools 탭만 선택
await p.evaluate(() => { var t = document.querySelector('#wsv2Flow [data-fl-edtab="tools"]'); if (t) t.click(); });
await p.waitForTimeout(60);

const beforeOpen = await p.evaluate(() => !!document.querySelector('#wsv2Flow .ed-roles'));
ck('R-0 패널 기본 닫힘', beforeOpen === false, 'ed-roles=' + beforeOpen);

// '전·후 사진 확인' 클릭 → 패널 오픈
await p.evaluate(() => { var btn = document.querySelector('#wsv2Flow [data-fl="roles"]'); if (btn) btn.click(); });
await p.waitForTimeout(60);
const open = await p.evaluate(() => {
  const panel = document.querySelector('#wsv2Flow .ed-roles');
  const rows = document.querySelectorAll('#wsv2Flow .ed-roles__row').length;
  const segs = document.querySelectorAll('#wsv2Flow .ed-roles__b').length;
  const exp = document.querySelector('#wsv2Flow [data-fl="roles"]').getAttribute('aria-expanded');
  return { hasPanel: !!panel, rows, segs, exp };
});
ck('R-1 클릭 시 인라인 패널 노출', open.hasPanel === true, JSON.stringify(open));
ck('R-2 선택 사진 6장 행 렌더', open.rows === 6, 'rows=' + open.rows);
ck('R-3 각 행 전/후/기본 세그(6×3=18)', open.segs === 18, 'segs=' + open.segs);
ck('R-4 aria-expanded=true', open.exp === 'true', open.exp);

// 첫 사진(before)을 after로 변경 → 역할 반영 + 패널 갱신
const firstIdx = await p.evaluate(() => {
  // editablePhotos 첫 사진의 절대 인덱스 추정: 첫 row의 after 버튼
  const btn = document.querySelector('#wsv2Flow .ed-roles__row [data-fl-setrole$=":after"]');
  return btn ? btn.getAttribute('data-fl-setrole') : null;
});
await p.evaluate(() => { var btn = document.querySelector('#wsv2Flow .ed-roles__row [data-fl-setrole$=":after"]'); if (btn) btn.click(); });
await p.waitForTimeout(60);
const afterClick = await p.evaluate((fi) => {
  const idx = +fi.split(':')[0];
  const role = window.__roleProbe ? null : null;
  // 패널이 갱신되어 해당 사진 행의 after 버튼이 on 인지
  const row = document.querySelector('#wsv2Flow .ed-roles__row');
  const onBtn = row ? row.querySelector('.ed-roles__b.on') : null;
  return { onLabel: onBtn ? onBtn.textContent : null, stillOpen: !!document.querySelector('#wsv2Flow .ed-roles') };
}, firstIdx);
ck('R-5 세그 클릭 후 패널 유지(인라인 완결)', afterClick.stillOpen === true, '');
ck('R-6 클릭한 역할 on 반영', afterClick.onLabel === '후', 'on=' + afterClick.onLabel);

// 다시 클릭 → 패널 닫힘
await p.evaluate(() => { var btn = document.querySelector('#wsv2Flow [data-fl="roles"]'); if (btn) btn.click(); });
await p.waitForTimeout(60);
const closed = await p.evaluate(() => !document.querySelector('#wsv2Flow .ed-roles'));
ck('R-7 재클릭 시 패널 닫힘(토글)', closed === true, '');
ck('X-1 pageerror/console error 0', fe.length === 0, fe.slice(0, 3).join(' | '));

const pass = r.filter(x => x.p).length;
console.log('V538 ROLES QA: ' + pass + '/' + r.length + ' ' + (pass === r.length ? 'PASS' : 'FAIL'));
r.forEach(x => console.log('  ' + (x.p ? 'PASS' : 'FAIL') + ' ' + x.n + (x.d ? '  — ' + x.d : '')));
await b.close();
process.exit(pass === r.length ? 0 : 1);
