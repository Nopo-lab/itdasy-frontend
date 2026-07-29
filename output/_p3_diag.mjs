// P3 diag — real beauty-engine in headless chromium. NEW vs OLD(HEAD) 비교로 P3-2/P3-3 효과 검증.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const smart = readFileSync('app-photo-editor-smart-mask.js', 'utf8');
const engineNew = readFileSync('js/photo-editor/beauty-engine.js', 'utf8');
// 직전 커밋(변경 전) 엔진 — 글로벌명 바꿔 동시 로드
const engineOldRaw = execSync('git show HEAD:js/photo-editor/beauty-engine.js', { encoding: 'utf8' });
const engineOld = engineOldRaw.replace(/PhotoEditorBeautyEngine/g, 'PhotoEditorBeautyEngineOLD');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.addScriptTag({ content: smart });
await page.addScriptTag({ content: engineOld });
await page.addScriptTag({ content: engineNew });

const out = await page.evaluate(() => {
  const W = 200, H = 200;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  // 살색 베이스 + 미세 결 노이즈 + 어두운 잡티 4점
  const img = ctx.createImageData(W, H);
  const d = img.data;
  function setpx(x, y, r, g, b) { const i = (y * W + x) * 4; d[i] = r; d[i+1] = g; d[i+2] = b; d[i+3] = 255; }
  let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = (rnd() - 0.5) * 14;  // 미세 결
    setpx(x, y, 212 + n, 172 + n, 150 + n);
  }
  // 잡티(어두운 점) — 실제 잡티(작고 또렷, 3px, 주변보다 ~40 어두움). 작아서 wide-blur 가 주변 피부톤 잘 추정.
  const spots = [[80,80],[120,80],[80,120],[120,120]];   // 중앙권(subject 높음) + 40px 간격(wide-blur 오염 방지)
  for (const [cx, cy] of spots) for (let dy=-1; dy<=1; dy++) for (let dx=-1; dx<=1; dx++) {
    if (dx*dx+dy*dy>2) continue; setpx(cx+dx, cy+dy, 172, 132, 110);
  }
  ctx.putImageData(img, 0, 0);

  const orig = ctx.getImageData(0, 0, W, H).data;
  const meanLum = (data) => { let s=0,n=0; for (let i=0;i<data.length;i+=4){ s += data[i]*0.299+data[i+1]*0.587+data[i+2]*0.114; n++; } return s/n; };
  const spotLum = (data) => { let s=0,n=0; for (const [cx,cy] of spots){ const i=(cy*W+cx)*4; s += data[i]*0.299+data[i+1]*0.587+data[i+2]*0.114; n++; } return s/n; };

  const origMean = meanLum(orig);
  const origGap = origMean - spotLum(orig);
  const run = (eng, b) => { const c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d'); x.putImageData(new ImageData(new Uint8ClampedArray(orig), W, H),0,0); eng.apply(x, W, H, b, false, null); return x.getImageData(0,0,W,H).data; };

  // P3-2: textureSmooth 단독 — OLD 는 톤다운(평균↓), NEW 는 lift 로 유지/상승
  const texOld = meanLum(run(window.PhotoEditorBeautyEngineOLD, { textureSmooth: 70 }));
  const texNew = meanLum(run(window.PhotoEditorBeautyEngine,    { textureSmooth: 70 }));
  // P3-3: blemish 단독 — gap 축소가 NEW 에서 더 커야
  const bOld = run(window.PhotoEditorBeautyEngineOLD, { blemish: 80 });
  const bNew = run(window.PhotoEditorBeautyEngine,    { blemish: 80 });
  const gapOld = meanLum(bOld) - spotLum(bOld);
  const gapNew = meanLum(bNew) - spotLum(bNew);
  return {
    origMean:+origMean.toFixed(2), origGap:+origGap.toFixed(2),
    texOld:+texOld.toFixed(2), texNew:+texNew.toFixed(2),
    gapOld:+gapOld.toFixed(2), gapNew:+gapNew.toFixed(2),
    redOld:+(100*(1-gapOld/origGap)).toFixed(1), redNew:+(100*(1-gapNew/origGap)).toFixed(1),
  };
});

console.log(JSON.stringify(out, null, 2));
// P3-2: NEW 가 OLD 보다 덜 어둡게(톤다운 완화) + 원본 대비 하락 없음
const p3_2_pass = out.texNew > out.texOld && out.texNew >= out.origMean - 0.3;
// P3-3: NEW 의 잡티 격차 축소가 OLD 보다 큼(약함 보강)
const p3_3_pass = out.redNew >= out.redOld + 4;
console.log('P3-2 (anti-톤다운):', p3_2_pass ? 'PASS' : 'FAIL', `(OLD ${out.texOld} → NEW ${out.texNew}, orig ${out.origMean})`);
console.log('P3-3 (잡티 강화):', p3_3_pass ? 'PASS' : 'FAIL', `(gap축소 OLD -${out.redOld}% → NEW -${out.redNew}%)`);
await browser.close();
process.exit(p3_2_pass && p3_3_pass ? 0 : 1);
