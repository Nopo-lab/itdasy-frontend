/* 사진편집 기능명 계약 QA 브라우저 실행부 */
const PHOTO_BEAUTY_QA_CASES = [
  { id: 'hairVolume', label: '머리 풍성감', kind: 'hair', beauty: { hairVolume: 80 } },
  { id: 'nailGloss', label: '네일 광택', kind: 'nail', beauty: { nailGloss: 80, nailShape: 24 } },
  { id: 'catchLight', label: '눈빛 반짝임', kind: 'eye', beauty: { catchLight: 80 } },
  { id: 'blemish', label: '잡티 완화', kind: 'skin', beauty: { blemish: 80 } },
];

window.__PhotoBeautyContractQa = { runCases };

async function runCases() {
  const results = [];
  for (const testCase of PHOTO_BEAUTY_QA_CASES) results.push(await runCase(testCase));
  return results;
}

async function runCase(testCase) {
  const sample = makeSample(testCase.kind);
  patchMasks(sample);
  const PE = window.PhotoEditor;
  unlockEditor();
  PE.open({ src: sample.src, initial_tab: 'beauty', shopName: 'QA' });
  const state = await waitImage(PE);
  await PE._internal.helpers.redraw(false);
  await sleep(80);
  const before = canvasData();
  Object.assign(state.beauty, testCase.beauty);
  await PE._internal.helpers.redraw(false);
  await sleep(80);
  const after = canvasData();
  closeEditor(PE);
  return scoreCase(testCase, sample, before, after);
}

function unlockEditor() {
  document.body.classList.remove('itdasy-locked');
  const lock = document.getElementById('lockOverlay');
  if (lock) lock.classList.add('hidden');
}

function closeEditor(PE) {
  if (PE && typeof PE.close === 'function') {
    PE.close(true);
    return;
  }
  const sheet = document.getElementById('photoEditorSheet');
  if (sheet) sheet.style.display = 'none';
}

function patchMasks(sample) {
  const masks = sample.masks;
  if (!window.MaskApplication) window.MaskApplication = {};
  window.MaskApplication.getMasksForBeautySync = () => ({
    useMasks: masks.useMasks,
    _scale: masks.scale,
    maskW: sample.w,
    maskH: sample.h,
  });
  window.MaskApplication.getNailMaskSync = () => masks.useMasks.nailMask
    ? { mask: masks.useMasks.nailMask, scale: 1 } : null;
  window.MaskApplication.getLashMaskSync = () => masks.lashMask
    ? { mask: masks.lashMask, scale: 1 } : null;
}

function makeSample(kind) {
  const w = 360, h = 480, cv = document.createElement('canvas'), ctx = cv.getContext('2d');
  const useMasks = {}, scale = {};
  cv.width = w;
  cv.height = h;
  ctx.fillStyle = '#e9e6df';
  ctx.fillRect(0, 0, w, h);
  if (kind === 'hair') drawHair(ctx, useMasks, scale, w, h);
  if (kind === 'nail') drawNail(ctx, useMasks, scale, w, h);
  if (kind === 'eye') drawEye(ctx, useMasks, scale, w, h);
  if (kind === 'skin') drawSkin(ctx, useMasks, scale, w, h);
  return { kind, w, h, src: cv.toDataURL('image/png'), masks: { useMasks, scale } };
}

function mask(w, h) {
  return new Float32Array(w * h);
}

function ellipse(m, w, h, cx, cy, rx, ry, value) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
    if (d <= 1) m[y * w + x] = value == null ? 1 : value;
  }
}

function drawHair(ctx, useMasks, scale, w, h) {
  const hair = mask(w, h), skin = mask(w, h), boundary = mask(w, h);
  ellipse(hair, w, h, 180, 155, 95, 120, 1);
  ellipse(skin, w, h, 180, 230, 58, 78, 1);
  for (let i = 0; i < hair.length; i++) if (hair[i] && !skin[i]) boundary[i] = 0.4;
  drawEllipse(ctx, '#f0d0bd', 180, 230, 58, 78);
  drawEllipse(ctx, '#4b2f22', 180, 155, 95, 120);
  useMasks.hairMask = hair;
  useMasks.skinMask = skin;
  useMasks.hairBoundaryMask = boundary;
  scale.hairMask = scale.skinMask = scale.hairBoundaryMask = 1;
}

function drawNail(ctx, useMasks, scale, w, h) {
  const nail = mask(w, h), skin = mask(w, h);
  ctx.fillStyle = '#d8a48f';
  ctx.fillRect(70, 130, 220, 220);
  for (let i = 0; i < 4; i++) {
    const cx = 115 + i * 45;
    ellipse(nail, w, h, cx, 170, 16, 34, 1);
    ellipse(skin, w, h, cx, 210, 20, 90, 1);
    drawEllipse(ctx, '#b35a78', cx, 170, 16, 34);
  }
  useMasks.nailMask = nail;
  useMasks.skinMask = skin;
  scale.nailMask = scale.skinMask = 1;
}

function drawEye(ctx, useMasks, scale, w, h) {
  const eye = mask(w, h), skin = mask(w, h);
  ellipse(skin, w, h, 180, 240, 150, 150, 1);
  ellipse(eye, w, h, 145, 210, 42, 18, 1);
  ellipse(eye, w, h, 215, 210, 42, 18, 1);
  ctx.fillStyle = '#e9c2ae';
  ctx.fillRect(0, 0, w, h);
  drawEllipse(ctx, '#f6f3ee', 145, 210, 42, 18);
  drawEllipse(ctx, '#f6f3ee', 215, 210, 42, 18);
  drawCircle(ctx, '#3b2b22', 145, 210, 10);
  drawCircle(ctx, '#3b2b22', 215, 210, 10);
  useMasks.eyeMask = eye;
  useMasks.skinMask = skin;
  scale.eyeMask = scale.skinMask = 1;
}

function drawSkin(ctx, useMasks, scale, w, h) {
  const skin = mask(w, h), spot = mask(w, h);
  ellipse(skin, w, h, 180, 230, 110, 145, 1);
  ctx.fillStyle = '#e7b99d';
  ctx.fillRect(0, 0, w, h);
  [[150, 205], [198, 235], [170, 270]].forEach(point => drawSpot(ctx, spot, w, h, point));
  useMasks.skinMask = skin;
  useMasks.__spotMask = spot;
  scale.skinMask = 1;
}

function drawSpot(ctx, spot, w, h, point) {
  ellipse(spot, w, h, point[0], point[1], 7, 7, 1);
  drawCircle(ctx, '#b98574', point[0], point[1], 7);
}

function drawEllipse(ctx, color, cx, cy, rx, ry) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawCircle(ctx, color, cx, cy, r) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

function waitImage(PE) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    waitImageTick(PE, t0, resolve, reject);
  });
}

function waitImageTick(PE, t0, resolve, reject) {
  const st = PE._internal && PE._internal.getState && PE._internal.getState();
  if (st && st.originalImg && st.originalImg.naturalWidth) return resolve(st);
  if (Date.now() - t0 > 15000) return reject(new Error('image timeout'));
  setTimeout(() => waitImageTick(PE, t0, resolve, reject), 50);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function canvasData() {
  const cv = document.getElementById('peCanvas');
  const data = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  return { w: cv.width, h: cv.height, data: Array.from(data) };
}

function scoreCase(testCase, sample, before, after) {
  const metric = metricForKind(testCase.kind, sample, before, after);
  return { id: testCase.id, label: testCase.label, ok: metric.ok, metric };
}

function metricForKind(kind, sample, before, after) {
  if (kind === 'hair') return hairMetric(sample, before, after);
  if (kind === 'nail') return nailMetric(sample, before, after);
  if (kind === 'eye') return eyeMetric(sample, before, after);
  return skinMetric(sample, before, after);
}

function lum(arr, i) {
  return arr[i] * 0.299 + arr[i + 1] * 0.587 + arr[i + 2] * 0.114;
}

function avgDelta(before, after, pred) {
  let sum = 0, n = 0, w = before.w, h = before.h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (pred(x, y)) {
    const i = (y * w + x) * 4;
    sum += lum(after.data, i) - lum(before.data, i);
    n++;
  }
  return n ? sum / n : 0;
}

function hairMetric(sample, before, after) {
  const hm = sample.masks.useMasks.hairMask, w = before.w, h = before.h;
  const ring = (x, y) => !hm[y * w + x] && near(hm, w, h, x, y, 4);
  const darken = -avgDelta(before, after, ring);
  return { outerRingDarken: +darken.toFixed(2), ok: darken > 2.2 };
}

function nailMetric(sample, before, after) {
  const nm = sample.masks.useMasks.nailMask, sm = sample.masks.useMasks.skinMask, w = before.w;
  const nailLift = avgDelta(before, after, (x, y) => nm[y * w + x] > 0.38);
  const skinLift = avgDelta(before, after, (x, y) => sm[y * w + x] > 0.5 && !nm[y * w + x]);
  return { nailLift: +nailLift.toFixed(2), outsideSkinLift: +skinLift.toFixed(2), ok: nailLift > 7 && skinLift < 5 };
}

function eyeMetric(sample, before, after) {
  const em = sample.masks.useMasks.eyeMask, w = before.w;
  const eyeLift = topDelta(before, after, (x, y) => em[y * w + x] > 0.5, 0.99);
  return { eyeHighlightLift: +eyeLift.toFixed(2), ok: eyeLift > 12 };
}

function skinMetric(sample, before, after) {
  const spot = sample.masks.useMasks.__spotMask, skin = sample.masks.useMasks.skinMask, w = before.w;
  const spotLift = avgDelta(before, after, (x, y) => spot[y * w + x] > 0.5);
  const spotPeakLift = topDelta(before, after, (x, y) => spot[y * w + x] > 0.5, 0.9);
  const skinLift = avgDelta(before, after, (x, y) => skin[y * w + x] > 0.5 && !spot[y * w + x]);
  return {
    spotLift: +spotLift.toFixed(2),
    spotPeakLift: +spotPeakLift.toFixed(2),
    otherSkinLift: +skinLift.toFixed(2),
    ok: (spotLift > 2.4 || spotPeakLift > 8) && skinLift < 8,
  };
}

function near(maskValue, w, h, x, y, r) {
  for (let yy = Math.max(0, y - r); yy <= Math.min(h - 1, y + r); yy++) {
    for (let xx = Math.max(0, x - r); xx <= Math.min(w - 1, x + r); xx++) {
      if (maskValue[yy * w + xx] > 0.5) return true;
    }
  }
  return false;
}

function topDelta(before, after, pred, ratio) {
  const deltas = [];
  for (let y = 0; y < before.h; y++) for (let x = 0; x < before.w; x++) if (pred(x, y)) {
    const i = (y * before.w + x) * 4;
    deltas.push(lum(after.data, i) - lum(before.data, i));
  }
  if (!deltas.length) return 0;
  deltas.sort((a, b) => a - b);
  return deltas[Math.max(0, Math.min(deltas.length - 1, Math.floor(deltas.length * ratio)))];
}
