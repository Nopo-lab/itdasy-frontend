# 작업실(Workspace) 전면 감사 — 2026-07-11

7축 병렬 감사 결과 취합. 스코프 = **작업실만** (예약/고객/매출/DM/잇비 제외).
라이브 플래그: `HYPER=ON`, `SIMPLE_FLOW=ON`, `AUTO_EDITOR=ON` → 플로우 = **업로드→구성(layout)→캡션→미리보기→고객연결**, 편집기 = `ItdEditor`.

---

## A. 사용자 지목 7건 (#1~#7) — 원인·수정 위치 확정

| # | 항목 | 원인 위치 | 수정 | 위험 |
|---|---|---|---|---|
| 1 | 시술명 선택 시 상단 점프 | flow `_appendServiceTag` (setScreen 재렌더→scrollTop=0) | ✅ **완료**(입력창만 갱신) | 저 |
| 2 | 폰트 중앙 안 맞음 | `itd-editor.js:1418` textAlign='center' 하드코딩, `L.align` 무시 | align 반영+x오프셋 | 저 |
| 3 | 사진편집 에러(아이콘 두부) | `ph-bold` 폰트 미로드 → 아이콘 빈네모(flow 1417/1433/1462/1465, connect.js:23) | Lucide 스프라이트 교체 | 저 |
| 4 | 여러장 인스타 업로드 실패 | 전역 fetch 타임아웃 20초 < 캐러셀 25~50초 → abort | `itdasyTimeoutMs:120000` (app-core+adapter) | 저 |
| 5 | 캡션→미리보기 재클릭 | `flow:2152` 자동이동이 `!HYPER` 조건에 묶여 죽음 | 첫 생성 시 auto `setScreen('preview')` | 중 |
| 5b | 발행→고객연결 | 해피패스 이미 됨(3652). 'ambiguous'(메타 스코프 대기) 시 정지 | ambiguous 분기도 connect로(선택) | 저 |
| 6 | 이어하기 옛 플로우 물림 | 홈 `KEY2SCREEN`에 `preview` 키 없어 폐기 `edit`로 낙하(home:16) | `preview:'preview'` 추가, edit/crop→layout | 중 |
| 7 | "내 레이아웃" 재정의 | 이름 혼동 + 학습로직 부재 | **"내 스타일"** 개명+문구 / 학습로직(별도 빌드) | 중~고 |

**죽은 핸들러(삭제)**: flow `2191-2192` toconnect/topreview(렌더 안됨, topreview는 caption으로 오배선), `2327` connect→preview 루프, home `KEY2SCREEN.publish`(죽음).

## B. 추가 발굴 (감사에서 나온 것)

**디자인/CTA**: 플로우 아이콘 39개가 Lucide 규칙 위반(Phosphor), 주요 CTA 햅틱 없음, 미리보기 primary CTA 2개 경합, async CTA 로딩상태 없어 더블탭 위험, "올리는 중" 스피너 안 돎, 중복 keyframe(css 260/370).

**분류/다양성**: 시술 사전(`caption-text.js:8`) 누락 多→시술명이 "사담"으로 잘림 / 레이아웃 8개 중 전후 3개 편중, 그리드·스토리·후기·공지 레이아웃 없음 / 톤 선택 실제론 없음(장식) / 색·폰트 하모니 6개 다 웜톤 / 템플릿 13개 중 전후 6개 / 스티커·배지 다양성 부족·영어 편중 / 전후 역할 자동추정 없음.

**사진편집 버그**: CORS 오염→export 조용히 null / 편집기 열림 중 compose null / `template-fit-text.js:175` focal `*2` 오타로 이미지 중앙 어긋남 / 텍스트 편집 undo 누락+플레이스홀더 잔존.

## C. 삭제 인벤토리 — ⚠️ 정직한 결론

**"안 쓰는 거 전부 삭제"는 위험.** 감사(보수적) 결과 **진짜 안전한 삭제는 극소량**:
- ✅ **안전 삭제**: `index.html:66 ITDASY_WS_SKIN_V4`(리더 0), `index.html:51 ITDASY_WORKSPACE_V2`(리더 0), 죽은 StoryEditor 주석, 위 죽은 핸들러 3개.
- ⛔ **삭제 금지(로드베어링)**: `edit`/`template` 화면·bg/crop 핸들러 — **저장된 콘텐츠 편집 시 여전히 사용됨**(홈 콘텐츠 드로어 `ACT2SCREEN`). 겉보기 레거시지만 살아있음.
- 🤔 **삭제=결정 필요(롤백 포기)**: `!HYPER`/`!SIMPLE_FLOW`/`AUTO_EDITOR` 브랜치 — 의도적 롤백코드. 그냥 지우면 롤백 능력 상실. **아래 D의 레지스트리 이식(S5) 후 "도달불가"가 기계적으로 확인되면 안전 삭제.**

## D. 유지보수 설계 (#7 "쓰레기코드 안 생기게") — 핵심

**원인**: 스텝 1개가 **7군데 분산**(SCREENS·VISIBLE_SCREENS·TITLE·CTA·RENDER·mount사다리·onCta사다리). 워크플로 바꿀 때마다 7곳 수정→하나 놓치면 고아=쓰레기. flow.js **3893줄**(1000줄 규칙 초과).

**해법**: **스텝 레지스트리 단일화** `flow/steps.js` — 스텝=테이블 한 줄`{id,title,visible,cta:{label,next},render,onEnter,onExit,onBack}`. 워크플로 변경=한 줄 수정→고아 원천 차단. 플래그=빌더 함수.
**이식 S1~S5**(각 단독배포+smoke): S1 읽기전용 미러(무동작변경)→S2 setScreen 라우팅→S3 onCta/back→S4 핸들러 분리→S5 죽은플래그 안전삭제.

---

## 실행 계획

**1단계 — 저위험 버그 배치(지금)**: #1(완료)·#2·#3·#4·#5·#6 + 안전 삭제 2개 + 죽은 핸들러 → 브라우저 회귀 → 커밋.
**2단계 — 다양성 팩**: 레이아웃/톤/하모니/템플릿/스티커 확장 + 시술 사전 확장(#5 분류).
**3단계 — 레지스트리 이식 S1~S3** (유지보수 구조) → 이후 S5에서 롤백 브랜치 안전 삭제.
**4단계 — #7 "내 스타일"** 개명·문구 + 학습로직(텍스트좌표·폰트·스티커 캡처→다음 편집기 자동적용).

_감사: 7 병렬 에이전트 · 2026-07-11_
