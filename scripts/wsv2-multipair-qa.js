/* 작업실 V2 — 다중 전후 pair → 템플릿 적용 → 캡션 캐러셀/payload QA
   실제 브라우저(chromium)에서 workspace-v2-flow.js + app-caption.js 를 구동.
   인증 우회: 슬롯(사진 포함)을 직접 주입하고 WorkspaceAdapter 를 스텁으로 대체.
   실행: node scripts/wsv2-multipair-qa.js   (playwright 필요) */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const FLOW = fs.readFileSync(path.join(ROOT, 'js/workspace/workspace-v2-flow.js'), 'utf8');
const HOME = fs.readFileSync(path.join(ROOT, 'js/workspace/workspace-v2-home.js'), 'utf8');
const CAP = fs.readFileSync(path.join(ROOT, 'app-caption.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'css/workspace-v2-flow.css'), 'utf8');
// 유효한 1x1 PNG dataURL (배경이미지 로드 실패 노이즈 방지)
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF8FAGW2BPHFsbpRAAAAAElFTkSuQmCC';

const FLOWPAGE = `<!doctype html><html><head><meta charset=utf-8><style>${CSS}</style></head><body>
<script>
 window._uid = () => 'id_' + Math.random().toString(36).slice(2); window.uid = window._uid;
 window.showToast = () => {}; window.confirm = () => true;
 window.renderScenarioSelector = (c, cb) => { window.__scenarioCb = cb; c.innerHTML = ''; };
 window.WorkspaceAdapter = {
   applyWorkspaceCorrections: o => Promise.resolve({ ok: true, dataUrl: o.src }),
   applyWorkspaceTemplate: o => { window.__n = (window.__n || 0) + 1; return Promise.resolve({ ok: true, dataUrl: '${PNG}'.replace('==', '=' + window.__n), template: o.template }); },
   generateCaption: o => { window.__lastGen = JSON.parse(JSON.stringify(o)); return Promise.resolve({ ok: true, caption: '본문', hashtags: ['#t'] }); },
   saveItem: s => { window.__lastSave = JSON.parse(JSON.stringify(s)); return Promise.resolve({ ok: true }); },
   instagramProfile: () => ({ connected: false }), recentCustomers: () => Promise.resolve([]),
 };
 window.Customer = { search: () => [], list: () => Promise.resolve([]) }; window.WorkspaceV2 = { refresh: () => {} };
</script><script>${FLOW}</script><script>${HOME}</script></body></html>`;

const CAPPAGE = `<!doctype html><html><head><meta charset=utf-8></head><body><script>
 window.API = ''; window.authHeader = () => ({});
 window.__sentBody = null; window.__resp = { caption: '문단 A.\\n\\n문단 A.\\n\\n문단 B.', hashtags: ['#x', '#x', '#y'] };
 window.fetch = (u, opt) => { window.__sentBody = JSON.parse(opt.body); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(window.__resp) }); };
</script><script>${CAP}</script></body></html>`;

const results = [];
const ck = (name, cond, detail) => results.push({ name, pass: !!cond, detail: detail || '' });

(async () => {
  const browser = await chromium.launch();

  // ── 플로우: 다중 pair → 템플릿 → 캐러셀 → payload ──
  const fp = await browser.newPage();
  const ferr = [];
  fp.on('pageerror', e => ferr.push(String(e)));
  fp.on('console', m => { if (m.type() === 'error' && !/INVALID_URL/.test(m.text())) ferr.push(m.text()); });
  await fp.setContent(FLOWPAGE, { waitUntil: 'load' });

  const six = {
    id: 'six', workspaceContext: { templatePurpose: 'before_after', type: 'before_after' },
    photos: [
      { id: 'b1', dataUrl: PNG, role: 'before' }, { id: 'a1', dataUrl: PNG, role: 'after' },
      { id: 'b2', dataUrl: PNG, role: 'before' }, { id: 'a2', dataUrl: PNG, role: 'after' },
      { id: 'b3', dataUrl: PNG, role: 'before' }, { id: 'a3', dataUrl: PNG, role: 'after' },
    ],
  };
  await fp.evaluate(s => window.WorkspaceFlow.open({ startScreen: 'edit', cat: 'ba', slot: s }), six);

  // Q8: 업로드 사진이 템플릿 카드 썸네일에 섞이지 않음(고정 예시/번들 자산만)
  const tplBgs = await fp.$$eval('#wsv2Flow [data-fl-tpl]', els => els.map(e => e.style.backgroundImage || ''));
  ck('Q8 업로드 사진이 템플릿 썸네일에 미주입', tplBgs.length > 0 && tplBgs.every(bg => !/iVBORw0KGgo/.test(bg)), JSON.stringify(tplBgs.slice(0, 2)));

  await fp.evaluate(() => window.WorkspaceFlow.command({ type: 'template', key: 'ba' }));
  await fp.waitForTimeout(400);
  await fp.evaluate(() => window.WorkspaceFlow.command({ type: 'save' }));
  await fp.waitForTimeout(120);
  let s = await fp.evaluate(() => window.__lastSave);
  ck('Q1 전/후×3 → Pair 3개(어댑터 3회)', (await fp.evaluate(() => window.__n)) === 3);
  ck('Q2 templateOutputs 3개 생성', s.templateOutputs && s.templateOutputs.length === 3, JSON.stringify((s.templateOutputs || []).length));
  ck('Q3 각 output 서로 다른 페어 사진', JSON.stringify(s.templateOutputs.map(o => [o.beforePhotoId, o.afterPhotoId])) === '[["b1","a1"],["b2","a2"],["b3","a3"]]', JSON.stringify(s.templateOutputs.map(o => [o.beforePhotoId, o.afterPhotoId])));
  ck('Q3b templateId 모두 동일', s.templateOutputs.every(o => o.templateId === 'wm-ba-feed'));
  ck('Q9 원본 6장 무오염', s.photos.length === 6 && s.photos.every(p => !/=[123]$/.test(p.dataUrl)));

  // Q4: 해제 → 원본 복구 (새 세션)
  await fp.evaluate(() => { window.__n = 0; });
  await fp.evaluate(s2 => window.WorkspaceFlow.open({ startScreen: 'edit', cat: 'ba', slot: s2 }), six);
  await fp.evaluate(() => window.WorkspaceFlow.command({ type: 'template', key: 'ba' }));
  await fp.waitForTimeout(400);
  await fp.evaluate(() => { const el = document.querySelector('[data-fl="tplrelease"]'); if (el) el.click(); });
  await fp.waitForTimeout(80);
  await fp.evaluate(() => window.WorkspaceFlow.command({ type: 'save' }));
  await fp.waitForTimeout(80);
  let sr = await fp.evaluate(() => window.__lastSave);
  ck('Q4 템플릿 해제 → 결과물 0 + 원본 6장', sr.templateOutputs.length === 0 && sr.photos.length === 6 && sr.templateOutput == null);

  // Q5: 캡션 캐러셀 3개
  await fp.evaluate(() => { window.__n = 0; });
  await fp.evaluate(s3 => window.WorkspaceFlow.open({ startScreen: 'edit', cat: 'ba', slot: s3 }), six);
  await fp.evaluate(() => window.WorkspaceFlow.command({ type: 'template', key: 'ba' }));
  await fp.waitForTimeout(400);
  await fp.evaluate(() => window.WorkspaceFlow.command({ type: 'goto', screen: 'caption' }));
  await fp.waitForTimeout(100);
  const slides = await fp.$$eval('#wsv2Flow [data-fs="caption"] [data-fl-carslide]', e => e.map(x => x.getAttribute('data-fl-carslide')));
  ck('Q5 캡션 상단 캐러셀 3슬라이드', JSON.stringify(slides) === '["pair-0","pair-1","pair-2"]', JSON.stringify(slides));

  // Q6/Q7: caption payload(opts) — extra_notes + templateOutputs 요약
  await fp.evaluate(() => window.WorkspaceFlow.command({ type: 'caption', service: '레이어드컷 27인치' }));
  await fp.waitForTimeout(150);
  let g = await fp.evaluate(() => window.__lastGen);
  ck('Q6 caption payload 에 extra_notes(키워드+정제지시)', /레이어드컷 27인치/.test(g.extra_notes) && /그대로 반복|직역/.test(g.extra_notes), g.extra_notes);
  ck('Q7 caption payload 에 templateOutputs 3개 요약', Array.isArray(g.templateOutputs) && g.templateOutputs.length === 3, JSON.stringify((g.templateOutputs || []).length));
  ck('Q7b photo_context 캐러셀 요약', /전후 결과물 3장/.test(g.photo_context), g.photo_context);

  // ── app-caption: 실제 /persona/generate payload 에 extra_notes 도달 + dedupe ──
  fs.writeFileSync(path.join(ROOT, 'output/_multipair_capqa.html'), CAPPAGE);
  if (!fs.existsSync(path.join(ROOT, 'output'))) fs.mkdirSync(path.join(ROOT, 'output'));
  const cp = await browser.newPage();
  const cerr = [];
  cp.on('pageerror', e => cerr.push(String(e)));
  cp.on('console', m => { if (m.type() === 'error') cerr.push(m.text()); });
  await cp.goto('file://' + path.join(ROOT, 'output/_multipair_capqa.html'), { waitUntil: 'load' });
  await cp.evaluate(() => localStorage.setItem('shop_type', '헤어'));
  const res = await cp.evaluate(async () => window.CaptionEngine.generate({
    photo_context: '시술/키워드: 레이어드컷 27인치 · 전후 결과물 3장(인스타 캐러셀 한 편).',
    service: '레이어드컷 27인치',
    extra_notes: '강조 표현: "개오바 얼굴" — 그대로 반복·직역하지 말고 뷰티샵 인스타 톤으로 자연스럽게 의미만 살려 반영해 주세요.',
  }));
  const body = await cp.evaluate(() => window.__sentBody);
  ck('Q6b 백엔드 payload.extra_notes 도달', !!body.extra_notes && /개오바 얼굴/.test(body.extra_notes), JSON.stringify(body.extra_notes || null));
  ck('Q10 캡션 문단 중복 제거', (res.caption.match(/문단 A/g) || []).length === 1, JSON.stringify(res.caption));
  ck('Q10b 해시태그 중복 제거', new Set(res.hashtags).size === res.hashtags.length);

  ck('Q11 flow console/runtime error 0', ferr.length === 0, JSON.stringify(ferr.slice(0, 4)));
  ck('Q11b caption-load error 0', cerr.length === 0, JSON.stringify(cerr.slice(0, 4)));

  await browser.close();
  const pass = results.filter(x => x.pass).length;
  console.log(`\n작업실 다중pair QA: ${pass}/${results.length} PASS`);
  results.forEach(x => console.log((x.pass ? '  PASS ' : '  FAIL ') + x.name + (x.pass ? '' : ' :: ' + x.detail)));
  process.exit(pass === results.length ? 0 : 1);
})();
