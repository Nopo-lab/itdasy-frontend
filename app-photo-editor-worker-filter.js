/* 사진 편집기 — 큰 사진 픽셀 보정 작업 파일 연결 */
(function () {
  'use strict';
  if (window.PhotoEditorWorkerFilter) return;

  let _worker = null, _seq = 0;
  const _pending = {};

  function _workerUrl() {
    return new URL('workers/photo-filter-worker.js', document.baseURI).toString();
  }

  function _getWorker() {
    if (!('Worker' in window)) return null;
    if (_worker) return _worker;
    try {
      _worker = new Worker(_workerUrl());
      _worker.onmessage = (event) => _finish(event.data || {});
      _worker.onerror = () => _failAll();
      return _worker;
    } catch (_e) {
      return null;
    }
  }

  function _finish(msg) {
    const p = _pending[msg.id];
    if (!p) return;
    delete _pending[msg.id];
    if (!msg.ok) p.reject(new Error(msg.error || '작업 실패'));
    else p.resolve(msg.data);
  }

  function _failAll() {
    Object.keys(_pending).forEach(id => {
      _pending[id].reject(new Error('작업 파일 오류'));
      delete _pending[id];
    });
    try { _worker && _worker.terminate(); } catch (_e) { void _e; }
    _worker = null;
  }

  function _run(payload, transfer) {
    const worker = _getWorker();
    if (!worker) return Promise.reject(new Error('작업 파일 미지원'));
    const id = ++_seq;
    payload.id = id;
    return new Promise((resolve, reject) => {
      _pending[id] = { resolve, reject };
      worker.postMessage(payload, transfer || []);
    });
  }

  async function _applyCanvas(canvas, payload) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    payload.width = canvas.width;
    payload.height = canvas.height;
    payload.data = image.data.buffer;
    const out = await _run(payload, [image.data.buffer]);
    ctx.putImageData(new ImageData(new Uint8ClampedArray(out), canvas.width, canvas.height), 0, 0);
    return true;
  }

  function shouldUse(canvas) {
    return !!_getWorker() && canvas && canvas.width * canvas.height > 1600000;
  }

  window.PhotoEditorWorkerFilter = {
    shouldUse,
    unsharpCanvas: (canvas, strength) => _applyCanvas(canvas, { type: 'unsharp', strength }),
    adjustCanvas: (canvas, adjust) => _applyCanvas(canvas, { type: 'adjust', adjust }),
  };
})();
