// v533 QA — 전후 에디토리얼 템플릿 5종: 등록/렌더/META/갤러리/Pair별 적용/해제/기본템플릿/편집슬롯
import fs from 'fs'; import path from 'path'; import { chromium } from 'playwright';
const ROOT = path.resolve('.');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const CSS = rd('css/workspace-v2-flow.css');
const STACK = [
  'js/photo-editor/template-fit-text.js', 'js/photo-editor/template-slots.js',
  'js/photo-editor/template-pack-beauty-data.js', 'js/photo-editor/template-market-data.js',
  'js/photo-editor/template-renderer-beauty-pack.js', 'js/photo-editor/template-renderer-beauty-pack-draws.js',
  'js/photo-editor/template-renderer-wm-pack-draws.js', 'js/photo-editor/premium-templates.js',
  'js/photo-editor/template-thumb.js', 'js/workspace/workspace-v2-home.js', 'js/workspace/workspace-v2-flow.js',
].map(rd).join('\n;\n');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF8FAGW2BPHFsbpRAAAAAElFTkSuQmCC';
const NEW = ['bp-ba-premium-infographic', 'bp-ba-luxury-review', 'bp-ba-story-signature', 'bp-ba-classic-poster', 'bp-ba-care-guide'];
const KEYS = ['ba-premium', 'ba-luxury', 'ba-story', 'ba-classic', 'ba-care'];
const r = []; const ck = (n, c, d) => r.push({ n, p: !!c, d: d || '' });

const b = await chromium.launch();
const HTML = `<!doctype html><html><head><meta charset=utf-8><style>${CSS}</style></head><body><script>
 window._uid=()=>'id_'+Math.random().toString(36).slice(2); window.uid=window._uid; window.showToast=()=>{}; window.confirm=()=>true;
 window.renderScenarioSelector=(c,cb)=>{c.innerHTML='';}; window.__ai=0;
 window.WorkspaceAdapter={
   applyWorkspaceTemplate:o=>{window.__ai++;return Promise.resolve({ok:true,dataUrl:'data:img/'+window.__ai});},
   generateCaption:o=>Promise.resolve({ok:true,caption:'x',hashtags:[]}), instagram:()=>({connected:false}),
   instagramProfile:()=>({connected:false}), recentCustomers:()=>Promise.resolve([]), saveItem:()=>Promise.resolve({ok:true}),
   setCaptionTemplate:()=>Promise.resolve({ok:true})
 };
 window.Customer={search:()=>[],list:()=>Promise.resolve([])}; window.WorkspaceV2={refresh:()=>{}};
</script><script>${STACK}</script>
<script>
 // 렌더 헬퍼 — 데이터 기반 1080x1350 합성(편집 슬롯 override 지원)
 window.__render=function(id, override){
   var MD=window.PhotoEditorTemplateMarketData, found=MD.lookupById(id);
   var sv=window.PhotoEditorTemplateSlots.getDefaultValues(id, found, {shopName:'잇데이 청담점'});
   if(override) for(var k in override) sv[k]=override[k];
   var pal=found.palette;
   var data={type:'beautyPack',kicker:found.prefillText,palette:pal,head:sv.headline||found.prefillText,sub:sv.subtitle,
     shop:sv.shop_name,accent:pal&&pal.accent,cta:sv.cta,customer:sv.customer_label,serviceName:sv.service_name,
     review:sv.review_text,beforeLabel:sv.before_label,afterLabel:sv.after_label};
   var cv=document.createElement('canvas');cv.width=1080;cv.height=1350;var ctx=cv.getContext('2d');
   window.PhotoEditorBeautyPack.draw(ctx,1080,1350,null,{id:id,slotValues:sv,imageSlots:{}},data);
   return cv.toDataURL('image/png');
 };
 window.__renderHook=function(id){
   var cv=document.createElement('canvas');cv.width=1080;cv.height=1350;var ctx=cv.getContext('2d');
   return window.PhotoEditorPremiumTemplates.renderHook(ctx,1080,1350,{tplV2:{id:id,slotValues:{},imageSlots:{}}});
 };
</script></body></html>`;
const fe = [];
const p = await b.newPage();
p.on('pageerror', e => fe.push(String(e)));
p.on('console', m => { if (m.type() === 'error' && !/INVALID_URL|net::|Failed to load/.test(m.text())) fe.push(m.text()); });
// localStorage(기본 템플릿) 검증 위해 http origin 으로 서빙(about:blank 은 localStorage 차단).
fs.writeFileSync(path.join(ROOT, 'output/_ba_qa.html'), HTML);
const PORT = process.env.QA_PORT || '8096';
await p.goto('http://localhost:' + PORT + '/output/_ba_qa.html', { waitUntil: 'load' });

// ── 등록 / 렌더 / META ──
for (let i = 0; i < NEW.length; i++) {
  const id = NEW[i];
  const has = await p.evaluate(x => !!(window.PhotoEditorBeautyPack && window.PhotoEditorBeautyPack.has(x)), id);
  const v3 = await p.evaluate(x => !!(window.PhotoEditorTemplateMarketData.v3ById(x)), id);
  const hook = await p.evaluate(x => window.__renderHook(x), id);
  ck('R-' + (i + 1) + ' ' + id + ' 등록(has/v3ById/renderHook)', has && v3 && hook === true, `has=${has} v3=${v3} hook=${hook}`);
}
// 렌더 결과 비어있지 않음 + 5종 서로 다름(pixel 다름)
const urls = [];
for (const id of NEW) urls.push(await p.evaluate(x => window.__render(x), id));
ck('R-6 5종 렌더 비어있지 않음', urls.every(u => u && u.length > 5000), urls.map(u => (u || '').length).join(','));
ck('R-7 5종 서로 다른 디자인(고유 출력)', new Set(urls).size === 5, '고유=' + new Set(urls).size);
// 편집 슬롯 반영 — service_name 바꾸면 출력 달라짐
const def = await p.evaluate(() => window.__render('bp-ba-premium-infographic'));
const mod = await p.evaluate(() => window.__render('bp-ba-premium-infographic', { service_name: 'QA시술명_XYZ_확인', review_text: 'QA후기문구_확인용_텍스트', cta: 'QA버튼확인' }));
ck('R-8 편집 슬롯(시술명/후기/CTA) 결과 반영', def !== mod, def === mod ? '동일(반영안됨)' : '다름');

// ── 워크스페이스 갤러리 + Pair별 적용 ──
const six = { id: 'six', workspaceContext: { templatePurpose: 'before_after', type: 'before_after' },
  photos: [0,1,2,3,4,5].map(i => ({ id: (i%2?'a':'b')+i, dataUrl: PNG, role: i%2?'after':'before' })) };
await p.evaluate(s => window.WorkspaceFlow.open({ startScreen: 'edit', cat: 'ba', slot: s }), six);
const openGrid = () => p.evaluate(() => { if (!document.querySelector('#wsv2Flow .tpl-grid2')) { var f = document.querySelector('#wsv2Flow [data-fl-fold="tpl"]'); if (f) f.click(); } });
await openGrid();
await p.waitForTimeout(120);
const gal = await p.evaluate((keys) => {
  var cards = Array.from(document.querySelectorAll('#wsv2Flow .tpl-item[data-fl-tpl]'));
  var present = keys.filter(k => cards.some(c => c.getAttribute('data-fl-tpl') === k));
  var thumbs = cards.map(c => (c.style.backgroundImage || '')).filter(b => /data:image/.test(b));
  return { count: cards.length, present: present, thumbN: thumbs.length, uniqThumb: new Set(thumbs).size };
}, KEYS);
ck('G-1 전후 갤러리 6종 노출(기존1+신규5)', gal.count >= 6, '카드=' + gal.count);
ck('G-2 신규 5 key 모두 카드 존재', gal.present.length === 5, '존재=' + gal.present.join(','));
ck('G-3 카드 썸네일 dataURL 생성', gal.thumbN >= 6, '썸네일=' + gal.thumbN);
ck('G-4 썸네일 서로 다름(회색/동일반복 아님)', gal.uniqThumb === gal.thumbN && gal.uniqThumb >= 6, '고유=' + gal.uniqThumb + '/' + gal.thumbN);

// Pair1=premium(일괄) → pair-1을 luxury, pair-2를 classic 으로 개별 변경
await p.evaluate(() => document.querySelector('#wsv2Flow [data-fl-tpl="ba-premium"]').click());
await p.waitForTimeout(400);
// [v541] 작은 스트립 → 큰 캐러셀. 짝별 템플릿명은 active 라벨(Pair N 결과 · 템플릿명)에서 확인.
const slideN = () => p.evaluate(() => document.querySelectorAll('#wsv2Flow .tpl-car .cap-car__img').length);
const labelOf = async (pid) => { await p.evaluate((p2) => { var d = document.querySelector('#wsv2Flow [data-fl-cardot="' + p2 + '"]'); if (d) d.click(); }, pid); await p.waitForTimeout(120); return p.evaluate(() => (document.querySelector('#wsv2Flow [data-fl-tpl-activelabel]') || {}).textContent || ''); };
const changeActiveTo = async (pid, tplKey) => { await p.evaluate((p2) => { var d = document.querySelector('#wsv2Flow [data-fl-cardot="' + p2 + '"]'); if (d) d.click(); }, pid); await p.waitForTimeout(120); await p.evaluate(() => { var c = document.querySelector('#wsv2Flow [data-fl="tplchange-active"]'); if (c) c.click(); }); await p.waitForTimeout(80); await p.evaluate((k) => { var t = document.querySelector('#wsv2Flow [data-fl-tpl="' + k + '"]'); if (t) t.click(); }, tplKey); await p.waitForTimeout(400); };
ck('P-1 일괄 적용 → 결과물 3장(프리미엄)', (await slideN()) === 3 && /프리미엄/.test(await labelOf('pair-0')), 'slides=' + (await slideN()));
await changeActiveTo('pair-1', 'ba-luxury');   // pair-1 → 럭셔리
await changeActiveTo('pair-2', 'ba-classic');  // pair-2 → 클래식
let l0 = await labelOf('pair-0'), l1 = await labelOf('pair-1'), l2 = await labelOf('pair-2');
ck('P-2 Pair1=프리미엄 유지', /프리미엄/.test(l0), l0);
ck('P-3 Pair2=럭셔리로 변경', /럭셔리/.test(l1), l1);
ck('P-4 Pair3=클래식으로 변경', /클래식/.test(l2), l2);
ck('P-5 세 결과물 서로 다른 템플릿', new Set([l0, l1, l2].map(s => (s || '').replace(/Pair \d 결과 · /, ''))).size === 3, JSON.stringify([l0, l1, l2]));
// 전체 해제 → 원본 복구
await p.evaluate(() => document.querySelector('#wsv2Flow [data-fl="tplrelease"]').click());
await p.waitForTimeout(150);
const rel = await p.evaluate(() => ({ tiles: document.querySelectorAll('#wsv2Flow .tpl-result').length, applied: document.querySelectorAll('#wsv2Flow .tpl-applied').length }));
ck('P-6 전체 해제 → 결과물 제거(원본 복구)', rel.tiles === 0 && rel.applied === 0, JSON.stringify(rel));

// ── 기본 템플릿 설정 ──
const dflt = await p.evaluate(() => {
  var ok = window.WorkspaceDefaultTpl.set('ba', 'bp-ba-luxury-review');
  return { ok: ok, got: window.WorkspaceDefaultTpl.get('ba') };
});
ck('D-1 기본 템플릿 설정/조회', dflt.ok && dflt.got === 'bp-ba-luxury-review', JSON.stringify(dflt));

ck('X-1 runtime/console error 0', fe.length === 0, JSON.stringify(fe.slice(0, 4)));
await b.close();
const pass = r.filter(x => x.p).length;
console.log('V533 BA-PACK QA: ' + pass + '/' + r.length + ' PASS');
r.forEach(x => console.log((x.p ? '  PASS ' : '  FAIL ') + x.n + (x.p ? '' : ' :: ' + x.d)));
process.exit(pass === r.length ? 0 : 1);
