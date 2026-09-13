'use strict';
/**
 * [2026-09-13 ZH P3-D → P2] 다른 시술 사진에 원장 동의 없이 꾸밈이 얹히던 것.
 *
 * 실측(라이브 계정): 붙임머리 글에 ✨💎 + '첫 방문 이벤트' → 저장(기억 1개 자동 생성, 동의 없음)
 *   → 다음 글 젤네일 사진의 캡션 미리보기(= 발행본)에 💎 가 구워져 나왔다.
 *   로그: via auto · kindFit −30 인데 total 37 로 유일 후보라 채택(select 는 최소 점수 없음 · 업종 축 없음).
 * 수정: 기억의 시술이 지금 시술과 **분명히 다르면** 자동으로 얹지 않는다. 모르면 기존 동작(추측 금지).
 */
const fs = require('fs');
const path = require('path');

function loadAll() {
  global.window = {}; global.window.ITDASY_WORK_MEMORY = true;
  global.location = { search: '' };
  global.localStorage = { _m: {}, getItem(k) { return Object.prototype.hasOwnProperty.call(this._m, k) ? this._m[k] : null; },
    setItem(k, v) { this._m[k] = String(v); }, removeItem(k) { delete this._m[k]; } };
  for (const f of ['work-memory.js', 'work-memory-engine.js']) {
    // eslint-disable-next-line no-eval
    eval(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'));
  }
  return { WM: global.window.WorkMemory, E: global.window.WorkMemoryEngine };
}
function hairSlot() {
  return { id: 'hair1', service: '붙임머리', photos: [{ editState: {
    v: 1, layoutIdx: 0, ratio: '4:5', layoutOrder: [], cellCrop: [], adj: [], photoDraw: {}, photoBg: {}, photos: ['x'],
    layers: [
      { type: 'text', text: '첫 방문 이벤트', x: 0.5, y: 0.9, size: 0.05, align: 'center' },
      { type: 'sticker', emoji: '✨', x: 0.5, y: 0.5, size: 0.1 },
      { type: 'sticker', emoji: '💎', x: 0.6, y: 0.6, size: 0.1 },
    ] } }] };
}
const stickers = (st) => ((st && st.layers) || []).filter((l) => l.type === 'sticker').map((l) => l.emoji);

describe('자동 적용은 같은 시술에만 — 라이브 재현 경로', () => {
  test('기억에 시술이 기록된다', () => {
    const { WM } = loadAll();
    const rec = WM.captureFromSlot(hairSlot(), { service: '붙임머리' });
    expect(rec.service).toBe('붙임머리');
  });

  test('🔴 붙임머리 기억 → 젤네일 캡션 미리보기(헤드리스 굽기)에 스티커가 안 얹힌다', () => {
    const { WM, E } = loadAll();
    WM.captureFromSlot(hairSlot(), { service: '붙임머리' });
    const base = [{ role: 'title', text: '젤네일', type: 'text' }];
    const out = E.decorateLayers(base, { photoCount: 1, service: '젤네일' });
    expect(out).toEqual(base);
    expect(E._lastSelect).toMatchObject({ via: 'none', reason: { blocked: 'service-mismatch' } });
  });

  test('🔴 붙임머리 기억 → 젤네일 편집기에도 안 얹힌다', () => {
    const { WM, E } = loadAll();
    WM.captureFromSlot(hairSlot(), { service: '붙임머리' });
    const st = E.forEditor({ restore: false, incoming: [], photoCount: 1, service: '젤네일' });
    expect(stickers(st)).toEqual([]);
  });

  test('같은 시술(붙임머리 → 붙임머리)은 예전처럼 자동으로 얹힌다', () => {
    const { WM, E } = loadAll();
    WM.captureFromSlot(hairSlot(), { service: '붙임머리' });
    const st = E.forEditor({ restore: false, incoming: [], photoCount: 1, service: '붙임머리' });
    expect(stickers(st)).toEqual(expect.arrayContaining(['✨', '💎']));
  });

  test('대소문자·공백·여러 시술(첫 시술 기준)은 같은 시술로 본다', () => {
    const { WM, E } = loadAll();
    WM.captureFromSlot(hairSlot(), { service: '붙임머리' });
    const st = E.forEditor({ restore: false, incoming: [], photoCount: 1, service: '  붙임머리 , 두피케어' });
    expect(stickers(st).length).toBeGreaterThan(0);
  });

  test('지금 시술을 모르면 기존 동작(추측해서 막지 않는다)', () => {
    const { WM, E } = loadAll();
    WM.captureFromSlot(hairSlot(), { service: '붙임머리' });
    const st = E.forEditor({ restore: false, incoming: [], photoCount: 1 });
    expect(stickers(st).length).toBeGreaterThan(0);
  });

  test('잇비 "평소 하던 대로"(명시 요청)는 시술이 달라도 적용한다', () => {
    const { WM, E } = loadAll();
    WM.captureFromSlot(hairSlot(), { service: '붙임머리' });
    const st = E.forEditor({ restore: false, orch: { useRecentStyle: true }, incoming: [], photoCount: 1, service: '젤네일' });
    expect(stickers(st).length).toBeGreaterThan(0);
  });
});

describe('옛 기억(시술 필드 없음) — 자동 이름에서만 시술을 읽는다', () => {
  function legacy(name) {
    return [{ id: 'old', schema: 2, sig: 'o', name, createdAt: Date.now(), thumb: null, ratio: '4:5', layoutIdx: 0, photoCount: 1,
      layoutOrder: [], collageBg: null, collageGap: null, fitMode: null, layers: [{ type: 'sticker', emoji: '💎', x: .5, y: .5, size: .1 }],
      shopStyleId: null, kind: 'service', applyCount: 0, lastAppliedAt: 0, publishCount: 1, lastPublishedAt: Date.now() }];
  }
  function run(name, service) {
    const { E } = loadAll();
    global.localStorage.setItem('itdasy:work_memory:list', JSON.stringify(legacy(name)));
    return stickers(E.forEditor({ restore: false, incoming: [], photoCount: 1, service }));
  }
  test('🔴 "붙임머리 한 장, …" 옛 기억 → 젤네일에 안 얹힌다(이번 라이브 계정의 기억이 이 형태)', () => {
    expect(run('붙임머리 한 장, 글씨 아래 가운데정렬', '젤네일')).toEqual([]);
  });
  test('"붙임머리 한 장, …" 옛 기억 → 붙임머리엔 얹힌다', () => {
    expect(run('붙임머리 한 장, 글씨 아래 가운데정렬', '붙임머리')).toEqual(['💎']);
  });
  test('원장이 이름을 바꾼 기억은 시술을 모르므로 막지 않는다', () => {
    expect(run('내 시그니처', '젤네일')).toEqual(['💎']);
  });
  test('시술명 없이 만든 기억("한 장, …")도 모름', () => {
    expect(run('한 장, 스티커만', '젤네일')).toEqual(['💎']);
  });
  test('전후비교·콜라주 이름도 읽는다', () => {
    expect(run('속눈썹 연장 전후비교, 글씨 위', '젤네일')).toEqual([]);
    expect(run('왁싱 콜라주 4장', '젤네일')).toEqual([]);
  });
});
