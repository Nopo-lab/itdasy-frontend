/*
 * shop-style.js — 우리샵 스타일(브랜드 디자인) 데이터모델 v1  [Phase A-3]
 *
 * "우리샵 스타일" = 원장의 브랜드 디자인 자산(텍스트 레이어 좌표·폰트·색·외곽선·그림자,
 *   로고/워터마크 위치, 프레임/여백/줄바꿈 규칙 등). 기존 템플릿을 대체하는 핵심 개념.
 *
 * 이 모듈은 데이터 계층만 담당(저장/불러오기/CRUD/시드). 실제 자동 배치(autoLayout 실동작)와
 *   편집기 연결은 Phase B/C에서. window.ShopStyle 로 공개.
 *
 * 저장소: localStorage
 *   - itdasy:shop_style:list   → 스타일 배열(JSON)
 *   - itdasy:shop_style:active → 활성 스타일 id
 *   ※ 로고 PNG 등 대용량 바이너리는 v1에선 dataUrl 로 인라인. 커지면 IndexedDB 로 이관(후속).
 *
 * 좌표계: 모든 x/y/w 는 프레임 기준 0..1 상대값(반응형). 폰트 size 는 프레임 짧은 변 대비 비율(0..1).
 */
(function () {
  'use strict';

  var K_LIST = 'itdasy:shop_style:list';
  var K_ACTIVE = 'itdasy:shop_style:active';
  var SCHEMA = 1;

  // ── 저수준 저장 ───────────────────────────────────────────────
  function _read(key, fallback) {
    try { var v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
    catch (_e) { return fallback; }
  }
  function _write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (_e) { return false; }   // quota 초과 등은 조용히 실패(상위에서 토스트)
  }
  function _uid() {
    return (typeof window._uid === 'function') ? window._uid()
      : 'ss_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  function _now() { return Date.now(); }

  // ── 스키마 빌더 ───────────────────────────────────────────────
  // 텍스트 레이어 1개. role: title|sub|body|hashtag. 좌표/타이포 전부 보존.
  function makeLayer(role, over) {
    var base = {
      role: role,
      text: '',
      x: 0.08, y: 0.5, w: 0.84,          // 프레임 상대 좌표(좌상단 기준)·폭
      font: 'Pretendard',
      size: 0.06,                         // 짧은 변 대비 비율
      color: '#ffffff',
      weight: 700,
      align: 'left',                      // left|center|right
      lineHeight: 1.25,
      letterSpacing: 0,
      opacity: 1,
      outline: { on: false, color: '#000000', width: 0 },
      shadow: { on: true, color: 'rgba(0,0,0,.45)', blur: 8, x: 0, y: 2 }
    };
    return Object.assign(base, over || {});
  }

  // 기본 스타일 — 스펙 편집화면(이미지 02)의 배치 근사: 화면 중앙~하단 좌측 정렬.
  //   제목(큰 굵은 글씨) → 부제목 → 본문 순으로 아래로 흐름.
  function defaultStyle(name) {
    var t = _now();
    return {
      id: _uid(),
      schema: SCHEMA,
      name: name || '우리샵 스타일 A',
      isDefault: true,
      version: 1,                         // 수정 누적 버전(Phase C 학습/버전관리에서 증가)
      confirmed: false,                   // [5차] 원장이 스타일을 '명시적으로 확정'했는가. 시드/자동생성=false.
                                          //   false 면 자동 텍스트 오버레이(시술명·해시태그) 안 박음 — 확정 opt-in.
      createdAt: t,
      updatedAt: t,
      frame: { ratio: '4:5', pad: 0.06 }, // 게시 프레임 비율 + 안전 여백(상대)
      margin: { x: 0.08, y: 0.08 },
      layers: [
        makeLayer('title',   { y: 0.46, size: 0.085, weight: 800, lineHeight: 1.1 }),
        makeLayer('sub',     { y: 0.565, size: 0.055, weight: 700 }),
        makeLayer('body',    { y: 0.66, size: 0.038, weight: 500, lineHeight: 1.5, opacity: 0.95 }),
        makeLayer('hashtag', { y: 0.90, size: 0.030, weight: 600, color: '#cfe3ff', opacity: 0.9 })
      ],
      logo: null,                         // { dataUrl, x, y, w, opacity }
      watermark: null,                    // { text, x, y, opacity, color }
      wrapRule: { maxCharsPerLine: 16 },  // 자동 줄바꿈 기준
      maxLen: { title: 18, sub: 24, body: 120 }
    };
  }

  // ── 컬렉션 CRUD ───────────────────────────────────────────────
  function list() {
    var arr = _read(K_LIST, null);
    return Array.isArray(arr) ? arr : [];
  }
  function _persist(arr) { return _write(K_LIST, arr); }

  function get(id) {
    var arr = list();
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return null;
  }
  function getActiveId() { return _read(K_ACTIVE, null); }
  function getActive() {
    var id = getActiveId();
    return (id && get(id)) || list()[0] || null;
  }
  function setActive(id) {
    if (!get(id)) return false;
    _write(K_ACTIVE, id);
    return true;
  }

  // 부분 스키마로 새 스타일 생성(기본값 위에 덮어쓰기). 저장 + 활성 옵션.
  function create(partial, makeActive) {
    var s = Object.assign(defaultStyle(partial && partial.name), partial || {});
    s.id = _uid(); s.isDefault = list().length === 0; s.createdAt = s.updatedAt = _now();
    var arr = list(); arr.push(s); _persist(arr);
    if (makeActive || arr.length === 1) _write(K_ACTIVE, s.id);
    return s;
  }

  // 기존 스타일 저장(부분 patch 머지) → version/updatedAt 증가.
  function save(id, patch) {
    var arr = list();
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) {
        arr[i] = Object.assign({}, arr[i], patch || {}, {
          id: id,
          version: (arr[i].version || 1) + (patch && patch._bumpVersion === false ? 0 : 1),
          updatedAt: _now()
        });
        delete arr[i]._bumpVersion;
        _persist(arr);
        return arr[i];
      }
    }
    return null;
  }

  function duplicate(id, newName) {
    var src = get(id); if (!src) return null;
    var copy = JSON.parse(JSON.stringify(src));
    copy.id = _uid(); copy.name = newName || (src.name + ' 복사본');
    copy.isDefault = false; copy.version = 1; copy.createdAt = copy.updatedAt = _now();
    var arr = list(); arr.push(copy); _persist(arr);
    return copy;
  }

  function remove(id) {
    var arr = list().filter(function (s) { return s.id !== id; });
    _persist(arr);
    if (getActiveId() === id) _write(K_ACTIVE, arr[0] ? arr[0].id : null);
    return true;
  }

  // 최초 1회 기본 스타일 시드 — 비어 있으면 1개 생성하고 활성 지정. 반환=활성 스타일.
  function ensureSeed() {
    if (!list().length) {
      var s = create({ name: '우리샵 스타일 A' }, true);
      return s;
    }
    if (!getActiveId()) _write(K_ACTIVE, list()[0].id);
    return getActive();
  }

  // [5차] 스타일이 '확정됐는가' — 자동 텍스트 오버레이 opt-in 게이트의 단일 판정.
  //   ① confirmed 필드가 있으면(신규 스타일) 그대로 사용.
  //   ② 필드가 없는 옛 스타일(마이그레이션): '손댔으면' 확정 취급(하위호환 — 쓰던 원장은 계속 나오게).
  //      판정 = 로고/워터마크를 설정했거나, 레이어 구성이 시드 기본(defaultStyle)과 다름.
  //      ⚠ version 은 자동 학습(_learnShopStyle)도 올리므로 판정에 쓰지 않는다.
  function isConfirmed(s) {
    if (!s) return false;
    if (typeof s.confirmed === 'boolean') return s.confirmed;
    if (s.logo && s.logo.dataUrl) return true;
    if (s.watermark && (s.watermark.text || '').trim()) return true;
    var _fp = function (ls) {
      return (ls || []).map(function (l) {
        // 역할·타입·enabled·고정텍스트 유무로 구성 지문(위치/폰트 미세값은 제외 — 학습 미세조정만으론 확정 아님)
        return (l.role || '') + '/' + (l.type || 'text') + '/' + (l.enabled === false ? '0' : '1') + '/' + (l.text ? 'T' : '');
      }).join('|');
    };
    return _fp(s.layers) !== _fp(defaultStyle().layers);
  }

  // 표시용 — '최근 수정 YYYY.MM.DD'
  function formatUpdated(s) {
    if (!s || !s.updatedAt) return '';
    var d = new Date(s.updatedAt);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate());
  }

  window.ShopStyle = {
    SCHEMA: SCHEMA,
    KEYS: { list: K_LIST, active: K_ACTIVE },
    makeLayer: makeLayer,
    defaultStyle: defaultStyle,
    list: list,
    get: get,
    getActive: getActive,
    getActiveId: getActiveId,
    setActive: setActive,
    create: create,
    save: save,
    duplicate: duplicate,
    remove: remove,
    ensureSeed: ensureSeed,
    isConfirmed: isConfirmed,
    formatUpdated: formatUpdated
  };
})();
