import { chromium } from 'playwright';
const URL='https://nopo-lab.github.io/itdasy-frontend-test-yeunjun/index.html?cb='+Date.now();
const PNG='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#cdd2d8"/></svg>').toString('base64');
const b=await chromium.launch(); const p=await b.newPage(); await p.setViewportSize({width:1280,height:900});
await p.goto(URL,{waitUntil:'load'}); await p.waitForTimeout(2500);
await p.evaluate((png)=>{window.showToast=()=>{};window.WorkspaceFlow.open({startScreen:'edit',cat:'feed',slot:{id:'s',workspaceContext:{templatePurpose:'feed',type:'feed'},photos:[{id:'a',dataUrl:png,role:'hero'}]}});},PNG);
await p.waitForTimeout(900);
const info=await p.evaluate(()=>{
  const vp=document.querySelector('[data-fs="edit"] .ed-photo-vp');
  const host=document.querySelector('.wsv2flow');
  const cs=vp?getComputedStyle(vp):null;
  return {
    vpExists:!!vp,
    hostOpen: host?host.classList.contains('is-open'):null,
    hostDisplay: host?getComputedStyle(host).display:null,
    cssHeight: cs?cs.height:null,
    offsetParentNull: vp?(vp.offsetParent===null):null,
    rectH: vp?Math.round(vp.getBoundingClientRect().height):null,
  };
});
await b.close(); console.log(JSON.stringify(info,null,2));
