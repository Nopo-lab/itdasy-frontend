/* 잇비 결과 카드 v0 + 핸드오프 — Node 자가 QA (브라우저 불필요)
 *
 * 실행: node scripts/itbi-handoff-qa.js
 * 핵심: 채팅 보정 params 가 카드/병합을 거쳐 편집기 state 로 유실 없이 전달되는지,
 *       initialState 없을 때 기존 동작이 100% 동일한지(회귀 0)를 검증.
 */
'use strict';
const fs = require('fs');
const path = require('path');

require(path.join(__dirname, '..', 'app-photo-editor-itbi-cards.js'));
const CARDS = globalThis.PhotoEditorItbiCards;

const results = [];
function check(name, pass, detail) { results.push({ name, pass: !!pass, detail: detail || '' }); }

// _initState 의 beauty/adjust/template 형태 모사 (편집기 fresh state)
function freshState() {
  return {
    activeTab: 'auto', ratio: 'original', autoIntensity: 'standard',
    adjust: { brightness: 100, saturate: 100, sharpness: 0, temperature: 0 },
    beauty: {
      skin: 0, redness: 0, blemish: 0, eyeShadow: 0, textureSmooth: 0, yellowness: 0,
      lipPop: 0, eyeColor: 0, browSharp: 0, handSkin: 0, nailGloss: 0, coolness: 0, nailShape: 0,
      hairShine: 0, hairVolume: 0, hairEndsClean: 0, hairColor: 0, hairDetail: 0, hairColorPop: 0,
      scalpBoost: 0, hairyArm: 0, eyeRedness: 0, irisClear: 0, catchLight: 0, underEyeClean: 0,
      lashSharp: 0, closeUpDetail: 0,
    },
    template: { id: null, leftLabel: '전', rightLabel: '후', reviewText: '', priceLines: '' },
  };
}

// 채팅 보정 결과 모사 (processPhoto 반환 형태)
const fakeResult = {
  dataUrl: 'data:image/jpeg;base64,AAAA',
  ratio: '4:5', preset_label: '네일',
  beauty: { nailGloss: 70, handSkin: 45, nailShape: 30 },
  adjust: { brightness: 104, saturate: 108, sharpness: 20, temperature: 0 },
  intensity: 'standard', preset: 'nail',
};

// 1. processPhoto 반환에 params 필드 존재 (소스 회귀 가드)
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'app-chat-auto-edit.js'), 'utf8');
  const hasFields = /beauty:\s*resolved/.test(src) && /adjust:\s*resolved/.test(src) && /intensity:\s*opts\.intensity/.test(src);
  check('1. processPhoto 반환에 beauty/adjust/intensity params', hasFields);
}

// 2. fromResult: 카드 3개 + 각 카드가 params 보존
{
  const cards = CARDS.fromResult(fakeResult, { photoUrl: fakeResult.dataUrl });
  const ok = Array.isArray(cards) && cards.length === 3 &&
    cards.every((c) => c.state && c.state.beauty === fakeResult.beauty && c.state.adjust === fakeResult.adjust) &&
    cards[0].initial_tab === 'beauty' && cards[1].initial_tab === 'bg' && cards[2].initial_tab === 'template';
  check('2. fromResult 3카드 + params 보존 + 탭매핑', ok,
    cards ? cards.map((c) => c.id + '→' + c.initial_tab).join(',') : 'null');
}

// 3. mergeInitialState: beauty 화이트리스트 병합 (채팅 값 → 편집기 state)
{
  const st = freshState();
  CARDS.mergeInitialState(st, { beauty: fakeResult.beauty, adjust: fakeResult.adjust, ratio: '4:5', autoIntensity: 'standard' });
  const ok = st.beauty.nailGloss === 70 && st.beauty.handSkin === 45 && st.beauty.nailShape === 30 &&
    st.adjust.brightness === 104 && st.ratio === '4:5';
  check('3. merge: 채팅 보정값이 편집기 state 로 유지', ok,
    'nailGloss=' + st.beauty.nailGloss + ' ratio=' + st.ratio);
}

// 4. merge: 알 수 없는 key 무시 (오염 0)
{
  const st = freshState();
  CARDS.mergeInitialState(st, { beauty: { nailGloss: 50, __evil: 999, lengthBoost: 80 }, autoIntensity: 'hacker' });
  const ok = st.beauty.nailGloss === 50 && !('__evil' in st.beauty) && !('lengthBoost' in st.beauty) &&
    st.autoIntensity === 'standard'; // invalid intensity 무시
  check('4. merge: 미지 key/invalid 무시 (오염 0)', ok, 'keys=' + Object.keys(st.beauty).length);
}

// 5. 회귀: initialState 없음 → state 완전 동일
{
  const a = JSON.stringify(freshState());
  const st = freshState();
  CARDS.mergeInitialState(st, null);
  CARDS.mergeInitialState(st, undefined);
  check('5. initialState 없음 → 기존 동작 100% 동일(회귀 0)', JSON.stringify(st) === a);
}

// 6. 적용 전 불변: fromResult 는 입력 state 를 만들지언정 어떤 편집기 state 도 변경하지 않음
{
  const st = freshState();
  const before = JSON.stringify(st);
  CARDS.fromResult(fakeResult, {}); // 카드 구성만 — 편집기 state 무관
  check('6. 카드 구성(fromResult)은 편집기 state 불변', JSON.stringify(st) === before);
}

// 7. merge: template subkeys 화이트리스트
{
  const st = freshState();
  CARDS.mergeInitialState(st, { template: { id: 'ba_lr', leftLabel: '시술전', danger: 'x' } });
  check('7. merge: template subkeys 병합 + 미지키 무시',
    st.template.id === 'ba_lr' && st.template.leftLabel === '시술전' && !('danger' in st.template));
}

// 8. renderHTML: 3개 [적용] 버튼 + data 속성 + XSS escape
{
  const cards = CARDS.fromResult(fakeResult, {});
  const html = CARDS.renderHTML(cards, 7);
  const btnCount = (html.match(/data-asst-itbi-card="7:/g) || []).length;
  const escaped = !/<script>/.test(CARDS.renderHTML([{ id: 'x', title: '<script>', desc: '', preview: 'p', state: {}, initial_tab: 'beauty' }], 0));
  check('8. renderHTML 3버튼 + data속성 + escape', btnCount === 3 && escaped, 'btns=' + btnCount);
}

// ── PR1: promo 경로 핸드오프 ──

// 9. promo-style 결과도 fromResult 로 params 보존(promo 카드도 beauty 유지)
{
  const promoResult = { dataUrl: 'data:image/jpeg;base64,BBBB', ratio: '4:5', preset_label: '네일', beauty: { nailGloss: 60 }, adjust: { brightness: 102 }, intensity: 'standard', preset: 'nail' };
  const cards = CARDS.fromResult(promoResult, { photoUrl: promoResult.dataUrl });
  check('9. promo-style 결과 → 카드 3개 + params 보존', Array.isArray(cards) && cards.length === 3 && cards.every((c) => c.state.beauty === promoResult.beauty), cards ? 'beauty=' + JSON.stringify(cards[0].state.beauty) : 'null');
}

// 10. injection 로직 미러: open_photo_editor 에만 initialState 주입, 나머지 불변, 비파괴
{
  // app-assistant.js _injectHandoffIntoHubActions 와 동일 규칙(미러). 실제 함수는 브라우저 IIFE 라 여기선 규칙 검증.
  function injectMirror(actions, handoff) {
    if (!Array.isArray(actions) || !handoff || !handoff.originalSrc) return actions;
    return actions.map((a) => (a && a.kind === 'open_photo_editor')
      ? Object.assign({}, a, { payload: Object.assign({}, a.payload || {}, { photo_url: handoff.originalSrc, initial_tab: 'beauty', initialState: handoff.params }) })
      : a);
  }
  const orig = [
    { id: 'ig', kind: 'open_instagram', payload: { dataUrl: 'x' } },
    { id: 'open_pe', kind: 'open_photo_editor', payload: {} },
    { id: 'save', kind: 'save_photo_to_customer', payload: { customerName: 'A' } },
  ];
  const handoff = { originalSrc: 'data:orig', params: { beauty: { nailGloss: 60 }, ratio: '4:5' } };
  const out = injectMirror(orig, handoff);
  const editor = out.find((a) => a.kind === 'open_photo_editor');
  const igUntouched = out[0] === orig[0]; // 비-editor 액션은 원본 참조 유지(비파괴)
  const origEmpty = Object.keys(orig[1].payload).length === 0; // 원본 미변경
  check('10. injection: editor 만 initialState 주입 + 비파괴', editor.payload.initialState === handoff.params && editor.payload.photo_url === 'data:orig' && igUntouched && origEmpty);
}

// 11. 소스 회귀 가드: assistant.js PR1 와이어링 존재
{
  const a = fs.readFileSync(path.join(__dirname, '..', 'app-assistant.js'), 'utf8');
  const hasInject = /_injectHandoffIntoHubActions/.test(a);
  const hasPromoRender = /_renderItbiCardsPromo/.test(a);
  const cardsUnconditional = /promo·비-promo 모두 카드/.test(a) || /itbiCards = \(window\.PhotoEditorItbiCards/.test(a);
  const promoHubInjected = /promo \? _injectHandoffIntoHubActions\(promo\.hubActions, handoff\)/.test(a);
  check('11. assistant.js PR1 와이어링(주입/렌더/무조건카드/promo hub)', hasInject && hasPromoRender && cardsUnconditional && promoHubInjected,
    JSON.stringify({ hasInject, hasPromoRender, cardsUnconditional, promoHubInjected }));
}

let allPass = true;
console.log('\n=== 잇비 결과 카드 v0 + 핸드오프 QA ===');
for (const r of results) { if (!r.pass) allPass = false; console.log((r.pass ? 'PASS' : 'FAIL') + '  ' + r.name + (r.detail ? '  [' + r.detail + ']' : '')); }
console.log('====================================');
console.log(allPass ? 'ALL PASS' : 'SOME FAILED');
process.exit(allPass ? 0 : 1);
