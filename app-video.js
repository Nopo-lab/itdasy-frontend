/* ─────────────────────────────────────────────────────────────
   Before/After 숏폼 MP4 (Phase 3 P3.3)

   엔드포인트:
   - GET  /video/capability       서버 ffmpeg 가용 여부
   - POST /video/beforeafter      multipart (before, after, hold_seconds, transition_seconds)
                                   → video/mp4 stream

   서버에 ffmpeg 없으면 capability false — 안내 후 비활성화.
   ──────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  let _beforeFile = null;
  let _afterFile = null;
  let _capabilityChecked = false;
  let _ffmpegOk = false;

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  async function _checkCapability() {
    if (_capabilityChecked) return _ffmpegOk;
    if (!window.API || !window.authHeader) return false;
    try {
      const res = await fetch(window.API + '/video/capability', { headers: window.authHeader() });
      if (res.ok) {
        const d = await res.json();
        _ffmpegOk = !!d.ffmpeg;
      } else {
        _ffmpegOk = false;
      }
    } catch (_) {
      _ffmpegOk = false;
    }
    _capabilityChecked = true;
    return _ffmpegOk;
  }

  function _ensureSheet() {
    let sheet = document.getElementById('videoSheet');
    if (sheet) return sheet;
    sheet = document.createElement('div');
    sheet.id = 'videoSheet';
    sheet.style.cssText = 'position:fixed;inset:0;z-index:9998;display:none;background:rgba(0,0,0,0.4);';
    sheet.innerHTML = `
      <div style="position:absolute;inset:auto 0 0 0;background:var(--bg,#fff);border-radius:20px 20px 0 0;max-height:90vh;display:flex;flex-direction:column;padding:16px;padding-bottom:max(16px,env(safe-area-inset-bottom));">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <strong style="font-size:18px;">비포/애프터 영상</strong>
          <span id="videoBadge" style="display:none;font-size:10px;padding:2px 6px;border-radius:4px;"></span>
          <button onclick="closeVideo()" style="margin-left:auto;background:none;border:none;font-size:20px;cursor:pointer;" aria-label="닫기">✕</button>
        </div>
        <div id="videoBody" style="flex:1;overflow-y:auto;"></div>
      </div>
    `;
    document.body.appendChild(sheet);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) closeVideo(); });
    return sheet;
  }

  function _renderBody(serverOk) {
    const body = document.getElementById('videoBody');
    if (!body) return;
    if (!serverOk) {
      body.innerHTML = `
        <div style="padding:30px 16px;text-align:center;">
          <div style="font-size:40px;margin-bottom:10px;">🎬</div>
          <div style="font-size:14px;color:#888;line-height:1.5;">서버에 영상 처리 엔진(ffmpeg)이 아직 준비되지 않았어요. 배포 환경이 완료되면 바로 사용할 수 있어요.</div>
        </div>
      `;
      return;
    }
    body.innerHTML = `
      <div style="padding:4px;">
        <div style="display:flex;gap:8px;margin-bottom:12px;">
          <label data-slot="before" style="flex:1;aspect-ratio:1;border:2px dashed #ddd;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;position:relative;">
            <input type="file" accept="image/*" hidden data-slot-input="before" />
            <div data-slot-label="before" style="font-size:12px;color:#888;text-align:center;padding:12px;">
              <div style="font-size:22px;margin-bottom:4px;">📷</div>
              BEFORE<br><span style="font-size:10px;">탭해서 선택</span>
            </div>
          </label>
          <label data-slot="after" style="flex:1;aspect-ratio:1;border:2px dashed #ddd;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;position:relative;">
            <input type="file" accept="image/*" hidden data-slot-input="after" />
            <div data-slot-label="after" style="font-size:12px;color:#888;text-align:center;padding:12px;">
              <div style="font-size:22px;margin-bottom:4px;">✨</div>
              AFTER<br><span style="font-size:10px;">탭해서 선택</span>
            </div>
          </label>
        </div>
        <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">정지 시간 <span id="vHoldLabel">1.2</span>초 (0.4~3.0)</label>
        <input id="vHold" type="range" min="0.4" max="3.0" step="0.1" value="1.2" style="width:100%;margin-bottom:12px;" />
        <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">전환 시간 <span id="vTransLabel">0.6</span>초 (0.2~2.0)</label>
        <input id="vTrans" type="range" min="0.2" max="2.0" step="0.1" value="0.6" style="width:100%;margin-bottom:14px;" />
        <button id="vGenerate" disabled style="width:100%;padding:12px;border:none;border-radius:8px;background:#ddd;color:#888;font-weight:700;font-size:15px;cursor:not-allowed;">📸 before·after 사진 먼저 선택</button>
        <div id="vStatus" style="margin-top:10px;min-height:20px;font-size:12px;color:#888;text-align:center;"></div>
      </div>
    `;

    body.querySelectorAll('[data-slot]').forEach(label => {
      const slot = label.dataset.slot;
      const input = label.querySelector('[data-slot-input]');
      input.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (file.size > 8 * 1024 * 1024) {
          if (window.showToast) window.showToast('8MB 초과 사진은 사용할 수 없어요');
          return;
        }
        if (slot === 'before') _beforeFile = file; else _afterFile = file;
        const url = URL.createObjectURL(file);
        const labelDiv = label.querySelector('[data-slot-label]');
        labelDiv.innerHTML = '';
        label.style.border = '2px solid var(--accent,#F18091)';
        label.style.background = `center/cover url("${url}")`;
        _updateGenerateButton();
      });
    });

    const holdEl = body.querySelector('#vHold');
    const transEl = body.querySelector('#vTrans');
    holdEl.addEventListener('input', () => body.querySelector('#vHoldLabel').textContent = holdEl.value);
    transEl.addEventListener('input', () => body.querySelector('#vTransLabel').textContent = transEl.value);

    body.querySelector('#vGenerate').addEventListener('click', _generate);
  }

  function _updateGenerateButton() {
    const btn = document.getElementById('vGenerate');
    if (!btn) return;
    const ready = !!_beforeFile && !!_afterFile;
    btn.disabled = !ready;
    btn.style.background = ready ? 'var(--accent,#F18091)' : '#ddd';
    btn.style.color = ready ? '#fff' : '#888';
    btn.style.cursor = ready ? 'pointer' : 'not-allowed';
    btn.textContent = ready ? '🎬 영상 만들기' : '📸 before·after 사진 먼저 선택';
  }

  async function _generate() {
    if (!_beforeFile || !_afterFile) return;
    const status = document.getElementById('vStatus');
    const btn = document.getElementById('vGenerate');
    btn.disabled = true;
    btn.textContent = '생성 중…';
    status.textContent = '서버에서 영상 합성 중 (최대 60초)';

    const fd = new FormData();
    fd.append('before', _beforeFile);
    fd.append('after', _afterFile);
    fd.append('hold_seconds', document.getElementById('vHold').value);
    fd.append('transition_seconds', document.getElementById('vTrans').value);
    try {
      const res = await fetch(window.API + '/video/beforeafter', {
        method: 'POST',
        headers: window.authHeader(),
        body: fd,
      });
      if (res.status === 501) {
        status.textContent = '서버 ffmpeg 미설치 — 관리자에게 문의';
        btn.textContent = '다시 시도';
        btn.disabled = false;
        return;
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      status.innerHTML = `
        <video src="${url}" controls autoplay loop style="width:100%;max-height:360px;border-radius:12px;margin-top:8px;"></video>
        <a href="${url}" download="beforeafter_${Date.now()}.mp4" style="display:inline-block;margin-top:8px;padding:8px 16px;background:var(--accent,#F18091);color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;">📥 MP4 저장</a>
      `;
      btn.textContent = '🎬 다시 만들기';
      btn.disabled = false;
      if (window.hapticLight) window.hapticLight();
    } catch (e) {
      console.warn('[video] 생성 실패:', e);
      status.textContent = '영상 생성 실패 — 잠시 후 재시도';
      btn.textContent = '🎬 영상 만들기';
      btn.disabled = false;
    }
  }

  window.openVideo = async function () {
    const sheet = _ensureSheet();
    sheet.style.display = 'block';
    document.body.style.overflow = 'hidden';
    const badge = sheet.querySelector('#videoBadge');
    const body = sheet.querySelector('#videoBody');
    body.innerHTML = '<div style="padding:30px;text-align:center;color:#aaa;">서버 확인 중…</div>';
    const ok = await _checkCapability();
    if (ok) {
      badge.style.display = 'inline-block';
      badge.style.background = 'rgba(76,175,80,0.15)';
      badge.style.color = '#388e3c';
      badge.textContent = '준비됨';
    } else {
      badge.style.display = 'inline-block';
      badge.style.background = 'rgba(255,193,7,0.2)';
      badge.style.color = '#f57c00';
      badge.textContent = '준비중';
    }
    _beforeFile = null;
    _afterFile = null;
    _renderBody(ok);
  };

  window.closeVideo = function () {
    const sheet = document.getElementById('videoSheet');
    if (sheet) sheet.style.display = 'none';
    document.body.style.overflow = '';
  };

  window.Video = {
    checkCapability: _checkCapability,
    get isReady() { return _ffmpegOk; },
  };
})();
