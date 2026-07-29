import { chromium } from 'playwright';
const BASE='http://localhost:8099';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const U='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:780}});
await p.goto(BASE+'/index.html',{waitUntil:'load'}); await sleep(2200);
await p.waitForFunction(()=>window.WorkspaceFlow,{timeout:20000}); await sleep(300);
await p.evaluate(u=>window.WorkspaceFlow.open({photoUrls:[u]}),U); await sleep(400);
const dbg=async tag=>{const s=await p.evaluate(()=>({title:document.querySelector('[data-fl-title]')?.textContent,open:!!document.getElementById('wsv2Flow')?.classList.contains('is-open'),hist:history.length,hash:location.hash,stack:(window._sheetBackStack||[]).join(',')}));console.log(tag,JSON.stringify(s));};
await dbg('open');
for(const s of['edit','caption','connect','preview']){await p.evaluate(x=>window.WorkspaceFlow.command({type:'goto',screen:x}),s);await sleep(150);}
await dbg('preview');
for(let i=1;i<=5;i++){await p.evaluate(()=>history.back());await sleep(220);await dbg('back'+i);}
await b.close();
