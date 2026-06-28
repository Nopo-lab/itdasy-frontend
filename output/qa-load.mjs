import { chromium } from 'playwright';
const b=await chromium.launch(); const pg=await b.newPage();
const errs=[];
pg.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
pg.on('console',m=>{ if(m.type()==='error'){ const t=m.text();
  if(/401|403|Failed to load resource|net::ERR|ERR_|Unauthorized|fetch|api|supabase|persona|token|CORS|favicon/i.test(t)) return; // 인증/네트워크 노이즈 제외
  errs.push('CONSOLE: '+t);
}});
await pg.goto('http://localhost:8097/index.html',{waitUntil:'load',timeout:15000}).catch(e=>errs.push('GOTO: '+e.message));
await pg.waitForTimeout(2500);
// 핵심 전역이 떴는지(파일 로드 성공 지표)
const ok=await pg.evaluate(()=>({
  flow: !!window.WorkspaceFlow, caption: !!window.CaptionEngine,
  build: window.__LATEST_BUILD__||null, appbuild: window.APP_BUILD||null,
}));
console.log('globals:', JSON.stringify(ok));
console.log('JS errors (auth/net 제외):', errs.length);
errs.slice(0,10).forEach(e=>console.log('  '+e));
await b.close();
