# 자가검토

- 사용자 운영 반영 승인 확인. 원본51dd998 변경 전 clean.
- 운영 데이터 변경 없는 선별 승격. 테스트 API/native/package/결제 설정 복사 제외.
- 기존 index 스크립트 순서 유지, URL 복구 스크립트만 fallback 앞에 추가. risk:integration 표시 예정.
- 인증 표는 서버 교환으로만 생성. 토큰/키/비밀번호를 코드·로그·커밋에 넣지 않음.
- 기존 저장소·딥링크 스킴 유지. standalone bridge의 prod/staging 불일치만 수정.
- 전체 검사 및 독립 최종 diff 검토는 구현 후 결과를 기록한다. 실제 기기·Meta 승인과 CI 결과는 별도 판단.

## 최종 검증

- 전체 Jest: 230 suites / 3357 PASS / 2 skip. lint 0 errors / 178 기존 경고; loader 105 scripts / 204 lazy, overlay 73개 누락0.
- 독립 리뷰 차단: 늦은 사진 URL 성공/실패가 재사용 img를 덮는 문제. src/srcset/currentSrc 확인 및 행동 회귀3개로 수정, 재검토 PASS.
- production bridge 회귀3개: prod만 저장, 테스트 세션 보존, 실패 및 URL직접토큰 차단.
- 보존 manifest 대상 파일 diff0. 런타임 서버 health200/schemaok 및 안전 복귀 응답6/6, 신규 서버5분 ERROR/5xx0.
- Meta 실제 운영 신규승인은 Invalid redirect_uri 거부. Facebook 관리자 로그인 필요. 기존 최신연결 Meta200, 오래된연결401. 실기기 복귀는 미확인.
