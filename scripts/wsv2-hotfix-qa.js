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

  // ── A3~A5. 5장 직접 묶기: 사진 라벨 탭으로 역할 직접 지정 ──
  await page.click('#wsv2Flow [data-fs="upload"] [data-fl-role="0"]');   // 홍보컷→전
  await page.click('#wsv2Flow [data-fs="upload"] [data-fl-role="1"]');   // 홍보컷→전
  await page.click('#wsv2Flow [data-fs="upload"] [data-fl-role="1"]');   // 전→후
  const tags3 = await page.$$eval('#wsv2Flow [data-fs="upload"] [data-fl-role]', els => els.map(e => e.textContent.trim()));
  check('A3 라벨 탭 → 역할 직접 지정(1=전·2=후·나머지 중립)', tags3[0] === '전' && tags3[1] === '후' && tags3[2] === '사진 3', JSON.stringify(tags3));
  await page.click('#wsv2Flow [data-fs="upload"] [data-fl-role="4"]');   // 전
  await page.click('#wsv2Flow [data-fs="upload"] [data-fl-role="4"]');   // 후
  await page.click('#wsv2Flow [data-fs="upload"] [data-fl-role="4"]');   // 제외
  const tag4 = await page.$eval('#wsv2Flow [data-fs="upload"] [data-fl-role="4"]', el => el.textContent.trim());
  check('A4 역할 순환에 제외 포함', tag4 === '제외', 'tag4=' + tag4);
  await page.click('#wsv2Flow [data-fl="batoggle"]');                    // 전/후 토글 → 수동 리셋 + 자동
  const tagsBa = await page.$$eval('#wsv2Flow [data-fs="upload"] [data-fl-role]', els => els.map(e => e.textContent.trim()));
  check('A5 전/후 토글 → 1=전·2=후·나머지 홍보컷(수동 리셋)', tagsBa[0] === '전' && tagsBa[1] === '후' && tagsBa[2] === '홍보컷', JSON.stringify(tagsBa));

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

  // ── P. 성능: 도구 버튼 탭이 편집화면 전체를 재생성하지 않음(섹션만 교체) ──
  await page.evaluate(() => {
    const photo = document.querySelector('#wsv2Flow [data-fs="edit"] [data-fl-edphoto]');
    if (photo) photo.setAttribute('data-qa-mark', '1');   // 전체 재렌더되면 이 마크가 사라짐
  });
  await page.click('#wsv2Flow [data-fs="edit"] [data-fl-basictool="contrast"]');
  await page.click('#wsv2Flow [data-fs="edit"] [data-fl-basictool="saturation"]');
  const photoKept = await page.$eval('#wsv2Flow [data-fs="edit"] [data-fl-edphoto]', el => el.getAttribute('data-qa-mark'));
  check('P1 도구 버튼 탭=섹션만 교체(사진 DOM 유지, 전체 재렌더 X)', photoKept === '1', 'mark=' + photoKept);
  const vpExists = await page.$$eval('#wsv2Flow [data-fs="edit"] [data-fl-edvp]', e => e.length);
  check('P2 줌 뷰포트(.ed-photo-vp) 존재', vpExists === 1, 'vp=' + vpExists);
  await page.evaluate(() => {
    const vp = document.querySelector('#wsv2Flow [data-fs="edit"] [data-fl-edvp]');
    vp.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    vp.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  const zoomT = await page.$eval('#wsv2Flow [data-fs="edit"] [data-fl-edphoto]', el => el.style.transform || '');
  check('P3 더블탭 → 확대 transform 적용', /scale\(2\)/.test(zoomT), 'transform=' + zoomT);

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
  // 결과 화면: 입력칸 1개만(상단 키워드 입력 제거, 본문 textarea 가 메인)
  const svcInputs = await page.$$eval('#wsv2Flow [data-fs="caption"] [data-fl-service]', e => e.length);
  const capBodies = await page.$$eval('#wsv2Flow [data-fs="caption"] [data-fl-capbody]', e => e.length);
  check('E1b 결과화면 입력칸 1개(상단 키워드 입력 제거, 본문 textarea 메인)', svcInputs === 0 && capBodies === 1, 'service=' + svcInputs + ' body=' + capBodies);
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

  // ── X. 캡션 스킵 방지: 게시글 생성 전엔 다음(고객연결) 못 감 ──
  await page.evaluate((png) => {
    window.WorkspaceFlow.open({ startScreen:'caption', slot:{ id:'sx', photos:[{ id:'p1', dataUrl: png, role:'hero' }] } });
  }, PNG);
  const barHiddenNoCap = await page.$eval('#wsv2Flow .wsv2flow__actionbar', el => el.classList.contains('hidden'));
  check('X1 게시글 생성 전 하단 CTA 숨김(스킵 불가)', barHiddenNoCap === true, 'hidden=' + barHiddenNoCap);
  // CTA 강제 클릭해도 미리보기/연결로 안 넘어감
  await page.evaluate(() => { var c = document.querySelector('#wsv2Flow [data-fl="cta"]'); if (c) c.click(); });
  const stillCap = await page.$eval('#wsv2Flow [data-fs="caption"]', el => el.classList.contains('active'));
  const previewActive = await page.$eval('#wsv2Flow [data-fs="preview"]', el => el.classList.contains('active'));
  check('X2 캡션 미생성 시 진행 차단(미리보기로 안 넘어감)', stillCap === true && previewActive === false, 'cap=' + stillCap + ' preview=' + previewActive);

  // ── I. 작업실 ↔ 잇비 유기적 연동 ──
  const STATE = fs.readFileSync(path.join(ROOT, 'js/workspace/workspace-state.js'), 'utf8');
  const ASAVE = fs.readFileSync(path.join(ROOT, 'js/assistant/core/assistant-template-save.js'), 'utf8');
  await page.addScriptTag({ content: STATE });
  await page.evaluate(() => {
    window.__slotSaved = null;
    window.saveSlotToDB = function (s) { window.__slotSaved = s; return Promise.resolve(true); };
    window.saveToGallery = function () {};
  });
  await page.addScriptTag({ content: ASAVE });
  // I1: 잇비 저장 → 슬롯에 caption + editedDataUrl 반영
  await page.evaluate(() => window.saveAssistantTemplateResult('data:image/png;base64,AAAA', { caption: '잇비가 만든 캡션 #네일', label: '잇비 결과' }));
  await page.waitForFunction(() => window.__slotSaved !== null);
  const saved = await page.evaluate(() => window.__slotSaved);
  check('I1 잇비 저장 슬롯에 캡션 전달', saved && saved.caption === '잇비가 만든 캡션 #네일', JSON.stringify(saved && saved.caption));
  check('I1b 잇비 결과가 editedDataUrl(편집완료)로 저장', saved && saved.photos && saved.photos[0] && !!saved.photos[0].editedDataUrl, JSON.stringify(saved && saved.photos && saved.photos[0]));
  // I2: 잇비 슬롯(캡션·편집 있음, 고객 없음) → deriveStatus=고객연결, nextAction=customer(미리보기 아님)
  const integ = await page.evaluate(() => {
    var slot = { photos: [{ role: 'hero', dataUrl: 'x', editedDataUrl: 'x' }], caption: '잇비 캡션' };
    return { status: window.WorkspaceState.deriveStatus(slot), next: window.WorkspaceState.nextAction(slot).key };
  });
  check('I2 캡션·편집 있는 슬롯 → 다음=고객연결(미리보기 직행 아님)', integ.next === 'customer' && integ.status === 'needs_customer', JSON.stringify(integ));
  // I3: 캡션 없는 잇비 슬롯 → 다음=캡션 생성
  const integ2 = await page.evaluate(() => window.WorkspaceState.nextAction({ photos: [{ role: 'hero', dataUrl: 'x', editedDataUrl: 'x' }], caption: '' }).key);
  check('I3 캡션 없으면 다음=캡션 생성', integ2 === 'caption', 'next=' + integ2);

  check('F1 콘솔/페이지 런타임 에러 없음', errors.length === 0, errors.slice(0,3).join(' | '));

  await browser.close();

  const pass = results.filter(r => r.pass).length;
  console.log('\n=== 작업실 V2 핫픽스 QA ===');
  results.forEach(r => console.log((r.pass ? 'PASS' : 'FAIL') + '  ' + r.name + (r.pass ? '' : '   << ' + r.detail)));
  console.log(`\n${pass}/${results.length} PASS`);
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
