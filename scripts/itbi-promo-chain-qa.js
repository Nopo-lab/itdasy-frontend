#!/usr/bin/env node
/* J-2 홍보용 사진 체인 QA (런타임 미수정, 텍스트/DOM만 — 실사진 불필요)
   - 감지: 홍보류 true / 단일보정(T-160/T-161) false
   - 캡션 초안: 업종별 생성 + 금지어(완전/무조건/영구/치료/개선 보장) 0
   - 버튼: 4개, phase [safe,safe,confirm,safe], 게시/danger 버튼 없음
   - runPromoPhotoChain: 사진없음 안내 / 정상 메시지(캡션+게시안함 문구)
   - 저장 confirm: 고객없음/고객있음 안내(자동저장 X)
   - 안전성: publish_instagram/send_message/Booking.create 직접 호출 0
   실행: python3 -m http.server 8099 후 node scripts/itbi-promo-chain-qa.js (PHOTO_QA_URL 지정 가능) */

const { chromium } = require('playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=promoqa';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 140)); });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.ItdasyPromoPhotoChain && window.ItdasyActionHub && window.ItdasyPhotoFlow, null, { timeout: 45000 });

  const out = await page.evaluate(() => {
    const C = window.ItdasyPromoPhotoChain; const H = window.ItdasyActionHub;
    const calls = [];
    window.publishInstagram = function () { calls.push('publishInstagram'); };
    window.sendMessage = function () { calls.push('sendMessage'); };
    window.Booking = Object.assign(window.Booking || {}, { create: function () { calls.push('Booking.create'); } });

    const r = {};
    // 1. 감지 (홍보 true / 단일보정 false)
    r.detect = {
      promo1: C.detectPromoPhotoChain('이 사진 홍보용으로 예쁘게 해줘'),
      promo2: C.detectPromoPhotoChain('이 사진 인스타 올릴 느낌으로 만들어줘'),
      promo3: C.detectPromoPhotoChain('시술 사진 홍보용으로 정리해줘'),
      promo4: C.detectPromoPhotoChain('이 사진 피드용으로 만들어줘'),
      single_hair: C.detectPromoPhotoChain('머리 풍성하게'),
      single_blemish: C.detectPromoPhotoChain('잡티 줄여줘'),
      single_eye: C.detectPromoPhotoChain('눈빛 반짝이게'),
      single_nail: C.detectPromoPhotoChain('네일 경계 또렷하게'),
    };
    // 2. 캡션 + 금지어
    const FORBID = /완전|무조건|영구|치료|개선\s*보장|효과\s*보장|의료/;
    const caps = ['nail_focus', 'hair_focus', 'lash_focus', 'natural', 'glam', 'brow_focus', 'lip_focus', 'unknown']
      .map(k => C.buildPromoCaptionDraft(k));
    r.caption = {
      nail_nailish: /네일|손끝|광택/.test(C.buildPromoCaptionDraft('nail_focus')),
      hair_hairish: /머릿결|윤기|스타일/.test(C.buildPromoCaptionDraft('hair_focus')),
      forbidden: caps.filter(c => FORBID.test(c)),
    };
    // 3. 버튼
    const acts = C.buildPromoActions({ currentCustomer: { id: 1, name: '김민지' } }, 'nail_focus', '캡션');
    r.actions = {
      count: acts.length,
      phases: acts.map(a => a.phase),
      kinds: acts.map(a => a.kind),
      hasPublish: acts.some(a => /publish|게시/.test(a.kind) || /게시/.test(a.label)),
      hasDanger: acts.some(a => a.phase === 'danger'),
    };
    // 4. runPromoPhotoChain — 사진없음 / 정상(스텁)
    const realRun = window.ItdasyPhotoFlow.runPromoFlow;
    window.ItdasyPhotoFlow.runPromoFlow = function () { return { ok: false, needsPhoto: true, message: 'x' }; };
    const noPhoto = C.runPromoPhotoChain('이 사진 홍보용으로 예쁘게', {});
    window.ItdasyPhotoFlow.runPromoFlow = function () { return { ok: true, recipeId: 'nail_focus', message: 'x' }; };
    const okRun = C.runPromoPhotoChain('네일 사진 홍보용으로 보정해줘', { currentCustomer: { id: 1, name: '김민지' } });
    window.ItdasyPhotoFlow.runPromoFlow = realRun;
    r.run = {
      noPhoto_msg: /사진을 (먼저 )?열어주세요|먼저 편집할 사진을 열어주세요/.test(noPhoto.message),
      ok_hasCaption: /캡션 초안/.test(okRun.message),
      ok_noSendNote: /실제 게시나 발송은 하지 않았어요/.test(okRun.message),
      ok_actions: (okRun.hubActions || []).length,
    };
    // 5/6. 저장 confirm — 고객없음/있음
    r.save = {
      noCust: H.handleActionClick({ kind: 'save_photo_to_customer', phase: 'confirm', payload: {} }).message,
      withCust: H.handleActionClick({ kind: 'save_photo_to_customer', phase: 'confirm', payload: { customerName: '김민지' } }).message,
    };
    // 7/8. 안전성 — 버튼 클릭 시 위험 함수 0
    window.PhotoEditor = { open: function () {}, _internal: { getState: function () { return {}; }, applyStatePatch: function () {} } };
    window.openInstagramPreview = function () {};
    acts.forEach(a => { try { H.handleActionClick(a, {}); } catch (_e) { void 0; } });
    r.safety = { publishInstagram: calls.filter(c => c === 'publishInstagram').length, sendMessage: calls.filter(c => c === 'sendMessage').length, bookingCreate: calls.filter(c => c === 'Booking.create').length };
    return r;
  });

  out.severeErrors = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK/i.test(e));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
}
main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
