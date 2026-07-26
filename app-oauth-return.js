/* ─────────────────────────────────────────────────────────────
   OAuth 완료 후 앱으로 복귀했을 때 처리

   Capacitor 네이티브 앱에서:
   - 브라우저에서 인스타 OAuth 마침
   - 백엔드가 itdasy://oauth/callback?connected=success 로 리다이렉트
   - Android intent-filter(itdasy scheme)가 앱 실행
   - Capacitor App 플러그인의 appUrlOpen 리스너가 URL 수신
   - connected=success 파라미터 확인 후 인스타 상태 재조회 + 토스트

   웹 브라우저에서는 no-op.
   ──────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  if (!isNative) return;

  const AppPlugin = window.Capacitor?.Plugins?.App;
  if (!AppPlugin) {
    console.warn('[oauth-return] Capacitor App 플러그인 없음');
    return;
  }

  // Google/Kakao OAuth 딥링크 처리
  // 백엔드가 itdasy://oauth-return?token=JWT&provider=google|kakao 로 리다이렉트
  function _handleSocialLogin(u, fullUrl) {
    const isOAuthReturn =
      u.host === 'oauth-return' ||
      u.pathname === '/oauth-return' ||
      u.pathname === 'oauth-return' ||
      /oauth-return/.test(fullUrl);
    if (!isOAuthReturn) return false;

    // query string 또는 hash fragment 둘 다 지원
    let params;
    try {
      params = new URLSearchParams(u.search || '');
    } catch (_e) {
      void _e;
      params = new URLSearchParams('');
    }
    if ((!params.get('token') && !params.get('error')) && u.hash) {
      try {
        params = new URLSearchParams(u.hash.replace(/^#/, ''));
      } catch (_e2) { void _e2; }
    }

    const token = params.get('token');
    const provider = params.get('provider') || 'oauth';
    const err = params.get('error');

    if (err) {
      if (window.showToast) window.showToast('로그인 실패: ' + decodeURIComponent(err));
      return true;
    }
    if (!token) return true;

    // [보안감사 H-2 2026-07-27] 딥링크(itdasy://oauth-return?token=)로 받은 토큰을 무검증 저장하면
    //   세션 고정 공격이 된다: 공격자가 자기 JWT 를 담은 링크를 피해자가 열게 하면, 피해자 앱이
    //   공격자 계정으로 로그인돼 이후 피해자의 사진·고객·매출이 공격자 계정에 쌓인다.
    //   → 저장·세션적용 전에 백엔드 /auth/me 로 (1) 토큰이 우리 백엔드가 발급한 유효 토큰인지 +
    //     (2) 서버가 돌려준 user id 가 토큰의 sub 와 일치하는지 확인한다.
    //     (2) 는 전역 fetch 래퍼의 401 자동 리프레시가 '기존 세션'으로 바꿔치기하는 경우도 막는다.
    //   완전 방어(OAuth 시작 시 state/nonce 발급→회신 대조)는 백엔드 동반 필요 — LAUNCH_REMAINING.md B.
    const api = (window.API || '');
    let claimedSub = '';
    try { claimedSub = String(JSON.parse(atob(token.split('.')[1])).sub || ''); } catch (_e) { void _e; }

    fetch(api + '/auth/me', { headers: { 'Authorization': 'Bearer ' + token } })
      .then(function (res) { return res.ok ? res.json() : Promise.reject(new Error('invalid_token')); })
      .then(function (me) {
        const meId = String((me && (me.id != null ? me.id : me.user_id)) || '');
        if (!claimedSub || !meId || meId !== claimedSub) throw new Error('token_user_mismatch');
        // 검증 통과 → 저장 · 세션 적용 · 리로드
        try {
          const keySuffix = api.includes('staging') ? 'staging' : (api.includes('localhost') ? 'local' : 'prod');
          localStorage.setItem('itdasy_token::' + keySuffix, token);
        } catch (_e) { void _e; }
        try { if (typeof window.applyNewSession === 'function') window.applyNewSession(token).catch(function () {}); } catch (_e) { void _e; }
        if (window.showToast) window.showToast(provider + ' 로그인 완료!');
        setTimeout(function () { window.location.reload(); }, 300);
      })
      .catch(function () {
        if (window.showToast) window.showToast('로그인 정보를 확인하지 못했어요. 다시 시도해 주세요.');
      });
    return true;
  }

  function _handleReturn(url) {
    if (!url) return;
    try {
      const u = new URL(url);
      if (u.protocol !== 'itdasy:') return;

      // Google/Kakao OAuth 복귀 먼저 시도
      if (_handleSocialLogin(u, url)) return;

      if (u.searchParams.get('connected') === 'success') {
        if (window.showToast) window.showToast('인스타 연동 완료!');

        // [QA #3] 인스타 상태 재조회 — 함수 존재 가드 + 다중 alias 시도.
        // 함수 없으면 location.reload 로 강제 새로고침 (cache vs live 불일치 방지).
        const refresh = window.checkInstagramStatus
          || window.checkInstaStatus
          || window.refreshInstagramUI
          || (window.IGState && window.IGState.refresh);
        if (typeof refresh === 'function') {
          try { Promise.resolve(refresh()).catch(() => {}); } catch (_e) { /* ignore */ }
        } else {
          try { setTimeout(() => location.reload(), 300); } catch (_e) { /* ignore */ }
        }

        // 홈 탭으로 유도 (선택)
        const homeTabBtn = document.querySelector('.tab-bar__btn[data-tab="home"]');
        if (homeTabBtn) homeTabBtn.click();

        // [2026-05-13 QA #blocker1] 연동 직후 자동 분석 — runAutoAnalysisAfterConnect 가
        // 즉시 진행 토스트 + analyzeOverlay + status 90초 폴링 + force fallback 처리.
        try {
          setTimeout(() => {
            try {
              if (typeof window.runAutoAnalysisAfterConnect === 'function') {
                window.runAutoAnalysisAfterConnect();
              } else if (typeof window.runPersonaAnalyze === 'function') {
                window.runPersonaAnalyze();
              }
            } catch (_e2) { /* ignore */ }
          }, 800);
        } catch (_e3) { /* ignore */ }
      } else if (u.searchParams.get('error')) {
        const err = u.searchParams.get('error');
        if (window.showToast) window.showToast('연동 실패: ' + err);
      }
    } catch (e) {
      console.warn('[oauth-return] URL 파싱 실패:', e);
    }
  }

  AppPlugin.addListener('appUrlOpen', (event) => {
    _handleReturn(event && event.url);
  });

  // 앱이 닫혀있다가 딥링크로 처음 열린 경우 (cold start)
  if (typeof AppPlugin.getLaunchUrl === 'function') {
    AppPlugin.getLaunchUrl().then((r) => {
      if (r && r.url) _handleReturn(r.url);
    }).catch(() => {});
  }
})();
