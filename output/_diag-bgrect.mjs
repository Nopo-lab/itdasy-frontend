import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const html=`<!doctype html><html><body><script src="/app-photo-editor-bg-compose.js"></script></body></html>`;
import fs from 'fs'; fs.writeFileSync('output/_diag-bgrect.html', html);
await p.goto('http://localhost:8091/output/_diag-bgrect.html',{waitUntil:'load'});
const out = await p.evaluate(async () => {
  function person(w,h){ const c=document.createElement('canvas'); c.width=w;c.height=h; const x=c.getContext('2d'); x.clearRect(0,0,w,h); x.fillStyle='rgba(200,150,120,1)'; x.fillRect(w*0.3,h*0.2,w*0.4,h*0.7); return c.toDataURL('image/png'); }
  const BC=window.PhotoEditorBgCompose;
  if(!BC||!BC.compose) return {err:'no compose'};
  const personUrl = person(1200,1600); // 3:4 인물
  const bg = { type:'procedural', color:'#ffffff' };
  async function dimOf(url){ const im=new Image(); await new Promise(r=>{im.onload=r;im.src=url;}); return im.naturalWidth+'x'+im.naturalHeight; }
  // 1) 배경 '적용' (preRemovedBgUrl=person → 매팅 스킵), ratio 4:5
  const apply = await BC.compose({ srcUrl: personUrl, preRemovedBgUrl: personUrl, bg, targetRatio:'4:5' });
  const applyDim = await dimOf(apply.composedDataUrl);
  // 2) 직후 슬라이드 재합성 (보정된 fg=person 가정, 동일 경로)
  const recomp = await BC.compose({ srcUrl: personUrl, preRemovedBgUrl: personUrl, bg, targetRatio:'4:5' });
  const recompDim = await dimOf(recomp.composedDataUrl);
  // 3) (대조군) 과거 방식: fg 원본 크기로 합성 → 3:4 (불일치 예상)
  return { applyDim, recompDim, match: applyDim===recompDim, fgNative:'1200x1600(3:4)' };
});
console.log(JSON.stringify(out,null,2));
if(errs.length) console.log('ERR',errs.slice(0,3));
await b.close();
