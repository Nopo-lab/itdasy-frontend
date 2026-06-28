import fs from 'fs'; import path from 'path'; import { chromium } from 'playwright';
const ROOT=path.resolve('.');
const FLOW=fs.readFileSync(path.join(ROOT,'js/workspace/workspace-v2-flow.js'),'utf8');
const HOME=fs.readFileSync(path.join(ROOT,'js/workspace/workspace-v2-home.js'),'utf8');
const STATE=fs.readFileSync(path.join(ROOT,'js/workspace/workspace-state.js'),'utf8');
const CSS=fs.readFileSync(path.join(ROOT,'css/workspace-v2-flow.css'),'utf8');
const CSS2=fs.readFileSync(path.join(ROOT,'css/workspace-v2.css'),'utf8');
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF8FAGW2BPHFsbpRAAAAAElFTkSuQmCC';
const PAGE=`<!doctype html><html><head><meta charset=utf-8><style>${CSS2}${CSS}</style></head><body><div id="homeRoot"></div><script>
 window._uid=()=> 'id_'+Math.random().toString(36).slice(2); window.uid=window._uid; window.__t=[]; window.showToast=m=>window.__t.push(m); window.confirm=()=>true; window.renderScenarioSelector=(c,cb)=>{c.innerHTML='';};
 window.PhotoEditorTemplateThumb={make:(tpl,o)=>'${PNG}#'+(tpl&&tpl.id)};
 window.WorkspaceAdapter={applyWorkspaceTemplate:o=>Promise.resolve({ok:true,dataUrl:'${PNG}'}),generateCaption:o=>Promise.resolve({ok:true,caption:'x',hashtags:[]}),saveItem:s=>Promise.resolve({ok:true}),instagram:()=>({connected:false}),instagramProfile:()=>({connected:false}),recentCustomers:()=>Promise.resolve([]),openPriceList:()=>{}};
 window.Customer={search:()=>[],list:()=>Promise.resolve([])};
</script><script>${STATE}</script><script>${FLOW}</script><script>${HOME}</script></body></html>`;
fs.writeFileSync(path.join(ROOT,'output/_t17.html'),PAGE);
const r=[]; const ck=(n,c,d)=>r.push({n,p:!!c,d:d||''});
const b=await chromium.launch(); const pg=await b.newPage(); const errs=[];
pg.on('pageerror',e=>errs.push(String(e))); pg.on('console',m=>{if(m.type()==='error'&&!/INVALID_URL|net::ERR/.test(m.text()))errs.push(m.text());});
await pg.goto('file://'+path.join(ROOT,'output/_t17.html'),{waitUntil:'load'});
await pg.evaluate(()=>{try{localStorage.clear();}catch(e){}});

// ===== Part A: flow 편집 폴드 기본 템플릿 =====
const T='#wsv2Flow [data-ed-tpl]';
const six={id:'six',workspaceContext:{templatePurpose:'before_after',type:'before_after'},photos:[0,1,2,3,4,5].map(i=>({id:(i%2?'a':'b')+i,dataUrl:PNG,role:i%2?'after':'before'}))};
await pg.evaluate(s=>window.WorkspaceFlow.open({startScreen:'edit',cat:'ba',slot:s}),six);
await pg.waitForTimeout(60);
ck('DT-1 "기본 템플릿 적용하기" 버튼(미적용시)', !!(await pg.$(T+' [data-fl="applydefault"]')));
ck('DT-2 각 카드 "기본으로 설정" 버튼', (await pg.$$eval(T+' [data-fl-setdefault]',e=>e.length))>0);
// 기본 없을 때 적용 → 안내 토스트
await pg.click(T+' [data-fl="applydefault"]'); await pg.waitForTimeout(40);
ck('DT-3 기본 없음 → 안내 토스트', (await pg.evaluate(()=>window.__t)).some(t=>/아직 기본 템플릿이 없어요/.test(t)));
// 전후 카드 기본 설정
await pg.evaluate(T=>{const el=document.querySelector(T+' [data-fl-setdefault="ba"]'); if(el) el.click();},T); await pg.waitForTimeout(60);
const lsDef=await pg.evaluate(()=>{try{return localStorage.getItem('itdasy:wsv2_default_tpl_ba');}catch(e){return null;}});
ck('DT-4 기본 설정 localStorage 저장', lsDef==='wm-ba-feed', String(lsDef));
ck('DT-5 기본 배지 표시', (await pg.$$eval(T+' .tpl-defbadge',e=>e.length))>0);
ck('DT-6 설정 토스트', (await pg.evaluate(()=>window.__t)).some(t=>/기본 템플릿으로 설정/.test(t)));
// 기본 적용 → templateOutputs 생성
await pg.click(T+' [data-fl="applydefault"]'); await pg.waitForTimeout(350);
const applied=await pg.$(T+' .tpl-applied');
ck('DT-7 기본 적용하기 → 적용됨', !!applied);

// ===== Part B: 홈 카드 실제 템플릿 preview =====
await pg.evaluate(()=>{window.WorkspaceV2 && window.WorkspaceV2.render(document.getElementById('homeRoot'), {slots:[]});});
await pg.waitForTimeout(60);
const H='#homeRoot';
const catImgs=await pg.$$eval(H+' .wsv2-cat img',e=>e.length).catch(()=>0);
const catBg=await pg.$$eval(H+' .wsv2-cat .wsv2-cat__thumb',e=>e.map(x=>x.getAttribute('style')||''));
ck('DT-8 홈 카드에 업로드/예시 img 미사용', catImgs===0, 'imgs='+catImgs);
ck('DT-9 홈 카드 썸네일=템플릿 preview(background-image)', catBg.some(s=>/background-image:url\(data:/.test(s)), JSON.stringify(catBg.slice(0,2)));
ck('DT-10 전후 카드 기본 배지(기본 설정됨)', (await pg.$$eval(H+' .wsv2-cat[data-wsv2-cat="ba"] .wsv2-cat__defbadge',e=>e.length))>0);
ck('DT-11 console error 0', errs.length===0, JSON.stringify(errs.slice(0,4)));
await b.close();
let pass=r.filter(x=>x.p).length;
console.log('V531 DEFAULT-TPL QA: '+pass+'/'+r.length+' PASS');
r.forEach(x=>console.log((x.p?'  PASS ':'  FAIL ')+x.n+(x.p?'':' :: '+x.d)));
process.exit(pass===r.length?0:1);
