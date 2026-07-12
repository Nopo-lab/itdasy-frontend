/* 작업실 V2 — v531 실기기 QA 핫픽스 통합 검증(chromium 헤드리스)
   pair 규칙 / 템플릿 적용·해제 UX / 캡션 캐러셀 스와이프 / 캡션 payload·dedup /
   해시태그 분리 편집 / 뒤로가기 / 유형별 기본 템플릿.
   localStorage(기본 템플릿) 때문에 file:// 로 로드. 실행: node scripts/wsv2-v531-qa.js */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const FLOW = rd('js/workspace/workspace-v2-flow.js');
const HOME = rd('js/workspace/workspace-v2-home.js');
const STATE = rd('js/workspace/workspace-state.js');
const CAP = rd('app-caption.js');
const CSS = rd('css/workspace-v2-flow.css');
const CSS2 = rd('css/workspace-v2.css');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF8FAGW2BPHFsbpRAAAAAElFTkSuQmCC';

const PAGE = `<!doctype html><html><head><meta charset=utf-8><style>${CSS2}${CSS}</style></head><body><div id="homeRoot"></div><script>
 window._uid=()=> 'id_'+Math.random().toString(36).slice(2); window.uid=window._uid; window.__t=[]; window.showToast=m=>window.__t.push(m); window.confirm=()=>true;
 window.renderScenarioSelector=(c,cb)=>{window.__scb=cb;c.innerHTML='';};
 window.PhotoEditorTemplateThumb={make:(tpl)=>'${PNG}#'+(tpl&&tpl.id)};
 window.__copied=null;
 window.WorkspaceAdapter={
   applyWorkspaceCorrections:o=>Promise.resolve({ok:true,dataUrl:o.src}),
   applyWorkspaceTemplate:o=>{window.__n=(window.__n||0)+1;return Promise.resolve({ok:true,dataUrl:'${PNG}'});},
   generateCaption:o=>{window.__g=JSON.parse(JSON.stringify(o));return Promise.resolve({ok:true,caption:'오늘의 시술 본문입니다.',hashtags:['#레이어드컷','#강남미용실']});},
   saveItem:s=>{window.__saved=JSON.parse(JSON.stringify(s));return Promise.resolve({ok:true});},
   copyText:t=>{window.__copied=t;}, instagram:()=>({connected:false}), instagramProfile:()=>({connected:false}), recentCustomers:()=>Promise.resolve([]), openPriceList:()=>{},
 };
 window.Customer={search:()=>[],list:()=>Promise.resolve([])};
</script><script>${STATE}</script><script>${FLOW}</script><script>${HOME}</script></body></html>`;

const results = [];
const ck = (name, cond, detail) => results.push({ name, pass: !!cond, detail: detail || '' });

(async () => {
  fs.writeFileSync(path.join(ROOT, 'output/_v531qa.html'), PAGE);
  const browser = await chromium.launch();
  const pg = await browser.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e)));
  pg.on('console', m => { if (m.type() === 'error' && !/INVALID_URL|net::ERR/.test(m.text())) errs.push(m.text()); });
  await pg.goto('file://' + path.join(ROOT, 'output/_v531qa.html'), { waitUntil: 'load' });
  await pg.evaluate(() => { try { localStorage.clear(); } catch (e) { void e; } });

  const U = '#wsv2Flow [data-fs="upload"]';
  const T = '#wsv2Flow [data-ed-tpl]';
  const C = '#wsv2Flow [data-fs="caption"]';
  const six = () => ({ id: 'six', workspaceContext: { templatePurpose: 'before_after', type: 'before_after' }, photos: [0, 1, 2, 3, 4, 5].map(i => ({ id: (i % 2 ? 'a' : 'b') + i, dataUrl: PNG, role: i % 2 ? 'after' : 'before' })) });

  // ── 1. Pair 규칙 (전/후/전/후/후/전 = 3, 라벨 1~3, 타일 DOM 보존) ──
  await pg.evaluate(png => window.WorkspaceFlow.open({ startScreen: 'upload', cat: 'ba', slot: { id: 's', photos: [0, 1, 2, 3, 4, 5].map(i => ({ id: 'p' + i, dataUrl: png, role: 'hero' })) } }), PNG);
  await pg.evaluate(u => document.querySelectorAll(u + ' [data-fl-tile]').forEach((t, i) => { t.__m = 'm' + i; }), U);
  for (const [i, role] of [[0, 'before'], [1, 'after'], [2, 'before'], [3, 'after'], [4, 'after'], [5, 'before']]) await pg.click(`${U} [data-fl-setrole="${i}:${role}"]`);
  await pg.waitForTimeout(60);
  ck('1 전/후/전/후/후/전 → Pair 3', (await pg.$$eval(`${U} .up-pair:not(.up-pair--left)`, e => e.length)) === 3);
  ck('1b Pair 라벨 1~3만', JSON.stringify(await pg.$$eval(`${U} .up-pair__n`, e => e.map(x => x.textContent))) === '["Pair 1","Pair 2","Pair 3"]');
  ck('1c 역할 탭 시 타일 DOM 보존(렉 회피)', (await pg.evaluate(u => { let ok = 0; document.querySelectorAll(u + ' [data-fl-tile]').forEach((t, i) => { if (t.__m === 'm' + i) ok++; }); return ok; }, U)) === 6);

  // ── 2. 템플릿 적용/해제 UX (적용 전 원본 / 적용 후 결과물 3 / 해제 후 원본) ──
  await pg.evaluate(s => window.WorkspaceFlow.open({ startScreen: 'edit', cat: 'ba', slot: s }), six());
  ck('2 적용 전 applied 배너 없음', !(await pg.$(T + ' .tpl-applied')));
  await pg.evaluate(() => window.WorkspaceFlow.command({ type: 'template', key: 'ba' }));
  await pg.waitForTimeout(400);
  ck('2b 적용 배너 결과물 3장', /전후 템플릿 적용됨 · 결과물 3장/.test(await pg.$eval(T + ' .tpl-applied__t', e => e.textContent).catch(() => '')));
  ck('2c 결과물 스트립 3장(Pair N 결과)', (await pg.$$eval(T + ' .tpl-result', e => e.length)) === 3);
  ck('2d 해제 버튼 문구', (await pg.$eval(T + ' .tpl-applied__release', e => e.textContent.trim()).catch(() => '')) === '템플릿 해제하기');
  await pg.click(T + ' .tpl-applied__release'); await pg.waitForTimeout(80);
  ck('2e 해제 후 배너 없음(원본 복구)', !(await pg.$(T + ' .tpl-applied')));

  // ── 3. 캡션 캐러셀 scroll-snap 스와이프 ──
  await pg.evaluate(s => window.WorkspaceFlow.open({ startScreen: 'edit', cat: 'ba', slot: s }), six());
  await pg.evaluate(() => window.WorkspaceFlow.command({ type: 'template', key: 'ba' })); await pg.waitForTimeout(350);
  await pg.evaluate(() => window.WorkspaceFlow.command({ type: 'goto', screen: 'caption' })); await pg.waitForTimeout(80);
  ck('3 캐러셀 scroll-snap track', !!(await pg.$(C + ' [data-fl-cartrack]')));
  ck('3b 슬라이드 3 + dot 3', (await pg.$$eval(C + ' [data-fl-carslide]', e => e.length)) === 3 && (await pg.$$eval(C + ' [data-fl-cardot]', e => e.length)) === 3);
  ck('3c 화살표 제거(스와이프 전용)', (await pg.$$eval(C + ' .cap-car__nav', e => e.length)) === 0);

  // ── 4. 캡션 UI 배치 + payload(키워드 최우선·다른 시술명 금지·구어 정제) ──
  ck('4 상황버튼이 입력칸보다 앞', await pg.evaluate(C => { const sc = document.querySelector(C + ' [data-fl-scenario]'), sv = document.querySelector(C + ' [data-fl-service]'); return !!sc && !!sv && !!(sc.compareDocumentPosition(sv) & Node.DOCUMENT_POSITION_FOLLOWING); }, C));
  await pg.evaluate(C => { document.querySelector(C + ' [data-fl-service]').value = '레이어드컷 27인치'; }, C);
  await pg.evaluate(() => window.__scb({ axes: { situation: '시술 완성' } })); await pg.waitForTimeout(150);
  const g = await pg.evaluate(() => window.__g);
  ck('4b photo_context 키워드 최우선', /시술\/키워드\(최우선 반영\): 레이어드컷 27인치/.test(g.photo_context));
  ck('4c 다른 시술명 추가 금지 명시', /입력하지 않은 다른 시술\/상품명은 새로 만들지 마세요/.test(g.photo_context) && /붙임머리·단발탈출·슬림땋기 등\)은 절대 추가하지 마세요/.test(g.extra_notes));
  ck('4d 구어 의미변환 지시(개오바 얼굴)', /개오바 얼굴.*얼굴 라인이 살아난/.test(g.extra_notes));

  // ── 5. 해시태그 분리 편집 → 저장/복사 반영 ──
  ck('5 본문/해시태그 분리(편집칸)', (await pg.$(C + ' [data-fl-capbody]')) && (await pg.$(C + ' [data-fl-caphashedit]')));
  await pg.evaluate(C => { document.querySelector(C + ' [data-fl-caphashedit]').value = '#내추럴펌 #얼굴라인'; }, C);
  await pg.evaluate(() => window.WorkspaceFlow.command({ type: 'goto', screen: 'preview' })); await pg.waitForTimeout(80);
  ck('5b 편집 해시태그 미리보기 반영', /#내추럴펌/.test(await pg.$eval('#wsv2Flow [data-fs="preview"] .ig-hash', e => e.textContent).catch(() => '')));
  await pg.evaluate(() => window.WorkspaceFlow.command({ type: 'save' })); await pg.waitForTimeout(60);
  ck('5c 저장 slot.hashtags 편집분', /#내추럴펌/.test((await pg.evaluate(() => window.__saved)).hashtags || ''));

  // ── 6. 뒤로가기 (캡션 결과 → 캡션 입력, 편집 아님) ──
  await pg.evaluate(s => window.WorkspaceFlow.open({ startScreen: 'upload', cat: 'ba', slot: s }), six());
  await pg.evaluate(() => window.WorkspaceFlow.command({ type: 'goto', screen: 'edit' }));
  await pg.evaluate(() => window.WorkspaceFlow.command({ type: 'template', key: 'ba' })); await pg.waitForTimeout(350);
  await pg.evaluate(() => window.WorkspaceFlow.command({ type: 'goto', screen: 'caption' })); await pg.waitForTimeout(40);
  await pg.evaluate(() => window.WorkspaceFlow.command({ type: 'caption', service: '레이어드컷' })); await pg.waitForTimeout(100);
  const isResult = () => pg.evaluate(() => !!document.querySelector('#wsv2Flow [data-fs="caption"] [data-fl-capbody]'));
  const isInput = () => pg.evaluate(() => !!document.querySelector('#wsv2Flow [data-fs="caption"] [data-fl-service]'));
  ck('6 캡션 결과 화면', await isResult());
  await pg.evaluate(() => window.dispatchEvent(new PopStateEvent('popstate'))); await pg.waitForTimeout(80);
  ck('6b 결과→back→캡션 입력(편집 X)', (await isInput()) && !(await isResult()));

  // ── 7. 유형별 기본 템플릿 설정/적용 + 홈 카드 preview ──
  await pg.evaluate(s => window.WorkspaceFlow.open({ startScreen: 'edit', cat: 'ba', slot: s }), six());
  await pg.evaluate(T => { const e = document.querySelector(T + ' [data-fl-setdefault="ba"]'); if (e) e.click(); }, T); await pg.waitForTimeout(60);
  ck('7 기본 템플릿 localStorage 저장', (await pg.evaluate(() => { try { return localStorage.getItem('itdasy:wsv2_default_tpl_ba'); } catch (e) { return null; } })) === 'wm-ba-feed');
  ck('7b 기본 배지', (await pg.$$eval(T + ' .tpl-defbadge', e => e.length)) > 0);
  await pg.evaluate(() => window.WorkspaceV2 && window.WorkspaceV2.render(document.getElementById('homeRoot'), { slots: [] })); await pg.waitForTimeout(60);
  ck('7c 홈 카드 업로드/예시 img 미사용', (await pg.$$eval('#homeRoot .wsv2-cat img', e => e.length).catch(() => 0)) === 0);
  ck('7d 홈 카드 = 템플릿 preview(background-image)', (await pg.$$eval('#homeRoot .wsv2-cat__thumb', e => e.map(x => x.getAttribute('style') || ''))).some(s => /background-image:url\(data:/.test(s)));

  ck('T console/runtime error 0', errs.length === 0, JSON.stringify(errs.slice(0, 5)));

  await browser.close();
  const pass = results.filter(x => x.pass).length;
  console.log(`\n작업실 v531 QA: ${pass}/${results.length} PASS`);
  results.forEach(x => console.log((x.pass ? '  PASS ' : '  FAIL ') + x.name + (x.pass ? '' : ' :: ' + x.detail)));
  process.exit(pass === results.length ? 0 : 1);
})();
