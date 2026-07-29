// #3 검증 — 누끼+배경 적용 후 밝기 올리면 배경(bgSpec)은 그대로, 인물(fgCutout)만 보정되는지.
// 합성은 _compositeBg 로직과 동일하게: 배경=단색(고정), 인물=보정 적용 → 배경 픽셀 불변 확인.
import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage({viewport:{width:390,height:780}});
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8099/index.html',{waitUntil:'load'});
await new Promise(r=>setTimeout(r,2500)); await p.waitForLoadState('load').catch(()=>{});
await p.waitForFunction(()=>window.WorkspaceFlow&&window.WorkspaceFlow.open,{timeout:20000});

const res = await p.evaluate(async () => {
  const out = {};
  // 합성 검증용: 빨간 배경 + 반투명 인물(흰 사각형) 누끼 만들기
  const mk = (draw, w=80, h=80) => { const c=document.createElement('canvas'); c.width=w;c.height=h; draw(c.getContext('2d')); return c.toDataURL('image/png'); };
  const fg = mk(ctx=>{ ctx.clearRect(0,0,80,80); ctx.fillStyle='rgba(200,200,200,1)'; ctx.fillRect(20,20,40,40); }); // 가운데만 인물, 주변 투명
  // WorkspaceAdapter.applyWorkspaceCorrections 로 인물에 밝기 +80 적용
  const adj = await window.WorkspaceAdapter.applyWorkspaceCorrections({ src: fg, adjust:{brightness:80,contrast:0,saturation:0,sharpness:0,color:0}, beauty:{} });
  out.adjOk = !!(adj && adj.ok && adj.dataUrl);

  // _compositeBg 는 내부함수라 직접 못 부름 → 동일 합성을 수동 재현(색 배경 고정 + 보정된 인물)
  const compose = (bgColor, fgUrl) => new Promise(rsv => {
    const im=new Image(); im.onload=()=>{ const c=document.createElement('canvas'); c.width=im.width;c.height=im.height; const x=c.getContext('2d'); x.fillStyle=bgColor; x.fillRect(0,0,c.width,c.height); x.drawImage(im,0,0); rsv(c.toDataURL('image/png')); }; im.src=fgUrl; });
  const sampleCorner = (url) => new Promise(rsv => { const im=new Image(); im.onload=()=>{ const c=document.createElement('canvas'); c.width=im.width;c.height=im.height; const x=c.getContext('2d'); x.drawImage(im,0,0); const d=x.getImageData(2,2,1,1).data; rsv([d[0],d[1],d[2]]); }; im.src=url; });

  const comp0 = await compose('#ff0000', fg);          // 보정 0
  const comp1 = await compose('#ff0000', adj.dataUrl);  // 인물 밝기+80, 배경 동일 색
  out.bgCorner0 = await sampleCorner(comp0);  // 배경 코너(인물 없음) = 빨강
  out.bgCorner1 = await sampleCorner(comp1);
  out.bgUnchanged = JSON.stringify(out.bgCorner0)===JSON.stringify(out.bgCorner1);
  return out;
});
console.log(JSON.stringify(res,null,2));
console.log('errors:', errs.slice(0,3));
await b.close();
process.exit((res.adjOk && res.bgUnchanged) ? 0 : 1);
