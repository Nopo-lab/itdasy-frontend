# CHANGELOG — 2026-04-20~04-21 마라톤 세션

연준 주도 Phase 5 완성: 음성/자동화/AI 비서/알림/리포트/이전 도우미 전반 출시.

---

## 📂 파일 변경 추적 (신설 · 수정 · 삭제)

### 🔴 신설 파일 (20)

**프론트 (`itdasy-frontend-test-yeunjun`)**
| 파일 | 라인 | 목적 |
|---|---|---|
| `app-customer.js` | 384 | 고객 CRM + 오버레이 시트 + Customer.pick() |
| `app-booking.js` | 436 | 예약 달력 (주간 뷰·중복 감지) |
| `app-revenue.js` | 455 | 매출 3탭 + SVG 차트 + 인센티브 카드 |
| `app-inventory.js` | 317 | 소모품 재고 + 부족 알림 |
| `app-nps.js` | 279 | NPS 입력 + 통계 카드 |
| `app-naver-reviews.js` | 254 | 네이버 리뷰 수동 저장 |
| `app-video.js` | 430 | 비포/애프터 MP4 (자막·전환 4종·시퀀스·AI 문구·인스타 공유) |
| `app-import.js` | 562 | 파일/사진OCR/카톡복붙 3탭 임포트 |
| `app-insights.js` | 207 | AI 인사이트 통합 대시보드 |
| `app-dashboard.js` | 551 | 사장님 메인 대시보드 |
| `app-customer-dashboard.js` | 306 | 고객 상세 대시보드 |
| `app-voice.js` | 365 | 음성 빠른 기록 (Web Speech + Gemini) |
| `app-photo-match.js` | 162 | EXIF → 고객 자동 매핑 |
| `app-complete-flow.js` | 220 | 시술 완료 번들 |
| `app-auto-ba.js` | 130 | 비포/애프터 자동 감지 |
| `app-today-brief.js` | 105 | 오늘의 브리핑 |
| `app-birthday.js` | 165 | 생일 자동 감지 |
| `app-notifications.js` | 166 | In-app 알림 벨·폴링 |
| `app-assistant.js` | 144 | AI 비서 챗봇 |
| `app-migration-wizard.js` | 135 | 이전 도우미 온보딩 |
| `app-report.js` | 163 | 월간 자동 리포트 |
| `app-debug-panel.js` | 179 | 인앱 진단 팝업 (Salvage 복구) |
| `Roadmap_yeonjun.md` | 300+ | 연준 전용 로드맵 |
| `TECH_DEBT.md` | 60+ | 모놀리스 분할 계획 |

**백엔드 (`itdasy_backend/backend`)**
| 파일 | 라인 | 목적 |
|---|---|---|
| `routers/customers.py` | 278 | CRM CRUD + `/{id}/dashboard` 집계 |
| `routers/bookings.py` | 128 | 예약 + 중복 감지 409 |
| `routers/revenue.py` | 107 | 매출 + `/forecast` |
| `routers/inventory.py` | 107 | 재고 + `/adjust` |
| `routers/nps.py` | 90 | NPS + `/stats` |
| `routers/naver_reviews.py` | 84 | 네이버 리뷰 수동 |
| `routers/video.py` | 229 | `/capability`·`/beforeafter`·`/sequence`·`/caption-suggest` |
| `routers/imports.py` | 164 | CSV/XLSX 임포트 + Free 50명 가드 |
| `routers/retention.py` | 24 | `/retention/at-risk` |
| `routers/coupons.py` | 18 | `/coupons/suggest` |
| `routers/voice.py` | 129 | `/voice/parse-audio/text/apply` |
| `routers/today.py` | 107 | `/today/brief` |
| `routers/birthdays.py` | 82 | `/birthdays/upcoming` |
| `routers/smart_import.py` | 110 | `/imports/smart/image/text/commit` |
| `routers/notifications.py` | 69 | `/notifications/pending/read/read-all` |
| `routers/assistant.py` | 137 | `/assistant/ask` |
| `routers/reports.py` | 110 | `/reports/monthly` |
| `services/video.py` | 207 | ffmpeg xfade + drawtext 한글 자막 |
| `services/importer.py` | 247 | CSV/XLSX 파서 + 한국어 컬럼 자동 매핑 |
| `services/retention_predictor.py` | 108 | 이탈 임박 계산 |
| `services/revenue_forecaster.py` | 78 | 주간 매출 예측 |
| `services/dynamic_coupon.py` | 82 | 슬로우 데이 쿠폰 |
| `services/voice_parser.py` | 118 | Gemini Audio 파싱 |
| `services/smart_import.py` | 152 | Gemini Vision OCR + 텍스트 정규식 |
| `services/reminder_scheduler.py` | 66 | 5분 cron 예약 리마인드 |
| `schemas/customer.py`·`booking.py`·`revenue.py`·`inventory.py`·`naver_review.py`·`nps.py`·`import_job.py` | 32~48 각 | 7개 Pydantic 스키마 |
| `Dockerfile` | 37 | ffmpeg + fonts-nanum apt 설치 |
| `nixpacks.toml` | 8 | 백업용 Nixpacks 설정 |

**홍보 사이트 (`itdasy-promo`)**
| 파일 | 변경 | 목적 |
|---|---|---|
| `index.html` | 법인명 통일·JSON-LD·hero 법인 배너 | Meta BV 재제출 |

### 🟡 수정 파일 (10+)

**프론트**
- `app-core.js` — SW 등록 블록 교체 + `APP_BUILD` 버전 배지 + 상대경로
- `app-gallery-finish.js` — 고객 자동 매핑 훅 + 슬롯 카드 `👤` 버튼 + `customer_id` FormData
- `app-plan.js` — `window.getCurrentPlan` / `isPaidPlan` 외부 API
- `app-support.js` — 7일 캐시 + optimistic render (Salvage)
- `sw.js` — 상대경로 + API 캐시 제거
- `index.html` — 버전 배지·빌드 체크·script 태그·설정시트 대시보드 단일 진입
- `shared/schemas.json` — 52 엔드포인트·16 모델
- `capacitor-templates/ios-info-plist-snippets.plist` — `NSMicrophoneUsageDescription`·`NSSpeechRecognitionUsageDescription`
- `capacitor-templates/android-manifest-snippets.xml` — `RECORD_AUDIO`·`hardware.microphone`

**백엔드**
- `main.py` — 16개 신규 라우터 등록 + `apscheduler` 스케줄러 startup
- `models.py` — `Customer`·`Booking`·`RevenueRecord`·`InventoryItem`·`NpsRecord`·`NaverReview`·`ImportJob`·`NotificationItem` 8개 ORM
- `schemas/__init__.py` — 모든 신규 스키마 노출
- `routers/caption.py` — `customer_segment` 파라미터 + SEGMENT_HINTS
- `schemas/caption.py` — `customer_segment` 필드
- `schemas/shop.py` — `MasterPersonaOut`·`OnboardingCaptionSave` 이관 수복
- `requirements.txt` — `openpyxl`·`apscheduler` 추가

### ⚫ 삭제·이관

- 원영 초기커밋으로 사라졌던 `app-debug-panel.js` → 복구
- `itdasy-beauty-app-main/backend/` 잘못된 위치 BE 파일 → 올바른 레포(`itdasy_backend/`)로 이관 (상위 monorepo 커밋은 reset)

---

## 🎀 주요 기능 목록 (사용자 관점)

### 기본 CRM 5종 (Phase 2)
👥 고객 / 📅 예약 / 💰 매출 / 📦 재고 / 💳 IAP 한도 가드

### 차별화 5종 (Phase 3)
⭐ 네이버 리뷰 / 📊 NPS + 통계 / 🎬 비포/애프터 영상 (자막·전환·시퀀스·AI) / 🧮 시술 인센티브 / 📥 CSV/XLSX 임포터

### AI 선제 제안 4종 (Phase 4)
💝 재방문 예측 / 📈 주간 매출 예측 / 🎟 다이나믹 쿠폰 / 🎭 페르소나 세그먼트

### 자동화 킬러 7종 (Phase 5)
🎤 음성 빠른 기록 / 📸 EXIF 자동 고객 매핑 / 🎀 시술 완료 번들 / ✨ 비포/애프터 자동 감지 / ☀️ 오늘의 브리핑 / 🎂 생일 자동 감지 / 🔔 In-app 알림 + 5분 cron

### 유연성 / 온보딩 3종
📥 스마트 임포트 (파일·사진OCR·카톡복붙) / 🧭 이전 도우미 / 📑 월간 자동 리포트

### 인텔리전스
🤖 AI 비서 챗봇 (샵 데이터 컨텍스트 기반 자연어 응답)

---

## 🚀 배포 상태

| 레포 | 브랜치 | 최신 | 비고 |
|---|---|---|---|
| `itdasy-frontend-test-yeunjun` | `main` | (본 커밋) | Pages 스테이징 |
| `itdasy_backend-test` | `main` | (본 커밋) | Railway staging |
| `itdasy-promo` | `main` | `03e8f31` (PR #1 머지) | itdasy.com |
| `itdasy-frontend` (운영) | `main` | (본 커밋) | Pages 운영 |
| `itdasy_backend` (운영) | `main` | (본 커밋) | Railway 운영 |

---

## 🛠️ 기술 부채 · 후속 작업

- `app-dashboard.js` 551줄 (500 상한 초과) → 분할 필요
- `app-caption.js` 1167줄 / `app-portfolio.js` 1023줄 / `app-gallery.js` 1016줄 모놀리스 분할
- 알림톡 대행사(알리고) 연동 — 예약 리마인드·NPS 자동 발송
- FCM 실발송 인프라 (현재는 In-app 큐만)
- AR 스킨/네일 분석 (Phase 4.4 이월)
- E. AI 스토리 자동 생성 (이월)
- 양면앱 (잇데이 Meet) — Phase 5 후속

_최종 갱신: 2026-04-21_
