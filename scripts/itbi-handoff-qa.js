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

let allPass = true;
console.log('\n=== 잇비 결과 카드 v0 + 핸드오프 QA ===');
for (const r of results) { if (!r.pass) allPass = false; console.log((r.pass ? 'PASS' : 'FAIL') + '  ' + r.name + (r.detail ? '  [' + r.detail + ']' : '')); }
console.log('====================================');
console.log(allPass ? 'ALL PASS' : 'SOME FAILED');
process.exit(allPass ? 0 : 1);
