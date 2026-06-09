/* 사진 편집기 — 템플릿 보관함 (T1+T2 2026-06-06)
   즐겨찾기 + 최근 사용 템플릿을 localStorage 에 저장.
   키: itdasy_tpl_lib::staging = { favorites:[id], recent:[id], defaults:{price,review,before_after} }
   - favorites: 북마크 토글(무제한)
   - recent: 적용 시 unshift, 최근 8개 cap (중복 제거)
   - defaults: purpose 별 사용자 지정 기본 템플릿 (잇비 자동적용 최우선). price/review/before_after 만.
   외부 노출: window.PhotoEditorTemplateLibrary */
(function () {
  'use strict';
  if (window.PhotoEditorTemplateLibrary) return;

  const KEY = 'itdasy_tpl_lib::staging';
  const RECENT_CAP = 8;
  const DEFAULT_PURPOSES = ['price', 'review', 'before_after'];   // 지원 purpose 3종만

  function _read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { favorites: [], recent: [], defaults: {} };
      const obj = JSON.parse(raw);
      const defaults = {};
      if (obj.defaults && typeof obj.defaults === 'object') {
        DEFAULT_PURPOSES.forEach(p => { if (typeof obj.defaults[p] === 'string' && obj.defaults[p]) defaults[p] = obj.defaults[p]; });
      }
      return {
        favorites: Array.isArray(obj.favorites) ? obj.favorites.filter(s => typeof s === 'string') : [],
        recent: Array.isArray(obj.recent) ? obj.recent.filter(s => typeof s === 'string') : [],
        defaults: defaults,
      };
    } catch (_e) { return { favorites: [], recent: [], defaults: {} }; }
  }

  function _write(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (_e) { void 0; }
  }

  function listFav() { return _read().favorites.slice(); }
  function listRecent() { return _read().recent.slice(); }

  function isFav(id) { return _read().favorites.indexOf(id) !== -1; }

  // 토글 후 새 상태(true=즐겨찾기됨) 반환.
  function toggleFav(id) {
    if (!id) return false;
    const data = _read();
    const i = data.favorites.indexOf(id);
    let now;
    if (i === -1) { data.favorites.unshift(id); now = true; }
    else { data.favorites.splice(i, 1); now = false; }
    _write(data);
    return now;
  }

  function addRecent(id) {
    if (!id) return;
    const data = _read();
    const i = data.recent.indexOf(id);
    if (i !== -1) data.recent.splice(i, 1);
    data.recent.unshift(id);
    data.recent = data.recent.slice(0, RECENT_CAP);
    _write(data);
  }

  // 보관함 표시용 합본: 즐겨찾기 우선 → 최근(중복 제외). id 순서 유지.
  function listAll() {
    const data = _read();
    const seen = {};
    const out = [];
    data.favorites.concat(data.recent).forEach(id => {
      if (id && !seen[id]) { seen[id] = 1; out.push(id); }
    });
    return out;
  }

  // ── purpose 별 기본 템플릿 (잇비 자동적용 최우선) ──
  // id 만 저장. 존재/purpose 일치 검증은 호출부(자동적용·갤러리) 책임.
  function getDefault(purpose) {
    if (DEFAULT_PURPOSES.indexOf(purpose) === -1) return '';
    return _read().defaults[purpose] || '';
  }
  function setDefault(purpose, id) {
    if (DEFAULT_PURPOSES.indexOf(purpose) === -1 || !id) return false;
    const data = _read();
    data.defaults[purpose] = id;   // 같은 purpose 1개만 — 덮어쓰기
    _write(data);
    return true;
  }
  function clearDefault(purpose) {
    if (DEFAULT_PURPOSES.indexOf(purpose) === -1) return;
    const data = _read();
    delete data.defaults[purpose];
    _write(data);
  }
  function listDefaults() { return Object.assign({}, _read().defaults); }

  window.PhotoEditorTemplateLibrary = { listFav, listRecent, isFav, toggleFav, addRecent, listAll, getDefault, setDefault, clearDefault, listDefaults };
})();
