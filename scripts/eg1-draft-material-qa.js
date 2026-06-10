#!/usr/bin/env node
/* EG-1 빈이력 고객 리터치 초안 가드 QA (런타임 미수정 — 실데이터 불필요, 스텁 주입)
   검증: 최근시술·사진·메모가 모두 없는 고객은 얇은 LLM 초안 대신 정직한 "기록 부족" 안내.
   기록 있는 고객은 기존 초안 경로(kind:execute) 정상 유지. 실제 발송/백엔드 초안 호출 0.
   실행: python3 -m http.server 8099 후 node scripts/eg1-draft-material-qa.js (PHOTO_QA_URL 지정 가능) */

const { chromium } = require('playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=eg1qa';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 430, height: 920 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 140)); });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.AssistantIntent && typeof window.AssistantIntent.tryDraftMessage === 'function', null, { timeout: 45000 });

  const out = await page.evaluate(async () => {
    try { localStorage.removeItem('assistant_router_disabled'); localStorage.setItem('shop_type', '네일'); } catch (_e) { void 0; }
    const I = window.AssistantIntent;
    const calls = { sendMessage: 0, draftBackend: 0 };
    window.sendMessage = function () { calls.sendMessage++; };
    if (typeof window.authHeader !== 'function') window.authHeader = function () { return {}; };

    // 고객 목록 스텁: 빈이력(382) + 기록보유(10) + 메모보유(20)
    // [A4 갱신] 정확 이름(score 100)만 자동 확정되므로 순수 한글 이름 사용(honor 추출=정확 일치).
    const CUSTOMERS = [
      { id: 382, name: '유빈', phone: '010-0000-0382' },
      { id: 10, name: '하준', phone: '010-0000-0010' },
      { id: 20, name: '서아', phone: '010-0000-0020', memo: '글리터 좋아하심' },
    ];
    window.apiFetch = async function (path) {
      if (/\/customers/.test(path)) return { ok: true, json: async () => ({ items: CUSTOMERS }) };
      return { ok: true, json: async () => ({}) };
    };
    // 갤러리 스텁: 10번만 사진/시술 보유, 382·20번은 사진 0
    window.loadGalleryItemsByCustomer = async function (id) {
      if (id === 10) return [{ id: 1, customer_id: 10, label: '젤네일 그라데이션' }];
      return [];
    };

    const r = {};
    // 1. 빈이력 고객 → 기록 부족 안내(message), 백엔드/발송 0
    const empty = await I.tryDraftMessage('유빈님 리터치 안내 문구 만들어줘', {});
    r.empty = {
      kind: empty && empty.kind,
      isGuide: !!(empty && empty.kind === 'message' && /기록이 부족|기록을 먼저|기록이나 사진을 먼저/.test(empty.text || '')),
      hasNoSendNote: !!(empty && /발송은 하지 않/.test(empty.text || '')),
    };
    // 2. 기록 있는 고객(사진/시술) → 기존 초안 경로(execute) 정상
    const rich = await I.tryDraftMessage('하준님 리터치 안내 문구 만들어줘', {});
    r.rich = { kind: rich && rich.kind, hasRecent: !!(rich && rich.hasRecent), hasAction: !!(rich && rich.action && rich.action.kind === 'draft_message') };
    // 3. 메모만 있는 고객 → 재료 있음으로 간주(execute)
    const memo = await I.tryDraftMessage('서아님 리터치 안내 문구 만들어줘', {});
    r.memo = { kind: memo && memo.kind, isExecute: !!(memo && memo.kind === 'execute') };

    r.safety = calls;   // 가드 단계에서 백엔드 draft_message 실행/발송 0
    return r;
  });

  out.severeErrors = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK/i.test(e));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
}
main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
