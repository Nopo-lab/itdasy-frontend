/* 사진 편집기 — PE-AI-1A 추천값 기본표 (순수 데이터)
   온디바이스 부위 인식 → 슬라이더 추천. LLM/API 호출 0.
   값은 모두 보수적. 키는 전부 app-photo-editor-beauty.js 의 SLIDERS 화이트리스트 내.
   - hairVolume: 형태변형 아님. "볼륨감 보조"로 최대 12.
   - handSkin/coolness: 손 전용 정밀 마스크 미연결 → 항상 약하게(상한).
   - closeUpDetail / hairColor / hairyArm: AI-1A 제외 (AI-1B Vision 에서 재검토). */
(function () {
  'use strict';
  if (window.PhotoEditorRecoMap) return;

  // 부위(presentRegions 키) → 추천 슬라이더 묶음.
  //   base = strong(신뢰도≥0.7) 추천값. weak(0.4~0.7) 는 UI 에서 base×0.6.
  //   cap  = 상한 (weak 환산 후에도 이 값을 넘지 않음).
  const RECO = {
    skin: [
      { key: 'skin',          base: 25 },
      { key: 'redness',       base: 22 },
      { key: 'blemish',       base: 18 },
      { key: 'textureSmooth', base: 18 },
      { key: 'yellowness',    base: 18 },
    ],
    eye: [
      { key: 'irisClear',     base: 22 },
      { key: 'catchLight',    base: 18 },
      { key: 'eyeColor',      base: 18 },
      { key: 'underEyeClean', base: 18 },
      { key: 'eyeShadow',     base: 15 },
    ],
    brow:   [ { key: 'browSharp',  base: 24 } ],
    lash:   [ { key: 'lashSharp',  base: 28 } ],
    sclera: [ { key: 'eyeRedness', base: 22 } ],
    lip:    [ { key: 'lipPop',     base: 25 } ],
    nail: [
      { key: 'nailGloss',     base: 38 },
      { key: 'nailShape',     base: 20 },
    ],
    hair: [
      { key: 'hairShine',     base: 30 },
      { key: 'hairEndsClean', base: 20 },
      { key: 'hairColorPop',  base: 20 },
      { key: 'scalpBoost',    base: 12 },
      { key: 'hairDetail',    base: 18 },
      { key: 'hairVolume',    base: 12, cap: 12, assist: true },  // "볼륨감 보조"만
    ],
    // 손: 전용 정밀 마스크 unwired → nailMask(Hand Landmarker) 로 손 존재 감지될 때만, 약하게.
    hand: [
      { key: 'handSkin',      base: 10, cap: 10 },
      { key: 'coolness',      base: 12, cap: 12 },
    ],
  };

  const REGION_LABEL = {
    skin: '피부', eye: '눈', brow: '눈썹', lash: '속눈썹', sclera: '흰자',
    lip: '입술', nail: '네일', hair: '헤어', hand: '손',
  };

  // 칩 표기용 짧은 라벨 (SLIDERS 와 의미 동일, 칩에 맞게 축약). 키는 동일.
  const SLIDER_LABEL = {
    skin: '피부톤 정리', redness: '붉은기 완화', blemish: '잡티 완화', textureSmooth: '결 정리', yellowness: '노란기 완화',
    irisClear: '눈동자 또렷', catchLight: '눈빛 반짝임', eyeColor: '아이 색감', underEyeClean: '눈밑 칙칙함', eyeShadow: '눈가 그림자',
    browSharp: '선명도(눈썹)', lashSharp: '속눈썹 선명도', eyeRedness: '눈 붉음 완화', lipPop: '입술 발색',
    nailGloss: '네일 광택', nailShape: '네일 경계 선명',
    hairShine: '모발 윤기', hairEndsClean: '머리끝 정리', hairColorPop: '염색 컬러 강조', scalpBoost: '두피 톤 보정', hairDetail: '머리결 선명도', hairVolume: '볼륨감 보조',
    handSkin: '손/발 피부톤', coolness: '푸른기 완화',
  };

  window.PhotoEditorRecoMap = { RECO, REGION_LABEL, SLIDER_LABEL };
})();
