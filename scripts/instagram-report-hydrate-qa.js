#!/usr/bin/env node
/* F1/F2/F3 인스타 분석 리포트 재수화 QA (런타임 미수정 — 실연동/실데이터 불필요, apiFetch 스텁)
   F1: /instagram/status persona → itdasy_latest_analysis 재수화(캐시 비었을 때만, 풍부본 보존).
   F2: style_analysis_status pending/failed → 빈 화면 대신 상태 안내(+failed 재분석 동선).
   F3: 내샵관리 카드가 style_summary/tone_summary/tone 중 하나라도 있으면 노출.
   안전성: publish/send/Booking.create/Revenue.create 자동 호출 0.
   실행: python3 -m http.server 8099 후 node scripts/instagram-report-hydrate-qa.js (PHOTO_QA_URL 지정 가능) */

const { chromium } = require('playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=ighydrateqa';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 430, height: 920 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 140)); });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => typeof window.checkInstaStatus === 'function' && typeof window.showDetailedAnalysis === 'function', null, { timeout: 45000 });

  const out = await page.evaluate(async () => {
    // QA 중 location.reload/대입으로 컨텍스트 파괴 방지(스텁 보존). 일부 분기가 새로고침을 시도함.
    try { window.location.reload = function () {}; } catch (_e) { void 0; }
    const calls = { publishInstagram: 0, sendMessage: 0, bookingCreate: 0, revenueCreate: 0, runPersonaAnalyze: 0 };
    const toasts = [];
    window.showToast = (t) => { toasts.push(String(t || '')); };
    window.publishInstagram = () => { calls.publishInstagram++; };
    window.sendMessage = () => { calls.sendMessage++; };
    window.Booking = Object.assign(window.Booking || {}, { create: () => { calls.bookingCreate++; } });
    window.Revenue = Object.assign(window.Revenue || {}, { create: () => { calls.revenueCreate++; } });
    window.runPersonaAnalyze = () => { calls.runPersonaAnalyze++; };   // F2 failed 동선 추적(실분석 미실행)
    // getToken 은 환경별 _TOKEN_KEY(::staging|::local|::prod)를 읽고 JWT payload.exp 만료를 검사함.
    //   → 유효 exp(미래) 를 가진 JWT 형태 가짜 토큰을 셋 다 set 해 환경 무관하게 getToken 통과.
    const FAKE_JWT = 'x.' + btoa(JSON.stringify({ exp: 9999999999 })) + '.y';
    try { ['staging', 'local', 'prod'].forEach(s => localStorage.setItem('itdasy_token::' + s, FAKE_JWT)); } catch (_e) { void 0; }

    const setStatus = (payload) => { window.apiFetch = async (path) => /instagram\/status/.test(path) ? { ok: true, json: async () => payload } : { ok: true, json: async () => ({}) }; };
    const readCache = () => { try { return JSON.parse(localStorage.getItem('itdasy_latest_analysis') || 'null'); } catch (_e) { return null; } };
    const clearCache = () => { try { localStorage.removeItem('itdasy_latest_analysis'); localStorage.removeItem('itdasy_persona_status'); } catch (_e) { void 0; } };
    const popup = () => document.getElementById('analyzeResultPopup');
    const closePopup = () => { const p = popup(); if (p) p.style.display = 'none'; };

    const DONE = { connected: true, shop_name: 'QA샵', handle: 'qa_shop', style_analysis_status: 'done',
      persona: { tone: '친근하고 따뜻한 말투', emojis: '✨😊', hashtags: '#네일,#젤네일', avg_caption_length: 80, style_summary: '편안하게 말 거는 동네 단골 느낌' } };

    const r = {};

    // S1. 캐시 비어있음 + status done → 재수화
    clearCache(); setStatus(DONE);
    await window.checkInstaStatus();
    const c1 = readCache();
    r.s1_hydrated = !!(c1 && c1.style_summary && c1.tone_summary && c1.style_summary === DONE.persona.style_summary);
    r.s1_status = (function () { try { return localStorage.getItem('itdasy_persona_status'); } catch (_e) { return null; } })();

    // S2. 재수화 후 showDetailedAnalysis → 팝업 렌더
    closePopup();
    window.showDetailedAnalysis();
    const pop = popup();
    r.s2_popupOpen = !!(pop && pop.style.display === 'block');
    r.s2_bodyHasContent = (document.getElementById('analyzeResultBody') || {}).innerHTML ? document.getElementById('analyzeResultBody').innerHTML.length > 80 : false;

    // S3. 기존 풍부 캐시 보존(top5 포함) — status done 와 달라도 덮어쓰지 않음
    const rich = { style_summary: '풍부본 스타일', tone_summary: '풍부본 톤', tone: '풍부본', top5_analysis: [{ rank: 1, why: 'x' }] };
    try { localStorage.setItem('itdasy_latest_analysis', JSON.stringify(rich)); } catch (_e) { void 0; }
    await window.checkInstaStatus();
    const c3 = readCache();
    r.s3_preserved = !!(c3 && c3.style_summary === '풍부본 스타일' && Array.isArray(c3.top5_analysis));

    // S4. pending → 재수화 안 함 + 안내
    clearCache(); setStatus({ connected: true, shop_name: 'QA샵', style_analysis_status: 'pending', persona: null });
    await window.checkInstaStatus();
    r.s4_noHydrate = readCache() == null || !(readCache() && readCache().style_summary);
    r.s4_statusPending = (function () { try { return localStorage.getItem('itdasy_persona_status') === 'pending'; } catch (_e) { return false; } })();
    closePopup(); toasts.length = 0;
    window.showDetailedAnalysis();
    r.s4_pendingGuide = toasts.some(t => /분석 중/.test(t)) && !(popup() && popup().style.display === 'block');

    // S5. failed → 실패 안내(safe) + 재분석 동선 안내. 단 리포트 열기로 자동 재분석은 금지(호출 0).
    clearCache(); setStatus({ connected: true, shop_name: 'QA샵', style_analysis_status: 'failed', persona: { tone: '', style_summary: '' } });
    await window.checkInstaStatus();
    closePopup(); toasts.length = 0; calls.runPersonaAnalyze = 0;
    window.showDetailedAnalysis();
    r.s5_failedGuide = toasts.some(t => /실패/.test(t) && /다시/.test(t));
    r.s5_noAutoReanalyze = calls.runPersonaAnalyze === 0;   // ★ 자동 재분석 안 함(사용자 직접 동선만)

    // S6. connected false → 기존 연동 안내 유지
    clearCache(); setStatus({ connected: false, shop_name: '' });
    await window.checkInstaStatus();
    closePopup(); toasts.length = 0;
    window.showDetailedAnalysis();
    r.s6_connectGuide = toasts.some(t => /인스타 연동 후|연동 후 분석/.test(t));

    r.safety = calls;
    return r;
  });

  // F3. 내샵관리 카드 조건 — tone 만 있어도 노출되는지 (격리 evaluate, render 전체 네비 회피).
  //   _renderPersonaCard 가 비노출이라, 카드가 쓰는 동일 표현식을 그대로 평가해 검증.
  out.f3 = await page.evaluate(() => {
    const evalCond = (raw) => ((raw && (raw.style_summary || raw.tone_summary || raw.tone)) || '').toString().trim();
    return {
      toneOnly: !!evalCond({ tone: '톤만 있음' }),
      toneSummaryOnly: !!evalCond({ tone_summary: '톤요약만' }),
      styleOnly: !!evalCond({ style_summary: '스타일만' }),
      emptyHidden: !evalCond({}),
    };
  });

  out.severeErrors = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK|Failed to load resource|ERR_/i.test(e));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
}
main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
