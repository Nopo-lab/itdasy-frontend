/**
 * [2026-09-13 ZH P3-C] 캡션 화면에서 질문에 답할 때마다 대표 미리보기가 높이 0 부터 다시 그려져 화면이 1000px 밀리던 것.
 * 실측(라이브 Chrome · 9:16 합성본 1080×1920): 답 클릭 직후 img h 0 · 앵커 y 1691→690(−1001px) → 디코드 후 1686.
 * 원칙: 비율 추측 금지(4/5 고정은 1.5:1 원본에서 300px 빈칸을 만들어 되돌렸다) → **실제로 디코드된 크기**만 쓴다.
 */
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'workspace-v2-flow.js'), 'utf8');
const C = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ');

describe('캡션 대표 미리보기 — 실제 크기로 칸을 먼저 잡는다', () => {
  test('한 번 디코드된 크기를 원본 URL 기준으로 기억한다(load 는 capture 로)', () => {
    expect(C).toMatch(/var _capPreviewDims = \{\};/);
    const i = C.indexOf("document.addEventListener('load', function (e) {");
    expect(i).toBeGreaterThan(0);
    const body = C.slice(i, i + 700);
    expect(body).toMatch(/im\.closest\('\.wsl-cap-preview'\)/);
    expect(body).toMatch(/_capPreviewDims\[d\.templateOutput\] = \{ w: im\.naturalWidth, h: im\.naturalHeight \};/);
    expect(body).toMatch(/\}, true\);/);
  });
  test('그사이 대표가 바뀌었으면 기록하지 않는다(남의 크기 금지)', () => {
    expect(C).toMatch(/if \(im\.getAttribute\('src'\) !== _blobDisp\(d\.templateOutput\)\) return;/);
  });
  test('0 크기(디코드 실패)는 기록하지 않는다', () => {
    expect(C).toMatch(/if \(!\(im\.naturalWidth > 0 && im\.naturalHeight > 0\) \|\| !d \|\| !d\.templateOutput\) return;/);
  });
  test('다시 그릴 때 알고 있으면 width/height 를 넣고, 모르면 안 넣는다(추측 금지)', () => {
    expect(C).toMatch(/var _pvDim = d\.templateOutput \? _capPreviewDims\[d\.templateOutput\] : null;/);
    expect(C).toMatch(/\(_pvDim \? ' width="' \+ _pvDim\.w \+ '" height="' \+ _pvDim\.h \+ '"' : ''\)/);
  });
  test('🔴 비율을 하드코딩하지 않는다(4/5 고정 회귀 금지)', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'css', 'workspace-hyper.css'), 'utf8');
    expect(css).not.toMatch(/\.wsl-cap-preview[^{]*\{[^}]*aspect-ratio/);
    expect(C).not.toMatch(/wsl-cap-preview[^\n]*aspect-ratio/);
    // width/height 속성이 있어도 CSS 가 height:auto 라 비율대로 줄어든다(늘어나지 않게)
    expect(css).toMatch(/\.wsl-cap-preview img \{ display: block; width: 100%; height: auto; \}/);
  });
});
