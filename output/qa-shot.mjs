import { chromium } from 'playwright';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const U=['iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwAEhgGAa0+lYwAAAABJRU5ErkJggg=='].map(c=>'data:image/png;base64,'+c);
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:780},deviceScaleFactor:2});
await p.goto('http://localhost:8099/index.html',{waitUntil:'load'}); await sleep(2200);
await p.waitForFunction(()=>window.WorkspaceFlow,{timeout:20000});
await p.evaluate(u=>window.WorkspaceFlow.open({photoUrls:u}),U); await sleep(500);
// 가로 overflow 체크
const ov=await p.evaluate(()=>{const s=document.querySelector('[data-fs="upload"].active');return s?{sw:s.scrollWidth,cw:s.clientWidth}:null;});
console.log('upload overflow:',JSON.stringify(ov),'overflow?',ov&&ov.sw>ov.cw+1);
await p.screenshot({path:'output/shot-upload.png'});
await p.evaluate(()=>window.WorkspaceFlow.command({type:'goto',screen:'edit'})); await sleep(600);
await p.screenshot({path:'output/shot-edit-tpl.png'});
await b.close(); console.log('shots saved');
