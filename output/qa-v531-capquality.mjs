import fs from 'fs'; import path from 'path'; import { chromium } from 'playwright';
const ROOT=path.resolve('.');
const FLOW=fs.readFileSync(path.join(ROOT,'js/workspace/workspace-v2-flow.js'),'utf8');
const HOME=fs.readFileSync(path.join(ROOT,'js/workspace/workspace-v2-home.js'),'utf8');
const CAP=fs.readFileSync(path.join(ROOT,'app-caption.js'),'utf8');
const CSS=fs.readFileSync(path.join(ROOT,'css/workspace-v2-flow.css'),'utf8');
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF8FAGW2BPHFsbpRAAAAAElFTkSuQmCC';
const r=[]; const ck=(n,c,d)=>r.push({n,p:!!c,d:d||''});
const b=await chromium.launch();
// Part A: 플로우 opts
const FP=`<!doctype html><html><head><meta charset=utf-8><style>${CSS}</style></head><body><script>
 window._uid=()=> 'id_'+Math.random().toString(36).slice(2); window.uid=window._uid; window.showToast=()=>{}; window.confirm=()=>true; window.renderScenarioSelector=(c,cb)=>{c.innerHTML='';};
 window.WorkspaceAdapter={applyWorkspaceTemplate:o=>Promise.resolve({ok:true,dataUrl:'${PNG}'.replace('==','=='+(window.__n=(window.__n||0)+1))}),generateCaption:o=>{window.__g=JSON.parse(JSON.stringify(o));return Promise.resolve({ok:true,caption:'x',hashtags:[]});},saveItem:s=>Promise.resolve({ok:true}),instagramProfile:()=>({connected:false}),recentCustomers:()=>Promise.resolve([])};
 window.Customer={search:()=>[],list:()=>Promise.resolve([])}; window.WorkspaceV2={refresh:()=>{}};
</script><script>${FLOW}</script><script>${HOME}</script></body></html>`;
const fp=await b.newPage(); const fe=[]; fp.on('pageerror',e=>fe.push(String(e))); fp.on('console',m=>{if(m.type()==='error'&&!/INVALID_URL/.test(m.text()))fe.push(m.text());});
await fp.setContent(FP,{waitUntil:'load'});
const six={id:'six',workspaceContext:{templatePurpose:'before_after',type:'before_after'},photos:[0,1,2,3,4,5].map(i=>({id:(i%2?'a':'b')+i,dataUrl:PNG,role:i%2?'after':'before'}))};
await fp.evaluate(s=>window.WorkspaceFlow.open({startScreen:'edit',cat:'ba',slot:s}),six);
await fp.evaluate(()=>window.WorkspaceFlow.command({type:'template',key:'ba'})); await fp.waitForTimeout(350);
await fp.evaluate(()=>window.WorkspaceFlow.command({type:'caption',service:'레이어드컷 27인치'})); await fp.waitForTimeout(120);
let g=await fp.evaluate(()=>window.__g);
ck('CQ-1 photo_context 키워드 최우선', /시술\/키워드\(최우선 반영\): 레이어드컷 27인치/.test(g.photo_context), g.photo_context);
ck('CQ-2 photo_context 다른 시술명 금지 명시', /입력하지 않은 다른 시술\/상품명은 새로 만들지 마세요/.test(g.photo_context));
ck('CQ-3 photo_context 중립 전후(시술명 가정X)', /시술 전\/후 변화 컷/.test(g.photo_context));
ck('CQ-4 extra_notes 키워드 최우선', /입력 키워드 "레이어드컷 27인치"를 게시글 핵심으로 최우선 반영/.test(g.extra_notes), g.extra_notes);
ck('CQ-5 extra_notes 붙임머리/단발탈출 금지', /붙임머리·단발탈출·슬림땋기 등\)은 절대 추가하지 마세요/.test(g.extra_notes));
ck('CQ-6 extra_notes 구어 의미변환 예시', /개오바 얼굴.*얼굴 라인이 살아난/.test(g.extra_notes));
ck('CQ-7 extra_notes 300자 이내', (g.extra_notes||'').length<=300, String((g.extra_notes||'').length));
// 개오바 얼굴 입력
await fp.evaluate(()=>{var i=document.querySelector('#wsv2Flow [data-fl-service]'); if(i)i.value='개오바 얼굴';});
await fp.evaluate(()=>window.WorkspaceFlow.command({type:'caption',service:'개오바 얼굴'})); await fp.waitForTimeout(100);
let g2=await fp.evaluate(()=>window.__g);
ck('CQ-8 개오바 얼굴 → 정제지시 동반', /개오바 얼굴/.test(g2.extra_notes)&&/의미만 뷰티샵 인스타 톤으로 정제/.test(g2.extra_notes), g2.extra_notes);

// Part B: dedupe + placeholder (app-caption, file://)
const CP=`<!doctype html><html><head><meta charset=utf-8></head><body><script>
 window.API=''; window.authHeader=()=>({});
 window.__resp={caption:'[샵이름]에서 두상 커 보임 없이 가벼움을 약속드려요.\\n\\n두상 커 보임 없이 가벼움을 약속드려요.\\n\\n다른 마무리 문장.',hashtags:['#a','#a','#b']};
 window.fetch=(u,o)=>{window.__body=JSON.parse(o.body);return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(window.__resp)});};
</script><script>${CAP}</script></body></html>`;
fs.writeFileSync(path.join(ROOT,'output/_cq.html'),CP);
const cp=await b.newPage(); const ce=[]; cp.on('pageerror',e=>ce.push(String(e))); cp.on('console',m=>{if(m.type()==='error')ce.push(m.text());});
await cp.goto('file://'+path.join(ROOT,'output/_cq.html'),{waitUntil:'load'});
await cp.evaluate(()=>localStorage.removeItem('shop_name'));
let res=await cp.evaluate(async()=>window.CaptionEngine.generate({photo_context:'x',service:'레이어드컷',extra_notes:'y'}));
ck('CQ-9 placeholder [샵이름] 치환(저희 샵)', !/\[샵이름\]/.test(res.caption)&&/저희 샵/.test(res.caption), res.caption);
ck('CQ-10 반복 문장 제거(약속드려요 1회)', (res.caption.match(/가벼움을 약속드려요/g)||[]).length===1, res.caption);
ck('CQ-11 해시태그 중복 제거', new Set(res.hashtags).size===res.hashtags.length);
ck('CQ-12 flow error 0', fe.length===0, JSON.stringify(fe.slice(0,3)));
ck('CQ-13 caption error 0', ce.length===0, JSON.stringify(ce.slice(0,3)));
await b.close();
let pass=r.filter(x=>x.p).length;
console.log('V531 CAP-QUALITY QA: '+pass+'/'+r.length+' PASS');
r.forEach(x=>console.log((x.p?'  PASS ':'  FAIL ')+x.n+(x.p?'':' :: '+x.d)));
process.exit(pass===r.length?0:1);
