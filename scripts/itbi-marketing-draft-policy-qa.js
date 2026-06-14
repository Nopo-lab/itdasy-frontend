#!/usr/bin/env node
/* J-5 마케팅 초안 공통 정책 QA (런타임 미수정, 문자열만 — 실데이터 불필요)
   - sanitize: 금지어/과장어 → 안전표현, 정리 후 hasForbidden=false
   - safetyNote: 연락=발송안함 / 캡션=게시안함
   - caption/template: 타입·업종별 생성, 금지어 0
   - chatSuggest: 타입별 검증된 프롬프트
   - 통합: photo-mode-support/customer-status/daily-briefing 가 정책 사용
   실행: python3 -m http.server 8099 후 node scripts/itbi-marketing-draft-policy-qa.js (PHOTO_QA_URL 지정 가능) */

const { chromium } = require('playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=mpqa';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 140)); });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.ItdasyMarketingDraftPolicy && window.ItdasyPhotoModeSupport, null, { timeout: 45000 });

  const out = await page.evaluate(() => {
    const P = window.ItdasyMarketingDraftPolicy;
    const r = {};
    // 1. sanitize — 금지어 입력 → 정리 후 금지어 0
    const bad = [
      '잡티 제거 100% 보장', '여드름 완치, 부작용 없음', '탈모 치료 영구 효과 보장',
      '트러블 커버 무조건 완전 제거', '확실히 좋아짐, 즉시 완치',
    ];
    const cleaned = bad.map(b => P.sanitize(b));
    r.sanitize = {
      anyForbiddenAfter: cleaned.filter(c => P.hasForbidden(c)),
      sample: cleaned[0],
    };
    // 2. safetyNote
    r.safetyNote = {
      retouch: P.safetyNote('retouch_offer'),
      caption: P.safetyNote('promo_caption'),
      contactHasSend: /발송.*하지 않았/.test(P.safetyNote('warm_checkin')),
      captionHasPublish: /게시.*하지 않았/.test(P.safetyNote('promo_caption')),
    };
    // 3. caption — 업종, 금지어 0
    const caps = ['nail_focus', 'hair_focus', 'lash_focus', 'natural', 'glam', 'brow_focus', 'lip_focus'].map(k => P.caption(k));
    r.caption = { nailish: /손끝|광택/.test(P.caption('nail_focus')), forbidden: caps.filter(c => P.hasForbidden(c)) };
    // 4. chatSuggest — 검증된 프롬프트
    r.chatSuggest = {
      retouch: P.chatSuggest('retouch_offer', { name: '김민지' }),
      rebook: P.chatSuggest('rebook_nudge', { name: '김민지' }),
      checkin: P.chatSuggest('warm_checkin', null),
      review: P.chatSuggest('review_request', { name: '김민지' }),
    };
    // 5. template — 타입별, 금지어 0
    const tmpls = P.TYPES.map(t => P.template(t, { name: '김민지', service: '젤네일' }));
    r.template = { count: tmpls.length, forbidden: tmpls.filter(t => P.hasForbidden(t)) };
    // 6. 통합 — 소비 모듈이 정책 사용
    r.integration = {
      photoModeSupport: !!(window.ItdasyPhotoModeSupport && window.ItdasyPhotoModeSupport.buildCaptionDraft('nail_focus') === P.caption('nail_focus')),
      statusCardSug: (function () {
        if (!window.ItdasyCustomerStatusCard) return 'n/a';
        const a = window.ItdasyCustomerStatusCard.buildCustomerStatusActions({ name: '김민지', noNext: true, isAtRisk: false, photoCount: 0 });
        const retouchBtn = a.find(x => x.id === 'retouch_draft');
        return retouchBtn && retouchBtn.payload && retouchBtn.payload.text === P.chatSuggest('retouch_offer', { name: '김민지' });
      })(),
    };
    return r;
  });

  out.severeErrors = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK/i.test(e));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
}
main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
