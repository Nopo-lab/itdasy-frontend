/* Workspace flow smoke — Phase D(flow.js 분할, T-104) 안전망.
 *
 * 정적 서버 + Playwright(chromium)로 "작업실" 플로우를 실제 구동해 런타임 회귀
 *   (JS 예외·화면 미렌더)를 잡는다. `npm run smoke:flow`. 분할 전/후로 매번 실행.
 *
 * 로그인은 _setAuthGateLocked(false)로 우회(시각검증과 동일). 백엔드 없이 돌리므로
 *   API/network 에러는 무시하고, 진짜 JS 예외(TypeError/ReferenceError/pageerror 등)만 실패로 본다.
 *
 * 종료코드: 0=PASS, 1=FAIL.
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8199;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.map': 'application/json',
};

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const fp = path.join(ROOT, p);
      if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('404'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(fp).pipe(res);
    });
    srv.listen(PORT, () => resolve(srv));
  });
}

const STEPS = [];
const step = (name, ok, detail) => STEPS.push({ name, ok: !!ok, detail: detail || '' });

// 백엔드 없는 스모크 — network/API 에러는 무시, 진짜 JS 예외만 실패.
const isHardError = (t) =>
  /pageerror:|TypeError|ReferenceError|SyntaxError|is not a function|Cannot read|Cannot set|is not defined|is not an object/.test(t)
  && !/fetch|network|net::|load failed|401|403|404|429|5\d\d|apiUrl|apiFetch|run\.app|supabase|persona|assistant\/ask/i.test(t);

async function openWorkspace(page) {
  return await page.evaluate(() => {
    const out = {};
    try { if (typeof _setAuthGateLocked === 'function') _setAuthGateLocked(false); } catch (e) { void e; }
    const lock = document.getElementById('lockOverlay'); if (lock) lock.style.display = 'none';
    function mk(c) { const cv = document.createElement('canvas'); cv.width = 600; cv.height = 750; const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 600, 750); return cv.toDataURL('image/jpeg', 0.7); }
    try {
      out.hasOpen = !!(window.WorkspaceFlow && window.WorkspaceFlow.command);
      window.WorkspaceFlow.command({ type: 'open', photoUrls: [mk('#c98a7a'), mk('#7a9ec9')] });
      out.isOpen = window.WorkspaceFlow.isOpen && window.WorkspaceFlow.isOpen();
      const s = window.WorkspaceFlow.getActiveSlot && window.WorkspaceFlow.getActiveSlot();
      out.slot = s ? { screen: s.screen, photoCount: s.photoCount } : null;
    } catch (e) { out.err = String(e); }
    return out;
  });
}

(async () => {
  const srv = await serve();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  const base = `http://localhost:${PORT}/index.html`;

  try {
    // ── ws-hyper ON (기본 플로우) ──
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.WorkspaceFlow && window.WorkspaceLayout && window.ItdEditor, { timeout: 20000 });
    step('modules load (WorkspaceFlow/Layout/Editor)', true);
    step('ws-hyper default ON', (await page.evaluate(() => window.ITDASY_WS_HYPER)) === true);

    await page.waitForTimeout(2000);   // 앱 초기 라우팅/히스토리 부팅 정착(안 그러면 오픈 직후 오버레이가 닫힘)
    await openWorkspace(page);
    await page.waitForTimeout(500);
    const s1 = await page.evaluate(() => window.WorkspaceFlow.getActiveSlot());
    step('open → HYPER routes to layout', s1 && s1.screen === 'layout', 'screen=' + (s1 && s1.screen));

    step('layout cards render (≥8)', (await page.evaluate(() => document.querySelectorAll('.wsl-card').length)) >= 8);

    await page.evaluate(() => { const c = document.querySelector('.wsl-card[data-fl-layoutpick="wsl-ba-lr"]'); if (c) c.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await page.waitForTimeout(400);
    step('select layout → stage mounts', await page.evaluate(() => !!document.querySelector('[data-fl-stage]')));

    // 후기/가격 텍스트 합성(A1) — composeLayout이 텍스트 주입 레이아웃도 그려내는지
    const compBA = await page.evaluate(async () => {
      const WL = window.WorkspaceLayout;
      function mk(c) { const cv = document.createElement('canvas'); cv.width = 400; cv.height = 500; const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 400, 500); return cv.toDataURL('image/jpeg', 0.7); }
      const p = { id: 'p', dataUrl: mk('#c98a7a'), role: 'main' };
      const rev = WL.getById('wsl-review'); rev.layers.forEach((L) => { if (L.role === 'body') L.text = '테스트 후기'; });
      const u = await WL.composeLayout(rev, [p], { main: p });
      return !!(u && u.indexOf('data:image') === 0);
    });
    step('composeLayout(review, 텍스트주입) OK', compBA);

    await page.evaluate(() => window.WorkspaceFlow.command({ type: 'goto', screen: 'caption' }));
    await page.waitForTimeout(250);
    step('goto caption', (await page.evaluate(() => window.WorkspaceFlow.getActiveSlot().screen)) === 'caption');

    await page.evaluate(() => window.WorkspaceFlow.command({ type: 'goto', screen: 'preview' }));
    await page.waitForTimeout(250);
    step('goto preview', (await page.evaluate(() => window.WorkspaceFlow.getActiveSlot().screen)) === 'preview');

    // 편집기 헤드리스 compose(exportComposite 경로)
    await page.evaluate(() => window.WorkspaceFlow.close());
    await page.waitForTimeout(200);
    const compose = await page.evaluate(async () => {
      function mk(c) { const cv = document.createElement('canvas'); cv.width = 400; cv.height = 500; const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 400, 500); return cv.toDataURL('image/jpeg', 0.7); }
      try { const u = await window.ItdEditor.compose({ photo: mk('#ccc'), photos: [mk('#ccc')], ratio: '4:5' }); return !!(u && u.indexOf('data:image') === 0); } catch (e) { return false; }
    });
    step('ItdEditor.compose → dataURL', compose);

    // ── ws-hyper OFF (옛 플로우 회귀) ──
    await page.goto(base + '?wshyper=0', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.WorkspaceFlow, { timeout: 20000 });
    step('rollback ?wshyper=0 → OFF', (await page.evaluate(() => window.ITDASY_WS_HYPER)) === false);
  } catch (e) {
    step('EXCEPTION', false, String(e).split('\n')[0]);
  }

  const hard = errs.filter(isHardError);
  step('no JS runtime errors', hard.length === 0, hard.slice(0, 3).join(' | '));

  await browser.close();
  srv.close();

  const fails = STEPS.filter((s) => !s.ok);
  console.log('\n── Workspace flow smoke ──');
  STEPS.forEach((s) => console.log(`${s.ok ? '✅' : '❌'} ${s.name}${s.detail ? '  (' + s.detail + ')' : ''}`));
  if (errs.length) console.log(`\n(참고: 무시된 network/API 에러 ${errs.length - hard.length}건)`);
  console.log(`\n${fails.length ? '❌ FAIL' : '✅ PASS'} — ${STEPS.length - fails.length}/${STEPS.length}`);
  process.exit(fails.length ? 1 : 0);
})();
