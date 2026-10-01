# 자가검토

- 사용자 운영 반영 승인 확인. 원본51dd998 변경 전 clean.
- 운영 데이터 변경 없는 선별 승격. 테스트 API/native/package/결제 설정 복사 제외.
- 기존 index 스크립트 순서 유지, URL 복구 스크립트만 fallback 앞에 추가. risk:integration 표시 예정.
- 인증 표는 서버 교환으로만 생성. 토큰/키/비밀번호를 코드·로그·커밋에 넣지 않음.
- 기존 저장소·딥링크 스킴 유지. standalone bridge의 prod/staging 불일치만 수정.
- 전체 검사 및 독립 최종 diff 검토는 구현 후 결과를 기록한다. 실제 기기·Meta 승인과 CI 결과는 별도 판단.
