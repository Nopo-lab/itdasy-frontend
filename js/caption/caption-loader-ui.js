/* caption-loader-ui.js — 캡션 생성 중 '슬롯머신' 로딩 팝업
   [B-분할] app-caption.js 에서 분리(2026-06-30). 전역 함수 유지(IIFE 아님) — window.showCaptionLoader 등 호출부 그대로.
   상태(SLOT_KEYWORDS/_slotTimers/_slotLocked/_personaFinalWords)는 이 기능에서만 쓰여 통째로 이동.
   공개: showCaptionLoader() / hideCaptionLoader(success, onClose) — app-caption.js 생성 흐름이 호출. */

// ===== 캡션 로딩 팝업 (슬롯머신) =====
const SLOT_KEYWORDS = [
  ['따뜻한','친근한','유머러스','전문적인','감성적인','활발한','차분한','트렌디한','포근한','자연스러운'],
  ['짧게','보통','길게','핵심만','상세하게','간결하게','풍부하게','딱맞게','깔끔하게','진심으로'],
  ['✨','🎀','💕','🌸','😊','💫','🔥','🌿','💗','🙏'],
];
let _slotTimers = [];
let _slotLocked = [false, false, false];
let _personaFinalWords = ['자연스러운', '보통', '✨'];

function _initSlotStrip(idx) {
  const strip = document.getElementById('slotStrip' + idx);
  if (!strip) return;
  strip.innerHTML = '';
  const words = [...SLOT_KEYWORDS[idx], ...SLOT_KEYWORDS[idx], ...SLOT_KEYWORDS[idx]];
  words.forEach(w => {
    const div = document.createElement('div');
    div.className = 'slot-item';
    div.textContent = w;
    strip.appendChild(div);
  });
  strip.style.transition = 'none';
  strip.style.transform = 'translateY(0px)';
}

function _spinReel(idx) {
  const strip = document.getElementById('slotStrip' + idx);
  if (!strip) return;
  let offset = 0;
  const itemH = 44;
  const total = SLOT_KEYWORDS[idx].length * 3;
  const speed = 100 + idx * 35;
  const timer = setInterval(() => {
    if (_slotLocked[idx]) { clearInterval(timer); return; }
    offset -= itemH;
    if (offset < -(total - SLOT_KEYWORDS[idx].length) * itemH) {
      offset = -Math.floor(Math.random() * SLOT_KEYWORDS[idx].length) * itemH;
      strip.style.transition = 'none';
      strip.style.transform = `translateY(${offset}px)`;
      return;
    }
    strip.style.transition = `transform ${speed * 0.9}ms linear`;
    strip.style.transform = `translateY(${offset}px)`;
  }, speed);
  _slotTimers.push(timer);
}

function _lockReel(idx, keyword) {
  _slotLocked[idx] = true;
  const lockEl = document.getElementById('slotLock' + idx);
  if (lockEl) {
    lockEl.textContent = keyword;
    lockEl.classList.add('active');
  }
  // 슬롯 윈도우 숨겨서 글자 겹침 방지
  const stripEl = document.getElementById('slotStrip' + idx);
  if (stripEl) {
    const winEl = stripEl.closest('.slot-window');
    if (winEl) winEl.style.visibility = 'hidden';
  }
}

function showCaptionLoader() {
  const popup = document.getElementById('captionLoadingPopup');
  popup.style.display = 'flex';
  _slotLocked = [false, false, false];
  _slotTimers.forEach(t => { clearInterval(t); clearTimeout(t); });
  _slotTimers = [];

  // 페르소나 데이터로 최종 잠금 키워드 설정
  const raw = JSON.parse(localStorage.getItem('itdasy_latest_analysis') || '{}');
  const avgLen = parseInt(raw.avg_caption_length) || 0;
  const lenWord = avgLen > 0 ? (avgLen < 50 ? '짧게' : avgLen > 120 ? '길게' : '보통') : '보통';
  const emojiMatch = (raw.emojis || '').match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u);
  const emojiWord = emojiMatch ? emojiMatch[0] : '✨';
  const toneWord = (raw.tone_summary || raw.tone || '').replace(/["']/g, '').trim().split(/[\s,·]+/)[0] || '자연스러운';
  _personaFinalWords = [toneWord, lenWord, emojiWord];

  [0,1,2].forEach(i => {
    const lock = document.getElementById('slotLock' + i);
    if (lock) lock.classList.remove('active');
    // 슬롯 윈도우 다시 표시
    const stripEl = document.getElementById('slotStrip' + i);
    if (stripEl) {
      const winEl = stripEl.closest('.slot-window');
      if (winEl) winEl.style.visibility = '';
    }
    _initSlotStrip(i);
    setTimeout(() => _spinReel(i), i * 120);
  });
  document.getElementById('clMsg').textContent = '원장님 말투로 조합 중...';
  document.getElementById('clHint').textContent = '키워드 조합 중이에요...';

  // 메시지 순환
  const _clMsgs = ['원장님 말투 불러오는 중...', 'AI가 글 구상 중이에요...', '해시태그 고르는 중...', '거의 다 됐어요...'];
  let _clMsgIdx = 0;
  const _clMsgTimer = setInterval(() => {
    _clMsgIdx = Math.min(_clMsgIdx + 1, _clMsgs.length - 1);
    if (!_slotLocked[0]) document.getElementById('clMsg').textContent = _clMsgs[_clMsgIdx];
  }, 1600);
  _slotTimers.push(_clMsgTimer);

}

function hideCaptionLoader(success, onClose) {
  // 아직 안 잠긴 릴만 순차 잠금 (150ms 간격) — API 응답 완료 시점에 맞춰 빠르게 종료
  const finalWords = [
    _personaFinalWords[0] || SLOT_KEYWORDS[0][Math.floor(Math.random() * SLOT_KEYWORDS[0].length)],
    _personaFinalWords[1] || SLOT_KEYWORDS[1][Math.floor(Math.random() * SLOT_KEYWORDS[1].length)],
    _personaFinalWords[2] || SLOT_KEYWORDS[2][Math.floor(Math.random() * SLOT_KEYWORDS[2].length)],
  ];
  let lastLockDelay = 0;
  [0, 1, 2].forEach(i => {
    if (!_slotLocked[i]) {
      setTimeout(() => _lockReel(i, finalWords[i]), i * 150);
      lastLockDelay = i * 150;
    }
  });
  // 마지막 릴 잠금 후 350ms 뒤 닫기
  setTimeout(() => {
    _slotTimers.forEach(t => { clearInterval(t); clearTimeout(t); });
    _slotTimers = [];
    document.getElementById('captionLoadingPopup').style.display = 'none';
    _slotLocked = [false, false, false];
    if (onClose) setTimeout(onClose, 80);
  }, lastLockDelay + 350);
}
