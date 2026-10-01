# Grammar Kart clean-v2 art

- Source: AI-generated transparent kart sprite atlas, created 2026-10-01 with the built-in image generation tool.
- The initial 1536 × 1536 atlas is preserved as `output/art-review/kart-clean-v2-atlas-v1-original.png`.
- A single alpha-edge cleanup edit removed the visible green/cyan and white fringe while preserving the nine sprites, their poses, and the 3 × 3 layout. The edited source returned at 1254 × 1254 RGBA and is preserved as `output/art-review/kart-clean-v2-atlas-v2-edit-raw.png`.
- `output/art-review/kart-clean-v2-atlas.png` is that edited source resampled once to 1536 × 1536 with Lanczos, giving exact 512 × 512 cells.
- Each WebP sprite is a direct 512 × 512 crop from the edited atlas; transparency is retained.
- Columns: `teal` (mint race kart), `red` (orange rally kart), `yellow` (purple future kart). Rows: `rear`, `left` steering, `right` steering. The legacy color keys are retained for app compatibility.
- No external source images or reference assets were used.

## Coastal roadside atlas
- Original GPT-generated transparent oak, palm, pine and racing barrier atlas, 2026-10-01.
- Runtime: roadside.webp (1024 × 1024 RGBA); no third-party game artwork used.

## Coastal background
- Original GPT-generated painted coastal racing environment, 2026-10-01.
- Runtime: coastal-sky.webp (1280 × 720), resized once from the generated PNG.
