#!/usr/bin/env node
/* T-117 조작부 가시성 QA 하니스 (1회성, 프로덕션 코드 미수정)
   목적: 뷰티/헤어/메이크업 패널 진입 시 첫 슬라이더가 화면(패널 viewport, nav-v7 위)에
         실제로 보이는지 bbox 로 측정하고 before/after 스크린샷을 남긴다.

   실행:
     PHASE=before node scripts/photo-controls-visibility-qa.js
     PHASE=after  node scripts/photo-controls-visibility-qa.js
   결과: output/playwright/{beauty,hair,makeup}_panel_<phase>.png + nav_overlap_check_<phase>.png
         + 콘솔 JSON 리포트 (bbox/가시성 판정) */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'output', 'playwright');
const PHASE = process.env.PHASE || 'before';
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=1&v=t117';

function shot(name) { return path.join(OUT, `${name}_${PHASE}.png`); }

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  });
  // 모바일 430×920 기준
  const page = await browser.newPage({ viewport: { width: 430, height: 920 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message || e)));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.addInitScript(() => {
    window.APP_BUILD = window.APP_BUILD || 'qa-t117';
    window.__t117_open = async function () {
      // lock overlay 해제
      document.body.classList.remove('itdasy-locked');
      const lock = document.getElementById('lockOverlay');
      if (lock) lock.classList.add('hidden');
      // 합성 인물 사진 (네트워크 의존 0)
      const c = document.createElement('canvas');
      c.width = 800; c.height = 1000;
      const g = c.getContext('2d');
      const grad = g.createLinearGradient(0, 0, 0, 1000);
      grad.addColorStop(0, '#f3d9c6'); grad.addColorStop(1, '#c98f74');
      g.fillStyle = grad; g.fillRect(0, 0, 800, 1000);
      g.fillStyle = '#a86b4f'; g.beginPath(); g.arc(400, 420, 180, 0, Math.PI * 2); g.fill();
      const src = c.toDataURL('image/png');
      const PE = window.PhotoEditor;
      PE.open({ src, shopName: '잇데이 QA 살롱', initial_tab: 'auto' });
      await new Promise((resolve, reject) => {
        const t0 = Date.now();
        const tick = () => {
          const st = PE._internal && PE._internal.getState && PE._internal.getState();
          if (st && st.originalImg && st.originalImg.naturalWidth) return resolve(true);
          if (Date.now() - t0 > 20000) return reject(new Error('이미지 로드 지연'));
          setTimeout(tick, 80);
        };
        tick();
      });
      // nav-v7 활성 보장
      const NV = window.PhotoEditorNavV7;
      if (NV) { try { NV.setEnabled(true); NV.mount(); } catch (_e) { void _e; } }
      await new Promise(r => setTimeout(r, 250));
    };
    window.__t117_nav = async function (chipId) {
      const NV = window.PhotoEditorNavV7;
      if (NV && NV.setSubChip) NV.setSubChip(chipId);
      await new Promise(r => setTimeout(r, 400)); // rAF 자동 스크롤 반영 대기
    };
    window.__t117_measure = function () {
      const panel = document.getElementById('pePanel');
      const nav = document.getElementById('peNavV7');
      if (!panel) return { error: 'no panel' };
      const sliders = Array.from(panel.querySelectorAll('.pe-slider')).filter(el => el.offsetParent !== null);
      const r = el => { const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), height: Math.round(b.height) }; };
      const pr = panel.getBoundingClientRect();
      const navTop = nav ? nav.getBoundingClientRect().top : window.innerHeight;
      const first = sliders[0] ? sliders[0].getBoundingClientRect() : null;
      const lastEl = sliders[sliders.length - 1];
      const visibleBottom = Math.min(pr.bottom, navTop);
      return {
        sliderCount: sliders.length,
        panel: r(panel),
        nav: nav ? r(nav) : null,
        navTopY: Math.round(navTop),
        visibleBottomY: Math.round(visibleBottom),
        first: first ? r(sliders[0]) : null,
        last: lastEl ? r(lastEl) : null,
        // 첫 슬라이더가 패널 가시영역(상단~nav위) 안에 온전히 들어오는가
        firstVisible: first ? (first.top >= pr.top - 2 && first.bottom <= visibleBottom + 2) : false,
        // 패널 끝까지 스크롤하면 마지막 슬라이더가 nav 위로 올라오는가(접근 가능)
        scroll: { top: Math.round(panel.scrollTop), height: Math.round(panel.scrollHeight), client: Math.round(panel.clientHeight) },
      };
    };
    window.__t117_scrollBottom = async function (expandMore) {
      const panel = document.getElementById('pePanel');
      if (!panel) return null;
      // "전체 보정 보기" 펼쳐 최악(슬라이더 27개) 케이스로 검증
      if (expandMore) {
        const tgl = panel.querySelector('[data-pe-beauty-toggle]');
        if (tgl) { tgl.click(); await new Promise(r => requestAnimationFrame(r)); }
      }
      // smooth 우회 — 즉시 바닥으로
      const prev = panel.style.scrollBehavior;
      panel.style.scrollBehavior = 'auto';
      panel.scrollTop = panel.scrollHeight;
      panel.style.scrollBehavior = prev || '';
      await new Promise(r => setTimeout(r, 120));
      const nav = document.getElementById('peNavV7');
      const navTop = nav ? nav.getBoundingClientRect().top : window.innerHeight;
      const sliders = Array.from(panel.querySelectorAll('.pe-slider')).filter(el => el.offsetParent !== null);
      const lastEl = sliders[sliders.length - 1];
      const lb = lastEl ? lastEl.getBoundingClientRect() : null;
      return {
        sliderCount: sliders.length,
        scrollTop: Math.round(panel.scrollTop),
        maxScroll: Math.round(panel.scrollHeight - panel.clientHeight),
        lastBottom: lb ? Math.round(lb.bottom) : null,
        navTopY: Math.round(navTop),
        lastReachable: lb ? (lb.bottom <= navTop + 2) : false,
      };
    };
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.PhotoEditor && window.PhotoEditorNavV7, null, { timeout: 45000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__t117_open());

  const report = { phase: PHASE, viewport: '430x920', cases: {} };

  const CASES = [
    { key: 'beauty', chip: 'beauty' },      // 리터치 > 뷰티 (general)
    { key: 'hair', chip: 'hair-detail' },   // 헤어 > 디테일
    { key: 'makeup', chip: 'makeup-lip' },  // 뷰티(makeup) > 입술
  ];
  for (const c of CASES) {
    await page.evaluate(chip => window.__t117_nav(chip), c.chip);
    const m = await page.evaluate(() => window.__t117_measure());
    report.cases[c.key] = m;
    await page.screenshot({ path: shot(`${c.key}_panel`), fullPage: false });
  }

  // nav 겹침 체크 — hair 패널에서 "전체 보정" 펼친 뒤 바닥까지 스크롤(최악 케이스)
  await page.evaluate(chip => window.__t117_nav(chip), 'hair-detail');
  const overlap = await page.evaluate(() => window.__t117_scrollBottom(true));
  await page.screenshot({ path: shot('nav_overlap_check'), fullPage: false });
  report.overlap = overlap;

  report.severeErrors = errors.filter(e => !/favicon|ResizeObserver/i.test(e));
  await browser.close();

  console.log(JSON.stringify(report, null, 2));
}

main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
