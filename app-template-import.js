/* 외부 템플릿 가져오기 (P1-B 2026-06-09)
   기존 가격표/홍보물 이미지를 올리면 → 백엔드 OCR(/templates/extract-ocr)로 문구·가격만 추출
   → "확인 카드" 로 보여주고 → 사용자가 [이 내용으로 카드 만들기] 누르면
   우리 editable 가격표 템플릿에 slotValues 로 주입(기존 _applyPriceSample 경로 재사용).

   정책:
   - 디자인 복제 금지. 원본 이미지는 배경으로 넣지 않음. 텍스트 내용만 재구성.
   - OCR 결과를 바로 적용하지 않고 확인 카드 먼저.
   - 기존 /services/import-pricelist 사용 안 함. ServiceTemplate DB 저장 안 함.
   - raw_text 는 디버그용으로 접어둠(개인정보/토큰 로그 금지).

   외부 노출: window.openTemplateImport()  — 업로드 시트 열기 */
(function () {
  'use strict';
  if (window.openTemplateImport) return;

  const PURPOSE_LABEL = { price: '가격표', review: '후기', before_after: '전후', promo: '홍보물' };

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
  function _toast(msg, type) {
    if (window.showToast) window.showToast(msg, type);
  }

  // OCR services({name,price,desc,duration_min}) → 우리 slotValues services 형태로 정규화.
  //   matcher.parsePriceServices 와 동일 항목({name,desc,price,badge,origPrice}). origPrice 는 OCR 미제공 → ''.
  function _normalizeServices(list) {
    return (Array.isArray(list) ? list : [])
      .map(s => {
        const price = String((s && s.price) || '').trim();
        // 백엔드가 needs_price 를 주거나 가격이 비면 '가격 확인 필요' 행으로 표시(버리지 않음).
        const needsPrice = !!(s && s.needs_price) || !price || price === '문의';
        return {
          name: String((s && s.name) || '').trim(),
          desc: String((s && s.desc) || '').trim(),
          price,
          badge: '',
          origPrice: '',
          duration: (s && typeof s.duration_min === 'number' && s.duration_min > 0) ? s.duration_min : '',
          needsPrice,
        };
      })
      .filter(s => s.name);   // 이름만 있으면 유지 — 가격 미확정 행도 살려 사용자가 채우게 함
  }

  // OCR 응답 → _applyPriceSample 이 받는 payload 형태.
  function _toPricePayload(ocr) {
    const sv = {
      services: _normalizeServices(ocr.services),
    };
    if (ocr.shop_name) sv.shop_name = String(ocr.shop_name).slice(0, 24);
    if (ocr.headline) sv.headline = String(ocr.headline).slice(0, 20);
    if (ocr.subtitle) sv.subtitle = String(ocr.subtitle).slice(0, 60);
    if (ocr.cta) sv.cta = String(ocr.cta).slice(0, 16);
    if (ocr.phone) sv.phone = String(ocr.phone).slice(0, 20);
    return {
      purpose: 'price',
      industry: ocr.industry || 'common',
      templateId: '',            // _applyPriceSample 내부에서 기본/bp/fallback 선택(v426 우선순위)
      slotValues: sv,
      autoApplyEligible: true,
    };
  }

  // ── 시트 ──────────────────────────────────────────────
  function _ensureSheet() {
    let sheet = document.getElementById('tplImportSheet');
    if (sheet) return sheet;
    sheet = document.createElement('div');
    sheet.id = 'tplImportSheet';
    sheet.className = 'tpli-overlay';
    sheet.innerHTML = `
      <div class="tpli-card" id="tplImportCard">
        <div class="tpli-head">
          <strong>가격표·홍보물로 카드 만들기</strong>
          <button id="tpliClose" class="tpli-x" aria-label="닫기">&times;</button>
        </div>
        <div class="tpli-desc">
          기존 가격표·홍보물 사진을 올리면 AI 가 <b>글자(시술·가격·문구)만</b> 읽어서
          우리 템플릿으로 새로 만들어 드려요. (사진 디자인은 복제하지 않아요)
        </div>
        <div id="tpliUpload" class="tpli-upload">
          <span class="tpli-upload-ic"><svg width="28" height="28" aria-hidden="true"><use href="#ic-image-plus"/></svg></span>
          <div class="tpli-upload-t">탭해서 사진 선택</div>
          <div class="tpli-upload-s">JPG · PNG · 6MB 이하</div>
          <input id="tpliFile" type="file" accept="image/*" style="display:none;">
        </div>
        <div id="tpliProgress" class="tpli-progress" style="display:none;">
          <span class="tpli-spin"></span>
          <span>AI 가 가격표 읽는 중… (5~15초)</span>
        </div>
        <div id="tpliResult" class="tpli-result" style="display:none;"></div>
      </div>`;
    document.body.appendChild(sheet);

    const close = () => _close();
    sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); });
    sheet.querySelector('#tpliClose').addEventListener('click', close);
    const up = sheet.querySelector('#tpliUpload');
    const fileInp = sheet.querySelector('#tpliFile');
    up.addEventListener('click', () => fileInp.click());
    fileInp.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) _upload(f);
    });
    return sheet;
  }

  function _open() {
    const sheet = _ensureSheet();
    sheet.querySelector('#tpliUpload').style.display = 'flex';
    sheet.querySelector('#tpliProgress').style.display = 'none';
    const rb = sheet.querySelector('#tpliResult');
    rb.style.display = 'none';
    rb.innerHTML = '';
    sheet.classList.add('on');
    document.body.style.overflow = 'hidden';
  }
  function _close() {
    const sheet = document.getElementById('tplImportSheet');
    if (!sheet) return;
    sheet.classList.remove('on');
    document.body.style.overflow = '';
  }

  // ── 업로드 → OCR 호출 ─────────────────────────────────
  async function _upload(file) {
    const sheet = document.getElementById('tplImportSheet');
    if (!sheet) return;
    const up = sheet.querySelector('#tpliUpload');
    const prog = sheet.querySelector('#tpliProgress');
    const rb = sheet.querySelector('#tpliResult');
    up.style.display = 'none';
    rb.style.display = 'none';
    prog.style.display = 'flex';

    try {
      let blob = file;
      if (typeof window.compressImageForUpload === 'function') {
        try { blob = await window.compressImageForUpload(file, 1280, 0.85); } catch (_e) { blob = file; }
      }
      const fd = new FormData();
      fd.append('file', blob, 'pricelist.jpg');
      const res = await window.apiFetch('/templates/extract-ocr', {
        method: 'POST',
        headers: (window.authHeader && window.authHeader()) || {},
        body: fd,
      });
      let data = {};
      try { data = await res.json(); } catch (_e) { data = {}; }

      if (res.status === 401) { _renderError('로그인이 필요해요. 다시 로그인 후 시도해 주세요.'); return; }
      if (res.status === 413) { _renderError('사진이 너무 커요. 6MB 이하로 줄여서 올려 주세요.'); return; }
      if (res.status === 422) { _renderError(data.detail || '가격표를 인식하지 못했어요. 더 선명한 사진으로 다시 시도해 주세요.', true); return; }
      if (!res.ok) { _renderError((data && data.detail) || '인식에 실패했어요. 잠시 후 다시 시도해 주세요.', true); return; }

      _renderResult(data);
    } catch (e) {
      try { console.warn('[template-import] 업로드 실패', (e && e.name) || 'err'); } catch (_le) { void _le; }
      _renderError('네트워크 연결을 확인하고 다시 시도해 주세요.', true);
    }
  }

  // ── 확인 카드 렌더 ───────────────────────────────────
  function _renderResult(ocr) {
    const sheet = document.getElementById('tplImportSheet');
    if (!sheet) return;
    sheet.querySelector('#tpliProgress').style.display = 'none';
    const rb = sheet.querySelector('#tpliResult');
    rb.style.display = 'block';

    const purpose = ocr.purpose || 'promo';
    const services = _normalizeServices(ocr.services);

    // price 가 아니거나 시술 0건이면 → 폴백(이번 P1-B 는 가격표만 적용).
    if (purpose !== 'price' || !services.length) {
      const why = purpose !== 'price'
        ? `${PURPOSE_LABEL[purpose] || '홍보물'}로 보여요. 지금은 가격표 사진만 카드로 만들 수 있어요.`
        : '시술·가격을 찾지 못했어요. 가격표가 또렷하게 보이는 사진으로 다시 올려 주세요.';
      _renderError(why, true);
      return;
    }

    const conf = typeof ocr.confidence === 'number' ? ocr.confidence : 0;
    const lowConf = conf > 0 && conf < 0.5;
    const needCnt = services.filter(s => s.needsPrice).length;
    const rows = services.slice(0, 12).map(s => `
      <div class="tpli-srow${s.needsPrice ? ' tpli-srow-need' : ''}">
        <span class="tpli-sname">${_esc(s.name)}</span>
        <span class="tpli-sprice${s.needsPrice ? ' tpli-sprice-need' : ''}">${_esc(s.price || '가격 확인 필요')}</span>
      </div>`).join('');
    const moreN = services.length > 12 ? (services.length - 12) : 0;

    const meta = [];
    if (ocr.shop_name) meta.push(`매장: ${_esc(ocr.shop_name)}`);
    if (ocr.phone) meta.push(`전화: ${_esc(ocr.phone)}`);

    rb.innerHTML = `
      <div class="tpli-okhead">
        <strong>가격표를 인식했어요</strong>
        <span class="tpli-count">시술 ${services.length}개</span>
      </div>
      ${meta.length ? `<div class="tpli-meta">${meta.join(' · ')}</div>` : ''}
      ${lowConf ? `<div class="tpli-warn">인식 정확도가 낮아요. 카드 만든 뒤 문구·가격을 꼭 확인해 주세요.</div>` : ''}
      ${needCnt ? `<div class="tpli-warn">가격을 못 읽은 시술 ${needCnt}개가 있어요. 카드 만든 뒤 가격을 채워 주세요.</div>` : ''}
      <div class="tpli-list">${rows}${moreN ? `<div class="tpli-more">외 ${moreN}개 더</div>` : ''}</div>
      <details class="tpli-raw"><summary>인식 원문 보기</summary><div>${_esc((ocr.raw_text || '').slice(0, 500))}</div></details>
      <div class="tpli-actions">
        <button id="tpliMake" class="tpli-primary">이 내용으로 카드 만들기</button>
        <button id="tpliRetry" class="tpli-secondary">다시 올리기</button>
        <button id="tpliCancel" class="tpli-ghost">취소</button>
      </div>`;

    rb.querySelector('#tpliMake').addEventListener('click', () => _makeCard(ocr));
    rb.querySelector('#tpliRetry').addEventListener('click', _open);
    rb.querySelector('#tpliCancel').addEventListener('click', _close);
  }

  function _renderError(msg, retryable) {
    const sheet = document.getElementById('tplImportSheet');
    if (!sheet) return;
    sheet.querySelector('#tpliProgress').style.display = 'none';
    const rb = sheet.querySelector('#tpliResult');
    rb.style.display = 'block';
    rb.innerHTML = `
      <div class="tpli-err">${_esc(msg)}</div>
      <div class="tpli-actions">
        ${retryable ? '<button id="tpliRetry" class="tpli-primary">다시 올리기</button>' : ''}
        <button id="tpliCancel" class="tpli-ghost">닫기</button>
      </div>`;
    const r = rb.querySelector('#tpliRetry'); if (r) r.addEventListener('click', _open);
    rb.querySelector('#tpliCancel').addEventListener('click', _close);
  }

  // ── 적용: 우리 가격표 템플릿에 slotValues 주입 (기존 경로 재사용) ──
  function _makeCard(ocr) {
    const apply = window.ItdasyAssistantApplyPriceSample;
    if (typeof apply !== 'function') { _toast('편집기를 불러오는 중이에요. 잠시 후 다시 시도해 주세요.'); return; }
    _close();
    try {
      apply(_toPricePayload(ocr));   // _applyPriceSample → PE.open + apply + 슬롯주입 + 편집시트 + 저장배선
    } catch (e) {
      try { console.warn('[template-import] 적용 실패', (e && e.name) || 'err'); } catch (_le) { void _le; }
      _toast('카드를 만들지 못했어요. 다시 시도해 주세요.');
    }
  }

  window.openTemplateImport = _open;
})();
