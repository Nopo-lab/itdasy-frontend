/* Phase 8 B1 — 영수증 / 쿠팡·네이버 주문내역 OCR 스캔 */
(function () {
  'use strict';

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  const KIND_META = {
    expense: {
      title: '💳 영수증 스캔',
      subtitle: '카페·마트·재료비 영수증을 찍으면 AI가 자동으로 금액·품목 추출',
      fields: ['amount', 'vendor', 'category', 'recorded_at', 'memo'],
      labels: { amount: '금액', vendor: '상호', category: '분류', recorded_at: '결제일', memo: '메모' },
      placeholders: { amount: '50000', vendor: '다이소', category: 'materials', recorded_at: '2026-04-23', memo: '젤네일 베이스 3개' },
    },
    inventory_order: {
      title: '📦 주문내역 스캔',
      subtitle: '쿠팡·네이버 주문내역 스크린샷 → AI 가 품목/수량 파싱 → 재고 자동 입고',
      fields: ['item_name', 'quantity', 'unit_price', 'total', 'ordered_at'],
      labels: { item_name: '품목', quantity: '수량', unit_price: '단가', total: '합계', ordered_at: '주문일' },
      placeholders: { item_name: '젤네일 베이스', quantity: '3', unit_price: '12000', total: '36000', ordered_at: '2026-04-23' },
    },
  };

  async function _uploadImage(file, kind) {
    const fd = new FormData();
    fd.append('image', file);
    fd.append('kind', kind);
    const res = await fetch(window.API + '/imports/smart/image', {
      method: 'POST',
      headers: { Authorization: window.authHeader().Authorization },
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'HTTP ' + res.status);
    }
    return await res.json();
  }

  async function _commit(kind, items) {
    const res = await fetch(window.API + '/imports/smart/commit', {
      method: 'POST',
      headers: { ...window.authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, items }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'HTTP ' + res.status);
    }
    return await res.json();
  }

  function _buildItemHtml(it, idx, fields, labels, placeholders) {
    return `
      <div class="rs-item" data-idx="${idx}" style="background:#fff;border:1px solid #eee;border-radius:12px;padding:12px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <input type="checkbox" class="rs-ck" data-idx="${idx}" checked style="width:18px;height:18px;flex-shrink:0;">
          <strong style="font-size:12px;color:#888;">#${idx + 1}</strong>
          <button class="rs-del" data-idx="${idx}" style="margin-left:auto;background:transparent;border:none;color:#aaa;cursor:pointer;font-size:13px;">✕</button>
        </div>
        ${fields.map(f => `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <label style="font-size:11px;color:#666;min-width:56px;">${_esc(labels[f] || f)}</label>
            <input class="rs-fld" data-idx="${idx}" data-field="${f}" type="text"
                   value="${_esc(it[f] == null ? '' : String(it[f]))}"
                   placeholder="${_esc(placeholders[f] || '')}"
                   style="flex:1;padding:7px 10px;border:1px solid #ddd;border-radius:8px;font-size:13px;">
          </div>
        `).join('')}
      </div>`;
  }

  function _collectItems(body, items) {
    const selected = [];
    body.querySelectorAll('.rs-item').forEach(row => {
      const idx = parseInt(row.dataset.idx, 10);
      const ck = row.querySelector('.rs-ck');
      if (!ck || !ck.checked) return;
      const item = { ...items[idx] };
      row.querySelectorAll('.rs-fld').forEach(fld => {
        const f = fld.dataset.field;
        const v = fld.value.trim();
        if (['amount', 'quantity', 'unit_price', 'total'].includes(f)) {
          item[f] = v ? parseInt(v.replace(/[^\d-]/g, ''), 10) || 0 : null;
        } else {
          item[f] = v || null;
        }
      });
      selected.push(item);
    });
    return selected;
  }

  async function _doCommit(body, kind, items) {
    const btn = body.querySelector('.rs-commit');
    const selected = _collectItems(body, items);
    if (!selected.length) {
      if (window.showToast) window.showToast('추가할 항목이 없어요');
      return;
    }
    btn.disabled = true;
    btn.innerHTML = '저장 중…';
    try {
      const res = await _commit(kind, selected);
      if (window.showToast) window.showToast(`✅ ${res.imported}건 저장${res.failed ? ` · 실패 ${res.failed}` : ''}`);
      if (window.hapticSuccess) window.hapticSuccess();
      body.closest('[id="receiptScanSheet"]')?.remove();
      try { sessionStorage.removeItem('pv_cache::inventory'); } catch (_e) { /* ignore */ }
    } catch (e) {
      if (window.showToast) window.showToast('저장 실패: ' + (e.message || ''));
      btn.disabled = false;
      btn.innerHTML = `✨ ${selected.length}개 추가하기`;
    }
  }

  function _renderPreview(overlay, kind, items) {
    const meta = KIND_META[kind];
    const body = overlay.querySelector('.rs-body');

    if (!items.length) {
      body.innerHTML = `
        <div style="padding:40px;text-align:center;color:#888;">
          <div style="font-size:36px;margin-bottom:10px;">🤷</div>
          <div style="font-size:13px;">이미지에서 데이터를 찾지 못했어요</div>
          <div style="font-size:11px;color:#aaa;margin-top:6px;">영수증이 선명한지 확인해주세요</div>
        </div>`;
      return;
    }

    body.innerHTML = `
      <div style="padding:14px 18px 6px;font-size:12px;color:#666;">
        AI 가 <strong>${items.length}개</strong> 항목을 찾았어요. 확인 후 "추가하기" 를 누르세요.
      </div>
      <div class="rs-items" style="padding:0 12px;">
        ${items.map((it, idx) => _buildItemHtml(it, idx, meta.fields, meta.labels, meta.placeholders)).join('')}
      </div>
      <div style="padding:14px 16px;display:flex;gap:10px;position:sticky;bottom:0;background:#fafafa;border-top:1px solid #eee;">
        <button class="rs-cancel" style="flex:1;padding:14px;border:1px solid #ddd;background:#fff;border-radius:12px;font-weight:700;cursor:pointer;">취소</button>
        <button class="rs-commit" style="flex:2;padding:14px;border:none;background:linear-gradient(135deg,#F18091,#D95F70);color:#fff;border-radius:12px;font-weight:800;cursor:pointer;">✨ ${items.length}개 추가하기</button>
      </div>
    `;

    body.querySelectorAll('.rs-del').forEach(btn => {
      btn.addEventListener('click', () => {
        items.splice(parseInt(btn.dataset.idx, 10), 1);
        _renderPreview(overlay, kind, items);
      });
    });
    body.querySelector('.rs-cancel').addEventListener('click', () => overlay.remove());
    body.querySelector('.rs-commit').addEventListener('click', () => _doCommit(body, kind, items));
  }

  async function _handleFileChange(e, overlay, kind) {
    const file = e.target.files[0];
    if (!file) return;
    const body = overlay.querySelector('.rs-body');
    body.innerHTML = `
      <div style="padding:60px 20px;text-align:center;">
        <div style="font-size:36px;animation:rs-pulse 1.2s ease-in-out infinite;">🤖</div>
        <div style="font-size:13px;color:#666;margin-top:10px;">AI 가 이미지를 읽는 중…</div>
        <div style="font-size:11px;color:#aaa;margin-top:4px;">보통 5~15초 걸려요</div>
      </div>
      <style>@keyframes rs-pulse{0%,100%{opacity:.4;}50%{opacity:1;}}</style>`;
    try {
      const res = await _uploadImage(file, kind);
      _renderPreview(overlay, kind, res.items || []);
    } catch (err) {
      body.innerHTML = `
        <div style="padding:40px 20px;text-align:center;color:#c00;">
          <div style="font-size:36px;">😵</div>
          <div style="font-size:13px;margin-top:10px;">OCR 실패: ${_esc(err.message || '')}</div>
        </div>`;
    }
  }

  async function openReceiptScan(kind) {
    kind = kind || 'expense';
    if (!KIND_META[kind]) {
      if (window.showToast) window.showToast('알 수 없는 스캔 종류');
      return;
    }
    const meta = KIND_META[kind];

    const overlay = document.createElement('div');
    overlay.id = 'receiptScanSheet';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,0.5);display:flex;align-items:flex-end;justify-content:center;';

    const sheet = document.createElement('div');
    sheet.style.cssText = 'width:100%;max-width:520px;background:#fafafa;border-radius:24px 24px 0 0;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;';
    sheet.innerHTML = `
      <div style="padding:20px 20px 12px;background:#fff;border-bottom:1px solid #eee;">
        <div style="width:36px;height:4px;background:#e0e0e0;border-radius:2px;margin:0 auto 14px;"></div>
        <div style="display:flex;align-items:center;gap:8px;">
          <strong style="font-size:17px;">${meta.title}</strong>
          <button class="rs-close" style="margin-left:auto;background:none;border:none;font-size:20px;color:#888;cursor:pointer;">✕</button>
        </div>
        <div style="font-size:12px;color:#888;margin-top:4px;">${meta.subtitle}</div>
      </div>
      <div class="rs-body" style="flex:1;overflow-y:auto;">
        <div style="padding:40px 20px;text-align:center;">
          <label for="rs-file-input" style="display:inline-block;padding:14px 22px;background:linear-gradient(135deg,#F18091,#D95F70);color:#fff;border-radius:100px;font-weight:800;cursor:pointer;box-shadow:0 4px 12px rgba(241,128,145,0.3);">
            📷 사진 선택 / 촬영
          </label>
          <input id="rs-file-input" type="file" accept="image/*" capture="environment" style="display:none;">
          <div style="font-size:11px;color:#888;margin-top:14px;">AI 가 이미지에서 자동 추출합니다.</div>
        </div>
      </div>`;
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    overlay.querySelector('.rs-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#rs-file-input').addEventListener('change', (e) => _handleFileChange(e, overlay, kind));
  }

  window.openReceiptScan = openReceiptScan;
  window.openExpenseScan = () => openReceiptScan('expense');
  window.openInventoryOrderScan = () => openReceiptScan('inventory_order');

  // Phase 8 — 통합 선택 UI: 영수증인지 주문내역인지 먼저 고르기
  window.openReceiptScanChooser = function () {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:24px;max-width:380px;width:90%;">
        <strong style="font-size:17px;">📸 무엇을 스캔할까요?</strong>
        <div style="font-size:12px;color:#888;margin-top:4px;margin-bottom:18px;">AI 가 이미지에서 자동으로 데이터를 추출해요</div>
        <button class="rs-chooser-exp" style="width:100%;padding:14px;border:1.5px solid #F18091;background:#fff;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:12px;margin-bottom:10px;">
          <span style="font-size:22px;">💳</span>
          <div style="flex:1;text-align:left;">
            <div style="color:#D95F70;">영수증 스캔</div>
            <div style="font-size:11px;color:#888;font-weight:400;margin-top:2px;">카페·마트·재료비 영수증 → 지출 기록</div>
          </div>
        </button>
        <button class="rs-chooser-ord" style="width:100%;padding:14px;border:1.5px solid #F18091;background:#fff;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:12px;margin-bottom:18px;">
          <span style="font-size:22px;">📦</span>
          <div style="flex:1;text-align:left;">
            <div style="color:#D95F70;">주문내역 스캔</div>
            <div style="font-size:11px;color:#888;font-weight:400;margin-top:2px;">쿠팡·네이버 주문 스크린샷 → 재고 입고</div>
          </div>
        </button>
        <button class="rs-chooser-cancel" style="width:100%;padding:10px;border:1px solid #ddd;background:#fff;border-radius:8px;font-weight:700;cursor:pointer;">닫기</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('.rs-chooser-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('.rs-chooser-exp').addEventListener('click', () => { overlay.remove(); openReceiptScan('expense'); });
    overlay.querySelector('.rs-chooser-ord').addEventListener('click', () => { overlay.remove(); openReceiptScan('inventory_order'); });
  };
})();
