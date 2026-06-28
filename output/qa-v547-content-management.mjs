// v547 QA — B-2 일괄 작업(영속) + B-1 게시 sheet(영속) + B-3 스크롤 복원 wiring
import fs from 'fs'; import path from 'path'; import { chromium } from 'playwright';
const ROOT=path.resolve('.'); const rd=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const r=[]; const ck=(n,c,d)=>r.push({n,p:!!c,d:d||''});
const PORT=process.env.QA_PORT||'8091'; const b=await chromium.launch();

// ── Part A: 홈 일괄 작업 (B-2) + 스크롤 wiring (B-3) ──
const HOME_CSS=[rd('css/tokens.css'),rd('css/workspace-v2.css')].join('\n');
const HOME_STACK=['js/workspace/workspace-state.js','js/workspace/workspace-v2-home.js'].map(rd).join('\n;\n');
const homeHtml=`<!doctype html><html><head><meta charset=utf-8><style>${HOME_CSS}</style></head><body><div id="root" class="wsv2"></div>
<script>window.showToast=function(m){window.__toast=m;};
 window.__store=[{id:'s1',label:'C1',photos:[{id:'a',dataUrl:'x',role:'before'},{id:'b',dataUrl:'x',role:'after'}],caption:'g',customer_id:'c1'},
   {id:'s2',label:'C2',photos:[{id:'c',dataUrl:'x',role:'hero'}],caption:'g',customer_id:'c2'},
   {id:'s3',label:'C3',photos:[{id:'d',dataUrl:'x',role:'hero'}],caption:'g',customer_id:'c3'}];
 window.loadSlotsFromDB=()=>Promise.resolve(window.__store.slice());
 window.saveSlotToDB=s=>{var i=window.__store.findIndex(x=>x.id===s.id);if(i>=0)window.__store[i]=s;return Promise.resolve();};
 window.deleteSlotFromDB=id=>{window.__store=window.__store.filter(x=>x.id!==id);return Promise.resolve();};
 window.WorkspaceFlow={open:function(o){window.__opened=o;}}; window.WorkspaceDefaultTpl={get:()=>'',set:()=>true};</script>
<script>${HOME_STACK}</script><script>window.WorkspaceV2.render(document.getElementById('root'),{slots:window.__store.slice()});</script></body></html>`;
fs.writeFileSync(path.join(ROOT,'output/_v547home.html'),homeHtml);
const pA=await b.newPage(); const feA=[]; pA.on('pageerror',e=>feA.push(String(e))); pA.on('console',m=>{if(m.type()==='error'&&!/Failed to load|net::|404|INVALID_URL/.test(m.text()))feA.push(m.text());});
await pA.goto('http://localhost:'+PORT+'/output/_v547home.html',{waitUntil:'load'}); await pA.waitForTimeout(80);
ck('B2-1 카드 3개', await pA.evaluate(()=>document.querySelectorAll('#root .wsv2-card').length)===3, '');
ck('B2-2 선택 토글 버튼', await pA.evaluate(()=>!!document.querySelector('#root [data-wsv2-selecttoggle]')), '');
// 선택 모드 진입
await pA.evaluate(()=>document.querySelector('#root [data-wsv2-selecttoggle]').click()); await pA.waitForTimeout(40);
ck('B2-3 선택모드 → 체크박스 표시', await pA.evaluate(()=>document.querySelectorAll('#root .wsv2-card__check').length)===3, '');
// s1,s2 선택
await pA.evaluate(()=>document.querySelector('#root [data-wsv2-slot="s1"]').click()); await pA.waitForTimeout(30);
await pA.evaluate(()=>document.querySelector('#root [data-wsv2-slot="s2"]').click()); await pA.waitForTimeout(30);
ck('B2-4 하단 바 "2개 선택"', await pA.evaluate(()=>/2개 선택/.test((document.querySelector('#root .wsv2-bulkbar')||{}).textContent||'')), '');
// 일괄 게시 완료
await pA.evaluate(()=>document.querySelector('#root [data-wsv2-bulk="publish"]').click()); await pA.waitForTimeout(60);
ck('B2-5 일괄 게시완료 → 저장소 영속(s1,s2 published)', await pA.evaluate(()=>{var g=id=>window.__store.filter(x=>x.id===id)[0];return g('s1').publish&&g('s1').publish.status==='published'&&g('s2').publish.status==='published'&&!(g('s3').publish&&g('s3').publish.status==='published');}), '');
ck('B2-6 게시완료 → green badge', await pA.evaluate(()=>document.querySelectorAll('#root .wsv2-badge--green').length>=2), '');
// 다시 선택모드 → s3 선택 → 일괄 삭제
await pA.evaluate(()=>document.querySelector('#root [data-wsv2-selecttoggle]').click()); await pA.waitForTimeout(40);
await pA.evaluate(()=>document.querySelector('#root [data-wsv2-slot="s3"]').click()); await pA.waitForTimeout(30);
await pA.evaluate(()=>document.querySelector('#root [data-wsv2-bulk="delete"]').click()); await pA.waitForTimeout(50);
ck('B2-7 일괄 삭제 확인 시트', await pA.evaluate(()=>/삭제할까요/.test((document.querySelector('[data-wsv2-confirm]')||{}).textContent||'')), '');
await pA.evaluate(()=>document.querySelector('[data-wsv2-confirm-go]').click()); await pA.waitForTimeout(60);
ck('B2-8 삭제 → 저장소 영속 제거(s3 없음)', await pA.evaluate(()=>!window.__store.some(x=>x.id==='s3')&&window.__store.length===2), '');
ck('B2-9 삭제 → 카드 제거', await pA.evaluate(()=>!document.querySelector('#root [data-wsv2-slot="s3"]')), '');
// B-3 wiring: 카드 진입 시 _enteredCardId 저장 후 복귀 render 시 그 카드로 스크롤(에러 없이 동작)
await pA.evaluate(()=>{ var c=document.querySelector('#root [data-wsv2-resume="s1"]'); if(c)c.click(); }); await pA.waitForTimeout(30);
ck('B3-1 카드 탭 → 플로우 open(slot 전달)', await pA.evaluate(()=>window.__opened&&window.__opened.slot&&window.__opened.slot.id==='s1'), '');
await pA.evaluate(()=>window.WorkspaceV2.render(document.getElementById('root'),{slots:window.__store.slice()})); await pA.waitForTimeout(60);
ck('B3-2 복귀 render 시 진입 카드 존재 + 에러 없음', await pA.evaluate(()=>!!document.querySelector('#root [data-wsv2-slot="s1"]')), '');
ck('B3-3 scrollInto25 wiring(소스)', /_scrollToEnteredCard|_enteredCardId/.test(rd('js/workspace/workspace-v2-home.js')), '');
ck('A-X home console error 0', feA.length===0, feA.slice(0,2).join(' | '));

// ── Part B: 게시 sheet (B-1) ──
const FCSS=rd('css/workspace-v2-flow.css');
const FSTACK=['js/photo-editor/template-fit-text.js','js/photo-editor/template-slots.js','js/photo-editor/template-pack-beauty-data.js','js/photo-editor/template-market-data.js','js/photo-editor/template-renderer-beauty-pack.js','js/photo-editor/template-renderer-beauty-pack-draws.js','js/photo-editor/template-renderer-wm-pack-draws.js','js/photo-editor/premium-templates.js','js/photo-editor/template-thumb.js','js/workspace/workspace-tpl-edit.js','js/workspace/workspace-v2-home.js','js/workspace/workspace-state.js','js/workspace/workspace-v2-flow.js'].map(rd).join('\n;\n');
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF8FAGW2BPHFsbpRAAAAAElFTkSuQmCC';
const fHtml=`<!doctype html><html><head><meta charset=utf-8><style>${FCSS}</style></head><body><script>
 window._uid=()=>'id_'+Math.random().toString(36).slice(2); window.uid=window._uid; window.showToast=()=>{}; window.confirm=()=>true; window.renderScenarioSelector=(c)=>{c.innerHTML='';};
 window.__saved=null;
 window.WorkspaceAdapter={ applyWorkspaceTemplate:()=>Promise.resolve({ok:true,dataUrl:'x'}), saveImage:()=>{}, saveItem:function(s){window.__saved=s;return Promise.resolve({ok:true});}, generateCaption:()=>Promise.resolve({ok:true,caption:'x',hashtags:[]}), instagram:()=>({connected:false}), instagramProfile:()=>({connected:false}), recentCustomers:()=>Promise.resolve([]), setCaptionTemplate:()=>Promise.resolve({ok:true}) };
 window.Customer={search:()=>[],list:()=>Promise.resolve([])}; window.WorkspaceV2={refresh:()=>{window.__refreshed=true;}};
</script><script>${FSTACK}</script></body></html>`;
fs.writeFileSync(path.join(ROOT,'output/_v547flow.html'),fHtml);
const pB=await b.newPage(); const feB=[]; await pB.setViewportSize({width:420,height:900});
pB.on('pageerror',e=>feB.push(String(e))); pB.on('console',m=>{if(m.type()==='error'&&!/Failed|net::|INVALID/.test(m.text()))feB.push(m.text());});
await pB.goto('http://localhost:'+PORT+'/output/_v547flow.html',{waitUntil:'load'});
const slot={id:'sp',workspaceContext:{templatePurpose:'before_after',type:'before_after'},photos:[{id:'a',dataUrl:PNG,role:'before'},{id:'b',dataUrl:PNG,role:'after'}]};
await pB.evaluate(s=>window.WorkspaceFlow.open({startScreen:'preview',cat:'ba',slot:s}),slot); await pB.waitForTimeout(150);
// saveimg 트리거
await pB.evaluate(()=>{var s=document.querySelector('#wsv2Flow [data-fl="saveimg"]'); if(s)s.click();}); await pB.waitForTimeout(120);
ck('B1-1 저장 후 "게시했나요?" sheet', await pB.evaluate(()=>!!document.querySelector('#wsv2Flow [data-fl-pubask]') && /게시했나요/.test(document.querySelector('#wsv2Flow [data-fl-pubask]').textContent)), await pB.evaluate(()=>!!document.querySelector('#wsv2Flow [data-fl-pubask]')));
ck('B1-2 sheet에 아직이에요/게시완료', await pB.evaluate(()=>!!document.querySelector('[data-fl="pubnot"]')&&!!document.querySelector('[data-fl="pubdone"]')), '');
// 게시 완료로 표시
await pB.evaluate(()=>{window.WorkspaceV2.refresh=()=>{window.__refreshed=true;};}); await pB.evaluate(()=>{var d=document.querySelector('#wsv2Flow [data-fl="pubdone"]'); if(d)d.click();}); await pB.waitForTimeout(80);
ck('B1-3 게시완료 → saveItem(published) 영속', await pB.evaluate(()=>window.__saved && window.__saved.publish && window.__saved.publish.status==='published'), '');
ck('B1-4 게시완료 → 홈 refresh 호출', await pB.evaluate(()=>window.__refreshed===true), '');
ck('B1-5 sheet 닫힘', await pB.evaluate(()=>!document.querySelector('#wsv2Flow [data-fl-pubask]')), '');
ck('B-X flow console error 0', feB.length===0, feB.slice(0,2).join(' | '));

const pass=r.filter(x=>x.p).length;
console.log('V547 QA: '+pass+'/'+r.length+' '+(pass===r.length?'PASS':'FAIL'));
r.forEach(x=>console.log('  '+(x.p?'PASS':'FAIL')+' '+x.n+(x.d?'  — '+x.d:'')));
await b.close(); process.exit(pass===r.length?0:1);
