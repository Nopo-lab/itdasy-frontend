// v541 QA — 썸네일 검은제목 제거 + long press 확대 미리보기 + 적용결과 큰 캐러셀
import fs from 'fs'; import path from 'path'; import { chromium } from 'playwright';
const ROOT = path.resolve('.');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const CSS = rd('css/workspace-v2-flow.css');
const STACK = [
  'js/photo-editor/template-fit-text.js','js/photo-editor/template-slots.js','js/photo-editor/template-pack-beauty-data.js',
  'js/photo-editor/template-market-data.js','js/photo-editor/template-renderer-beauty-pack.js','js/photo-editor/template-renderer-beauty-pack-draws.js',
  'js/photo-editor/template-renderer-wm-pack-draws.js','js/photo-editor/premium-templates.js','js/photo-editor/template-thumb.js',
  'js/workspace/workspace-tpl-edit.js','js/workspace/workspace-v2-home.js','js/workspace/workspace-v2-flow.js',
].map(rd).join('\n;\n');
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF8FAGW2BPHFsbpRAAAAAElFTkSuQmCC';
const r=[]; const ck=(n,c,dd)=>r.push({n,p:!!c,d:dd||''});
const b=await chromium.launch();
const HTML=`<!doctype html><html><head><meta charset=utf-8><style>${CSS}</style></head><body><script>
 window._uid=()=>'id_'+Math.random().toString(36).slice(2); window.uid=window._uid; window.showToast=(m)=>{window.__toast=m;}; window.confirm=()=>true;
 window.renderScenarioSelector=(c)=>{c.innerHTML='';};
 var _ai=0;
 window.WorkspaceAdapter={ applyWorkspaceTemplate:function(o){ _ai++; return Promise.resolve({ok:true,dataUrl:'data:img/'+_ai}); },
   generateCaption:()=>Promise.resolve({ok:true,caption:'x',hashtags:[]}), instagram:()=>({connected:false}), instagramProfile:()=>({connected:false}), recentCustomers:()=>Promise.resolve([]), saveItem:()=>Promise.resolve({ok:true}), setCaptionTemplate:()=>Promise.resolve({ok:true}) };
 window.Customer={search:()=>[],list:()=>Promise.resolve([])}; window.WorkspaceV2={refresh:()=>{}};
 window.WorkspaceDefaultTpl={get:()=>'',set:()=>true};
</script><script>${STACK}</script></body></html>`;
fs.writeFileSync(path.join(ROOT,'output/_v541qa.html'),HTML);
const PORT=process.env.QA_PORT||'8091';
const fe=[]; const p=await b.newPage(); await p.setViewportSize({width:420,height:900});
p.on('pageerror',e=>fe.push(String(e)));
p.on('console',m=>{ if(m.type()==='error'&&!/INVALID_URL|net::|Failed to load/.test(m.text())) fe.push(m.text()); });
await p.goto('http://localhost:'+PORT+'/output/_v541qa.html',{waitUntil:'load'});
const six={id:'six',workspaceContext:{templatePurpose:'before_after',type:'before_after'},photos:[0,1,2,3,4,5].map(i=>({id:(i%2?'a':'b')+i,dataUrl:PNG,role:i%2?'after':'before'}))};
await p.evaluate(s=>window.WorkspaceFlow.open({startScreen:'edit',cat:'ba',slot:s}),six);
await p.waitForTimeout(150);

// ── 1) 검은 제목 오버레이 제거 ──
const thumbs=await p.evaluate(()=>({ count:document.querySelectorAll('#wsv2Flow .tpl-item').length, hasTitleSpan:!!document.querySelector('#wsv2Flow .tpl-item > span'), hasAria:!!document.querySelector('#wsv2Flow .tpl-item[aria-label]') }));
ck('T-1 전후 템플릿 썸네일 6종 노출', thumbs.count===6, 'count='+thumbs.count);
ck('T-2 썸네일 검은 제목 span 제거', thumbs.hasTitleSpan===false, '');
ck('T-3 템플릿명 aria-label 보존(접근성)', thumbs.hasAria===true, '');

// ── 2) long press 확대 미리보기 ──
await p.evaluate(()=>{ var it=document.querySelector('#wsv2Flow .tpl-item'); var rc=it.getBoundingClientRect();
  it.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:rc.x+10,clientY:rc.y+10})); });
await p.waitForTimeout(620);
ck('L-1 길게 누르면 확대 미리보기 열림', await p.evaluate(()=>!!document.querySelector('#wsv2Flow [data-fl-tplpreview]')), '');
ck('L-2 미리보기에 적용하기/닫기 버튼', await p.evaluate(()=>!!document.querySelector('[data-fl-tppapply]')&&!!document.querySelector('[data-fl-tppclose]')), '');
ck('L-3 long press 시 바로 적용 안 됨(템플릿 미적용)', await p.evaluate(()=>!document.querySelector('#wsv2Flow .tpl-car')), '');
// 닫기 → 상태 변화 없음
await p.evaluate(()=>document.querySelector('.tpl-preview__close').click());
await p.waitForTimeout(60);
ck('L-4 닫기 시 미리보기 사라지고 미적용', await p.evaluate(()=>!document.querySelector('#wsv2Flow [data-fl-tplpreview]')&&!document.querySelector('#wsv2Flow .tpl-car')), '');

// long press 억제 창(700ms) 만료 후 정상 탭이 안 먹히는지 검증
await p.evaluate(()=>document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true})));
await p.waitForTimeout(760);

// ── 3) short tap 적용 → 큰 캐러셀 ──
await p.evaluate(()=>{ var it=document.querySelector('#wsv2Flow .tpl-item'); var rc=it.getBoundingClientRect();
  it.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:rc.x+10,clientY:rc.y+10}));
  it.dispatchEvent(new PointerEvent('pointerup',{bubbles:true})); it.click(); });
await p.waitForTimeout(400);
const car=await p.evaluate(()=>({ hasCar:!!document.querySelector('#wsv2Flow .tpl-car'), hasStrip:!!document.querySelector('#wsv2Flow .tpl-results'), slides:document.querySelectorAll('#wsv2Flow .tpl-car .cap-car__slide').length, pills:document.querySelectorAll('#wsv2Flow .tpl-car__pill').length, change:!!document.querySelector('[data-fl="tplchange-active"]'), edit:!!document.querySelector('[data-fl="tpledit-active"]') }));
ck('C-1 적용 후 큰 캐러셀 표시', car.hasCar===true, JSON.stringify(car));
ck('C-2 작은 스트립(tpl-results) 아님', car.hasStrip===false, '');
ck('C-3 Pair 3개 슬라이드', car.slides===3, 'slides='+car.slides);
ck('C-4 Pair pill 3개', car.pills===3, 'pills='+car.pills);
ck('C-5 active Pair 템플릿 바꾸기/수정 버튼', car.change&&car.edit, '');

// ── 4) Pair 2로 전환 + templateId 유지 ──
const pids=await p.evaluate(()=>{ var outs=(window.__wsdbg&&window.__wsdbg.outs)||null; return outs; });
await p.evaluate(()=>{ var pl=document.querySelectorAll('#wsv2Flow .tpl-car__pill'); if(pl[1])pl[1].click(); });
await p.waitForTimeout(120);
ck('C-6 Pair pill 전환 시 active 라벨 갱신', await p.evaluate(()=>{ var l=document.querySelector('[data-fl-tpl-activelabel]'); return l&&/Pair 2/.test(l.textContent); }), await p.evaluate(()=>{var l=document.querySelector('[data-fl-tpl-activelabel]');return l?l.textContent:'';}));
ck('X-1 pageerror/console error 0', fe.length===0, fe.slice(0,3).join(' | '));

const pass=r.filter(x=>x.p).length;
console.log('V541 QA: '+pass+'/'+r.length+' '+(pass===r.length?'PASS':'FAIL'));
r.forEach(x=>console.log('  '+(x.p?'PASS':'FAIL')+' '+x.n+(x.d?'  — '+x.d:'')));
await b.close();
process.exit(pass===r.length?0:1);
