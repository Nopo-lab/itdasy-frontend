import { chromium } from 'playwright'; import fs from 'fs';
const b=await chromium.launch();const p=await b.newPage();
const html=`<!doctype html><html><body><script src="/app-photo-editor-smart-mask.js"></script><script src="/js/photo-editor/beauty-engine.js"></script></body></html>`;
fs.writeFileSync('output/_diag-eye3.html',html);
await p.goto('http://localhost:8091/output/_diag-eye3.html',{waitUntil:'load'});
const out=await p.evaluate(()=>{
  const W=120,H=120; const eng=window.PhotoEditorBeautyEngine;
  function scene(){const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});
    x.fillStyle='#ebc8b0';x.fillRect(0,0,W,H); // 피부
    x.fillStyle='#f0dede';x.fillRect(40,50,50,18); // 충혈 흰자(붉은기, r>g>b)
    return x;}
  function fm(rx,ry,rw,rh){const m=new Float32Array(W*H);for(let y=ry;y<ry+rh;y++)for(let x=rx;x<rx+rw;x++)m[y*W+x]=1;return m;}
  const masks={useMasks:{scleraMask:fm(40,50,50,18),eyeMask:fm(40,50,50,18)},_scale:{scleraMask:1},maskW:W,maskH:H};
  function sample(c){const d=c.getImageData(60,58,1,1).data;return {r:d[0],g:d[1],b:d[2]};}
  const res={};
  [0,50,100].forEach(v=>{const c=scene();if(v!==0)eng.apply(c,W,H,{eyeRedness:v},false,masks);res['v'+v]=sample(c);});
  return res;
});
console.log('충혈 흰자 픽셀 R/G/B (0/50/100):');
[0,50,100].forEach(v=>{const s=out['v'+v];console.log('  '+v+': r='+s.r+' g='+s.g+' b='+s.b+(v>0?(s.b<=Math.max(s.r,s.g)?' → B 비우세(파란색 아님) OK':' → ❌ 파란 cast'):''));});
const o=out.v0,h=out.v100;
console.log('붉은기 완화: R '+o.r+'→'+h.r+(h.r<o.r?' OK':' FAIL'));
console.log('파란 cast 차단: B('+h.b+') ≤ max(R,G)('+Math.max(h.r,h.g)+') →',h.b<=Math.max(h.r,h.g)?'PASS':'FAIL');
await b.close();
