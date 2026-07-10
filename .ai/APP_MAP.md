📇 **잇데이 앱 = 방대함** (프론트 ~250파일 + 백엔드 라우터 60·서비스 70·모델 56). "이 기능 없나?" 추측하지 말고 **`.ai/APP_FEATURE_INDEX.md` 먼저 확인.** 기능 파일 바꾸면 인덱스도 같이 갱신.

**이미 있는 것(신기능이라 착각 금지):** DM 자동응답 엔진·원장 confirm 큐(`dm_*`), 네이버 톡톡(실전송)·카카오 알림톡(Aligo 실발송)·OAuth 로그인 3종, 단골/이탈 리텐션(`retention.py`), 리터치 DM 초안(`retouch.py`), 리뷰 요청(`customer_reviews.py`), 인스타 인사이트, 자동화 규칙(`automation.py`), 시술추천·회원권·재고·영수증/명함/가격표 OCR, 잇비 챗봇(`assistant.py` 6964줄).

**안 되는 것:** 인스타 게시물 댓글 답글 자동화 ❌(manage_comments 스코프 제거), 네이버 리뷰 답글 ❌(공식 API 없음).
**심사/스텁 대기:** 인스타 발행(content_publish 심사)·인스타 DM봇(Meta Advanced 심사 후 on)·네이버 예약 동기화(스텁).

**어디 볼지:** 도메인→파일 매핑표 + 채널/DM 실제 구현 상태표는 `.ai/APP_FEATURE_INDEX.md` 상단에 있음.
