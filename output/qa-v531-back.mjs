import fs from 'fs'; import path from 'path'; import { chromium } from 'playwright';
const ROOT=path.resolve('.');
const FLOW=fs.readFileSync(path.join(ROOT,'js/workspace/workspace-v2-flow.js'),'utf8');
const HOME=fs.readFileSync(path.join(ROOT,'js/workspace/workspace-v2-home.js'),'utf8');
const CSS=fs.readFileSync(path.join(ROOT,'css/workspace-v2-flow.css'),'utf8');
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF8FAGW2BPHFsbpRAAAAAElFTkSuQmCC';
const PAGE=`<!doctype html><html><head><meta charset=utf-8><style>${CSS}</style></head><body><script>
 window._uid=()=> 'id_'+Math.random().toString(36).slice(2); window.uid=window._uid; window.showToast=()=>{}; window.confirm=()=>true; window.renderScenarioSelector=(c,cb)=>{c.innerHTML='';};
 window.WorkspaceAdapter={applyWorkspaceCorrections:o=>Promise.resolve({ok:true,dataUrl:o.src}),applyWorkspaceTemplate:o=>Promise.resolve({ok:true,dataUrl:'${PNG}'}),generateCaption:o=>Promise.resolve({ok:true,caption:'생성된 본문입니다.',hashtags:['#t']}),saveItem:s=>Promise.resolve({ok:true}),instagramProfile:()=>({connected:false}),recentCustomers:()=>Promise.resolve([])};
 window.Customer={search:()=>[],list:()=>Promise.resolve([])}; window.WorkspaceV2={refresh:()=>{},close:()=>{window.__closed=true;}};
 window._registerSheet=(n,cb)=>{window.__sb=cb;}; window._markSheetOpen=()=>{};
</script><script>${FLOW}</script><script>${HOME}</script></body></html>`;
const r=[]; const ck=(n,c,d)=>r.push({n,p:!!c,d:d||''});
const b=await chromium.launch(); const pg=await b.newPage(); const errs=[];
pg.on('pageerror',e=>errs.push(String(e))); pg.on('console',m=>{if(m.type()==='error'&&!/INVALID_URL/.test(m.text()))errs.push(m.text());});
await pg.setContent(PAGE,{waitUntil:'load'});
const six={id:'six',workspaceContext:{templatePurpose:'before_after',type:'before_after'},photos:[0,1,2,3,4,5].map(i=>({id:(i%2?'a':'b')+i,dataUrl:PNG,role:i%2?'after':'before'}))};
const active=()=>pg.evaluate(()=>{const s=document.querySelector('#wsv2Flow .wsv2flow__s.active');return s?s.getAttribute('data-fs'):null;});
const isCapResult=()=>pg.evaluate(()=>!!document.querySelector('#wsv2Flow [data-fs="caption"] [data-fl-capbody]'));
const isCapInput=()=>pg.evaluate(()=>!!document.querySelector('#wsv2Flow [data-fs="caption"] [data-fl-service]'));
const pop=()=>pg.evaluate(()=>window.dispatchEvent(new PopStateEvent('popstate')));
// 편집 → 템플릿 적용 → 캡션 입력 → 생성(결과)
await pg.evaluate(s=>window.WorkspaceFlow.open({startScreen:'upload',cat:'ba',slot:s}),six); await pg.evaluate(()=>window.WorkspaceFlow.command({type:'goto',screen:'edit'})); await pg.waitForTimeout(40);
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'template',key:'ba'})); await pg.waitForTimeout(300);
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'goto',screen:'caption'})); await pg.waitForTimeout(60);
ck('BK-1 캡션 입력 화면', await isCapInput() && !(await isCapResult()));
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'caption',service:'레이어드컷 27인치'})); await pg.waitForTimeout(120);
ck('BK-2 캡션 결과 화면(생성됨)', await isCapResult(), 'active='+(await active()));
// 결과 → back → 캡션 입력
await pop(); await pg.waitForTimeout(80);
ck('BK-3 결과→back→캡션 입력(편집 아님)', (await active())==='caption' && await isCapInput() && !(await isCapResult()), 'active='+(await active()));
// 입력 → back → 편집
await pop(); await pg.waitForTimeout(80);
ck('BK-4 입력→back→편집', (await active())==='edit', 'active='+(await active()));
// 편집 → back → 업로드
await pop(); await pg.waitForTimeout(80);
ck('BK-5 편집→back→업로드', (await active())==='upload', 'active='+(await active()));
// 업로드에서 시스템 back = sheet 레지스트리가 _systemBack 호출(navStack 비면 close)
await pg.evaluate(()=>window.__sb&&window.__sb()); await pg.waitForTimeout(80);
const open1=await pg.evaluate(()=>document.querySelector('#wsv2Flow').classList.contains('is-open'));
ck('BK-6 업로드→back→플로우 닫힘(홈)', open1===false, 'is-open='+open1);
// 결과 → 고객연결 → back → 결과 유지
await pg.evaluate(s=>window.WorkspaceFlow.open({startScreen:'upload',cat:'ba',slot:s}),six); await pg.evaluate(()=>window.WorkspaceFlow.command({type:'goto',screen:'edit'})); await pg.waitForTimeout(40);
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'template',key:'ba'})); await pg.waitForTimeout(300);
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'goto',screen:'caption'})); await pg.waitForTimeout(40);
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'caption',service:'레이어드컷'})); await pg.waitForTimeout(100);
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'goto',screen:'connect'})); await pg.waitForTimeout(60);
ck('BK-7 고객 연결 화면', (await active())==='connect', 'active='+(await active()));
await pop(); await pg.waitForTimeout(80);
ck('BK-8 connect→back→캡션 결과 유지(입력 아님)', (await active())==='caption' && await isCapResult(), 'active='+(await active())+' result='+(await isCapResult()));
ck('BK-9 console error 0', errs.length===0, JSON.stringify(errs.slice(0,4)));
await b.close();
let pass=r.filter(x=>x.p).length;
console.log('V531 BACK-NAV QA: '+pass+'/'+r.length+' PASS');
r.forEach(x=>console.log((x.p?'  PASS ':'  FAIL ')+x.n+(x.p?'':' :: '+x.d)));
process.exit(pass===r.length?0:1);
