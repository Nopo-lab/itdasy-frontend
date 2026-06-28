import { chromium } from 'playwright'; import fs from 'fs';
const b=await chromium.launch();const p=await b.newPage();
const html=`<!doctype html><html><body><script src="/app-photo-editor-smart-mask.js"></script><script src="/js/photo-editor/beauty-engine.js"></script></body></html>`;
fs.writeFileSync('output/_diag-handnail.html',html);
await p.goto('http://localhost:8091/output/_diag-handnail.html',{waitUntil:'load'});
const out=await p.evaluate(()=>{
  const W=160,H=200; const eng=window.PhotoEditorBeautyEngine; const SM=window.PhotoEditorSmartMask;
  function scene(){const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});
    x.fillStyle='#b9bcc2';x.fillRect(0,0,W,H); // 배경
    x.fillStyle='#e0b89a';x.fillRect(45,40,70,140); // 손(살색)
    x.fillStyle='#d98aa0';x.fillRect(55,40,12,22);x.fillStyle='#dd92a6';x.fillRect(72,38,12,20);x.fillStyle='#d98aa0';x.fillRect(89,40,12,22); // 손톱 3개(분홍/광택)
    return x;}
  function mean(a,bd,rx,ry,rw,rh){let s=0,n=0;for(let y=ry;y<ry+rh;y++)for(let x=rx;x<rx+rw;x++){const i=(y*W+x)*4;s+=Math.abs(a[i]-bd[i])+Math.abs(a[i+1]-bd[i+1])+Math.abs(a[i+2]-bd[i+2]);n+=3;}return +(s/n).toFixed(2);}
  // SmartMask 분류 샘플(손 픽셀, 손톱 픽셀)
  function cls(px,py){const c=scene();const d=c.getImageData(px,py,1,1).data;const r=d[0],g=d[1],bl=d[2];const lum=r*.299+g*.587+bl*.114;return SM.classify({r,g,b:bl,lum,maxCh:Math.max(r,g,bl),minCh:Math.min(r,g,bl),x:px,y:py,w:W,h:H});}
  const handCls=cls(70,120), nailCls=cls(61,50);
  const res={ handSkinClass:+(handCls.skin||0).toFixed(2), nailScore:+(nailCls.nail||0).toFixed(2) };
  // 무마스크 handSkin/nailGloss 적용 델타(손/손톱 영역)
  [['handSkin',45,90,70,80],['nailGloss',55,40,46,22],['nailShape',55,40,46,22]].forEach(([k,rx,ry,rw,rh])=>{
    [50,100].forEach(v=>{const c=scene();const bef=c.getImageData(0,0,W,H).data.slice();eng.apply(c,W,H,{[k]:v},false,null);const af=c.getImageData(0,0,W,H).data;res[k+'_'+v]=mean(bef,af,rx,ry,rw,rh);});
  });
  return res;
});
console.log(JSON.stringify(out,null,1));
await b.close();
