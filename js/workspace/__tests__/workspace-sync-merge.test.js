'use strict';

/* M3: 3-way 병합 (2026-07-17)
   폰은 캡션만, 태블릿은 사진만 고쳤는데도 늦게 올라간 쪽이 슬롯을 통째로 덮어써 상대 수정이
   사라지던 버그. base(양쪽이 마지막으로 합의한 버전)를 기준으로 필드별로 판정하면 둘 다 산다.
     local==base  → 내가 안 건드림 → remote
     remote==base → 상대가 안 건드림 → local
     셋 다 다름   → 진짜 충돌(자동으로 못 고름) */

const fs = require('fs');
const path = require('path');

function loadSync() {
  /* 순수 병합 로직만 본다. _debug 는 플래그 ON 일 때만 노출되므로 켜되,
     ready()(=authHeader/apiFetch 필요)가 false 라 실제 동기화·네트워크는 안 돈다.
     boot 재시도 타이머만 도는데 jest 종료를 막지 않게 setTimeout 을 무력화한다. */
  global.window = { ITDASY_SLOT_SYNC: true, addEventListener() {} };
  global.document = { addEventListener() {}, hidden: false };
  global.indexedDB = { open() { return {}; } };
  const realTimeout = global.setTimeout;
  global.setTimeout = () => 0;
  const file = path.join(__dirname, '..', 'workspace-sync.js');
  // eslint-disable-next-line no-eval
  eval(fs.readFileSync(file, 'utf8'));
  global.setTimeout = realTimeout;
  return global.window.WorkspaceSync && global.window.WorkspaceSync._debug;
}

const D = loadSync();
const base0 = {
  label: '글', caption: '원본캡션', hashtags: '#a', customer_id: null, order: 0,
  photos: [{ id: 'p1', role: 'hero' }],
};

describe('merge3 — 서로 다른 필드는 둘 다 산다', () => {
  test('폰=캡션 / 태블릿=사진 → 자동 병합, 손실 0', () => {
    const base = D.makeBase(base0);
    const local = Object.assign({}, base0, { caption: '폰 캡션' });
    const remote = Object.assign({}, base0, { photos: [{ id: 'p1', role: 'hero' }, { id: 'p2', role: 'after' }] });
    const r = D.merge3(base, local, remote);
    expect(r.conflicts).toEqual([]);
    expect(r.slot.caption).toBe('폰 캡션');        // 내 수정 생존
    expect(r.slot.photos.length).toBe(2);          // 상대 수정 생존
  });

  test('내가 안 건드린 필드는 상대 것을 받는다', () => {
    const base = D.makeBase(base0);
    const local = Object.assign({}, base0);                       // 아무것도 안 고침
    const remote = Object.assign({}, base0, { caption: '상대 캡션' });
    const r = D.merge3(base, local, remote);
    expect(r.slot.caption).toBe('상대 캡션');
    expect(r.conflicts).toEqual([]);
  });

  test('상대가 안 건드린 필드는 내 것을 지킨다', () => {
    const base = D.makeBase(base0);
    const local = Object.assign({}, base0, { caption: '내 캡션' });
    const remote = Object.assign({}, base0);
    const r = D.merge3(base, local, remote);
    expect(r.slot.caption).toBe('내 캡션');
    expect(r.conflicts).toEqual([]);
  });

  test('결과가 같으면 충돌 아님(둘이 같은 값으로 고침)', () => {
    const base = D.makeBase(base0);
    const local = Object.assign({}, base0, { caption: '같은값' });
    const remote = Object.assign({}, base0, { caption: '같은값' });
    expect(D.merge3(base, local, remote).conflicts).toEqual([]);
  });
});

describe('merge3 — 진짜 충돌만 사람에게', () => {
  test('둘 다 같은 필드를 다르게 고치면 충돌로 표시', () => {
    const base = D.makeBase(base0);
    const local = Object.assign({}, base0, { caption: '폰' });
    const remote = Object.assign({}, base0, { caption: '태블릿' });
    const r = D.merge3(base, local, remote);
    expect(r.conflicts).toContain('caption');
  });

  test('둘 다 사진을 바꾸면 충돌 — 배열은 필드로 못 쪼갠다', () => {
    const base = D.makeBase(base0);
    const local = Object.assign({}, base0, { photos: [{ id: 'pX', role: 'hero' }] });
    const remote = Object.assign({}, base0, { photos: [{ id: 'pY', role: 'hero' }] });
    expect(D.merge3(base, local, remote).conflicts).toContain('photos');
  });
});

describe('photoSig — blob 없이 변경만 감지', () => {
  test('같은 사진 집합은 같은 서명', () => {
    expect(D.photoSig(base0)).toBe(D.photoSig(Object.assign({}, base0)));
  });
  test('사진이 추가되면 서명이 달라진다', () => {
    const more = Object.assign({}, base0, { photos: base0.photos.concat([{ id: 'p2', role: 'after' }]) });
    expect(D.photoSig(more)).not.toBe(D.photoSig(base0));
  });
  test('사진 없거나 깨져도 안 터진다', () => {
    expect(D.photoSig(null)).toBe('');
    expect(D.photoSig({})).toBe('');
  });
});

describe('makeBase — 서버로 새면 안 되는 순수 로컬 상태', () => {
  test('사진 blob 은 안 담고 서명만(용량 방어)', () => {
    const b = D.makeBase({ caption: 'c', photos: [{ id: 'p1', dataUrl: 'data:image/png;base64,AAAA' }] });
    expect(JSON.stringify(b)).not.toContain('data:image');
    expect(typeof b._sig).toBe('string');
  });
});
