/* ─────────────────────────────────────────────────────────────
   [DEPRECATED · 2026-04-30] 예약 캘린더 (구버전)

   이 파일은 app-calendar-view.js v4 마이그레이션으로 무력화됨.
   - openBooking / openCalendarView / closeBooking → app-calendar-view.js 가 정의
   - window.Booking CRUD → app-booking-api.js 가 정의
   - 마크업 / drag-drop / 폼 / 직원 필터 / now-line / 미니캘 / PC 레이아웃 → app-calendar-view.js v4

   index.html 에 등록되어 있지 않으므로 실제 로드되지 않음. 안전을 위해 IIFE 만 남김.
   삭제하지 않는 이유: 외부 호출자(레거시 북마크 등)가 직접 `<script src="app-booking.js">` 로
   불러오는 경우라도 충돌 없이 무시되도록.

   다음 정기 청소 시(v1.5+) 완전 삭제 예정.
   ──────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  // intentionally empty — see app-calendar-view.js
})();
