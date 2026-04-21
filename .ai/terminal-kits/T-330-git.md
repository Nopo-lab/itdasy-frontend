# T-330 git 명령 (원영님 복붙용)

> **사용법:** 터미널 (iTerm/Terminal) 열고, 아래 블록 **순서대로** 하나씩 복사→붙여넣기→엔터.
> 중간에 이상한 메시지 나오면 멈추고 스크린샷 찍어서 물어보세요.

## 0. 준비

```bash
cd ~/path/to/itdasy-frontend-test-yeunjun   # ← 원영님 실제 경로로 바꿔주세요
git status                                   # 변경 파일 많이 떠야 정상
```

변경 파일이 60개 넘게 떠야 맞아요. (삭제 3 + 수정 여럿 + CLAUDE.md 5 + .ai/ 문서 여러 개)

## 1. 첫 커밋 — 구 페르소나 탭 + 레거시/숨김/노쇼 제거 (코드)

```bash
git add -A \
  app-persona.js \
  components/persona-popup.js \
  app-cookie-consent.js \
  js/persona \
  app-core.js \
  app-caption.js \
  app-instagram.js \
  app-booking.js \
  app-report.js \
  app-calendar-view.js \
  app-customer-dashboard.js \
  style-home.css \
  index.html \
  .eslintrc.js \
  README.md

git commit -m "$(cat <<'EOF'
refactor(T-330): remove legacy persona tab, cookie consent, hidden UI, legacy token, no-show frontend

- Delete app-persona.js (900 lines, Q1-Q9 survey tab, replaced by /shop/persona/onboarding)
- Delete components/persona-popup.js (544 lines, Mock AI caption popup)
- Delete app-cookie-consent.js (49 lines, dead code)
- app-caption.js: replace openPersonaPopup() with showOnboardingCaptionPopup() in identity_incomplete handler; update consent_missing toast wording
- app-instagram.js: remove auto-open persona popup after analysis (2 spots)
- app-core.js: remove migrateLegacyToken IIFE (10 lines); keep only _TOKEN_KEY pattern
- app-booking.js, app-report.js, app-calendar-view.js, app-customer-dashboard.js: remove no_show UI (button, label, stat column, status color, icon branch)
- style-home.css: remove .header-persona-texts / persona-status-* rules
- index.html: remove persona nav button, tab-persona div, persona/cookie script tags, dead homeQuestion span; PRESERVE #personaDash (used by new tone card) and cbt1ResetArea (CBT test device)
- .eslintrc.js, README.md: clean exception list and file table

Preserved intentionally (look-alike but still in use):
- components/scenario-selector.js (new writing flow uses it)
- #personaDash div (renderPersonaDash target)
- cbt1ResetArea button (yeunjun/test staging CBT)

Backend no-show cleanup tracked separately in T-330-B (itdasy_backend-test repo).

~1,700 lines removed net.
EOF
)"
```

## 2. 두 번째 커밋 — CLAUDE.md 하네스 슬림화

```bash
git add -A \
  CLAUDE.md \
  js/caption/CLAUDE.md \
  js/core/CLAUDE.md \
  js/gallery/CLAUDE.md \
  js/portfolio/CLAUDE.md

git commit -m "$(cat <<'EOF'
docs(T-330): slim CLAUDE.md harness to <=20 lines per module

- Root CLAUDE.md: 85 -> 16 lines
- js/caption/CLAUDE.md: 9 lines
- js/core/CLAUDE.md: 8 lines
- js/gallery/CLAUDE.md: 8 lines
- js/portfolio/CLAUDE.md: 9 lines

Keeps only module-specific rules (file size, public API, dependency boundaries, change checks). Inherited rules live in parent CLAUDE.md + AGENTS.md.

Removed deleted js/persona/CLAUDE.md in prior commit.
EOF
)"
```

## 3. 세 번째 커밋 — 티켓 / 로드맵 / 핸드오프 문서

```bash
git add -A .ai/

git commit -m "$(cat <<'EOF'
docs(T-330): ticket, roadmap, session state, for-user handoff

- .ai/tickets/T-330.md: final summary ticket (scopes A-F, preservation list, verification)
- .ai/tickets/T-330/plan.md, self-review.md: standard-track plan + self-review
- .ai/tickets/T-330-B-backend.md: handoff ticket for yeunjun (backend no_show cleanup)
- .ai/ROADMAP.md: Phase 1.6 entry + backend handoff memo
- .ai/SESSION_STATE.md: T-330 checkpoint + preservation notes
- .ai/FOR_USER.md: what-now instructions for 원영
- .ai/terminal-kits/T-330-git.md: this command set
EOF
)"
```

## 4. 자가점검

```bash
git log --oneline -5
git status                       # clean 떠야 정상
grep -rn "no_show\|openPersonaPopup\|app-persona\|persona-popup" \
  --include="*.js" --include="*.html" --include="*.css" . \
  2>/dev/null | head -20         # 0건 나와야 정상
```

## 5. push

```bash
git push origin main
```

GitHub Pages 자동 배포 (~1분). `https://nopo-lab.github.io/itdasy-frontend-test-yeunjun/` 에서 확인.

## 6. 확인할 것 (배포 후)

- [ ] 앱 열고 로그인 → 홈 탭 정상
- [ ] 글쓰기 탭 → 시나리오 선택 팝업 정상 (🚫 이 로직 불가침)
- [ ] 프로필 미완성 상태에서 캡션 생성 시도 → 신 온보딩 팝업 뜨는지 확인
- [ ] 하단 네비에 "페르소나" 탭 **없음** (삭제됐으니까)
- [ ] 예약 탭 → "노쇼" 버튼 **없음**
- [ ] 리포트 탭 → 통계 카드 3개 → **2개** 로 줄었는지
- [ ] (선택) 캘린더 뷰 → 노쇼 상태색 사라졌는지

이상 있으면 스샷 + 어느 단계에서 문제인지 알려주세요.

## 7. 연준에게 전달

Slack/카톡에 이 메시지 복사 →

```
백엔드 노쇼 정리 좀 부탁해. 프론트에선 다 지웠어.
티켓: itdasy-frontend-test-yeunjun/.ai/tickets/T-330-B-backend.md
요약: BookingStatus enum 에서 no_show 값 drop + 기존 데이터 cancelled 로 마이그레이션 + 관련 엔드포인트/테스트/문서 제거.
```

## 롤백 (만약을 위해)

뭔가 크게 깨지면:

```bash
git reset --hard HEAD~3          # 커밋 3개 되돌림 (PUSH 전만 안전)
```

**push 한 뒤** 롤백이 필요하면 **원영님이 먼저 오케한테 물어봐주세요** — `git revert` 로 안전 롤백할지 판단.
