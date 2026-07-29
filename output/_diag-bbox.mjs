import { chromium } from 'playwright';
const b=await chromium.launch();const p=await b.newPage();
await p.goto('http://localhost:8091/output/_diag-bgrect.html',{waitUntil:'load'});
const out=await p.evaluate(async()=>{
  // 인물: 투명 배경에 세로로 긴 사람(프레임 거의 채움)
  function person(){const W=1000,H=1400;const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.clearRect(0,0,W,H);x.fillStyle='rgba(200,150,120,1)';x.fillRect(W*0.2,H*0.05,W*0.6,H*0.9);return c.toDataURL('image/png');}
  const BC=window.PhotoEditorBgCompose;
  const r=await BC.compose({srcUrl:person(),preRemovedBgUrl:person(),bg:{type:'procedural',color:'#ffffff'},targetRatio:'4:5'});
  const im=new Image();await new Promise(res=>{im.onload=res;im.src=r.composedDataUrl;});
  const cv=document.createElement('canvas');cv.width=im.naturalWidth;cv.height=im.naturalHeight;const cx=cv.getContext('2d');cx.drawImage(im,0,0);
  const d=cx.getImageData(0,0,cv.width,cv.height).data;
  // 인물(주황) 픽셀 bbox
  let minY=cv.height,maxY=0,minX=cv.width,maxX=0;
  for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++){const i=(y*cv.width+x)*4;if(d[i]>150&&d[i+1]>100&&d[i+1]<200&&d[i+2]<170&&d[i]>d[i+2]){if(y<minY)minY=y;if(y>maxY)maxY=y;if(x<minX)minX=x;if(x>maxX)maxX=x;}}
  const ph=maxY-minY,pw=maxX-minX;
  return {frame:cv.width+'x'+cv.height, personFillH:+(ph/cv.height).toFixed(3), personFillW:+(pw/cv.width).toFixed(3)};
});
console.log(JSON.stringify(out));
await b.close();
