'use strict';

/*
 * 한 원장이 여러 방식으로 시술 자랑을 올리는 실사용 흐름 QA.
 * 핵심은 "원장 1명 = 스타일 1개"가 아니라,
 * 같은 원장 안에서도 스타일/업종/게시목적/전후 여부별로 따로 배우고
 * 갈리면 억지로 적용하지 않는지 확인하는 것이다.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

function memBackend() {
  const db = { preferences: new Map(), learning_signals: new Map(), preference_versions: new Map() };
  return {
    async put(s, r) { db[s].set(r.id, JSON.parse(JSON.stringify(r))); return r.id; },
    async get(s, id) { const v = db[s].get(id); return v ? JSON.parse(JSON.stringify(v)) : null; },
    async all(s) { return [...db[s].values()].map((v) => JSON.parse(JSON.stringify(v))); },
    async del(s, id) { db[s].delete(id); },
  };
}

function load(userId = 'owner-diverse') {
  global.window = {};
  global.location = { search: '' };
  const ls = {};
  global.localStorage = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(ls, k) ? ls[k] : null; },
    setItem(k, v) { ls[k] = String(v); },
    removeItem(k) { delete ls[k]; },
  };
  global.localStorage.setItem('last_user_id', String(userId));
  ['work-memory-engine.js', 'work-memory-store.js', 'work-memory-preferences.js'].forEach((f) => {
    // eslint-disable-next-line no-eval
    eval(fs.readFileSync(path.join(ROOT, 'workspace', f), 'utf8'));
  });
  global.window.WMStore._setBackend(memBackend());
  return { E: global.window.WorkMemoryEngine, P: global.window.WMPrefs };
}

let n = 0;
function obs(signals, context, extra = {}) {
  n += 1;
  return Object.assign({
    observationId: 'diverse-' + n,
    memoryId: extra.memoryId || 'mem-' + n,
    context,
    outcome: extra.outcome || 'published',
    signals: signals.map((s, i) => Object.assign({ at: i }, s)),
    baseline: extra.baseline || [],
    startedAt: 0,
    endedAt: Date.now() + n,
  }, extra.extra || {});
}

const sig = {
  font: (after, before = 'pretendard') => ({ event: 'font_changed', layerKey: 'title', before, after }),
  color: (after, before = '#222222') => ({ event: 'color_changed', layerKey: 'title', before, after }),
  align: (after, before = 'center') => ({ event: 'alignment_changed', layerKey: 'title', before, after }),
  pos: (x, y) => ({ event: 'position_changed', layerKey: 'title', after: { x, y } }),
  size: (v) => ({ event: 'size_changed', layerKey: 'title', after: v }),
  text: () => ({ event: 'text_changed', layerKey: 'title', before: '기존', after: '9월 이벤트' }),
};

const ctx = (over = {}) => Object.assign({
  shopStyleId: 'clean', service: '젤네일', photoCount: 1, kind: 'service', hasBeforeAfter: false,
}, over);

async function repeat(P, times, signals, context, extra = {}) {
  for (let i = 0; i < times; i += 1) await P.learn(obs(signals, context, extra));
}

describe('다양한 원장 스타일 학습 흐름 — 상황별 분리 보장', () => {
  test('같은 원장의 완성샷/이벤트/전후 스타일이 서로 새지 않는다', async () => {
    const { P } = load();
    const service = ctx({ kind: 'service', hasBeforeAfter: false });
    const promo = ctx({ kind: 'promotion', hasBeforeAfter: false });
    const beforeAfter = ctx({ kind: 'service', photoCount: 2, hasBeforeAfter: true });

    await repeat(P, 3, [sig.font('jua'), sig.color('#FFFFFF'), sig.pos(0.22, 0.82)], service, { memoryId: 'service-clean' });
    await repeat(P, 3, [sig.font('blackhansans'), sig.color('#FF3366'), sig.size(0.14), sig.text()], promo, { memoryId: 'event-pop' });
    await repeat(P, 3, [sig.align('left'), sig.color('#15181D'), sig.pos(0.18, 0.18)], beforeAfter, { memoryId: 'before-after' });

    expect((await P.resolve('font', service)).value).toBe('jua');
    expect((await P.resolve('color', service)).value).toBe('#FFFFFF');
    expect((await P.resolve('font', promo)).value).toBe('blackhansans');
    expect((await P.resolve('size', promo)).value).toBe('~');
    expect((await P.resolve('color', beforeAfter)).value).toBe('#15181D');
    expect((await P.resolve('align', beforeAfter)).value).toBe('left');

    // 이벤트에서 반복된 강한 글자체가 일반 완성샷에 덮이지 않는다.
    expect((await P.resolve('font', service)).value).not.toBe('blackhansans');
    // 전후사진 정렬도 일반 1장 완성샷으로 새지 않는다.
    expect(await P.resolve('align', service)).toBeNull();
    // 문구 내용은 여전히 학습 대상이 아니다.
    expect((await P.list()).some((p) => p.feature === 'text')).toBe(false);
  });

  test('같은 시술 완성샷 안에서도 선택한 샵스타일별 취향을 따로 배운다', async () => {
    const { P } = load();
    const clean = ctx({ shopStyleId: 'clean' });
    const poster = ctx({ shopStyleId: 'poster' });

    await repeat(P, 3, [sig.font('jua'), sig.color('#FFFFFF')], clean, { memoryId: 'clean-style' });
    await repeat(P, 3, [sig.font('blackhansans'), sig.color('#15181D')], poster, { memoryId: 'poster-style' });

    expect((await P.resolve('font', clean)).value).toBe('jua');
    expect((await P.resolve('color', clean)).value).toBe('#FFFFFF');
    expect((await P.resolve('font', poster)).value).toBe('blackhansans');
    expect((await P.resolve('color', poster)).value).toBe('#15181D');
  });

  test('스타일을 모르는 새 작업에서 기존 스타일들이 반반 갈리면 억지 추천하지 않는다', async () => {
    const { P } = load();
    await repeat(P, 3, [sig.font('jua')], ctx({ shopStyleId: 'clean' }), { memoryId: 'clean-style' });
    await repeat(P, 3, [sig.font('blackhansans')], ctx({ shopStyleId: 'poster' }), { memoryId: 'poster-style' });

    const unknownStyle = ctx({ shopStyleId: null });
    expect(await P.resolve('font', unknownStyle)).toBeNull();
  });
});
