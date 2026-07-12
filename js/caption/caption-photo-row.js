/* caption-photo-row.js — 캡션 탭 사진 썸네일 줄(드래그로 순서 변경)
   [B-분할] app-caption.js 에서 분리(2026-06-30). 전역 함수 유지 — 호출부 그대로.
   상태 _captionPhotosReordered 는 이 기능 소유 → 함께 이동. 코어는 _resetCaptionPhotoOrder() 만 호출(캡슐화).
   의존(전역, 다른 파일): _capEsc(코어) / _captionSlotId / _slots / initCaptionSlotPicker.
   공개: _captionOpenSlotPicker() / _renderCaptionPhotoRow() / _removeCapPhoto() / _resetCaptionPhotoOrder() */

// ===== 캡션 탭 사진 영역 (드래그 순서 변경) =====
let _captionPhotosReordered = null; // 재정렬된 사진 배열 (null = 슬롯 기본 순서)

// [B-분할] 코어(saveCaptionToGallery 등)가 순서 상태를 초기화할 때 호출 — 상태는 이 모듈이 소유.
function _resetCaptionPhotoOrder() {
  _captionPhotosReordered = null;
}

function _captionOpenSlotPicker() {
  const picker = document.getElementById('captionSlotPicker');
  if (picker) {
    picker.style.display = 'block';
    if (typeof initCaptionSlotPicker === 'function') initCaptionSlotPicker();
    picker.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function _renderCaptionPhotoRow() {
  const strip = document.getElementById('captionPhotoThumbRow');
  if (!strip) return;

  const slot = (typeof _captionSlotId !== 'undefined' && _captionSlotId && typeof _slots !== 'undefined')
    ? _slots.find(s => s.id === _captionSlotId) : null;

  if (!slot) {
    strip.innerHTML = `<div data-caption-open-picker style="width:72px;height:72px;border-radius:10px;border:1.5px dashed var(--border);display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--text3);cursor:pointer;flex-shrink:0;"><i class="ph-duotone ph-camera" style="font-size:22px;color:var(--text-subtle);"></i></div>`;
    strip.querySelector('[data-caption-open-picker]')?.addEventListener('click', _captionOpenSlotPicker);
    return;
  }

  const basePhotos = slot.photos.filter(p => !p.hidden);
  if (!_captionPhotosReordered || _captionPhotosReordered._slotId !== _captionSlotId) {
    _captionPhotosReordered = [...basePhotos];
    _captionPhotosReordered._slotId = _captionSlotId;
  }

  strip.innerHTML = '';
  _captionPhotosReordered.forEach((p, i) => {
    const src = p.editedDataUrl || p.dataUrl || '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;flex-shrink:0;user-select:none;';
    wrap.draggable = true;
    wrap.dataset.capPhotoIdx = i;

    wrap.innerHTML = `
      <img src="${_capEsc(src)}" alt="" draggable="false" style="width:72px;height:72px;object-fit:cover;border-radius:10px;display:block;pointer-events:none;">
      <button data-remove-cap-photo data-photo-index="${i}" style="position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;border:none;background:rgba(0,0,0,0.55);color:#fff;font-size:11px;line-height:1;cursor:pointer;">×</button>
      <div style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);font-size:8px;color:rgba(255,255,255,0.8);background:rgba(0,0,0,0.35);border-radius:3px;padding:0 3px;">${i+1}</div>
    `;
    wrap.querySelector('[data-remove-cap-photo]')?.addEventListener('click', e => {
      _removeCapPhoto(Number(e.currentTarget.dataset.photoIndex), e);
    });

    // HTML5 drag (desktop + PWA)
    wrap.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', String(i)); wrap.style.opacity = '0.4'; });
    wrap.addEventListener('dragend', () => wrap.style.opacity = '1');
    wrap.addEventListener('dragover', e => { e.preventDefault(); wrap.style.outline = '2px solid var(--accent)'; });
    wrap.addEventListener('dragleave', () => wrap.style.outline = '');
    wrap.addEventListener('drop', e => {
      e.preventDefault(); wrap.style.outline = '';
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const toIdx = parseInt(wrap.dataset.capPhotoIdx, 10);
      if (isNaN(fromIdx) || fromIdx === toIdx) return;
      const arr = [..._captionPhotosReordered];
      const [removed] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, removed);
      _captionPhotosReordered = arr;
      _captionPhotosReordered._slotId = _captionSlotId;
      _renderCaptionPhotoRow();
    });

    // Long-press (300ms) → touch drag
    let _lpTimer = null, _lpActive = false;
    wrap.addEventListener('touchstart', () => {
      _lpTimer = setTimeout(() => {
        _lpActive = true;
        wrap.style.opacity = '0.5';
        if (navigator.vibrate) navigator.vibrate(20);
      }, 300);
    }, { passive: true });
    wrap.addEventListener('touchend', () => {
      clearTimeout(_lpTimer);
      if (_lpActive) { wrap.style.opacity = '1'; _lpActive = false; }
    }, { passive: true });
    wrap.addEventListener('touchmove', e => {
      if (!_lpActive) { clearTimeout(_lpTimer); return; }
      e.preventDefault();
      const touch = e.touches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('[data-cap-photo-idx]');
      if (el && el !== wrap) {
        const fromIdx = parseInt(wrap.dataset.capPhotoIdx, 10);
        const toIdx   = parseInt(el.dataset.capPhotoIdx, 10);
        const arr = [..._captionPhotosReordered];
        const [removed] = arr.splice(fromIdx, 1);
        arr.splice(toIdx, 0, removed);
        _captionPhotosReordered = arr;
        _captionPhotosReordered._slotId = _captionSlotId;
        _renderCaptionPhotoRow();
      }
    }, { passive: false });

    strip.appendChild(wrap);
  });

  const addBtn = document.createElement('div');
  addBtn.style.cssText = 'width:72px;height:72px;border-radius:10px;border:1.5px dashed var(--border);display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--text3);cursor:pointer;flex-shrink:0;';
  addBtn.textContent = '+';
  addBtn.onclick = _captionOpenSlotPicker;
  strip.appendChild(addBtn);
}

function _removeCapPhoto(idx, e) {
  e?.stopPropagation();
  if (!_captionPhotosReordered) return;
  const slotId = _captionPhotosReordered._slotId;
  _captionPhotosReordered = _captionPhotosReordered.filter((_, i) => i !== idx);
  _captionPhotosReordered._slotId = slotId;
  _renderCaptionPhotoRow();
}
