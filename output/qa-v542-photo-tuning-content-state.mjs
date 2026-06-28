// v542 QA — 내 콘텐츠 삭제(영속) + 게시 완료(영속+badge) + 보정 디버그 패널 0/50/100
import fs from 'fs'; import path from 'path'; import { chromium } from 'playwright';
const ROOT = path.resolve('.');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const r = []; const ck = (n, c, d) => r.push({ n, p: !!c, d: d || '' });
const PORT = process.env.QA_PORT || '8091';
const b = await chromium.launch();

// ── Part A: 홈 삭제/게시완료 (영속) ──
const HOME_CSS = rd('css/workspace-v2.css');
const HOME_STACK = ['js/workspace/workspace-state.js', 'js/workspace/workspace-v2-home.js'].map(rd).join('\n;\n');
const homeHtml = `<!doctype html><html><head><meta charset=utf-8><style>${HOME_CSS}</style></head><body>
<div id="root" class="wsv2"></div>
<script>
 window.showToast=function(m){window.__toast=m;};
 window.__store=[
   {id:'s1',label:'콘텐츠 1',photos:[{id:'a',dataUrl:'x',role:'before'},{id:'b',dataUrl:'x',role:'after'}],caption:'글',customer_id:'c1'},
   {id:'s2',label:'콘텐츠 2',photos:[{id:'c',dataUrl:'x',role:'hero'}],caption:'글2',customer_id:'c2'}
 ];
 window.loadSlotsFromDB=function(){return Promise.resolve(window.__store.slice());};
 window.saveSlotToDB=function(s){var i=window.__store.findIndex(function(x){return x.id===s.id;}); if(i>=0)window.__store[i]=s; else window.__store.push(s); window.__saved=s.id; return Promise.resolve();};
 window.deleteSlotFromDB=function(id){window.__store=window.__store.filter(function(x){return x.id!==id;}); window.__deleted=id; return Promise.resolve();};
</script>
<script>${HOME_STACK}</script>
<script>window.WorkspaceV2.render(document.getElementById('root'),{slots:window.__store.slice()});</script>
</body></html>`;
fs.writeFileSync(path.join(ROOT, 'output/_v542home.html'), homeHtml);
const pA = await b.newPage(); const feA = [];
pA.on('pageerror', e => feA.push(String(e)));
pA.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::|404|INVALID_URL/.test(m.text())) feA.push(m.text()); });
await pA.goto('http://localhost:' + PORT + '/output/_v542home.html', { waitUntil: 'load' });
await pA.waitForTimeout(80);
ck('A-1 카드 2개 렌더', await pA.evaluate(() => document.querySelectorAll('#root .wsv2-card').length) === 2, '');

// 게시 완료 — s1
await pA.evaluate(() => document.querySelector('#root [data-wsv2-slot="s1"]').click());
await pA.waitForTimeout(60);
ck('A-2 드로어에 게시 완료 + 삭제 버튼', await pA.evaluate(() => !!document.querySelector('[data-wsv2-act="게시 완료"]') && !!document.querySelector('[data-wsv2-act="삭제"]')), '');
await pA.evaluate(() => document.querySelector('[data-wsv2-act="게시 완료"]').click());
await pA.waitForTimeout(80);
ck('A-3 게시 완료 → 저장소 published 영속', await pA.evaluate(() => { var s = window.__store.filter(x => x.id === 's1')[0]; return s && s.publish && s.publish.status === 'published'; }), 'saved=' + await pA.evaluate(() => window.__saved));
ck('A-4 카드에 "게시 완료" green badge', await pA.evaluate(() => { var c = document.querySelector('#root [data-wsv2-slot="s1"]'); return c && /게시 완료/.test(c.textContent) && !!c.querySelector('.wsv2-badge--green'); }), '');
// 새로고침(재로드) 후 유지
await pA.evaluate(() => { return window.loadSlotsFromDB().then(function (s) { window.WorkspaceV2.render(document.getElementById('root'), { slots: s }); }); });
await pA.waitForTimeout(80);
ck('A-5 새로고침 후 게시 완료 유지', await pA.evaluate(() => { var c = document.querySelector('#root [data-wsv2-slot="s1"]'); return c && !!c.querySelector('.wsv2-badge--green'); }), '');

// 삭제 — s2
await pA.evaluate(() => document.querySelector('#root [data-wsv2-slot="s2"]').click());
await pA.waitForTimeout(60);
await pA.evaluate(() => document.querySelector('[data-wsv2-act="삭제"]').click());
await pA.waitForTimeout(60);
ck('A-6 삭제 확인 시트 표시', await pA.evaluate(() => !!document.querySelector('[data-wsv2-confirm]') && /삭제할까요/.test(document.querySelector('[data-wsv2-confirm]').textContent)), '');
// 취소 먼저 — 유지
await pA.evaluate(() => document.querySelector('[data-wsv2-confirm-cancel]').click());
await pA.waitForTimeout(40);
ck('A-7 취소 시 유지(저장소 2개)', await pA.evaluate(() => window.__store.length) === 2, '');
// 다시 삭제 → 확인
await pA.evaluate(() => document.querySelector('#root [data-wsv2-slot="s2"]').click());
await pA.waitForTimeout(40);
await pA.evaluate(() => document.querySelector('[data-wsv2-act="삭제"]').click());
await pA.waitForTimeout(40);
await pA.evaluate(() => document.querySelector('[data-wsv2-confirm-ok]').click());
await pA.waitForTimeout(80);
ck('A-8 삭제 → 저장소에서 영구 제거', await pA.evaluate(() => window.__store.length === 1 && window.__deleted === 's2'), '');
ck('A-9 삭제 → 카드 목록에서 즉시 제거', await pA.evaluate(() => !document.querySelector('#root [data-wsv2-slot="s2"]')), '');
ck('A-10 s1(게시완료)은 영향 없음', await pA.evaluate(() => !!document.querySelector('#root [data-wsv2-slot="s1"]')), '');
ck('A-X console error 0', feA.length === 0, feA.slice(0, 2).join(' | '));

// ── Part B: 보정 디버그 패널 (?photoDebug=1) ──
const FCSS = rd('css/workspace-v2-flow.css');
const FSTACK = [
  'js/photo-editor/template-fit-text.js','js/photo-editor/template-slots.js','js/photo-editor/template-pack-beauty-data.js',
  'js/photo-editor/template-market-data.js','js/photo-editor/template-renderer-beauty-pack.js','js/photo-editor/template-renderer-beauty-pack-draws.js',
  'js/photo-editor/template-renderer-wm-pack-draws.js','js/photo-editor/premium-templates.js','js/photo-editor/template-thumb.js',
  'js/workspace/workspace-tpl-edit.js','js/workspace/workspace-v2-home.js','js/workspace/workspace-state.js','js/workspace/workspace-v2-flow.js',
].map(rd).join('\n;\n');
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF8FAGW2BPHFsbpRAAAAAElFTkSuQmCC';
const fHtml = (q) => `<!doctype html><html><head><meta charset=utf-8><style>${FCSS}</style></head><body><script>
 window._uid=()=>'id_'+Math.random().toString(36).slice(2); window.uid=window._uid; window.showToast=()=>{}; window.confirm=()=>true; window.renderScenarioSelector=(c)=>{c.innerHTML='';};
 window.WorkspaceAdapter={ applyWorkspaceTemplate:()=>Promise.resolve({ok:true,dataUrl:'data:img/x'}), applyWorkspaceCorrections:()=>Promise.resolve({ok:true,dataUrl:'${PNG}'}), generateCaption:()=>Promise.resolve({ok:true,caption:'x',hashtags:[]}), instagram:()=>({connected:false}), instagramProfile:()=>({connected:false}), recentCustomers:()=>Promise.resolve([]), saveItem:()=>Promise.resolve({ok:true}), setCaptionTemplate:()=>Promise.resolve({ok:true}) };
 window.Customer={search:()=>[],list:()=>Promise.resolve([])}; window.WorkspaceV2={refresh:()=>{}};
</script><script>${FSTACK}</script></body></html>`;
fs.writeFileSync(path.join(ROOT, 'output/_v542flow.html'), fHtml());
const slot={id:'s',workspaceContext:{templatePurpose:'before_after',type:'before_after'},photos:[{id:'a',dataUrl:PNG,role:'before'},{id:'b',dataUrl:PNG,role:'after'}]};

// debug ON
const pB = await b.newPage(); const feB = []; await pB.setViewportSize({ width: 420, height: 900 });
pB.on('pageerror', e => feB.push(String(e)));
pB.on('console', m => { if (m.type() === 'error' && !/INVALID_URL|net::|Failed/.test(m.text())) feB.push(m.text()); });
await pB.goto('http://localhost:' + PORT + '/output/_v542flow.html?photoDebug=1', { waitUntil: 'load' });
await pB.evaluate(s => window.WorkspaceFlow.open({ startScreen: 'edit', cat: 'ba', slot: s }), slot);
await pB.waitForTimeout(150);
ck('B-1 ?photoDebug=1 → 보정 디버그 패널 표시', await pB.evaluate(() => !!document.querySelector('#wsv2Flow .ed-fxdebug')), '');
ck('B-2 패널에 0/50/100 + 현재값 복사 버튼', await pB.evaluate(() => document.querySelectorAll('#wsv2Flow [data-fl-fxv]').length === 3 && !!document.querySelector('#wsv2Flow [data-fl="fxcopy"]')), '');
ck('B-3 패널에 key/mask 표시', await pB.evaluate(() => /skinMask|mask/.test(document.querySelector('#wsv2Flow .ed-fxdebug').textContent)), '');
// 50 보기 → skin=50
await pB.evaluate(() => document.querySelector('#wsv2Flow [data-fl-fxv="50"]').click());
await pB.waitForTimeout(120);
ck('B-4 "50 보기" → 슬라이더 50 적용', await pB.evaluate(() => { var s = document.querySelector('#wsv2Flow [data-fl-beautyrange="skin"]'); return s && +s.value === 50; }), await pB.evaluate(() => { var s = document.querySelector('#wsv2Flow [data-fl-beautyrange="skin"]'); return s ? s.value : 'no-slider'; }));
ck('B-X console error 0', feB.length === 0, feB.slice(0, 2).join(' | '));

// debug OFF
const pC = await b.newPage(); await pC.setViewportSize({ width: 420, height: 900 });
await pC.goto('http://localhost:' + PORT + '/output/_v542flow.html', { waitUntil: 'load' });
await pC.evaluate(s => window.WorkspaceFlow.open({ startScreen: 'edit', cat: 'ba', slot: s }), slot);
await pC.waitForTimeout(120);
ck('B-5 일반 모드 → 디버그 패널 미노출', await pC.evaluate(() => !document.querySelector('#wsv2Flow .ed-fxdebug')), '');

const pass = r.filter(x => x.p).length;
console.log('V542 QA: ' + pass + '/' + r.length + ' ' + (pass === r.length ? 'PASS' : 'FAIL'));
r.forEach(x => console.log('  ' + (x.p ? 'PASS' : 'FAIL') + ' ' + x.n + (x.d ? '  — ' + x.d : '')));
await b.close();
process.exit(pass === r.length ? 0 : 1);
