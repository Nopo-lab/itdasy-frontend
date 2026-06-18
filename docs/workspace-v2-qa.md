# 작업실 V2 E2E QA 체크리스트 (Phase 4)

> 실사용 수동 QA용. 실제 이미지·로그인 상태에서 확인. (`window.ITDASY_WORKSPACE_V2=false` 폴백도 확인)

## 시나리오
1. **시술 자랑/홍보컷(1장)**: 업로드 → crop 4:5 → 보정 → 템플릿 → 캡션 → 미리보기 → 저장 → 새로고침 복원
2. **전후 콘텐츠(2장)**: 업로드 → before/after 확인 → 각각 crop → 템플릿 → 캡션 → 저장 (role 보존)
3. **고객 후기(1장)**: review tone 캡션 → 고객 연결 → 저장
4. **이벤트**: 이벤트 템플릿 → 캡션 → 미리보기 (준비중 문구 없음)
5. **가격표**: 가격표 업로드/OCR 흐름 (홍보 사진 오라우팅 없음)

## 핵심 체크
- [ ] 다음 추천 작업: 사진만→비율 자르기 / 편집됨→캡션 / 캡션됨→미리보기 / 미리보기됨→고객 연결
- [ ] 전후 1장만 → "사진 2장 필요", role 누락 → "전/후 역할 확인"
- [ ] crop 결과 = editedDataUrl + cropMeta, originalUrl(dataUrl) 보존
- [ ] 카드 썸네일 = crop/edited 결과 우선
- [ ] 새로고침 후: crop/editedDataUrl/templateMeta/caption/customer/type/role/publish 유지
- [ ] 캡션 다시/더 길게/후기체/해시태그 더 → 재업로드 요구 없음
- [ ] 인스타 미리보기: photo/caption 반영, "업로드 아님" 표시
- [ ] 인스타 미연결 → 업로드 버튼 숨김 + 복사/저장/연결만
- [ ] 고객 없음 → empty-state, 데모 고객(김연수 등) 미노출
- [ ] 저장 카드 중복 생성 없음
- [ ] 구 slot popup / nav-sheet / openSlotEditor 직접 노출 0
- [ ] 폴백 flag=false → 기존 작업실
- [ ] 홈/작업실/내샵 네비 회귀 없음, 잇비/예약/매출/고객기록 회귀 없음
- [ ] 콘솔 에러 0, 모바일 390 폭, 버전 3중 일치

## 상태 모델 (slot, additive)
- `slot.workspaceContext` {type(before_after/promo/review/event/price), expectedPhotos, defaultRatio, templatePurpose, captionMode, createdFrom:'workspace_v2'}
- `slot.photos[]` {id, dataUrl(원본), editedDataUrl(보정/크롭), cropMeta, role, updatedAt}
- `slot.caption` + `slot.hashtags` + `slot.captionMeta` {mode, length_tier, tone_override, generatedAt, log_id}
- `slot.customer_id` / `slot.customer_name`
- `slot.publish` {status: draft|preview_ready|upload_ready|published, instagramPreparedAt, publishedAt}

---

## Phase 5-1 실기기 QA 기록 (2026-06-18, 라이브 `v510-workspace-inplace-edit`)

> 실기기는 보스 직접 조작. 헤드리스 대체 PASS 보고 금지.

### ✅ PASS (실기기 확인됨)
- **P0 편집 라우팅 회귀**: 기본/피부/머릿결/배경/고급 탭 → 구 PhotoEditor 미라우팅, 같은 V2 편집 화면 내 전환 (B2)
- **구 UI 누수**: 슬롯 팝업/하단 시트/nav-sheet 직접 노출 없음 (B8)

### ⏳ 진행 중 — 미확인 항목 (Phase 5-1 미마감)
- [ ] 캡션 생성 실제 호출 (스테이징 백엔드 응답)
- [ ] "저장하고 캡션 생성" 후 재업로드 요구 없는지
- [ ] 고객 연결 실데이터 로드 (없으면 empty-state)
- [ ] 저장 후 새로고침 복원 (edited/crop/caption/customer/type/role/publish)
- [ ] 전후 2장 역할(before/after) 보존
- [ ] 인스타 미리보기 / 게시 준비 (미연결 시 업로드 숨김)
- [ ] 핀치 줌 / 팬 (편집·크롭)
- [ ] safe-area / 하단바 겹침 (노치·홈바)

**상태**: P0 편집 라우팅 회귀 = **PASS** · Phase 5-1 전체 = **진행 중**
