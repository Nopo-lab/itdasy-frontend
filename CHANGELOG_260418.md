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
