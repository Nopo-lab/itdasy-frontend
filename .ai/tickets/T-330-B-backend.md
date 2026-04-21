# T-330-B · 백엔드 노쇼(no_show) 제거 — 연준 전달용

**대상 레포:** `itdasy_backend-test` (스테이징) → 검증 후 운영 미러
**담당:** 연준 (T3 BE)
**의존:** T-330 프론트 완료 ✅ (2026-04-22)
**원영님 지시:** "노쇼 서버자체를 지워. 필요없잖아." (2026-04-22)
**트랙:** 표준 (스키마·API 변경 포함)

## 왜 지우나

- 프론트에서 노쇼 UI·버튼·통계 카드·캘린더 상태색 전부 제거 완료 (T-330 스코프 E)
- 원영님 판단: 네일 스튜디오 운영 특성상 "취소" 하나로 충분. 노쇼 분리는 과잉 UX
- 현재 프론트 어디서도 `status=no_show` 로 PATCH 하지 않음 → 서버만 정리되면 데이터 일관성 회복

## 연준 확인 필요 (프론트가 접근 못 해서 정확한 경로는 몰라요)

`itdasy_backend-test` 레포에서 아래 grep 먼저 해주세요:

```bash
grep -rni "no_show\|noshow\|NoShow" app/ tests/ alembic/ 2>/dev/null
```

예상 포인트 (프론트 T-330 작업 당시 추정):

| 레이어 | 예상 대상 |
|---|---|
| Enum | `BookingStatus` enum 에서 `no_show` 값 제거 (있다면) |
| 엔드포인트 | `POST /bookings/{id}/noshow` (혹은 유사) 전용 경로 있으면 삭제 |
| 스키마 | `BookingUpdate.status` 값 검증에서 `no_show` 허용 제거 |
| DB | alembic 마이그레이션에서 `booking_status` enum 값 drop (Postgres enum 은 알터 필요) |
| 통계 | `reports` / `dashboard` 쿼리에서 `no_show` 카운트 집계 제거 |
| 시드 | 테스트 픽스처에 `status='no_show'` 값 있으면 `cancelled` 로 수정 |

## 작업 절차 제안

1. **조사 (15분)**
   - 위 grep 결과 모으기
   - 기존 데이터 `SELECT COUNT(*) FROM bookings WHERE status='no_show'` 확인 (몇 건인지)

2. **데이터 마이그레이션**
   - 기존 `no_show` 레코드를 `cancelled` 로 일괄 UPDATE (또는 원영님과 상의해 삭제)
   - alembic 리비전 추가: `drop_no_show_from_booking_status`

3. **코드 제거**
   - Enum 값 drop
   - 전용 엔드포인트 있으면 삭제 (프론트가 이미 호출 안 함)
   - 스키마 validator 좁히기
   - 테스트 수정 (`test_booking_*.py` 에서 no_show 관련 케이스 제거)

4. **배포**
   - Railway staging 먼저 (현재 레포) → 프론트 회귀 테스트 (예약 생성/취소/캘린더 확인)
   - 통과 시 운영 백엔드 미러

## Acceptance Criteria

- [ ] `grep -rni "no_show" app/` → 0건
- [ ] `BookingStatus` enum 값: `pending|confirmed|completed|cancelled` 만 남음
- [ ] `alembic upgrade head` 성공 (staging + prod 양쪽)
- [ ] 기존 `no_show` 데이터 마이그레이션 (`cancelled` 로 변환 또는 삭제)
- [ ] 테스트 suite 전부 그린
- [ ] 프론트 예약 생성/취소 smoke test 통과

## 위험 / 주의

- **데이터 손실 위험:** `no_show` 로 기록된 기존 예약 데이터가 있을 수 있음. drop 전에 반드시 cancelled 로 마이그레이션 (또는 원영님에게 "이대로 삭제해도 돼?" 물어보기)
- **Postgres enum drop:** `ALTER TYPE booking_status DROP VALUE 'no_show'` 은 PG 10+ 필요하고, 사용 중인 값이 있으면 실패. 반드시 UPDATE 먼저
- **운영 백엔드 미러 전에** 스테이징에서 프론트랑 1일 정도 돌려보고 이상 없는지 확인

## 참고

- 프론트 T-330 완료 커밋: (원영님 push 후 업데이트 필요)
- 프론트에서 제거된 파일 참조:
  - `app-booking.js`: `data-bf-status="no_show"` 버튼 제거, `'노쇼'` 라벨 매핑 제거
  - `app-report.js`: 통계 3열 → 2열 (노쇼 카운트 삭제)
  - `app-calendar-view.js`: `statusColor` 에서 `no_show: '#F57C00'` 제거
  - `app-customer-dashboard.js`: 아이콘 분기에서 noshow 제거

## 연준에게 ✍️

> 원영님이 프론트에선 노쇼 다 지웠어. 서버만 남았는데, 데이터 몇 건 있는지부터 확인하고 (쿼리로) 마이그레이션 계획 짜줘. 이 티켓 완료되면 `.ai/ROADMAP.md` Phase 1.6 표 업데이트 부탁.
