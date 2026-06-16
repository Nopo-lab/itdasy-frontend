/* 잇비 다중 사진 역할/그룹 — 순수 상태 로직 (UI 없음, [7] MVP)
   photo-mode.js 는 흐름/UI 연결만, 이 모듈이 assets/groups CRUD·자동추정·충돌해소·직렬화 담당.
   하위호환: dataUrl 은 refs[] 에 "한 번만" 저장(중복 금지), assets 는 photoRef 로 참조.
   외부: window.PhotoSession = { create, addAssets, getAsset, autoAssign, setRole,
     validateBeforeAfter, photosForBA, photosForShowcase, photosForCaption,
     serialize, restore, ROLES, ROLE_LABEL } */
(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : this);
  if (root.PhotoSession) { if (typeof module !== 'undefined' && module.exports) module.exports = root.PhotoSession; return; }

  var ROLES = { BEFORE: 'before', AFTER: 'after', HERO: 'hero', CAPTION: 'caption', EXCLUDE: 'exclude', UNSET: 'unset' };
  var ROLE_LABEL = { before: '전 사진', after: '후 사진', hero: '홍보컷', caption: '캡션용', exclude: '제외', unset: '미지정' };
  var SINGLE = { before: 1, after: 1 };   // 단일만 허용되는 역할(중복 지정 시 직전 것 unset)

  var _seq = 0;
  function _uid(p) { _seq += 1; return (p || 'a_') + Date.now().toString(36) + '_' + _seq.toString(36); }

  function create() { return { sessionId: _uid('ps_'), assets: [], groups: [], activeGroupId: null }; }

  // urls: [dataUrl | {url|dataUrl}] → asset 누적(유실 없음). source: 'batch'|'single'|'ba_second'|'restore'
  function addAssets(session, urls, source) {
    if (!session) session = create();
    var base = session.assets.length;
    (urls || []).forEach(function (u, i) {
      var url = (typeof u === 'string') ? u : (u && (u.url || u.dataUrl)) || '';
      if (!url) return;
      session.assets.push({
        assetId: _uid('a_'), url: url, editedUrl: null,
        role: ROLES.UNSET, order: base + i, source: source || 'batch', createdAt: Date.now(),
      });
    });
    return session;
  }

  function getAsset(session, assetId) {
    return (session && session.assets || []).filter(function (a) { return a.assetId === assetId; })[0] || null;
  }
  function _byRole(session, role) {
    return (session && session.assets || []).filter(function (a) { return a.role === role; });
  }

  // 자동 추정: 1장=hero, 2장=before/after, 3장+=1·2 before/after + 나머지 hero.
  function autoAssign(session) {
    var a = (session && session.assets) || [];
    var n = a.length;
    if (!n) return session;
    if (n === 1) { a[0].role = ROLES.HERO; return session; }
    a[0].role = ROLES.BEFORE; a[1].role = ROLES.AFTER;
    for (var i = 2; i < n; i++) a[i].role = ROLES.HERO;
    return session;
  }

  // 역할 지정 + 충돌해소: before/after 는 단일 → 같은 역할 기존 것은 unset(마지막 선택 우선).
  function setRole(session, assetId, role) {
    var target = getAsset(session, assetId);
    if (!target) return session;
    if (SINGLE[role]) {
      _byRole(session, role).forEach(function (o) { if (o.assetId !== assetId) o.role = ROLES.UNSET; });
    }
    target.role = role;
    return session;
  }

  // 전후 진행 가능 검증. reason: 'empty'|'all_excluded'|'no_before'|'no_after'|null
  function validateBeforeAfter(session) {
    var a = (session && session.assets) || [];
    if (!a.length) return { ok: false, reason: 'empty' };
    if (a.every(function (x) { return x.role === ROLES.EXCLUDE; })) return { ok: false, reason: 'all_excluded' };
    if (!a.some(function (x) { return x.role === ROLES.BEFORE; })) return { ok: false, reason: 'no_before' };
    if (!a.some(function (x) { return x.role === ROLES.AFTER; })) return { ok: false, reason: 'no_after' };
    return { ok: true, reason: null };
  }

  function _first(session, role) { var r = _byRole(session, role); return r.length ? r[0] : null; }
  function _firstUsable(session) {
    return (session && session.assets || []).filter(function (a) { return a.role !== ROLES.EXCLUDE; })[0] || null;
  }

  // 전후: { before, after } (편집결과 우선은 호출측에서 editedUrl 사용)
  function photosForBA(session) { return { before: _first(session, ROLES.BEFORE), after: _first(session, ROLES.AFTER) }; }
  // 홍보: hero 우선 → 첫 non-exclude
  function photosForShowcase(session) { return _first(session, ROLES.HERO) || _firstUsable(session); }
  // 캡션: hero → after → 첫 non-exclude (caption 칩 UI 제거됨, enum 은 하위호환 유지).
  function photosForCaption(session) { return _first(session, ROLES.HERO) || _first(session, ROLES.AFTER) || _firstUsable(session); }

  // ── 직렬화(중복 최소화): 같은 dataUrl 은 refs 에 한 번만, assets 는 photoRef 로 참조 ──
  function serialize(session) {
    if (!session || !session.assets || !session.assets.length) return null;
    var refs = []; var seen = {};
    function refFor(url) {
      if (!url) return null;
      if (Object.prototype.hasOwnProperty.call(seen, url)) return seen[url];
      var id = 'pf_' + refs.length; seen[url] = id; refs.push({ id: id, dataUrl: url }); return id;
    }
    var assets = session.assets.map(function (a) {
      return { assetId: a.assetId, role: a.role, order: a.order, source: a.source, photoRef: refFor(a.editedUrl || a.url || '') };
    });
    return { photoSession: { sessionId: session.sessionId, assets: assets, groups: session.groups || [], refs: refs } };
  }

  // 역직렬화: photoSession(assets+refs) → session 복원
  function restore(photoSession) {
    if (!photoSession || !Array.isArray(photoSession.assets)) return null;
    var byRef = {};
    (photoSession.refs || []).forEach(function (r) { if (r && r.id) byRef[r.id] = r.dataUrl; });
    var session = create();
    session.sessionId = photoSession.sessionId || session.sessionId;
    session.groups = photoSession.groups || [];
    session.assets = photoSession.assets.map(function (m, i) {
      return {
        assetId: m.assetId || _uid('a_'),
        url: (m.photoRef && byRef[m.photoRef]) || m.url || '',
        editedUrl: null, role: m.role || ROLES.UNSET,
        order: m.order != null ? m.order : i, source: m.source || 'restore', createdAt: Date.now(),
      };
    });
    return session;
  }

  root.PhotoSession = {
    create: create, addAssets: addAssets, getAsset: getAsset, autoAssign: autoAssign, setRole: setRole,
    validateBeforeAfter: validateBeforeAfter, photosForBA: photosForBA,
    photosForShowcase: photosForShowcase, photosForCaption: photosForCaption,
    serialize: serialize, restore: restore, ROLES: ROLES, ROLE_LABEL: ROLE_LABEL,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PhotoSession;
})();
