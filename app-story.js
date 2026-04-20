/* ─────────────────────────────────────────────────────────────
   AI 인스타 스토리 자동 생성 (Phase 5 · 2026-04-21)

   플로우:
   1. 음성 녹음 or 텍스트 입력 → /stories/generate (Gemini)
   2. 결과(headline/sub_text/hashtags/mood) → Canvas 1080x1920 스토리 이미지
   3. [저장] 다운로드 / [인스타 공유] Share API

   mood 에 따라 배경 그라디언트 4종:
   - cozy: 베이지·로즈 · bright: 크림·피치 · chic: 먹·라벤더 · cute: 연핑크·민트
   ──────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const MOODS = {
    cozy:   { name: '따뜻', gradient: ['#F5E6D8', '#E8B4A0'], accent: '#7A4A3C' },
    bright: { name: '밝음', gradient: ['#FFF4E6', '#FFD3B6'], accent: '#B85C38' },
    chic:   { name: '시크', gradient: ['#2C2C3E', '#A89CC8'], accent: '#F5F5F5' },
    cute:   { name: '귀여움', gradient: ['#FFDFEC', '#C4E9D7'], accent: '#D96387' },
  };

  let _result = null;
  let _canvas = null;
  let _recognition = null;
  let _interimText = '';

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  async function _apiPost(path, body) {
    const res = await fetch(window.API + path, {
      method: 'POST',
      headers: { ...window.authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  }

  function _ensureSheet() {
    let sheet = document.getElementById('storySheet');
    if (sheet) return sheet;
    sheet = document.createElement('div');
    sheet.id = 'storySheet';
    sheet.style.cssText = 'position:fixed;inset:0;z-index:9999;display:none;background:rgba(0,0,0,0.55);';
    sheet.innerHTML = `
      <div style="position:absolute;inset:auto 0 0 0;background:var(--bg,#fff);border-radius:20px 20px 0 0;max-height:92vh;display:flex;flex-direction:column;padding:16px;padding-bottom:max(16px,env(safe-area-inset-bottom));">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="font-size:22px;">✨</span>
          <strong style="font-size:17px;">스토리 자동 만들기</strong>
          <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(241,128,145,0.15);color:#D95F70;font-weight:700;">AI</span>
          <button onclick="closeStory()" style="margin-left:auto;background:rgba(0,0,0,0.05);border:none;width:32px;height:32px;border-radius:50%;font-size:16px;cursor:pointer;">✕</button>
        </div>
        <div id="storyBody" style="flex:1;overflow-y:auto;"></div>
      </div>
    `;
    document.body.appendChild(sheet);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) closeStory(); });
    return sheet;
  }

  function _renderIntro() {
    document.getElementById('storyBody').innerHTML = `
      <div style="padding:10px 0;">
        <div style="text-align:center;padding:16px 8px;background:linear-gradient(135deg,rgba(241,128,145,0.08),rgba(241,128,145,0.02));border-radius:14px;margin-bottom:16px;">
          <div style="font-size:13px;color:#555;line-height:1.6;">
            <strong>오늘 시술 느낌을 말해 주세요.</strong><br>
            AI 가 스토리용 감성 카드로 만들어드려요.<br>
            <span style="font-size:11px;color:#888;">예: "김지연님 속눈썹 풀세트 너무 잘 나왔어요 💗"</span>
          </div>
        </div>

        <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">짧은 메모</label>
        <div style="position:relative;">
          <textarea id="storyInput" rows="4" maxlength="500" placeholder="오늘 시술 이야기를 편하게…" style="width:100%;padding:12px;padding-right:50px;border:1px solid #ddd;border-radius:12px;font-family:inherit;resize:vertical;font-size:14px;"></textarea>
          <button id="storyMicBtn" aria-label="음성 입력" style="position:absolute;right:10px;bottom:10px;width:36px;height:36px;border:none;border-radius:50%;background:linear-gradient(135deg,#F18091,#D95F70);color:#fff;font-size:16px;cursor:pointer;">🎤</button>
        </div>
        <div id="storyMicStatus" style="font-size:11px;color:#888;margin-top:4px;text-align:center;min-height:16px;"></div>

        <button id="storyGen" style="width:100%;margin-top:12px;padding:13px;border:none;border-radius:10px;background:linear-gradient(135deg,#F18091,#D95F70);color:#fff;font-weight:800;cursor:pointer;font-size:15px;">✨ AI 스토리 만들기</button>
      </div>
    `;
    document.getElementById('storyGen').addEventListener('click', _generate);
    document.getElementById('storyMicBtn').addEventListener('click', _toggleMic);
  }

  function _hasWebSpeech() {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }

  function _toggleMic() {
    if (_recognition) { _recognition.stop(); return; }
    if (!_hasWebSpeech()) {
      document.getElementById('storyMicStatus').textContent = '이 기기에서 음성 입력을 지원하지 않아요';
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    _recognition = new SR();
    _recognition.lang = 'ko-KR';
    _recognition.continuous = true;
    _recognition.interimResults = true;
    _interimText = '';
    const input = document.getElementById('storyInput');
    const startingValue = input.value;
    const btn = document.getElementById('storyMicBtn');
    btn.style.background = 'linear-gradient(135deg,#dc3545,#ff6b6b)';
    btn.textContent = '⏹';
    document.getElementById('storyMicStatus').textContent = '듣고 있어요…';
    _recognition.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      _interimText = text;
      input.value = startingValue + (startingValue ? ' ' : '') + text;
    };
    _recognition.onerror = () => {};
    _recognition.onend = () => {
      _recognition = null;
      btn.style.background = 'linear-gradient(135deg,#F18091,#D95F70)';
      btn.textContent = '🎤';
      document.getElementById('storyMicStatus').textContent = _interimText ? '✓ 받아쓰기 완료' : '';
    };
    try { _recognition.start(); } catch (_) {}
  }

  async function _generate() {
    const text = document.getElementById('storyInput').value.trim();
    if (!text) {
      if (window.showToast) window.showToast('메모를 먼저 입력하거나 🎤 눌러 말해 주세요');
      return;
    }
    const btn = document.getElementById('storyGen');
    btn.disabled = true; btn.textContent = 'AI 생성 중…';
    try {
      _result = await _apiPost('/stories/generate', { text });
      _renderResult();
    } catch (e) {
      btn.disabled = false; btn.textContent = '✨ AI 스토리 만들기';
      if (window.showToast) window.showToast('실패: ' + e.message);
    }
  }

  function _renderResult() {
    const r = _result;
    const mood = MOODS[r.mood] || MOODS.cozy;
    document.getElementById('storyBody').innerHTML = `
      <div style="padding:10px 0;">
        <button onclick="window._storyBack()" style="background:none;border:none;font-size:13px;color:#888;margin-bottom:10px;cursor:pointer;">← 다시</button>

        <!-- 미리보기 Canvas -->
        <div style="position:relative;max-width:280px;aspect-ratio:9/16;margin:0 auto 14px;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.15);">
          <canvas id="storyCanvas" width="540" height="960" style="width:100%;height:100%;display:block;"></canvas>
        </div>

        <!-- 편집 영역 -->
        <div style="padding:12px;background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:12px;margin-bottom:10px;">
          <label style="display:block;font-size:11px;color:#888;margin-bottom:4px;">헤드라인</label>
          <input id="sfHeadline" value="${_esc(r.headline)}" maxlength="40" style="width:100%;padding:8px;border:1px solid #eee;border-radius:6px;font-size:14px;font-weight:700;margin-bottom:8px;" />
          <label style="display:block;font-size:11px;color:#888;margin-bottom:4px;">서브 텍스트</label>
          <textarea id="sfSub" rows="2" maxlength="80" style="width:100%;padding:8px;border:1px solid #eee;border-radius:6px;font-size:12px;font-family:inherit;resize:vertical;">${_esc(r.sub_text)}</textarea>
        </div>

        <!-- mood 선택 -->
        <div style="margin-bottom:10px;">
          <div style="font-size:11px;color:#888;margin-bottom:6px;">배경 분위기</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">
            ${Object.entries(MOODS).map(([k, m]) => `
              <button data-mood="${k}" style="padding:10px 4px;border:2px solid ${r.mood === k ? '#F18091' : 'transparent'};border-radius:10px;background:linear-gradient(135deg,${m.gradient[0]},${m.gradient[1]});color:${m.accent};font-size:11px;font-weight:700;cursor:pointer;">${m.name}</button>
            `).join('')}
          </div>
        </div>

        <!-- 해시태그 -->
        <div style="padding:10px 12px;background:#fafafa;border-radius:10px;margin-bottom:12px;">
          <div style="font-size:11px;color:#888;margin-bottom:4px;">해시태그 (클립보드 복사용)</div>
          <div style="font-size:12px;color:#555;line-height:1.7;">${(r.hashtags || []).map(t => '#' + _esc(t)).join(' ')}</div>
        </div>

        <!-- 액션 버튼 -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <button id="storyDownload" style="padding:12px;border:1px solid #ddd;border-radius:10px;background:#fff;color:#555;font-weight:700;cursor:pointer;font-size:13px;">📥 이미지 저장</button>
          <button id="storyShareIg" style="padding:12px;border:none;border-radius:10px;background:linear-gradient(135deg,#833AB4,#FD1D1D);color:#fff;font-weight:800;cursor:pointer;font-size:13px;">🎀 인스타 공유</button>
        </div>
        <button id="storyCopy" style="width:100%;margin-top:8px;padding:10px;border:1px solid #eee;border-radius:8px;background:transparent;color:#888;font-size:12px;cursor:pointer;">📋 해시태그만 복사</button>
      </div>
    `;

    _canvas = document.getElementById('storyCanvas');
    _drawCanvas();

    document.getElementById('sfHeadline').addEventListener('input', (e) => { _result.headline = e.target.value; _drawCanvas(); });
    document.getElementById('sfSub').addEventListener('input', (e) => { _result.sub_text = e.target.value; _drawCanvas(); });
    document.querySelectorAll('[data-mood]').forEach(btn => btn.addEventListener('click', () => {
      _result.mood = btn.dataset.mood;
      _drawCanvas();
      _renderResult();  // 테두리 강조 업데이트
    }));
    document.getElementById('storyDownload').addEventListener('click', _download);
    document.getElementById('storyShareIg').addEventListener('click', _shareToInstagram);
    document.getElementById('storyCopy').addEventListener('click', _copyHashtags);
  }

  window._storyBack = _renderIntro;

  function _drawCanvas() {
    if (!_canvas) return;
    const ctx = _canvas.getContext('2d');
    const W = _canvas.width, H = _canvas.height;
    const m = MOODS[_result.mood] || MOODS.cozy;

    // 그라디언트 배경
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, m.gradient[0]);
    grad.addColorStop(1, m.gradient[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 장식 원형 블러
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = m.accent;
    ctx.beginPath(); ctx.arc(W * 0.85, H * 0.15, 100, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(W * 0.12, H * 0.85, 140, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // 로고 배지
    ctx.fillStyle = m.accent + 'CC';
    ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🎀 잇데이', 40, 60);

    // 헤드라인
    ctx.fillStyle = m.accent;
    ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif';
    ctx.textAlign = 'center';
    _wrapText(ctx, _result.headline || '', W / 2, H * 0.45, W - 80, 58);

    // 서브 텍스트
    ctx.fillStyle = m.accent + 'CC';
    ctx.font = '28px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif';
    _wrapText(ctx, _result.sub_text || '', W / 2, H * 0.62, W - 120, 40);

    // 해시태그 하단
    ctx.fillStyle = m.accent + '99';
    ctx.font = '22px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif';
    const tags = (_result.hashtags || []).slice(0, 3).map(t => '#' + t).join('  ');
    ctx.fillText(tags, W / 2, H - 80);
  }

  function _wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const lines = [];
    (text || '').split('\n').forEach(raw => {
      const chars = raw.split('');
      let line = '';
      for (const c of chars) {
        const test = line + c;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = c;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
    });
    const startY = y - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
  }

  function _download() {
    _canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `itdasy_story_${Date.now()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      if (window.hapticSuccess) window.hapticSuccess();
    }, 'image/png', 0.95);
  }

  async function _shareToInstagram() {
    _canvas.toBlob(async (blob) => {
      if (!blob) return;
      const fileName = `itdasy_story_${Date.now()}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });
      if (window.Capacitor?.isNativePlatform?.()) {
        try {
          const { Filesystem, Directory, Share } = window.Capacitor.Plugins;
          if (Filesystem && Share) {
            const reader = new FileReader();
            reader.onload = async () => {
              const base64 = reader.result.split(',')[1];
              const saved = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache, recursive: true });
              await Share.share({ title: '잇데이 스토리', url: saved.uri, dialogTitle: '인스타그램에 공유' });
            };
            reader.readAsDataURL(blob);
            return;
          }
        } catch (_) {}
      }
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: '잇데이 스토리' }); return; } catch (_) {}
      }
      // 폴백: 다운로드
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
      if (window.showToast) window.showToast('이미지 저장됨 — 인스타 스토리에 올려주세요');
    }, 'image/png', 0.95);
  }

  async function _copyHashtags() {
    const tags = (_result.hashtags || []).map(t => '#' + t).join(' ');
    try {
      await navigator.clipboard.writeText(tags);
      if (window.showToast) window.showToast('해시태그 복사됨');
    } catch (e) { prompt('복사', tags); }
  }

  window.openStory = function () {
    _ensureSheet();
    document.getElementById('storySheet').style.display = 'block';
    document.body.style.overflow = 'hidden';
    _result = null;
    _renderIntro();
  };
  window.closeStory = function () {
    const sheet = document.getElementById('storySheet');
    if (sheet) sheet.style.display = 'none';
    document.body.style.overflow = '';
    try { _recognition?.stop(); } catch (_) {}
  };
})();
