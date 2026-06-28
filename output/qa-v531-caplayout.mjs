import fs from 'fs'; import path from 'path'; import { chromium } from 'playwright';
const ROOT=path.resolve('.');
const FLOW=fs.readFileSync(path.join(ROOT,'js/workspace/workspace-v2-flow.js'),'utf8');
const HOME=fs.readFileSync(path.join(ROOT,'js/workspace/workspace-v2-home.js'),'utf8');
const CSS=fs.readFileSync(path.join(ROOT,'css/workspace-v2-flow.css'),'utf8');
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF8FAGW2BPHFsbpRAAAAAElFTkSuQmCC';
const PAGE=`<!doctype html><html><head><meta charset=utf-8><style>${CSS}</style></head><body><script>
 window._uid=()=> 'id_'+Math.random().toString(36).slice(2); window.uid=window._uid; window.__t=[]; window.showToast=m=>window.__t.push(m); window.confirm=()=>true;
 window.renderScenarioSelector=(c,cb)=>{window.__scb=cb;c.innerHTML='<button class="scbtn">시술 완성</button>';};
 window.WorkspaceAdapter={applyWorkspaceTemplate:o=>Promise.resolve({ok:true,dataUrl:'${PNG}'}),generateCaption:o=>{window.__gen=(window.__gen||0)+1;window.__lastg=JSON.parse(JSON.stringify(o));return Promise.resolve({ok:true,caption:'본문',hashtags:['#t']});},saveItem:s=>Promise.resolve({ok:true}),instagramProfile:()=>({connected:false}),recentCustomers:()=>Promise.resolve([])};
 window.Customer={search:()=>[],list:()=>Promise.resolve([])}; window.WorkspaceV2={refresh:()=>{}};
</script><script>${FLOW}</script><script>${HOME}</script></body></html>`;
const r=[]; const ck=(n,c,d)=>r.push({n,p:!!c,d:d||''});
const b=await chromium.launch(); const pg=await b.newPage(); const errs=[];
pg.on('pageerror',e=>errs.push(String(e))); pg.on('console',m=>{if(m.type()==='error'&&!/INVALID_URL/.test(m.text()))errs.push(m.text());});
await pg.setContent(PAGE,{waitUntil:'load'});
const C='#wsv2Flow [data-fs="caption"]';
await pg.evaluate(png=>window.WorkspaceFlow.open({startScreen:'caption',cat:'ba',slot:{id:'s',workspaceContext:{templatePurpose:'before_after'},photos:[{id:'b',dataUrl:png,role:'before'},{id:'a',dataUrl:png,role:'after'}]}}),PNG);
await pg.waitForTimeout(80);
// 순서: scenario 가 service 입력칸보다 앞
const order=await pg.evaluate(C=>{const sc=document.querySelector(C+' [data-fl-scenario]');const sv=document.querySelector(C+' [data-fl-service]');if(!sc||!sv)return 'missing';return (sc.compareDocumentPosition(sv)&Node.DOCUMENT_POSITION_FOLLOWING)?'scenario-before-input':'input-before-scenario';},C);
ck('CL-1 상황버튼이 입력칸보다 앞', order==='scenario-before-input', order);
ck('CL-2 "오늘 어떤 상황이에요?" 헤드', !!(await pg.$(C+' .cap-scenario-head')));
ck('CL-3 안내문 입력칸 근처(hint 존재)', /상황\(시술 완성·신규 고객 등\)을 고르면/.test(await pg.$eval(C+' .cap-field-hint',e=>e.textContent).catch(()=>'')));
// 상황만 선택(키워드 없음) → 생성 안 함
await pg.evaluate(()=>window.__scb({axes:{situation:'시술 완성'}})); await pg.waitForTimeout(60);
ck('CL-4 상황만 선택+키워드없음 → 생성 안 함', (await pg.evaluate(()=>window.__gen||0))===0, 'gen='+(await pg.evaluate(()=>window.__gen||0)));
ck('CL-5 입력 유도 토스트', (await pg.evaluate(()=>window.__t)).some(t=>/키워드를 입력/.test(t)));
// 키워드 입력 후 상황 선택 → 생성
await pg.evaluate(C=>{const i=document.querySelector(C+' [data-fl-service]');i.value='레이어드컷 27인치';},C);
await pg.evaluate(()=>window.__scb({axes:{situation:'신규 고객'}})); await pg.waitForTimeout(100);
ck('CL-6 키워드+상황 → 생성', (await pg.evaluate(()=>window.__gen||0))>=1);
ck('CL-7 생성 payload 키워드 반영', /레이어드컷 27인치/.test((await pg.evaluate(()=>window.__lastg)).photo_context||''));
// 새 입력 세션: 키워드만 + Enter → 기본 상황으로 생성
await pg.evaluate(png=>window.WorkspaceFlow.open({startScreen:'caption',cat:'ba',slot:{id:'s2',workspaceContext:{templatePurpose:'before_after'},photos:[{id:'b',dataUrl:png,role:'before'},{id:'a',dataUrl:png,role:'after'}]}}),PNG);
await pg.waitForTimeout(60);
await pg.evaluate(()=>{window.__gen=0;});
await pg.evaluate(C=>{const i=document.querySelector(C+' [data-fl-service]');i.value='젤네일 아트';i.focus();},C);
await pg.evaluate(C=>{const i=document.querySelector(C+' [data-fl-service]');i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));},C);
await pg.waitForTimeout(100);
ck('CL-8 키워드만+Enter → 생성', (await pg.evaluate(()=>window.__gen||0))>=1, 'gen='+(await pg.evaluate(()=>window.__gen||0)));
ck('CL-9 console error 0', errs.length===0, JSON.stringify(errs.slice(0,4)));
await b.close();
let pass=r.filter(x=>x.p).length;
console.log('V531 CAP-LAYOUT QA: '+pass+'/'+r.length+' PASS');
r.forEach(x=>console.log((x.p?'  PASS ':'  FAIL ')+x.n+(x.p?'':' :: '+x.d)));
process.exit(pass===r.length?0:1);
