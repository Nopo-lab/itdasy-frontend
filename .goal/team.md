# Goal / Team — Photo Editor Upgrade

Updated: 2026-05-21

## Goal

Make the Itdasy photo editor feel like a salon-owner-first beauty editing app:

- Fast first result: local, no-wait edits for normal use.
- Accurate detail edits: skin, hair, eyes, hands, nails, and background should not bleed into each other.
- Simple workflow: choose photo → pick salon goal → adjust only if needed → export feed/story/template.
- Premium output: service name, price, brand, before/after, and templates should be ready for SNS posting.

## Product Rule

Do not add random editing features just because competitor apps have them.
Add only what helps salon owners post cleaner before/after, result, menu, price, and booking photos faster.

## Team

- T1 Strategy / UX: decide what belongs on the first screen and what should stay hidden in advanced tools.
- T2 Frontend: implement local editor, masks, menu flow, touch controls, export, and template polish.
- T4 QA: verify with real nail, hair, lash, skin, and background photos. Check delay, broken rendering, and export.
- Backend / paid AI: only for slow or paid features such as high-quality erase, generative fill, and upscale.

## Current Sprint

T-600 Photo Editor Competitive Upgrade

Priority order:

1. P0: smart local masks for skin / hair / eye / nail / background safety.
2. P0: merge duplicated menu wording and surface salon presets clearly.
3. P1: model-backed segmentation for hair / skin / person where it can run without freezing.
4. P1: magic cleanup brush for flyaways, hair ends, lash gaps, cuticle area, and blemishes.
5. P1: batch salon export: feed 4:5, story 9:16, before/after, and price card.
6. P2: paid slow AI for generative erase, fill, upscale, and virtual try-on.

## Done Means

- No pink/white mask blobs in result canvas.
- Detail edits affect the intended area more than background.
- Text and templates stay movable and export cleanly.
- Large phone photos open without visible long freeze.
- Browser QA passes before push.
