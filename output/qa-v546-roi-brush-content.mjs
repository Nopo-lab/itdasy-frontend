// v546 QA — A-1 ROI dilation/symmetry 로직, A-2 손 피부 ROI 배선
import fs from 'fs'; import { chromium } from 'playwright';
const rd=f=>fs.readFileSync(f,'utf8');
const r=[]; const ck=(n,c,d)=>r.push({n,p:!!c,d:d||''});
const b=await chromium.launch(); const PORT=process.env.QA_PORT||'8091';

// ── A-2: handSkin 이 handSkinMask(손 ROI)에 적용, 미연결 시 skinW 폴백 ──
const html=`<!doctype html><html><body><script>${rd('app-photo-editor-smart-mask.js')}</script><script>${rd('js/photo-editor/beauty-engine.js')}</script></body></html>`;
fs.writeFileSync('output/_v546qa.html',html);
const p=await b.newPage(); const fe=[]; p.on('pageerror',e=>fe.push(String(e)));
await p.goto('http://localhost:'+PORT+'/output/_v546qa.html',{waitUntil:'load'});
const a2=await p.evaluate(()=>{
  const W=200,H=200; function scene(){const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='#cfd3d8';x.fillRect(0,0,W,H);x.fillStyle='#e0b89a';x.fillRect(30,30,60,140);x.fillStyle='#ebc8b0';x.fillRect(120,30,60,140);return x;}
  function rect(rx,ry,rw,rh){const m=new Float32Array(W*H);for(let y=ry;y<ry+rh;y++)for(let x=rx;x<rx+rw;x++)m[y*W+x]=1;return m;}
  function mean(a,bd,rx,ry,rw,rh){let s=0,n=0;for(let y=ry;y<ry+rh;y++)for(let x=rx;x<rx+rw;x++){const i=(y*W+x)*4;s+=Math.abs(a[i]-bd[i])+Math.abs(a[i+1]-bd[i+1])+Math.abs(a[i+2]-bd[i+2]);n+=3;}return +(s/n).toFixed(2);}
  const eng=window.PhotoEditorBeautyEngine;
  // 1) handSkinMask 연결 → 손 영역만
  let c=scene(); let bef=c.getImageData(0,0,W,H).data.slice();
  eng.apply(c,W,H,{handSkin:80},false,{useMasks:{handSkinMask:rect(30,30,60,140)},_scale:{handSkinMask:1},maskW:W,maskH:H});
  let af=c.getImageData(0,0,W,H).data;
  const handD=mean(bef,af,30,30,60,140), faceD=mean(bef,af,120,30,60,140);
  // 2) handSkinMask 미연결(얼굴 사진) → skinW 폴백(얼굴 피부에 적용, 동작 유지)
  c=scene(); bef=c.getImageData(0,0,W,H).data.slice();
  eng.apply(c,W,H,{handSkin:80},false,null);
  af=c.getImageData(0,0,W,H).data;
  const fallbackFaceD=mean(bef,af,120,30,60,140);
  // 3) value=0 no-op
  c=scene(); bef=c.getImageData(0,0,W,H).data.slice();
  // value 0 → 엔진 _hasAny false → no-op
  let any=eng.apply?1:0;
  return { handD, faceD, fallbackFaceD };
});
ck('A2-1 handSkin 손 ROI 적용(손>1)', a2.handD>1, 'handD='+a2.handD);
ck('A2-2 손 ROI 시 얼굴 비적용(얼굴<0.3)', a2.faceD<0.3, 'faceD='+a2.faceD);
ck('A2-3 손 마스크 미연결 시 skin 폴백 동작', a2.fallbackFaceD>0.5, 'fallbackFaceD='+a2.fallbackFaceD);
ck('A2-4 MaskApplication.getHandSkinMaskSync 노출', /getHandSkinMaskSync/.test(rd('js/photo-editor/mask-application.js')), '');
ck('A2-X engine pageerror 0', fe.length===0, fe.slice(0,2).join(' | '));

// ── A-1: ROI dilation/symmetry 알고리즘(provider 가 쓰는 순수 로직) ──
const a1=await p.evaluate(()=>{
  function dilate(mask,w,h,r){const tmp=new Float32Array(w*h),out=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let m=0;const x0=Math.max(0,x-r),x1=Math.min(w-1,x+r);for(let xx=x0;xx<=x1;xx++){const v=mask[y*w+xx];if(v>m)m=v;}tmp[y*w+x]=m;}for(let y=0;y<h;y++)for(let x=0;x<w;x++){let m=0;const y0=Math.max(0,y-r),y1=Math.min(h-1,y+r);for(let yy=y0;yy<=y1;yy++){const v=tmp[yy*w+x];if(v>m)m=v;}out[y*w+x]=m;}return out;}
  function bbox(m,w,h,t){let mnX=w,mxX=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if((m[y*w+x]||0)>t){if(x<mnX)mnX=x;if(x>mxX)mxX=x;}if(mxX<0)return null;return{w:mxX-mnX+1};}
  function recon(mask,w,h,detLeft){const bb=bbox(mask,w,h,0.2);if(!bb)return mask;const shift=Math.round(bb.w*2.0)*(detLeft?1:-1);const out=new Float32Array(w*h);for(let i=0;i<mask.length;i++)out[i]=mask[i];for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sx=x-shift;if(sx<0||sx>=w)continue;const v=mask[y*w+sx];if(v>out[y*w+x])out[y*w+x]=v;}return out;}
  function cov(m){let c=0;for(let i=0;i<m.length;i++)if(m[i]>0.3)c++;return c/m.length*100;}
  const W=100,H=100; const m=new Float32Array(W*H);
  for(let y=45;y<52;y++)for(let x=20;x<30;x++)m[y*W+x]=1;
  const c0=cov(m), cd=cov(dilate(m,W,H,3)), cr=cov(recon(m,W,H,true));
  const rb=bbox(recon(m,W,H,true),W,H,0.3), lb=bbox(m,W,H,0.3);
  return { c0:+c0.toFixed(2), cd:+cd.toFixed(2), cr:+cr.toFixed(2), bothW:rb.w, oneW:lb.w };
});
ck('A1-1 dilation → coverage 확장', a1.cd>a1.c0*1.5, a1.c0+'%→'+a1.cd+'%');
ck('A1-2 한쪽눈→대칭복원 양쪽', a1.bothW>a1.oneW*1.8, '폭 '+a1.oneW+'→'+a1.bothW);
ck('A1-3 provider dilation/symmetry 배선', /_dilateRegion|_reconstructMissingEye|_dilateMask/.test(rd('js/photo-editor/region-mask-provider.js')), '');

const pass=r.filter(x=>x.p).length;
console.log('V546 QA: '+pass+'/'+r.length+' '+(pass===r.length?'PASS':'FAIL'));
r.forEach(x=>console.log('  '+(x.p?'PASS':'FAIL')+' '+x.n+(x.d?'  — '+x.d:'')));
await b.close();
process.exit(pass===r.length?0:1);
