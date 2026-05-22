/* AI 잇비 — 단일 액션 카드 버튼 처리
   수정/저장/취소/품목/할인 버튼 경로를 app-assistant.js에서 분리. */
(function () {
  'use strict';

  function _bodyContains(el) {
    const body = document.getElementById('asstBody');
    return !!(el && body && body.contains(el));
  }

  function _safeToast(message) {
    if (typeof window.showToast === 'function') window.showToast(message);
  }

  function _parseIndex(value) {
    return parseInt(value, 10);
  }

  function _backupPayload(msg) {
    if (msg.action_orig_payload) return;
    try {
      msg.action_orig_payload = JSON.parse(JSON.stringify(msg.action.payload || {}));
    } catch (_e) {
      msg.action_orig_payload = {};
    }
  }

  function _flushSingleFields(idx, msg, deps) {
    const body = document.getElementById('asstBody');
    if (!body || !msg || !msg.action) return;
    if (!msg.action.payload) msg.action.payload = {};
    const inputs = body.querySelectorAll(`[data-single-field^="${idx}:"]`);
    inputs.forEach(inp => {
      const parts = inp.getAttribute('data-single-field').split(':');
      deps.applyEditField(msg.action, parts.slice(1).join(':'), inp.value);
    });
  }

  function _handleRun(e, deps) {
    const el = e.target.closest('[data-action-run]');
    if (!el || !_bodyContains(el)) return false;
    deps.runAction(_parseIndex(el.dataset.actionRun));
    return true;
  }

  function _handleCancel(e, deps) {
    const el = e.target.closest('[data-action-cancel]');
    if (!el || !_bodyContains(el)) return false;
    const msg = deps.history[_parseIndex(el.dataset.actionCancel)];
    if (msg) {
      msg.action_status = 'cancelled';
      msg.action = null;
      msg.edit_mode = false;
    }
    deps.renderHistory();
    return true;
  }

  function _handleEdit(e, deps) {
    const el = e.target.closest('[data-action-edit]');
    if (!el || !_bodyContains(el)) return false;
    const msg = deps.history[_parseIndex(el.dataset.actionEdit)];
    if (!msg || !msg.action) return true;
    if (msg.action_status === 'running' || msg.action_status === 'done') {
      _safeToast('이미 처리 중이거나 완료된 작업입니다');
      return true;
    }
    _backupPayload(msg);
    msg.edit_mode = true;
    deps.renderHistory();
    return true;
  }

  function _handleSave(e, deps) {
    const el = e.target.closest('[data-action-save]');
    if (!el || !_bodyContains(el)) return false;
    const idx = _parseIndex(el.dataset.actionSave);
    const msg = deps.history[idx];
    if (msg && msg.action) {
      _flushSingleFields(idx, msg, deps);
      deps.stripEmptyItems(msg.action.payload);
      deps.stripEmptyAdjustments(msg.action.payload);
      msg.edit_mode = false;
      deps.renderHistory();
    }
    return true;
  }

  function _handleItemAdd(e, deps) {
    const el = e.target.closest('[data-single-item-add]');
    if (!el || !_bodyContains(el)) return false;
    const idx = _parseIndex(el.dataset.singleItemAdd);
    const msg = deps.history[idx];
    if (msg && msg.action) {
      deps.flushSingleInputs(idx);
      if (!msg.action.payload) msg.action.payload = {};
      if (!Array.isArray(msg.action.payload.items)) msg.action.payload.items = [];
      msg.action.payload.items.push({ name: '', quantity: 1 });
      deps.renderHistory();
    }
    return true;
  }

  function _handleItemDelete(e, deps) {
    const el = e.target.closest('[data-single-item-delete]');
    if (!el || !_bodyContains(el)) return false;
    const [idx, iItem] = el.dataset.singleItemDelete.split(':').map(_parseIndex);
    const msg = deps.history[idx];
    if (msg && msg.action && msg.action.payload && Array.isArray(msg.action.payload.items)) {
      deps.flushSingleInputs(idx);
      msg.action.payload.items.splice(iItem, 1);
      deps.renderHistory();
    }
    return true;
  }

  function _handleAdjustmentAdd(e, deps) {
    const el = e.target.closest('[data-single-adjustment-add]');
    if (!el || !_bodyContains(el)) return false;
    const idx = _parseIndex(el.dataset.singleAdjustmentAdd);
    const msg = deps.history[idx];
    if (msg && msg.action) {
      deps.flushSingleInputs(idx);
      if (!msg.action.payload) msg.action.payload = {};
      if (!Array.isArray(msg.action.payload.adjustments)) msg.action.payload.adjustments = [];
      msg.action.payload.adjustments.push({ kind: '', amount: 0 });
      deps.renderHistory();
    }
    return true;
  }

  function _handleAdjustmentDelete(e, deps) {
    const el = e.target.closest('[data-single-adjustment-delete]');
    if (!el || !_bodyContains(el)) return false;
    const [idx, iAdj] = el.dataset.singleAdjustmentDelete.split(':').map(_parseIndex);
    const msg = deps.history[idx];
    if (msg && msg.action && msg.action.payload && Array.isArray(msg.action.payload.adjustments)) {
      deps.flushSingleInputs(idx);
      msg.action.payload.adjustments.splice(iAdj, 1);
      deps.renderHistory();
    }
    return true;
  }

  function _handleEditCancel(e, deps) {
    const el = e.target.closest('[data-action-editcancel]');
    if (!el || !_bodyContains(el)) return false;
    const msg = deps.history[_parseIndex(el.dataset.actionEditcancel)];
    if (msg && msg.action) {
      if (msg.action_orig_payload) {
        try { msg.action.payload = JSON.parse(JSON.stringify(msg.action_orig_payload)); }
        catch (_e) { void _e; }
      }
      msg.edit_mode = false;
      deps.renderHistory();
    }
    return true;
  }

  function handleClick(e, deps) {
    return _handleRun(e, deps)
      || _handleCancel(e, deps)
      || _handleEdit(e, deps)
      || _handleSave(e, deps)
      || _handleItemAdd(e, deps)
      || _handleItemDelete(e, deps)
      || _handleAdjustmentAdd(e, deps)
      || _handleAdjustmentDelete(e, deps)
      || _handleEditCancel(e, deps);
  }

  window.ItdasyAssistantSingleActions = { handleClick };
})();
