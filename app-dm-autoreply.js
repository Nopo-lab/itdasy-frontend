/* ─────────────────────────────────────────────────────────────
   AI DM 자동응답 — 설정 UI (v1.1 — Meta Advanced Review 통과 후 활성)

   v1.0 현재: 백엔드 스켈레톤 + 이 UI 는 존재하지만 "심사 대기중" 배지 표시.
   v1.1 Meta 심사 통과 후: Railway env DM_AUTOREPLY_ENABLED=true →
     /instagram/dm-reply/status 의 global_enabled=true →
     UI 에서 토글 활성화 → 즉시 작동.
   ──────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  let _globalEnabled = false;  // 서버 상태 캐시

  async function _fetchStatus() {
    try {
      const res = await fetch(window.API + '/instagram/dm-reply/status', { headers: window.authHeader() });
      if (!res.ok) return { global_enabled: false };
      return await res.json();
    } catch (_e) { return { global_enabled: false }; }
  }

  async function _fetchSettings() {
    try {
      const res = await fetch(window.API + '/instagram/dm-reply/settings', { headers: window.authHeader() });
      if (!res.ok) return null;
      return await res.json();
    } catch (_e) { return null; }
  }

  async function _saveSettings(settings) {
    const res = await fetch(window.API + '/instagram/dm-reply/settings', {
      method: 'POST',
      headers: { ...window.authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    return res.ok;
  }

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  async function openDMAutoreplySettings() {
    const status = await _fetchStatus();
    _globalEnabled = !!status.global_enabled;
    const settings = (await _fetchSettings()) || {
      enabled: false, tone: 'friendly',
      blocked_keywords: [], auto_reply_start: '09:00', auto_reply_end: '22:00',
      template_intro: '', template_pricing: '', template_booking: '',
    };

    const overlay = document.createElement('div');
    overlay.id = 'dmAutoreplySheet';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,0.45);display:flex;align-items:flex-end;justify-content:center;animation:dm-bg-in .2s ease;';

    const sheet = document.createElement('div');
    sheet.style.cssText = 'width:100%;max-width:480px;background:#fff;border-radius:24px 24px 0 0;padding:24px 20px;max-height:90vh;overflow-y:auto;box-sizing:border-box;';

    const disabledBanner = _globalEnabled ? '' : `
      <div style="padding:14px;background:#FFF7E6;border:1px solid #FFD666;border-radius:12px;margin-bottom:16px;">
        <div style="font-weight:800;color:#B45309;font-size:13px;margin-bottom:4px;">⏳ Meta 심사 대기중</div>
        <div style="font-size:12px;color:#666;line-height:1.5;">
          DM 자동응답 기능은 Meta Advanced Review 통과 후 활성화됩니다.<br>
          설정은 미리 저장해 두실 수 있고, 심사 통과 즉시 자동으로 적용돼요 (최대 2~3주).
        </div>
      </div>`;

    sheet.innerHTML = `
      <div style="width:36px;height:4px;background:#e0e0e0;border-radius:2px;margin:0 auto 18px;"></div>
      <div style="font-size:17px;font-weight:800;color:#1a1a1a;margin-bottom:6px;">🤖 AI DM 자동응답</div>
      <div style="font-size:12px;color:#888;margin-bottom:16px;">시술 중 온 DM에 AI 비서가 자동으로 답장해요.</div>
      ${disabledBanner}

      <label style="display:flex;align-items:center;justify-content:space-between;padding:14px;background:#FAFAFA;border-radius:12px;margin-bottom:12px;cursor:${_globalEnabled ? 'pointer' : 'not-allowed'};opacity:${_globalEnabled ? '1' : '0.6'};">
        <div>
          <div style="font-weight:700;font-size:14px;">자동응답 켜기</div>
          <div style="font-size:11px;color:#888;margin-top:2px;">켜놓으면 DM 즉시 AI 답장</div>
        </div>
        <input id="dmEnabled" type="checkbox" ${settings.enabled ? 'checked' : ''} ${_globalEnabled ? '' : 'disabled'} style="width:20px;height:20px;">
      </label>

      <div style="margin-bottom:14px;">
        <label style="font-size:12px;font-weight:700;color:#555;">답장 톤</label>
        <select id="dmTone" style="width:100%;margin-top:6px;padding:10px;border:1px solid #ddd;border-radius:10px;font-size:14px;">
          <option value="friendly" ${settings.tone === 'friendly' ? 'selected' : ''}>친근하게 (반말 섞어서)</option>
          <option value="professional" ${settings.tone === 'professional' ? 'selected' : ''}>정중하게 (존댓말)</option>
          <option value="cute" ${settings.tone === 'cute' ? 'selected' : ''}>귀엽게 (이모지 풍부)</option>
        </select>
      </div>

      <div style="margin-bottom:14px;">
        <label style="font-size:12px;font-weight:700;color:#555;">응답 시간 (이 시간 외엔 답장 안 함)</label>
        <div style="display:flex;gap:8px;margin-top:6px;">
          <input id="dmStart" type="time" value="${_esc(settings.auto_reply_start || '09:00')}" style="flex:1;padding:10px;border:1px solid #ddd;border-radius:10px;font-size:14px;">
          <span style="align-self:center;color:#888;">~</span>
          <input id="dmEnd" type="time" value="${_esc(settings.auto_reply_end || '22:00')}" style="flex:1;padding:10px;border:1px solid #ddd;border-radius:10px;font-size:14px;">
        </div>
      </div>

      <div style="margin-bottom:14px;">
        <label style="font-size:12px;font-weight:700;color:#555;">금지어 (쉼표 구분 — 이 단어 포함된 DM 은 사람 대응)</label>
        <input id="dmBlocked" type="text" value="${_esc((settings.blocked_keywords || []).join(', '))}" placeholder="환불, 컴플레인, 부작용" style="width:100%;margin-top:6px;padding:10px;border:1px solid #ddd;border-radius:10px;font-size:14px;box-sizing:border-box;">
        <div style="font-size:10px;color:#999;margin-top:4px;">기본 금지어 자동 포함: 의료·치료·부작용·환불·법적</div>
      </div>

      <details style="margin-bottom:14px;">
        <summary style="font-size:12px;font-weight:700;color:#555;cursor:pointer;padding:8px 0;">AI 실패 시 사용할 템플릿 (선택)</summary>
        <textarea id="dmTplIntro" placeholder="인사말 템플릿" style="width:100%;margin-top:8px;padding:10px;border:1px solid #ddd;border-radius:10px;font-size:13px;box-sizing:border-box;min-height:60px;">${_esc(settings.template_intro || '')}</textarea>
        <textarea id="dmTplPricing" placeholder="가격 문의 템플릿" style="width:100%;margin-top:8px;padding:10px;border:1px solid #ddd;border-radius:10px;font-size:13px;box-sizing:border-box;min-height:60px;">${_esc(settings.template_pricing || '')}</textarea>
        <textarea id="dmTplBooking" placeholder="예약 문의 템플릿" style="width:100%;margin-top:8px;padding:10px;border:1px solid #ddd;border-radius:10px;font-size:13px;box-sizing:border-box;min-height:60px;">${_esc(settings.template_booking || '')}</textarea>
      </details>

      <div style="display:flex;gap:10px;margin-top:20px;">
        <button id="dmCancel" style="flex:1;padding:14px;border:1px solid #ddd;background:#fff;border-radius:12px;font-weight:700;cursor:pointer;">닫기</button>
        <button id="dmSave" style="flex:2;padding:14px;border:none;background:linear-gradient(135deg,#F18091,#D95F70);color:#fff;border-radius:12px;font-weight:800;cursor:pointer;">저장</button>
      </div>
    `;

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    sheet.querySelector('#dmCancel').addEventListener('click', () => overlay.remove());
    sheet.querySelector('#dmSave').addEventListener('click', async () => {
      const payload = {
        enabled: sheet.querySelector('#dmEnabled').checked,
        tone: sheet.querySelector('#dmTone').value,
        blocked_keywords: sheet.querySelector('#dmBlocked').value.split(',').map(s => s.trim()).filter(Boolean),
        auto_reply_start: sheet.querySelector('#dmStart').value || '09:00',
        auto_reply_end: sheet.querySelector('#dmEnd').value || '22:00',
        template_intro: sheet.querySelector('#dmTplIntro').value,
        template_pricing: sheet.querySelector('#dmTplPricing').value,
        template_booking: sheet.querySelector('#dmTplBooking').value,
      };
      const ok = await _saveSettings(payload);
      if (window.showToast) window.showToast(ok ? '저장됐어요' : '저장 실패');
      if (ok) overlay.remove();
    });
  }

  window.openDMAutoreplySettings = openDMAutoreplySettings;
})();
