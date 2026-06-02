#!/usr/bin/env node
/* TPL-3 잇비 홍보 체인 → 템플릿 3개 추천 QA (런타임 미수정, 텍스트만 — 실사진 불필요)
   - recommendTemplates: 명령별 업종/목적 매칭 상위3
   - 추천 3개 전부 industry/purpose 태그 보유(TPL-2 회귀 0)
   - photo-chain.buildPromoTemplateRecos 위임 동작
   - fallback: 업종 불명확 → common/promo/feed/story 계열
   실행: python3 -m http.server 8099 후 node scripts/tpl-recommend-qa.js (PHOTO_QA_URL 지정 가능) */

const { chromium } = require('playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=recoqa';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 140)); });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.PhotoEditorTemplateMarketData && window.ItdasyPromoPhotoChain, null, { timeout: 45000 });

  const out = await page.evaluate(() => {
    const MD = window.PhotoEditorTemplateMarketData;
    const cases = [
      { cmd: '네일 홍보용으로 해줘', wantInd: 'nail' },
      { cmd: '헤어 피드용으로 해줘', wantInd: 'hair', wantPur: 'feed' },
      { cmd: '속눈썹 스토리용으로 해줘', wantInd: 'lash', wantPur: 'story' },
      { cmd: '가격표 만들어줘', wantPur: 'price' },
      { cmd: '이 사진 홍보용으로 예쁘게 해줘', fallback: true },
    ];
    const rows = cases.map(c => {
      const recs = MD.recommendTemplates(c.cmd, {}, 3) || [];
      const ids = recs.map(t => t.id);
      const allTagged = recs.every(t => t.industry && t.purpose);
      const indHit = c.wantInd ? recs.some(t => t.industry === c.wantInd) : null;
      const purHit = c.wantPur ? recs.some(t => t.purpose === c.wantPur) : null;
      return { cmd: c.cmd, n: recs.length, ids, allTagged, indHit, purHit,
        inds: recs.map(t => t.industry), purs: recs.map(t => t.purpose) };
    });
    // photo-chain 위임
    const chainRecos = window.ItdasyPromoPhotoChain.buildPromoTemplateRecos('네일 홍보용으로 해줘', {});
    return { rows, chainRecos, chainN: (chainRecos || []).length };
  });

  out.severeErrors = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK/i.test(e));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
}
main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
