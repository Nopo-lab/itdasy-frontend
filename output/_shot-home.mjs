import fs from 'fs'; import { chromium } from 'playwright';
const rd=f=>fs.readFileSync(f,'utf8');
const CSS=[rd('css/tokens.css'),rd('css/workspace-v2.css')].join('\n');
const STACK=['js/workspace/workspace-state.js','js/workspace/workspace-v2-home.js'].map(rd).join('\n;\n');
const PNG='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="#e9c4a8"/></svg>').toString('base64');
const slots=[1,2,3,4,5].map(i=>({id:'s'+i,label:'콘텐츠 '+i,photos:[{id:'a'+i,dataUrl:PNG,role:'before'},{id:'b'+i,dataUrl:PNG,role:'after'}],caption:'글',customer_id:'c'+i}));
const HTML=`<!doctype html><html><head><meta charset=utf-8><style>${CSS} body{margin:0;background:#fff}</style></head><body>
<div id="root" class="wsv2"></div>
<script>window.showToast=()=>{};window.loadSlotsFromDB=()=>Promise.resolve(${JSON.stringify(slots)});window.saveSlotToDB=()=>Promise.resolve();window.deleteSlotFromDB=()=>Promise.resolve();window.WorkspaceDefaultTpl={get:()=>'',set:()=>true};</script>
<script>${STACK}</script>
<script>window.WorkspaceV2.render(document.getElementById('root'),{slots:${JSON.stringify(slots)}});</script>
</body></html>`;
fs.writeFileSync('output/_shot-home.html',HTML);
const b=await chromium.launch();
for (const [w,name] of [[1440,'pc1440'],[768,'tablet768']]) {
  const p=await b.newPage(); await p.setViewportSize({width:w,height:900});
  await p.goto('http://localhost:8091/output/_shot-home.html',{waitUntil:'load'});
  await p.waitForTimeout(150);
  await p.screenshot({path:'output/_shot-home-'+name+'.png'});
  const info=await p.evaluate(()=>{var r=document.querySelector('#root');var c=getComputedStyle(r);return {maxW:c.maxWidth,actualW:Math.round(r.getBoundingClientRect().width),cards:document.querySelectorAll('.wsv2-card').length};});
  console.log(name,JSON.stringify(info));
  await p.close();
}
await b.close();
