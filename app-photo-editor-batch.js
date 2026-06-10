/* 사진 편집기 — 배치 편집 모듈
   슬롯 사진에 현재 보정/필름/그림자/워터마크/비율을 한 번에 적용한다.
*/
(function () {
  'use strict';

  let _job = null;

  function _getCurrentSlot() {
    try {
      if (typeof window._slots === 'undefined' || typeof window._popupSlotId === 'undefined') return null;
      const slot = (window._slots || []).find(s => s && s.id === window._popupSlotId);
      if (!slot) return null;
      const photos = _visiblePhotos(slot);
      if (photos.length < 2) return null;
      return { id: slot.id, label: slot.label || '슬롯', count: photos.length };
    } catch (err) {
      console.warn('[photo-batch] 슬롯 확인 실패:', err);
      return null;
    }
  }

  async function _applyToSlot(state, helpers, buttonEl) {
    if (_job && _job.running) {
      _job.cancelled = true;
      _toast(helpers, '배치 편집을 중단할게요');
      return;
    }
    const slotInfo = _getCurrentSlot();
    if (!slotInfo) return _toast(helpers, '현재 슬롯을 찾지 못했어요');
    const slot = (window._slots || []).find(s => s && s.id === slotInfo.id);
    const photos = _visiblePhotos(slot);
    if (!photos.length) return _toast(helpers, '적용할 사진이 없어요');
    // [2026-06-10] confirm → _askConfirm (인라인 다이얼로그, UI 블로킹 제거)
    if (!(await _confirmApply(photos.length))) return;

    const settings = _buildSettings(state);
    const restoreText = _setBusy(buttonEl, photos.length);
    const counts = { done: 0, fail: 0 };
    _job = { running: true, cancelled: false };
    try {
      await _runQueue(photos, settings, helpers, buttonEl, counts);
      await _saveSlot(slot);
      const stopped = _job.cancelled ? '중단됨: ' : '';
      _toast(helpers, stopped + counts.done + '장 성공, ' + counts.fail + '장 실패');
      _notifyGallery(slot.id, counts.done);
    } finally {
      _restoreButton(buttonEl, restoreText);
      _job = null;
    }
  }

  async function _runQueue(photos, settings, helpers, buttonEl, counts) {
    let cursor = 0;
    const total = photos.length;
    const concurrency = _isMobile() ? 1 : 2;
    const worker = async () => {
      while (cursor < total && _job && !_job.cancelled) {
        const photo = photos[cursor++];
        const ok = await _applyOne(photo, settings, helpers);
        if (ok) counts.done++;
        else counts.fail++;
        _updateBusy(buttonEl, counts.done + counts.fail, total);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));
  }

  async function _applyOne(photo, settings, helpers) {
    try {
      let srcUrl = photo && (photo.dataUrl || photo.editedDataUrl);
      if (!srcUrl) return false;
      const bgResult = await _maybeApplyBg(photo, srcUrl, settings);
      if (bgResult) srcUrl = bgResult;
      const img = await _loadImage(srcUrl);
      const result = await _drawAdjusted(img, settings, helpers);
      if (!result) return false;
      photo.editedDataUrl = result;
      return true;
    } catch (err) {
      console.warn('[photo-batch] 사진 보정 실패:', err);
      return false;
    }
  }

  async function _maybeApplyBg(photo, srcUrl, settings) {
    const bgId = settings.bg && settings.bg.id;
    if (!bgId || !window.PhotoEditorBgCompose || typeof window.GALLERY_BG_LIST !== 'function') return null;
    const bg = window.GALLERY_BG_LIST().find(item => item && item.id === bgId);
    if (!bg) return null;
    const result = await window.PhotoEditorBgCompose.compose({
      srcUrl,
      bg,
      targetRatio: settings.ratio !== 'original' ? settings.ratio : '1:1',
      preRemovedBgUrl: photo.removedBgUrl,
      shadow: settings.shadow,
    });
    photo.removedBgUrl = result.removedBgDataUrl;
    return result.composedDataUrl;
  }

  function _loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function _drawAdjusted(img, settings, helpers) {
    try {
      const crop = _computeCrop(img, settings.ratio || 'original');
      const cv = document.createElement('canvas');
      cv.width = crop.dw; cv.height = crop.dh;
      const ctx = cv.getContext('2d');
      const a = settings.adjust || {};
      const temp = a.temperature || 0;
      const sepia = Math.max(0, temp) / 100;
      const contrast = 100 + Math.max(0, -temp) * 0.3;
      ctx.filter = 'brightness(' + (a.brightness || 100) + '%) saturate(' + (a.saturate || 100) + '%) contrast(' + contrast + '%) sepia(' + sepia + ')';
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.dw, crop.dh);
      ctx.filter = 'none';
      await _applySharpness(cv, a.sharpness || 0, helpers);
      _applyBeauty(ctx, crop.dw, crop.dh, settings.beauty, helpers);
      _applyFilm(cv, settings.film, helpers);
      _drawWatermark(ctx, crop.dw, crop.dh, settings.watermark, helpers);
      return cv.toDataURL('image/jpeg', 0.92);
    } catch (err) {
      console.warn('[photo-batch] 캔버스 합성 실패:', err);
      return null;
    }
  }

  function _computeCrop(img, ratio) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    if (ratio === '1:1' || ratio === '4:5' || ratio === '9:16') return _ratioCrop(iw, ih, ratio);
    const k = Math.min(1080, iw) / iw;
    return { sx: 0, sy: 0, sw: iw, sh: ih, dw: Math.round(iw * k), dh: Math.round(ih * k) };
  }

  function _ratioCrop(iw, ih, ratio) {
    const parts = ratio.split(':').map(Number);
    const targetAR = parts[0] / parts[1], imgAR = iw / ih;
    let sw, sh, sx, sy;
    if (imgAR > targetAR) { sh = ih; sw = Math.round(ih * targetAR); sx = Math.round((iw - sw) / 2); sy = 0; }
    else { sw = iw; sh = Math.round(iw / targetAR); sx = 0; sy = Math.round((ih - sh) / 2); }
    const dw = 1080;
    return { sx, sy, sw, sh, dw, dh: Math.round(dw / targetAR) };
  }

  async function _applySharpness(canvas, sharpness, helpers) {
    if (sharpness <= 10) return;
    const WF = window.PhotoEditorWorkerFilter;
    if (WF && WF.shouldUse && WF.shouldUse(canvas)) {
      try { await WF.unsharpCanvas(canvas, sharpness / 100); return; } catch (_e) { void _e; }
    }
    if (helpers && typeof helpers.unsharpMask === 'function') {
      helpers.unsharpMask(canvas.getContext('2d'), canvas.width, canvas.height, sharpness / 100);
    }
  }

  function _applyBeauty(ctx, dw, dh, beauty, helpers) {
    if (!helpers || typeof helpers.applyDrawHook !== 'function') return;
    try { helpers.applyDrawHook('beauty', ctx, dw, dh, beauty || {}, helpers); }
    catch (err) { console.warn('[photo-batch] 뷰티 보정 실패:', err); }
  }

  function _applyFilm(canvas, film, helpers) {
    if (!film || !film.presetId || !helpers || typeof helpers.applyDrawHook !== 'function') return;
    try { helpers.applyDrawHook('gl_film', canvas, { film }, helpers); }
    catch (err) { console.warn('[photo-batch] 필름 보정 실패:', err); }
  }

  function _drawWatermark(ctx, w, h, watermark, helpers) {
    if (!watermark || !watermark.value || !helpers || typeof helpers.drawWatermark !== 'function') return;
    try { helpers.drawWatermark(ctx, w, h, watermark); }
    catch (err) { console.warn('[photo-batch] 워터마크 실패:', err); }
  }

  async function _saveSlot(slot) {
    try {
      if (typeof window.saveSlotToDB === 'function') await window.saveSlotToDB(slot);
    } catch (err) {
      console.warn('[photo-batch] 슬롯 저장 실패:', err);
    }
  }

  function _notifyGallery(slotId, count) {
    try {
      window.dispatchEvent(new CustomEvent('itdasy:gallery:photo-replaced', {
        detail: { kind: 'batch_edit', slotId, count },
      }));
    } catch (err) {
      console.warn('[photo-batch] 갤러리 갱신 알림 실패:', err);
    }
  }

  function _visiblePhotos(slot) {
    return ((slot && slot.photos) || []).filter(p => p && !p.hidden);
  }

  function _buildSettings(state) {
    return {
      adjust: _clone(state && state.adjust),
      beauty: _clone(state && state.beauty),
      film: _clone(state && state.film),
      watermark: _clone(state && state.watermark),
      shadow: _clone((state && state.shadow) || { mode: 'none' }),
      ratio: (state && state.ratio) || 'original',
      bg: _clone(state && state.bg),
    };
  }

  function _clone(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function _isMobile() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  }

  function _confirmApply(count) {
    const msg = '슬롯 사진 ' + count + '장에 현재 보정을 일괄 적용할까요? 원본은 보존되고 편집본만 갱신됩니다.';
    // [2026-06-10] 인라인 다이얼로그 우선 (확정 true / 취소 false 로 resolve)
    if (window._inlineConfirm) {
      return new Promise((resolve) => window._inlineConfirm(msg, () => resolve(true), () => resolve(false)));
    }
    if (typeof window.confirm !== 'function') return Promise.resolve(true);
    return Promise.resolve(window.confirm(msg));
  }

  function _setBusy(buttonEl, total) {
    if (!buttonEl) return '';
    const text = buttonEl.textContent;
    buttonEl.disabled = false;
    buttonEl.textContent = '배치 보정 중... 0/' + total + ' · 중단';
    return text;
  }

  function _updateBusy(buttonEl, current, total) {
    if (buttonEl) buttonEl.textContent = '배치 보정 중... ' + current + '/' + total + ' · 중단';
  }

  function _restoreButton(buttonEl, text) {
    if (!buttonEl) return;
    buttonEl.disabled = false;
    buttonEl.textContent = text;
  }

  function _toast(helpers, message) {
    if (helpers && typeof helpers.toast === 'function') helpers.toast(message);
  }

  window.PhotoEditorBatch = {
    getCurrentSlot: _getCurrentSlot,
    applyToSlot: _applyToSlot,
  };
})();
