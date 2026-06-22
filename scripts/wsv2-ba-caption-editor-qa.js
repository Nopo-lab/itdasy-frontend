/* 작업실 V2 전후/캡션/편집 회귀 QA (v528) — 실제 chromium 에서 workspace-v2-flow.js 구동.
   인증 우회: 슬롯(사진 포함)을 직접 주입해 화면 렌더 후 동작 검증.
   커버: 이슈1(페어링 표시)·2(템플릿 출력 분리)·3(썸네일 전환)·4(실템플릿 썸네일)·5(배지)·6(캡션 dedupe)·7(키워드)·9(마스크 워밍업). */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const FLOW = fs.readFileSync(path.join(ROOT, 'js/workspace/workspace-v2-flow.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'css/workspace-v2-flow.css'), 'utf8');
const CAP = fs.readFileSync(path.join(ROOT, 'app-caption.js'), 'utf8');
// 원본/합성본 구분용 — PNG(원본) vs COMPOSITE(전후 합성 결과 stub)
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF8FAGW2BPHFsbpRAAAAAElFTkSuQmCC';
const COMPOSITE = 'data:image/png;base64,COMPOSITEAAA';
const TPLTHUMB = 'data:image/png;base64,TPLTHUMBAAA';

// app-caption.js 의 순수함수 _dedupeCaptionText 만 추출(외부 의존 없음)해 단위 검증.
const DEDUPE_SRC = (CAP.match(/function _dedupeCaptionText[\s\S]*?\n}/) || [])[0];

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head>
<body>
<script>
  window._uid = function(){ return 'id_' + Math.random().toString(36).slice(2); };
  window.__toasts = []; window.showToast = function(m){ window.__toasts.push(m); };
  window.confirm = function(){ return true; };
  window.__warmCalls = [];
  window.WorkspaceAdapter = {
    applyWorkspaceTemplate: function(opts){ window.__lastTpl = opts; return Promise.resolve({ ok:true, dataUrl: '${COMPOSITE}', template: opts.template }); },
    applyWorkspaceCorrections: function(opts){ return Promise.resolve({ ok:true, dataUrl: opts.src }); },
    applyWorkspaceBgAction: function(opts){ return Promise.resolve({ ok:true, dataUrl: opts.src }); },
    generateCaption: function(opts){ window.__lastGen = opts; return Promise.resolve({ ok:true, caption:'생성 본문 ' + (opts.service||''), hashtags:['#tag'], caption_template:'' }); },
    warmMasks: function(src){ window.__warmCalls.push(src); return Promise.resolve(true); },
    saveItem: function(slot){ window.__lastSave = slot; return Promise.resolve({ ok:true }); },
    instagram: function(){ return { connected:false }; },
    instagramProfile: function(){ return { connected:false }; },
    recentCustomers: function(){ return Promise.resolve([]); },
  };
  // [이슈4] 실템플릿 썸네일 생성기 stub — 호출되면 TPLTHUMB 반환(카드가 이걸 쓰는지 검증).
  window.PhotoEditorTemplateThumb = { make: function(tpl, opts){ window.__thumbMade = (window.__thumbMade||[]).concat(tpl.id); return '${TPLTHUMB}'; } };
  window.renderScenarioSelector = function(container, cb){ window.__scenarioCb = cb; container.innerHTML = '<div class="stub"></div>'; };
  window.Customer = { search: function(){ return []; }, list: function(){ return Promise.resolve([]); } };
  window.ItdasySourceImage = { resolve: function(){ return null; } };
</script>
<script>${FLOW}</script>
${DEDUPE_SRC ? '<script>window.__dedupe = ' + DEDUPE_SRC.replace('function _dedupeCaptionText', 'function') + '</script>' : ''}
</body></html>`;

const results = [];
function check(name, cond, detail) { results.push({ name, pass: !!cond, detail: detail || '' }); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console:' + m.text()); });
  await page.setContent(PAGE, { waitUntil: 'load' });

  // ── 이슈1: 전후 페어링 표시 (전/전/후 → Pair 1 + 남은 전사진 "후 부족") ──
  await page.evaluate((png) => {
    window.WorkspaceFlow.open({ startScreen:'upload', slot:{ id:'u1', photos:[
      { id:'p1', dataUrl: png, role:'before', selected:true, selSeq:1, roleManual:true },
      { id:'p2', dataUrl: png, role:'before', selected:true, selSeq:2, roleManual:true },
      { id:'p3', dataUrl: png, role:'after',  selected:true, selSeq:3, roleManual:true } ] } });
  }, PNG);
  const pairCount = await page.$$eval('#wsv2Flow [data-fs="upload"] .up-pair:not(.up-pair--left)', e => e.length);
  const leftNeed = await page.$eval('#wsv2Flow [data-fs="upload"] .up-pair--left .up-pair__need', el => el.textContent).catch(() => '');
  const pairHead = await page.$eval('#wsv2Flow [data-fs="upload"] .up-pairs__head', el => el.textContent).catch(() => '');
  check('이슈1 전/전/후 → Pair 1쌍 표시', pairCount === 1, 'pairs=' + pairCount);
  check('이슈1 남은 전사진 "후 사진 부족" 안내', /후 사진/.test(leftNeed), 'need=' + leftNeed);
  check('이슈1 페어 헤드 "전후 1쌍" 안내', /1쌍/.test(pairHead), 'head=' + pairHead);

  // ── 이슈4 + 이슈2 + 이슈11: 편집화면 템플릿 적용 ──
  await page.evaluate((png) => {
    window.WorkspaceFlow.open({ startScreen:'edit', slot:{ id:'e1', photos:[
      { id:'b1', dataUrl: png, role:'before', selected:true, selSeq:1 },
      { id:'a1', dataUrl: png, role:'after',  selected:true, selSeq:2 } ] } });
  }, PNG);
  // 이슈4: 템플릿 카드 배경 = 실템플릿 썸네일(TPLTHUMB), 업로드 사진(PNG) 아님
  const cardBg = await page.$eval('#wsv2Flow [data-fs="edit"] [data-fl-tpl]', el => el.getAttribute('style') || '');
  check('이슈4 템플릿 카드=실템플릿 썸네일(make 사용)', cardBg.indexOf('TPLTHUMB') >= 0, 'bg=' + cardBg.slice(0, 60));
  check('이슈4 템플릿 카드에 업로드 사진 안 섞임', cardBg.indexOf('iVBORw0') < 0, 'bg=' + cardBg.slice(0, 60));
  const thumbMade = await page.evaluate(() => window.__thumbMade || []);
  check('이슈4 PhotoEditorTemplateThumb.make 호출됨', thumbMade.length >= 1, 'made=' + JSON.stringify(thumbMade));

  // 전후 템플릿 카드(data-fl-tpl="ba") 클릭 → 적용
  await page.click('#wsv2Flow [data-fs="edit"] [data-fl-tpl="ba"]');
  await page.waitForFunction(() => !!window.__lastTpl, { timeout: 2000 });
  await sleep(60);
  // 이슈2: 편집 상단 스위처 썸네일은 원본(PNG)만 — 합성본(COMPOSITE)으로 오염 안 됨
  const switcherBgs = await page.$$eval('#wsv2Flow [data-fs="edit"] [data-fl-editsel]', els => els.map(e => e.getAttribute('style') || ''));
  const polluted = switcherBgs.some(s => s.indexOf('COMPOSITE') >= 0);
  check('이슈2 적용 후 편집 스위처=원본 유지(합성본 오염 X)', !polluted && switcherBgs.length === 2, 'bgs=' + JSON.stringify(switcherBgs.map(s => s.slice(0, 40))));
  // 이슈11: 적용 배너 + 해제 버튼
  const banner = await page.$eval('#wsv2Flow [data-fs="edit"] .tpl-applied__t', el => el.textContent).catch(() => '');
  const hasRelease = await page.$$eval('#wsv2Flow [data-fs="edit"] [data-fl="tplrelease"]', e => e.length);
  check('이슈11 적용됨 배너 표시(Pair 정보 포함)', /적용됨/.test(banner) && /Pair/.test(banner), 'banner=' + banner);
  check('이슈11 해제 버튼 존재', hasRelease === 1, 'release=' + hasRelease);
  // 이슈11 해제 → 배너/적용 사라짐
  await page.click('#wsv2Flow [data-fs="edit"] [data-fl="tplrelease"]');
  await sleep(40);
  const bannerGone = await page.$$eval('#wsv2Flow [data-fs="edit"] .tpl-applied', e => e.length);
  const cardOn = await page.$$eval('#wsv2Flow [data-fs="edit"] [data-fl-tpl].on', e => e.length);
  check('이슈11 해제 → 적용 배너 사라짐', bannerGone === 0, 'banner=' + bannerGone);
  check('이슈11 해제 → 카드 선택(on) 해제', cardOn === 0, 'on=' + cardOn);

  // ── 이슈3: 썸네일 전환 = 부분 갱신(사진 DOM 유지) + 즉시 .on 토글 ──
  await page.evaluate((png) => {
    window.WorkspaceFlow.open({ startScreen:'edit', slot:{ id:'e2', photos:[
      { id:'b2', dataUrl: png, role:'before', selected:true, selSeq:1 },
      { id:'a2', dataUrl: png, role:'after',  selected:true, selSeq:2 } ] } });
  }, PNG);
  await page.evaluate(() => { var p = document.querySelector('#wsv2Flow [data-fs="edit"] [data-fl-edphoto]'); if (p) p.setAttribute('data-qa-mark', '1'); });
  // 두 번째(후) 썸네일 클릭 → 즉시 .on 토글(동기)
  await page.click('#wsv2Flow [data-fs="edit"] [data-fl-editsel="1"]');
  const onImmediate = await page.$eval('#wsv2Flow [data-fs="edit"] [data-fl-editsel="1"]', el => el.classList.contains('on'));
  check('이슈3 썸네일 클릭 즉시 선택 테두리(.on) 반영', onImmediate === true, 'on=' + onImmediate);
  await sleep(80);
  const markKept = await page.$eval('#wsv2Flow [data-fs="edit"] [data-fl-edphoto]', el => el.getAttribute('data-qa-mark'));
  check('이슈3 전환=부분 갱신(사진 DOM 유지, 전체 재렌더 X)', markKept === '1', 'mark=' + markKept);

  // ── 이슈9: 편집 진입 시 warmMasks 호출(마스크 사전 워밍업) ──
  const warmCalled = await page.evaluate(() => (window.__warmCalls || []).length);
  check('이슈9 편집 진입 시 warmMasks 호출(마스크 워밍업)', warmCalled >= 1, 'calls=' + warmCalled);

  // ── 이슈5: 스토리 배지 텍스트 정확("스토리") + 가독 폰트(>=11px) ──
  await page.evaluate(() => { window.WorkspaceFlow.command && null; });
  const storyBadge = await page.$$eval('#wsv2Flow [data-fs="edit"] .tpl-badge', els => els.map(e => e.textContent.trim()));
  const badgeFont = await page.$eval('#wsv2Flow [data-fs="edit"] .tpl-badge', el => parseFloat(getComputedStyle(el).fontSize));
  check('이슈5 스토리 배지 텍스트 정확("스토리")', storyBadge.indexOf('스토리') >= 0, JSON.stringify(storyBadge));
  check('이슈5 배지 폰트 가독(>=11px)', badgeFont >= 11, 'font=' + badgeFont);

  // ── 이슈7: 캡션 생성 payload 키워드 반영 ──
  await page.evaluate((png) => {
    window.WorkspaceFlow.open({ startScreen:'caption', slot:{ id:'c1', photos:[{ id:'p1', dataUrl: png, role:'hero', selected:true, selSeq:1 }] } });
  }, PNG);
  await page.fill('#wsv2Flow [data-fs="caption"] [data-fl-service]', '레이어드컷 27인치');
  await page.evaluate(() => window.__scenarioCb && window.__scenarioCb({ axes: { situation:'완성', customer:'단골', photo:'클로즈업' }, special_context:'' }));
  await page.waitForFunction(() => !!window.__lastGen, { timeout: 2000 });
  const gen = await page.evaluate(() => window.__lastGen);
  check('이슈7 payload.service = 입력 키워드 verbatim', gen && gen.service === '레이어드컷 27인치', 'svc=' + (gen && gen.service));
  check('이슈7 photo_context 맨 앞에 키워드 명시', gen && /^시술\/키워드: 레이어드컷 27인치/.test(gen.photo_context || ''), 'ctx=' + (gen && gen.photo_context));

  // ── 이슈6: 캡션 dedupe(문단/근사중복/문장) ──
  if (DEDUPE_SRC) {
    const dd = await page.evaluate(() => {
      const f = window.__dedupe;
      return {
        para: f('완성했어요.\n\n완성했어요.'),                          // 동일 문단 2회
        near: f('오늘 완성했어요!\n\n오늘 완성했어요 😊'),              // 근사 중복(이모지/부호)
        sent: f('레이어드컷 완성. 만족하셨어요. 레이어드컷 완성.'),      // 같은 문장 반복
        single: f('첫 문단입니다\n첫 문단입니다'),                       // 단일 개행 중복
      };
    });
    check('이슈6 동일 문단 중복 제거', (dd.para.match(/완성했어요/g) || []).length === 1, 'r=' + JSON.stringify(dd.para));
    check('이슈6 근사 중복(이모지/부호) 제거', (dd.near.match(/완성했어요/g) || []).length === 1, 'r=' + JSON.stringify(dd.near));
    check('이슈6 문장 단위 중복 제거', (dd.sent.match(/레이어드컷 완성/g) || []).length === 1, 'r=' + JSON.stringify(dd.sent));
    check('이슈6 단일 개행 중복 제거', (dd.single.match(/첫 문단입니다/g) || []).length === 1, 'r=' + JSON.stringify(dd.single));
  } else {
    check('이슈6 dedupe 함수 추출', false, '_dedupeCaptionText 추출 실패');
  }

  check('콘솔/런타임 에러 없음', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  const pass = results.filter(r => r.pass).length;
  console.log('\n=== 작업실 V2 전후/캡션/편집 회귀 QA (v528) ===');
  results.forEach(r => console.log((r.pass ? 'PASS' : 'FAIL') + '  ' + r.name + (r.pass ? '' : '   << ' + r.detail)));
  console.log(`\n${pass}/${results.length} PASS`);
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
