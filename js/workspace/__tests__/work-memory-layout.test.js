'use strict';

/* 원장 작업 기억이 '레이아웃과 공존'하는지 (2026-07-17).

   이 테스트가 생긴 이유: T-115 P2 의 주입 조건이 `!_restore && !_wsEd` 였다.
   _wsEd 는 작업실 레이아웃이 켜지면 늘 채워지는데, 작업실 기본 흐름이
   업로드→레이아웃→캡션이라 사실상 **항상** 꺼져 있었다. 원장이 스티커·글씨·도형을
   ★기본으로 지정해도 새 글에선 아무것도 안 올라왔다(기능이 있는데 없는 상태).

   이제 레이아웃이 있어도 기억을 쓰되 layersOnly=true 로 '꾸밈만' 가져온다.
   칸 배치(layoutIdx·collageBg·fitMode)는 방금 고른 레이아웃이 소유한다 —
   안 그러면 반대로 레이아웃이 기억에 덮여 사라진다. 두 방향 다 여기서 잠근다. */

const fs = require('fs');
const path = require('path');

const FLOW = path.join(__dirname, '..', 'workspace-v2-flow.js');
const flowSrc = fs.readFileSync(FLOW, 'utf8');

// work-memory.js 는 IIFE + window 전역 → 가짜 window 에 얹어 실제 함수를 쓴다
// (workspace-perf.test.js 와 같은 방식 — 이 레포 jest 는 node 환경이라 window 가 없다).
function loadWM() {
  global.window = {};
  global.localStorage = {
    _m: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._m, k) ? this._m[k] : null; },
    setItem(k, v) { this._m[k] = String(v); },
    removeItem(k) { delete this._m[k]; },
  };
  const file = path.join(__dirname, '..', 'work-memory.js');
  // eslint-disable-next-line no-eval
  eval(fs.readFileSync(file, 'utf8'));
  return global.window.WorkMemory;
}
const WM = loadWM();

const REC = {
  id: 'r1',
  ratio: '4:5',
  layoutIdx: 4,
  layoutOrder: [0, 1],
  collageBg: '#ffffff',
  collageGap: 8,
  fitMode: 'cover',
  layers: [
    { type: 'sticker', emoji: '💅', x: 0.2, y: 0.2, size: 0.1 },
    { type: 'rect', shape: 'circle', fill: false, strokeW: 0.01, color: '#fff', x: 0.8, y: 0.2, w: 0.2, h: 0.2 },
    { type: 'text', role: 'title', text: '지난 글 문구', x: 0.5, y: 0.85, size: 0.06 },
  ],
};
const INCOMING = [{ role: 'title', text: '이번 글 문구' }];

describe('작업 기억 × 레이아웃', () => {
  test('레이아웃이 켜져 있으면(layersOnly) 칸 배치를 안 씌운다', () => {
    const st = WM.toEditState(REC, { photoCount: 4, layersOnly: true, incoming: INCOMING });
    expect(st).toBeTruthy();
    // 레이아웃이 소유하는 값 — 기억이 건드리면 원장이 고른 레이아웃이 사라진다
    expect(st.layoutIdx).toBeUndefined();
    expect(st.collageBg).toBeUndefined();
    expect(st.collageGap).toBeUndefined();
    expect(st.fitMode).toBeUndefined();
  });

  test('레이아웃이 켜져 있어도 꾸밈(layers)은 그대로 넘어온다', () => {
    const st = WM.toEditState(REC, { photoCount: 4, layersOnly: true, incoming: INCOMING });
    expect(st.layers).toHaveLength(3);
    expect(st.layers.some((l) => l.type === 'sticker' && l.emoji === '💅')).toBe(true);
    // 도형은 모양·채움이 보존돼야 한다(테두리 원이 채운 사각형으로 뭉개지면 안 됨)
    const shape = st.layers.find((l) => l.type === 'rect');
    expect(shape.shape).toBe('circle');
    expect(shape.fill).toBe(false);
  });

  test('같은 role 텍스트는 이번 글 문구로 갈아끼운다(지난 글이 되살아나면 안 됨)', () => {
    const st = WM.toEditState(REC, { photoCount: 4, layersOnly: true, incoming: INCOMING });
    expect(st.layers.find((l) => l.role === 'title').text).toBe('이번 글 문구');
  });

  test('레이아웃이 없으면 예전대로 칸 배치까지 복원한다', () => {
    const st = WM.toEditState(REC, { photoCount: 4, layersOnly: false, incoming: INCOMING });
    expect(st.layoutIdx).toBe(4);
    expect(st.collageBg).toBe('#ffffff');
    expect(st.fitMode).toBe('cover');
  });

  test('사진 수가 기억의 칸 수와 다르면 레이아웃은 건드리지 않는다(빈 칸 방지)', () => {
    const st = WM.toEditState(REC, { photoCount: 2, layersOnly: false, incoming: INCOMING });
    expect(st.layoutIdx).toBeUndefined();   // 기억은 4칸, 지금 사진 2장
    expect(st.layers).toHaveLength(3);      // 꾸밈은 그대로
  });
});

describe('flow 배선', () => {
  test('★기본 기억 주입이 더는 _wsEd(레이아웃) 로 막히지 않는다', () => {
    // 옛 조건: (!_restore && !_wsEd && window.WorkMemory) — 레이아웃이면 통째로 skip
    expect(flowSrc).not.toMatch(/!_restore\s*&&\s*!_wsEd\s*&&\s*window\.WorkMemory/);
    expect(flowSrc).toMatch(/layersOnly:\s*!!_wsEd/);
  });

  test('콜라주 editState 에 기억의 꾸밈을 합쳐 넘긴다', () => {
    expect(flowSrc).toMatch(/_mergeWmLayers\(_wsEd\.editState,\s*_wmEd\)/);
  });
});
