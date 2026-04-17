# Components 규칙

## 특성
- `type="module"` 스크립트 (나머지 app-*.js는 글로벌 스코프)
- 부모(app-*.js)의 글로벌 함수 접근: `window.API`, `window.authHeader()`

## 파일별 역할
| 파일 | 역할 |
|---|---|
| persona-popup.js | 말투 검증 팝업 (AI 생성 캡션 피드백) |
| scenario-selector.js | 캡션 시나리오 선택 (상황/손님/사진 3축) |

## 데이터
- `shared/schemas.json` — 시나리오 카드 스키마
- `shared/scenario_cards.json` — 시나리오 옵션 목록
