import { chromium } from 'playwright';
const b=await chromium.launch();const p=await b.newPage();
await p.goto('http://localhost:8091/output/_diag-maskeffect.html',{waitUntil:'load'});
const out=await p.evaluate(()=>{
  const W=160,H=160; const eng=window.PhotoEditorBeautyEngine;
  function scene(){const cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d',{willReadFrequently:true});
    c.fillStyle='#ebc8b0';c.fillRect(0,0,W,H); // 얼굴 피부 전면
    c.fillStyle='#f0dada';c.fillRect(50,60,60,20); // 충혈 흰자(밝은 핑크)
    c.fillStyle='#5a4030';c.beginPath();c.arc(80,70,7,0,7);c.fill(); // 홍채
    return {cv,c, eyeRoi:{x:50,y:60,w:60,h:20}, skinRoi:{x:5,y:5,w:30,h:30}};}
  function fm(roi){const m=new Float32Array(W*H);for(let y=roi.y;y<roi.y+roi.h;y++)for(let x=roi.x;x<roi.x+roi.w;x++)m[y*W+x]=1;return m;}
  function mean(a,bd,roi){let s=0,n=0;for(let y=roi.y;y<roi.y+roi.h;y++)for(let x=roi.x;x<roi.x+roi.w;x++){const i=(y*W+x)*4;s+=Math.abs(a[i]-bd[i])+Math.abs(a[i+1]-bd[i+1])+Math.abs(a[i+2]-bd[i+2]);n+=3;}return +(s/n).toFixed(2);}
  const res={};
  for(const v of [0,50,100]){const S=scene();const before=S.c.getImageData(0,0,W,H).data.slice();
    const eye=fm(S.eyeRoi);const masks={useMasks:{scleraMask:eye,eyeMask:eye},_scale:{scleraMask:1},maskW:W,maskH:H};
    eng.apply(S.c,W,H,{eyeRedness:v},false,masks);const after=S.c.getImageData(0,0,W,H).data;
    res['v'+v]={eye:mean(before,after,S.eyeRoi),skin:mean(before,after,S.skinRoi)};}
  return res;
});
console.log('eyeRedness (realistic pink sclera):',JSON.stringify(out));
await b.close();
