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

  function _generateMask(peCanvas, featherRadius) {
    const w = peCanvas.width, h = peCanvas.height;
    const cacheKey = w + 'x' + h;
    if (_maskCache && _maskCache.key === cacheKey && _maskCache.src === peCanvas._bgBlurSrc) {
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

    if (featherRadius > 0) {
      _featherMask(mCtx, w, h, featherRadius);
    }

    _maskCache = { key: cacheKey, src: peCanvas._bgBlurSrc, canvas: maskCv };
    return maskCv;
  }

  function _featherMask(ctx, w, h, r) {
    const passes = Math.min(r, 3);
    for (let p = 0; p < passes; p++) {
      const src = ctx.getImageData(0, 0, w, h);
      const out = ctx.createImageData(w, h);
      const d = src.data, o = out.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let sum = 0, n = 0;
        for (let ky = -2; ky <= 2; ky++) for (let kx = -2; kx <= 2; kx++) {
          const nx = Math.min(w - 1, Math.max(0, x + kx));
          const ny = Math.min(h - 1, Math.max(0, y + ky));
          sum += d[(ny * w + nx) * 4]; n++;
        }
        const i = (y * w + x) * 4;
        const v = sum / n;
        o[i] = v; o[i + 1] = v; o[i + 2] = v; o[i + 3] = 255;
      }
      ctx.putImageData(out, 0, 0);
    }
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
    const maskCv = _generateMask(peCanvas, feather);
    if (!maskCv) return;

    const blurProg = Ctx.compileProgram(Pipe.VS_COMMON, Pipe.FS_HEADER + BlurMod.FS_BLUR);
    if (!blurProg) return;

    const blurRadius = 2 + str * 8;
    const blurredCanvas = Pipe.run(peCanvas, [
      { program: blurProg, uniforms: { u_radius: blurRadius, u_dir: [1, 0], u_texSize: [w, h] } },
      { program: blurProg, uniforms: { u_radius: blurRadius, u_dir: [0, 1], u_texSize: [w, h] } },
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
