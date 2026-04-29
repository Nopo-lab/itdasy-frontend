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

  // [2026-04-29 C2] 톤별 미리보기 답장 — 사장님이 톤 카드 누르자마자 어떻게 답하는지 확인
  function _tonePreview(tone) {
    const samples = {
      friendly:     '안녕하세요😊 가격 문의 주셔서 감사해요! 시술 종류 알려주시면 바로 답변드릴게요🌷',
      professional: '안녕하세요. 가격 문의 주셔서 감사합니다. 원하시는 시술 알려주시면 안내해 드리겠습니다.',
      cute:         '와아 안녕하세요💗 가격 문의 너무 감사해요🥹 어떤 시술이 궁금하신가요?✨',
    };
    return samples[tone] || samples.friendly;
  }

  async function openDMAutoreplySettings() {
    const status = await _fetchStatus();
    _globalEnabled = !!status.global_enabled;
    const accountReady = status.account_ready !== false;
    const browserTz = (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul');
    const settings = (await _fetchSettings()) || {
      enabled: false, tone: 'friendly',
      blocked_keywords: [], auto_reply_start: '09:00', auto_reply_end: '22:00',
      timezone_name: browserTz,
      template_intro: '', template_pricing: '', template_booking: '',
    };
    settings.timezone_name = settings.timezone_name || browserTz;

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
    const accountBanner = accountReady ? '' : `
      <div style="padding:14px;background:#FEF2F2;border:1px solid #FCA5A5;border-radius:12px;margin-bottom:16px;">
        <div style="font-weight:800;color:#B91C1C;font-size:13px;margin-bottom:4px;">인스타 계정 재확인 필요</div>
        <div style="font-size:12px;color:#666;line-height:1.5;">
          ${status.instagram_connected ? '인스타 토큰은 있지만 DM 받을 계정 ID가 비어 있어요.' : '인스타그램이 아직 연결되지 않았어요.'}<br>
          인스타 다시 연결하기 또는 DM 진단의 user_id 동기화를 먼저 실행해 주세요.
        </div>
      </div>`;

    const _dmInboxAsync = async () => {
      try {
        const res = await fetch(window.API + '/instagram/dm-reply/recent-conversations?limit=10', {
          headers: window.authHeader(),
        });
        if (!res.ok) return;
        const data = await res.json();
        const inbox = sheet.querySelector('#dmInbox');
        if (!inbox || !data.conversations || !data.conversations.length) {
          if (inbox) inbox.innerHTML = `
            <div style="padding:14px;background:#FAFAFA;border-radius:12px;text-align:center;color:#999;font-size:12px;">
              📭 아직 도착한 DM 이 없어요
            </div>`;
          return;
        }
        inbox.innerHTML = `
          <div style="font-size:12px;font-weight:700;color:#555;margin-bottom:8px;">📥 최근 도착 DM (${data.conversations.length}건)</div>
          ${data.conversations.map(c => {
            const replyOk = c.reply?.ok === true;
            const replyTxt = (c.reply?.text || '').replace(/[<>&"]/g,'');
            const recvTxt = (c.received_text || '').replace(/[<>&"]/g,'');
            const senderTail = c.sender_tail || '????';
            const tsTxt = c.ts ? new Date(c.ts).toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit'}) : '';
            return `
              <div style="background:#fff;border:1px solid #e5e5e5;border-radius:10px;padding:10px 12px;margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;font-size:11px;color:#888;margin-bottom:4px;">
                  <span>👤 ...${senderTail}</span>
                  <span>${tsTxt}</span>
                </div>
                <div style="font-size:13px;color:#333;margin-bottom:6px;">${recvTxt}</div>
                ${replyTxt ? `
                  <div style="background:${replyOk ? '#F3E8FF' : '#FEF3C7'};border-radius:8px;padding:8px;font-size:12px;color:${replyOk ? '#6B21A8' : '#92400E'};margin-bottom:6px;">
                    🤖 ${replyTxt}
                  </div>
                  ${replyOk ? `
                    <div style="display:flex;gap:6px;">
                      <button class="dm-fb-good" data-recv="${recvTxt}" data-reply="${replyTxt}" style="flex:1;padding:6px;border:1px solid #10B981;border-radius:6px;background:#fff;color:#10B981;font-size:11px;font-weight:700;cursor:pointer;">👍 좋음</button>
                      <button class="dm-fb-bad" data-recv="${recvTxt}" data-reply="${replyTxt}" style="flex:1;padding:6px;border:1px solid #DC2626;border-radius:6px;background:#fff;color:#DC2626;font-size:11px;font-weight:700;cursor:pointer;">👎 별로</button>
                    </div>
                  ` : ''}
                ` : `
                  <div style="font-size:11px;color:#999;">⏳ 답장 안 감 (영업시간 외 또는 금지어 등)</div>
                `}
              </div>
            `;
          }).join('')}
        `;
        // 피드백 클릭 핸들러
        const _fb = async (recv, reply, rating) => {
          try {
            const r = await fetch(window.API + '/instagram/dm-reply/feedback', {
              method: 'POST',
              headers: { ...window.authHeader(), 'Content-Type': 'application/json' },
              body: JSON.stringify({ received_text: recv, reply_text: reply, rating }),
            });
            const d = await r.json();
            if (d.ok && rating === 'good' && window.showToast) {
              window.showToast('✅ 답변 예시에 추가됐어요 — AI 가 다음부터 이렇게 답장합니다');
            } else if (rating === 'bad' && window.showToast) {
              window.showToast('피드백 기록됐어요');
            }
          } catch (_) { /* ignore */ }
        };
        inbox.querySelectorAll('.dm-fb-good').forEach(b => b.addEventListener('click', () => _fb(b.dataset.recv, b.dataset.reply, 'good')));
        inbox.querySelectorAll('.dm-fb-bad').forEach(b => b.addEventListener('click', () => _fb(b.dataset.recv, b.dataset.reply, 'bad')));
      } catch (_) { /* ignore */ }
    };

    sheet.innerHTML = `
      <div style="width:36px;height:4px;background:#e0e0e0;border-radius:2px;margin:0 auto 18px;"></div>
      <div style="font-size:17px;font-weight:800;color:#1a1a1a;margin-bottom:6px;">🤖 AI DM 자동응답</div>
      <div style="font-size:12px;color:#888;margin-bottom:16px;">시술 중 온 DM에 AI 비서가 자동으로 답장해요.</div>
      ${disabledBanner}
      ${accountBanner}
      <!-- [2026-04-29 C1] 도착 DM 시간순 list — 시트 상단 -->
      <div id="dmInbox" style="margin-bottom:16px;"></div>

      <label style="display:flex;align-items:center;justify-content:space-between;padding:14px;background:#FAFAFA;border-radius:12px;margin-bottom:12px;cursor:${_globalEnabled && accountReady ? 'pointer' : 'not-allowed'};opacity:${_globalEnabled && accountReady ? '1' : '0.6'};">
        <div>
          <div style="font-weight:700;font-size:14px;">자동응답 켜기</div>
          <div style="font-size:11px;color:#888;margin-top:2px;">${status.instagram_handle ? _esc(status.instagram_handle) + ' DM에 즉시 AI 답장' : '켜놓으면 DM 즉시 AI 답장'}</div>
        </div>
        <input id="dmEnabled" type="checkbox" ${settings.enabled ? 'checked' : ''} ${_globalEnabled && accountReady ? '' : 'disabled'} style="width:20px;height:20px;">
      </label>

      <!-- [2026-04-29 C2] 톤 카드 3개 — 클릭 큰 카드 -->
      <div style="margin-bottom:14px;">
        <label style="font-size:12px;font-weight:700;color:#555;">답장 톤</label>
        <div id="dmToneCards" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:6px;">
          <button type="button" data-tone="friendly" class="dm-tone-card ${settings.tone === 'friendly' ? 'dm-tone-on' : ''}" style="padding:14px 6px;border:2px solid ${settings.tone === 'friendly' ? '#7C3AED' : '#e5e5e5'};border-radius:12px;background:${settings.tone === 'friendly' ? 'linear-gradient(135deg,#FAF5FF,#F3E8FF)' : '#fff'};cursor:pointer;font-size:13px;font-weight:700;color:${settings.tone === 'friendly' ? '#5B21B6' : '#666'};">
            <div style="font-size:22px;margin-bottom:4px;">😊</div>
            <div>친근하게</div>
            <div style="font-size:10px;font-weight:400;color:#888;margin-top:3px;">반말 섞어서</div>
          </button>
          <button type="button" data-tone="professional" class="dm-tone-card ${settings.tone === 'professional' ? 'dm-tone-on' : ''}" style="padding:14px 6px;border:2px solid ${settings.tone === 'professional' ? '#7C3AED' : '#e5e5e5'};border-radius:12px;background:${settings.tone === 'professional' ? 'linear-gradient(135deg,#FAF5FF,#F3E8FF)' : '#fff'};cursor:pointer;font-size:13px;font-weight:700;color:${settings.tone === 'professional' ? '#5B21B6' : '#666'};">
            <div style="font-size:22px;margin-bottom:4px;">🙇‍♀️</div>
            <div>정중하게</div>
            <div style="font-size:10px;font-weight:400;color:#888;margin-top:3px;">존댓말</div>
          </button>
          <button type="button" data-tone="cute" class="dm-tone-card ${settings.tone === 'cute' ? 'dm-tone-on' : ''}" style="padding:14px 6px;border:2px solid ${settings.tone === 'cute' ? '#7C3AED' : '#e5e5e5'};border-radius:12px;background:${settings.tone === 'cute' ? 'linear-gradient(135deg,#FAF5FF,#F3E8FF)' : '#fff'};cursor:pointer;font-size:13px;font-weight:700;color:${settings.tone === 'cute' ? '#5B21B6' : '#666'};">
            <div style="font-size:22px;margin-bottom:4px;">🥰</div>
            <div>귀엽게</div>
            <div style="font-size:10px;font-weight:400;color:#888;margin-top:3px;">이모지 풍부</div>
          </button>
        </div>
        <input id="dmTone" type="hidden" value="${_esc(settings.tone || 'friendly')}">
        <div id="dmTonePreview" style="margin-top:8px;padding:10px;background:#F9FAFB;border-radius:10px;font-size:12px;color:#555;line-height:1.5;">
          미리보기: <span id="dmTonePreviewText" style="color:#5B21B6;font-weight:600;">${_tonePreview(settings.tone || 'friendly')}</span>
        </div>
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
        <label style="font-size:12px;font-weight:700;color:#555;">시간대 기준</label>
        <select id="dmTimezone" style="width:100%;margin-top:6px;padding:10px;border:1px solid #ddd;border-radius:10px;font-size:14px;">
          <option value="Asia/Seoul" ${settings.timezone_name === 'Asia/Seoul' ? 'selected' : ''}>한국 시간 (Asia/Seoul)</option>
          ${browserTz === 'Asia/Seoul' ? '' : `<option value="${_esc(browserTz)}" ${settings.timezone_name === browserTz ? 'selected' : ''}>현재 기기 시간 (${_esc(browserTz)})</option>`}
          <option value="UTC" ${settings.timezone_name === 'UTC' ? 'selected' : ''}>UTC</option>
        </select>
        <div style="font-size:10px;color:#999;margin-top:4px;">Railway 서버 시간이 아니라 이 시간대를 기준으로 자동응답 여부를 판단해요.</div>
      </div>

      <div style="margin-bottom:14px;">
        <label style="font-size:12px;font-weight:700;color:#555;">금지어 (쉼표 구분 — 이 단어 포함된 DM 은 사람 대응)</label>
        <input id="dmBlocked" type="text" value="${_esc((settings.blocked_keywords || []).join(', '))}" placeholder="환불, 컴플레인, 부작용" style="width:100%;margin-top:6px;padding:10px;border:1px solid #ddd;border-radius:10px;font-size:14px;box-sizing:border-box;">
        <div style="font-size:10px;color:#999;margin-top:4px;">기본 금지어 자동 포함: 의료·치료·부작용·환불·법적</div>
      </div>

      <details open style="margin-bottom:14px;">
        <summary style="font-size:12px;font-weight:700;color:#7C3AED;cursor:pointer;padding:8px 0;">⭐ 사장님이 평소 답하는 방식 (3~5개) — AI가 이 톤·문체 그대로 따라 함</summary>
        <textarea id="dmSample1" placeholder="예: 가격 문의 감사해요🌷 시술별로 달라서 인스타 프로필 가격표 먼저 확인 부탁드려요!" style="width:100%;margin-top:8px;padding:10px;border:1px solid #C4B5FD;border-radius:10px;font-size:13px;box-sizing:border-box;min-height:50px;background:#FAF5FF;">${_esc((settings.sample_replies || [])[0] || '')}</textarea>
        <textarea id="dmSample2" placeholder="예: 예약 문의 주셔서 감사해요🥹 원하시는 날짜·시간 DM 으로 보내주시면 확인해드릴게요" style="width:100%;margin-top:8px;padding:10px;border:1px solid #C4B5FD;border-radius:10px;font-size:13px;box-sizing:border-box;min-height:50px;background:#FAF5FF;">${_esc((settings.sample_replies || [])[1] || '')}</textarea>
        <textarea id="dmSample3" placeholder="예: 후기 사진은 인스타 피드 참고해 주세요💗 시술 결과 자연스럽게 잘 나와요!" style="width:100%;margin-top:8px;padding:10px;border:1px solid #C4B5FD;border-radius:10px;font-size:13px;box-sizing:border-box;min-height:50px;background:#FAF5FF;">${_esc((settings.sample_replies || [])[2] || '')}</textarea>
        <textarea id="dmSample4" placeholder="예: 안녕하세요🤍 잇데이 스튜디오입니다! 어떤 시술 궁금하세요?" style="width:100%;margin-top:8px;padding:10px;border:1px solid #C4B5FD;border-radius:10px;font-size:13px;box-sizing:border-box;min-height:50px;background:#FAF5FF;">${_esc((settings.sample_replies || [])[3] || '')}</textarea>
        <textarea id="dmSample5" placeholder="예: 영업시간은 09:00~21:00 이에요✨ 일요일 휴무!" style="width:100%;margin-top:8px;padding:10px;border:1px solid #C4B5FD;border-radius:10px;font-size:13px;box-sizing:border-box;min-height:50px;background:#FAF5FF;">${_esc((settings.sample_replies || [])[4] || '')}</textarea>
      </details>

      <details style="margin-bottom:14px;">
        <summary style="font-size:12px;font-weight:700;color:#555;cursor:pointer;padding:8px 0;">AI 실패 시 사용할 템플릿 (카테고리별)</summary>
        <textarea id="dmTplIntro" placeholder="인사말" style="width:100%;margin-top:8px;padding:10px;border:1px solid #ddd;border-radius:10px;font-size:13px;box-sizing:border-box;min-height:50px;">${_esc(settings.template_intro || '')}</textarea>
        <textarea id="dmTplPricing" placeholder="가격 문의" style="width:100%;margin-top:8px;padding:10px;border:1px solid #ddd;border-radius:10px;font-size:13px;box-sizing:border-box;min-height:50px;">${_esc(settings.template_pricing || '')}</textarea>
        <textarea id="dmTplBooking" placeholder="예약 문의" style="width:100%;margin-top:8px;padding:10px;border:1px solid #ddd;border-radius:10px;font-size:13px;box-sizing:border-box;min-height:50px;">${_esc(settings.template_booking || '')}</textarea>
        <textarea id="dmTplLocation" placeholder="위치 문의 (예: 강남역 5번 출구 도보 3분)" style="width:100%;margin-top:8px;padding:10px;border:1px solid #ddd;border-radius:10px;font-size:13px;box-sizing:border-box;min-height:50px;">${_esc(settings.template_location || '')}</textarea>
        <textarea id="dmTplHours" placeholder="영업시간 문의" style="width:100%;margin-top:8px;padding:10px;border:1px solid #ddd;border-radius:10px;font-size:13px;box-sizing:border-box;min-height:50px;">${_esc(settings.template_hours || '')}</textarea>
        <textarea id="dmTplReview" placeholder="후기/사진 문의" style="width:100%;margin-top:8px;padding:10px;border:1px solid #ddd;border-radius:10px;font-size:13px;box-sizing:border-box;min-height:50px;">${_esc(settings.template_review || '')}</textarea>
      </details>

      <div style="display:flex;gap:10px;margin-top:20px;">
        <button id="dmCancel" style="flex:1;padding:14px;border:1px solid #ddd;background:#fff;border-radius:12px;font-weight:700;cursor:pointer;">닫기</button>
        <button id="dmSave" style="flex:2;padding:14px;border:none;background:linear-gradient(135deg,#F18091,#D95F70);color:#fff;border-radius:12px;font-weight:800;cursor:pointer;">저장</button>
      </div>
    `;

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    // [2026-04-29 C1] 도착 DM list 비동기 채움
    _dmInboxAsync().catch(() => {});

    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    sheet.querySelector('#dmCancel').addEventListener('click', () => overlay.remove());
    // [2026-04-29 C2] 톤 카드 클릭
    sheet.querySelectorAll('.dm-tone-card').forEach(card => {
      card.addEventListener('click', () => {
        const tone = card.dataset.tone;
        sheet.querySelector('#dmTone').value = tone;
        sheet.querySelectorAll('.dm-tone-card').forEach(c => {
          const on = c.dataset.tone === tone;
          c.style.border = on ? '2px solid #7C3AED' : '2px solid #e5e5e5';
          c.style.background = on ? 'linear-gradient(135deg,#FAF5FF,#F3E8FF)' : '#fff';
          c.style.color = on ? '#5B21B6' : '#666';
        });
        const prev = sheet.querySelector('#dmTonePreviewText');
        if (prev) prev.textContent = _tonePreview(tone);
      });
    });
    sheet.querySelector('#dmSave').addEventListener('click', async () => {
      const samples = ['dmSample1', 'dmSample2', 'dmSample3', 'dmSample4', 'dmSample5']
        .map(id => (sheet.querySelector('#' + id)?.value || '').trim())
        .filter(Boolean);
      const payload = {
        enabled: sheet.querySelector('#dmEnabled').checked,
        tone: sheet.querySelector('#dmTone').value,
        blocked_keywords: sheet.querySelector('#dmBlocked').value.split(',').map(s => s.trim()).filter(Boolean),
        auto_reply_start: sheet.querySelector('#dmStart').value || '09:00',
        auto_reply_end: sheet.querySelector('#dmEnd').value || '22:00',
        timezone_name: sheet.querySelector('#dmTimezone').value || 'Asia/Seoul',
        template_intro: sheet.querySelector('#dmTplIntro').value,
        template_pricing: sheet.querySelector('#dmTplPricing').value,
        template_booking: sheet.querySelector('#dmTplBooking').value,
        template_location: sheet.querySelector('#dmTplLocation')?.value || '',
        template_hours: sheet.querySelector('#dmTplHours')?.value || '',
        template_review: sheet.querySelector('#dmTplReview')?.value || '',
        sample_replies: samples,
      };
      const ok = await _saveSettings(payload);
      if (window.showToast) window.showToast(ok ? '저장됐어요' : '저장 실패');
      if (ok) overlay.remove();
    });
  }

  window.openDMAutoreplySettings = openDMAutoreplySettings;
})();
