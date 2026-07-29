import fs from 'fs'; import path from 'path'; import { chromium } from 'playwright';
const ROOT=path.resolve('.');
const FLOW=fs.readFileSync(path.join(ROOT,'js/workspace/workspace-v2-flow.js'),'utf8');
const HOME=fs.readFileSync(path.join(ROOT,'js/workspace/workspace-v2-home.js'),'utf8');
const CSS=fs.readFileSync(path.join(ROOT,'css/workspace-v2-flow.css'),'utf8');
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF8FAGW2BPHFsbpRAAAAAElFTkSuQmCC';
const PAGE=`<!doctype html><html><head><meta charset=utf-8><style>${CSS}</style></head><body>
<script>
 window._uid=function(){return 'id_'+Math.random().toString(36).slice(2);}; window.uid=window._uid;
 window.__toasts=[]; window.showToast=m=>window.__toasts.push(m); window.confirm=()=>true;
 window.renderScenarioSelector=(c,cb)=>{window.__scenarioCb=cb;c.innerHTML='<i></i>';};
 window.WorkspaceAdapter={
   applyWorkspaceCorrections:o=>Promise.resolve({ok:true,dataUrl:o.src}),
   applyWorkspaceTemplate:function(o){window.__n=(window.__n||0)+1;return Promise.resolve({ok:true,dataUrl:"${PNG}",template:o.template});},
   generateCaption:o=>{window.__lastGen=o;return Promise.resolve({ok:true,caption:'생성 본문 '+(o.service||''),hashtags:['#t']});},
   saveItem:s=>{window.__lastSave=JSON.parse(JSON.stringify(s));return Promise.resolve({ok:true});},
   instagramProfile:()=>({connected:false}), recentCustomers:()=>Promise.resolve([]),
 };
 window.Customer={search:()=>[],list:()=>Promise.resolve([])}; window.WorkspaceV2={refresh:()=>{}};
</script>
<script>${FLOW}</script><script>${HOME}</script></body></html>`;
const r=[]; const ck=(n,c,d)=>r.push({n,p:!!c,d:d||''});
const b=await chromium.launch(); const pg=await b.newPage(); const errs=[];
pg.on('pageerror',e=>errs.push(String(e))); pg.on('console',m=>{if(m.type()==='error')errs.push('con:'+m.text());});
await pg.setContent(PAGE,{waitUntil:'load'});
const CAP='#wsv2Flow [data-fs="caption"]';
const sixSlot=()=>({id:'six',workspaceContext:{templatePurpose:'before_after',type:'before_after'},
  photos:[{id:'b1',dataUrl:PNG,role:'before'},{id:'a1',dataUrl:PNG,role:'after'},
          {id:'b2',dataUrl:PNG,role:'before'},{id:'a2',dataUrl:PNG,role:'after'},
          {id:'b3',dataUrl:PNG,role:'before'},{id:'a3',dataUrl:PNG,role:'after'}]});

// 1) 6장 → 적용 → 캡션(pre-gen) → 캐러셀 3슬라이드
await pg.evaluate(s=>window.WorkspaceFlow.open({startScreen:'edit',cat:'ba',slot:s}),sixSlot());
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'template',key:'ba'}));
await pg.waitForTimeout(400);
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'goto',screen:'caption'}));
await pg.waitForTimeout(100);
const carExists=await pg.$(CAP+' [data-fl-carousel]');
const slides=await pg.$$eval(CAP+' [data-fl-carslide]',e=>e.map(x=>x.getAttribute('data-fl-carslide')));
const dots=await pg.$$(CAP+' [data-fl-cardot]');
const badge1=await pg.$eval(CAP+' .cap-car__slide.on .cap-car__badge',e=>e.textContent.trim());
ck('S4-1 캐러셀 렌더', !!carExists, String(!!carExists));
ck('S4-2 슬라이드 3개(pair-0/1/2)', JSON.stringify(slides)==='["pair-0","pair-1","pair-2"]', JSON.stringify(slides));
ck('S4-3 dot 3개', dots.length===3, String(dots.length));
ck('S4-4 첫 배지 "1 / 3 · Pair 1"', badge1==='1 / 3 · Pair 1', badge1);

// 2) next 클릭 → active 2번째
await pg.click(CAP+' [data-fl-carnav="next"]');
await pg.waitForTimeout(50);
let onId=await pg.$eval(CAP+' .cap-car__slide.on',e=>e.getAttribute('data-fl-carslide'));
let onBadge=await pg.$eval(CAP+' .cap-car__slide.on .cap-car__badge',e=>e.textContent.trim());
ck('S4-5 next→active pair-1', onId==='pair-1'&&onBadge==='2 / 3 · Pair 2', onId+' / '+onBadge);

// 3) dot 3번째 클릭 → active pair-2 + outputUrl 반영
await pg.click(CAP+' [data-fl-cardot]:nth-of-type(3)');
await pg.waitForTimeout(50);
let onId3=await pg.$eval(CAP+' .cap-car__slide.on',e=>e.getAttribute('data-fl-carslide'));
ck('S4-6 dot3→active pair-2', onId3==='pair-2', onId3);

// 4) 캡션 생성(결과 상태) → 캐러셀 여전히 상단
await pg.evaluate(()=>{var i=document.querySelector('#wsv2Flow [data-fl-service]'); if(i){i.value='레이어드컷';}});
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'caption',service:'레이어드컷'}));
await pg.waitForTimeout(150);
const carAfter=await pg.$(CAP+' [data-fl-carousel]');
const hasResult=await pg.$(CAP+' .cap-card');
ck('S4-7 생성 후에도 캐러셀 상단 유지', !!carAfter, String(!!carAfter));
ck('S4-8 결과 카드 함께 표시', !!hasResult, String(!!hasResult));
const hint=await pg.$eval(CAP+' .cap-car__hint',e=>e.textContent.trim()).catch(()=>'');
ck('S4-9 안내문 "3장의 전후 결과물..."', /3장의 전후 결과물/.test(hint), hint);

// 5) 단일 페어(전/후) → 캐러셀 없음(단일 프리뷰)
await pg.evaluate(png=>window.WorkspaceFlow.open({startScreen:'edit',cat:'ba',slot:{id:'one',workspaceContext:{templatePurpose:'before_after'},
  photos:[{id:'b1',dataUrl:png,role:'before'},{id:'a1',dataUrl:png,role:'after'}]}}),PNG);
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'template',key:'ba'}));
await pg.waitForTimeout(300);
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'goto',screen:'caption'}));
await pg.waitForTimeout(80);
const carSingle=await pg.$(CAP+' [data-fl-carousel]');
const thumbSingle=await pg.$(CAP+' .cap-photo');
ck('S4-10 단일 페어=캐러셀 없음', !carSingle, 'car='+!!carSingle);
ck('S4-11 단일 페어=단일 썸네일 표시', !!thumbSingle, 'thumb='+!!thumbSingle);

ck('S4-12 console/runtime error 0', errs.length===0, JSON.stringify(errs.slice(0,5)));
await b.close();
let pass=r.filter(x=>x.p).length;
console.log('STEP4 QA: '+pass+'/'+r.length+' PASS');
r.forEach(x=>console.log((x.p?'  PASS ':'  FAIL ')+x.n+(x.p?'':' :: '+x.d)));
process.exit(pass===r.length?0:1);
