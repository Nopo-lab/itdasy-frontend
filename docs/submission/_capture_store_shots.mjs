/**
 * 스토어 제출용 스크린샷 캡처 — 실제 앱 화면을 그대로 찍는다.
 *
 * [출시감사 2026-07-31] 이전엔 `_gen_iap_screenshot.py` 가 PIL 로 가짜 화면을 그렸다.
 *   앱에 이미 잘 만들어진 멤버십 화면(app-plan.js)이 있는데 조잡한 모조품을 만들어
 *   제출문서·랜딩에 뿌리고 있었고, 가격이 바뀔 때마다 이미지에 옛 가격이 구워진 채 남았다.
 *   → 앱 화면을 직접 캡처하는 방식으로 교체. 가격·문구는 앱이 단일 진실원.
 *
 * 사용법:
 *   ITDASY_TOKEN='<스테이징 토큰>' node docs/submission/_capture_store_shots.mjs
 *
 * 출력: docs/submission/shots/*.png  (App Store 6.7" = 1290×2796, 6.5" = 1242×2688)
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'shots');
const APP = process.env.ITDASY_URL || 'https://nopo-lab.github.io/itdasy-frontend-test-yeunjun/';
const TOKEN = process.env.ITDASY_TOKEN;

if (!TOKEN) {
  console.error('ITDASY_TOKEN 환경변수가 필요합니다 (스테이징 로그인 토큰).');
  process.exit(1);
}

// App Store 요구 규격. deviceScaleFactor 로 실제 픽셀을 맞춘다.
const DEVICES = [
  { name: '6.7', w: 430, h: 932, scale: 3 },   // 1290×2796
  { name: '6.5', w: 414, h: 896, scale: 3 },   // 1242×2688
];

/** 화면별 진입 동작. page 를 목표 화면까지 이동시킨다. */
const SCREENS = [
  {
    id: 'membership',
    label: '멤버십(IAP)',
    go: async (page) => {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('.ms-side__item, .ms-menu__item')]
          .find((x) => /플랜/.test(x.innerText || ''));
        if (!b) throw new Error('플랜·구독 진입 버튼을 찾지 못함');
        b.click();
      });
      await page.waitForTimeout(1500);
    },
  },
  {
    id: 'home',
    label: '홈',
    go: async (page) => { await page.waitForTimeout(800); },
  },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

for (const dev of DEVICES) {
  for (const screen of SCREENS) {
    const ctx = await browser.newContext({
      viewport: { width: dev.w, height: dev.h },
      deviceScaleFactor: dev.scale,
      isMobile: true,
      hasTouch: true,
      locale: 'ko-KR',
    });
    const page = await ctx.newPage();
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.evaluate((t) => localStorage.setItem('itdasy_token::staging', t), TOKEN);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000); // 앱 부팅 + 데이터 로드

    try {
      await screen.go(page);
      const out = join(OUT, `${screen.id}-${dev.name}.png`);
      await page.screenshot({ path: out });
      console.log(`  → ${out}  (${dev.w * dev.scale}×${dev.h * dev.scale})`);
    } catch (e) {
      console.error(`  ✗ ${screen.id}-${dev.name}: ${e.message}`);
    }
    await ctx.close();
  }
}

await browser.close();
console.log('완료. Apple 은 6.7" 필수, 6.5" 는 선택(없으면 6.7" 를 축소해 씀).');
