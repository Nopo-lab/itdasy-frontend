# itdasy-frontend-test-yeunjun (연준 스테이징)

**언어**: 한국말, 쉬운말. 원영님은 코딩 초보.

- 역할: 연준 전용 프론트 검증 레포. 배포 `https://nopo-lab.github.io/itdasy-frontend-test-yeunjun/`
- 백엔드: `itdasy_backend-test` (Railway staging). 토큰 키: `itdasy_token::staging`
- 상속: 루트 `../CLAUDE.md` + `../AGENTS.md §3, §4`
- 워크플로우: 1) 여기서 먼저 → 2) 검증 후 `itdasy-frontend`(운영) 승격
- 트랙: 4줄 이상 / API / Capacitor = 표준(티켓→플랜→승인→코드→T4→T1→머지), 문서·1~3줄 = 경량
- 코드 룰: 함수 50줄·파일 500줄 (ESLint 강제). 초과 시 분할 티켓 + 원영님 승인
- 분할 대상: `app-caption.js` / `app-portfolio.js` / `app-gallery.js` — Phase 2 (T-101/102/103)
- 로컬: `python3 -m http.server 8080` · `npx cap sync android` · Android 빌드는 GitHub Actions 권장
- Capacitor: scheme `itdasy://`, plugins = SplashScreen/StatusBar/Push/Camera/App
- Actions: `Android Build`(수동) · `Supabase Daily Backup`(UTC 18:00)

진행 상황: `.ai/ROADMAP.md` · 세션: `.ai/SESSION_STATE.md`
