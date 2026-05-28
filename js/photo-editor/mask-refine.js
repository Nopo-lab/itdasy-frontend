/* 사진 편집기 — Mask Refine 헬퍼 (v313 2026-05-28)
   RegionMaskProvider 가 사용하는 공용 픽셀 헬퍼.
   외부 의존성 0. 순수 함수만.

   API:
     window.MaskRefine = {
       polygonToMask(polygon, w, h)          → Float32Array(w*h)
       gaussianFeather(mask, w, h, radius)   → Float32Array (in-place 안전)
       sobelEdgeStrength(canvas)             → Float32Array(w*h) 0~1
       maskCoverage(mask)                    → 0~1 (평균값)
       maskConfidence(mask, threshold)       → 0~1 (threshold 초과 픽셀 비율)
       boxBlur1D(arr, w, h, radius)          → Float32Array
       subtractMask(a, b)                    → Float32Array (a - b, clamp 0)
       intersectMask(a, b)                   → Float32Array (min)
       unionMask(a, b)                       → Float32Array (max)
       invertMask(mask)                      → Float32Array (1 - mask)
     };

   v313 제약:
     - 보정 엔진에 연결 X (debug overlay + getStats 전용)
     - 어떤 입력에도 throw 하지 않음 (잘못된 입력 → empty mask 반환)
*/
(function () {
  'use strict';
  if (window.MaskRefine) return;

  function _safeSize(w, h) {
    w = Math.max(1, w | 0);
    h = Math.max(1, h | 0);
    return { w, h, n: w * h };
  }

  function _emptyMask(w, h) {
    const sz = _safeSize(w, h);
    return new Float32Array(sz.n);
  }

  // polygon(2D point 배열) → 마스크. 내부 1, 외부 0.
  // 간이 scanline fill (작은 polygon 가정 — face landmark용).
  function polygonToMask(polygon, w, h) {
    const sz = _safeSize(w, h);
    const out = new Float32Array(sz.n);
    if (!polygon || !polygon.length) return out;
    const pts = polygon.filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y));
    if (pts.length < 3) return out;
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      if (pts[i].y < minY) minY = pts[i].y;
      if (pts[i].y > maxY) maxY = pts[i].y;
    }
    const yStart = Math.max(0, Math.floor(minY));
    const yEnd = Math.min(sz.h - 1, Math.ceil(maxY));
    for (let y = yStart; y <= yEnd; y++) {
      const xs = [];
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const a = pts[i], b = pts[j];
        if ((a.y > y) !== (b.y > y)) {
          const x = (b.x - a.x) * (y - a.y) / (b.y - a.y || 1e-6) + a.x;
          xs.push(x);
        }
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k < xs.length; k += 2) {
        const x0 = Math.max(0, Math.floor(xs[k]));
        const x1 = Math.min(sz.w - 1, Math.ceil(xs[k + 1] || xs[k]));
        const row = y * sz.w;
        for (let x = x0; x <= x1; x++) out[row + x] = 1;
      }
    }
    return out;
  }

  // 1D box blur (수평) — gaussianFeather 가 두 번 호출 (separable).
  function boxBlur1D(arr, w, h, r) {
    const sz = _safeSize(w, h);
    if (!arr || arr.length !== sz.n) return _emptyMask(sz.w, sz.h);
    const rr = Math.max(1, r | 0);
    const out = new Float32Array(sz.n);
    // 수평
    const tmp = new Float32Array(sz.n);
    for (let y = 0; y < sz.h; y++) {
      const row = y * sz.w;
      let acc = 0, cnt = 0;
      for (let x = -rr; x <= rr; x++) {
        const xi = Math.min(sz.w - 1, Math.max(0, x));
        acc += arr[row + xi]; cnt++;
      }
      tmp[row] = acc / cnt;
      for (let x = 1; x < sz.w; x++) {
        const addX = Math.min(sz.w - 1, x + rr);
        const subX = Math.max(0, x - rr - 1);
        acc += arr[row + addX] - arr[row + subX];
        tmp[row + x] = acc / cnt;
      }
    }
    // 수직
    for (let x = 0; x < sz.w; x++) {
      let acc = 0, cnt = 0;
      for (let y = -rr; y <= rr; y++) {
        const yi = Math.min(sz.h - 1, Math.max(0, y));
        acc += tmp[yi * sz.w + x]; cnt++;
      }
      out[x] = acc / cnt;
      for (let y = 1; y < sz.h; y++) {
        const addY = Math.min(sz.h - 1, y + rr);
        const subY = Math.max(0, y - rr - 1);
        acc += tmp[addY * sz.w + x] - tmp[subY * sz.w + x];
        out[y * sz.w + x] = acc / cnt;
      }
    }
    return out;
  }

  // 두 번 box blur ≈ Gaussian (separable).
  function gaussianFeather(mask, w, h, radius) {
    const r = Math.max(1, Math.round((radius || 0)));
    let out = boxBlur1D(mask, w, h, r);
    out = boxBlur1D(out, w, h, r);
    // 0~1 clamp
    for (let i = 0; i < out.length; i++) {
      if (out[i] < 0) out[i] = 0;
      else if (out[i] > 1) out[i] = 1;
    }
    return out;
  }

  // Sobel edge — canvas 또는 ImageData 입력 → 0~1 정규화 강도 맵.
  function sobelEdgeStrength(canvas) {
    try {
      const w = canvas.width | 0, h = canvas.height | 0;
      const sz = _safeSize(w, h);
      if (!w || !h) return _emptyMask(w, h);
      const ctx = canvas.getContext && canvas.getContext('2d');
      if (!ctx) return _emptyMask(w, h);
      const img = ctx.getImageData(0, 0, sz.w, sz.h);
      const d = img.data;
      const gray = new Float32Array(sz.n);
      for (let i = 0, j = 0; i < d.length; i += 4, j++) {
        gray[j] = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
      }
      const out = new Float32Array(sz.n);
      let maxV = 1e-6;
      for (let y = 1; y < sz.h - 1; y++) {
        for (let x = 1; x < sz.w - 1; x++) {
          const i = y * sz.w + x;
          const gx =
            -gray[i - sz.w - 1] - 2 * gray[i - 1] - gray[i + sz.w - 1]
            + gray[i - sz.w + 1] + 2 * gray[i + 1] + gray[i + sz.w + 1];
          const gy =
            -gray[i - sz.w - 1] - 2 * gray[i - sz.w] - gray[i - sz.w + 1]
            + gray[i + sz.w - 1] + 2 * gray[i + sz.w] + gray[i + sz.w + 1];
          const mag = Math.sqrt(gx * gx + gy * gy);
          out[i] = mag;
          if (mag > maxV) maxV = mag;
        }
      }
      // 정규화
      const k = 1 / maxV;
      for (let i = 0; i < out.length; i++) out[i] *= k;
      return out;
    } catch (_e) {
      return _emptyMask(canvas && canvas.width, canvas && canvas.height);
    }
  }

  function maskCoverage(mask) {
    if (!mask || !mask.length) return 0;
    let s = 0;
    for (let i = 0; i < mask.length; i++) s += mask[i];
    return s / mask.length;
  }

  function maskConfidence(mask, threshold) {
    if (!mask || !mask.length) return 0;
    const th = threshold == null ? 0.5 : threshold;
    let n = 0;
    for (let i = 0; i < mask.length; i++) if (mask[i] >= th) n++;
    return n / mask.length;
  }

  function _binaryOp(a, b, op) {
    if (!a || !b || a.length !== b.length) {
      return new Float32Array((a && a.length) || (b && b.length) || 0);
    }
    const out = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = op(a[i], b[i]);
    return out;
  }

  function subtractMask(a, b) {
    return _binaryOp(a, b, (x, y) => {
      const v = x - y;
      return v < 0 ? 0 : v;
    });
  }
  function intersectMask(a, b) { return _binaryOp(a, b, (x, y) => x < y ? x : y); }
  function unionMask(a, b) { return _binaryOp(a, b, (x, y) => x > y ? x : y); }

  function invertMask(mask) {
    if (!mask) return new Float32Array(0);
    const out = new Float32Array(mask.length);
    for (let i = 0; i < mask.length; i++) out[i] = 1 - mask[i];
    return out;
  }

  // v332 — 점 집합의 convex hull (Andrew's monotone chain)
  function convexHull(points) {
    const pts = (points || []).filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y));
    if (pts.length < 3) return pts.slice();
    pts.sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [];
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper = [];
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    upper.pop(); lower.pop();
    return lower.concat(upper);
  }

  // v332 — 회전 타원 → mask (rx/ry = 반경, angleRad = 라디안)
  function ellipseToMask(cx, cy, rx, ry, angleRad, w, h) {
    const sz = _safeSize(w, h);
    const out = new Float32Array(sz.n);
    if (!rx || !ry) return out;
    const cosA = Math.cos(angleRad || 0), sinA = Math.sin(angleRad || 0);
    const irx2 = 1 / (rx * rx), iry2 = 1 / (ry * ry);
    const r = Math.ceil(Math.sqrt(rx * rx + ry * ry));
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(sz.w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(sz.h - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      const dy = y - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const lx = dx * cosA + dy * sinA;
        const ly = -dx * sinA + dy * cosA;
        if (lx * lx * irx2 + ly * ly * iry2 <= 1) out[y * sz.w + x] = 1;
      }
    }
    return out;
  }

  window.MaskRefine = {
    polygonToMask,
    gaussianFeather,
    sobelEdgeStrength,
    maskCoverage,
    maskConfidence,
    boxBlur1D,
    subtractMask,
    intersectMask,
    unionMask,
    invertMask,
    convexHull,
    ellipseToMask,
  };
})();
