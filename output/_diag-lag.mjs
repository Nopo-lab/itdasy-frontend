import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const html=`<!doctype html><html><body>
<script src="/app-photo-editor-smart-mask.js"></script>
<script src="/js/photo-editor/beauty-engine.js"></script>
<script src="/js/workspace/workspace-adapter.js"></script>
</body></html>`;
import fs from 'fs'; fs.writeFileSync('output/_diag-lag.html', html);
await p.goto('http://localhost:8091/output/_diag-lag.html',{waitUntil:'load'});
const out = await p.evaluate(async () => {
  // 큰 인물풍 이미지 합성
  const W=2000,H=2600; const cv=document.createElement('canvas'); cv.width=W;cv.height=H;
  const c=cv.getContext('2d'); c.fillStyle='#cfd3d8'; c.fillRect(0,0,W,H);
  c.fillStyle='#ebc8b0'; c.fillRect(400,300,1200,1700); // skin
  c.fillStyle='#4a3526'; c.fillRect(450,200,1100,400);  // hair
  const src=cv.toDataURL('image/jpeg',0.9);
  const WA=window.WorkspaceAdapter;
  if (!WA || !WA.applyWorkspaceCorrections) return {err:'no adapter'};
  const beauty={ skin:60, hairShine:60, blemish:40, textureSmooth:50 };
  async function timeIt(previewMaxPx){
    const t0=performance.now();
    const r=await WA.applyWorkspaceCorrections({ src, adjust:{}, beauty, previewMaxPx, maskKey:'k'+(previewMaxPx||'full') });
    const t=performance.now()-t0;
    // 출력 dims
    const im=new Image(); await new Promise(res=>{im.onload=res; im.src=r.dataUrl;});
    return { ok:r.ok, ms:Math.round(t), dim:im.naturalWidth+'x'+im.naturalHeight };
  }
  const full=await timeIt(0);
  const prev=await timeIt(1100);
  return { full, prev };
});
console.log(JSON.stringify(out,null,2));
if(errs.length) console.log('ERR',errs.slice(0,3));
await b.close();
