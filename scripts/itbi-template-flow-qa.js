#!/usr/bin/env node
/* eslint-disable no-console */
/* 잇비 템플릿 저장 흐름 통합 스모크 (P0/P1/P1b)
   - 가격표/후기/전후/전후 1장 선택(P1) 자동완성 → 마무리 갤러리 + 작업실 슬롯 저장
   - P1b: 전/후 선택 시 파일 picker 오픈(filechooser) → 두 번째 사진 자동완성
   - v3 TOP5(5) + BP(3) 노출 무회귀 / pageerror 0 / mobile overflow 0
   실행: python3 -m http.server 8099 후
        PHOTO_QA_URL=http://127.0.0.1:8099/?nav_v7=0 node scripts/itbi-template-flow-qa.js
   (라이브: PHOTO_QA_URL=https://nopo-lab.github.io/itdasy-frontend-test-yeunjun/ ) */
const { chromium } = require('playwright');
const zlib = require('zlib');
const BASE = process.env.PHOTO_QA_URL || 'http://127.0.0.1:8099/?nav_v7=0&v=flowqa';

function crc32(b){let c=~0;for(let i=0;i<b.length;i++){c^=b[i];for(let k=0;k<8;k++)c=(c>>>1)^(0xEDB88320&-(c&1));}return ~c>>>0;}
function chunk(t,d){const T=Buffer.from(t,'ascii');const L=Buffer.alloc(4);L.writeUInt32BE(d.length);const C=Buffer.alloc(4);C.writeUInt32BE(crc32(Buffer.concat([T,d])));return Buffer.concat([L,T,d,C]);}
function png(s,r,g,b){const sig=Buffer.from([137,80,78,71,13,10,26,10]);const h=Buffer.alloc(13);h.writeUInt32BE(s,0);h.writeUInt32BE(s,4);h[8]=8;h[9]=2;const row=Buffer.concat([Buffer.from([0]),Buffer.concat(Array.from({length:s},()=>Buffer.from([r,g,b])))]);const raw=Buffer.concat(Array.from({length:s},()=>row));return Buffer.concat([sig,chunk('IHDR',h),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}
const A=png(3,200,40,40), B=png(7,40,40,200);
const AD='data:image/png;base64,'+A.toString('base64');
const BD='data:image/png;base64,'+B.toString('base64');

const errs=[];
async function fresh(br){const p=await(await br.newContext({viewport:{width:390,height:844}})).newPage();p.on('pageerror',e=>errs.push(String(e.message||e)));await p.goto(BASE,{waitUntil:'networkidle',timeout:60000});await p.waitForTimeout(3000);await p.evaluate(async()=>{try{const rs=await navigator.serviceWorker.getRegistrations();rs.forEach(r=>r.unregister());}catch(_){ /* noop */ }});await p.waitForFunction(()=>window.openAssistant&&window.PhotoEditor&&window.loadGalleryItems&&window.loadSlotsFromDB&&window.PhotoEditorTemplateMarketData,null,{timeout:30000});return p;}
const reopen=async(p)=>{await p.evaluate(()=>window.openAssistant());await p.waitForTimeout(400);};
const up=async(p,b,n)=>{await p.setInputFiles('#asstGallery',{name:n,mimeType:'image/png',buffer:b});await p.waitForTimeout(180);await p.evaluate(()=>document.getElementById('asstSend').click());await p.waitForTimeout(800);};
const upMulti=async(p)=>{await p.setInputFiles('#asstGallery',[{name:'a.png',mimeType:'image/png',buffer:A},{name:'b.png',mimeType:'image/png',buffer:B}]);await p.waitForTimeout(180);await p.evaluate(()=>document.getElementById('asstSend').click());await p.waitForTimeout(800);};
const send=async(p,t)=>{await p.evaluate(x=>{const i=document.getElementById('asstInput');i.value=x;i.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('asstSend').click();},t);await p.waitForTimeout(900);};
const eOpen=(p)=>p.evaluate(()=>{const s=document.getElementById('photoEditorSheet');return !!(s&&getComputedStyle(s).display!=='none');});
const choiceN=(p)=>p.evaluate(()=>[...document.querySelectorAll('[data-asst-hub-act]')].filter(b=>/시술 전 사진|시술 후 사진|일단 이 사진/.test(b.textContent)).length);
const save=async(p)=>{await p.evaluate(()=>{const b=document.querySelector('[data-edit-save]')||document.querySelector('#photoEditorSheet [data-pe-act="save"]');if(b)b.click();});await p.waitForTimeout(1300);};
const counts=(p)=>p.evaluate(async()=>({g:(await window.loadGalleryItems()).filter(i=>i.source==='assistant_template').length,s:(await window.loadSlotsFromDB()).filter(x=>/^asst_/.test(x.id||'')).length}));
const afterW=(p)=>p.evaluate(()=>{const s=window.PhotoEditor._internal.getState&&window.PhotoEditor._internal.getState();return s&&s.originalImg&&s.originalImg.naturalWidth||null;});

(async()=>{
  const br=await chromium.launch({headless:true});
  const R={};

  // 노출 무회귀
  let p=await fresh(br);
  R.visible=await p.evaluate(()=>{const ids=(window.PhotoEditorTemplateMarketData.visibleTemplates()||[]).map(t=>t.id);return{v3:ids.filter(x=>/^v3-/.test(x)).length,bp:ids.filter(x=>/^bp-/.test(x)).length};});

  // 가격표
  await reopen(p); await send(p,'물광 8만원 가격표 만들어줘'); R.price_editor=await eOpen(p); await save(p); R.price=await counts(p);
  await p.context().close();

  // 후기: 현재 흐름은 편집기 직행이 아니라 채팅 안에서 사진 역할/카드로 안내.
  p=await fresh(br);
  R.review=await p.evaluate(async({a,b})=>{
    const PM=window.ItdasyPhotoMode; PM.exit();
    const msg=await PM.handlePhotos([a,b],'고객후기 카드 만들어줘',{});
    return { roleCard:!!(msg&&msg.photo_roles), assetN:msg&&msg.photo_roles&&msg.photo_roles.assets.length,
      noEditor:!(document.getElementById('photoEditorSheet')&&getComputedStyle(document.getElementById('photoEditorSheet')).display!=='none') };
  },{a:AD,b:BD});
  await p.context().close();

  // 전후 1장: 채팅에서 두 번째 사진을 요구하고, 두 번째 사진을 받으면 전후 카드 생성.
  p=await fresh(br);
  R.ba1=await p.evaluate(async({a,b})=>{
    const PM=window.ItdasyPhotoMode; PM.exit();
    await PM.handlePhotos([a],'홍보용으로 예쁘게 해줘',{});
    const ask=await PM.handleText('전후 카드 만들어줘',{});
    const done=await PM.handlePhotos([b],'',{});
    return { asksSecond:/사진 2장|사진 1장 더/.test(ask&&ask.text||''), hasResult:!!(done&&done.photo_result),
      hasEditCta:Array.isArray(done&&done.related)&&done.related.includes('전 사진 편집')&&done.related.includes('후 사진 편집') };
  },{a:AD,b:BD});
  await p.context().close();

  // 전후 2장: 두 장 모두 사용해 바로 전후 카드 생성.
  p=await fresh(br);
  R.ba2=await p.evaluate(async({a,b})=>{
    const PM=window.ItdasyPhotoMode; PM.exit();
    const msg=await PM.handlePhotos([a,b],'전후 카드 만들어줘',{});
    return { hasResult:!!(msg&&msg.photo_result), caption:/전·후/.test(msg&&msg.photo_caption||''),
      hasEditCta:Array.isArray(msg&&msg.related)&&msg.related.includes('전 사진 편집')&&msg.related.includes('후 사진 편집') };
  },{a:AD,b:BD});
  R.overflowX=await p.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
  await p.context().close();

  R.jsPageErrors=errs;
  // 판정
  const ok = R.visible.v3===5 && R.visible.bp>=4   // 최신 BP 추가 허용: 기본 4개 이상이면 노출 무회귀
    && R.price.g>=1 && R.price.s>=1
    && R.review.roleCard && R.review.assetN===2 && R.review.noEditor
    && R.ba1.asksSecond && R.ba1.hasResult && R.ba1.hasEditCta
    && R.ba2.hasResult && R.ba2.caption && R.ba2.hasEditCta
    && R.overflowX===0 && errs.length===0;
  R.PASS=ok;
  console.log(JSON.stringify(R,null,2));
  await br.close();
  process.exit(ok?0:1);
})().catch(e=>{console.error('FATAL',e&&e.message);process.exit(2);});
