
# TODO — 다음 세션에서 해야 할 것 (2026-04-18 심사 결과)

## 즉시 (출시 전 필수)

### CRITICAL
- [x] **회원탈퇴 CASCADE 삭제** — 15개 테이블 즉시 삭제 완료 (2026-04-18)
- [x] **개인정보처리방침 완성** — 수집항목(이메일,IP,얼굴좌표 포함), 제3자 제공(Gemini/Replicate/Remove.bg/Meta/Resend/Sentry/Supabase/Railway), 보유기간, 파기절차 반영 (2026-04-18)
- [x] **Alembic 도입** — baseline + 운영 DB stamp 완료 (2026-04-18)
- [ ] **토스페이먼츠 실결제 연동** — 보류 (별도 큰 작업)

### HIGH
- [x] **`/admin/reset` user_id==1 하드코딩 제거** — Depends(get_admin_user)로 교체 완료
- [x] **FERNET_KEY를 env_validator 필수 목록에 추가** — 완료
- [x] **동의 로그 파일→DB 전환** — `UserConsent` 테이블 사용(IP/UA 포함)
- [x] **OpenAPI 문서 프로덕션 비활성화** — ENVIRONMENT=production 감지 시 차단
- [x] **Gemini 호출 async 전환** — generation/caption_generator/caption/instagram/image 모두 async 전환
- [x] **프론트 접근성(a11y)** — `<img>` alt, 주요 nav `aria-label`, `role="navigation"` 추가

### MEDIUM
- [ ] **Rate Limiting Redis 전환** — 현재 메모리 기반 (재시작 시 리셋)
- [ ] **리텐션 장치** — 푸시 알림(FCM), 이메일 리마인더
- [ ] **바이럴 장치** — 추천 코드 보상, 공유 기능
- [ ] **테스트 코드 작성** — 회원탈퇴/결제/토큰갱신 크리티컬 경로
- [ ] **무료 플랜 API 비용 시뮬레이션** — 사용자 1만명 시 역마진 계산
