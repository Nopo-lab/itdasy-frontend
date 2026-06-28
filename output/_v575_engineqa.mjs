// v575 engine QA — 실엔진 OLD(HEAD) vs NEW. 잡티(붉은점) 검출 / morphology export 활성화 검증.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
const smart = readFileSync('app-photo-editor-smart-mask.js', 'utf8');
const refineNew = readFileSync('js/photo-editor/mask-refine.js', 'utf8');
const engineNew = readFileSync('js/photo-editor/beauty-engine.js', 'utf8');
const engineOld = execSync('git show HEAD:js/photo-editor/beauty-engine.js', { encoding: 'utf8' })
  .replace(/PhotoEditorBeautyEngine/g, 'PhotoEditorBeautyEngineOLD');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.addScriptTag({ content: smart });
await page.addScriptTag({ content: refineNew });
await page.addScriptTag({ content: engineOld });
await page.addScriptTag({ content: engineNew });

const out = await page.evaluate(() => {
  const W = 200, H = 200;
  // 균일 피부 + 작은 '붉은 잡티' 점들(주변보다 r 높음) + 작은 어두운 점들
  function build() {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'); const img = ctx.createImageData(W, H); const d = img.data;
    let s = 7; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4; const n = (rnd() - 0.5) * 6;
      d[i] = 205 + n; d[i + 1] = 170 + n; d[i + 2] = 150 + n; d[i + 3] = 255;   // 피부톤
    }
    // 붉은 잡티(여드름) 12개 — 반경 3px, r +45
    const spots = [];
    for (let k = 0; k < 12; k++) {
      const cx = 20 + ((rnd() * (W - 40)) | 0), cy = 20 + ((rnd() * (H - 40)) | 0);
      spots.push([cx, cy]);
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        if (dx * dx + dy * dy > 9) continue;
        const x = cx + dx, y = cy + dy, i = (y * W + x) * 4;
        d[i] = Math.min(255, d[i] + 45); d[i + 1] = Math.max(0, d[i + 1] - 8); d[i + 2] = Math.max(0, d[i + 2] - 8);
      }
    }
    ctx.putImageData(img, 0, 0);
    return { ctx, spots };
  }
  // 붉은 잡티 영역의 '주변대비 붉은기' 평균 — 작을수록 잡티가 옅어짐(개선)
  function redBumpAt(ctx, spots) {
    const d = ctx.getImageData(0, 0, W, H).data;
    let sum = 0, cnt = 0;
    for (const [cx, cy] of spots) {
      const i = (cy * W + cx) * 4; const spotRed = d[i] - (d[i + 1] + d[i + 2]) / 2;
      // 주변(반경 10) 평균 붉은기
      let nr = 0, nc = 0;
      for (let dy = -10; dy <= 10; dy += 2) for (let dx = -10; dx <= 10; dx += 2) {
        const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const j = (y * W + x) * 4; nr += d[j] - (d[j + 1] + d[j + 2]) / 2; nc++;
      }
      sum += spotRed - (nr / nc); cnt++;
    }
    return sum / cnt;
  }
  const skinMask = new Float32Array(W * H).fill(1);
  const masks = { useMasks: { skinMask }, _scale: { skinMask: 1 }, maskW: W, maskH: H };
  const beauty = { blemish: 100 };

  const a = build(); const base = redBumpAt(a.ctx, a.spots);
  const b1 = build(); window.PhotoEditorBeautyEngineOLD.apply(b1.ctx, W, H, beauty, false, masks); const oldR = redBumpAt(b1.ctx, b1.spots);
  const b2 = build(); window.PhotoEditorBeautyEngine.apply(b2.ctx, W, H, beauty, false, masks); const newR = redBumpAt(b2.ctx, b2.spots);

  // morphology export 활성화 확인
  const RF = window.MaskRefine;
  const morphOk = !!(RF && RF.openMask && RF.closeMask && RF.erodeMask && RF.dilateMask);
  let morphRuns = false;
  try { const m = new Float32Array(64); m[20] = 1; RF.closeMask(RF.openMask(m, 8, 8, 1), 8, 8, 1); morphRuns = true; } catch (_e) { morphRuns = false; }

  return { base: +base.toFixed(1), oldR: +oldR.toFixed(1), newR: +newR.toFixed(1), morphOk, morphRuns };
});
await browser.close();

const results = [];
const ok = (n, c, d='') => results.push({ n, pass: !!c, d });
ok('붉은 잡티 — 원본 대비 붉은기 ' + out.base, out.base > 10);
ok('OLD 엔진: 붉은 잡티 거의 무반응(' + out.oldR + ' ≈ base ' + out.base + ')', Math.abs(out.oldR - out.base) < 4, 'old=' + out.oldR);
ok('NEW 엔진: 붉은 잡티 옅어짐(' + out.newR + ' < OLD ' + out.oldR + ')', out.newR < out.oldR - 5, 'new=' + out.newR + ' old=' + out.oldR);
ok('morphology export 활성화(openMask/closeMask)', out.morphOk);
ok('morphology 실행 가능(네일 마스크 정리 코드 살아남)', out.morphRuns);
let pass = 0, fail = 0;
console.log('\n===== v575 engine QA =====');
console.log('붉은잡티 주변대비 붉은기: base=' + out.base + '  OLD=' + out.oldR + '  NEW=' + out.newR);
for (const r of results) { console.log((r.pass ? 'PASS' : 'FAIL') + '  ' + r.n + (r.d && !r.pass ? '  → ' + r.d : '')); r.pass ? pass++ : fail++; }
console.log(`\n총 ${results.length} · PASS ${pass} · FAIL ${fail}`);
process.exit(fail ? 1 : 0);
