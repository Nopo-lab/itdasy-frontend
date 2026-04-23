# js/caption — 캡션 생성·편집 모듈

- 부모 `../../CLAUDE.md` + `../../AGENTS.md` 규칙 상속
- 역할: 인스타/카페24 캡션 생성·AI 보정·샘플. `app-caption.js`(1167줄) 분할본
- 공개 API: `index.js` 만 외부 import 허용. 전역은 `window.ItdasyCaption` 하나
- 분할 가이드: `index.js`(진입) · `generator.js`(AI, 400줄 상한) · `templates.js` · `editor.js` · `__tests__/`
- 의존성: 상위 `app-core.js`·`app-ai.js`. `app-gallery.js` 직접 참조 금지 (이벤트)
- 변경 체크: 해시태그 중복은 `templates.js`만 · 토큰은 `window.getToken()` 경유 · 500줄 초과 즉시 추출 · innerHTML+onclick 인라인 금지(XSS)
- 상태: 🔴 분할 전. monolith 수정 금지, 새 기능만 `js/caption/*.js` 로
