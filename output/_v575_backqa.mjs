import fs from 'fs'; import { chromium } from 'playwright';
const rd=f=>fs.readFileSync(f,'utf8');
const FCSS=['css/tokens.css','css/components.css','css/workspace-v2-flow.css'].map(rd).join('\n');
const FSTACK=['js/photo-editor/template-fit-text.js','js/photo-editor/template-slots.js','js/photo-editor/template-pack-beauty-data.js','js/photo-editor/template-market-data.js','js/photo-editor/template-renderer-beauty-pack.js','js/photo-editor/template-renderer-beauty-pack-draws.js','js/photo-editor/template-renderer-wm-pack-draws.js','js/photo-editor/premium-templates.js','js/photo-editor/template-thumb.js','js/workspace/workspace-tpl-edit.js','js/workspace/workspace-v2-home.js','js/workspace/workspace-state.js','js/workspace/workspace-v2-flow.js'].map(rd).join('\n;\n');
const HTML=`<!doctype html><html><head><meta charset=utf-8><style>${FCSS}</style></head><body><script>
 window._uid=()=>'id_'+Math.random().toString(36).slice(2); window.uid=window._uid; window.showToast=()=>{}; window.confirm=()=>true; window.renderScenarioSelector=(c)=>{c.innerHTML='';};
 window._registerSheet=(n,fn)=>{window.__sheetClose=fn;}; window._markSheetOpen=()=>{}; window._markSheetClosed=()=>{};
 window.WorkspaceAdapter={ applyWorkspaceTemplate:()=>Promise.resolve({ok:true,dataUrl:'x'}), applyWorkspaceCorrections:()=>Promise.resolve({ok:true,dataUrl:'x'}), generateCaption:()=>Promise.resolve({ok:true,caption:'x',hashtags:[]}), instagram:()=>({connected:false}), instagramProfile:()=>({connected:false}), recentCustomers:()=>Promise.resolve([]), saveItem:()=>Promise.resolve({ok:true}), setCaptionTemplate:()=>Promise.resolve({ok:true}) };
 window.Customer={search:()=>[],list:()=>Promise.resolve([])}; window.WorkspaceV2={refresh:()=>{}};
</script><script>${FSTACK}</script></body></html>`;
fs.writeFileSync('output/_v575_backqa.html',HTML);
const b=await chromium.launch(); const p=await b.newPage(); await p.setViewportSize({width:420,height:880});
await p.goto('http://localhost:8091/output/_v575_backqa.html',{waitUntil:'load'});
const png='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="400" height="600" fill="#ddd"/></svg>').toString('base64');
// 홈 시작하기 → 파일선택 → 편집 직행 경로 재현: open(startScreen edit, files)
const r=await p.evaluate(async(png)=>{
  // dataURL → File
  const res=await fetch(png); const blob=await res.blob(); const file=new File([blob],'p.png',{type:'image/svg+xml'});
  window._fileToDataUrl=(f)=>new Promise((rs)=>{const rd=new FileReader();rd.onload=()=>rs(rd.result);rd.readAsDataURL(f);});
  window.WorkspaceFlow.open({startScreen:'edit',cat:'feed',files:[file]});
  await new Promise(r=>setTimeout(r,600));
  const active=[...document.querySelectorAll('.wsv2flow__s')].find(s=>s.classList.contains('active'));
  return { activeScreen: active?active.dataset.fs:null };
},png);
// 뒤로가기(시스템 back) 시뮬레이션 — 닫혀서 홈 복귀해야 함(navStack 비어있으면)
const afterBack=await p.evaluate(()=>{
  const before=document.querySelector('.wsv2flow').classList.contains('is-open');
  if(window.__sheetClose) window.__sheetClose();   // _systemBack 직접 호출(=베이스에서 back)
  const wf=document.querySelector('.wsv2flow');
  const active=[...document.querySelectorAll('.wsv2flow__s')].find(s=>s.classList.contains('active'));
  return { wasOpen:before, stillOpen: wf.classList.contains('is-open'), activeScreen: active?active.dataset.fs:null };
});
await b.close();
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
ok('파일 직행 → 편집 화면(업로드 건너뜀)', r.activeScreen==='edit', 'active='+r.activeScreen);
ok('직행 진입 시 편집이 베이스(뒤로가기 1회=닫힘/홈)', afterBack.wasOpen && !afterBack.stillOpen, JSON.stringify(afterBack));
ok('뒤로가기 후 중간 업로드 화면 안 뜸', afterBack.activeScreen!=='upload', 'active='+afterBack.activeScreen);
let pass=0,fail=0; console.log('\n===== v575 back-nav QA (이슈1) =====');
for(const x of results){console.log((x.pass?'PASS':'FAIL')+'  '+x.n+(x.d&&!x.pass?'  → '+x.d:'')); x.pass?pass++:fail++;}
console.log(`\n총 ${results.length} · PASS ${pass} · FAIL ${fail}`); process.exit(fail?1:0);
