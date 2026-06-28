import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const html=`<!doctype html><html><body>
<script src="/app-photo-editor-smart-mask.js"></script>
<script src="/js/photo-editor/beauty-engine.js"></script>
</body></html>`;
import fs from 'fs'; fs.writeFileSync('output/_diag-maskeffect.html', html);
await p.goto('http://localhost:8091/output/_diag-maskeffect.html',{waitUntil:'load'});
const out = await p.evaluate(() => {
  const W=256,H=256;
  function face(){ const cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d',{willReadFrequently:true});
    c.fillStyle='#c9ccd2'; c.fillRect(0,0,W,H);
    c.fillStyle='#ebc8b0'; c.fillRect(56,40,144,180);              // skin
    // 결: 고주파 노이즈
    let img=c.getImageData(56,40,144,180),d=img.data,s=7; for(let i=0;i<d.length;i+=4){s=(s*1103515245+12345)&0x7fffffff;const n=((s%100)-50)/50*12;d[i]+=n;d[i+1]+=n;d[i+2]+=n;} c.putImageData(img,56,40);
    c.fillStyle='#c3a48f'; [[110,120],[140,150],[96,160],[150,100]].forEach(([x,y])=>c.fillRect(x,y,5,5)); // 잡티 점
    c.fillStyle='#f2efe9'; c.fillRect(96,92,64,14); // 흰자
    c.fillStyle='#d0968e'; c.fillRect(105,96,8,8); // 붉은 눈
    return {cv,c, skinRoi:{x:56,y:40,w:144,h:180}, spots:[[110,120],[140,150],[96,160],[150,100]], eyeRoi:{x:96,y:92,w:64,h:14}, bgRoi:{x:4,y:4,w:30,h:30}}; }
  function fullMask(roi){ const m=new Float32Array(W*H); for(let y=roi.y;y<roi.y+roi.h;y++)for(let x=roi.x;x<roi.x+roi.w;x++)m[y*W+x]=1; return m; }
  function meanRoi(a,bd,roi){let s=0,n=0;for(let y=roi.y;y<roi.y+roi.h;y++)for(let x=roi.x;x<roi.x+roi.w;x++){const i=(y*W+x)*4;s+=Math.abs(a[i]-bd[i])+Math.abs(a[i+1]-bd[i+1])+Math.abs(a[i+2]-bd[i+2]);n+=3;}return +(s/n).toFixed(2);}
  function spotMean(a,bd,spots){let s=0,n=0;spots.forEach(([px,py])=>{for(let y=py;y<py+5;y++)for(let x=px;x<px+5;x++){const i=(y*W+x)*4;s+=Math.abs(a[i]-bd[i])+Math.abs(a[i+1]-bd[i+1])+Math.abs(a[i+2]-bd[i+2]);n+=3;}});return +(s/n).toFixed(2);}
  const eng=window.PhotoEditorBeautyEngine; const res={};
  function run(beautyKey, vals, roiKey){
    const out2={};
    for(const v of vals){
      const F=face(); const before=F.c.getImageData(0,0,W,H).data.slice();
      const skin=fullMask(F.skinRoi), eye=fullMask(F.eyeRoi);
      const masks={ useMasks:{ skinMask:skin, eyeMask:eye, scleraMask:eye }, _scale:{ scleraMask:1 }, maskW:W, maskH:H };
      const beauty={}; beauty[beautyKey]=v;
      eng.apply(F.c, W, H, beauty, false, masks);
      const after=F.c.getImageData(0,0,W,H).data;
      out2['v'+v]={ skin:meanRoi(before,after,F.skinRoi), spot:spotMean(before,after,F.spots), eye:meanRoi(before,after,F.eyeRoi), bg:meanRoi(before,after,F.bgRoi) };
    }
    return out2;
  }
  res.textureSmooth=run('textureSmooth',[0,50,100]);
  res.blemish=run('blemish',[0,50,100]);
  res.eyeRedness=run('eyeRedness',[0,50,100]);
  return res;
});
console.log(JSON.stringify(out,null,1));
if(errs.length)console.log('ERR',errs.slice(0,3));
await b.close();
