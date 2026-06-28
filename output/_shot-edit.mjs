import fs from 'fs'; import { chromium } from 'playwright';
const rd=f=>fs.readFileSync(f,'utf8');
const FCSS=rd('css/workspace-v2-flow.css');
const FSTACK=[
 'js/photo-editor/template-fit-text.js','js/photo-editor/template-slots.js','js/photo-editor/template-pack-beauty-data.js',
 'js/photo-editor/template-market-data.js','js/photo-editor/template-renderer-beauty-pack.js','js/photo-editor/template-renderer-beauty-pack-draws.js',
 'js/photo-editor/template-renderer-wm-pack-draws.js','js/photo-editor/premium-templates.js','js/photo-editor/template-thumb.js',
 'js/workspace/workspace-tpl-edit.js','js/workspace/workspace-v2-home.js','js/workspace/workspace-state.js','js/workspace/workspace-v2-flow.js',
].map(rd).join('\n;\n');
function tallPhoto(){ return 'data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#cdd2d8"/><circle cx="300" cy="160" r="120" fill="#e9c4a8"/><text x="300" y="60" font-size="40" text-anchor="middle" fill="#c0392b">TOP-얼굴</text><rect x="180" y="320" width="240" height="560" fill="#b07a52"/><text x="300" y="860" font-size="36" text-anchor="middle" fill="#fff">BOTTOM</text></svg>').toString('base64'); }
const PNG=tallPhoto();
const HTML=`<!doctype html><html><head><meta charset=utf-8><style>${FCSS}</style></head><body><script>
 window._uid=()=>'id_'+Math.random().toString(36).slice(2); window.uid=window._uid; window.showToast=()=>{}; window.confirm=()=>true; window.renderScenarioSelector=(c)=>{c.innerHTML='';};
 window.WorkspaceAdapter={ applyWorkspaceTemplate:()=>Promise.resolve({ok:true,dataUrl:'data:img/x'}), applyWorkspaceCorrections:()=>Promise.resolve({ok:true,dataUrl:'x'}), generateCaption:()=>Promise.resolve({ok:true,caption:'x',hashtags:[]}), instagram:()=>({connected:false}), instagramProfile:()=>({connected:false}), recentCustomers:()=>Promise.resolve([]), saveItem:()=>Promise.resolve({ok:true}), setCaptionTemplate:()=>Promise.resolve({ok:true}) };
 window.Customer={search:()=>[],list:()=>Promise.resolve([])}; window.WorkspaceV2={refresh:()=>{}};
</script><script>${FSTACK}</script></body></html>`;
fs.writeFileSync('output/_shot-edit.html',HTML);
const b=await chromium.launch();
for (const [w,name] of [[420,'mobile'],[1440,'pc']]) {
  const p=await b.newPage(); await p.setViewportSize({width:w,height:880});
  await p.goto('http://localhost:8091/output/_shot-edit.html',{waitUntil:'load'});
  const slot={id:'s',workspaceContext:{templatePurpose:'before_after',type:'before_after'},photos:[{id:'a',dataUrl:PNG,role:'before'},{id:'b',dataUrl:PNG,role:'after'}]};
  await p.evaluate(s=>window.WorkspaceFlow.open({startScreen:'edit',cat:'ba',slot:s}),slot);
  await p.waitForTimeout(300);
  await p.screenshot({path:'output/_shot-edit-'+name+'.png'});
  await p.close();
}
await b.close(); console.log('shot done');
