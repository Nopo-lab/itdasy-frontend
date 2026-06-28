import fs from 'fs'; import path from 'path'; import { chromium } from 'playwright';
const ROOT=path.resolve('.');
const FLOW=fs.readFileSync(path.join(ROOT,'js/workspace/workspace-v2-flow.js'),'utf8');
const HOME=fs.readFileSync(path.join(ROOT,'js/workspace/workspace-v2-home.js'),'utf8');
const CSS=fs.readFileSync(path.join(ROOT,'css/workspace-v2-flow.css'),'utf8');
const TOK=fs.readFileSync(path.join(ROOT,'css/tokens.css'),'utf8');
// 변신 느낌 dataURL 2색 (유효 PNG 1x1, 색은 무관 — 레이아웃 확인용)
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HgAGgwJ/lK3Q6wAAAABJRU5ErkJggg==';
const PAGE=`<!doctype html><html><head><meta charset=utf-8><style>${TOK}${CSS}
 body{margin:0;background:var(--bg)} #wsv2Flow{position:static!important;transform:none!important;inset:auto!important;width:390px;height:780px;overflow:auto}</style></head><body>
<script>
 window._uid=()=> 'id_'+Math.random().toString(36).slice(2); window.uid=window._uid;
 window.showToast=()=>{}; window.confirm=()=>true;
 window.renderScenarioSelector=(c,cb)=>{window.__scenarioCb=cb;c.innerHTML='';};
 window.WorkspaceAdapter={applyWorkspaceCorrections:o=>Promise.resolve({ok:true,dataUrl:o.src}),
   applyWorkspaceTemplate:o=>Promise.resolve({ok:true,dataUrl:'${PNG}',template:o.template}),
   generateCaption:o=>Promise.resolve({ok:true,caption:'오늘은 김민지 고객님의 레이어드컷 27인치 작업이에요. 세 장의 전후 컷으로 변화를 한눈에 담았습니다.',hashtags:['#레이어드컷','#얼굴라인']}),
   saveItem:s=>Promise.resolve({ok:true}), instagramProfile:()=>({connected:false}), recentCustomers:()=>Promise.resolve([])};
 window.Customer={search:()=>[],list:()=>Promise.resolve([])}; window.WorkspaceV2={refresh:()=>{}};
</script><script>${FLOW}</script><script>${HOME}</script></body></html>`;
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:390,height:780},deviceScaleFactor:2});
await pg.setContent(PAGE,{waitUntil:'load'});
const six={id:'six',workspaceContext:{templatePurpose:'before_after',type:'before_after'},
  photos:[{id:'b1',dataUrl:PNG,role:'before'},{id:'a1',dataUrl:PNG,role:'after'},{id:'b2',dataUrl:PNG,role:'before'},{id:'a2',dataUrl:PNG,role:'after'},{id:'b3',dataUrl:PNG,role:'before'},{id:'a3',dataUrl:PNG,role:'after'}]};
await pg.evaluate(s=>window.WorkspaceFlow.open({startScreen:'edit',cat:'ba',slot:s}),six);
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'template',key:'ba'}));
await pg.waitForTimeout(400);
await pg.evaluate(()=>window.WorkspaceFlow.command({type:'caption',service:'레이어드컷 27인치'}));
await pg.waitForTimeout(300);
await pg.screenshot({path:'output/step4-caption-carousel.png'});
console.log('shot saved');
await b.close();
