#!/usr/bin/env node
/* EG-3 / CF-4 클릭 시점 캔버스 재캡처 QA (런타임 미수정 — 실사진 불필요, placeholder canvas 주입)
   검증: open_instagram / export_image 클릭 시 payload.dataUrl(스테일) 이 아니라
   클릭 시점의 #peCanvas(최신 보정/템플릿 적용본)를 재캡처하는가.
   - RED 캔버스 → 클릭 → 라이브 캡처(스테일 payload 와 다름)
   - BLUE 로 다시 그림(템플릿 적용 흉내) → 재클릭 → 캡처가 RED→BLUE 로 달라짐
   - export_image 도 동일하게 최신본 사용
   - 캔버스 없으면 payload fallback, 둘 다 없으면 "사진 열어주세요" 안내
   - 안전성: publish_instagram 직접 호출 0 (open_instagram 은 미리보기만)
   실행: python3 -m http.server 8099 후 node scripts/cf4-recapture-qa.js (PHOTO_QA_URL 지정 가능) */

const { chromium } = require('playwright');
const BASE_URL = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=cf4qa';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 430, height: 920 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 140)); });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.ItdasyActionHub && typeof window.ItdasyActionHub.handleActionClick === 'function', null, { timeout: 45000 });

  const out = await page.evaluate(async () => {
    const H = window.ItdasyActionHub;
    const calls = { publishInstagram: 0, bookingCreate: 0, revenueCreate: 0, sendMessage: 0, preview: 0 };
    // 위험 함수 스텁 — 직접 자동실행 추적
    window.publishInstagram = function () { calls.publishInstagram++; };
    window.sendMessage = function () { calls.sendMessage++; };
    window.Booking = Object.assign(window.Booking || {}, { create: function () { calls.bookingCreate++; } });
    window.Revenue = Object.assign(window.Revenue || {}, { create: function () { calls.revenueCreate++; } });
    // 인스타 미리보기는 src 만 캡처(게시 아님)
    let lastPreviewSrc = '';
    window.openInstagramPreview = function (opts) { calls.preview++; lastPreviewSrc = (opts && opts.src) || ''; };
    // export 의 <a download> 클릭 href 캡처(다운로드 실제 발생 방지 위해 click 가로채기)
    let lastExportHref = '';
    const _origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (this.download) { lastExportHref = this.href; return; } return _origClick.apply(this, arguments); };

    // placeholder #peCanvas 생성 + 단색 채우기 헬퍼
    let cv = document.getElementById('peCanvas');
    if (!cv) { cv = document.createElement('canvas'); cv.id = 'peCanvas'; document.body.appendChild(cv); }
    cv.width = 64; cv.height = 64;
    function paint(color) { const g = cv.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, 64, 64); return cv.toDataURL('image/jpeg', 0.92); }

    const STALE = 'data:image/jpeg;base64,STALE_PAYLOAD_OLD_EDIT';
    const r = {};

    // 1. RED 캔버스에서 open_instagram → 라이브 캡처(스테일과 다름)
    const redUrl = paint('#ff0000');
    H.handleActionClick({ kind: 'open_instagram', phase: 'safe', payload: { dataUrl: STALE, caption: 'x' } }, {});
    const cap1 = lastPreviewSrc;
    r.usedLiveNotStale = cap1 !== STALE && cap1.startsWith('data:image');
    r.cap1MatchesRed = cap1 === redUrl;

    // 2. 템플릿 적용 흉내 — BLUE 로 다시 그림 → 재클릭 시 캡처 달라짐
    const blueUrl = paint('#0000ff');
    H.handleActionClick({ kind: 'open_instagram', phase: 'safe', payload: { dataUrl: STALE, caption: 'x' } }, {});
    const cap2 = lastPreviewSrc;
    r.recaptureDiffers = cap2 !== cap1;          // RED→BLUE 로 달라져야 함
    r.cap2MatchesBlue = cap2 === blueUrl;
    r.redBlueDiffer = redUrl !== blueUrl;        // sanity: 두 캔버스 dataUrl 자체가 다름

    // 3. export_image 도 클릭 시점 최신본(BLUE) 사용
    H.handleActionClick({ kind: 'export_image', phase: 'safe', payload: { dataUrl: STALE } }, {});
    r.exportUsesLive = lastExportHref === blueUrl && lastExportHref !== STALE;

    // 4. 캔버스 없을 때 payload fallback
    cv.parentNode.removeChild(cv);
    H.handleActionClick({ kind: 'open_instagram', phase: 'safe', payload: { dataUrl: STALE, caption: 'x' } }, {});
    r.fallbackToPayload = lastPreviewSrc === STALE;

    // 5. 캔버스도 payload 도 없으면 안내(게시 X)
    const noImg = H.handleActionClick({ kind: 'open_instagram', phase: 'safe', payload: {} }, {});
    r.noImageGuide = /사진을 열어주세요|이미지가 없어요/.test((noImg && noImg.message) || '');

    HTMLAnchorElement.prototype.click = _origClick;
    r.safety = calls;
    return r;
  });

  out.severeErrors = errors.filter(e => !/favicon|ResizeObserver|TensorFlow|XNNPACK/i.test(e));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
}
main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
