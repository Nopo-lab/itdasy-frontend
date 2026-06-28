import { chromium } from 'playwright';
import path from 'path';
const file = 'file://' + path.resolve('workspace-mockup-v3.html');
const b = await chromium.launch();
const errs = [];
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
p.on('pageerror', e => errs.push('PAGEERR: '+e.message));
await p.goto(file, { waitUntil:'networkidle' });
await p.waitForTimeout(400);
await p.screenshot({ path: 'output/v3-deck.png', fullPage: true });
const info = await p.evaluate(()=>{
  const out=[];
  document.querySelectorAll('.phone').forEach((ph,i)=>{
    const r=ph.getBoundingClientRect();
    out.push({i, w:Math.round(r.width), h:Math.round(r.height), oflowX: ph.scrollWidth>ph.clientWidth+1});
  });
  return {n:document.querySelectorAll('.phone').length, hero:!!document.getElementById('hero-knob'), car:!!document.getElementById('capcar'), phones:out};
});
// test hero drag JS + carousel JS work
const drag = await p.evaluate(()=>{
  const knob=document.getElementById('hero-knob'); const before=document.getElementById('hero-before');
  const w0=before.style.width;
  const ba=document.getElementById('hero-ba'); const r=ba.getBoundingClientRect();
  ba.dispatchEvent(new MouseEvent('mousedown',{clientX:r.left+r.width*0.75,bubbles:true}));
  window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
  return {before_after_width:before.style.width};
});
const car = await p.evaluate(()=>{
  const c=document.getElementById('capcar'); c.querySelector('.next').click();
  const on=c.querySelector('.slide.on'); return on.querySelector('.badge').textContent;
});
console.log(JSON.stringify(info,null,1));
console.log('hero drag width after click@75%:', drag.before_after_width);
console.log('carousel after next click badge:', car);
console.log('CONSOLE ERRORS:', errs.length, JSON.stringify(errs.slice(0,8)));
await b.close();
