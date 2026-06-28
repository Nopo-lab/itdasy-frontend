import fs from 'fs'; import path from 'path'; import { chromium } from 'playwright';
const ROOT=path.resolve('.');
const FLOW=fs.readFileSync(path.join(ROOT,'js/workspace/workspace-v2-flow.js'),'utf8');
const HOME=fs.readFileSync(path.join(ROOT,'js/workspace/workspace-v2-home.js'),'utf8');
const CSS=fs.readFileSync(path.join(ROOT,'css/workspace-v2-flow.css'),'utf8');
const TOK=fs.readFileSync(path.join(ROOT,'css/tokens.css'),'utf8');
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF8FAGW2BPHFsbpRAAAAAElFTkSuQmCC';
const PAGE=`<!doctype html><html><head><meta charset=utf-8><style>${TOK}${CSS}
 body{margin:0} #wsv2Flow{position:static!important;transform:none!important;inset:auto!important;width:390px;height:760px;overflow:auto;display:block!important}</style></head><body><script>
 window._uid=()=> 'id_'+Math.random().toString(36).slice(2); window.uid=window._uid;
 window.showToast=()=>{}; window.confirm=()=>true; window.renderScenarioSelector=(c,cb)=>{window.__cb=cb;c.innerHTML='';};
 window.WorkspaceAdapter={applyWorkspaceCorrections:o=>Promise.resolve({ok:true,dataUrl:o.src}),applyWorkspaceTemplate:o=>Promise.resolve({ok:true,dataUrl:'${PNG}'}),generateCaption:o=>Promise.resolve({ok:true,caption:'본문',hashtags:['#t']}),saveItem:s=>Promise.resolve({ok:true}),instagramProfile:()=>({connected:false}),recentCustomers:()=>Promise.resolve([])};
 window.Customer={search:()=>[],list:()=>Promise.resolve([])}; window.WorkspaceV2={refresh:()=>{}};
</script><script>${FLOW}</script><script>${HOME}</script></body></html>`;
const r=[]; const ck=(n,c,d)=>r.push({n,p:!!c,d:d||''});
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:390,height:760}}); const errs=[];
pg.on('pageerror',e=>errs.push(String(e))); pg.on('console',m=>{if(m.type()==='error'&&!/INVALID_URL/.test(m.text()))errs.push(m.text());});
await pg.setContent(PAGE,{waitUntil:'load'});
const six={id:'six',workspaceContext:{templatePurpose:'before_after',type:'before_after'},photos:[0,1,2,3,4,5].map(i=>({id:(i%2?'a':'b')+i,dataUrl:PNG,role:i%2?'after':'before'}))};
await pg.evaluate(s=>window.WorkspaceFlow.open({startScreen:'edit',cat:'ba',slot:s}),six);
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'template',key:'ba'}));
await pg.waitForTimeout(300);
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'goto',screen:'caption'}));
await pg.waitForTimeout(150);
const C='#wsv2Flow [data-fs="caption"]';
const track=await pg.$(C+' [data-fl-cartrack]');
const slides=await pg.$$eval(C+' [data-fl-carslide]',e=>e.map(x=>x.getAttribute('data-fl-carslide')));
const dots=await pg.$$eval(C+' [data-fl-cardot]',e=>e.length);
const cw=await pg.$eval(C+' [data-fl-cartrack]',e=>e.clientWidth).catch(()=>0);
ck('SW-1 track + 슬라이드 3개', !!track && JSON.stringify(slides)==='["pair-0","pair-1","pair-2"]', JSON.stringify(slides));
ck('SW-2 dot 3개', dots===3, 'n='+dots);
ck('SW-3 track 레이아웃 폭>0(스와이프 가능)', cw>0, 'cw='+cw);
// 스와이프 시뮬: scrollLeft = 2*clientWidth → scroll 이벤트 → active dot 3
await pg.evaluate(C=>{const t=document.querySelector(C+' [data-fl-cartrack]');t.scrollLeft=2*t.clientWidth;t.dispatchEvent(new Event('scroll'));},C);
await pg.waitForTimeout(80);
const onDotIdx=await pg.evaluate(C=>{const ds=[...document.querySelectorAll(C+' [data-fl-cardot]')];return ds.findIndex(d=>d.classList.contains('on'));},C);
ck('SW-4 스와이프(scrollLeft) → 3번째 dot active', onDotIdx===2, 'onIdx='+onDotIdx);
// dot 1 클릭 → scrollLeft 0 근처 + active dot 1
await pg.evaluate(C=>document.querySelector(C+' [data-fl-cardot]').click(),C);
await pg.waitForTimeout(120);
const onDot1=await pg.evaluate(C=>{const ds=[...document.querySelectorAll(C+' [data-fl-cardot]')];return ds.findIndex(d=>d.classList.contains('on'));},C);
ck('SW-5 dot1 클릭 → 1번째 active', onDot1===0, 'onIdx='+onDot1);
// 슬라이드가 가로로 배치(첫 두 슬라이드 offsetLeft 다름 = scroll 배치)
const layout=await pg.evaluate(C=>{const s=[...document.querySelectorAll(C+' [data-fl-carslide]')];return s.length>=2?[s[0].offsetLeft,s[1].offsetLeft]:[0,0];},C);
ck('SW-6 슬라이드 가로 배치(snap)', layout[1]>layout[0], JSON.stringify(layout));
ck('SW-7 화살표(nav) 제거됨', (await pg.$$eval(C+' .cap-car__nav',e=>e.length))===0);
ck('SW-8 console error 0', errs.length===0, JSON.stringify(errs.slice(0,4)));
await b.close();
let pass=r.filter(x=>x.p).length;
console.log('V531 SWIPE QA: '+pass+'/'+r.length+' PASS');
r.forEach(x=>console.log((x.p?'  PASS ':'  FAIL ')+x.n+(x.p?'':' :: '+x.d)));
process.exit(pass===r.length?0:1);
