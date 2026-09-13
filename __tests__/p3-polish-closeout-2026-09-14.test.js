'use strict';
/* [2026-09-14 REMAINING P3 POLISH] 첫원장 라이브에서 남은 거슬림 — 각 항목을 수정 전 코드로 돌리면 실패한다. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

function pickFn(src, name, indent) {
  const i = src.indexOf((indent || '  ') + 'function ' + name + '(');
  if (i < 0) throw new Error('no fn ' + name);
  let d = 0, st = false;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') { d++; st = true; } else if (src[k] === '}') { d--; if (st && d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('unterminated ' + name);
}

// ── P3-6 예약 기본 시각 ─────────────────────────────────────────
describe('P3-6 새 예약 기본 시각은 지난 시각이 아니다', () => {
  const CAL = read('app-calendar-view.js');
  // eslint-disable-next-line no-new-func
  const mk = new Function(
    'function _pad(n){return String(n).padStart(2,"0");}\n' +
    'function _ds(d){return d.getFullYear()+"-"+_pad(d.getMonth()+1)+"-"+_pad(d.getDate());}\n' +
    pickFn(CAL, '_defaultNewSlot') + '; return _defaultNewSlot;')();
  const slots = []; for (let h = 10; h < 22; h++) for (const m of [0, 30]) slots.push(String(h).padStart(2, '0') + ':' + (m ? '30' : '00'));
  const at = (h, mi) => new Date(2026, 8, 14, h, mi);
  test('🔴 오후 1:12 → 13:30 (영업 슬롯)', () => {
    expect(mk('2026-09-14', slots, at(13, 12))).toEqual({ dateStr: '2026-09-14', start: '13:30', end: '14:30' });
  });
  test('정각이면 다음 30분(지금과 같은 시각 금지)', () => {
    expect(mk('2026-09-14', slots, at(13, 0)).start).toBe('13:30');
  });
  test('영업 시작 전(오전 8:05) → 첫 슬롯 10:00', () => {
    expect(mk('2026-09-14', slots, at(8, 5)).start).toBe('10:00');
  });
  test('영업 끝난 뒤(22:10) → 22:30 (지난 시각 아님)', () => {
    expect(mk('2026-09-14', slots, at(22, 10)).start).toBe('22:30');
  });
  test('🔴 새벽 0:57(라이브 재현) → 오전 9·10시가 아니라 오늘 첫 영업 슬롯 10:00 (지난 시각 아님)', () => {
    const r = mk('2026-09-14', slots, at(0, 57));
    expect(r.start).toBe('10:00'); expect(r.dateStr).toBe('2026-09-14');
  });
  test('밤 23:10 → 내일 첫 슬롯', () => {
    expect(mk('2026-09-14', slots, at(23, 10))).toEqual({ dateStr: '2026-09-15', start: '10:00', end: '11:00' });
  });
  test('다른 날짜를 골라 들어오면 그날 첫 슬롯', () => {
    expect(mk('2026-09-20', slots, at(15, 0)).start).toBe('10:00');
  });
  test('폼이 기본값을 이 함수에서 받는다(slots[0] 고정 금지)', () => {
    expect(CAL).toMatch(/_auto = \(!existing && !pendS\) \? _defaultNewSlot\(/);
    expect(CAL).not.toMatch(/: \(pendS \? _fmt\(pendS\) : slots\[0\]\)/);
  });
});

// ── P3-4 캡션 칩에 등록 시술 ────────────────────────────────────
describe('P3-4 등록한 시술 메뉴가 캡션 칩 앞에 온다', () => {
  const SRC = read('js/caption/caption-keyword-tags.js');
  function load(shopType, templates) {
    const store = { shop_type: shopType, itdasy_service_templates_cache: JSON.stringify(templates) };
    const win = {};
    const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: () => {} };
    // eslint-disable-next-line no-new-func
    return new Function('window', 'localStorage', SRC + '; return getShopKeywords;')(win, ls);
  }
  test('🔴 붙임머리 샵 + 등록 시술 → 앞 8칸 안에 등록 시술', () => {
    const k = load('붙임머리', [{ name: 'QA 붙임머리 100모' }])();
    expect(k.slice(0, 8)).toContain('QA 붙임머리 100모');
    expect(k[0]).toBe('QA 붙임머리 100모');
  });
  test('시술 메뉴 0개면 업종 칩 그대로(폴백)', () => {
    const k = load('붙임머리', [])();
    expect(k[0]).toBe('붙임머리');
  });
  test('여러 개면 앞 4개만 앞자리 — 업종 칩이 최소 4칸 남는다', () => {
    const t = ['a', 'b', 'c', 'd', 'e', 'f'].map((n) => ({ name: n }));
    const k = load('붙임머리', t)();
    expect(k.slice(0, 4)).toEqual(['a', 'b', 'c', 'd']);
    expect(k.slice(4, 8)).toEqual(['붙임머리', '18인치', '20인치', '22인치']);
    expect(k).toContain('e');
  });
  test('칩은 버튼 위에 있다 — "아래에서" 라고 말하지 않는다', () => {
    const F = read('js/workspace/workspace-v2-flow.js');
    expect(F).not.toMatch(/아래에서 시술을 골라주세요/);
    expect(F).toMatch(/data-fl-cgenlock="service">시술을 골라주세요</);
  });
});

// ── P3-9 고객관리 count ────────────────────────────────────────
test('P3-9 내 샵 관리가 숨어 있는 동안 바뀐 데이터를 탭이 열릴 때 다시 그린다', () => {
  const S = read('app-myshop-v3.js');
  expect(S).toMatch(/else _dirtyWhileHidden = true;/);
  expect(S).toMatch(/new MutationObserver\([\s\S]{0,200}_dirtyWhileHidden[\s\S]{0,200}_doRender\(root\)/);
});

// ── P3-10 추가 버튼 하나 ──────────────────────────────────────
test('P3-10 고객 선택에서 결과 0건일 때 추가 버튼은 하나', () => {
  const C = read('app-customer.js');
  expect(C).not.toMatch(/<button data-pick-quick-add/);
  expect(C).toMatch(/아래에서 바로 새 고객으로 추가할 수 있어요/);
  expect((C.match(/\+ 추가하고 선택/g) || []).length).toBeGreaterThanOrEqual(1);
});

// ── P3-8 0만 금지 ─────────────────────────────────────────────
describe('P3-8 금액 표기에 "0만" 이 없다', () => {
  const D = read('app-customer-dashboard.js');
  // eslint-disable-next-line no-new-func
  const f = new Function(pickFn(D, '_wonShortParts') + pickFn(D, '_wonShort') + '; return { p: _wonShortParts, s: _wonShort };')();
  test.each([
    [0, '0원'], [1, '1원'], [9999, '9,999원'], [10000, '1만원'], [150000, '15만원'], [1200000, '120만원'], [-4000, '−4,000원'], [4000, '4,000원'],
  ])('%p → %p', (n, want) => { expect(f.s(n)).toBe(want); });
  test('카드·시술 기록·회원권 라벨이 이 규칙을 쓴다', () => {
    expect(D).not.toMatch(/<small>만<\/small>/);
    expect(D).not.toMatch(/Math\.floor\(bal \/ 10000\) \+ '만'/);
    expect(D).toMatch(/_wonShortParts\(m\.totalRev\)/);
  });
  test('홈 목표 남은 금액도 만원 미만은 원으로', () => {
    expect(read('js/home/v41-renderers.js')).toMatch(/\(goal - total\) < 10000 \?/);
  });
});

// ── P3-7 님 중복 ──────────────────────────────────────────────
describe('P3-7 호칭이 두 번 붙지 않는다', () => {
  const CORE = read('app-core.js');
  const win = {};
  // eslint-disable-next-line no-new-func
  new Function('window', CORE.slice(CORE.indexOf('window.withHonorific = '), CORE.indexOf('// ===== data-changed')))(win);
  test.each([
    ['김민지', '김민지님'], ['김민지님', '김민지님'], ['QA첫손님', 'QA첫손님'], ['홍길동 원장님', '홍길동 원장님'], ['박 선생님', '박 선생님'], [' 이수 ', '이수님'],
  ])('withHonorific(%p) = %p', (n, want) => { expect(win.withHonorific(n)).toBe(want); });
  test('dedupeNim 이 "QA첫손님 님" 도 접는다', () => {
    expect(win.dedupeNim('QA첫손님 님 예약을 저장했어요')).toBe('QA첫손님 예약을 저장했어요');
    expect(win.dedupeNim('QA첫손님님')).toBe('QA첫손님');
  });
  test('🔴 고객 상세 이름·토스트·확인창·잇비 말풍선이 이 규칙을 탄다', () => {
    expect(read('app-customer-dashboard.js')).not.toMatch(/\$\{_esc\(m\.c\.name \|\| '손님'\)\} 님/);
    expect(CORE).toMatch(/safe = window\.dedupeNim\(safe\)/);
    expect(CORE).toMatch(/if \(typeof msg === 'string' && window\.dedupeNim\) msg = window\.dedupeNim\(msg\)/);
    expect(read('app-assistant.js')).toMatch(/return window\.dedupeNim \? window\.dedupeNim\(s\) : s;/);
  });
});

// ── P3-11 시술 메뉴 제목 겹침 ──────────────────────────────────
test('P3-11 시트 헤더는 불투명 · 본문에 같은 제목을 또 쓰지 않는다', () => {
  expect(read('app-generic-sheet.js')).toMatch(/<div class="hub-header" style="background:var\(--surface,#fff\);">/);
  expect(read('app-service-templates.js')).not.toMatch(/<h2[^>]*>시술 메뉴<\/h2>/);
});

// ── P3-12 눈썹 아이콘 ─────────────────────────────────────────
test('P3-12 눈썹 업종 아이콘에 채움 사각 artifact 가 있는 ph-scribble 을 안 쓴다', () => {
  const h = read('index.html');
  expect(h).not.toMatch(/ph-duotone ph-scribble/);
  expect(h).toMatch(/ph-duotone ph-paint-brush"[^>]*><\/i><\/div>\s*<div class="ob-shop-name">눈썹/);
});

// ── P3-1 계속하기 below fold ─────────────────────────────────
test('P3-1 온보딩 [계속하기] 는 스크롤 컨테이너 아래에 붙어 있다', () => {
  const css = read('style-home.css');
  expect(css).toMatch(/#obBtn\.ob-btn \{[\s\S]{0,80}position: sticky; bottom:/);
});

// ── P3-2 붙임머리 프리셋 ─────────────────────────────────────
describe('P3-2 붙임머리 샵 시술 메뉴 추천', () => {
  const SRC = read('app-service-templates.js');
  function env(shopType, norm) {
    const win = { itdasyNormalizeShopType: () => norm, _esc: (s) => String(s) };
    const ls = { getItem: (k) => (k === 'shop_type' ? shopType : null), setItem: () => {} };
    // eslint-disable-next-line no-new-func
    const body = SRC.slice(SRC.indexOf('  const STARTERS'), SRC.indexOf('  function _renderStarterChips'));
    return new Function('window', 'localStorage', body + '; return { cat: _starterCat, sel: _catForSelect, list: _starterList };')(win, ls);
  }
  test('🔴 붙임머리 → 붙임머리 주문 단위 · 분류는 헤어', () => {
    const e = env('붙임머리', { cat: 'hair', label: '붙임머리' });
    expect(e.list().map((s) => s.name)).toEqual(['붙임머리 100모', '22인치 붙임머리', '붙임머리 리터치', '붙임머리 제거']);
    expect(e.sel()).toBe('hair');
  });
  test('헤어샵은 기존 헤어 추천 그대로', () => {
    const e = env('헤어샵', { cat: 'hair', label: '헤어샵' });
    expect(e.list()[0].name).toBe('디자인컷');
  });
  test('업종 모르면 분류 기본은 기타(네일로 찍지 않는다)', () => {
    expect(env('beauty', { cat: 'general', label: '기타' }).sel()).toBe('etc');
  });
});

// ── P3-3 빈 상태 아이콘 ─────────────────────────────────────
test('P3-3 빈 상태 기본 아이콘이 이모지가 아니다', () => {
  expect(read('app-empty-state.js')).not.toMatch(/opts\?\.icon \|\| '🌱'/);
  expect(read('app-service-templates.js')).toMatch(/icon: 'ic-scissors'/);
  expect(read('app-report.js')).not.toMatch(/🌱/);
  expect(read('app-insights.js')).not.toMatch(/🌱/);
});

// ── P3-15 재편집 완료 목적지 ─────────────────────────────────
test('P3-15 캡션까지 끝난 글을 사진 편집으로 다시 열면 완료 후 캡션 화면으로', () => {
  expect(read('js/workspace/workspace-v2-flow.js')).toMatch(/if \(String\(d\.caption \|\| ''\)\.trim\(\) && !d\._editorNext\) d\._editorNext = 'caption';\s*_openStoryEditor\(\); return;/);
});
