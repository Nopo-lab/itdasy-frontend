/* 사진 편집기 — 배경 블러 (인물 부각 / 아웃포커스)
   SmartMask subject weight 로 전경 마스크 생성 → GL 가우시안 블러 → 합성.
   마스크 edge feather 포함.
*/
(function () {
  'use strict';
  if (window.PhotoEditorBgBlur) return;

  const FS_COMPOSITE = `
uniform sampler2D u_sharp;
uniform sampler2D u_fgMask;

void main() {
  vec4 blurred = texture(u_image, v_uv);
  vec4 sharp = texture(u_sharp, v_uv);
  float fg = texture(u_fgMask, v_uv).r;
  outColor = vec4(mix(blurred.rgb, sharp.rgb, fg), sharp.a);
}
`;

  let _progComposite = null;
  let _maskCache = null;

  function _ensureComposite() {
    if (_progComposite) return true;
    const Ctx = window.PhotoEditorGLCtx;
    const Pipe = window.PhotoEditorGLPipeline;
    if (!Ctx || !Pipe || !Ctx.supported) return false;
    if (!Ctx.init()) return false;
    _progComposite = Ctx.compileProgram(Pipe.VS_COMMON, Pipe.FS_HEADER + FS_COMPOSITE);
    return !!_progComposite;
  }

  function _generateMask(peCanvas, featherRadius, srcKey) {
    const w = peCanvas.width, h = peCanvas.height;
    const cacheKey = w + 'x' + h + '|' + (srcKey || '');
    if (_maskCache && _maskCache.key === cacheKey) {
      return _maskCache.canvas;
    }
    const SM = window.PhotoEditorSmartMask;
    if (!SM || typeof SM.classify !== 'function') return null;
    const ctx = peCanvas.getContext('2d');
    let imgData;
    try { imgData = ctx.getImageData(0, 0, w, h); } catch (_e) { return null; }
    const d = imgData.data;
    const maskCv = document.createElement('canvas');
    maskCv.width = w; maskCv.height = h;
    const mCtx = maskCv.getContext('2d');
    const mImg = mCtx.createImageData(w, h);
    const m = mImg.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const lum = r * 0.299 + g * 0.587 + b * 0.114;
        const maxCh = Math.max(r, g, b), minCh = Math.min(r, g, b);
        const p = SM.classify({ r, g, b, lum, maxCh, minCh, x, y, w, h });
        const fg = Math.max(p.subject, p.skin, p.hair);
        const v = Math.min(255, Math.round(fg * 255));
        m[i] = v; m[i + 1] = v; m[i + 2] = v; m[i + 3] = 255;
      }
    }
    mCtx.putImageData(mImg, 0, 0);

    _morphMask(mCtx, w, h);
    if (featherRadius > 0) _featherMask(mCtx, w, h, featherRadius);
    _applyDepthFalloff(mCtx, w, h);

    _maskCache = { key: cacheKey, canvas: maskCv };
    return maskCv;
  }

  function _morphMask(ctx, w, h) {
    _morphPass(ctx, w, h, true);
    _morphPass(ctx, w, h, false);
  }

  function _morphPass(ctx, w, h, dilate) {
    const src = ctx.getImageData(0, 0, w, h);
    const out = ctx.createImageData(w, h);
    const d = src.data, o = out.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let best = dilate ? 0 : 255;
      for (let ky = -1; ky <= 1; ky++) for (let kx = -1; kx <= 1; kx++) {
        const nx = Math.min(w - 1, Math.max(0, x + kx));
        const ny = Math.min(h - 1, Math.max(0, y + ky));
        const v = d[(ny * w + nx) * 4];
        best = dilate ? Math.max(best, v) : Math.min(best, v);
      }
      const i = (y * w + x) * 4;
      o[i] = best; o[i + 1] = best; o[i + 2] = best; o[i + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
  }

  function _featherMask(ctx, w, h, r) {
    const passes = Math.min(r + 1, 5);
    for (let p = 0; p < passes; p++) {
      const src = ctx.getImageData(0, 0, w, h);
      const out = ctx.createImageData(w, h);
      const d = src.data, o = out.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let sum = 0, n = 0;
        for (let ky = -2; ky <= 2; ky++) for (let kx = -2; kx <= 2; kx++) {
          const nx = Math.min(w - 1, Math.max(0, x + kx));
          const ny = Math.min(h - 1, Math.max(0, y + ky));
          const gw = _gauss5(kx) * _gauss5(ky);
          sum += d[(ny * w + nx) * 4] * gw; n += gw;
        }
        const i = (y * w + x) * 4;
        const v = sum / n;
        o[i] = v; o[i + 1] = v; o[i + 2] = v; o[i + 3] = 255;
      }
      ctx.putImageData(out, 0, 0);
    }
  }

  function _gauss5(v) {
    return v === 0 ? 6 : Math.abs(v) === 1 ? 4 : 1;
  }

  function _applyDepthFalloff(ctx, w, h) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const nx = (x + 0.5) / w - 0.5;
      const ny = (y + 0.5) / h - 0.48;
      const center = Math.max(0, 1 - Math.sqrt(nx * nx * 1.6 + ny * ny * 1.2));
      const v = Math.max(d[i], Math.round(center * 72));
      d[i] = Math.min(255, v); d[i + 1] = d[i]; d[i + 2] = d[i];
    }
    ctx.putImageData(img, 0, 0);
  }

  function _uploadTex(gl, source) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  function _applyBgBlur(peCanvas, state) {
    const s = state.bgBlur;
    if (!s || s.strength <= 0) return;
    if (!_ensureComposite()) return;

    const Pipe = window.PhotoEditorGLPipeline;
    const BlurMod = window.PhotoEditorGLShadersBlur;
    const Ctx = window.PhotoEditorGLCtx;
    if (!Pipe || !BlurMod || !Ctx || !Ctx.supported) return;
    if (!Ctx.init()) return;

    const w = peCanvas.width, h = peCanvas.height;
    const str = s.strength / 100;
    const feather = Math.round(1 + str * 3);
    const maskCv = _generateMask(peCanvas, feather, state.originalSrc);
    if (!maskCv) return;

    const blurProg = Ctx.compileProgram(Pipe.VS_COMMON, Pipe.FS_HEADER + BlurMod.FS_BLUR);
    if (!blurProg) return;

    const blurRadius = 2 + str * 8;
    const blurredCanvas = Pipe.run(peCanvas, [
      { program: blurProg, uniforms: { u_radius: blurRadius, u_dir: [1, 0], u_texSize: [w, h] } },
      { program: blurProg, uniforms: { u_radius: blurRadius, u_dir: [0, 1], u_texSize: [w, h] } },
      { program: blurProg, uniforms: { u_radius: blurRadius * 0.65, u_dir: [1, 1], u_texSize: [w, h] } },
    ], { width: w, height: h });
    if (!blurredCanvas) return;

    const gl = Ctx.gl;
    const sharpTex = _uploadTex(gl, peCanvas);
    const maskTex = _uploadTex(gl, maskCv);

    const out = Pipe.run(blurredCanvas, [{
      program: _progComposite,
      uniforms: {},
      textures: { u_sharp: sharpTex, u_fgMask: maskTex },
    }], { width: w, height: h });

    gl.deleteTexture(sharpTex);
    gl.deleteTexture(maskTex);

    if (!out) return;
    const ctx = peCanvas.getContext('2d');
    ctx.drawImage(out, 0, 0);
  }

  function invalidateCache() { _maskCache = null; }

  function _register() {
    if (!window.PhotoEditor || !window.PhotoEditor._internal) return false;
    window.PhotoEditor._internal.registerDrawHook('bgBlur', _applyBgBlur);
    return true;
  }
  if (!_register()) {
    let t = 0;
    const iv = setInterval(() => { if (_register() || ++t > 50) clearInterval(iv); }, 100);
  }

  window.PhotoEditorBgBlur = { invalidateCache };
})();
