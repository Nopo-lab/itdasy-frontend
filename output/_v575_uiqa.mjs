// v575 UI QA — 실브라우저(headed) 편집기 UX 검증. 사진위 overlay 제거 / 마스크버튼 1세트 / 큰사진 / 네일 손피부톤 제거.
import fs from 'fs';
import { chromium } from 'playwright';
const rd = f => fs.readFileSync(f, 'utf8');
const FCSS = ['css/tokens.css','css/components.css','css/workspace-v2-flow.css'].map(rd).join('\n');
const FSTACK = [
  'js/photo-editor/template-fit-text.js','js/photo-editor/template-slots.js','js/photo-editor/template-pack-beauty-data.js',
  'js/photo-editor/template-market-data.js','js/photo-editor/template-renderer-beauty-pack.js','js/photo-editor/template-renderer-beauty-pack-draws.js',
  'js/photo-editor/template-renderer-wm-pack-draws.js','js/photo-editor/premium-templates.js','js/photo-editor/template-thumb.js',
  'js/workspace/workspace-tpl-edit.js','js/workspace/workspace-v2-home.js','js/workspace/workspace-state.js','js/workspace/workspace-v2-flow.js',
].map(rd).join('\n;\n');
const PNG = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#cdd2d8"/><circle cx="300" cy="200" r="150" fill="#e9c4a8"/><rect x="160" y="380" width="280" height="520" fill="#b07a52"/></svg>').toString('base64');
const HTML = `<!doctype html><html><head><meta charset=utf-8><style>${FCSS}</style></head><body><script>
 window._uid=()=>'id_'+Math.random().toString(36).slice(2); window.uid=window._uid; window.showToast=()=>{}; window.confirm=()=>true; window.renderScenarioSelector=(c)=>{c.innerHTML='';};
 window.WorkspaceAdapter={ applyWorkspaceTemplate:()=>Promise.resolve({ok:true,dataUrl:'data:img/x'}), applyWorkspaceCorrections:()=>Promise.resolve({ok:true,dataUrl:'x'}), generateCaption:()=>Promise.resolve({ok:true,caption:'x',hashtags:[]}), instagram:()=>({connected:false}), instagramProfile:()=>({connected:false}), recentCustomers:()=>Promise.resolve([]), saveItem:()=>Promise.resolve({ok:true}), setCaptionTemplate:()=>Promise.resolve({ok:true}) };
 window.Customer={search:()=>[],list:()=>Promise.resolve([])}; window.WorkspaceV2={refresh:()=>{}};
</script><script>${FSTACK}</script></body></html>`;
fs.writeFileSync('output/_v575_uiqa.html', HTML);

const results = [];
const ok = (n, c, d='') => results.push({ n, pass: !!c, d });
const browser = await chromium.launch();
const consoleErrors = {};
for (const [w, name] of [[420, 'mobile'], [1440, 'pc']]) {
  const page = await browser.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
  await page.setViewportSize({ width: w, height: 900 });
  await page.goto('http://localhost:8091/output/_v575_uiqa.html', { waitUntil: 'load' });
  const slot = { id: 's', workspaceContext: { templatePurpose: 'feed', type: 'feed' }, photos: [{ id: 'a', dataUrl: PNG, role: 'hero' }] };
  await page.evaluate(s => window.WorkspaceFlow.open({ startScreen: 'edit', cat: 'feed', slot: s }), slot);
  await page.waitForTimeout(400);

  // 1) 사진 뷰포트 안에 overlay 버튼/배지 없음
  const insideVp = await page.evaluate(() => {
    const vp = document.querySelector('[data-fs="edit"] .ed-photo-vp');
    if (!vp) return { noVp: true };
    return {
      hasToolsInside: !!vp.querySelector('.ed-vptools'),
      hasBadgeInside: !!vp.querySelector('.ed-mask-badge,[data-fl-maskbadge]'),
      hasMaskBtnInside: !!vp.querySelector('[data-fl-eb="마스크"],[data-fl="maskpaint"]'),
      vpHeight: Math.round(vp.getBoundingClientRect().height),
      children: Array.from(vp.children).map(c => c.className),
    };
  });
  ok(`[${name}] 사진 뷰포트 안 도구바 없음`, insideVp && !insideVp.hasToolsInside, JSON.stringify(insideVp.children));
  ok(`[${name}] 사진 뷰포트 안 인식%배지 없음`, insideVp && !insideVp.hasBadgeInside);
  ok(`[${name}] 사진 뷰포트 안 마스크버튼 없음`, insideVp && !insideVp.hasMaskBtnInside);
  ok(`[${name}] 사진 크게(높이>=340) — 실제 ${insideVp.vpHeight}px`, insideVp.vpHeight >= 340);

  // 2) 도구바는 사진 '밖' 형제로 존재 + 줌 컨트롤
  const toolbar = await page.evaluate(() => {
    const tb = document.querySelector('[data-fs="edit"] .ed-vptools');
    const vp = document.querySelector('[data-fs="edit"] .ed-photo-vp');
    return {
      exists: !!tb,
      isSibling: !!(tb && vp && tb.parentElement === vp.parentElement),
      hasZoom: !!(tb && tb.querySelector('[data-fl="edzoomin"]') && tb.querySelector('[data-fl="edzoomout"]')),
    };
  });
  ok(`[${name}] 확대/축소 도구바 사진 밖 존재`, toolbar.exists && toolbar.isSibling && toolbar.hasZoom);

  // 3) 마스크 보기/직접 칠하기 각각 1개(ed-maskpill, 메뉴 쪽)
  const maskBtns = await page.evaluate(() => ({
    maskView: document.querySelectorAll('[data-fs="edit"] [data-fl-eb="마스크"]').length,
    maskPaint: document.querySelectorAll('[data-fs="edit"] [data-fl="maskpaint"]').length,
    pillView: document.querySelectorAll('[data-fs="edit"] .ed-maskpill[data-fl-eb="마스크"]').length,
    vpbtnMask: document.querySelectorAll('[data-fs="edit"] .ed-vpbtn[data-fl-eb="마스크"]').length,
  }));
  ok(`[${name}] 마스크 보기 버튼 1개`, maskBtns.maskView === 1, JSON.stringify(maskBtns));
  ok(`[${name}] 직접 칠하기 버튼 1개`, maskBtns.maskPaint === 1, JSON.stringify(maskBtns));
  ok(`[${name}] 사진위 마스크버튼(ed-vpbtn) 0개`, maskBtns.vpbtnMask === 0);

  // 4) 네일 탭에 손 피부톤 없음
  const nailTab = await page.evaluate(() => {
    const t = document.querySelector('[data-fs="edit"] [data-fl-edtab="nail"]');
    if (!t) return { noTab: true };
    t.click();
    return null;
  });
  await page.waitForTimeout(200);
  const nailCtl = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('[data-fs="edit"] [data-ed-adv] .ed-tab, [data-fs="edit"] [data-ed-adv] [data-fl-prectool], [data-fs="edit"] [data-ed-adv] button')).map(e => e.textContent.trim());
    const body = (document.querySelector('[data-fs="edit"] [data-ed-adv]') || {}).textContent || '';
    return { hasHandSkin: body.includes('손 피부톤'), hasNailGloss: body.includes('네일 광택'), hasNailShape: body.includes('네일 경계') };
  });
  ok(`[${name}] 네일 탭 '손 피부톤' 없음`, nailCtl && !nailCtl.hasHandSkin, JSON.stringify(nailCtl));
  ok(`[${name}] 네일 탭 네일 광택/경계 존재`, nailCtl && nailCtl.hasNailGloss && nailCtl.hasNailShape);

  await page.screenshot({ path: `output/v575-qa-images/edit-${name}.png`, fullPage: false });
  consoleErrors[name] = errs;
  ok(`[${name}] 콘솔 에러 0`, errs.length === 0, errs.slice(0, 3).join(' | '));
  await page.close();
}
await browser.close();

let pass = 0, fail = 0;
console.log('\n===== v575 UI QA =====');
for (const r of results) { console.log((r.pass ? 'PASS' : 'FAIL') + '  ' + r.n + (r.d && !r.pass ? '  → ' + r.d : '')); r.pass ? pass++ : fail++; }
console.log(`\n총 ${results.length} · PASS ${pass} · FAIL ${fail}`);
console.log('콘솔에러:', JSON.stringify(consoleErrors));
process.exit(fail ? 1 : 0);
