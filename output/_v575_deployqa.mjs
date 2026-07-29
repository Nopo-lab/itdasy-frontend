import { chromium } from 'playwright';
const URL = 'https://nopo-lab.github.io/itdasy-frontend-test-yeunjun/index.html?cb=' + Date.now();
const PNG = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#cdd2d8"/><circle cx="300" cy="200" r="150" fill="#e9c4a8"/><rect x="160" y="380" width="280" height="520" fill="#b07a52"/></svg>').toString('base64');
const b = await chromium.launch();
const results = []; const ok = (n,c,d='')=>results.push({n,pass:!!c,d});
for (const [w,name] of [[420,'mobile'],[1440,'pc']]) {
  const p = await b.newPage(); const errs=[];
  p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  p.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  await p.setViewportSize({width:w,height:900});
  await p.goto(URL,{waitUntil:'load'}); await p.waitForTimeout(3000);
  // 실제 배포본 함수로 편집기 진입(슬롯). 어댑터 백엔드콜은 무시.
  await p.evaluate(()=>{ try{window.showToast=()=>{};}catch(e){} });
  const opened = await p.evaluate((png)=>{
    if(!window.WorkspaceFlow||!window.WorkspaceFlow.open) return false;
    window.WorkspaceFlow.open({startScreen:'edit',cat:'feed',slot:{id:'s',workspaceContext:{templatePurpose:'feed',type:'feed'},photos:[{id:'a',dataUrl:png,role:'hero'}]}});
    return true;
  }, PNG);
  await p.waitForTimeout(900);
  const r = await p.evaluate(()=>{
    const vp=document.querySelector('[data-fs="edit"] .ed-photo-vp');
    const tb=document.querySelector('[data-fs="edit"] .ed-vptools');
    return {
      vp:!!vp, vpH: vp?Math.round(vp.getBoundingClientRect().height):0,
      toolsInside: !!(vp&&vp.querySelector('.ed-vptools')),
      badgeInside: !!(vp&&vp.querySelector('.ed-mask-badge')),
      maskBtnInside: !!(vp&&vp.querySelector('[data-fl-eb="마스크"],[data-fl="maskpaint"]')),
      toolbarSibling: !!(tb&&vp&&tb.parentElement===vp.parentElement),
      maskView: document.querySelectorAll('[data-fs="edit"] [data-fl-eb="마스크"]').length,
      maskPaint: document.querySelectorAll('[data-fs="edit"] [data-fl="maskpaint"]').length,
      vpbtnMask: document.querySelectorAll('[data-fs="edit"] .ed-vpbtn[data-fl-eb="마스크"]').length,
    };
  });
  ok(`[${name}] 배포본 편집기 진입`, opened && r.vp);
  ok(`[${name}] 사진 크게(>=340) — ${r.vpH}px`, r.vpH>=340);
  ok(`[${name}] 사진 위 도구바/배지/마스크버튼 없음`, !r.toolsInside&&!r.badgeInside&&!r.maskBtnInside);
  ok(`[${name}] 도구바 사진 밖 형제`, r.toolbarSibling);
  ok(`[${name}] 마스크보기1/직접칠1/사진위마스크0`, r.maskView===1&&r.maskPaint===1&&r.vpbtnMask===0, JSON.stringify(r));
  // 네일 탭 손피부톤
  await p.evaluate(()=>{const t=document.querySelector('[data-fs="edit"] [data-fl-edtab="nail"]'); if(t)t.click();});
  await p.waitForTimeout(250);
  const nail = await p.evaluate(()=>{const a=document.querySelector('[data-fs="edit"] [data-ed-adv]'); return (a?a.textContent:'');});
  ok(`[${name}] 네일 탭 손피부톤 없음`, !nail.includes('손 피부톤'));
  ok(`[${name}] 네일 광택/경계 존재`, nail.includes('네일 광택')&&nail.includes('네일 경계'));
  await p.screenshot({path:`output/v575-qa-images/deployed-${name}.png`});
  const codeErrs = errs.filter(e=>!/Failed to load resource|net::|404|Supabase|fetch|CORS|mediapipe|storage\.googleapis|gemini|favicon|401|403/i.test(e));
  ok(`[${name}] 코드 콘솔에러 0(네트워크 제외)`, codeErrs.length===0, codeErrs.slice(0,3).join(' | '));
  await p.close();
}
await b.close();
let pass=0,fail=0; console.log('\n===== v575 DEPLOYED QA (https://nopo-lab.github.io/itdasy-frontend-test-yeunjun/) =====');
for(const r of results){console.log((r.pass?'PASS':'FAIL')+'  '+r.n+(r.d&&!r.pass?'  → '+r.d:'')); r.pass?pass++:fail++;}
console.log(`\n총 ${results.length} · PASS ${pass} · FAIL ${fail}`); process.exit(fail?1:0);
