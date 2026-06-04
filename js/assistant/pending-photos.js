/* AI 잇비 — 사진 첨부 대기 UI
   app-assistant.js 본체가 커지지 않도록 사진 미리보기와 종류 버튼만 분리한다. */
(function () {
  'use strict';

  const PHOTO_CHIPS = [
    { key: 'enhance', label: '홍보용 이미지 만들기', text: '이 사진 인스타 홍보용으로 예쁘게 해줘' },
    { key: 'card',    label: '인스타 피드용으로',   text: '이 사진 인스타 피드용으로 정리해줘' },
    { key: 'price',   label: '전후 비교 카드로',     text: '이 사진 전후 비교 카드로 만들어줘' },
    { key: 'kakao',   label: '자연스럽게 보정',       text: '이 사진 자연스럽게 보정해줘' },
  ];

  function _escDefault(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  function _chipStyle(on) {
    if (on) {
      return 'flex-shrink:0;padding:6px 12px;border:1px solid rgba(124,58,237,0.65);border-radius:999px;background:#BC6675;color:#fff;font-size:11.5px;font-weight:800;cursor:pointer;white-space:nowrap;box-shadow:0 3px 10px rgba(109,40,217,0.2);';
    }
    return 'flex-shrink:0;padding:6px 12px;border:1px solid rgba(124,58,237,0.25);border-radius:999px;background:#F7EFF0;color:#BC6675;font-size:11.5px;font-weight:700;cursor:pointer;white-space:nowrap;';
  }

  function _wrap() {
    return document.getElementById('asstPending');
  }

  function _renderEmpty(wrap) {
    wrap.style.display = 'none';
    wrap.innerHTML = '';
    wrap.style.flexDirection = '';
    wrap.style.alignItems = '';
  }

  function _thumbHtml(ctx, url, i) {
    return `
      <div style="position:relative;width:54px;height:54px;flex-shrink:0;border-radius:10px;overflow:hidden;background:#f0f0f0;border:1px solid rgba(0,0,0,0.06);">
        <img src="${ctx.esc(url)}" alt="첨부 사진 ${i + 1}" style="width:100%;height:100%;object-fit:cover;display:block;" />
        <button data-pending-remove="${i}" aria-label="제거" style="position:absolute;top:2px;right:2px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,0.65);color:#fff;border:none;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;padding:0;font-weight:700;">×</button>
      </div>
    `;
  }

  function _chipHtml(ctx, chip) {
    const on = ctx.suggestedKind === chip.key;
    return `<button type="button" data-photo-chip="${chip.key}" data-photo-chip-suggested="${on ? '1' : '0'}" style="${_chipStyle(on)}">${on ? '추천 · ' : ''}${chip.label}</button>`;
  }

  function _bindChipClicks(wrap, ctx) {
    wrap.querySelectorAll('[data-photo-chip]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = PHOTO_CHIPS.find(c => c.key === btn.dataset.photoChip);
        const input = document.getElementById('asstInput');
        if (item && input) input.value = item.text;
        if (item && typeof ctx.deps.send === 'function') ctx.deps.send();
      });
    });
  }

  function _bindRemoveClicks(wrap, ctx) {
    wrap.querySelectorAll('[data-pending-remove]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        _removeAt(ctx, parseInt(btn.dataset.pendingRemove, 10));
      });
    });
  }

  function _render(ctx) {
    const wrap = _wrap();
    if (!wrap) return;
    if (!ctx.files.length) { _renderEmpty(wrap); return; }
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.alignItems = 'stretch';
    wrap.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">${ctx.thumbs.map((url, i) => _thumbHtml(ctx, url, i)).join('')}</div>
      <div style="font-size:10.5px;color:#6B7684;font-weight:600;margin-bottom:4px;padding:0 2px;">이 사진은? (탭해서 잇비에게 바로 보내기)</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">${PHOTO_CHIPS.map(chip => _chipHtml(ctx, chip)).join('')}</div>
    `;
    _bindRemoveClicks(wrap, ctx);
    _bindChipClicks(wrap, ctx);
  }

  function _classifyFirst(ctx) {
    const classifier = window.ItdasyAssistantPhotoKind;
    if (!ctx.files[0] || !classifier || typeof classifier.classify !== 'function') return;
    classifier.classify(ctx.files[0]).then(kind => {
      if (!ctx.files.length) return;
      ctx.suggestedKind = kind || 'enhance';
      _render(ctx);
    }).catch(err => { void err; });
  }

  function _add(ctx, inputFiles) {
    const arr = Array.from(inputFiles || []).filter(Boolean);
    const room = 10 - ctx.files.length;
    if (room <= 0) {
      if (typeof window.showToast === 'function') window.showToast('한 번에 최대 10장까지만');
      return;
    }
    arr.slice(0, room).forEach(file => _pushFile(ctx, file));
    _render(ctx);
    _classifyFirst(ctx);
    setTimeout(() => document.getElementById('asstInput')?.focus(), 30);
    if (window.hapticLight) window.hapticLight();
  }

  function _pushFile(ctx, file) {
    ctx.files.push(file);
    try { ctx.thumbs.push(URL.createObjectURL(file)); }
    catch (_e) { ctx.thumbs.push(''); }
  }

  function _removeAt(ctx, index) {
    if (!Number.isInteger(index) || index < 0 || index >= ctx.files.length) return;
    try { URL.revokeObjectURL(ctx.thumbs[index]); } catch (_e) { void _e; }
    ctx.files.splice(index, 1);
    ctx.thumbs.splice(index, 1);
    _render(ctx);
    if (!ctx.files.length) document.getElementById('asstInput')?.focus();
  }

  function _clear(ctx) {
    ctx.thumbs.forEach(url => { try { URL.revokeObjectURL(url); } catch (_e) { void _e; } });
    ctx.files.splice(0, ctx.files.length);
    ctx.thumbs.splice(0, ctx.thumbs.length);
    ctx.suggestedKind = '';
    _render(ctx);
  }

  function create(deps) {
    const ctx = {
      deps: deps || {},
      esc: deps && typeof deps.esc === 'function' ? deps.esc : _escDefault,
      files: [],
      thumbs: [],
      suggestedKind: '',
    };
    return {
      files: ctx.files,
      thumbs: ctx.thumbs,
      render: () => _render(ctx),
      add: inputFiles => _add(ctx, inputFiles),
      removeAt: index => _removeAt(ctx, index),
      clear: () => _clear(ctx),
      snapshotAndClear: () => {
        const copy = ctx.files.slice();
        _clear(ctx);
        return copy;
      },
    };
  }

  window.ItdasyAssistantPendingPhotos = { create, PHOTO_CHIPS };
})();
