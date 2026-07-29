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
 window.__failIdx=-1;
 window.WorkspaceAdapter={
   applyWorkspaceCorrections:o=>Promise.resolve({ok:true,dataUrl:o.src}),
   applyWorkspaceTemplate:function(o){window.__tplCalls=window.__tplCalls||[];var n=window.__tplCalls.length;window.__tplCalls.push({photoIds:(o.photos||[]).map(p=>p&&p.id)});
     if(n===window.__failIdx) return Promise.resolve({ok:false,toast:'fail'});
     return Promise.resolve({ok:true,dataUrl:'data:image/png;base64,RES_'+n,template:o.template});},
   generateCaption:o=>Promise.resolve({ok:true,caption:'본문',hashtags:['#t']}),
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
const reset=()=>pg.evaluate(()=>{window.__tplCalls=[];window.__failIdx=-1;window.__lastSave=null;});
const sixSlot=()=>({id:'six',workspaceContext:{templatePurpose:'before_after',type:'before_after'},
  photos:[{id:'b1',dataUrl:PNG,role:'before'},{id:'a1',dataUrl:PNG,role:'after'},
          {id:'b2',dataUrl:PNG,role:'before'},{id:'a2',dataUrl:PNG,role:'after'},
          {id:'b3',dataUrl:PNG,role:'before'},{id:'a3',dataUrl:PNG,role:'after'}]});

// 1) 6장(전후×3) → 결과물 3개, 각 서로 다른 페어, 같은 templateId
await reset();
await pg.evaluate(s=>window.WorkspaceFlow.open({startScreen:'edit',cat:'ba',slot:s}),sixSlot());
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'template',key:'ba'}));
await pg.waitForTimeout(400);
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'save'}));
await pg.waitForTimeout(120);
let s=await pg.evaluate(()=>window.__lastSave);
let calls=await pg.evaluate(()=>window.__tplCalls);
ck('S3-1 결과물 3개 생성', s.templateOutputs&&s.templateOutputs.length===3, JSON.stringify((s.templateOutputs||[]).length));
ck('S3-2 어댑터 3회 호출(페어별 2장씩)', calls.length===3&&calls.every(c=>c.photoIds.length===2), JSON.stringify(calls));
ck('S3-3 각 결과물 서로 다른 페어 사진', JSON.stringify(s.templateOutputs.map(o=>[o.beforePhotoId,o.afterPhotoId]))==='[["b1","a1"],["b2","a2"],["b3","a3"]]', JSON.stringify(s.templateOutputs.map(o=>[o.beforePhotoId,o.afterPhotoId])));
ck('S3-4 templateId 모두 동일(wm-ba-feed)', s.templateOutputs.every(o=>o.templateId==='wm-ba-feed'), JSON.stringify(s.templateOutputs.map(o=>o.templateId)));
ck('S3-5 outputUrl 모두 다름', new Set(s.templateOutputs.map(o=>o.outputUrl)).size===3, JSON.stringify(s.templateOutputs.map(o=>o.outputUrl)));
ck('S3-6 원본 6장 무오염(합성본 미주입)', s.photos.length===6&&s.photos.every(p=>!/RES_/.test(p.dataUrl)&&!/RES_/.test(p.editedDataUrl||'')), JSON.stringify(s.photos.map(p=>p.id)));

// 2) 실패 격리: 두번째 페어 실패 → 결과물 2개, 화면 안 깨짐
await reset();
await pg.evaluate(()=>{window.__failIdx=1;});
await pg.evaluate(s=>window.WorkspaceFlow.open({startScreen:'edit',cat:'ba',slot:s}),sixSlot());
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'template',key:'ba'}));
await pg.waitForTimeout(400);
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'save'}));
await pg.waitForTimeout(120);
let sf=await pg.evaluate(()=>window.__lastSave);
ck('S3-7 실패 페어 격리 → 결과물 2개', sf.templateOutputs&&sf.templateOutputs.length===2, JSON.stringify((sf.templateOutputs||[]).map(o=>o.pairId)));
ck('S3-8 살아남은 결과물은 성공 페어만(b1a1·b3a3)', JSON.stringify(sf.templateOutputs.map(o=>[o.beforePhotoId,o.afterPhotoId]))==='[["b1","a1"],["b3","a3"]]', JSON.stringify(sf.templateOutputs.map(o=>[o.beforePhotoId,o.afterPhotoId])));

// 3) 전/후/후 → 1 결과물 + 남은 후 원본 유지
await reset();
await pg.evaluate(png=>window.WorkspaceFlow.open({startScreen:'edit',cat:'ba',slot:{id:'p3',workspaceContext:{templatePurpose:'before_after'},
  photos:[{id:'b1',dataUrl:png,role:'before'},{id:'a1',dataUrl:png,role:'after'},{id:'a2',dataUrl:png,role:'after'}]}}),PNG);
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'template',key:'ba'}));
await pg.waitForTimeout(300);
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'save'}));
await pg.waitForTimeout(100);
let s33=await pg.evaluate(()=>window.__lastSave);
ck('S3-9 전/후/후 → 결과물 1개', s33.templateOutputs&&s33.templateOutputs.length===1, JSON.stringify((s33.templateOutputs||[]).length));
ck('S3-10 남은 후(a2) 원본 photos 유지', s33.photos.some(p=>p.id==='a2'&&!/RES_/.test(p.dataUrl)), JSON.stringify(s33.photos.map(p=>p.id)));

// 4) 해제 → 원본 복구
await reset();
await pg.evaluate(s=>window.WorkspaceFlow.open({startScreen:'edit',cat:'ba',slot:s}),sixSlot());
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'template',key:'ba'}));
await pg.waitForTimeout(400);
await pg.evaluate(()=>{var el=document.querySelector('[data-fl="tplrelease"]');if(el)el.click();});
await pg.waitForTimeout(80);
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'save'}));
await pg.waitForTimeout(100);
let sr=await pg.evaluate(()=>window.__lastSave);
ck('S3-11 해제 후 결과물 0개 + 원본 6장', sr.templateOutputs.length===0&&sr.photos.length===6&&sr.templateOutput==null, JSON.stringify({o:sr.templateOutputs.length,p:sr.photos.length}));

ck('S3-12 console/runtime error 0', errs.length===0, JSON.stringify(errs.slice(0,5)));
await b.close();
let pass=r.filter(x=>x.p).length;
console.log('STEP3 QA: '+pass+'/'+r.length+' PASS');
r.forEach(x=>console.log((x.p?'  PASS ':'  FAIL ')+x.n+(x.p?'':' :: '+x.d)));
process.exit(pass===r.length?0:1);
