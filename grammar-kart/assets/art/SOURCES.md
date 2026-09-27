# Grammar Grand Prix 아트 출처

- `kart-rear-teal.webp`, `kart-left-teal.webp`, `kart-right-teal.webp`: OpenAI GPT image generation, 2026-09-27. Corrected transparent atlas generation: direct symmetric rear, screen-left yaw/lean, and screen-right yaw/lean poses.
- `kart-rear-red.webp`, `kart-left-red.webp`, `kart-right-red.webp`: the same corrected atlas generation for the red sporty kart.
- `kart-rear-yellow.webp`, `kart-left-yellow.webp`, `kart-right-yellow.webp`: the same corrected atlas generation for the yellow chunky rally kart.
- `kart-turn-atlas.webp`: corrected transparent 3×3 atlas at 768×768; rows are teal/red/yellow and columns are direct-rear/steer-left/steer-right. Each frame is 256×256.
- `neon-circuit-bg.webp`: OpenAI GPT image generation, 2026-09-27. Original wide circuit scene, exported to 1024×512 WebP for a low-spec Canvas2D background.
- `garage-bg.webp`: OpenAI GPT image generation, 2026-09-27. Original vehicle-free cyan/orange pit garage with an empty left presentation plinth and darker right UI-safe panel; exported to 1440×810 WebP (about 113KB).
- `kart-showcase-teal.webp`, `kart-showcase-red.webp`, `kart-showcase-yellow.webp`: OpenAI GPT image generation, 2026-09-27, using the corresponding original kart sprites as visual references. Transparent rear-three-quarter hero renders, exported as 512×512 WebP for the garage/showroom selection screen.
- `roadside-atlas.webp`: OpenAI GPT image generation, 2026-09-27. One transparent five-prop atlas for roadside dressing: guardrail, broadleaf tree, floodlight, chevron sign, and orange/white safety barrier. Each final frame is 256×256; source columns were separated by measured alpha gaps before export so the tree and floodlight remain intact.
- `road-guardrail.webp`, `road-tree.webp`, `road-floodlight.webp`, `road-chevron.webp`, `road-safety-barrier.webp`: the five extracted 256×256 RGBA WebP frames from `roadside-atlas.webp`, optimized for cached Canvas2D draw calls. No asphalt tile was added because the existing road geometry supplies the moving surface.
- `solo-cover.webp`: OpenAI GPT image generation, 2026-09-27, using the three original showcase kart renders as visual references. Original 16:9 coastal sunset race scene with a clear teal lead kart, red/yellow rivals, cornering, and cyan/orange speed trails; exported to 960×540 RGB WebP (about 75KB). No text or logos.
- `race-items-atlas.webp`: OpenAI GPT image generation, 2026-09-27. Transparent 640×128 RGBA WebP (about 16KB), five 128×128 cells in order: banana-left, banana-right, missile-right-with-short-trail, missile-left-with-short-trail, impact-burst.
- `race-obstacles-atlas.webp`: OpenAI GPT image generation, 2026-09-27. Transparent 576×192 RGBA WebP (about 25KB), three 192×192 cells in order: 3D traffic cone, small orange/white road barrier, 3D banana peel. Each object includes a compact grounded shadow for world-depth sorting.
- `hud-boost.webp`, `hud-shield.webp`: OpenAI GPT image generation, 2026-09-27. Original transparent 3D HUD icon atlas split into two 192×192 RGBA WebP tiles: cyan/orange turbo canister and cyan/ivory armored energy shield. Transparent margins were tightened for 48px HUD display; no text or logos.

생성 원본은 프로젝트 표시 크기에 맞춰 알파 가장자리와 해상도를 정리했다. 주행 포즈와 입장 화면용 전시 자산은 별도 파일로 제공하며, 생성 이미지에는 기존 게임·캐릭터·로고를 참조하지 않았다. 주행 자산은 성능 차이가 없고, 쇼케이스 이미지는 외형 선택용이다.
