/* 사진 편집기 — 빠른 영역 안전장치 (피부/모발/눈/네일/배경) */
(function () {
  'use strict';
  if (window.PhotoEditorSmartMask) return;

  function _clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  function _subjectWeight(x, y, w, h) {
    const nx = (x + 0.5) / Math.max(1, w);
    const ny = (y + 0.5) / Math.max(1, h);
    const center = 1 - (Math.abs(nx - 0.5) * 1.45 + Math.abs(ny - 0.48) * 1.02);
    const edge = nx < 0.04 || nx > 0.96 || ny < 0.02 || ny > 0.97 ? 0.18 : 1;
    return _clamp01(center) * edge;
  }

  function _skinScore(r, g, b, lum, subject) {
    const rb = r - b;
    const rg = r - g;
    const warm = r > 78 && rg > 2 && g > b - 12 && rb > 14 && rb < 112;
    const bright = lum > 58 && lum < 244;
    const score = warm && bright ? 0.9 : 0;
    return _clamp01(score * Math.max(subject, 0.18));
  }

  function _hairScore(r, g, b, lum, sat, subject, skin) {
    const neutral = Math.abs(r - g) < 52 && Math.abs(g - b) < 58;
    const dark = lum > 14 && lum < 120;
    const dyed = lum > 45 && lum < 205 && sat > 18 && sat < 132;
    const score = (dark || neutral || dyed) && skin < 0.42 ? 0.82 : 0;
    return _clamp01(score * Math.max(subject, 0.2));
  }

  function _eyeScore(r, g, b, lum, sat, x, y, w, h, subject) {
    const nx = (x + 0.5) / Math.max(1, w);
    const ny = (y + 0.5) / Math.max(1, h);
    const faceBand = _clamp01(1 - Math.abs(ny - 0.38) * 5.2) * _clamp01(1 - Math.abs(nx - 0.5) * 2.35);
    const irisOrLash = lum > 16 && lum < 138;
    const whiteCatch = lum > 150 && sat < 68 && Math.max(r, g, b) - Math.min(r, g, b) < 62;
    return _clamp01(faceBand * subject * (irisOrLash ? 0.9 : (whiteCatch ? 0.55 : 0)));
  }

  function _nailScore(lum, sat, subject, skin, hair) {
    const glossy = lum > 168 && sat < 90;
    const colored = sat > 42 && lum > 78 && lum < 238;
    const base = (glossy ? 0.45 : 0) + (colored ? 0.55 : 0) + (skin > 0.22 ? 0.18 : 0);
    return _clamp01(base * subject * (hair > 0.42 ? 0.25 : 1));
  }

  function classify(p) {
    const r = p.r || 0, g = p.g || 0, b = p.b || 0;
    const lum = p.lum == null ? r * 0.299 + g * 0.587 + b * 0.114 : p.lum;
    const maxCh = p.maxCh == null ? Math.max(r, g, b) : p.maxCh;
    const minCh = p.minCh == null ? Math.min(r, g, b) : p.minCh;
    const sat = maxCh - minCh;
    const subject = _subjectWeight(p.x || 0, p.y || 0, p.w || 1, p.h || 1);
    const skin = Math.max(_skinScore(r, g, b, lum, subject), p.isSkinFallback ? 0.42 : 0);
    const hair = Math.max(_hairScore(r, g, b, lum, sat, subject, skin), p.hairFallback ? 0.35 : 0);
    const eye = _eyeScore(r, g, b, lum, sat, p.x || 0, p.y || 0, p.w || 1, p.h || 1, subject);
    const nail = _nailScore(lum, sat, subject, skin, hair);
    const red = r > g + 8 && r > b + 4 ? Math.max(skin, eye, subject * 0.42) : 0;
    return { subject, skin: _clamp01(skin), hair: _clamp01(hair), eye, nail, redness: _clamp01(red) };
  }

  window.PhotoEditorSmartMask = { classify };
})();
