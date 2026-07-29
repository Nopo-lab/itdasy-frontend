import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto('http://localhost:8099/index.html',{waitUntil:'load'}); 
await new Promise(r=>setTimeout(r,2000));
const has=await p.evaluate(()=>typeof _dedupeCaptionText==='function');
console.log('dedupe fn global:', has);
if(has){
  const t1=await p.evaluate(()=>_dedupeCaptionText('레이어드컷 시술 완료!\n\n예약 환영합니다.\n\n레이어드컷 시술 완료!\n\n예약 환영합니다.'));
  console.log('중복문단 제거:', JSON.stringify(t1));
  const t2=await p.evaluate(()=>_dedupeCaptionText('한 줄\n한 줄\n다른 줄'));
  console.log('연속줄 제거:', JSON.stringify(t2));
}
await b.close();
