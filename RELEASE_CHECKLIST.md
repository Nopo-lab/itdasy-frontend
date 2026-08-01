# 릴리즈 승인 체크리스트

> **출시 버튼 누르기 직전** 한 번에 훑는 목록. 위에서부터 순서대로.
> 하나라도 ☐ 면 출시하지 않는다.

---

## 게이트 A — 스모크 7항목 (5~10분)

카오스 QA 보다 **먼저** 통과해야 한다. 여기서 깨지면 나머지는 볼 의미가 없다.

- [ ] 앱 실행 — 콘솔 에러 0
- [ ] 로그인
- [ ] 사진 업로드
- [ ] AI 생성 (캡션)
- [ ] 저장 — **사진첩에 실제로 들어갔는지 눈으로 확인** (네이티브에서 거짓 성공 이력 있음)
- [ ] 로그아웃
- [ ] 재로그인

> 웹(Pages)과 **네이티브 빌드 각각** 돌린다. 저장·딥링크는 네이티브에서만 깨진다.

---

## 게이트 B — 연준님 수동 작업 (앱 밖)

### 스토어
- [ ] App Store Connect: `itdasy_membership_monthly_6900` (₩6,900/월, 7일 무료체험) 등록·심사제출
- [ ] Play Console: 같은 상품 등록. **패키지명 `com.y2do.itdasy`** 확인
- [ ] Cloud Run env: `APPLE_IAP_SHARED_SECRET` · `APPLE_APP_BUNDLE_ID` · `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` · `GOOGLE_PLAY_PACKAGE_NAME`
- [ ] 실기기 샌드박스 결제 1회 성공
- [ ] Xcode 에서 `PrivacyInfo.xcprivacy` 를 프로젝트에 추가 (지금 pbxproj 미등록 → 번들 안 됨)
- [ ] 스토어 스크린샷 최신 — `docs/submission/shots/` 재캡처 (IAP 배선 후)
- [ ] 개인정보처리방침 URL 접근 확인
- [ ] 데모 계정 `review@itdasy.com` 운영 DB 시드 + **비밀번호 로테이션**

### Meta
- [ ] `.ai/META_INSTAGRAM_CONSOLE_CHECKLIST.md` 10건 점검
- [ ] **Verify Token 재발급** (문서에 평문 노출됨)
- [ ] consent 화면 포함 스크린캐스트 재녹화
- [ ] `INSTAGRAM_FULL_SCOPE=1` 유지 확인 (심사 중엔 4개 전부 요청해야 함)

### 인프라·보안
- [ ] **운영** Cloud Run `min-instances 0 → 1` (콜드스타트 51초 이력)
- [ ] 운영 DB 비밀번호 교체 (2026-04-19 노출 이력)
- [ ] **시크릿 재발급 3종**: Replicate 토큰 · Redis 비밀번호 · Instagram Verify Token
- [ ] `REDIS_URL` 을 Cloud Run 에서 닿는 주소로 (현재 옛 Railway 주소 → rate limit 이 메모리 폴백)
- [ ] GitHub org 2FA 필수화 + `main` 브랜치 보호
- [ ] GCP 예산 알림 (일 2만원 권고)
- [ ] Firebase 등록 → `google-services.json` · `GoogleService-Info.plist` (푸시 현재 미작동)

### 운영 준비
- [ ] `DISCORD_ALERT_WEBHOOK` 설정됨 — ✅ **2026-08-01 완료, HTTP 204 확인**
- [ ] `ITDASY_DAILY_COST_CAP_KRW=50000` 설정
- [ ] `ITDASY_STAGING_BYPASS_ALL` 이 **운영에 없는지** 확인 (있으면 한도·과금 전부 무력)
- [ ] `BYPASS_PLAN_LIMITS_EMAILS` 운영은 비우기
- [ ] admin 계정으로 **🚀 출시 첫날** 화면 열리는지 확인

---

## 게이트 C — 빌드·배포

- [ ] 버전 코드/버전명 증가 (현재 `versionCode 1` / `versionName "1.0"`)
- [ ] Git Tag + Release Note
- [ ] `?v=` 캐시버스터 자동 반영 확인 (deploy.yml 이 처리 — 새 파일은 수동 1회 필요)
- [ ] Debug 흔적 제거 — `?debug=1` · 콘솔 로그 · 테스트 계정
- [ ] 앱 아이콘 / 스플래시
- [ ] `RELEASE_AUDIT_2026-07-31.md` 의 P0 = 0건

---

## 게이트 D — 카오스 QA (스모크 통과 후)

- [ ] 저장·발행 버튼 **100연타** → 중복 생성 0
- [ ] 몽키 플로우: 로그인→사진선택→취소→재선택→뒤로→앞으로→로그아웃→재로그인
- [ ] AI 생성 중 백그라운드 전환 후 복귀
- [ ] 사진 20장 / 100MB+ 업로드 — OOM·행 없음
- [ ] 오프라인 전환 → 복귀
- [ ] PC(≥768px) 오버레이 사이드바 잘림 없음
- [ ] **Restore Drill** — 백업이 실제로 복구되는지 리허설 (아직 미실시)

---

## 게이트 E — 출시 후 30분

- [ ] admin 🚀 출시 첫날 새로고침 (5~10분 간격)
- [ ] 첫 가입·첫 캡션·첫 매출이 실제로 들어오는지
- [ ] Discord 알림 채널 조용한지
- [ ] Sentry 새 이슈 없는지
- [ ] 원가가 예상 범위인지 (잇비 ~7.5원/마디)

장애 시 → [RUNBOOK.md](RUNBOOK.md)

---

_최종 갱신: 2026-08-01_
