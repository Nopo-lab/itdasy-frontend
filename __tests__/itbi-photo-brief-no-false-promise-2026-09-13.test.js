'use strict';
/**
 * [2026-09-13 ZH ITBI] "글씨 얼굴 안 가리게 아래로 내려줘" · "문구 좀 더 크게" + 사진 →
 * 잇비가 "시술내용 텍스트·캡션까지 자동으로 입혀드릴게요" 라고 먼저 약속했는데 글자 레이어 0개(라이브 실측).
 */
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'app-assistant.js'), 'utf8');
const C = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/[^\n]*$/gm, '');

// 파서는 순수 함수라 실제로 돌린다
global.window = {};
// eslint-disable-next-line no-eval
eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'assistant', 'photo-brief-parser.js'), 'utf8'));
const PB = global.window.ItdasyPhotoBrief;

function branch() {
  const i = C.indexOf('if (_brief && _brief.hasBrief && photoUrls.length && !_isOcrPhotoIntent(question)) {');
  const j = C.indexOf('_offerLayoutPicks = function (pushUser) {', i);
  expect(i).toBeGreaterThan(0); expect(j).toBeGreaterThan(i);
  return C.slice(i, j);
}

describe('두 문장은 넣을 문구가 없다 — 만들어질 레이어 0개(사실 고정)', () => {
  test.each(['글씨 얼굴 안 가리게 아래로 내려줘', '문구 좀 더 크게'])('%s', (q) => {
    const b = PB.parse(q);
    expect(b.hasBrief).toBe(true);           // 브리핑으로는 잡힌다(그래서 예전엔 약속했다)
    expect(PB.buildLayers(b)).toEqual([]);   // 그런데 만들 게 없다
    expect(b.service).toBe('');                // 🔴 지시문 통째가 시술내용·사진 글자가 되면 안 된다(LLM 실패 시 폴백 경로)
  });
  test('지시어 하나만 있어도 시술내용으로 새지 않는다(문구 단독 · 크기/이동 단독)', () => {
    expect(PB.parse('문구 바꿔줘').service).toBe('');
    expect(PB.parse('좀 더 크게 해줘').service).toBe('');
    expect(PB.parse('살짝 내려줘').service).toBe('');
  });
  test('기존 브리핑 문장은 그대로 시술내용을 뽑는다', () => {
    const b = PB.parse('최근 원장 작업으로 좌측하단 텍스트에 시술내용 추가하고 스티커 덕지덕지 붙여줘. 22인치 재시술 손상모');
    expect(b.service).toBe('22인치 재시술 손상모');
    expect(PB.parse('젤네일 이달의아트, 문구 넣어줘').service).toBe('젤네일 이달의아트');
  });
  test('따옴표 문구가 있으면 그 위치·크기로 만들어진다(안내 문구대로 하면 된다)', () => {
    const L = PB.buildLayers(PB.parse('"첫 방문 이벤트" 글씨 아래에 크게'));
    expect(L).toHaveLength(1);
    expect(L[0]).toMatchObject({ type: 'text', text: '첫 방문 이벤트', size: 0.07 });
    expect(L[0].y).toBeGreaterThan(0.8);
  });
});

describe('잇비 — 만들어질 게 있을 때만 약속한다', () => {
  test('🔴 LLM 보강 전에 "입혀드릴게요" 를 말하지 않는다', () => {
    const b = branch();
    const promise = b.indexOf('캡션까지 자동으로 입혀드릴게요');
    expect(promise).toBeGreaterThan(b.indexOf('parseSmart(question)'));
    expect(promise).toBeGreaterThan(b.indexOf('buildLayers(_finalBrief)'));
  });
  test('🔴 0개면 사실대로 말하고 작업실을 열지 않는다(orchestrate 보다 먼저 return)', () => {
    const b = branch();
    const guard = b.indexOf('if (!_hasText && !_hasSticker && !(_finalBrief && _finalBrief.useRecentStyle)) {');
    expect(guard).toBeGreaterThan(0);
    const g = b.slice(guard, b.indexOf('return;', guard));
    expect(g).toMatch(/넣을 문구를 못 찾았어요/);
    expect(g).not.toMatch(/orchestrate|closeAssistant/);
    expect(guard).toBeLessThan(b.indexOf("type: 'orchestrate'"));
    expect(guard).toBeLessThan(b.indexOf('closeAssistant()'));
  });
  test('2장 이상이면 구성 고르기로 이어지고, 1장은 채팅에 남는다(안내가 닫혀 안 보이는 것 방지)', () => {
    expect(branch()).toMatch(/if \(photoUrls\.length >= 2 && typeof _offerLayoutPicks === 'function'\) _offerLayoutPicks\(false\);/);
  });
  test('약속 문구는 실제로 만들어진 것만 말한다(시술내용 텍스트라고 뭉뚱그리지 않음)', () => {
    const b = branch();
    expect(b).toMatch(/\(_hasText \? '글자' : ''\)/);
    expect(b).not.toMatch(/_brief\.wantsText \? '시술내용 텍스트'/);
  });
  test('브리핑 분기는 평소 사진 흐름으로 새지 않는다(중복 처리 방지) · 사진만 보낸 흐름은 그대로', () => {
    expect(C).toMatch(/if \(_brief && _brief\.hasBrief && photoUrls\.length && !_isOcrPhotoIntent\(question\)\) return;[^\n]*\n\s*if \(photoUrls\.length && !_isOcrPhotoIntent\(question\) && !_isCaptionIntent\) \{\n\s*_offerLayoutPicks\(true\);/);
  });
});
