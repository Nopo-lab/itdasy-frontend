#!/usr/bin/env node
/* 핫픽스F 이슈5 QA — 예약 draft 슬롯필링 + _CREATE_VERB 확장 + reschedule 결정성.
   런타임 스텁(고객 강연준, Booking 없음=충돌 skip). 실데이터 불필요.
   실행: python3 -m http.server 8099 후 node scripts/hotfixF-booking-draft-qa.js */
const { chromium } = require('playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=hotfixfqa';
function ok(c) { return c ? 'PASS' : 'FAIL'; }

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 430, height: 920 } });
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.AssistantIntent && window.ItbiBookingDraft
    && typeof window.AssistantIntent.tryCreateBooking === 'function'
    && typeof window.ItbiBookingDraft.tryDraft === 'function'
    && window.ItdasyBookingContext, null, { timeout: 45000 });

  const r = await page.evaluate(async () => {
    try {
      localStorage.removeItem('assistant_router_disabled');
      localStorage.setItem('shop_type', '붙임머리');
      window.SHOP_CONFIG = Object.assign(window.SHOP_CONFIG || {}, {
        '붙임머리': { defaultTag: '붙임머리', treatments: ['붙임머리', '레이어드 컷'] },
      });
    } catch (_e) { void 0; }
    if (typeof window.authHeader !== 'function') window.authHeader = function () { return {}; };
    const CUSTOMERS = [{ id: 7, name: '강연준', phone: '010-7777-7777' }];
    window.apiFetch = async function (path) {
      if (/\/customers/.test(path)) return { ok: true, json: async () => ({ items: CUSTOMERS }) };
      if (/\/bookings/.test(path)) return { ok: true, json: async () => ({ items: [] }) };
      return { ok: true, json: async () => ({}) };
    };
    delete window.Booking;   // 충돌체크/슬롯 추천 skip → concrete time 이면 바로 카드

    const I = window.AssistantIntent, BD = window.ItbiBookingDraft, BC = window.ItdasyBookingContext;
    const out = {};

    // #2 한 문장 명시 예약("…예약해") → 카드(가격표/OCR 아님)
    const oneShot = await I.tryCreateBooking('강연준 내일 오후 2시 붙임머리 시술 예약해', {});
    out.oneshot = { kind: oneShot && oneShot.kind, card: !!(oneShot && oneShot.kind === 'card'), who: oneShot && oneShot.customer && oneShot.customer.name };

    // #1 "예약 잡기" → 고객 대기(needCustomer)
    const pj = await I.tryCreateBooking('예약 잡기', {});
    out.yejak = { kind: pj && pj.kind, needCustomer: !!(pj && pj.needCustomer) };

    // #1/#4 draft: 고객명만 → 시간 질문, 시간만 → 시술 질문, 시술명 → 카드
    BD.clear(); BD.arm({ mode: 'add' });
    const d1 = await BD.tryDraft('강연준');
    out.draft_name = { hasText: !!(d1 && d1.text), asksTime: !!(d1 && /몇 시/.test(d1.text || '')), notCard: !(d1 && d1.__card) };
    const d2 = await BD.tryDraft('오후 2시');
    out.draft_time = { asksService: !!(d2 && /어떤 시술/.test(d2.text || '')), notCard: !(d2 && d2.__card) };
    const d2b = await BD.tryDraft('붙임머리');
    out.draft_service_done = { card: !!(d2b && d2b.__card), who: d2b && d2b.__card && d2b.__card.customer && d2b.__card.customer.name,
      hh: d2b && d2b.__card && d2b.__card.action && new Date(d2b.__card.action.payload.starts_at).getHours() };

    // #6 lastCustomer 기억 + 재사용
    out.last = { name: BD.lastCustomer() && BD.lastCustomer().name };
    BD.clear(); BD.arm({ mode: 'add', customer: BD.lastCustomer() });
    const d3 = await BD.tryDraft('내일 오후 2시 예약 추가');
    const d3b = await BD.tryDraft('붙임머리');
    out.draft_reuse = { asksService: !!(d3 && /어떤 시술/.test(d3.text || '')), card: !!(d3b && d3b.__card), who: d3b && d3b.__card && d3b.__card.customer && d3b.__card.customer.name };

    // #3 draft 안에서 "시술 뭐 있는데" → 가격표 양보(null) 아님, 시간/시술 안내
    BD.clear(); BD.arm({ mode: 'add', customer: { id: 7, name: '강연준' }, dateBase: (function () { const x = new Date(); x.setDate(x.getDate() + 1); x.setHours(0, 0, 0, 0); return x; })() });
    const d4 = await BD.tryDraft('붙임머리 있잖아 시술 뭐 있는데');
    out.draft_service_q = { notNull: !!d4, hasText: !!(d4 && d4.text), notImageReq: !(d4 && /이미지|사진.*올려/.test(d4.text || '')) };

    // 양보: 매출 질의는 draft 가 가로채지 않음(null)
    BD.clear(); BD.arm({ mode: 'add', customer: { id: 7, name: '강연준' } });
    const d5 = await BD.tryDraft('오늘 매출 얼마야');
    out.draft_yield = { yielded: d5 === null };

    // #8 reschedule 결정성: 같은 문장 두 번 → 둘 다 "몇 시로?" (참조 14시를 새 시간으로 안 씀)
    const yr = new Date().getFullYear();
    const bk = { id: 99, customer_id: 7, customer_name: '강연준', service_name: '붙임머리',
      starts_at: new Date(yr, 5, 17, 14, 0, 0).toISOString(), ends_at: new Date(yr, 5, 17, 15, 0, 0).toISOString(), status: 'confirmed' };
    BC.rememberList({ type: 'bookings_day', data: { items: [bk] } });
    const rs1 = await BC.tryRun('강연준 6/17 14시 예약 시간 바꿔');
    BC.rememberList({ type: 'bookings_day', data: { items: [bk] } });
    const rs2 = await BC.tryRun('강연준 6/17 14시 예약 시간 바꿔');
    const ask = (x) => !!(x && x.kind === 'message' && /몇 시로/.test(x.text || ''));
    out.resched = { first: ask(rs1), second: ask(rs2), deterministic: ask(rs1) && ask(rs2) };
    // #7 그 뒤 "4시로" → 16시로 변경 카드
    const rs3 = await BC.tryRun('4시로 바꿔');
    out.resched_apply = { card: !!(rs3 && rs3.kind === 'card'), hh: rs3 && rs3.action && new Date(rs3.action.payload.starts_at).getHours() };

    return out;
  });

  const checks = [
    ['#2 한문장 예약→카드(가격표 아님)', r.oneshot.card && r.oneshot.who === '강연준'],
    ['#1 "예약 잡기"→고객 대기(needCustomer)', r.yejak.needCustomer],
    ['#1 draft 고객명만→시간 질문', r.draft_name.asksTime && r.draft_name.notCard],
    ['#4 draft 시간만→시술 질문', r.draft_time.asksService && r.draft_time.notCard],
    ['#4 draft 시술 입력→카드(14시)', r.draft_service_done.card && r.draft_service_done.who === '강연준' && r.draft_service_done.hh === 14],
    ['#6 lastCustomer 기억', r.last.name === '강연준'],
    ['#6 직전 고객 재사용→시술 질문 후 카드', r.draft_reuse.asksService && r.draft_reuse.card && r.draft_reuse.who === '강연준'],
    ['#3 시술질의 이미지요구 안함', r.draft_service_q.notNull && r.draft_service_q.hasText && r.draft_service_q.notImageReq],
    ['양보: 매출질의 draft 미가로챔', r.draft_yield.yielded],
    ['#8 reschedule 결정성(반복 "몇 시로?")', r.resched.deterministic],
    ['#7 "4시로"→16시 변경 카드', r.resched_apply.card && r.resched_apply.hh === 16],
  ];
  let pass = 0;
  checks.forEach(([name, cond]) => { console.log(`[${ok(cond)}] ${name}`); if (cond) pass++; });
  console.log(`\n결과: ${pass}/${checks.length} PASS`);
  console.log('상세:', JSON.stringify(r, null, 1));
  await browser.close();
  process.exit(pass === checks.length ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(2); });
