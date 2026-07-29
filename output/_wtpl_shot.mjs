import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.setViewportSize({width:1280,height:900});
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8095/output/_wtpl.html',{waitUntil:'load'});
await p.evaluate(()=>window.openSheet('bp-ba-premium-infographic'));
await p.waitForTimeout(500);
await p.screenshot({path:'output/wtpl-desktop.png'});
// edit service_name → preview should update; capture applied
await p.evaluate(()=>{ var f=document.querySelector('[data-wtpl-field="service_name"]'); f.value='레이어드컷 27인치 QA'; f.dispatchEvent(new Event('input',{bubbles:true})); });
await p.evaluate(()=>{ var f=document.querySelector('[data-wtpl-field="review_text"]'); f.value='QA 후기 반영 확인 텍스트입니다.'; f.dispatchEvent(new Event('input',{bubbles:true})); });
await p.waitForTimeout(200);
await p.screenshot({path:'output/wtpl-edited.png'});
const counters=await p.evaluate(()=>({svc:document.querySelector('[data-wtpl-count="service_name"]').textContent, has:!!document.querySelector('.wtpl-card')}));
console.log('counters',JSON.stringify(counters));
// apply
await p.evaluate(()=>document.querySelector('[data-wtpl="apply"]').click());
await p.waitForTimeout(200);
const applied=await p.evaluate(()=>({hasOut:!!(window.__applied&&window.__applied.outputUrl&&window.__applied.outputUrl.length>2000), svc:window.__applied&&window.__applied.slotValues&&window.__applied.slotValues.service_name, closed:!document.querySelector('.wtpl-card')}));
console.log('applied',JSON.stringify(applied));
console.log('errors',errs.slice(0,4));
// mobile
await p.setViewportSize({width:430,height:920});
await p.evaluate(()=>window.openSheet('bp-ba-luxury-review'));
await p.waitForTimeout(400);
await p.screenshot({path:'output/wtpl-mobile.png'});
await b.close();
