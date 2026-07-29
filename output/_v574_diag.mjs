// v574 diag — real engine NEW vs OLD(HEAD). ease 가시성 / 눈 containment / 헤어 통합.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const smart = readFileSync('app-photo-editor-smart-mask.js', 'utf8');
const engineNew = readFileSync('js/photo-editor/beauty-engine.js', 'utf8');
const engineOld = execSync('git show HEAD:js/photo-editor/beauty-engine.js', { encoding: 'utf8' })
  .replace(/PhotoEditorBeautyEngine/g, 'PhotoEditorBeautyEngineOLD');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.addScriptTag({ content: smart });
await page.addScriptTag({ content: engineOld });
await page.addScriptTag({ content: engineNew });

const out = await page.evaluate(() => {
  const W = 160, H = 160;
  function build(kind) {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'); const img = ctx.createImageData(W, H); const d = img.data;
    let s = 999; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4; const n = (rnd() - 0.5) * 12; let r, g, b;
      if (kind === 'hair') { r = 64 + n; g = 58 + n; b = 52 + n; }          // 어두운 중성 머리톤
      else { r = 212 + n; g = 172 + n; b = 150 + n; }                        // 살색
      d[i] = r; d[i+1] = g; d[i+2] = b; d[i+3] = 255;
    }
    if (kind === 'face') {                                                    // 눈 밴드(ny≈0.42)에 밝은 흰자/캐치 후보
      for (const cx of [56, 104]) for (let dy=-5; dy<=5; dy++) for (let dx=-9; dx<=9; dx++) {
        const x=cx+dx, y=Math.round(0.42*H)+dy, i=(y*W+x)*4; d[i]=235; d[i+1]=235; d[i+2]=238;
      }
    }
    ctx.putImageData(img, 0, 0); return ctx.getImageData(0,0,W,H).data;
  }
  const run = (eng, base, b) => { const c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d'); x.putImageData(new ImageData(new Uint8ClampedArray(base), W, H),0,0); eng.apply(x, W, H, b, false, null); return x.getImageData(0,0,W,H).data; };
  const diffSum = (a, b) => { let s=0; for (let i=0;i<a.length;i+=4){ s+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]); } return s; };

  const hair = build('hair'), face = build('face');
  const ENG = window.PhotoEditorBeautyEngine, OLD = window.PhotoEditorBeautyEngineOLD;

  // (A) ease 가시성 — hairShine 35 중간값: NEW(eased) 변화량 > OLD(linear)
  const aOld = diffSum(hair, run(OLD, hair, { hairShine: 35 }));
  const aNew = diffSum(hair, run(ENG, hair, { hairShine: 35 }));

  // (B) 눈 containment — eyeMask 없음(regionMasks=null). catchLight/irisClear 가 OLD 는 눈밴드 누출, NEW 는 0
  const bOldCatch = diffSum(face, run(OLD, face, { catchLight: 80 }));
  const bNewCatch = diffSum(face, run(ENG, face, { catchLight: 80 }));
  const bOldIris  = diffSum(face, run(OLD, face, { irisClear: 80 }));
  const bNewIris  = diffSum(face, run(ENG, face, { irisClear: 80 }));

  // (C) 헤어 통합 — NEW 에서 hairVolume 와 hairFull(레거시) 가 같은 효과(흡수)
  const cVol  = diffSum(hair, run(ENG, hair, { hairVolume: 60 }));
  const cFull = diffSum(hair, run(ENG, hair, { hairFull: 60 }));

  // (D) containment 이 기능을 죽이지 않음 — eyeMask 제공 시 catchLight 가 실제로 적용(>0)
  const eyeMask = new Float32Array(W * H);
  for (const cx of [56, 104]) for (let dy=-5; dy<=5; dy++) for (let dx=-9; dx<=9; dx++) { const x=cx+dx, y=Math.round(0.42*H)+dy; eyeMask[y*W+x] = 1; }
  const rm = { useMasks: { eyeMask }, _scale: { eyeMask: 1 }, maskW: W, maskH: H };
  const runM = (b) => { const c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d'); x.putImageData(new ImageData(new Uint8ClampedArray(face), W, H),0,0); ENG.apply(x, W, H, b, false, rm); return x.getImageData(0,0,W,H).data; };
  const dCatchMasked = diffSum(face, runM({ catchLight: 80 }));

  return {
    withMask: { catchMasked: dCatchMasked },
    ease: { old: aOld, new: aNew, ratio: aOld>0 ? +(aNew/aOld).toFixed(2) : null },
    catch: { old: bOldCatch, new: bNewCatch },
    iris: { old: bOldIris, new: bNewIris },
    hairMerge: { vol: cVol, full: cFull, symmetric: cVol>0 && Math.abs(cVol-cFull) < cVol*0.02 },
  };
});

console.log(JSON.stringify(out, null, 2));
const easePass = out.ease.ratio >= 1.2;                               // 중간값 20%+ 강화
const catchPass = out.catch.new === 0 && out.catch.old > 0;          // 마스크 없으면 누출 0
const irisPass  = out.iris.new === 0 && out.iris.old > 0;
const mergePass = out.hairMerge.symmetric && out.hairMerge.vol > 0;  // 볼륨감 하나로 통합(대칭)
const withMaskPass = out.withMask.catchMasked > 0;                   // 마스크 있으면 기능 정상 동작
console.log('ease 가시성:', easePass ? 'PASS' : 'FAIL', `(OLD ${out.ease.old} → NEW ${out.ease.new}, x${out.ease.ratio})`);
console.log('눈 밝게 containment:', catchPass ? 'PASS' : 'FAIL', `(누출 OLD ${out.catch.old} → NEW ${out.catch.new})`);
console.log('눈동자 또렷 containment:', irisPass ? 'PASS' : 'FAIL', `(누출 OLD ${out.iris.old} → NEW ${out.iris.new})`);
console.log('헤어 볼륨/풍성 통합:', mergePass ? 'PASS' : 'FAIL', `(vol ${out.hairMerge.vol} == full ${out.hairMerge.full})`);
console.log('마스크 있으면 눈효과 동작:', withMaskPass ? 'PASS' : 'FAIL', `(catchLight w/eyeMask=${out.withMask.catchMasked})`);
await browser.close();
process.exit(easePass && catchPass && irisPass && mergePass && withMaskPass ? 0 : 1);
