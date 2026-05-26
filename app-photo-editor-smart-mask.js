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
    const warm = r > 70 && rg > -4 && g > b - 14 && rb > 8 && rb < 125;
    const bright = lum > 45 && lum < 248;
    if (!warm || !bright) return 0;
    const conf = 0.6 + Math.min(rg, 20) / 50 + Math.min(rb, 40) / 100;
    return _clamp01(Math.min(conf, 0.95) * Math.max(subject, 0.22));
  }

  function _hairScore(r, g, b, lum, sat, subject, skin, x, y, w, h) {
    const neutral = Math.abs(r - g) < 52 && Math.abs(g - b) < 58;
    const dark = lum > 14 && lum < 130;
    const dyed = lum > 45 && lum < 210 && sat > 15 && sat < 145;
    const ny = (y + 0.5) / Math.max(1, h);
    const upperBoost = ny < 0.5 ? 0.25 : 0;
    const skinOk = skin < 0.65 || ny < 0.45;
    const score = (dark || neutral || dyed) && skinOk ? 0.82 + upperBoost : 0;
    return _clamp01(score * Math.max(subject, 0.25));
  }

  function _eyeScore(r, g, b, lum, sat, x, y, w, h, subject) {
    const nx = (x + 0.5) / Math.max(1, w);
    const ny = (y + 0.5) / Math.max(1, h);
    const faceBand = _clamp01(1 - Math.abs(ny - 0.42) * 3.0) * _clamp01(1 - Math.abs(nx - 0.5) * 1.8);
    const irisOrLash = lum > 12 && lum < 150;
    const whiteCatch = lum > 140 && sat < 75 && Math.max(r, g, b) - Math.min(r, g, b) < 70;
    return _clamp01(faceBand * Math.max(subject, 0.3) * (irisOrLash ? 0.92 : (whiteCatch ? 0.6 : 0)));
  }

  function _nailScore(lum, sat, subject, skin) {
    const glossy = lum > 150 && sat < 100;
    const colored = sat > 35 && lum > 65 && lum < 245;
    const nude = lum > 130 && lum < 210 && sat < 45;
    const base = (glossy ? 0.5 : 0) + (colored ? 0.55 : 0) + (nude ? 0.35 : 0) + (skin > 0.18 ? 0.2 : 0);
    return _clamp01(base * Math.max(subject, 0.3));
  }

  function classify(p) {
    const r = p.r || 0, g = p.g || 0, b = p.b || 0;
    const lum = p.lum == null ? r * 0.299 + g * 0.587 + b * 0.114 : p.lum;
    const maxCh = p.maxCh == null ? Math.max(r, g, b) : p.maxCh;
    const minCh = p.minCh == null ? Math.min(r, g, b) : p.minCh;
    const sat = maxCh - minCh;
    const subject = _subjectWeight(p.x || 0, p.y || 0, p.w || 1, p.h || 1);
    const skin = Math.max(_skinScore(r, g, b, lum, subject), p.isSkinFallback ? 0.42 : 0);
    const hair = Math.max(_hairScore(r, g, b, lum, sat, subject, skin, p.x || 0, p.y || 0, p.w || 1, p.h || 1), p.hairFallback ? 0.35 : 0);
    const eye = _eyeScore(r, g, b, lum, sat, p.x || 0, p.y || 0, p.w || 1, p.h || 1, subject);
    const nail = _nailScore(lum, sat, subject, skin);
    const red = r > g + 8 && r > b + 4 ? Math.max(skin, eye, subject * 0.42) : 0;
    return { subject, skin: _clamp01(skin), hair: _clamp01(hair), eye, nail, redness: _clamp01(red) };
  }

  window.PhotoEditorSmartMask = { classify };
})();
