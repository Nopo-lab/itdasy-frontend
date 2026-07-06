/* 작업실 slot 계정 동기화 (FE) — 기기 간 draft slot sync. 설계: DESIGN_slot_sync.md
   원칙:
   - 플래그 window.ITDASY_SLOT_SYNC 로 게이트. OFF 면 아무 것도 안 함(기존 로컬 전용 동작 그대로).
   - 로컬 IndexedDB(itdasy-gallery/slots)는 캐시로 유지. 저장/삭제는 항상 로컬 먼저.
   - 이미지는 최종 액션 때만 업로드(content_hash dedupe). 편집 중간 업로드 없음.
   - 충돌 = LWW(updatedAt). 삭제 = tombstone. 오프라인 = tombstone/재시도 큐.
   - 서버 쓰기용 원본 saveSlotToDB/deleteSlotFromDB 참조를 보관(래핑 재귀 방지).
   보조 메타(lastPulledAt/migratedAt/tombstones)는 별도 DB 'itdasy-sync'에 저장 →
   기존 app-gallery-db.js 의 스키마/버전 안 건드림. */
(function () {
  'use strict';

  function enabled() { return window.ITDASY_SLOT_SYNC === true; }
  function has(fn) { return typeof fn === 'function'; }
  function authHeader() { return has(window.authHeader) ? (window.authHeader() || {}) : {}; }
  function loggedIn() { var h = authHeader(); return !!(h && h.Authorization); }
  function ready() { return enabled() && loggedIn() && has(window.apiFetch) && has(window.saveSlotToDB); }
  function log() { if (window.__ITDASY_SYNC_DEBUG__) { try { console.log.apply(console, ['[wssync]'].concat([].slice.call(arguments))); } catch (_e) { void 0; } } }

  // 래핑 전에 잡아둔 원본(서버→로컬 반영 시 dirty 재표시 방지에 사용).
  var _origSaveSlot = null, _origDeleteSlot = null;

  // ── 보조 메타 DB (itdasy-sync) ─────────────────────────────
  var _sdb = null;
  function openSyncDB() {
    return new Promise(function (resolve, reject) {
      if (_sdb) return resolve(_sdb);
      var req = indexedDB.open('itdasy-sync', 1);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
        if (!db.objectStoreNames.contains('tombstones')) db.createObjectStore('tombstones', { keyPath: 'slot_id' });
      };
      req.onsuccess = function (e) { _sdb = e.target.result; resolve(_sdb); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function _tx(store, mode) { return openSyncDB().then(function (db) { return db.transaction(store, mode).objectStore(store); }); }
  function getMeta(k) { return _tx('meta', 'readonly').then(function (s) { return new Promise(function (res) { var r = s.get(k); r.onsuccess = function () { res(r.result ? r.result.v : null); }; r.onerror = function () { res(null); }; }); }); }
  function setMeta(k, v) { return _tx('meta', 'readwrite').then(function (s) { return new Promise(function (res) { var r = s.put({ k: k, v: v }); r.onsuccess = function () { res(true); }; r.onerror = function () { res(false); }; }); }); }
  function addTombstone(slotId) { return _tx('tombstones', 'readwrite').then(function (s) { return new Promise(function (res) { var r = s.put({ slot_id: slotId, at: Date.now() }); r.onsuccess = function () { res(true); }; r.onerror = function () { res(false); }; }); }); }
  function delTombstone(slotId) { return _tx('tombstones', 'readwrite').then(function (s) { return new Promise(function (res) { var r = s.delete(slotId); r.onsuccess = function () { res(true); }; r.onerror = function () { res(false); }; }); }); }
  function listTombstones() { return _tx('tombstones', 'readonly').then(function (s) { return new Promise(function (res) { var r = s.getAll(); r.onsuccess = function () { res(r.result || []); }; r.onerror = function () { res([]); }; }); }); }

  // ── 이미지 dataURL → JPEG blob (최장축 1440, q0.86) — Cloud Run 32MB·저장비용 방어 ──
  function _dataUrlToJpegBlob(dataUrl, maxDim, q) {
    maxDim = maxDim || 1440; q = q || 0.86;
    return new Promise(function (resolve) {
      try {
        var img = new Image();
        img.onload = function () {
          var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
          var sc = Math.min(1, maxDim / Math.max(w, h || 1));
          var cw = Math.max(1, Math.round(w * sc)), ch = Math.max(1, Math.round(h * sc));
          var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
          var cx = cv.getContext('2d');
          cx.fillStyle = '#fff'; cx.fillRect(0, 0, cw, ch);
          cx.drawImage(img, 0, 0, cw, ch);
          if (cv.toBlob) cv.toBlob(function (b) { resolve(b); }, 'image/jpeg', q);
          else resolve(null);
        };
        img.onerror = function () { resolve(null); };
        img.src = dataUrl;
      } catch (_e) { resolve(null); }
    });
  }

  // 세션 캐시 — 같은 dataURL 은 세션 내 1회만 업로드.
  var _uploadCache = new Map();
  function uploadImage(dataUrl) {
    if (_uploadCache.has(dataUrl)) return Promise.resolve(_uploadCache.get(dataUrl));
    return _dataUrlToJpegBlob(dataUrl).then(function (blob) {
      if (!blob) return null;
      var fd = new FormData(); fd.append('image', blob, 'ws.jpg');
      return window.apiFetch('/workspace/slots/image', { method: 'POST', headers: authHeader(), body: fd })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { var u = j && j.url; if (u) _uploadCache.set(dataUrl, u); return u || null; })
        .catch(function (e) { log('upload fail', e); return null; });
    });
  }

  // ── 깊은 순회 — data:image URL 수집/치환 ─────────────────────
  function _isDataImg(v) { return typeof v === 'string' && v.indexOf('data:image') === 0; }
  function collectDataUrls(obj, out, depth) {
    out = out || new Set(); depth = depth || 0;
    if (obj == null || depth > 8) return out;
    if (_isDataImg(obj)) { out.add(obj); return out; }
    if (typeof obj !== 'object') return out;
    if (Array.isArray(obj)) { for (var i = 0; i < obj.length; i++) collectDataUrls(obj[i], out, depth + 1); return out; }
    for (var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) collectDataUrls(obj[k], out, depth + 1); }
    return out;
  }
  function deepReplace(obj, map, depth) {
    depth = depth || 0;
    if (obj == null || depth > 8) return obj;
    if (_isDataImg(obj)) return map.has(obj) ? map.get(obj) : null;   // 업로드 실패분은 null
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(function (v) { return deepReplace(v, map, depth + 1); });
    var out = {};
    for (var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = deepReplace(obj[k], map, depth + 1); }
    return out;
  }
  function _clone(o) { try { return (typeof structuredClone === 'function') ? structuredClone(o) : JSON.parse(JSON.stringify(o)); } catch (_e) { try { return JSON.parse(JSON.stringify(o)); } catch (_e2) { return o; } } }

  var META_SKIP = { id: 1, label: 1, caption: 1, hashtags: 1, publish: 1, customer_id: 1, order: 1, photos: 1, updatedAt: 1, syncState: 1 };
  function buildMeta(slot) {
    var m = {};
    for (var k in slot) {
      if (!Object.prototype.hasOwnProperty.call(slot, k) || META_SKIP[k]) continue;
      var v = slot[k];
      if (typeof v === 'function' || _isDataImg(v)) continue;
      try { if (JSON.stringify(v) && JSON.stringify(v).length > 100000) continue; } catch (_e) { continue; }
      m[k] = v;
    }
    return m;
  }

  function tsMs(iso) { if (!iso) return 0; var t = new Date(iso).getTime(); return isNaN(t) ? 0 : t; }
  function isoOf(ms) { try { return new Date(ms || Date.now()).toISOString(); } catch (_e) { return new Date().toISOString(); } }

  // ── slot → 서버 payload (이미지 URL 치환 후) ─────────────────
  function buildPayload(slot) {
    var urls = Array.from(collectDataUrls(slot));
    // 순차 업로드 (draft 사진 수 적음, 서버·네트워크 배려).
    return urls.reduce(function (p, du) { return p.then(function (map) { return uploadImage(du).then(function (u) { if (u) map.set(du, u); return map; }); }); }, Promise.resolve(new Map()))
      .then(function (map) {
        // [버그수정 2026-07-06] 업로드 실패분이 하나라도 있으면 payload 불완전 → 이 사실을 상위(pushSlot)에
        //   알려 slot 을 synced 로 마킹하지 않게 한다(안 그러면 실패한 사진이 서버·로컬 양쪽에서 소실).
        var _complete = (urls.length === map.size);
        var c = deepReplace(_clone(slot), map);
        var photos = (c.photos || []).map(function (p, i) {
          var img = p.editedDataUrl || p.dataUrl;
          return {
            photo_id: String(p.id || ('p' + i)),
            role: p.role || 'hero',
            image_url: (typeof img === 'string' && img.indexOf('data:') !== 0) ? img : null,
            base_url: (typeof p.baseUrl === 'string' && p.baseUrl.indexOf('data:') !== 0) ? p.baseUrl : null,
            edit_state: p.editState || null,
            sort_order: i,
          };
        }).filter(function (p) { return !!p.image_url; });   // 이미지 없는 사진은 스킵
        return {
          _complete: _complete,
          payload: {
            slot_id: String(slot.id),
            label: slot.label || '',
            caption: slot.caption || '',
            hashtags: slot.hashtags || '',
            publish: slot.publish || null,
            customer_id: (slot.customer_id != null ? slot.customer_id : null),
            sort_order: slot.order || 0,
            meta: buildMeta(slot),
            client_updated_at: isoOf(slot.updatedAt),
            photos: photos,
          },
        };
      });
  }

  // ── 서버 slot → 로컬 slot 형태 복원 ──────────────────────────
  function remoteToLocal(rs) {
    var photos = (rs.photos || []).map(function (p) {
      return {
        id: p.photo_id, role: p.role || 'hero', selected: true,
        dataUrl: p.base_url || p.image_url,
        editedDataUrl: p.image_url,
        baseUrl: p.base_url || p.image_url,
        editState: p.edit_state || null,
      };
    });
    var slot = Object.assign({}, rs.meta || {}, {
      id: rs.slot_id, label: rs.label || '', caption: rs.caption || '',
      hashtags: rs.hashtags || '', publish: rs.publish || null,
      customer_id: (rs.customer_id != null ? rs.customer_id : null),
      order: rs.sort_order || 0, photos: photos,
      updatedAt: tsMs(rs.client_updated_at), syncState: 'synced',
    });
    return slot;
  }

  function loadAllLocal() { return has(window.loadSlotsFromDB) ? Promise.resolve(window.loadSlotsFromDB()).catch(function () { return []; }) : Promise.resolve([]); }
  function refreshHome() { try { if (window.WorkspaceV2 && has(window.WorkspaceV2.refresh)) window.WorkspaceV2.refresh(); } catch (_e) { void 0; } }

  // ── Phase B: 다른 기기에서 온 http 이미지 → 로컬 dataURL 재수화(hydration) ──
  //   다른 기기가 올린 slot 은 이미지가 Supabase https URL. 뷰·단일발행(fetch→blob)은 CORS(*)로 바로 되지만,
  //   편집기/캐러셀은 캔버스에 다시 굽는데 크로스오리진 이미지는 캔버스를 오염(taint)시켜 export 가 막힌다.
  //   → 픽셀이 필요한 순간(편집기 열기·캐러셀 발행) 직전에 http 이미지를 data:URL 로 되돌려, 로컬 생성 slot 과 동일하게 다룬다.
  var _hydrateCache = new Map();
  function _isHttp(u) { return typeof u === 'string' && /^https?:\/\//.test(u); }
  function _isSyncedImg(u) { return _isHttp(u) && (/\/storage\/v1\/object\/public\//.test(u) || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(u)); }
  function hydrateUrl(url) {
    if (_hydrateCache.has(url)) return Promise.resolve(_hydrateCache.get(url));
    return fetch(url).then(function (r) { return r.ok ? r.blob() : null; }).then(function (b) {
      if (!b) return null;
      return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = function () { res(null); }; fr.readAsDataURL(b); });
    }).then(function (du) { if (du) _hydrateCache.set(url, du); return du; }).catch(function (e) { log('hydrate fail', e); return null; });
  }
  function collectSyncedImgs(obj, out, depth) {
    out = out || new Set(); depth = depth || 0;
    if (obj == null || depth > 8) return out;
    if (_isSyncedImg(obj)) { out.add(obj); return out; }
    if (typeof obj !== 'object') return out;
    if (Array.isArray(obj)) { for (var i = 0; i < obj.length; i++) collectSyncedImgs(obj[i], out, depth + 1); return out; }
    for (var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) collectSyncedImgs(obj[k], out, depth + 1); }
    return out;
  }
  function deepMapReplace(obj, map, depth) {
    depth = depth || 0;
    if (obj == null || depth > 8) return obj;
    if (typeof obj === 'string') return map.has(obj) ? map.get(obj) : obj;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(function (v) { return deepMapReplace(v, map, depth + 1); });
    var out = {};
    for (var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = deepMapReplace(obj[k], map, depth + 1); }
    return out;
  }
  // photos 배열을 제자리(in place) 수화 — dataUrl/editedDataUrl/baseUrl + editState 중첩까지. 바뀐 게 있으면 true.
  function hydratePhotos(photos) {
    if (!enabled() || !Array.isArray(photos) || !photos.length) return Promise.resolve(false);
    var urls = new Set();
    photos.forEach(function (p) {
      if (!p) return;
      ['dataUrl', 'editedDataUrl', 'baseUrl'].forEach(function (k) { if (_isSyncedImg(p[k])) urls.add(p[k]); });
      if (p.editState) collectSyncedImgs(p.editState, urls, 0);
    });
    if (!urls.size) return Promise.resolve(false);
    var arr = Array.from(urls);
    return arr.reduce(function (pr, u) { return pr.then(function (m) { return hydrateUrl(u).then(function (du) { if (du) m.set(u, du); return m; }); }); }, Promise.resolve(new Map()))
      .then(function (map) {
        if (!map.size) return false;
        photos.forEach(function (p) {
          if (!p) return;
          ['dataUrl', 'editedDataUrl', 'baseUrl'].forEach(function (k) { if (map.has(p[k])) p[k] = map.get(p[k]); });
          if (p.editState) p.editState = deepMapReplace(p.editState, map, 0);
        });
        return true;
      });
  }

  // ── PUSH — dirty slot 업서트 + tombstone 삭제 반영 ───────────
  var _pushing = false;
  function pushAll() {
    if (!ready() || _pushing) return Promise.resolve();
    _pushing = true;
    return flushTombstones()
      .then(loadAllLocal)
      .then(function (slots) {
        var dirty = (slots || []).filter(function (s) { return s && s.syncState !== 'synced'; });
        log('push dirty', dirty.length);
        return dirty.reduce(function (p, slot) { return p.then(function () { return pushSlot(slot); }); }, Promise.resolve());
      })
      .catch(function (e) { log('pushAll err', e); })
      .then(function () { _pushing = false; });
  }
  function pushSlot(slot) {
    return buildPayload(slot).then(function (built) {
      var payload = built.payload, complete = built._complete;
      return window.apiFetch('/workspace/slots/upsert', {
        method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, authHeader()), body: JSON.stringify(payload),
      }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (j && (j.ok || j.skipped)) {
          // [버그수정 2026-07-06] 사진 업로드가 하나라도 실패했으면 synced 로 굳히지 않는다(dirty 유지 → 다음 push 재시도).
          //   안 그러면 실패 사진이 서버에 없는 채 synced 로 마킹돼 pull 이 로컬을 덮어 영구 소실.
          if (complete) {
            slot.syncState = 'synced';
            if (_origSaveSlot) return Promise.resolve(_origSaveSlot(slot)).catch(function () {});   // synced 상태만 영속(재-dirty 안 함)
          } else {
            log('pushSlot partial — keep dirty for retry', slot && slot.id);
          }
        }
      });
    }).catch(function (e) { log('pushSlot err', slot && slot.id, e); });
  }
  function flushTombstones() {
    return listTombstones().then(function (tombs) {
      return (tombs || []).reduce(function (p, t) {
        return p.then(function () {
          return window.apiFetch('/workspace/slots/' + encodeURIComponent(t.slot_id), { method: 'DELETE', headers: authHeader() })
            .then(function (r) { if (r.ok) return delTombstone(t.slot_id); })
            .catch(function (e) { log('tomb del err', e); });
        });
      }, Promise.resolve());
    });
  }

  // ── PULL — delta 병합(LWW) ──────────────────────────────────
  var _pulling = false;
  function pull() {
    if (!ready() || _pulling) return Promise.resolve();
    _pulling = true;
    return getMeta('lastPulledAt').then(function (since) {
      var url = '/workspace/slots' + (since ? ('?since=' + encodeURIComponent(since)) : '');
      return window.apiFetch(url, { method: 'GET', headers: authHeader() }).then(function (r) { return r.ok ? r.json() : null; });
    }).then(function (resp) {
      if (!resp || !Array.isArray(resp.slots)) return;
      return loadAllLocal().then(function (locals) {
        var byId = {}; (locals || []).forEach(function (s) { if (s && s.id != null) byId[String(s.id)] = s; });
        var changed = false;
        var applyFailed = false;   // [버그수정 2026-07-06] 적용 실패분 있으면 lastPulledAt 전진 금지(그 slot 이 영영 누락되던 것)
        return resp.slots.reduce(function (p, rs) {
          return p.then(function () {
            var local = byId[String(rs.slot_id)];
            if (rs.deleted) {
              if (local && has(_origDeleteSlot)) {
                var delMs = tsMs(rs.deleted_at);
                if (!local.updatedAt || local.updatedAt <= delMs) { changed = true; return Promise.resolve(_origDeleteSlot(rs.slot_id)).catch(function () { applyFailed = true; }).then(function () { return delTombstone(rs.slot_id); }); }
              }
              return delTombstone(rs.slot_id);   // 서버가 삭제 확인 → 로컬 tombstone 정리
            }
            // 로컬이 아직 안 올라간 변경(=synced 아님)이고 더 최신이면 로컬 유지(다음 push 로 서버 갱신).
            //   [버그수정 2026-07-06] push 필터(!=='synced')와 술어 일치 — 'dirty' 외 값(undefined 등)도 방어.
            if (local && local.syncState !== 'synced' && (local.updatedAt || 0) > tsMs(rs.client_updated_at)) return;
            changed = true;
            return Promise.resolve(_origSaveSlot(remoteToLocal(rs))).catch(function () { applyFailed = true; });
          });
        }, Promise.resolve()).then(function () {
          // 하나라도 적용 실패면 since 를 전진시키지 않는다 → 다음 pull 이 그 delta 를 다시 받아 재시도.
          if (resp.server_time && !applyFailed) setMeta('lastPulledAt', resp.server_time);
          if (changed) refreshHome();
        });
      });
    }).catch(function (e) { log('pull err', e); }).then(function () { _pulling = false; });
  }

  // ── 최초 로그인 마이그레이션 — 로컬 slot 1회 서버 업로드 ──────
  function migrateIfNeeded() {
    if (!ready()) return Promise.resolve();
    return getMeta('migratedAt').then(function (m) {
      if (m) return;
      return loadAllLocal().then(function (slots) {
        var now = Date.now();
        return (slots || []).reduce(function (p, s) {
          return p.then(function () {
            if (!s) return;
            if (!s.updatedAt) s.updatedAt = now;
            s.syncState = 'dirty';
            if (_origSaveSlot) return Promise.resolve(_origSaveSlot(s)).catch(function () {});
          });
        }, Promise.resolve()).then(function () { return setMeta('migratedAt', isoOf(now)); });
      });
    });
  }

  // ── 통합 sync ───────────────────────────────────────────────
  var _syncing = false;
  function sync() {
    if (!ready() || _syncing) return Promise.resolve();
    _syncing = true;
    // 편집 플로우 열려 있으면(coalesce) 자동 push 생략 — 정착(settleSlot)이나 idle 백스톱에서만 올림. pull 은 계속.
    return migrateIfNeeded().then(function () { return (COALESCE() && _flowOpen) ? null : pushAll(); }).then(pull).catch(function (e) { log('sync err', e); }).then(function () { _syncing = false; });
  }
  var _pushTimer = null;
  function schedulePush() { if (!ready()) return; clearTimeout(_pushTimer); _pushTimer = setTimeout(function () { pushAll(); }, 1200); }

  // ── coalesce(비용 방어) — 편집 중엔 매 저장마다 업로드하지 않고, '정착(settle)' 때 1회만 ──
  //   sub-flag ITDASY_SLOT_SYNC_COALESCE. off면 기존 eager 동작 그대로.
  //   신규 slot 은 open 시점에 안정적 id가 없으므로 slot별이 아니라 '플로우 열림' 단위로 억제한다.
  var _flowOpen = false;
  var _idleTimer = null;
  function COALESCE() { return window.ITDASY_SLOT_SYNC_COALESCE === true; }
  function _armIdle() { if (_idleTimer) clearTimeout(_idleTimer); _idleTimer = setTimeout(function () { settleSlot(); }, 20000); }  // 백스톱: 20s 무저장이면 정착
  function _clearIdle() { if (_idleTimer) { clearTimeout(_idleTimer); _idleTimer = null; } }
  function beginEdit() { if (!COALESCE()) return; _flowOpen = true; clearTimeout(_pushTimer); _clearIdle(); }   // 편집 시작 → auto-push 억제
  function settleSlot() { _flowOpen = false; _clearIdle(); if (!ready()) return Promise.resolve(); return pushAll(); }   // 정착 → 최종본 1회 push

  // ── 전역 래핑 — 저장/삭제 시 dirty 표시 + 동기화 트리거 ──────
  function wrapGlobals() {
    if (has(window.saveSlotToDB) && !window.saveSlotToDB.__wsSyncWrapped) {
      _origSaveSlot = window.saveSlotToDB;
      var wrappedSave = function (slot) {
        try { if (slot && typeof slot === 'object') { slot.updatedAt = Date.now(); slot.syncState = 'dirty'; } } catch (_e) { void 0; }
        var out = _origSaveSlot.apply(this, arguments);
        // 편집 플로우 열려 있으면(coalesce) 즉시 push 대신 idle 백스톱만 — 정착 때 1회 업로드.
        Promise.resolve(out).then(function () { if (COALESCE() && _flowOpen) _armIdle(); else schedulePush(); }).catch(function () {});
        return out;
      };
      wrappedSave.__wsSyncWrapped = true;
      window.saveSlotToDB = wrappedSave;
    }
    if (has(window.deleteSlotFromDB) && !window.deleteSlotFromDB.__wsSyncWrapped) {
      _origDeleteSlot = window.deleteSlotFromDB;
      var wrappedDel = function (id) {
        var out = _origDeleteSlot.apply(this, arguments);
        Promise.resolve(out).then(function () { return addTombstone(String(id)); }).then(function () { if (ready()) flushTombstones(); }).catch(function () {});
        return out;
      };
      wrappedDel.__wsSyncWrapped = true;
      window.deleteSlotFromDB = wrappedDel;
    }
  }

  // ── 로그아웃/계정전환 시 로컬 sync 메타 완전 삭제 ──────────────
  //   [버그수정 2026-07-06] logout 은 itdasy-gallery(slots)만 지우고 itdasy-sync(migratedAt·lastPulledAt·
  //   tombstones)는 안 지웠다 → 다음 계정에서 migrate skip·delta 누락으로 계정 격리 붕괴+slot 유실.
  function clearLocal() {
    return new Promise(function (resolve) {
      try {
        if (_sdb) { try { _sdb.close(); } catch (_e) { void 0; } _sdb = null; }
        try { _uploadCache.clear(); } catch (_e2) { void 0; }
        try { if (typeof _hydrateCache !== 'undefined' && _hydrateCache) _hydrateCache.clear(); } catch (_e3) { void 0; }
        var req = indexedDB.deleteDatabase('itdasy-sync');
        req.onsuccess = req.onerror = req.onblocked = function () { resolve(true); };
      } catch (_e) { resolve(false); }
    });
  }

  // ── init ───────────────────────────────────────────────────
  function init() {
    if (!enabled()) { window.WorkspaceSync = { enabled: false, sync: function () { return Promise.resolve(); }, hydratePhotos: function () { return Promise.resolve(false); }, beginEdit: function () {}, settleSlot: function () { return Promise.resolve(); }, clearLocal: clearLocal }; return; }
    wrapGlobals();
    window.WorkspaceSync = { enabled: true, sync: sync, pull: pull, push: pushAll, hydratePhotos: hydratePhotos, beginEdit: beginEdit, settleSlot: settleSlot, clearLocal: clearLocal, _debug: { buildPayload: buildPayload, remoteToLocal: remoteToLocal, hydratePhotos: hydratePhotos } };
    // 최초 동기화 — 로그인 상태 갖춰지면. 아니면 이후 트리거에서 재시도.
    var tries = 0;
    (function boot() { if (ready()) { sync(); } else if (tries++ < 20) { setTimeout(boot, 800); } })();
    window.addEventListener('online', function () { sync(); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) sync(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
