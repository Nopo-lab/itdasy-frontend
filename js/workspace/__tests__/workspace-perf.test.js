'use strict';

/* workspace-perf 순수 로직 테스트 (2026-07-15)
   _internals 는 예전부터 노출돼 있었는데 테스트가 0건이었다. 성과 화면은 원장님이 "다음 글을 어떻게
   만들지" 정하는 근거라, 집계가 조용히 틀리면 잘못된 작업 습관을 굳힌다 → 순수 함수만이라도 잠근다. */

const fs = require('fs');
const path = require('path');

function loadPerf(layoutPresets) {
  global.window = {
    _esc: (v) => String(v == null ? '' : v),
    WorkspaceLayout: {
      getById: (id) => (layoutPresets || []).filter((p) => p.id === id)[0] || null,
      getMyLayouts: () => [],
    },
  };
  const file = path.join(__dirname, '..', 'workspace-perf.js');
  // eslint-disable-next-line no-eval
  eval(fs.readFileSync(file, 'utf8'));
  return global.window.WorkspacePerf._internals;
}

const STARTERS = [
  { id: 'wsl-ba-lr', name: '전후 · 좌우' },
  { id: 'wsl-ba-tb', name: '전후 · 상하' },
];

describe('_layoutOf — 실제 프리셋을 봐야 한다', () => {
  test('templateOutputs[].templateId 를 프리셋 이름으로 푼다', () => {
    const { _layoutOf } = loadPerf(STARTERS);
    const slot = {
      templateOutputs: [{ templateId: 'wsl-ba-lr' }],
      workspaceContext: { templatePurpose: 'before_after' },
    };
    expect(_layoutOf(slot)).toBe('전후 · 좌우');
  });

  test('좌우와 상하가 서로 다른 값으로 갈린다 (예전엔 둘 다 "전후" 로 뭉갰음)', () => {
    const { _layoutOf } = loadPerf(STARTERS);
    const lr = { templateOutputs: [{ templateId: 'wsl-ba-lr' }], workspaceContext: { templatePurpose: 'before_after' } };
    const tb = { templateOutputs: [{ templateId: 'wsl-ba-tb' }], workspaceContext: { templatePurpose: 'before_after' } };
    expect(_layoutOf(lr)).not.toBe(_layoutOf(tb));
  });

  test('레이아웃 없이 사진만 올린 슬롯(templateId=null)은 옛 폴백을 쓴다', () => {
    const { _layoutOf } = loadPerf(STARTERS);
    const slot = { templateOutputs: [{ templateId: null }], workspaceContext: { templatePurpose: 'review' } };
    expect(_layoutOf(slot)).toBe('후기');
  });

  test('모르는 프리셋 id 면 폴백 (내 레이아웃이 아직 안 실렸을 때)', () => {
    const { _layoutOf } = loadPerf(STARTERS);
    const slot = { templateOutputs: [{ templateId: 'wsl-알수없음' }], workspaceContext: { templateLabel: '내가 만든 틀' } };
    expect(_layoutOf(slot)).toBe('내가 만든 틀');
  });

  test('슬롯이 없으면 빈 문자열', () => {
    const { _layoutOf } = loadPerf(STARTERS);
    expect(_layoutOf(null)).toBe('');
  });
});

describe('_ro — 조사 으로/로', () => {
  test('받침 없으면 로', () => {
    const { _ro } = loadPerf(STARTERS);
    expect(_ro('말투')).toBe('로');       // 투 — 받침 없음
    expect(_ro('사진 장수')).toBe('로');  // 수 — 받침 없음
  });

  test('받침 있으면 으로', () => {
    const { _ro } = loadPerf(STARTERS);
    expect(_ro('레이아웃')).toBe('으로');  // 웃 — 받침 ㅅ
    expect(_ro('사진')).toBe('으로');      // 진 — 받침 ㄴ
  });

  test('받침 ㄹ 은 예외적으로 로', () => {
    const { _ro } = loadPerf(STARTERS);
    expect(_ro('제목')).toBe('으로');
    expect(_ro('스타일')).toBe('로');      // 일 — 받침 ㄹ
  });

  test('한글이 아니거나 비어도 안 터진다', () => {
    const { _ro } = loadPerf(STARTERS);
    expect(_ro('')).toBe('으로');
    expect(_ro(null)).toBe('으로');
    expect(_ro('layout')).toBe('으로');
  });
});

describe('_photoCountOf', () => {
  test('장수를 라벨로, 4장 이상은 묶는다', () => {
    const { _photoCountOf } = loadPerf(STARTERS);
    expect(_photoCountOf({ photos: [1] })).toBe('1장');
    expect(_photoCountOf({ photos: [1, 2] })).toBe('2장');
    expect(_photoCountOf({ photos: [1, 2, 3, 4, 5] })).toBe('4장 이상');
    expect(_photoCountOf({ photos: [] })).toBe('');
  });
});

describe('_agg — 표본 가드가 핵심', () => {
  const row = (layout, likes, comments, saved, bookings) => ({
    layout, likes, comments, saved: saved || 0,
    bookings: new Array(bookings || 0).fill({ name: 'x', sure: false }),
  });
  const byLayout = (r) => r.layout || null;

  test('3건 미만은 enough=false — "이게 최고" 라고 말하면 안 된다', () => {
    const { _agg, MIN_POSTS } = loadPerf(STARTERS);
    expect(MIN_POSTS).toBe(3);
    const out = _agg([row('A', 100, 0, 0, 0), row('A', 100, 0, 0, 0)], byLayout);
    expect(out[0].posts).toBe(2);
    expect(out[0].enough).toBe(false);
  });

  test('3건 이상이면 enough=true', () => {
    const { _agg } = loadPerf(STARTERS);
    const out = _agg([row('A', 1, 0, 0, 0), row('A', 1, 0, 0, 0), row('A', 1, 0, 0, 0)], byLayout);
    expect(out[0].enough).toBe(true);
  });

  test('반응 점수 = 좋아요 + 댓글×2 + 저장×3 (백엔드 top_posts 와 같은 가중치)', () => {
    const { _score } = loadPerf(STARTERS);
    expect(_score({ likes: 10, comments: 5, saved: 2 })).toBe(10 + 10 + 6);
  });

  test('반응 점수 평균이 높은 축이 1등 — 예약 0건이라도 순위가 나온다', () => {
    const { _agg } = loadPerf(STARTERS);
    const out = _agg([row('A', 10, 0, 0, 0), row('B', 100, 0, 0, 0)], byLayout);
    expect(out[0].key).toBe('B');
    expect(out[0].scorePerPost).toBe(100);
  });

  test('점수가 같으면 예약이 많은 쪽이 앞선다', () => {
    const { _agg } = loadPerf(STARTERS);
    const out = _agg([row('A', 10, 0, 0, 0), row('B', 10, 0, 0, 3)], byLayout);
    expect(out[0].key).toBe('B');
  });

  test('키가 없는 행(작업실 밖에서 올린 글)은 집계에서 빠진다', () => {
    const { _agg } = loadPerf(STARTERS);
    const out = _agg([row('', 10, 0, 0, 0), row('A', 10, 0, 0, 0)], byLayout);
    expect(out.length).toBe(1);
    expect(out[0].key).toBe('A');
  });
});

describe('_attachInquiries — 게시물별 미응대 문의', () => {
  test('media_id 로 묶고 intent 는 중복 제거', () => {
    const { _attachInquiries } = loadPerf(STARTERS);
    const rows = [{ id: 'm1', inquiries: 0, intents: [] }, { id: 'm2', inquiries: 0, intents: [] }];
    _attachInquiries(rows, {
      items: [
        { media_id: 'm1', intent: 'price' },
        { media_id: 'm1', intent: 'price' },
        { media_id: 'm1', intent: 'booking' },
        { media_id: 'm2', intent: 'location' },
      ],
    });
    expect(rows[0].inquiries).toBe(3);
    expect(rows[0].intents).toEqual(['price', 'booking']);
    expect(rows[1].inquiries).toBe(1);
  });

  test('큐가 비었거나 못 읽었으면 아무 것도 안 붙는다 (화면은 살아있어야 함)', () => {
    const { _attachInquiries } = loadPerf(STARTERS);
    const rows = [{ id: 'm1', inquiries: 0, intents: [] }];
    _attachInquiries(rows, { items: [], _failed: true });
    expect(rows[0].inquiries).toBe(0);
  });

  test('media_id 없는 항목은 무시', () => {
    const { _attachInquiries } = loadPerf(STARTERS);
    const rows = [{ id: 'm1', inquiries: 0, intents: [] }];
    _attachInquiries(rows, { items: [{ intent: 'price' }] });
    expect(rows[0].inquiries).toBe(0);
  });
});

describe('_attribute — 예약 귀속 (기존 동작 회귀 방지)', () => {
  const DAY = 86400000;
  const T = Date.parse('2026-07-10T00:00:00Z');

  test('예약 직전 7일 안의 가장 최근 게시물 1건에만 붙는다', () => {
    const { _attribute } = loadPerf(STARTERS);
    const rows = [
      { publishedAt: T - 1 * DAY, slot: null, bookings: [] },
      { publishedAt: T - 5 * DAY, slot: null, bookings: [] },
    ];
    _attribute(rows, [{ created_at: new Date(T).toISOString(), customer_name: '김철수' }]);
    expect(rows[0].bookings.length).toBe(1);
    expect(rows[1].bookings.length).toBe(0);
  });

  test('7일 넘은 게시물엔 안 붙는다', () => {
    const { _attribute } = loadPerf(STARTERS);
    const rows = [{ publishedAt: T - 9 * DAY, slot: null, bookings: [] }];
    _attribute(rows, [{ created_at: new Date(T).toISOString(), customer_name: '김철수' }]);
    expect(rows[0].bookings.length).toBe(0);
  });

  test('취소된 예약은 세지 않는다', () => {
    const { _attribute } = loadPerf(STARTERS);
    const rows = [{ publishedAt: T - 1 * DAY, slot: null, bookings: [] }];
    _attribute(rows, [{ created_at: new Date(T).toISOString(), status: 'cancelled' }]);
    expect(rows[0].bookings.length).toBe(0);
  });

  test('고객연결한 슬롯 + 같은 고객 = 추정이 아니라 확정(sure)', () => {
    const { _attribute } = loadPerf(STARTERS);
    const rows = [{ publishedAt: T - 1 * DAY, slot: { customer_id: 7 }, bookings: [] }];
    _attribute(rows, [{ created_at: new Date(T).toISOString(), customer_id: 7, customer_name: '김철수' }]);
    expect(rows[0].bookings[0].sure).toBe(true);
    expect(rows[0].sureCount).toBe(1);
  });

  test('게시물보다 먼저 잡힌 예약은 그 게시물 덕이 아니다', () => {
    const { _attribute } = loadPerf(STARTERS);
    const rows = [{ publishedAt: T + 1 * DAY, slot: null, bookings: [] }];
    _attribute(rows, [{ created_at: new Date(T).toISOString(), customer_name: '김철수' }]);
    expect(rows[0].bookings.length).toBe(0);
  });
});

describe('_matchSlot — 인스타 게시물 ↔ 슬롯 연결', () => {
  test('igMediaId 가 최우선', () => {
    const { _matchSlot } = loadPerf(STARTERS);
    const slots = [
      { id: 'wrong', caption: '같은 캡션', publish: { igMediaId: '999' } },
      { id: 'right', caption: '다른 캡션', publish: { igMediaId: '123' } },
    ];
    expect(_matchSlot({ id: '123', caption: '같은 캡션' }, slots).id).toBe('right');
  });

  test('id 가 없으면 캡션으로 폴백 (옛 슬롯)', () => {
    const { _matchSlot } = loadPerf(STARTERS);
    const slots = [{ id: 'old', caption: '오늘 속눈썹 시술', publish: {} }];
    expect(_matchSlot({ id: '123', caption: '오늘 속눈썹 시술' }, slots).id).toBe('old');
  });

  test('아무것도 안 맞으면 null (작업실 밖에서 올린 글)', () => {
    const { _matchSlot } = loadPerf(STARTERS);
    expect(_matchSlot({ id: '123', caption: 'zzz' }, [{ id: 'a', caption: 'yyy', publish: {} }])).toBe(null);
  });
});
