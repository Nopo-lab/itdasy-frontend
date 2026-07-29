// v549 QA — A 눈 ROI(흰자 dilation 제거) / C 네일 격리(피부·배경 무변) / D 마스크 색상 / E 게시완료 홈이동
import { chromium } from 'playwright'; import fs from 'fs'; import path from 'path';
const ROOT=path.resolve('.'); const rd=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const r=[]; const ck=(n,c,d)=>r.push({n,p:!!c,d:d||''});
const PORT=process.env.QA_PORT||'8091'; const b=await chromium.launch();

// ── A/C: 엔진(눈맑게 no-blue + 네일 격리) ──
const html=`<!doctype html><html><body><script src="/app-photo-editor-smart-mask.js"></script><script src="/js/photo-editor/beauty-engine.js"></script></body></html>`;
fs.writeFileSync(path.join(ROOT,'output/_v549qa.html'),html);
const p=await b.newPage(); const fe=[]; p.on('pageerror',e=>fe.push(String(e)));
await p.goto('http://localhost:'+PORT+'/output/_v549qa.html',{waitUntil:'load'});
const eng=await p.evaluate(()=>{
  const eng=window.PhotoEditorBeautyEngine;
  // 눈맑게 no-blue
  const W=120,H=120;
  function eye(){const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='#ebc8b0';x.fillRect(0,0,W,H);x.fillStyle='#f0dede';x.fillRect(40,50,50,18);return x;}
  function fm(rx,ry,rw,rh){const m=new Float32Array(W*H);for(let y=ry;y<ry+rh;y++)for(let x=rx;x<rx+rw;x++)m[y*W+x]=1;return m;}
  const em={useMasks:{scleraMask:fm(40,50,50,18),eyeMask:fm(40,50,50,18)},_scale:{scleraMask:1},maskW:W,maskH:H};
  function s1(c){const d=c.getImageData(60,58,1,1).data;return{r:d[0],g:d[1],b:d[2]};}
  const e0=s1(eye()); let c=eye();eng.apply(c,W,H,{eyeRedness:100},false,em);const e100=s1(c);
  // 네일 격리(vivid 폴리시)
  const NW=160,NH=200;
  function hand(){const c=document.createElement('canvas');c.width=NW;c.height=NH;const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='#b9bcc2';x.fillRect(0,0,NW,NH);x.fillStyle='#e0b89a';x.fillRect(45,40,70,140);x.fillStyle='#d6489a';x.fillRect(55,40,12,22);x.fillStyle='#dd3a8a';x.fillRect(72,38,12,20);x.fillStyle='#d6489a';x.fillRect(89,40,12,22);return x;}
  function mean(a,bd,rx,ry,rw,rh){let s=0,n=0;for(let y=ry;y<ry+rh;y++)for(let x=rx;x<rx+rw;x++){const i=(y*NW+x)*4;s+=Math.abs(a[i]-bd[i])+Math.abs(a[i+1]-bd[i+1])+Math.abs(a[i+2]-bd[i+2]);n+=3;}return +(s/n).toFixed(2);}
  function nz(k){const c=hand();const bef=c.getImageData(0,0,NW,NH).data.slice();eng.apply(c,NW,NH,{[k]:100},false,null);const af=c.getImageData(0,0,NW,NH).data;return {nail:mean(bef,af,55,40,46,22),skin:mean(bef,af,55,120,46,40),bg:mean(bef,af,5,5,30,30)};}
  return { e0,e100, gloss:nz('nailGloss'), shape:nz('nailShape') };
});
ck('A-1 눈맑게 100 붉은기 완화(R↓)', eng.e100.r < eng.e0.r, 'R '+eng.e0.r+'→'+eng.e100.r);
ck('A-2 눈맑게 100 파란색 아님(B≤R, B 최댓값 아님)', eng.e100.b <= eng.e100.r && eng.e100.b <= Math.max(eng.e100.r,eng.e100.g), 'B='+eng.e100.b);
ck('A-3 흰자 dilation 제거(눈썹 번짐 방지) 소스', !/_dilateRegion\(t, img, 0\.008\)/.test(rd('js/photo-editor/region-mask-provider.js')) && /흰자는 dilation 안 함/.test(rd('js/photo-editor/region-mask-provider.js')), '');
ck('C-1 네일 광택 손톱만(손톱>1)', eng.gloss.nail > 1, 'nail='+eng.gloss.nail);
ck('C-2 네일 광택 손 피부 무변(<0.5)', eng.gloss.skin < 0.5, 'skin='+eng.gloss.skin);
ck('C-3 네일 광택 배경 무변(<0.5)', eng.gloss.bg < 0.5, 'bg='+eng.gloss.bg);
ck('C-4 네일 경계 손톱만(손톱>1, 피부<0.5)', eng.shape.nail > 1 && eng.shape.skin < 0.5, 'nail='+eng.shape.nail+' skin='+eng.shape.skin);
ck('A/C-X engine error 0', fe.length===0, fe.slice(0,2).join(' | '));

// ── D/E: 플로우 (마스크 색상 + 게시완료 홈이동) ──
const FCSS=rd('css/workspace-v2-flow.css');
const FSTACK=['js/photo-editor/template-fit-text.js','js/photo-editor/template-slots.js','js/photo-editor/template-pack-beauty-data.js','js/photo-editor/template-market-data.js','js/photo-editor/template-renderer-beauty-pack.js','js/photo-editor/template-renderer-beauty-pack-draws.js','js/photo-editor/template-renderer-wm-pack-draws.js','js/photo-editor/premium-templates.js','js/photo-editor/template-thumb.js','js/workspace/workspace-tpl-edit.js','js/workspace/workspace-v2-home.js','js/workspace/workspace-state.js','js/workspace/workspace-v2-flow.js'].map(rd).join('\n;\n');
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF8FAGW2BPHFsbpRAAAAAElFTkSuQmCC';
const fHtml=`<!doctype html><html><head><meta charset=utf-8><style>${FCSS}</style></head><body><script>
 window._uid=()=>'id_'+Math.random().toString(36).slice(2); window.uid=window._uid; window.showToast=function(m){window.__toast=m;}; window.confirm=()=>true; window.renderScenarioSelector=(c)=>{c.innerHTML='';};
 window.WorkspaceAdapter={ applyWorkspaceTemplate:()=>Promise.resolve({ok:true,dataUrl:'x'}), saveImage:()=>{}, saveItem:function(s){window.__saved=s;return Promise.resolve({ok:true});}, generateCaption:()=>Promise.resolve({ok:true,caption:'x',hashtags:[]}), instagram:()=>({connected:false}), instagramProfile:()=>({connected:false}), recentCustomers:()=>Promise.resolve([]), setCaptionTemplate:()=>Promise.resolve({ok:true}) };
 window.Customer={search:()=>[],list:()=>Promise.resolve([])}; window.WorkspaceV2={refresh:()=>{}};
</script><script>${FSTACK}</script></body></html>`;
fs.writeFileSync(path.join(ROOT,'output/_v549flow.html'),fHtml);
const pB=await b.newPage(); await pB.setViewportSize({width:420,height:900}); const feB=[];
pB.on('pageerror',e=>feB.push(String(e))); pB.on('console',m=>{if(m.type()==='error'&&!/Failed|net::|INVALID/.test(m.text()))feB.push(m.text());});
await pB.goto('http://localhost:'+PORT+'/output/_v549flow.html',{waitUntil:'load'});
const slot={id:'sp',workspaceContext:{templatePurpose:'before_after',type:'before_after'},photos:[{id:'a',dataUrl:PNG,role:'before'},{id:'b',dataUrl:PNG,role:'after'}]};
// D: 마스크 색상 — eyes 탭 + eyeRedness → 파랑(흰자), browSharp → 초록, nail → 핑크
await pB.evaluate(s=>window.WorkspaceFlow.open({startScreen:'edit',cat:'ba',slot:s}),slot); await pB.waitForTimeout(120);
const colors=await pB.evaluate(()=>{
  function info(tab,prec){ /* _maskInfoForTab 은 내부 — 색상 매핑을 소스로 간접 확인 */ return null; }
  return { src: true };
});
ck('D-1 마스크 색상 스펙(눈=파랑 70,130,240 / 눈썹=초록 / 네일=핑크 / 손=주황)', /눈썹.*\[90, 200, 110\]|browMask.*\[90, 200, 110\]/.test(rd('js/workspace/workspace-v2-flow.js')) && /\[70, 130, 240\]/.test(rd('js/workspace/workspace-v2-flow.js')) && /handSkinMask.*\[240, 160, 70\]/.test(rd('js/workspace/workspace-v2-flow.js')) && /nailMask.*\[240, 110, 175\]/.test(rd('js/workspace/workspace-v2-flow.js')), '');
// E: 게시완료 → 토스트 + 홈(플로우 닫힘)
await pB.evaluate(s=>window.WorkspaceFlow.open({startScreen:'preview',cat:'ba',slot:s}),slot); await pB.waitForTimeout(120);
await pB.evaluate(()=>{var s=document.querySelector('#wsv2Flow [data-fl="saveimg"]'); if(s)s.click();}); await pB.waitForTimeout(100);
await pB.evaluate(()=>{var d=document.querySelector('#wsv2Flow [data-fl="pubdone"]'); if(d)d.click();}); await pB.waitForTimeout(100);
ck('E-1 게시완료 → "게시물이 저장되었습니다" 토스트', /게시물이 저장되었습니다/.test(await pB.evaluate(()=>window.__toast||'')), await pB.evaluate(()=>window.__toast||''));
ck('E-2 게시완료 → published 영속', await pB.evaluate(()=>window.__saved&&window.__saved.publish&&window.__saved.publish.status==='published'), '');
ck('E-3 게시완료 → 플로우 닫힘(홈 이동)', await pB.evaluate(()=>{var f=document.querySelector('#wsv2Flow'); return !f || !f.classList.contains('is-open');}), '');
ck('D/E-X flow error 0', feB.length===0, feB.slice(0,2).join(' | '));

const pass=r.filter(x=>x.p).length;
console.log('V549 QA: '+pass+'/'+r.length+' '+(pass===r.length?'PASS':'FAIL'));
r.forEach(x=>console.log('  '+(x.p?'PASS':'FAIL')+' '+x.n+(x.d?'  — '+x.d:'')));
await b.close(); process.exit(pass===r.length?0:1);
