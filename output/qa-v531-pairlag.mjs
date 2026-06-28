import fs from 'fs'; import path from 'path'; import { chromium } from 'playwright';
const ROOT=path.resolve('.');
const FLOW=fs.readFileSync(path.join(ROOT,'js/workspace/workspace-v2-flow.js'),'utf8');
const HOME=fs.readFileSync(path.join(ROOT,'js/workspace/workspace-v2-home.js'),'utf8');
const CSS=fs.readFileSync(path.join(ROOT,'css/workspace-v2-flow.css'),'utf8');
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF8FAGW2BPHFsbpRAAAAAElFTkSuQmCC';
const PAGE=`<!doctype html><html><head><meta charset=utf-8><style>${CSS}</style></head><body><script>
 window._uid=()=> 'id_'+Math.random().toString(36).slice(2); window.uid=window._uid;
 window.showToast=m=>{window.__t=(window.__t||[]);window.__t.push(m);}; window.confirm=()=>true; window.renderScenarioSelector=(c,cb)=>{c.innerHTML='';};
 window.WorkspaceAdapter={applyWorkspaceTemplate:o=>Promise.resolve({ok:true,dataUrl:'${PNG}'}),generateCaption:o=>Promise.resolve({ok:true,caption:'x',hashtags:[]}),saveItem:s=>Promise.resolve({ok:true}),instagramProfile:()=>({connected:false}),recentCustomers:()=>Promise.resolve([])};
 window.Customer={search:()=>[],list:()=>Promise.resolve([])}; window.WorkspaceV2={refresh:()=>{}};
</script><script>${FLOW}</script><script>${HOME}</script></body></html>`;
const r=[]; const ck=(n,c,d)=>r.push({n,p:!!c,d:d||''});
const b=await chromium.launch(); const pg=await b.newPage(); const errs=[];
pg.on('pageerror',e=>errs.push(String(e))); pg.on('console',m=>{if(m.type()==='error'&&!/INVALID_URL/.test(m.text()))errs.push(m.text());});
await pg.setContent(PAGE,{waitUntil:'load'});
await pg.evaluate(png=>window.WorkspaceFlow.open({startScreen:'upload',cat:'ba',slot:{id:'six',photos:[0,1,2,3,4,5].map(i=>({id:'p'+i,dataUrl:png,role:'hero'}))}}),PNG);
const U='#wsv2Flow [data-fs="upload"]';
// 타일 DOM 보존 확인용 마커
await pg.evaluate(u=>{document.querySelectorAll(u+' [data-fl-tile]').forEach((t,i)=>t.__mark='m'+i);},U);
// 전/후/전/후/후/전 연타(빠르게)
const seq=[[0,'before'],[1,'after'],[2,'before'],[3,'after'],[4,'after'],[5,'before']];
for(const [i,role] of seq){ await pg.click(`${U} [data-fl-setrole="${i}:${role}"]`); }
await pg.waitForTimeout(60);
const pairRows=await pg.$$eval(`${U} .up-pair:not(.up-pair--left)`,e=>e.length);
const leftRows=await pg.$$eval(`${U} .up-pair--left`,e=>e.length);
const pairNums=await pg.$$eval(`${U} .up-pair__n`,e=>e.map(x=>x.textContent));
const summary=await pg.$eval(`${U} .up-summary`,e=>e.textContent);
// 타일 DOM 보존(마커 유지 = 전체 재렌더 안함)
const marksKept=await pg.evaluate(u=>{const ts=document.querySelectorAll(u+' [data-fl-tile]');let ok=0;ts.forEach((t,i)=>{if(t.__mark==='m'+i)ok++;});return ok;},U);
ck('LP-1 전/후/전/후/후/전 → Pair 3개', pairRows===3, 'rows='+pairRows);
ck('LP-2 leftover 0(Pair 4 오표시 없음)', leftRows===0, 'left='+leftRows);
ck('LP-3 라벨 Pair 1/2/3', JSON.stringify(pairNums)==='["Pair 1","Pair 2","Pair 3"]', JSON.stringify(pairNums));
ck('LP-4 요약 전후쌍 3', /전후쌍\s*3/.test(summary.replace(/\s/g,' ')), summary);
ck('LP-5 타일 DOM 보존(전체 재렌더 안함)', marksKept===6, 'kept='+marksKept+'/6');
// 추가 케이스
async function setRoles(roles){ // roles: array len = photos
  await pg.evaluate(png=>window.WorkspaceFlow.open({startScreen:'upload',cat:'ba',slot:{id:'s',photos:roles0.map((_,i)=>({id:'p'+i,dataUrl:png,role:'hero'}))}}),PNG);
}
// 전/전/후/후 → 2
await pg.evaluate(png=>window.WorkspaceFlow.open({startScreen:'upload',cat:'ba',slot:{id:'s4',photos:[0,1,2,3].map(i=>({id:'q'+i,dataUrl:png,role:'hero'}))}}),PNG);
for(const [i,role] of [[0,'before'],[1,'before'],[2,'after'],[3,'after']]) await pg.click(`${U} [data-fl-setrole="${i}:${role}"]`);
await pg.waitForTimeout(40);
ck('LP-6 전/전/후/후 → Pair 2', (await pg.$$eval(`${U} .up-pair:not(.up-pair--left)`,e=>e.length))===2);
// 전/전/전/후 → 1 + 남은전 2
await pg.evaluate(png=>window.WorkspaceFlow.open({startScreen:'upload',cat:'ba',slot:{id:'s5',photos:[0,1,2,3].map(i=>({id:'w'+i,dataUrl:png,role:'hero'}))}}),PNG);
for(const [i,role] of [[0,'before'],[1,'before'],[2,'before'],[3,'after']]) await pg.click(`${U} [data-fl-setrole="${i}:${role}"]`);
await pg.waitForTimeout(40);
ck('LP-7 전/전/전/후 → Pair 1 + leftover 2', (await pg.$$eval(`${U} .up-pair:not(.up-pair--left)`,e=>e.length))===1 && (await pg.$$eval(`${U} .up-pair--left`,e=>e.length))===2);
ck('LP-8 console error 0', errs.length===0, JSON.stringify(errs.slice(0,4)));
await b.close();
let pass=r.filter(x=>x.p).length;
console.log('V531 PAIR/LAG QA: '+pass+'/'+r.length+' PASS');
r.forEach(x=>console.log((x.p?'  PASS ':'  FAIL ')+x.n+(x.p?'':' :: '+x.d)));
process.exit(pass===r.length?0:1);
