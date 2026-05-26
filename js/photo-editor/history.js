/* 사진 편집기 — 편집 기록 관리 */
(function () {
  'use strict';

  if (window.PhotoEditorHistory) return;

  const SNAP_KEYS = [
    'originalSrc', 'removedBgDataUrl', 'preBgOriginalSrc', 'adjust', 'ratio',
    'text', 'watermark', 'beauty', 'relight', 'template', 'autoIntensity',
    'layers', 'activeLayerId', 'selective', 'film', 'curve', 'hsl', 'shadow', 'bg', 'bgBlur', 'tplV2',
  ];

  function snapshot(state) {
    const out = {};
    const prev = state.history && state.history[state.historyCursor];
    for (const key of SNAP_KEYS) out[key] = _copySnapValue(state, key, prev);
    return out;
  }

  function _copySnapValue(state, key, prev) {
    const value = state[key];
    if (key === 'originalSrc' && prev && value === prev[key]) return prev[key];
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function push(state) {
    if (!state) return;
    state.history = state.history.slice(0, state.historyCursor + 1);
    state.history.push(snapshot(state));
    if (state.history.length > 20) state.history.shift();
    state.historyCursor = state.history.length - 1;
  }

  function applySnapshot(state, snap) {
    if (!state || !snap) return;
    for (const key of SNAP_KEYS) if (snap[key] !== undefined) state[key] = snap[key];
  }

  function undo(state) {
    if (!state || state.historyCursor <= 0) return null;
    state.historyCursor -= 1;
    return state.history[state.historyCursor] || null;
  }

  function redo(state) {
    if (!state || state.historyCursor >= state.history.length - 1) return null;
    state.historyCursor += 1;
    return state.history[state.historyCursor] || null;
  }

  window.PhotoEditorHistory = { push, undo, redo, applySnapshot };
})();
