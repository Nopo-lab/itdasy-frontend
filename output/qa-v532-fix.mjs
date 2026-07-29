// v532 QA — 캡션 화면 정리 + 짝별 템플릿 + 인스타 톤/다시쓰기/문맥/엔터경로 수정
// 실행: npx playwright 설치 후 `node output/qa-v532-fix.mjs`
import fs from 'fs'; import path from 'path'; import { chromium } from 'playwright';
const ROOT = path.resolve('.');
const FLOW = fs.readFileSync(path.join(ROOT, 'js/workspace/workspace-v2-flow.js'), 'utf8');
const HOME = fs.readFileSync(path.join(ROOT, 'js/workspace/workspace-v2-home.js'), 'utf8');
const CSS  = fs.readFileSync(path.join(ROOT, 'css/workspace-v2-flow.css'), 'utf8');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF8FAGW2BPHFsbpRAAAAAElFTkSuQmCC';
const r = []; const ck = (n, c, d) => r.push({ n, p: !!c, d: d || '' });
const b = await chromium.launch();

// 각 합성 호출마다 다른 dataUrl 반환(짝별 격리 검증용) + generateCaption opts 캡처(window.__g)
const FP = `<!doctype html><html><head><meta charset=utf-8><style>${CSS}</style></head><body><script>
 window._uid=()=>'id_'+Math.random().toString(36).slice(2); window.uid=window._uid; window.showToast=()=>{}; window.confirm=()=>true;
 window.renderScenarioSelector=(c,cb)=>{c.innerHTML='';};
 window.__n=0;
 window.WorkspaceAdapter={
   applyWorkspaceTemplate:o=>{window.__n++;return Promise.resolve({ok:true,dataUrl:'data:img/'+window.__n});},
   generateCaption:o=>{window.__g=JSON.parse(JSON.stringify(o));return Promise.resolve({ok:true,caption:'생성된 글 '+(window.__cn=(window.__cn||0)+1),hashtags:['#가','#나','#다']});},
   saveItem:s=>Promise.resolve({ok:true}), instagramProfile:()=>({connected:false}), instagram:()=>({connected:false}),
   recentCustomers:()=>Promise.resolve([]), setCaptionTemplate:()=>Promise.resolve({ok:true})
 };
 window.Customer={search:()=>[],list:()=>Promise.resolve([])}; window.WorkspaceV2={refresh:()=>{}};
</script><script>${FLOW}</script><script>${HOME}</script></body></html>`;
const fp = await b.newPage(); const fe = [];
fp.on('pageerror', e => fe.push(String(e)));
fp.on('console', m => { if (m.type() === 'error' && !/INVALID_URL|net::|Failed to load/.test(m.text())) fe.push(m.text()); });
await fp.setContent(FP, { waitUntil: 'load' });

const six = { id: 'six', workspaceContext: { templatePurpose: 'before_after', type: 'before_after' },
  photos: [0,1,2,3,4,5].map(i => ({ id: (i%2?'a':'b')+i, dataUrl: PNG, role: i%2?'after':'before' })) };
await fp.evaluate(s => window.WorkspaceFlow.open({ startScreen: 'edit', cat: 'ba', slot: s }), six);
// ba 일괄 적용(검증된 command 경로). 적용 후 템플릿 폴드는 이미 열려 결과 스트립이 노출됨.
await fp.evaluate(() => window.WorkspaceFlow.command({ type: 'template', key: 'ba' }));
await fp.waitForTimeout(500);

// [v541] 작은 스트립 → 큰 캐러셀. 결과 이미지=슬라이드, 짝별 변경=pill 활성화 후 active 바꾸기.
const readImgs = () => fp.evaluate(() => Array.from(document.querySelectorAll('#wsv2Flow .tpl-car .cap-car__img')).map(e => e.style.backgroundImage));
const activatePair = (pid) => fp.evaluate((p) => { var d = document.querySelector('#wsv2Flow [data-fl-cardot="' + p + '"]'); if (d) d.click(); }, pid);
let A = await readImgs();
ck('T-1 일괄 적용 → 결과물 3장(캐러셀)', A.length === 3, JSON.stringify(A));
ck('T-2 Pair pill 3개', await fp.evaluate(() => document.querySelectorAll('#wsv2Flow .tpl-car__pill').length) === 3, '');
ck('T-3 배너 "적용된 전후 템플릿"', await fp.evaluate(() => /적용된 전후 템플릿/.test((document.querySelector('#wsv2Flow .tpl-applied__t') || {}).textContent || '')), '');
ck('T-4 active-pair "템플릿 바꾸기" 버튼', await fp.evaluate(() => !!document.querySelector('#wsv2Flow [data-fl="tplchange-active"]')), '');

// 짝별 변경 — pair-1 활성화 후 바꾸기 → 다른 짝 유지
const before = A.slice();
await activatePair('pair-1');
await fp.waitForTimeout(120);
await fp.evaluate(() => { var c = document.querySelector('#wsv2Flow [data-fl="tplchange-active"]'); if (c) c.click(); });
await fp.waitForTimeout(80);
await fp.evaluate(() => { var t = document.querySelector('#wsv2Flow [data-fl-tpl="ba"]'); if (t) t.click(); });
await fp.waitForTimeout(350);
let Bt = await readImgs();
ck('T-5 pair-1 결과만 변경됨', Bt[1] !== before[1], before[1] + ' → ' + Bt[1]);
ck('T-6 pair-0 결과 유지', Bt[0] === before[0], before[0] + ' / ' + Bt[0]);
ck('T-7 pair-2 결과 유지', Bt[2] === before[2], before[2] + ' / ' + Bt[2]);
ck('T-8 결과물 여전히 3장(개수 안 깨짐)', Bt.length === 3, String(Bt.length));

// 전체 해제 → 원본 복구(결과물 0)
await fp.evaluate(() => { var rl = document.querySelector('#wsv2Flow [data-fl="tplrelease"]'); if (rl) rl.click(); });
await fp.waitForTimeout(120);
let rel = await fp.evaluate(() => ({ tiles: document.querySelectorAll('#wsv2Flow .tpl-result').length, applied: document.querySelectorAll('#wsv2Flow .tpl-applied').length }));
ck('T-9 전체 해제 → 결과물 스트립 제거', rel.tiles === 0 && rel.applied === 0, JSON.stringify(rel));

// ── 캡션: 문맥 / 인스타 톤 / 더 길게 / 다시 쓰기 ──
await fp.evaluate(() => window.WorkspaceFlow.command({ type: 'caption', service: '레이어드컷 27인치' }));
await fp.waitForTimeout(150);
let g = await fp.evaluate(() => window.__g);
ck('C-1 photo_context 입력 시술 최우선', /이 게시글의 유일한 시술\): 레이어드컷 27인치/.test(g.photo_context), g.photo_context);
ck('C-2 photo_context 과거글 말투만 명시', /과거 글은 말투만 참고/.test(g.photo_context));
ck('C-3 extra_notes 시술내용=입력값만', /시술명·인치·기법·재료는 입력값만/.test(g.extra_notes), g.extra_notes);
ck('C-4 extra_notes 타 시술명 금지', /붙임머리·단발·땋기·매듭·펌 등\)은 사진이나 예시에 보여도 절대 언급/.test(g.extra_notes));
ck('C-5 extra_notes ≤300자', (g.extra_notes||'').length <= 300, String((g.extra_notes||'').length));
ck('C-6 photo_context ≤500자', (g.photo_context||'').length <= 500, String((g.photo_context||'').length));

// 인스타 톤(결과 화면 버튼)
await fp.evaluate(() => { var v = document.querySelector('#wsv2Flow [data-fl-var="insta"]'); if (v) v.click(); });
await fp.waitForTimeout(150);
let gi = await fp.evaluate(() => window.__g);
ck('C-7 인스타 톤 → tone_override "ornate"(enum 유효, 422 아님)', gi.tone_override === 'ornate', JSON.stringify(gi.tone_override));
// 더 길게
await fp.evaluate(() => { var v = document.querySelector('#wsv2Flow [data-fl-var="long"]'); if (v) v.click(); });
await fp.waitForTimeout(150);
let gl = await fp.evaluate(() => window.__g);
ck('C-8 더 길게 → length_tier "long"', gl.length_tier === 'long', JSON.stringify(gl.length_tier));
// 다시 쓰기 → 변형 지시(재생성 N회차)
await fp.evaluate(() => { var v = document.querySelector('#wsv2Flow [data-fl-var="regen"]'); if (v) v.click(); });
await fp.waitForTimeout(150);
let gr = await fp.evaluate(() => window.__g);
ck('C-9 다시 쓰기 → extra_notes 변형 지시 포함', /재생성 \d+회차/.test(gr.extra_notes), gr.extra_notes);

// 해시태그 추천 섹션 제거 확인(결과 화면 DOM)
let hsec = await fp.evaluate(() => {
  var root = document.querySelector('#wsv2Flow');
  return {
    추천제목: /추천 해시태그/.test(root.innerHTML),
    더가져오기: !!root.querySelector('[data-fl="morehash"]'),
    chip: !!root.querySelector('.hash-chip'),
    편집칸: !!root.querySelector('[data-fl-caphashedit]')
  };
});
ck('H-1 "추천 해시태그" 제목 없음', hsec.추천제목 === false);
ck('H-2 "+ 더 가져오기" 없음', hsec.더가져오기 === false);
ck('H-3 추천 chip 없음', hsec.chip === false);
ck('H-4 해시태그 직접편집 textarea 유지', hsec.편집칸 === true);

// ── Enter 경로 vs 버튼 경로(IME 가드) ──
// 초기화 → 입력 화면
await fp.evaluate(() => { var v = document.querySelector('#wsv2Flow [data-fl-var="reset"]'); if (v) v.click(); });
await fp.waitForTimeout(120);
// IME 조합 중 Enter(isComposing=true) → 생성 안 됨
await fp.evaluate(() => { window.__g = null; var i = document.querySelector('#wsv2Flow [data-fl-service]'); i.value = '붙임머리 27인치 손상모'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })); });
await fp.waitForTimeout(120);
let gC = await fp.evaluate(() => window.__g);
ck('E-1 IME 조합 중 Enter 는 생성 안 함', gC === null, JSON.stringify(gC && gC.service));
// 조합 종료 후 Enter(isComposing=false) → 키워드 그대로 반영
await fp.evaluate(() => { var i = document.querySelector('#wsv2Flow [data-fl-service]'); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: false, bubbles: true })); });
await fp.waitForTimeout(150);
let gE = await fp.evaluate(() => window.__g);
ck('E-2 Enter(조합완료) → service 정확 반영', gE && gE.service === '붙임머리 27인치 손상모', JSON.stringify(gE && gE.service));
ck('E-3 Enter 경로 photo_context 에 키워드 반영', gE && /붙임머리 27인치 손상모/.test(gE.photo_context), gE && gE.photo_context);
// 버튼 경로(command caption = 시술완성 진입) 동일 키워드
await fp.evaluate(() => window.WorkspaceFlow.command({ type: 'caption', service: '붙임머리 27인치 손상모' }));
await fp.waitForTimeout(150);
let gB = await fp.evaluate(() => window.__g);
ck('E-4 버튼 경로도 동일 service 반영', gB && gB.service === '붙임머리 27인치 손상모', JSON.stringify(gB && gB.service));
ck('E-5 Enter/버튼 photo_context 동일 수준(키워드 prefix 동일)',
  gE && gB && gE.photo_context.indexOf('붙임머리 27인치 손상모') === gB.photo_context.indexOf('붙임머리 27인치 손상모'),
  (gE && gE.photo_context.slice(0,40)) + ' || ' + (gB && gB.photo_context.slice(0,40)));

ck('X-1 runtime/console error 0', fe.length === 0, JSON.stringify(fe.slice(0, 4)));

await b.close();
const pass = r.filter(x => x.p).length;
console.log('V532 FIX QA: ' + pass + '/' + r.length + ' PASS');
r.forEach(x => console.log((x.p ? '  PASS ' : '  FAIL ') + x.n + (x.p ? '' : ' :: ' + x.d)));
process.exit(pass === r.length ? 0 : 1);
