# 출시 남은 작업 체크리스트 (2026-07-27 감사 후속)

전면 감사(6도메인)에서 프론트로 고칠 수 있는 건 전부 라이브 반영됨. 아래는 **코드로 못 끝내는**
것 + **프론트로 이어서 할** 것. 완료되면 체크.

---

## 🔴 A. IAP 인앱결제 — 콘솔/시크릿 (Claude 불가, 사장님/원영)
상세: `IAP_SETUP.md`. 프론트 연동·플러그인·lockfile 은 완료(라이브).

- [ ] App Store Connect: 자동갱신구독 `itdasy_membership_monthly_6900` (₩6,900/월, 7일 무료체험) 등록·심사제출
- [ ] Play Console: 동일 상품ID 구독 등록·활성화
- [ ] Cloud Run(itdasy-backend-staging, asia-northeast3, itdasy-495513) env:
      `APPLE_IAP_SHARED_SECRET`, `APPLE_APP_BUNDLE_ID`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`(base64), `GOOGLE_PLAY_PACKAGE_NAME`
- [ ] (운영 배포 시 운영 Cloud Run 에도 동일 env)
- [ ] `npx cap sync` 를 실빌드 환경(Xcode/Android Studio/GitHub Actions)에서 — 로컬 맥은 @capacitor/android template 누락으로 update 실패(무해)
- [ ] 실기기 샌드박스 결제 1회 → `_appleReceipt`/`_googleToken` 추출 확인(`IAP_SETUP.md §5`). 안 맞으면 그 2함수만 수정
- [ ] Apple S2S / Google RTDN 알림 핸들러 Phase 2(갱신·취소·환불 반영) — 백엔드 `iap.py` TODO

## 🟠 B. 백엔드 동반 필요
- [ ] **H-2 OAuth state/nonce 완전화**: 프론트는 oauth-return 시 `/auth/me` 검증을 추가함(부분 완화, 라이브). 완전 방어는 백엔드가 OAuth 시작 시 `state` 발급→딥링크로 회신→프론트 대조 필요.
- [ ] **M-14 결제 멱등키**: 프론트가 요청별 idempotency 키 부여(라이브). 백엔드가 그 키로 중복 결제/충전 dedup 해야 완성.

## 🟡 C. 네이티브 플러그인/설정 (원영 판단)
- [ ] **H-4 미사용 권한 삭제**: iOS `NSContactsUsageDescription`/`NSFaceIDUsageDescription`/`NSMicrophoneUsageDescription` — 실제 구현 예정 없으면 Info.plist 에서 키 제거(Apple 5.1.1). 문구 한국어화는 완료.
- [ ] **M-19 Secure Storage**: access 토큰을 localStorage 대신 Keychain/Keystore 로 — Capacitor Secure Storage 플러그인 필요
- [ ] **L-10 Sign in with Apple**: `@capacitor-community/apple-sign-in` 설치 후 iOS 소셜로그인 노출(현재 4.8 회피 위해 숨김)

## ✅ D. 프론트로 이어서 진행 (이 세션)
- [x] IAP 프론트 연동(app-iap.js) + 구매복원 + 셋업문서
- [x] **H-2 프론트 완화**(oauth-return): 딥링크 토큰을 저장 전 `/auth/me` 로 검증 + 토큰 sub↔서버 user id 일치 확인(세션 고정 완화). 라이브.
- [ ] **L-1 마무리 killer-widgets 이모지** — 보류(카드 단위 일괄이라야 함. 💝🎯 심볼은 스프라이트에 없어 추가 필요). 조각 변환하면 한 카드 안에 아이콘/이모지 혼재로 더 지저분. 별도 디자인 배치.
- [ ] **M-17 포그라운드 herd** — 보류(visibilitychange 7개 모듈 생명주기 리팩터. 각 refresh 는 의도된 동작이라 무테스트 블라인드 수정 = 회귀 위험). 실기기 리줌 테스트와 함께 진행 권장.
- [ ] **M-14 결제 멱등키** — 보류(백엔드 dedup 없으면 프론트 키만으론 무효. IAP 경로는 스토어가 이미 멱등. 웹 PG 만 해당 → 백엔드 §B 와 함께).

_기준 문서: 감사 6도메인 결과. 진행상황은 memory `project_itdasy_launch_audit_6domain`._
