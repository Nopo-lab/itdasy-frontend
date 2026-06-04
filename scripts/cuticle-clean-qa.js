/* 큐티클/손 주변 정리 PoC — Node 자가 QA (브라우저 불필요)
 *
 * 실행: node scripts/cuticle-clean-qa.js
 * 검증: flag 0 pixel-identical / nail·배경 보호 / ring-only 변화 / 마스크 실패 no-op / 붉은기 완화
 */
'use strict';
const path = require('path');

// 모듈 로드 (window 없으면 globalThis 에 attach)
require(path.join(__dirname, '..', 'app-photo-editor-cuticle.js'));
const CU = globalThis.PhotoEditorCuticle;

const W = 40, H = 40, MW = 40, MH = 40;

// ── 합성 마스크: 중앙 10x10 손톱, 그 둘레 30x30 손 피부, 바깥 배경 ──
function buildMasks() {
  const nail = new Float64Array(MW * MH);
  const skin = new Float64Array(MW * MH);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const idx = y * MW + x;
    if (x >= 15 && x <= 24 && y >= 15 && y <= 24) nail[idx] = 1;     // 손톱
    if (x >= 5 && x <= 34 && y >= 5 && y <= 34) skin[idx] = 1;       // 손 피부(손톱 포함)
  }
  return { useMasks: { nailMask: nail, skinMask: skin }, maskW: MW, maskH: MH };
}

// ── 합성 이미지: 손톱=핑크폴리시, 피부=붉은기 강한 살색, 배경=어두움 ──
function buildData() {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    let r, g, b;
    if (x >= 15 && x <= 24 && y >= 15 && y <= 24) { r = 180; g = 60; b = 120; }   // 네일
    else if (x >= 5 && x <= 34 && y >= 5 && y <= 34) { r = 210; g = 150; b = 150; } // 피부(붉은기)
    else { r = 30; g = 30; b = 30; }                                              // 배경
    d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
  }
  return d;
}

function makeCtx(d) {
  return {
    _d: d,
    getImageData() { return { data: new Uint8ClampedArray(d), width: W, height: H }; },
    putImageData(img) { d.set(img.data); }
  };
}

function px(d, x, y) { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2]]; }
function diff(a, b) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]); }

function run(flag, masksOverride) {
  CU._poc.cuticleClean = flag;
  const before = buildData();
  const after = new Uint8ClampedArray(before);
  const ctx = makeCtx(after);
  const masks = masksOverride !== undefined ? masksOverride : buildMasks();
  CU.apply(ctx, W, H, {}, masks);
  return { before, after };
}

const results = [];
function check(name, pass, detail) { results.push({ name, pass, detail: detail || '' }); }

// 1. flag 0 → pixel-identical
{
  const { before, after } = run(0);
  let identical = true;
  for (let i = 0; i < before.length; i++) if (before[i] !== after[i]) { identical = false; break; }
  check('1. flag=0 → 출력 pixel-identical', identical);
}

// flag=100 공통 실행
const hot = run(100);

// 2. 네일 내부 diff 0 (손톱 안쪽 보호)
{
  const d0 = diff(px(hot.before, 20, 20), px(hot.after, 20, 20));
  check('2. 네일 내부(20,20) diff 0', d0 === 0, 'diff=' + d0);
}

// 3. 배경 diff 0
{
  const d0 = diff(px(hot.before, 0, 0), px(hot.after, 0, 0));
  const d1 = diff(px(hot.before, 2, 38), px(hot.after, 2, 38));
  check('3. 배경 diff 0', d0 === 0 && d1 === 0, 'corner=' + d0 + ' edge=' + d1);
}

// 4. ring 영역만 변화 (손톱 경계 바로 바깥은 변하고, 손톱서 먼 피부는 불변)
{
  const ringChanged = diff(px(hot.before, 14, 20), px(hot.after, 14, 20)); // 손톱(15~) 바로 왼쪽
  const farSkin = diff(px(hot.before, 6, 6), px(hot.after, 6, 6));         // 손톱서 먼 피부
  check('4. ring(14,20) 변화 & 먼 피부(6,6) 불변', ringChanged > 0 && farSkin === 0,
    'ringΔ=' + ringChanged + ' farΔ=' + farSkin);
}

// 5. 붉은기 완화 (ring 픽셀 red 채널 감소)
{
  const rb = px(hot.before, 14, 20)[0], ra = px(hot.after, 14, 20)[0];
  check('5. ring 붉은기 완화 (R 감소)', ra < rb, 'R ' + rb + '→' + ra);
}

// 6. 과보정 cap (ring 변화량이 작음 — 채널당 평균 변화 ≤ 큰 폭 아님)
{
  const b = px(hot.before, 14, 20), a = px(hot.after, 14, 20);
  const maxCh = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2]));
  check('6. 과보정 cap (ring 채널 변화 ≤ 40)', maxCh <= 40, 'maxΔ=' + maxCh);
}

// 7. nailMask null → no-op
{
  const { before, after } = run(100, { useMasks: { nailMask: null, skinMask: buildMasks().useMasks.skinMask }, maskW: MW, maskH: MH });
  let identical = true;
  for (let i = 0; i < before.length; i++) if (before[i] !== after[i]) { identical = false; break; }
  check('7. nailMask null → no-op', identical);
}

// 8. skinMask null → no-op (손 전체 블러 금지)
{
  const { before, after } = run(100, { useMasks: { nailMask: buildMasks().useMasks.nailMask, skinMask: null }, maskW: MW, maskH: MH });
  let identical = true;
  for (let i = 0; i < before.length; i++) if (before[i] !== after[i]) { identical = false; break; }
  check('8. skinMask null → no-op', identical);
}

// 9. regionMasks 자체 null → no-op
{
  const { before, after } = run(100, null);
  let identical = true;
  for (let i = 0; i < before.length; i++) if (before[i] !== after[i]) { identical = false; break; }
  check('9. regionMasks null → no-op', identical);
}

CU._poc.cuticleClean = 0; // 정리: 기본값 복귀

let allPass = true;
console.log('\n=== 큐티클 정리 PoC QA ===');
for (const r of results) {
  if (!r.pass) allPass = false;
  console.log((r.pass ? 'PASS' : 'FAIL') + '  ' + r.name + (r.detail ? '  [' + r.detail + ']' : ''));
}
console.log('========================');
console.log(allPass ? 'ALL PASS' : 'SOME FAILED');
process.exit(allPass ? 0 : 1);
