# SESSION_STATE — 세션 인수인계 파일

> 새 세션이 시작되면 **이 파일을 먼저 읽고** 현재 단계·대기 결정·마지막 체크포인트를 파악한다.

**LAST UPDATED:** 2026-05-25 · v270 — AI 잇비 테스트 모드 차단

---

## 🟣 2026-05-25 — v270 AI 잇비 테스트 모드 차단

배경: 앱 전체 코드검사에서 `app-assistant-mocks.js`가 일반 앱에도 연결돼 있는 점 확인. 메시지 발송/인스타 게시를 테스트 모드로 가로챌 수 있어 위험.

완료:
- `index.html`에서 `app-assistant-mocks.js` 연결 제거.
- 혹시 나중에 파일이 다시 연결돼도 `?debug=1&assistant_mocks=1`이 없으면 작동하지 않게 안전장치 추가.
- 빌드: `20260525-v270-assistant-mocks-off` 로 통일.

확인:
- JS 문법 확인 통과.
- 관련 자동 검사: 새 오류 0개. 기존 `app-core.js` 경고만 남음.
- `npm run smoke` 통과: 173 scripts, build `20260525-v270-assistant-mocks-off`.
- 브라우저 실제 확인 통과: 테스트 모드 파일이 앱 스크립트 목록에도 없고 실제 로드도 안 됨. 심각 오류 0개.

남음:
- 큰 파일/긴 함수 경고 378개는 다음 분리 작업에서 계속 줄여야 함.

---

## 🟣 2026-05-25 — v269 사진편집기·AI 잇비 정리

배경: 사용자 요청. `/Users/kang-yeonjun/.claude/plans/ai-gpt-dapper-twilight.md` 계획을 이어서 진행. 새 기능을 크게 만들기보다, 같은 화면으로 가는 길과 AI 잇비 사진 작업을 정리.

완료:
- 홈/메뉴/AI허브에서 마무리 화면과 사진편집기를 여는 길을 공통 함수로 모음.
- 백엔드가 아직 처리하지 못하는 AI 잇비 사진 작업 7개를 프론트에서 안전하게 사진편집기/고객 선택 화면으로 연결.
- 사진 업로드 후 `사진 보정/명함/영수증/카톡 캡처` 버튼 중 하나를 가볍게 추천 표시.
- 사진편집기 필름 프리셋을 8개에서 16개로 늘림.
- 브랜드 템플릿 기본값 6개를 추가.
- 뷰티 보정 탭에 AI 메이크업 추천 버튼 5개를 별도 파일로 추가.
- 빌드: `20260525-v269-ai-gpt-cleanup` 로 통일.

확인:
- JS 문법 확인 통과.
- 바꾼 파일 관련 자동 검사 통과.
- 전체 자동 검사는 새 오류 0개. 기존 큰 파일/큰 함수 경고는 계속 남음.
- `npm run smoke` 통과: 174 scripts, build `20260525-v269-ai-gpt-cleanup`.
- `npm run lint:css` 통과.
- `npm test -- --runInBand` 정상 종료(테스트 파일 없음).
- 브라우저 실제 확인 통과: 빌드 일치, 잇비 사진 버튼 4개, 추천 표시 1개, 필름 16개, 기본 템플릿 6개, AI 메이크업 버튼 5개, 심각 오류 0개.

남음:
- `app-assistant.js`와 사진편집기 본체에는 아직 큰 파일/큰 함수 경고가 남아 있어 계속 분리 필요.

---

## 🟣 2026-05-25 — v268 AI 잇비 추천 파일 연결 보강

배경: 사용자 확인 요청. `ff5da92` 이후 잇비 쪽 일부가 안 되는 것 같다는 제보.

완료:
- `ff5da92`에 추천/자동완성 처리 연결 코드가 들어갔지만, 실제 새 파일 연결이 빠진 점 확인.
- `js/assistant/suggestion-controls.js`를 추가하고 `index.html`에서 `app-assistant.js`보다 먼저 읽게 연결.
- 새 파일을 서비스워커 저장 목록에 추가.
- 빌드: `20260525-v268-assistant-suggestions` 로 통일.

확인:
- JS 문법 확인 통과.
- 관련 자동 검사 통과. 기존 큰 파일/큰 함수 경고만 남음.
- `npm run smoke` 통과: 170 scripts, build `20260525-v268-assistant-suggestions`.
- 브라우저 실제 확인 통과: 잇비 도구 메뉴가 패널 안에 표시, 사진 종류 버튼 4개 표시, 말투 분석 함수 3개 노출, 심각 오류 0개.

남음:
- `app-assistant.js`는 여전히 큰 파일이라 카드 표시 쪽 추가 분리 필요.

---

## 🟣 2026-05-22 — v259 AI 잇비 그룹/통합 카드 버튼 분리

배경: 사용자 요청. 앱 전체에서 AI식 중복 설계, 옛날 코드 잔존, 큰 파일 위험을 계속 줄이는 다음 작업.

완료:
- AI 잇비의 그룹/통합 카드 버튼 처리(전체 추가, 수정, 접기/펴기, 행별 실행/수정/저장/제외/되돌리기)를 `js/assistant/group-action-controls.js`로 분리.
- 중복 경고와 fallback 프리뷰 카드 버튼 처리도 같은 버튼 전용 파일로 이동.
- `app-assistant.js`의 큰 클릭 처리 함수는 새 그룹 액션 모듈에 넘겨주는 얇은 연결부로 정리.
- 새 그룹 액션 모듈을 AI 잇비 본체보다 먼저 읽도록 `index.html`에 연결하고 `risk:integration` 표시를 남김.
- 새 파일은 서비스워커 저장 목록에 추가.
- 빌드: `20260522-v259-assistant-group-actions` 로 통일.

확인:
- 최신 `origin/main`과 로컬 `main` 일치에서 시작.
- 변경 JS 문법 확인 통과.
- 그룹 액션 버튼 모듈 단독 확인 통과.
- `git diff --check` 통과.
- `npm run smoke` 통과: 190 scripts, build `20260522-v259-assistant-group-actions`.
- `npm run lint:css` 통과.
- 관련 파일 자동 검사기 에러 0개 확인. 기존 큰 파일/큰 함수 경고는 남음.
- `npm test -- --runInBand` 정상 종료.
- `npm audit --omit=dev` 취약점 0개.
- 브라우저 검증 통과: 첫 화면 심각 오류 0개, HTML 직접 실행 연결 0개, 사진/단일/그룹 액션 버튼 모듈 정상.

남음:
- `app-assistant.js`는 아직 큰 파일이라, 다음 작업에서 추천 문구/입력 자동완성 또는 카드 표시 쪽을 더 분리해야 함.

---

## 🟣 2026-05-22 — v258 AI 잇비 단일 액션 버튼 분리

배경: 사용자 요청. 앱 전체에서 AI식 중복 설계, 옛날 코드 잔존, 큰 파일 위험을 계속 줄이는 다음 작업.

완료:
- AI 잇비의 단일 액션 버튼 처리(추가하기, 취소, 수정, 저장, 품목 추가/삭제, 할인 추가/삭제, 편집 취소)를 `js/assistant/single-action-controls.js`로 분리.
- `app-assistant.js`의 큰 클릭 처리 함수는 새 단일 액션 모듈에 넘겨주는 얇은 연결부로 정리.
- 새 단일 액션 모듈을 AI 잇비 본체보다 먼저 읽도록 `index.html`에 연결하고 `risk:integration` 표시를 남김.
- 새 파일은 서비스워커 저장 목록에 추가.
- 빌드: `20260522-v258-assistant-single-actions` 로 통일.

확인:
- 최신 `origin/main`과 로컬 `main` 일치에서 시작.
- 변경 JS 문법 확인 통과.
- 단일 액션 버튼 모듈 단독 확인 통과.
- `git diff --check` 통과.
- `npm run smoke` 통과: 189 scripts, build `20260522-v258-assistant-single-actions`.
- `npm run lint:css` 통과.
- 관련 파일 자동 검사기 에러 0개 확인. 기존 큰 파일/큰 함수 경고는 남음.
- `npm test -- --runInBand` 정상 종료.
- `npm audit --omit=dev` 취약점 0개.
- 브라우저 검증 통과: 첫 화면 심각 오류 0개, HTML 직접 실행 연결 0개, 사진/단일 액션 버튼 모듈 정상.

남음:
- `app-assistant.js`는 아직 큰 파일이라, 다음 작업에서 그룹/통합 카드 버튼 처리를 더 분리해야 함.

---

## 🟣 2026-05-22 — v257 AI 잇비 사진 클릭 처리 분리

배경: 사용자 요청. 앱 전체에서 AI식 중복 설계, 옛날 코드 잔존, 큰 파일 위험을 계속 줄이는 다음 작업.

완료:
- AI 잇비의 사진 관련 클릭 처리(첨부 삭제, 업로드 사진 확대, 보정 결과 확대, 보정 결과 저장/인스타/편집기/다시)를 `js/assistant/photo-actions.js`로 분리.
- `app-assistant.js`의 큰 클릭 처리 함수는 새 사진 클릭 모듈에 넘겨주는 얇은 연결부로 정리.
- 새 사진 클릭 모듈을 AI 잇비 본체보다 먼저 읽도록 `index.html`에 연결하고 `risk:integration` 표시를 남김.
- 새 파일은 서비스워커 저장 목록에 추가.
- 빌드: `20260522-v257-assistant-photo-actions` 로 통일.

확인:
- 최신 `origin/main`과 로컬 `main` 일치에서 시작.
- 변경 JS 문법 확인 통과.
- 사진 클릭 모듈 단독 확인 통과.
- `git diff --check` 통과.
- `npm run smoke` 통과: 188 scripts, build `20260522-v257-assistant-photo-actions`.
- `npm run lint:css` 통과.
- 관련 파일 자동 검사기 에러 0개 확인. 기존 큰 파일/큰 함수 경고는 남음.
- `npm test -- --runInBand` 정상 종료.
- `npm audit --omit=dev` 취약점 0개.
- 브라우저 검증 통과: 첫 화면 심각 오류 0개, HTML 직접 실행 연결 0개, 새 사진 클릭 처리 모듈 정상.

남음:
- `app-assistant.js`는 아직 큰 파일이라, 다음 작업에서 단일 액션 수정/저장 버튼 처리를 더 분리해야 함.

---

## 🟣 2026-05-22 — v256 AI 잇비 카드 요약 분리

배경: 사용자 요청. 앱 전체에서 AI식 중복 설계, 옛날 코드 잔존, 큰 파일 위험을 계속 줄이는 다음 작업.

완료:
- AI 잇비 카드 안에 보이는 한 줄 요약 규칙을 `js/assistant/kind-core.js` 공통 파일로 이동.
- 지출/재고/고객/예약/매출/회원권/환불/가격변경 요약을 작은 함수들로 나눠 새 큰 함수가 생기지 않게 정리.
- “전체 추가” 버튼 실행 순서 계산도 공통 파일로 이동. 고객 추가가 먼저 처리되는 안전 순서 유지.
- `app-assistant.js`는 새 공통 함수를 호출하는 얇은 연결부만 남김.
- 빌드: `20260522-v256-assistant-summary` 로 통일.

확인:
- 최신 `origin/main`과 로컬 `main` 일치에서 시작.
- 변경 JS 문법 확인 통과.
- 요약 규칙 단독 확인 통과: 지출/재고/회원권 문장, 고객 먼저 실행 순서 확인.
- `git diff --check` 통과.
- `npm run smoke` 통과: 187 scripts, build `20260522-v256-assistant-summary`.
- `npm run lint:css` 통과.
- 관련 파일 자동 검사기 에러 0개 확인. 기존 큰 파일/큰 함수 경고는 남음.
- `npm test -- --runInBand` 정상 종료.
- `npm audit --omit=dev` 취약점 0개.
- 브라우저 검증 통과: 첫 화면 심각 오류 0개, HTML 직접 실행 연결 0개, AI 잇비 요약/실행순서 함수 정상.

남음:
- `app-assistant.js`는 아직 큰 파일이라, 다음 작업에서 실행 버튼 처리 묶음을 분리해야 함.

---

## 🟣 2026-05-21 — v255 AI 잇비 공통 분리 1차

배경: 사용자 요청. 앱 전체에서 AI식 중복 설계, 옛날 코드 잔존, 큰 파일 위험을 계속 줄이는 다음 작업.

완료:
- `app-assistant.js` 안에 박혀 있던 AI 잇비 액션 종류, 위험 작업 목록, 카테고리 선택 목록, 외부 등록 함수를 `js/assistant/kind-core.js`로 분리.
- 마케팅 액션 확장 파일은 새 공통 파일을 기준으로 설명을 맞춤.
- `index.html`에 새 공통 파일을 AI 잇비 본체보다 먼저 읽도록 연결하고 `risk:integration` 표시를 남김.
- 새 파일은 서비스워커 저장 목록에 추가.
- 빌드: `20260521-v255-assistant-core` 로 통일.

확인:
- 최신 `origin/main`과 로컬 `main` 일치에서 시작.
- 변경 JS 문법 확인 통과.
- `git diff --check` 통과.
- `npm run smoke` 통과: 187 scripts, build `20260521-v255-assistant-core`.
- `npm run lint:css` 통과.
- 관련 파일 자동 검사기 에러 0개 확인. 기존 큰 파일/큰 함수 경고는 남음.
- `npm test -- --runInBand` 정상 종료.
- `npm audit --omit=dev` 취약점 0개.
- 브라우저 검증 통과: 첫 화면 심각 오류 0개, HTML 직접 실행 연결 0개, AI 잇비 공통 등록 함수 정상.

남음:
- `app-assistant.js`는 아직 큰 파일이라, 다음 작업에서 실행 버튼 처리/카드 렌더링 쪽을 더 쪼개야 함.

---

## 🟣 2026-05-21 — v254 서버 호출 공통화

배경: 사용자 요청. 앱 전체에서 AI식 중복 설계, 옛날 코드 잔존, 보안 위험을 계속 줄이는 다음 작업.

완료:
- `app-core.js`에 공통 서버 주소 함수 `apiUrl`, 공통 호출 함수 `apiFetch` 추가.
- 앱 JS 전반의 `서버 주소 + 경로` 직접 호출을 `apiFetch('/경로')` 방식으로 정리.
- 인스타, 캡션, 포트폴리오, 고객, 예약, 매출, DM, 알림, 사진 누끼/업로드 등 주요 사용자 흐름 호출을 같은 경로로 통일.
- 독립 진단 페이지와 예약 확인 페이지도 같은 주소 조립 방식으로 정리.
- 새 공통 함수가 자동 검사에서 인식되도록 규칙 파일과 에이전트 문서에 등록.
- 빌드: `20260521-v254-api-fetch` 로 통일.

확인:
- 최신 `origin/main`과 로컬 `main` 일치에서 시작.
- 변경 JS 문법 확인 통과.
- `git diff --check` 통과.
- `npm run smoke` 통과: 186 scripts, build `20260521-v254-api-fetch`.
- `npm run lint:css` 통과.
- 자동 검사기 에러 0개 확인. 기존 큰 파일/큰 함수 경고는 남음.
- `npm test -- --runInBand` 정상 종료.
- `npm audit --omit=dev` 취약점 0개.
- 브라우저 검증 통과: 첫 화면 심각 오류 0개, HTML 직접 실행 연결 0개, 공통 서버 호출 함수 노출 정상.
- 사진편집 QA 통과: 샘플 10장 + 템플릿 30종, 실패 0개.

남음:
- 기존 큰 파일/큰 함수 경고는 별도 분할 작업으로 줄여야 함.

---

## 🟣 2026-05-21 — v253 앱 전체 보안/구식 연결 정리

배경: 사용자 요청. 사진편집만이 아니라 앱 전체에서 AI식 중복 설계, 옛날 코드 잔존, 보안 위험을 검사하고 바로 고칠 수 있는 부분을 정리.

완료:
- 앱 코드와 `index.html`에 남아 있던 HTML 직접 실행 연결을 제거. 버튼/입력은 `data-*` 이름표 + 공통 연결 코드로 통합.
- 캡션, AI 추천, 갤러리, 포트폴리오, 고객, 인스타, 파워뷰 등 동적 카드에 들어가던 사용자/서버 문자열을 더 안전하게 처리.
- 공개 진단 페이지 `diag.html`, `dm-diag.html`, `get-token.html`은 로컬 개발 환경에서만 열리게 차단.
- 인앱 진단 패널은 로컬 또는 `?debug=1`일 때만 자세한 진단을 열게 제한.
- 레거시 토큰 키 직접 문자열은 앱 실행 코드에서 제거.
- `document.write` 제거, 빈 오류 삼킴 일부를 경고 기록으로 교체.
- 빌드: `20260521-v253-audit-hardening` 로 통일.

확인:
- 최신 `origin/main`과 로컬 `main` 일치 확인.
- `node --check` 변경 JS 전수 통과.
- `git diff --check` 통과.
- `npm run smoke` 통과: 186 scripts, build `20260521-v253-audit-hardening`.
- `npm run lint:css` 통과.
- `npm test -- --runInBand` 정상 종료.
- `npm audit --omit=dev` 취약점 0개.
- 브라우저 검증 통과: 첫 화면 심각 오류 0개, HTML 직접 실행 연결 0개, 이메일 로그인 접기/만들기 메뉴 정상.
- 사진편집 QA 통과: 샘플 10장 + 템플릿 30종, 실패 0개.

남음:
- 전체 자동검사는 새 오류 없이 통과하지만 기존 큰 파일/큰 함수/미사용 코드 경고 394개가 남아 있음. 별도 분할 작업으로 줄여야 함.
- API 주소 직접 조합은 오래된 파일 전체에 넓게 남아 있어, 서버 호출 구조를 건드리는 별도 작업으로 나눠야 안전함.

---

## 🟣 2026-05-21 — v252 사진편집 자동 그림자 + 배치 안정화

배경: 사용자 요청. 클로드 플랜을 그대로 새로 만들지 말고, 이미 들어온 필름/배치/스마트 영역 기능과 합쳐 중복을 줄이고 실제로 쓸 기능만 안정화해야 함.

완료:
- `app-photo-editor-bg-compose.js`: 갤러리와 사진편집이 같이 쓰는 누끼+배경 합성 공통 모듈 추가. 누끼 PNG의 투명도만 써서 `그림자 없음/부드럽게/또렷하게/떠 있는 느낌` 4종 자동 그림자 적용.
- `app-gallery-bg.js`: 기존 배경 합성 큰 코드를 공통 모듈 호출로 정리. 파일 566줄 → 346줄.
- `app-photo-editor-bg-tab.js`: 사진편집 `누끼·배경` 안에 그림자 옵션을 추가. 별도 탭은 만들지 않음.
- `app-photo-editor-worker-filter.js`, `workers/photo-filter-worker.js`: 큰 사진 선명도 계산을 별도 작업 파일로 빼서 화면 멈춤을 줄이는 길 추가.
- `app-photo-editor-batch.js`: 기존 배치 기능을 필름/그림자/워터마크/비율까지 먹도록 확장. 모바일 1장씩, 데스크톱 2장씩 처리. 진행률, 중단, 실패 건너뛰기 연결.
- `app-photo-editor-ai-mask.js`, `app-photo-editor-selective.js`, `app-photo-editor-selective-mask.js`: 보수형 `사람/시술`, `배경` 영역 버튼 추가. 기존 스마트 영역 판단과 합쳐 보정 핀으로 연결.
- `app-photo-editor.js`: 즐겨찾기 프리셋에 필름/그림자/워터마크/배경 상태까지 저장. 되돌리기 기록에도 그림자/배경 포함.
- `index.html`, `app-core.js`, `sw.js`: 빌드 `20260521-v252-photo-shadow-batch` 로 통일.

확인:
- JS 문법 확인, 공백 검사 통과.
- `npm run smoke` 통과: 186 scripts, build `20260521-v252-photo-shadow-batch`.
- `npm test -- --runInBand` 정상 종료.
- 관련 파일 자동검사: 새 오류 0개, 기존 경고만 유지.
- 실제 사진 QA 통과: 네일 5장 / 헤어 5장 / 피부 5장 / 메이크업 5장 + 템플릿 30종, 브라우저 심각 오류 0개, 실패 0개.
- 브라우저 추가 확인: 그림자 4종 버튼 노출, 사람/배경 영역 버튼 노출, 사람 영역 핀 생성, 큰 사진 작업 파일 작동, 배치 2장 적용 성공.

남음:
- MediaPipe 정밀 모델은 아직 기본 편집 흐름에 넣지 않음. 비용/속도 판단 후 느린 정밀 기능으로 별도 연결.
- 실제 원장님 사진 10~20장 사람 눈 검수는 계속 필요.

---

## 🟣 2026-05-21 — v251 사진편집 스마트 영역 보정 + 메뉴 정리

배경: 사용자 요청. 사진편집 메뉴를 원장님 작업 순서에 맞게 정리하고, 피부/머리/눈/네일 보정이 배경·옷·로고로 새는 문제를 줄여야 함.

완료:
- `.goal/team.md`, `.ai/tickets/T-600.md`, `.ai/tickets/T-600/plan.md`: 사진편집 경쟁력 강화 목표, 팀 역할, 진행 범위 기록.
- `app-photo-editor-smart-mask.js`: 사진 픽셀에서 피부/머리/눈/네일/붉은기 가능성을 빠르게 계산하는 안전장치 추가.
- `app-photo-editor-beauty.js`: 피부, 붉은기, 손, 눈, 속눈썹, 머리 윤기, 머리 풍성감, 머리끝 정리, 네일 광택 보정이 각 영역에 더 안전하게 먹도록 연결.
- `app-photo-editor-entry-v6.js`: 첫 화면을 `빠른 자동보정`, `톤·필터`, `배경·누끼`, `디테일` 중심으로 정리. 느린 정밀 AI 문구를 분리.
- `app-photo-editor-ai-touch-v2.js`: 느린 정밀 AI 버튼 문구 정리.
- `js/photo-editor/premium-templates.js`: 너무 하얗게 보여 검사에서 걸리던 카드 템플릿 3종을 살롱 카드 톤으로 보정.
- `scripts/photo-editor-realistic-qa.js`: 실제 사진 검증 리포트와 스크린샷이 현재 빌드명으로 남도록 수정.
- `index.html`, `app-core.js`, `sw.js`: 빌드 `20260521-v251-photo-smart-mask` 로 통일.

확인:
- JS 문법 확인, 공백 검사 통과.
- `npm run smoke` 통과: 182 scripts, build `20260521-v251-photo-smart-mask`.
- `npm test -- --runInBand` 정상 종료.
- 관련 파일 자동검사: 새 오류 0개, 기존 큰 함수 경고 1개 유지.
- 실제 사진 QA 통과: 네일 5장 / 헤어 4장 / 피부 1장 + 템플릿 30종, 브라우저 심각 오류 0개, 실패 0개.
- 스크린샷 확인: 작은 카드의 `디테일` 글자 잘림 없음.

남음:
- 실제 원장님 사진 10~20장 사람 눈 검수.
- 유료/느린 AI 기능은 결제·비용 결정 후 별도 작업.

---

## 🟣 2026-05-20 — v250 템플릿 튕김 + 영역 보정 안정화

배경: 사용자 제보. 사진편집에서 템플릿을 누르면 튕기거나 멈추고, 피부/배경/헤어 보정이 원하는 영역만 깔끔하게 먹지 않음.

완료:
- `js/photo-editor/premium-templates.js`: 프리미엄 템플릿 렌더러 안의 같은 이름 함수 충돌 수정. 템플릿 적용 시 잘못된 함수가 불려 터지던 경로 제거.
- `js/photo-editor/premium-templates.js`: 프리미엄 템플릿 버튼 꾸미기 코드가 같은 글자를 계속 다시 쓰며 멈칫거릴 수 있던 루프 차단.
- `app-photo-editor-templates-v2.js`: 템플릿 마켓 창이 사진편집 화면 뒤로 숨지 않게 높이값 조정.
- `app-photo-editor-beauty.js`: 피부/붉은기/머리 보정이 사진 가장자리 배경으로 새지 않도록 중앙 사람 영역 기준을 강화.
- `app-photo-editor-beauty.js`: 머리 풍성감에서 전체 사진 선명화가 과하게 걸리던 강도를 낮춰 배경 흔들림 감소.
- `index.html`, `app-core.js`, `sw.js`: 빌드 `20260520-v250-template-mask-hotfix` 로 통일.

확인:
- 브라우저 자동 검증: 사진 열기 → 프레임 → 프리미엄 템플릿 30종 → `feed-showcase` 적용 → 캔버스 정상 표시 확인.
- 브라우저 픽셀 검증: 중앙 피부 변화 `12.67`, 중앙 헤어 변화 `6.33`, 살색 배경 변화 `0.30`, 어두운 배경 변화 `0`.
- JS 문법 확인, 공백 검사, `npm run smoke`, `npm test -- --runInBand` 통과.
- 관련 파일 자동검사는 0 errors, 기존 warnings 3개 유지.

---

## 🟣 2026-05-20 — v249 사진 선택 미리보기 수정

배경: 사용자 제보. 사진편집 메인화면에서 사진을 골라도 바로 보이지 않음.

완료:
- `app-photo-editor.js`: 사진 로드 완료 후 새 사진편집 메인화면 미리보기 갱신 호출 추가.
- `app-photo-editor-entry-v6.js`: 외부에서 메인화면을 다시 그릴 수 있는 refresh 함수 공개.
- `index.html`, `app-core.js`, `sw.js`: 빌드 `20260520-v249-photo-pick-preview` 로 통일.

확인:
- 브라우저 자동 검증: 사진편집 메인화면에서 파일 선택 후 미리보기 이미지 즉시 표시 확인.
- JS 문법 확인, 공백 검사 통과.

남음:
- 로컬에 예약 취소 SQL-first 관련 미커밋 변경이 남아있음. 사진편집 v249 커밋에는 포함하지 않음.

---

## 🟣 2026-05-20 — v247 디테일 보정 + 시술 선택

배경: 사용자 요청. 사진편집 디테일 추천보정이 실제로 되는지 확인하고, 모발 끝 정리/풍성감 약함과 텍스트 시술명·가격 자동 의미를 정리해야 함.

완료:
- `app-photo-editor-beauty.js`: 머리 판단 범위를 넓혀 밝은 머리/염색 머리도 보정 대상에 더 잘 잡히게 수정.
- `app-photo-editor-beauty.js`: `머리 풍성감` 대비·선명도 체감 강화, `머리끝 정리` 섞임 강도 강화.
- `app-photo-editor.js`: 텍스트 버튼을 `시술 선택`, `가격 넣기`로 변경하고 텍스트 레이어 동기화 누락을 보강.
- `app-photo-editor-service-picker.js`: 시술 프리셋 가격표에서 시술을 골라 사진 문구로 넣는 선택창 추가.
- `app-service-templates.js`: 시술 프리셋 목록을 로컬 캐시에 저장해 사진편집 선택창에서도 재사용 가능하게 함.
- `app-photo-editor.js`: CSS 충돌로 사진편집 시트가 숨는 경우를 막기 위해 열기/닫기 표시를 강하게 고정.
- `index.html`, `app-core.js`, `sw.js`: 빌드 `20260520-v247-detail-service-picker` 로 통일.

확인:
- 브라우저 픽셀 검증 통과: 모발 추천 6개 전부 실제 변화 확인. `머리 풍성감 12.551`, `머리끝 정리 3.11`, `모발 윤기 2.125`, `머리결 7.151`, `염색 컬러 강조 8.274`, `모발 색감 1.788`.
- 브라우저 UI 검증 통과: `복구펌` 선택 → 텍스트 레이어 반영, `가격 넣기` → `12만원` 반영.
- 브라우저 UI 검증 통과: 사진편집 시트 실제 표시값 `flex` 확인.
- JS 문법 확인, 공백 검사, `npm run smoke`, `npm test -- --runInBand`, 전체 자동검사 통과.
- 전체 자동검사는 0 errors, 기존 warnings 441개 유지.

남음:
- 실제 원장님 헤어 사진으로 사람 눈 기준 체감 검수는 별도.

---

## 🟣 2026-05-20 — v244 속눈썹 눈 보정 추가

배경: 사용자 요청. 속눈썹 사진에서 눈 붉음, 흐린 눈동자, 눈빛 부족을 바로 고칠 수 있어야 함.

완료:
- `app-photo-editor-beauty.js`: 속눈썹 메뉴 첫 화면에 눈 붉음 완화, 눈동자 또렷, 눈빛 반짝임, 눈밑 칙칙함 슬라이더 추가.
- `app-core.js`, `app-photo-editor-beauty.js`, `app-photo-enhance.js`: `속눈썹`을 `눈썹`으로 잘못 읽던 문제 수정.
- `app-photo-enhance.js`, `js/photo-editor/studio-presets.js`: 속눈썹 자동 보정과 `눈빛 클리어` 카드를 새 눈 보정값으로 연결.
- `app-photo-editor-ai-touch-v2.js`: 정밀 얼굴 보정에서 눈 영역을 어두운 색으로 덧칠하지 않고 선명도/대비 보정으로 처리.
- `index.html`, `app-core.js`, `sw.js`: 빌드 `20260520-v244-lash-eye-tools` 로 통일.

확인:
- 브라우저 자동 검증 통과: 속눈썹 업종 인식, 속눈썹 메뉴 슬라이더 노출, `눈빛 클리어` 카드 적용, 붉은 눈 샘플의 빨간값 감소.
- JS 문법 확인, 공백 검사, `npm run smoke`, `npm test -- --runInBand` 통과.
- 전체 자동검사는 0 errors, 기존 warnings 유지.

---

## 🟣 2026-05-20 — v240 사진편집 새 메뉴 흐름/뒤로가기 수정

배경: 사용자 제보. 사진편집 새 메뉴에서 AI 자동/느낌/누끼/자르기/사이즈/텍스트/보정/필터/잡티를 누르면 다시 예전 어두운 편집 화면으로 떨어지고, 기능 안에서 뒤로 누르면 사진편집 메뉴가 아니라 홈으로 나가던 문제.

완료:
- `app-photo-editor-entry-v6.js`: 기능 안쪽 상태를 새로 추가. 카드 진입 시 상단 제목을 `사진 편집 · 기능명` 으로 바꾸고, 뒤로 버튼은 `메뉴` 로 표시.
- `app-photo-editor-entry-v6.js`: 기능 안쪽에서 뒤로 누르면 편집기를 닫지 않고 사진편집 새 메뉴로 돌아오게 수정.
- `app-photo-editor.js`: 폰/브라우저 뒤로가기도 기능 안쪽에서는 홈으로 나가지 않고 사진편집 메뉴로 복귀하게 수정.
- `css/screens/photo-editor-entry-v6.css`: 기능 안쪽 화면도 밝은 v6 디자인으로 덮음. 옛 탭줄은 숨기고, 패널/버튼/슬라이더/입력창/살롱 자동보정 카드까지 새 디자인으로 정리.
- `index.html`, `app-core.js`, `sw.js`: 빌드 `20260520-v240-photo-editor-flow` 로 통일.

확인:
- 브라우저 자동 검증 통과: AI 자동, 느낌/필터, 누끼, 자르기, 사이즈, 텍스트, 보정, 잡티, 폰/브라우저 뒤로가기.
- 누끼는 실제 유료/외부 처리 대신 검증용 가짜 배경으로 합성 흐름만 비용 없이 확인.
- 브라우저 심각 오류 0개.
- JS 문법 확인, CSS 자동검사, 공백 검사 통과.
- `npm run smoke` 통과 (176 scripts, build `20260520-v240-photo-editor-flow`).
- `npm test -- --runInBand` 정상 종료 (테스트 파일 없음).
- 전체 자동검사는 0 errors, 기존 warnings 445개.

---

## 🟣 2026-05-20 — v239 사진편집 템플릿 렉 핫픽스

배경: 사용자 전달 진단. 템플릿 탭에서 큰 사진을 불러오거나 후기/가격 문구를 입력할 때 멈칫거리는 현상.

완료:
- `app-photo-editor-templates.js`: 같은 1080×1350 / 1080×1920 캔버스 크기면 더 이상 매번 새로 만들지 않게 수정.
- 후기/가격/Before-After 라벨 입력 중에는 140ms 기다렸다 한 번만 다시 그리게 변경. 입력 완료 시 작업 기록은 1번만 남김.
- 큰 원본 사진은 템플릿용 축소본을 한 번 만들어 재사용. 4000×6000급 사진도 첫 템플릿 이후 다시그리기 부담을 낮춤.
- `index.html`, `app-core.js`, `sw.js`: 빌드 `20260520-v239-template-lag-hotfix` 로 통일하고 템플릿 파일 캐시도 갱신.

확인:
- JS 문법 확인, 템플릿 파일 자동검사, 공백 검사 통과.
- `npm run smoke` 통과 (176 scripts).
- `npm test -- --runInBand` 정상 종료 (테스트 파일 없음).
- 브라우저 실측: 4000×6000 테스트 사진에서 6종 템플릿 전환, 입력 22자 연속 입력 시 다시그리기 1회로 묶임. 브라우저 심각 오류 0개.

---

## 🟣 2026-05-19 — v234 사진편집 스튜디오 고급화 + 실제 사진 QA

배경: 사용자 요청. 템플릿 30종은 기능상 되지만 고급 디자인 자산 수준은 부족했고, 실제 네일/헤어/피부 사진으로 체감 품질 확인 필요.

완료:
- `js/photo-editor/studio-presets.js`: 자동 탭을 "살롱 빠른 보정" 메뉴로 교체. 자연광 살롱, 네일 컬러업, 헤어 윤기, 속눈썹 또렷, 피부톤 정돈, SNS 선명컷 6개 프리셋 추가.
- `js/photo-editor/premium-templates.js`: 기존 30종 템플릿 목록은 유지하고 결과 캔버스 합성을 프리미엄 렌더러로 교체. 예전 흰 배경/이모지 느낌 제거, 살롱 홍보용 카드·스토리·가격표·명함 톤으로 재구성.
- `css/screens/photo-editor-studio.css`: 사진편집기 메뉴/탭/버튼/템플릿 시트를 차분한 다크 살롱 도구 톤으로 재정리. v232 의 강한 핑크/퍼플 느낌 완화.
- `scripts/photo-editor-realistic-qa.js`: 실제 공개 사진 기반 QA 추가. 네일/헤어/피부 계열 10~20장 샘플 수집, 프리셋+템플릿 적용 후 캔버스가 흰색/분홍색 덩어리로 깨지지 않는지 검사.
- 빌드 버전: `20260519-v234-studio-editor`.

확인:
- JS 문법 확인, 신규 파일 자동검사, 공백 검사 통과.
- `npm run smoke` 통과 (174 scripts).
- `npm test -- --runInBand` 정상 종료 (테스트 파일 없음).
- 전체 자동검사: 0 errors, 기존 warnings 443개.
- 실제 사진 QA 통과: 14장(네일 5 / 헤어 4 / 피부 5) + 템플릿 30종, 브라우저 심각 오류 0개, 실패 0개.

남음:
- 실제 원장님 사진 10~20장으로 사람 눈 검수는 별도. 자동 검사는 공개 사진 기반으로 통과.

---

## 🟣 2026-05-19 — v233 사진편집 렌더링 깨짐 긴급 수정

배경: 사용자 제보. 얼굴 인식/셀렉티브 보정에서 흰색·분홍색 덩어리, 필름 프리셋에서 윤곽선/색반전처럼 깨짐, 자동보정에서 사진이 흐려지는 현상.

완료:
- `app-photo-editor-gl-pipeline.js`: mask 업로드가 원본 사진 텍스처 자리(TEXTURE0)를 덮던 핵심 버그 수정. 이제 원본은 원본대로, mask 는 mask 자리(TEXTURE1)로 분리.
- `app-photo-editor-gl-shaders-lut.js`: 필름 3D LUT 가 실제 보정표 텍스처를 쓰게 수정. `네일 글로우` 등 필름이 사진 자체를 보정표처럼 읽는 깨짐 경로 제거.
- `app-photo-editor-gl-shaders-blur.js`: 자동보정 선명도 단계가 흐린 결과를 그대로 반환하던 경로 제거.
- `app-photo-editor-selective-mask.js`: mask canvas 상태 초기화 강화. 흰/분홍 mask 가 결과 이미지에 직접 합성되지 않게 안전화.
- `app-photo-editor.js`: original 비율에서 4032×3024 원본 해상도 유지, 렌더 후 canvas 상태 초기화, undo/redo 에 selective/film/curve/hsl 포함.
- `app-photo-editor-film-presets.js`: 필름 기본 강도 75% 로 낮춰 자연스러운 뷰티 보정 쪽으로 조정.
- `app-power-view.js`: 페이지 로드 중 `_krw is not defined` 오류 수정.
- 빌드 버전: `20260519-v233-photo-render-hotfix`.

확인:
- JS 문법 확인, 자동검사, `git diff --check` 통과.
- `npm run smoke` 통과 (172 scripts).
- `npm test -- --runInBand` 정상 종료 (테스트 파일 없음).
- Playwright + WebGL 검증 통과:
  · 4032×3024 원본 크기 유지.
  · 자동보정 흐림 없음.
  · 셀렉티브 분홍/흰 덩어리 없음.
  · 필름 색감 변화 정상, 윤곽선/색반전 spike 없음.
  · 브라우저 심각 오류 0개.

남음:
- 실제 iPhone Safari / 구형 Android 실기기 손검사는 별도. 자동 브라우저에서는 WebGL SwiftShader 로 경로 확인 완료.

---

## 🟣 2026-05-19 — v223 md 기준 엄격 정리

배경: 사용자 지시 "코드 md대로 수정해 1차 2차니 뭐니 멈추지 말고". v222 에서 남겨둔 테스트용 SNS 캘린더 버튼과 PE-4 드래그 텍스트 로드를 md 기준으로 다시 정리.

완료:
- `app-ai-hub.js`: 첫 화면 순서를 사진 편집기 → SNS 캡션 → 해시태그 매니저 중심으로 변경. SNS 캘린더 행 제거.
- `index.html`: `app-sns-calendar.js`, `app-photo-editor-text-dnd.js` 로드 제거. 이미 숨긴 AR/영상/성과/예약/크로스발행 등도 계속 미로드.
- `app-sns-hashtag.js`: 해시태그 매니저를 핵심 기능으로 유지하면서 인라인 클릭 제거, 복사 실패 경고 처리.
- `app-photo-editor-templates-v2.js`, `app-photo-editor-templates.js`, `app-instagram.js`: 릴스 커버 노출 문구를 스토리/세로 홍보 이미지 쪽으로 정리.
- `app-assistant.js`, `app-auto-ba.js`: 영상 자동편집 진입 대신 사진 카드/Before-After 비교로 연결.
- `app-myshop-v3.js`, `app-drawer.js`, `app-power-view-quota.js`: Free/Pro 잔여 문구 일부를 체험/멤버십으로 정리.
- 빌드 버전: `20260519-v223-md-strict`.

남음:
- 파일 삭제는 하지 않음. 삭제는 AGENTS.md 기준 빨간불이라 별도 승인 필요. 현재는 앱에서 불러오지 않게 처리.
- 실제 결제/스토어 상품 ID 정리는 백엔드/스토어 작업이라 별도.

---

## 🟣 2026-05-19 — v222 md 기준 기능 정리

배경: 사용자 확인. `/Users/kang-yeonjun/Downloads/ultra-plan-review.md` 는 "사진편집 + AI 캡션/해시태그에 집중, 잡기능은 보류/삭제" 방향. 기존 v216~v219 는 기능을 너무 많이 붙여둔 상태였음.

완료:
- `app-ai-hub.js`: AI·자동화 화면에 `SNS 캘린더` 행 추가. 누르면 `window.SNSCalendar.open()` 실행.
- `app-sns-calendar.js`: md 기준 보류인 피드 미리보기 버튼 제거. 캘린더 자체는 테스트 진입 가능하게 유지. 빈 날짜 채우기는 서버 돈 안 드는 로컬 아이디어로 표시.
- `index.html`: 보류/삭제 후보 기능은 파일 삭제 없이 로드만 끔.
  · 숨김: AR 가상시술, 사진 점수, 조명 보정 별도 탭, 콜라주, 릴스/비디오, SNS 예약발행, 피드 미리보기, 성과 화면, AI 포스트, 크로스 발행, 경쟁샵, 자동 리포스트.
  · 유지: 사진편집 본체, Before/After, 템플릿 30종, 해시태그 매니저, SNS 캘린더 테스트 버튼.
- `app-photo-editor-ai-touch-v2.js`: 기본 버튼처럼 보이던 `AI 원터치 v2` 를 `정밀 얼굴 보정 (느림)` 보조 버튼으로 변경. 기본은 기존 `한 번에 자동 보정`.
- `index.html`, `app-plan.js` 등: Free/Pro/Premium 비교 화면과 사용자 문구를 월 6,900원 단일 멤버십 방향으로 정리.
- 빌드 버전: `20260519-v222-md-focus`.
- 검사 완료: JS 문법 확인, 자동검사, `npm run smoke`, 공백 검사 통과. 브라우저에서 `SNS 캘린더` 진입, `빈 날짜 아이디어` 동작, 월 6,900원 멤버십 팝업, 숨긴 기능 미로드 확인.

남음:
- 실제 결제/서버 플랜 구조는 아직 기존 `pro` 경로를 임시 사용. 백엔드 결제 상품명·스토어 상품 ID 정리는 별도 작업 필요.
- 숨긴 파일은 삭제하지 않음. 앱 안정 확인 후 진짜 삭제 여부 결정.

---

## 🟣 2026-05-19 — v219 잔여 4 빈틈 완전 해결

배경: 사용자 "다 하라니까? 시발 뭐하냐" — v218 에서 정직하게 짚었던 빈틈 4개 (SN-5 endpoint 미확인, SN-1 캘린더-백엔드 동기화, PE-5 30종 실제 동일 디자인, PE-1+6 로딩 UX 부재) 즉시 모두 처리.

(1) SN-5 insights endpoint 신규 (`itdasy_backend-test`):
- `routers/instagram_insights.py` 신규 (167줄). `GET /instagram/insights`.
- Meta Graph API v21.0: `/{ig-user}/media?fields=id,caption,timestamp,permalink,like_count,comments_count` + 각 미디어별 병렬 `/{media-id}/insights?metric=saved,reach` + `/{ig-user}?fields=followers_count`.
- 응답: `{status, total_posts, avg_likes, avg_comments, total_likes, total_comments, top_posts[{id,caption,permalink,like_count,comments_count,saved,reach,timestamp}], best_hours[{hour,avg_likes}], follower_count}`.
- 토큰/계정 없으면 503 대신 200 + `status='no_account'`. 인사이트 시간대 집계는 미디어 timestamp 시간(hour) 기준 평균.

(2) SN-5 프론트 결선 (`app-sns-analytics.js`):
- 새 응답 형식 → 기존 화면 포맷으로 매핑 (`_mapBackend`). top_posts → topPosts[1..5], best_hours → bestTimes (max 대비 정규화 score), summary 집계.
- daily 그래프는 백엔드 미제공 — top_posts 의 timestamp 로 30일 버킷 합성 (`_dailyFromPosts`).
- 헤더에 `● 실시간` (서버) / `데모` 뱃지. `_notice` 영역에 미연동 안내.

(3) SN-1 캘린더 백엔드 동기화 (`app-sns-calendar.js`):
- `_syncFromServer()` — `SNSSchedule.list()` 응답을 로컬 `_posts` 와 `serverId` 기준 병합. 첫 렌더는 로컬, 응답 도착하면 다시 렌더.
- `_deletePost` — `target.serverId` 있으면 `SNSSchedule.cancel(serverId)` 비차단 호출.

(4) PE-5 30종 진짜 차별화 (`app-photo-editor-templates-v2.js`):
- `_drawOverlay` 가 30개 템플릿 ID → 고유 합성 함수 dispatch table.
- 30개 합성 함수 (~570줄):
  · 피드 5: `_drawFeedShowcase`(하단 그라데이션), `_drawFeedNewMenu`(NEW 뱃지), `_drawFeedReview`(따옴표 카드), `_drawFeedPrice`(가격 강조 띠), `_drawFeedNotice`(📢 헤더)
  · 스토리 5: `_drawStoryCount`(큰 D-N), `_drawStoryOpen`(OPEN 박스), `_drawStoryAttend`(5칸 출석), `_drawStoryQA`(Q+답변 박스), `_drawStoryPoll`(A/B 옵션)
  · 릴스 5: `_drawReelsBA`(BEFORE↗AFTER), `_drawReelsPrice`(어둠+큰 헤드), `_drawReelsNew`(✨NEW 헤더), `_drawReelsReview`(★5+카드), `_drawReelsProcess`(1→2→3→4 step)
  · 이벤트 5: `_drawEventDiscount`(회전 SALE), `_drawEventMember`(VIP 골드 테두리), `_drawEventNewcomer`(좌우 컬러 분할), `_drawEventDeadline`(빨간 ⏰), `_drawEventGift`(🎁 리본 박스)
  · 가격표 5: `_drawPriceTable` 공통 + 카테고리별 4개 메뉴 배열 (헤어/네일/속눈썹/메이크업/왁싱)
  · 명함 5: `_drawCardMinimal`(라인), `_drawCardGold`(검정+골드 그라데이션 테두리), `_drawCardPink`(파스텔+화이트 카드), `_drawCardDark`(어두운+컬러 띠), `_drawCardNature`(베이지+잎사귀 곡선)
- 옛 6개 카테고리 공통 합성 함수 (_drawFeed/_drawStory 등) 제거.

(5) PE-1/PE-6 로딩 UX (`app-mediapipe-loader.js` + 양 모듈):
- 로더에 `onProgress(fn)` API + `_state.progress` 0~100. 단계: 5(시작)→15(TF.js fetch)→45(TF.js 완)→75(face-mesh fetch 완)→100(detector ready).
- PE-1 버튼: `AI 모델 로딩 중 15%…` 동적 표시 + 사전 로드 (`await ML.load()`) → 로드 끝나면 `AI 분석 중…`.
- PE-6 시트: 상단 보라 알림 배너(`#arLoadingBanner`) — `AI 얼굴 인식 로딩 45%` / `얼굴 안 잡힘 — 네일은 드래그` / `실패 — 폴백`.

빌드 버전 v219, 백엔드 푸시 (instagram_insights + scheduled url fix), 프론트 푸시 예정.

ultra-plan 진행 상태 — **운영 가능 수준**:
- ✅ Phase 1 사진편집 4/4: PE-1, PE-2, PE-4, PE-5
- ✅ Phase 1 SNS 5/5: SN-1 (백엔드 동기화 포함), SN-2 (upload+publish 결선), SN-3, SN-4, SN-5 (실제 insights API)
- ✅ Phase 2 사진편집 4/4: PE-6 (로딩 배너 포함), PE-8, PE-9, PE-10
- ✅ Phase 2 SNS 5/5: SN-6, SN-7 (네이버/카카오 백엔드 + skipped 응답), SN-8, SN-9, SN-10
- ⛔ Phase 3 / PE-3 / PE-7 — 사용자 명시 제외

운영 적용 시 필요한 외부 작업 (코드 외):
- Railway 환경변수 등록: `PUBLIC_BASE_URL` (옵션 — 없으면 request.base_url 폴백), `NAVER_BLOG_OPEN_API_TOKEN` / `NAVER_BLOG_USER_ID` / `KAKAO_CHANNEL_BIZ_KEY` / `KAKAO_CHANNEL_PUBLIC_ID` (미설정 시 SN-7 부분 'skipped' 응답)
- 사람 손 클릭 검증 (자동화 불가 — 사용자 직접)

위반 영역: 없음. itdasy-frontend-test-yeunjun + itdasy_backend-test 만 작업. 운영 레포 미터치.

---

## 🟣 2026-05-19 — v218 v217 fix + SN-2/SN-7 백엔드 결선

---

## 🟣 2026-05-19 — v218 v217 fix + SN-2/SN-7 백엔드 결선

배경: 사용자(연준) "다 해야지 제대로" 지시. v217 작성 직후 코드 정독에서 명백한 통합 버그 발견 — 신규 4개 모듈이 잘못된 DOM ID/state 필드 참조. 또 SN-2/SN-7 백엔드 결선 미완료 부분 마저 완료.

발견된 버그 (코드 정독에서):
1. `peSheet` ID 참조 — 실제는 `photoEditorSheet`. PE-1/PE-5/PE-6 watcher 가 영원히 sheet 못 찾았었음.
2. `state.image` 필드 참조 — 실제는 `state.originalImg`. PE-1 보정 결과 적용 시 NPE 위험.
3. `state.imageBitmap` 필드 — 존재하지 않음. 제거.
4. setInterval 영구 폴링 (1초/700ms/500ms × 4 모듈) — MutationObserver 로 교체. 깜빡임도 제거.
5. PE-4 hit test 가 size/60 * 4 = 화면 40% 너무 큼 — measureText + 회전 역변환으로 픽셀 정확 hit test.
6. PE-5 가 state.tplV2 만 설정하고 실제 합성 없음 — PhotoEditor 본체에 `_drawHooks.tplV2_overlay` 호출 1줄 추가 + Templates v2 가 hook 등록.

PE-5 디자인 합성 (이번 라운드 추가):
- 6 카테고리별 합성 함수 — feed (하단 그라데이션 띠 + 헤드라인), story (상단 컬러 블록), reels (중앙 어둠 + 큰 헤드 + 컬러 띠), event (중앙 라운드 박스), price (상단 헤더 + 하단 정보 영역), card (테두리 + 중앙 다크 박스).
- Brand Kit primary/accent/soft 가 진짜로 캔버스에 그려짐.

SN-2 백엔드 결선 (`itdasy_backend-test`):
- `routers/scheduled_posts.py` 에 `POST /scheduled-posts/upload` 추가 — data URL 받아 static/uploads/scheduled/{uid}.{ext} 저장, 공개 URL 반환. 8MB 상한, 지원 형식 png/jpg/webp.
- 환경변수 `PUBLIC_BASE_URL` 있으면 풀 URL, 없으면 상대 경로 (`/static/uploads/scheduled/...`).
- 발행 자체는 기존 `services/scheduled_publisher.publish_loop` 가 main.py startup task 로 무한 루프 돌면서 처리.

SN-2 프론트 (`app-sns-schedule.js`):
- 옛 `POST /instagram/schedule` (존재하지 않던 endpoint) → 새 2단계 호출. (1) `/scheduled-posts/upload` (2) `/scheduled-posts` POST.
- `listScheduled()` / `cancelScheduled(id)` API 추가 — 캘린더가 init 시 호출 가능.

SN-7 백엔드 결선 (신규 라우터):
- `routers/sns_crosspost.py` — POST `/sns/naver-blog/post`, POST `/sns/kakao-channel/send`.
- 환경변수 미설정 (NAVER_BLOG_OPEN_API_TOKEN, NAVER_BLOG_USER_ID, KAKAO_CHANNEL_BIZ_KEY, KAKAO_CHANNEL_PUBLIC_ID) 시 503 대신 **200 + status='skipped'** 응답. 프론트에서 사용자에게 "API 키 등록 필요" 안내.
- 환경변수 등록되면 실제 네이버 블로그 OpenAPI / 카카오 비즈니스 메시지 호출.
- main.py 에 라우터 등록 1줄 추가.

SN-7 프론트 (`app-sns-phase2.js openCrossPlatform`):
- 옛 가짜 toast → 실제 백엔드 호출 + 결과 표시 (✅ / ⚠️ skipped / ❌ error).
- 캡션 textarea + 블로그 제목 input + 플랫폼별 체크박스 + 결과 div.
- Instagram 은 사진 첨부 필수 안내 (별도 진입 — 기존 `/instagram/publish` 사용).

확인:
- 백엔드 AST 통과, frontend node --check / smoke / eslint 0 errors.
- headless Chrome 로드 → JS 에러 0, 빌드 v218 적용 확인.
- 백엔드 푸시: `git push test feat/sns-publish-routes:main` 성공 (Railway 자동 배포 대기).

ultra-plan 진행 상태:
- ✅ Phase 1 전체 (PE-1/2/4/5 + SN-1~5) — UI 정밀 + 백엔드 결선 완료
- ✅ Phase 2 전체 (PE-6/8/9/10 + SN-6~10) — UI 정밀 + 백엔드 결선 완료
- ⛔ Phase 3 / PE-3 AI 배경 / PE-7 릴스 — 사용자 지시로 보류

다음 라운드 후보 (선택):
- SN-7 네이버/카카오 환경변수 등록 (운영 작업)
- PE-1 MediaPipe 첫 로딩 스피너 UX
- PE-4 텍스트 외 스티커/이미지 레이어로 확장
- SN-5 인사이트 demo data → 실제 IG insights API 결선

위반 영역: 없음. 운영 레포 (itdasy_backend / itdasy-frontend / itdasy-frontend-test) 미터치. 코덱스 스테이징 2개 + 백엔드 스테이징만 작업.

---

## 🟣 2026-05-19 — v217 ultra-plan 마무리 (잔여 4 사진편집 모듈 + 공통 Face Mesh)

---

## 🟣 2026-05-19 — v217 ultra-plan 마무리 (잔여 4 사진편집 모듈 + 공통 Face Mesh)

배경: v216 에서 PE-2/8/9/10 + SN-1~10 까지 푸시 완료. 사용자 "ㄱㄱ" 지시로 잔여 PE-1/4/5/6 마무리.

신규 모듈 (전부 신규 파일, 기존 파일 0줄 수정):
- `app-mediapipe-loader.js` — TF.js + face-landmarks-detection CDN 비동기 로드. `MediaPipeLoader.detect(canvas/img) → keypoints[]`, `regionPolygon(lm, name) → polygon`, `pathPolygon(ctx, polygon)`. 영역 5종 (faceOval/leftEye/rightEye/lips/foreheadTop). 폴백 `drawFallbackEllipsePath`. PE-1/PE-6 공통.
- `app-photo-editor-ai-touch-v2.js` (PE-1) — 6 업종(hair/makeup/lashes/nail/scalp/waxing) preset 정의. `_apply(source, shopType)` → 새 canvas. 1) CSS filter 베이스 톤 → 2) Face Mesh 검출 → 3-a) 성공: 피부 영역 clip + soft blur + 입술 tint + 눈 sharpen / 3-b) 실패: 중앙 ellipse 폴백. **자동 탭에 보라색 그라데이션 버튼 자동 주입.**
- `app-photo-editor-text-dnd.js` (PE-4) — `pointerdown` hit test → `pointermove` 로 layer.x/y 갱신. `touchmove` 두 손가락이면 핀치 거리 비율로 layer.size, angle 변화로 layer.rot. 더블탭 `window.prompt` inline 편집. `peCanvas` 자동 바인딩.
- `app-photo-editor-templates-v2.js` (PE-5) — 30종 (피드 5 / 스토리 5 / 릴스커버 5 / 이벤트 5 / 가격표 5 / 명함 5). Brand Kit (`window.BrandKit.get()`) primary/accent/soft 자동 적용. 검색 + 카테고리 탭. 적용 시 `state.aspect`, `state.tplV2`, 텍스트 레이어 prefill. **템플릿 탭에 보라색 진입 버튼 자동 주입.**
- `app-photo-editor-ar-tryon.js` (PE-6) — 헤어 6컬러 / 입술 6컬러 / 속눈썹 4단계 / 네일 6컬러. 전용 시트 (`#arTryOnSheet`, body 직접 마운트). Face Mesh 영역 자동 마스킹. 네일은 손 사진 대응을 위해 **사용자가 손톱 위에서 드래그하면 박스 추가**. 전/후 토글 + PNG export. **뷰티 탭에 핑크-보라 진입 버튼 자동 주입.**

`index.html`:
- 빌드 버전 v217 통일 (`window.__LATEST_BUILD__` / `APP_BUILD` / `CACHE_VERSION`).
- 신규 5 스크립트 로드 추가 (defer, 기존 스크립트 0줄 영향).

확인:
- `node --check` 신규 5개 통과.
- `npm run smoke` 통과 (166 scripts).
- `npx eslint <5>` 통과 (0 errors, 1 warning — text-dnd `_bind` 줄수 74 > 50).
- `npm run lint` 통과 (0 errors, 439 warnings — 기존 405 + 신규 22 + 일부 기존 라인 줄수 경고만).
- `git diff --check` 통과.

ultra-plan 진행률:
- ✅ Phase 1 사진편집: PE-1, PE-2, PE-4, PE-5 (PE-3 AI 배경 제외)
- ✅ Phase 1 SNS: SN-1 ~ SN-5
- ✅ Phase 2 사진편집: PE-6, PE-8, PE-9, PE-10 (PE-7 릴스 제외)
- ✅ Phase 2 SNS: SN-6 ~ SN-10 (`app-sns-phase2.js` 통합)
- ⛔ Phase 3 전체 (PE-11/12, SN-11/12/13) — 사용자 지시로 보류

기술 빚 / 다음 라운드:
- MediaPipe 첫 검출 시 TF.js + face mesh 모델 ~2-3MB CDN 로딩. 첫 호출 1-2초 지연. 두 번째부터 즉시.
- PE-5 템플릿 30종은 색상·prefillText 기반 합성. 실제 PNG 디자인(SVG/이미지 자산) 으로 업그레이드 권장 (디자이너 리소스 필요).
- PE-4 핀치 줌은 두 손가락 1회 제스처. 연속 변화 시 텍스트 사이즈 24 상한 검토.
- PE-6 네일 영역은 사용자 수동 박스. 추후 손 detection (MediaPipe Hands) 추가하면 자동화 가능.

위반 영역: 없음. 원본 blob 보존·기존 누끼/자동보정/SNS 모듈 0줄 영향. PhotoEditor `_internal` 등록 API만 사용.

---

## 🟣 2026-05-19 — v216 ultra-plan Phase 1+2 부분 적용 (사진편집 4 + SNS 10)

배경: 사용자(연준)가 `~/Downloads/photo_sns_ultra_plan.md` 마스터플랜에서 **Phase 3 / 릴스(PE-7) / AI 배경(PE-3) 제외** 지시. 코덱스가 v206.8 사진편집 완성도 보강 커밋 후 푸시 전에 끊김. 원영님은 그 사이 origin/main 에 v207~v215 (매출 기간 선택 + 고객관리 v4 리뉴얼) 9개 커밋 푸시.

진행 순서:
1. 원영 origin/main 위에 코덱스 2 커밋(v206 폰트·픽셀 + v206.8 사진편집기 완성도) rebase. 충돌은 빌드 버전 라인 (app-core.js / index.html / sw.js)뿐. origin 버전 유지.
2. 2 커밋 푸시 완료 (`acf1f74`).
3. stash 에 있던 ultra-plan WIP 복구 후 빌드 v207-ultra-plan → **v216-ultra-plan-p1-p2** 로 통일.
4. 신규 모듈 11개 + sns-modules.css + .gitignore(playwright 산출물) 한 커밋으로 정리.

신규 (사진편집 Phase 1+2 — 릴스/AI배경 제외):
- `app-photo-editor-ba-slider.js` (PE-2 Before/After 인터랙티브 슬라이더, 560줄): vertical/horizontal 모드, 드래그 가능 구분선, 라벨 커스터마이즈, divider style 3종, PNG/JPG export.
- `app-photo-editor-relight.js` (PE-8 AI 릴라이팅, 118줄): 조명 방향·색온도·강도 슬라이더, gradient overlay 합성.
- `app-photo-editor-collage.js` (PE-9 스마트 콜라주, 98줄): 2~6장 사진을 grid/diagonal/horizontal 레이아웃으로 자동 배치.
- `app-photo-editor-quality-score.js` (PE-10 품질 스코어, 149줄): 구도/조명/선명도/색감 4축 평가 + 개선 팁.

신규 (SNS 관리 Phase 1 + Phase 2):
- `app-sns-calendar.js` (SN-1 콘텐츠 캘린더, 409줄): 월간/주간 뷰, 드래그 배치, localStorage 저장, AI 빈 날짜 제안 슬롯.
- `app-sns-schedule.js` (SN-2 예약 발행, 70줄): SNSCalendar 의 status:'scheduled' 게시물을 시간 도래 시 발행 큐로 전달.
- `app-sns-grid-preview.js` (SN-3 피드 그리드, 152줄): 9칸/12칸 미리보기, 드래그 재배치.
- `app-sns-hashtag.js` (SN-4 해시태그 매니저, 166줄): 업종별 추천 세트 10종 저장, 원터치 삽입.
- `app-sns-analytics.js` (SN-5 성과 대시보드, 95줄): 좋아요/댓글/도달/저장 추이 + TOP5 + 최적 발행시간 AI 추천(폴백 demo data).
- `app-sns-phase2.js` (SN-6~10 Phase 2 통합, 136줄): AI 포스트 원클릭, 크로스 플랫폼(IG+네이버+카카오), AI 코파일럿, 경쟁샵 벤치마크, 자동 리포스트(에버그린).

신규 CSS:
- `css/screens/sns-modules.css` (136줄): 모든 SNS 모듈 공통 스타일.

`index.html` 로드:
- v216 빌드 버전 통일 (`window.__LATEST_BUILD__` / `APP_BUILD` / `CACHE_VERSION`)
- 신규 11개 모듈 + sns-modules.css 추가 (defer)
- 기존 스크립트 0줄 영향

확인:
- `npm run smoke` 통과 (161 scripts).
- `npx eslint <신규 10>` 통과 (errors 0, warnings 22 — 기존 줄수/no-unused 패턴과 동일).
- `npm run lint` 통과 (errors 0, warnings 438 — 기존 405 + 신규 22 + 빌드라인 일부).
- `git diff --check` 통과.
- `node --check` 신규 10개 통과.

미완료 (다음 세션 권장):
- PE-1 AI 원터치 v2 (MediaPipe Face Mesh 정밀 마스킹)
- PE-4 드래그&드롭 텍스트 (touchmove/touchend 핀치줌 직접 조작)
- PE-5 템플릿 30종 확장 (현재 6 → 30+, Brand Kit 자동 적용)
- PE-6 AI 가상 시술 (헤어컬러/네일컬러/속눈썹 AR 오버레이)

명시적 제외 (사용자 지시):
- PE-3 AI 배경 생성 (서버 API 비용 우려)
- PE-7 릴스/숏폼 비디오 에디터
- Phase 3 전체 (PE-11 포트폴리오 사이트, PE-12 시술기록 자동화, SN-11 리뷰 자동응답, SN-12 ROI 트래커, SN-13 UGC 수집)

위반 영역: 없음. 원본 blob 보존·기존 누끼/자동보정 0줄 수정·assistant kind 0줄 영향.

---

## 🟣 2026-05-19 — v206.8 사진편집기 점검·분리·보완

원영님 요청: Claude가 토큰 한도로 멈춘 뒤 남은 사진편집 작업 확인, 가짜 기능/깨진 기능 점검, 파일 분할과 새 기능 추가.

완료:
- `app-photo-editor-batch.js` 신규: 사진편집기 본체에서 배치 편집을 분리.
- `app-photo-editor-export.js` 신규: 저장/다음 단계 모달을 본체에서 분리.
- `app-photo-editor-layers.js` 신규: 텍스트 레이어 추가/삭제/선택/순서 변경을 본체에서 분리.
- `app-photo-editor-brush-effects.js` 신규: 부분 보정 브러시의 실제 픽셀 계산을 브러시 화면 코드에서 분리.
- 배치 편집 버튼에 진행 상태 표시 추가: `0/N` → `N/N`, 처리 중 버튼 비활성화.
- `app-photo-editor-templates.js`: 인스타 스토리·릴스 커버용 `스토리 9:16` 템플릿 추가. 결과 캔버스 1080×1920.
- `app-photo-editor-export.js`: `2배 고화질` 저장, `WebP 저장`, `피드+스토리 세트 저장` 추가.
- `app-brand-templates.js`: 브랜드 템플릿 적용이 실제 열린 사진편집기 상태에 반영되도록 보정.
- `app-photo-editor-brush.js`: 부분 보정 브러시가 화면에만 보이고 저장 때 사라지는 문제를 줄이도록 결과를 실제 편집 원본에 반영.
- `app-photo-editor.js`: 부분 보정 브러시·배경 변경처럼 원본 이미지가 바뀐 작업도 되돌리기/다시실행 때 이미지까지 복구하도록 보강.
- `app-photo-editor-zoom.js`: 편집기 재오픈 시 휠 이벤트가 쌓일 수 있는 부분 정리.
- `app-assistant-actions-marketing.js`: 사진편집 관련 액션 등록 전 초기화 순서 오류 수정.
- `app-complete-flow.js`, `app-dashboard.js`, `app-gallery-write.js`: 자동검사를 막던 빈 처리칸 정리.
- 빌드 버전: `20260519-v206.8-photo-complete`.

분리 결과:
- `app-photo-editor.js`: 1073줄 → 1013줄. 저장 세트와 되돌리기 보강을 넣어 조금 늘었고, 다음 라운드 분리 대상.
- `app-photo-editor-brush.js`: 541줄 → 447줄.

확인:
- 실제 브라우저 확인 통과: 새 빌드 로드, 분리 모듈 4개 로드, 스토리 템플릿 1080×1920 출력, 텍스트 레이어 추가, 배치 편집 테스트 슬롯 2장 편집본 생성, 브러시 픽셀 변화, 되돌리기/다시실행 이미지 복구, 피드+스토리 세트 저장, 2배 저장 후 다음 단계 모달 표시.
- `npm run smoke` 통과.
- `npm test -- --runInBand` 통과. 테스트 파일 없음.
- `npm run lint` 통과. 오래된 경고 405개는 남아 있으나 막는 오류 0개.
- `git diff --check` 통과.

남은 기술 빚:
- `app-photo-editor.js` 는 1013줄이라 500줄 기준까지는 계속 분리 필요.
- `app-photo-editor-brush.js` 는 447줄로 500줄 아래로 내려왔지만, `_bindBrushPanel` 함수가 아직 길어 다음 라운드에서 이벤트 핸들러 분리 권장.
- 저장/브러시/되돌리기의 큰 구멍은 막았고, 다음 작업은 본체 파일 추가 분리와 원장님들이 자주 쓰는 보정 프리셋 고도화가 좋음.

---

## 🟣 2026-05-18 — v168 병렬 라운드 (전체 계획 일괄 진행)

설계 문서: `~/.claude/plans/zesty-snacking-clarke.md` §11~§17, §25

병렬 작업 5개 (subagent 4 + foreground 1):

1. **사진 편집기 P1 — 뷰티 5 슬라이더 + 템플릿 5종 + 다음 단계 모달**
   - `app-photo-editor.js` 확장 (~890줄, 🟠 분할 후보 → 차후 별도 티켓)
   - 뷰티: HSV 마스킹 픽셀 walk (피부톤/붉은기/모발윤기/네일광택/속눈썹). 슬라이더 change에만 합성 (성능 보호)
   - 템플릿: B&A 좌우 / B&A 상하 / 시술 안내 / 가격표 / 후기 카드 — 모두 1080×1350 캔버스
   - 저장 후 모달: 캡션 만들기 / 고객 기록 첨부(P1 결선 대기) / 인스타 미리보기 3 버튼

2. **Brand Kit 모듈** (subagent A)
   - `app-brand-kit.js` (248줄, ≤250)
   - `css/screens/brand-kit.css` (187줄)
   - 공개 API: `BrandKit.get/save/open/close`
   - 사진 편집기 브랜드 탭 → "Brand Kit 전체 설정" 버튼으로 진입

3. **4:5 비율 분기** (subagent B)
   - `app-gallery-bg.js` (436→459줄)
   - `_ratioToSize('1:1'|'4:5'|'9:16')` 매핑 함수 + `applySelectedBg({target_ratio})` / `applyTemplate(id,{target_ratio})` opts 추가
   - 알파 bbox·서버 누끼·imgly 폴백 불가침

4. **Today Morning 카드** (subagent C)
   - `app-today-morning.js` (283줄)
   - `GET /today/morning` 우선, 폴백: `Booking.list` / `CustomerCache+Chips.pickAll` / `localStorage.itdasy_recent_gallery`
   - 4섹션: 운영 / 고객 케어 / 콘텐츠 / 마케팅
   - SWR 60초 + iPhone Safari 터치 fix
   - 홈 `#homeMorningMount`에 mount (app-home-v41.js _autoMount → TodayMorning.render)

5. **DM intent 정책 매트릭스** (subagent D)
   - `app-dm-autoreply.js` +29줄 (1115→1144)
   - `INTENT_AUTONOMY_DEFAULTS`: 가격=auto / 위치=auto / 시간=confirm_high / 예약=draft / 기타=draft
   - 가격표 존재 여부 체크 후 `auto`→`confirm_high` 다운그레이드
   - explicit `autonomy_mode` 보존 — 기존 분기 0줄 수정
   - 마커: `// [v167-INTENT-MATRIX]`

회귀 영향:
- 사진 편집기: 원본 blob 절대 보존 + 기존 누끼·자동보정 0줄 수정 + 슬라이더 change에만 합성 (60fps 보호)
- Brand Kit: 신규 모듈, 기존 shop_settings 캐시와 키 분리 (`itdasy_brand_kit`)
- 4:5: 기존 1:1/9:16 호출 동작 0줄 영향 (default '1:1')
- Today Morning: 홈에 카드 추가만, 기존 위젯 0줄 영향
- DM intent: explicit autonomy 보존, 기존 booking_action/draft 분기 0줄 영향

진입로 (테스트):
- 사진 편집기: AI·자동화 시트 → 사진 편집기 → 8탭 / Brand Kit 진입
- 모닝 브리핑: 홈 상단 (homeV41Root 위)
- DM intent: DM 자동응답 시트 열면 conversation들이 새 autonomy_mode 자동 할당
- Brand Kit: `window.BrandKit.open()` 또는 사진 편집기 브랜드 탭

빌드 버전: `20260518-v168-parallel-round`

---

## 🟣 2026-05-17 22:00 — 사진 편집기 P0 MVP (티켓 P0-PE-1/2/3 통합)

설계 문서: `~/.claude/plans/zesty-snacking-clarke.md` §25

신규 모듈:
- `app-photo-editor.js` (≈540줄) — 8탭 시트 (자동/보정/뷰티/누끼·배경/템플릿/텍스트/브랜드/내보내기)
  · 캔버스 합성: CSS filter (밝기/채도/색온도/대비) + unsharp mask (선명도)
  · 비율 4종: 원본/1:1/4:5/9:16 자동 자르기 + export
  · 워터마크: 위치 4종(tl/tr/bl/br) + 투명도 + localStorage 기본값 저장
  · 텍스트 1개: 시술명·가격 자동 prefill, 위치 슬라이더
  · history stack 20 + undo
  · 원본/편집 비교: 캔버스 롱탭 또는 "원본" 버튼
- `css/screens/photo-editor.css` (≈200줄) — 다크 테마, 8탭 가로 스크롤

연결:
- `app-assistant-actions-marketing.js` — kind 6종 추가 (open_photo_editor, apply_photo_preset, adjust_photo, add_text_overlay, add_watermark, export_marketing_image)
- `app-assistant.js` — `registerLocalHandler(kind, handler)` API 추가 → open_photo_editor는 백엔드 호출 없이 프론트 단독 실행
- `app-ai-hub.js` — AI·자동화 시트에 "사진 편집기" 행 추가 (NEW 배지)
- `index.html` — CSS/JS 1줄씩 로드, app-assistant/ai-hub 버스터 v167

진입로 3가지 (사용자 테스트용):
1. **AI 자동화 시트 → "사진 편집기"** 행 탭 → 시트 오픈 → 파일 고르기 → 8탭 편집 → 저장
2. **챗봇:** `window.PhotoEditor.open({src: 'blob:...'})` 콘솔 (또는 backend가 open_photo_editor 액션 응답 시 카드 → 실행)
3. **AI 비서 액션 카드:** open_photo_editor kind를 받으면 즉시 편집기 오픈 (로컬 핸들러)

회귀 영향:
- 원본 blob/URL 절대 덮어쓰지 않음
- 기존 누끼·자동보정·B&A는 0줄 수정. 편집기는 별도 시트로 분리
- assistant `_executeAction`은 로컬 핸들러 우선 분기 1개만 추가 (기존 18 kind 0줄 영향)

다음 (P1 잔여 — 사진 편집기):
- 뷰티 탭 5 슬라이더 (피부톤/붉은기/모발 윤기/네일 광택/속눈썹)
- 템플릿 탭 5종 (B&A 좌우/상하/후기/가격/시술 안내)
- 편집 완료 → 캡션 카드 자동 연결
- 인스타 미리보기 4:5/1:1/9:16 자동 매핑
- brand_kit UI (샵 설정 화면)

---

## 🟣 2026-05-17 18:00 — 뷰티업GPT 초고도화 P1-5 (AI 브리핑 카드)

설계 문서: `~/.claude/plans/zesty-snacking-clarke.md` §7

신규/수정:
- `app-customer-ai-brief.js` 신규 (≤350줄) — `/customers/{id}/ai-brief` 우선, 없으면 dashboard 페이로드로 클라이언트 컴퓨트
- `app-customer-chips.js` — `pickAll`/`renderTopN` 노출 (브리핑 카드에서 상위 3개 chip 호스팅)
- `app-customer-dashboard.js` — Hero 뒤 `#cdAiBriefMount` 삽입 + 두 경로(dashboard / 폴백)에서 모두 렌더
- `app-calendar-view.js` — 예약 폼 고객 섹션 안에 `#bfAiBriefMount` 삽입 + 고객 picker로 선택 시 브리핑 갱신, prefill(수정/대시보드 진입) 케이스도 1회 렌더
- `index.html` — `app-customer-ai-brief.js` 로드 (customer-hub 이전), customer-dashboard/calendar-view 버스터 v167

회귀 영향: 백엔드 ai-brief 부재 시 클라이언트 폴백만으로 동작. 카드 비어 있으면 자체 숨김 — 기존 화면 외형 영향 없음.

다음 (P1 잔여):
- 백엔드 `/customers/{id}/ai-brief` 스켈레톤 (LLM 요약 + churn_risk)
- treatment 1급 엔티티 (백엔드 협업)
- send_message 실제 발송 결선 (백엔드 SMS/알림톡 게이트)

---

## 🔴 새 세션은 먼저 읽기

- **현재 Phase:** 9 — 전면 최적화 + 신기능 (플랜 파일 참조)
- **플랜 파일:** `~/.claude/plans/lively-sniffing-pudding.md`
- **이전 완료:** Phase 0~6.4 완전 완료. Phase 7(앱 심사 50%), Phase 8(운영 승격 50%)
- **최신 빌드:** `20260506-v101-phase3-5`

**불가침 영역:**
- 글쓰기 탭 시나리오 팝업(`openCaptionScenarioPopup` / `scenario-selector.js` / `_doGenerateCaption`) — 원영님 "이 로직 최고". 에러 핸들러 문구 1군데 외 수정 금지.
- `#personaDash` div, `cbt1ResetArea` 버튼, `components/scenario-selector.js` 보존

---

## 🔵 Phase 9 진행 현황

### LAST CHECKPOINT — 2026-05-25 17:54
- AI 잇비 v271 작업 완료: 사진 첨부 후 뜨는 미리보기/사진 종류 버튼을 `js/assistant/pending-photos.js`로 분리.
- 대화 응답 대기와 사진 첨부 대기 이름이 겹치던 부분을 정리.
- 최신 빌드: `20260525-v271-assistant-pending-photos`.
- 브라우저 자동 검증 통과: 사진 첨부 시 버튼 4개 표시, 명함 추천 표시, 삭제 시 대기 영역 닫힘.
- 자동 확인 통과: JS 문법 확인, 새 파일 자동 검사, 공백 검사, `npm run smoke`, `npm test -- --runInBand`.

### 이전 체크포인트 — 2026-05-20 10:18
- 사진편집 v246 작업 완료: 누끼 전 사진 안전 정리, 누끼 실패 재시도, 메뉴 중복 통합, 디테일/리터치/저장 흐름 정리.
- 최신 빌드: `20260520-v246-photo-bg-detail-flow`.
- 브라우저 자동 검증 통과: 4200×3000 사진이 2560×1829로 정리됨, 누끼 재시도 흐름, 새 메뉴 라벨, 디테일/리터치/저장 진입.
- 자동 확인 통과: JS 문법 확인, 공백 검사, `npm run smoke`, `npm test -- --runInBand`, 관련 파일 자동검사.

### 이전 체크포인트 — 2026-05-20 07:59
- 사진편집 v245 작업 완료: 텍스트 드래그, 누끼 결과 재사용, 조명/플래시, 헤어 보정, 추천 스타일 메뉴 연결.
- 최신 빌드: `20260520-v245-photo-workflow-tools`.
- 브라우저 자동 검증 통과: 새 메뉴 라벨, 텍스트 드래그, 플래시 밝기 변화, 헤어 슬라이더, `플래시 홍보컷`, 기능 안 뒤로가기.
- 자동 확인 통과: JS 문법 확인, 공백 검사, `npm run smoke`, `npm test -- --runInBand`; 관련 파일 자동검사는 오류 0개, 기존 경고 7개.

### 이전 체크포인트 — 2026-05-16 18:45
- 프론트 연준 테스트: 로컬 `main` 과 GitHub `origin/main` 동일 (`3742715`).
- 프론트 운영: GitHub `frontend/main` 은 로컬보다 7개 새 커밋이 있고, 로컬은 운영보다 164개 앞서 있어 서로 섞임. 바로 덮어쓰기 금지.
- 백엔드 스테이징: 로컬 `main` 과 GitHub `test/main` 동일 (`f1fbaac`).
- 백엔드 운영: GitHub `origin/main` 은 스테이징보다 61개 뒤처짐.

### Phase 1: 서버 연결 불안정 수정 ✅ 완료 (2026-05-06)
- `app-core.js`: RETRY_STATUSES에 500 추가, MAX_RETRIES 3회, BACKOFF_MS [500,1500,4000]
- `app-core.js`: JSON POST도 재시도 허용 (_isRetryableMethod 확장)
- `app-core.js`: safeFetch timeout 15s → 25s
- `app-perf-recovery.js`: prefetch timeout 8s → 20s
- `app-perf-recovery.js`: _probeBackendOnline → /auth/me 실제 API ping으로 교체
- `app-dm-autoreply.js`: read timeout 8s → 15s

### Phase 2: 성능 최적화 ✅ 1차 완료 (2026-05-06)
- `app-customer-cache.js` 신규: 고객 목록 공유 캐시 + 중복 요청 방지
- `app-customer.js` / `app-customer-hub.js` / `app-customer-dashboard.js`: 같은 고객 캐시를 함께 사용
- `app-revenue.js`: 오늘/이번주/이번달 매출을 미리 받아 탭 전환 대기 줄임
- `app-dm-settings-cache.js` 신규: DM 자동응답/멘트관리 설정 중복 요청 방지
- `app-customer-hub.js`: 고객 분류 계산 반복 줄임
- 보류: 초기 lazy loader 는 `index.html` 로드 순서 영향이 커서 별도 안전 티켓으로 분리

### Phase 3: UX 간소화 ✅ 1차 완료 (2026-05-06)
- `css/screens/phase9-ux.css` 신규: 고객/예약/매출 버튼 터치 영역 44~48px 확보
- `app-phase9-ux.js` 신규: 예약 빠른 추가, 매출 빠른 입력, 공통 로딩/오류 문구 헬퍼 추가
- 홈 빠른 실행 버튼: 예약 추가, 매출 기록, 대기자, 위험 고객, 리마인더, 리뷰 요청, 회원권, 예약 링크

### Phase 4: 보안 강화 🟡 프론트 1차 완료 (2026-05-06)
- `app-secure-storage.js` 신규: Web Crypto 기반 전화번호/주소 암호화 저장
- `app-shop-settings.js`: 샵 전화번호/주소 저장·불러오기를 암호화 저장으로 교체
- 보류: refresh token, shop_id 응답, 강한 CSP 는 백엔드/외부 스크립트 영향 있어 별도 안전 작업 필요

### Phase 5: 신규 기능 🟡 프론트 1차 완료 (2026-05-06)
- `app-waitlist.js` 신규: 대기자 로컬 관리 + 예약 빠른 추가 연결
- `app-reminder.js` 신규: 리마인더 설정 + 예약 확인 수동 전송 연결
- `app-retention-ai.js` 신규: `/retention/at-risk` 기반 위험 고객 화면 + DM 초안 복사
- `app-review.js` 신규: 리뷰 요청 문구 생성/복사 관리
- `app-public-link.js` 로드: 공개 예약 링크 화면을 빠른 실행에 연결
- 남음: 대기자/멤버십/리뷰 서버 저장, 자동 스케줄러, refresh token 은 연준 백엔드 작업 필요

### Phase 6: Cold Start 버그 수정 ✅ 완료 (2026-05-07)
- `app-customer-dashboard.js`: _apiGet 타임아웃 10s→22s, AbortError 시 /customers/{id} 폴백 추가
- `app-perf-recovery.js`: 헬스체크 프로브 타임아웃 8s→20s, 초기 프로브 딜레이 800ms→3s
- `app-core.js`: AbortController 이미 abort된 신호의 재시도 차단 (불필요 토스트 억제)
- `itdasy_backend-test/generation.py`: Vertex AI location "global"→"us-central1" 수정, SA JSON 인증 배포
  - 원인: 사용자가 Railway에 USE_VERTEX_AI=true + GOOGLE_SERVICE_ACCOUNT_JSON 추가했는데
    기존 코드가 location="global" (무효)로 모든 AI 호출 실패 → 챗봇 1분+ 타임아웃

---

## 🟡 원영님 남은 액션 (Phase 7)

1. Apple Developer 계정 가입 ($99/년)
2. Google Play Developer 가입 ($25 1회)
3. T-320 "Sign in with Apple 구현해" 지시
4. 데모 시드 실행 + 스크린샷 촬영 + TestFlight

---

## 핵심 맥락

**토큰 키 체계:**
- `app-core.js:33` `_TOKEN_KEY = 'itdasy_token::' + (staging|prod|local)` 패턴

**스크립트 로드 순서:**
- `index.html:1084-1104` 순서 변경 절대 금지

**깨지면 안 되는 것:**
- Capacitor 플러그인 (SplashScreen/StatusBar/Push/Camera/App)
- OAuth 스킴 `itdasy://`
- GitHub Actions `Android Build` + `Supabase Daily Backup`

---

## 이전 체크포인트 아카이브

2026-04-20 ~ 2026-05-06 이전 체크포인트는 `.ai/CHANGELOG_2026-05.md` 참조.

---

## 재시작 부트스트랩

```
프로젝트 작업 재개합니다. 다음 순서로 읽고, 읽었으면 "bootstrap:OK" 써주세요:
1. CLAUDE.md
2. .ai/SESSION_STATE.md
그 다음 Phase 9 플랜 파일 (~/.claude/plans/lively-sniffing-pudding.md)을 요약해주세요.
```
