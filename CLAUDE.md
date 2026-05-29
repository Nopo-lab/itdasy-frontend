# itdasy-frontend-test-yeunjun (연준 스테이징)

## 🚨 디자인 정책 (2026-05-28 ~ )

**다크모드 정비 보류 중** — 모든 디자인·CSS 작업은 **라이트모드 기준**으로만 진행.
`html[data-theme="dark"]` 블록(tokens.css)은 토큰 정리 끝난 뒤 일괄 재점검 예정.

- 새 컴포넌트 작성 시 다크모드 토큰 매핑 안 해도 OK
- 기존 다크모드 블록은 건드리지 말 것 (복원용)
- 다크모드 활성화 키: `app-theme.js DARK_MODE_DISABLED = false`

**언어**: 한국말, 쉬운말. 원영님은 코딩 초보.

- 역할: 연준 전용 프론트 검증 레포. 배포 `https://nopo-lab.github.io/itdasy-frontend-test-yeunjun/`
- 백엔드: `itdasy_backend-test` (Cloud Run staging). `PROD_API` = `https://itdasy-backend-staging-644329093453.asia-northeast3.run.app` (app-core.js:57). 토큰 키: `itdasy_token::staging`
- 상속: 루트 `../CLAUDE.md` + `../AGENTS.md §3, §4`
- 워크플로우: 1) 여기서 먼저 → 2) 검증 후 `itdasy-frontend`(운영) 승격
- 트랙: 4줄 이상 / API / Capacitor = 표준(티켓→플랜→승인→코드→T4→T1→머지), 문서·1~3줄 = 경량
- 코드 룰: 함수 50줄·파일 500줄 (ESLint 강제). 초과 시 분할 티켓 + 원영님 승인
- 서버 호출: 직접 주소를 붙이지 말고 `window.apiUrl()` / `window.apiFetch()` 사용
- 분할 대상: `app-caption.js` / `app-portfolio.js` / `app-gallery.js` — Phase 2 (T-101/102/103)
- 로컬: `python3 -m http.server 8080` · `npx cap sync android` · Android 빌드는 GitHub Actions 권장
- Capacitor: scheme `itdasy://`, plugins = SplashScreen/StatusBar/Push/Camera/App
- Actions: `Android Build`(수동) · `Supabase Daily Backup`(UTC 18:00)

진행 상황: `.ai/ROADMAP.md` · 세션: `.ai/SESSION_STATE.md`
