/**
 * 원장 편집 손맛 회귀 방지.
 * - 확대 손잡이 하나로 텍스트/스티커가 가로·세로 따로 커져야 한다.
 * - 화면 저장과 재편집이 그 가로·세로 확대값을 잃으면 안 된다.
 * - 글자색과 배경색은 서로 다른 조작이어야 한다.
 */
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'itd-editor.js'), 'utf8');
const CSS = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'css', 'itd-editor.css'), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
const C = strip(SRC);

describe('편집 손맛 — 확대 손잡이와 색상 UX (2026-09-14)', () => {
  test('레이어는 전체배율 외에 가로·세로 배율을 가진다', () => {
    expect(C).toMatch(/function _sx\(L\)/);
    expect(C).toMatch(/function _sy\(L\)/);
    expect(C).toMatch(/scaleX: 1, scaleY: 1/);
  });

  test('화면 transform 은 가로·세로 배율을 분리해서 적용한다', () => {
    expect(C).toMatch(/scale\(' \+ \(\(L\.scale \|\| 1\) \* _sx\(L\)\) \+ ',' \+ \(\(L\.scale \|\| 1\) \* _sy\(L\)\) \+ '\)'/);
    expect(C).toMatch(/style\.transform = 'scale\(' \+ invX \+ ',' \+ invY \+ '\)'/);
  });

  test('확대 손잡이를 좌우로 움직이면 scaleX, 상하로 움직이면 scaleY 가 바뀐다', () => {
    expect(C).toMatch(/rsd\.L\.scaleX = Math\.max\(0\.2, Math\.min\(6, rsd\.sx0 \* \(1 \+ nldx/);
    expect(C).toMatch(/rsd\.L\.scaleY = Math\.max\(0\.2, Math\.min\(6, rsd\.sy0 \* \(1 \+ nldy/);
    expect(CSS).toMatch(/\.itl__rs\{[^}]*right:-20px;bottom:-20px/);
  });

  test('저장·재편집·합성도 가로·세로 배율을 보존한다', () => {
    expect(C).toMatch(/scaleX: _sx\(L\), scaleY: _sy\(L\)/);
    expect(C).toMatch(/L\.scaleX = spec\.scaleX \|\| 1; L\.scaleY = spec\.scaleY \|\| 1/);
    expect(C).toMatch(/c\.scale\(_sx\(L\), _sy\(L\)\)/);
    expect(C).toMatch(/_applyXfSnap\(op\.L, xf\)/);
  });

  test('글자색과 배경색은 한 줄 색상표에서 선택 대상만 바꾼다', () => {
    expect(C).toContain('data-r="colorTarget"');
    expect(C).toContain('data-ctarget="text">글자</button>');
    expect(C).toContain('data-ctarget="textbg">배경</button>');
    expect(C).toContain("_rbSw('textactive', 'itsw')");
    expect(C).toContain("_pipSw('textactive', 'itsw')");
    expect(C).toMatch(/function _textColorTarget\(\)/);
    expect(C).toMatch(/function _setTextColorTarget\(t\)/);
    expect(C).toMatch(/if \(t === 'textactive'\) \{ _colorPickApply\(_textColorTarget\(\), v\); return; \}/);
    expect(C).not.toMatch(/data-bgcolor/);
    expect(C).toMatch(/function applyBgColor\(c\)/);
    expect(C).toMatch(/bgColor: L\.bgColor \|\| null/);
    expect(C).toMatch(/if \(L\.bgColor\) base\.bgColor = L\.bgColor/);
  });

  test('배경색 되돌리기는 null 도 복원한다', () => {
    expect(C).toMatch(/hasOwnProperty\.call\(v, 'bgColor'\)\) L\.bgColor = v\.bgColor \|\| null/);
  });
});
