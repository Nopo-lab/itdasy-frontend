import fs from 'fs'; import path from 'path'; import { chromium } from 'playwright';
const ROOT=path.resolve('.');
const FLOW=fs.readFileSync(path.join(ROOT,'js/workspace/workspace-v2-flow.js'),'utf8');
const HOME=fs.readFileSync(path.join(ROOT,'js/workspace/workspace-v2-home.js'),'utf8');
const CSS=fs.readFileSync(path.join(ROOT,'css/workspace-v2-flow.css'),'utf8');
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF8FAGW2BPHFsbpRAAAAAElFTkSuQmCC';
const PAGE=`<!doctype html><html><head><meta charset=utf-8><style>${CSS}</style></head><body><script>
 window._uid=()=> 'id_'+Math.random().toString(36).slice(2); window.uid=window._uid;
 window.showToast=()=>{}; window.confirm=()=>true; window.renderScenarioSelector=(c,cb)=>{c.innerHTML='';};
 window.WorkspaceAdapter={applyWorkspaceCorrections:o=>Promise.resolve({ok:true,dataUrl:o.src}),applyWorkspaceTemplate:o=>{window.__n=(window.__n||0)+1;return Promise.resolve({ok:true,dataUrl:'${PNG}'});},generateCaption:o=>Promise.resolve({ok:true,caption:'x',hashtags:[]}),saveItem:s=>Promise.resolve({ok:true}),instagramProfile:()=>({connected:false}),recentCustomers:()=>Promise.resolve([])};
 window.Customer={search:()=>[],list:()=>Promise.resolve([])}; window.WorkspaceV2={refresh:()=>{}};
</script><script>${FLOW}</script><script>${HOME}</script></body></html>`;
const r=[]; const ck=(n,c,d)=>r.push({n,p:!!c,d:d||''});
const b=await chromium.launch(); const pg=await b.newPage(); const errs=[];
pg.on('pageerror',e=>errs.push(String(e))); pg.on('console',m=>{if(m.type()==='error'&&!/INVALID_URL/.test(m.text()))errs.push(m.text());});
await pg.setContent(PAGE,{waitUntil:'load'});
const six={id:'six',workspaceContext:{templatePurpose:'before_after',type:'before_after'},photos:[0,1,2,3,4,5].map(i=>({id:(i%2?'a':'b')+i,dataUrl:PNG,role:i%2?'after':'before'}))};
const T='#wsv2Flow [data-ed-tpl]';
await pg.evaluate(s=>window.WorkspaceFlow.open({startScreen:'edit',cat:'ba',slot:s}),six);
// 적용 전: applied 배너 없음
ck('TX-1 적용 전 applied 배너 없음', !(await pg.$(T+' .tpl-applied')));
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'template',key:'ba'}));
await pg.waitForTimeout(400);
const banner=await pg.$eval(T+' .tpl-applied__t',e=>e.textContent.trim()).catch(()=>'');
const results=await pg.$$eval(T+' .tpl-result',e=>e.length);
const resLbls=await pg.$$eval(T+' .tpl-result__lbl',e=>e.map(x=>x.textContent.trim()));
const relTxt=await pg.$eval(T+' .tpl-applied__release',e=>e.textContent.trim()).catch(()=>'');
const chgExists=!!(await pg.$(T+' .tpl-applied__change'));
ck('TX-2 배너 "전후 템플릿 적용됨 · 결과물 3장"', /전후 템플릿 적용됨 · 결과물 3장/.test(banner), banner);
ck('TX-3 결과물 스트립 3장', results===3, 'n='+results);
ck('TX-4 결과 라벨 Pair 1/2/3 결과', JSON.stringify(resLbls)==='["Pair 1 결과","Pair 2 결과","Pair 3 결과"]', JSON.stringify(resLbls));
ck('TX-5 해제 버튼 "템플릿 해제하기"', relTxt==='템플릿 해제하기', relTxt);
ck('TX-6 "템플릿 바꾸기" 진입 존재', chgExists);
// 바꾸기 클릭 → fold 열림 유지 + 토스트(에러 없음)
await pg.click(T+' .tpl-applied__change'); await pg.waitForTimeout(50);
ck('TX-7 바꾸기 후에도 템플릿 카드 보임', (await pg.$$eval(T+' .tpl-item',e=>e.length))>0);
// 해제 → 배너 사라지고 카드만
await pg.click(T+' .tpl-applied__release'); await pg.waitForTimeout(80);
ck('TX-8 해제 후 applied 배너 없음', !(await pg.$(T+' .tpl-applied')));
ck('TX-9 해제 후 템플릿 카드 여전히 표시', (await pg.$$eval(T+' .tpl-item',e=>e.length))>0);
ck('TX-10 console error 0', errs.length===0, JSON.stringify(errs.slice(0,4)));
await b.close();
let pass=r.filter(x=>x.p).length;
console.log('V531 TPL-UX QA: '+pass+'/'+r.length+' PASS');
r.forEach(x=>console.log((x.p?'  PASS ':'  FAIL ')+x.n+(x.p?'':' :: '+x.d)));
process.exit(pass===r.length?0:1);
