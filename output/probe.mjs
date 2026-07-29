import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('http://localhost:8099/index.html',{waitUntil:'load'});
await new Promise(r=>setTimeout(r,2500));
await p.waitForLoadState('load').catch(()=>{});
const info = await p.evaluate(()=>({
  beautyEngine: !!(window.PhotoEditorBeautyEngine && window.PhotoEditorBeautyEngine.apply),
  bgCompose: !!(window.PhotoEditorBgCompose && window.PhotoEditorBgCompose.compose),
  maskApp: !!window.MaskApplication,
  maskBeautySync: !!(window.MaskApplication && window.MaskApplication.getMasksForBeautySync),
  workerFilter: !!(window.PhotoEditorWorkerFilter && window.PhotoEditorWorkerFilter.adjustCanvas),
  flow: !!window.WorkspaceFlow,
}));
console.log(JSON.stringify(info,null,2));
await b.close();
