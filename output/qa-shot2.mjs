import { chromium } from 'playwright';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const U=['iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwAEhgGAa0+lYwAAAABJRU5ErkJggg=='].map(c=>'data:image/png;base64,'+c);
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:780},deviceScaleFactor:2});
await p.goto('http://localhost:8099/index.html',{waitUntil:'load'}); await sleep(2200);
await p.waitForFunction(()=>window.WorkspaceFlow,{timeout:20000});
await p.evaluate(u=>window.WorkspaceFlow.open({photoUrls:u}),U); await sleep(500);
// 인증 레이어 위로 강제 노출 (시각 확인용)
const info=await p.evaluate(()=>{const el=document.getElementById('wsv2Flow');el.style.cssText+=';position:fixed;inset:0;z-index:99999;display:flex;background:var(--bg,#faf7f5);';const cs=getComputedStyle(el);return {display:cs.display,z:cs.zIndex,w:el.offsetWidth,h:el.offsetHeight};});
console.log('overlay:',JSON.stringify(info));
await sleep(300);
await p.screenshot({path:'output/shot-upload.png'});
await p.evaluate(()=>window.WorkspaceFlow.command({type:'goto',screen:'edit'})); await sleep(600);
await p.evaluate(()=>{const el=document.getElementById('wsv2Flow');el.style.cssText+=';position:fixed;inset:0;z-index:99999;display:flex;';});
await sleep(300);
await p.screenshot({path:'output/shot-edit-tpl.png'});
await b.close(); console.log('done');
