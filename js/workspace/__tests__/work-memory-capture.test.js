'use strict';

/* 원장 작업 기억 — '붙잡기(capture)' 경로 회귀 방어 (2026-07-21).

   기존 work-memory-layout.test.js 는 재사용(toEditState)만 덮는다.
   저장/발행 때 실제로 기억을 만드는 captureFromSlot 경로는 무테스트였다 —
   실백엔드 QA 로 전부 통과를 확인했지만(dedup·10개상한·이름·기본지정·빈편집스킵),
   이 동작들을 코드로 잠가 리팩터가 조용히 깨는 걸 막는다.
   특히 브라우저 자동화로는 편집기 '완료'를 못 눌러 end-to-end 캡처를 못 태웠기에,
   캡처 함수 경계에서의 계약을 여기서 못박는다. */

const fs = require('fs');
const path = require('path');

// work-memory.js 는 IIFE + window 전역 → 가짜 window/localStorage 에 얹어 실제 함수를 쓴다
// (work-memory-layout.test.js 와 동일 방식 — 이 레포 jest 는 node 환경).
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

// 편집기 산출물(ItdEditor._exportState 형태)과 같은 editState 를 사진에 얹은 슬롯.
// _pickState 는 photos[i].editState 에서 v && layers.length 를 찾는다.
function slot(layers, opts) {
  opts = opts || {};
  return {
    id: opts.id || ('s' + Math.random().toString(36).slice(2, 7)),
    service: opts.service || '젤네일',
    photos: [{
      editState: {
        v: 1,
        layoutIdx: opts.layoutIdx == null ? 0 : opts.layoutIdx,
        ratio: opts.ratio || '4:5',
        layoutOrder: [], cellCrop: [], adj: [], photoDraw: { a: 1 }, photoBg: {}, pz: { scale: 1 },
        photos: ['x'],
        layers,
      },
    }],
  };
}
const T = (x, y, size, align, text, extra) => Object.assign({ type: 'text', role: 'title', x, y, size, align, text }, extra || {});

describe('작업 기억 붙잡기(captureFromSlot)', () => {
  let WM;
  beforeEach(() => { WM = loadWM(); });

  test('편집 layers 가 있으면 기억 1개 생성 + 첫 기억은 자동 ★기본', () => {
    const rec = WM.captureFromSlot(slot([T(0.5, 0.2, 0.09, 'center', '젤네일')]), { service: '젤네일' });
    expect(rec).toBeTruthy();
    expect(WM.list()).toHaveLength(1);
    expect(WM.getDefaultId()).toBe(rec.id);
    expect(rec.name).toContain('젤네일');
  });

  test('편집이 없으면(layers 0장) 캡처 안 함 = null — 기억할 꾸밈이 없음(정상)', () => {
    const rec = WM.captureFromSlot(slot([]), { service: '젤네일' });
    expect(rec).toBeNull();
    expect(WM.list()).toHaveLength(0);
  });

  test('editState 자체가 없는 사진이면 캡처 안 함 = null', () => {
    const rec = WM.captureFromSlot({ id: 's0', service: '젤', photos: [{ dataUrl: 'x' }] }, {});
    expect(rec).toBeNull();
    expect(WM.list()).toHaveLength(0);
  });

  test('같은 배치·다른 글자 → dedup(새 기억 안 만들고 useCount++)', () => {
    WM.captureFromSlot(slot([T(0.5, 0.2, 0.09, 'center', '첫 글자')]), { service: '젤' });
    const r2 = WM.captureFromSlot(slot([T(0.5, 0.2, 0.09, 'center', '다른 글자로 바꿈')]), { service: '속' });
    expect(WM.list()).toHaveLength(1);
    expect(r2.useCount).toBe(2);
  });

  test('배치가 다르면 새 기억으로 쌓인다', () => {
    WM.captureFromSlot(slot([T(0.5, 0.2, 0.09, 'center', 'A')]), {});
    WM.captureFromSlot(slot([T(0.2, 0.85, 0.04, 'left', 'B')]), {});
    expect(WM.list()).toHaveLength(2);
  });

  test('10개 초과 저장 → MAX 10 유지 + ★기본은 절대 밀려나지 않음', () => {
    const first = WM.captureFromSlot(slot([T(0.01, 0.01, 0.01, 'left', '0')]), {});
    WM.setDefault(first.id);
    for (let i = 1; i < 15; i++) {
      WM.captureFromSlot(slot([T(0.01 + i * 0.03, 0.3, 0.02 + i * 0.002, 'left', String(i))]), {});
    }
    expect(WM.list()).toHaveLength(WM.MAX);
    expect(WM.MAX).toBe(10);
    expect(WM.get(first.id)).toBeTruthy();          // 기본 보호됨
    expect(WM.getDefaultId()).toBe(first.id);
  });

  test('_distill: 사진 전용 값(photoDraw·photos·adj)은 버리고 재사용 값만 담는다', () => {
    const rec = WM.captureFromSlot(slot([{ type: 'sticker', x: 0.8, y: 0.15, size: 0.1 }]), {});
    expect(rec.photoDraw).toBeUndefined();
    expect(rec.photos).toBeUndefined();
    expect(rec.adj).toBeUndefined();
    expect(rec.ratio).toBe('4:5');
    expect(rec.layers).toHaveLength(1);
  });

  test('이름 자동생성 — 전후비교 / 한 장 + 글씨 위치·정렬', () => {
    const ba = WM.captureFromSlot(slot([{ type: 'badge', role: 'sub', x: 0.5, y: 0.9, size: 0.04, align: 'center', text: 'x' }], { layoutIdx: 7 }), { service: '펌' });
    expect(ba.name).toContain('전후비교');
    const single = WM.captureFromSlot(slot([T(0.5, 0.2, 0.09, 'center', 'y')], { layoutIdx: 0 }), { service: '네일' });
    expect(single.name).toContain('한 장');
    expect(single.name).toContain('가운데 큰 제목');   // 큰(≥0.07)+center 특징
  });

  test('describe(): 레이어 종류별 카운트(글씨·밑줄·스티커)', () => {
    const rec = WM.captureFromSlot(slot([
      T(0.5, 0.1, 0.06, 'center', 't'),
      { type: 'line', x: 0.5, y: 0.5, size: 0.3 },
      { type: 'sticker', x: 0.3, y: 0.6, size: 0.1 },
    ]), {});
    const d = WM.describe(rec);
    expect(d).toContain('글씨 1');
    expect(d).toContain('밑줄 1');
    expect(d).toContain('스티커 1');
  });

  test('d.service 우선, 없으면 slot.service 로 이름을 짓는다', () => {
    const withD = WM.captureFromSlot(slot([T(0.5, 0.2, 0.09, 'center', 'a')], { service: '슬롯시술' }), { service: '디시술' });
    expect(withD.name).toContain('디시술');
  });
});

describe('flow 배선 — 저장/발행 시 캡처 호출이 유지돼야 한다', () => {
  const flowSrc = fs.readFileSync(path.join(__dirname, '..', 'workspace-v2-flow.js'), 'utf8');

  test('save() 가 captureAndNotify(slot, d) 를 호출한다', () => {
    expect(flowSrc).toMatch(/WorkMemory\.captureAndNotify\(slot,\s*d\)/);
  });

  test('게시 완료(_markPublishedNow) 도 captureAndNotify(_pubSlot, d) 를 호출한다', () => {
    expect(flowSrc).toMatch(/WorkMemory\.captureAndNotify\(_pubSlot,\s*d\)/);
  });

  // 브라우저 자동화로 편집기 '완료'를 못 눌러 end-to-end 를 못 태웠으므로,
  // 편집기→저장 사이의 계약(편집 결과가 사진 editState 로 실린다)을 소스로 못박는다.
  test('편집기 onDone 이 편집 결과(editState)를 사진에 저장한다 — 저장 시 캡처가 볼 값', () => {
    expect(flowSrc).toMatch(/p\.editState = meta\.editState/);
  });

  test('buildSlot 이 사진의 editState 를 슬롯에 실어 넘긴다(캡처의 _pickState 가 읽음)', () => {
    expect(flowSrc).toMatch(/editState:\s*p\.editState/);
  });
});

describe('편집기 산출물 계약 — _exportState 가 layers 를 담아야 캡처가 성립', () => {
  const edSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'itd-editor', 'itd-editor.js'), 'utf8');

  test('_exportState 반환에 v 와 layers(직렬화)가 포함된다', () => {
    expect(edSrc).toMatch(/function _exportState/);
    expect(edSrc).toMatch(/layers:\s*\(S\.layers\s*\|\|\s*\[\]\)\.map\(_serLayer\)/);
  });
});
