#!/bin/bash
# 프론트엔드 번들링: 12개 JS → 1개 minified 파일

FILES=(
  app-core.js
  app-spec-validator.js
  app-instagram.js
  app-caption.js
  app-ai.js
  app-gallery.js
  app-gallery-bg.js
  app-gallery-element.js
  app-gallery-review.js
  app-gallery-write.js
  app-gallery-finish.js
  app-persona.js
)

echo "번들링 시작..."
cat "${FILES[@]}" > app.bundle.js
npx esbuild app.bundle.js --minify --outfile=app.bundle.min.js --target=es2020

ORIG=$(cat "${FILES[@]}" | wc -c)
MIN=$(wc -c < app.bundle.min.js)
echo "원본: $(($ORIG / 1024))KB → 번들: $(($MIN / 1024))KB ($(( (ORIG - MIN) * 100 / ORIG ))% 절감)"
echo "번들링 완료: app.bundle.min.js"
