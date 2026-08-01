# 잇데이 운영 런북

> 장애가 났을 때 **뭘 보고 뭘 누를지**. 당황한 상태에서 읽는 문서라 짧게 썼다.
> 여기 적힌 명령·수치는 전부 2026-08-01 스테이징에서 **실제로 해보고** 확인한 것이다.

---

## 0. 30초 안에 상황 파악

| 확인 | 어디서 |
|---|---|
| 서버 살아있나 | https://itdasy-backend-staging-644329093453.asia-northeast3.run.app/health → `{"status":"healthy"}` |
| AI 살아있나 | 같은 주소 `/ai-health` → `api_key_fallback_ready:true` · `fallback_fail:0` |
| 지금 뭐가 막혀있나 | admin → **🚀 출시 첫날** 맨 위 빨간 카드 |
| 사용량·원가 | 같은 화면. 상한 사용률 90% 넘으면 빨강 |
| 알림 이력 | [Uptime Alert 실행 기록](https://github.com/Nopo-lab/itdasy_backend-test/actions/workflows/uptime-alert.yml) |

**Discord 알림은 5분마다** 온다(러너가 붐비면 5~15분 밀릴 수 있음). 조용하면 정상이다.

---

## 1. 서버가 안 뜬다 (`/health` 실패 · 🚨 알림)

1. **Cloud Run 콘솔**에서 리비전 상태 확인
   [콘솔 열기](https://console.cloud.google.com/run/detail/asia-northeast3/itdasy-backend-staging/metrics?project=itdasy-495513)
2. 최근 배포가 원인 같으면 **이전 리비전으로 롤백**:
   ```bash
   gcloud run services update-traffic itdasy-backend-staging \
     --region=asia-northeast3 --project=itdasy-495513 --to-revisions=<이전리비전>=100
   ```
   리비전 목록: `gcloud run revisions list --service=itdasy-backend-staging --region=asia-northeast3`
3. 롤백해도 안 되면 **DB 쪽 의심** — `/health` 는 DB 핑이 실패해도 503 을 준다(`main.py:1366`).
   Supabase 대시보드에서 인스턴스 상태 확인.

⚠️ **알림이 안 왔는데 죽어 있는 경우**: cron 이 밀렸거나 워크플로가 깨진 것.
과거에 YAML 파싱 실패로 알림이 아예 안 돈 적 있다(2026-07-31). Actions 화면을 직접 볼 것.

---

## 2. 서버는 뜨는데 AI 만 실패 (캡션·잇비만 안 됨)

`/health` 200 인데 `/ai-health` 의 `fallback_fail > 0` 이거나 `api_key_fallback_ready:false`.

1. **원인 확인** — GCP 콘솔 → Vertex AI 쿼터. 429 가 쌓이면 여기가 원인.
2. **길어지면 기능만 끈다** (서비스 전체는 살린다):
   ```bash
   gcloud run services update itdasy-backend-staging \
     --region=asia-northeast3 --project=itdasy-495513 \
     --update-env-vars FEATURE_CAPTION=off
   ```
   원장님에겐 "캡션 만들기를 잠시 점검 중이에요 🙏" 가 뜬다.
3. **복구**:
   ```bash
   gcloud run services update itdasy-backend-staging \
     --region=asia-northeast3 --project=itdasy-495513 \
     --remove-env-vars FEATURE_CAPTION
   ```

**실측(2026-08-01)**: 반영까지 새 리비전 배포 **약 40초**. 캡션만 503 이 되고
잇비·`/health` 는 200 유지 — 기능별로 격리된다.

| 끄고 싶은 것 | env |
|---|---|
| 잇비 | `FEATURE_ASSISTANT=off` |
| 캡션 | `FEATURE_CAPTION=off` |
| 누끼 | `FEATURE_REMOVEBG=off` |
| AI 이미지 3종 | `FEATURE_IMAGE_AI=off` |
| **전체 점검 모드** | `MAINTENANCE_MODE=1` |

---

## 3. AI 비용이 튄다

1. admin **🚀 출시 첫날** → "오늘 누적" 과 "상한 사용률" 확인
2. 상한이 안 걸려 있으면 지금 건다:
   ```bash
   gcloud run services update itdasy-backend-staging \
     --region=asia-northeast3 --project=itdasy-495513 \
     --update-env-vars ITDASY_DAILY_COST_CAP_KRW=50000
   ```
   넘으면 AI 호출이 429 로 막히고 "오늘 AI 사용량이 많아 잠시 쉬어가요" 가 뜬다.
3. **특정 기능이 범인이면** 그것만 끈다(위 2번 표).

🔥 **누끼 폴백 주의**: Replicate 가 흔들리면 remove.bg 폴백(장당 **280원**, Replicate 의 200배)이
자동으로 탄다. 로그에서 `[NUKKI] Replicate 실패, Remove.bg 폴백` 이 반복되면
`REMOVEBG_API_KEY` 를 비워 폴백을 끊는 게 낫다.

---

## 4. 인스타(Meta) 가 안 된다

- **연동은 되는데 발행이 안 됨** → 정상이다. `content_publish` 가 심사 중이라
  앱이 발행 버튼 대신 "캡션 복사해서 직접 올려주세요" 를 보여준다.
- **연동 자체가 안 됨** → 토큰 만료(60일) 의심. 원장님에게 설정 → 인스타 다시 연결 안내.
- **심사 통과했을 때**: `INSTAGRAM_SCOPES` 에 통과한 권한을 추가한다.
  ⚠️ **심사 기간 중에는 4개 전부 요청해야 한다**(`INSTAGRAM_FULL_SCOPE=1` 유지) —
  리뷰어가 권한을 부여받아 기능을 눌러봐야 심사가 진행된다.

---

## 5. DB 가 이상하다

- 현재 **읽기 전용 모드는 없다.** DB 가 죽으면 `/health` 가 503 → 앱 전체가 멈춘다.
- 할 수 있는 것: `MAINTENANCE_MODE=1` 로 점검 안내를 띄우고 Supabase 복구를 기다린다.
- 백업: Supabase Daily Backup(Actions, UTC 18:00). **복구 리허설은 아직 안 해봤다** —
  실제로 복구되는지 확인 필요(출시 전 숙제).

---

## 6. 첫날 지표 임계값

| 지표 | 정상 | 이럴 땐 본다 |
|---|---|---|
| 신규 가입 | — | 0 이면 가입 경로 확인(회원가입 500 여부) |
| 활성 사용자 / 가입 | 50%+ | 낮으면 온보딩·로그인 문제 |
| 오늘 원가 / 상한 | <60% | 90% 넘으면 범인 기능 확인 |
| 잇비 응답 | 3초 내외 | 10초+ 지속이면 Vertex 상태 확인 |
| 캡션 응답 | 30~50초 | 60초+ 면 내부 재생성 폭주 의심(`CAPTION_REGEN` 로그) |

---

## 7. 연락·계정

- Cloud Run / Vertex: GCP 프로젝트 `itdasy-495513` (asia-northeast3)
- Discord 알림 채널: `DISCORD_ALERT_WEBHOOK` (= Cloud Run 의 `DISCORD_MODERATION_WEBHOOK`)
- admin: https://nopo-lab.github.io/itdasy-admin/ (`is_admin=True` 계정 필요)
- 데모 계정: `review@itdasy.com` (심사용)

---

_최종 갱신: 2026-08-01 · 킬스위치·알림은 스테이징에서 실제로 눌러보고 검증함_
