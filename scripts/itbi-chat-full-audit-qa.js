#!/usr/bin/env node
/* 잇비 채팅 전수조사 QA — 예약/고객/사진/캡션/이벤트/작업실 핵심 문장 회귀 확인.
   실행: node scripts/itbi-chat-full-audit-qa.js */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const at = (h, m = 0) => {
  const d = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), h, m, 0, 0);
  return d.toISOString();
};

const store = new Map();
global.window = global;
global.localStorage = {
  getItem: (k) => store.has(k) ? store.get(k) : null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
global.document = {
  querySelector: () => null,
  getElementById: () => null,
  createElement: () => ({ style: {}, classList: { add() {}, remove() {} } }),
};
global.Image = class {
  set src(v) { this._src = v; setTimeout(() => { if (this.onload) this.onload(); }, 0); }
  get src() { return this._src; }
};
global.navigator = { clipboard: { writeText: async () => {} } };
global.console.debug = () => {};

localStorage.setItem('shop_type', '붙임머리');
localStorage.setItem('itdasy_latest_analysis', JSON.stringify({ tone: '친근하고 인스타스러운 말투', avg_caption_length: 180 }));
global.SHOP_CONFIG = {
  '붙임머리': { defaultTag: '붙임머리', treatments: ['붙임머리', '레이어드 컷', '속눈썹펌', '젤네일'] },
};
global.API = '';
global.authHeader = () => ({ Authorization: 'Bearer qa' });
global.showTab = (tab) => { global.__lastTab = tab; };
global.closeAssistant = () => { global.__assistantClosed = true; };
global.initWorkshopTab = () => { global.__workshopInit = true; };
global._openCustomerEditSheet = (data) => { global.__lastCustomerForm = data; };
global.openCustomerDashboard = (id) => { global.__lastCustomerOpen = id; };
global.openCustomers = () => { global.__customersOpened = true; };
global.openInstagramPreview = () => { global.__instaPreviewOpened = true; };
global.saveAssistantTemplateResult = async () => ({ slotId: 'slot-qa' });
global.loadSlotsFromDB = async () => [{ id: 'slot-1', label: '이벤트 카드' }];
global.highlightWorkshopSlot = (id) => { global.__highlightedSlot = id; return true; };
global.AppLoader = { loaded: () => true, ensure: async () => true };
global.PhotoEditorTemplateLibrary = { getDefault: (purpose) => purpose === 'before_after' ? 'ba-cream' : '' };
global.PhotoEditorTemplateMarketData = {
  CATS: [{ id: 'feed', ratio: '4:5' }, { id: 'before_after', ratio: '4:5' }],
  lookupById: (id) => ({ id, label: id === 'ba-cream' ? '시술 전후 (크림)' : id, cat: /^ba/.test(id) ? 'before_after' : 'feed' }),
};
global.PhotoEditorTemplateGallery = { previewURL: async (_fake, _px, _opts) => 'preview:' + ((_fake.tplV2 || {}).id || 'tpl') };
global.ChatAutoEdit = { processPhoto: async ({ src }) => ({ dataUrl: 'edited:' + src, preset_label: '홍보 보정' }) };
global._esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
global.Customer = {
  _cache: [
    { id: 1, name: '김민지', phone: '010-1111-2222', memo: '붙임머리 단골' },
    { id: 2, name: '황민지', phone: '010-2222-3333' },
    { id: 3, name: '문하영', phone: '010-3333-4444' },
    { id: 4, name: '강연준', phone: '010-4444-5555' },
    { id: 5, name: '윤하영', phone: '010-5555-6666' },
  ],
  search(q) { return this._cache.filter((c) => c.name.includes(q) || q.includes(c.name)); },
  pick: async () => ({ id: 1, name: '김민지' }),
  create: async (data) => { global.__createdCustomer = data; return data; },
  update: async (id, data) => { global.__updatedCustomer = { id, data }; return data; },
};
const BOOKINGS = [
  { id: 10, customer_id: 2, customer_name: '황민지', service_name: '붙임머리', starts_at: at(14), ends_at: at(15), status: 'booked' },
  { id: 11, customer_id: 1, customer_name: '김민지', service_name: '레이어드 컷', starts_at: at(16), ends_at: at(17), status: 'booked' },
];
global.Booking = {
  list: async () => BOOKINGS,
  shopHours: () => ({ start: 10, end: 22 }),
  hasConflict: (s) => !!global.__conflictStart && s === global.__conflictStart,
};
global.fetch = async () => ({
  ok: true,
  json: async () => ({
    caption: '붙임머리 시술 후 자연스럽게 정리했어요.\n매장 톤에 맞춰 따뜻하게 소개해요.',
    hashtags: ['붙임머리', '헤어스타일', '예약문의'],
  }),
});
global.apiFetch = async (url) => {
  if (/\/customers/.test(url)) return { ok: true, json: async () => ({ items: Customer._cache }) };
  if (/\/bookings/.test(url)) return { ok: true, json: async () => ({ items: BOOKINGS }) };
  return { ok: true, json: async () => ({ items: [] }) };
};

function evalFile(rel) {
  const file = path.join(ROOT, rel);
  vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
}

window.PhotoSession = require(path.join(ROOT, 'js/assistant/core/photo-session.js'));
[
  'js/assistant/core/action-hub.js',
  'assistant-intent-router.js',
  'js/assistant/core/booking-draft.js',
  'js/assistant/core/booking-context.js',
  'js/assistant/core/customer-add-guard.js',
  'js/assistant/core/customer-phone-intent.js',
  'js/assistant/core/create-intent.js',
  'js/assistant/core/saved-cards-intent.js',
  'js/assistant/core/photo-mode-support.js',
  'js/assistant/core/photo-mode.js',
].forEach(evalFile);

const checks = [];
function check(name, cond, detail) {
  checks.push({ name, pass: !!cond, detail });
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' :: ' + (detail || '')));
}
function includes(s, frag) { return String(s || '').includes(frag); }
async function run() {
  const I = window.AssistantIntent;
  const BD = window.ItbiBookingDraft;
  const BC = window.ItdasyBookingContext;
  const CAG = window.ItdasyCustomerAddGuard;
  const CPI = window.ItdasyCustomerPhoneIntent;
  const CI = window.ItbiCreateIntent;
  const SCI = window.ItbiSavedCardsIntent;
  const PMS = window.ItdasyPhotoModeSupport;
  const PM = window.ItdasyPhotoMode;
  const PS = window.PhotoSession;
  const P = window.ItdasyAssistantPriceList;

  check('A1 연락처 수정은 고객정보로 감', (await CPI.tryRun('강연준 연락처 010-9999-8888로 수정해')).matched);
  check('A2 고객정보+전화번호 변경은 가격표 아님', (await CPI.tryRun('윤하영 고객정보 등록돼 있고 전화번호 010-2222-3333로 바꿔')).matched);
  check('A3 붙임머리 시술 예약은 가격표 생성 아님', !CI.classify('붙임머리 시술 예약'));
  check('A4 이벤트 카드 의도 우선', CI.classify('이벤트 카드 만들어줘').purpose === 'event');
  check('A5 네일 오픈 이벤트도 이벤트', CI.classify('네일 오픈 이벤트 만들어줘').purpose === 'event');
  check('A6 가격표 요청은 가격표', CI.classify('가격표 만들어줘').purpose === 'price');
  check('A7 고객 카드 조회는 디자인 생성 아님', !CI.classify('고객 카드 보여줘'));
  check('A8 저장 카드 조회는 작업실 의도', SCI.classify('저장한 카드 보여줘').matched);
  check('A9 사진 있어도 가격표는 사진모드 시작 아님', PMS.shouldStart('가격표 만들어줘', { hasPhoto: true }) === false);
  check('A10 홍보용 보정은 사진모드 시작', PMS.shouldStart('홍보용으로 예쁘게 해줘', { hasPhoto: true }) === true);

  const create = await I.tryCreateBooking('내일 3시 김민지 붙임머리 예약해줘', {});
  check('B1 한 문장 예약은 예약 카드', create && create.kind === 'card' && create.action.kind === 'create_booking');
  check('B2 3시는 오후 3시로 해석', new Date(create.action.payload.starts_at).getHours() === 15);
  const need = await I.tryCreateBooking('예약 잡기', {});
  check('B3 예약 잡기는 고객 질문', need && need.needCustomer === true);
  BD.clear(); BD.arm({ mode: 'add' });
  const d1 = await BD.tryDraft('김민지');
  check('B4 고객명만 오면 예약 draft에 누적', includes(d1.text, '김민지님'));
  const d2 = await BD.tryDraft('내일 2시');
  check('B5 2시는 오후 2시로 누적', includes(d2.text, '어떤 시술'));
  const d3 = await BD.tryDraft('붙임머리');
  check('B6 서비스 입력 후 예약 확인 카드', d3 && d3.__card && d3.__card.kind === 'card');
  check('B7 예약 확인 카드 시간은 14시', new Date(d3.__card.action.payload.starts_at).getHours() === 14);
  const lookup = await I.tryLookupBooking('황민지 예약은 언제야?');
  check('B8 고객별 예약 조회 카드', lookup && lookup.booking_cards && lookup.booking_cards.length === 1);
  BC.rememberList({ type: lookup.type, data: lookup.data });
  const r1 = await BC.tryRun('4시로');
  check('B9 조회 직후 4시로는 예약 변경', r1 && r1.kind === 'card' && r1.action.kind === 'reschedule_booking');
  check('B10 4시로는 16시', new Date(r1.action.payload.starts_at).getHours() === 16);
  BC.rememberList({ type: lookup.type, data: lookup.data });
  const r2 = await BC.tryRun('내일 예약 그거 4시로 바꿔');
  check('B11 그거 변경은 최근 예약 사용', r2 && r2.kind === 'card');
  global.__conflictStart = create.action.payload.starts_at;
  const conflict = await I.tryCreateBooking('내일 3시 김민지 붙임머리 예약해줘', {});
  check('B12 중복 예약은 친절한 안내', conflict && includes(conflict.text, '이미 예약') && !includes(conflict.text, 'already has'));
  global.__conflictStart = '';

  Customer._cache = Customer._cache.filter((c) => c.name !== '윤하영');
  const f1 = await CAG.tryRun('윤하영 고객 찾아줘');
  check('C1 없는 고객 찾기는 비슷한 후보 제안', includes(f1.text, '문하영') && !includes(f1.text, '기록을 열게요'));
  const f2 = await CAG.tryRun('김민지 찾아줘');
  check('C2 정확 고객 찾기는 기록 열기', includes(f2.text, '김민지님 고객 기록'));
  const add = await CAG.tryRun('박새롬 고객 추가해');
  check('C3 없는 고객 추가는 자동생성 대신 폼', includes(add.text, '정보를 입력하는 창'));
  check('C4 신규 고객 폼 안내에 연락처 포함', includes(add.text, '연락처'));
  global.__createdCustomer = null;
  const addPhone = await CPI.tryRun('이수진 010-7777-8888 추가해줘');
  check('C5 연락처 있는 신규도 저장 전 폼', includes(addPhone.text, '정보를 입력하는 창') && !global.__createdCustomer);
  check('C6 연락처 수정은 저장 전 확인', includes((await CPI.tryRun('강연준 연락처 010-1234-5678로 수정해')).text, '바꿀까요'));

  PM.exit();
  const capAsk = await PM.handlePhotos(['p1'], '캡션 만들어줘', {});
  check('E1 시술내역 없으면 먼저 질문', includes(capAsk.text, '어떤 시술'));
  const cap = await PM.handleText('레이어드 컷', {});
  check('E2 시술 입력 후 캡션 생성', includes(cap.text, '캡션') && includes(cap.photo_caption, '#붙임머리'));
  const longer = await PM.handleText('더 길게', {});
  check('E3 더 길게는 분량 증가 기준 유지', includes(longer.photo_caption, '시술 포인트') || String(longer.photo_caption || '').split('\n').length >= 4);
  global.__instaPreviewOpened = false;
  await PM.handleText('더 인스타스럽게 다시', {});
  check('E4 인스타스럽게 다시는 미리보기 자동오픈 금지', global.__instaPreviewOpened === false);
  check('E5 인스타 미리보기 감지는 명시 요청만', PMS.looksPreviewRequest('더 인스타스럽게 다시') === false);

  PM.exit();
  const onePromo = await PM.handlePhotos(['promo1'], '홍보용으로 예쁘게 해줘', {});
  check('D1 사진 1장 홍보는 채팅 카드', !!(onePromo.pm_tpls || onePromo.photo_result || includes(onePromo.text, '미리')));
  PM.exit();
  await PM.handlePhotos(['before1'], '홍보용으로 예쁘게 해줘', {});
  const ba1 = await PM.handleText('전후 템플릿 만들어줘', {});
  const ba2 = await PM.handlePhotos(['after1'], '', {});
  check('D2 전후 1장 후 2번째 사진 기억', ba1 && includes(ba1.text, '사진 2장') && ba2 && ba2.photo_result);
  PM.exit();
  const baDirect = await PM.handlePhotos(['before2', 'after2'], '전후 템플릿 만들어줘', {});
  check('D3 사진 2장 먼저 올리면 전후 카드', baDirect && baDirect.photo_result && includes(baDirect.text, '전후 카드를 만들었어요'));
  PM.exit();
  const roles = await PM.handlePhotos(['b', 'a', 'h'], '홍보용 카드 만들어줘', {});
  check('D4 사진 3장 역할 카드 표시', roles.photo_roles && roles.photo_roles.assets.length === 3);
  check('D5 사진 3장 역할 before/after/hero 보존', roles.photo_roles.assets.map((x) => x.role).join(',') === 'before,after,hero');
  const sess = PS.autoAssign(PS.addAssets(PS.create(), ['b', 'a', 'h'], 'batch'));
  check('H1 PhotoSession 역할 보존', sess.assets.map((x) => x.role).join(',') === 'before,after,hero');
  const ser = PS.serialize(sess);
  check('H2 PhotoSession 저장 중복 최소화', ser.photoSession.refs.length === 3 && ser.photoSession.assets.every((a) => a.photoRef));
  const restored = PS.restore(ser.photoSession);
  check('H3 PhotoSession 복원 역할 유지', restored.assets.map((x) => x.role).join(',') === 'before,after,hero');

  check('F1 이벤트 카드는 편집기 직행 대신 선택지 대상', CI.classify('이벤트 카드 만들어줘').purpose === 'event');
  check('F2 오픈 이벤트도 전후/후기 아님', CI.classify('네일 오픈 이벤트 만들어줘').purpose === 'event');
  const priceRows = P.parseRequest('붙임머리 300000원 리터치 50000원 가격표 만들어줘');
  check('F3 가격 있는 가격표만 초안 성공', priceRows.matched && priceRows.priced === 2);
  const priceMissing = P.parseRequest('붙임머리 시술 예약');
  check('F4 예약 문장은 가격표 초안 성공 아님', priceMissing.matched === false);
  const saved = await SCI.handle('작업실 열어줘');
  check('H4 작업실 열기는 채팅 위로 이동', includes(saved.reply, '작업실') && global.__lastTab === 'workshop');

  const failed = checks.filter((x) => !x.pass);
  console.log(`\nRESULT ${checks.length - failed.length}/${checks.length} PASS`);
  if (failed.length) {
    console.log('\nFAILED');
    failed.forEach((x) => console.log('- ' + x.name + (x.detail ? ': ' + x.detail : '')));
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('QA 실행 실패:', err && err.stack ? err.stack : err);
  process.exit(2);
});
