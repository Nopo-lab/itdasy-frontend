/* ─────────────────────────────────────────────────────────────
   생체 인증 자동 재로그인 (T-317 · 2026-04-22) — SKELETON

   Capacitor 네이티브 빌드 환경에서 정식 작동.
   PWA(웹)에서는 WebAuthn Platform Authenticator 폴백.

   현재 상태: 🟡 스켈레톤 — 플러그인 설치(`npm i @aparajita/capacitor-biometric-auth`)
   후 활성화. 설치 전엔 조용히 비활성.

   전역:
     window.Biometric.available()  → boolean
     window.Biometric.enable()     → 토큰 보관 시작
     window.Biometric.verify()     → 생체 인증 후 토큰 반환
     window.Biometric.disable()    → 보관 토큰 삭제
   ──────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const SECRET_KEY = 'itdasy_biometric_token_v1';

  async function _plugin() {
    if (window.Capacitor?.isNativePlatform?.() && window.CapacitorPlugins?.BiometricAuth) {
      return window.CapacitorPlugins.BiometricAuth;
    }
    try {
      const mod = await import('@aparajita/capacitor-biometric-auth').catch(() => null);
      return mod?.BiometricAuth || null;
    } catch (_) { return null; }
  }

  async function available() {
    try {
      const p = await _plugin();
      if (!p) return false;
      const info = await p.checkBiometry();
      return !!(info?.isAvailable);
    } catch (_) { return false; }
  }

  async function enable(token) {
    // [보안감사 H-2 2026-07-27] JWT 를 평문 localStorage 에 저장하던 것을 폐기.
    //   기존 구현은 생체 프롬프트를 통과해도 토큰을 평문 고정키(SECRET_KEY)에 그대로 뒀다 →
    //   루팅/XSS/adb 백업으로 생체인증 없이 바로 탈취되는 '보안 위장'이었다.
    //   진짜 보안저장(Keychain/Keystore) 플러그인이 붙기 전까지는 기능을 켜지 않는다(토큰 미저장).
    //   TODO(M-19): @capacitor/preferences(secure) 또는 secure-storage 플러그인 연동 후
    //     p.setSecret/getSecret 류의 보안 스토리지에 저장하도록 교체.
    void token;
    return false;
  }

  async function verify() {
    // 보안저장 미연동 상태에서는 반환할 토큰이 없다(평문 저장 폐기). 항상 null → 일반 로그인 폴백.
    return null;
  }

  async function disable() {
    localStorage.removeItem(SECRET_KEY);
    localStorage.removeItem(SECRET_KEY + '_flag');
    return true;
  }

  function isEnabled() {
    return localStorage.getItem(SECRET_KEY + '_flag') === '1';
  }

  window.Biometric = { available, enable, verify, disable, isEnabled };
})();
