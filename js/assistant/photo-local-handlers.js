/* AI 잇비 — 백엔드 없는 사진 작업 안전 처리
   서버에 아직 없는 사진 액션은 사진편집기/고객 선택 화면으로 우회한다. */
(function () {
  'use strict';

  const PHOTO_KIND_META = {
    adjust_photo: { icon: 'ic-sliders', label: '사진 보정', color: '#7C3AED' },
    add_text_overlay: { icon: 'ic-type', label: '텍스트 추가', color: '#0EA5E9' },
    add_watermark: { icon: 'ic-stamp', label: '워터마크', color: '#D58A95' },
    export_marketing_image: { icon: 'ic-download', label: '마케팅 이미지', color: '#2563EB' },
    attach_photo_to_customer: { icon: 'ic-user-plus', label: '고객 사진 연결', color: '#14B8A6' },
    analyze_photo_and_recommend_edit: { icon: 'ic-sparkles', label: '사진 추천 보정', color: '#F59E0B' },
    prepare_instagram_post_bundle: { icon: 'ic-instagram', label: '인스타 세트', color: '#E11D48' },
  };

  function _toast(msg) {
    if (typeof window.showToast === 'function') window.showToast(msg);
  }

  function _payload(action) {
    return (action && action.payload) || {};
  }

  function _openEditor(payload, tab) {
    const opts = Object.assign({}, payload || {}, { initial_tab: tab || 'auto' });
    if (typeof window.openPhotoEditorFromAction === 'function') {
      return window.openPhotoEditorFromAction(opts);
    }
    if (window.PhotoEditor && typeof window.PhotoEditor.openFromAction === 'function') {
      window.PhotoEditor.openFromAction(opts);
      return true;
    }
    _toast('사진 편집기를 불러오는 중이에요. 잠시 후 다시 눌러주세요');
    return false;
  }

  function _ensureWatermark(payload) {
    const text = payload.watermark_text || payload.text || '';
    if (!text || !window.BrandKit || typeof window.BrandKit.save !== 'function') return;
    window.BrandKit.save({ watermark_text: text, watermark_position: 'br', watermark_opacity: 0.82 });
  }

  async function _pickCustomer() {
    if (!window.Customer || typeof window.Customer.pick !== 'function') return null;
    try { return await window.Customer.pick({}); }
    catch (_e) { return null; }
  }

  function _recommendMessage(payload) {
    const target = payload.service_name ? `${payload.service_name} 사진` : '이 사진';
    return `${target}은 먼저 자연스럽게 밝기와 선명도를 맞춘 뒤, 필요하면 템플릿이나 캡션까지 이어가면 좋아요.`;
  }

  function _registerOne(api, kind, handler) {
    if (typeof api.registerLocalHandler === 'function') api.registerLocalHandler(kind, handler);
  }

  function _register(api) {
    if (!api || typeof api.registerLocalHandler !== 'function') return false;
    if (typeof api.registerKindMeta === 'function') api.registerKindMeta(PHOTO_KIND_META);
    _registerOne(api, 'adjust_photo', async action => {
      _openEditor(_payload(action), 'tune');
      return { message: '사진 보정 화면을 열었어요' };
    });
    _registerOne(api, 'add_text_overlay', async action => {
      _openEditor(_payload(action), 'text');
      return { message: '텍스트 넣는 화면을 열었어요' };
    });
    _registerOne(api, 'add_watermark', async action => {
      const payload = _payload(action);
      _ensureWatermark(payload);
      _openEditor(payload, 'brand');
      return { message: '워터마크 화면을 열었어요' };
    });
    _registerOne(api, 'export_marketing_image', async action => {
      _openEditor(Object.assign({ preset: 'instagram_feed' }, _payload(action)), 'export');
      return { message: '저장·내보내기 화면을 열었어요' };
    });
    _registerOne(api, 'attach_photo_to_customer', async _action => {
      const picked = await _pickCustomer();
      if (picked && typeof window.openFinishTab === 'function') window.openFinishTab();
      return { message: picked ? `${picked.name || '고객'}님 사진 연결 화면을 열었어요` : '고객 선택을 취소했어요' };
    });
    _registerOne(api, 'analyze_photo_and_recommend_edit', async action => ({ message: _recommendMessage(_payload(action)) }));
    _registerOne(api, 'prepare_instagram_post_bundle', async action => {
      _openEditor(Object.assign({ intent: 'instagram' }, _payload(action)), 'tune');
      return { message: '인스타용 보정 화면을 열었어요. 저장 후 캡션까지 이어가면 돼요' };
    });
    return true;
  }

  if (!_register(window.ItdasyAssistant)) {
    let tries = 0;
    const iv = setInterval(() => {
      if (_register(window.ItdasyAssistant) || ++tries > 50) clearInterval(iv);
    }, 100);
  }
})();
