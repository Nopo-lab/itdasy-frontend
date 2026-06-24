const path = require('path');

function loadEngine() {
  jest.resetModules();
  global.window = {
    PhotoEditorSmartMask: {
      classify: () => ({ skin: 1, hair: 0, eye: 0, nail: 1, redness: 0 }),
    },
  };
  require(path.resolve(__dirname, '../../../js/photo-editor/beauty-engine.js'));
  return global.window.PhotoEditorBeautyEngine;
}

function contextFor(r, g, b) {
  const original = new Uint8ClampedArray([r, g, b, 255]);
  let current = new Uint8ClampedArray(original);
  return {
    canvas: { width: 1, height: 1 },
    getImageData: () => ({ data: new Uint8ClampedArray(current) }),
    putImageData: image => { current = new Uint8ClampedArray(image.data); },
    snapshot: () => Array.from(current),
    original: () => Array.from(original),
  };
}

function masks(type) {
  return {
    useMasks: { [type]: new Float32Array([1]) },
    _scale: { [type]: 1 },
    maskW: 1,
    maskH: 1,
  };
}

afterEach(() => {
  delete global.window;
});

test('손 마스크가 없으면 피부색 추정으로 손 보정을 실행하지 않는다', () => {
  const engine = loadEngine();
  const ctx = contextFor(160, 120, 90);
  engine.apply(ctx, 1, 1, { handSkin: 100 }, false, null);
  expect(ctx.snapshot()).toEqual(ctx.original());
});

test('네일 마스크가 없으면 반짝임 추정으로 네일 보정을 실행하지 않는다', () => {
  const engine = loadEngine();
  const ctx = contextFor(225, 220, 215);
  engine.apply(ctx, 1, 1, { nailGloss: 100, nailShape: 100 }, false, null);
  expect(ctx.snapshot()).toEqual(ctx.original());
});

test('실제 손 마스크가 있으면 손 영역 보정을 실행한다', () => {
  const engine = loadEngine();
  const ctx = contextFor(160, 120, 90);
  engine.apply(ctx, 1, 1, { handSkin: 100 }, false, masks('handSkinMask'));
  expect(ctx.snapshot()).not.toEqual(ctx.original());
});

test('실제 네일 마스크가 있으면 네일 광택을 실행한다', () => {
  const engine = loadEngine();
  const ctx = contextFor(225, 220, 215);
  engine.apply(ctx, 1, 1, { nailGloss: 100 }, false, masks('nailMask'));
  expect(ctx.snapshot()).not.toEqual(ctx.original());
});
