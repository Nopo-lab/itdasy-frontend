self.onmessage = (event) => {
  const msg = event.data || {};
  try {
    const data = new Uint8ClampedArray(msg.data);
    if (msg.type === 'adjust') _adjust(data, msg.adjust || {});
    if (msg.type === 'unsharp' || (msg.adjust && msg.adjust.sharpness > 10)) {
      _unsharp(data, msg.width, msg.height, msg.strength || ((msg.adjust || {}).sharpness / 100));
    }
    self.postMessage({ id: msg.id, ok: true, data: data.buffer }, [data.buffer]);
  } catch (err) {
    self.postMessage({ id: msg.id, ok: false, error: err && err.message ? err.message : String(err) });
  }
};

function _clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

function _adjust(data, a) {
  const bright = (a.brightness == null ? 100 : a.brightness) / 100;
  const sat = (a.saturate == null ? 100 : a.saturate) / 100;
  const temp = a.temperature || 0;
  for (let i = 0; i < data.length; i += 4) {
    const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    let r = (lum + (data[i] - lum) * sat) * bright + temp * 0.45;
    let g = (lum + (data[i + 1] - lum) * sat) * bright + Math.abs(temp) * 0.06;
    let b = (lum + (data[i + 2] - lum) * sat) * bright - temp * 0.45;
    data[i] = _clamp(r); data[i + 1] = _clamp(g); data[i + 2] = _clamp(b);
  }
}

function _unsharp(data, w, h, strength) {
  const blur = new Uint8ClampedArray(data.length);
  const k = 1 + Math.max(0, Math.min(1, strength || 0)) * 1.2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let rs = 0, gs = 0, bs = 0, n = 0;
    for (let dx = -1; dx <= 1; dx++) {
      const xx = Math.min(w - 1, Math.max(0, x + dx));
      const p = (y * w + xx) * 4;
      rs += data[p]; gs += data[p + 1]; bs += data[p + 2]; n++;
    }
    const p = (y * w + x) * 4;
    blur[p] = rs / n; blur[p + 1] = gs / n; blur[p + 2] = bs / n; blur[p + 3] = data[p + 3];
  }
  for (let i = 0; i < data.length; i += 4) {
    data[i] = _clamp(data[i] + (data[i] - blur[i]) * (k - 1));
    data[i + 1] = _clamp(data[i + 1] + (data[i + 1] - blur[i + 1]) * (k - 1));
    data[i + 2] = _clamp(data[i + 2] + (data[i + 2] - blur[i + 2]) * (k - 1));
  }
}
