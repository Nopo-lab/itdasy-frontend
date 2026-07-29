import fs from 'fs'; import path from 'path'; import { chromium } from 'playwright';
const ROOT=path.resolve('.');
const FLOW=fs.readFileSync(path.join(ROOT,'js/workspace/workspace-v2-flow.js'),'utf8');
const HOME=fs.readFileSync(path.join(ROOT,'js/workspace/workspace-v2-home.js'),'utf8');
const CSS=fs.readFileSync(path.join(ROOT,'css/workspace-v2-flow.css'),'utf8');
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF8FAGW2BPHFsbpRAAAAAElFTkSuQmCC';
const PAGE=`<!doctype html><html><head><meta charset=utf-8><style>${CSS}</style></head><body><script>
 window._uid=()=> 'id_'+Math.random().toString(36).slice(2); window.uid=window._uid; window.showToast=()=>{}; window.confirm=()=>true; window.renderScenarioSelector=(c,cb)=>{window.__scb=cb;c.innerHTML='';};
 window.__copied=null;
 window.WorkspaceAdapter={applyWorkspaceTemplate:o=>Promise.resolve({ok:true,dataUrl:'${PNG}'}),generateCaption:o=>Promise.resolve({ok:true,caption:'오늘의 시술 본문입니다.',hashtags:['#레이어드컷','#강남미용실']}),saveItem:s=>{window.__saved=JSON.parse(JSON.stringify(s));return Promise.resolve({ok:true});},copyText:t=>{window.__copied=t;},instagram:()=>({connected:false}),instagramProfile:()=>({connected:false}),recentCustomers:()=>Promise.resolve([])};
 window.Customer={search:()=>[],list:()=>Promise.resolve([])}; window.WorkspaceV2={refresh:()=>{}};
</script><script>${FLOW}</script><script>${HOME}</script></body></html>`;
const r=[]; const ck=(n,c,d)=>r.push({n,p:!!c,d:d||''});
const b=await chromium.launch(); const pg=await b.newPage(); const errs=[];
pg.on('pageerror',e=>errs.push(String(e))); pg.on('console',m=>{if(m.type()==='error'&&!/INVALID_URL/.test(m.text()))errs.push(m.text());});
await pg.setContent(PAGE,{waitUntil:'load'});
const C='#wsv2Flow [data-fs="caption"]';
await pg.evaluate(png=>window.WorkspaceFlow.open({startScreen:'caption',cat:'ba',slot:{id:'s',workspaceContext:{templatePurpose:'before_after'},photos:[{id:'b',dataUrl:png,role:'before'},{id:'a',dataUrl:png,role:'after'}]}}),PNG);
await pg.waitForTimeout(60);
// 생성
await pg.evaluate(C=>{document.querySelector(C+' [data-fl-service]').value='레이어드컷';},C);
await pg.evaluate(()=>window.__scb({axes:{situation:'시술 완성'}})); await pg.waitForTimeout(120);
ck('HE-1 본문 textarea 존재', !!(await pg.$(C+' [data-fl-capbody]')));
ck('HE-2 해시태그 편집 textarea 분리', !!(await pg.$(C+' [data-fl-caphashedit]')));
const bodyHasHash=await pg.$eval(C+' [data-fl-capbody]',e=>/#/.test(e.value)).catch(()=>false);
ck('HE-3 본문엔 해시태그 미포함(분리)', bodyHasHash===false);
const hv=await pg.$eval(C+' [data-fl-caphashedit]',e=>e.value);
ck('HE-4 해시태그칸 초기값(추천 태그)', /#레이어드컷/.test(hv)&&/#강남미용실/.test(hv), hv);
// 사용자 수동 편집: 해시태그 추가
await pg.evaluate(C=>{const t=document.querySelector(C+' [data-fl-caphashedit]');t.value='#레이어드컷 #내추럴펌 #얼굴라인';},C);
// 미리보기로 → flush 반영
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'goto',screen:'preview'}));
await pg.waitForTimeout(80);
const ighash=await pg.$eval('#wsv2Flow [data-fs="preview"] .ig-hash',e=>e.textContent).catch(()=>'');
ck('HE-5 편집 해시태그가 미리보기 반영', /#내추럴펌/.test(ighash)&&/#얼굴라인/.test(ighash)&&!/#강남미용실/.test(ighash), ighash);
// 복사 반영
await pg.evaluate(()=>{const el=document.querySelector('#wsv2Flow [data-fs="preview"] [data-fl="copycap"]'); if(el) el.click();});
await pg.waitForTimeout(40);
const cp=await pg.evaluate(()=>window.__copied);
ck('HE-6 복사 = 본문 + 빈줄 + 편집 해시태그', /오늘의 시술 본문/.test(cp)&&/#내추럴펌/.test(cp)&&/\n\n/.test(cp), cp);
// 저장 반영
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'save'})); await pg.waitForTimeout(60);
const saved=await pg.evaluate(()=>window.__saved);
ck('HE-7 저장 slot.hashtags 편집분 반영', saved&&/#내추럴펌/.test(saved.hashtags)&&/#얼굴라인/.test(saved.hashtags), saved&&saved.hashtags);
ck('HE-8 console error 0', errs.length===0, JSON.stringify(errs.slice(0,4)));
await b.close();
let pass=r.filter(x=>x.p).length;
console.log('V531 HASH-EDIT QA: '+pass+'/'+r.length+' PASS');
r.forEach(x=>console.log((x.p?'  PASS ':'  FAIL ')+x.n+(x.p?'':' :: '+x.d)));
process.exit(pass===r.length?0:1);
