import { chromium } from 'playwright'; import fs from 'fs';
const b=await chromium.launch();const p=await b.newPage();
const html=`<!doctype html><html><body><script src="/app-photo-editor-smart-mask.js"></script><script src="/js/photo-editor/beauty-engine.js"></script></body></html>`;
fs.writeFileSync('output/_diag-nailiso.html',html);
await p.goto('http://localhost:8091/output/_diag-nailiso.html',{waitUntil:'load'});
const out=await p.evaluate(()=>{
  const W=160,H=200; const eng=window.PhotoEditorBeautyEngine;
  function hand(){const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});
    x.fillStyle='#b9bcc2';x.fillRect(0,0,W,H); // 배경(밝은 회색)
    x.fillStyle='#e0b89a';x.fillRect(45,40,70,140); // 손(밝은 살색)
    x.fillStyle='#d6489a';x.fillRect(55,40,12,22);x.fillStyle='#dd3a8a';x.fillRect(72,38,12,20);x.fillStyle='#d6489a';x.fillRect(89,40,12,22); // 손톱(채도 높은 핑크 폴리시)
    return x;}
  function mean(a,bd,rx,ry,rw,rh){let s=0,n=0;for(let y=ry;y<ry+rh;y++)for(let x=rx;x<rx+rw;x++){const i=(y*W+x)*4;s+=Math.abs(a[i]-bd[i])+Math.abs(a[i+1]-bd[i+1])+Math.abs(a[i+2]-bd[i+2]);n+=3;}return +(s/n).toFixed(2);}
  function go(k,v){const c=hand();const bef=c.getImageData(0,0,W,H).data.slice();eng.apply(c,W,H,{[k]:v},false,null);const af=c.getImageData(0,0,W,H).data;
    return {nail:mean(bef,af,55,40,46,22), skin:mean(bef,af,55,120,46,40), bg:mean(bef,af,5,5,30,30)};}
  return {nailGloss:go('nailGloss',100), nailShape:go('nailShape',100)};
});
console.log('nailGloss100: 손톱='+out.nailGloss.nail+' 손피부='+out.nailGloss.skin+' 배경='+out.nailGloss.bg);
console.log('nailShape100: 손톱='+out.nailShape.nail+' 손피부='+out.nailShape.skin+' 배경='+out.nailShape.bg);
console.log('판정 — 손톱에만(손톱>1 & 손피부<0.7 & 배경<0.5):', (out.nailGloss.nail>1 && out.nailGloss.skin<0.7 && out.nailGloss.bg<0.5)?'OK':'FAIL');
await b.close();
