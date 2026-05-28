/* ─────────────────────────────────────────────────────────────
   다크모드 토글 — 2단계 순환: 라이트 ↔ 다크
   - localStorage: itdasy_theme = 'light' | 'dark'
   - body[data-theme] 속성 사용, CSS 에서 `[data-theme="dark"]` 선택자로 적용
   ──────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const STORAGE_KEY = 'itdasy_theme';
  const MODES = ['light', 'dark'];
  const LABELS = { light: '라이트', dark: '다크' };
  // [2026-05-28] 라이트 정비 중 — 다크모드 비활성. 정비 끝나면 false로 복원.
  const DARK_MODE_DISABLED = true;
  // Phase6: Phosphor 전환 — sprite href → ph-* class. themeToggleIcon은 <i>.
  const ICON_CLASS = { light: 'ph-sun', dark: 'ph-moon' };

  function _current() {
    if (DARK_MODE_DISABLED) return 'light';
    const saved = localStorage.getItem(STORAGE_KEY);
    if (MODES.includes(saved)) return saved;
    // [2026-05-20] 초기 사용자(localStorage 비어있음) 는 무조건 라이트로 시작.
    // 이전: prefers-color-scheme:dark 면 다크로 자동 진입 → 캐시 지운 사용자
    // (=초기 사용자) 가 로그인 화면을 다크모드로 마주침. 사용자 결정으로 라이트 고정.
    // 다크모드는 토글 한 번 누른 이후에만 활성.
    return 'light';
  }

  function _applyTheme(mode) {
    const html = document.documentElement;
    const body = document.body;
    if (mode === 'dark') {
      html.setAttribute('data-theme', 'dark');
      body?.setAttribute('data-theme', 'dark');
    } else {
      html.setAttribute('data-theme', 'light');
      body?.setAttribute('data-theme', 'light');
    }
    _updateButton(mode);
  }

  function _updateButton(mode) {
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
      const ic = document.getElementById('themeToggleIcon');
      if (ic) {
        // <i class="ph-duotone ph-sun"> → ph-moon 으로 토글
        ic.classList.remove('ph-sun', 'ph-moon');
        ic.classList.add(ICON_CLASS[mode]);
      }
      btn.setAttribute('aria-label', `화면 모드: ${LABELS[mode]} (탭하면 전환)`);
      btn.setAttribute('title', `${LABELS[mode]} 모드`);
    }
  }

  window.toggleTheme = function () {
    if (DARK_MODE_DISABLED) {
      if (typeof window.showToast === 'function') {
        window.showToast('다크모드는 정비 중이에요. 잠시만요 🔧');
      }
      return;
    }
    const cur = _current();
    const next = MODES[(MODES.indexOf(cur) + 1) % MODES.length];
    localStorage.setItem(STORAGE_KEY, next);
    _applyTheme(next);
    _syncLabels();
    if (typeof window.showToast === 'function') {
      window.showToast(`${LABELS[next]} 모드`);
    }
  };

  // Phase 7 T-334 — 설정 메뉴 버튼과 연결
  window.cycleTheme = window.toggleTheme;

  // T-334 — 큰 글씨 모드
  const FS_MODES = ['normal', 'large', 'xl'];
  const FS_LABELS = { normal: '보통', large: '크게', xl: '아주 크게' };
  const FS_KEY = 'itdasy_fontsize';
  function _curFS() { return localStorage.getItem(FS_KEY) || 'normal'; }
  function _applyFS(mode) {
    const html = document.documentElement;
    if (mode === 'normal') html.removeAttribute('data-fontsize');
    else html.setAttribute('data-fontsize', mode);
  }
  window.cycleFontSize = function () {
    const cur = _curFS();
    const next = FS_MODES[(FS_MODES.indexOf(cur) + 1) % FS_MODES.length];
    try { localStorage.setItem(FS_KEY, next); } catch(_){ /* ignore */ }
    _applyFS(next);
    _syncLabels();
    if (typeof window.showToast === 'function') window.showToast(`🔠 글씨 ${FS_LABELS[next]}`);
  };
  _applyFS(_curFS());

  function _syncLabels() {
    const tl = document.getElementById('themeLabel');
    if (tl) tl.textContent = LABELS[_current()];
    const fl = document.getElementById('fontSizeLabel');
    if (fl) fl.textContent = FS_LABELS[_curFS()];
  }

  // 최초 로드 시 저장된 테마 적용
  _applyTheme(_current());

  // DOM ready 때 버튼 아이콘 반영 (초기에 body 없을 수 있음)
  document.addEventListener('DOMContentLoaded', () => { _applyTheme(_current()); _syncLabels(); });
})();
