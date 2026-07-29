// v550 QA — 편집 큰 사진 좌우 carousel(컴팩트 dot 네비 + 화살표/키보드 전환, 큰 rail 제거)
import fs from 'fs'; import path from 'path'; import { chromium } from 'playwright';
const ROOT=path.resolve('.'); const rd=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const CSS=rd('css/workspace-v2-flow.css');
const STACK=['js/photo-editor/template-fit-text.js','js/photo-editor/template-slots.js','js/photo-editor/template-pack-beauty-data.js','js/photo-editor/template-market-data.js','js/photo-editor/template-renderer-beauty-pack.js','js/photo-editor/template-renderer-beauty-pack-draws.js','js/photo-editor/template-renderer-wm-pack-draws.js','js/photo-editor/premium-templates.js','js/photo-editor/template-thumb.js','js/workspace/workspace-tpl-edit.js','js/workspace/workspace-v2-home.js','js/workspace/workspace-v2-flow.js'].map(rd).join('\n;\n');
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF8FAGW2BPHFsbpRAAAAAElFTkSuQmCC';
const r=[]; const ck=(n,c,dd)=>r.push({n,p:!!c,d:dd||''});
const PORT=process.env.QA_PORT||'8091'; const b=await chromium.launch();
const HTML=`<!doctype html><html><head><meta charset=utf-8><style>${CSS}</style></head><body><script>
 window._uid=()=>'id_'+Math.random().toString(36).slice(2); window.uid=window._uid; window.showToast=()=>{}; window.confirm=()=>true; window.renderScenarioSelector=(c)=>{c.innerHTML='';};
 window.WorkspaceAdapter={ applyWorkspaceTemplate:()=>Promise.resolve({ok:true,dataUrl:'x'}), bakeCorrections:()=>Promise.resolve({ok:true,dataUrl:'${PNG}'}), generateCaption:()=>Promise.resolve({ok:true,caption:'x',hashtags:[]}), instagram:()=>({connected:false}), instagramProfile:()=>({connected:false}), recentCustomers:()=>Promise.resolve([]), saveItem:()=>Promise.resolve({ok:true}), setCaptionTemplate:()=>Promise.resolve({ok:true}) };
 window.Customer={search:()=>[],list:()=>Promise.resolve([])}; window.WorkspaceV2={refresh:()=>{}}; window.WorkspaceDefaultTpl={get:()=>'',set:()=>true};
</script><script>${STACK}</script></body></html>`;
fs.writeFileSync(path.join(ROOT,'output/_v550qa.html'),HTML);
const fe=[]; const p=await b.newPage(); await p.setViewportSize({width:420,height:900});
p.on('pageerror',e=>fe.push(String(e))); p.on('console',m=>{if(m.type()==='error'&&!/INVALID_URL|net::|Failed to load/.test(m.text()))fe.push(m.text());});
await p.goto('http://localhost:'+PORT+'/output/_v550qa.html',{waitUntil:'load'});

// 6장 업로드 → 편집 화면
const six={id:'six',workspaceContext:{type:'multi'},photos:[0,1,2,3,4,5].map(i=>({id:'p'+i,dataUrl:PNG,role:'hero'}))};
await p.evaluate(s=>window.WorkspaceFlow.open({startScreen:'edit',cat:'multi',slot:s}),six);
await p.waitForTimeout(150);
const nav=await p.evaluate(()=>({carnav:!!document.querySelector('#wsv2Flow .ed-carnav'), oldRail:!!document.querySelector('#wsv2Flow .ed-baswitch'), dots:document.querySelectorAll('#wsv2Flow .ed-carnav__dot').length, count:(document.querySelector('#wsv2Flow .ed-carnav__count')||{}).textContent||'', arws:document.querySelectorAll('#wsv2Flow .ed-carnav__arw').length, pill:(document.querySelector('#wsv2Flow .ed-carnav__pill')||{}).textContent||'', vp:!!document.querySelector('#wsv2Flow [data-fl-edvp]')}));
ck('A-1 carousel 네비 표시', nav.carnav===true, '');
ck('A-2 기존 큰 rail(ed-baswitch) 제거', nav.oldRail===false, '');
ck('A-3 dot 6개', nav.dots===6, 'dots='+nav.dots);
ck('A-4 카운터 "1 / 6"', /1\s*\/\s*6/.test(nav.count), 'count='+nav.count);
ck('A-5 PC 화살표 2개', nav.arws===2, '');
ck('A-6 "이 사진 편집 중" pill', /편집 중/.test(nav.pill), nav.pill);
ck('A-7 큰 프리뷰(edvp) 존재', nav.vp===true, '');

// 다음 화살표 → editIdx 1 + dot/카운터 갱신
await p.evaluate(()=>{var a=document.querySelector('#wsv2Flow [data-fl-edswipe="next"]'); if(a)a.click();});
await p.waitForTimeout(220);
ck('B-1 다음 화살표 → 2번째 사진(카운터 2/6)', /2\s*\/\s*6/.test(await p.evaluate(()=>(document.querySelector('#wsv2Flow .ed-carnav__count')||{}).textContent||'')), '');
ck('B-2 active dot 2번째', await p.evaluate(()=>{var ds=document.querySelectorAll('#wsv2Flow .ed-carnav__dot'); return ds[1]&&ds[1].classList.contains('on')&&!ds[0].classList.contains('on');}), '');

// dot로 4번째 직접 점프
await p.evaluate(()=>{var ds=document.querySelectorAll('#wsv2Flow .ed-carnav__dot'); if(ds[3])ds[3].click();});
await p.waitForTimeout(220);
ck('B-3 dot 클릭 점프(4/6)', /4\s*\/\s*6/.test(await p.evaluate(()=>(document.querySelector('#wsv2Flow .ed-carnav__count')||{}).textContent||'')), '');

// 키보드 좌화살표 → 3
await p.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true})));
await p.waitForTimeout(220);
ck('B-4 키보드 ←  → 3/6', /3\s*\/\s*6/.test(await p.evaluate(()=>(document.querySelector('#wsv2Flow .ed-carnav__count')||{}).textContent||'')), '');

// 1장 업로드 → 네비 없음
await p.evaluate(s=>window.WorkspaceFlow.open({startScreen:'edit',cat:'multi',slot:s}),{id:'one',workspaceContext:{type:'multi'},photos:[{id:'o',dataUrl:PNG,role:'hero'}]});
await p.waitForTimeout(120);
ck('C-1 1장 업로드 → carousel 네비 없음(단일)', await p.evaluate(()=>!document.querySelector('#wsv2Flow .ed-carnav')), '');
ck('C-2 1장도 큰 프리뷰 정상', await p.evaluate(()=>!!document.querySelector('#wsv2Flow [data-fl-edvp]')), '');

// 2장 전후 → 좌우 전환 가능
await p.evaluate(s=>window.WorkspaceFlow.open({startScreen:'edit',cat:'ba',slot:s}),{id:'ba',workspaceContext:{templatePurpose:'before_after',type:'before_after'},photos:[{id:'bf',dataUrl:PNG,role:'before'},{id:'af',dataUrl:PNG,role:'after'}]});
await p.waitForTimeout(120);
ck('C-3 2장 전후 → dot 2개 + 전/후 라벨', await p.evaluate(()=>{var n=document.querySelectorAll('#wsv2Flow .ed-carnav__dot').length; var pill=(document.querySelector('#wsv2Flow .ed-carnav__pill')||{}).textContent||''; return n===2&&/전 사진|후 사진/.test(pill);}), '');
ck('X-1 console error 0', fe.length===0, fe.slice(0,3).join(' | '));

const pass=r.filter(x=>x.p).length;
console.log('V550 QA: '+pass+'/'+r.length+' '+(pass===r.length?'PASS':'FAIL'));
r.forEach(x=>console.log('  '+(x.p?'PASS':'FAIL')+' '+x.n+(x.d?'  — '+x.d:'')));
await b.close(); process.exit(pass===r.length?0:1);
