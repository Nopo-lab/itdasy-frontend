import fs from 'fs'; import path from 'path'; import { chromium } from 'playwright';
const ROOT = path.resolve('.');
const FLOW = fs.readFileSync(path.join(ROOT,'js/workspace/workspace-v2-flow.js'),'utf8');
const HOME = fs.readFileSync(path.join(ROOT,'js/workspace/workspace-v2-home.js'),'utf8');
const CSS  = fs.readFileSync(path.join(ROOT,'css/workspace-v2-flow.css'),'utf8');
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF8FAGW2BPHFsbpRAAAAAElFTkSuQmCC';
const PAGE=`<!doctype html><html><head><meta charset=utf-8><style>${CSS}</style></head><body>
<script>
 window._uid=function(){return 'id_'+Math.random().toString(36).slice(2);};
 window.uid=window._uid; window.__toasts=[]; window.showToast=function(m){window.__toasts.push(m);};
 window.confirm=function(){return true;};
 window.renderScenarioSelector=function(c,cb){window.__scenarioCb=cb;c.innerHTML='<i></i>';};
 window.WorkspaceAdapter={
   applyWorkspaceCorrections:o=>Promise.resolve({ok:true,dataUrl:o.src}),
   applyWorkspaceTemplate:function(o){window.__tplCalls=(window.__tplCalls||[]);window.__tplCalls.push(o);
     return Promise.resolve({ok:true,dataUrl:'data:image/png;base64,RESULT_'+window.__tplCalls.length,template:o.template});},
   generateCaption:o=>Promise.resolve({ok:true,caption:'본문',hashtags:['#t']}),
   saveItem:function(s){window.__lastSave=JSON.parse(JSON.stringify(s));return Promise.resolve({ok:true});},
   instagramProfile:()=>({connected:false}), recentCustomers:()=>Promise.resolve([]),
 };
 window.Customer={search:()=>[],list:()=>Promise.resolve([])};
 window.WorkspaceV2={refresh:function(){}};
</script>
<script>${FLOW}</script><script>${HOME}</script>
</body></html>`;
const r=[]; const ck=(n,c,d)=>r.push({n,p:!!c,d:d||''});
const b=await chromium.launch(); const pg=await b.newPage(); const errs=[];
pg.on('pageerror',e=>errs.push(String(e))); pg.on('console',m=>{if(m.type()==='error')errs.push('con:'+m.text());});
await pg.setContent(PAGE,{waitUntil:'load'});
const baSlot=(id)=>({id,workspaceContext:{templatePurpose:'before_after',type:'before_after'},
  photos:[{id:'b1',dataUrl:PNG,role:'before'},{id:'a1',dataUrl:PNG,role:'after'}]});

// 1) 전/후 2장 → 템플릿 적용 → save → 단일 결과물 미러
await pg.evaluate(s=>window.WorkspaceFlow.open({startScreen:'edit',cat:'ba',slot:s}),baSlot('s1'));
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'template',key:'ba'}));
await pg.waitForTimeout(300);
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'save'}));
await pg.waitForTimeout(100);
let s=await pg.evaluate(()=>window.__lastSave);
ck('S2-1 templateOutputs 배열 생성(len=1)', s.templateOutputs&&s.templateOutputs.length===1, JSON.stringify(s.templateOutputs));
ck('S2-2 templateOutput 미러==outputs[0].outputUrl', s.templateOutput===(s.templateOutputs[0]||{}).outputUrl, s.templateOutput);
ck('S2-3 output 스키마(pairId/templateId/outputUrl)', s.templateOutputs[0].pairId==='pair-0'&&!!s.templateOutputs[0].templateId&&/RESULT_/.test(s.templateOutputs[0].outputUrl), JSON.stringify(s.templateOutputs[0]));
ck('S2-4 원본 사진 무오염', s.photos.every(p=>!/RESULT_/.test(p.dataUrl)&&!/RESULT_/.test(p.editedDataUrl||'')), JSON.stringify(s.photos.map(p=>p.id)));

// 2) 새 세션: 적용 → 해제 → save (해제는 close 전에)
await pg.evaluate(s=>window.WorkspaceFlow.open({startScreen:'edit',cat:'ba',slot:s}),baSlot('s2'));
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'template',key:'ba'}));
await pg.waitForTimeout(300);
const relHit=await pg.evaluate(()=>{var el=document.querySelector('[data-fl="tplrelease"]'); if(el){el.click();return true;} return false;});
await pg.waitForTimeout(80);
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'save'}));
await pg.waitForTimeout(80);
let s2=await pg.evaluate(()=>window.__lastSave);
ck('S2-5 해제버튼 존재+클릭됨', relHit===true, 'relHit='+relHit);
ck('S2-6 해제 후 templateOutputs 빈 배열', Array.isArray(s2.templateOutputs)&&s2.templateOutputs.length===0, JSON.stringify(s2.templateOutputs));
ck('S2-7 해제 후 templateOutput null', s2.templateOutput==null, String(s2.templateOutput));

// 3) 구 슬롯 hydrate
await pg.evaluate(png=>window.WorkspaceFlow.open({startScreen:'caption',cat:'ba',slot:{id:'old',templateOutput:'data:image/png;base64,LEGACY',
  workspaceContext:{templatePurpose:'before_after',templateId:'wm-ba-feed',templateLabel:'전후 비교'},
  photos:[{id:'b1',dataUrl:png,role:'before'},{id:'a1',dataUrl:png,role:'after'}]}}),PNG);
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'save'}));
await pg.waitForTimeout(80);
let s3=await pg.evaluate(()=>window.__lastSave);
ck('S2-8 구슬롯 hydrate→templateOutputs 1개', s3.templateOutputs&&s3.templateOutputs.length===1&&s3.templateOutputs[0].outputUrl==='data:image/png;base64,LEGACY', JSON.stringify(s3.templateOutputs));
ck('S2-9 구슬롯 templateOutput 미러 유지', s3.templateOutput==='data:image/png;base64,LEGACY', String(s3.templateOutput));
ck('S2-10 console/runtime error 0', errs.length===0, JSON.stringify(errs.slice(0,5)));
await b.close();
let pass=r.filter(x=>x.p).length;
console.log('STEP2 QA: '+pass+'/'+r.length+' PASS');
r.forEach(x=>console.log((x.p?'  PASS ':'  FAIL ')+x.n+(x.p?'':' :: '+x.d)));
process.exit(pass===r.length?0:1);
