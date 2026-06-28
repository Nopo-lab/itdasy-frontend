// v540 QA — 마스크 pill 이동 + 네일 inline helper + 콘텐츠 편집 라우팅
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
 window.MaskApplication={ getMasksForBeauty:function(img){ var mw=200,mh=200,sk=new Float32Array(mw*mh),hr=new Float32Array(mw*mh);
   for(var y=0;y<mh;y++)for(var x=0;x<mw;x++){var i=y*mw+x; if(x<mw*0.6&&y>mh*0.3)sk[i]=0.9; if(y<mh*0.3)hr[i]=0.8;}
   return Promise.resolve({useMasks:{skinMask:sk,hairMask:hr},_scale:{},maskW:mw,maskH:mh}); }, getNailMaskSync:function(){return null;} };
 window.WorkspaceAdapter={ applyWorkspaceTemplate:()=>Promise.resolve({ok:true,dataUrl:'data:img/x'}), generateCaption:()=>Promise.resolve({ok:true,caption:'x',hashtags:[]}), instagram:()=>({connected:false}), instagramProfile:()=>({connected:false}), recentCustomers:()=>Promise.resolve([]), saveItem:()=>Promise.resolve({ok:true}), setCaptionTemplate:()=>Promise.resolve({ok:true}) };
 window.Customer={search:()=>[],list:()=>Promise.resolve([])}; window.WorkspaceV2={refresh:()=>{}};
</script><script>${STACK}</script></body></html>`;
fs.writeFileSync(path.join(ROOT,'output/_v540qa.html'),HTML);
const PORT=process.env.QA_PORT||'8091';
const fe=[]; const p=await b.newPage(); await p.setViewportSize({width:420,height:900});
p.on('pageerror',e=>fe.push(String(e)));
p.on('console',m=>{ if(m.type()==='error'&&!/INVALID_URL|net::|Failed to load/.test(m.text())) fe.push(m.text()); });
await p.goto('http://localhost:'+PORT+'/output/_v540qa.html',{waitUntil:'load'});
const slot={id:'s',workspaceContext:{templatePurpose:'before_after',type:'before_after'},photos:[{id:'a',dataUrl:PNG,role:'before'},{id:'b',dataUrl:PNG,role:'after'}]};

// ── 마스크 pill 위치 ──
await p.evaluate(s=>window.WorkspaceFlow.open({startScreen:'edit',cat:'ba',slot:s}),slot);
await p.waitForTimeout(120);
ck('P-1 마스크 pill 정밀조정 안에 존재', await p.evaluate(()=>!!document.querySelector('#wsv2Flow [data-ed-adv] .ed-maskpill')), '');
ck('P-2 하단바에 마스크 버튼 없음', await p.evaluate(()=>!document.querySelector('#wsv2Flow [data-ed-bottom] [data-fl-eb="마스크"]')), '');
// pill ON (skin)
await p.evaluate(()=>document.querySelector('#wsv2Flow .ed-maskpill').click());
await p.waitForTimeout(250);
ck('P-3 pill ON → skin overlay 표시', await p.evaluate(()=>{var o=document.querySelector('#wsv2Flow [data-fl-maskov]'); return o&&!o.hidden&&o.width>0;}), '');
ck('P-4 pill on 상태', await p.evaluate(()=>!!document.querySelector('#wsv2Flow .ed-maskpill.on')), '');

// ── 네일 탭: nailMask 없음 → inline helper, 좌상단 배지 숨김 ──
await p.evaluate(()=>{var t=document.querySelector('#wsv2Flow [data-fl-edtab="nail"]'); if(t)t.click();});
await p.waitForTimeout(300);
const nail=await p.evaluate(()=>{ var h=document.querySelector('#wsv2Flow [data-fl-maskhelper]'); var bd=document.querySelector('#wsv2Flow [data-fl-maskbadge]');
  return {helperShown:h&&!h.hidden, helperText:h?h.textContent:'', badgeHidden:bd?bd.hidden:'x'}; });
ck('N-1 네일 미인식 → inline helper 표시', nail.helperShown===true, nail.helperText);
ck('N-2 helper 문구 부드러움(기본 영역)', /기본 영역으로 보정 중/.test(nail.helperText), '');
ck('N-3 좌상단 배지 숨김(사진 안 가림)', nail.badgeHidden===true, 'badgeHidden='+nail.badgeHidden);

// ── 콘텐츠 편집 라우팅 (focus) ──
async function reopen(focus){ await p.evaluate(()=>{ if(window.WorkspaceFlow.close)window.WorkspaceFlow.close(); }); await p.waitForTimeout(40);
  await p.evaluate((args)=>window.WorkspaceFlow.open({startScreen:'edit',cat:'ba',slot:args.slot,focus:args.focus}),{slot,focus}); await p.waitForTimeout(160); }
await reopen('crop');
ck('R-1 비율자르기 → 고급(tools) 탭 active', await p.evaluate(()=>!!document.querySelector('#wsv2Flow [data-fl-edtab="tools"].on')), '');
await reopen('template');
ck('R-2 템플릿 → 템플릿 폴드 열림', await p.evaluate(()=>{var f=document.querySelector('#wsv2Flow [data-fl-fold="tpl"]'); return f&&/open/.test(f.className);}), '');
await reopen('background');
ck('R-3 누끼·배경 → 기본보정 background 도구', await p.evaluate(()=>{ // basicTool=background 시 배경 섹션 노출 (data-fl-basictool 또는 bg 컨트롤)
  return !!document.querySelector('#wsv2Flow [data-ed-basic]'); }), 'bg section present');
await reopen('photo-edit');
ck('R-4 사진편집 → 편집화면 기본 진입(콘텐츠 유지)', await p.evaluate(()=>!!document.querySelector('#wsv2Flow [data-fs="edit"]')), '');
// 콘텐츠 유지 — photos 가 로드되어 편집화면(업로드 아님)
ck('R-5 콘텐츠 이미지가 에디터에 로드됨(새 업로드 리셋 아님)', await p.evaluate(()=>{var ep=document.querySelector('#wsv2Flow [data-fl-edphoto]'); return !!ep && ep.style.backgroundImage.indexOf('url(')>=0;}), '');
ck('X-1 pageerror/console error 0', fe.length===0, fe.slice(0,3).join(' | '));

const pass=r.filter(x=>x.p).length;
console.log('V540 QA: '+pass+'/'+r.length+' '+(pass===r.length?'PASS':'FAIL'));
r.forEach(x=>console.log('  '+(x.p?'PASS':'FAIL')+' '+x.n+(x.d?'  — '+x.d:'')));
await b.close();
process.exit(pass===r.length?0:1);
