// v539 QA — 마스크 보기 토글 + 슬라이더 렉(다운스케일) + 배경 rect 일관
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
const r = []; const ck = (n, c, dd) => r.push({ n, p: !!c, d: dd || '' });
const b = await chromium.launch();
const HTML = `<!doctype html><html><head><meta charset=utf-8><style>${CSS}</style></head><body><script>
 window._uid=()=>'id_'+Math.random().toString(36).slice(2); window.uid=window._uid; window.showToast=(m)=>{window.__toast=m;}; window.confirm=()=>true;
 window.renderScenarioSelector=(c)=>{c.innerHTML='';};
 // stub MaskApplication — skin/hair 마스크 가짜 생성(좌상단 절반 영역)
 window.MaskApplication={ getMasksForBeauty:function(img){
   var mw=200,mh=200, sk=new Float32Array(mw*mh), hr=new Float32Array(mw*mh);
   for(var y=0;y<mh;y++)for(var x=0;x<mw;x++){ var i=y*mw+x; if(x<mw*0.6&&y>mh*0.3) sk[i]=0.9; if(y<mh*0.3) hr[i]=0.8; }
   return Promise.resolve({ useMasks:{ skinMask:sk, hairMask:hr }, _scale:{}, maskW:mw, maskH:mh });
 }, getNailMaskSync:function(){return null;} };
 window.WorkspaceAdapter={ applyWorkspaceTemplate:()=>Promise.resolve({ok:true,dataUrl:'data:img/x'}),
   generateCaption:()=>Promise.resolve({ok:true,caption:'x',hashtags:[]}), instagram:()=>({connected:false}), instagramProfile:()=>({connected:false}), recentCustomers:()=>Promise.resolve([]), saveItem:()=>Promise.resolve({ok:true}), setCaptionTemplate:()=>Promise.resolve({ok:true}) };
 window.Customer={search:()=>[],list:()=>Promise.resolve([])}; window.WorkspaceV2={refresh:()=>{}};
</script><script>${STACK}</script></body></html>`;
fs.writeFileSync(path.join(ROOT, 'output/_v539qa.html'), HTML);
const PORT = process.env.QA_PORT || '8091';
const fe = [];
const p = await b.newPage();
await p.setViewportSize({ width: 420, height: 900 });
p.on('pageerror', e => fe.push(String(e)));
p.on('console', m => { if (m.type() === 'error' && !/INVALID_URL|net::|Failed to load/.test(m.text())) fe.push(m.text()); });
await p.goto('http://localhost:' + PORT + '/output/_v539qa.html', { waitUntil: 'load' });

const slot = { id: 's', workspaceContext: { templatePurpose: 'before_after', type: 'before_after' },
  photos: [{ id: 'a', dataUrl: PNG, role: 'before' }, { id: 'b', dataUrl: PNG, role: 'after' }] };
await p.evaluate(s => window.WorkspaceFlow.open({ startScreen: 'edit', cat: 'ba', slot: s }), slot);
await p.waitForTimeout(120);

ck('M-0 마스크 보기 버튼 존재', await p.evaluate(() => !!document.querySelector('#wsv2Flow [data-fl-eb="마스크"]')), '');
const ovHiddenInit = await p.evaluate(() => { var o = document.querySelector('#wsv2Flow [data-fl-maskov]'); return o ? o.hidden : 'no-canvas'; });
ck('M-1 overlay 기본 숨김', ovHiddenInit === true, 'hidden=' + ovHiddenInit);

// 마스크 보기 ON (skin 탭 기본)
await p.evaluate(() => document.querySelector('#wsv2Flow [data-fl-eb="마스크"]').click());
await p.waitForTimeout(250);
const onState = await p.evaluate(() => {
  var o = document.querySelector('#wsv2Flow [data-fl-maskov]');
  var bd = document.querySelector('#wsv2Flow [data-fl-maskbadge]');
  return { ovHidden: o ? o.hidden : 'x', ovW: o ? o.width : 0, badge: bd ? bd.textContent : '', badgeHidden: bd ? bd.hidden : 'x', active: !!document.querySelector('#wsv2Flow .ed-maskpill.on') };   // [v540] 토글이 정밀패널 pill 로 이동(.ed-maskpill.on)
});
ck('M-2 ON 시 overlay 표시', onState.ovHidden === false && onState.ovW > 0, JSON.stringify(onState));
ck('M-3 배지에 피부 인식+coverage', /피부·얼굴 인식됨 · \d/.test(onState.badge), onState.badge);
ck('M-4 버튼 active 상태', onState.active === true, '');

// 헤어 탭 전환 → 배지 헤어로
await p.evaluate(() => { var t = document.querySelector('#wsv2Flow [data-fl-edtab="hair"]'); if (t) t.click(); });
await p.waitForTimeout(250);
const hairBadge = await p.evaluate(() => (document.querySelector('#wsv2Flow [data-fl-maskbadge]') || {}).textContent);
ck('M-5 헤어 탭 → 헤어 마스크 배지', /헤어 인식됨 · \d/.test(hairBadge), hairBadge);

// OFF → overlay 숨김
await p.evaluate(() => document.querySelector('#wsv2Flow [data-fl-eb="마스크"]').click());
await p.waitForTimeout(80);
const offHidden = await p.evaluate(() => (document.querySelector('#wsv2Flow [data-fl-maskov]') || {}).hidden);
ck('M-6 OFF 시 overlay 즉시 숨김', offHidden === true, 'hidden=' + offHidden);
ck('X-1 pageerror/console error 0', fe.length === 0, fe.slice(0, 3).join(' | '));

const pass = r.filter(x => x.p).length;
console.log('V539 MASKVIEW QA: ' + pass + '/' + r.length + ' ' + (pass === r.length ? 'PASS' : 'FAIL'));
r.forEach(x => console.log('  ' + (x.p ? 'PASS' : 'FAIL') + ' ' + x.n + (x.d ? '  — ' + x.d : '')));
await b.close();
process.exit(pass === r.length ? 0 : 1);
