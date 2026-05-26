/* 사진 편집기 — GL Bilateral Filter (에지 보존 피부 스무딩)
   boxBlur 대비: 에지(눈/입술/윤곽)는 보존하면서 피부 결만 부드럽게 처리.
   WebGL 미지원 시 beauty-engine.js 의 boxBlur 가 폴백으로 동작함.
*/
(function () {
  'use strict';
  if (window.PhotoEditorGLBilateral) return;

  const FS_BILATERAL = `
uniform vec2 u_texSize;
uniform float u_sigmaS;
uniform float u_sigmaR;

void main() {
  vec4 center = texture(u_image, v_uv);
  vec3 cRgb = center.rgb;
  vec3 sum = vec3(0.0);
  float wSum = 0.0;
  float ss2 = 2.0 * u_sigmaS * u_sigmaS;
  float sr2 = 2.0 * u_sigmaR * u_sigmaR;
  vec2 px = 1.0 / u_texSize;

  for (int i = -3; i <= 3; i++) {
    for (int j = -3; j <= 3; j++) {
      vec2 off = vec2(float(i), float(j)) * px;
      vec3 s = texture(u_image, v_uv + off).rgb;
      float sd = float(i * i + j * j);
      float cd = dot(s - cRgb, s - cRgb);
      float w = exp(-sd / ss2 - cd / sr2);
      sum += s * w;
      wSum += w;
    }
  }

  vec3 smoothed = sum / max(wSum, 0.001);
  vec4 effect = vec4(smoothed, center.a);
  vec4 original = center;
  outColor = applyMask(original, effect);
}
`;

  let _prog = null;

  function _ensure() {
    if (_prog) return true;
    const Ctx = window.PhotoEditorGLCtx;
    const Pipe = window.PhotoEditorGLPipeline;
    if (!Ctx || !Pipe || !Ctx.supported) return false;
    if (!Ctx.init()) return false;
    _prog = Ctx.compileProgram(Pipe.VS_COMMON, Pipe.FS_HEADER + FS_BILATERAL);
    return !!_prog;
  }

  function apply(peCanvas, strength) {
    if (strength <= 0 || !_ensure()) return null;
    const Pipe = window.PhotoEditorGLPipeline;
    if (!Pipe || typeof Pipe.run !== 'function') return null;
    const w = peCanvas.width, h = peCanvas.height;
    if (w < 4 || h < 4) return null;
    const sigmaS = 1.0 + strength * 3.0;
    const sigmaR = 0.04 + strength * 0.12;
    return Pipe.run(peCanvas, [{
      program: _prog,
      uniforms: { u_texSize: [w, h], u_sigmaS: sigmaS, u_sigmaR: sigmaR },
    }], { width: w, height: h });
  }

  window.PhotoEditorGLBilateral = { apply };
})();
