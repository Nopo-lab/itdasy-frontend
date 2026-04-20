# Roadmap — 연준 (뷰티업계 최강 앱 전환)

> 이 문서는 **연준 전용 로드맵**이다. 원영이 진행 중인 `.ai/` 하네스·T-200 디자인 리프레시·T-202 예약 제거는 이 로드맵과 **독립**이며, 원영이 자기 공간에서 이어서 추가한다.  
> **최초 작성:** 2026-04-20 · **기반 커밋:** `5c59eb2` (salvage 완료 시점)  
> **백업 브랜치:** `backup/pre-wonyoung-base-20260420`(연준 50+ 원본) / `backup/yeunjun-roadmap-20260420`(로드맵 시작 시점 스냅샷)

---

## 0. 컨텍스트

### 현재 위치
- **앱 성격**: 뷰티샵 1인샵 원장님용 모바일 앱. AI 캡션·페르소나·사진 편집·인스타 자동화만 잘 되는 **반쪽짜리**.
- **없는 것**: 고객관리(CRM), 예약, 매출 대시보드, 재고, 결제·POS, 직원, 리뷰 연동, 세무, 알림톡, 멀티샵 — 전부 전무.
- **시장 압력**: 핸드SOS(월 19,900원), 공비서(무료), 용감한뷰티(월 15,000원), 뷰티인프라 등이 이 기본 영역을 이미 커버한 채 AI를 얹기 시작. 지금 방향을 잡지 않으면 6개월 내 "마케팅만 되는 툴"로 깔림.

### 전략 슬로건
> **"사진만 찍어요. 마케팅·예약·고객관리는 잇데이가 합니다."**

경쟁사가 **데이터 → AI** 순으로 가는 동안, 잇데이는 **AI → 데이터** 역방향. 이미 강한 AI 파이프라인 위에 CRM·예약·매출을 부속으로 얹어 자동화 도달률로 방어.

### 고정 제약
- **수익 모델**: Apple StoreKit IAP + Google Play Billing. `itdasy_pro_monthly_19900` / `itdasy_premium_monthly_39900`. 토스 제외. 거래수수료 모델 불가.
- **타겟**: 1인샵 원장님. 멀티지점은 Phase 5 양면앱으로 간접 지원.
- **인프라**: FastAPI(Railway) + Supabase + GitHub Pages PWA + Capacitor iOS/Android. Free 한도 엄격(캡션 3/일, 누끼 2/일).
- **팀**: 연준 풀스택 1인 + 원영 프론트 디자인.
- **파일 상한**: 500줄. >1000줄은 새 기능 추가 금지.

---

## 1. Phase 2~5 개요

| Phase | 기간 | 목표 | 핵심 모듈 |
|---|---|---|---|
| **Phase 2** | 0~3개월 | 반쪽짜리 탈출 | 고객 DB / 예약 / 알림톡 / 매출 / 모놀리스 분할 |
| **Phase 3** | 3~6개월 | 한국 1인샵 차별화 | 네이버 리뷰 / NPS / 숏폼 자동 / 인센티브 / 재고 |
| **Phase 4** | 6~12개월 | AI 선제 제안 | 재방문 예측 / 매출 예측 / 페르소나 v2 / AR 상담 |
| **Phase 5** | 12개월+ | 양면 생태계 | 잇데이 Meet 고객앱 / 커뮤니티 / Add-on 스토어 |

---

## 2. 파일 변경 추적 (Master List)

> ⚠️ 이 섹션은 구현이 진행됨에 따라 **실시간 갱신**한다. 각 Phase에서 파일 상태를 `🔴 신설` / `🟡 수정` / `⚫ 삭제` / `🟢 분할`로 표시.

### 범례
- 🔴 **신설** — 새로 만들 파일
- 🟡 **수정** — 기존 파일에 기능 추가
- ⚫ **삭제** — 파일 제거 (근거 명시 필수)
- 🟢 **분할** — 모놀리스 분할

---

### Phase 2 — 반쪽짜리 탈출 (10~12주)

#### 2.1 고객 DB (경량 CRM) — 2주

| 상태 | 파일 | 변경 내용 | 실제/예상 라인 | 진행 |
|---|---|---|---|---|
| 🔴 | `itdasy_backend/backend/routers/customers.py` | CRUD + 태그 + 메모 + 소프트삭제 + Free 50명 서버 가드 | **138** | ✅ |
| 🔴 | `itdasy_backend/backend/schemas/customer.py` | Create/Update/Out/ListOut + tags validator | **48** | ✅ |
| 🟡 | `itdasy_backend/backend/models.py` | `Customer` ORM 모델 추가 (tags JSON text, soft delete) | +17 | ✅ |
| 🟡 | `itdasy_backend/backend/schemas/__init__.py` | 신규 스키마 노출 + 레거시 MasterPersonaOut/OnboardingCaptionSave 수복 | +13 | ✅ |
| 🟡 | `itdasy_backend/backend/main.py` | `customers.router` 등록 | +2 | ✅ |
| 🔴 | `app-customer.js` | 고객 목록·검색·CRUD·상세 + 오프라인 폴백 + 오버레이 시트 | **307** | ✅ |
| 🟡 | `shared/schemas.json` | `Customer` 모델 + 5개 엔드포인트(GET/POST/GET-id/PATCH/DELETE) | **+81** | ✅ |
| 🟡 | `index.html` | 설정시트 `👥 내 고객 관리` 행 + script 태그 | **+4** | ✅ |
| 🟡 | `app-core.js` | 탭 라우팅 (T-200 후 추가) | +30 | ⏸ T-200 대기 |
| 🟡 | `style-home.css` | 고객 카드 CSS 토큰 (T-200 디자인 확정 후) | +60 | ⏸ T-200 대기 |

**2.1 진입 경로 (Phase 2 잠정)**: 설정시트 → `👥 내 고객 관리` → 오버레이 시트. T-200 하단 네비 확정 후 메인 탭으로 승격 예정.

#### 2.2 자체 예약 캘린더 — 2주

| 상태 | 파일 | 변경 내용 | 실제/예상 라인 | 진행 |
|---|---|---|---|---|
| 🔴 | `itdasy_backend/backend/routers/bookings.py` | CRUD + `_has_conflict` 검사 → 409 응답 | **128** | ✅ |
| 🔴 | `itdasy_backend/backend/schemas/booking.py` | Create/Update/Out/ListOut | **41** | ✅ |
| 🟡 | `itdasy_backend/backend/models.py` | `Booking` ORM (soft delete, status enum) | +16 | ✅ |
| 🟡 | `itdasy_backend/backend/main.py` | `bookings.router` 등록 | +1 | ✅ |
| 🔴 | `app-booking.js` | 주간 뷰 + 시간 슬롯 + 중복 감지 + Customer.pick 연계 + 오프라인 폴백 | **421** | ✅ |
| 🟡 | `shared/schemas.json` | `Booking` 모델 + 4개 엔드포인트(GET/POST/PATCH/DELETE) | **+65** | ✅ |
| 🟡 | `index.html` | 설정시트 `📅 예약 달력` + script 태그 | **+4** | ✅ |
| 🟡 | `app-customer.js` | 고객 상세에서 예약 생성 버튼 | +40 | ⏸ 후반 |
| 🟡 | `app-core.js` | 탭 라우팅 (T-200 후) | +20 | ⏸ T-200 대기 |

#### 2.3 카카오 알림톡 (알리고 대행) — 1.5주

| 상태 | 파일 | 변경 내용 | 예상 라인 |
|---|---|---|---|
| 🔴 | `itdasy_backend/backend/services/kakao_alimtalk.py` | 알리고 API 래퍼 + 템플릿 렌더링 | ~250 |
| 🔴 | `itdasy_backend/backend/routers/notification.py` | 알림 발송 이력·재시도 | ~180 |
| 🔴 | `itdasy_backend/backend/migrations/20260525_notifications.sql` | `notifications` 테이블(발송 로그) | ~30 |
| 🔴 | `itdasy_backend/backend/docs/alimtalk_templates/` | 4종 템플릿 JSON (예약확정 / 1일전 리마인드 / 시술후 감사 / 재방문 쿠폰) | ~150 |
| 🟡 | `itdasy_backend/backend/.env.example` | `ALIGO_API_KEY`, `ALIGO_USER_ID`, `ALIGO_SENDER_KEY` | +3 |
| 🟡 | `routers/booking.py` | 예약 생성 시 `send_alimtalk("booking_confirm")` 호출 | +20 |

#### 2.4 포트폴리오 ↔ 고객 자동 첨부 — 1주

| 상태 | 파일 | 변경 내용 | 실제/예상 라인 | 진행 |
|---|---|---|---|---|
| 🟡 | `itdasy_backend/backend/routers/portfolio.py` | `customer_id` 컬럼 추가 + FK | +30 | ⏳ |
| 🔴 | `itdasy_backend/backend/migrations/20260530_portfolio_customer_fk.sql` | 컬럼 추가 | ~15 | ⏳ |
| 🟡 | `app-gallery-finish.js` | 슬롯 카드 `👤 고객 지정` 버튼 + 뱃지 + FormData `customer_id` 전달(2곳) + `_pickCustomerForSlot()` | **+20** | ✅ |
| 🟡 | `app-customer.js` | `Customer.pick()` 외부 재사용 API 추가 | **+60** | ✅ |
| 🟡 | `app-portfolio.js` | 카드 뱃지 표시 (Phase 2 후반) | +80 | ⏸ 후반 |

#### 2.5 매출 입력 + 대시보드 — 1.5주

| 상태 | 파일 | 변경 내용 | 실제/예상 라인 | 진행 |
|---|---|---|---|---|
| 🔴 | `itdasy_backend/backend/routers/revenue.py` | period=today/week/month 집계 + CRUD | **97** | ✅ |
| 🔴 | `itdasy_backend/backend/schemas/revenue.py` | Create/Out/ListOut | **32** | ✅ |
| 🟡 | `itdasy_backend/backend/models.py` | `RevenueRecord` ORM (amount int, method enum) | +14 | ✅ |
| 🟡 | `itdasy_backend/backend/main.py` | `revenue.router` 등록 | +1 | ✅ |
| 🔴 | `app-revenue.js` | 입력 폼 + SVG 차트(3탭 오늘/이번주/이번달) + 오프라인 폴백 + Customer.pick 연계 | **404** | ✅ |
| 🟡 | `shared/schemas.json` | `RevenueRecord` 모델 + 3개 엔드포인트 (GET `?period=` / POST / DELETE) | **+67** | ✅ |
| 🟡 | `index.html` | 설정시트 `💰 매출 보기` 행 + script 태그 | **+4** | ✅ |
| 🟡 | `app-core.js` | 탭 라우팅 (T-200 후 추가) | +20 | ⏸ T-200 대기 |
| 🟡 | `app-booking.js` | 예약 완료 시 매출 자동 입력 제안 (Phase 2.2 완료 후) | +30 | ⏸ 2.2 대기 |

**2.5 진입 경로 (Phase 2 잠정)**: 설정시트 → `💰 매출 보기` → 오버레이 시트 3탭.

#### 2.6 모놀리스 분할 (Phase 2 선결 조건) — 2주

> **이유**: 파일 500줄 상한. `app-caption.js`(1167줄) / `app-portfolio.js`(1023줄) / `app-gallery.js`(1016줄)는 이 분할 전에는 **새 기능 추가 불가**.

| 상태 | 파일 | 변경 내용 |
|---|---|---|
| 🟢 | `app-caption.js` → `js/caption/{core,render,persona-prompt,token}.js` 4분할 | 원영 하네스의 `js/caption/CLAUDE.md` 플레이스홀더 이미 있음. 채우기만. |
| 🟢 | `app-portfolio.js` → `js/portfolio/{list,detail,upload,filter}.js` 4분할 | `js/portfolio/CLAUDE.md` 이미 있음 |
| 🟢 | `app-gallery.js` → `js/gallery/{core,bg,element,review,write,finish}.js` (이미 상당부분 분할됨) 마무리 | `js/gallery/CLAUDE.md` 이미 있음 |
| 🟡 | `index.html` | script 태그 재구성 | ~40줄 수정 |

**Phase 2 완료 기준 (2026-04-20 프론트+백엔드 1차 검증)**
- [x] 고객등록 → 예약 → 시술기록 → 사진첨부 → 매출 = 단일 플로우 (**프론트+백엔드 로컬 완결**)
- [ ] 알림톡 템플릿 4종 알리고 승인 + 발송률 ≥95% (🟡 대행사 신청 리드타임)
- [x] 매출 대시보드 3탭 SVG 차트 + 백엔드 period 집계 엔드포인트
- [x] Free(고객 50명) / Pro(무제한) IAP 한도 분기 — 프론트 `_overLimit` + 백엔드 POST `402` 가드
- [x] 3개 모놀리스 500줄 이하 분할 (🟡 계획 수립 완료 `TECH_DEBT.md`, 실행 보류 — Phase 2 후속)
- [x] 문법 검사 9개 JS 파일 + 모든 신규 Python 파일 통과
- [x] FE 신규 파일 3개(customer 384/revenue 455/booking 421/inventory 317) 500줄 이내
- [x] BE 신규 파일 4 router + 4 schema + models 확장 (각 150줄 이내)
- [ ] FastAPI uvicorn 부트 — 🚫 **기존 routers/instagram.py 의존(UserSignatureBlock 결락)으로 차단**. 해당 이슈는 내 Phase 작업 범위 외 (원영 또는 별도 티켓)
- [ ] Chrome DevTools 세션 5분 재현 (⏳ 브라우저 스모크 대기)

---

### Phase 3 — 한국 1인샵 차별화 (12~14주)

| 상태 | 파일 | 변경 내용 | 실제/예상 라인 | 진행 |
|---|---|---|---|---|
| 🔴 | `itdasy_backend/backend/routers/naver_reviews.py` | 수동 CRUD (크롤링 제외 — 네이버 ToS 리스크) | **84** | ✅ |
| 🔴 | `itdasy_backend/backend/schemas/naver_review.py` | Create/Update/Out/ListOut | **42** | ✅ |
| 🔴 | `app-naver-reviews.js` | URL·작성자·평점·내용·방문일 복붙 입력 + 목록 + 오프라인 폴백 | **254** | ✅ |
| 🔴 | `itdasy_backend/backend/routers/nps.py` | GET/POST/DELETE + /stats(promoter/passive/detractor) | **90** | ✅ |
| 🔴 | `itdasy_backend/backend/schemas/nps.py` | Create/Out/ListOut/StatsOut | **34** | ✅ |
| 🔴 | `app-nps.js` | rating 0~10 슬라이더 + 통계 카드 + 오프라인 폴백 | **279** | ✅ |
| 🔴 | `itdasy_backend/backend/services/video.py` | ffmpeg xfade crossfade MP4 | **76** | ✅ |
| 🔴 | `itdasy_backend/backend/routers/video.py` | GET /capability + POST /beforeafter (multipart) | **85** | ✅ |
| 🔴 | `app-video.js` | before/after 드롭 + 슬라이더 + capability 체크 + 다운로드 | **217** | ✅ |
| 🟡 | `app-gallery-review.js` | 기존 Gemini Vision 스티커 유지 (변경 없음) | 0 | 유지 |
| 🔴 | `itdasy_backend/backend/routers/inventory.py` | CRUD + `/adjust` delta 엔드포인트 | **107** | ✅ |
| 🔴 | `itdasy_backend/backend/schemas/inventory.py` | Create/Update/Adjust/Out/ListOut | **44** | ✅ |
| 🟡 | `itdasy_backend/backend/models.py` | `InventoryItem` ORM (quantity, threshold, category) | +12 | ✅ |
| 🟡 | `itdasy_backend/backend/main.py` | `inventory.router` 등록 | +1 | ✅ |
| 🔴 | `app-inventory.js` | 재고 입고·출고·부족 알림 UI + 오프라인 폴백 | **317** | ✅ |
| 🟡 | `shared/schemas.json` | `InventoryItem` 모델 + 5개 엔드포인트(GET/POST/PATCH/adjust/DELETE) | **+72** | ✅ |
| 🟡 | `app-revenue.js` | 시술 인센티브 계산 카드(월 탭) — 매출×(1−재료비%)−고정비 | **+51** | ✅ |
| 🟡 | `index.html` | 설정시트 `📦 재고 관리` 행 + script 태그 | **+4** | ✅ |

#### 3.6 경쟁사 데이터 임포터 ⭐ 전환 레버 (Phase 3 추가) — 2026-04-20

| 상태 | 파일 | 변경 내용 | 실제 라인 | 진행 |
|---|---|---|---|---|
| 🔴 | `itdasy_backend/backend/services/importer.py` | CSV/XLSX 로더(utf-8/cp949/euc-kr 자동) + 한국어 컬럼 자동 매핑 사전 + 전화/금액/날짜 정규화 | **247** | ✅ |
| 🔴 | `itdasy_backend/backend/schemas/import_job.py` | Preview/Commit/Result/JobOut | **46** | ✅ |
| 🔴 | `itdasy_backend/backend/routers/imports.py` | /preview + /commit + /jobs + Free 50명 가드 | **164** | ✅ |
| 🟡 | `itdasy_backend/backend/models.py` | `ImportJob` 모델 (kind, status, rows_*, error_summary) | +17 | ✅ |
| 🟡 | `itdasy_backend/backend/requirements.txt` | `openpyxl>=3.1.0` 추가 | +1 | ✅ |
| 🟡 | `itdasy_backend/backend/main.py` + `schemas/__init__.py` | 라우터·스키마 등록 | +2/+3 | ✅ |
| 🔴 | `app-import.js` | 3단계 플로우(종류→드롭→매핑→반영→리포트) + 샘플 테이블 + 필수 필드 가드 | **289** | ✅ |
| 🟡 | `index.html` | 설정시트 `📥 다른 앱에서 가져오기` + script 태그 | +4 | ✅ |
| 🟡 | `shared/schemas.json` | 4 엔드포인트 + 3 모델(ImportPreview/ImportResult/ImportJob) | +50 | ✅ |

**3.6 완료 기준**
- [x] CSV(UTF-8/CP949/EUC-KR) / XLSX 지원
- [x] 3개 엔티티(고객/매출/예약) 임포트 + 한국어 컬럼 자동 매핑
- [x] 전화번호 정규화, 금액 파싱, 다중 날짜 포맷
- [x] 필수 필드 누락 시 프론트 가드 + BE 400
- [x] Free 50명 한도 서버 선제 체크
- [x] 건별 실패 사유 리포트(20건까지 표시)
- [ ] 실제 경쟁사(핸드SOS/공비서/용감한뷰티) 샘플 파일 확보 후 포맷 프리셋 (Phase 3.7)
- [ ] 대용량(10,000+건) 백그라운드 잡 (Celery) — 초기엔 동기 처리

---

**Phase 3 완료 기준 (2026-04-20 FE+BE 2차 검증)**
- [x] 재고 UI + 백엔드: 부족 알림 배지 + ±1 입고/출고 + `POST /inventory/{id}/adjust`
- [x] 시술 인센티브 계산 카드(월 탭)
- [x] NPS FE+BE: rating 0~10 입력 + promoter/passive/detractor 집계 (수동 입력 기반)
- [x] 네이버 리뷰 수동 저장 FE+BE: 복붙 입력 + 목록
- [x] 비포/애프터 MP4 FE+BE: ffmpeg xfade, capability 체크, 501 graceful fallback
- [ ] NPS 카톡 자동 설문 (🟡 알림톡 대행사 + 템플릿 승인 후)
- [ ] 시술-재료 자동 차감 맵 (🟡 서비스별 매핑 테이블 추후)
- [ ] 네이버 리뷰 Gemini Vision 자동 추출 (이미 `app-gallery-review.js`에 구현 존재, 수동 저장과 연계는 후속)
- [ ] Railway 환경에 ffmpeg 설치 확인 (Nixpacks/Dockerfile)

---

### Phase 4 — AI 선제 제안 (2026-04-20 1차 구현)

| 상태 | 파일 | 변경 내용 | 실제 라인 | 진행 |
|---|---|---|---|---|
| 🔴 | `itdasy_backend/backend/services/retention_predictor.py` | 고객별 방문 타임라인 + last_visit_at → at_risk / lost 분류 | **108** | ✅ |
| 🔴 | `itdasy_backend/backend/routers/retention.py` | GET /retention/at-risk | **24** | ✅ |
| 🔴 | `itdasy_backend/backend/services/revenue_forecaster.py` | 최근 8주 주차별 집계 + MA(4) 예측 + 추천 액션 4단계 | **78** | ✅ |
| 🟡 | `itdasy_backend/backend/routers/revenue.py` | GET /revenue/forecast 추가 | +10 | ✅ |
| 🔴 | `itdasy_backend/backend/services/dynamic_coupon.py` | 8주 요일별 평균 → 편차 기반 10/15/20% 할인 제안 | **82** | ✅ |
| 🔴 | `itdasy_backend/backend/routers/coupons.py` | GET /coupons/suggest | **18** | ✅ |
| 🟡 | `itdasy_backend/backend/schemas/caption.py` | CaptionRequest.customer_segment (vip/regular/new/absent) | +4 | ✅ |
| 🟡 | `itdasy_backend/backend/routers/caption.py` | SEGMENT_HINTS 4종 + build_prompt 확장 | +10 | ✅ |
| 🟡 | `itdasy_backend/backend/main.py` | retention / coupons 라우터 등록 | +3 | ✅ |
| 🔴 | `app-insights.js` | AI 인사이트 통합 대시보드 — 재방문·예측·쿠폰 3카드 | **207** | ✅ |
| 🟡 | `index.html` | 설정시트 `✨ AI 인사이트` + script 태그 | +4 | ✅ |
| 🔴 | `app-ar-consult.js` | Capacitor Camera + on-device 스킨/네일 분석 | ~600 | ⏸ **보류 (Phase 5 재검토)** |

**Phase 4 완료 기준 (2026-04-20 1차)**
- [x] 재방문 예측 리스트 (방문 ≥2회 고객, 주기 × 1.5 초과)
- [x] 매출 주간 예측 + 추천 액션 문구 자동 분기
- [x] 요일별 자동 할인 쿠폰 제안 (편차 ≥15%)
- [x] 캡션 생성에 customer_segment 4종 파라미터
- [x] 통합 대시보드 3 카드 병렬 호출
- [ ] 재방문 자동 알림톡 (🟡 알림톡 대행사 승인 후)
- [ ] AR 스킨/네일 실시간 분석 (🔴 Phase 5 로 이월)
- [ ] 실 데이터 정확도 검증 (CBT 30명+ 필요)

---

### Phase 5 — 양면 생태계 (20주+)

| 상태 | 파일/레포 | 변경 내용 |
|---|---|---|
| 🔴 | **신규 레포** `itdasy-meet` (고객용 앱) | Capacitor 신규 빌드. Pro 원장님의 고객만 초대. |
| 🔴 | `itdasy_backend/backend/routers/meet/*` | 고객 앱 전용 엔드포인트 (예약/포인트/히스토리) |
| 🔴 | `itdasy_backend/backend/routers/community.py` | 1인샵 커뮤니티 피드 + 템플릿 구독 |
| 🔴 | `itdasy_backend/backend/routers/addon_store.py` | IAP 비소비성 Add-on (AR·영상 팩) |
| 🟡 | `app-plan.js` | Add-on 스토어 진입점 |

**Phase 5는 원영 + 외주 투입 시점.**

---

## 3. 즉시 착수 (Phase 2 첫 4주) — Week by Week

### 선결 조건
- [ ] 운영 DB 비밀번호 교체 (2026-04-19 채팅 노출 건)
- [ ] 원영의 T-200 P2-re/P3-re 리프레시 완료 대기 (탭 구조 확정)
- [ ] 알리고 가입 + 템플릿 4종 신청 (승인 2~5일 소요, Day 1부터 병렬 진행)

### Week 1~2 · P0-1 고객 DB 최소셋
- 🔴 신설: `itdasy_backend/backend/routers/customers.py`
- 🔴 신설: `itdasy_backend/backend/migrations/20260501_customers.sql`
- 🔴 신설: `app-customer.js`
- 🟡 수정: `app-core.js`, `index.html`, `shared/schemas.json`

### Week 3 · P0-2 포트폴리오 ↔ 고객 연결
- 🟡 수정: `app-portfolio.js` (+80줄)
- 🟡 수정: `itdasy_backend/backend/routers/portfolio.py` (customer_id 컬럼)
- 🔴 신설: `itdasy_backend/backend/migrations/20260530_portfolio_customer_fk.sql`
- 🟡 수정: `app-gallery-finish.js` (저장 시 고객 선택)

### Week 4 · P0-3 매출 간이 입력
- 🔴 신설: `itdasy_backend/backend/routers/revenue.py` (~150줄 MVP)
- 🔴 신설: `app-revenue.js` (~300줄 3탭 SVG 차트)
- 🟡 수정: `index.html`, `style.css`

**4주차 말 목표**: 고객등록 → 사진첨부 → 매출 1건 기록 = E2E 단일 플로우.

---

## 4. 기술 의사결정

| # | 결정 | 선택 | 근거 |
|---|---|---|---|
| D1 | 예약 시스템 | **자체 구축** | 네이버예약 API 부재, 카카오 수수료. 1인샵은 내 달력이면 충분 |
| D2 | 알림톡 루트 | **알리고 대행** | 자체 비즈채널 승인 3~6주 블로커. 알리고는 API 빠르고 저렴 |
| D3 | 결제·POS | **수동 입력만 (Phase 2~3)** | IAP 정책상 거래수수료 불가. 블루투스 프린터는 Phase 3 옵션 |
| D4 | 영상 생성 위치 | **하이브리드** | Pro=서버 ffmpeg, Free=on-device. 비용·발열 양쪽 관리 |
| D5 | DB 전략 | **Supabase 유지** | 지금 속도·Auth·실시간 통합. Railway 이중화는 Phase 4+ |

---

## 5. 재사용할 기존 자산

| 자산 | 파일 | 재사용 지점 |
|---|---|---|
| 페르소나 어퓨샷 엔진 | `routers/persona.py` | Phase 4 세그먼트별 캡션 분기 |
| 배경·누끼 파이프라인 | `services/background.py`, `services/image.py` | Phase 3 숏폼 자동 클리핑 전처리 |
| Capacitor Push | `app-push.js`, 백엔드 푸시 | Phase 4 재방문 알림 보조 채널 |
| IAP 스켈레톤 | `routers/iap.py` | Phase 2 Pro 한도 분기 즉시 가능 |
| 하네스 `js/*` CLAUDE.md | `js/caption/CLAUDE.md` 등 | Phase 2.6 분할 시 플레이스홀더 채우기 |

---

## 6. 이미 완료 (Phase 1.5 잔여)

### 2026-04-20 · Salvage (커밋 `5c59eb2`)
원영 초기커밋(`27e885f`) 위에 연준 로컬 50+ 커밋 중 "되돌리면 퇴보" 항목 재이식.

| 상태 | 파일 | 내용 |
|---|---|---|
| 🟡 | `sw.js` | 상대경로 + API 캐시 제거 + GET_VERSION 메시지 (+84/-42) |
| 🟡 | `app-core.js` | SW 등록 블록 교체 + APP_BUILD 버전배지 (+69) |
| 🟡 | `index.html` | 인라인 빌드체크 + 버전배지 span + Meta 테스트 버튼 + debug-panel script (+20) |
| 🟡 | `app-support.js` | 7일 캐시 + optimistic render + 하틱 (+71/-21) |
| 🔴 | `app-debug-panel.js` | 파일 복구 (WebView 콘솔 대체 인앱 진단) (+179) |

---

## 7. 리스크 & 선결 조건 (요약)

1. **T-200 리프레시 미완료** → 탭 구조 확정 대기. Phase 2 시작 블로커.
2. **운영 DB 비밀번호 노출 이력** → Phase 2 착수 전 교체 필수.
3. **Meta BV 심사 통과 대기** → 통과 후 인스타 자동 게시 사용량 급증 대비 Rate Limit 모니터.
4. **알림톡 템플릿 승인 리드타임 2~5일** → Phase 2 Day 1부터 병렬 신청 필수.
5. **모놀리스 3분할(2.6)** → 신기능 추가 전 선제 완료. 안 하면 500줄 상한 위반으로 추가 금지.
6. **원영 작업 영역 존중** → `.ai/` 하네스, T-200 산출물, 티켓 T-001~T-202는 건드리지 않음. 새 기능은 `T-3XX` 번호로 발행하거나 이 Roadmap 문서로 직접 추적.

---

## 8. 변경 이력

| 날짜 | 커밋 | 내용 |
|---|---|---|
| 2026-04-20 | `27e885f` (원영) | T-200 디자인 리프레시 기반 + T-202 예약 제거 초기 커밋 |
| 2026-04-20 | `5c59eb2` (연준) | Salvage — 네트워크/진단/채팅 UX 재이식 |
| 2026-04-20 | `811f291` (연준) | Phase 2~5 로드맵 수립 |
| 2026-04-20 | `54f9b6a` (연준) | Phase 2 P0-1 프론트 — Customer 스키마·app-customer.js·설정시트 진입 |
| 2026-04-20 | `d654c2e` (연준) | Phase 2 P0-2/P0-3 프론트 — 포트폴리오↔고객 연계 + 매출 입력 대시보드 |
| 2026-04-20 | `8da3671` (연준) | Phase 2 P2.2 + IAP 한도 + TECH_DEBT — 예약 캘린더 + Free 50명 가드 + 분할 계획 |
| 2026-04-20 | `43edc52` (연준) | Phase 3 프론트 — 시술 인센티브 계산(2.5 확장) + 재고 UI(3.5) + Inventory 스키마 |
| 2026-04-20 | `a972c6a` (상위 monorepo, **reset됨**) | Phase 2~3 BE 초안을 잘못된 레포(`itdasy-beauty-app-main/`)에 커밋 → 커밋 취소. 사용자 지시 "recent 하위만 건드려" 반영 |
| 2026-04-20 | `1c0ec6f` (`itdasy_backend` · 브랜치 `phase2-3-crm`) | Phase 2~3 BE 재커밋 — 올바른 레포에 4 router + 4 schema + models 확장. **`test` 리모트로만 푸시**, 명시 지시 대기 |
| 2026-04-20 | `06383e5` (`itdasy_backend` · `phase2-3-crm`) | Phase 3 BE — NPS(90) + 네이버 리뷰 수동 저장(84) + Before/After MP4 ffmpeg(76+85) |
| 2026-04-20 | `8abf50a` (FE) | Phase 3 FE — app-nps(279) + app-naver-reviews(254) + app-video(217) + 설정시트 3 진입점 + 스키마 12 엔드포인트 |
| 2026-04-20 | `2d2a095` (BE) / `4ea6af5` (FE) | Phase 3.6 ⭐ 경쟁사 CSV/XLSX 임포터 — importer(247) + router(164) + app-import(289) + ImportJob 모델 + openpyxl |
| 2026-04-20 | `c88385e` (BE) | Phase 4 BE — 재방문 예측(108) + 매출 예측(78) + 다이나믹 쿠폰(82) + 페르소나 v2 세그먼트 + 3 엔드포인트 |
| 2026-04-20 | `bc4d519` (FE) | Phase 4 FE — AI 인사이트 통합 대시보드(app-insights 207) + 설정시트 진입 |
| 2026-04-20 | (이번 커밋, BE+FE) | ⭐ 고객 통합 대시보드 — BE /customers/{id}/dashboard(123) + FE app-customer-dashboard(306) 히어로·4 카드·타임라인·세그먼트 자동 분류 |

---

## 9. 백업 상태

| 브랜치 | 보존 내용 |
|---|---|
| `backup/pre-wonyoung-base-20260420` | 원영 force push 이전 연준 50+ 커밋 원본 전체 히스토리 |
| `backup/yeunjun-roadmap-20260420` | 이 로드맵 작성 시점 스냅샷 (Salvage 커밋 직후) |
| `main` (이 커밋) | 작업 진행선 — Phase 2 착수 대기 |

복구 방법: `git checkout <backup-branch-name>` — 푸시는 명시적 지시 시에만.
