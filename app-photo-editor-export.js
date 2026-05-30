/* 사진 편집기 — 저장/다음 단계 모듈 (2026-05-19 v206.5 분할)
   책임:
     • PNG/JPG/WebP/2배 고화질/피드+스토리 세트 저장
     • 저장 후 캡션/고객기록/인스타 미리보기 다음 단계 모달
*/
(function () {
  'use strict';

  function _getOption(format) {
    if (format === 'jpg') return { mime: 'image/jpeg', ext: 'jpg', quality: 0.95, scale: 1, label: 'JPG' };
    if (format === 'webp') return { mime: 'image/webp', ext: 'webp', quality: 0.9, scale: 1, label: 'WebP' };
    if (format === 'png2') return { mime: 'image/png', ext: 'png', quality: 0.95, scale: 2, label: '2배 고화질 PNG' };
    return { mime: 'image/png', ext: 'png', quality: 0.95, scale: 1, label: 'PNG' };
  }

  async function _save(format, state, helpers) {
    if (!state || !state.originalImg) return _toast(helpers, '편집할 사진이 없어요');
    const cv = document.getElementById('peCanvas');
    if (!cv) return;
    if (format === 'set') return _savePostSet(cv, state, helpers);
    if (format === 'feed') return _saveSingleRatio(cv, 1080, 1350, 'feed-4x5', state, helpers);
    if (format === 'story') return _saveSingleRatio(cv, 1080, 1920, 'story-9x16', state, helpers);
    const opt = _getOption(format);
    const exportCv = _makeExportCanvas(cv, opt.scale);
    exportCv.toBlob((blob) => _finishSave(blob, exportCv, opt, state, helpers), opt.mime, opt.quality);
  }

  function _saveSingleRatio(cv, w, h, name, state, helpers) {
    const out = _makeCoverCanvas(cv, w, h);
    _downloadCanvas(out, 'itdasy-' + name + '-' + Date.now() + '.png');
    _toast(helpers, name + ' 저장 완료 (' + w + '×' + h + ')');
    if (state) state._savedAtCursor = state.historyCursor;
    _notifyExport();
  }

  function _savePostSet(cv, state, helpers) {
    const feed = _makeCoverCanvas(cv, 1080, 1350);
    const story = _makeCoverCanvas(cv, 1080, 1920);
    _downloadCanvas(feed, 'itdasy-feed-4x5-' + Date.now() + '.png');
    _downloadCanvas(story, 'itdasy-story-9x16-' + Date.now() + '.png');
    _toast(helpers, '피드+스토리 2장 저장 완료');
    if (state) state._savedAtCursor = state.historyCursor;
    _notifyExport();
    _showNextSteps(story, state, helpers);
  }

  function _makeCoverCanvas(src, width, height) {
    const out = document.createElement('canvas');
    out.width = width; out.height = height;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#0c0c10';
    ctx.fillRect(0, 0, width, height);
    const fit = _coverRect(src.width, src.height, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, fit.sx, fit.sy, fit.sw, fit.sh, 0, 0, width, height);
    return out;
  }

  function _coverRect(srcW, srcH, outW, outH) {
    const srcAR = srcW / srcH, outAR = outW / outH;
    if (srcAR > outAR) {
      const sw = Math.round(srcH * outAR);
      return { sx: Math.round((srcW - sw) / 2), sy: 0, sw, sh: srcH };
    }
    const sh = Math.round(srcW / outAR);
    return { sx: 0, sy: Math.round((srcH - sh) / 2), sw: srcW, sh };
  }

  function _downloadCanvas(cv, filename) {
    cv.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
    }, 'image/png', 0.95);
  }

  function _finishSave(blob, exportCv, opt, state, helpers) {
    if (!blob) return _toast(helpers, '저장 실패 — 다시 시도해 주세요');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'itdasy-edit-' + Date.now() + '.' + opt.ext;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
    _toast(helpers, opt.label + ' 저장 완료');
    if (state) state._savedAtCursor = state.historyCursor;
    _notifyExport();
    _showNextSteps(exportCv, state, helpers);
  }

  function _makeExportCanvas(cv, scale) {
    if (!scale || scale === 1) return cv;
    const out = document.createElement('canvas');
    out.width = Math.round(cv.width * scale);
    out.height = Math.round(cv.height * scale);
    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cv, 0, 0, out.width, out.height);
    return out;
  }

  function _notifyExport() {
    try {
      window.dispatchEvent(new CustomEvent('itdasy:gallery:photo-replaced', {
        detail: { kind: 'export_marketing_image', source: 'photo-editor' },
      }));
    } catch (err) {
      console.warn('[photo-export] 저장 알림 실패:', err);
    }
    // [T-101] 잇비 "방금 작업" 컨텍스트.
    try { window.ItdasyAssistantContext && window.ItdasyAssistantContext.markRecentAction('사진 저장'); } catch (_e) { void 0; }
  }

  function _showNextSteps(cv, state, helpers) {
    document.getElementById('peNextStepsModal')?.remove();
    const dataUrl = _safeDataUrl(cv);
    const modal = document.createElement('div');
    modal.id = 'peNextStepsModal';
    modal.className = 'pe-modal';
    modal.innerHTML = _nextStepsHTML(dataUrl);
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => _onNextStepClick(e, modal, dataUrl, state, helpers));
  }

  function _nextStepsHTML(dataUrl) {
    return `<div class="pe-modal-backdrop" data-pe-ns="close"></div><div class="pe-modal-card">
      <div class="pe-modal-head"><strong>저장 완료! 다음에 뭘 할까요?</strong><button type="button" class="pe-iconbtn" data-pe-ns="close" aria-label="닫기">×</button></div>
      ${dataUrl ? `<div class="pe-modal-thumb"><img src="${dataUrl}" alt="편집본 미리보기" /></div>` : ''}
      <div class="pe-modal-actions"><button type="button" class="pe-action-btn" data-pe-ns="caption">✨ 캡션 만들기</button><button type="button" class="pe-action-btn" data-pe-ns="attach">📎 고객 기록에 첨부</button><button type="button" class="pe-action-btn" data-pe-ns="instagram">📷 인스타 미리보기</button></div>
      <div class="pe-hint" style="text-align:center;margin-top:10px;">다시 편집하려면 닫고 슬라이더를 조정하세요.</div></div>`;
  }

  function _onNextStepClick(e, modal, dataUrl, state, helpers) {
    const act = e.target.closest('[data-pe-ns]')?.dataset.peNs;
    if (!act) return;
    if (act === 'close') return modal.remove();
    modal.remove();
    if (act === 'caption') _openCaption(helpers);
    else if (act === 'attach') _attachToCustomer(dataUrl, state, helpers);
    else if (act === 'instagram') _openInstagram(dataUrl, state, helpers);
  }

  // [T-003 2026-05-29] 편집본을 고객 시술기록에 연결 (로컬 갤러리 + 백엔드 graceful).
  // [T-119-A 2026-05-31] attachPhotoToCustomer() 결과를 받아 중복/서버실패를 명확히 안내.
  //   기존엔 결과를 무시해 중복·서버실패에도 "연결했어요"만 떴음. assistant/photo-flow 와 동일 수준으로 정합.
  //   성공/완전실패는 TreatmentLink 가 이미 토스트를 띄우므로 이중 표시를 피해 중복·서버실패만 추가 안내.
  async function _attachToCustomer(dataUrl, state, helpers) {
    if (!(window.TreatmentLink && typeof window.TreatmentLink.attachPhotoToCustomer === 'function')) {
      return _toast(helpers, '고객 연결 모듈을 불러오는 중이에요. 잠시 후 다시 시도해주세요');
    }
    let res;
    try {
      res = await window.TreatmentLink.attachPhotoToCustomer({
        dataUrl: dataUrl,
        serviceName: (state && state.serviceName) || '',
        price: (state && state.price) || 0,
        customerId: (state && state.customerId) || null,
        source: 'photoeditor_attach',
      });
    } catch (err) {
      console.warn('[photo-export] 고객 첨부 실패:', err);
      return _toast(helpers, '고객 기록 저장 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요');
    }
    if (!res || res.cancelled) return;   // 고객 선택 취소 → 조용히 종료(기존 동작 유지)
    if (res.wasDuplicate) {
      _toast(helpers, '이미 고객 기록에 저장된 사진이라 중복 저장하지 않았어요.');
    } else if (res.local === true && res.remote === false) {
      _toast(helpers, '고객 기록(로컬)에는 저장했지만 서버 동기화는 실패했어요. 네트워크가 안정되면 다시 시도해 주세요.');
    }
    // 성공(local && remote)·완전실패(!ok)는 TreatmentLink 가 이미 토스트를 띄우므로 추가하지 않는다.
  }

  function _openCaption(helpers) {
    if (typeof window.openCaptionScenarioPopup !== 'function') return _toast(helpers, '캡션 모듈을 찾을 수 없어요');
    try {
      window.openCaptionScenarioPopup();
      _toast(helpers, '캡션 시나리오를 열었어요');
    } catch (err) {
      console.warn('[photo-export] 캡션 열기 실패:', err);
      _toast(helpers, '캡션 화면을 여는 중 문제가 생겼어요');
    }
  }

  function _openInstagram(dataUrl, state, helpers) {
    if (typeof window.openInstagramPreview === 'function') {
      try {
        window.openInstagramPreview({ ratio: (state && state.ratio) || '1:1', src: dataUrl });
      } catch (err) {
        console.warn('[photo-export] 인스타 미리보기 실패:', err);
        _toast(helpers, '인스타 미리보기 화면을 여는 중 문제가 생겼어요');
      }
    } else if (typeof window.showTab === 'function') {
      window.showTab('finish');
      _toast(helpers, '마무리 탭으로 이동했어요');
    } else {
      _toast(helpers, '인스타 미리보기 화면을 찾을 수 없어요');
    }
  }

  function _safeDataUrl(cv) {
    try { return cv.toDataURL('image/png'); }
    catch (err) {
      console.warn('[photo-export] 미리보기 생성 실패:', err);
      return '';
    }
  }

  function _toast(helpers, message) {
    if (helpers && typeof helpers.toast === 'function') helpers.toast(message);
  }

  window.PhotoEditorExport = { save: _save };
})();
