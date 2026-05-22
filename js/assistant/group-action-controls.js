/* AI 잇비 — 그룹/통합 액션 카드 버튼 처리
   여러 건 추가 카드와 행별 수정/제외 버튼 경로를 app-assistant.js에서 분리. */
(function () {
  'use strict';

  function _bodyContains(el) {
    const body = document.getElementById('asstBody');
    return !!(el && body && body.contains(el));
  }

  function _nums(value) {
    return String(value || '').split(':').map(n => parseInt(n, 10));
  }

  function _row(deps, hi, gi, ii) {
    return deps.history[hi]?.action_groups?.[gi]?.items?.[ii] || null;
  }

  function _flushRowFields(key, it, deps) {
    const body = document.getElementById('asstBody');
    if (!body || !it || !it.action) return;
    if (!it.action.payload) it.action.payload = {};
    const inputs = body.querySelectorAll(`[data-row-field^="${key}:"]`);
    inputs.forEach(inp => {
      const parts = inp.getAttribute('data-row-field').split(':');
      deps.applyEditField(it.action, parts.slice(3).join(':'), inp.value);
    });
  }

  function _handleFallback(e, deps) {
    const el = e.target.closest('[data-fallback-intent]');
    if (!el || !_bodyContains(el)) return false;
    deps.submitFallback(parseInt(el.dataset.fallbackIdx, 10), el.dataset.fallbackIntent);
    return true;
  }

  function _handleDuplicateProceed(e, deps) {
    const el = e.target.closest('[data-dup-proceed]');
    if (!el || !_bodyContains(el)) return false;
    const [hi, wi] = _nums(el.dataset.dupProceed);
    const msg = deps.history[hi];
    if (msg && Array.isArray(msg.duplicate_warnings) && msg.duplicate_warnings[wi]) {
      msg.duplicate_warnings[wi].dismissed = true;
      deps.renderHistory();
    }
    return true;
  }

  function _skipDuplicateTarget(msg, targetIdx) {
    if (msg.action && targetIdx === 0) {
      msg.action_status = 'cancelled';
      msg.action = null;
      msg.edit_mode = false;
    }
    if (Array.isArray(msg.action_groups)) {
      msg.action_groups.forEach(g => (g.items || []).forEach(it => {
        if (it && it.origIdx === targetIdx) {
          it.skipped = true;
          it.editing = false;
        }
      }));
    }
  }

  function _handleDuplicateSkip(e, deps) {
    const el = e.target.closest('[data-dup-skip]');
    if (!el || !_bodyContains(el)) return false;
    const [hi, wi] = _nums(el.dataset.dupSkip);
    const msg = deps.history[hi];
    const warn = msg && Array.isArray(msg.duplicate_warnings) ? msg.duplicate_warnings[wi] : null;
    if (warn) {
      warn.dismissed = true;
      _skipDuplicateTarget(msg, warn.action_index);
      deps.renderHistory();
    }
    return true;
  }

  function _handleUnifiedRun(e, deps) {
    const el = e.target.closest('[data-unified-runall]');
    if (!el) return false;
    deps.runUnifiedAll(parseInt(el.dataset.unifiedRunall, 10));
    return true;
  }

  function _handleUnifiedEdit(e, deps) {
    const el = e.target.closest('[data-unified-edit]');
    if (!el) return false;
    const msg = deps.history[parseInt(el.dataset.unifiedEdit, 10)];
    if (msg && msg.action_groups) {
      msg.unified_mode = false;
      msg.action_groups.forEach(g => { g.expanded = true; });
      deps.renderHistory();
    }
    return true;
  }

  function _handleGroupToggle(e, deps) {
    const el = e.target.closest('[data-group-toggle]');
    if (!el) return false;
    const [hi, gi] = _nums(el.dataset.groupToggle);
    const g = deps.history[hi]?.action_groups?.[gi];
    if (g) {
      g.expanded = !g.expanded;
      deps.renderHistory();
    }
    return true;
  }

  function _handleGroupRunAll(e, deps) {
    const el = e.target.closest('[data-group-runall]');
    if (!el) return false;
    const [hi, gi] = _nums(el.dataset.groupRunall);
    deps.runGroupAll(hi, gi);
    return true;
  }

  function _handleRowRun(e, deps) {
    const el = e.target.closest('[data-row-run]');
    if (!el || !_bodyContains(el)) return false;
    const [hi, gi, ii] = _nums(el.dataset.rowRun);
    deps.runGroupRow(hi, gi, ii);
    return true;
  }

  function _handleRowEdit(e, deps) {
    const el = e.target.closest('[data-row-edit]');
    if (!el || !_bodyContains(el)) return false;
    const it = _row(deps, ..._nums(el.dataset.rowEdit));
    if (it) {
      it.editing = true;
      deps.renderHistory();
    }
    return true;
  }

  function _handleRowEditCancel(e, deps) {
    const el = e.target.closest('[data-row-editcancel]');
    if (!el || !_bodyContains(el)) return false;
    const it = _row(deps, ..._nums(el.dataset.rowEditcancel));
    if (it) {
      it.editing = false;
      deps.renderHistory();
    }
    return true;
  }

  function _handleRowSave(e, deps) {
    const el = e.target.closest('[data-row-save]');
    if (!el || !_bodyContains(el)) return false;
    const [hi, gi, ii] = _nums(el.dataset.rowSave);
    const it = _row(deps, hi, gi, ii);
    if (it) {
      _flushRowFields(`${hi}:${gi}:${ii}`, it, deps);
      deps.stripEmptyItems(it.action.payload);
      deps.stripEmptyAdjustments(it.action.payload);
      it.editing = false;
      deps.renderHistory();
    }
    return true;
  }

  function _handleRowItemAdd(e, deps) {
    const el = e.target.closest('[data-row-item-add]');
    if (!el || !_bodyContains(el)) return false;
    const [hi, gi, ii] = _nums(el.dataset.rowItemAdd);
    const it = _row(deps, hi, gi, ii);
    if (it) {
      deps.flushRowInputs(hi, gi, ii);
      if (!it.action.payload) it.action.payload = {};
      if (!Array.isArray(it.action.payload.items)) it.action.payload.items = [];
      it.action.payload.items.push({ name: '', quantity: 1 });
      deps.renderHistory();
    }
    return true;
  }

  function _handleRowItemDelete(e, deps) {
    const el = e.target.closest('[data-row-item-delete]');
    if (!el || !_bodyContains(el)) return false;
    const [hi, gi, ii, iItem] = _nums(el.dataset.rowItemDelete);
    const it = _row(deps, hi, gi, ii);
    if (it && it.action?.payload?.items) {
      deps.flushRowInputs(hi, gi, ii);
      it.action.payload.items.splice(iItem, 1);
      deps.renderHistory();
    }
    return true;
  }

  function _handleRowAdjustmentAdd(e, deps) {
    const el = e.target.closest('[data-row-adjustment-add]');
    if (!el || !_bodyContains(el)) return false;
    const [hi, gi, ii] = _nums(el.dataset.rowAdjustmentAdd);
    const it = _row(deps, hi, gi, ii);
    if (it) {
      deps.flushRowInputs(hi, gi, ii);
      if (!it.action.payload) it.action.payload = {};
      if (!Array.isArray(it.action.payload.adjustments)) it.action.payload.adjustments = [];
      it.action.payload.adjustments.push({ kind: '', amount: 0 });
      deps.renderHistory();
    }
    return true;
  }

  function _handleRowAdjustmentDelete(e, deps) {
    const el = e.target.closest('[data-row-adjustment-delete]');
    if (!el || !_bodyContains(el)) return false;
    const [hi, gi, ii, iAdj] = _nums(el.dataset.rowAdjustmentDelete);
    const it = _row(deps, hi, gi, ii);
    if (it && it.action?.payload?.adjustments) {
      deps.flushRowInputs(hi, gi, ii);
      it.action.payload.adjustments.splice(iAdj, 1);
      deps.renderHistory();
    }
    return true;
  }

  function _handleRowSkip(e, deps) {
    const el = e.target.closest('[data-row-skip]');
    if (!el || !_bodyContains(el)) return false;
    const it = _row(deps, ..._nums(el.dataset.rowSkip));
    if (it) {
      it.skipped = true;
      it.editing = false;
      deps.renderHistory();
    }
    return true;
  }

  function _handleRowUnskip(e, deps) {
    const el = e.target.closest('[data-row-unskip]');
    if (!el || !_bodyContains(el)) return false;
    const it = _row(deps, ..._nums(el.dataset.rowUnskip));
    if (it) {
      it.skipped = false;
      deps.renderHistory();
    }
    return true;
  }

  function handleClick(e, deps) {
    return _handleFallback(e, deps)
      || _handleDuplicateProceed(e, deps)
      || _handleDuplicateSkip(e, deps)
      || _handleUnifiedRun(e, deps)
      || _handleUnifiedEdit(e, deps)
      || _handleGroupToggle(e, deps)
      || _handleGroupRunAll(e, deps)
      || _handleRowRun(e, deps)
      || _handleRowEdit(e, deps)
      || _handleRowEditCancel(e, deps)
      || _handleRowSave(e, deps)
      || _handleRowItemAdd(e, deps)
      || _handleRowItemDelete(e, deps)
      || _handleRowAdjustmentAdd(e, deps)
      || _handleRowAdjustmentDelete(e, deps)
      || _handleRowSkip(e, deps)
      || _handleRowUnskip(e, deps);
  }

  window.ItdasyAssistantGroupActions = { handleClick };
})();
