#!/usr/bin/env node
/* PE-AI-1A 부위 기반 추천 카드 QA (런타임 미수정, RecoCards/RecoRegion 모델 측정 전용)

   검증:
     A. 화이트리스트 — 추천 키는 전부 27개 SLIDERS 키 안 (없는 param 0)
     B. closeUpDetail / hairColor / hairyArm 미추천 (AI-1A 제외)
     C. 네일 시나리오 → 네일 카드 + 손 카드, 피부/눈 카드 0
     D. 얼굴 시나리오 → 피부·눈·입술·눈썹·속눈썹·흰자 카드, 네일/손 카드 0
     E. handSkin ≤ 10 / hairVolume ≤ 12 상한
     F. 미준비(pending) → 카드 0
     G. 없는 부위(absent) → 카드 0
     H. weak/strong 환산 — strong skin=25, weak skin=15
     I. 카드 산출(compute)이 state.beauty 를 바꾸지 않음
     J. 추천값이 슬라이더 범위(0~100) 안
     K. 적용 = 기존 슬라이더 경로 (state.beauty set + input/label 동기화 + scheduleRedraw 1 + pushHistory 1)
     L. 적용 전 state.beauty 불변 (자동 적용 0)
     M. severe pageerror 0
   실행: python3 -m http.server 8099 후 node scripts/reco-region-qa.js */

const { chromium } = require('playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=reco-qa';

const WHITELIST = ['skin','redness','blemish','eyeShadow','textureSmooth','yellowness','lipPop','eyeColor','browSharp','handSkin','nailGloss','coolness','nailShape','hairShine','hairVolume','hairEndsClean','hairColor','hairDetail','hairColorPop','scalpBoost','hairyArm','eyeRedness','irisClear','catchLight','underEyeClean','lashSharp','closeUpDetail'];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 160)); });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(
    () => window.PhotoEditorRecoCards && window.PhotoEditorRecoRegion && window.PhotoEditorRecoMap && window.RegionMaskProvider && window.MaskApplication,
    null, { timeout: 45000 });

  const res = await page.evaluate((WL) => {
    const checks = [];
    const ok = (name, cond, detail) => checks.push({ name, pass: !!cond, detail: detail || '' });
    const RC = window.PhotoEditorRecoCards, RP = window.RegionMaskProvider, MA = window.MaskApplication;

    // 스텁 헬퍼: getStats + lazy sync getters 를 시나리오별로 교체
    const origStats = RP.getStats;
    const origNail = MA.getNailMaskSync, origScl = MA.getScleraMaskSync, origBrow = MA.getBrowMaskSync, origLash = MA.getLashMaskSync;
    function setScenario(statsRows, lazy) {
      RP.getStats = () => statsRows;
      MA.getNailMaskSync   = () => (lazy.nail   || null);
      MA.getScleraMaskSync = () => (lazy.sclera || null);
      MA.getBrowMaskSync   = () => (lazy.brow   || null);
      MA.getLashMaskSync   = () => (lazy.lash   || null);
    }
    function restore() {
      RP.getStats = origStats;
      MA.getNailMaskSync = origNail; MA.getScleraMaskSync = origScl; MA.getBrowMaskSync = origBrow; MA.getLashMaskSync = origLash;
    }
    const conf = (c) => ({ confidence: c, mask: {}, scale: 1 });
    const cardKeys = (built) => built.cards.map(c => c.regionKey);
    const allItems = (built) => built.cards.reduce((a, c) => a.concat(c.items), []);

    try {
      // ── 네일 시나리오 (손 closeup, 얼굴 없음) ──
      setScenario(
        [{ maskType: 'skinMask', confidence: 0.1, status: 'failed', sourceTier: 3, coverage: 0 }],
        { nail: conf(0.85) }
      );
      const stateNail = { originalImg: {}, beauty: {} };
      const beforeNail = JSON.stringify(stateNail.beauty);
      const nailBuilt = RC.compute(stateNail);
      ok('I1 compute 가 state.beauty 불변', JSON.stringify(stateNail.beauty) === beforeNail && beforeNail === '{}');
      const nk = cardKeys(nailBuilt);
      ok('C1 네일 카드 존재', nk.includes('nail'), nk.join(','));
      ok('C2 손 카드 존재(nail=Hand Landmarker)', nk.includes('hand'), nk.join(','));
      ok('C3 피부/눈 카드 없음', !nk.includes('skin') && !nk.includes('eye'), nk.join(','));
      const nailItems = allItems(nailBuilt);
      const handSkinItem = nailItems.find(i => i.key === 'handSkin');
      ok('E1 handSkin ≤ 10', handSkinItem && handSkinItem.value <= 10, handSkinItem ? String(handSkinItem.value) : 'none');
      const glossItem = nailItems.find(i => i.key === 'nailGloss');
      ok('H-nail nailGloss strong=38', glossItem && glossItem.value === 38, glossItem ? String(glossItem.value) : 'none');

      // ── 얼굴 시나리오 ──
      setScenario(
        [
          { maskType: 'skinMask', confidence: 0.85, status: 'ready', sourceTier: 2, coverage: 0.2 },
          { maskType: 'eyeMask',  confidence: 0.85, status: 'ready', sourceTier: 2, coverage: 0.02 },
          { maskType: 'lipMask',  confidence: 0.85, status: 'ready', sourceTier: 2, coverage: 0.01 },
          { maskType: 'hairMask', confidence: 0.1,  status: 'failed', sourceTier: 3, coverage: 0 },
        ],
        { brow: conf(0.8), lash: conf(0.8), sclera: conf(0.8) }
      );
      const faceBuilt = RC.compute({ originalImg: {}, beauty: {} });
      const fk = cardKeys(faceBuilt);
      ok('D1 피부 카드', fk.includes('skin'), fk.join(','));
      ok('D2 눈 카드', fk.includes('eye'), fk.join(','));
      ok('D3 입술 카드', fk.includes('lip'), fk.join(','));
      ok('D4 눈썹 카드', fk.includes('brow'), fk.join(','));
      ok('D5 속눈썹 카드', fk.includes('lash'), fk.join(','));
      ok('D6 흰자 카드', fk.includes('sclera'), fk.join(','));
      ok('D7 네일/손 카드 없음', !fk.includes('nail') && !fk.includes('hand'), fk.join(','));
      const skinItem = allItems(faceBuilt).find(i => i.key === 'skin');
      ok('H1 skin strong=25', skinItem && skinItem.value === 25, skinItem ? String(skinItem.value) : 'none');

      // 화이트리스트 + 범위 + 제외 키 (네일+얼굴 전체 아이템)
      const everyItem = allItems(nailBuilt).concat(allItems(faceBuilt));
      ok('A1 추천 키 전부 화이트리스트', everyItem.every(i => WL.indexOf(i.key) >= 0), everyItem.map(i => i.key).filter(k => WL.indexOf(k) < 0).join(','));
      ok('B1 closeUpDetail 미추천', everyItem.every(i => i.key !== 'closeUpDetail'));
      ok('B2 hairColor 미추천', everyItem.every(i => i.key !== 'hairColor'));
      ok('B3 hairyArm 미추천', everyItem.every(i => i.key !== 'hairyArm'));
      ok('J1 추천값 0~100 범위', everyItem.every(i => i.value >= 0 && i.value <= 100));

      // ── 헤어 시나리오 (hairVolume 상한) ──
      setScenario(
        [{ maskType: 'hairMask', confidence: 0.85, status: 'ready', sourceTier: 1, coverage: 0.3 }],
        {}
      );
      const hairBuilt = RC.compute({ originalImg: {}, beauty: {} });
      const hv = allItems(hairBuilt).find(i => i.key === 'hairVolume');
      ok('E2 hairVolume ≤ 12', hv && hv.value <= 12, hv ? String(hv.value) : 'none');

      // ── weak 환산 (skin conf 0.5) ──
      setScenario([{ maskType: 'skinMask', confidence: 0.5, status: 'ready', sourceTier: 2, coverage: 0.2 }], {});
      const weakBuilt = RC.compute({ originalImg: {}, beauty: {} });
      const weakSkin = allItems(weakBuilt).find(i => i.key === 'skin');
      ok('H2 skin weak=15 (25×0.6)', weakSkin && weakSkin.value === 15, weakSkin ? String(weakSkin.value) : 'none');

      // ── pending (미계산) → 카드 0 ──
      setScenario([], {});  // getStats 빈 배열 + 모든 lazy null → 전부 pending
      const pendBuilt = RC.compute({ originalImg: {}, beauty: {} });
      ok('F1 미준비 → 카드 0', pendBuilt.cards.length === 0 && pendBuilt.pending === true, 'cards=' + pendBuilt.cards.length);

      // ── absent (게이트 실패) → 카드 0 ──
      setScenario([{ maskType: 'skinMask', confidence: 0.1, status: 'failed', sourceTier: 3, coverage: 0 }], {});
      const absBuilt = RC.compute({ originalImg: {}, beauty: {} });
      ok('G1 없는 부위 → 카드 0', absBuilt.cards.length === 0, 'cards=' + absBuilt.cards.length);

      // ── 사진 없음 → 카드 0 ──
      const noImg = RC.compute({ originalImg: null, beauty: {} });
      ok('G2 사진 없음 → 카드 0', noImg.cards.length === 0);
    } finally { restore(); }

    return { checks };
  }, WHITELIST);

  // ── K/L. 적용 경로 DOM 테스트 (가짜 패널 + 슬라이더 + 스파이 helpers) ──
  const applyRes = await page.evaluate(() => {
    const checks = [];
    const ok = (name, cond, detail) => checks.push({ name, pass: !!cond, detail: detail || '' });
    const RC = window.PhotoEditorRecoCards, RP = window.RegionMaskProvider, MA = window.MaskApplication;
    const origStats = RP.getStats, origNail = MA.getNailMaskSync;
    RP.getStats = () => [{ maskType: 'skinMask', confidence: 0.1, status: 'failed', sourceTier: 3, coverage: 0 }];
    MA.getNailMaskSync = () => ({ confidence: 0.85, mask: {}, scale: 1 });
    MA.getScleraMaskSync = () => null; MA.getBrowMaskSync = () => null; MA.getLashMaskSync = () => null;

    const panel = document.createElement('div');
    panel.innerHTML = RC.html({}) +
      '<label class="pe-slider"><span class="pe-slider-val" data-pe-slider-val="nailGloss">0</span>' +
      '<input type="range" min="0" max="100" step="1" value="0" data-pe-slider="nailGloss"/></label>' +
      '<label class="pe-slider"><span class="pe-slider-val" data-pe-slider-val="nailShape">0</span>' +
      '<input type="range" min="0" max="100" step="1" value="0" data-pe-slider="nailShape"/></label>' +
      '<label class="pe-slider"><span class="pe-slider-val" data-pe-slider-val="handSkin">0</span>' +
      '<input type="range" min="0" max="100" step="1" value="0" data-pe-slider="handSkin"/></label>' +
      '<label class="pe-slider"><span class="pe-slider-val" data-pe-slider-val="coolness">0</span>' +
      '<input type="range" min="0" max="100" step="1" value="0" data-pe-slider="coolness"/></label>';
    document.body.appendChild(panel);

    const state = { originalImg: {}, beauty: {} };
    let redraws = 0, histories = 0;
    const helpers = { scheduleRedraw: () => { redraws++; }, pushHistory: () => { histories++; }, toast: () => {} };

    RC.bind(panel, state, helpers);
    // 적용 전(render만): state.beauty 불변
    ok('L1 카드 렌더만으로 state.beauty 불변', Object.keys(state.beauty).length === 0);

    const applyBtn = panel.querySelector('[data-pe-reco-apply="nail"]');
    ok('K0 네일 적용 버튼 존재', !!applyBtn);
    if (applyBtn) applyBtn.click();

    ok('K1 nailGloss state=38', state.beauty.nailGloss === 38, String(state.beauty.nailGloss));
    ok('K2 nailGloss input.value 동기화', panel.querySelector('[data-pe-slider="nailGloss"]').value === '38');
    ok('K3 nailGloss 라벨 동기화', panel.querySelector('[data-pe-slider-val="nailGloss"]').textContent === '38');
    ok('K4 scheduleRedraw 1회', redraws === 1, String(redraws));
    ok('K5 pushHistory 1회(undo 1스텝)', histories === 1, String(histories));

    document.body.removeChild(panel);
    RP.getStats = origStats; MA.getNailMaskSync = origNail;
    return { checks };
  });

  const all = res.checks.concat(applyRes.checks);
  const severe = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK|Failed to load resource|ERR_|tfjs|WebGL|backend/i.test(e));
  all.push({ name: 'M1 severe pageerror 0', pass: severe.length === 0, detail: severe.join(' | ').slice(0, 200) });

  const pass = all.filter(c => c.pass).length, fail = all.length - pass;
  console.log(JSON.stringify({ checks: all, summary: pass + ' pass / ' + fail + ' fail' }, null, 2));
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
}
main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
