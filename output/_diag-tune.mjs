// 마스크 주입 실측 — 16종 효과의 0/50/100 mask-mean delta + 마스크밖 오염
import { chromium } from 'playwright';
const b=await chromium.launch();const p=await b.newPage();
const html=`<!doctype html><html><body><script src="/app-photo-editor-smart-mask.js"></script><script src="/js/photo-editor/beauty-engine.js"></script></body></html>`;
import fs from 'fs'; fs.writeFileSync('output/_diag-tune.html',html);
await p.goto('http://localhost:8091/output/_diag-tune.html',{waitUntil:'load'});
const out=await p.evaluate(()=>{
  const W=240,H=300;
  function scene(){
    const cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d',{willReadFrequently:true});
    c.fillStyle='#c9ccd2';c.fillRect(0,0,W,H);
    // hair (위)
    c.fillStyle='#4a3526';c.fillRect(50,20,140,90);
    // skin face
    c.fillStyle='#ebc8b0';c.fillRect(60,100,120,110);
    // 결/잡티 노이즈
    let im=c.getImageData(50,20,140,190),d=im.data,s=7;for(let i=0;i<d.length;i+=4){s=(s*1103515245+12345)&0x7fffffff;const n=((s%100)-50)/50*11;d[i]+=n;d[i+1]+=n;d[i+2]+=n;}c.putImageData(im,50,20);
    c.fillStyle='#c3a48f';[[100,150],[130,170],[90,180]].forEach(([x,y])=>c.fillRect(x,y,5,5)); // 잡티
    // eye 흰자+홍채 (양쪽)
    c.fillStyle='#f0dada';c.fillRect(75,120,28,12);c.fillStyle='#5a4030';c.beginPath();c.arc(89,126,5,0,7);c.fill();
    c.fillStyle='#f0dada';c.fillRect(137,120,28,12);c.fillStyle='#5a4030';c.beginPath();c.arc(151,126,5,0,7);c.fill();
    // 눈썹
    c.fillStyle='#3a2a22';c.fillRect(75,110,28,4);c.fillRect(137,110,28,4);
    // 입술
    c.fillStyle='#b84a52';c.fillRect(105,195,30,10);
    // nail (아래 손톱)
    c.fillStyle='#d98aa0';c.fillRect(95,250,50,30);
    return c;
  }
  function rect(roi){const m=new Float32Array(W*H);for(let y=roi.y;y<roi.y+roi.h;y++)for(let x=roi.x;x<roi.x+roi.w;x++)m[y*W+x]=1;return m;}
  const R={hair:{x:50,y:20,w:140,h:90},skin:{x:60,y:100,w:120,h:110},eye:{x:75,y:118,w:90,h:18},brow:{x:75,y:108,w:90,h:8},nail:{x:95,y:250,w:50,h:30},bg:{x:4,y:4,w:30,h:30}};
  const masks={ useMasks:{ skinMask:rect(R.skin), hairMask:rect(R.hair), eyeMask:rect(R.eye), scleraMask:rect(R.eye), nailMask:rect(R.nail) }, _scale:{scleraMask:1,nailMask:1}, browMask:rect(R.brow), browScale:1, lashMask:rect(R.eye), lashScale:1, maskW:W,maskH:H };
  function mean(a,bd,roi){let s=0,n=0;for(let y=roi.y;y<roi.y+roi.h;y++)for(let x=roi.x;x<roi.x+roi.w;x++){const i=(y*W+x)*4;s+=Math.abs(a[i]-bd[i])+Math.abs(a[i+1]-bd[i+1])+Math.abs(a[i+2]-bd[i+2]);n+=3;}return +(s/n).toFixed(2);}
  const eng=window.PhotoEditorBeautyEngine;
  const FX={ skin:'skin',textureSmooth:'skin',blemish:'skin',hairDetail:'hair',hairVolume:'hair',hairShine:'hair',hairFull:'hair',hairEndsClean:'hair',browSharp:'brow',lashSharp:'eye',eyeRedness:'eye',catchLight:'eye',nailGloss:'nail',nailShape:'nail',handSkin:'skin' };
  const res={};
  Object.keys(FX).forEach(k=>{
    const roi=R[FX[k]]; const row={};
    [0,50,100].forEach(v=>{
      const c=scene(); const before=c.getImageData(0,0,W,H).data.slice();
      const beauty={}; beauty[k]=v; if(v!==0) eng.apply(c,W,H,beauty,false,masks);
      const after=c.getImageData(0,0,W,H).data;
      row['v'+v]=mean(before,after,roi); if(v===100) row.bg=mean(before,after,R.bg);
    });
    res[k]=row;
  });
  return res;
});
const tgt={skin:[1.5,3],textureSmooth:[1,3],hairDetail:[1.5,3],hairVolume:[2,4],hairShine:[3,6],hairFull:[2,4],hairEndsClean:[1,2],browSharp:[1,2],lashSharp:[1.5,3],eyeRedness:[1,2],catchLight:[1,1.5],nailGloss:[2,4],nailShape:[1.5,3],handSkin:[1.5,3],blemish:[0,99]};
console.log('효과'.padEnd(16),'0/50/100'.padEnd(22),'bg','목표50~','판정');
Object.keys(out).forEach(k=>{const r=out[k];const t=tgt[k]||[0,0];const ok=r.v0===0 && r.v50>=t[0]*0.6 && r.v100>r.v50;console.log(k.padEnd(16),(r.v0+'/'+r.v50+'/'+r.v100).padEnd(22),String(r.bg).padEnd(4),(t[0]+'~').padEnd(6),ok?'OK':'약함');});
await b.close();
