# itdasy-frontend-test-yeunjun (연준 스테이징)

## 📇 앱 기능 인덱스 (먼저 볼 것)

**"이 기능 없나?" 추측 전에 `.ai/APP_FEATURE_INDEX.md` 확인.** 이 앱은 방대함(프론트 ~250파일 + 백엔드 라우터 60·서비스 70·모델 56). DM 자동응답·네이버톡톡·카카오 알림톡·리텐션·리뷰요청·인사이트·OCR 등 **대부분 이미 구현돼 있음**. 상단 도메인맵 + 채널/DM 실제 상태표 참고. **기능 파일(`js/**`·`app-*.js`·백엔드 routers/services/models) 바꾸면 인덱스 해당 항목도 갱신**(SessionStart 훅이 요약 주입, PostToolUse 훅이 갱신 리마인드 — `.claude/settings.json`).

## ✅ 캐시 버전(`?v=`) — **배포가 자동으로 올린다** (2026-07-23~)

**이제 손으로 안 올려도 된다.** `deploy.yml` 의 `Auto-bump all ?v= cache busters` 단계가
매 배포마다 `index.html`·`js/load-groups.js` 의 **모든 `?v=` 를 빌드 버전으로 통일**한다
(`scripts/bump_cache_busters.py`, 실측 258건). `load-groups.js` 자신의 버전도 포함되며,
그게 안 바뀌면 배포를 **실패시킨다** — 그거 하나 빠지면 나머지가 전부 무효이기 때문.

- 🔴 **딱 하나 남은 수동 작업**: `?v=` 가 **아직 안 붙은 새 파일**을 추가할 때는
  한 번은 손으로 `?v=` 를 붙여야 한다. 스크립트는 '이미 붙어 있는 것'만 갱신한다
  (사람이 의도적으로 뺀 항목까지 건드리지 않으려고 일부러 그렇게 했다).
- 외부 CDN(`https://…`)은 건드리지 않는다.
- 왜 자동화했나: 손으로 하면 반드시 빠뜨린다. 특히 `index.html` 의 `js/load-groups.js?v=` 를
  빼먹으면 **안의 버전을 아무리 올려도 무효**다 — 브라우저가 옛 load-groups 를 쓰고 그 안의
  옛 `?v=` 로 파일을 부른다. 2026-07-23 실측으로 잡았다: 파일엔 수정이 있는데 로드된 script 가
  `caption-text.js?v=20260714-fix-batch1`(9일 전)이었다.

<details><summary>참고 — 옛 수동 규칙(이제 안 해도 됨)</summary>


- 실제로 여러 번 당했다(2026-07-22 라운드 포함): 고친 기능이 라이브 파일엔 들어가 있는데 화면엔 안 나와서
  "코드가 틀렸나" 를 한참 뒤졌고, SW 캐시를 지우고서야 나왔다. **로컬 검증도 똑같이 속는다.**
- "고쳤는데 화면이 그대로" 면 → 코드보다 **캐시부터** 의심.
- `sw.js` 의 `CACHE_VERSION` 은 deploy.yml 이 자동 주입한다. **`?v=` 는 자동이 아니다 — 사람이 올려야 한다.**
- 🚨 **`js/load-groups.js` 자신의 `?v=` 도 같이 올려라** (index.html:2311).
  이걸 빼면 **안의 버전을 아무리 올려도 소용없다** — 브라우저가 옛 load-groups.js 를 그대로 쓰고,
  그 안에 적힌 옛 `?v=` 로 파일을 불러온다. 2026-07-23 실측으로 잡았다:
  파일엔 수정이 있고 load-groups 도 갱신했는데 화면은 그대로 → 로드된 script 태그가
  `caption-text.js?v=20260714-fix-batch1`(옛 버전)이었다. **버전 올리기가 통째로 무력화되는 지점.**
- 빠뜨리기 쉬운 것: `?v=` 가 아직 **안 붙은 항목**(`'app-backup.js',` 처럼) — 새로 붙여야 영영 캐시되지 않는다.
  그리고 CSS(`index.html` 의 `<link>`), `js/workspace/**` 같은 긴 경로.

```python
# 일괄 갱신 — FILES 만 바꿔 재사용
import io, re
V = '20260722-vXXX-이름'
FILES = ['app-foo.js', 'js/workspace/bar.js', 'css/screens/baz.css']
for t in ('js/load-groups.js', 'index.html'):
    s = io.open(t, encoding='utf-8').read()
    for f in FILES:
        s = re.sub(re.escape(f) + r'\?v=[^\'"?&]*', f + '?v=' + V, s)
    io.open(t, 'w', encoding='utf-8').write(s)
# 🚨 load-groups.js 자신의 버전도 반드시 — 안 올리면 위 갱신이 전부 무효
s = io.open('index.html', encoding='utf-8').read()
io.open('index.html', 'w', encoding='utf-8').write(
    re.sub(r'js/load-groups\.js\?v=[^\'"?&]*', 'js/load-groups.js?v=' + V, s))
```
</details>

## 🚨 디자인 정책 (2026-05-28 ~ )

**다크모드 정비 보류 중** — 모든 디자인·CSS 작업은 **라이트모드 기준**으로만 진행.
`html[data-theme="dark"]` 블록(tokens.css)은 토큰 정리 끝난 뒤 일괄 재점검 예정.

- 새 컴포넌트 작성 시 다크모드 토큰 매핑 안 해도 OK
- 기존 다크모드 블록은 건드리지 말 것 (복원용)
- 다크모드 활성화 키: `app-theme.js DARK_MODE_DISABLED = false`

## 🚨 PC 레이아웃 — 풀스크린 오버레이/하위화면은 사이드바에 안 잘리게 (필수)

PC(`@media (width >= 768px)`)엔 고정 사이드바 `#sideNav`(`.side-nav.ms-side`, **폭 `var(--side-nav-width)` = 232px, ≥1200px 260px, z-index 10000**)가 있다. `position:fixed; inset:0` 오버레이는 그냥 두면 **사이드바가 왼쪽을 가려 콘텐츠가 잘린다**(반복 사고 — 9번+ 지적됨).

> **🔑 오프셋은 항상 `var(--side-nav-width)` 로 (하드코딩 232/260 금지).** SSOT = `style-components.css` `:root{--side-nav-width}`. 폭은 반응형(≥768px 232 · ≥1200px 260)이라 하드코딩하면 한쪽 breakpoint 에서 반드시 어긋난다. (v716, 2026-07-09)

- 설정 하위화면은 **`.subscreen-overlay` 클래스 재사용** → `style-responsive.css`에서 PC 오프셋(`left:var(--side-nav-width); top:var(--app-header-h)`)이 일괄 적용됨. ⚠️ 이 클래스는 `transform: translateX()` 슬라이드라 PC에서 `transform/inset`을 통째로 덮지 말 것(닫기 깨짐).
- 허브류 풀스크린은 `style-responsive.css`의 hub-overlay 셀렉터 목록(`inset: var(--app-header-h) 0 0 var(--side-nav-width)`)에 **새 ID/클래스를 반드시 등록**.
- 새 풀스크린 오버레이를 만들면 **무조건 `style-responsive.css`의 `@media (width >= 768px)` 블록에 등록**하고, PC 폭에서 왼쪽 잘림 없는지 확인. 모바일만 보고 만들지 말 것.

**언어**: 한국말, 쉬운말. 원영님은 코딩 초보.

- 역할: 연준 전용 프론트 검증 레포. 배포 `https://nopo-lab.github.io/itdasy-frontend-test-yeunjun/`
- 백엔드: `itdasy_backend-test` (Cloud Run staging). `PROD_API` = `https://itdasy-backend-staging-644329093453.asia-northeast3.run.app` (app-core.js:57). 토큰 키: `itdasy_token::staging`
- 상속: 루트 `../CLAUDE.md` + `../AGENTS.md §3, §4`
- 워크플로우: 1) 여기서 먼저 → 2) 검증 후 `itdasy-frontend`(운영) 승격
- 트랙: 4줄 이상 / API / Capacitor = 표준(티켓→플랜→승인→코드→T4→T1→머지), 문서·1~3줄 = 경량
- 코드 룰: **줄수 제한 없음**(2026-07-14 폐기, 루트 CLAUDE.md 참조). 분할은 재사용·독립테스트·동시작업 같은 실제 이유가 있을 때만. 큰 파일은 먼저 지울 게 없는지 본다
- 서버 호출: 직접 주소를 붙이지 말고 `window.apiUrl()` / `window.apiFetch()` 사용
- 분할 대상: `app-caption.js` / `app-portfolio.js` / `app-gallery.js` — Phase 2 (T-101/102/103)
- 로컬: `python3 -m http.server 8080` · `npx cap sync android` · Android 빌드는 GitHub Actions 권장
- Capacitor: scheme `itdasy://`, plugins = SplashScreen/StatusBar/Push/Camera/App
- Actions: `Android Build`(수동) · `Supabase Daily Backup`(UTC 18:00)

진행 상황: `.ai/ROADMAP.md` · 세션: `.ai/SESSION_STATE.md`
