/* social-style-source.js — 외부 공개 SNS 계정 스타일 QA 입력. [2026-09-15]
 *
 * 목적: 다른 공개 Instagram Professional 계정을 공식 Business Discovery로 읽어
 *       현재 스타일 분석기가 먹는 mediaList 모양으로 바꾼다.
 *
 * 안전선:
 *   - 기본 동작은 저장 없는 미리보기다. 남의 스타일을 원장 스타일로 자동 저장하지 않는다.
 *   - 개인/비공개/권한 부족 계정은 available=false 로만 표시하고 빈 학습값으로 섞지 않는다.
 *   - 실제 게시/댓글/DM은 하지 않는다. 읽기 전용이다.
 *
 * 공개: window.SocialStyleSource.fetchPublicBusinessMedia(username, opts)
 *       window.SocialStyleSource.previewProfile(username, opts)
 */
(function () {
  'use strict';
  if (window.SocialStyleSource) return;

  function _headers() {
    try { return (typeof window.authHeader === 'function') ? window.authHeader() : {}; }
    catch (_e) { void _e; return {}; }
  }

  function _limit(n) {
    n = parseInt(n, 10);
    if (!isFinite(n) || n <= 0) return 12;
    return Math.max(1, Math.min(n, 24));
  }

  function _username(raw) {
    raw = String(raw || '').trim();
    raw = raw.split('?', 1)[0].split('#', 1)[0].replace(/\/+$/, '');
    raw = raw.indexOf('instagram.com/') >= 0 ? raw.split('/').pop() : raw;
    return raw.replace(/^@+/, '').trim();
  }

  function _normalizeMedia(item, username) {
    return {
      id: item && item.id,
      thumb: (item && (item.thumb || item.thumbnail_url || item.media_url)) || '',
      media_url: item && item.media_url,
      thumbnail_url: item && item.thumbnail_url,
      media_type: item && item.media_type,
      permalink: item && item.permalink,
      caption: (item && item.caption) || '',
      timestamp: item && item.timestamp,
      like_count: item && item.like_count,
      comments_count: item && item.comments_count,
      source: 'instagram_business_discovery',
      source_username: username || null
    };
  }

  function fetchPublicBusinessMedia(username, opts) {
    opts = opts || {};
    var u = _username(username);
    if (!u || !window.apiFetch) {
      return Promise.resolve({ connected: false, available: false, username: u, media: [] });
    }
    var path = '/instagram/business-discovery?username=' + encodeURIComponent(u) + '&limit=' + _limit(opts.limit);
    return window.apiFetch(path, { headers: _headers() })
      .then(function (r) { return (r && r.ok) ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.available) {
          return Object.assign({ connected: !!(j && j.connected), available: false, username: u, media: [] }, j || {});
        }
        var gotUser = j.username || u;
        var media = (Array.isArray(j.media) ? j.media : [])
          .map(function (m) { return _normalizeMedia(m, gotUser); })
          .filter(function (m) { return m.id && m.thumb; });
        return Object.assign({}, j, { username: gotUser, media: media });
      })
      .catch(function () { return { connected: true, available: false, username: u, media: [] }; });
  }

  function previewProfile(username, opts) {
    opts = opts || {};
    return fetchPublicBusinessMedia(username, opts).then(function (j) {
      if (!j || !j.available || !j.media.length) return Object.assign({ profile: null }, j || {});
      if (!(window.InstagramTextStyle && window.InstagramTextStyle.build)) {
        return Object.assign({ profile: null, reason: 'no_style_engine' }, j);
      }
      return window.InstagramTextStyle.build(j.media, {
        save: false,
        onPost: (typeof opts.onPost === 'function') ? opts.onPost : null
      }).then(function (profile) {
        return Object.assign({}, j, { profile: profile || null });
      });
    });
  }

  window.SocialStyleSource = {
    fetchPublicBusinessMedia: fetchPublicBusinessMedia,
    previewProfile: previewProfile,
    _username: _username,
    _normalizeMedia: _normalizeMedia,
    _limit: _limit
  };
})();
