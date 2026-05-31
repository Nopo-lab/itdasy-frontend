#!/usr/bin/env node
/* T-161 잇비 modify/상대조정 명령 정렬 QA (런타임 미수정, 텍스트만 — 실사진 불필요)
   명령 → parse 최종 patch + route(feature/modify) + 안내문. 과장문구 스캔 + 회귀.
   route 판정: NLModify.plan 결과와 parse steps 동일하면 'modify', 아니면 'feature'.
   실행: python3 -m http.server 8099 후 node scripts/itbi-modify-align-qa.js (PHOTO_QA_URL 지정 가능) */

const { chromium } = require('playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=t161qa';

// 1. 완화형/약화 조사 대상 12개
const TARGETS = [
  '여드름 줄여줘', '잡티 줄여줘', '잡티 조금만 완화해줘', '다크서클 줄여줘',
  '눈밑 칙칙함 줄여줘', '피부결 조금 정리해줘', '붉은기 줄여줘', '노란기 줄여줘',
  '입술 발색 조금만', '눈빛 조금만 반짝이게', '머리 풍성감 조금 줄여줘', '네일 광택 줄여줘',
];
// 2. modify 유지 회귀
const KEEP_MODIFY = ['방금 보정 줄여줘', '너무 과해', '광택 줄여줘', '입술색 너무 진해', '눈빛 너무 과해', '전체적으로 덜'];
// 3. T-160 기능 명령 회귀 (full strength 유지)
const KEEP_FEATURE = ['눈빛 반짝이게', '잡티 완화', '피부결 정리', '머리 풍성하게'];

function classify(page, cmds) {
  return page.evaluate((cmds) => {
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    return cmds.map((cmd) => {
      const pl = window.PhotoEditorIntentParser.parse(cmd);
      const mod = window.PhotoEditorNLModify.plan(cmd);
      const route = (mod && eq(mod.steps, pl.steps)) ? 'modify' : (pl.intent === 'bg' ? 'bg' : 'feature');
      const beauty = {};
      pl.steps.forEach(s => { if (s.action === 'set_beauty') Object.assign(beauty, s.params); });
      return { cmd, route, intent: pl.intent, beauty, firstAction: (pl.steps[0] || {}).action, explain: pl.explanation_ko };
    });
  }, cmds);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 140)); });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.PhotoEditorIntentParser && window.PhotoEditorNLModify, null, { timeout: 45000 });

  const targets = await classify(page, TARGETS);
  const keepModify = await classify(page, KEEP_MODIFY);
  const keepFeature = await classify(page, KEEP_FEATURE);

  const HYPE = /제거|완전|마법|없애|지워|싹|커버/;
  const scan = rows => rows.map(r => ({ ...r, hype: HYPE.test(r.explain) ? r.explain.match(HYPE)[0] : null }));

  const out = {
    url: BASE_URL,
    targets: scan(targets),
    keepModify: scan(keepModify),
    keepFeature: scan(keepFeature),
    severeErrors: errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK/i.test(e)),
  };
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
}
main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
