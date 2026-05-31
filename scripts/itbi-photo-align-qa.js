#!/usr/bin/env node
/* T-160 잇비 사진편집 명령-효과 정렬 QA (런타임 미수정, 텍스트만 — 실사진 불필요)
   각 명령을 IntentParser.parse → apply_preset 이면 PRESETS 로 최종 beauty 해석.
   "명령 → 실제 PhotoEditor patch 값" 을 한 표로 출력. 강화효과(v369) 사용 여부/과장문구 판정.
   실행: python3 -m http.server 8099 후 node scripts/itbi-photo-align-qa.js  (또는 PHOTO_QA_URL 지정) */

const { chromium } = require('playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=itbiqa';

// 점검 대상 명령 (보스 T-160 항목)
const COMMANDS = {
  hair: ['머리 풍성하게', '머리끝 정리', '잔머리 정리', '머리결 정리', '윤기 살려줘'],
  eye: ['눈빛 반짝이게', '속눈썹 선명하게', '눈 또렷하게'],
  nail: ['네일 경계 또렷하게', '네일 반짝이게', '손 피부톤 정리'],
  skin: ['잡티 완화', '피부결 정리', '눈밑 칙칙함 완화', '다크서클 완화'],
  makeup: ['입술 발색 살려줘', '아이 색감 살려줘'],
};

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 140)); });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.PhotoEditorIntentParser && window.PhotoEditorPresetCards, null, { timeout: 45000 });

  const flat = [];
  for (const cat in COMMANDS) for (const cmd of COMMANDS[cat]) flat.push({ cat, cmd });

  const rows = await page.evaluate((flat) => {
    const PRESETS = window.PhotoEditorPresetCards.PRESETS;
    const presetBeauty = (id) => { const p = PRESETS.find(x => x.id === id); return p ? (p.beauty || {}) : { __missing: id }; };
    return flat.map(({ cat, cmd }) => {
      const plan = window.PhotoEditorIntentParser.parse(cmd);
      const beauty = {};
      let route = [];
      for (const s of plan.steps) {
        if (s.action === 'set_beauty') { Object.assign(beauty, s.params); route.push('set_beauty'); }
        else if (s.action === 'apply_preset') { Object.assign(beauty, presetBeauty(s.params.preset)); route.push('preset:' + s.params.preset); }
        else route.push(s.action);
      }
      return { cat, cmd, intent: plan.intent, route: route.join('+'), beauty, explain: plan.explanation_ko, desc: (plan.steps[0] && plan.steps[0].description_ko) || '' };
    });
  }, flat);

  // 과장 문구 스캔 (제거/완전/마법/없애/지워)
  const HYPE = /제거|완전|마법|없애|지워|싹|깨끗하게 없/;
  rows.forEach(r => { r.hype = HYPE.test(r.desc) || HYPE.test(r.explain) ? (r.desc + ' / ' + r.explain).match(HYPE)[0] : null; });

  const out = { url: BASE_URL, rows, severeErrors: errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK/i.test(e)) };
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
}
main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
