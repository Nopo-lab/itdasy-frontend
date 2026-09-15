'use strict';

const fs = require('fs');
const path = require('path');

function load() {
  global.window = { ITDASY_WORK_MEMORY: true };
  global.location = { search: '' };
  global.localStorage = {
    _m: { last_user_id: '5' },
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._m, k) ? this._m[k] : null; },
    setItem(k, v) { this._m[k] = String(v); }, removeItem(k) { delete this._m[k]; }
  };
  ['work-memory-policy.js', 'work-memory.js', 'work-memory-engine.js'].forEach((f) => {
    // eslint-disable-next-line no-eval
    eval(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'));
  });
  return { WM: window.WorkMemory, E: window.WorkMemoryEngine, P: window.WorkMemoryPolicy };
}

function memory(P, over) {
  return Object.assign({
    id: 'nail', schema: 2, sig: 'nail', name: '네일 완성샷', createdAt: Date.now(),
    ratio: '4:5', layoutIdx: 0, photoCount: 1, layers: [{ type: 'sticker', emoji: 'N', x: 0.5, y: 0.5, size: 0.1 }],
    industry: '네일', occasion: '완성샷', consentVersion: P.VERSION, autoApplyAllowed: true, ownerId: '5'
  }, over || {});
}

describe('실제 선택 엔진의 안전 정책', () => {
  test('추천은 기본 켜짐, 자동 적용은 기본 꺼짐이다', () => {
    const { WM } = load();
    expect(WM.recommendOn()).toBe(true);
    expect(WM.autoOn()).toBe(false);
  });

  test('자동 적용을 켜도 같은 계정·업종·목적·허용 기록만 선택한다', () => {
    const { WM, E, P } = load();
    localStorage.setItem(WM.KEYS.list, JSON.stringify([
      memory(P), memory(P, { id: 'hair', sig: 'hair', industry: '헤어' }),
      memory(P, { id: 'event', sig: 'event', occasion: '이벤트' }),
      memory(P, { id: 'other', sig: 'other', ownerId: '9' }),
      memory(P, { id: 'no', sig: 'no', autoApplyAllowed: false })
    ]));
    WM.setAutoOn(true);
    const ctx = { photoCount: 1, industry: '네일', occasion: '완성샷', accountId: '5' };
    expect(E.select(ctx).candidates.map((x) => x.id)).toEqual(['nail']);
    expect(E.forEditor(Object.assign({ restore: false, incoming: [], layersOnly: true }, ctx)).layers[0].emoji).toBe('N');
    expect(E.decorateLayers([], ctx)[0].emoji).toBe('N');
  });

  test('추천을 끄면 자동 적용도 꺼지고 편집기에 아무것도 얹지 않는다', () => {
    const { WM, E, P } = load();
    localStorage.setItem(WM.KEYS.list, JSON.stringify([memory(P)]));
    WM.setAutoOn(true); WM.setRecommendOn(false);
    expect(WM.autoOn()).toBe(false);
    expect(E.forEditor({ restore: false, incoming: [], photoCount: 1, industry: '네일', occasion: '완성샷', accountId: '5' })).toBeNull();
  });

  test('자동 적용이 꺼져도 같은 칸의 스타일은 한 탭 추천으로만 준비한다', () => {
    const { WM, E, P } = load();
    localStorage.setItem(WM.KEYS.list, JSON.stringify([
      memory(P, { autoApplyAllowed: false, adjustmentPreset: { presetId: 'nail_color', presetStrength: 0.5 } }),
      memory(P, { id: 'hair', sig: 'hair', industry: '헤어', autoApplyAllowed: false })
    ]));
    const ctx = { restore: false, incoming: [], layersOnly: true, photoCount: 1,
      industry: '네일', occasion: '완성샷', accountId: '5' };
    expect(E.forEditor(ctx)).toBeNull();
    const suggestion = E.recommendForEditor(ctx);
    expect(suggestion.memoryId).toBe('nail');
    expect(suggestion.adjustmentPreset.presetId).toBe('nail_color');
    expect(suggestion.state.adjustmentPreset).toEqual({ presetId: 'nail_color', presetStrength: 0.5 });
    expect(suggestion.state.layers[0]).toMatchObject({ _src: 'wm', _wmTok: suggestion.token });
    expect(WM.get('nail').applyCount || 0).toBe(0);
    expect(E.acceptSuggestion(suggestion)).toBe(true);
    expect(WM.get('nail').applyCount).toBe(1);
    expect(E._lastApply.memoryId).toBe('nail');
  });

  test('레이어 없는 보정 전용 스타일도 추천하고 적용 기록을 남긴다', () => {
    const { WM, E, P } = load();
    localStorage.setItem(WM.KEYS.list, JSON.stringify([
      memory(P, { layers: [], adjustmentPreset: { presetId: 'nail_color', presetStrength: 1 } }),
    ]));
    const suggestion = E.recommendForEditor({ restore: false, photoCount: 1,
      industry: '네일', occasion: '완성샷', accountId: '5' });
    expect(suggestion.state.layers).toEqual([]);
    expect(suggestion.adjustmentPreset.presetId).toBe('nail_color');
    expect(E.acceptSuggestion(suggestion)).toBe(true);
    expect(E._lastApply).toMatchObject({ token: suggestion.token, memoryId: 'nail', count: 0 });
  });
});
