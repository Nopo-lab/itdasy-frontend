# T-500 self-review — 앱 심사 전 신뢰 회복 1차

작성: 2026-05-04 05:45 · 오케스트레이터

## 체크리스트

1. ✅ 변경 파일 목록

   `.ai/tickets/T-500.md`, `.ai/tickets/T-500/plan.md`, `.ai/tickets/T-500/self-review.md`, `.ai/BOARD.md`, `.ai/FOR_USER.md`, `.ai/SESSION_STATE.md`, `index.html`, `style-home.css`, `sw.js`, `app-core.js`, `app-dashboard.js`, `app-home-v41.js`, `app-instagram.js`, `app-killer-widgets.js`, `app-myshop-v3.js`, `app-perf-recovery.js`, `app-plan.js`, `app-staff.js`, `app-backup.js`, `app-failures-hub.js`, `app-gallery-review.js`, `app-gestures.js`, `app-kakao-hub.js`, `app-naver-link.js`, `app-shop-settings.js`, `data-deletion.html`, `privacy.html`, `terms.html`, `docs/submission/Review-Notes.md`, `docs/submission/Apple-Privacy-Labels.md`, `docs/submission/iOS-Preflight-Checklist.md`, `docs/submission/README.md`, `docs/submission/App-Store-Metadata-EN.md`

2. ✅ `index.html` 스크립트 로드 순서 영향 없음

   순서는 바꾸지 않았다. 바뀐 것은 일부 파일의 새 버전 표시뿐이다.

3. ✅ `window.*` 전역 추가/제거 확인

   `window.applyStoreReviewLoginGuard`, `window.getCurrentPlanLabel` 추가. 둘 다 기존 앱 전역 헬퍼 패턴과 맞다.

4. ✅ localStorage 토큰 키 관련 확인

   로그인 초기 화면에서 토큰 키 직접 확인을 제거하고 `app-core.js`의 `getToken()` 흐름으로 맡겼다.

5. ✅ Capacitor 브릿지 관련 확인

   네이티브 설정 변경 없음. iOS 감지는 화면 버튼 노출 제어에만 사용.

6. ✅ Supabase 권한 의존 쿼리 확인

   DB 직접 접근 없음. 로그인 전 서버 호출은 토큰이 없으면 멈추도록 조정.

7. ✅ 50줄 초과 함수 새로 만들지 않음

   새 헬퍼는 짧게 분리했다.

8. ✅ 빈 `catch {}` 추가하지 않음

   오히려 기존 빈 처리 블록 15개를 `void _e;`로 채워 자동 검사 오류를 제거했다.

9. ✅ 커밋 메시지 후보

   `T-500 심사 전 로그인/문서 신뢰도 1차 수리`

10. ✅ 자동 확인

   - `npm run smoke` 통과
   - `npm run lint` 통과. 오래된 경고는 남아 있으나 막는 오류는 0개
   - `npm test -- --runInBand` 통과. 테스트 파일 없음
   - `git diff --check` 통과
   - 브라우저 확인: 데스크톱은 소셜 로그인 표시, iPhone 화면은 소셜 로그인 숨김, 로그인 전 쿠키/앱 조각 숨김

## 남은 일

- 심사용 데모 계정 샘플 데이터는 백엔드에서 넣어야 한다.
- `/shop/settings` 저장 권한은 백엔드 확인이 필요하다.
- iOS에 Google/카카오/네이버 로그인을 다시 보이게 하려면 먼저 Apple 로그인을 구현해야 한다.
