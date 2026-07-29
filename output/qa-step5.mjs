import fs from 'fs'; import path from 'path'; import { chromium } from 'playwright';
const ROOT=path.resolve('.');
const FLOW=fs.readFileSync(path.join(ROOT,'js/workspace/workspace-v2-flow.js'),'utf8');
const HOME=fs.readFileSync(path.join(ROOT,'js/workspace/workspace-v2-home.js'),'utf8');
const CAP=fs.readFileSync(path.join(ROOT,'app-caption.js'),'utf8');
const CSS=fs.readFileSync(path.join(ROOT,'css/workspace-v2-flow.css'),'utf8');
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF8FAGW2BPHFsbpRAAAAAElFTkSuQmCC';
const r=[]; const ck=(n,c,d)=>r.push({n,p:!!c,d:d||''});
const b=await chromium.launch();

// ===== Part A/D: 플로우 opts (harness) =====
const FLOWPAGE=`<!doctype html><html><head><meta charset=utf-8><style>${CSS}</style></head><body>
<script>
 window._uid=()=> 'id_'+Math.random().toString(36).slice(2); window.uid=window._uid;
 window.showToast=()=>{}; window.confirm=()=>true;
 window.renderScenarioSelector=(c,cb)=>{window.__scenarioCb=cb;c.innerHTML='';};
 window.WorkspaceAdapter={applyWorkspaceCorrections:o=>Promise.resolve({ok:true,dataUrl:o.src}),
   applyWorkspaceTemplate:o=>{window.__n=(window.__n||0)+1;return Promise.resolve({ok:true,dataUrl:'${PNG}'.replace('==','=='+window.__n),template:o.template});},
   generateCaption:o=>{window.__lastGen=JSON.parse(JSON.stringify(o));return Promise.resolve({ok:true,caption:'본문',hashtags:['#t']});},
   saveItem:s=>Promise.resolve({ok:true}), instagramProfile:()=>({connected:false}), recentCustomers:()=>Promise.resolve([])};
 window.Customer={search:()=>[],list:()=>Promise.resolve([])}; window.WorkspaceV2={refresh:()=>{}};
</script><script>${FLOW}</script><script>${HOME}</script></body></html>`;
const fp=await b.newPage(); const ferr=[]; fp.on('pageerror',e=>ferr.push(String(e))); fp.on('console',m=>{if(m.type()==='error'&&!/INVALID_URL/.test(m.text()))ferr.push(m.text());});
await fp.setContent(FLOWPAGE,{waitUntil:'load'});
const six={id:'six',workspaceContext:{templatePurpose:'before_after',type:'before_after'},
  photos:[{id:'b1',dataUrl:PNG,role:'before'},{id:'a1',dataUrl:PNG,role:'after'},{id:'b2',dataUrl:PNG,role:'before'},{id:'a2',dataUrl:PNG,role:'after'},{id:'b3',dataUrl:PNG,role:'before'},{id:'a3',dataUrl:PNG,role:'after'}]};
await fp.evaluate(s=>window.WorkspaceFlow.open({startScreen:'edit',cat:'ba',slot:s}),six);
await fp.evaluate(()=>window.WorkspaceFlow.command({type:'template',key:'ba'}));
await fp.waitForTimeout(400);
await fp.evaluate(()=>window.WorkspaceFlow.command({type:'caption',service:'레이어드컷 27인치'}));
await fp.waitForTimeout(150);
let g=await fp.evaluate(()=>window.__lastGen);
ck('S5-1 photo_context 에 시술/키워드 prepend', /시술\/키워드: 레이어드컷 27인치/.test(g.photo_context), g.photo_context);
ck('S5-2 photo_context 에 캐러셀 3장 요약', /전후 결과물 3장\(인스타 캐러셀/.test(g.photo_context), g.photo_context);
ck('S5-3 extra_notes 에 키워드+정제지시', /레이어드컷 27인치/.test(g.extra_notes)&&/그대로 반복.*반영/.test(g.extra_notes), g.extra_notes);
ck('S5-4 opts.templateOutputs 3개 요약', Array.isArray(g.templateOutputs)&&g.templateOutputs.length===3&&g.templateOutputs.every(o=>o.templateId==='wm-ba-feed'), JSON.stringify((g.templateOutputs||[]).map(o=>o.pairId)));
ck('S5-5 selectedTemplateId 전달', g.selectedTemplateId==='wm-ba-feed', String(g.selectedTemplateId));
ck('S5-6 extra_notes 300자 이내', (g.extra_notes||'').length<=300, String((g.extra_notes||'').length));

// 구어 표현 "개오바 얼굴"
await fp.evaluate(()=>{var i=document.querySelector('#wsv2Flow [data-fl-service]'); if(i)i.value='개오바 얼굴';});
await fp.evaluate(()=>window.WorkspaceFlow.command({type:'caption',service:'개오바 얼굴'}));
await fp.waitForTimeout(120);
let g2=await fp.evaluate(()=>window.__lastGen);
ck('S5-7 구어 표현 extra_notes 정제지시 동반', /개오바 얼굴/.test(g2.extra_notes)&&/직역하지 말|그대로 반복/.test(g2.extra_notes), g2.extra_notes);
ck('S5-8 opts 에 이전 캡션 본문 누적 없음', !('caption' in g2)||!/본문/.test(String(g2.caption||'')), JSON.stringify(Object.keys(g2)));

// 더 길게 → 누적 없음(length_tier long, extra_notes 재구성)
await fp.evaluate(()=>window.WorkspaceFlow.command({type:'capvar',variant:'long'}));
await fp.waitForTimeout(120);
let g3=await fp.evaluate(()=>window.__lastGen);
ck('S5-9 더 길게=length_tier long + 누적 없음', g3.length_tier==='long'&&(!('caption' in g3)), JSON.stringify({lt:g3.length_tier}));

// ===== Part B/C: app-caption 실제 payload + dedupe =====
const CAPPAGE=`<!doctype html><html><head><meta charset=utf-8></head><body><script>
 window.API=''; window.authHeader=()=>({});
 window.__sentBody=null; window.__resp={caption:'문단 하나.\\n\\n문단 하나.\\n\\n다른 문단.',hashtags:['#a','#a','#b']};
 window.fetch=function(u,opt){window.__sentBody=JSON.parse(opt.body); return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(window.__resp)});};
</script><script>${CAP}</script></body></html>`;
fs.writeFileSync(path.join(ROOT,"output/_capqa.html"),CAPPAGE);
const cp=await b.newPage(); const cerr=[]; cp.on("pageerror",e=>cerr.push(String(e))); cp.on("console",m=>{if(m.type()==="error")cerr.push(m.text());});
await cp.goto("file://"+path.join(ROOT,"output/_capqa.html"),{waitUntil:"load"});
await cp.evaluate(()=>localStorage.setItem('shop_type','헤어'));
let res=await cp.evaluate(async()=>{ return await window.CaptionEngine.generate({photo_context:'시술/키워드: 레이어드컷 27인치 · 전후 결과물 3장(인스타 캐러셀 한 편).', service:'레이어드컷 27인치', extra_notes:'강조 표현: "개오바 얼굴" — 그대로 반복·직역하지 말고 뷰티샵 인스타 톤으로 자연스럽게 의미만 살려 반영해 주세요.'}); });
let body=await cp.evaluate(()=>window.__sentBody);
ck('S5-10 백엔드 payload 에 extra_notes 도달', !!body.extra_notes&&/개오바 얼굴/.test(body.extra_notes), JSON.stringify(body.extra_notes||null));
ck('S5-11 payload.photo_context 캐러셀 요약 유지', /전후 결과물 3장/.test(body.photo_context), body.photo_context);
ck('S5-12 payload.service 전달', body.service==='레이어드컷 27인치', String(body.service));
ck('S5-13 payload 4+필드(category/length_tier/tone_override)', !!body.category&&!!body.length_tier&&!!body.tone_override, JSON.stringify(Object.keys(body)));
ck('S5-14 캡션 문단 중복 제거(같은 문단 1회)', (res.caption.match(/문단 하나/g)||[]).length===1, JSON.stringify(res.caption));
ck('S5-15 해시태그 중복 제거', new Set(res.hashtags).size===res.hashtags.length&&res.hashtags.length===2, JSON.stringify(res.hashtags));

ck('S5-16 flow console error 0', ferr.length===0, JSON.stringify(ferr.slice(0,4)));
ck('S5-17 caption-load console error 0', cerr.length===0, JSON.stringify(cerr.slice(0,4)));
await b.close();
let pass=r.filter(x=>x.p).length;
console.log('STEP5 QA: '+pass+'/'+r.length+' PASS');
r.forEach(x=>console.log((x.p?'  PASS ':'  FAIL ')+x.n+(x.p?'':' :: '+x.d)));
process.exit(pass===r.length?0:1);
