/* 작업실 V2 핫픽스 QA — 실제 브라우저(chromium)에서 workspace-v2-flow.js 를 구동.
   인증 우회: 슬롯(사진 포함)을 직접 주입해 edit/caption 화면을 렌더 후 동작 검증. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const FLOW = fs.readFileSync(path.join(ROOT, 'js/workspace/workspace-v2-flow.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'css/workspace-v2-flow.css'), 'utf8');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF8FAGW2BPHFsbpRAAAAAElFTkSuQmCC';

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head>
<body>
<script>
  window._uid = function(){ return 'id_' + Math.random().toString(36).slice(2); };
  window.__toasts = [];
  window.showToast = function(m){ window.__toasts.push(m); };
  window.confirm = function(){ window.__confirmCalled = true; return true; };
  window.renderScenarioSelector = function(container, cb){ window.__scenarioCb = cb; container.innerHTML = '<div class="stub-scenario"></div>'; };
  window.WorkspaceAdapter = {
    applyWorkspaceCorrections: function(opts){ window.__lastCorr = opts; return Promise.resolve({ ok:true, dataUrl: opts.src }); },
    generateCaption: function(opts){ window.__lastGen = opts; return Promise.resolve({ ok:true, caption:'생성된 본문 ' + (opts.service||''), hashtags:['#' + ((opts.service||'tag').split(/[ ,]/)[0])], caption_template:'' }); },
    instagram: function(){ return { connected:false }; },
    instagramProfile: function(){ return { connected:false }; },
    recentCustomers: function(){ return Promise.resolve([]); },
  };
</script>
<script>${FLOW}</script>
</body></html>`;

const results = [];
function check(name, cond, detail) { results.push({ name, pass: !!cond, detail: detail || '' }); }

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console:' + m.text()); });
  await page.setContent(PAGE, { waitUntil: 'load' });

  // ── A. 업로드 화면: 2장 자동 전후 금지 ──
  await page.evaluate((png) => {
    window.WorkspaceFlow.open({ startScreen:'upload', slot:{ id:'s1', photos:[
      { id:'p1', dataUrl: png, role:'hero' }, { id:'p2', dataUrl: png, role:'hero' },
      { id:'p3', dataUrl: png, role:'hero' }, { id:'p4', dataUrl: png, role:'hero' }, { id:'p5', dataUrl: png, role:'hero' } ] } });
  }, PNG);
  const upTags = await page.$$eval('#wsv2Flow [data-fs="upload"] .thumb-tag', els => els.map(e => e.textContent.trim()));
  const baToggleOn = await page.$eval('#wsv2Flow [data-fl="batoggle"]', el => el.classList.contains('on'));
  check('A1 5장 업로드 자동 전후 OFF', baToggleOn === false, 'toggle on=' + baToggleOn);
  check('A2 자동 홍보컷/전후 라벨 안 붙음(중립 라벨)', upTags.length === 5 && upTags.every(t => /^사진 \d/.test(t)), JSON.stringify(upTags));

  // ── B/C. 편집 화면 렌더 ──
  await page.evaluate((png) => {
    window.WorkspaceFlow.open({ startScreen:'edit', slot:{ id:'s2', photos:[{ id:'p1', dataUrl: png, role:'hero' }] } });
  }, PNG);
  const hasLabeled = await page.$$eval('#wsv2Flow [data-fs="edit"] .ed-slider--labeled', e => e.length);
  const hasVal = await page.$$eval('#wsv2Flow [data-fs="edit"] .ed-val', e => e.length);
  const loHi = await page.$eval('#wsv2Flow [data-fs="edit"] .ed-slider--labeled', el => ({
    lo: el.querySelector('.ed-slabel--lo')?.textContent.trim(),
    hi: el.querySelector('.ed-slabel--hi')?.textContent.trim(),
    hasNumber: /\d/.test(el.textContent),
  }));
  check('C1 좌우 고정 라벨 슬라이더 존재', hasLabeled >= 1, 'count=' + hasLabeled);
  check('C2 숫자 표기(.ed-val) 제거', hasVal === 0, 'ed-val count=' + hasVal);
  check('C3 밝기 라벨 어두움/밝음 + 숫자 없음', loHi.lo === '어두움' && loHi.hi === '밝음' && !loHi.hasNumber, JSON.stringify(loHi));

  // 색감 탭으로 전환 후 라벨 확인 (쿨톤/웜톤)
  await page.click('#wsv2Flow [data-fs="edit"] [data-fl-basictool="color"]');
  const colorLabels = await page.$eval('#wsv2Flow [data-fs="edit"] .ed-slider--labeled', el => ({
    lo: el.querySelector('.ed-slabel--lo')?.textContent.trim(), hi: el.querySelector('.ed-slabel--hi')?.textContent.trim() }));
  check('C4 색감 라벨 쿨톤/웜톤', colorLabels.lo === '쿨톤' && colorLabels.hi === '웜톤', JSON.stringify(colorLabels));

  // 선명도 라벨
  await page.click('#wsv2Flow [data-fs="edit"] [data-fl-basictool="sharpness"]');
  const shpLabels = await page.$eval('#wsv2Flow [data-fs="edit"] .ed-slider--labeled', el => ({
    lo: el.querySelector('.ed-slabel--lo')?.textContent.trim(), hi: el.querySelector('.ed-slabel--hi')?.textContent.trim() }));
  check('C5 선명도 라벨 부드러움/또렷함', shpLabels.lo === '부드러움' && shpLabels.hi === '또렷함', JSON.stringify(shpLabels));

  // ── B. 슬라이더 동작 + 되돌리기/다시실행/비교/초기화 ──
  await page.click('#wsv2Flow [data-fs="edit"] [data-fl-basictool="brightness"]');
  // 밝기 슬라이더를 +60 으로 드래그(input)→손뗌(change)
  await page.$eval('#wsv2Flow [data-fs="edit"] input[data-fl-range="brightness"]', el => {
    el.value = 60; el.dispatchEvent(new Event('focusin', { bubbles:true }));
    el.dispatchEvent(new Event('input', { bubbles:true }));
    el.dispatchEvent(new Event('change', { bubbles:true }));
  });
  const filterAfter = await page.$eval('#wsv2Flow [data-fs="edit"] [data-fl-edphoto]', el => el.style.filter || el.getAttribute('style'));
  check('B1 밝기 조정이 실제 렌더(filter/preview)에 반영', /brightness/.test(filterAfter) || (await page.evaluate(()=>!!window.__lastCorr)), 'filter=' + filterAfter);
  const undoEnabled = await page.$eval('#wsv2Flow [data-fs="edit"] [data-fl-eb="되돌리기"]', el => !el.classList.contains('disabled'));
  check('B2 조정 후 되돌리기 버튼 활성', undoEnabled, 'enabled=' + undoEnabled);

  // 되돌리기 → adjust.brightness 0 복귀
  await page.click('#wsv2Flow [data-fs="edit"] [data-fl-eb="되돌리기"]');
  const brAfterUndo = await page.$eval('#wsv2Flow [data-fs="edit"] input[data-fl-range="brightness"]', el => +el.value);
  check('B3 되돌리기 → 밝기 값 원복(0)', brAfterUndo === 0, 'brightness=' + brAfterUndo);
  const redoEnabled = await page.$eval('#wsv2Flow [data-fs="edit"] [data-fl-eb="다시실행"]', el => !el.classList.contains('disabled'));
  check('B4 되돌리기 후 다시실행 활성', redoEnabled, 'enabled=' + redoEnabled);
  // 다시실행 → 60 복귀
  await page.click('#wsv2Flow [data-fs="edit"] [data-fl-eb="다시실행"]');
  const brAfterRedo = await page.$eval('#wsv2Flow [data-fs="edit"] input[data-fl-range="brightness"]', el => +el.value);
  check('B5 다시실행 → 밝기 값 60 복귀', brAfterRedo === 60, 'brightness=' + brAfterRedo);

  // 비교(원본보기): originalPreview 토글 시 필터 none + 원본 dataUrl
  await page.click('#wsv2Flow [data-fs="edit"] [data-fl-eb="비교"]');
  const cmp = await page.$eval('#wsv2Flow [data-fs="edit"] [data-fl-edphoto]', el => (el.getAttribute('style')||''));
  check('B6 비교 → 필터 제거(원본 표시)', /filter:\s*none/.test(cmp) || !/brightness/.test(cmp), 'style=' + cmp);
  await page.click('#wsv2Flow [data-fs="edit"] [data-fl-eb="비교"]'); // 다시 끄기

  // 초기화: 팝업(confirm) 없이 보정만 0 으로
  await page.evaluate(() => { window.__confirmCalled = false; });
  await page.click('#wsv2Flow [data-fs="edit"] [data-fl-eb="초기화"]');
  const brAfterReset = await page.$eval('#wsv2Flow [data-fs="edit"] input[data-fl-range="brightness"]', el => +el.value);
  const confirmCalled = await page.evaluate(() => window.__confirmCalled);
  check('B7 초기화 → 보정 0 + confirm 팝업 없음', brAfterReset === 0 && confirmCalled === false, 'br=' + brAfterReset + ' confirm=' + confirmCalled);

  // ── E. 캡션 키워드 반영 + 버튼 ──
  await page.evaluate((png) => {
    window.WorkspaceFlow.open({ startScreen:'caption', slot:{ id:'s3', photos:[{ id:'p1', dataUrl: png, role:'hero' }] } });
  }, PNG);
  // 시술명 입력 후 '이 내용으로 생성'
  await page.fill('#wsv2Flow [data-fs="caption"] [data-fl-service]', '레이어드컷 샤기컷');
  await page.click('#wsv2Flow [data-fs="caption"] [data-fl="gen"]');
  await page.waitForFunction(() => !!window.__lastGen);
  const gen = await page.evaluate(() => window.__lastGen);
  check('E1 캡션 생성 payload에 키워드 반영', gen && gen.service === '레이어드컷 샤기컷', JSON.stringify(gen));
  // 결과 화면 버튼 존재 (다시/더 길게/초기화/해시태그 더/인스타스럽게)
  const capBtns = await page.$$eval('#wsv2Flow [data-fs="caption"] [data-fl-var]', els => els.map(e => e.textContent.trim()));
  check('E2 하단 버튼=다시/더 길게/초기화/해시태그 더/인스타스럽게',
    JSON.stringify(capBtns) === JSON.stringify(['다시','더 길게','초기화','해시태그 더','인스타스럽게']), JSON.stringify(capBtns));
  // 인스타스럽게 → tone instagram, 라우팅 없음(캡션 화면 유지)
  await page.evaluate(() => { window.__lastGen = null; });
  await page.click('#wsv2Flow [data-fs="caption"] [data-fl-var="insta"]');
  await page.waitForFunction(() => !!window.__lastGen);
  const ins = await page.evaluate(() => window.__lastGen);
  const stillCaption = await page.$eval('#wsv2Flow [data-fs="caption"]', el => el.classList.contains('active'));
  check('E3 인스타스럽게 → tone=instagram, 캡션 화면 유지(팝업/라우팅 없음)', ins && ins.tone_override === 'instagram' && stillCaption, JSON.stringify(ins) + ' active=' + stillCaption);
  // 초기화 → 입력 화면 복귀(사진 유지)
  await page.click('#wsv2Flow [data-fs="caption"] [data-fl-var="reset"]');
  const backToInput = await page.$eval('#wsv2Flow [data-fs="caption"]', el => !!el.querySelector('[data-fl="gen"]'));
  const svcKept = await page.$eval('#wsv2Flow [data-fs="caption"] [data-fl-service]', el => el.value);
  check('E4 캡션 초기화 → 입력화면 복귀(서비스 유지)', backToInput && svcKept === '레이어드컷 샤기컷', 'input=' + backToInput + ' svc=' + svcKept);

  check('F1 콘솔/페이지 런타임 에러 없음', errors.length === 0, errors.slice(0,3).join(' | '));

  await browser.close();

  const pass = results.filter(r => r.pass).length;
  console.log('\n=== 작업실 V2 핫픽스 QA ===');
  results.forEach(r => console.log((r.pass ? 'PASS' : 'FAIL') + '  ' + r.name + (r.pass ? '' : '   << ' + r.detail)));
  console.log(`\n${pass}/${results.length} PASS`);
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
