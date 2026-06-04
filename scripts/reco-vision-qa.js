#!/usr/bin/env node
/* PE-AI-1B 프론트 QA — Vision 정밀 추천 (apiFetch/VisionClient mock, 실호출 0).

   검증:
     A. 동의 없음 → analyze 호출 0 (모달만)
     B. 동의 거부 → analyze 0, AI-1A 유지
     C. 동의 성공 → analyze 호출
     D. 교차검증/2차검증: 27키 밖 폐기 / 없는 부위 0 / handSkin≤10 / hairVolume≤12 / closeUpDetail 미노출
     E. 마스크×Vision 매트릭스: ready+high→정밀 / fallback+high→검증 필요 / ready+low→기본
     F. 에러코드 fallback: 403 pro_required / 429 / 502 / 504 → AI-1A 유지(state.__visionReco 미설정)
     G. 적용 전 state.beauty 불변 / 적용 후 슬라이더·라벨 동기화 / undo 1스텝
     H. severe pageerror 0
   실행: python3 -m http.server 8099 후 node scripts/reco-vision-qa.js */

const { chromium } = require('playwright');
// 앱 SPA 의 비로그인 redirect/타이머와 격리하기 위해 빈 페이지에 reco 모듈만 주입한다.
const ORIGIN = process.env.PHOTO_QA_ORIGIN || 'http://127.0.0.1:8099';
const SCRIPTS = [
  '/js/photo-editor/reco-map.js',
  '/js/photo-editor/reco-region.js',
  '/js/photo-editor/reco-vision-client.js',
  '/js/photo-editor/reco-consent.js',
  '/js/photo-editor/reco-cards-ui.js',
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 160)); });

  await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
  for (const s of SCRIPTS) await page.addScriptTag({ url: ORIGIN + s });
  await page.waitForFunction(
    () => window.PhotoEditorRecoCards && window.PhotoEditorRecoCards.computeMerged && window.PhotoEditorVisionClient && window.PhotoEditorRecoConsent && window.PhotoEditorRecoRegion,
    null, { timeout: 15000 });

  // ── D/E. 교차검증 + 2차검증 (computeMerged, RecoRegion stub) ──
  const merge = await page.evaluate(() => {
    const checks = [];
    const ok = (n, c, d) => checks.push({ name: n, pass: !!c, detail: d || '' });
    const RC = window.PhotoEditorRecoCards;
    const origBuild = window.PhotoEditorRecoRegion.build;

    function withRegion(region, fn) {
      window.PhotoEditorRecoRegion.build = () => region;
      try { return fn(); } finally { window.PhotoEditorRecoRegion.build = origBuild; }
    }
    const keysOf = b => b.cards.map(c => c.regionKey);
    const itemsOf = (b, rk) => { const c = b.cards.find(x => x.regionKey === rk); return c ? c.items : []; };
    const val = (b, rk, key) => { const it = itemsOf(b, rk).find(i => i.key === key); return it ? it.value : null; };
    const badge = (b, rk) => { const c = b.cards.find(x => x.regionKey === rk); return c ? c.badgeText : null; };

    // 얼굴+네일 마스크 상태
    const region = {
      skin: { present: true, state: 'strong', conf: 0.85 },
      eye: { present: true, state: 'weak', conf: 0.5 },
      hair: { present: false, state: 'absent', conf: 0 },
      lip: { present: true, state: 'strong', conf: 0.8 },
      nail: { present: false, state: 'absent', conf: 0 },
      sclera: { present: false, state: 'absent', conf: 0 },
      brow: { present: false, state: 'absent', conf: 0 },
      lash: { present: false, state: 'absent', conf: 0 },
      hand: { present: false, state: 'absent', conf: 0 },
    };

    withRegion(region, () => {
      const state = { originalImg: {}, beauty: {} };
      // ready(skin strong) + vision high → 정밀, vision 값 사용 + 27키 밖/closeUpDetail 폐기
      RC.setVisionResult(state, {
        photo_type: 'skin',
        detected_regions: ['skin', 'hair', 'hands'],
        region_confidence: { skin: 0.9, hair: 0.2, hands: 0.8 },
        recommended_adjustments: [
          { key: 'skin', value: 30 },
          { key: 'evilKey', value: 99 },        // 화이트리스트 밖 → 폐기
          { key: 'closeUpDetail', value: 40 },  // RECO 밖 → 미노출
          { key: 'handSkin', value: 40 },       // hands high지만 mask hand absent → 검증 필요 + 상한 10
          { key: 'hairShine', value: 50 },      // hair vision low(0.2) + mask absent → 제외
        ],
      });
      const b = RC.computeMerged(state);
      ok('D1 27키 밖(evilKey) 폐기', !b.cards.some(c => c.items.some(i => i.key === 'evilKey')));
      ok('D2 closeUpDetail 미노출', !b.cards.some(c => c.items.some(i => i.key === 'closeUpDetail')));
      ok('E1 skin ready+high → 정밀 추천', badge(b, 'skin') === '정밀 추천', String(badge(b, 'skin')));
      ok('D3 skin vision 값 사용(30)', val(b, 'skin', 'skin') === 30, String(val(b, 'skin', 'skin')));
      ok('E2 hand mask absent + vision high → 검증 필요', badge(b, 'hand') === '검증 필요', String(badge(b, 'hand')));
      ok('D4 handSkin ≤10 (40→10)', val(b, 'hand', 'handSkin') === 10, String(val(b, 'hand', 'handSkin')));
      ok('D5 hair vision low + mask absent → 카드 없음', keysOf(b).indexOf('hair') < 0, keysOf(b).join(','));
    });

    // ready + vision low → 기본 추천(AI-1A 값, 마스크 우선)
    withRegion(region, () => {
      const state = { originalImg: {}, beauty: {} };
      RC.setVisionResult(state, {
        photo_type: 'general', detected_regions: ['skin'], region_confidence: { skin: 0.2 },
        recommended_adjustments: [{ key: 'skin', value: 90 }],
      });
      const b = RC.computeMerged(state);
      ok('E3 skin ready + vision low → 기본 추천', badge(b, 'skin') === '기본 추천', String(badge(b, 'skin')));
      ok('E4 기본 추천은 AI-1A 값(25, vision 90 무시)', val(b, 'skin', 'skin') === 25, String(val(b, 'skin', 'skin')));
    });

    // hairVolume 상한 (hair mask strong + vision high)
    withRegion({ hair: { present: true, state: 'strong', conf: 0.85 } }, () => {
      const state = { originalImg: {}, beauty: {} };
      RC.setVisionResult(state, {
        photo_type: 'hair', detected_regions: ['hair'], region_confidence: { hair: 0.9 },
        recommended_adjustments: [{ key: 'hairVolume', value: 80 }, { key: 'hairShine', value: 40 }],
      });
      const b = RC.computeMerged(state);
      ok('D6 hairVolume ≤12 (80→12)', val(b, 'hair', 'hairVolume') === 12, String(val(b, 'hair', 'hairVolume')));
    });

    return { checks };
  });

  // ── A/B/C/F/G. 플로우 (VisionClient/apiFetch mock + 가짜 패널) ──
  const flow = await page.evaluate(async () => {
    const checks = [];
    const ok = (n, c, d) => checks.push({ name: n, pass: !!c, detail: d || '' });
    const RC = window.PhotoEditorRecoCards;
    window.__toasts = [];
    window.showToast = (m) => window.__toasts.push(String(m));
    window.authHeader = () => ({});

    // RecoRegion stub: skin strong (AI-1A 카드 1개 보장)
    window.PhotoEditorRecoRegion.build = () => ({ skin: { present: true, state: 'strong', conf: 0.85 } });

    function makePanel() {
      const panel = document.createElement('div');
      panel.innerHTML = RC.html() +
        '<label class="pe-slider"><span class="pe-slider-val" data-pe-slider-val="skin">0</span>' +
        '<input type="range" min="0" max="100" step="1" value="0" data-pe-slider="skin"/></label>';
      document.body.appendChild(panel);
      return panel;
    }

    // A. 동의 없음 → analyze 호출 0 (모달만)
    let analyzeCalls = 0;
    window.PhotoEditorVisionClient.analyze = () => { analyzeCalls++; return Promise.resolve({ ok: true, data: { photo_type: 'skin', detected_regions: ['skin'], region_confidence: { skin: 0.9 }, recommended_adjustments: [{ key: 'skin', value: 30 }] } }); };
    try { localStorage.removeItem('itdasy_ai_vision_consent'); } catch (_e) { /* noop */ }
    let state = { originalImg: {}, beauty: {} };
    let helpers = { scheduleRedraw: () => {}, pushHistory: () => {}, toast: () => {} };
    let panel = makePanel();
    RC.bind(panel, state, helpers);
    panel.querySelector('[data-pe-reco-precise]').click();
    await new Promise(r => setTimeout(r, 30));
    ok('A1 동의 모달 노출', !!document.querySelector('[data-reco-consent]'));
    ok('A2 동의 전 analyze 호출 0', analyzeCalls === 0, String(analyzeCalls));

    // B. 거부 → analyze 0, 모달 닫힘
    document.querySelector('[data-reco-consent-deny]').click();
    await new Promise(r => setTimeout(r, 20));
    ok('B1 거부 후 analyze 0', analyzeCalls === 0);
    ok('B2 거부 후 모달 닫힘', !document.querySelector('[data-reco-consent]'));
    document.body.removeChild(panel);

    // C. 동의 성공 → consent 기록 → analyze 호출. (apiFetch mock: consent 200)
    window.apiFetch = () => Promise.resolve({ ok: true, json: async () => ({}) });
    analyzeCalls = 0;
    state = { originalImg: {}, beauty: {} };
    panel = makePanel();
    RC.bind(panel, state, helpers);
    panel.querySelector('[data-pe-reco-precise]').click();
    await new Promise(r => setTimeout(r, 30));
    document.querySelector('[data-reco-consent-agree]').click();
    await new Promise(r => setTimeout(r, 60));
    ok('C1 동의 후 analyze 호출 1', analyzeCalls === 1, String(analyzeCalls));
    ok('C2 성공 시 state.__visionReco 설정', !!state.__visionReco);
    ok('G1 Vision 도착만으로 state.beauty 불변', Object.keys(state.beauty).length === 0);
    document.body.removeChild(panel);

    // F. 에러코드 → AI-1A 유지 (state.__visionReco 미설정)
    async function errCase(code, label) {
      window.PhotoEditorVisionClient.analyze = () => Promise.resolve({ ok: false, code: code, status: 0 });
      const s = { originalImg: {}, beauty: {} };
      const p = makePanel();
      try { localStorage.setItem('itdasy_ai_vision_consent', '1'); } catch (_e) { /* noop */ }  // uiCached → 모달 스킵
      RC.bind(p, s, helpers);
      p.querySelector('[data-pe-reco-precise]').click();
      await new Promise(r => setTimeout(r, 40));
      ok(label, !s.__visionReco, 'visionReco set?');
      document.body.removeChild(p);
    }
    await errCase('pro_required', 'F1 403 pro_required → AI-1A 유지');
    await errCase('quota', 'F2 429 → AI-1A 유지');
    await errCase('vision_failed', 'F3 502 → AI-1A 유지');
    await errCase('timeout', 'F4 504/timeout → AI-1A 유지');

    // F5. 403 consent_required → 모달 재노출
    window.PhotoEditorVisionClient.analyze = () => Promise.resolve({ ok: false, code: 'consent_required', status: 403 });
    { const s = { originalImg: {}, beauty: {} }; const p = makePanel();
      try { localStorage.setItem('itdasy_ai_vision_consent', '1'); } catch (_e) { /* noop */ }
      RC.bind(p, s, helpers); p.querySelector('[data-pe-reco-precise]').click();
      await new Promise(r => setTimeout(r, 40));
      ok('F5 consent_required → 모달 재노출', !!document.querySelector('[data-reco-consent]'));
      const m = document.querySelector('[data-reco-consent]'); if (m) m.remove();
      document.body.removeChild(p);
    }

    // G. 적용 경로: 적용 전 불변 → 적용 후 동기화 + redraw/history 1회
    window.PhotoEditorRecoRegion.build = () => ({ skin: { present: true, state: 'strong', conf: 0.85 } });
    let redraws = 0, hist = 0;
    const h2 = { scheduleRedraw: () => redraws++, pushHistory: () => hist++, toast: () => {} };
    const s2 = { originalImg: {}, beauty: {} };
    RC.setVisionResult(s2, { photo_type: 'skin', detected_regions: ['skin'], region_confidence: { skin: 0.9 }, recommended_adjustments: [{ key: 'skin', value: 30 }] });
    const p2 = makePanel();
    RC.bind(p2, s2, h2);
    ok('G2 적용 전 state.beauty 불변', Object.keys(s2.beauty).length === 0);
    const applyBtn = p2.querySelector('[data-pe-reco-apply="skin"]');
    ok('G3 정밀 카드 적용 버튼 존재', !!applyBtn);
    if (applyBtn) applyBtn.click();
    ok('G4 적용 후 state.beauty.skin=30', s2.beauty.skin === 30, String(s2.beauty.skin));
    ok('G5 슬라이더 input/label 동기화', p2.querySelector('[data-pe-slider="skin"]').value === '30' && p2.querySelector('[data-pe-slider-val="skin"]').textContent === '30');
    ok('G6 scheduleRedraw 1회', redraws === 1, String(redraws));
    ok('G7 pushHistory 1회(undo 1스텝)', hist === 1, String(hist));
    document.body.removeChild(p2);

    return { checks };
  });

  const all = merge.checks.concat(flow.checks);
  const severe = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK|Failed to load resource|ERR_|tfjs|WebGL|backend/i.test(e));
  all.push({ name: 'H1 severe pageerror 0', pass: severe.length === 0, detail: severe.join(' | ').slice(0, 200) });

  const pass = all.filter(c => c.pass).length, fail = all.length - pass;
  console.log(JSON.stringify({ checks: all, summary: pass + ' pass / ' + fail + ' fail' }, null, 2));
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
}
main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
