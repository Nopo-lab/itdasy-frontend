// v536 QA — mock 생성형 게이팅 + 부위보정 마스크 상태 노출 + 문구 정직성
import fs from 'fs'; import path from 'path'; import { chromium } from 'playwright';
const ROOT = path.resolve('.');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const STACK = [
  'js/photo-editor/mask-confidence.js', 'js/photo-editor/mask-status-ui.js',
  'app-photo-editor-generative-l3.js', 'app-photo-editor-beauty.js',
].map(rd).join('\n;\n');
const r = []; const ck = (n, c, d) => r.push({ n, p: !!c, d: d || '' });
const b = await chromium.launch();

function page(flag) {
  return `<!doctype html><html><head><meta charset=utf-8></head><body><script>
   window.__panels={}; window.__toast=null; window.showToast=function(m){window.__toast=m;};
   window._esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c];});};
   window.PhotoEditor={ _internal:{ registerTabPanel:function(id,p){window.__panels[id]=p;}, registerDrawHook:function(){} } };
  </script><script>${STACK}</script></body></html>`;
}
const PORT = process.env.QA_PORT || '8091';
fs.writeFileSync(path.join(ROOT, 'output/_v536off.html'), page(false));

const fe = [];
// ── 플래그 OFF: mock 생성형 'ai' 패널 등록 안 됨 ──
const p1 = await b.newPage();
p1.on('pageerror', e => fe.push(String(e)));
await p1.goto('http://localhost:' + PORT + '/output/_v536off.html', { waitUntil: 'load' });
const off = await p1.evaluate(() => ({
  aiRegistered: !!window.__panels['ai'],
  beautyRegistered: !!window.__panels['beauty'],
}));
ck('M-1 플래그 없으면 mock 생성형 ai 패널 미등록', off.aiRegistered === false, 'aiRegistered=' + off.aiRegistered);
ck('M-2 beauty 패널은 정상 등록', off.beautyRegistered === true, '');

// 부위 보정 패널 HTML — 마스크 상태 노출 + AI 라벨 없음
const beautyHtml = await p1.evaluate(() => {
  try { return window.__panels['beauty'].html({ originalImg: {}, beauty: {}, beautyRegion: 'skin' }); } catch (e) { return 'ERR:' + e.message; }
});
ck('B-1 부위보정에 정밀 마스크 상태 노출', /정밀 마스크 상태|정밀 인식 상태 보기/.test(beautyHtml), beautyHtml.slice(0, 60));
ck('B-2 슬라이더에 "AI" 라벨 없음(정직)', !/AI\s*인식|AI\s*보정|AI\s*생성/.test(beautyHtml), '');
ck('B-3 마스크 상태 정직 라벨(정밀/일반 보정)', /정밀 적용|약하게 적용|기본 보정|준비 중/.test(beautyHtml), '');

// ── 플래그 ON: mock 등록되지만 '실험실'로 정직 표기, 크레딧 차감 문구 없음 ──
const p2 = await b.newPage();
p2.on('pageerror', e => fe.push(String(e)));
await p2.addInitScript(() => { try { localStorage.setItem('PE_GENERATIVE_MOCK', '1'); } catch (e) { } });
fs.writeFileSync(path.join(ROOT, 'output/_v536on.html'), page(true));
await p2.goto('http://localhost:' + PORT + '/output/_v536on.html', { waitUntil: 'load' });
const on = await p2.evaluate(() => {
  var reg = !!window.__panels['ai'];
  var html = '';
  try { html = reg ? window.__panels['ai'].html({ originalImg: {} }) : ''; } catch (e) { html = 'ERR:' + e.message; }
  return { reg: reg, html: html };
});
ck('M-3 개발자 플래그 켜면 mock 등록됨', on.reg === true, 'reg=' + on.reg);
ck('M-4 mock 패널은 "실험실/mock"로 정직 표기', /실험실|mock/.test(on.html), '');
ck('M-5 "크레딧 차감"·"AI 생성" 오해 문구 없음', !/크레딧 1장 예정|실제 차감|AI 생성|생성 완료/.test(on.html), '');

ck('X-1 pageerror 0', fe.length === 0, JSON.stringify(fe.slice(0, 3)));
await b.close();
const pass = r.filter(x => x.p).length;
console.log('V536 PHOTO QA: ' + pass + '/' + r.length + ' PASS');
r.forEach(x => console.log((x.p ? '  PASS ' : '  FAIL ') + x.n + (x.p ? '' : ' :: ' + x.d)));
process.exit(pass === r.length ? 0 : 1);
