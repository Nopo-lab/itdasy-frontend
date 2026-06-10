(function () {
  'use strict';

  function esc(deps, value) {
    return deps.esc ? deps.esc(value) : String(value == null ? '' : value);
  }

  function svg(deps, id, size) {
    return deps.svg ? deps.svg(id, size) : '';
  }

  function metaFor(deps, kind) {
    return deps.catMeta ? deps.catMeta(kind) : { icon: 'ic-check', label: kind || '작업', color: '#666' };
  }

  function summaryFor(deps, action) {
    return deps.summarizeItem ? deps.summarizeItem(action) : ((action && action.confirmation_text) || '');
  }

  function unifiedStats(flat) {
    const total = flat.length;
    const doneCount = flat.filter(f => f.it.status === 'done').length;
    const failedCount = flat.filter(f => f.it.status === 'failed').length;
    const skippedCount = flat.filter(f => f.it.skipped).length;
    return {
      total,
      doneCount,
      failedCount,
      skippedCount,
      allTouched: (doneCount + failedCount + skippedCount) >= total && total > 0,
    };
  }

  function renderDoneCard(deps, label) {
    return `<div style="margin-top:8px;padding:12px 14px;background:var(--surface);border:0.5px solid var(--border);border-radius:14px;display:flex;align-items:center;gap:8px;">
      <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#E2F8EB;color:#0F8746;">${svg(deps, 'ic-check', 13)}</span>
      <span style="font-size:12px;font-weight:700;color:#0F8746;">${esc(deps, label)}</span>
    </div>`;
  }

  function unifiedDoneLabel(stats) {
    if (stats.failedCount) return `${stats.doneCount}건 저장 · ${stats.failedCount}건 실패`;
    if (stats.skippedCount) return `${stats.doneCount}건 저장 · ${stats.skippedCount}건 제외`;
    return `${stats.total}건 모두 저장 완료`;
  }

  function unifiedRowState(deps, f, meta) {
    // [2026-05-26] 아이콘 색 무채(var(--text-subtle)) — ic-wallet(매출)만 로즈 강조
    const baseIconColor = (f.kind === 'create_revenue') ? 'var(--brand-strong)' : 'var(--text-subtle)';
    const base = { rowBg: 'transparent', rowOpacity: 1, statusRight: '' };
    if (f.it.status === 'done') {
      return {
        ...base,
        statusRight: '<span style="font-size:11px;color:#0F8746;font-weight:700;flex-shrink:0;">완료</span>',
        icon: `<span style="width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:#0F8746;">${svg(deps, 'ic-check-circle', 14)}</span>`,
      };
    }
    if (f.it.status === 'failed') {
      return {
        ...base,
        statusRight: '<span style="font-size:11px;color:#E5484D;font-weight:700;flex-shrink:0;">실패</span>',
        icon: `<span style="width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:#E5484D;">${svg(deps, 'ic-x', 14)}</span>`,
      };
    }
    if (f.it.status === 'running') {
      return {
        ...base,
        statusRight: `<span style="font-size:11px;color:var(--text-muted);font-weight:700;flex-shrink:0;">저장 중…</span>`,
        icon: `<span style="width:18px;height:18px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;"><span style="display:inline-block;width:12px;height:12px;border:2px solid #C5CBD2;border-top-color:#191F28;border-radius:50%;animation:asst-spin 0.8s linear infinite;"></span></span>`,
      };
    }
    return {
      ...base,
      rowOpacity: f.it.skipped ? 0.45 : 1,
      statusRight: f.it.skipped ? '<span style="font-size:11px;color:var(--text-subtle);font-weight:700;flex-shrink:0;">제외</span>' : '',
      icon: `<span style="width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:${baseIconColor};">${svg(deps, meta.icon, 16)}</span>`,
    };
  }

  function unifiedRow(deps, f, isLast) {
    const meta = metaFor(deps, f.kind);
    const state = unifiedRowState(deps, f, meta);
    const errorLine = (f.it.status === 'failed' && f.it.errorMsg)
      ? `<div style="font-size:11px;color:#E5484D;margin-top:2px;line-height:1.4;">사유: ${esc(deps, f.it.errorMsg)}</div>`
      : '';
    const sep = isLast ? '' : 'border-bottom:0.5px solid var(--border);';
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 2px;${sep}opacity:${state.rowOpacity};">
      ${state.icon}
      <div style="flex:1;min-width:0;font-size:13px;line-height:1.4;letter-spacing:-0.2px;">
        <span style="font-weight:500;color:var(--text);">${esc(deps, meta.label)}</span>
        <span style="color:var(--text-muted);"> · ${esc(deps, summaryFor(deps, f.it.action))}</span>
        ${errorLine}
      </div>
      ${state.statusRight}
    </div>`;
  }

  function unifiedProgressLine(deps, historyIdx, progress, stats) {
    // id 부여 — _runUnifiedAll 에서 textContent / width 부분갱신
    let txt;
    let pct = 0;
    if (progress) {
      txt = (progress.label || '진행 중') + ' · ' + progress.current + '/' + progress.total;
      pct = progress.total ? Math.round((progress.current / progress.total) * 100) : 0;
    } else if (stats.allTouched) {
      txt = `완료 ${stats.doneCount} · 실패 ${stats.failedCount} · 제외 ${stats.skippedCount}`;
      pct = 100;
    } else {
      txt = `${stats.total}건을 한 번에 추가할 수 있어요`;
    }
    return `<div id="unifiedProgress-${historyIdx}" style="font-size:11px;color:var(--text-subtle);margin-top:2px;letter-spacing:-0.2px;">${esc(deps, txt)}</div>
      <div id="unifiedProgressBar-${historyIdx}" style="margin-top:6px;height:3px;background:var(--surface-2);border-radius:2px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:var(--brand);transition:width .25s ease;"></div>
      </div>`;
  }

  function unifiedHeader(deps, historyIdx, progress, stats) {
    // [2026-05-26] ic-list-checks 인라인 SVG (sprite 미등록 — Lucide list-checks paths)
    const iconListChecks = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 17 5 19 8 16"/><polyline points="3 7 5 9 8 6"/><line x1="11" y1="8" x2="21" y2="8"/><line x1="11" y1="16" x2="21" y2="16"/></svg>';
    return `<div style="padding:12px 14px;background:var(--surface);">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;color:var(--text-subtle);">${iconListChecks}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:500;color:var(--text);letter-spacing:-0.2px;">한 번에 추가할 내용 <span style="color:var(--text-subtle);font-weight:400;">(${stats.total}건)</span></div>
          ${unifiedProgressLine(deps, historyIdx, progress, stats)}
        </div>
      </div>
    </div>`;
  }

  function unifiedControls(deps, historyIdx, progress, stats, flat) {
    const running = !!progress;
    const hasRemaining = flat.some(f => !f.it.skipped && f.it.status !== 'done' && f.it.status !== 'running');
    const touched = stats.doneCount + stats.failedCount + stats.skippedCount > 0;
    const runLabel = running ? `진행 중 ${progress.current}/${progress.total}`
      : (touched && hasRemaining ? `${svg(deps, 'ic-check', 13)} 남은 항목 추가하기` : `${svg(deps, 'ic-check', 13)} 전체 추가하기`);
    return `<div id="unifiedControls-${historyIdx}" style="display:flex;gap:6px;padding:12px 14px 14px;">
      <button data-unified-edit="${historyIdx}" ${running ? 'disabled' : ''} style="flex:1;padding:11px;border:0.5px solid var(--border-strong);border-radius:10px;background:var(--surface);color:var(--text-muted);font-weight:600;cursor:${running ? 'not-allowed' : 'pointer'};font-size:13px;opacity:${running ? 0.5 : 1};">수정</button>
      <button data-unified-runall="${historyIdx}" ${running || !hasRemaining ? 'disabled' : ''} class="asst-unified-runbtn" style="flex:2;padding:11px;border:none;border-radius:10px;background:#3D434D;color:#FFFFFF;font-weight:700;cursor:${running || !hasRemaining ? 'not-allowed' : 'pointer'};font-size:13px;opacity:${running || !hasRemaining ? 0.6 : 1};display:inline-flex;align-items:center;justify-content:center;gap:5px;letter-spacing:-0.2px;">${runLabel}</button>
    </div>`;
  }

  function unifiedStyle() {
    return `<style>
      .asst-unified-runbtn:hover:not(:disabled) { background: #4A5260 !important; }
      @keyframes asst-spin { to { transform: rotate(360deg); } }
    </style>`;
  }

  function renderUnifiedCard(msg, historyIdx, deps) {
    const flat = deps.unifiedExecutionOrder ? deps.unifiedExecutionOrder(msg.action_groups || []) : [];
    const stats = unifiedStats(flat);
    const progress = msg.unified_progress;
    if (stats.allTouched && !progress) return renderDoneCard(deps, unifiedDoneLabel(stats));
    const rowsHtml = flat.map((f, i) => unifiedRow(deps, f, i === flat.length - 1)).join('');
    return `<div style="margin-top:8px;background:var(--surface);border:0.5px solid var(--border);border-left:3px solid var(--brand);border-radius:0 12px 12px 0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
      ${unifiedHeader(deps, historyIdx, progress, stats)}
      <div style="padding:2px 14px;display:flex;flex-direction:column;">${rowsHtml}</div>
      ${unifiedControls(deps, historyIdx, progress, stats, flat)}
    </div>${unifiedStyle()}`;
  }

  function groupHeaderLine(group, done, skipped, remaining, meta) {
    if (group.bulkProgress) {
      return `<div style="font-size:11px;color:${meta.color};font-weight:700;margin-top:2px;">진행 중 · ${group.bulkProgress.current}/${group.bulkProgress.total} 완료</div>`;
    }
    return (done || skipped)
      ? `<div style="font-size:11px;color:#888;margin-top:2px;">완료 ${done} · 제외 ${skipped} · 남음 ${remaining}</div>`
      : '';
  }

  function groupHeader(deps, group, total, done, skipped, remaining, meta) {
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:${meta.color}22;color:${meta.color};">${svg(deps, meta.icon, 16)}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:800;color:#222;">${esc(deps, meta.label)} <span style="color:${meta.color};">(${total}건)</span></div>
        ${groupHeaderLine(group, done, skipped, remaining, meta)}
      </div>
    </div>`;
  }

  function groupControls(deps, group, historyIdx, gIdx, remaining, done, skipped, meta) {
    const toggleIcon = group.expanded ? svg(deps, 'ic-chevron-down', 13) : svg(deps, 'ic-edit-3', 13);
    const runIcon = svg(deps, 'ic-check', 13);
    const runText = group.bulkProgress
      ? `진행 중 ${group.bulkProgress.current}/${group.bulkProgress.total}`
      : (done + skipped > 0 ? `${runIcon} 남은 ${remaining}개 추가` : `${runIcon} 전체 추가`);
    return `<div style="display:flex;gap:6px;">
      <button data-group-toggle="${historyIdx}:${gIdx}" style="flex:1;padding:9px;border:1px solid ${meta.color};border-radius:10px;background:#fff;color:${meta.color};font-weight:800;cursor:pointer;font-size:12px;display:inline-flex;align-items:center;justify-content:center;gap:5px;">${toggleIcon} ${group.expanded ? '접기' : '수정하기'}</button>
      <button data-group-runall="${historyIdx}:${gIdx}" ${group.bulkProgress ? 'disabled' : ''} style="flex:2;padding:9px;border:none;border-radius:10px;background:${meta.color};color:#fff;font-weight:800;cursor:${group.bulkProgress ? 'not-allowed' : 'pointer'};font-size:12px;opacity:${group.bulkProgress ? 0.6 : 1};display:inline-flex;align-items:center;justify-content:center;gap:5px;">${runText}</button>
    </div>`;
  }

  function groupRowsHtml(deps, group, historyIdx, gIdx, duplicateWarnings, meta) {
    if (!group.expanded) return '';
    const rows = group.items.map((it, iIdx) => {
      const rowHtml = renderGroupRow(it, historyIdx, gIdx, iIdx, meta, deps);
      const warnHtml = (it.origIdx != null && !it.skipped && it.status !== 'done' && deps.renderDuplicateWarnings)
        ? deps.renderDuplicateWarnings(historyIdx, duplicateWarnings, it.origIdx)
        : '';
      return `${warnHtml}${rowHtml}`;
    }).join('');
    return `<div style="margin-top:10px;padding-top:10px;border-top:1px dashed hsl(220,15%,88%);display:flex;flex-direction:column;gap:8px;">${rows}</div>
      <div style="height:10px;"></div>`;
  }

  function groupDuplicateBanner(deps, group, duplicateWarnings) {
    if (group.expanded || !Array.isArray(duplicateWarnings) || !duplicateWarnings.length) return '';
    const origIdxSet = new Set(group.items.map(it => it.origIdx));
    const hits = duplicateWarnings.filter(w => !w.dismissed && origIdxSet.has(w.action_index));
    if (!hits.length) return '';
    return `<div style="margin-bottom:8px;padding:8px 10px;background:#FFF7ED;border:1px solid #FDBA74;border-radius:10px;font-size:11px;color:#C2410C;font-weight:700;display:inline-flex;align-items:center;gap:5px;">
      ${svg(deps, 'ic-alert-triangle', 12)} 중복 의심 ${hits.length}건 — '수정하기' 눌러서 확인하세요
    </div>`;
  }

  function renderActionGroup(group, historyIdx, gIdx, duplicateWarnings, deps) {
    const meta = metaFor(deps, group.kind);
    const total = group.items.length;
    const done = group.items.filter(it => it.status === 'done').length;
    const skipped = group.items.filter(it => it.skipped).length;
    const remaining = total - done - skipped;
    const allDone = total > 0 && (done + skipped) >= total && done > 0;
    if (allDone) {
      const label = skipped ? `${meta.label} ${done}건 추가됨 (${skipped}건 제외)` : `${meta.label} ${done}건 모두 추가됨`;
      return renderDoneCard(deps, label);
    }
    return `<div style="margin-top:6px;padding:12px;background:#fff;border:1px solid ${meta.color};border-radius:14px;">
      ${groupHeader(deps, group, total, done, skipped, remaining, meta)}
      ${groupDuplicateBanner(deps, group, duplicateWarnings)}
      ${groupRowsHtml(deps, group, historyIdx, gIdx, duplicateWarnings, meta)}
      ${groupControls(deps, group, historyIdx, gIdx, remaining, done, skipped, meta)}
    </div>`;
  }

  function rowDone(deps, it) {
    return `<div style="padding:9px 10px;border-radius:10px;background:hsl(145,45%,96%);border:1px solid hsl(145,45%,85%);font-size:12px;color:hsl(145,50%,30%);font-weight:700;display:inline-flex;align-items:center;gap:5px;width:100%;box-sizing:border-box;">
      ${svg(deps, 'ic-check', 12)} <span>${esc(deps, summaryFor(deps, it.action))}</span>
    </div>`;
  }

  function rowFailed(deps, it, key, meta) {
    const errLine = it.errorMsg
      ? `<div style="font-size:11px;color:hsl(0,60%,35%);background:hsl(0,70%,98%);padding:6px 8px;border-radius:8px;margin-bottom:6px;line-height:1.4;">사유: ${esc(deps, it.errorMsg)}</div>`
      : '';
    return `<div style="padding:9px 10px;border-radius:10px;background:hsl(0,70%,96%);border:1px solid hsl(0,70%,85%);">
      <div style="font-size:12px;color:hsl(0,70%,40%);font-weight:700;margin-bottom:6px;display:inline-flex;align-items:center;gap:5px;">${svg(deps, 'ic-x', 12)} <span>실패 — ${esc(deps, summaryFor(deps, it.action))}</span></div>
      ${errLine}
      <button data-row-run="${key}" style="padding:6px 10px;border:1px solid ${meta.color};border-radius:8px;background:#fff;color:${meta.color};font-size:11px;font-weight:700;cursor:pointer;">다시 시도</button>
    </div>`;
  }

  function rowSkipped(deps, it, key, iIdx) {
    return `<div style="padding:9px 10px;border-radius:10px;background:#f5f5f5;border:1px dashed #ccc;opacity:0.55;display:flex;align-items:center;gap:8px;">
      <div style="flex:1;font-size:12px;color:#888;text-decoration:line-through;">${iIdx + 1}. ${esc(deps, summaryFor(deps, it.action))}</div>
      <button data-row-unskip="${key}" style="padding:5px 9px;border:1px solid #ccc;border-radius:8px;background:#fff;color:var(--text-muted);font-size:11px;font-weight:700;cursor:pointer;">되돌리기</button>
    </div>`;
  }

  function confidenceBadge(deps, action) {
    const conf = (action && typeof action.confidence === 'number') ? action.confidence : null;
    if (conf === null || conf >= 0.9) return '';
    const pct = Math.round(conf * 100);
    if (conf < 0.7) {
      return `<span style="display:inline-block;margin-left:6px;padding:1px 6px;background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:4px;font-size:11px;font-weight:700;">⚠️ 확인 필요 ${pct}%</span>`;
    }
    return `<span style="display:inline-block;margin-left:6px;padding:1px 6px;background:#fefce8;color:#a16207;border:1px solid #fde68a;border-radius:4px;font-size:11px;font-weight:600;">참고 ${pct}%</span>`;
  }

  function fieldHtml(deps, key, field, label, val, extra) {
    if (val === undefined) return '';
    const ex = extra || {};
    if (ex.select) return selectFieldHtml(deps, key, field, label, val);
    const type = ex.type || 'text';
    return `<div style="display:flex;align-items:center;gap:6px;">
      <span style="width:50px;font-size:11px;color:#888;font-weight:700;">${label}</span>
      <input data-row-field="${key}:${field}" type="${type}" value="${esc(deps, val == null ? '' : val)}" style="flex:1;padding:6px 8px;border:1px solid hsl(220,15%,85%);border-radius:8px;font-size:11px;background:#fff;" />
    </div>`;
  }

  function selectFieldHtml(deps, key, field, label, val) {
    const options = deps.categoryOptionsHtml ? deps.categoryOptionsHtml(val) : '';
    return `<div style="display:flex;align-items:center;gap:6px;">
      <span style="width:50px;font-size:11px;color:#888;font-weight:700;">${label}</span>
      <select data-row-field="${key}:${field}" style="flex:1;padding:6px 8px;border:1px solid hsl(220,15%,85%);border-radius:8px;font-size:11px;background:#fff;">
        <option value=""${val ? '' : ' selected'}>선택</option>
        ${options}
      </select>
    </div>`;
  }

  function inventoryEditor(deps, key, p, meta) {
    if (!Array.isArray(p.items)) p.items = [];
    const memo = ('memo' in p) ? fieldHtml(deps, key, 'memo', '메모', p.memo) : '';
    return {
      fields: [],
      itemsHtml: `<div style="font-size:11px;font-weight:700;color:#888;margin-bottom:2px;">품목</div>
        ${deps.renderItemsEditor(key, p.items, { fieldAttr: 'row-field', addAttr: 'row-item-add', delAttr: 'row-item-delete', color: meta.color, compact: true })}${memo}`,
    };
  }

  function expenseEditor(deps, key, p, meta) {
    if (!Array.isArray(p.items)) p.items = [];
    if (!Array.isArray(p.adjustments)) p.adjustments = [];
    return {
      fields: [
        fieldHtml(deps, key, 'vendor', '가게', p.vendor == null ? '' : p.vendor),
        fieldHtml(deps, key, 'amount', '결제', p.amount == null ? '' : p.amount, { type: 'number' }),
        fieldHtml(deps, key, 'category', '분류', p.category == null ? '' : p.category, { select: true }),
        fieldHtml(deps, key, 'memo', '메모', p.memo == null ? '' : p.memo),
      ],
      itemsHtml: `<div style="font-size:11px;font-weight:700;color:#888;margin:8px 0 2px;">품목 (정가)</div>
        ${deps.renderItemsEditor(key, p.items, { fieldAttr: 'row-field', addAttr: 'row-item-add', delAttr: 'row-item-delete', color: meta.color, compact: true })}
        <div style="font-size:11px;font-weight:700;color:#888;margin:8px 0 2px;">할인·쿠폰·포인트</div>
        ${deps.renderAdjustmentsEditor(key, p.adjustments, { fieldAttr: 'row-field', addAttr: 'row-adjustment-add', delAttr: 'row-adjustment-delete', color: meta.color, compact: true })}
        ${deps.renderExpenseSummary(p)}`,
    };
  }

  function defaultEditor(deps, key, it, p) {
    const fields = [];
    if ('customer_name' in p || 'name' in p) fields.push(fieldHtml(deps, key, 'customer_name', '이름', p.customer_name ?? p.name));
    if ('customer_phone' in p || 'phone' in p) fields.push(fieldHtml(deps, key, 'customer_phone', '전화', p.customer_phone ?? p.phone));
    if ('service_name' in p) fields.push(fieldHtml(deps, key, 'service_name', '시술', p.service_name));
    if ('amount' in p) fields.push(fieldHtml(deps, key, 'amount', '금액', p.amount));
    if ('starts_at' in p) fields.push(fieldHtml(deps, key, 'starts_at', '시작', p.starts_at));
    if ('memo' in p) fields.push(fieldHtml(deps, key, 'memo', '메모', p.memo));
    if (!fields.length) fields.push(fallbackConfirmationField(deps, key, it));
    return { fields, itemsHtml: '' };
  }

  function fallbackConfirmationField(deps, key, it) {
    return `<div style="display:flex;align-items:center;gap:6px;">
      <span style="width:50px;font-size:11px;color:#888;font-weight:700;">내용</span>
      <input data-row-field="${key}:confirmation_text" value="${esc(deps, it.action.confirmation_text || '')}" style="flex:1;padding:6px 8px;border:1px solid hsl(220,15%,85%);border-radius:8px;font-size:11px;" />
    </div>`;
  }

  function editContent(deps, key, it, p, meta) {
    if (!it.editing) return { fields: [], itemsHtml: '' };
    const kind = it.action && it.action.kind;
    if (kind === 'upsert_inventory') return inventoryEditor(deps, key, p, meta);
    if (kind === 'create_expense') return expenseEditor(deps, key, p, meta);
    return defaultEditor(deps, key, it, p);
  }

  function rowButtons(deps, key, editing, meta) {
    if (editing) {
      return `<div style="display:flex;gap:6px;margin-top:4px;">
        <button data-row-save="${key}" style="flex:1;padding:7px;border:none;border-radius:8px;background:${meta.color};color:#fff;font-weight:700;cursor:pointer;font-size:11px;display:inline-flex;align-items:center;justify-content:center;gap:4px;">${svg(deps, 'ic-save', 12)} 저장</button>
        <button data-row-editcancel="${key}" style="flex:1;padding:7px;border:1px solid #ddd;border-radius:8px;background:#fff;color:var(--text-muted);font-weight:700;cursor:pointer;font-size:11px;">취소</button>
      </div>`;
    }
    return `<div style="display:flex;gap:6px;margin-top:4px;">
      <button data-row-run="${key}" style="flex:1;padding:7px;border:none;border-radius:8px;background:${meta.color};color:#fff;font-weight:700;cursor:pointer;font-size:11px;display:inline-flex;align-items:center;justify-content:center;gap:4px;">${svg(deps, 'ic-check', 12)} 추가</button>
      <button data-row-edit="${key}" style="flex:1;padding:7px;border:1px solid #ddd;border-radius:8px;background:#fff;color:#555;font-weight:700;cursor:pointer;font-size:11px;display:inline-flex;align-items:center;justify-content:center;gap:4px;">${svg(deps, 'ic-edit-3', 12)} 편집</button>
      <button data-row-skip="${key}" style="flex:1;padding:7px;border:1px solid #ddd;border-radius:8px;background:#fff;color:#888;font-weight:700;cursor:pointer;font-size:11px;display:inline-flex;align-items:center;justify-content:center;gap:4px;">${svg(deps, 'ic-trash-2', 12)} 제외</button>
    </div>`;
  }

  function rowEditable(deps, it, key, iIdx, meta) {
    const p = (it.action && it.action.payload) || {};
    const content = editContent(deps, key, it, p, meta);
    const head = `<div style="font-size:12px;color:#222;font-weight:700;">${iIdx + 1}. ${esc(deps, summaryFor(deps, it.action))}${confidenceBadge(deps, it.action)}</div>`;
    const status = it.status === 'running'
      ? `<div style="font-size:11px;color:${meta.color};font-weight:700;margin-top:2px;">저장 중…</div>`
      : '';
    return `<div style="padding:9px 10px;border-radius:10px;background:hsl(340,100%,99%);border:1px solid hsl(340,30%,92%);display:flex;flex-direction:column;gap:6px;">
      ${head}
      ${status}
      ${it.editing && content.fields.length ? `<div style="display:flex;flex-direction:column;gap:4px;">${content.fields.join('')}</div>` : ''}
      ${it.editing ? content.itemsHtml : ''}
      ${rowButtons(deps, key, it.editing === true, meta)}
    </div>`;
  }

  function renderGroupRow(it, historyIdx, gIdx, iIdx, meta, deps) {
    const key = `${historyIdx}:${gIdx}:${iIdx}`;
    if (it.status === 'done') return rowDone(deps, it);
    if (it.status === 'failed') return rowFailed(deps, it, key, meta);
    if (it.skipped) return rowSkipped(deps, it, key, iIdx);
    return rowEditable(deps, it, key, iIdx, meta);
  }

  window.ItdasyAssistantCardRenderers = {
    renderUnifiedCard,
    renderActionGroup,
    renderGroupRow,
  };
}());
