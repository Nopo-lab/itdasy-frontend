// v545 QA — value=0 no-op·단조증가 / catchLight·nailShape 보강 / 편집 프리뷰 contain / PC 홈 폭
import fs from 'fs'; import { chromium } from 'playwright';
const rd=f=>fs.readFileSync(f,'utf8');
const r=[]; const ck=(n,c,d)=>r.push({n,p:!!c,d:d||''});
const b=await chromium.launch();
const PORT=process.env.QA_PORT||'8091';

// ── Part A: 엔진 no-op + 단조 (마스크 주입 실측) ──
const ehtml=`<!doctype html><html><body><script>${rd('app-photo-editor-smart-mask.js')}</script><script>${rd('js/photo-editor/beauty-engine.js')}</script></body></html>`;
fs.writeFileSync('output/_v545eng.html',ehtml);
const pA=await b.newPage(); const feA=[]; pA.on('pageerror',e=>feA.push(String(e)));
await pA.goto('http://localhost:'+PORT+'/output/_v545eng.html',{waitUntil:'load'});
const eng=await pA.evaluate(()=>{
  const W=240,H=300;
  function scene(){const cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d',{willReadFrequently:true});
    c.fillStyle='#c9ccd2';c.fillRect(0,0,W,H);c.fillStyle='#4a3526';c.fillRect(50,20,140,90);c.fillStyle='#ebc8b0';c.fillRect(60,100,120,110);
    let im=c.getImageData(50,20,140,190),d=im.data,s=7;for(let i=0;i<d.length;i+=4){s=(s*1103515245+12345)&0x7fffffff;const n=((s%100)-50)/50*11;d[i]+=n;d[i+1]+=n;d[i+2]+=n;}c.putImageData(im,50,20);
    c.fillStyle='#f0dada';c.fillRect(75,120,28,12);c.fillRect(137,120,28,12);c.fillStyle='#5a4030';c.beginPath();c.arc(89,126,5,0,7);c.fill();c.beginPath();c.arc(151,126,5,0,7);c.fill();
    c.fillStyle='#3a2a22';c.fillRect(75,110,28,4);c.fillRect(137,110,28,4);c.fillStyle='#d98aa0';c.fillRect(95,250,50,30);return c;}
  function rect(roi){const m=new Float32Array(W*H);for(let y=roi.y;y<roi.y+roi.h;y++)for(let x=roi.x;x<roi.x+roi.w;x++)m[y*W+x]=1;return m;}
  const R={hair:{x:50,y:20,w:140,h:90},skin:{x:60,y:100,w:120,h:110},eye:{x:75,y:118,w:90,h:18},brow:{x:75,y:108,w:90,h:8},nail:{x:95,y:250,w:50,h:30},bg:{x:4,y:4,w:30,h:30}};
  const masks={useMasks:{skinMask:rect(R.skin),hairMask:rect(R.hair),eyeMask:rect(R.eye),scleraMask:rect(R.eye),nailMask:rect(R.nail)},_scale:{scleraMask:1,nailMask:1},browMask:rect(R.brow),browScale:1,lashMask:rect(R.eye),lashScale:1,maskW:W,maskH:H};
  function mean(a,bd,roi){let s=0,n=0;for(let y=roi.y;y<roi.y+roi.h;y++)for(let x=roi.x;x<roi.x+roi.w;x++){const i=(y*W+x)*4;s+=Math.abs(a[i]-bd[i])+Math.abs(a[i+1]-bd[i+1])+Math.abs(a[i+2]-bd[i+2]);n+=3;}return +(s/n).toFixed(2);}
  const FX={skin:'skin',textureSmooth:'skin',hairDetail:'hair',hairVolume:'hair',hairShine:'hair',hairFull:'hair',hairEndsClean:'hair',browSharp:'brow',lashSharp:'eye',eyeRedness:'eye',catchLight:'eye',nailGloss:'nail',nailShape:'nail',handSkin:'skin'};
  const eng=window.PhotoEditorBeautyEngine; const out={};
  Object.keys(FX).forEach(k=>{const roi=R[FX[k]];const row={};[0,50,100].forEach(v=>{const c=scene();const before=c.getImageData(0,0,W,H).data.slice();const bt={};bt[k]=v;if(v!==0)eng.apply(c,W,H,bt,false,masks);const after=c.getImageData(0,0,W,H).data;row['v'+v]=mean(before,after,roi);if(v===100)row.bg=mean(before,after,R.bg);});out[k]=row;});
  return out;
});
let noopFail=[], monoFail=[], pollFail=[];
Object.keys(eng).forEach(k=>{const r2=eng[k]; if(r2.v0!==0)noopFail.push(k); if(!(r2.v100>r2.v50))monoFail.push(k); if(r2.bg>0.5)pollFail.push(k);});
ck('A-1 value=0 전부 no-op(delta 0)', noopFail.length===0, noopFail.join(','));
ck('A-2 0<50<100 단조 증가', monoFail.length===0, monoFail.join(','));
ck('A-3 마스크 밖 오염 없음(bg<0.5)', pollFail.length===0, pollFail.join(','));
ck('A-4 catchLight 보강(100 delta > 0.4)', eng.catchLight.v100>0.4, 'v100='+eng.catchLight.v100);
ck('A-5 nailShape 보강(100 delta > 1.2)', eng.nailShape.v100>1.2, 'v100='+eng.nailShape.v100);
ck('A-6 textureSmooth 보강(100 delta > 2.5)', eng.textureSmooth.v100>2.5, 'v100='+eng.textureSmooth.v100);
ck('A-X engine pageerror 0', feA.length===0, feA.slice(0,2).join(' | '));

// ── Part B: CSS — 편집 프리뷰 contain + PC 홈 폭 ──
const cssHtml=`<!doctype html><html><head><meta charset=utf-8><style>${rd('css/workspace-v2-flow.css')}\n${rd('css/workspace-v2.css')}</style></head><body>
<div class="wsv2flow"><div class="ed-photo" style="width:100px;height:100px;background-image:url(data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=)"></div></div>
<div class="wsv2" id="home"></div></body></html>`;
fs.writeFileSync('output/_v545css.html',cssHtml);
const pB=await b.newPage();
await pB.setViewportSize({width:1366,height:900});
await pB.goto('http://localhost:'+PORT+'/output/_v545css.html',{waitUntil:'load'});
ck('B-1 편집 프리뷰 background-size: contain', (await pB.evaluate(()=>getComputedStyle(document.querySelector('.ed-photo')).backgroundSize))==='contain', await pB.evaluate(()=>getComputedStyle(document.querySelector('.ed-photo')).backgroundSize));
ck('B-2 PC(1366px) 작업실 홈 max-width 1120px', (await pB.evaluate(()=>getComputedStyle(document.getElementById('home')).maxWidth))==='1120px', await pB.evaluate(()=>getComputedStyle(document.getElementById('home')).maxWidth));
await pB.setViewportSize({width:768,height:900}); await pB.waitForTimeout(50);
ck('B-3 태블릿(768px) max-width 780px 유지(회귀 없음)', (await pB.evaluate(()=>getComputedStyle(document.getElementById('home')).maxWidth))==='780px', await pB.evaluate(()=>getComputedStyle(document.getElementById('home')).maxWidth));

const pass=r.filter(x=>x.p).length;
console.log('V545 QA: '+pass+'/'+r.length+' '+(pass===r.length?'PASS':'FAIL'));
r.forEach(x=>console.log('  '+(x.p?'PASS':'FAIL')+' '+x.n+(x.d?'  — '+x.d:'')));
await b.close();
process.exit(pass===r.length?0:1);
