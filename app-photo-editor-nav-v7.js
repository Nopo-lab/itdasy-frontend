/* 사진 편집기 — 하단 2단 카테고리/서브칩 메뉴 (v329 2026-05-28 nav-v7 preview)

   목적: 뷰티캠 그라마(상단 = 활성 카테고리의 도구 칩, 하단 = 카테고리) 도입.
         사진 1회 업로드 후 백버튼 없이 카테고리·서브칩만 좌우스크롤로 이동.

   ⚠️ v329 정책: feature flag 기본 OFF. 호환성·회귀 안전 위해 기존 .pe-tabs 와 공존.
       활성화 방법:
         localStorage.setItem('PE_NAV_V7', '1')  또는  URL ?nav_v7=1
       활성 시 기존 .pe-tabs 는 hide, 신규 2단 메뉴 mount.

   외부 의존:
     - PhotoEditor (탭 클릭/state 접근)
     - 기존 탭 시스템 (서브칩 → 탭 매핑으로 호출)
   외부 영향: 0 (플래그 OFF 일 때 mount 안 함, DOM 추가 없음).

   API:
     window.PhotoEditorNavV7 = {
       isEnabled()
       setEnabled(on)
       mount()                 — 수동 mount (자동 OFF 일 때)
       unmount()
       setCategory(catId)
       setSubChip(chipId)
     };
*/
(function () {
  'use strict';
  if (window.PhotoEditorNavV7) return;

  const FLAG_KEY = 'PE_NAV_V7';
  const NAV_ID = 'peNavV7';

  // ── 카테고리 + 서브칩 정의 ─────────────────────────────
  // 서브칩 → 기존 탭(tab) + (옵션) beautyFocus 매핑
  // [PR-4a] 중복 메뉴 정리: AI도구/추천보정/우리샵자동/헤어추천/네일추천 제거,
  //   보정 진입을 "부위보정" 하나로 통합(잇비 NL + 부위보정 + 전체조정/부분보정 = 보정 컨텍스트 sub-chip).
  //   헤어/피부/네일 별도 추천 메뉴 금지. 샵별 자동은 잇비 채팅 NL로(PR-5).
  //   기존 탭/패널(auto, beautyFocus 등)은 삭제 아님 — nav 노출만 제외(기능 보존).
  const CATEGORIES = [
    { id: 'beauty',   label: '부위보정', icon: 'sparkles', chips: [
      { id: 'beauty-itbi',   label: '잇비에게 말하기', tab: 'ai' },
      { id: 'beauty-region', label: '부위보정',        tab: 'beauty' },
      { id: 'beauty-tune',   label: '전체 조정',       tab: 'tune' },
      { id: 'beauty-part',   label: '부분 보정',       tab: 'selective' },
    ]},
    { id: 'bg',       label: '배경', icon: 'frame', chips: [
      { id: 'bg-blur',      label: '배경 흐림', tab: 'bg' },
      { id: 'bg-select',    label: '배경 선택', tab: 'bg' },
      { id: 'bg-cutout',    label: '누끼',      tab: 'bg' },
    ]},
    { id: 'template', label: '템플릿', icon: 'stack', chips: [
      { id: 'tpl-feed',     label: '피드',      tab: 'template' },
      { id: 'tpl-story',    label: '스토리',    tab: 'template' },
      { id: 'tpl-price',    label: '가격표',    tab: 'template' },
    ]},
    { id: 'text',     label: '텍스트', icon: 'typography', chips: [
      { id: 'text-add',     label: '텍스트',  tab: 'text' },
      { id: 'text-brand',   label: '샵 정보', tab: 'brand' },
    ]},
    { id: 'compare',  label: '전후', icon: 'compare', chips: [
      { id: 'tpl-ba',       label: '전후 비교', tab: 'ba' },
    ]},
    { id: 'export',   label: '저장', icon: 'resize', chips: [
      { id: 'export-ratio', label: '비율',        tab: 'export' },
      { id: 'export-save',  label: '저장',        tab: 'export' },
      { id: 'export-set',   label: '피드/스토리', tab: 'export' },
    ]},
  ];

  // 인라인 SVG (entry-v6 와 동일 패턴 — 외부 폰트 의존 0)
  const ICONS = {
    'wand':       '<svg viewBox="0 0 24 24"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M15 9h0M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5"/></svg>',
    'compare':    '<svg viewBox="0 0 24 24"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>',
    'sparkles':   '<svg viewBox="0 0 24 24"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>',
    'droplet':    '<svg viewBox="0 0 24 24"><path d="M12 2.69 5.66 9.04a8 8 0 1 0 12.68 0Z"/></svg>',
    'adjustments':'<svg viewBox="0 0 24 24"><circle cx="6" cy="10" r="2"/><path d="M6 4v4M6 12v8"/><circle cx="12" cy="16" r="2"/><path d="M12 4v10M12 18v2"/><circle cx="18" cy="7" r="2"/><path d="M18 4v1M18 9v11"/></svg>',
    'typography': '<svg viewBox="0 0 24 24"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>',
    'resize':     '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 21V9h12"/></svg>',
    'stack':      '<svg viewBox="0 0 24 24"><path d="m12 2 9 4.5-9 4.5L3 6.5 12 2zM21 12l-9 4.5L3 12M21 17.5l-9 4.5-9-4.5"/></svg>',
    'frame':      '<svg viewBox="0 0 24 24"><path d="M22 6 6 22M22 18 6 2M2 6h20M2 18h20"/></svg>',
  };
  function _ic(name) { return '<span class="pe-nav-v7-ic">' + (ICONS[name] || '') + '</span>'; }

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  // ── 상태 ──────────────────────────────────────────────
  let _activeCategory = 'beauty';      // [PR-4a] 기본 = 부위보정 카테고리
  let _activeChip = 'beauty-region';   // [PR-4a] 기본 칩 = 부위보정(슬라이더)
  let _mounted = false;

  function _query(qs) {
    try { return new URLSearchParams(window.location.search).get(qs); }
    catch (_e) { return null; }
  }
  // v330 cutover — default ON.
  //   비활성: localStorage.PE_NAV_V7='0' 또는 URL ?nav_v7=0
  //   활성:   기본값 (또는 명시 '1')
  function isEnabled() {
    const urlVal = _query('nav_v7');
    if (urlVal === '0') return false;
    if (urlVal === '1') return true;
    try {
      if (window.localStorage) {
        const v = localStorage.getItem(FLAG_KEY);
        if (v === '0') return false;
        // v === '1' 또는 null/undefined 모두 ON 으로 간주
      }
    } catch (_e) { /* ignore */ }
    return true;
  }
  function setEnabled(on) {
    try {
      if (on) localStorage.removeItem(FLAG_KEY);   // default ON 으로 복귀
      else    localStorage.setItem(FLAG_KEY, '0'); // 명시 OFF
    } catch (_e) { /* ignore */ }
    if (on) { try { mount(); } catch (_e) { /* ignore */ } }
    else    { try { unmount(); } catch (_e) { /* ignore */ } }
    return isEnabled();
  }

  // ── DOM 빌드 ──────────────────────────────────────────
  function _buildHTML() {
    const cat = CATEGORIES.find(c => c.id === _activeCategory) || CATEGORIES[0];
    const chips = cat ? cat.chips : [];
    return `<div class="pe-nav-v7-row pe-nav-v7-subchips" id="peNavV7Sub">
        ${chips.map(_chipBtn).join('')}
      </div>
      <div class="pe-nav-v7-row pe-nav-v7-cats" id="peNavV7Cats">
        ${CATEGORIES.map(_catBtn).join('')}
      </div>`;
  }
  function _catBtn(cat) {
    const on = cat.id === _activeCategory ? ' on' : '';
    return `<button type="button" class="pe-nav-v7-cat${on}" data-pev7-cat="${_esc(cat.id)}">
      ${_ic(cat.icon || 'sparkles')}
      <span class="pe-nav-v7-cat-label">${_esc(cat.label)}</span>
    </button>`;
  }
  function _chipBtn(chip) {
    const on = chip.id === _activeChip ? ' on' : '';
    return `<button type="button" class="pe-nav-v7-chip${on}" data-pev7-chip="${_esc(chip.id)}">${_esc(chip.label)}</button>`;
  }

  function _ensureContainer() {
    const sheet = document.getElementById('photoEditorSheet');
    if (!sheet) return null;
    let nav = document.getElementById(NAV_ID);
    if (nav) return nav;
    nav = document.createElement('nav');
    nav.id = NAV_ID;
    nav.className = 'pe-nav-v7';
    // pe-tabs 와 같은 부모(.pe-root) 안에 삽입 — pe-tabs 바로 위
    const tabs = sheet.querySelector('#peTabs');
    if (tabs && tabs.parentNode) {
      tabs.parentNode.insertBefore(nav, tabs);
    } else {
      sheet.appendChild(nav);
    }
    nav.addEventListener('click', _onClick);
    return nav;
  }

  // ── 동작 ──────────────────────────────────────────────
  function _onClick(e) {
    const catBtn = e.target.closest('[data-pev7-cat]');
    if (catBtn) { setCategory(catBtn.dataset.pev7Cat); return; }
    const chipBtn = e.target.closest('[data-pev7-chip]');
    if (chipBtn) { setSubChip(chipBtn.dataset.pev7Chip); return; }
  }

  function setCategory(catId) {
    const cat = CATEGORIES.find(c => c.id === catId);
    if (!cat) return false;
    _activeCategory = cat.id;
    // 첫 서브칩 자동 활성 + 매핑 탭 클릭
    if (cat.chips && cat.chips.length) {
      setSubChip(cat.chips[0].id);
    } else {
      _rerender();
    }
    return true;
  }

  function setSubChip(chipId) {
    for (let i = 0; i < CATEGORIES.length; i++) {
      const cat = CATEGORIES[i];
      const chip = cat.chips.find(c => c.id === chipId);
      if (chip) {
        _activeCategory = cat.id;
        _activeChip = chip.id;
        _applyChipToEditor(chip);
        _rerender();
        return true;
      }
    }
    return false;
  }

  function _applyChipToEditor(chip) {
    try {
      const PE = window.PhotoEditor;
      const st = PE && PE._internal && PE._internal.getState ? PE._internal.getState() : null;
      // beautyFocus 사전 설정 (헤어/뷰티 카테고리)
      if (st && chip.beautyFocus) {
        st.beautyFocus = chip.beautyFocus;
      }
      // 기존 탭 버튼을 프로그래매틱 클릭 — 핸들러 그대로 동작
      const tabBtn = document.querySelector('#peTabs [data-pe-tab="' + chip.tab + '"]');
      if (tabBtn) tabBtn.click();
    } catch (e) {
      console.warn('[nav-v7] applyChip failed:', e && e.message);
    }
  }

  function _rerender() {
    const nav = document.getElementById(NAV_ID);
    if (!nav) return;
    nav.innerHTML = _buildHTML();
    // v319 — 활성 서브칩/카테고리를 행 가운데로 (행만 스크롤 → 페이지 스크롤 부작용 없음)
    _centerActive(nav, '.pe-nav-v7-subchips', '.pe-nav-v7-chip.on');
    _centerActive(nav, '.pe-nav-v7-cats', '.pe-nav-v7-cat.on');
  }

  function _centerActive(nav, rowSel, activeSel) {
    const row = nav.querySelector(rowSel);
    const el = row && row.querySelector(activeSel);
    if (!row || !el) return;
    const target = el.offsetLeft - (row.clientWidth - el.clientWidth) / 2;
    const left = Math.max(0, target);
    try { row.scrollTo({ left: left, behavior: 'smooth' }); }
    catch (_e) { row.scrollLeft = left; }
  }

  function mount() {
    if (_mounted) return true;
    const nav = _ensureContainer();
    if (!nav) return false;
    nav.innerHTML = _buildHTML();
    const sheet = document.getElementById('photoEditorSheet');
    if (sheet) sheet.classList.add('pe-nav-v7-active');
    _mounted = true;
    return true;
  }

  function unmount() {
    const nav = document.getElementById(NAV_ID);
    if (nav && nav.parentNode) nav.parentNode.removeChild(nav);
    const sheet = document.getElementById('photoEditorSheet');
    if (sheet) sheet.classList.remove('pe-nav-v7-active');
    _mounted = false;
  }

  // ── 부팅 ──────────────────────────────────────────────
  function _boot() {
    if (!isEnabled()) return;
    // sheet 이 생성될 때까지 폴링 (PhotoEditor.open 호출 후 ensureSheet)
    let tries = 0;
    const iv = setInterval(() => {
      const sheet = document.getElementById('photoEditorSheet');
      if (sheet || ++tries > 80) {
        if (sheet) { try { mount(); } catch (e) { console.warn('[nav-v7] mount failed:', e && e.message); } }
        clearInterval(iv);
      }
    }, 120);
  }

  window.PhotoEditorNavV7 = {
    isEnabled, setEnabled, mount, unmount, setCategory, setSubChip,
    CATEGORIES,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    _boot();
  }
})();
