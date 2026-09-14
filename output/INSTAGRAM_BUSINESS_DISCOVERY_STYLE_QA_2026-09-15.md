# Instagram Business Discovery 스타일 QA — 2026-09-15

## 결론

- 인스타 웹 브라우저 검색은 무로그인 상태에서 로그인 화면으로 막힘을 확인했다.
- 앱이 실제로 쓸 수 있는 공식 경로는 Meta Business Discovery다.
- 다른 공개 Professional 계정 username을 넣으면 최근 게시물, 캡션, 이미지 URL, 게시물 링크, 시간, 좋아요/댓글 수를 읽는 백엔드 통로를 추가했다.
- 외부 계정 분석은 기본적으로 저장하지 않는다. 남의 스타일이 원장 스타일로 자동 오염되지 않게 프론트 미리보기 경로는 `save:false`로 고정했다.

## 구현

### 백엔드

- `GET /instagram/business-discovery?username=<계정>&limit=<1~24>`
- 연결된 원장 인스타 토큰이 없으면 `connected:false`.
- 대상 계정이 개인/비공개/권한 부족이면 `available:false`로 내려서 빈 학습값으로 섞이지 않게 함.
- Meta 오류 메시지와 토큰 원문은 응답에 싣지 않음.

### 프론트

- `window.SocialStyleSource.fetchPublicBusinessMedia(username, opts)`
- `window.SocialStyleSource.previewProfile(username, opts)`
- `InstagramTextStyle.build(mediaList, { save:false })` 지원 추가.
- 외부 계정 QA 경로는 `IgPostAnalysis.collect()`를 부르지 않아 서버의 내 스타일 저장소에 자동 저장하지 않음.

## 검증

- 브라우저 직접 확인: Instagram 탐색 URL은 로그인 화면으로 리다이렉트, TikTok 검색은 오류 화면, Threads 검색은 결과 접근 제한.
- 프론트 관련 테스트: 109개 통과.
- 백엔드 관련 테스트: 30개 통과.
- 프론트 자동 검사: 에러 0개, 기존 경고 203개.
- 전체 프론트 테스트: 3,144개 통과.
- 앱 파일 목록 검사: 통과.
- 작업실 흐름: 9/9 통과.
- 뒤로가기 오버레이 검사: 통과.

## 남은 것

- 백엔드 운영 배포는 이 레포 규칙상 원영님 YES 필요.
- 배포 뒤 QA 계정이 인스타에 연결된 상태에서 실제 username 3~5개를 넣어 `available:true` 실호출 확인 필요.
