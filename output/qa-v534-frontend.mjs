// v534 QA — 캡션 payload variation + 본문/해시태그 분리 + 템플릿 수정 시트(Pair별) + 썸네일 샘플
import fs from 'fs'; import path from 'path'; import { chromium } from 'playwright';
const ROOT = path.resolve('.');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const CSS = rd('css/workspace-v2-flow.css');
const STACK = [
  'js/photo-editor/template-fit-text.js', 'js/photo-editor/template-slots.js',
  'js/photo-editor/template-pack-beauty-data.js', 'js/photo-editor/template-market-data.js',
  'js/photo-editor/template-renderer-beauty-pack.js', 'js/photo-editor/template-renderer-beauty-pack-draws.js',
  'js/photo-editor/template-renderer-wm-pack-draws.js', 'js/photo-editor/premium-templates.js',
  'js/photo-editor/template-thumb.js', 'js/workspace/workspace-tpl-edit.js',
  'js/workspace/workspace-v2-home.js', 'js/workspace/workspace-v2-flow.js',
].map(rd).join('\n;\n');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF8FAGW2BPHFsbpRAAAAAElFTkSuQmCC';
const r = []; const ck = (n, c, d) => r.push({ n, p: !!c, d: d || '' });
const b = await chromium.launch();
const HTML = `<!doctype html><html><head><meta charset=utf-8><style>${CSS}</style></head><body><script>
 window._uid=()=>'id_'+Math.random().toString(36).slice(2); window.uid=window._uid; window.showToast=(m)=>{window.__toast=m;}; window.confirm=()=>true;
 window.renderScenarioSelector=(c,cb)=>{c.innerHTML='';}; window.__ai=0;
 window.WorkspaceAdapter={
   applyWorkspaceTemplate:o=>{window.__ai++;return Promise.resolve({ok:true,dataUrl:'data:img/'+window.__ai});},
   generateCaption:o=>{window.__g=JSON.parse(JSON.stringify(o));return Promise.resolve({ok:true,caption:'생성된 글',hashtags:['#가','#나']});},
   instagram:()=>({connected:false}), instagramProfile:()=>({connected:false}), recentCustomers:()=>Promise.resolve([]), saveItem:()=>Promise.resolve({ok:true}), setCaptionTemplate:()=>Promise.resolve({ok:true})
 };
 window.Customer={search:()=>[],list:()=>Promise.resolve([])}; window.WorkspaceV2={refresh:()=>{}};
</script><script>${STACK}</script></body></html>`;
fs.writeFileSync(path.join(ROOT, 'output/_v534qa.html'), HTML);
const PORT = process.env.QA_PORT || '8094';
const fe = [];
const p = await b.newPage();
p.on('pageerror', e => fe.push(String(e)));
p.on('console', m => { if (m.type() === 'error' && !/INVALID_URL|net::|Failed to load/.test(m.text())) fe.push(m.text()); });
await p.goto('http://localhost:' + PORT + '/output/_v534qa.html', { waitUntil: 'load' });

const six = { id: 'six', workspaceContext: { templatePurpose: 'before_after', type: 'before_after' },
  photos: [0,1,2,3,4,5].map(i => ({ id: (i%2?'a':'b')+i, dataUrl: PNG, role: i%2?'after':'before' })) };
await p.evaluate(s => window.WorkspaceFlow.open({ startScreen: 'edit', cat: 'ba', slot: s }), six);

// ── 캡션 payload variation (caption_intent/variation_seed/treatment_keyword) ──
await p.evaluate(() => window.WorkspaceFlow.command({ type: 'caption', service: '레이어드 27인치 붙임머리' }));
await p.waitForTimeout(150);
let g0 = await p.evaluate(() => window.__g);
ck('C-1 최초 생성 caption_intent=generate', g0.caption_intent === 'generate', g0.caption_intent);
ck('C-2 treatment_keyword 전달', g0.treatment_keyword === '레이어드 27인치 붙임머리', g0.treatment_keyword);
ck('C-3 strict_user_context=true', g0.strict_user_context === true, String(g0.strict_user_context));
ck('C-4 variation_seed 존재', typeof g0.variation_seed === 'string' && g0.variation_seed.length > 0, g0.variation_seed);
ck('C-5 content_type 전달(before_after)', g0.content_type === 'before_after', g0.content_type);
await p.evaluate(() => { var v = document.querySelector('#wsv2Flow [data-fl-var="insta"]'); if (v) v.click(); });
await p.waitForTimeout(150);
let gi = await p.evaluate(() => window.__g);
ck('C-6 인스타 톤 → caption_intent=instagram + previous_caption', gi.caption_intent === 'instagram' && !!gi.previous_caption, gi.caption_intent + '/' + !!gi.previous_caption);
await p.evaluate(() => { var v = document.querySelector('#wsv2Flow [data-fl-var="long"]'); if (v) v.click(); });
await p.waitForTimeout(150);
let gl = await p.evaluate(() => window.__g);
ck('C-7 더 길게 → caption_intent=longer', gl.caption_intent === 'longer', gl.caption_intent);
await p.evaluate(() => { var v = document.querySelector('#wsv2Flow [data-fl-var="regen"]'); if (v) v.click(); });
await p.waitForTimeout(150);
let gr = await p.evaluate(() => window.__g);
ck('C-8 다시 쓰기 → caption_intent=rewrite + 다른 variation_seed', gr.caption_intent === 'rewrite' && gr.variation_seed !== g0.variation_seed, gr.variation_seed);

// ── 템플릿 수정 시트 (Pair별) ──
const openGrid = () => p.evaluate(() => { if (!document.querySelector('#wsv2Flow .tpl-grid2')) { var f = document.querySelector('#wsv2Flow [data-fl-fold="tpl"]'); if (f) f.click(); } });
await openGrid();
await p.evaluate(() => document.querySelector('#wsv2Flow [data-fl-tpl="ba-premium"]').click());
await p.waitForTimeout(450);
// [v541] 작은 스트립 → 큰 캐러셀. 결과 이미지는 캐러셀 슬라이드(.cap-car__img), 수정은 active-pair 버튼.
const imgs0 = () => p.evaluate(() => Array.from(document.querySelectorAll('#wsv2Flow .tpl-car .cap-car__img')).map(e => e.style.backgroundImage));
let A = await imgs0();
ck('T-1 일괄 적용 결과물 3장(캐러셀 슬라이드)', A.length === 3, String(A.length));
ck('T-2 active Pair "템플릿 수정" 버튼 노출', await p.evaluate(() => !!document.querySelector('#wsv2Flow [data-fl="tpledit-active"]')), '');
// Pair 1(첫 active) 수정 시트 오픈
await p.evaluate(() => document.querySelector('#wsv2Flow [data-fl="tpledit-active"]').click());
await p.waitForTimeout(400);
ck('T-3 수정 시트 오픈(.wtpl-card)', await p.evaluate(() => !!document.querySelector('.wtpl-card')), '');
ck('T-4 좌 preview + 우 편집 패널 동시 존재', await p.evaluate(() => !!document.querySelector('.wtpl-preview canvas') && !!document.querySelector('.wtpl-body [data-wtpl-field="service_name"]')), '');
// 시술명/후기/CTA/before 라벨 수정 → preview 즉시 반영(캔버스 dataURL 변화)
const previewUrl = () => p.evaluate(() => { var c = document.querySelector('.wtpl-preview canvas'); return c ? c.toDataURL('image/jpeg', 0.6) : ''; });
let pv0 = await previewUrl();
await p.evaluate(() => { ['service_name', 'review_text', 'cta', 'before_label'].forEach(function (k, i) { var f = document.querySelector('[data-wtpl-field="' + k + '"]'); if (f) { f.value = 'QA' + k + i; f.dispatchEvent(new Event('input', { bubbles: true })); } }); });
await p.waitForTimeout(150);
let pv1 = await previewUrl();
ck('T-5 입력 시 preview 즉시 반영(캔버스 변화)', pv0 !== pv1, '');
ck('T-6 글자수 카운터 갱신', await p.evaluate(() => /\/30/.test(document.querySelector('[data-wtpl-count="service_name"]').textContent)), '');
// 수정 적용 → Pair 1 결과만 갱신
await p.evaluate(() => document.querySelector('[data-wtpl="apply"]').click());
await p.waitForTimeout(300);
ck('T-7 적용 후 시트 닫힘', await p.evaluate(() => !document.querySelector('.wtpl-card')), '');
let B = await imgs0();
ck('T-8 Pair 1 결과물 갱신(실 렌더 dataURL)', B[0] !== A[0] && /data:image\/jpeg/.test(B[0]), B[0].slice(0, 24));
ck('T-9 Pair 2/3 결과물 유지(다른 짝 비영향)', B[1] === A[1] && B[2] === A[2], '');
// 다시 열어 slotValues 유지 + 되돌리기 (active = Pair 1)
await p.evaluate(() => document.querySelector('#wsv2Flow [data-fl="tpledit-active"]').click());
await p.waitForTimeout(300);
let svcKept = await p.evaluate(() => (document.querySelector('[data-wtpl-field="service_name"]') || {}).value || '');
ck('T-10 재오픈 시 수정값 유지(service_name)', /QAservice_name/.test(svcKept), svcKept);
await p.evaluate(() => document.querySelector('[data-wtpl="revert"]').click());
await p.waitForTimeout(150);
let svcReverted = await p.evaluate(() => (document.querySelector('[data-wtpl-field="service_name"]') || {}).value || '');
ck('T-11 "기본 문구로 되돌리기" 동작', !/QAservice_name/.test(svcReverted) && svcReverted.length > 0, svcReverted);
// 취소 → 미반영
await p.evaluate(() => { var f = document.querySelector('[data-wtpl-field="cta"]'); if (f) { f.value = '취소될값'; f.dispatchEvent(new Event('input', { bubbles: true })); } });
await p.evaluate(() => document.querySelector('[data-wtpl="cancel"]').click());
await p.waitForTimeout(200);
ck('T-12 취소 시 닫힘(변경 미저장)', await p.evaluate(() => !document.querySelector('.wtpl-card')), '');

// ── 썸네일 샘플 사진(전후 카드) ──
let thumbs = await p.evaluate(() => { var s = new Set(); document.querySelectorAll('#wsv2Flow .tpl-item[data-fl-tpl] ').forEach(c => { var b = c.style.backgroundImage || ''; if (/data:image/.test(b)) s.add(b); }); return s.size; });
ck('T-13 전후 갤러리 썸네일 dataURL 다수 생성', thumbs >= 6, String(thumbs));

ck('X-1 runtime/console error 0', fe.length === 0, JSON.stringify(fe.slice(0, 4)));
await b.close();
const pass = r.filter(x => x.p).length;
console.log('V534 FRONTEND QA: ' + pass + '/' + r.length + ' PASS');
r.forEach(x => console.log((x.p ? '  PASS ' : '  FAIL ') + x.n + (x.p ? '' : ' :: ' + x.d)));
process.exit(pass === r.length ? 0 : 1);
