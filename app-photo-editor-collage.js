/* 잇데이 — 스마트 콜라주 (v298)
   사진 2~6장 → 레이아웃 선택 → 캔버스 합성 → 편집기 전달 */
(function () {
  'use strict';
  if (window.PhotoEditorCollage) return;

  const LAYOUTS = {
    2: [
      { id: 'lr', name: '좌우', cells: [{x:0,y:0,w:.5,h:1},{x:.5,y:0,w:.5,h:1}] },
      { id: 'tb', name: '상하', cells: [{x:0,y:0,w:1,h:.5},{x:0,y:.5,w:1,h:.5}] },
      { id: 'ba', name: 'Before/After', cells: [{x:0,y:0,w:.5,h:1},{x:.5,y:0,w:.5,h:1}], labels: ['BEFORE', 'AFTER'] },
    ],
    3: [
      { id: '1p2', name: '1+2', cells: [{x:0,y:0,w:1,h:.5},{x:0,y:.5,w:.5,h:.5},{x:.5,y:.5,w:.5,h:.5}] },
      { id: '2p1', name: '2+1', cells: [{x:0,y:0,w:.5,h:.5},{x:.5,y:0,w:.5,h:.5},{x:0,y:.5,w:1,h:.5}] },
      { id: 'step3', name: '시술 과정', cells: [{x:0,y:0,w:1/3,h:1},{x:1/3,y:0,w:1/3,h:1},{x:2/3,y:0,w:1/3,h:1}], labels: ['1', '2', '3'] },
    ],
    4: [
      { id: 'grid4', name: '그리드', cells: [{x:0,y:0,w:.5,h:.5},{x:.5,y:0,w:.5,h:.5},{x:0,y:.5,w:.5,h:.5},{x:.5,y:.5,w:.5,h:.5}] },
      { id: 'step4', name: '시술 과정', cells: [{x:0,y:0,w:.25,h:1},{x:.25,y:0,w:.25,h:1},{x:.5,y:0,w:.25,h:1},{x:.75,y:0,w:.25,h:1}], labels: ['1','2','3','4'] },
    ],
    5: [
      { id: '1p4', name: '1+4', cells: [{x:0,y:0,w:1,h:.5},{x:0,y:.5,w:.25,h:.5},{x:.25,y:.5,w:.25,h:.5},{x:.5,y:.5,w:.25,h:.5},{x:.75,y:.5,w:.25,h:.5}] },
    ],
    6: [
      { id: 'grid6', name: '2x3', cells: [{x:0,y:0,w:1/3,h:.5},{x:1/3,y:0,w:1/3,h:.5},{x:2/3,y:0,w:1/3,h:.5},{x:0,y:.5,w:1/3,h:.5},{x:1/3,y:.5,w:1/3,h:.5},{x:2/3,y:.5,w:1/3,h:.5}] },
    ],
  };

  let _images = [];
  let _selectedLayout = null;
  let _ratio = '1:1';
  let _gap = 4;

  function _toast(msg) { if (window.showToast) window.showToast(msg); }

  function _layoutChips(n) {
    const list = LAYOUTS[n] || LAYOUTS[2];
    return list.map((l, i) =>
      `<button type="button" class="pe-chip-btn${i === 0 ? ' on' : ''}" data-collage-layout="${l.id}">${l.name}</button>`
    ).join('');
  }

  function open() {
    _images = [];
    _selectedLayout = null;
    let pop = document.getElementById('peCollagePop');
    if (!pop) { pop = document.createElement('div'); pop.id = 'peCollagePop'; document.body.appendChild(pop); }
    pop.style.cssText = 'position:fixed;inset:0;z-index:10100;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:16px;';
    pop.innerHTML = `<div style="background:var(--surface,#1e1e24);color:var(--text1,#e8e8ec);width:100%;max-width:420px;border-radius:20px;padding:20px;max-height:88vh;overflow-y:auto;">
      <div style="font-size:16px;font-weight:800;margin-bottom:12px;">콜라주 만들기</div>
      <input type="file" id="collageFileInput" accept="image/*" multiple style="display:none;">
      <button data-collage-pick style="width:100%;height:48px;border:2px dashed rgba(213,138,149,0.5);border-radius:14px;background:transparent;color:#D58A95;font-size:13px;font-weight:700;cursor:pointer;">사진 고르기 (2~6장)</button>
      <div id="collageThumbRow" style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;"></div>
      <div id="collageLayoutSection" style="display:none;margin-top:14px;">
        <div style="font-size:12px;font-weight:700;color:#aaa;margin-bottom:6px;">레이아웃</div>
        <div id="collageLayoutChips" style="display:flex;gap:6px;flex-wrap:wrap;"></div>
      </div>
      <div id="collageOptionsSection" style="display:none;margin-top:10px;">
        <div style="display:flex;gap:6px;margin-bottom:8px;">
          <button type="button" class="pe-chip-btn on" data-collage-ratio="1:1">1:1</button>
          <button type="button" class="pe-chip-btn" data-collage-ratio="4:5">4:5 피드</button>
          <button type="button" class="pe-chip-btn" data-collage-ratio="9:16">9:16 스토리</button>
        </div>
        <label style="display:flex;align-items:center;gap:8px;font-size:11px;color:#aaa;">간격 <input type="range" min="0" max="16" value="4" data-collage-gap style="flex:1;"> <span data-collage-gap-val>4</span>px</label>
      </div>
      <canvas id="collagePreviewCv" width="360" height="360" style="display:none;width:100%;border-radius:12px;margin-top:12px;background:#111;"></canvas>
      <div style="display:flex;gap:8px;margin-top:14px;">
        <button data-collage-close style="flex:1;height:42px;border:1px solid rgba(255,255,255,0.12);border-radius:12px;background:transparent;color:#ccc;font-weight:600;cursor:pointer;">취소</button>
        <button id="collageCreateBtn" disabled style="flex:1.5;height:42px;border:none;border-radius:12px;background:linear-gradient(135deg,#D58A95,#e8a87c);color:#fff;font-weight:800;cursor:pointer;opacity:0.4;">콜라주 만들기</button>
      </div>
    </div>`;
    pop.querySelector('[data-collage-pick]').addEventListener('click', () => pop.querySelector('#collageFileInput').click());
    pop.querySelector('[data-collage-close]').addEventListener('click', () => { pop.style.display = 'none'; });
    pop.querySelector('#collageFileInput').addEventListener('change', e => _onFilesSelected(e, pop));
    pop.querySelector('#collageCreateBtn').addEventListener('click', () => _create(pop));
    pop.querySelectorAll('[data-collage-ratio]').forEach(btn => btn.addEventListener('click', () => {
      _ratio = btn.dataset.collageRatio;
      pop.querySelectorAll('[data-collage-ratio]').forEach(b => b.classList.toggle('on', b === btn));
      _renderPreview(pop);
    }));
    const gapInp = pop.querySelector('[data-collage-gap]');
    if (gapInp) gapInp.addEventListener('input', () => {
      _gap = +gapInp.value;
      const v = pop.querySelector('[data-collage-gap-val]');
      if (v) v.textContent = _gap;
      _renderPreview(pop);
    });
  }

  function _onFilesSelected(e, pop) {
    const files = Array.from(e.target.files || []).slice(0, 6);
    if (files.length < 2) return _toast('최소 2장을 선택해주세요');
    _images = [];
    let loaded = 0;
    const thumbRow = pop.querySelector('#collageThumbRow');
    thumbRow.innerHTML = '';
    files.forEach(f => {
      const img = new Image();
      const url = URL.createObjectURL(f);
      img.onload = () => {
        URL.revokeObjectURL(url);
        loaded++;
        const thumb = document.createElement('div');
        thumb.style.cssText = 'width:48px;height:48px;border-radius:8px;overflow:hidden;border:1.5px solid rgba(255,255,255,0.1);';
        thumb.innerHTML = `<img src="${img.src}" style="width:100%;height:100%;object-fit:cover;">`;
        thumbRow.appendChild(thumb);
        if (loaded === files.length) _onAllLoaded(pop);
      };
      img.onerror = () => { loaded++; };
      img.src = url;
      _images.push(img);
    });
  }

  function _onAllLoaded(pop) {
    const n = _images.length;
    const layouts = LAYOUTS[n] || LAYOUTS[2];
    _selectedLayout = layouts[0];
    const section = pop.querySelector('#collageLayoutSection');
    section.style.display = 'block';
    const opts = pop.querySelector('#collageOptionsSection');
    if (opts) opts.style.display = 'block';
    pop.querySelector('#collageLayoutChips').innerHTML = _layoutChips(n);
    pop.querySelectorAll('[data-collage-layout]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.collageLayout;
        _selectedLayout = layouts.find(l => l.id === id) || layouts[0];
        pop.querySelectorAll('[data-collage-layout]').forEach(b => b.classList.toggle('on', b === btn));
        _renderPreview(pop);
      });
    });
    const createBtn = pop.querySelector('#collageCreateBtn');
    createBtn.disabled = false;
    createBtn.style.opacity = '1';
    _renderPreview(pop);
  }

  function _ratioDims(base) {
    if (_ratio === '4:5') return [base, Math.round(base * 5 / 4)];
    if (_ratio === '9:16') return [base, Math.round(base * 16 / 9)];
    return [base, base];
  }

  function _renderPreview(pop) {
    const cv = pop.querySelector('#collagePreviewCv');
    if (!cv || !_selectedLayout) return;
    cv.style.display = 'block';
    const [pw, ph] = _ratioDims(360);
    _drawCollage(cv, _images, _selectedLayout, pw, ph);
  }

  function _drawCollage(cv, images, layout, W, H) {
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#1a1a20';
    ctx.fillRect(0, 0, W, H);
    const gap = _gap != null ? _gap : Math.round(W * 0.005);
    const r = Math.round(W * 0.015);
    layout.cells.forEach((c, i) => {
      if (i >= images.length) return;
      const img = images[i];
      const dx = Math.round(c.x * W) + gap, dy = Math.round(c.y * H) + gap;
      const dw = Math.round(c.w * W) - gap * 2, dh = Math.round(c.h * H) - gap * 2;
      const sAR = img.naturalWidth / img.naturalHeight, dAR = dw / dh;
      let sx, sy, sw, sh;
      if (sAR > dAR) { sh = img.naturalHeight; sw = sh * dAR; sx = (img.naturalWidth - sw) / 2; sy = 0; }
      else { sw = img.naturalWidth; sh = sw / dAR; sx = 0; sy = (img.naturalHeight - sh) / 2; }
      ctx.save();
      _roundRect(ctx, dx, dy, dw, dh, r);
      ctx.clip();
      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
      ctx.restore();
    });
    if (layout.labels) _drawLabels(ctx, layout, W, H, gap);
  }

  function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function _drawLabels(ctx, layout, W, H, gap) {
    ctx.font = `700 ${Math.round(W * 0.028)}px Pretendard, "Noto Sans KR", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    layout.cells.forEach((c, i) => {
      if (i >= layout.labels.length) return;
      const label = layout.labels[i];
      const cx = Math.round((c.x + c.w / 2) * W);
      const cy = Math.round(c.y * H) + gap + Math.round(W * 0.015);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const tw = ctx.measureText(label).width + 16;
      ctx.fillRect(cx - tw / 2, cy - 2, tw, Math.round(W * 0.038));
      ctx.fillStyle = '#fff';
      ctx.fillText(label, cx, cy);
    });
  }

  function _create(pop) {
    if (_images.length < 2 || !_selectedLayout) return;
    const result = _composeHQ(_images, _selectedLayout);
    pop.style.display = 'none';
    if (window.PhotoEditor) {
      window.PhotoEditor.open({ src: result });
      _toast('콜라주 완성! 텍스트·보정 추가 가능');
    }
  }

  function _composeHQ(images, layout) {
    const cv = document.createElement('canvas');
    const [ow, oh] = _ratioDims(1080);
    _drawCollage(cv, images, layout, ow, oh);
    return cv.toDataURL('image/jpeg', 0.93);
  }

  window.PhotoEditorCollage = { open };
})();
