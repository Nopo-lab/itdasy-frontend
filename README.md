# itdasy Frontend (⛔운영)

뷰티샵 AI 마케팅 PWA — **운영 레포**. Claude 직접 push 금지.

> 공동작업 가이드·레포 지도는 [루트 `../README.md`](../README.md) 참조.
> 프로젝트 규칙은 [루트 `../CLAUDE.md`](../CLAUDE.md) 참조.

## 기술 스택

- **Vanilla JavaScript** (`build.sh` esbuild 번들링)
- **PWA** — Service Worker + manifest.json
- **Capacitor 6** (네이티브 iOS/Android 쉘)
- **GitHub Pages** 자동 배포

## 운영 URL

- Web: https://nopo-lab.github.io/itdasy-frontend/
- API: https://itdasy260417-production.up.railway.app

## 빌드

```bash
./build.sh   # 12개 JS → app.bundle.min.js
```

push → GitHub Actions 자동 번들 + SW 캐시 버전 갱신.

## 승격 정책

변경은 `itdasy-frontend-test-yeunjun` 에서 검증 → 사용자 지시로 여기에 승격.
Claude 가 직접 push 금지 (`../CLAUDE.md` 의 "절대 금지" 규칙).

## 테스트 계정

cbt1~4@itdasy.com / Itdasy2026!
