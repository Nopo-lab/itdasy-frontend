/* AI 잇비 — 사진편집 말 명령 */
(function () {
  'use strict';

  const COMMANDS = [
    { id: 'instagram', test: /(인스타|instagram|sns).*(업로드|올려|발행|게시|준비)/, action: 'instagram' },
    { id: 'ba', test: /(비포|애프터|전후|before|after|b\/a|b&a)/i, tab: 'ba', card: 'ba', label: '비포/애프터 비교를 열었어요' },
    { id: 'bg', test: /(누끼|배경).*(제거|바꿔|교체|흰|깔끔)|배경\s*누끼/, tab: 'bg', card: 'bg', label: '배경·누끼 화면을 열었어요' },
    { id: 'template', test: /(홍보|템플릿|가격표|후기|카드).*(만들|열|보여|준비)/, tab: 'template', card: 'template', label: '홍보 템플릿을 열었어요' },
    { id: 'text', test: /(텍스트|문구|글자|가격|이벤트).*(넣|추가|작성|써)/, tab: 'text', card: 'text', label: '텍스트 넣기를 열었어요' },
    { id: 'brand', test: /(워터마크|브랜드|로고).*(넣|추가|관리|열)/, tab: 'brand', card: 'brand', label: '브랜드 화면을 열었어요' },
    { id: 'save', test: /(저장|내보내기|다운로드|사이즈|비율).*(열|해|준비)?/, tab: 'export', card: 'save', label: '저장 화면을 열었어요' },
    { id: 'hair-volume', test: /(헤어|머리|모발).*(풍성|볼륨|숱|정수리)|(풍성하게).*(헤어|머리|모발)/, tab: 'beauty', card: 'hair',
      patch: { beautyFocus: 'hair', beauty: { hairVolume: 62, hairShine: 36, hairDetail: 30, scalpBoost: 26 } }, label: '헤어 풍성감과 윤기를 올렸어요' },
    { id: 'hair-detail', test: /(머리결|모발\s*결|윤기|찰랑|염색|컬러).*(살려|보정|강조|정리)?/, tab: 'beauty', card: 'hair',
      patch: { beautyFocus: 'hair', beauty: { hairShine: 48, hairDetail: 42, hairEndsClean: 30, hairColorPop: 24 } }, label: '머리결과 컬러 디테일을 살렸어요' },
    { id: 'eye-sparkle', test: /(눈빛|눈동자|반짝|초롱|속눈썹|아이).*(살려|보정|강조|반짝)?/, tab: 'beauty', card: 'detail',
      patch: { beautyFocus: 'lash', beauty: { catchLight: 58, irisClear: 44, lashSharp: 34, eyeRedness: 24 } }, label: '눈빛 반짝임과 눈가 선명도를 올렸어요' },
    { id: 'nail-gloss', test: /(네일|손톱|패디|손).*(광택|반짝|선명|경계|피부톤)/, tab: 'beauty', card: 'detail',
      patch: { beautyFocus: 'nail', beauty: { nailGloss: 58, nailShape: 34, handSkin: 30, coolness: 18 } }, label: '네일 광택과 손 피부톤을 정리했어요' },
    { id: 'skin-detail', test: /(피부|붉은기|잡티|결|톤).*(정리|보정|완화|지워|매끈)|잡티/, tab: 'beauty', card: 'detail',
      patch: { beautyFocus: 'skin', beauty: { skin: 34, redness: 38, blemish: 42, textureSmooth: 26, yellowness: 18 } }, label: '피부톤, 붉은기, 잡티를 자연스럽게 정리했어요' },
    { id: 'relight', test: /(조명|빛|역광|어둡|그림자).*(살려|보정|밝게|정리)?/, tab: 'relight', card: 'relight',
      patch: { relight: { intensity: 48, ambientBoost: 28, warmth: 8 } }, label: '조명을 보정했어요' },
    { id: 'bright', test: /(밝기|밝게|환하게|노출).*(올려|보정|해)?/, tab: 'tune', card: 'tune',
      patch: { adjust: { brightness: 116, sharpness: 18 } }, label: '밝기를 올렸어요' },
    { id: 'vivid', test: /(채도|색감|선명|쨍하게|또렷).*(올려|보정|해)?/, tab: 'tune', card: 'tune',
      patch: { adjust: { saturate: 118, sharpness: 36 } }, label: '색감과 선명도를 올렸어요' },
    { id: 'warm', test: /(따뜻|웜톤|노란빛).*(보정|해|올려)?/, tab: 'tune', card: 'tune',
      patch: { adjust: { temperature: 16 } }, label: '따뜻한 톤으로 맞췄어요' },
    { id: 'cool', test: /(차갑|쿨톤|푸른빛).*(보정|해|맞춰)?/, tab: 'tune', card: 'tune',
      patch: { adjust: { temperature: -16 } }, label: '차가운 톤으로 맞췄어요' },
    { id: 'auto', test: /(자동\s*보정|자동보정|빠른\s*보정|한\s*번에|예쁘게).*(해|적용|보정)?/, tab: 'auto', card: 'auto',
      patch: { adjust: { brightness: 105, saturate: 110, sharpness: 24, temperature: 5 } }, label: '빠른 자동보정을 적용했어요' },
    { id: 'open', test: /(사진|이미지|포토)\s*(편집|보정|수정|꾸미|예쁘게|만들|업로드)|편집기|보정\s*화면/, tab: null, card: null, label: '사진 편집기를 열었어요' },
  ];

  function _toast(msg) { if (window.showToast) window.showToast(msg); }

  function _editorReady() {
    return !!(window.PhotoEditor && typeof window.PhotoEditor.open === 'function');
  }

  function _editorVisible() {
    const sheet = document.getElementById('photoEditorSheet');
    return !!(sheet && sheet.style.display !== 'none');
  }

  function _state() {
    try { return window.PhotoEditor?._internal?.getState?.(); }
    catch (_e) { return null; }
  }

  function _textPatch(cmd, text) {
    if (cmd.id !== 'text') return null;
    const m = text.match(/(?:텍스트|문구|글자)\s*(?:넣어줘|추가해줘|써줘|:)?\s*(.+)$/);
    const value = m && m[1] && !/(넣|추가|작성|써)$/.test(m[1]) ? m[1].trim() : '';
    return value ? { text: { value } } : null;
  }

  function _mergePatch(base, extra) {
    const out = Object.assign({}, base || {});
    if (!extra) return out;
    Object.keys(extra).forEach(k => {
      out[k] = typeof extra[k] === 'object' && !Array.isArray(extra[k])
        ? Object.assign({}, out[k] || {}, extra[k])
        : extra[k];
    });
    return out;
  }

  function _applyCommand(cmd, text) {
    const internal = window.PhotoEditor?._internal;
    if (!internal || typeof internal.applyStatePatch !== 'function') return;
    const patch = _mergePatch(cmd.patch, _textPatch(cmd, text));
    if (cmd.tab) patch.activeTab = cmd.tab;
    internal.applyStatePatch(patch);
  }

  function _openEditor(cmd, text) {
    if (!_editorVisible()) window.PhotoEditor.open({ initial_tab: cmd.tab || undefined });
    setTimeout(() => {
      const hasWork = !!(cmd.tab || cmd.patch || cmd.id === 'text');
      if (cmd.tab && window.PhotoEditorEntryV6?.goto) window.PhotoEditorEntryV6.goto(cmd.tab, cmd.card || cmd.tab);
      if (hasWork) _applyCommand(cmd, text);
      const st = _state();
      _toast(!hasWork || (st && st.originalImg) ? cmd.label : (cmd.label + ' 사진을 고르면 바로 반영돼요'));
    }, 60);
  }

  function _currentCanvasUrl() {
    const cv = document.getElementById('peCanvas');
    if (!cv || !cv.width || !cv.height) return '';
    try { return cv.toDataURL('image/jpeg', 0.92); }
    catch (_e) { return ''; }
  }

  function _caption() {
    const st = _state();
    const shop = (st && st.shopName) || '';
    return (shop ? shop + ' 시술 사진입니다. ' : '') + '문의는 DM 주세요.';
  }

  function _openInstagram() {
    const src = _currentCanvasUrl();
    if (src && typeof window.openInstagramPreview === 'function') {
      window.openInstagramPreview({ src, ratio: '4:5', caption: _caption(), enableUpload: true });
      _toast('인스타 업로드 준비를 열었어요');
      return;
    }
    _openEditor({ tab: 'export', card: 'save', label: '저장 화면을 열었어요' }, '');
    _toast('사진을 먼저 고른 뒤 인스타 업로드라고 말해 주세요');
  }

  function tryRun(input, q, deps) {
    const text = String(q || input?.value || '').trim();
    if (!_editorReady() || !text) return false;
    // [QA퍼징 2026-06-12] "고객/예약/매출 카드 보여줘"는 사진 템플릿 명령이 아니다 —
    //   template 커맨드의 /(…|카드).*(보여|열)/ 가 도메인 조회를 오매칭해 편집기를 열던 버그 차단.
    if (/(고객|손님|예약|매출|회원|명단|연락처|통계|차트|일정)\s*(카드|명단|목록|정보|리스트|내역|보여)/.test(text)) return false;
    const cmd = COMMANDS.find(c => c.test.test(text));
    if (!cmd) return false;
    if (deps && typeof deps.clearInput === 'function') deps.clearInput(input);
    else if (input) input.value = '';
    if (cmd.action === 'instagram') _openInstagram();
    else _openEditor(cmd, text);
    return true;
  }

  window.ItdasyAssistantPhotoCommands = { tryRun };
})();
