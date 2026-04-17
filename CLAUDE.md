# itdasy Frontend

뷰티샵 AI 마케팅 도우미 — PWA 프론트엔드

## 구조
- Vanilla JS SPA (모듈 시스템 미사용, 글로벌 스코프)
- 단일 진입점: `index.html`

## 빌드 & 배포
- `build.sh` → 12개 JS 합쳐서 `app.bundle.min.js` 생성 (esbuild)
- push → GitHub Actions (문법체크 → 번들링 → GitHub Pages 배포)
- SW 캐시: 배포마다 BUILD_HASH 자동 갱신

## API 연결
- `app-core.js:4` — `PROD_API = 'https://itdasy260417-production.up.railway.app'`
- 인증: `localStorage.itdasy_token` (JWT)
- `authHeader()` — `{ Authorization: 'Bearer ...', ... }`

## 모듈별 역할
| 파일 | 역할 | 줄 |
|---|---|---|
| app-core.js | 인증, 탭, API, 구독배지, 유틸 | 750 |
| app-caption.js | 캡션 생성 UI, 시나리오 선택 | 880 |
| app-instagram.js | OAuth 연동, 말투 분석 | 290 |
| app-gallery.js | 이미지 편집 메인, 슬롯 관리 | 990 |
| app-gallery-bg.js | 누끼 + 배경 합성 | 376 |
| app-gallery-element.js | 요소 추가 (로고, 텍스트) | 352 |
| app-gallery-review.js | 리뷰 스티커 | 233 |
| app-gallery-write.js | 갤러리 내 글쓰기 | 192 |
| app-gallery-finish.js | 마무리 탭 | 280 |
| app-persona.js | 페르소나 설정 UI | 770 |
| app-ai.js | AI 추천 | 235 |
| app-spec-validator.js | 폼 검증 | 153 |

## 하위 CLAUDE.md
- `components/CLAUDE.md` — 모듈 컴포넌트 규칙

## 주의
- 이 레포는 **public** — API 키, 비밀 정보 절대 포함 금지
- 수정 후 개별 JS 파일 수정, push 시 자동 번들링
