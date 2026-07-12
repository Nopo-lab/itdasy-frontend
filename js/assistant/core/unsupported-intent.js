/* 잇비 미지원/미이해 발화 정직 안내 — FE 가로채기 (2026-06-12, P1-5)

   문제: "글자 좀 줄여 / 별로네 / 다른 거 / 이벤트로 바꿔 / 아니 다시" 같은
     (a) 세부 편집 명령, (b) 평가·재시도, (c) 문맥부족 발화가 아무 샷컷에도 안 잡혀
     백엔드로 새고, 백엔드 호출이 실패하면 "📡 인터넷 연결을 확인해 주세요"로 수렴 →
     실제 인터넷 문제가 아닌데 앱이 거짓말하는 것처럼 보였다.
   해결: 백엔드 전송 직전(모든 실제 샷컷 실패 후)에 이 분류기로 종류를 나눠
     정직한 안내를 주고 백엔드로 안 보낸다. → 인터넷 오류 거짓 수렴 제거.

   종류:
     edit_detail  — 글자/색/크기/위치 등 세부 편집("아직 말로 세부 편집은 못 해요, 편집기에서 직접").
     retry_alt    — 별로/다른 거/바꿔/다시("아직 다른 디자인 자동 변경은 준비 중이에요").
     context_lost — 무엇을 말하는지 못 찾음("저장된 카드를 먼저 열어주세요").

   외부: window.ItbiUnsupportedIntent = { classify } */
(function () {
  'use strict';
  if (window.ItbiUnsupportedIntent) return;

  // (a) 세부 편집 — 글자/글씨/폰트/크기/색/위치/정렬 류(이 단계까지 왔으면 사진편집 샷컷은 이미 실패).
  var EDIT_DETAIL_RE = /(글자|글씨|폰트|타이포|크게|작게|줄여|줄이|키워|키우|색깔|글자\s*색|색\s*바꿔|색\s*바꾸|위로|아래로|왼쪽|오른쪽|가운데\s*정렬|정렬|굵게|얇게|간격|자간|행간|사이즈|글씨\s*크기|옮겨|이동해|기울)/;
  // (b) 평가·재시도·대안 — 별로/다른 거/말고/첫 번째가 나았어/…로 바꿔(예약·고객 충돌 낮은 표현만).
  var RETRY_ALT_RE = /(별로|마음에\s*안|맘에\s*안|다른\s*거|다른\s*걸|다른\s*것|다른\s*디자인|다른\s*스타일|딴\s*거|말고|첫\s*번째|두\s*번째|세\s*번째|더\s*나았|나았어|로\s*바꿔|으로\s*바꿔|아니\s*다시|다시\s*해|처음부터\s*다시|새로\s*해줘)/;
  // (c) 문맥 부족 — 대명사만 있고 대상 못 찾음(드묾: 보통 activeCard/saved 가 먼저 잡음).
  var CONTEXT_LOST_RE = /^(그거|이거|저거|그것|방금\s*거|아까\s*거|마지막\s*거)\s*[?!.]*$/;

  function classify(q) {
    var t = String(q || '').trim();
    if (!t) return null;
    if (EDIT_DETAIL_RE.test(t)) return { kind: 'edit_detail' };
    if (RETRY_ALT_RE.test(t)) return { kind: 'retry_alt' };
    if (CONTEXT_LOST_RE.test(t)) return { kind: 'context_lost' };
    return null;
  }

  window.ItbiUnsupportedIntent = { classify: classify };
})();
