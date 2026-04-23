# js/core — 공통 인프라 (엄격)

- 부모 `../../CLAUDE.md` + `../../AGENTS.md` 상속. 코어라서 더 엄격
- 현재: `app-core.js` 831줄. 분할 보류, 엄격 규칙 우선
- 규칙: 신규 export → JSDoc 필수 · 새 `window.*` 추가 시 오케스트레이터 리뷰 · fetch wrapper는 `app-core.js`에서만 · localStorage 키는 상단 상수
- 토큰 키: `itdasy_token::staging` / `::prod` / `::local` (API 문자열로 자동 판별). 레거시 `itdasy_token` 직접 참조 금지 — `window.getToken()`/`setToken()` 경유
- 분할 로드맵 (900줄 도달 시): `index.js`·`auth.js`·`http.js`·`events.js`·`env.js`·`__tests__/`
- 변경 체크: auth 수정 시 토큰 격리 유지 · fetch 수정 시 `sw.js` 오프라인 테스트 · 에러는 한국어·상수화 · OAuth 스킴 `itdasy://` 는 🔴 원영님 승인 필수
