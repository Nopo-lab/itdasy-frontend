# ITDASY — 실제 공개 뷰티 이미지 스타일 학습 QA

## 서버 API 확인

- `/instagram-style/analyze` 호출 결과: HTTP `401`
- 의미: 서버 Vision 분석은 로그인 토큰 없이는 막혀 있음. 정상적인 차단.

## 실제 이미지 다운로드/분석 결과

- FAIL `lemon8_lash_before_after` — HTTPError: HTTP Error 403: Forbidden
- `marketing_hair_story_before_after` (Salon marketing public page, 헤어)
  - 로컬 파일: `output/real-source-style-learning-qa/images/marketing_hair_story_before_after.png`
  - 크기: 825×1200, 밝기 0.391, 채도 0.232, 온도 0.106
  - 글자 후보: present=True, color=#FFFFFF, pos=middle-center, align=center, size=0.099
- `ameba_nail_handcare_before_after` (Ameba public blog, 네일)
  - 로컬 파일: `output/real-source-style-learning-qa/images/ameba_nail_handcare_before_after.jpg`
  - 크기: 864×1080, 밝기 0.741, 채도 0.133, 온도 0.063
  - 글자 후보: present=True, color=#FFFFFF, pos=middle-center, align=center, size=0.077
- FAIL `rakuten_lash_lift_before_after` — HTTPError: HTTP Error 404: Not Found
- `canva_hair_treatment_instagram_post` (Canva public template image, 헤어)
  - 로컬 파일: `output/real-source-style-learning-qa/images/canva_hair_treatment_instagram_post.jpg`
  - 크기: 1600×1600, 밝기 0.996, 채도 0.0, 온도 0.0
  - 글자 후보: present=True, color=#FFFFFF, pos=middle-center, align=center, size=0.096
- `librelash_sydney_lash_extensions` (Libre Lash Sydney public site, 속눈썹)
  - 로컬 파일: `output/real-source-style-learning-qa/images/librelash_sydney_lash_extensions.jpg`
  - 크기: 1564×1564, 밝기 0.554, 채도 0.34, 온도 0.129
  - 글자 후보: present=True, color=#15181D, pos=upper-center, align=right, size=0.045
- `soomgo_forehead_waxing_before_after` (Soomgo public portfolio image, 왁싱)
  - 로컬 파일: `output/real-source-style-learning-qa/images/soomgo_forehead_waxing_before_after.jpg`
  - 크기: 1080×1080, 밝기 0.96, 채도 0.02, 온도 0.02
  - 글자 후보: present=True, color=#15181D, pos=middle-center, align=center, size=0.099
- `lashinc_sg_4d_lash_extensions` (Lash Inc SG public shop image, 속눈썹)
  - 로컬 파일: `output/real-source-style-learning-qa/images/lashinc_sg_4d_lash_extensions.png`
  - 크기: 500×500, 밝기 0.698, 채도 0.242, 온도 0.078
  - 글자 후보: present=True, color=#FFFFFF, pos=middle-center, align=center, size=0.116
- `canva_hair_story_book_now` (Canva public template image, 헤어)
  - 로컬 파일: `output/real-source-style-learning-qa/images/canva_hair_story_book_now.jpg`
  - 크기: 450×800, 밝기 0.141, 채도 0.108, 온도 0.012
  - 글자 후보: present=True, color=#FFFFFF, pos=middle-center, align=center, size=0.098

## 서비스별 학습 프로필

- 네일: samples=1, textUsage=1.0, axes={"align": "center", "position": "middle-center", "color": "#FFFFFF", "sizeRatioMedian": 0.077, "tone": {"brightness": 0.741, "saturation": 0.133, "warmth": 0.063}}
- 속눈썹: samples=2, textUsage=1.0, axes={"align": "center", "position": "middle-center", "color": "#15181D", "sizeRatioMedian": 0.081, "tone": {"brightness": 0.626, "saturation": 0.291, "warmth": 0.104}}
- 왁싱: samples=1, textUsage=1.0, axes={"align": "center", "position": "middle-center", "color": "#15181D", "sizeRatioMedian": 0.099, "tone": {"brightness": 0.96, "saturation": 0.02, "warmth": 0.02}}
- 헤어: samples=3, textUsage=1.0, axes={"align": "center", "position": "middle-center", "color": "#FFFFFF", "sizeRatioMedian": 0.098, "tone": {"brightness": 0.391, "saturation": 0.108, "warmth": 0.012}}

## 한계

- 로컬 분석은 OCR이 아니라 픽셀 기반 글자 후보 추정이다.
- QA 로그인 토큰이 있으면 같은 이미지 파일을 서버 Vision API로 다시 돌릴 수 있다.
