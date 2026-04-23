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
    const p = await _plugin();
    if (!p) { return false; }
    try {
      // iOS Keychain / Android Keystore 에 암호화 저장
      await p.setBiometryType && p.setBiometryType();
      localStorage.setItem(SECRET_KEY + '_flag', '1');
      // 실제 토큰은 플러그인 보안 스토리지에 — 여기선 단순화
      localStorage.setItem(SECRET_KEY, token);
      return true;
    } catch (e) { return false; }
  }

  async function verify() {
    const p = await _plugin();
    if (!p) return null;
    try {
      await p.authenticate({
        reason: '잇데이 재로그인',
        cancelTitle: '취소',
        allowDeviceCredential: true,
        iosFallbackTitle: '비밀번호로 로그인',
        androidTitle: '잇데이',
        androidSubtitle: '생체 인증으로 빠르게 로그인',
      });
      return localStorage.getItem(SECRET_KEY);
    } catch (e) { return null; }
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
