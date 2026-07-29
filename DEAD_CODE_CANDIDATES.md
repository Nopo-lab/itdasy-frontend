# dead code 후보 — 미사용 지역 함수 28개 (총 365줄)

> 검증: graphify 호출그래프 in-degree 0 **AND** 코드 전체에서 함수명 1회(정의부)만 등장 **AND** 공개 API 객체메서드 아님.
> 삭제는 아직 안 함. 눈으로 확인용.

## 기타 미사용 지역 헬퍼 — 13개 / 145줄
- `_monthSummary` — app-calendar-view.js:L240–248 (9줄)
- `_depositSignal` — app-dm-confirm-queue.js:L140–142 (3줄)
- `showPhotoInstaPreview` — app-gallery-slot-editor.js:L495–521 (27줄)
- `unassignPopupPhoto` — app-gallery-slot-editor.js:L307–320 (14줄)
- `_showDragIndicator` — app-gallery-workshop.js:L717–728 (12줄)
- `_onDockClick` — app-phase9-ux.js:L160–176 (17줄)
- `_dockHTML` — app-phase9-ux.js:L137–149 (13줄)
- `_groupedHTML` — app-photo-editor-beauty.js:L131–141 (11줄)
- `_createAction` — js/assistant/core/customer-add-guard.js:L93–100 (8줄)
- `_checkpoint` — js/assistant/core/customer-status-card.js:L141–146 (6줄)
- `_monthCount` — js/home/v41-renderers.js:L292–302 (11줄)
- `_todayExpected` — js/home/v41-renderers.js:L304–311 (8줄)
- `_txtGrid` — js/itd-editor/itd-editor.js:L297–302 (6줄)

## 작업실 V2 (재설계로 버려진 HTML 빌더) — 7개 / 97줄
- `_capConfirmHtmlOld` — js/workspace/workspace-v2-flow.js:L1991–2004 (14줄)
- `_ctrlSlider` — js/workspace/workspace-v2-flow.js:L655–661 (7줄)
- `_tplResultCarousel` — js/workspace/workspace-v2-flow.js:L796–817 (22줄)
- `_bentoHTML` — js/workspace/workspace-v2-home.js:L150–175 (26줄)
- `_categoryHTML` — js/workspace/workspace-v2-home.js:L96–110 (15줄)
- `_cBarHTML` — js/workspace/workspace-v2-home.js:L186–191 (6줄)
- `_cFiltersHTML` — js/workspace/workspace-v2-home.js:L178–184 (7줄)

## 대시보드 (INVENTORY_HIDDEN 로 대체된 옛 렌더러) — 1개 / 54줄
- `_metricsGrid` — app-dashboard.js:L215–268 (54줄)

## 사진편집 템플릿 오버레이 (미사용 draw) — 2개 / 51줄
- `_drawBADark` — js/photo-editor/template-overlay.js:L313–336 (24줄)
- `_drawBASage` — js/photo-editor/template-overlay.js:L285–311 (27줄)

## 재고/소모품 CRUD (미연결) — 4개 / 10줄
- `_loadInventoryItems` — app-service-templates.js:L47–50 (4줄)
- `_deleteConsumption` — app-service-templates.js:L56–56 (1줄)
- `_loadConsumptions` — app-service-templates.js:L51–54 (4줄)
- `_createConsumption` — app-service-templates.js:L55–55 (1줄)

## DM (폴링 — 크리티컬 버그로 OFF, 제품확인) — 1개 / 8줄
- `_startInboxPoll` — app-dm-autoreply.js:L1509–1516 (8줄)

## [삭제제외] 공개 API 메서드 — 호출 없어도 유지
- `subscribe` — app-instagram.js:L197  (외부 호출용 API)
- `showBanner` — app-cookie-consent.js:L122  (외부 호출용 API)
- `grant` — app-cookie-consent.js:L120  (외부 호출용 API)