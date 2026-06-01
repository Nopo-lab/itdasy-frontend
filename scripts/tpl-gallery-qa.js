#!/usr/bin/env node
/* TPL-1 템플릿 실미리보기 갤러리 QA (런타임 미수정 — 실사진 불필요, placeholder는 코드 생성)
   - 모든 템플릿(overlay/ba) 썸네일 dataURL 생성: 빈 카드 0
   - _rr 버그픽스 후 cream/polaroid BA 템플릿 썸네일 생성 확인
   - Free/Pro 모두 썸네일 생성(잠금이어도 미리보기 보임)
   - fallback: 미지원 id 강제 시 null → 호출측 gradient 유지(크래시 0)
   - pageerror 0
   실행: python3 -m http.server 8099 후 node scripts/tpl-gallery-qa.js (PHOTO_QA_URL 지정 가능) */

const { chromium } = require('playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=tplqa';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 140)); });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.PhotoEditorTemplateThumb && window.PhotoEditorTemplatesV2
    && window.PhotoEditorTemplateOverlay && window.PhotoEditorBACompose, null, { timeout: 45000 });

  const out = await page.evaluate(() => {
    const TH = window.PhotoEditorTemplateThumb, TV = window.PhotoEditorTemplatesV2, CATS = TV.CATS;
    const r = { total: 0, ok: 0, overlay: 0, ba: 0, empty: [], cream: { total: 0, ok: 0 }, free: { total: 0, ok: 0 }, pro: { total: 0, ok: 0 } };
    TV.TEMPLATES.forEach(t => {
      r.total++;
      const cat = CATS.find(c => c.id === t.cat) || { ratio: '4:5' };
      const kind = TH.supportKind(t.id);
      const url = TH.make(t, { ratio: cat.ratio, accent: '#c98a95', shopName: '테스트샵' });
      const good = !!(url && url.length > 200);
      if (good) { r.ok++; r[kind === 'ba' ? 'ba' : 'overlay']++; } else { r.empty.push(t.id); }
      // cream/polaroid BA = _rr 픽스 대상
      if (/^ba-.*(cream|polaroid)/.test(t.id) || t.id === 'ba-flower-shadow' || t.id === 'ba-polaroid') { r.cream.total++; if (good) r.cream.ok++; }
      const tier = t.tier === 'pro' ? 'pro' : 'free';
      r[tier].total++; if (good) r[tier].ok++;
    });
    // fallback 강제: 알 수 없는 id 라도 크래시 없이 처리(빈 배경 dataURL 또는 null). 핵심은 throw 0.
    let fbNoCrash = true;
    try { TH.make({ id: '__no_such_template__', label: 'x' }, { ratio: '1:1' }); } catch (_e) { fbNoCrash = false; }
    r.fallbackNoCrash = fbNoCrash;
    return r;
  });

  out.severeErrors = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK/i.test(e));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
}
main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
