# 변경사항 기록 — 2026-04-18 (연준)

## 인프라 구축
- 프론트/백엔드 레포 분리: `itdasy-frontend` (public) + `itdasy_backend` (private)
- Railway 24시간 백엔드 서버 (US East)
- Supabase Postgres 클라우드 DB 전환
- GitHub Pages 프론트 자동 배포
- GitHub push → Railway/Pages 자동 재배포 파이프라인
- 테스트 레포: `itdasy-frontend-test`, `itdasy-frontend-test-yeunjun`
- 공동작업 가이드 README 작성 (3개 레포 동일)

## 보안 강화 (Phase 1)
- `SECRET_KEY` 폴백값 제거 → 미설정 시 서버 시작 거부
- `/platform/*` 프록시 전체 인증 추가 (토큰 없으면 401)
- CORS ngrok 와일드카드 제거 (프로덕션 보호)
- 로그인 Rate Limiting 추가 (5분 내 10회 → 429 차단)
- 로그인 실패 로깅 (IP + 이메일 기록)
- httpx 로그 레벨 조정 → access_token URL 노출 차단 (TD-003)
- DB 세션 rollback 추가 (TD-007)
- 비밀번호 정책: 8자 이상 + 영문 + 숫자 필수
- `POST /auth/change-password` 비밀번호 변경 엔드포인트 추가
- `DELETE /auth/delete-account` 회원탈퇴 엔드포인트 추가 (PIPA 의무)
- Instagram 토큰 자동갱신 크론 (12시간마다, 만료 7일전 갱신)

## 출시 인프라 (Phase 2)
- 환경변수 검증 모듈 (`utils/env_validator.py`) — 필수 키 누락 시 서버 거부
- `_migrate_if_schema_drift` → 경고만 출력 (기존 데이터 보존)
- Sentry 에러 모니터링 연동 (SENTRY_DSN 환경변수)
- sentry-sdk, slowapi 패키지 추가

## 결제/구독 모듈 (Phase 3)
- `Subscription`, `PaymentHistory` DB 모델 추가
- 구독 라우터 6개 API:
  - `GET /subscription/status` — 내 구독 상태
  - `GET /subscription/usage` — 사용량 (캡션/누끼/발행/분석)
  - `GET /subscription/plans` — 플랜 목록
  - `POST /subscription/start-trial` — 14일 무료체험
  - `POST /subscription/cancel` — 구독 취소
  - `GET /subscription/payments` — 결제 이력
- 사용량 한도 체커 유틸리티 (`utils/quota_checker.py`)
- 플랜: Free (0원) / Pro (19,900원) / Premium (39,900원)

## 좀비 코드 정리
### 프론트엔드 (-1,853줄)
- `app-portfolio.js` 파일 삭제 (1,023줄)
- `index.html`: tab-portfolio, persona nav 버튼, publishPreviewPopup 삭제 (323줄)
- `app-caption.js`: doActualPublish, publishToInstagram, closePublishPreview 삭제 (162줄)
- `app-ai.js`: doInstagramPublish 삭제 (32줄)
- `app-gallery-write.js`: publishFromCaption, doPublishFromCaption 삭제 (179줄)
- `app-persona.js`: _renderIdentityBlock (Q1~Q9 설문) 삭제 (133줄)
- `sw.js`: 캐시에서 app-portfolio.js 제거

### 백엔드 (-3 라우터, -5 엔드포인트)
- `routers/portfolio.py` 삭제 (포트폴리오 완전 폐기)
- `routers/schedule.py` 삭제 (예약발행 폐기)
- `routers/marketing.py` 삭제 (노쇼마케팅 폐기)
- `routers/instagram.py`: /publish, /publish-story 엔드포인트 삭제 (Catbox 의존 제거)
- `main.py`: portfolio, schedule, marketing import/include 제거

## 기타
- 누끼: withoutbg (HuggingFace) → Remove.bg API 전환 (메모리 초과 해결)
- 프론트 누끼 순서: 서버 API 우선 → 클라이언트(imgly) 폴백
- Gemini API 키 형식 변경 대응 (AQ.Ab8... 신규 형식)
- Instagram OAuth 콜백 URL → nopo-lab.github.io/itdasy-frontend 수정
- 원영이 최신 코드 반영 (gallery 5파일 분할, 서명중복제거, 팝업확대, 직접작성옵션)
- 앱 아이콘 1024x1024 생성
- Meta 데이터 삭제 콜백 + 안내 페이지 추가
- CBT 계정 cbt1~4 재생성 (Supabase)
- datetime timezone-aware 비교 수정 (Supabase 호환)

## 현재 엔드포인트: 68개
## 현재 월 비용: $0~5

# 변경사항 추가 기록 — 2026-04-18 심야 (연준)

## 추가 완료 항목

### 보안
- Instagram 토큰 Fernet 암호화 저장/복호화 읽기 (`utils/token_crypto.py`)
- FERNET_KEY Railway 환경변수 등록

### 성능
- Gemini `generate_json_async` 비동기 함수 추가 (동시성 개선)
- Replicate RMBG-2.0 누끼 1순위 연동 (장당 14원, Remove.bg 폴백)
- 프론트 JS 번들링: 12파일 → `app.bundle.min.js` 1파일 (245KB→186KB, 25% 절감)
- SW 캐시 버전 배포마다 자동 갱신 (BUILD_HASH)

### 안정화
- TD-005: `.all()` 무제한 조회 → `.limit()` 추가 (background, leads, persona)
- TD-006: Instagram API 네트워크 예외 처리 (ConnectError, TimeoutException)
- GitHub Actions CI: 문법 체크 실패 시 배포 차단 (프론트+백엔드 모두)

### 사용자 기능
- 비밀번호 재설정: `POST /auth/forgot-password` + `POST /auth/reset-password`
- 비밀번호 재설정 프론트 페이지 (`reset-password.html`)
- 로그인 화면 "비밀번호를 잊으셨나요?" 링크
- 구독 플랜 팝업 UI (Free/Pro/Premium 카드 + 사용량 표시 + 무료체험)
- Free 배지 헤더에 항상 표시 (클릭 시 플랜 팝업)

### 버그 수정
- `_loadImageSrc` 함수 누락 → 추가 (배경 합성 에러 해결)
- SW 경로 `itdasy-studio` → `itdasy-frontend` 수정
- 플랜 팝업 외부 클릭 시 닫기

### 인프라
- Resend API 키 Railway 등록 (이메일 발송 준비)
- Replicate API 토큰 Railway 등록
- Sentry DSN Railway 등록
- DB 백업 복구 리허설 완료 (30테이블 백업, 7테이블 복원 검증)

### 좀비 코드 정리 (프론트+백엔드)
- 프론트: app-portfolio.js, tab-portfolio, publishPreviewPopup, doActualPublish 등 1,853줄 삭제
- 백엔드: portfolio.py, schedule.py, marketing.py 라우터 삭제, instagram /publish 삭제

---

## 다음 해야 할 것 (TODO)

### 필수 (출시 전)
- [ ] 토스페이먼츠 실결제 연동 (사업자 등록 완료됨)
- [ ] Alembic DB 마이그레이션 도입
- [ ] Resend 도메인 인증 (커스텀 이메일 발송)
- [ ] 프론트 구독 UI 실제 결제 연결
- [ ] 브라우저 통합 테스트 (캡션생성, 누끼, 인스타연동 직접 확인)

### 권장 (출시 후)
- [ ] Sentry 프론트엔드 JS SDK 추가
- [ ] 관리자 대시보드
- [ ] 푸시 알림 (FCM)
- [ ] 앱스토어 등록 (Capacitor/TWA)
- [ ] Gemini Context Caching (비용 절감)
- [ ] 광고법 자동 차단 (taboo filter)
