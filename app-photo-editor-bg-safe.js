/* 사진 편집기 — 누끼 안정화 래퍼 */
(function () {
  'use strict';
  if (window.PhotoEditorBgSafe) return;

  const MAX_SIDE = 2560;
  let wrapped = false;

  function _emit(message, detail) {
    window.dispatchEvent(new CustomEvent('itdasy:photo-bg-status', { detail: Object.assign({ message }, detail || {}) }));
  }

  async function _srcToDataUrl(src) {
    const s = String(src || '');
    if (!s) throw new Error('사진을 찾지 못했어요');
    if (s.startsWith('data:')) return s;
    const r = await fetch(s);
    if (!r.ok) throw new Error('사진을 읽지 못했어요');
    const b = await r.blob();
    return await _blobToDataUrl(b);
  }

  function _blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
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

  async function _canvasToDataUrl(canvas, mime, quality) {
    return await new Promise((resolve) => {
      if (!canvas.toBlob) return resolve(canvas.toDataURL(mime, quality));
      canvas.toBlob(blob => resolve(blob ? _blobToDataUrl(blob) : canvas.toDataURL(mime, quality)), mime, quality);
    });
  }

  async function prepareSource(src) {
    const dataUrl = await _srcToDataUrl(src);
    const img = await _loadImage(dataUrl);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) throw new Error('사진 크기를 읽지 못했어요');
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    const outW = Math.max(1, Math.round(w * scale));
    const outH = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, outW, outH);
    ctx.drawImage(img, 0, 0, outW, outH);
    const normalized = await _canvasToDataUrl(canvas, 'image/jpeg', 0.92);
    return { src: normalized, width: outW, height: outH, changed: normalized !== dataUrl || scale < 1 };
  }

  function _easyError(err, retried) {
    const msg = String((err && err.message) || '');
    if (msg.includes('한도')) return err;
    return new Error(retried
      ? '이 사진은 누끼가 불안정해요. 사진을 한 번 정리해서 다시 시도했지만 실패했어요.'
      : '누끼가 실패했어요. 사진을 정리해서 다시 시도해볼게요.');
  }

  async function _run(original, srcUrl, bgId, ratio, preRemovedBgUrl) {
    if (preRemovedBgUrl) return await original(srcUrl, bgId, ratio, preRemovedBgUrl);
    let prepared = null;
    try {
      _emit('사진을 누끼용으로 정리 중…', { phase: 'prepare' });
      prepared = await prepareSource(srcUrl);
    } catch (err) {
      console.warn('[bg-safe] 사진 정리 실패, 원본으로 진행:', err);
    }
    const firstSrc = prepared ? prepared.src : srcUrl;
    try {
      _emit('누끼 처리 중…', { phase: 'cutout', prepared: !!prepared });
      return await original(firstSrc, bgId, ratio, null);
    } catch (firstErr) {
      if (prepared) {
        _emit('정리한 사진 누끼 실패, 원본으로 한 번 더 시도 중…', { phase: 'retry-original' });
        try { return await original(srcUrl, bgId, ratio, null); }
        catch (secondErr) { throw _easyError(secondErr, true); }
      }
      _emit('원본 누끼 실패, 사진 정리 후 재시도 중…', { phase: 'retry' });
      try {
        prepared = await prepareSource(srcUrl);
        return await original(prepared.src, bgId, ratio, null);
      } catch (secondErr) {
        throw _easyError(secondErr, true);
      }
    }
  }

  function wrap() {
    if (wrapped || typeof window.composeBgForEditor !== 'function') return false;
    const original = window.composeBgForEditor;
    window.composeBgForEditor = async function (srcUrl, bgId, ratio, preRemovedBgUrl) {
      return await _run(original, srcUrl, bgId, ratio, preRemovedBgUrl);
    };
    wrapped = true;
    return true;
  }

  function boot() {
    if (wrap()) return;
    let tries = 0;
    const iv = setInterval(() => { if (wrap() || ++tries > 80) clearInterval(iv); }, 100);
  }

  window.PhotoEditorBgSafe = { wrap, prepareSource };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
