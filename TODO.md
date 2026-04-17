
# TODO — 다음 세션에서 해야 할 것 (2026-04-18 심사 결과)

## 즉시 (출시 전 필수)

### CRITICAL
- [ ] **회원탈퇴 CASCADE 삭제** — 현재 2개 테이블만 삭제, 12개 잔존. Apple/Google 즉시 리젝 사유
- [ ] **개인정보처리방침 완성** — 수집항목(이메일,IP,얼굴좌표), 제3자 제공(Gemini,Replicate,Remove.bg), 보유기간, 파기절차 추가
- [ ] **Alembic 도입** — create_all 기반 → 정식 마이그레이션. 스키마 변경 시 데이터 유실 방지
- [ ] **토스페이먼츠 실결제 연동** — 빌링키 발급 → 정기결제 → 웹훅 검증. 현재 매출 0원

### HIGH
- [ ] **`/admin/reset` user_id==1 하드코딩 제거** — get_admin_user로 교체
- [ ] **FERNET_KEY를 env_validator 필수 목록에 추가**
- [ ] **동의 로그 파일→DB 전환** — privacy_consent.log → UserConsent 테이블 사용
- [ ] **OpenAPI 문서 프로덕션 비활성화** — `/docs`, `/openapi.json` 차단
- [ ] **Gemini 호출 async 전환** — 동기 blocking → async. 동시 10명 이상 처리
- [ ] **프론트 접근성(a11y)** — aria-label, alt 속성 추가

### MEDIUM
- [ ] **Rate Limiting Redis 전환** — 현재 메모리 기반 (재시작 시 리셋)
- [ ] **리텐션 장치** — 푸시 알림(FCM), 이메일 리마인더
- [ ] **바이럴 장치** — 추천 코드 보상, 공유 기능
- [ ] **테스트 코드 작성** — 회원탈퇴/결제/토큰갱신 크리티컬 경로
- [ ] **무료 플랜 API 비용 시뮬레이션** — 사용자 1만명 시 역마진 계산
