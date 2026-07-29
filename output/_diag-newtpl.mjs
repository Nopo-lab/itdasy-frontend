import fs from 'fs'; import path from 'path'; import { chromium } from 'playwright';
const ROOT=path.resolve('.'); const rd=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const STACK=[
  'js/photo-editor/template-fit-text.js','js/photo-editor/template-slots.js','js/photo-editor/template-pack-beauty-data.js',
  'js/photo-editor/template-market-data.js','js/photo-editor/template-renderer-beauty-pack.js','js/photo-editor/template-renderer-beauty-pack-draws.js',
  'js/photo-editor/template-renderer-wm-pack-draws.js','js/photo-editor/premium-templates.js','js/photo-editor/template-thumb.js',
].map(rd).join('\n;\n');
const html=`<!doctype html><html><body><script>${STACK}</script></body></html>`;
fs.writeFileSync('output/_diag-newtpl.html',html);
const b=await chromium.launch(); const p=await b.newPage(); const errs=[];
p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8091/output/_diag-newtpl.html',{waitUntil:'load'});
const ids=['bp-ba-skin-acne-pink','bp-ba-hair-extension-polaroid','bp-ba-nail-polaroid','bp-ba-nail-pink-polaroid','wm-ba-story'];
const out=await p.evaluate((ids)=>{
  const T=window.PhotoEditorTemplateThumb; const res={};
  if(!T||!T.make) return {err:'no thumb'};
  ids.forEach(function(id){
    try{ var ratio = id==='wm-ba-story'?'9:16':'4:5'; var url=T.make({id:id,label:id},{ratio:ratio,shopName:'테스트샵'});
      res[id]={ok:!!url&&/^data:image/.test(url), len:url?url.length:0}; }
    catch(e){ res[id]={ok:false,err:String(e.message||e)}; }
  });
  return res;
},ids);
console.log(JSON.stringify(out,null,1));
if(errs.length)console.log('PAGE ERR',errs.slice(0,3));
await b.close();
