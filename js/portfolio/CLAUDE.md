# js/portfolio — 포트폴리오 관리

- 부모 `../../CLAUDE.md` + `../../AGENTS.md` 상속
- 역할: 포트폴리오 CRUD·이미지 업로드·순서 재배열·공개/비공개. `app-portfolio.js`(1023줄) 분할본
- 공개 API: `index.js` 만 외부. 전역 `window.ItdasyPortfolio` 단일
- 분할 가이드: `index.js`·`crud.js`(Supabase, 400줄 상한)·`uploader.js`(Camera)·`reorder.js`·`render.js`·`__tests__/`
- 의존성: 상위 `app-core.js`·`app-haptic.js`. `app-caption.js`·`app-gallery.js` 직접 호출 금지 (커스텀 이벤트)
- 변경 체크: 이미지 5MB 상한 · RLS 위반 시 한국어 에러 · soft delete(`deleted_at`) 고수 · 버킷 환경 구분 (`ENV` 상수)
- 상태: 🔴 분할 전. monolith 수정 금지, 새 기능만 `js/portfolio/*.js` 로
