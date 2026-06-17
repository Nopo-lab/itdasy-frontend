/* Workspace V2 — 콘텐츠 상태 모델 + 다음 추천 작업 (순수 함수)
   의존: 없음 (slot 데이터 구조만 읽음).
   slot 형태: { id, label, photos:[{dataUrl,editedDataUrl,...}], caption, hashtags,
               customer_id, customer_name, status, wsStatus?, ... }
   주의: 여기서 slot 을 변경하지 않는다(읽기 전용). 저장은 app-gallery-db 가 담당. */
(function () {
  'use strict';

  // 콘텐츠 상태 (Phase 1: 산출만, 전이 고도화는 Phase 4)
  var STATUS = {
    UPLOAD_PENDING: 'upload_pending', // 사진만 없거나 비어 있음
    NEEDS_EDIT:     'needs_edit',     // 사진 있음, 아직 보정/캡션 전
    NEEDS_CAPTION:  'needs_caption',  // 보정됨, 캡션 없음
    NEEDS_CUSTOMER: 'needs_customer', // 캡션 있음, 고객 미연결
    READY:          'ready',          // 캡션+고객(또는 연결 스킵) → 게시 준비
    PUBLISHED:      'published',       // 게시 완료
  };

  // 상태별 표시 메타 (배지 텍스트 + 색 클래스 — workspace-v2.css 와 매핑)
  var META = {
    upload_pending: { label: '업로드 대기', tone: 'gray',  group: 'progress' },
    needs_edit:     { label: '보정 필요',   tone: 'pink',  group: 'progress' },
    needs_caption:  { label: '캡션 필요',   tone: 'pink',  group: 'progress' },
    needs_customer: { label: '고객 연결',   tone: 'blue',  group: 'progress' },
    ready:          { label: '게시 준비',   tone: 'amber', group: 'ready'    },
    published:      { label: '게시 완료',   tone: 'green', group: 'done'     },
  };

  // 다음 추천 작업 (상태 → {key, label}); key 는 Phase 2 어댑터 라우팅에 사용
  var NEXT = {
    upload_pending: { key: 'upload',   label: '사진 추가' },
    needs_edit:     { key: 'edit',     label: '보정 / 템플릿' },
    needs_caption:  { key: 'caption',  label: '캡션 생성' },
    needs_customer: { key: 'customer', label: '고객 연결' },
    ready:          { key: 'publish',  label: '게시 준비' },
    published:      { key: 'done',     label: '완료' },
  };

  function _hasText(v) { return !!(v && String(v).trim()); }

  function deriveStatus(slot) {
    if (!slot) return STATUS.UPLOAD_PENDING;
    // 명시적 게시 완료 우선 (기존 스키마: status==='published' / instagramPublished)
    if (slot.status === 'published' || slot.instagramPublished) return STATUS.PUBLISHED;
    // 수동 override 존중 (Phase 4 에서 사용)
    if (slot.wsStatus && META[slot.wsStatus]) return slot.wsStatus;

    var photos = slot.photos || [];
    if (!photos.length) return STATUS.UPLOAD_PENDING;

    var anyEdited  = photos.some(function (p) { return p && _hasText(p.editedDataUrl); });
    var hasCaption = _hasText(slot.caption);
    var hasCustomer = !!slot.customer_id;

    if (!anyEdited && !hasCaption) return STATUS.NEEDS_EDIT;
    if (!hasCaption)               return STATUS.NEEDS_CAPTION;
    if (!hasCustomer)              return STATUS.NEEDS_CUSTOMER;
    return STATUS.READY;
  }

  function statusMeta(status) {
    return META[status] || META.upload_pending;
  }

  function nextAction(slot) {
    return NEXT[deriveStatus(slot)] || NEXT.upload_pending;
  }

  // 코어스 필터 그룹 (V2 홈 상단 탭): all / progress / ready / done
  function filterGroup(slot) {
    return statusMeta(deriveStatus(slot)).group;
  }

  window.WorkspaceState = {
    STATUS: STATUS,
    deriveStatus: deriveStatus,
    statusMeta: statusMeta,
    nextAction: nextAction,
    filterGroup: filterGroup,
  };
})();
