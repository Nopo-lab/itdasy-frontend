// Itdasy Studio - 글쓰기 탭 (app-gallery.js에서 분리)

// ═══════════════════════════════════════════════════════
// 피크 캐러셀 (글쓰기 슬롯 사진 / 미리보기 공용)
// ═══════════════════════════════════════════════════════
function _buildPeekCarousel(photos, id) {
  if (!photos.length) return '<div style="color:var(--text3);text-align:center;padding:16px;font-size:12px;">사진 없음</div>';
  const total = photos.length;
  if (total === 1) {
    return `<div style="width:70%;margin:0 auto;aspect-ratio:1/1;border-radius:14px;overflow:hidden;">
      <img src="${photos[0].editedDataUrl || photos[0].dataUrl}" style="width:100%;height:100%;object-fit:cover;">
    </div>`;
  }
  return `
    <div id="${id}" style="overflow:hidden;position:relative;user-select:none;touch-action:pan-y;">
      <div id="${id}_t" style="display:flex;transform:translateX(15%);transition:transform .35s cubic-bezier(.25,.46,.45,.94);">
        ${photos.map((p, i) => `
          <div style="flex-shrink:0;width:70%;padding:0 2%;box-sizing:border-box;">
            <div class="${id}_s" style="aspect-ratio:1/1;border-radius:14px;overflow:hidden;transition:transform .35s,filter .35s;transform:scale(${i===0?1:.85});filter:${i===0?'none':'brightness(.6)'};">
              <img src="${p.editedDataUrl || p.dataUrl}" style="width:100%;height:100%;object-fit:cover;display:block;">
            </div>
          </div>`).join('')}
      </div>
      <div style="display:flex;justify-content:center;gap:5px;padding:8px 0 0;" id="${id}_dots">
        ${photos.map((_,i) => `<div id="${id}_d${i}" style="height:6px;border-radius:3px;background:${i?'rgba(0,0,0,0.15)':'var(--accent)'};width:${i?'6':'18'}px;transition:all .3s;"></div>`).join('')}
      </div>
    </div>
  `;
}

function _initPeekCarousel(id, total) {
  const track = document.getElementById(id + '_t');
  if (!track || total < 2) return;
  let cur = 0;
  let offsetPx = 0; // 실시간 드래그 오프셋
  const container = document.getElementById(id);
  const containerW = container?.offsetWidth || 300;
  const slideW = containerW * 0.7; // 70%

  function go(n, animate = true) {
    cur = Math.max(0, Math.min(total - 1, n));
    offsetPx = -cur * slideW;
    track.style.transition = animate ? 'transform .35s cubic-bezier(.25,.46,.45,.94)' : 'none';
    track.style.transform = `translateX(calc(15% + ${offsetPx}px))`;
    track.querySelectorAll('.' + id + '_s').forEach((el, i) => {
      el.style.transform = i === cur ? 'scale(1)' : 'scale(.85)';
      el.style.filter = i === cur ? 'none' : 'brightness(.6)';
    });
    for (let i = 0; i < total; i++) {
      const d = document.getElementById(id + '_d' + i);
      if (d) { d.style.width = i === cur ? '18px' : '6px'; d.style.background = i === cur ? 'var(--accent)' : 'rgba(0,0,0,0.15)'; }
    }
  }

  // 모멘텀 계산용 변수
  let sx = 0, st = 0, dragging = false, lastX = 0, velocity = 0, lastTime = 0;

  track.addEventListener('touchstart', e => {
    sx = e.touches[0].clientX;
    lastX = sx;
    st = Date.now();
    lastTime = st;
    velocity = 0;
    dragging = true;
    track.style.transition = 'none';
  }, { passive: true });

  track.addEventListener('touchmove', e => {
    if (!dragging) return;
    const x = e.touches[0].clientX;
    const dx = x - sx;
    const now = Date.now();
    const dt = now - lastTime;
    if (dt > 0) velocity = (x - lastX) / dt; // px/ms
    lastX = x;
    lastTime = now;
    // 실시간 드래그 반영
    track.style.transform = `translateX(calc(15% + ${offsetPx + dx}px))`;
    if (Math.abs(dx) > 10) e.preventDefault();
  }, { passive: false });

  track.addEventListener('touchend', e => {
    if (!dragging) return;
    dragging = false;
    const dx = e.changedTouches[0].clientX - sx;
    // 모멘텀: 속도 기반으로 몇 슬라이드 이동할지 결정
    const momentum = velocity * 150; // 150ms 관성
    const totalMove = dx + momentum;
    const slidesToMove = Math.round(-totalMove / slideW);
    go(cur + slidesToMove);
  }, { passive: true });

  // 마우스 드래그
  let msx = 0, mst = 0, md = false, mLastX = 0, mVelocity = 0, mLastTime = 0;
  track.addEventListener('mousedown', e => {
    msx = e.clientX;
    mLastX = msx;
    mst = Date.now();
    mLastTime = mst;
    mVelocity = 0;
    md = true;
    track.style.transition = 'none';
    e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!md) return;
    const x = e.clientX;
    const dx = x - msx;
    const now = Date.now();
    const dt = now - mLastTime;
    if (dt > 0) mVelocity = (x - mLastX) / dt;
    mLastX = x;
    mLastTime = now;
    track.style.transform = `translateX(calc(15% + ${offsetPx + dx}px))`;
  });
  window.addEventListener('mouseup', e => {
    if (!md) return;
    md = false;
    const dx = e.clientX - msx;
    const momentum = mVelocity * 150;
    const totalMove = dx + momentum;
    const slidesToMove = Math.round(-totalMove / slideW);
    go(cur + slidesToMove);
  });
}

// ═══════════════════════════════════════════════════════
// 글쓰기 탭 — 슬롯 픽커
// ═══════════════════════════════════════════════════════
function initCaptionSlotPicker() {
  const doneSlots = _slots.filter(s => s.status === 'done' && s.photos.length > 0);
  const container = document.getElementById('captionSlotPicker');
  if (!container) return;

  // 키워드 태그 렌더링
  if (typeof renderCaptionKeywordTags === 'function') renderCaptionKeywordTags();

  if (!doneSlots.length) { container.style.display = 'none'; return; }
  container.style.display = 'block';
  container.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:12px 14px;">
      <div style="font-size:12px;font-weight:800;color:var(--text);margin-bottom:10px;">작업실 슬롯 <span style="font-size:10px;color:var(--text3);font-weight:400;">— 탭하면 사진이 연결돼요</span></div>
      <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;" id="captionSlotCards">
        ${doneSlots.map(slot => {
          const thumb = slot.photos.filter(p => !p.hidden)[0];
          if (!thumb) return '';
          return `
            <div id="csPick_${slot.id}" onclick="loadSlotForCaption('${slot.id}')" style="flex-shrink:0;width:64px;cursor:pointer;text-align:center;">
              <img src="${thumb.editedDataUrl || thumb.dataUrl}" style="width:64px;height:64px;object-fit:cover;border-radius:10px;border:2px solid transparent;transition:border-color 0.2s;" id="csThumb_${slot.id}">
              <div style="font-size:9px;color:var(--text2);margin-top:3px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${slot.label}</div>
            </div>
          `;
        }).join('')}
      </div>
      <div id="captionSlotPhotoStrip" style="display:none;margin-top:10px;"></div>
    </div>
  `;
}

async function loadSlotForCaption(slotId) {
  const slot = _slots.find(s => s.id === slotId);
  if (!slot) return;
  _captionSlotId = slotId;

  // 슬롯 카드 선택 표시
  document.querySelectorAll('[id^="csThumb_"]').forEach(el => {
    el.style.borderColor = 'transparent';
  });
  const pickedThumb = document.getElementById(`csThumb_${slotId}`);
  if (pickedThumb) pickedThumb.style.borderColor = 'var(--accent)';

  // 보이는 사진만 (hidden 제외)
  const visPhotos = slot.photos.filter(p => !p.hidden);

  // 사진 피크 캐러셀 표시
  const strip = document.getElementById('captionSlotPhotoStrip');
  if (strip && visPhotos.length > 0) {
    strip.style.display = 'block';
    strip.innerHTML = _buildPeekCarousel(visPhotos, 'cs_carousel');
    setTimeout(() => _initPeekCarousel('cs_carousel', visPhotos.length), 50);
  } else if (strip) {
    strip.style.display = 'none';
  }

  showToast(`${slot.label} 연결됐어요 ✅`);

  // 단일 작업 카드의 사진 영역 갱신 (app-caption.js)
  if (typeof _captionPhotosReordered !== 'undefined') _captionPhotosReordered = null;
  if (typeof _renderCaptionPhotoRow === 'function') _renderCaptionPhotoRow();
}


