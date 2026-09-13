/**
 * P1 회귀 — **동기화 충돌로 일부러 남긴 두 벌 중 하나가 작업실에서 사라지던 것.**
 *
 * 두 서브시스템이 정반대로 동작하고 있었다:
 *   workspace-sync.js `resolveConflict()`
 *     → 진짜 충돌이면 서버본을 원본 자리에, 내 것을 `_conflict_` 사본으로 **둘 다 보존**한다.
 *       (자동으로 고를 근거가 원리적으로 없으니 사람이 고르라고 남기는 것이다)
 *   workspace-v2-home.js `_dedupDrafts()`
 *     → 옛 버그(v663 이전)로 쌓인 중복 초안을 **같은 사진 지문이면 최신 1개**로 합친다.
 *
 * 충돌 쌍은 사진이 같으니 지문이 같다 → 합쳐지고, 더 최신인 충돌 사본만 남는다.
 * 실측(2026-09-13, cbt3): 로컬 3 · 서버 3 인데 화면 타일 **2**,
 * 사라진 `mtwaanxzx4nb6` 는 status done / syncState synced / 삭제·tombstone 아님, 필터 '전체'.
 * 데이터는 남아 있지만 **원장은 충돌이 났다는 사실조차 모르고 다른 버전에 닿을 수 없다.**
 *
 * 계약(이 테스트가 고정하는 것):
 *   평범한 중복 초안 → 지금처럼 합친다.
 *   진짜 충돌 쌍     → 둘 다 남긴다.
 * 판정은 문자열 grep 이 아니라 **실제 `_dedupDrafts()` 를 돌린 결과 slot id 목록**으로 한다.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HOME = fs.readFileSync(path.join(ROOT, 'js/workspace/workspace-v2-home.js'), 'utf8');
const SYNC = fs.readFileSync(path.join(ROOT, 'js/workspace/workspace-sync.js'), 'utf8');

/** 소스에서 함수 하나를 원문 그대로 떼어낸다(중괄호 균형으로 끝을 찾는다). */
function cut(src, header) {
  const i = src.indexOf(header);
  if (i < 0) throw new Error('not found: ' + header);
  let depth = 0, started = false;
  for (let k = i; k < src.length; k++) {
    const ch = src[k];
    if (ch === '{') { depth++; started = true; }
    else if (ch === '}') { depth--; if (started && depth === 0) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced: ' + header);
}

/** `_dedupDrafts` 를 의존 함수와 함께 진짜로 실행 가능한 형태로 만든다. */
function loadDedup() {
  const parts = [cut(HOME, 'function _isPub('), cut(HOME, 'function _dedupDrafts(')];
  // 충돌 사본 판별 헬퍼가 생겼다면 같이 싣는다(수정 전에는 없다 — 없으면 건너뛴다).
  try { parts.unshift(cut(HOME, 'function _isConflictCopy(')); } catch (_e) { void _e; }
  // eslint-disable-next-line no-new-func
  return new Function('slots', parts.join('\n') + '\n; return _dedupDrafts(slots);');
}

const ids = (list) => list.map((s) => String(s.id));
/** 같은 사진을 쓰는 초안 — 지문이 같아지도록 photo id 를 공유한다. */
const draft = (id, t, extra) => Object.assign({
  id, label: '작업', status: 'done', updatedAt: t, photos: [{ id: 'ph-1' }],
}, extra || {});

describe('P1 · 충돌로 남긴 두 벌은 둘 다 보인다', () => {
  test('CASE A · 평범한 중복 초안은 지금처럼 하나로 합친다 (기존 계약 유지)', () => {
    const out = loadDedup()([draft('a', 100), draft('b', 200)]);
    expect(out).toHaveLength(1);
    expect(ids(out)).toEqual(['b']);            // 최신이 남는다
  });

  test('🔴 CASE B · 원본 + 충돌 사본은 둘 다 남는다 (이번 버그)', () => {
    const out = loadDedup()([
      draft('mtwaanxzx4nb6', 100),
      draft('mtwaanxzx4nb6_conflict_1789107327563', 200, { conflictOf: 'mtwaanxzx4nb6' }),
    ]);
    expect(ids(out).sort()).toEqual(
      ['mtwaanxzx4nb6', 'mtwaanxzx4nb6_conflict_1789107327563'].sort()
    );
  });

  test('🔴 CASE B2 · 옛 데이터(메타 없이 id 규약만) 도 둘 다 남는다', () => {
    const out = loadDedup()([
      draft('slot9', 100),
      draft('slot9_conflict_1789107327563', 200),   // conflictOf 필드가 없는 legacy
    ]);
    expect(out).toHaveLength(2);
  });

  test('🔴 CASE C · 충돌 사본이 둘이면 셋 다 접근 가능하다', () => {
    const out = loadDedup()([
      draft('s1', 100),
      draft('s1_conflict_111', 200, { conflictOf: 's1' }),
      draft('s1_conflict_222', 300, { conflictOf: 's1' }),
    ]);
    expect(ids(out).sort()).toEqual(['s1', 's1_conflict_111', 's1_conflict_222']);
  });

  test('🔴 CASE D · 충돌 사본이 나중에 갱신돼도 계속 보인다', () => {
    const out = loadDedup()([
      draft('s2', 999),                                        // 원본이 더 최신이어도
      draft('s2_conflict_333', 100, { conflictOf: 's2' }),     // 사본은 사라지지 않는다
    ]);
    expect(ids(out).sort()).toEqual(['s2', 's2_conflict_333']);
  });

  test('CASE F · 평범한 초안 목록은 개수가 늘지 않는다 (과잉 보존 방지)', () => {
    const out = loadDedup()([
      draft('n1', 100, { photos: [{ id: 'p1' }] }),
      draft('n2', 200, { photos: [{ id: 'p2' }] }),
      draft('n3', 300, { photos: [{ id: 'p3' }] }),
    ]);
    expect(out).toHaveLength(3);
  });

  test('발행본은 원래부터 합치지 않는다 (경계 확인)', () => {
    const out = loadDedup()([
      draft('pub1', 100, { status: 'published' }),
      draft('pub2', 200, { status: 'published' }),
    ]);
    expect(out).toHaveLength(2);
  });
});

describe('P1 · 충돌 사본은 의미 필드로 스스로를 증명한다', () => {
  test('🔴 사본을 만들 때 conflictOf 를 심는다 — 라벨 문자열에만 의존하지 않는다', () => {
    const body = cut(SYNC, 'function resolveConflict(');
    expect(body).toMatch(/conflictOf\s*:/);
  });

  test('conflictOf 는 서버 왕복에서 살아남는다 (META_SKIP 에 없어야 meta 로 실린다)', () => {
    const skip = SYNC.match(/var META_SKIP = \{[^}]*\}/);
    expect(skip).toBeTruthy();
    expect(skip[0]).not.toMatch(/conflictOf/);
  });

  test('사본 라벨에 사람이 읽을 표시가 남는다', () => {
    const body = cut(SYNC, 'function resolveConflict(');
    expect(body).toMatch(/다른 기기 수정본/);
  });
});

describe('P1 · 충돌 사본은 화면에서 구분된다', () => {
  /** `_feedTile` 의 칩 분기를 그대로 떼어 실행한다(라벨 문자열이 아니라 필드로 판정하는지). */
  function loadChip() {
    const parts = [cut(HOME, 'function _isConflictCopy('), cut(HOME, 'function _isPub(')];
    const tile = cut(HOME, 'function _feedTile(');
    const i = tile.indexOf('var chip =');
    // ⚠️ '작성 중' 은 위쪽 주석에도 나온다 — 반드시 `var chip =` **뒤에서** 찾는다.
    const j = tile.indexOf(';', tile.indexOf("'작성 중'", i));
    if (i < 0 || j < 0) throw new Error('chip branch not found');
    const body = tile.slice(i, j + 1);
    // eslint-disable-next-line no-new-func
    return new Function('slot', 'window',
      parts.join('\n') + '\nvar _isReady=function(){return true;};\n' +
      'var _ss=null, _local=false;\n' + body + '\n; return chip;');
  }

  test('🔴 충돌 사본 카드에 "다른 기기 수정본" 표시가 붙는다', () => {
    const chip = loadChip()(draft('s_conflict_111', 100, { conflictOf: 's' }), {});
    expect(chip).toMatch(/다른 기기 수정본/);
  });

  test('라벨이 병합으로 덮여도 표시는 유지된다 (필드로 판정)', () => {
    const slot = draft('s_conflict_222', 100, { conflictOf: 's', label: '서버가 덮어쓴 제목' });
    expect(loadChip()(slot, {})).toMatch(/다른 기기 수정본/);
  });

  test('평범한 초안에는 충돌 표시가 없다 (오탐 방지)', () => {
    expect(loadChip()(draft('plain', 100), {})).not.toMatch(/다른 기기 수정본/);
  });
});
