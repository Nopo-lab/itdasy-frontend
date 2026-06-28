import fs from 'fs'; import path from 'path'; import { chromium } from 'playwright';
const ROOT=path.resolve('.');
const FLOW=fs.readFileSync(path.join(ROOT,'js/workspace/workspace-v2-flow.js'),'utf8');
const HOME=fs.readFileSync(path.join(ROOT,'js/workspace/workspace-v2-home.js'),'utf8');
const CSS=fs.readFileSync(path.join(ROOT,'css/workspace-v2-flow.css'),'utf8');
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF8FAGW2BPHFsbpRAAAAAElFTkSuQmCC';
const PAGE=`<!doctype html><html><head><meta charset=utf-8><style>${CSS}</style></head><body><script>
 window._uid=()=> 'id_'+Math.random().toString(36).slice(2); window.uid=window._uid;
 window.showToast=()=>{}; window.confirm=()=>true; window.renderScenarioSelector=(c,cb)=>{c.innerHTML='';};
 window.WorkspaceAdapter={applyWorkspaceTemplate:o=>Promise.resolve({ok:true,dataUrl:'${PNG}'}),generateCaption:o=>Promise.resolve({ok:true,caption:'x',hashtags:[]}),saveItem:s=>Promise.resolve({ok:true}),instagramProfile:()=>({connected:false}),recentCustomers:()=>Promise.resolve([])};
 window.Customer={search:()=>[],list:()=>Promise.resolve([])}; window.WorkspaceV2={refresh:()=>{}};
</script><script>${FLOW}</script><script>${HOME}</script></body></html>`;
const b=await chromium.launch(); const pg=await b.newPage(); const errs=[];
pg.on('pageerror',e=>errs.push(String(e))); pg.on('console',m=>{if(m.type()==='error'&&!/INVALID_URL/.test(m.text()))errs.push(m.text());});
await pg.setContent(PAGE,{waitUntil:'load'});
// 6장을 hero(역할 미지정)로 열기 → 사용자가 직접 탭하는 상황 모사
await pg.evaluate(png=>window.WorkspaceFlow.open({startScreen:'upload',cat:'ba',slot:{id:'six',photos:[0,1,2,3,4,5].map(i=>({id:'p'+i,dataUrl:png,role:'hero'}))}}),PNG);
// 자동배치 후 초기 상태
const t=async()=>await pg.$$eval('#wsv2Flow [data-fs="upload"] [data-fl-setrole].on',e=>e.map(x=>x.getAttribute('data-fl-setrole')));
console.log('초기 역할(on):', JSON.stringify(await t()));
// 전/후/전/후/후/전 시퀀스로 클릭: p0=before,p1=after,p2=before,p3=after,p4=after,p5=before
const seq=[[0,'before'],[1,'after'],[2,'before'],[3,'after'],[4,'after'],[5,'before']];
for(const [i,r] of seq){ await pg.click(`#wsv2Flow [data-fs="upload"] [data-fl-setrole="${i}:${r}"]`); await pg.waitForTimeout(20); }
// pair 표시 + 요약
const pairHead=await pg.$eval('#wsv2Flow [data-fs="upload"] .up-pairs__head',e=>e.textContent).catch(()=>'(none)');
const pairRows=await pg.$$eval('#wsv2Flow [data-fs="upload"] .up-pair:not(.up-pair--left)',e=>e.length);
const leftRows=await pg.$$eval('#wsv2Flow [data-fs="upload"] .up-pair--left',e=>e.length);
const pairNums=await pg.$$eval('#wsv2Flow [data-fs="upload"] .up-pair__n',e=>e.map(x=>x.textContent));
const summary=await pg.$eval('#wsv2Flow [data-fs="upload"] .up-summary',e=>e.textContent).catch(()=>'(none)');
const roles=await pg.evaluate(()=>window.WorkspaceFlow.__dbg?window.WorkspaceFlow.__dbg():null);
console.log('pair head:', pairHead);
console.log('pair rows(완성):', pairRows, '/ leftover rows:', leftRows);
console.log('pair labels:', JSON.stringify(pairNums));
console.log('summary:', summary);
console.log('errors:', errs.length, JSON.stringify(errs.slice(0,3)));
await b.close();
