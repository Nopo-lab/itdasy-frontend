# T-601 자가검토

1. 변경 파일 목록
   - `.ai/APP_FEATURE_INDEX.md`
   - `.ai/BOARD.md`
   - `.ai/SESSION_STATE.md`
   - `css/itd-editor.css`
   - `css/screens/sub-screens.css`
   - `js/itd-editor/itd-editor.js`
   - `js/itd-editor/data/itd-beauty-stickers.js`
   - `js/itd-editor/__tests__/beauty-stickers-2026-09-14.test.js`
   - `js/load-groups.js`
   - `js/workspace/work-memory.js`
   - `js/workspace/work-memory-engine.js`
   - `js/workspace/work-memory-policy.js`
   - `js/workspace/work-memory-consent-ui.js`
   - `js/workspace/workspace-settings.js`
   - `js/workspace/workspace-v2-flow.js`
   - `js/workspace/workspace-v2-home.js`
   - `js/workspace/__tests__/*work-memory*`
   - `scripts/ws-flow-smoke.js`
   - `output/WORKSHOP_NORTH_STAR_IMPLEMENTATION_2026-09-14.md`
2. `index.html` 스크립트 로드 순서 영향 없음. 새 파일은 기존 load-groups 경로에 추가.
3. 새 전역은 `window.WorkMemoryPolicy`, `window.WorkMemoryConsentUI`이며 작업실 모듈 전역 패턴과 일치.
4. localStorage는 기존 작업기억 저장소 helper를 통해 사용. 레거시 토큰 키 직접 사용 없음.
5. Capacitor 네이티브 설정 변경 없음.
6. Supabase 직접 쿼리 없음.
7. 새 큰 화면을 만들지 않고 정책·동의·스티커 데이터를 작은 파일로 분리.
8. 빈 `catch {}` 추가 없음.
9. 커밋 메시지에 `T-601` 포함 예정.
10. 확인 통과:
    - `npm test -- --runInBand` 192묶음, 3,124개 통과
    - `npm run lint:ci` 오류 0개
    - `node scripts/smoke-check.js --git` 통과
    - `npm run smoke:flow` 9/9 통과
    - `npm run audit:overlay` 통과
    - 현재 작업실 브라우저 QA: 보정 기억 적용·빼기, 저장·재편집, 스티커 1개 격리, 선택 프리셋 표시 확인
