/* 사진 → 고객 시술기록 연결 (T-003/T-004 · 2026-05-29)
   잇데이 정체성 핵심 루프: 보정한 사진을 고객 카드에 귀속시킨다.

   설계:
   - 로컬 우선: 편집본을 갤러리에 customer_id 로 저장 → 오프라인에서도 동작, 대시보드 타임라인의 1차 소스.
   - 백엔드 결선: POST /treatments 로 시술기록 메타 행 생성 (graceful — 실패해도 로컬은 유지).
   - 백엔드 treatments.photos 는 photo_id/URL 을 기대(base64 불가)하므로, 사진 자체는 로컬 갤러리에 두고
     백엔드엔 메타(고객·날짜·서비스·가격)만 보낸다. 대시보드가 둘을 합쳐 보여준다(T-005).

   진입점: photo-editor 저장 후 "고객 기록에 첨부", 잇비 attach_photo_to_customer / create_treatment_record. */
(function () {
  'use strict';

  function _toast(msg, type) { if (typeof window.showToast === 'function') window.showToast(msg, type); }
  function _uid() {
    if (typeof window._uid === 'function') { try { return window._uid(); } catch (_e) { void 0; } }
    return 'tl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  async function _pickCustomer(selectedId) {
    if (!window.Customer || typeof window.Customer.pick !== 'function') {
      _toast('고객 모듈을 불러오는 중이에요. 잠시 후 다시 시도해주세요');
      return null;
    }
    try { return await window.Customer.pick(selectedId ? { selectedId } : {}); }
    catch (_e) { return null; }
  }

  // 편집본을 로컬 갤러리에 고객 연결로 저장. dataUrl 없으면 건너뜀.
  async function _saveLocal(opts, cust) {
    if (typeof window.saveToGallery !== 'function' || !opts.dataUrl) return null;
    try {
      return await window.saveToGallery({
        id: _uid(),
        label: opts.serviceName || '시술 사진',
        photos: [{ id: _uid(), dataUrl: opts.dataUrl, mode: 'after' }],
        caption: '',
        hashtags: '',
        customer_id: cust.id,
        customer_name: cust.name || '',
      });
    } catch (_e) { return null; }
  }

  // 백엔드 시술기록 메타 행 생성 (graceful).
  async function _createBackend(opts, cust) {
    if (typeof window.apiFetch !== 'function') return { ok: false };
    try {
      const auth = (typeof window.authHeader === 'function') ? window.authHeader() : {};
      const body = { customer_id: cust.id, performed_at: new Date().toISOString() };
      if (opts.serviceName) body.service_name = opts.serviceName;
      if (opts.price) body.price = +opts.price || 0;
      if (opts.memo) body.memo = opts.memo;
      const res = await window.apiFetch('/treatments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify(body),
      });
      return { ok: !!(res && res.ok), status: res && res.status };
    } catch (_e) { return { ok: false }; }
  }

  // 메인: 사진 → 고객 선택(또는 지정) → 로컬 저장 + 백엔드 결선.
  //   opts.customer = {id, name} 가 오면 picker 생략 (잇비 액션 payload 에 고객이 이미 있는 경우).
  async function attachPhotoToCustomer(opts) {
    opts = opts || {};
    const cust = (opts.customer && opts.customer.id != null)
      ? { id: opts.customer.id, name: opts.customer.name || '' }
      : await _pickCustomer(opts.customerId);
    if (!cust) return { ok: false, cancelled: true };
    const local = await _saveLocal(opts, cust);
    const remote = await _createBackend(opts, cust);
    try {
      window.dispatchEvent(new CustomEvent('itdasy:treatments:changed', { detail: { customer_id: cust.id } }));
    } catch (_e) { void 0; }
    const name = cust.name || '고객';
    if (local || remote.ok) _toast(`${name}님 기록에 사진을 연결했어요`, 'success');
    else _toast(`${name}님을 선택했지만 저장에 실패했어요`, 'error');
    return { ok: !!(local || remote.ok), customer: cust, local: !!local, remote: remote.ok };
  }

  window.TreatmentLink = { attachPhotoToCustomer };
})();
