#!/usr/bin/env node
/* PE-R5a-2 정밀 마스크 상태 카드 정합 QA (런타임 미수정, MaskStatusUI 모델 측정 전용)

   검증:
     A. REGIONS 플래그 — handSkin unwired, nail/sclera conditional
     B. handSkin 정직 표기 — stats 고신뢰여도 '정밀 적용됨' 아님(항상 fallback)
     C. nail/sclera 조건부 라벨 — 고신뢰 시 '필요 시 정밀 적용'(generic '정밀 적용됨' 아님), skin 은 '정밀 적용됨'
     D. confidence 원장용 보조문구 노출
     E. disable flag 표기 — PE_MASK_DISABLE/PE_NAIL_MASK_DISABLE/PE_SCLERA_MASK_DISABLE
     F. 사진 없음 → disabled
     G. pageerror 0
   실행: python3 -m http.server 8099 후 node scripts/photo-mask-status-qa.js */

const { chromium } = require('playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=maskstatus-qa';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 160)); });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.MaskStatusUI && window.RegionMaskProvider, null, { timeout: 45000 });

  const res = await page.evaluate(() => {
    const checks = [];
    const ok = (name, cond, detail) => checks.push({ name, pass: !!cond, detail: detail || '' });
    const UI = window.MaskStatusUI, RP = window.RegionMaskProvider;
    const reg = (id) => UI.REGIONS.find(r => r.id === id);

    // A. REGIONS 플래그
    ok('A1 handSkin unwired', reg('handSkinMask') && reg('handSkinMask').unwired === true);
    ok('A2 nail conditional', reg('nailMask') && reg('nailMask').conditional === true);
    ok('A3 sclera conditional', reg('scleraMask') && reg('scleraMask').conditional === true);
    ok('A4 brow 행 + conditional + 라벨', reg('browMask') && reg('browMask').conditional === true && reg('browMask').labels && reg('browMask').labels.strong === '눈썹 선명 보정에 정밀 사용');

    // B/C. getStats 스텁으로 고신뢰 주입 후 라벨 검증
    const orig = RP.getStats;
    RP.getStats = () => ([
      { maskType: 'skinMask', confidence: 0.85, status: 'ready', sourceTier: 2, coverage: 0.2 },
      { maskType: 'nailMask', confidence: 0.85, status: 'ready', sourceTier: 1, coverage: 0.01 },
      { maskType: 'scleraMask', confidence: 0.5, status: 'ready', sourceTier: 2, coverage: 0.005 },
      { maskType: 'handSkinMask', confidence: 0.9, status: 'ready', sourceTier: 1, coverage: 0.1 },
      { maskType: 'browMask', confidence: 0.85, status: 'ready', sourceTier: 2, coverage: 0.01 },
    ]);
    let model;
    try { model = UI.buildModel({ originalImg: {} }); } finally { RP.getStats = orig; }
    const row = (id) => model.rows.find(r => r.id === id);
    ok('B1 handSkin 고신뢰여도 정밀 아님', row('handSkinMask').status === '기본 보정으로 처리 중' && row('handSkinMask').tone === 'fallback', row('handSkinMask').status);
    ok('B2 handSkin 정직 detail', /기본 피부 보정/.test(row('handSkinMask').detail));
    ok('C1 skin(비조건부) 정밀 적용됨', row('skinMask').status === '정밀 적용됨', row('skinMask').status);
    ok('C2 nail(조건부) 필요 시 정밀 적용', row('nailMask').status === '필요 시 정밀 적용', row('nailMask').status);
    ok('C3 sclera(조건부) 필요 시 약하게 적용', row('scleraMask').status === '필요 시 약하게 적용', row('scleraMask').status);
    ok('C4 brow 고신뢰 → 눈썹 선명 보정에 정밀 사용', row('browMask').status === '눈썹 선명 보정에 정밀 사용', row('browMask').status);

    // D. 보조문구
    const h = UI.html({ originalImg: {} });
    ok('D1 confidence 원장용 보조문구', /신뢰도가 높으면 정밀 마스크로/.test(h) && /해당 보정을 켤 때만 적용/.test(h));
    ok('D2 조건부 note (네일/흰자)', /네일 광택·모양 보정을 켤 때 사용/.test(h) && /눈 충혈 완화 보정을 켤 때 사용/.test(h));

    return { checks, _orig: typeof orig === 'function' };
  });

  // E. disable flags
  const flagCheck = await page.evaluate(() => {
    const UI = window.MaskStatusUI;
    const set = (k) => localStorage.setItem(k, '1');
    const clr = (k) => localStorage.removeItem(k);
    const out = {};
    set('PE_MASK_DISABLE');
    out.allDisabled = UI.buildModel({ originalImg: {} }).rows.every(r => r.status === '비활성화됨');
    clr('PE_MASK_DISABLE');
    set('PE_NAIL_MASK_DISABLE');
    out.nailDisabled = UI.buildModel({ originalImg: {} }).rows.find(r => r.id === 'nailMask').status === '비활성화됨';
    clr('PE_NAIL_MASK_DISABLE');
    set('PE_SCLERA_MASK_DISABLE');
    out.scleraDisabled = UI.buildModel({ originalImg: {} }).rows.find(r => r.id === 'scleraMask').status === '비활성화됨';
    clr('PE_SCLERA_MASK_DISABLE');
    set('PE_BROW_MASK_DISABLE');
    out.browDisabled = UI.buildModel({ originalImg: {} }).rows.find(r => r.id === 'browMask').status === '눈썹 정밀 마스크 미사용';
    clr('PE_BROW_MASK_DISABLE');
    out.noPhoto = UI.buildModel({ originalImg: null }).rows.every(r => r.tone === 'disabled');
    return out;
  });
  res.checks.push({ name: 'E1 PE_MASK_DISABLE → 전체 비활성화됨', pass: flagCheck.allDisabled });
  res.checks.push({ name: 'E2 PE_NAIL_MASK_DISABLE → 네일 비활성화됨', pass: flagCheck.nailDisabled });
  res.checks.push({ name: 'E3 PE_SCLERA_MASK_DISABLE → 흰자 비활성화됨', pass: flagCheck.scleraDisabled });
  res.checks.push({ name: 'E4 PE_BROW_MASK_DISABLE → 눈썹 정밀 마스크 미사용', pass: flagCheck.browDisabled });
  res.checks.push({ name: 'F1 사진 없음 → disabled', pass: flagCheck.noPhoto });

  const severe = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK|Failed to load resource|ERR_|tfjs|WebGL|backend/i.test(e));
  res.checks.push({ name: 'G1 severe pageerror 0', pass: severe.length === 0, detail: severe.join(' | ').slice(0, 200) });

  const pass = res.checks.filter(c => c.pass).length, fail = res.checks.length - pass;
  console.log(JSON.stringify({ checks: res.checks, summary: pass + ' pass / ' + fail + ' fail' }, null, 2));
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
}
main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
